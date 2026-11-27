// wide_scan_fails.js — 0-D4 B' (cycle1455): wide scan failure isolation per typeId.
// Previously a single global counter latched ALL wide scans after 5 failures, so one
// unresolvable ID (e.g. a wrong note_block ID) disabled resource search session-wide.
// This pure core keeps failures per ID; only infrastructure failures stay global.
// WIDE-BLOCK-NOEXIT-01 (cyc2418): a block now carries a timestamp and expires after
// WIDE_SCAN_BLOCK_TTL_MS, so the next scan gets one half-open retry and a success
// can restore the ID. Without a finite timestamp nothing expires (fail-safe).
// Pure: no @minecraft/server import, never throws. Time is passed in as `now`.
export const WIDE_SCAN_MAX_FAILS = 5;
export const WIDE_SCAN_BLOCK_TTL_MS = 600000;
export function createWideScanFails(maxFails = WIDE_SCAN_MAX_FAILS) {
  const m = typeof maxFails === "number" && maxFails >= 1 ? Math.floor(maxFails) : WIDE_SCAN_MAX_FAILS;
  return { maxFails: m, byId: Object.create(null), global: 0, blockedAt: Object.create(null), globalAt: null };
}
function expireWideBlock(state, id, now) {
  if (!Number.isFinite(now)) return;
  if (state.global >= state.maxFails && Number.isFinite(state.globalAt) && now - state.globalAt >= WIDE_SCAN_BLOCK_TTL_MS) { state.global = 0; state.globalAt = null; }
  if (typeof id === "string" && (state.byId[id] || 0) >= state.maxFails && state.blockedAt && Number.isFinite(state.blockedAt[id]) && now - state.blockedAt[id] >= WIDE_SCAN_BLOCK_TTL_MS) { delete state.byId[id]; delete state.blockedAt[id]; }
}
export function wideIdBlocked(state, id, now) {
  try { if (!state || typeof id !== "string") return false; expireWideBlock(state, id, now); return (state.byId[id] || 0) >= state.maxFails || state.global >= state.maxFails; } catch { return false; }
}
export function partitionWideIds(state, ids, now) {
  try { const usable = [], blocked = []; for (const id of Array.isArray(ids) ? ids : []) (wideIdBlocked(state, id, now) ? blocked : usable).push(id); return { usable, blocked }; } catch { return { usable: [], blocked: [] }; }
}
export function noteWideSuccess(state, ids) {
  try { if (!state) return state; state.global = 0; state.globalAt = null; for (const id of Array.isArray(ids) ? ids : []) { delete state.byId[id]; if (state.blockedAt) delete state.blockedAt[id]; } return state; } catch { return state; }
}
export function noteWideIdFailure(state, id, now) {
  try { if (!state || typeof id !== "string") return state; state.byId[id] = (state.byId[id] || 0) + 1; if (state.byId[id] >= state.maxFails && Number.isFinite(now)) { if (!state.blockedAt) state.blockedAt = Object.create(null); state.blockedAt[id] = now; } return state; } catch { return state; }
}
export function noteWideGlobalFailure(state, now) {
  try { if (!state) return state; state.global = (state.global || 0) + 1; if (state.global >= state.maxFails && Number.isFinite(now)) state.globalAt = now; return state; } catch { return state; }
}
export function wideFailsOf(state, id) { try { return state?.byId?.[id] || 0; } catch { return 0; } }
