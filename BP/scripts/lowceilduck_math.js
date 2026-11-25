// lowceilduck_math.js — POLISH-ANIM-LOWCEILDUCK-01 (cycle0537-a07 発案 / cycle0553 統合)
// 低い天井の下に居続ける間の小さな「かがみ込み」持続姿勢 (純粋核・表示層のみ)
// 仕様の正: brain_parts/solutions/cycle0537-a07/REPORT.md
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。時刻は引数で受ける。
export const LOWCEILDUCK_CONFIRM_OBS = 2;
export const LOWCEILDUCK_CONFIRM_MS = 1200;
export const LOWCEILDUCK_PITCH_DEG = 7;
export const LOWCEILDUCK_SINK = 0.06;
export const LOWCEILDUCK_RISE_MS = 300;
export const LOWCEILDUCK_FALL_MS = 250;
export const LOWCEILDUCK_UNKNOWN_HOLD_MS = 600;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

export function createLowCeilDuckState() {
  return { obsStreak: 0, firstObsMs: null, active: false, enteredAtMs: null, exitedAtMs: null, blendAtExit: 0, lastObsMs: null, lastReason: "invalid" };
}

function blendOf(state, now) {
  if (state.active) {
    const e = finiteOrNull(state.enteredAtMs);
    if (e === null) return 1;
    const t = (now - e) / LOWCEILDUCK_RISE_MS;
    return t <= 0 ? 0 : t >= 1 ? 1 : t;
  }
  const x = finiteOrNull(state.exitedAtMs);
  if (x === null) return 0;
  const t = (now - x) / LOWCEILDUCK_FALL_MS;
  if (t >= 1) return 0;
  if (t <= 0) return state.blendAtExit || 0;
  return (state.blendAtExit || 0) * (1 - t);
}

// noteLowCeilDuck(state, { lowCeil: true|false|null, suppressed, nowMs }) -> state (破壊的に更新)
// lowCeil=null (観測欠落) は UNKNOWN_HOLD_MS まで保持し、それを超えたら解除する。
export function noteLowCeilDuck(state, input) {
  try {
    if (!state || typeof state !== "object") return createLowCeilDuckState();
    if (!input || typeof input !== "object") { state.lastReason = "invalid"; return state; }
    const now = finiteOrNull(input.nowMs);
    if (now === null) { state.lastReason = "invalid"; return state; }
    if (input.suppressed === true) {
      if (state.active) { state.blendAtExit = blendOf(state, now); state.exitedAtMs = now; }
      state.active = false; state.obsStreak = 0; state.firstObsMs = null; state.lastObsMs = now; state.lastReason = "exit_suppressed";
      return state;
    }
    if (input.lowCeil === null || input.lowCeil === undefined) {
      const last = finiteOrNull(state.lastObsMs);
      if (last !== null && now - last > LOWCEILDUCK_UNKNOWN_HOLD_MS) {
        if (state.active) { state.blendAtExit = blendOf(state, now); state.exitedAtMs = now; }
        state.active = false; state.obsStreak = 0; state.firstObsMs = null; state.lastReason = "unknown_expired";
      } else state.lastReason = "unknown_hold";
      return state;
    }
    state.lastObsMs = now;
    if (input.lowCeil === true) {
      if (state.obsStreak === 0 || state.firstObsMs === null) state.firstObsMs = now;
      state.obsStreak = (Number.isFinite(state.obsStreak) ? state.obsStreak : 0) + 1;
      if (!state.active && state.obsStreak >= LOWCEILDUCK_CONFIRM_OBS && now - state.firstObsMs >= LOWCEILDUCK_CONFIRM_MS) {
        state.active = true; state.enteredAtMs = now; state.exitedAtMs = null; state.lastReason = "enter";
      } else state.lastReason = state.active ? "hold" : "confirming";
      return state;
    }
    // lowCeil === false: 天井が開いた
    if (state.active) { state.blendAtExit = blendOf(state, now); state.exitedAtMs = now; }
    state.active = false; state.obsStreak = 0; state.firstObsMs = null; state.lastReason = "exit_open";
    return state;
  } catch { return createLowCeilDuckState(); }
}

export function sampleLowCeilDuck(state, nowMs) {
  try {
    const zero = { active: false, pitchDeg: 0, sink: 0, blend: 0 };
    if (!state || typeof state !== "object") return { ...zero };
    const now = finiteOrNull(nowMs);
    if (now === null) return { ...zero };
    const b = blendOf(state, now);
    if (!(b > 0)) return { ...zero };
    return { active: true, pitchDeg: LOWCEILDUCK_PITCH_DEG * b, sink: LOWCEILDUCK_SINK * b, blend: b };
  } catch { return { active: false, pitchDeg: 0, sink: 0, blend: 0 }; }
}

export function isLowCeilDuckActive(state, nowMs) {
  try { return sampleLowCeilDuck(state, nowMs).active; } catch { return false; }
}
