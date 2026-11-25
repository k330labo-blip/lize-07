// bridge.js — ground-walk Stage 0-C 純粋層 (cycle0403, DESIGN §3 / A04最小案)
// D2裁定: 落下ブロック集合は main.js の FALLING_BLOCK_IDS と同一定義を複製し、tests/test_bridge.mjs で突き合わせる。
// 未配線 (main から import しない)。サーバAPI非依存・例外を投げない。
export const BRIDGE_FALLING_IDS = new Set(["minecraft:sand","minecraft:red_sand","minecraft:suspicious_sand","minecraft:gravel","minecraft:suspicious_gravel","minecraft:white_concrete_powder","minecraft:orange_concrete_powder","minecraft:magenta_concrete_powder","minecraft:light_blue_concrete_powder","minecraft:yellow_concrete_powder","minecraft:lime_concrete_powder","minecraft:pink_concrete_powder","minecraft:gray_concrete_powder","minecraft:light_gray_concrete_powder","minecraft:cyan_concrete_powder","minecraft:purple_concrete_powder","minecraft:blue_concrete_powder","minecraft:brown_concrete_powder","minecraft:green_concrete_powder","minecraft:red_concrete_powder","minecraft:black_concrete_powder"]);
const EXTRA_EXCLUDE = [/glass/, /_leaves$/, /ice/, /snow_block/, /tnt/, /crafting_table/, /furnace/, /chest/, /_bed$/, /torch/, /ladder/];
export function bridgeNeedWithBuffer(need) { const n = Number.isFinite(need) && need > 0 ? Math.ceil(need) : 0; return n + Math.max(2, Math.ceil(n * 0.1)); }
// columns: [{kind:"walkable"|"gap"|"blocked"|"lava"|"unknown", extraNeed?:number, waterDepth?:number}]
export function bridgeScan(columns) {
  if (!Array.isArray(columns) || !columns.length) return { ok: false, reason: "no_anchor", need: 0, spans: [] };
  for (const c of columns) { if (!c || c.kind === "unknown") return { ok: false, reason: "unknown", need: 0, spans: [] }; if (c.kind === "lava") return { ok: false, reason: "lava", need: 0, spans: [] }; }
  const spans = []; let cur = null;
  columns.forEach((c, i) => {
    const isGap = c.kind === "gap" || (typeof c.waterDepth === "number" && c.waterDepth > 0);
    if (isGap) { if (!cur) cur = { start: i, end: i, need: 0 }; cur.end = i; let add = 1; if (typeof c.waterDepth === "number") { if (c.waterDepth >= 5) { cur.deep = true; } else if (c.waterDepth >= 3) add += c.waterDepth - 2; } cur.need += add + (Number.isFinite(c.extraNeed) ? c.extraNeed : 0); }
    else if (cur) { spans.push(cur); cur = null; }
  });
  if (cur) spans.push(cur);
  const valid = spans.filter((sp) => {
    const before = columns[sp.start - 1], after = columns[sp.end + 1];
    return before?.kind === "walkable" && after?.kind === "walkable" && !sp.deep;
  });
  if (spans.length && !valid.length) {
    if (spans.some((sp) => sp.deep)) return { ok: false, reason: "deep_water", need: 0, spans: [] };
    return { ok: false, reason: "no_anchor", need: 0, spans: [] };
  }
  const need = valid.reduce((a, sp) => a + sp.need, 0);
  return { ok: valid.length > 0, reason: valid.length ? "span" : "none", need, spans: valid };
}
export function selectBridgeMaterial(inv, opts = {}) {
  if (!Array.isArray(inv)) return null;
  const isValuable = typeof opts.isValuable === "function" ? opts.isValuable : () => false;
  const isJunk = typeof opts.isJunk === "function" ? opts.isJunk : () => false;
  const cands = [];
  for (const it of inv) {
    if (!it || typeof it.typeId !== "string" || !(it.amount > 0)) continue;
    const id = it.typeId;
    if (BRIDGE_FALLING_IDS.has(id)) continue;
    if (isValuable(id)) continue;
    if (EXTRA_EXCLUDE.some((re) => re.test(id))) continue;
    if (!id.startsWith("minecraft:") || /sword|pickaxe|axe|shovel|hoe|bow|arrow|apple|bread|beef|pork|carrot|potato|egg|milk|bucket$/.test(id)) continue;
    cands.push(it);
  }
  if (!cands.length) return null;
  cands.sort((a, b) => (isJunk(b.typeId) ? 1 : 0) - (isJunk(a.typeId) ? 1 : 0) || b.amount - a.amount);
  return cands[0];
}
