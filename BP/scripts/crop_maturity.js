// ============================================================
// リゼ (LIZE-07) 作物の成熟上限 — 知識データ（単一の正）
// 作物ごとに growth の上限が違う（小麦等は7、ビートルートは3）ため、
// 一律の閾値で判定すると上限の小さい作物が構造的に成熟扱いにならない。
// 判定は isCropMature() の純粋関数のみを使い、閾値のベタ書きをしない。
// ============================================================

export const CROP_MATURITY_MAX = {
  "minecraft:wheat": 7,
  "minecraft:carrots": 7,
  "minecraft:potatoes": 7,
  "minecraft:beetroot": 3,
};

export function isCropBlock(typeId) {
  return Object.prototype.hasOwnProperty.call(CROP_MATURITY_MAX, typeId);
}

// growth が読めない（null/undefined/非数）場合は安全側で未成熟。
export function isCropMature(typeId, growth) {
  if (!isCropBlock(typeId)) return false;
  if (growth === null || growth === undefined) return false;
  const g = Number(growth);
  if (!Number.isFinite(g)) return false;
  return g >= CROP_MATURITY_MAX[typeId];
}

// cycle1543 収穫A-F1: BREAK の前提条件としての成熟ゲート (汎用述語)。
// 非作物は null (ゲート対象外)、作物は成熟なら {ok:true}、未成熟/読取不能なら
// fail-closed で {ok:false, reason:"IMMATURE"}。閾値は CROP_MATURITY_MAX が単一の正。
export function cropBreakGate(typeId, growth) {
  if (!isCropBlock(typeId)) return null;
  return isCropMature(typeId, growth) ? { ok: true } : { ok: false, reason: "IMMATURE" };
}
