// station_math.js — SMELT-STATION-LIT-01 (cyc2477): 精錬設備集合の単一の正 (純粋核)。
// 旧来は知覚の記録述語が /furnace|smoker/ の部分一致で lit_*・溶鉱炉・燻製器まで記録する一方、
// ensureStation の門は minecraft:furnace の完全一致のみで、記録される集合と使える集合がずれていた。
// 実行部 executeSmeltLeg は設備種別・点火状態を見ないインベントリ変換のため、門の役割は
// 「精錬設備が存在するか」の存在確認だけであり、種別制約は入れない (cyc2387 A17 設計)。
// 例外を投げない。
export const SMELT_STATION_IDS = Object.freeze(new Set([
  "minecraft:furnace", "minecraft:lit_furnace",
  "minecraft:blast_furnace", "minecraft:lit_blast_furnace",
  "minecraft:smoker", "minecraft:lit_smoker",
]));
export const isSmeltStationId = (id) => typeof id === "string" && SMELT_STATION_IDS.has(id);
export const isCraftStationId = (id) => id === "minecraft:crafting_table";
// SMELT-STATION-RANGE-01 R1a (cyc2478): 既知の精錬設備記録から最寄りを選ぶ純粋核。
// recs は knownWorkstations(dim) の戻り {x,y,z,k,...} (次元フィルタは呼び出し側が済ませる)。
// 精錬設備でない記録・座標が有限でない記録は落とし、3D距離が cap (既定32) 以内の最小距離を返す。無ければ null。例外を投げない。
export function selectKnownSmeltStation(recs, pos, cap = 32) {
  if (!Array.isArray(recs) || !pos) return null;
  const px = Number(pos.x), py = Number(pos.y), pz = Number(pos.z);
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) return null;
  const lim = Number.isFinite(cap) && cap >= 0 ? cap : 32;
  let best = null, bestD = Infinity;
  for (const rec of recs) {
    if (!rec || !isSmeltStationId(rec.k)) continue;
    const x = Number(rec.x), y = Number(rec.y), z = Number(rec.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const d = Math.hypot(x - px, y - py, z - pz);
    if (d <= lim && d < bestD) { best = rec; bestD = d; }
  }
  return best;
}
