// POLISH-ANIM-TOOLCHECK-01 — pure core draft (cycle1754-a10)
// No @minecraft/server dependency. Deterministic: time is passed in.
// Never throws; invalid input yields inactive + finite zeros.
// Display layer only: outputs are gaze offsets + a record-only arm pitch.
export const TOOLCHECK_IDLE_MS = 45000;
export const TOOLCHECK_DURATION_MS = 900;
export const TOOLCHECK_COOLDOWN_MS = 180000;
export const TOOLCHECK_PITCH_DEG = 24;
export const TOOLCHECK_YAW_DEG = -6;
export const TOOLCHECK_ARM_PITCH_DEG = -28;
export const TOOLCHECK_RISE_MS = 150;
export const TOOLCHECK_HOLD_END_MS = 550;

export function createToolCheckState() {
  return { windowStartMs: null, lastFiredMs: null };
}
function finite(n, fb = 0) { return typeof n === "number" && Number.isFinite(n) ? n : fb; }
function normState(s) {
  if (!s || typeof s !== "object") return createToolCheckState();
  return {
    windowStartMs: (typeof s.windowStartMs === "number" && Number.isFinite(s.windowStartMs)) ? s.windowStartMs : null,
    lastFiredMs: (typeof s.lastFiredMs === "number" && Number.isFinite(s.lastFiredMs)) ? s.lastFiredMs : null,
  };
}
function envelope(elapsedMs) {
  if (elapsedMs < 0) return 0;
  if (elapsedMs < TOOLCHECK_RISE_MS) return elapsedMs / TOOLCHECK_RISE_MS;
  if (elapsedMs < TOOLCHECK_HOLD_END_MS) return 1;
  if (elapsedMs < TOOLCHECK_DURATION_MS) return 1 - (elapsedMs - TOOLCHECK_HOLD_END_MS) / (TOOLCHECK_DURATION_MS - TOOLCHECK_HOLD_END_MS);
  return 0;
}
// input: { nowMs, idleMs, suppressed, state }
// idleMs = continuous idle/wait duration (caller-measured). suppressed=true blocks firing
// and cancels an active window (consumed: cooldown still applies, no delayed refire).
export function tickToolCheck(input) {
  const nowMs = finite(input?.nowMs, NaN);
  const state = normState(input?.state);
  const idle = { active: false, gazePitchDeg: 0, gazeYawDeg: 0, armPitchDeg: 0, fired: false, state };
  if (!Number.isFinite(nowMs)) return idle;
  const suppressed = input?.suppressed === true;
  const idleMs = finite(input?.idleMs, 0);
  // Cancel active window on suppression.
  if (state.windowStartMs !== null && suppressed) {
    return { ...idle, state: { windowStartMs: null, lastFiredMs: state.lastFiredMs ?? state.windowStartMs } };
  }
  // Continue active window.
  if (state.windowStartMs !== null) {
    const elapsed = nowMs - state.windowStartMs;
    if (elapsed >= 0 && elapsed < TOOLCHECK_DURATION_MS) {
      const e = envelope(elapsed);
      return { active: e > 0, gazePitchDeg: TOOLCHECK_PITCH_DEG * e, gazeYawDeg: TOOLCHECK_YAW_DEG * e, armPitchDeg: TOOLCHECK_ARM_PITCH_DEG * e, fired: false, state };
    }
    state.windowStartMs = null; // window finished; fall through (cooldown blocks refire)
  }
  // Fire condition.
  const cooled = state.lastFiredMs === null || (nowMs - state.lastFiredMs) >= TOOLCHECK_COOLDOWN_MS;
  if (!suppressed && idleMs >= TOOLCHECK_IDLE_MS && cooled) {
    const next = { windowStartMs: nowMs, lastFiredMs: nowMs };
    return { active: false, gazePitchDeg: 0, gazeYawDeg: 0, armPitchDeg: 0, fired: true, state: next };
  }
  return { ...idle, state };
}
export default tickToolCheck;
