// vein_math.js — 0-D1 (cycle1400): 鉱脈継続性の純粋核。
// 通常鉱石と深層鉱石を同一資源として扱い、候補は登録順でなく距離優先で選ぶ。
// 鉱石を壊した後は18近傍 (面+辺、角除外) の同資源を次候補として保持し、遠方の survey 結果より
// 今の鉱脈を優先する。@minecraft/server を import しない。例外を投げない。
export function resourceKeyOf(typeId) {
  try {
    if (typeof typeId !== "string" || !typeId) return null;
    let t = typeId.split(":").pop();
    if (t.startsWith("lit_")) t = t.slice("lit_".length);
    if (t.startsWith("deepslate_")) t = t.slice("deepslate_".length);
    if (t.startsWith("lit_")) t = t.slice("lit_".length);
    return t;
  } catch { return null; }
}
export function sameResource(a, b) {
  try { const ka = resourceKeyOf(a), kb = resourceKeyOf(b); return ka !== null && ka === kb; } catch { return false; }
}
function d2(from, loc) { const dx = loc.x - from.x, dy = loc.y - from.y, dz = loc.z - from.z; return dx * dx + dy * dy + dz * dz; }
export function pickNearest(cands, from) {
  try {
    if (!Array.isArray(cands) || !from) return null;
    let best = null, bd = Infinity;
    for (const c of cands) { if (!c || !c.loc) continue; const d = d2(from, c.loc); if (d < bd) { bd = d; best = c; } }
    return best;
  } catch { return null; }
}
// 0-D1-R2 (cyc2396): 継続近傍は面6+辺12=18方向 (角8方向は含めない)。tree_cont_math と同一の構成式に揃える。
const DIRS = Object.freeze((() => { const out = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { if (!dx && !dy && !dz) continue; if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) === 3) continue; out.push([dx, dy, dz]); } return out; })());
export function capVeinCands(cands, from, cap = 32) {
  try {
    const out = []; const seen = new Set();
    for (const c of (Array.isArray(cands) ? cands : [])) {
      if (!c || !c.loc) continue;
      const k = `${c.loc.x},${c.loc.y},${c.loc.z}`;
      if (seen.has(k)) continue; seen.add(k); out.push(c);
    }
    const lim = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 32;
    const validFrom = from && Number.isFinite(from.x) && Number.isFinite(from.y) && Number.isFinite(from.z);
    if (!validFrom) return out.slice(-lim);
    const sorted = out.map((c, i) => [d2(from, c.loc), i, c]).sort((a, b) => (a[0] - b[0]) || (a[1] - b[1])).map((e) => e[2]);
    return sorted.slice(0, lim);
  } catch { return []; }
}
export function veinNeighbors(pos, brokenTypeId, typeIdAt) {
  try {
    if (!pos || typeof typeIdAt !== "function") return [];
    const out = [];
    for (const [dx, dy, dz] of DIRS) {
      const p = { x: pos.x + dx, y: pos.y + dy, z: pos.z + dz };
      let t = null; try { t = typeIdAt(p); } catch { t = null; }
      if (t && sameResource(t, brokenTypeId)) out.push({ loc: p, typeId: t });
    }
    return out;
  } catch { return []; }
}
// 優先順位: 今の鉱脈の継続候補 > 近傍走査の最寄り > survey の最寄り。
export function chooseOreTarget({ vein = [], near = [], survey = null, from = null } = {}) {
  try {
    const v = pickNearest(vein, from || (vein[0] && vein[0].loc) || { x: 0, y: 0, z: 0 });
    if (v) return { ...v, via: "vein" };
    const n = pickNearest(near, from || (near[0] && near[0].loc) || { x: 0, y: 0, z: 0 });
    if (n) return { ...n, via: "near" };
    if (survey && survey.loc) return { ...survey, via: "survey" };
    return null;
  } catch { return null; }
}
