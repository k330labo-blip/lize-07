// wadeglance_math.js — POLISH-ANIM-WADEGLANCE-01 (cycle1514, a07発案): stepping into
// shallow water, Lize glances down at her footing for a moment, like a person
// checking the depth. Display layer only. The feeder must supply depthBand from
// real observation; "unknown" never fires (no guessing). Pure: no
// @minecraft/server import, never throws, time comes only from arguments.
export const WADEGLANCE_PITCH_DEG = 14;
export const WADEGLANCE_DURATION_MS = 650;
export const WADEGLANCE_COOLDOWN_MS = 25000;
export const WADEGLANCE_DEDUP_MS = 8000;
export function createWadeGlanceState() { return { armed: false, shallowStreak: 0, lastFiredAt: null, startedAt: null, lastCellKey: null, lastCellAt: null, episode: 0 }; }
function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
// sample: { inWater, depthBand: "shallow"|"deep"|"unknown", submerged?, falling?, selfPropelled?, suppressed?, cellKey? }
export function noteWadeGlance(state, sample, nowMs) {
  const out = { fired: false, reason: "invalid" };
  try {
    if (!state || !sample) return out;
    const now = fin(nowMs); if (now === null) return out;
    if (!sample.inWater) { state.armed = false; state.shallowStreak = 0; if (state.startedAt !== null) state.startedAt = null; out.reason = "out_of_water"; return out; }
    // 再生中の打ち切り: 潜水・危険等が来たら波形を即時終了する
    if (state.startedAt !== null && (sample.submerged || sample.suppressed)) { state.startedAt = null; out.reason = "aborted"; return out; }
    if (sample.depthBand !== "shallow") { state.shallowStreak = 0; out.reason = sample.depthBand === "unknown" ? "unknown_band" : "not_shallow"; return out; }
    state.shallowStreak = (fin(state.shallowStreak) || 0) + 1;
    if (state.armed) { out.reason = "already_in"; return out; }
    if (state.shallowStreak < 2) { out.reason = "confirming"; return out; }
    // 辺の確定: ここからは同一入水では再発火しない (armed は出水でのみ解除)
    state.armed = true;
    if (sample.submerged || sample.falling || sample.selfPropelled === false || sample.suppressed) { out.reason = "suppressed_edge_consumed"; return out; }
    if (state.lastFiredAt !== null && now - state.lastFiredAt < WADEGLANCE_COOLDOWN_MS) { out.reason = "cooldown"; return out; }
    const ck = typeof sample.cellKey === "string" ? sample.cellKey : null;
    if (ck && state.lastCellKey === ck && state.lastCellAt !== null && now - state.lastCellAt < WADEGLANCE_DEDUP_MS) { out.reason = "dedup_cell"; return out; }
    state.startedAt = now; state.lastFiredAt = now; state.episode = (fin(state.episode) || 0) + 1;
    if (ck) { state.lastCellKey = ck; state.lastCellAt = now; }
    out.fired = true; out.reason = "fired"; return out;
  } catch { return out; }
}
export function sampleWadeGlance(state, nowMs) {
  const out = { active: false, gazePitchDeg: 0 };
  try {
    if (!state || state.startedAt === null || state.startedAt === undefined) return out;
    const now = fin(nowMs); if (now === null) return out;
    const t = now - state.startedAt;
    if (t < 0) return out;
    if (t >= WADEGLANCE_DURATION_MS) { state.startedAt = null; return out; }
    const k = t < 150 ? t / 150 : (t < 400 ? 1 : 1 - (t - 400) / 250);
    out.active = k > 0; out.gazePitchDeg = WADEGLANCE_PITCH_DEG * k; return out;
  } catch { return out; }
}
