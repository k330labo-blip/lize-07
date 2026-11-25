// combatend_math.js — POLISH-ANIM-COMBATEND-01 pure core (cycle0224 integration)
// Spec: brain_parts/solutions/cycle0153-a14/REPORT.md §4/§5, design notes tests/cycle0224_a04_combatend.md
// Display-layer only. No @minecraft/server import, no Date.now / Math.random —
// fully deterministic, never throws. The fire/no-fire result must NEVER flow
// back into combat decisions (invariant from the spec).
//
// Rules:
//  - fires once per combat episode, only when ALL of: combat lasted >= 3000ms,
//    hostileCount === 0 observed 2 samples in a row (undefined = no observation,
//    streak is kept, neither advanced nor reset), last hurt >= 1500ms ago,
//    cooldown (30s) elapsed, not suppressed
//  - waveform 1000ms: enter 350ms sin -> hold 200ms -> return 450ms cos,
//    pitch +6deg max, always converges to exactly 0
//  - re-engagement / hurt / suppression during playback cuts straight into a
//    return phase that reaches exactly 0 within 450ms from the current value
//  - a confirmed end is CONSUMED even when it does not fire (short combat,
//    recently hurt, suppressed, cooldown): no delayed fire for the same episode

export const COMBATEND_MIN_COMBAT_MS = 3000;
export const COMBATEND_CLEAR_SAMPLES = 2;
export const COMBATEND_QUIET_MS = 1500;
export const COMBATEND_DURATION_MS = 1000;
export const COMBATEND_ENTER_MS = 350;
export const COMBATEND_HOLD_MS = 200;
export const COMBATEND_RETURN_MS = 450;
export const COMBATEND_PITCH_DEG = 6;
export const COMBATEND_ARM_PITCH_DEG = 18;
export const COMBATEND_COOLDOWN_MS = 30000;
export const COMBATEND_REASONS = Object.freeze([
  "fire", "holding", "cleared_short", "not_confirmed", "recently_hurt",
  "cooldown", "still_in_combat", "suppressed", "invalid",
]);

const SUPPRESS_FIELDS = [
  "working", "digging", "placing", "delivering", "inWaterSurfaced",
  "falling", "dead", "justTeleported", "justRespawned",
  "flinchActive", "otherOverlayActive",
];
const isSuppressed = (s) => !!s && SUPPRESS_FIELDS.some((f) => s[f] === true);
const validCount = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0) ? Math.floor(v) : null;

export function createCombatEndState() {
  return {
    combatSinceMs: null, clearStreak: 0, lastHurtAtMs: null,
    activeSinceMs: null, cutAtMs: null, cutFromDeg: 0,
    lastFiredAtMs: null, episodeClosed: false, lastRecord: null,
  };
}

export function combatEndPitchOffset(elapsedMs) {
  try {
    if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= COMBATEND_DURATION_MS) return 0;
    if (elapsedMs < COMBATEND_ENTER_MS) return COMBATEND_PITCH_DEG * Math.sin((Math.PI / 2) * (elapsedMs / COMBATEND_ENTER_MS));
    if (elapsedMs < COMBATEND_ENTER_MS + COMBATEND_HOLD_MS) return COMBATEND_PITCH_DEG;
    const t = (elapsedMs - COMBATEND_ENTER_MS - COMBATEND_HOLD_MS) / COMBATEND_RETURN_MS;
    return COMBATEND_PITCH_DEG * Math.cos((Math.PI / 2) * t);
  } catch { return 0; }
}

function currentPitchDeg(state, nowMs) {
  if (state.cutAtMs !== null && Number.isFinite(state.cutAtMs)) {
    const t = (nowMs - state.cutAtMs) / COMBATEND_RETURN_MS;
    if (t >= 1) return 0;
    if (t <= 0) return state.cutFromDeg;
    return state.cutFromDeg * Math.cos((Math.PI / 2) * t);
  }
  if (state.activeSinceMs !== null && Number.isFinite(state.activeSinceMs)) return combatEndPitchOffset(nowMs - state.activeSinceMs);
  return 0;
}

function startCut(state, nowMs) {
  const cur = currentPitchDeg(state, nowMs);
  state.activeSinceMs = null;
  if (cur > 0) { state.cutAtMs = nowMs; state.cutFromDeg = cur; }
  else { state.cutAtMs = null; state.cutFromDeg = 0; }
}

export function noteCombatEnd(state, sample, nowMs) {
  try {
    if (!state || typeof state !== "object") return { fired: false, reason: "invalid" };
    if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) return { fired: false, reason: "invalid" };
    const s = sample && typeof sample === "object" ? sample : {};
    const count = validCount(s.hostileCount);
    const suppressed = isSuppressed(s);
    if (s.hurtNow === true) {
      state.lastHurtAtMs = nowMs;
      if (state.activeSinceMs !== null) startCut(state, nowMs);
    }
    // playback cut: re-engagement or suppression rising ends the display early
    if (state.activeSinceMs !== null && ((count !== null && count >= 1) || suppressed)) startCut(state, nowMs);
    if (count === null) return { fired: false, reason: "not_confirmed" }; // no observation: streak kept
    if (count >= 1) {
      if (state.combatSinceMs === null) { state.combatSinceMs = nowMs; state.episodeClosed = false; }
      state.clearStreak = 0;
      return { fired: false, reason: "still_in_combat" };
    }
    // count === 0
    if (state.combatSinceMs === null) return { fired: false, reason: "not_confirmed" };
    state.clearStreak = (state.clearStreak || 0) + 1;
    if (state.clearStreak < COMBATEND_CLEAR_SAMPLES) return { fired: false, reason: "not_confirmed" };
    // confirmed end: consume the episode whatever the outcome
    const started = state.combatSinceMs;
    state.combatSinceMs = null; state.clearStreak = 0; state.episodeClosed = true;
    const rec = (reason) => { state.lastRecord = { atMs: nowMs, fired: reason === "fire", reason }; return { fired: reason === "fire", reason }; };
    if (nowMs - started < COMBATEND_MIN_COMBAT_MS) return rec("cleared_short");
    if (state.lastHurtAtMs !== null && nowMs - state.lastHurtAtMs < COMBATEND_QUIET_MS) return rec("recently_hurt");
    if (suppressed) return rec("suppressed");
    if (state.lastFiredAtMs !== null && nowMs - state.lastFiredAtMs < COMBATEND_COOLDOWN_MS) return rec("cooldown");
    state.activeSinceMs = nowMs; state.cutAtMs = null; state.cutFromDeg = 0; state.lastFiredAtMs = nowMs;
    return rec("fire");
  } catch { return { fired: false, reason: "invalid" }; }
}

export function sampleCombatEnd(state, nowMs) {
  try {
    if (!state || typeof state !== "object" || typeof nowMs !== "number" || !Number.isFinite(nowMs)) return { active: false, pitchDeg: 0, armPitchDeg: 0, reason: "invalid" };
    if (state.cutAtMs !== null && Number.isFinite(state.cutAtMs)) {
      const t = (nowMs - state.cutAtMs) / COMBATEND_RETURN_MS;
      if (t >= 1) { state.cutAtMs = null; state.cutFromDeg = 0; return { active: false, pitchDeg: 0, armPitchDeg: 0, reason: "holding" }; }
      const p = currentPitchDeg(state, nowMs);
      return { active: p > 0, pitchDeg: p, armPitchDeg: p * (COMBATEND_ARM_PITCH_DEG / COMBATEND_PITCH_DEG), reason: "holding" };
    }
    if (state.activeSinceMs !== null && Number.isFinite(state.activeSinceMs)) {
      const elapsed = nowMs - state.activeSinceMs;
      if (elapsed < 0 || elapsed >= COMBATEND_DURATION_MS) { if (elapsed >= COMBATEND_DURATION_MS) state.activeSinceMs = null; return { active: false, pitchDeg: 0, armPitchDeg: 0, reason: "holding" }; }
      const p = combatEndPitchOffset(elapsed);
      return { active: true, pitchDeg: p, armPitchDeg: p * (COMBATEND_ARM_PITCH_DEG / COMBATEND_PITCH_DEG), reason: "holding" };
    }
    return { active: false, pitchDeg: 0, armPitchDeg: 0, reason: "holding" };
  } catch { return { active: false, pitchDeg: 0, armPitchDeg: 0, reason: "invalid" }; }
}
