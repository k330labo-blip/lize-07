// stow_math.js — POLISH-ANIM-STOW-01 純粋核 (cycle0522 統合)
// ひと区切りの作業セッションが終わった直後の、小さな「道具をしまう」仕草。
// 発案正本: brain_parts/solutions/polish-backlog/cycle0505_new_idea.md (§4 契約案)
// 本ファイルはドラフト置き場専用。統合時に BP/scripts/stow_math.js へ移し、
// ローカル写しのクランプ定数を ./gaze_math.js の import へ置換すること (CONTRACT.md §5)。
// 純粋・決定的・例外なし: @minecraft/server を import しない、相対 import を持たない、
// Date.now/乱数なし (時刻は全て引数)、入力 state を破壊しない (更新は新オブジェクトを返す)。
// 表示層のみ: 移動・作業・掘削可否・所持個数には一切触らない。実機確認待ち。
"use strict";

export const STOW_SESSION_MIN_MS = 8000;   // セッション成立に必要な継続時間
export const STOW_SESSION_MIN_COUNT = 3;   // セッション成立に必要な成功回数
export const STOW_GAP_END_MS = 1200;       // 最後の成功から終了確定までの無作業時間
export const STOW_LINK_MS = 3000;          // この間隔以内の成功は同一セッション
export const STOW_DURATION_MS = 700;
export const STOW_MAX_PITCH_DEG = 14;      // 視線ピッチ最大 (下向き正)
export const STOW_MAX_ARM_DEG = 38;        // 腕の下ろし量 (当面は記録のみ、CONTRACT.md §4)
export const STOW_COOLDOWN_MS = 20000;
export const STOW_LOWER_END_MS = 250;      // phase 境界: lower [0,250) / hold [250,450) / return [450,700)
export const STOW_HOLD_END_MS = 450;

import { GAZE_PITCH_MIN as PITCH_MIN, GAZE_PITCH_MAX as PITCH_MAX } from "./gaze_math.js"; // cycle0522 統合: ローカル写しを gaze_math へ置換
const WORK_KINDS = new Set(["BREAK", "PLACE", "CRAFT", "SMELT"]); // STORE は含めない (STORESETTLE の領分、CONTRACT.md §2)

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clampPitch(v) { return Math.max(PITCH_MIN, Math.min(PITCH_MAX, v)); }
function cloneState(s) {
  return {
    sessionStartMs: fin(s?.sessionStartMs),
    lastWorkMs: fin(s?.lastWorkMs),
    successCount: Number.isFinite(s?.successCount) && s.successCount > 0 ? Math.floor(s.successCount) : 0,
    sessionArmed: s?.sessionArmed === true,
    firedAtMs: fin(s?.firedAtMs),
    lastFiredMs: fin(s?.lastFiredMs),
  };
}
function clearedSession(s) { const n = cloneState(s); n.sessionStartMs = null; n.lastWorkMs = null; n.successCount = 0; n.sessionArmed = false; return n; }

// createStowState() -> 揮発 state (永続化しない)
export function createStowState() {
  return { sessionStartMs: null, lastWorkMs: null, successCount: 0, sessionArmed: false, firedAtMs: null, lastFiredMs: null };
}

// noteStowWork(state, { nowMs, kind, success }) -> 新しい state (元は不変)
// kind が WORK_KINDS かつ success===true の観測だけを数える。それ以外は state を (複製して) そのまま返す。
// 直前の成功から STOW_LINK_MS を超えていれば、その成功から新しいセッションとして数え直す。
// sessionArmed は「継続 >= MIN_MS かつ 成功 >= MIN_COUNT」を満たした観測の時点で立つ。
export function noteStowWork(state, input) {
  try {
    if (!state || typeof state !== "object") return createStowState();
    const base = cloneState(state);
    if (!input || typeof input !== "object") return base;
    const now = fin(input.nowMs);
    if (now === null || input.success !== true || !WORK_KINDS.has(input.kind)) return base;
    if (base.lastWorkMs === null || now - base.lastWorkMs > STOW_LINK_MS || now < base.lastWorkMs) {
      base.sessionStartMs = now; base.successCount = 1; base.sessionArmed = false;
    } else {
      if (base.sessionStartMs === null) base.sessionStartMs = now;
      base.successCount += 1;
    }
    base.lastWorkMs = now;
    base.sessionArmed = base.successCount >= STOW_SESSION_MIN_COUNT
      && base.sessionStartMs !== null && (now - base.sessionStartMs) >= STOW_SESSION_MIN_MS;
    return base;
  } catch { return createStowState(); }
}

// noteStowTick(state, { nowMs, workActive, suppressed, overlayActive, toolTypeId })
//   -> { state, fired, toolTypeId }
// 発火は「成立済みセッションがあり、最後の成功から GAP_END 以上経ち、workActive!==true、
// suppressed!==true、overlayActive!==true、冷却経過済み」の全てを満たす最初の1回だけ。
// 終了確定 (gap 到達かつ workActive!==true) の時点で、抑制・上位重畳・冷却により発火できない場合も
// セッションは消費する (遅れ発火なし)。workActive===true の間は終了未確定として消費しない。
// 未成立セッションも gap 到達で失効させる。toolTypeId は判定に使わず記録用にそのまま返す。
export function noteStowTick(state, input) {
  const toolTypeId = (input && typeof input === "object" && typeof input.toolTypeId === "string") ? input.toolTypeId : null;
  try {
    if (!state || typeof state !== "object" || !input || typeof input !== "object") return { state: createStowState(), fired: false, toolTypeId };
    const base = cloneState(state);
    const now = fin(input.nowMs);
    if (now === null || base.lastWorkMs === null) return { state: base, fired: false, toolTypeId };
    if (now - base.lastWorkMs < STOW_GAP_END_MS) return { state: base, fired: false, toolTypeId };
    if (input.workActive === true) return { state: base, fired: false, toolTypeId }; // 終了未確定: 消費しない
    const wasArmed = base.sessionArmed === true;
    const next = clearedSession(base); // ここから先は成立/未成立を問わず終了として消費
    if (!wasArmed) return { state: next, fired: false, toolTypeId };
    if (input.suppressed === true || input.overlayActive === true) return { state: next, fired: false, toolTypeId };
    if (next.lastFiredMs !== null && now - next.lastFiredMs < STOW_COOLDOWN_MS) return { state: next, fired: false, toolTypeId };
    next.firedAtMs = now; next.lastFiredMs = now;
    return { state: next, fired: true, toolTypeId };
  } catch { return { state: createStowState(), fired: false, toolTypeId }; }
}

// stowOffset(elapsedMs) -> { gazePitchDeg, armPitchDeg, phase } | null
// 波形は単一山: lower は sin で ease-out に最大へ、hold は最大保持、return は cos で 0 へ。
// elapsed=0 で両値 0、域外・負値・非有限数は null (=完全に素へ戻る出口)。
export function stowOffset(elapsedMs) {
  try {
    const e = fin(elapsedMs);
    if (e === null || e < 0 || e >= STOW_DURATION_MS) return null;
    let k, phase;
    if (e < STOW_LOWER_END_MS) { k = Math.sin((e / STOW_LOWER_END_MS) * Math.PI / 2); phase = "lower"; }
    else if (e < STOW_HOLD_END_MS) { k = 1; phase = "hold"; }
    else { k = Math.cos(((e - STOW_HOLD_END_MS) / (STOW_DURATION_MS - STOW_HOLD_END_MS)) * Math.PI / 2); phase = "return"; }
    return { gazePitchDeg: STOW_MAX_PITCH_DEG * k, armPitchDeg: STOW_MAX_ARM_DEG * k, phase };
  } catch { return null; }
}

// applyStowPitch(basePitchDeg, elapsedMs) -> 度
// オフセットが null、または base が非有限なら base をそのまま返す。それ以外は加算してクランプ。
export function applyStowPitch(basePitchDeg, elapsedMs) {
  try {
    const off = stowOffset(elapsedMs);
    if (off === null || !Number.isFinite(basePitchDeg)) return basePitchDeg;
    return clampPitch(basePitchDeg + off.gazePitchDeg);
  } catch { return basePitchDeg; }
}

// isStowActive(startedAtMs, nowMs) -> boolean (時刻巻き戻しは false)
export function isStowActive(startedAtMs, nowMs) {
  try {
    const s = fin(startedAtMs), n = fin(nowMs);
    if (s === null || n === null) return false;
    return stowOffset(n - s) !== null;
  } catch { return false; }
}
