// sfx.js — 素材カテゴリ→サウンド対応表 (要望バッチF 正式統合 v0.4.88、出典 brain_parts/solutions/lize-sound/DESIGN.md)
// △ID (UNVERIFIED_IDS) は実機確認待ち。再生は全て try/catch 内蔵で失敗しても本体を止めない
// 純粋モジュール: @minecraft/server を import しない。dimension は注入され、
// 再生は全て try/catch 内蔵で、音の失敗が本体処理を止めることはない。
// 純粋モジュール: @minecraft/server を import しない。dimension は注入される。

// ---------------------------------------------------------------------------
// §3 カテゴリ → サウンド ID 解決表
// hit = 掘削中の叩き音 / break = 破壊音 / step = 足音。null = 無音。
// ✓ = DESIGN §1.2 で実在確認済み / △ = 推定 (UNVERIFIED_IDS に列挙、統合前に照合)
// ---------------------------------------------------------------------------
export const SFX_TABLE = Object.freeze({
  grass:          { hit: "hit.grass",  break: "dig.grass",          step: "step.grass" },        // ✓✓✓
  sand:           { hit: "hit.sand",   break: "dig.sand",           step: "step.sand" },         // △✓✓
  gravel:         { hit: "hit.gravel", break: "dig.gravel",         step: "step.gravel" },       // △✓✓
  snow:           { hit: "hit.snow",   break: "dig.snow",           step: "step.snow" },         // △✓△
  powder_snow:    { hit: "hit.snow",   break: "dig.powder_snow",    step: "step.snow" },         // snow に寄せる (hit/step)
  cloth:          { hit: "hit.cloth",  break: "dig.cloth",          step: "step.cloth" },        // △✓✓
  wood:           { hit: "hit.wood",   break: "dig.wood",           step: "step.wood" },         // △✓✓
  stem:           { hit: "hit.wood",   break: "dig.stem",           step: "step.nether_wood" },  // ネザー木材: hit は wood 代用
  fungus:         { hit: "hit.wood",   break: "dig.fungus",         step: "step.nether_wood" },  // POLISH-SND-CLASS-FUNGUS-01 (cyc2020): break のみ専用ID確認済み (DESIGN §1.2)、hit/step は stem 流用
  stone:          { hit: "hit.stone",  break: "dig.stone",          step: "step.stone" },        // ✓✓✓
  deepslate:      { hit: "hit.deepslate", break: "dig.deepslate",   step: "step.deepslate" },    // △✓△ (step 無ければ step.stone)
  deepslate_bricks: { hit: "hit.deepslate", break: "dig.deepslate_bricks", step: "step.deepslate" }, // POLISH-SND-CLASS-DEEPSLATE-BRICKS-01 (cycle1256): break のみ専用ID確認済み、hit/step は deepslate 流用
  copper:         { hit: "hit.stone",  break: "dig.copper",         step: "step.stone" },        // hit/step は stone 代用
  netherite:      { hit: "hit.stone",  break: "dig.netherite",      step: "step.netherite" },    // POLISH-SND-TIER3-NETHERITE (cycle1303): hit は stone 代用、完全一致 netherite_block のみ
  netherrack:     { hit: "hit.stone",  break: "dig.netherrack",     step: "step.netherrack" },   // ✓(break/step)
  nether_brick:   { hit: "hit.stone",  break: "dig.nether_brick",   step: "step.nether_brick" }, // ✓(break/step)
  nether_gold_ore:{ hit: "hit.stone",  break: "dig.nether_gold_ore", step: "step.nether_gold_ore" }, // ✓(break/step)
  nylium:         { hit: "hit.grass",  break: "dig.nylium",         step: "step.nylium" },       // hit は grass 代用
  soul_sand:      { hit: "hit.sand",   break: "dig.soul_sand",      step: "step.sand" },         // hit/step は sand 代用
  soul_soil:      { hit: "hit.grass",  break: "dig.soul_soil",      step: "step.grass" },        // hit/step は grass 代用
  // 金属: 破壊専用 ID はバニラに存在しない (DESIGN §3)。暫定で hit.iron を強めに流用。
  metal:          { hit: "hit.iron",   break: "hit.iron",           step: "step.iron" },         // ✓✓✓ (break は暫定)
  // ガラス: 叩き音・足音は無音、破壊は random.glass が正 (dig.glass は存在しない)。
  glass:          { hit: null,         break: "random.glass",       step: null },
  ice:            { hit: null,         break: "random.glass",       step: "step.stone" },        // POLISH-SND-TIER3-ICE (cycle1322): glass へ寄せると足音が消えるため専用行 (break/step 分離)
  vines:          { hit: "hit.grass",  break: "dig.vines",          step: "step.grass" },        // POLISH-SND-TIER3-VINES (cycle1322): hit/step は grass 代用
  coral:          { hit: "hit.stone",  break: "dig.coral",          step: "step.stone" },        // POLISH-SND-TIER3-CORAL (cycle1322): hit/step は stone 代用
  amethyst:       { hit: "hit.amethyst_block", break: "dig.amethyst_block", step: "step.amethyst_block" }, // POLISH-SND-AMETHYST-01 (cycle0606, a10監査で専用ID確認済み): アメジスト系が stone へ落ちていた誤分類の是正
  shroomlight:    { hit: "hit.stone",  break: "dig.shroomlight",    step: "step.stone" },        // POLISH-SND-CLASS-A4 (cycle0936): break のみ専用ID確認済み、hit/step は stone 流用
  froglight:      { hit: "hit.stone",  break: "break.froglight",    step: "step.froglight" },    // POLISH-SND-CLASS-FROGLIGHT (cycle1215): break/step 専用ID確認済み (dig.froglight は実在しないため break.* 命名)、hit は stone 流用
  moss:           { hit: "hit.grass",  break: "dig.moss",           step: "step.moss" },         // POLISH-SND-CLASS-R2 (cycle1058): dig/step 専用ID確認済み、hit は grass 流用
  nether_sprouts: { hit: "hit.grass",  break: "dig.nether_sprouts", step: "step.nether_sprouts" }, // POLISH-SND-CLASS-NETHERSPROUTS-01 (cycle1434): dig/step 専用ID確認済み、hit は grass 流用
  candle:         { hit: "hit.candle", break: "dig.candle",       step: "step.cloth" },        // POLISH-SND-CLASS-CANDLE (cycle1134): dig/hit 専用ID確認済み、step は cloth 流用
  honey_block:    { hit: "hit.stone",  break: "dig.honey_block",    step: "step.stone" },        // POLISH-SND-CLASS-R1 (cycle0955): break 専用ID確認済み、hit/step は stone 流用
  lodestone:      { hit: "hit.stone",  break: "dig.lodestone",      step: "step.stone" },        // POLISH-SND-CLASS-R1 (cycle0955): break 専用ID確認済み、hit/step は stone 流用
  basalt:         { hit: "hit.basalt", break: "dig.basalt",       step: "step.basalt" },       // POLISH-SND-CLASS-BASALT-01 (cycle1514): 3軸とも専用IDを Wiki Bedrock 行で確認済み
  azalea_leaves:  { hit: "hit.azalea_leaves", break: "dig.azalea_leaves", step: "step.azalea_leaves" }, // POLISH-SND-CLASS-AZALEA-LEAVES-01 (cycle1532): 3軸とも専用ID確認済み (Bedrock Wiki 1.21.70)。低木 azalea 本体は対象外
  bone_block:     { hit: "hit.bone_block", break: "dig.bone_block", step: "step.bone_block" }, // POLISH-SND-CLASS-BONEBLOCK-01 (cyc1743): 3軸とも専用ID確認済み (A19先行照合)、従来は stone 落ち
  cherry_leaves:  { hit: "hit.cherry_leaves", break: "break.cherry_leaves", step: "step.cherry_leaves" }, // POLISH-SND-CLASS-CHERRYLEAVES-01 (cyc1810): hit/step/break 専用ID確認済み (Bedrock Wiki 1.21.70)。dig.cherry_leaves は実在しないため break.* 命名 (froglight と同型)
  sculk:          { hit: "hit.sculk",  break: "break.sculk",        step: "step.sculk" },
  tuff:           { hit: "hit.tuff",   break: "break.tuff",         step: "step.tuff" },          // POLISH-SND-CLASS-TUFF-01 (cyc2221): 3軸とも専用ID確認済み (Bedrock Wiki 1.21.70)。dig.tuff は実在しないため break.* 命名 (froglight と同型)。加工変種は対象外        // POLISH-SND-CLASS-SCULK-01 (cyc1924): 3軸とも専用ID確認済み (Bedrock Wiki 1.21.70)。dig.sculk は実在しないため break.* 命名 (froglight と同型)
  calcite:        { hit: "hit.calcite", break: "break.calcite",      step: "step.calcite" },       // POLISH-SND-CLASS-CALCITE-01 (cyc2232): 3軸とも専用ID確認済み (Bedrock Wiki 1.21.70)。dig.calcite は実在しないため break.* 命名
});

// §1.2 で実在確認済みの ID (この表が参照する分 + 汎用分)
export const CONFIRMED_IDS = new Set([
  "hit.grass", "hit.stone", "hit.iron",
  "dig.grass", "dig.sand", "dig.gravel", "dig.snow", "dig.powder_snow",
  "dig.cloth", "dig.wood", "dig.stem", "dig.fungus", "dig.stone", "dig.deepslate", // cyc2020: dig.fungus 専用ID確認済み (break のみ)
  "dig.copper", "dig.netherite", "step.netherite", "dig.netherrack", "dig.nether_brick", "dig.nether_gold_ore",
  "dig.nylium", "dig.soul_sand", "dig.soul_soil", "dig.vines", "dig.coral",
  "hit.amethyst_block", "dig.amethyst_block", "step.amethyst_block", // cycle0606 a10: 専用ID確認済み
  "dig.shroomlight", // cycle0936 a08: 専用ID確認済み (break のみ)
  "dig.honey_block", "dig.lodestone", // cycle0955 a07: 専用ID確認済み (break のみ)
  "dig.moss", "step.moss", // cycle1058 a07: 専用ID確認済み (break/step)
  "dig.nether_sprouts", "step.nether_sprouts", // cycle1434 a14: 専用ID確認済み (break/step)
  "dig.candle", "hit.candle", // cycle1134 a07: 専用ID確認済み (break/hit)
  "hit.basalt", "dig.basalt", "step.basalt", // cycle1514 a14: 専用ID確認済み (3軸とも)
  "hit.azalea_leaves", "dig.azalea_leaves", "step.azalea_leaves", // cycle1532 a18: 専用ID確認済み (3軸とも)
  "hit.bone_block", "dig.bone_block", "step.bone_block", // cyc1743 A19: 専用ID確認済み (3軸とも)
  "hit.cherry_leaves", "break.cherry_leaves", "step.cherry_leaves", // cyc1810 A15: 専用ID確認済み (dig.cherry_leaves は実在しない)
  "hit.sculk", "break.sculk", "step.sculk", // cyc1924 A17: 専用ID確認済み (dig.sculk は実在しない)
  "hit.tuff", "break.tuff", "step.tuff", // cyc2221 A18: 専用ID確認済み (dig.tuff は実在しない)
  "hit.calcite", "break.calcite", "step.calcite", // cyc2232 A06: 専用ID確認済み (dig.calcite は実在しない)
  "break.froglight", "step.froglight", // cycle1215 a14: 専用ID確認済み (break/step。dig.froglight/hit.froglight は実在しない)
  "dig.deepslate_bricks", // cycle1256 a16: 専用ID確認済み (break のみ)
  "step.grass", "step.sand", "step.gravel", "step.cloth", "step.wood",
  "step.nether_wood", "step.stone", "step.netherrack", "step.nether_brick",
  "step.nether_gold_ore", "step.nylium", "step.iron",
  "random.glass", "random.pop", "random.pop2",
  "game.player.hurt", "game.player.die",
  "game.player.attack.strong", "game.player.attack.weak",
  "entity.generic.splash",
]);

// △ 推定 ID: 統合前に sound_definitions.json 全文と機械照合し、
// 実在しなければ DESIGN §3 の代用列に確定させること。
export const UNVERIFIED_IDS = new Set([
  "hit.sand", "hit.gravel", "hit.snow", "hit.cloth", "hit.wood", "hit.deepslate",
  "step.snow", "step.deepslate",
]);

// 絶対に返してはいけない不存在 ID (DESIGN §1.2)
export const FORBIDDEN_IDS = new Set([
  "dig.glass", "hit.glass", "dig.metal", "dig.iron", "iron.break",
]);

export const GENERIC_IDS = Object.freeze({
  attack: "game.player.attack.strong",
  hurt: "game.player.hurt",
  splash: "entity.generic.splash",
  pickup: "random.pop",
});

// ---------------------------------------------------------------------------
// §2.2 typeId → カテゴリ (上から順に評価。順序が意味を持つ)
// ---------------------------------------------------------------------------
function bare(typeId) {
  if (typeof typeId !== "string") return "";
  const i = typeId.indexOf(":");
  return i >= 0 ? typeId.slice(i + 1) : typeId;
}

const GRASS_IDS = new Set([
  "grass_block", "dirt", "coarse_dirt", "rooted_dirt", "dirt_with_roots", "podzol", "mycelium", // cycle0659 (a09): dirt_with_roots alias
  "dirt_path", "farmland", "mud", "muddy_mangrove_roots", "clay", "packed_mud",
  "hay_block", "dried_kelp_block", "sponge", "wet_sponge",
  "target", "melon", "pumpkin", "carved_pumpkin", // cycle1543: 草系の実体 (干し草標的・瓜類)
  "grass_path", "melon_block", // cycle0505 (a16): 別名スペル (dirt_path / melon の別表記) が stone へ落ちていた非対称の是正
  "grass", "short_grass", "tall_grass", "fern", "large_fern",
  "tnt", // cycle0537 (a08 N2): 火薬+砂の軟素材が stone へ落ちていた是正
]);
// cycle1133-a11 Tier1+Tier2: 部分一致を廃し完全一致集合へ狭小化。
// lantern/chain の部分一致が sea_lantern/jack_o_lantern/chain_command_block を誤爆していた。
// 旧部分一致で偶然 metal だった raw_*/anvil派生/大釜中身入りは明示固定してから狭める (順序厳守)。
const METAL_IDS = new Set([
  "iron_block", "gold_block", "iron_door", "iron_trapdoor", "anvil",
  "chipped_anvil", "damaged_anvil",
  "cauldron", "water_cauldron", "lava_cauldron", "powder_snow_cauldron", "hopper",
  "chain", "iron_chain", "lantern", "soul_lantern",
  "raw_iron_block", "raw_gold_block",
  // Tier2: 金属だが拾われていなかったもの
  "iron_bars", "bell", "heavy_weighted_pressure_plate", "light_weighted_pressure_plate",
  "heavy_core", "vault", "trial_spawner", "crafter", "brewing_stand", "tripwire_hook", // cycle1543: 金属筐体・スタンド・仕掛け
  "iron_golem_statue", // cycle2058 (a13): copper_golem_statue→copper との非対称解消 (stone 落下だった1形)
  "ominous_vault", "ominous_trial_spawner", // cycle0252: 基礎形 vault/trial_spawner と同素材 (不吉変種の非対称解消)
  "mob_spawner", "spawner", // cycle0740 (a12): 試練系は metal なのに通常スポナーだけ未収載だった非対称を是正
]);
// Tier2: ガラス音グループだが "glass" を含まない発光系 (sea_lantern は Tier1 とセット)
const GLASSLIKE_IDS = new Set(["glowstone", "redstone_lamp", "lit_redstone_lamp", "sea_lantern", "beacon"]); // cycle1543: beacon を追加 / cycle0252: lit_redstone_lamp は基礎形と同素材
// POLISH-SND-AMETHYST-01 (cycle0606): アメジスト系は専用カテゴリ (完全一致のみ、将来IDを巻き込まない)
const AMETHYST_IDS = new Set(["amethyst_block", "budding_amethyst", "amethyst_cluster", "large_amethyst_bud", "medium_amethyst_bud", "small_amethyst_bud"]);

// cycle0922 (a05): 植物集合。作物茎・コケ絨毯もここで grass に確定させ、_stem/_carpet の先取り誤分類を解消する
const PLANT_IDS = new Set([
  "reeds", "kelp_plant", "tall_seagrass", "azalea_leaves_flowered", // cycle0522 (a13): 植物別名の grass 是正
  "poppy", "dandelion", "red_tulip", "orange_tulip", "white_tulip", "pink_tulip",
  "blue_orchid", "allium", "azure_bluet", "oxeye_daisy", "cornflower", "lily_of_the_valley", "wither_rose",
  "sunflower", "lilac", "rose_bush", "peony", "pink_petals", "wildflowers", "leaf_litter", "spore_blossom",
  "azalea", "flowering_azalea", "moss_block", "pale_moss_block", "pale_hanging_moss", "moss_carpet", "pale_moss_carpet",
  "vine", "glow_lichen", "hanging_roots", "big_dripleaf", "small_dripleaf", "big_dripleaf_stem", // cycle0537 (a08 N4): 茎だけ stem へ漏れていた是正
  "kelp", "seagrass", "lily_pad", "sea_pickle", "sugar_cane", "cactus",
  "nether_sprouts", "warped_roots", "crimson_roots", "nether_wart",
  "wheat", "carrots", "potatoes", "beetroot", "cocoa", "sweet_berry_bush", "chorus_plant",
  "dead_bush", "bush", "firefly_bush", "short_dry_grass", "tall_dry_grass",
  "deadbush", "waterlily", // cycle0505 (a16): 別名スペル (dead_bush / lily_pad の別表記) の非対称是正
  "mangrove_propagule", "mangrove_roots", "red_mushroom_block", "brown_mushroom_block",
  "melon_stem", "pumpkin_stem", "attached_melon_stem", "attached_pumpkin_stem", "mushroom_stem",
  "eyeblossom", "open_eyeblossom", "closed_eyeblossom", "pitcher_plant", "torchflower_pod", "small_dripleaf_stem", // cycle0740 (a12): big_dripleaf_stem と同形に揃える // cycle0628 (a09 N1): 素形だけ stone へ落ちていた非対称を是正
  "torchflower", "torchflower_crop", "pitcher_pod", "pitcher_crop",
]);
// cycle0922 (a05): 木製家具・設備
const WOODWORK_IDS = new Set([
  "chest", "trapped_chest", "barrel", "bookshelf", "chiseled_bookshelf", "crafting_table",
  "cartography_table", "fletching_table", "loom", "lectern", "note_block", "jukebox",
  "composter", "ladder", "campfire", "soul_campfire", "beehive", "bee_nest", "scaffolding", "creaking_heart",
  "sign", "wall_sign", "hanging_sign", "wall_hanging_sign", "standing_sign", "wooden_button", "wooden_pressure_plate", "shelf", "wooden_slab", // cycle0740 (a12): standing_sign のみ欠落していた // cycle0522 (a13): 無樹種・旧式形の wood 是正
  "torch", "wall_torch", "soul_torch", "soul_wall_torch", "redstone_torch", "redstone_wall_torch", "unlit_redstone_torch", // cycle0606 (a10): 松明系が stone へ落ちていた誤分類を wood へ是正 / cycle0628 (a09 N2): unlit 形の非対称を是正
  "armor_stand", "item_frame", "glow_item_frame", "smithing_table", "jack_o_lantern", "lit_pumpkin", // cycle0659 (a09): lit_pumpkin only fell to stone vs jack_o_lantern wood
]);
// cycle0922 (a05): 樹種×部品の直積 (素朴なサフィックス追加は stone_stairs を巻き込むため直積必須)
const WOOD_SPECIES = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "bamboo", "poplar"]; // cycle0740 (a12): poplar 部品だけ直積から漏れていた
const NETHER_SPECIES = ["crimson", "warped"];
const WOOD_PARTS = ["_stairs", "_slab", "_double_slab", "_sign", "_standing_sign", "_hanging_sign", "_wall_sign", "_wall_hanging_sign", "_button", "_pressure_plate", "_fence_gate", "_door", "_trapdoor", "_fence", "_shelf"]; // cycle0522 (a13): *_standing_sign / *_double_slab の直積漏れ是正 (petrified_oak_slab は stone のまま=負ガード) // POLISH-SND-CLASS-SHELF-01 (cycle0224): 木製棚 *_shelf を wood へ (crimson/warped は stem 判定が先行)
const speciesPart = (species, id) => species.some((s) => WOOD_PARTS.some((p) => id === s + p));

export function materialOfTypeId(typeId) {
  const id = bare(typeId);
  if (!id || id === "air") return null;                                   // 1: 無音
  if (id === "water" || id === "flowing_water" || id === "lava" || id === "flowing_lava") return null; // 2: 液体そのもののみ無音 (a11 狭小化: water_cauldron 等を無音化しない)
  if (id === "web" || id === "cobweb" || id === "fire" || id === "soul_fire" || id === "portal" || id === "end_portal" || id === "end_gateway" || id === "bubble_column" || id === "structure_void") return null; // 2b (cycle0537 a08 N1): 無音であるべき形が stone へ落ちていた是正 (完全一致のみ)
  if (id.includes("glass")) return "glass";                               // 3
  if (GLASSLIKE_IDS.has(id)) return "glass";                              // 3b (a11): 発光ガラス系
  if (id === "azalea_leaves" || id === "flowering_azalea_leaves") return "azalea_leaves"; // 3c (cycle1532): ツツジの葉だけ専用音 (完全一致のみ。azalea_leaves_flowered は PLANT 側の grass を維持)
  if (id === "cherry_leaves") return "cherry_leaves"; // 3d (cyc1810): 桜の葉だけ専用音 (完全一致のみ。includes("cherry") は桜木材を巻き込むため不採用)
  if (id === "sculk") return "sculk"; // 3e (cyc1924): スカルク本体だけ専用音 (完全一致のみ。sculk_vein 等の族は別素材のため巻き込まない)
  if (id.endsWith("_leaves") || id === "leaves" || id === "leaves2") return "grass"; // 4: 葉は草系 (cycle0832 a11 A1: レガシー素形 leaves/leaves2 も同素材)
  if (GRASS_IDS.has(id)) return "grass";                                 // 5: 土は grass グループ
  if (id === "moss_block" || id === "moss_carpet") return "moss"; // cycle1058 R2: PLANT_IDS (5b) より前に完全一致で抜く (pale_moss 系は巻き込まない)
  if (id === "nether_sprouts") return "nether_sprouts"; // cycle1434: PLANT_IDS (5b) より前に完全一致で抜く (warped_roots 等は grass のまま)
  // 5b (cycle0922): 植物は grass。flower_pot は土器なので _flower の対象外に明示する
  if (id !== "flower_pot" && (PLANT_IDS.has(id) || id === "sapling" || id === "flower" || id === "tallgrass" || id === "mushroom" || id.endsWith("_sapling") || id.endsWith("_flower") || id.endsWith("_mushroom"))) return "grass"; // cycle0832 a11 A1: レガシー素形 sapling/flower/tallgrass/mushroom
  if (id === "sand" || id === "red_sand" || id === "suspicious_sand"
      || id === "concrete_powder" || id.endsWith("_concrete_powder")) return "sand";   // 6 (+a11 powder。硬化 *_concrete は stone のまま)
  if (id === "gravel" || id === "suspicious_gravel") return "gravel";     // 7
  if (id === "powder_snow") return "powder_snow";                         // 8
  if (id === "snow" || id === "snow_layer" || id === "snow_block" || id === "top_snow") return "snow"; // 9 (cycle0446: snow_block/top_snow が stone へ落ちていた誤分類を是正)
  if (id === "cake" || id === "candle_cake" || id.endsWith("_candle_cake")) return "cloth"; // cycle1134: ケーキ形は cloth のまま (ろうそく単体は candle へ分離)
  if (id === "candle" || id.endsWith("_candle")) return "candle"; // cycle1134: ろうそく17形は専用 dig.candle/hit.candle
  if (id.endsWith("_wool") || id.endsWith("_carpet")
      || id.endsWith("_bed") || id.endsWith("_banner") || id === "banner"
      || id === "bed" || id === "carpet" || id === "wool") return "cloth"; // 10 (+a11 bed/banner 全色 / cycle0553: 素の banner / cycle0721: 素の bed/carpet/wool)
  if (id === "netherite_block") return "netherite";                      // 11a (cycle1303): 完全一致のみ。ancient_debris は巻き込まない
  if (id === "ice" || id === "packed_ice" || id === "blue_ice" || id === "frosted_ice") return "ice"; // 11b (cycle1322): 完全一致集合のみ (includes("ice") は将来の無関係 ID を巻き込むため不採用)
  if (id.includes("vines")) return "vines";                               // 11c (cycle1322): 複数形のみ。単数 vine は grass のまま (PLANT 側に "vines" を含む ID は無い)
  if (id.includes("coral")) return "coral";                               // 11d (cycle1322): 生死・形状の全数形を拾う (copper の後・既定の前)
  if (AMETHYST_IDS.has(id)) return "amethyst"; // cycle0606: 専用カテゴリ (stone 既定より前)
  if (id === "shroomlight") return "shroomlight"; // cycle0936: 完全一致のみ
  if (id === "froglight" || id.endsWith("_froglight")) return "froglight"; // cycle1215: froglight 3形+素形を専用カテゴリへ (従来は stone 落ち)
  if (id === "honey_block") return "honey_block"; // cycle0955 R1: 完全一致のみ
  if (id === "lodestone") return "lodestone"; // cycle0955 R1: 完全一致のみ
  if (id === "bone_block") return "bone_block"; // cyc1743 BONEBLOCK-01: 完全一致のみ
  if (id === "tuff") return "tuff"; // cyc2221 TUFF-01: 完全一致のみ (polished_tuff 等の加工変種は stone のまま)
  if (id === "calcite") return "calcite"; // cyc2232 CALCITE-01: 完全一致のみ
  if (id === "basalt" || id === "smooth_basalt") return "basalt"; // cycle1514 BASALT-01: 完全一致2形のみ (polished_basalt は裏取り未実施のため stone のまま)
  if (id === "deepslate_bricks" || id === "cracked_deepslate_bricks" || id === "deepslate_tiles" || id === "cracked_deepslate_tiles") return "deepslate_bricks"; // cycle1256 bricks 2 forms + cycle1455 POLISH-SND-CLASS-DEEPSLATE-TILES-01: tiles 2 forms verified against Bedrock sounds (tiles use the deepslate_bricks sound set); derived slab/stairs/wall forms stay excluded
  if (id === "deepslate_copper_ore") return "deepslate"; // cycle2117: 母岩優先 (深層岩鉱石は母岩が正、copper includes より前)
  if (id.includes("copper") || id.includes("lightning_rod")) return "copper"; // 11 (+a11 避雷針は銅)
  if (id.includes("deepslate")) return "deepslate";                       // 12: 深層岩鉱石は母岩優先
  if (id === "nether_quartz_ore" || id === "ancient_debris") return "netherrack"; // 12b (cycle1543): 母岩原則 (深層岩鉱石の母岩優先と同型)
  if (id === "nether_gold_ore") return "nether_gold_ore";                 // 13
  if (id === "netherrack") return "netherrack";                           // 14
  if (id.includes("nether_brick")) return "nether_brick";                 // 15
  if (id.includes("nylium")) return "nylium";                             // 16
  if (id === "soul_sand") return "soul_sand";                             // 17
  if (id === "soul_soil") return "soul_soil";                             // 18
  if (id === "crimson_fungus" || id === "warped_fungus") return "fungus"; // cyc2020 FUNGUS-01: 菌本体だけ完全一致で stem より前に抜く (endsWith 流用は将来形を巻き込むため不採用)
  // 19: ネザー木材 (幹・菌類・ネザー木の板材/幹)
  if (id.endsWith("_stem") || id.endsWith("_hyphae") || id.endsWith("_fungus")
      || id === "warped_planks" || id === "crimson_planks"
      || id === "warped_wart_block" || id === "nether_wart_block" || id === "wart_block") return "stem"; // cyc2122: 旧式別名 wart_block も同素材として stem (includes("wart") は作物巻き込みのため不採用)
  // 21 を wood より先に判定する鉄製品 (iron_door 等)。§2.2 順20の「iron でないもの」条件の実装。
  if (METAL_IDS.has(id)) return "metal";                                  // a11: 完全一致のみ
  if (id.includes("rail")) return "metal";                                // 21: rail 系
  // 19b (cycle0922): ネザー樹種×部品は stem (crimson_door 等の wood 不整合も解消)
  if (speciesPart(NETHER_SPECIES, id)) return "stem";
  // 20: 木系
  if (WOODWORK_IDS.has(id) || speciesPart(WOOD_SPECIES, id)
      || id.endsWith("_log") || id.endsWith("_wood") || id.endsWith("_planks") || id === "log" || id === "log2" || id === "planks" || id === "double_wooden_slab" // cycle0832 a11 A1: レガシー素形 log/log2/planks/double_wooden_slab
      || id.includes("bamboo")
      || ((id.includes("door") || id.includes("trapdoor") || id.includes("fence"))
          && !id.includes("iron"))) return "wood";
  return "stone";                                                         // 22: 既定 (通常鉱石含む)
}

// カテゴリ + 種別 → ID。kind: "hit" | "break" | "step" | "place" (place は break を流用)
export function resolveSoundId(category, kind) {
  if (!category) return null;
  const row = SFX_TABLE[category];
  if (!row) return null;
  if (kind === "place") return row.break;
  return row[kind] ?? null;
}

export function soundIdFor(typeId, kind) {
  return resolveSoundId(materialOfTypeId(typeId), kind);
}

// ---------------------------------------------------------------------------
// 再生層 (§5 微ランダム / §4 スロットル)。状態は呼び出し側が持つ (r 集約の作法)。
// ---------------------------------------------------------------------------
export function createSfxState() {
  return { lastHitMs: -Infinity, lastHurtMs: -Infinity, pickupStreak: 0, lastPickupMs: -Infinity };
}

export const HIT_INTERVAL_MS = 250;   // §4(a): 5tick
export const HURT_INTERVAL_MS = 300;  // §4(e): 300ms

// 共通口: 失敗は全て握りつぶし false を返す。rng はテスト注入用。
export function playAt(dim, id, loc, opts = {}, rng = Math.random) {
  if (!dim || typeof dim.playSound !== "function" || !id || !loc) return false;
  try {
    const jitter = opts.jitter !== false;
    const volume = (opts.volume ?? 1.0) * (jitter ? 0.9 + rng() * 0.2 : 1);
    const pitch = (opts.pitch ?? 1.0) * (jitter ? 0.95 + rng() * 0.1 : 1);
    dim.playSound(id, loc, { volume, pitch });
    return true;
  } catch { return false; }
}

export function sfxDigHit(state, dim, loc, typeId, nowMs) {
  if (nowMs - state.lastHitMs < HIT_INTERVAL_MS) return false;
  const ok = playAt(dim, soundIdFor(typeId, "hit"), loc, { volume: 1.0 });
  if (ok) state.lastHitMs = nowMs;
  return ok;
}

export function sfxDigBreak(dim, loc, typeId) {
  const cat = materialOfTypeId(typeId);
  if (cat === "metal") // §3 暫定: hit.iron を volume 1.0 / pitch 0.9 で強めに
    return playAt(dim, SFX_TABLE.metal.break, loc, { volume: 1.0, pitch: 0.9, jitter: false });
  return playAt(dim, resolveSoundId(cat, "break"), loc, { volume: 1.0 });
}

export function sfxPlace(dim, loc, typeId) { // §3: 設置 = dig.<カテゴリ> を volume 0.7
  return playAt(dim, soundIdFor(typeId, "place"), loc, { volume: 0.7 });
}

const STEP_VOLUME = { walk: 0.5, dash: 0.7, fine: 0.3 };
// POLISH-SND-ENV-01 最小形 (cycle1234, a08設計): 足音の媒体係数。媒体はブロック ID
// でなくエンティティ状態から取る汎用概念で、水中だけ鈍くする。未知の媒体・型違いは
// 恒等係数に倒す (例外安全)。音 ID は足元素材の step のまま変えない: splash は
// SWIM-01 が入水/出水の遷移で鳴らす音であり、水中歩行中ずっと鳴らすと意味が衝突する。
export function envStepCoef(medium) {
  if (medium === "water") return { volumeMul: 0.6, pitchMul: 0.8 };
  return { volumeMul: 1.0, pitchMul: 1.0 };
}
export function sfxStep(dim, loc, surfaceTypeId, opts = {}) {
  // 旧 opts.wet (splash 差し替え) は呼び出し側が無く到達不能だったため、媒体係数へ置換
  const medium = opts.medium ?? (opts.wet ? "water" : null);
  const coef = envStepCoef(medium);
  return playAt(dim, soundIdFor(surfaceTypeId, "step"), loc,
    { volume: (STEP_VOLUME[opts.mode] ?? STEP_VOLUME.walk) * coef.volumeMul, pitch: coef.pitchMul });
}

export function sfxLand(dim, loc, surfaceTypeId) {
  return playAt(dim, soundIdFor(surfaceTypeId, "step"), loc, { volume: 1.0, pitch: 0.9, jitter: false });
}

export function sfxSplash(dim, loc) {
  return playAt(dim, GENERIC_IDS.splash, loc, { volume: 1.0 });
}

export function sfxAttack(dim, loc) {
  return playAt(dim, GENERIC_IDS.attack, loc, { volume: 1.0 });
}

export function sfxHurt(state, dim, loc, nowMs) {
  if (nowMs - state.lastHurtMs < HURT_INTERVAL_MS) return false;
  const ok = playAt(dim, GENERIC_IDS.hurt, loc, { volume: 1.0 });
  if (ok) state.lastHurtMs = nowMs;
  return ok;
}

export function sfxEat(dim, loc, itemId) { // POLISH-SND-EAT-01 (cycle0753): 飲食音はアイテム形態別 (a10検証)。医療系は飲食でないため無音、飲み物系は drink、それ以外は eat。候補IDは△のため聞こえは実機確認待ち
  const id = typeof itemId === "string" ? itemId : "";
  if (/(aidkit|bandage|medical|first_aid)/.test(id)) return false;
  const isDrink = /(potion|milk|honey_bottle)/.test(id);
  return playAt(dim, isDrink ? "random.drink" : "random.eat", loc, { volume: 1.0 });
}

export function sfxPickup(state, dim, loc, nowMs) { // §4(f): 連続取得で pitch 上昇 (上限 1.3)
  state.pickupStreak = (nowMs - state.lastPickupMs <= 1000) ? state.pickupStreak + 1 : 0;
  state.lastPickupMs = nowMs;
  const pitch = Math.min(1.0 + state.pickupStreak * 0.05, 1.3);
  return playAt(dim, GENERIC_IDS.pickup, loc, { volume: 1.0, pitch, jitter: false });
}
