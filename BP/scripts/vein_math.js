// vein_math.js — 0-D1 (cycle1400): 鉱脈継続性の純粋核。
// 通常鉱石と深層鉱石を同一資源として扱い、候補は登録順でなく距離優先で選ぶ。
// 鉱石を壊した後は6近傍の同資源を次候補として保持し、遠方の survey 結果より
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
const DIRS = Object.freeze([[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]);
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
