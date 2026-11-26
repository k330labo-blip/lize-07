// sourcing.js — リゼ (LIZE-07) 素材ソース知識ベース
// 「この素材が欲しい」と言われたら、どこで・何から・どれだけ取れるかを引く辞書。
// 純粋JS（@minecraft/server 非依存）。統合側は findSources / planFor を使う。
//
// エントリ形式:
//   "minecraft:xxx": {
//     item,            // = キーと同じアイテムID
//     name,            // 日本語名
//     aliases: [...],  // 日本語/英語の別名（findSources で引ける）
//     priority,        // 基幹度 1(最基幹: 木・石・鉄) 〜 5(特殊・ボス級)
//     sources: [       // 配列順 = 推奨順
//       {
//         kind: 'block' | 'entity' | 'craft' | 'fill',
//           block : id は壊すブロック
//           entity: id は倒す/相手にするエンティティ
//           craft : id は主原料アイテム（変換・加工・精錬で得る）
//         id,
//         yield: [min, max],   // 1回の採取/討伐/変換で得られる dropItem の数
//         dropItem,            // 実際に落ちる/得られるアイテムID
//         process: 'smelt' | 'craft' | null,  // dropItem から item への追加工程
//         where: { dim: 'overworld'|'nether'|'end', biome?, yRange?: [min,max], note }
//       }
//     ]
//   }
// 注意: ハサミ・釣り・シルクタッチ等、Bedrock Script API からリゼが実行できない
// 採取法は note に明記し、代替（討伐など実行可能な方式）を推奨順の上に置く。

import { GVC_VALUABLES } from "./brain/compat_gvc.js";
import { OF_VALUABLES } from "./brain/compat_orbital.js";

export const SOURCING = {
  // ================= 鉱石・金属 =================
  "minecraft:iron_ingot": { item: "minecraft:iron_ingot", name: "鉄インゴット", aliases: ["鉄", "iron", "iron_ingot"], priority: 1, sources: [
    { kind: "block", id: "minecraft:iron_ore", yield: [1, 1], dropItem: "minecraft:raw_iron", process: "smelt", where: { dim: "overworld", yRange: [-64, 72], note: "Y15付近とY232付近に山。洞窟露出も多い" } },
    { kind: "block", id: "minecraft:deepslate_iron_ore", yield: [1, 1], dropItem: "minecraft:raw_iron", process: "smelt", where: { dim: "overworld", yRange: [-64, -1], note: "深層岩層の鉄。Y-20前後" } },
    { kind: "entity", id: "minecraft:iron_golem", yield: [3, 5], dropItem: "minecraft:iron_ingot", process: null, where: { dim: "overworld", biome: "village/plains", note: "村のゴーレム。村人の評判が下がるので注意" } },
  ] },
  "minecraft:raw_iron": { item: "minecraft:raw_iron", name: "鉄の原石", aliases: ["鉄原石", "raw_iron"], priority: 2, sources: [
    { kind: "block", id: "minecraft:iron_ore", yield: [1, 1], dropItem: "minecraft:raw_iron", process: null, where: { dim: "overworld", yRange: [-64, 72], note: "精錬前の形で欲しい場合" } },
    { kind: "block", id: "minecraft:deepslate_iron_ore", yield: [1, 1], dropItem: "minecraft:raw_iron", process: null, where: { dim: "overworld", yRange: [-64, -1], note: "" } },
  ] },
  "minecraft:gold_ingot": { item: "minecraft:gold_ingot", name: "金インゴット", aliases: ["金", "gold", "gold_ingot"], priority: 2, sources: [
    { kind: "block", id: "minecraft:gold_ore", yield: [1, 1], dropItem: "minecraft:raw_gold", process: "smelt", where: { dim: "overworld", yRange: [-64, 32], note: "Y-16付近が中心。荒野では全層多め" } },
    { kind: "block", id: "minecraft:deepslate_gold_ore", yield: [1, 1], dropItem: "minecraft:raw_gold", process: "smelt", where: { dim: "overworld", yRange: [-64, -1], note: "" } },
    { kind: "block", id: "minecraft:nether_gold_ore", yield: [2, 6], dropItem: "minecraft:gold_nugget", process: "craft", where: { dim: "nether", note: "金塊2-6個。9個でインゴット1個に合成" } },
  ] },
  "minecraft:raw_gold": { item: "minecraft:raw_gold", name: "金の原石", aliases: ["金原石", "raw_gold"], priority: 3, sources: [
    { kind: "block", id: "minecraft:gold_ore", yield: [1, 1], dropItem: "minecraft:raw_gold", process: null, where: { dim: "overworld", yRange: [-64, 32], note: "" } },
    { kind: "block", id: "minecraft:deepslate_gold_ore", yield: [1, 1], dropItem: "minecraft:raw_gold", process: null, where: { dim: "overworld", yRange: [-64, -1], note: "" } },
  ] },
  "minecraft:gold_nugget": { item: "minecraft:gold_nugget", name: "金塊", aliases: ["gold_nugget"], priority: 3, sources: [
    { kind: "block", id: "minecraft:nether_gold_ore", yield: [2, 6], dropItem: "minecraft:gold_nugget", process: null, where: { dim: "nether", note: "ネザーの全層" } },
    { kind: "entity", id: "minecraft:zombie_pigman", yield: [0, 1], dropItem: "minecraft:gold_nugget", process: null, where: { dim: "nether", note: "ゾンビピグリン。怒らせると集団で襲ってくる" } },
  ] },
  "minecraft:copper_ingot": { item: "minecraft:copper_ingot", name: "銅インゴット", aliases: ["銅", "copper", "copper_ingot"], priority: 2, sources: [
    { kind: "block", id: "minecraft:copper_ore", yield: [2, 5], dropItem: "minecraft:raw_copper", process: "smelt", where: { dim: "overworld", yRange: [-16, 112], note: "Y48付近が中心。ドリップストーン洞窟では大規模鉱脈" } },
    { kind: "block", id: "minecraft:deepslate_copper_ore", yield: [2, 5], dropItem: "minecraft:raw_copper", process: "smelt", where: { dim: "overworld", yRange: [-64, -1], note: "" } },
    { kind: "entity", id: "minecraft:drowned", yield: [0, 1], dropItem: "minecraft:copper_ingot", process: null, where: { dim: "overworld", biome: "ocean/river", note: "ドラウンドの低確率ドロップ" } },
  ] },
  "minecraft:raw_copper": { item: "minecraft:raw_copper", name: "銅の原石", aliases: ["銅原石", "raw_copper"], priority: 3, sources: [
    { kind: "block", id: "minecraft:copper_ore", yield: [2, 5], dropItem: "minecraft:raw_copper", process: null, where: { dim: "overworld", yRange: [-16, 112], note: "1鉱石から複数出る" } },
  ] },
  "minecraft:diamond": { item: "minecraft:diamond", name: "ダイヤモンド", aliases: ["ダイヤ", "diamond"], priority: 1, sources: [
    { kind: "block", id: "minecraft:deepslate_diamond_ore", yield: [1, 1], dropItem: "minecraft:diamond", process: null, where: { dim: "overworld", yRange: [-64, -50], note: "深いほど多い。Y-59前後が本命。空気に触れていない鉱石が多いのでブランチマイニング向き" } },
    { kind: "block", id: "minecraft:diamond_ore", yield: [1, 1], dropItem: "minecraft:diamond", process: null, where: { dim: "overworld", yRange: [-64, 16], note: "浅い層では稀" } },
  ] },
  "minecraft:emerald": { item: "minecraft:emerald", name: "エメラルド", aliases: ["emerald"], priority: 3, sources: [
    { kind: "block", id: "minecraft:emerald_ore", yield: [1, 1], dropItem: "minecraft:emerald", process: null, where: { dim: "overworld", biome: "mountain/meadow", yRange: [-16, 320], note: "山岳系のみ。1個ずつ単独で生成。高い場所ほど多い" } },
    { kind: "block", id: "minecraft:deepslate_emerald_ore", yield: [1, 1], dropItem: "minecraft:emerald", process: null, where: { dim: "overworld", biome: "mountain", yRange: [-16, -1], note: "山岳の深層岩層" } },
  ] },
  "minecraft:coal": { item: "minecraft:coal", name: "石炭", aliases: ["coal"], priority: 1, sources: [
    { kind: "block", id: "minecraft:coal_ore", yield: [1, 1], dropItem: "minecraft:coal", process: null, where: { dim: "overworld", yRange: [0, 320], note: "Y96とY136付近に山。洞窟の壁で大量に露出" } },
    { kind: "block", id: "minecraft:deepslate_coal_ore", yield: [1, 1], dropItem: "minecraft:coal", process: null, where: { dim: "overworld", yRange: [-64, 0], note: "深層では少なめ" } },
    { kind: "entity", id: "minecraft:wither_skeleton", yield: [0, 1], dropItem: "minecraft:coal", process: null, where: { dim: "nether", biome: "nether_fortress", note: "ウィザースケルトンのついで" } },
  ] },
  "minecraft:redstone": { item: "minecraft:redstone", name: "レッドストーン", aliases: ["redstone", "赤石"], priority: 2, sources: [
    { kind: "block", id: "minecraft:deepslate_redstone_ore", yield: [4, 5], dropItem: "minecraft:redstone", process: null, where: { dim: "overworld", yRange: [-64, -16], note: "深いほど多い" } },
    { kind: "block", id: "minecraft:redstone_ore", yield: [4, 5], dropItem: "minecraft:redstone", process: null, where: { dim: "overworld", yRange: [-64, 16], note: "" } },
  ] },
  "minecraft:lapis_lazuli": { item: "minecraft:lapis_lazuli", name: "ラピスラズリ", aliases: ["ラピス", "lapis"], priority: 3, sources: [
    { kind: "block", id: "minecraft:lapis_ore", yield: [4, 9], dropItem: "minecraft:lapis_lazuli", process: null, where: { dim: "overworld", yRange: [-64, 64], note: "Y0付近が中心" } },
    { kind: "block", id: "minecraft:deepslate_lapis_ore", yield: [4, 9], dropItem: "minecraft:lapis_lazuli", process: null, where: { dim: "overworld", yRange: [-64, 0], note: "" } },
  ] },
  "minecraft:quartz": { item: "minecraft:quartz", name: "ネザークォーツ", aliases: ["クォーツ", "quartz"], priority: 3, sources: [
    { kind: "block", id: "minecraft:quartz_ore", yield: [1, 1], dropItem: "minecraft:quartz", process: null, where: { dim: "nether", yRange: [10, 117], note: "ネザーの全域。経験値も美味しい" } },
  ] },
  "minecraft:netherite_scrap": { item: "minecraft:netherite_scrap", name: "ネザライトの欠片", aliases: ["netherite_scrap"], priority: 5, sources: [
    { kind: "block", id: "minecraft:ancient_debris", yield: [1, 1], dropItem: "minecraft:ancient_debris", process: "smelt", where: { dim: "nether", yRange: [8, 22], note: "古代の残骸。Y15前後が本命。爆発耐性があり溶岩に落ちても消えない" } },
  ] },
  "minecraft:netherite_ingot": { item: "minecraft:netherite_ingot", name: "ネザライトインゴット", aliases: ["ネザライト", "netherite"], priority: 5, sources: [
    { kind: "craft", id: "minecraft:netherite_scrap", yield: [1, 1], dropItem: "minecraft:netherite_ingot", process: "craft", where: { dim: "overworld", note: "欠片4個＋金インゴット4個を合成。まず欠片集めが本体" } },
  ] },
  "minecraft:amethyst_shard": { item: "minecraft:amethyst_shard", name: "アメジストの欠片", aliases: ["アメジスト", "amethyst"], priority: 4, sources: [
    { kind: "block", id: "minecraft:amethyst_cluster", yield: [4, 4], dropItem: "minecraft:amethyst_shard", process: null, where: { dim: "overworld", yRange: [-64, 30], note: "ジオード内の成長しきった塊のみ。芽生えるアメジストは壊すと消えるので掘らない" } },
  ] },
  "minecraft:glowstone_dust": { item: "minecraft:glowstone_dust", name: "グロウストーンダスト", aliases: ["グロウストーン", "glowstone"], priority: 3, sources: [
    { kind: "block", id: "minecraft:glowstone", yield: [2, 4], dropItem: "minecraft:glowstone_dust", process: null, where: { dim: "nether", note: "天井から垂れ下がる塊。足場に注意" } },
    { kind: "entity", id: "minecraft:witch", yield: [0, 2], dropItem: "minecraft:glowstone_dust", process: null, where: { dim: "overworld", note: "ウィッチのドロップ（副産物）" } },
  ] },
  // ================= 石・土・砂 =================
  "minecraft:cobblestone": { item: "minecraft:cobblestone", name: "丸石", aliases: ["丸石", "cobblestone"], priority: 1, sources: [
    { kind: "block", id: "minecraft:stone", yield: [1, 1], dropItem: "minecraft:cobblestone", process: null, where: { dim: "overworld", note: "石を掘ると丸石になる（シルクタッチで石そのまま）" } },
  ] },
  "minecraft:stone": { item: "minecraft:stone", name: "石", aliases: ["stone"], priority: 2, sources: [
    { kind: "craft", id: "minecraft:cobblestone", yield: [1, 1], dropItem: "minecraft:stone", process: "smelt", where: { dim: "overworld", note: "丸石を精錬。シルクタッチ採取はAPI制約で不可のため精錬ルートが確実" } },
  ] },
  "minecraft:cobbled_deepslate": { item: "minecraft:cobbled_deepslate", name: "深層岩の丸石", aliases: ["深層岩", "deepslate"], priority: 2, sources: [
    { kind: "block", id: "minecraft:deepslate", yield: [1, 1], dropItem: "minecraft:cobbled_deepslate", process: null, where: { dim: "overworld", yRange: [-64, 0], note: "Y0以下の地層そのもの" } },
  ] },
  "minecraft:granite": { item: "minecraft:granite", name: "花崗岩", aliases: ["granite"], priority: 3, sources: [
    { kind: "block", id: "minecraft:granite", yield: [1, 1], dropItem: "minecraft:granite", process: null, where: { dim: "overworld", yRange: [-64, 64], note: "地下の塊状地層" } },
  ] },
  "minecraft:diorite": { item: "minecraft:diorite", name: "閃緑岩", aliases: ["diorite"], priority: 3, sources: [
    { kind: "block", id: "minecraft:diorite", yield: [1, 1], dropItem: "minecraft:diorite", process: null, where: { dim: "overworld", yRange: [-64, 64], note: "地下の塊状地層" } },
  ] },
  "minecraft:andesite": { item: "minecraft:andesite", name: "安山岩", aliases: ["andesite"], priority: 3, sources: [
    { kind: "block", id: "minecraft:andesite", yield: [1, 1], dropItem: "minecraft:andesite", process: null, where: { dim: "overworld", yRange: [-64, 64], note: "地下の塊状地層" } },
  ] },
  "minecraft:dirt": { item: "minecraft:dirt", name: "土", aliases: ["土", "dirt"], priority: 1, sources: [
    { kind: "block", id: "minecraft:dirt", yield: [1, 1], dropItem: "minecraft:dirt", process: null, where: { dim: "overworld", note: "地表のどこにでもある" } },
  ] },
  "minecraft:sand": { item: "minecraft:sand", name: "砂", aliases: ["砂", "sand"], priority: 1, sources: [
    { kind: "block", id: "minecraft:sand", yield: [1, 1], dropItem: "minecraft:sand", process: null, where: { dim: "overworld", biome: "desert/beach", note: "落下するブロック。下から掘ると崩れるので注意" } },
  ] },
  "minecraft:red_sand": { item: "minecraft:red_sand", name: "赤い砂", aliases: ["red_sand"], priority: 4, sources: [
    { kind: "block", id: "minecraft:red_sand", yield: [1, 1], dropItem: "minecraft:red_sand", process: null, where: { dim: "overworld", biome: "badlands", note: "荒野の地表" } },
  ] },
  "minecraft:glass": { item: "minecraft:glass", name: "ガラス", aliases: ["ガラス", "glass"], priority: 2, sources: [
    { kind: "craft", id: "minecraft:sand", yield: [1, 1], dropItem: "minecraft:glass", process: "smelt", where: { dim: "overworld", note: "砂をかまどで精錬。現行のリゼは精錬工程が未対応のため、採取は「砂の回収まで」を保証し精錬は別段階として分ける" } },
  ] },
  "minecraft:sandstone": { item: "minecraft:sandstone", name: "砂岩", aliases: ["砂岩", "sandstone"], priority: 3, sources: [
    { kind: "block", id: "minecraft:sandstone", yield: [1, 1], dropItem: "minecraft:sandstone", process: null, where: { dim: "overworld", biome: "desert", note: "砂漠の砂の下の層" } },
    { kind: "craft", id: "minecraft:sand", yield: [1, 1], dropItem: "minecraft:sandstone", process: "craft", where: { dim: "overworld", note: "砂4個から合成" } },
  ] },
  "minecraft:gravel": { item: "minecraft:gravel", name: "砂利", aliases: ["砂利", "gravel"], priority: 2, sources: [
    { kind: "block", id: "minecraft:gravel", yield: [1, 1], dropItem: "minecraft:gravel", process: null, where: { dim: "overworld", note: "地下・川底・海底。落下ブロック" } },
  ] },
  "minecraft:flint": { item: "minecraft:flint", name: "火打石", aliases: ["flint"], priority: 3, sources: [
    { kind: "block", id: "minecraft:gravel", yield: [0, 1], dropItem: "minecraft:flint", process: null, where: { dim: "overworld", note: "砂利を掘ると約10%で砂利の代わりに出る。出るまで掘り続ける素材" } },
  ] },
  "minecraft:clay_ball": { item: "minecraft:clay_ball", name: "粘土玉", aliases: ["粘土", "clay"], priority: 3, sources: [
    { kind: "block", id: "minecraft:clay", yield: [4, 4], dropItem: "minecraft:clay_ball", process: null, where: { dim: "overworld", biome: "river/lush_caves", note: "川底・湖底。緑豊かな洞窟にも多い" } },
  ] },
  "minecraft:brick": { item: "minecraft:brick", name: "レンガ", aliases: ["brick"], priority: 3, sources: [
    { kind: "craft", id: "minecraft:clay_ball", yield: [1, 1], dropItem: "minecraft:brick", process: "smelt", where: { dim: "overworld", note: "粘土玉を精錬" } },
  ] },
  "minecraft:terracotta": { item: "minecraft:terracotta", name: "テラコッタ", aliases: ["terracotta"], priority: 4, sources: [
    { kind: "block", id: "minecraft:terracotta", yield: [1, 1], dropItem: "minecraft:terracotta", process: null, where: { dim: "overworld", biome: "badlands", note: "荒野の色付き地層" } },
  ] },
  "minecraft:obsidian": { item: "minecraft:obsidian", name: "黒曜石", aliases: ["黒曜石", "obsidian"], priority: 3, sources: [
    { kind: "block", id: "minecraft:obsidian", yield: [1, 1], dropItem: "minecraft:obsidian", process: null, where: { dim: "overworld", note: "溶岩源に水が触れた場所。ダイヤ以上のツルハシ相当が必要で採掘に時間がかかる" } },
  ] },
  "minecraft:netherrack": { item: "minecraft:netherrack", name: "ネザーラック", aliases: ["netherrack"], priority: 2, sources: [
    { kind: "block", id: "minecraft:netherrack", yield: [1, 1], dropItem: "minecraft:netherrack", process: null, where: { dim: "nether", note: "ネザーの地層そのもの。柔らかく速く掘れる" } },
  ] },
  "minecraft:soul_sand": { item: "minecraft:soul_sand", name: "ソウルサンド", aliases: ["soul_sand"], priority: 3, sources: [
    { kind: "block", id: "minecraft:soul_sand", yield: [1, 1], dropItem: "minecraft:soul_sand", process: null, where: { dim: "nether", biome: "soul_sand_valley", yRange: [0, 128], note: "足が遅くなる。ネザー要塞周辺にもある" } },
  ] },
  "minecraft:soul_soil": { item: "minecraft:soul_soil", name: "ソウルソイル", aliases: ["soul_soil"], priority: 3, sources: [
    { kind: "block", id: "minecraft:soul_soil", yield: [1, 1], dropItem: "minecraft:soul_soil", process: null, where: { dim: "nether", biome: "soul_sand_valley", note: "" } },
  ] },
  "minecraft:basalt": { item: "minecraft:basalt", name: "玄武岩", aliases: ["basalt"], priority: 3, sources: [
    { kind: "block", id: "minecraft:basalt", yield: [1, 1], dropItem: "minecraft:basalt", process: null, where: { dim: "nether", biome: "basalt_deltas", note: "玄武岩デルタの柱群" } },
  ] },
  "minecraft:blackstone": { item: "minecraft:blackstone", name: "ブラックストーン", aliases: ["blackstone"], priority: 3, sources: [
    { kind: "block", id: "minecraft:blackstone", yield: [1, 1], dropItem: "minecraft:blackstone", process: null, where: { dim: "nether", yRange: [5, 28], note: "ネザー地下の地層。玄武岩デルタにも" } },
  ] },
  "minecraft:magma_block": { item: "minecraft:magma_block", name: "マグマブロック", aliases: ["magma_block"], priority: 4, sources: [
    { kind: "block", id: "minecraft:magma_block", yield: [1, 1], dropItem: "minecraft:magma_block", process: null, where: { dim: "nether", note: "上に乗るとダメージ（しゃがむと無効）。海底の熱水噴出孔にも" } },
  ] },
  "minecraft:end_stone": { item: "minecraft:end_stone", name: "エンドストーン", aliases: ["end_stone"], priority: 4, sources: [
    { kind: "block", id: "minecraft:end_stone", yield: [1, 1], dropItem: "minecraft:end_stone", process: null, where: { dim: "end", note: "エンドの島の地層そのもの" } },
  ] },
  "minecraft:ice": { item: "minecraft:ice", name: "氷", aliases: ["氷", "ice"], priority: 4, sources: [
    { kind: "block", id: "minecraft:ice", yield: [0, 0], dropItem: "minecraft:ice", process: null, where: { dim: "overworld", biome: "frozen_ocean/snowy", note: "シルクタッチなしでは壊すと水になる（収量0）。現行のリゼはシルクタッチ採取不可のため実質採取不可と扱う" } },
  ] },
  "minecraft:snowball": { item: "minecraft:snowball", name: "雪玉", aliases: ["雪玉", "snowball"], priority: 3, sources: [
    { kind: "block", id: "minecraft:snow", yield: [4, 4], dropItem: "minecraft:snowball", process: null, where: { dim: "overworld", biome: "snowy", note: "雪ブロック1個から4個" } },
  ] },
  "minecraft:pointed_dripstone": { item: "minecraft:pointed_dripstone", name: "鍾乳石", aliases: ["dripstone"], priority: 4, sources: [
    { kind: "block", id: "minecraft:dripstone_block", yield: [4, 4], dropItem: "minecraft:pointed_dripstone", process: null, where: { dim: "overworld", biome: "dripstone_caves", note: "鍾乳石ブロックを壊すと4個。生えている鍾乳石は根元を壊すと落下して砕ける" } },
  ] },
  // ================= 木材 =================
  "minecraft:oak_log": { item: "minecraft:oak_log", name: "オークの原木", aliases: ["オーク", "原木", "木材", "oak", "log", "wood"], priority: 1, sources: [
    { kind: "block", id: "minecraft:oak_log", yield: [1, 1], dropItem: "minecraft:oak_log", process: null, where: { dim: "overworld", biome: "plains/forest", note: "幹を下から切る。葉は自然に枯れて苗木・リンゴが落ちる" } },
  ] },
  "minecraft:spruce_log": { item: "minecraft:spruce_log", name: "トウヒの原木", aliases: ["トウヒ", "spruce"], priority: 2, sources: [
    { kind: "block", id: "minecraft:spruce_log", yield: [1, 1], dropItem: "minecraft:spruce_log", process: null, where: { dim: "overworld", biome: "taiga/snowy", note: "巨木は幹が高い" } },
  ] },
  "minecraft:birch_log": { item: "minecraft:birch_log", name: "シラカバの原木", aliases: ["シラカバ", "白樺", "birch"], priority: 2, sources: [
    { kind: "block", id: "minecraft:birch_log", yield: [1, 1], dropItem: "minecraft:birch_log", process: null, where: { dim: "overworld", biome: "birch_forest", note: "" } },
  ] },
  "minecraft:jungle_log": { item: "minecraft:jungle_log", name: "ジャングルの原木", aliases: ["ジャングル木", "jungle_log"], priority: 3, sources: [
    { kind: "block", id: "minecraft:jungle_log", yield: [1, 1], dropItem: "minecraft:jungle_log", process: null, where: { dim: "overworld", biome: "jungle", note: "巨木は2x2幹。カカオが実る木でもある" } },
  ] },
  "minecraft:acacia_log": { item: "minecraft:acacia_log", name: "アカシアの原木", aliases: ["アカシア", "acacia"], priority: 3, sources: [
    { kind: "block", id: "minecraft:acacia_log", yield: [1, 1], dropItem: "minecraft:acacia_log", process: null, where: { dim: "overworld", biome: "savanna", note: "幹が斜めに枝分かれする" } },
  ] },
  "minecraft:dark_oak_log": { item: "minecraft:dark_oak_log", name: "ダークオークの原木", aliases: ["ダークオーク", "dark_oak"], priority: 3, sources: [
    { kind: "block", id: "minecraft:dark_oak_log", yield: [1, 1], dropItem: "minecraft:dark_oak_log", process: null, where: { dim: "overworld", biome: "dark_forest", note: "常に2x2の太幹。葉からリンゴも出る" } },
  ] },
  "minecraft:mangrove_log": { item: "minecraft:mangrove_log", name: "マングローブの原木", aliases: ["マングローブ", "mangrove"], priority: 3, sources: [
    { kind: "block", id: "minecraft:mangrove_log", yield: [1, 1], dropItem: "minecraft:mangrove_log", process: null, where: { dim: "overworld", biome: "mangrove_swamp", note: "根が水中に張る。足場が悪い" } },
  ] },
  "minecraft:cherry_log": { item: "minecraft:cherry_log", name: "サクラの原木", aliases: ["サクラ", "桜", "cherry"], priority: 3, sources: [
    { kind: "block", id: "minecraft:cherry_log", yield: [1, 1], dropItem: "minecraft:cherry_log", process: null, where: { dim: "overworld", biome: "cherry_grove", note: "山あいのサクラ林" } },
  ] },
  "minecraft:pale_oak_log": { item: "minecraft:pale_oak_log", name: "ペールオークの原木", aliases: ["ペールオーク", "pale_oak"], priority: 4, sources: [
    { kind: "block", id: "minecraft:pale_oak_log", yield: [1, 1], dropItem: "minecraft:pale_oak_log", process: null, where: { dim: "overworld", biome: "pale_garden", note: "クリーキングに注意（見られている間は動かない）" } },
  ] },
  "minecraft:crimson_stem": { item: "minecraft:crimson_stem", name: "真紅の幹", aliases: ["真紅の幹", "crimson_stem"], priority: 3, sources: [
    { kind: "block", id: "minecraft:crimson_stem", yield: [1, 1], dropItem: "minecraft:crimson_stem", process: null, where: { dim: "nether", biome: "crimson_forest", note: "巨大キノコの幹。燃えない木材" } },
  ] },
  "minecraft:warped_stem": { item: "minecraft:warped_stem", name: "歪んだ幹", aliases: ["歪んだ幹", "warped_stem"], priority: 3, sources: [
    { kind: "block", id: "minecraft:warped_stem", yield: [1, 1], dropItem: "minecraft:warped_stem", process: null, where: { dim: "nether", biome: "warped_forest", note: "エンダーマンが多いが敵対しにくいバイオーム" } },
  ] },
  "minecraft:bamboo": { item: "minecraft:bamboo", name: "竹", aliases: ["竹", "bamboo"], priority: 2, sources: [
    { kind: "block", id: "minecraft:bamboo", yield: [1, 1], dropItem: "minecraft:bamboo", process: null, where: { dim: "overworld", biome: "jungle/bamboo_jungle", note: "根元を切ると上部が全部崩れて落ちる。効率が非常に良い" } },
  ] },
  "minecraft:oak_planks": { item: "minecraft:oak_planks", name: "オークの木材（板材）", aliases: ["木材板", "板材", "planks"], priority: 1, sources: [
    { kind: "craft", id: "minecraft:oak_log", yield: [4, 4], dropItem: "minecraft:oak_planks", process: "craft", where: { dim: "overworld", note: "原木1個から4枚。手作業変換（作業台不要）" } },
  ] },
  "minecraft:stick": { item: "minecraft:stick", name: "棒", aliases: ["棒", "stick"], priority: 1, sources: [
    { kind: "craft", id: "minecraft:oak_planks", yield: [4, 4], dropItem: "minecraft:stick", process: "craft", where: { dim: "overworld", note: "板材2枚から4本。どの樹種の板材でも可" } },
    { kind: "block", id: "minecraft:leaves", yield: [0, 1], dropItem: "minecraft:stick", process: null, where: { dim: "overworld", note: "葉を壊すと稀に落ちる（副産物）" } },
  ] },
  "minecraft:charcoal": { item: "minecraft:charcoal", name: "木炭", aliases: ["木炭", "charcoal"], priority: 2, sources: [
    { kind: "craft", id: "minecraft:oak_log", yield: [1, 1], dropItem: "minecraft:charcoal", process: "smelt", where: { dim: "overworld", note: "原木を精錬。どの樹種でも可。石炭の代用になる" } },
  ] },
  // ================= 作物・植物・食料 =================
  "minecraft:wheat": { item: "minecraft:wheat", name: "小麦", aliases: ["小麦", "wheat"], priority: 2, sources: [
    { kind: "block", id: "minecraft:wheat", yield: [1, 1], dropItem: "minecraft:wheat", process: null, where: { dim: "overworld", biome: "farm", note: "成熟（金色）してから収穫。種も一緒に落ちるので植え直し可能" } },
  ] },
  "minecraft:carrot": { item: "minecraft:carrot", name: "ニンジン", aliases: ["ニンジン", "人参", "carrot"], priority: 2, sources: [
    { kind: "block", id: "minecraft:carrots", yield: [1, 4], dropItem: "minecraft:carrot", process: null, where: { dim: "overworld", biome: "farm", note: "成熟すると複数取れる" } },
    { kind: "entity", id: "minecraft:zombie", yield: [0, 1], dropItem: "minecraft:carrot", process: null, where: { dim: "overworld", note: "ゾンビの稀なドロップ（副産物）" } },
  ] },
  "minecraft:potato": { item: "minecraft:potato", name: "ジャガイモ", aliases: ["ジャガイモ", "芋", "potato"], priority: 2, sources: [
    { kind: "block", id: "minecraft:potatoes", yield: [2, 5], dropItem: "minecraft:potato", process: null, where: { dim: "overworld", biome: "farm", note: "成熟で2-5個。稀に毒芋が混ざる" } },
  ] },
  "minecraft:beetroot": { item: "minecraft:beetroot", name: "ビートルート", aliases: ["ビートルート", "beetroot"], priority: 3, sources: [
    { kind: "block", id: "minecraft:beetroot", yield: [1, 1], dropItem: "minecraft:beetroot", process: null, where: { dim: "overworld", biome: "farm", note: "種も一緒に落ちる" } },
  ] },
  "minecraft:sugar_cane": { item: "minecraft:sugar_cane", name: "サトウキビ", aliases: ["サトウキビ", "sugar_cane"], priority: 2, sources: [
    { kind: "block", id: "minecraft:sugar_cane", yield: [1, 1], dropItem: "minecraft:sugar_cane", process: null, where: { dim: "overworld", biome: "river/beach", note: "水辺に自生。下段を残すと再生する" } },
  ] },
  "minecraft:sugar": { item: "minecraft:sugar", name: "砂糖", aliases: ["砂糖", "sugar"], priority: 3, sources: [
    { kind: "craft", id: "minecraft:sugar_cane", yield: [1, 1], dropItem: "minecraft:sugar", process: "craft", where: { dim: "overworld", note: "サトウキビ1本から変換" } },
  ] },
  "minecraft:paper": { item: "minecraft:paper", name: "紙", aliases: ["紙", "paper"], priority: 3, sources: [
    { kind: "craft", id: "minecraft:sugar_cane", yield: [3, 3], dropItem: "minecraft:paper", process: "craft", where: { dim: "overworld", note: "サトウキビ3本から紙3枚（作業台）" } },
  ] },
  "minecraft:pumpkin": { item: "minecraft:pumpkin", name: "カボチャ", aliases: ["カボチャ", "南瓜", "pumpkin"], priority: 3, sources: [
    { kind: "block", id: "minecraft:pumpkin", yield: [1, 1], dropItem: "minecraft:pumpkin", process: null, where: { dim: "overworld", biome: "plains/farm", note: "自生もある。栽培は茎から実る" } },
  ] },
  "minecraft:melon_slice": { item: "minecraft:melon_slice", name: "スイカ", aliases: ["スイカ", "melon"], priority: 3, sources: [
    { kind: "block", id: "minecraft:melon_block", yield: [3, 7], dropItem: "minecraft:melon_slice", process: null, where: { dim: "overworld", biome: "jungle/farm", note: "ブロック1個から3-7切れ" } },
  ] },
  "minecraft:apple": { item: "minecraft:apple", name: "リンゴ", aliases: ["リンゴ", "林檎", "apple"], priority: 3, sources: [
    { kind: "block", id: "minecraft:oak_leaves", yield: [0, 1], dropItem: "minecraft:apple", process: null, where: { dim: "overworld", note: "オーク/ダークオークの葉が枯れる際に約0.5%。木を切り倒して葉が消えるのを待つのが正攻法" } },
  ] },
  "minecraft:sweet_berries": { item: "minecraft:sweet_berries", name: "スイートベリー", aliases: ["ベリー", "sweet_berries"], priority: 3, sources: [
    { kind: "block", id: "minecraft:sweet_berry_bush", yield: [1, 3], dropItem: "minecraft:sweet_berries", process: null, where: { dim: "overworld", biome: "taiga", note: "成熟した茂みから。茂みに入るとチクチク痛い" } },
  ] },
  "minecraft:glow_berries": { item: "minecraft:glow_berries", name: "グロウベリー", aliases: ["グロウベリー", "glow_berries"], priority: 4, sources: [
    { kind: "block", id: "minecraft:cave_vines", yield: [1, 1], dropItem: "minecraft:glow_berries", process: null, where: { dim: "overworld", biome: "lush_caves", note: "緑豊かな洞窟の天井ツタ。光源にもなる" } },
  ] },
  "minecraft:cocoa_beans": { item: "minecraft:cocoa_beans", name: "カカオ豆", aliases: ["カカオ", "cocoa"], priority: 4, sources: [
    { kind: "block", id: "minecraft:cocoa", yield: [2, 3], dropItem: "minecraft:cocoa_beans", process: null, where: { dim: "overworld", biome: "jungle", note: "ジャングル原木の側面に実る。成熟（橙色）で2-3個" } },
  ] },
  "minecraft:kelp": { item: "minecraft:kelp", name: "昆布", aliases: ["昆布", "kelp"], priority: 3, sources: [
    { kind: "block", id: "minecraft:kelp", yield: [1, 1], dropItem: "minecraft:kelp", process: null, where: { dim: "overworld", biome: "ocean", note: "海中。上部を切るとまとめて落ちる" } },
  ] },
  "minecraft:nether_wart": { item: "minecraft:nether_wart", name: "ネザーウォート", aliases: ["ネザーウォート", "nether_wart"], priority: 4, sources: [
    { kind: "block", id: "minecraft:nether_wart", yield: [2, 4], dropItem: "minecraft:nether_wart", process: null, where: { dim: "nether", biome: "nether_fortress", note: "要塞内のソウルサンド畑。成熟で2-4個" } },
  ] },
  "minecraft:chorus_fruit": { item: "minecraft:chorus_fruit", name: "コーラスフルーツ", aliases: ["コーラス", "chorus_fruit"], priority: 4, sources: [
    { kind: "block", id: "minecraft:chorus_plant", yield: [0, 1], dropItem: "minecraft:chorus_fruit", process: null, where: { dim: "end", note: "コーラスの木を壊すと連鎖で崩れる。食べるとテレポートするので回収は食べずに" } },
  ] },
  "minecraft:brown_mushroom": { item: "minecraft:brown_mushroom", name: "茶色キノコ", aliases: ["キノコ", "mushroom"], priority: 3, sources: [
    { kind: "block", id: "minecraft:brown_mushroom", yield: [1, 1], dropItem: "minecraft:brown_mushroom", process: null, where: { dim: "overworld", biome: "swamp/dark_forest", note: "暗い場所・沼地・ネザーにも自生" } },
  ] },
  "minecraft:cactus": { item: "minecraft:cactus", name: "サボテン", aliases: ["サボテン", "cactus"], priority: 3, sources: [
    { kind: "block", id: "minecraft:cactus", yield: [1, 1], dropItem: "minecraft:cactus", process: null, where: { dim: "overworld", biome: "desert/badlands", note: "下段を切ると上が崩れる。触ると痛い" } },
  ] },
  "minecraft:vine": { item: "minecraft:vine", name: "ツタ", aliases: ["ツタ", "vine"], priority: 4, sources: [
    { kind: "block", id: "minecraft:vine", yield: [1, 1], dropItem: "minecraft:vine", process: null, where: { dim: "overworld", biome: "jungle/swamp", note: "本来はハサミ必須。ハサミはAPI制約でリゼが使えないため、現行は採取不可（素手では消滅する）" } },
  ] },
  "minecraft:honeycomb": { item: "minecraft:honeycomb", name: "ハニカム", aliases: ["ハニカム", "honeycomb"], priority: 4, sources: [
    { kind: "block", id: "minecraft:bee_nest", yield: [3, 3], dropItem: "minecraft:honeycomb", process: null, where: { dim: "overworld", biome: "plains/flower_forest", note: "満タンの巣が対象。下に焚き火がないと蜂が怒る＋ハサミ相当が必要で、現行のリゼでは採取不可に近い" } },
  ] },
  // ================= 動物・食料素材 =================
  "minecraft:white_wool": { item: "minecraft:white_wool", name: "羊毛（白）", aliases: ["羊毛", "毛", "ウール", "wool"], priority: 2, sources: [
    { kind: "entity", id: "minecraft:sheep", yield: [1, 3], dropItem: "minecraft:white_wool", process: null, where: { dim: "overworld", biome: "plains", note: "ハサミでの刈り取りはAPI制約で不可のため討伐方式。倒すと羊毛＋羊肉。色付き羊からはその色の羊毛" } },
    { kind: "entity", id: "minecraft:spider", yield: [0, 2], dropItem: "minecraft:string", process: "craft", where: { dim: "overworld", note: "代替ルート: 糸4個から羊毛1個を合成（本命は羊）" } },
  ] },
  "minecraft:mutton": { item: "minecraft:mutton", name: "羊肉（生）", aliases: ["羊肉", "mutton"], priority: 3, sources: [
    { kind: "entity", id: "minecraft:sheep", yield: [1, 2], dropItem: "minecraft:mutton", process: null, where: { dim: "overworld", biome: "plains", note: "羊毛と同時に取れる" } },
  ] },
  "minecraft:leather": { item: "minecraft:leather", name: "革", aliases: ["革", "leather"], priority: 2, sources: [
    { kind: "entity", id: "minecraft:cow", yield: [0, 2], dropItem: "minecraft:leather", process: null, where: { dim: "overworld", biome: "plains", note: "牛肉も同時" } },
    { kind: "entity", id: "minecraft:horse", yield: [0, 2], dropItem: "minecraft:leather", process: null, where: { dim: "overworld", biome: "plains/savanna", note: "馬からも" } },
    { kind: "entity", id: "minecraft:mooshroom", yield: [0, 2], dropItem: "minecraft:leather", process: null, where: { dim: "overworld", biome: "mushroom_fields", note: "ムーシュルームからも" } },
  ] },
  "minecraft:beef": { item: "minecraft:beef", name: "牛肉（生）", aliases: ["牛肉", "beef"], priority: 2, sources: [
    { kind: "entity", id: "minecraft:cow", yield: [1, 3], dropItem: "minecraft:beef", process: null, where: { dim: "overworld", biome: "plains", note: "革も同時" } },
  ] },
  "minecraft:porkchop": { item: "minecraft:porkchop", name: "豚肉（生）", aliases: ["豚肉", "porkchop"], priority: 2, sources: [
    { kind: "entity", id: "minecraft:pig", yield: [1, 3], dropItem: "minecraft:porkchop", process: null, where: { dim: "overworld", biome: "plains/forest", note: "" } },
  ] },
  "minecraft:chicken": { item: "minecraft:chicken", name: "鶏肉（生）", aliases: ["鶏肉", "chicken_meat"], priority: 3, sources: [
    { kind: "entity", id: "minecraft:chicken", yield: [1, 1], dropItem: "minecraft:chicken", process: null, where: { dim: "overworld", biome: "plains/forest", note: "羽根も同時" } },
  ] },
  "minecraft:feather": { item: "minecraft:feather", name: "羽根", aliases: ["羽根", "feather"], priority: 3, sources: [
    { kind: "entity", id: "minecraft:chicken", yield: [0, 2], dropItem: "minecraft:feather", process: null, where: { dim: "overworld", biome: "plains/forest", note: "矢の材料" } },
  ] },
  "minecraft:egg": { item: "minecraft:egg", name: "卵", aliases: ["卵", "egg"], priority: 3, sources: [
    { kind: "entity", id: "minecraft:chicken", yield: [1, 1], dropItem: "minecraft:egg", process: null, where: { dim: "overworld", note: "倒すのではなく、鶏が5-10分間隔で産んだ卵を回収する。囲いがあると効率が良い" } },
  ] },
  "minecraft:rabbit_hide": { item: "minecraft:rabbit_hide", name: "ウサギの皮", aliases: ["ウサギ皮", "rabbit_hide"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:rabbit", yield: [0, 1], dropItem: "minecraft:rabbit_hide", process: null, where: { dim: "overworld", biome: "desert/snowy/flower_forest", note: "素早い。肉も同時" } },
  ] },
  "minecraft:rabbit": { item: "minecraft:rabbit", name: "ウサギ肉（生）", aliases: ["ウサギ肉", "rabbit_meat"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:rabbit", yield: [0, 1], dropItem: "minecraft:rabbit", process: null, where: { dim: "overworld", biome: "desert/snowy", note: "" } },
  ] },
  "minecraft:cod": { item: "minecraft:cod", name: "生鱈", aliases: ["タラ", "鱈", "cod"], priority: 3, sources: [
    { kind: "entity", id: "minecraft:cod", yield: [1, 1], dropItem: "minecraft:cod", process: null, where: { dim: "overworld", biome: "ocean", note: "釣りはAPI制約で不可のため水中で直接討伐。骨粉が稀に同時" } },
  ] },
  "minecraft:salmon": { item: "minecraft:salmon", name: "生鮭", aliases: ["サケ", "鮭", "salmon"], priority: 3, sources: [
    { kind: "entity", id: "minecraft:salmon", yield: [1, 1], dropItem: "minecraft:salmon", process: null, where: { dim: "overworld", biome: "ocean/river", note: "川を遡る群れが狙いやすい" } },
  ] },
  "minecraft:pufferfish": { item: "minecraft:pufferfish", name: "フグ", aliases: ["フグ", "pufferfish"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:pufferfish", yield: [1, 1], dropItem: "minecraft:pufferfish", process: null, where: { dim: "overworld", biome: "warm_ocean", note: "近づくと膨らんで毒。食べると毒＋空腹" } },
  ] },
  "minecraft:tropical_fish": { item: "minecraft:tropical_fish", name: "熱帯魚", aliases: ["熱帯魚", "tropical_fish"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:tropical_fish", yield: [1, 1], dropItem: "minecraft:tropical_fish", process: null, where: { dim: "overworld", biome: "warm_ocean", note: "" } },
  ] },
  // ================= モブドロップ =================
  "minecraft:string": { item: "minecraft:string", name: "糸", aliases: ["糸", "string"], priority: 2, sources: [
    { kind: "entity", id: "minecraft:spider", yield: [0, 2], dropItem: "minecraft:string", process: null, where: { dim: "overworld", note: "夜・洞窟。クモの目も同時に出ることがある" } },
    { kind: "block", id: "minecraft:web", yield: [1, 1], dropItem: "minecraft:string", process: null, where: { dim: "overworld", biome: "mineshaft", note: "廃坑のクモの巣を剣で切る" } },
  ] },
  "minecraft:spider_eye": { item: "minecraft:spider_eye", name: "クモの目", aliases: ["クモの目", "spider_eye"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:spider", yield: [0, 1], dropItem: "minecraft:spider_eye", process: null, where: { dim: "overworld", note: "糸のついで" } },
  ] },
  "minecraft:gunpowder": { item: "minecraft:gunpowder", name: "火薬", aliases: ["火薬", "gunpowder"], priority: 2, sources: [
    { kind: "entity", id: "minecraft:creeper", yield: [0, 2], dropItem: "minecraft:gunpowder", process: null, where: { dim: "overworld", note: "爆発される前に倒すこと。爆死するとドロップしない" } },
    { kind: "entity", id: "minecraft:ghast", yield: [0, 2], dropItem: "minecraft:gunpowder", process: null, where: { dim: "nether", note: "ガストの涙も同時" } },
    { kind: "entity", id: "minecraft:witch", yield: [0, 2], dropItem: "minecraft:gunpowder", process: null, where: { dim: "overworld", note: "ウィッチの複合ドロップの1つ" } },
  ] },
  "minecraft:bone": { item: "minecraft:bone", name: "骨", aliases: ["骨", "bone"], priority: 2, sources: [
    { kind: "entity", id: "minecraft:skeleton", yield: [0, 2], dropItem: "minecraft:bone", process: null, where: { dim: "overworld", note: "矢も同時。骨粉の原料" } },
  ] },
  "minecraft:bone_meal": { item: "minecraft:bone_meal", name: "骨粉", aliases: ["骨粉", "bone_meal"], priority: 2, sources: [
    { kind: "craft", id: "minecraft:bone", yield: [3, 3], dropItem: "minecraft:bone_meal", process: "craft", where: { dim: "overworld", note: "骨1本から3個。作物の成長促進" } },
  ] },
  "minecraft:arrow": { item: "minecraft:arrow", name: "矢", aliases: ["矢", "arrow"], priority: 3, sources: [
    { kind: "entity", id: "minecraft:skeleton", yield: [0, 2], dropItem: "minecraft:arrow", process: null, where: { dim: "overworld", note: "骨と同時" } },
    { kind: "craft", id: "minecraft:flint", yield: [4, 4], dropItem: "minecraft:arrow", process: "craft", where: { dim: "overworld", note: "火打石＋棒＋羽根で4本（作業台）" } },
  ] },
  "minecraft:rotten_flesh": { item: "minecraft:rotten_flesh", name: "腐った肉", aliases: ["腐肉", "rotten_flesh"], priority: 3, sources: [
    { kind: "entity", id: "minecraft:zombie", yield: [0, 2], dropItem: "minecraft:rotten_flesh", process: null, where: { dim: "overworld", note: "非常食。村人ゾンビ治療やオオカミ餌にも" } },
  ] },
  "minecraft:ender_pearl": { item: "minecraft:ender_pearl", name: "エンダーパール", aliases: ["パール", "ender_pearl"], priority: 3, sources: [
    { kind: "entity", id: "minecraft:enderman", yield: [0, 1], dropItem: "minecraft:ender_pearl", process: null, where: { dim: "overworld", biome: "warped_forest/end", note: "目を合わせると襲ってくる。屋根2マスの下に籠ると安全" } },
  ] },
  "minecraft:blaze_rod": { item: "minecraft:blaze_rod", name: "ブレイズロッド", aliases: ["ブレイズロッド", "blaze_rod"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:blaze", yield: [0, 1], dropItem: "minecraft:blaze_rod", process: null, where: { dim: "nether", biome: "nether_fortress", note: "要塞のスポナー周辺。火の玉を避けながら" } },
  ] },
  "minecraft:blaze_powder": { item: "minecraft:blaze_powder", name: "ブレイズパウダー", aliases: ["blaze_powder"], priority: 4, sources: [
    { kind: "craft", id: "minecraft:blaze_rod", yield: [2, 2], dropItem: "minecraft:blaze_powder", process: "craft", where: { dim: "overworld", note: "ロッド1本から2個" } },
  ] },
  "minecraft:ender_eye": { item: "minecraft:ender_eye", name: "エンダーアイ", aliases: ["エンダーアイ", "ender_eye"], priority: 4, sources: [
    { kind: "craft", id: "minecraft:ender_pearl", yield: [1, 1], dropItem: "minecraft:ender_eye", process: "craft", where: { dim: "overworld", note: "エンダーパール＋ブレイズパウダー。要塞探しの必需品" } },
  ] },
  "minecraft:ghast_tear": { item: "minecraft:ghast_tear", name: "ガストの涙", aliases: ["ガストの涙", "ghast_tear"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:ghast", yield: [0, 1], dropItem: "minecraft:ghast_tear", process: null, where: { dim: "nether", note: "溶岩の上に落とすと消える。打ち返し討伐が理想" } },
  ] },
  "minecraft:slime_ball": { item: "minecraft:slime_ball", name: "スライムボール", aliases: ["スライム", "slime_ball"], priority: 3, sources: [
    { kind: "entity", id: "minecraft:slime", yield: [0, 2], dropItem: "minecraft:slime_ball", process: null, where: { dim: "overworld", biome: "swamp/slime_chunk", yRange: [-64, 40], note: "分裂するので最小サイズまで倒す。沼地は満月の夜が最盛" } },
  ] },
  "minecraft:magma_cream": { item: "minecraft:magma_cream", name: "マグマクリーム", aliases: ["magma_cream"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:magma_cube", yield: [0, 1], dropItem: "minecraft:magma_cream", process: null, where: { dim: "nether", biome: "basalt_deltas/nether_wastes", note: "分裂する大型個体が対象" } },
  ] },
  "minecraft:phantom_membrane": { item: "minecraft:phantom_membrane", name: "ファントムの皮膜", aliases: ["皮膜", "phantom_membrane"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:phantom", yield: [0, 1], dropItem: "minecraft:phantom_membrane", process: null, where: { dim: "overworld", note: "3日以上寝ていない夜に空から来る。エリトラ修理用" } },
  ] },
  "minecraft:shulker_shell": { item: "minecraft:shulker_shell", name: "シュルカーの殻", aliases: ["シュルカー殻", "shulker_shell"], priority: 5, sources: [
    { kind: "entity", id: "minecraft:shulker", yield: [0, 1], dropItem: "minecraft:shulker_shell", process: null, where: { dim: "end", biome: "end_city", note: "約50%で1個。浮遊弾に注意" } },
  ] },
  "minecraft:totem_of_undying": { item: "minecraft:totem_of_undying", name: "不死のトーテム", aliases: ["トーテム", "totem"], priority: 5, sources: [
    { kind: "entity", id: "minecraft:evoker", yield: [1, 1], dropItem: "minecraft:totem_of_undying", process: null, where: { dim: "overworld", biome: "woodland_mansion/raid", note: "エヴォーカー確定ドロップ。森の洋館か襲撃イベント" } },
  ] },
  "minecraft:wither_skeleton_skull": { item: "minecraft:wither_skeleton_skull", name: "ウィザースケルトンの頭蓋骨", aliases: ["ウィザスケ頭", "wither_skull"], priority: 5, sources: [
    { kind: "entity", id: "minecraft:wither_skeleton", yield: [0, 1], dropItem: "minecraft:wither_skeleton_skull", process: null, where: { dim: "nether", biome: "nether_fortress", note: "確率は約2.5%。石と石炭も同時に出る" } },
  ] },
  "minecraft:nether_star": { item: "minecraft:nether_star", name: "ネザースター", aliases: ["nether_star"], priority: 5, sources: [
    { kind: "entity", id: "minecraft:wither", yield: [1, 1], dropItem: "minecraft:nether_star", process: null, where: { dim: "overworld", note: "ボス「ウィザー」確定ドロップ。召喚には頭蓋骨3個＋ソウルサンド4個が先に必要" } },
  ] },
  "minecraft:trident": { item: "minecraft:trident", name: "トライデント", aliases: ["trident"], priority: 5, sources: [
    { kind: "entity", id: "minecraft:drowned", yield: [0, 1], dropItem: "minecraft:trident", process: null, where: { dim: "overworld", biome: "ocean/river", note: "トライデント装備個体からのみ低確率" } },
  ] },
  "minecraft:nautilus_shell": { item: "minecraft:nautilus_shell", name: "オウムガイの殻", aliases: ["nautilus_shell"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:drowned", yield: [0, 1], dropItem: "minecraft:nautilus_shell", process: null, where: { dim: "overworld", biome: "ocean", note: "殻を手に持ったドラウンドから確定" } },
  ] },
  "minecraft:ink_sac": { item: "minecraft:ink_sac", name: "イカスミ", aliases: ["イカスミ", "ink_sac"], priority: 3, sources: [
    { kind: "entity", id: "minecraft:squid", yield: [1, 3], dropItem: "minecraft:ink_sac", process: null, where: { dim: "overworld", biome: "ocean/river", note: "黒い染料の原料" } },
  ] },
  "minecraft:glow_ink_sac": { item: "minecraft:glow_ink_sac", name: "輝くイカスミ", aliases: ["glow_ink_sac"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:glow_squid", yield: [1, 3], dropItem: "minecraft:glow_ink_sac", process: null, where: { dim: "overworld", yRange: [-64, 30], note: "地下の水場に光るイカ" } },
  ] },
  "minecraft:prismarine_shard": { item: "minecraft:prismarine_shard", name: "プリズマリンの欠片", aliases: ["プリズマリン", "prismarine"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:guardian", yield: [0, 2], dropItem: "minecraft:prismarine_shard", process: null, where: { dim: "overworld", biome: "ocean_monument", note: "海底神殿のガーディアン。トゲ反撃に注意" } },
  ] },
  "minecraft:prismarine_crystals": { item: "minecraft:prismarine_crystals", name: "プリズマリンクリスタル", aliases: ["prismarine_crystals"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:guardian", yield: [0, 1], dropItem: "minecraft:prismarine_crystals", process: null, where: { dim: "overworld", biome: "ocean_monument", note: "欠片と同時に出ることがある" } },
  ] },
  "minecraft:sponge": { item: "minecraft:sponge", name: "スポンジ（濡れた）", aliases: ["スポンジ", "sponge"], priority: 5, sources: [
    { kind: "block", id: "minecraft:sponge", yield: [1, 1], dropItem: "minecraft:sponge", process: null, where: { dim: "overworld", biome: "ocean_monument", note: "神殿内のスポンジ部屋。乾かすには精錬が必要" } },
    { kind: "entity", id: "minecraft:elder_guardian", yield: [1, 1], dropItem: "minecraft:sponge", process: null, where: { dim: "overworld", biome: "ocean_monument", note: "エルダーガーディアンからも1個" } },
  ] },
  "minecraft:breeze_rod": { item: "minecraft:breeze_rod", name: "ブリーズロッド", aliases: ["breeze_rod"], priority: 5, sources: [
    { kind: "entity", id: "minecraft:breeze", yield: [1, 2], dropItem: "minecraft:breeze_rod", process: null, where: { dim: "overworld", biome: "trial_chambers", note: "試練の間（トライアルチャンバー）のブリーズ" } },
  ] },
  "minecraft:ochre_froglight": { item: "minecraft:ochre_froglight", name: "フロッグライト（黄土）", aliases: ["フロッグライト", "froglight"], priority: 4, sources: [
    { kind: "entity", id: "minecraft:frog", yield: [1, 1], dropItem: "minecraft:ochre_froglight", process: null, where: { dim: "nether", biome: "basalt_deltas", note: "カエルが小型マグマキューブを食べると生成される。色はカエルの生息地で変わる（黄土=通常種）" } },
  ] },
  // ================= 加工品 =================
  "minecraft:torch": { item: "minecraft:torch", name: "松明", aliases: ["松明", "torch"], priority: 1, sources: [
    { kind: "craft", id: "minecraft:coal", yield: [4, 4], dropItem: "minecraft:torch", process: "craft", where: { dim: "overworld", note: "石炭（または木炭）＋棒で4本。手作業変換" } },
  ] },
  "minecraft:book": { item: "minecraft:book", name: "本", aliases: ["本", "book"], priority: 3, sources: [
    { kind: "craft", id: "minecraft:paper", yield: [1, 1], dropItem: "minecraft:book", process: "craft", where: { dim: "overworld", note: "紙3枚＋革1枚（作業台）" } },
  ] },
  "minecraft:bread": { item: "minecraft:bread", name: "パン", aliases: ["パン", "bread"], priority: 2, sources: [
    { kind: "craft", id: "minecraft:wheat", yield: [1, 1], dropItem: "minecraft:bread", process: "craft", where: { dim: "overworld", note: "小麦3個から1個（作業台）" } },
  ] },
  "minecraft:glass_bottle": { item: "minecraft:glass_bottle", name: "ガラス瓶", aliases: ["瓶", "glass_bottle"], priority: 3, sources: [
    { kind: "craft", id: "minecraft:glass", yield: [3, 3], dropItem: "minecraft:glass_bottle", process: "craft", where: { dim: "overworld", note: "ガラス3個から瓶3個。元は砂の精錬から" } },
  ] },
  "minecraft:bricks": { item: "minecraft:bricks", name: "レンガブロック", aliases: ["レンガブロック", "bricks"], priority: 3, sources: [
    { kind: "craft", id: "minecraft:brick", yield: [1, 1], dropItem: "minecraft:bricks", process: "craft", where: { dim: "overworld", note: "レンガ（精錬品）4個で1ブロック" } },
  ] },
  "minecraft:stone_bricks": { item: "minecraft:stone_bricks", name: "石レンガ", aliases: ["石レンガ", "stone_bricks"], priority: 3, sources: [
    { kind: "craft", id: "minecraft:stone", yield: [1, 1], dropItem: "minecraft:stone_bricks", process: "craft", where: { dim: "overworld", note: "石4個から4個。石は丸石の精錬から" } },
  ] },
  "minecraft:shears": { item: "minecraft:shears", name: "ハサミ", aliases: ["ハサミ", "shears"], priority: 3, sources: [
    { kind: "craft", id: "minecraft:iron_ingot", yield: [1, 1], dropItem: "minecraft:shears", process: "craft", where: { dim: "overworld", note: "鉄2個。※あなた（主人）用。リゼ自身はAPI制約でハサミを使えない" } },
  ] },
  "minecraft:bucket": { item: "minecraft:bucket", name: "バケツ", aliases: ["バケツ", "bucket"], priority: 2, sources: [
    { kind: "craft", id: "minecraft:iron_ingot", yield: [1, 1], dropItem: "minecraft:bucket", process: "craft", where: { dim: "overworld", note: "鉄3個" } },
  ] },
  "minecraft:milk_bucket": { item: "minecraft:milk_bucket", name: "牛乳", aliases: ["牛乳", "ミルク", "milk_bucket"], priority: 2, sources: [
    { kind: "fill", id: "minecraft:cow", mediumKind: "entity", container: "minecraft:bucket", yield: [1, 1], dropItem: "minecraft:milk_bucket", process: "fill", where: { dim: "overworld", note: "空バケツを牛に使う。牛は殺さない・傷つけない" } },
    { kind: "fill", id: "minecraft:mooshroom", mediumKind: "entity", container: "minecraft:bucket", yield: [1, 1], dropItem: "minecraft:milk_bucket", process: "fill", where: { dim: "overworld", biome: "mushroom_fields", note: "ムーシュルームからも搾乳できる（代替源・推奨順2位）" } },
  ] },
  "minecraft:water_bucket": { item: "minecraft:water_bucket", name: "水入りバケツ", aliases: ["水入りバケツ", "水バケツ", "water_bucket"], priority: 2, sources: [
    { kind: "fill", id: "minecraft:water", mediumKind: "block", container: "minecraft:bucket", yield: [1, 1], dropItem: "minecraft:water_bucket", process: "fill", where: { dim: "overworld", note: "静止した水源に空バケツを使う。水源ブロックは消費される。流水は不可" } },
  ] },
  "minecraft:lava_bucket": { item: "minecraft:lava_bucket", name: "溶岩バケツ", aliases: ["溶岩バケツ", "マグマバケツ", "lava_bucket"], priority: 3, sources: [
    { kind: "fill", id: "minecraft:lava", mediumKind: "block", container: "minecraft:bucket", yield: [1, 1], dropItem: "minecraft:lava_bucket", process: "fill", where: { dim: "overworld", note: "溶岩源に空バケツを使う。安全ゲート（S5）を満たす場合のみ。流れる溶岩は不可" } },
  ] },
  // ================= GVC（弾薬類） =================
  // ID出典: brain/compat_gvc.js の貴重品リスト（テキスト参照のみで確認）。
  // ドロップ率はGVC側の未検証情報のため yield は目安、note にその旨を明記。
  "zex:bullet_frag": { item: "zex:bullet_frag", name: "GVC 弾薬（破片弾系）", aliases: ["弾薬", "弾", "GVC弾薬", "bullet"], priority: 3, sources: [
    { kind: "entity", id: "gvcv5:ga", yield: [0, 4], dropItem: "zex:bullet_frag", process: null, where: { dim: "overworld", note: "ゲリラ歩兵のドロップ（目安・未検証）。他に bullet_ap/at/db/emp/gas/hp/srag のバリエーション弾がある" } },
    { kind: "entity", id: "gvcv5:gb1", yield: [0, 4], dropItem: "zex:bullet_frag", process: null, where: { dim: "overworld", note: "ゲリラ歩兵 v2 系も同様（目安）" } },
  ] },
  "gvcv5:40mmgr_ammo_gc_item": { item: "gvcv5:40mmgr_ammo_gc_item", name: "GVC 40mmグレネード弾", aliases: ["40mm", "グレネード弾"], priority: 4, sources: [
    { kind: "entity", id: "gvcv5:gc1", yield: [0, 2], dropItem: "gvcv5:40mmgr_ammo_gc_item", process: null, where: { dim: "overworld", note: "グレネード装備のゲリラ v3 系のドロップ（目安・未検証）" } },
  ] },
  "gvcv5:ammobox1_item": { item: "gvcv5:ammobox1_item", name: "GVC 弾薬箱", aliases: ["弾薬箱", "ammobox"], priority: 4, sources: [
    { kind: "entity", id: "gvcv5:char2c", yield: [0, 1], dropItem: "gvcv5:ammobox1_item", process: null, where: { dim: "overworld", note: "敵ボス級のドロップ（目安・未検証）。RPG用は rpg_ammobox1_item / rpg_ammobox2_item" } },
  ] },
  "zex:rocketm": { item: "zex:rocketm", name: "GVC ロケット弾", aliases: ["ロケット弾", "rocket"], priority: 5, sources: [
    { kind: "entity", id: "gvcv5:mer03k", yield: [0, 2], dropItem: "zex:rocketm", process: null, where: { dim: "overworld", note: "砲撃型ボス mer 系のドロップ（目安・未検証）" } },
  ] },
  // ================= 軌道工廠 =================
  // ID出典: brain/compat_orbital.js（テキスト参照のみ）。採取可否が未確定の素材は
  // note に「要確認」と明記し、planFor では supported:false の段階として返す。
  "orbital_foundry:raw_uranium": { item: "orbital_foundry:raw_uranium", name: "ウラン原鉱", aliases: ["ウラン", "raw_uranium"], priority: 4, sources: [
    { kind: "block", id: "orbital_foundry:uranium_ore", yield: [1, 1], dropItem: "orbital_foundry:raw_uranium", process: null, where: { dim: "overworld", note: "工廠の希少鉱石から。※鉱石ブロックIDは要確認（compat の「希少鉱石産」コメントが根拠）。精錬で uranium_ingot" } },
  ] },
  "orbital_foundry:uranium_ingot": { item: "orbital_foundry:uranium_ingot", name: "ウランインゴット", aliases: ["uranium_ingot"], priority: 4, sources: [
    { kind: "craft", id: "orbital_foundry:raw_uranium", yield: [1, 1], dropItem: "orbital_foundry:uranium_ingot", process: "smelt", where: { dim: "overworld", note: "ウラン原鉱の精錬（工廠工程の可能性。要確認）" } },
  ] },
  "orbital_foundry:steel_ingot": { item: "orbital_foundry:steel_ingot", name: "鋼鉄インゴット", aliases: ["鋼鉄", "steel"], priority: 3, sources: [
    { kind: "craft", id: "minecraft:iron_ingot", yield: [1, 1], dropItem: "orbital_foundry:steel_ingot", process: "craft", where: { dim: "overworld", note: "鉄を工廠の機械で加工する素材。バニラかまどでは作れない（工廠の進行が必要）" } },
  ] },
  "orbital_foundry:meteor_iron": { item: "orbital_foundry:meteor_iron", name: "隕鉄", aliases: ["隕鉄", "meteor_iron"], priority: 4, sources: [
    { kind: "craft", id: "orbital_foundry:meteor_iron", yield: [1, 1], dropItem: "orbital_foundry:meteor_iron", process: "craft", where: { dim: "overworld", note: "軌道貨物便で届く素材（T2キー・起動核の材料）。自然採取源はなく、リゼの採取対象外。調達は工廠の貨物進行で" } },
  ] },
  "orbital_foundry:orbital_crystal": { item: "orbital_foundry:orbital_crystal", name: "軌道結晶", aliases: ["軌道結晶", "orbital_crystal"], priority: 5, sources: [
    { kind: "craft", id: "orbital_foundry:orbital_crystal", yield: [1, 1], dropItem: "orbital_foundry:orbital_crystal", process: "craft", where: { dim: "overworld", note: "軌道貨物便系の素材（T3/T6キー）。自然採取源はなく、リゼの採取対象外" } },
  ] },
  "orbital_foundry:iridium": { item: "orbital_foundry:iridium", name: "イリジウム", aliases: ["イリジウム", "iridium"], priority: 5, sources: [
    { kind: "entity", id: "orbital_foundry:overseer", yield: [0, 2], dropItem: "orbital_foundry:iridium", process: null, where: { dim: "overworld", note: "工廠の最上位素材。ボス系からの入手が推定されるが未検証（要確認）。工廠の進行が前提" } },
  ] },
  "orbital_foundry:corn": { item: "orbital_foundry:corn", name: "トウモロコシ（工廠作物）", aliases: ["トウモロコシ", "corn"], priority: 3, sources: [
    { kind: "block", id: "orbital_foundry:corn", yield: [1, 2], dropItem: "orbital_foundry:corn", process: null, where: { dim: "overworld", biome: "farm", note: "工廠の作物。種を植えて育てる（収量は目安）" } },
  ] },
  "orbital_foundry:strawberry": { item: "orbital_foundry:strawberry", name: "イチゴ（工廠作物）", aliases: ["イチゴ", "strawberry"], priority: 3, sources: [
    { kind: "block", id: "orbital_foundry:strawberry", yield: [1, 2], dropItem: "orbital_foundry:strawberry", process: null, where: { dim: "overworld", biome: "farm", note: "工廠の作物（収量は目安）" } },
  ] },
};

// ---------- 原木（汎用） ----------
// パーサの「原木」は id "log" になる。樹種を問わず最寄りの自然の木を伐る（実行部が樹種横断で探す）。
if (!SOURCING["log"]) SOURCING["log"] = { item: "log", name: "原木", aliases: ["原木", "丸太", "log"], priority: 1, sources: [
  { kind: "block", id: "minecraft:oak_log", yield: [1, 1], dropItem: "minecraft:oak_log", process: null, where: { dim: "overworld", note: "自然の木なら樹種は問わない" } },
] };

// ---------- GVC / 軌道工廠アイテムの登録 ----------
// 他アドオンの貴重品は「落ちているものの回収（敵のドロップ等）」を前提に注文可能にする。
// kind:"craft"・id=自分自身 にすると、実行部はブロック走査で見つからずドロップ品の探索に落ちる。
for (const id of [...GVC_VALUABLES, ...OF_VALUABLES]) {
  if (SOURCING[id]) continue;
  const tail = id.split(":").pop();
  SOURCING[id] = { item: id, name: tail.replace(/_/g, " "), aliases: [tail, id], priority: 4, sources: [
    { kind: "craft", id, yield: [1, 1], dropItem: id, process: null, where: { dim: "overworld", note: "他アドオンのアイテム。落ちているものの回収が前提（敵のドロップ・既存ストック等）" } },
  ] };
}

// ---------- 検索 ----------
const ALIAS_INDEX = (() => {
  const m = new Map();
  for (const [id, e] of Object.entries(SOURCING)) {
    m.set(id.toLowerCase(), id);
    m.set(id.split(":").pop().toLowerCase(), id);
    m.set(e.name, id);
    for (const a of e.aliases || []) m.set(String(a).toLowerCase(), id);
  }
  return m;
})();

// HUNT-SCAN-BUCKET-01 (cyc2385): 供給源になりうる実体IDの集合。
// 走査分類が家畜4種固定で、sourcing が列挙する非敵対の供給源 (rabbit/cod/salmon/squid 等) を
// 拾う受け皿が無く、目の前にいても absent 扱いになった是正。知識表が増えれば集合も追随する。
export function entitySourceIds() {
  const out = new Set();
  try {
    for (const e of Object.values(SOURCING)) {
      for (const s of e?.sources || []) if (s && s.kind === "entity" && typeof s.id === "string") out.add(s.id);
    }
  } catch {}
  return out;
}

// itemId（完全/省略形）・日本語名・エイリアスのいずれかからエントリを引く。無ければ null。
export function findSources(itemIdOrAlias) {
  if (!itemIdOrAlias) return null;
  const q = String(itemIdOrAlias).trim();
  if (SOURCING[q]) return SOURCING[q];
  const id = ALIAS_INDEX.get(q.toLowerCase());
  return id ? SOURCING[id] : null;
}

// ---------- 採取プラン雛形 ----------
// 返り値: { item, name, count, source, alternatives, steps, support, est }
//   support: 'full'（採取→帰還まで実行可能）
//          | 'gather_only'（精錬/加工の段階で止まる。steps の該当工程に supported:false）
//          | 'unsupported'（採取自体が現行APIで不可・調達系素材）
//   steps: [{step:'move'|'mine'|'hunt'|'gather'|'smelt'|'craft'|'return', ...}]
//   est: { perAction:[min,max], actionsMin, actionsMax } 必要個数に対する採取回数目安
export function planFor(itemIdOrAlias, opts = {}) {
  const entry = findSources(itemIdOrAlias);
  if (!entry) return null;
  const count = Math.max(1, Math.floor(opts.count || 1));
  const si = Number.isInteger(opts.sourceIndex) ? opts.sourceIndex : 0;
  const source = entry.sources[Math.min(si, entry.sources.length - 1)];
  const alternatives = entry.sources.filter((_, i) => i !== Math.min(si, entry.sources.length - 1));
  const w = source.where || {};
  const steps = [];
  // 移動
  const dest = [];
  if (w.dim && w.dim !== "overworld") dest.push(w.dim === "nether" ? "ネザー" : "エンド");
  if (w.biome) dest.push(`バイオーム:${w.biome}`);
  if (w.yRange) dest.push(`Y${w.yRange[0]}〜${w.yRange[1]}`);
  steps.push({ step: "move", to: dest.join(" / ") || "オーバーワールド", dim: w.dim || "overworld", biome: w.biome || null, yRange: w.yRange || null, note: w.note || "", supported: true });
  // 採取
  const gatherStep = source.kind === "fill" ? "fill" : source.kind === "entity" ? "hunt" : source.kind === "craft" ? "gather" : "mine";
  const zeroYield = (source.yield?.[1] ?? 0) <= 0;
  // R-C4-4 S2→S4: fill は S4 で実行部を接続済み。
  // kind 判定を entity/craft より前に置かないと mine へ誤って落ちる (cyc2377_a16 §2)。
  const stepSupported = !zeroYield; // R-C4-4 S4 (cyc2382): 充填tx接続済みのため fill も supported
  steps.push({ step: gatherStep, kind: source.kind, target: source.id, dropItem: source.dropItem, yield: source.yield, note: source.kind === "fill" ? "殺さずに充填する（容器を媒体に使う）" : source.kind === "entity" ? "討伐して回収（敵対ポリシーは指示層の指定に従う）" : source.kind === "craft" ? `原料 ${source.id} を必要数集める` : "掘って回収", supported: stepSupported });
  // 工程（精錬/加工）
  let support = zeroYield ? "unsupported" : "full";
  if (source.process === "smelt") {
    steps.push({ step: "smelt", input: source.dropItem, output: entry.item, note: "かまど工程が必要。現行のリゼは精錬未対応のため、この段階で分ける（原料の回収までを保証）", supported: false });
    if (support === "full") support = "gather_only";
  } else if (source.process === "craft") {
    steps.push({ step: "craft", input: source.id === source.dropItem ? source.dropItem : source.id, output: entry.item, note: "変換・合成工程。手作業変換は実行可否を統合側が判断（作業台系は未対応の場合あり）", supported: false });
    if (support === "full") support = "gather_only";
  }
  // 帰還
  steps.push({ step: "return", note: "拠点へ帰還し、コンテナへ入庫する", supported: true });
  const [ymin, ymax] = source.yield || [1, 1];
  const est = {
    perAction: source.yield || [1, 1],
    actionsMin: ymax > 0 ? Math.ceil(count / ymax) : null,
    actionsMax: ymin > 0 ? Math.ceil(count / ymin) : null,
  };
  return { item: entry.item, name: entry.name, count, source, alternatives, steps, support, est };
}
