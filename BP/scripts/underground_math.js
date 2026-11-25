// underground_math.js — 地下判定の純粋核 (キュー0副次, cycle1400)
// 出典: basics-stone-stop REPORT「isUnderground が雪で反転」の切り分け。
// 実測の結論: 反転は地形差ではなく、掘り済み列 (上方が空気) と未掘列を比べた
// ハーネス側の artefact だった。同一列条件では雪層の有無で結果は変わらない。
// 本モジュールは main.js isUnderground の数え上げ規則を純粋関数化し、その
// 性質 (雪層は地形に数えない / 地形2以上で地下) を回帰テストで固定する。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// 固体判定は呼び出し側が solidOfTypeId を注入する (nav が単一の正)。

export const UNDERGROUND_TERRAIN_MIN = 2;
export const UNDERGROUND_SCAN_MAX = 48;

// 地形に数えない ID。旧 main.js の除外 regex は部分文字列 grass が
// minecraft:grass_block (地表の地形そのもの) にまでマッチする過剰除外だった
// (cycle1400 a17 実測)。草は short/tall_grass の完全形だけを除外する。
const NON_TERRAIN = /_leaves$|_log$|_wood$|_stem$|vine|short_grass|tall_grass|flower|snow_layer/;

export function isTerrainId(typeId) {
  try {
    if (typeof typeId !== "string" || !typeId) return false;
    if (typeId === "minecraft:air") return false;
    return !NON_TERRAIN.test(typeId);
  } catch { return false; }
}

// countTerrainAbove(getId, isSolid, locY, topY) -> 上方の地形固体数
// getId(y) -> typeId|null, isSolid(typeId) -> boolean
export function countTerrainAbove(getId, isSolid, locY, topY) {
  try {
    if (typeof getId !== "function" || typeof isSolid !== "function") return 0;
    if (!Number.isFinite(locY) || !Number.isFinite(topY) || topY <= locY) return 0;
    let n = 0;
    const hi = Math.min(topY, locY + UNDERGROUND_SCAN_MAX);
    for (let y = locY + 1; y <= hi; y++) {
      const id = getId(y);
      if (!id || !isTerrainId(id)) continue;
      let solid = false; try { solid = !!isSolid(id); } catch {}
      if (solid) n++;
    }
    return n;
  } catch { return 0; }
}

// isUndergroundColumn(getId, isSolid, locY, topY) -> boolean
export function isUndergroundColumn(getId, isSolid, locY, topY) {
  try { return countTerrainAbove(getId, isSolid, locY, topY) >= UNDERGROUND_TERRAIN_MIN; }
  catch { return false; }
}
