// recallcheck_math.js — 再召喚で荷物が戻ったとき、手元を確かめる小さな俯き POLISH-ANIM-RECALLCHECK-01 (純粋核)
// 作り込みトラック cycle1238 新規発案: 0-C3 で個別情報まで戻るようになった荷物を、
// 復元直後に一度だけ見下ろして確かめる。表示層のみ (復元の成否・個数には触らない)。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX } from "./gaze_math.js";

export const RECALLCHECK_DURATION_MS = 900;
export const RECALLCHECK_MAX_DEG = 18;
export const RECALLCHECK_COOLDOWN_MS = 30000;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

export function recallcheckPitchOffset(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= RECALLCHECK_DURATION_MS) return null;
    const t = e / RECALLCHECK_DURATION_MS;
    const k = t < 0.3 ? Math.sin((t / 0.3) * Math.PI / 2)
            : t < 0.65 ? 1
            : Math.cos(((t - 0.65) / 0.35) * Math.PI / 2);
    return RECALLCHECK_MAX_DEG * k;
  } catch { return null; }
}

export function applyRecallcheckPitch(basePitchDeg, elapsedMs) {
  try {
    const off = recallcheckPitchOffset(elapsedMs);
    if (off === null || !Number.isFinite(basePitchDeg)) return basePitchDeg;
    return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

export function isRecallcheckActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    return recallcheckPitchOffset(n - s) !== null;
  } catch { return false; }
}

// restoredCount >= 1 のときだけ (空の復元では発火しない)
export function shouldRecallcheck(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (typeof input.restoredCount !== "number" || !Number.isFinite(input.restoredCount) || input.restoredCount < 1) return false;
    const n = finiteOrNull(input.nowMs); if (n === null) return false;
    const last = finiteOrNull(input.lastFiredMs);
    if (last === null) return true;
    return n - last >= RECALLCHECK_COOLDOWN_MS;
  } catch { return false; }
}
