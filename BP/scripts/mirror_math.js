// mirror_math.js — POLISH-ANIM-MIRROR-01 pure core 統合版 (cycle1421, BP/scripts/mirror_math.js)
// Spec: brain_parts/solutions/polish-backlog/POLISH-NEW-cycle1400-a12.md §2/§6
// Display-layer only. No BP integration in this draft. No Minecraft API deps.
//
// Contract:
//  input edges: owner's jump-start / sneak-start edges + nowMs + suppressed flag
//  output sample: { active, kind: "hop"|"dip"|null, bodyYOffset, crouchDepth, gazePitchDeg }
// Rules (§2):
//  - window 900ms, same kind x2 fires once
//  - cooldown 30s; edges during active/cooldown are consumed (not counted)
//  - suppressed edges are consumed; no delayed firing after suppression lifts
//  - non-owner edges are never counted
//  - if hop and dip would complete together, the first to complete wins, other consumed
//  - hop: bodyYOffset max 0.12, 350ms single mountain (triangle), then back to 0
//  - dip: crouchDepth max 0.35, ramp 150ms + hold 450ms + return 150ms (=750ms), then 0
//  - gazePitchDeg: max +6 deg, scaled by the same envelope

export const MIRROR_CONSTANTS = Object.freeze({
  WINDOW_MS: 900,
  COOLDOWN_MS: 30000,
  HOP_MAX: 0.12,
  HOP_DURATION_MS: 350,
  DIP_MAX: 0.35,
  DIP_RAMP_MS: 150,
  DIP_HOLD_MS: 450,
  DIP_RETURN_MS: 150,
  DIP_DURATION_MS: 750, // 150 + 450 + 150
  GAZE_MAX_DEG: 6,
});

const C = MIRROR_CONSTANTS;

export function createMirrorState() {
  return {
    pendingJumpAt: null, // ms timestamp of first unmatched jump edge, or null
    pendingSneakAt: null, // ms timestamp of first unmatched sneak edge, or null
    activeKind: null, // "hop" | "dip" | null
    activeStartMs: null,
    cooldownUntilMs: 0,
    lastFiredKind: null,
    lastFiredAtMs: null,
  };
}

export function resetMirrorState(state) {
  state.pendingJumpAt = null;
  state.pendingSneakAt = null;
  state.activeKind = null;
  state.activeStartMs = null;
  state.cooldownUntilMs = 0;
  state.lastFiredKind = null;
  state.lastFiredAtMs = null;
  return state;
}

function durationFor(kind) {
  return kind === "hop" ? C.HOP_DURATION_MS : C.DIP_DURATION_MS;
}

function isActiveAt(state, nowMs) {
  if (state.activeKind == null || state.activeStartMs == null) return false;
  return nowMs >= state.activeStartMs && nowMs < state.activeStartMs + durationFor(state.activeKind);
}

function clearPending(state) {
  state.pendingJumpAt = null;
  state.pendingSneakAt = null;
}

// Record one edge. edgeKind: "jump" | "sneak". opts: { isOwner, suppressed }
// Returns { fired: boolean, kind: "hop"|"dip"|null, consumed: boolean }
export function recordEdge(state, edgeKind, nowMs, opts = {}) {
  const isOwner = opts.isOwner !== false; // callers should pass explicitly; default owner for draft ergonomics
  const suppressed = !!opts.suppressed;

  if (edgeKind !== "jump" && edgeKind !== "sneak") {
    return { fired: false, kind: null, consumed: false };
  }
  // Non-owner: never counted (§2/§6).
  if (!isOwner) return { fired: false, kind: null, consumed: true };
  // Suppressed: consume this edge AND any pending of that kind; no delayed fire.
  if (suppressed) {
    if (edgeKind === "jump") state.pendingJumpAt = null; else state.pendingSneakAt = null;
    return { fired: false, kind: null, consumed: true };
  }
  // Active or cooldown: consume, do not count toward next firing.
  if (isActiveAt(state, nowMs) || nowMs < state.cooldownUntilMs) {
    clearPending(state);
    return { fired: false, kind: null, consumed: true };
  }
  // Expire stale active marker (sample() also clears, but keep recordEdge self-consistent).
  if (state.activeKind != null && !isActiveAt(state, nowMs)) {
    state.activeKind = null; state.activeStartMs = null;
  }

  const pendingKey = edgeKind === "jump" ? "pendingJumpAt" : "pendingSneakAt";
  const pendingAt = state[pendingKey];
  if (pendingAt != null && nowMs - pendingAt <= C.WINDOW_MS && nowMs >= pendingAt) {
    const kind = edgeKind === "jump" ? "hop" : "dip";
    state.activeKind = kind;
    state.activeStartMs = nowMs;
    state.cooldownUntilMs = nowMs + C.COOLDOWN_MS;
    state.lastFiredKind = kind;
    state.lastFiredAtMs = nowMs;
    clearPending(state); // the other kind's pending is also consumed (no overlap firing)
    return { fired: true, kind, consumed: false };
  }
  // First edge (or previous expired > window): (re)start the window for this kind.
  state[pendingKey] = nowMs;
  return { fired: false, kind: null, consumed: false };
}

// Sample display offsets at nowMs. Always returns complete-zero output when inactive/ended.
export function sampleMirror(state, nowMs) {
  const zero = { active: false, kind: null, bodyYOffset: 0, crouchDepth: 0, gazePitchDeg: 0 };
  if (state.activeKind == null || state.activeStartMs == null) return { ...zero };
  const kind = state.activeKind;
  const elapsed = nowMs - state.activeStartMs;
  const dur = durationFor(kind);
  if (elapsed < 0) return { ...zero };
  if (elapsed >= dur) {
    state.activeKind = null; state.activeStartMs = null;
    return { ...zero };
  }
  let env; // 0..1
  if (kind === "hop") {
    const t = elapsed / C.HOP_DURATION_MS; // triangle single mountain, peak at t=0.5
    env = 1 - Math.abs(2 * t - 1);
  } else {
    if (elapsed < C.DIP_RAMP_MS) env = elapsed / C.DIP_RAMP_MS;
    else if (elapsed < C.DIP_RAMP_MS + C.DIP_HOLD_MS) env = 1;
    else env = 1 - (elapsed - C.DIP_RAMP_MS - C.DIP_HOLD_MS) / C.DIP_RETURN_MS;
  }
  env = Math.max(0, Math.min(1, env));
  return {
    active: true,
    kind,
    bodyYOffset: kind === "hop" ? C.HOP_MAX * env : 0,
    crouchDepth: kind === "dip" ? C.DIP_MAX * env : 0,
    gazePitchDeg: C.GAZE_MAX_DEG * env,
  };
}

export default { MIRROR_CONSTANTS, createMirrorState, resetMirrorState, recordEdge, sampleMirror };
