// settle_math.js — POLISH-ANIM-SETTLE-01 (cycle2058): 掘削を1つ終えた直後の小さな「確認の間」視線 (純粋核)
// 発火源は commitLastAction が記録する r.lastAction の BREAK 成功 (seq の変化)。
// 納品時の NOD-01・入手時の INSPECT-01 とは別イベント: こちらは掘削完了ごと・下向き8度・450ms。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。表示層のみ。
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX } from "./gaze_math.js";

export const SETTLE_DURATION_MS = 450;
export const SETTLE_MAX_DEG = 8;
export const SETTLE_COOLDOWN_MS = 4000;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// settlePitchOffset(elapsedMs) -> 追加ピッチ (度, 下向き正) | null
export function settlePitchOffset(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= SETTLE_DURATION_MS) return null;
    const t = e / SETTLE_DURATION_MS;
    const k = t < 0.3 ? Math.sin((t / 0.3) * Math.PI / 2)
            : t < 0.55 ? 1
            : Math.cos(((t - 0.55) / 0.45) * Math.PI / 2);
    return SETTLE_MAX_DEG * k;
  } catch { return null; }
}

export function applySettlePitch(basePitchDeg, elapsedMs) {
  try {
    const off = settlePitchOffset(elapsedMs);
    if (off === null || !Number.isFinite(basePitchDeg)) return basePitchDeg;
    return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

export function isSettleActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    return settlePitchOffset(n - s) !== null;
  } catch { return false; }
}

// shouldSettle(input): { broke, suppressed, lastFiredMs, nowMs }
// 掘削成功の辺でのみ、抑制中 (危険/落下/水中) は発火せず、冷却 4 秒。
export function shouldSettle(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.broke !== true || input.suppressed === true) return false;
    const n = finiteOrNull(input.nowMs);
    if (n === null) return false;
    const last = finiteOrNull(input.lastFiredMs);
    if (last === null) return true;
    return n - last >= SETTLE_COOLDOWN_MS;
  } catch { return false; }
}
