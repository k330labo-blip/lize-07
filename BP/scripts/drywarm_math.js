// drywarm_math.js — POLISH-ANIM-DRYWARM-01 (cycle1400): 濡れた後に熱源のそばで手をかざして乾かす小さな構え (純粋核)
// 設計: brain_parts/solutions/cycle1400-polish/BACKLOG.md。@minecraft/server を import しない。例外を投げない。表示層のみ。
export const DRYWARM_WET_THRESHOLD_MS = 30000;
export const DRYWARM_WET_DECAY_MS = 60000;
export const DRYWARM_HEAT_STABLE_COUNT = 2;
export const DRYWARM_DURATION_MS = 1600;
export const DRYWARM_COOLDOWN_MS = 900000;
export const DRYWARM_PITCH_DEG = 7;
export const DRYWARM_ARM_PITCH_DEG = -20;
export const DRYWARM_YAW_LIMIT_DEG = 30;
export function createDrywarmState() { return { wetMs: 0, lastWetAtMs: null, heatStable: 0, startedAtMs: null, lastFiredAtMs: null, lockedYawDeg: null }; }
const fin = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
export function drywarmEnvelope(elapsedMs) { try { const e = fin(elapsedMs); if (e === null || e < 0 || e >= DRYWARM_DURATION_MS) return 0; if (e < 400) return e / 400; if (e < 1100) return 1; return 1 - (e - 1100) / 500; } catch { return 0; } }
export function drywarmPitchAt(startedAtMs, nowMs) { try { const s = fin(startedAtMs), n = fin(nowMs); if (s === null || n === null) return 0; return DRYWARM_PITCH_DEG * drywarmEnvelope(n - s); } catch { return 0; } }
export function isDrywarmActive(state, nowMs) { try { const s = fin(state?.startedAtMs), n = fin(nowMs); if (s === null || n === null) return false; const e = n - s; return e >= 0 && e < DRYWARM_DURATION_MS; } catch { return false; } }
export function drywarmDue(lastFiredAtMs, nowMs) { try { const n = fin(nowMs); if (n === null) return false; const l = fin(lastFiredAtMs); if (l === null) return true; return n - l >= DRYWARM_COOLDOWN_MS; } catch { return false; } }
// noteDrywarm(state, input{nowMs, dtMs, wet:boolean(雨曝露|水中), nearHeat:boolean, suppressed:boolean}) -> 発火したら true
export function noteDrywarm(state, input) {
  try {
    if (!state || typeof state !== "object" || !input) return false;
    const now = fin(input.nowMs); if (now === null) return false;
    if (isDrywarmActive(state, now)) { if (input.suppressed === true) { state.startedAtMs = null; } return false; }
    if (state.startedAtMs !== null && !isDrywarmActive(state, now)) state.startedAtMs = null;
    if (input.wet === true) { const dt = fin(input.dtMs); state.wetMs = (fin(state.wetMs) || 0) + (dt !== null && dt > 0 ? dt : 0); state.lastWetAtMs = now; }
    else if (state.lastWetAtMs !== null && now - state.lastWetAtMs >= DRYWARM_WET_DECAY_MS) { state.wetMs = 0; state.lastWetAtMs = null; }
    if (input.nearHeat === true) state.heatStable = (fin(state.heatStable) || 0) + 1; else state.heatStable = 0;
    if ((fin(state.wetMs) || 0) < DRYWARM_WET_THRESHOLD_MS) return false;
    if (state.heatStable < DRYWARM_HEAT_STABLE_COUNT) return false;
    if (input.suppressed === true) return false;
    if (!drywarmDue(state.lastFiredAtMs, now)) return false;
    state.startedAtMs = now; state.lastFiredAtMs = now; state.wetMs = 0; state.lockedYawDeg = fin(input.heatYawDeg);
    return true;
  } catch { return false; }
}
