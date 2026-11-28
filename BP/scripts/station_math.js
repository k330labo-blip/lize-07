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
// SMELT-STATION-REPAIR-CLASS-01 (cyc2480): 既知の精錬設備記録を距離順に並べる純粋核。
// selectKnownSmeltStation は最寄り1件しか返さず、最寄りが幽霊記録だと cap 内の第2候補が
// 再読されない遮蔽 (B10) があった。呼び出し側が再読成功まで反復できるよう候補列を返す。
export function rankKnownSmeltStations(recs, pos, cap = 32) {
  if (!Array.isArray(recs) || !pos) return [];
  const px = Number(pos.x), py = Number(pos.y), pz = Number(pos.z);
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) return [];
  const lim = Number.isFinite(cap) && cap >= 0 ? cap : 32;
  const out = [];
  for (const rec of recs) {
    if (!rec || !isSmeltStationId(rec.k)) continue;
    const x = Number(rec.x), y = Number(rec.y), z = Number(rec.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const d = Math.hypot(x - px, y - py, z - pz);
    if (d <= lim) out.push({ rec, d });
  }
  out.sort((a, b) => a.d - b.d);
  return out.map((e) => e.rec);
}
// cap の外にだけ精錬設備の記録があるかを返す (cap超は幽霊・記録なしと対処が正反対のため分ける)。
export function hasSmeltStationBeyondCap(recs, pos, cap = 32) {
  if (!Array.isArray(recs) || !pos) return false;
  const px = Number(pos.x), py = Number(pos.y), pz = Number(pos.z);
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) return false;
  const lim = Number.isFinite(cap) && cap >= 0 ? cap : 32;
  for (const rec of recs) {
    if (!rec || !isSmeltStationId(rec.k)) continue;
    const x = Number(rec.x), y = Number(rec.y), z = Number(rec.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    if (Math.hypot(x - px, y - py, z - pz) > lim) return true;
  }
  return false;
}
// 再読段の結果を理由へ分類する純粋核。ghost=再読できたが設備でない (記録は恒久的に stale)、
// unreadable=例外/null で再読不能 (一時的でありうる。掃除しない)、cap_over=記録は cap の外だけ、
// no_record=精錬設備の記録自体が無い。対処が正反対のペアを同一理由へ潰さない。
export function classifyKnownSmeltOutcome(o = {}) {
  if ((o.ghost || 0) > 0) return "ghost";
  if ((o.unreadable || 0) > 0) return "unreadable";
  if (o.beyondCap) return "cap_over";
  return "no_record";
}
