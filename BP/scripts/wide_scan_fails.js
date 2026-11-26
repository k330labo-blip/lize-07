// wide_scan_fails.js — 0-D4 B' (cycle1455): wide scan failure isolation per typeId.
// Previously a single global counter latched ALL wide scans after 5 failures, so one
// unresolvable ID (e.g. a wrong note_block ID) disabled resource search session-wide.
// This pure core keeps failures per ID; only infrastructure failures stay global.
// Pure: no @minecraft/server import, never throws.
export const WIDE_SCAN_MAX_FAILS = 5;
export function createWideScanFails(maxFails = WIDE_SCAN_MAX_FAILS) {
  const m = typeof maxFails === "number" && maxFails >= 1 ? Math.floor(maxFails) : WIDE_SCAN_MAX_FAILS;
  return { maxFails: m, byId: Object.create(null), global: 0 };
}
export function wideIdBlocked(state, id) {
  try { if (!state || typeof id !== "string") return false; return (state.byId[id] || 0) >= state.maxFails || state.global >= state.maxFails; } catch { return false; }
}
export function partitionWideIds(state, ids) {
  try { const usable = [], blocked = []; for (const id of Array.isArray(ids) ? ids : []) (wideIdBlocked(state, id) ? blocked : usable).push(id); return { usable, blocked }; } catch { return { usable: [], blocked: [] }; }
}
export function noteWideSuccess(state, ids) {
  try { if (!state) return state; state.global = 0; for (const id of Array.isArray(ids) ? ids : []) delete state.byId[id]; return state; } catch { return state; }
}
export function noteWideIdFailure(state, id) {
  try { if (!state || typeof id !== "string") return state; state.byId[id] = (state.byId[id] || 0) + 1; return state; } catch { return state; }
}
export function noteWideGlobalFailure(state) {
  try { if (!state) return state; state.global = (state.global || 0) + 1; return state; } catch { return state; }
}
export function wideFailsOf(state, id) { try { return state?.byId?.[id] || 0; } catch { return 0; } }
