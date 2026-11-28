// torch_guard_math.js — TORCH-SPACING-01 縮小形＋TORCH-RETRY-NOBACKOFF-01 新形 (cyc2495 A08 確定・cyc2499 A13 条件A・cyc2500 統合): 自律松明の間隔と失敗冷却の純粋核。
//   純粋モジュール: @minecraft/server を import しない。例外を投げない。状態は引数の state のみを変更する。
// 解く欠陥:
//   SPACING: 従来の抑制は設置成功セルの完全一致のみ (planner torchViable) で、1セル横へ動けば即再選出され実効間隔1セル/約1秒だった。
//     → torchWithinSpacing で前回設置セルからの水平距離 < TORCH_SPACING_CELLS (6) を抑制対象へ一般化する (planner 側が本核を使う)。
//     既存光源の近傍抑制は実光量が取れないため前提棄却として含めない (cyc2497 A08)。
//   RETRY: placeTorch の SET_FAILED / API_ERROR は冷却が無く、次周期に再選出・再試行を無期限に繰り返しうる。
//     → deposit_guard 型 {fails, cooldownUntil, lastReason} を横展開し、対象理由だけを数え、連続 TORCH_FAIL_LIMIT 回で TORCH_COOLDOWN_MS 冷却する。
//     NO_SUPPORT / NOT_DARK / NO_MATERIAL は試行失敗として数えない (選出ゲート・事前条件で落ちるため)。

export const TORCH_SPACING_CELLS = 6;
export const TORCH_FAIL_LIMIT = 3;
export const TORCH_COOLDOWN_MS = 60000;
const COUNTED_REASONS = new Set(["SET_FAILED", "API_ERROR"]);

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// createTorchGuardState() -> { fails, cooldownUntil, lastReason }
export function createTorchGuardState() { return { fails: 0, cooldownUntil: 0, lastReason: null }; }

// noteTorchFailure(state, reason, nowMs) -> { action, fails, reason }
//  - 対象理由 (SET_FAILED/API_ERROR) のみ加算。上限到達で cooldownUntil=now+TORCH_COOLDOWN_MS・fails=0。action="cooldown"
//  - 対象外理由・入力不正: 状態不変。action="ignored"/"invalid"
export function noteTorchFailure(state, reason, nowMs) {
  try {
    if (!state || typeof state !== "object") return { action: "invalid", fails: 0, reason: null };
    const now = finiteOrNull(nowMs);
    if (now === null || !COUNTED_REASONS.has(reason)) return { action: "ignored", fails: state.fails || 0, reason: null };
    state.fails = (typeof state.fails === "number" && Number.isFinite(state.fails) ? state.fails : 0) + 1;
    state.lastReason = reason;
    if (state.fails >= TORCH_FAIL_LIMIT) {
      state.cooldownUntil = now + TORCH_COOLDOWN_MS;
      state.fails = 0;
      return { action: "cooldown", fails: 0, reason };
    }
    return { action: "fail", fails: state.fails, reason };
  } catch { return { action: "invalid", fails: 0, reason: null }; }
}

// noteTorchSuccess(state) -> { action } : 設置成功で失敗数と冷却をリセットする。
export function noteTorchSuccess(state) {
  try {
    if (!state || typeof state !== "object") return { action: "invalid" };
    state.fails = 0; state.cooldownUntil = 0; state.lastReason = null;
    return { action: "reset" };
  } catch { return { action: "invalid" }; }
}

// isTorchCooling(state, nowMs) -> boolean : 冷却中か (不正入力は false)。
export function isTorchCooling(state, nowMs) {
  try {
    if (!state || typeof state !== "object") return false;
    const now = finiteOrNull(nowMs), until = finiteOrNull(state.cooldownUntil);
    return now !== null && until !== null && now < until;
  } catch { return false; }
}

// torchWithinSpacing(doneCell, pos, spacingCells?) -> boolean
//  doneCell: "x,y,z" 形式の前回設置セル文字列。pos: {x,z} (実座標。床関数は本核で行う)。
//  水平距離 (セル中心同士ではなく床セル同士) が spacing 未満なら true。パース不能は false (抑制しない)。
export function torchWithinSpacing(doneCell, pos, spacingCells) {
  try {
    if (typeof doneCell !== "string" || !pos || typeof pos !== "object") return false;
    const parts = doneCell.split(",").map((s) => Number(s));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return false;
    const px = finiteOrNull(pos.x), pz = finiteOrNull(pos.z);
    if (px === null || pz === null) return false;
    const sp = finiteOrNull(spacingCells) ?? TORCH_SPACING_CELLS;
    const dx = Math.floor(px) - parts[0], dz = Math.floor(pz) - parts[2];
    return Math.sqrt(dx * dx + dz * dz) < sp;
  } catch { return false; }
}
