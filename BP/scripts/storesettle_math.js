// storesettle_math.js — POLISH-ANIM-STORESETTLE-01 (cycle0505 新規発案): チェスト等への格納 (STORE) 成功直後の小さな収納の仕草 (純粋核)
// 発火源は lastAction の STORE 成功の辺。DELIVERBOW (主人への手渡し)・PLACESETTLE (設置) とは発火源が別:
// こちらは格納ごと・下向き6度・500ms・一山波形で、物をしまい終えた所作を視線だけで表す。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。表示層のみ・実機確認待ち。
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX } from "./gaze_math.js";

export const STORESETTLE_DURATION_MS = 500;
export const STORESETTLE_MAX_DEG = 6;
export const STORESETTLE_COOLDOWN_MS = 4000;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

export function storesettlePitchOffset(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= STORESETTLE_DURATION_MS) return null;
    const t = e / STORESETTLE_DURATION_MS;
    const k = t < 0.3 ? Math.sin((t / 0.3) * Math.PI / 2)
            : t < 0.55 ? 1
            : Math.cos(((t - 0.55) / 0.45) * Math.PI / 2);
    return STORESETTLE_MAX_DEG * k;
  } catch { return null; }
}

export function applyStoresettlePitch(basePitchDeg, elapsedMs) {
  try {
    const off = storesettlePitchOffset(elapsedMs);
    if (off === null || !Number.isFinite(basePitchDeg)) return basePitchDeg;
    return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

export function isStoresettleActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    return storesettlePitchOffset(n - s) !== null;
  } catch { return false; }
}

// shouldStoresettle(input): { stored, suppressed, lastFiredMs, nowMs }
export function shouldStoresettle(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.stored !== true || input.suppressed === true) return false;
    const n = finiteOrNull(input.nowMs);
    if (n === null) return false;
    const last = finiteOrNull(input.lastFiredMs);
    if (last === null) return true;
    return n - last >= STORESETTLE_COOLDOWN_MS;
  } catch { return false; }
}
