// recipes.js — リゼ (LIZE-07) レシピ知識の単一の正（Phase 0 統合, 2026-11-24）
// 旧3系統を本モジュールへ統合した: decomposer 内蔵表（69出力）＋ crafting_data.js 131件
// （同一47件は一致を確認、競合6件は下記注記、新規74出力を EXTRA として吸収（圧縮解除4件は ALT へ分離））＋ bootstrap の燃料数値。
// crafting_data.js は本モジュールへ吸収済みのため削除した。新しいレシピはここへだけ追加すること。
// 競合の裁定: paper は現行ID minecraft:sugar_cane を正とした（旧ID reeds は不採用）。
// iron/gold ingot のブロック・金塊由来、bone_meal の bone_block 由来は代替レシピとして
// ALT_RECIPES に分離し、逆向き分解の主経路（精錬/骨）とはしない（従来挙動の保存）。
// 形式: outputItemId -> { out, inputs:{itemId:n}, kind:"craft"|"smelt", station:"hand"|"table"|"furnace" }

export const WOOD_SPECIES = [
  { log: "minecraft:oak_log", planks: "minecraft:oak_planks" },
  { log: "minecraft:spruce_log", planks: "minecraft:spruce_planks" },
  { log: "minecraft:birch_log", planks: "minecraft:birch_planks" },
  { log: "minecraft:jungle_log", planks: "minecraft:jungle_planks" },
  { log: "minecraft:acacia_log", planks: "minecraft:acacia_planks" },
  { log: "minecraft:dark_oak_log", planks: "minecraft:dark_oak_planks" },
  { log: "minecraft:mangrove_log", planks: "minecraft:mangrove_planks" },
  { log: "minecraft:cherry_log", planks: "minecraft:cherry_planks" },
  { log: "minecraft:pale_oak_log", planks: "minecraft:pale_oak_planks" },
  { log: "minecraft:crimson_stem", planks: "minecraft:crimson_planks" },
  { log: "minecraft:warped_stem", planks: "minecraft:warped_planks" },
];
const DEFAULT_SPECIES = WOOD_SPECIES[0]; // オーク

function toolSet(table, mat, prefix) {
  // ツール類: ツルハシ/斧/剣/シャベル/クワ（素材 mat ＋ 棒）
  table[`minecraft:${prefix}_pickaxe`] = { out: 1, inputs: { [mat]: 3, "minecraft:stick": 2 }, kind: "craft", station: "table" };
  table[`minecraft:${prefix}_axe`] = { out: 1, inputs: { [mat]: 3, "minecraft:stick": 2 }, kind: "craft", station: "table" };
  table[`minecraft:${prefix}_sword`] = { out: 1, inputs: { [mat]: 2, "minecraft:stick": 1 }, kind: "craft", station: "table" };
  table[`minecraft:${prefix}_shovel`] = { out: 1, inputs: { [mat]: 1, "minecraft:stick": 2 }, kind: "craft", station: "table" };
  table[`minecraft:${prefix}_hoe`] = { out: 1, inputs: { [mat]: 2, "minecraft:stick": 2 }, kind: "craft", station: "table" };
}

function buildBaseRecipes(species) {
  const R = {};
  const { log, planks } = species;

  // --- 木材チェーン（選択した樹種で生成） ---
  R[planks] = { out: 4, inputs: { [log]: 1 }, kind: "craft", station: "hand" };
  R["minecraft:stick"] = { out: 4, inputs: { [planks]: 2 }, kind: "craft", station: "hand" };
  R["minecraft:crafting_table"] = { out: 1, inputs: { [planks]: 4 }, kind: "craft", station: "hand" };
  R["minecraft:chest"] = { out: 1, inputs: { [planks]: 8 }, kind: "craft", station: "table" };
  toolSet(R, planks, "wooden");
  toolSet(R, "minecraft:cobblestone", "stone");
  toolSet(R, "minecraft:iron_ingot", "iron");
  toolSet(R, "minecraft:diamond", "diamond");
  R["minecraft:furnace"] = { out: 1, inputs: { "minecraft:cobblestone": 8 }, kind: "craft", station: "table" };
  R["minecraft:torch"] = { out: 4, inputs: { "minecraft:coal": 1, "minecraft:stick": 1 }, kind: "craft", station: "hand" };

  // --- 他樹種の板材（目標が他樹種板材の場合はそのまま引けるように） ---
  for (const sp of WOOD_SPECIES) {
    if (sp.planks !== planks) R[sp.planks] = { out: 4, inputs: { [sp.log]: 1 }, kind: "craft", station: "hand" };
  }

  // --- 精錬（かまど。out=1、1回 = 1個精錬） ---
  const smelt = (output, input) => { R[output] = { out: 1, inputs: { [input]: 1 }, kind: "smelt", station: "furnace" }; };
  smelt("minecraft:iron_ingot", "minecraft:raw_iron");
  smelt("minecraft:gold_ingot", "minecraft:raw_gold");
  smelt("minecraft:copper_ingot", "minecraft:raw_copper");
  smelt("minecraft:glass", "minecraft:sand");
  smelt("minecraft:stone", "minecraft:cobblestone");
  smelt("minecraft:netherite_scrap", "minecraft:ancient_debris");
  smelt("minecraft:brick", "minecraft:clay_ball");
  smelt("minecraft:charcoal", log);

  // --- 合成（複数素材・変換） ---
  R["minecraft:netherite_ingot"] = { out: 1, inputs: { "minecraft:netherite_scrap": 4, "minecraft:gold_ingot": 4 }, kind: "craft", station: "table" };
  R["minecraft:bone_meal"] = { out: 3, inputs: { "minecraft:bone": 1 }, kind: "craft", station: "hand" };
  R["minecraft:blaze_powder"] = { out: 2, inputs: { "minecraft:blaze_rod": 1 }, kind: "craft", station: "hand" };
  R["minecraft:paper"] = { out: 3, inputs: { "minecraft:sugar_cane": 3 }, kind: "craft", station: "table" };
  R["minecraft:white_wool"] = { out: 1, inputs: { "minecraft:string": 4 }, kind: "craft", station: "table" };
  R["minecraft:arrow"] = { out: 4, inputs: { "minecraft:flint": 1, "minecraft:stick": 1, "minecraft:feather": 1 }, kind: "craft", station: "table" };
  R["minecraft:sandstone"] = { out: 1, inputs: { "minecraft:sand": 4 }, kind: "craft", station: "hand" };
  R["minecraft:quartz_block"] = { out: 1, inputs: { "minecraft:quartz": 4 }, kind: "craft", station: "hand" };
  R["minecraft:glowstone"] = { out: 1, inputs: { "minecraft:glowstone_dust": 4 }, kind: "craft", station: "hand" };
  R["minecraft:melon_block"] = { out: 1, inputs: { "minecraft:melon_slice": 9 }, kind: "craft", station: "table" };
  R["minecraft:hay_block"] = { out: 1, inputs: { "minecraft:wheat": 9 }, kind: "craft", station: "table" };
  R["minecraft:snow_block"] = { out: 1, inputs: { "minecraft:snowball": 4 }, kind: "craft", station: "hand" };
  R["minecraft:clay"] = { out: 1, inputs: { "minecraft:clay_ball": 4 }, kind: "craft", station: "hand" };

  // --- 圧縮ブロック（9個→1ブロック） ---
  const pairs = [
    ["minecraft:diamond_block", "minecraft:diamond"],
    ["minecraft:iron_block", "minecraft:iron_ingot"],
    ["minecraft:gold_block", "minecraft:gold_ingot"],
    ["minecraft:emerald_block", "minecraft:emerald"],
    ["minecraft:coal_block", "minecraft:coal"],
    ["minecraft:redstone_block", "minecraft:redstone"],
    ["minecraft:lapis_block", "minecraft:lapis_lazuli"],
    ["minecraft:copper_block", "minecraft:copper_ingot"],
    ["minecraft:netherite_block", "minecraft:netherite_ingot"],
    ["minecraft:raw_iron_block", "minecraft:raw_iron"],
    ["minecraft:raw_gold_block", "minecraft:raw_gold"],
    ["minecraft:raw_copper_block", "minecraft:raw_copper"],
  ];
  for (const [block, unit] of pairs) R[block] = { out: 1, inputs: { [unit]: 9 }, kind: "craft", station: "table" };

  return R;
}

// ---- crafting_data.js から吸収した追加レシピ（oak 基準。新規74出力） ----
export const EXTRA_RECIPES = {
  "minecraft:bowl": { out: 4, inputs: {"minecraft:oak_planks": 3}, kind: "craft", station: "table" },
  "minecraft:ladder": { out: 3, inputs: {"minecraft:stick": 7}, kind: "craft", station: "table" },
  "minecraft:oak_fence": { out: 3, inputs: {"minecraft:oak_planks": 4, "minecraft:stick": 2}, kind: "craft", station: "table" },
  "minecraft:oak_fence_gate": { out: 1, inputs: {"minecraft:oak_planks": 2, "minecraft:stick": 4}, kind: "craft", station: "table" },
  "minecraft:oak_door": { out: 3, inputs: {"minecraft:oak_planks": 6}, kind: "craft", station: "table" },
  "minecraft:oak_trapdoor": { out: 2, inputs: {"minecraft:oak_planks": 6}, kind: "craft", station: "table" },
  "minecraft:oak_stairs": { out: 4, inputs: {"minecraft:oak_planks": 6}, kind: "craft", station: "table" },
  "minecraft:oak_slab": { out: 6, inputs: {"minecraft:oak_planks": 3}, kind: "craft", station: "table" },
  "minecraft:oak_sign": { out: 3, inputs: {"minecraft:oak_planks": 6, "minecraft:stick": 1}, kind: "craft", station: "table" },
  "minecraft:oak_boat": { out: 1, inputs: {"minecraft:oak_planks": 5}, kind: "craft", station: "table" },
  "minecraft:wooden_button": { out: 1, inputs: {"minecraft:oak_planks": 1}, kind: "craft", station: "hand" },
  "minecraft:wooden_pressure_plate": { out: 1, inputs: {"minecraft:oak_planks": 2}, kind: "craft", station: "table" },
  "minecraft:white_bed": { out: 1, inputs: {"minecraft:white_wool": 3, "minecraft:oak_planks": 3}, kind: "craft", station: "table" },
  "minecraft:barrel": { out: 1, inputs: {"minecraft:oak_planks": 6, "minecraft:oak_slab": 2}, kind: "craft", station: "table" },
  "minecraft:composter": { out: 1, inputs: {"minecraft:oak_slab": 7}, kind: "craft", station: "table" },
  "minecraft:cobblestone_stairs": { out: 4, inputs: {"minecraft:cobblestone": 6}, kind: "craft", station: "table" },
  "minecraft:cobblestone_slab": { out: 6, inputs: {"minecraft:cobblestone": 3}, kind: "craft", station: "table" },
  "minecraft:cobblestone_wall": { out: 6, inputs: {"minecraft:cobblestone": 6}, kind: "craft", station: "table" },
  "minecraft:lever": { out: 1, inputs: {"minecraft:stick": 1, "minecraft:cobblestone": 1}, kind: "craft", station: "hand" },
  "minecraft:bucket": { out: 1, inputs: {"minecraft:iron_ingot": 3}, kind: "craft", station: "table" },
  "minecraft:shears": { out: 1, inputs: {"minecraft:iron_ingot": 2}, kind: "craft", station: "table" },
  "minecraft:flint_and_steel": { out: 1, inputs: {"minecraft:iron_ingot": 1, "minecraft:flint": 1}, kind: "craft", station: "hand" },
  "minecraft:shield": { out: 1, inputs: {"minecraft:oak_planks": 6, "minecraft:iron_ingot": 1}, kind: "craft", station: "table" },
  "minecraft:hopper": { out: 1, inputs: {"minecraft:iron_ingot": 5, "minecraft:chest": 1}, kind: "craft", station: "table" },
  "minecraft:minecart": { out: 1, inputs: {"minecraft:iron_ingot": 5}, kind: "craft", station: "table" },
  "minecraft:rail": { out: 16, inputs: {"minecraft:iron_ingot": 6, "minecraft:stick": 1}, kind: "craft", station: "table" },
  "minecraft:anvil": { out: 1, inputs: {"minecraft:iron_block": 3, "minecraft:iron_ingot": 4}, kind: "craft", station: "table" },
  "minecraft:compass": { out: 1, inputs: {"minecraft:iron_ingot": 4, "minecraft:redstone": 1}, kind: "craft", station: "table" },
  "minecraft:golden_pickaxe": { out: 1, inputs: {"minecraft:gold_ingot": 3, "minecraft:stick": 2}, kind: "craft", station: "table" },
  "minecraft:golden_axe": { out: 1, inputs: {"minecraft:gold_ingot": 3, "minecraft:stick": 2}, kind: "craft", station: "table" },
  "minecraft:golden_shovel": { out: 1, inputs: {"minecraft:gold_ingot": 1, "minecraft:stick": 2}, kind: "craft", station: "table" },
  "minecraft:golden_sword": { out: 1, inputs: {"minecraft:gold_ingot": 2, "minecraft:stick": 1}, kind: "craft", station: "table" },
  "minecraft:golden_hoe": { out: 1, inputs: {"minecraft:gold_ingot": 2, "minecraft:stick": 2}, kind: "craft", station: "table" },
  "minecraft:clock": { out: 1, inputs: {"minecraft:gold_ingot": 4, "minecraft:redstone": 1}, kind: "craft", station: "table" },
  "minecraft:iron_helmet": { out: 1, inputs: {"minecraft:iron_ingot": 5}, kind: "craft", station: "table" },
  "minecraft:iron_chestplate": { out: 1, inputs: {"minecraft:iron_ingot": 8}, kind: "craft", station: "table" },
  "minecraft:iron_leggings": { out: 1, inputs: {"minecraft:iron_ingot": 7}, kind: "craft", station: "table" },
  "minecraft:iron_boots": { out: 1, inputs: {"minecraft:iron_ingot": 4}, kind: "craft", station: "table" },
  "minecraft:diamond_helmet": { out: 1, inputs: {"minecraft:diamond": 5}, kind: "craft", station: "table" },
  "minecraft:diamond_chestplate": { out: 1, inputs: {"minecraft:diamond": 8}, kind: "craft", station: "table" },
  "minecraft:diamond_leggings": { out: 1, inputs: {"minecraft:diamond": 7}, kind: "craft", station: "table" },
  "minecraft:diamond_boots": { out: 1, inputs: {"minecraft:diamond": 4}, kind: "craft", station: "table" },
  "minecraft:leather_helmet": { out: 1, inputs: {"minecraft:leather": 5}, kind: "craft", station: "table" },
  "minecraft:leather_chestplate": { out: 1, inputs: {"minecraft:leather": 8}, kind: "craft", station: "table" },
  "minecraft:leather_leggings": { out: 1, inputs: {"minecraft:leather": 7}, kind: "craft", station: "table" },
  "minecraft:leather_boots": { out: 1, inputs: {"minecraft:leather": 4}, kind: "craft", station: "table" },
  "minecraft:blast_furnace": { out: 1, inputs: {"minecraft:iron_ingot": 5, "minecraft:furnace": 1, "minecraft:smooth_stone": 3}, kind: "craft", station: "table" },
  "minecraft:smoker": { out: 1, inputs: {"minecraft:furnace": 1, "minecraft:oak_log": 4}, kind: "craft", station: "table" },
  "minecraft:stonecutter": { out: 1, inputs: {"minecraft:stone": 3, "minecraft:iron_ingot": 1}, kind: "craft", station: "table" },
  "minecraft:smithing_table": { out: 1, inputs: {"minecraft:iron_ingot": 2, "minecraft:oak_planks": 4}, kind: "craft", station: "table" },
  "minecraft:grindstone": { out: 1, inputs: {"minecraft:stick": 2, "minecraft:stone_slab": 1, "minecraft:oak_planks": 2}, kind: "craft", station: "table" },
  "minecraft:campfire": { out: 1, inputs: {"minecraft:stick": 3, "minecraft:coal": 1, "minecraft:oak_log": 3}, kind: "craft", station: "table" },
  "minecraft:redstone_torch": { out: 1, inputs: {"minecraft:redstone": 1, "minecraft:stick": 1}, kind: "craft", station: "hand" },
  "minecraft:stone_bricks": { out: 4, inputs: {"minecraft:stone": 4}, kind: "craft", station: "table" },
  "minecraft:glass_bottle": { out: 3, inputs: {"minecraft:glass": 3}, kind: "craft", station: "table" },
  "minecraft:bow": { out: 1, inputs: {"minecraft:stick": 3, "minecraft:string": 3}, kind: "craft", station: "table" },
  "minecraft:fishing_rod": { out: 1, inputs: {"minecraft:stick": 3, "minecraft:string": 2}, kind: "craft", station: "table" },
  "minecraft:tnt": { out: 1, inputs: {"minecraft:gunpowder": 5, "minecraft:sand": 4}, kind: "craft", station: "table" },
  "minecraft:iron_nugget": { out: 9, inputs: {"minecraft:iron_ingot": 1}, kind: "craft", station: "hand" },
  "minecraft:gold_nugget": { out: 9, inputs: {"minecraft:gold_ingot": 1}, kind: "craft", station: "hand" },
  "minecraft:bone_block": { out: 1, inputs: {"minecraft:bone_meal": 9}, kind: "craft", station: "table" },
  "minecraft:bread": { out: 1, inputs: {"minecraft:wheat": 3}, kind: "craft", station: "table" },
  "minecraft:book": { out: 1, inputs: {"minecraft:paper": 3, "minecraft:leather": 1}, kind: "craft", station: "table" },
  "minecraft:smooth_stone": { out: 1, inputs: {"minecraft:stone": 1}, kind: "smelt", station: "furnace" },
  "minecraft:terracotta": { out: 1, inputs: {"minecraft:clay": 1}, kind: "smelt", station: "furnace" },
  "minecraft:netherbrick": { out: 1, inputs: {"minecraft:netherrack": 1}, kind: "smelt", station: "furnace" },
  "minecraft:cooked_beef": { out: 1, inputs: {"minecraft:beef": 1}, kind: "smelt", station: "furnace" },
  "minecraft:cooked_porkchop": { out: 1, inputs: {"minecraft:porkchop": 1}, kind: "smelt", station: "furnace" },
  "minecraft:cooked_chicken": { out: 1, inputs: {"minecraft:chicken": 1}, kind: "smelt", station: "furnace" },
  "minecraft:cooked_mutton": { out: 1, inputs: {"minecraft:mutton": 1}, kind: "smelt", station: "furnace" },
  "minecraft:baked_potato": { out: 1, inputs: {"minecraft:potato": 1}, kind: "smelt", station: "furnace" },
  "minecraft:cooked_cod": { out: 1, inputs: {"minecraft:cod": 1}, kind: "smelt", station: "furnace" },
  "minecraft:cooked_salmon": { out: 1, inputs: {"minecraft:salmon": 1}, kind: "smelt", station: "furnace" },
  "minecraft:dried_kelp": { out: 1, inputs: {"minecraft:kelp": 1}, kind: "smelt", station: "furnace" },
};

export function buildRecipes(species) {
  const R = buildBaseRecipes(species);
  for (const k of Object.keys(EXTRA_RECIPES)) if (!R[k]) R[k] = EXTRA_RECIPES[k];
  return R;
}

// 代替レシピ（分解の主経路には使わない。知識として保持）
export const ALT_RECIPES = [
  { output: "minecraft:iron_ingot", out: 9, inputs: { "minecraft:iron_block": 1 }, kind: "craft", station: "hand", noDecompose: true },
  { output: "minecraft:iron_ingot", out: 1, inputs: { "minecraft:iron_nugget": 9 }, kind: "craft", station: "table" },
  { output: "minecraft:gold_ingot", out: 9, inputs: { "minecraft:gold_block": 1 }, kind: "craft", station: "hand", noDecompose: true },
  { output: "minecraft:gold_ingot", out: 1, inputs: { "minecraft:gold_nugget": 9 }, kind: "craft", station: "table" },
  { output: "minecraft:bone_meal", out: 9, inputs: { "minecraft:bone_block": 1 }, kind: "craft", station: "hand" },
  { output: "minecraft:diamond", out: 9, inputs: { "minecraft:diamond_block": 1 }, kind: "craft", station: "hand", noDecompose: true },
  { output: "minecraft:coal", out: 9, inputs: { "minecraft:coal_block": 1 }, kind: "craft", station: "hand", noDecompose: true },
  { output: "minecraft:redstone", out: 9, inputs: { "minecraft:redstone_block": 1 }, kind: "craft", station: "hand", noDecompose: true },
  { output: "minecraft:wheat", out: 9, inputs: { "minecraft:hay_block": 1 }, kind: "craft", station: "hand", noDecompose: true },
];

// 燃料表の単一の正: 1単位で精錬できる個数（crafting_data FUELS を正、bootstrap FUEL_VALUES の石炭8と一致）
export const FUEL_TABLE = {
  "minecraft:coal": 8, "minecraft:charcoal": 8,
  "minecraft:lava_bucket": 100, "minecraft:coal_block": 80, "minecraft:blaze_rod": 12,
  "minecraft:oak_log": 1.5, "minecraft:oak_planks": 1.5, "minecraft:oak_slab": 0.75,
  "minecraft:stick": 0.5, "minecraft:wooden_pickaxe": 1, "minecraft:bamboo": 0.25,
};
// 燃料の容器返却属性 (知識データ, Phase3 SMELT P2): 消費すると容器が残る燃料。
// 実行部はこの表で汎用的に返却する (燃料名の分岐は置かない)。
export const FUEL_CONTAINER_RETURN = { "minecraft:lava_bucket": "minecraft:bucket" };
// 変種候補・実行消費からの宣言的例外 (Phase3 SMELT P2, cycle1916-a02 実測で従来裁定を反転):
// 木ツルハシは素材の埋め込み燃焼量 5.5 に対し燃料値 1 で、計画コストが道具価値を
// 過小評価して小バッチで優先的に燃やし、最後の1本の喪失も成功として不可視になる。
// 汎用的な道具保護 (最後の1個保護) が入るまで、候補・実行消費の双方から外す。
export const FUEL_VARIANT_EXCLUDED = Object.freeze(["minecraft:wooden_pickaxe", "minecraft:wooden_axe", "minecraft:wooden_sword", "minecraft:wooden_shovel", "minecraft:wooden_hoe"]);
export function smeltPerFuel(itemId) { const v = FUEL_TABLE[itemId]; return (typeof v === "number" && v > 0) ? v : 8; }
export function recipeFor(itemId, species) { return buildRecipes(species || WOOD_SPECIES[0])[itemId] || null; }
export function countRecipes() { return Object.keys(buildRecipes(WOOD_SPECIES[0])).length; }
