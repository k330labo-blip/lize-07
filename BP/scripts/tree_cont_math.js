// tree_cont_math.js — 0-D3 R1 (cycle0583): 同じ木の継続の純粋核。
// 原木を壊したとき近傍の「同一typeIdかつ許可ID内」の原木だけを次候補として保持する。
// 葉は辿らないため葉接触の隣木へは渡らない。完全一致なので樹種厳守と両立する。
// cyc1939 G1: 6近傍→18近傍へ拡張。斜めにずれる横枝と2x2幹 (ダークオーク等) の
// 斜め柱が6近傍では候補に入らず同じ木の継続が切れていた。対象は同一typeIdの
// 原木セルだけなので、葉だけが接触する隣木へは依然として渡らない。
// 角のみで接する8方向 (|dx|=|dy|=|dz|=1) は含めない (a02 実測: 角接触は隣木の
// 誤認経路になる一方、斜め枝・斜め幹の利益は辺隣接だけで得られる)。
// @minecraft/server を import しない。例外を投げない。
// 0-P S4 (cyc2486): 面6方向のみ。辺・角近傍は破壊で露出しないため読まない (vein_math と同型)。斜め枝・2x2幹の斜め柱は面でつながる中間セルを掘る段階で候補化される (段階的追跡)。cyc1939 G1 の18近傍拡張は 0-P で supersede。
const DIRS = Object.freeze([[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]);
export function treeNeighbors(pos, brokenTypeId, typeIdAt, allowedIds) {
  try {
    if (!pos || typeof typeIdAt !== "function" || typeof brokenTypeId !== "string") return [];
    const allowed = Array.isArray(allowedIds) ? allowedIds : null;
    if (allowed && !allowed.includes(brokenTypeId)) return [];
    const out = [];
    for (const [dx, dy, dz] of DIRS) {
      const p = { x: pos.x + dx, y: pos.y + dy, z: pos.z + dz };
      let t = null; try { t = typeIdAt(p); } catch { t = null; }
      if (t && t === brokenTypeId && (!allowed || allowed.includes(t))) out.push({ loc: p, typeId: t });
    }
    return out;
  } catch { return []; }
}
function td2(from, loc) { const dx = loc.x - from.x, dy = loc.y - from.y, dz = loc.z - from.z; return dx * dx + dy * dy + dz * dz; }
export function mergeTreeCands(prev, found, cap = 32, from = null) {
  try {
    const out = []; const seen = new Set();
    for (const c of [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(found) ? found : [])]) {
      if (!c || !c.loc) continue;
      const k = `${c.loc.x},${c.loc.y},${c.loc.z}`;
      if (seen.has(k)) continue; seen.add(k); out.push(c);
    }
    const lim = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 32;
    // 0-D3-R5 (cyc2396): from が有効な場合のみ距離順に先頭 cap 件。null 時は現行互換 (末尾 cap 件)。
    const validFrom = from && Number.isFinite(from.x) && Number.isFinite(from.y) && Number.isFinite(from.z);
    if (!validFrom) return out.slice(-lim);
    const sorted = out.map((c, i) => [td2(from, c.loc), i, c]).sort((a, b) => (a[0] - b[0]) || (a[1] - b[1])).map((e) => e[2]);
    return sorted.slice(0, lim);
  } catch { return []; }
}
