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
