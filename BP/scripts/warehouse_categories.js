// warehouse_categories.js — 倉庫 W1/W3: 仕分け先カテゴリ語彙の単一の正 (cyc1908)。
// UI・台帳・仕分け核 (warehouse_sort の category 一致) はこの語彙の id を共有する。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
export const WAREHOUSE_CATEGORIES = [
  { id: "ore", label: "鉱石・金属" },
  { id: "wood", label: "木材" },
  { id: "food", label: "食料" },
  { id: "block", label: "建材ブロック" },
  { id: "misc", label: "雑貨" },
];
export function isWarehouseCategory(id) {
  try { return typeof id === "string" && WAREHOUSE_CATEGORIES.some((c) => c.id === id); } catch { return false; }
}
export function categoryLabelOf(id) {
  try {
    if (typeof id !== "string") return null;
    const hit = WAREHOUSE_CATEGORIES.find((c) => c.id === id);
    return hit ? hit.label : null;
  } catch { return null; }
}

// W3 (2) 既知分類: 品目 (完全一致 typeId) -> カテゴリの単一の正 (cyc2059)。
// 契約: 完全一致のみ。名前空間・部分一致・接尾辞では決めない (名前空間は出典情報のみ)。
// 写像に無い品目は null = 分類不明として元箱に残る (warehouse_sort の unknown_destination)。
// 代表品目から開始し、全網羅は狙わない。追加はこの表への追記だけで行う。
export const WAREHOUSE_ITEM_CATEGORIES = {
  // ore: 鉱石・金属・燃料鉱物
  "minecraft:coal": "ore", "minecraft:charcoal": "ore", "minecraft:coal_ore": "ore", "minecraft:deepslate_coal_ore": "ore", "minecraft:coal_block": "ore",
  "minecraft:iron_ore": "ore", "minecraft:deepslate_iron_ore": "ore", "minecraft:iron_ingot": "ore", "minecraft:iron_block": "ore", "minecraft:iron_nugget": "ore",
  "minecraft:copper_ore": "ore", "minecraft:deepslate_copper_ore": "ore", "minecraft:copper_ingot": "ore", "minecraft:copper_block": "ore",
  "minecraft:gold_ore": "ore", "minecraft:deepslate_gold_ore": "ore", "minecraft:nether_gold_ore": "ore", "minecraft:gold_ingot": "ore", "minecraft:gold_block": "ore", "minecraft:gold_nugget": "ore",
  "minecraft:diamond": "ore", "minecraft:deepslate_diamond_ore": "ore", "minecraft:diamond_block": "ore",
  "minecraft:emerald": "ore", "minecraft:emerald_ore": "ore", "minecraft:deepslate_emerald_ore": "ore", "minecraft:emerald_block": "ore",
  "minecraft:lapis_lazuli": "ore", "minecraft:lapis_ore": "ore", "minecraft:deepslate_lapis_ore": "ore", "minecraft:lapis_block": "ore",
  "minecraft:deepslate_redstone_ore": "ore", "minecraft:quartz": "ore", "minecraft:ancient_debris": "ore",
  "minecraft:glowstone_dust": "ore", "minecraft:amethyst_shard": "ore",
  "minecraft:raw_iron": "ore", "minecraft:raw_gold": "ore", "minecraft:raw_copper": "ore", "minecraft:redstone": "ore",
  "minecraft:netherite_ingot": "ore", "minecraft:netherite_scrap": "ore",
  // wood: 原木・木材
  "minecraft:oak_log": "wood", "minecraft:birch_log": "wood", "minecraft:acacia_log": "wood", "minecraft:cherry_log": "wood",
  "minecraft:dark_oak_log": "wood", "minecraft:jungle_log": "wood", "minecraft:mangrove_log": "wood", "minecraft:pale_oak_log": "wood", "minecraft:crimson_stem": "wood",
  "minecraft:acacia_planks": "wood", "minecraft:birch_planks": "wood", "minecraft:cherry_planks": "wood", "minecraft:dark_oak_planks": "wood",
  "minecraft:jungle_planks": "wood", "minecraft:mangrove_planks": "wood", "minecraft:bamboo_planks": "wood", "minecraft:crimson_planks": "wood",
  "minecraft:spruce_log": "wood", "minecraft:spruce_planks": "wood", "minecraft:oak_planks": "wood",
  // food: 食料
  "minecraft:apple": "food", "minecraft:golden_apple": "food", "minecraft:golden_carrot": "food", "minecraft:baked_potato": "food",
  "minecraft:beef": "food", "minecraft:cooked_beef": "food", "minecraft:porkchop": "food", "minecraft:cooked_porkchop": "food",
  "minecraft:chicken": "food", "minecraft:cooked_chicken": "food", "minecraft:mutton": "food", "minecraft:cooked_mutton": "food",
  "minecraft:cod": "food", "minecraft:cooked_cod": "food", "minecraft:cooked_salmon": "food", "minecraft:cooked_rabbit": "food",
  "minecraft:bread": "food", "minecraft:carrot": "food", "minecraft:potato": "food", "minecraft:beetroot": "food",
  "minecraft:cookie": "food", "minecraft:pumpkin_pie": "food", "minecraft:melon_slice": "food", "minecraft:dried_kelp": "food", "minecraft:egg": "food",
  // block: 建材ブロック
  "minecraft:cobblestone": "block", "minecraft:mossy_cobblestone": "block", "minecraft:cobbled_deepslate": "block", "minecraft:deepslate": "block",
  "minecraft:dirt": "block", "minecraft:gravel": "block", "minecraft:glass": "block", "minecraft:bricks": "block", "minecraft:brick": "block",
  "minecraft:andesite": "block", "minecraft:basalt": "block", "minecraft:blackstone": "block", "minecraft:clay": "block",
  "minecraft:end_stone": "block", "minecraft:glowstone": "block", "minecraft:dripstone_block": "block", "minecraft:calcite": "block",
  "minecraft:pumpkin": "block", "minecraft:melon_block": "block", "minecraft:bone_block": "block",
  "minecraft:stone": "block", "minecraft:sand": "block", "minecraft:sandstone": "block", "minecraft:obsidian": "block",
  "minecraft:diorite": "block", "minecraft:granite": "block", "minecraft:netherrack": "block",
  // misc: 雑貨
  "minecraft:bone": "misc", "minecraft:bone_meal": "misc", "minecraft:book": "misc", "minecraft:bowl": "misc", "minecraft:bucket": "misc",
  "minecraft:clock": "misc", "minecraft:compass": "misc", "minecraft:feather": "misc", "minecraft:leather": "misc", "minecraft:paper": "misc",
  "minecraft:arrow": "misc", "minecraft:blaze_rod": "misc", "minecraft:blaze_powder": "misc", "minecraft:glass_bottle": "misc", "minecraft:clay_ball": "misc",
  "minecraft:stick": "misc", "minecraft:string": "misc", "minecraft:gunpowder": "misc", "minecraft:flint": "misc", "minecraft:ender_pearl": "misc",
};
export function categoryOfItem(typeId) {
  try {
    if (typeof typeId !== "string" || !typeId) return null;
    const hit = WAREHOUSE_ITEM_CATEGORIES[typeId];
    return typeof hit === "string" && isWarehouseCategory(hit) ? hit : null;
  } catch { return null; }
}
