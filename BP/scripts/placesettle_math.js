// placesettle_math.js — POLISH-ANIM-PLACESETTLE-01 (cycle2248): 設置を1つ終えた直後の小さな「置き場所の確認」視線 (純粋核)
// 発火源は commitLastAction が記録する r.lastAction の PLACE 成功 (seq の変化)。
// SETTLE-01 (BREAK完了・下向き8度・450ms) とは別イベント: こちらは設置完了ごと・下向き5度・380ms・冷却5秒。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。表示層のみ。
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX } from "./gaze_math.js";

export const PLACESETTLE_DURATION_MS = 380;
export const PLACESETTLE_MAX_DEG = 5;
export const PLACESETTLE_COOLDOWN_MS = 5000;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// placesettlePitchOffset(elapsedMs) -> 追加ピッチ (度, 下向き正) | null
export function placesettlePitchOffset(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= PLACESETTLE_DURATION_MS) return null;
    const t = e / PLACESETTLE_DURATION_MS;
    const k = t < 0.35 ? Math.sin((t / 0.35) * Math.PI / 2)
            : t < 0.6 ? 1
            : Math.cos(((t - 0.6) / 0.4) * Math.PI / 2);
    return PLACESETTLE_MAX_DEG * k;
  } catch { return null; }
}

export function applyPlacesettlePitch(basePitchDeg, elapsedMs) {
  try {
    const off = placesettlePitchOffset(elapsedMs);
    if (off === null || !Number.isFinite(basePitchDeg)) return basePitchDeg;
    return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

export function isPlacesettleActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    return placesettlePitchOffset(n - s) !== null;
  } catch { return false; }
}

// shouldPlacesettle(input): { placed, suppressed, lastFiredMs, nowMs }
// 設置成功の辺でのみ、抑制中 (危険/落下/水中) は発火せず、冷却 5 秒。
export function shouldPlacesettle(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.placed !== true || input.suppressed === true) return false;
    const n = finiteOrNull(input.nowMs);
    if (n === null) return false;
    const last = finiteOrNull(input.lastFiredMs);
    if (last === null) return true;
    return n - last >= PLACESETTLE_COOLDOWN_MS;
  } catch { return false; }
}
