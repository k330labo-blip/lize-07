// tree_species_math.js — 0-D3 (cycle_next): 樹種指定の厳守の純粋核。
// 「原木」等の総称指定では全樹種を対象にするが、特定樹種 (例 minecraft:oak_log) の
// 指定では対象選択・所持進捗・ドロップ回収のすべてをその樹種だけに限定する。
// @minecraft/server を import しない。例外を投げない。
export function specifiedLogId(target) {
  try {
    if (typeof target !== "string" || !target) return null;
    const tail = target.split(":").pop();
    if (!tail || tail === "log" || !tail.endsWith("_log")) return null;
    return `minecraft:${tail}`;
  } catch { return null; }
}
export function allowedLogIds(target, allIds) {
  try {
    const all = Array.isArray(allIds) ? allIds.filter((x) => typeof x === "string") : [];
    const spec = specifiedLogId(target);
    if (!spec) return all.slice();
    return all.includes(spec) ? [spec] : [spec];
  } catch { return []; }
}
export function countLogsForTarget(invCounts, target, allIds) {
  try {
    const inv = invCounts || {};
    const ids = allowedLogIds(target, allIds);
    return ids.reduce((a, id) => a + (Number(inv[id]) || 0), 0);
  } catch { return 0; }
}
export function isLogCountedForTarget(typeId, target, allIds) {
  try { return allowedLogIds(target, allIds).includes(typeId); } catch { return false; }
}
