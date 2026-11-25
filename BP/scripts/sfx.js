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
  stone:          { hit: "hit.stone",  break: "dig.stone",          step: "step.stone" },        // ✓✓✓
  deepslate:      { hit: "hit.deepslate", break: "dig.deepslate",   step: "step.deepslate" },    // △✓△ (step 無ければ step.stone)
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
});

// §1.2 で実在確認済みの ID (この表が参照する分 + 汎用分)
export const CONFIRMED_IDS = new Set([
  "hit.grass", "hit.stone", "hit.iron",
  "dig.grass", "dig.sand", "dig.gravel", "dig.snow", "dig.powder_snow",
  "dig.cloth", "dig.wood", "dig.stem", "dig.stone", "dig.deepslate",
  "dig.copper", "dig.netherite", "step.netherite", "dig.netherrack", "dig.nether_brick", "dig.nether_gold_ore",
  "dig.nylium", "dig.soul_sand", "dig.soul_soil", "dig.vines", "dig.coral",
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
  "grass_block", "dirt", "coarse_dirt", "rooted_dirt", "podzol", "mycelium",
  "dirt_path", "farmland", "mud", "muddy_mangrove_roots", "clay", "packed_mud",
  "hay_block", "dried_kelp_block", "sponge", "wet_sponge",
  "target", "melon", "pumpkin", "carved_pumpkin", // cycle1543: 草系の実体 (干し草標的・瓜類)
  "grass", "short_grass", "tall_grass", "fern", "large_fern",
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
]);
// Tier2: ガラス音グループだが "glass" を含まない発光系 (sea_lantern は Tier1 とセット)
const GLASSLIKE_IDS = new Set(["glowstone", "redstone_lamp", "sea_lantern", "beacon"]); // cycle1543: beacon を追加

// cycle0922 (a05): 植物集合。作物茎・コケ絨毯もここで grass に確定させ、_stem/_carpet の先取り誤分類を解消する
const PLANT_IDS = new Set([
  "poppy", "dandelion", "red_tulip", "orange_tulip", "white_tulip", "pink_tulip",
  "blue_orchid", "allium", "azure_bluet", "oxeye_daisy", "cornflower", "lily_of_the_valley", "wither_rose",
  "sunflower", "lilac", "rose_bush", "peony", "pink_petals", "wildflowers", "leaf_litter", "spore_blossom",
  "azalea", "flowering_azalea", "moss_block", "pale_moss_block", "pale_hanging_moss", "moss_carpet", "pale_moss_carpet",
  "vine", "glow_lichen", "hanging_roots", "big_dripleaf", "small_dripleaf",
  "kelp", "seagrass", "lily_pad", "sea_pickle", "sugar_cane", "cactus",
  "nether_sprouts", "warped_roots", "crimson_roots", "nether_wart",
  "wheat", "carrots", "potatoes", "beetroot", "cocoa", "sweet_berry_bush", "chorus_plant",
  "dead_bush", "bush", "firefly_bush", "short_dry_grass", "tall_dry_grass",
  "mangrove_propagule", "mangrove_roots", "red_mushroom_block", "brown_mushroom_block",
  "melon_stem", "pumpkin_stem", "attached_melon_stem", "attached_pumpkin_stem", "mushroom_stem",
  "open_eyeblossom", "closed_eyeblossom", "pitcher_plant", "torchflower_pod",
  "torchflower", "torchflower_crop", "pitcher_pod", "pitcher_crop",
]);
// cycle0922 (a05): 木製家具・設備
const WOODWORK_IDS = new Set([
  "chest", "trapped_chest", "barrel", "bookshelf", "chiseled_bookshelf", "crafting_table",
  "cartography_table", "fletching_table", "loom", "lectern", "note_block", "jukebox",
  "composter", "ladder", "campfire", "soul_campfire", "beehive", "bee_nest", "scaffolding", "creaking_heart",
  "armor_stand", "item_frame", "glow_item_frame", "smithing_table", "jack_o_lantern",
]);
// cycle0922 (a05): 樹種×部品の直積 (素朴なサフィックス追加は stone_stairs を巻き込むため直積必須)
const WOOD_SPECIES = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "bamboo"];
const NETHER_SPECIES = ["crimson", "warped"];
const WOOD_PARTS = ["_stairs", "_slab", "_sign", "_hanging_sign", "_wall_sign", "_wall_hanging_sign", "_button", "_pressure_plate", "_fence_gate", "_door", "_trapdoor", "_fence", "_shelf"]; // POLISH-SND-CLASS-SHELF-01 (cycle0224): 木製棚 *_shelf を wood へ (crimson/warped は stem 判定が先行)
const speciesPart = (species, id) => species.some((s) => WOOD_PARTS.some((p) => id === s + p));

export function materialOfTypeId(typeId) {
  const id = bare(typeId);
  if (!id || id === "air") return null;                                   // 1: 無音
  if (id === "water" || id === "flowing_water" || id === "lava" || id === "flowing_lava") return null; // 2: 液体そのもののみ無音 (a11 狭小化: water_cauldron 等を無音化しない)
  if (id.includes("glass")) return "glass";                               // 3
  if (GLASSLIKE_IDS.has(id)) return "glass";                              // 3b (a11): 発光ガラス系
  if (id.endsWith("_leaves")) return "grass";                             // 4: 葉は草系
  if (GRASS_IDS.has(id)) return "grass";                                 // 5: 土は grass グループ
  // 5b (cycle0922): 植物は grass。flower_pot は土器なので _flower の対象外に明示する
  if (id !== "flower_pot" && (PLANT_IDS.has(id) || id.endsWith("_sapling") || id.endsWith("_flower") || id.endsWith("_mushroom"))) return "grass";
  if (id === "sand" || id === "red_sand" || id === "suspicious_sand"
      || id === "concrete_powder" || id.endsWith("_concrete_powder")) return "sand";   // 6 (+a11 powder。硬化 *_concrete は stone のまま)
  if (id === "gravel" || id === "suspicious_gravel") return "gravel";     // 7
  if (id === "powder_snow") return "powder_snow";                         // 8
  if (id === "snow" || id === "snow_layer") return "snow";                // 9
  if (id.endsWith("_wool") || id.endsWith("_carpet")
      || id.endsWith("_bed") || id.endsWith("_banner")) return "cloth";   // 10 (+a11 bed/banner 全色)
  if (id === "netherite_block") return "netherite";                      // 11a (cycle1303): 完全一致のみ。ancient_debris は巻き込まない
  if (id === "ice" || id === "packed_ice" || id === "blue_ice" || id === "frosted_ice") return "ice"; // 11b (cycle1322): 完全一致集合のみ (includes("ice") は将来の無関係 ID を巻き込むため不採用)
  if (id.includes("vines")) return "vines";                               // 11c (cycle1322): 複数形のみ。単数 vine は grass のまま (PLANT 側に "vines" を含む ID は無い)
  if (id.includes("coral")) return "coral";                               // 11d (cycle1322): 生死・形状の全数形を拾う (copper の後・既定の前)
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
  // 19: ネザー木材 (幹・菌類・ネザー木の板材/幹)
  if (id.endsWith("_stem") || id.endsWith("_hyphae") || id.endsWith("_fungus")
      || id === "warped_planks" || id === "crimson_planks"
      || id === "warped_wart_block" || id === "nether_wart_block") return "stem";
  // 21 を wood より先に判定する鉄製品 (iron_door 等)。§2.2 順20の「iron でないもの」条件の実装。
  if (METAL_IDS.has(id)) return "metal";                                  // a11: 完全一致のみ
  if (id.includes("rail")) return "metal";                                // 21: rail 系
  // 19b (cycle0922): ネザー樹種×部品は stem (crimson_door 等の wood 不整合も解消)
  if (speciesPart(NETHER_SPECIES, id)) return "stem";
  // 20: 木系
  if (WOODWORK_IDS.has(id) || speciesPart(WOOD_SPECIES, id)
      || id.endsWith("_log") || id.endsWith("_wood") || id.endsWith("_planks")
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
