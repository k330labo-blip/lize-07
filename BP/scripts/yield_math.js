// yield_math.js — POLISH-ANIM-YIELD-01 pure core (cycle0153 統合)
// Spec: brain_parts/solutions/cycle0141-a20/POLISH_IDEA.md §4/§5/§9
// Display-layer only. No @minecraft/server import, no relative imports,
// no Date.now / Math.random — fully deterministic, never throws.
//
// Contract:
//  input  (noteYield): owner horizontal distance, facing diff deg, approaching flag,
//                      roomLeft/roomRight booleans (caller's existing observation),
//                      suppression booleans (only === true counts)
//  output (sampleYield): { active, coef, lateralOffset, yawDeg, gazePitchDeg, reason }
//                        lateralOffset is DISPLAY ONLY — never feed into real coords/pathing.
// Rules (spec §4.3):
//  - fires once per approach, only when ALL of: dist<=3.5, facingDiff>=150,
//    approaching===true, exactly one side has room, cooldown (20s) elapsed, not suppressed
//  - ramp-in 250ms linear, hold while approach continues and dist>1.2, hold cap 1200ms,
//    ramp-out 300ms linear back to exactly 0
//  - dist<=1.2 (passed) / approach ends / suppression rises -> hold is cut, ramp-out begins
//  - an approach blocked by cooldown or suppression is CONSUMED: no delayed fire
//    within the same approach; re-arm only after dist leaves the trigger zone once
//  - invalid inputs (NaN / out-of-range / missing) never fire and never advance state

export const YIELD_TRIGGER_DIST = 3.5;
export const YIELD_FACING_MIN_DEG = 150;
export const YIELD_COOLDOWN_MS = 20000;
export const YIELD_RAMP_IN_MS = 250;
export const YIELD_HOLD_MAX_MS = 1200;
export const YIELD_RAMP_OUT_MS = 300;
export const YIELD_LATERAL_MAX = 0.18;
export const YIELD_YAW_MAX_DEG = 10;
export const YIELD_PITCH_DEG = 4;
export const YIELD_PASS_DIST = 1.2;
// Spec §4.1 list, plus "not_approaching" so the approaching-flag failure is
// distinguishable from the facing-angle failure in records (draft extension).
export const YIELD_REASONS = Object.freeze([
  "fire", "holding", "passed", "cooldown", "no_room", "wide_open",
  "not_head_on", "not_approaching", "too_far", "suppressed", "invalid",
]);

export const YIELD_CONSTANTS = Object.freeze({
  TRIGGER_DIST: YIELD_TRIGGER_DIST,
  FACING_MIN_DEG: YIELD_FACING_MIN_DEG,
  COOLDOWN_MS: YIELD_COOLDOWN_MS,
  RAMP_IN_MS: YIELD_RAMP_IN_MS,
  HOLD_MAX_MS: YIELD_HOLD_MAX_MS,
  RAMP_OUT_MS: YIELD_RAMP_OUT_MS,
  LATERAL_MAX: YIELD_LATERAL_MAX,
  YAW_MAX_DEG: YIELD_YAW_MAX_DEG,
  PITCH_DEG: YIELD_PITCH_DEG,
  PASS_DIST: YIELD_PASS_DIST,
});

const SUPPRESS_FIELDS = [
  "working", "digging", "attacking", "placing", "inCombat", "danger",
  "falling", "inWater", "climbing", "onNarrowBridge",
  "justTeleported", "justRespawned", "dead", "otherOverlayActive",
];

export function createYieldState() {
  return {
    activeSinceMs: null, // fire timestamp while an envelope is running, else null
    outStartMs: null,    // ramp-out start (termination event), else null = auto-cap applies
    outFromCoef: 1,      // coef captured at ramp-out start
    termReason: null,    // why the hold was cut: "passed" | "suppressed" | "not_approaching"
    lastFiredAtMs: null,
    side: 0,             // -1 = left, +1 = right, 0 = none; fixed for the whole envelope
    approachConsumed: false, // current approach already fired or was blocked (cooldown/suppressed)
    lastRecord: null,    // { atMs, fired, side, reason } of the latest noteYield
  };
}

export function resetYieldState(state) {
  if (!state || typeof state !== "object") return state;
  const fresh = createYieldState();
  for (const k of Object.keys(fresh)) state[k] = fresh[k];
  return state;
}

function isFiniteNum(v) { return typeof v === "number" && Number.isFinite(v); }

function isSuppressed(sample) {
  if (sample.suppressed === true) return true;
  for (const f of SUPPRESS_FIELDS) if (sample[f] === true) return true;
  return false;
}

// Envelope coefficient at nowMs without mutating state. 0 when inactive/ended.
function coefAt(state, nowMs) {
  if (state.activeSinceMs == null) return 0;
  const elapsed = nowMs - state.activeSinceMs;
  if (elapsed < 0) return 0;
  let outStart = state.outStartMs;
  let outFrom = state.outFromCoef;
  if (outStart == null) {
    outStart = state.activeSinceMs + YIELD_RAMP_IN_MS + YIELD_HOLD_MAX_MS;
    outFrom = 1;
  }
  if (nowMs >= outStart) {
    const t = (nowMs - outStart) / YIELD_RAMP_OUT_MS;
    if (t >= 1) return 0;
    return Math.max(0, Math.min(1, outFrom * (1 - t)));
  }
  if (elapsed < YIELD_RAMP_IN_MS) return elapsed / YIELD_RAMP_IN_MS;
  return 1;
}

function envelopeEnded(state, nowMs) {
  if (state.activeSinceMs == null) return true;
  const outStart = state.outStartMs != null
    ? state.outStartMs
    : state.activeSinceMs + YIELD_RAMP_IN_MS + YIELD_HOLD_MAX_MS;
  return nowMs >= outStart + YIELD_RAMP_OUT_MS;
}

function beginOut(state, nowMs, reason) {
  if (state.outStartMs != null) return;
  state.outFromCoef = coefAt(state, nowMs);
  state.outStartMs = nowMs;
  state.termReason = reason;
}

function record(state, nowMs, fired, side, reason) {
  const rec = { fired, side, reason };
  state.lastRecord = { atMs: nowMs, fired, side, reason };
  return rec;
}

// Feed one observation tick. Returns { fired, side, reason } — `fired` is true
// only on the firing edge. Safe to call every tick; never throws.
export function noteYield(state, sample, nowMs) {
  if (!state || typeof state !== "object") return { fired: false, side: 0, reason: "invalid" };
  if (!sample || typeof sample !== "object" || !isFiniteNum(nowMs)) {
    return { fired: false, side: state.side || 0, reason: "invalid" };
  }
  const dist = sample.ownerDist;
  const facing = sample.facingDiffDeg;
  const distOk = isFiniteNum(dist) && dist >= 0;
  const facingOk = isFiniteNum(facing) && facing >= 0 && facing <= 180;
  if (!distOk || !facingOk) {
    // Invalid observation: do not advance state (spec §4.3-4).
    return { fired: false, side: state.side || 0, reason: "invalid" };
  }

  // Leaving the trigger zone re-arms the next approach.
  if (dist > YIELD_TRIGGER_DIST) state.approachConsumed = false;

  // --- While an envelope is running: watch for hold-termination only. ---
  if (state.activeSinceMs != null) {
    if (envelopeEnded(state, nowMs)) {
      state.activeSinceMs = null; state.outStartMs = null; state.termReason = null;
      // fall through: this same tick may be evaluated as a fresh approach,
      // but approachConsumed still guards re-fire within the same approach.
    } else {
      if (state.outStartMs == null) {
        if (isSuppressed(sample)) beginOut(state, nowMs, "suppressed");
        else if (dist <= YIELD_PASS_DIST) beginOut(state, nowMs, "passed");
        else if (sample.approaching !== true) beginOut(state, nowMs, "not_approaching");
      }
      const reason = state.outStartMs != null ? (state.termReason || "holding") : "holding";
      return record(state, nowMs, false, state.side, reason);
    }
  }

  // --- Idle: evaluate the firing conditions in a fixed order. ---
  const side = sample.roomLeft === true && sample.roomRight !== true ? -1
    : sample.roomRight === true && sample.roomLeft !== true ? 1 : 0;

  let reason = null;
  if (dist > YIELD_TRIGGER_DIST) reason = "too_far";
  else if (facing < YIELD_FACING_MIN_DEG) reason = "not_head_on";
  else if (sample.approaching !== true) reason = "not_approaching";
  else if (sample.roomLeft === true && sample.roomRight === true) reason = "wide_open";
  else if (sample.roomLeft !== true && sample.roomRight !== true) reason = "no_room";
  else if (isSuppressed(sample)) reason = "suppressed";
  else if (state.lastFiredAtMs != null && nowMs - state.lastFiredAtMs < YIELD_COOLDOWN_MS) reason = "cooldown";

  if (reason != null) {
    // Geometry fully satisfied but blocked by suppression/cooldown: consume
    // this approach so it cannot fire late when the block lifts (spec §4.3-3).
    if ((reason === "suppressed" || reason === "cooldown") && !state.approachConsumed) {
      state.approachConsumed = true;
    }
    return record(state, nowMs, false, 0, reason);
  }
  if (state.approachConsumed) {
    // Same approach that already fired or was blocked; wait for exit + re-entry.
    return record(state, nowMs, false, 0, state.lastFiredAtMs != null && nowMs - state.lastFiredAtMs < YIELD_COOLDOWN_MS ? "cooldown" : "suppressed");
  }

  state.activeSinceMs = nowMs;
  state.outStartMs = null;
  state.outFromCoef = 1;
  state.termReason = null;
  state.side = side;
  state.lastFiredAtMs = nowMs;
  state.approachConsumed = true;
  return record(state, nowMs, true, side, "fire");
}

// Sample display offsets at nowMs. Always finite; all-zero when inactive/ended.
export function sampleYield(state, nowMs) {
  const zero = { active: false, coef: 0, lateralOffset: 0, yawDeg: 0, gazePitchDeg: 0, reason: "invalid" };
  if (!state || typeof state !== "object" || !isFiniteNum(nowMs)) return { ...zero };
  if (state.activeSinceMs == null) return { ...zero, reason: "too_far" };
  if (envelopeEnded(state, nowMs)) {
    state.activeSinceMs = null; state.outStartMs = null; state.termReason = null;
    return { ...zero, reason: "passed" };
  }
  const coef = Math.max(0, Math.min(1, coefAt(state, nowMs)));
  const side = state.side === -1 || state.side === 1 ? state.side : 0;
  return {
    active: coef > 0,
    coef,
    lateralOffset: side * YIELD_LATERAL_MAX * coef,
    yawDeg: side * YIELD_YAW_MAX_DEG * coef,
    gazePitchDeg: YIELD_PITCH_DEG * coef,
    reason: state.outStartMs != null ? (state.termReason || "holding") : "holding",
  };
}

export default {
  YIELD_CONSTANTS, YIELD_REASONS,
  createYieldState, resetYieldState, noteYield, sampleYield,
};
