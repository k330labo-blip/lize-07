// doubletake_math.js — POLISH-ANIM-DOUBLETAKE-01 純粋核 (cycle0403, A10ドラフト仕様に基づき統括実装)
// 主人の距離が歩行ではあり得ない速さで縮んだ辺でのみ発火する二度見。表示層専用。
export const DT_FAR_MIN = 14;
export const DT_NEAR_MAX = 4.5;
export const DT_MAX_GAP_MS = 1500;
export const DT_MIN_SPEED = 12;
export const DT_DURATION_MS = 700;
export const DT_COOLDOWN_MS = 30000;
export const DT_REARM_MS = 5000;
export const DT_AVERT_YAW_DEG = 18;
export const DT_LOOK_PITCH_DEG = -3;
export function createDoubletakeState() { return { prevDist: null, prevAtMs: null, firedAtMs: null, lastTriggerMs: null, rearmUntilMs: 0 }; }
function finite(n) { return typeof n === "number" && Number.isFinite(n); }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function smooth(v) { const t = clamp01(v); return t * t * (3 - 2 * t); }
export function noteDoubletake(state, sample, nowMs, suppressed) {
  if (!state || !sample || !finite(nowMs)) return "none";
  if (!sample.ownerPresent || !sample.sameDimension || !finite(sample.dist)) { state.prevDist = null; state.prevAtMs = null; return "none"; }
  const prevDist = state.prevDist, prevAt = state.prevAtMs;
  state.prevDist = sample.dist; state.prevAtMs = nowMs;
  if (!finite(prevDist) || !finite(prevAt)) return "none";
  const gap = nowMs - prevAt;
  if (gap <= 0 || gap > DT_MAX_GAP_MS) return "none";
  if (!(prevDist >= DT_FAR_MIN && sample.dist <= DT_NEAR_MAX)) return "none";
  const speed = (prevDist - sample.dist) / (gap / 1000);
  if (speed < DT_MIN_SPEED) return "none";
  if (nowMs < (state.rearmUntilMs || 0)) return "consumed";
  if (state.lastTriggerMs != null && nowMs - state.lastTriggerMs < DT_COOLDOWN_MS) { state.rearmUntilMs = nowMs + DT_REARM_MS; return "consumed"; }
  if (suppressed) { state.rearmUntilMs = nowMs + DT_REARM_MS; return "consumed"; }
  state.firedAtMs = nowMs; state.lastTriggerMs = nowMs;
  return "fired";
}
export function sampleDoubletake(state, nowMs) {
  if (!state || !finite(nowMs) || !finite(state.firedAtMs)) return { active: false, yawDeg: 0, pitchDeg: 0 };
  const t = nowMs - state.firedAtMs;
  if (t < 0 || t >= DT_DURATION_MS) return { active: false, yawDeg: 0, pitchDeg: 0 };
  let yaw = 0;
  if (t < 200) yaw = 0;
  else if (t < 450) yaw = DT_AVERT_YAW_DEG * smooth((t - 200) / 250);
  else yaw = DT_AVERT_YAW_DEG * (1 - smooth((t - 450) / 250));
  return { active: true, yawDeg: yaw, pitchDeg: DT_LOOK_PITCH_DEG };
}
