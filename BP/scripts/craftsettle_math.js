// craftsettle_math.js — POLISH-ANIM-CRAFTSETTLE-01 (cycle0141): 作り終えた直後の小さな「出来上がりの確認」視線 (純粋核)
// 発火源は commitLastAction が記録する r.lastAction の CRAFT / SMELT 成功 (seq の変化)。
// SETTLE-01 (BREAK完了)・PLACESETTLE-01 (PLACE完了) とは別イベント: こちらは製作/精錬完了ごと。
// 波形は二山 (手元→成果物へ視線が2回小さく寄る) で既存の単山と区別する。下向き6度・520ms・冷却6秒。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。表示層のみ。
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX } from "./gaze_math.js";

export const CRAFTSETTLE_DURATION_MS = 520;
export const CRAFTSETTLE_MAX_DEG = 6;
export const CRAFTSETTLE_COOLDOWN_MS = 6000;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// craftsettlePitchOffset(elapsedMs) -> 追加ピッチ (度, 下向き正) | null
export function craftsettlePitchOffset(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= CRAFTSETTLE_DURATION_MS) return null;
    const t = e / CRAFTSETTLE_DURATION_MS;
    // 二山波形: 0〜0.4 で一山目、0.4〜0.55 で半分戻し、0.55〜1 で二山目から復帰
    const k = t < 0.4 ? Math.sin((t / 0.4) * Math.PI / 2)
            : t < 0.55 ? 1 - 0.45 * Math.sin(((t - 0.4) / 0.15) * Math.PI / 2)
            : t < 0.75 ? 0.55 + 0.3 * Math.sin(((t - 0.55) / 0.2) * Math.PI / 2)
            : 0.85 * Math.cos(((t - 0.75) / 0.25) * Math.PI / 2);
    return CRAFTSETTLE_MAX_DEG * Math.max(0, Math.min(1, k));
  } catch { return null; }
}

export function applyCraftsettlePitch(basePitchDeg, elapsedMs) {
  try {
    const off = craftsettlePitchOffset(elapsedMs);
    if (off === null || !Number.isFinite(basePitchDeg)) return basePitchDeg;
    return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

export function isCraftsettleActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    return craftsettlePitchOffset(n - s) !== null;
  } catch { return false; }
}

// shouldCraftsettle(input): { crafted, suppressed, lastFiredMs, nowMs }
export function shouldCraftsettle(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.crafted !== true || input.suppressed === true) return false;
    const n = finiteOrNull(input.nowMs);
    if (n === null) return false;
    const last = finiteOrNull(input.lastFiredMs);
    if (last === null) return true;
    return n - last >= CRAFTSETTLE_COOLDOWN_MS;
  } catch { return false; }
}
