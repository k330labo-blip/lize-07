// tree_cont_math.js — 0-D3 R1 (cycle0583): 同じ木の継続の純粋核。
// 原木を壊したとき近傍の「同一typeIdかつ許可ID内」の原木だけを次候補として保持する。
// 葉は辿らないため葉接触の隣木へは渡らない。完全一致なので樹種厳守と両立する。
// cyc1939 G1: 6近傍→26近傍へ拡張。斜めにずれる横枝と2x2幹 (ダークオーク等) の
// 斜め柱が6近傍では候補に入らず同じ木の継続が切れていた。対象は同一typeIdの
// 原木セルだけなので、葉だけが接触する隣木へは依然として渡らない。
// @minecraft/server を import しない。例外を投げない。
const DIRS = Object.freeze((() => { const out = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { if (dx || dy || dz) out.push([dx, dy, dz]); } return out; })());
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
export function mergeTreeCands(prev, found, cap = 32) {
  try {
    const out = []; const seen = new Set();
    for (const c of [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(found) ? found : [])]) {
      if (!c || !c.loc) continue;
      const k = `${c.loc.x},${c.loc.y},${c.loc.z}`;
      if (seen.has(k)) continue; seen.add(k); out.push(c);
    }
    const lim = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 32;
    return out.slice(-lim);
  } catch { return []; }
}
