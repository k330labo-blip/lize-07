// scan_fail_math.js — 0-D4 R3+R4 (cyc2481): near-scan failure counts kept per typeId.
// Previously scanBlocksNear counted one shared failedCells for the whole multi-ID
// scan and wrote that same value into every ID's cache entry, and a wide-scan
// success overwrote every requested ID's entry with failedCells: 0 — including
// IDs the wide scan never actually succeeded for (per-ID failure or blocked),
// erasing failure counts those IDs had accumulated in near scans and making
// scanCachePeek report a false "absent" instead of "unknown".
// This pure core keeps the counts per ID: a cell that cannot be read counts
// once against every wanted ID (it is unreadable for all of them), and a wide
// success may reset only the IDs it actually succeeded for; other IDs keep
// their previously accumulated count.
// Pure: no server API import, never throws.
export function createScanFailCounts(ids) {
  const counts = Object.create(null);
  try { for (const id of Array.isArray(ids) ? ids : []) if (typeof id === "string") counts[id] = 0; } catch {}
  return counts;
}
export function noteScanCellFailure(counts, ids) {
  try { if (!counts) return counts; for (const id of Array.isArray(ids) ? ids : []) if (typeof id === "string") counts[id] = (counts[id] || 0) + 1; } catch {}
  return counts;
}
export function scanFailedCellsFor(counts, id) {
  try { const v = counts?.[id]; return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0; } catch { return 0; }
}
export function wideResetIds(requestedIds, succeededIds) {
  try {
    const ok = new Set(Array.isArray(succeededIds) ? succeededIds : []);
    return (Array.isArray(requestedIds) ? requestedIds : []).filter((id) => typeof id === "string" && ok.has(id));
  } catch { return []; }
}
export function preservedFailedCells(prevEntry) {
  try { const v = prevEntry?.failedCells; return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0; } catch { return 0; }
}
