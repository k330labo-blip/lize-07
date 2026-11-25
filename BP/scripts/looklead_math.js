// POLISH-ANIM-LOOKLEAD-01 — pure core draft (cycle2036-a05)
// 作業対象への視線の「先行」: 次の dig/attack/place が始まる少し前に、
// 頭だけを次の対象へ滑らかに向け始める (POLISH-ANIM-LOOK-01 の未統合部分。
// cycle0821 統合はピッチ連動のみで「先行タイミングは対象外」と明記された)。
// No @minecraft/server dependency. Deterministic: time is passed in.
// Never throws; invalid input yields inactive + finite zeros.
// Display layer only: outputs are gaze direction deltas toward the NEXT target,
// scaled by a 0..1 blend. The caller adds (rot.y + yawDeltaDeg, rot.x + pitchDeltaDeg)
// at the lowest-priority overlay point of applyGaze.
export const LOOKLEAD_LEAD_MS = 250;        // start turning this long before the action begins (~5 ticks)
export const LOOKLEAD_WINDOW_MAX_MS = 650;  // if the action never starts, give up after this
export const LOOKLEAD_COOLDOWN_MS = 800;    // after a window ends / is consumed, wait before refiring
export const LOOKLEAD_PITCH_MIN_DEG = -60;  // same pitch clamp family as gaze_math
export const LOOKLEAD_PITCH_MAX_DEG = 75;

export function createLookLeadState() {
  return { windowStartMs: null, targetKey: null, lastFiredMs: null };
}
function finite(n, fb = 0) { return typeof n === "number" && Number.isFinite(n) ? n : fb; }
function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }
function normState(s) {
  if (!s || typeof s !== "object") return createLookLeadState();
  return {
    windowStartMs: (typeof s.windowStartMs === "number" && Number.isFinite(s.windowStartMs)) ? s.windowStartMs : null,
    targetKey: typeof s.targetKey === "string" && s.targetKey.length > 0 ? s.targetKey : null,
    lastFiredMs: (typeof s.lastFiredMs === "number" && Number.isFinite(s.lastFiredMs)) ? s.lastFiredMs : null,
  };
}
function smoothstep(t) { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); }
// Shortest-arc yaw delta is caller-computed; we only clamp its magnitude defensively.
function normYawDelta(d) {
  let v = finite(d, 0);
  v = ((v + 540) % 360) - 180;
  return v;
}
function idleOut(state) {
  return { active: false, fired: false, completed: false, blend: 0, yawDeltaDeg: 0, pitchDeltaDeg: 0, state };
}
// input: {
//   nowMs,
//   msUntilAction: number|null  // ms until the next dig/attack/place starts; null = none scheduled
//   yawToNextDeg, pitchToNextDeg // signed deltas from current gaze direction to the next target
//   targetKey: string|null       // stable id of the next target (cell key / entity id); change restarts
//   suppressed: boolean          // danger / falling / inWater / higher-priority gaze active
//   state
// }
export function tickLookLead(input) {
  const nowMs = finite(input?.nowMs, NaN);
  const state = normState(input?.state);
  if (!Number.isFinite(nowMs)) return idleOut(state);
  const suppressed = input?.suppressed === true;
  const targetKey = typeof input?.targetKey === "string" && input.targetKey.length > 0 ? input.targetKey : null;
  const msUntil = (typeof input?.msUntilAction === "number" && Number.isFinite(input.msUntilAction)) ? input.msUntilAction : null;
  const yawDelta = normYawDelta(input?.yawToNextDeg);
  const pitchDelta = clamp(finite(input?.pitchToNextDeg, 0), LOOKLEAD_PITCH_MIN_DEG, LOOKLEAD_PITCH_MAX_DEG);

  // Active window handling.
  if (state.windowStartMs !== null) {
    const elapsed = nowMs - state.windowStartMs;
    // Suppression or target switch consumes the window (cooldown applies, no delayed refire).
    if (suppressed || targetKey !== state.targetKey) {
      return { ...idleOut({ windowStartMs: null, targetKey: null, lastFiredMs: state.lastFiredMs ?? state.windowStartMs }) };
    }
    // The action started (caller no longer reports an upcoming action): window completes.
    if (msUntil === null) {
      return { active: false, fired: false, completed: true, blend: 1, yawDeltaDeg: yawDelta, pitchDeltaDeg: pitchDelta, state: { windowStartMs: null, targetKey: null, lastFiredMs: state.lastFiredMs ?? state.windowStartMs } };
    }
    // Action is overdue / never came: expire.
    if (elapsed < 0 || elapsed > LOOKLEAD_WINDOW_MAX_MS) {
      return idleOut({ windowStartMs: null, targetKey: null, lastFiredMs: state.lastFiredMs ?? state.windowStartMs });
    }
    const blend = smoothstep(elapsed / LOOKLEAD_LEAD_MS);
    return { active: blend > 0, fired: false, completed: false, blend, yawDeltaDeg: yawDelta * blend, pitchDeltaDeg: pitchDelta * blend, state };
  }

  // Fire condition: an action is scheduled inside the lead window, not already starting.
  const cooled = state.lastFiredMs === null || (nowMs - state.lastFiredMs) >= LOOKLEAD_COOLDOWN_MS;
  if (!suppressed && targetKey !== null && msUntil !== null && msUntil > 0 && msUntil <= LOOKLEAD_LEAD_MS && cooled) {
    const next = { windowStartMs: nowMs, targetKey, lastFiredMs: nowMs };
    return { active: false, fired: true, completed: false, blend: 0, yawDeltaDeg: 0, pitchDeltaDeg: 0, state: next };
  }
  return idleOut(state);
}
export default tickLookLead;
