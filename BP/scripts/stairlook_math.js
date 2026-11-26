// stairlook_math.js — POLISH-ANIM-STAIRSLOOK-01 (cycle1455): when stepping up/down
// repeatedly (stairs/slabs/1-block steps), gaze pitches slightly toward the steps,
// like a person watching their footing. Display layer only, record-only until a
// feeder for step events is wired. Pure: no @minecraft/server import, never throws.
export const STAIRSLOOK_PITCH_UP = -6;   // looking slightly up when climbing (up is negative in gaze convention used by other polish cores)
export const STAIRSLOOK_PITCH_DOWN = 10; // looking down when descending
export const STAIRSLOOK_DURATION_MS = 700;
export const STAIRSLOOK_COOLDOWN_MS = 6000;
export function createStairLookState() { return { lastFiredAt: null, startedAt: null, dir: 0, episode: 0 }; }
function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
// sample: { stepDir: -1|0|1, suppressed?, combat?, falling?, inWater?, working? }
export function noteStairLook(state, sample, nowMs) {
  const out = { fired: false, reason: "invalid" };
  try {
    if (!state || !sample) return out;
    const now = fin(nowMs); if (now === null) return out;
    const d = sample.stepDir;
    if (d !== 1 && d !== -1) { out.reason = "no_step"; return out; }
    if (sample.suppressed || sample.combat || sample.falling || sample.inWater || sample.working) { out.reason = "suppressed"; return out; }
    if (state.lastFiredAt !== null && now - state.lastFiredAt < STAIRSLOOK_COOLDOWN_MS) { out.reason = "cooldown"; return out; }
    state.startedAt = now; state.lastFiredAt = now; state.dir = d; state.episode = (fin(state.episode) || 0) + 1;
    out.fired = true; out.reason = "fired"; return out;
  } catch { return out; }
}
export function stairLookPitch(state, nowMs) {
  try {
    if (!state || state.startedAt === null) return 0;
    const now = fin(nowMs); if (now === null) return 0;
    const t = now - state.startedAt;
    if (t < 0 || t >= STAIRSLOOK_DURATION_MS) { if (t >= STAIRSLOOK_DURATION_MS) state.startedAt = null; return 0; }
    const k = t < 175 ? t / 175 : (t < 450 ? 1 : 1 - (t - 450) / 250);
    return (state.dir === 1 ? STAIRSLOOK_PITCH_UP : STAIRSLOOK_PITCH_DOWN) * k;
  } catch { return 0; }
}
