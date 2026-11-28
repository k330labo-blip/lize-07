// cell_class.js — typeId 基礎分類の単一の正（cell_class P1 表化, cyc2494）
//
// 1つの typeId について、意味の違う2軸を別フィールドで返す:
//   occlusion: 視線軸（見えるか）。observability.js の occlusionClass の正。
//              "opaque" | "transparent" | "partial" | "unknown"
//   body:      体軸（入れるか・立てるか・危ないか）。nav.js の classifyTypeId の正。
//              { solid, pass, water, lava, hazard, cost, door, doorOpenable, top, unknown }
//              に、葉のときだけ leaves:true が付く（現行どおりの非対称を保存する）。
//
// 2軸は別の規則列で計算する。葉・ガラス・氷は「視線は通るが体は通らない」ため、
// 片方の軸からもう片方を導出してはならない（cyc2482 A01 裁定）。完全一致リストも
// 軸ごとに別に持つ: 重なる ID が多いだけで同一ではない（例: ice は視線リストにだけある）。
//
// 本ファイルは @minecraft/server に依存しない純粋モジュール。nav.js / observability.js
// の両方から import されるため、どちらへも import を持たない（循環を作らない）。
// 分類値を変える是正は別単位で行うこと（本ファイルは定義場所の単一化が責務）。
// 流体の体軸判定は完全一致のみ（cell_class ⑦, cyc2494 前段サブステップで是正済み:
// water_bucket / lava_bucket 等の部分一致による過剰な流体扱いをしない）。

// ---------------------------------------------------------------------------
// 体軸（旧 nav.js の定数群を移設）
// ---------------------------------------------------------------------------

// 体が通る ID の接尾辞。cell_class P3 (cyc2493): "_bush_dead" は語順逆の死にパターンの
// ため削除済み (dead_bush は BODY_PASS_EXACT が担う)。苗木・ボタンは材質によらず体を塞がない
const BODY_PASS_SUFFIX = ["_grass", "_flower", "_tulip", "_orchid", "_daisy", "_lily", "_fern", "_sapling", "_button"];
const BODY_PASS_EXACT = new Set([
  "minecraft:air", "minecraft:cave_air", "minecraft:void_air", // cell_class P3-1: 空気の変種を固体扱いしない
  "minecraft:tripwire", "minecraft:string", // cell_class P3-3: 糸・トリップワイヤーは体を塞がない
  "minecraft:dandelion", "minecraft:azure_bluet", "minecraft:sunflower", "minecraft:lilac", "minecraft:rose_bush", "minecraft:peony", // cell_class P3-4: 単語形の花は接尾辞で拾えないため完全一致
  "minecraft:tall_grass", "minecraft:short_grass", "minecraft:grass",
  "minecraft:fern", "minecraft:large_fern", "minecraft:dead_bush", "minecraft:torch",
  "minecraft:soul_torch", "minecraft:redstone_torch", "minecraft:redstone_wire",
  "minecraft:rail", "minecraft:golden_rail", "minecraft:detector_rail", "minecraft:activator_rail",
  "minecraft:carpet", "minecraft:moss_carpet", "minecraft:lever", "minecraft:stone_button",
  "minecraft:vine", "minecraft:glow_lichen", "minecraft:snow_layer", "minecraft:lily_pad",
  "minecraft:sugar_cane", // cycle1110 CANE-01段1: サトウキビは体が通る
]);
const BODY_COSTLY_PASS = [ // [部分一致, コスト] 体は通るが高コスト
  ["sweet_berry_bush", 4.0], ["powder_snow", 4.0], ["cobweb", 8.0],
];
const BODY_COSTLY_SOLID = [ // [部分一致, コスト] 固体かつ高コスト
  ["magma", 6.0], // cell_class P3-6 (cyc2493): campfire は先行する hazard 判定で hazard になるため、こちらは到達不能な死にコードだった。正は hazard
];

// 体軸の既定セル（旧 nav.js の AIR）。呼び出しごとに新しい複製を作る
// （旧 classifyTypeId が毎回新規オブジェクトを返す契約を保存するため、
// 凍結した共有オブジェクトをそのまま返してはならない）。
function bodyAir() {
  return { solid: false, pass: true, water: false, lava: false, hazard: false, cost: 0, door: false, doorOpenable: false, top: 1, unknown: false };
}

// 体軸の計算。判定順・早期 return は旧 classifyTypeId と同一（流体だけ ⑦ で完全一致化済み）。
// api は isLiquid のみ受け付ける（正式版では Block の isSolid プロパティは常に undefined のため使わない）。
function bodyOf(typeId, api) {
  const id = String(typeId || "minecraft:air"); // 旧契約: null/空は air として扱う（未読込の扱いは呼び出し側の cellUnknown が担う）
  const c = bodyAir();
  if (id === "minecraft:lava" || id === "minecraft:flowing_lava") { c.lava = true; c.pass = false; return c; }
  if (id === "minecraft:water" || id === "minecraft:flowing_water") { c.water = true; return c; } // pass=true のまま（泳ぎ/水ノード）
  if (id.endsWith("_door") || id.endsWith("_fence_gate") || id === "minecraft:iron_door") {
    c.door = true; c.pass = false;
    c.doorOpenable = !id.includes("iron");
    return c;
  }
  if (id.endsWith("_trapdoor")) { c.solid = true; c.pass = false; return c; } // 閉じている前提で支持（開は統合側で要確認）
  if (id.includes("fire") || id.endsWith("cactus") || id.includes("wither_rose")) { c.hazard = true; c.pass = false; return c; }
  if (id.endsWith("_leaves")) { c.solid = true; c.pass = false; c.leaves = true; return c; } // v0.4.59: 葉は体は通さないが「地面」ではない (fly.groundNear が区別する)。leaves はこの分岐でのみ付く
  for (const [sub, cost] of BODY_COSTLY_PASS) if (id.includes(sub)) { c.cost = cost; return c; }
  for (const [sub, cost] of BODY_COSTLY_SOLID) if (id.includes(sub)) { c.solid = true; c.pass = false; c.cost = cost; return c; }
  if (BODY_PASS_EXACT.has(id) || BODY_PASS_SUFFIX.some((s) => id.endsWith(s)) || id.endsWith("_carpet") || id.endsWith("_sign") || id.endsWith("_pressure_plate")) {
    return c; // 通過可能
  }
  // top 近似は solid 確定より「前」に行う（旧順序の保存）。この位置で代入しておくことで、
  // 直後の api.isLiquid 経路でも、末尾の solid 経路でも、同じ top が返る。
  if (id.endsWith("_slab") && !id.includes("double")) c.top = 0.5; // 下付きハーフブロック近似（両面 slab は対象外で top=1 のまま）
  if ((id.endsWith("_fence") || id.endsWith("_wall")) && !id.endsWith("_fence_gate")) c.top = 1.5; // BASICS-07 (cycle1400): フェンス/塀の実衝突は1.5
  if (api && api.isLiquid) { c.water = true; return c; }
  c.solid = true; c.pass = false; // 不明なブロックは固体として倒す（安全側）
  return c;
}

// ---------------------------------------------------------------------------
// 視線軸（旧 observability.js の定数群を移設）
// ---------------------------------------------------------------------------

// 視界を通すブロック（完全一致）。体軸の BODY_PASS_EXACT とは別物:
// ice/barrier/ladder/scaffolding/slime_block/honey_block/fire 等は視線だけが通る。
const SIGHT_TRANSPARENT_EXACT = new Set([
  "minecraft:air", "minecraft:cave_air", "minecraft:void_air",
  "minecraft:glass", "minecraft:glass_pane", "minecraft:tinted_glass",
  "minecraft:ice", "minecraft:barrier", "minecraft:light_block",
  "minecraft:structure_void",
  "minecraft:torch", "minecraft:soul_torch", "minecraft:redstone_torch",
  "minecraft:redstone_wire", "minecraft:rail", "minecraft:golden_rail",
  "minecraft:detector_rail", "minecraft:activator_rail",
  "minecraft:lever", "minecraft:vine", "minecraft:glow_lichen",
  "minecraft:lily_pad", "minecraft:sugar_cane", "minecraft:cobweb",
  "minecraft:fire", "minecraft:soul_fire", "minecraft:ladder",
  "minecraft:tripwire", "minecraft:string", "minecraft:scaffolding",
  "minecraft:slime_block", "minecraft:honey_block",
  // 0-P S0 (cyc2483, A01裁定 P2): 接尾辞形で拾えない単語形IDの族内不整合を是正
  "minecraft:grass", "minecraft:fern", "minecraft:dead_bush", "minecraft:snow_layer", "minecraft:sweet_berry_bush", "minecraft:wither_rose",
  // cell_class P3 (cyc2493): 単語形の花6種。素の carpet も _carpet 終端に一致しないため完全一致で追加 (moss_carpet は終端でも拾えるが明示)
  "minecraft:dandelion", "minecraft:azure_bluet", "minecraft:sunflower", "minecraft:lilac", "minecraft:rose_bush", "minecraft:peony",
  "minecraft:carpet", "minecraft:moss_carpet",
]);

// 一部だけ遮るブロック（接尾辞）。視線判定では保守的に「遮る」側へ倒す。
// _carpet は床面の薄片で視線を遮らないため partial ではなく transparent 側（0-P S0）。
const SIGHT_PARTIAL_SUFFIX = ["_slab", "_stairs", "_fence", "_wall", "_trapdoor"];

// 流体は視線軸では「完全一致セット」でだけ判定する。
const SIGHT_OPAQUE_FLUID = new Set(["minecraft:lava", "minecraft:flowing_lava"]); // 溶岩の中は視認できない
const SIGHT_TRANSPARENT_FLUID = new Set(["minecraft:water", "minecraft:flowing_water"]); // 水越しには見える

// 視線軸の計算。判定順は旧 occlusionClass と同一。
// null/undefined はここでは扱わず、呼び出し側（occlusionClass）が "unknown" を返す
// （classifyCell 自体も null を受けたら occlusion:"unknown" を返す）。
function occlusionOf(typeId) {
  const id = String(typeId);
  if (SIGHT_TRANSPARENT_FLUID.has(id)) return "transparent";
  if (SIGHT_OPAQUE_FLUID.has(id)) return "opaque";
  if (SIGHT_TRANSPARENT_EXACT.has(id)) return "transparent";
  if (id === "minecraft:glass" || id.endsWith("_glass") || id.endsWith("glass_pane")) return "transparent"; // cell_class P2後半 (cyc2493): includes("glass") から狭窄済み。glass_bottle は透過にしない
  if (id.endsWith("_leaves")) return "transparent"; // 葉は透けて見える（隙間がある）
  if (id.endsWith("_sign") || id.endsWith("_button") || id.endsWith("_pressure_plate")) return "transparent";
  if (id.endsWith("_grass") || id.endsWith("_flower") || id.endsWith("_fern") || id.endsWith("_sapling") || id.endsWith("_tulip") || id.endsWith("_orchid") || id.endsWith("_daisy")) return "transparent";
  if (id.endsWith("_carpet")) return "transparent"; // 0-P S0: カーペット類は視線透過
  for (const s of SIGHT_PARTIAL_SUFFIX) if (id.endsWith(s)) return "partial";
  return "opaque"; // 大半の固体はこちら（鉱石・チェスト等の対象物も含む）。未知 ID も安全側
}

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

/**
 * typeId の2軸分類を返す。判定規則は旧 nav.classifyTypeId（body）と
 * 旧 observability.occlusionClass（occlusion）の和集合（流体の体軸は ⑦ 完全一致化済み）。
 * @param {string|null|undefined} typeId
 * @param {{isLiquid?: boolean}|null} [api] 体軸の isLiquid 判定だけに使う（旧 classifyTypeId の第2引数と同一契約）
 * @returns {{ occlusion: string, body: object }} body は呼び出しごとに新規オブジェクト。
 *   null/undefined のとき occlusion は "unknown"、body は旧 classifyTypeId(null) と同じ air セル。
 */
export function classifyCell(typeId, api = null) {
  if (typeId === null || typeId === undefined) {
    return { occlusion: "unknown", body: bodyOf(typeId, api) };
  }
  return { occlusion: occlusionOf(typeId), body: bodyOf(typeId, api) };
}
