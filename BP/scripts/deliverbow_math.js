// deliverbow_math.js — POLISH-ANIM-DELIVERBOW-01 (cycle0446 新規発案): 手渡し成功直後の小さな会釈 (純粋核)
// 発火源は planner deliver_to_owner の移送成功 (moved>0) の辺。拠点入庫時の NOD-01・掘削完了の
// SETTLE-01 とは発火源が別: こちらは主人への手渡しごと・下向き10度・650ms・一山波形。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。表示層のみ。
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX } from "./gaze_math.js";

export const DELIVERBOW_DURATION_MS = 650;
export const DELIVERBOW_MAX_DEG = 10;
export const DELIVERBOW_COOLDOWN_MS = 5000;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// deliverBowPitchOffset(elapsedMs) -> 追加ピッチ (度, 下向き正) | null
export function deliverBowPitchOffset(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= DELIVERBOW_DURATION_MS) return null;
    const t = e / DELIVERBOW_DURATION_MS;
    const k = t < 0.35 ? Math.sin((t / 0.35) * Math.PI / 2)
            : t < 0.6 ? 1
            : Math.cos(((t - 0.6) / 0.4) * Math.PI / 2);
    return DELIVERBOW_MAX_DEG * k;
  } catch { return null; }
}

export function applyDeliverBowPitch(basePitchDeg, elapsedMs) {
  try {
    const off = deliverBowPitchOffset(elapsedMs);
    if (off === null || !Number.isFinite(basePitchDeg)) return basePitchDeg;
    return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

export function isDeliverBowActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    return deliverBowPitchOffset(n - s) !== null;
  } catch { return false; }
}

// shouldDeliverBow(input): { delivered, suppressed, lastFiredMs, nowMs }
export function shouldDeliverBow(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.delivered !== true || input.suppressed === true) return false;
    const n = finiteOrNull(input.nowMs);
    if (n === null) return false;
    const last = finiteOrNull(input.lastFiredMs);
    if (last === null) return true;
    return n - last >= DELIVERBOW_COOLDOWN_MS;
  } catch { return false; }
}
