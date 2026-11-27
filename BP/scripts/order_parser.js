// リゼ (LIZE-07) 指示パーサ — 主人のチャット指示を「注文オブジェクト」に変換する
// 純粋JS。@minecraft/server には依存しない。統合時は BP/scripts/ へコピーして使う想定。
//
// 位置づけ:
//   チャット反応層（chat_responses 等）が拾う前に、まず本パーサに通す。
//   parseOrder が注文を返したら実行層（プランナー/実行部）が注文として処理し、
//   null を返したら「指示ではない通常の雑談」として既存のチャット反応に譲る。
//   ※ 口調・セリフは扱わない。パースのみ。
//
// 文法（キーワード方式）:
//   制約句（無視して/倒しながら/逃げて…）を先に抽出して文面から除去し、
//   残りを句（、。で分割）ごとに「対象＋数量＋動詞」で読み、
//   主目的1件＋寄り道（sideTasks）最大2件に分解する。
//   素材名は最長一致で照合する（鉄鉱石 > 鉄、ダイヤのピッケル > ダイヤ 等）。

import { amount_parse, stackSizeOfItem } from "./amount_math.js"; // 0-C5 (cycle1256): 数量解釈の純粋核

// ---------------------------------------------------------------- 素材辞書
// [id, type('item'|'block'), 表示名, 別名[]] 。別名は最長一致で照合される。
const MATERIAL_DEFS = [
  // 鉱物・金属
  ["diamond", "item", "ダイヤモンド", ["ダイヤモンド", "ダイヤ"]],
  ["diamond_ore", "block", "ダイヤモンド鉱石", ["ダイヤモンド鉱石", "ダイヤ鉱石"]],
  ["iron_ingot", "item", "鉄インゴット", ["鉄インゴット", "鉄"]],
  ["iron_ore", "block", "鉄鉱石", ["鉄鉱石"]],
  ["raw_iron", "item", "鉄の原石", ["鉄の原石"]],
  ["gold_ingot", "item", "金インゴット", ["金インゴット", "金"]],
  ["gold_ore", "block", "金鉱石", ["金鉱石"]],
  ["raw_gold", "item", "金の原石", ["金の原石"]],
  ["copper_ingot", "item", "銅インゴット", ["銅インゴット", "銅"]],
  ["copper_ore", "block", "銅鉱石", ["銅鉱石"]],
  ["raw_copper", "item", "銅の原石", ["銅の原石"]],
  ["coal", "item", "石炭", ["石炭"]],
  ["coal_ore", "block", "石炭鉱石", ["石炭鉱石"]],
  ["redstone", "item", "レッドストーン", ["レッドストーン"]],
  ["lapis_lazuli", "item", "ラピスラズリ", ["ラピスラズリ", "ラピス"]],
  ["emerald", "item", "エメラルド", ["エメラルド"]],
  ["emerald_ore", "block", "エメラルド鉱石", ["エメラルド鉱石"]],
  ["netherite_ingot", "item", "ネザライトインゴット", ["ネザライトインゴット", "ネザライト"]],
  ["netherite_scrap", "item", "ネザライトの欠片", ["ネザライトの欠片"]],
  ["ancient_debris", "block", "古代の残骸", ["古代の残骸", "残骸"]],
  ["quartz", "item", "ネザークォーツ", ["ネザークォーツ", "クォーツ", "石英"]],
  ["amethyst_shard", "item", "アメジストの欠片", ["アメジストの欠片", "アメジスト"]],
  ["obsidian", "block", "黒曜石", ["黒曜石"]],
  ["glowstone", "block", "グロウストーン", ["グロウストーン"]],
  ["glowstone_dust", "item", "グロウストーンダスト", ["グロウストーンダスト"]],
  // 木材
  ["log", "block", "原木", ["原木", "木"]],
  ["oak_log", "block", "オークの原木", ["オークの原木", "オーク原木"]],
  ["spruce_log", "block", "トウヒの原木", ["トウヒの原木", "トウヒ原木"]],
  ["birch_log", "block", "シラカバの原木", ["シラカバの原木", "シラカバ原木"]],
  ["jungle_log", "block", "ジャングルの原木", ["ジャングルの原木"]],
  ["acacia_log", "block", "アカシアの原木", ["アカシアの原木"]],
  ["dark_oak_log", "block", "ダークオークの原木", ["ダークオークの原木"]],
  ["cherry_log", "block", "サクラの原木", ["サクラの原木", "桜の原木"]],
  ["mangrove_log", "block", "マングローブの原木", ["マングローブの原木"]],
  ["oak_planks", "block", "板材", ["オークの板材", "板材", "木の板"]],
  ["stick", "item", "棒", ["棒"]],
  // 石・土・砂
  ["cobblestone", "block", "丸石", ["丸石"]],
  ["stone", "block", "石", ["石"]],
  ["deepslate", "block", "深層岩", ["深層岩"]],
  ["cobbled_deepslate", "block", "丸石深層岩", ["丸石深層岩", "深層丸石"]],
  ["granite", "block", "花崗岩", ["花崗岩"]],
  ["diorite", "block", "閃緑岩", ["閃緑岩"]],
  ["andesite", "block", "安山岩", ["安山岩"]],
  ["tuff", "block", "凝灰岩", ["凝灰岩"]],
  ["sand", "block", "砂", ["砂"]],
  ["gravel", "block", "砂利", ["砂利"]],
  ["dirt", "block", "土", ["土"]],
  ["clay_ball", "item", "粘土", ["粘土"]],
  ["glass", "block", "ガラス", ["ガラス"]],
  ["bricks", "block", "レンガ", ["レンガブロック", "レンガ", "煉瓦"]],
  ["netherrack", "block", "ネザーラック", ["ネザーラック"]],
  ["soul_sand", "block", "ソウルサンド", ["ソウルサンド"]],
  ["end_stone", "block", "エンドストーン", ["エンドストーン"]],
  ["basalt", "block", "玄武岩", ["玄武岩"]],
  ["blackstone", "block", "ブラックストーン", ["ブラックストーン"]],
  ["flint", "item", "火打石", ["火打石"]],
  ["ice", "block", "氷", ["氷"]],
  ["snowball", "item", "雪玉", ["雪玉"]],
  // モブドロップ・その他素材
  ["wool", "block", "羊毛", ["羊毛", "ウール", "羊の毛"]],
  ["leather", "item", "革", ["革", "レザー"]],
  ["string", "item", "糸", ["糸"]],
  ["feather", "item", "羽根", ["羽根", "羽"]],
  ["bone", "item", "骨", ["骨"]],
  ["gunpowder", "item", "火薬", ["火薬"]],
  ["ender_pearl", "item", "エンダーパール", ["エンダーパール", "パール"]],
  ["blaze_rod", "item", "ブレイズロッド", ["ブレイズロッド"]],
  ["ghast_tear", "item", "ガストの涙", ["ガストの涙"]],
  ["slime_ball", "item", "スライムボール", ["スライムボール"]],
  ["spider_eye", "item", "クモの目", ["クモの目", "蜘蛛の目"]],
  ["rotten_flesh", "item", "腐った肉", ["腐った肉"]],
  ["phantom_membrane", "item", "ファントムの皮膜", ["ファントムの皮膜"]],
  ["shulker_shell", "item", "シュルカーの殻", ["シュルカーの殻"]],
  ["nautilus_shell", "item", "オウムガイの殻", ["オウムガイの殻"]],
  ["heart_of_the_sea", "item", "海洋の心", ["海洋の心"]],
  ["nether_star", "item", "ネザースター", ["ネザースター"]],
  ["totem_of_undying", "item", "不死のトーテム", ["不死のトーテム", "トーテム"]],
  ["paper", "item", "紙", ["紙"]],
  ["book", "item", "本", ["本"]],
  ["sugar_cane", "block", "サトウキビ", ["サトウキビ"]],
  ["short_grass", "block", "草", ["草", "雑草"]],
  ["bamboo", "block", "竹", ["竹"]],
  ["kelp", "item", "昆布", ["昆布"]],
  ["sponge", "block", "スポンジ", ["スポンジ", "海綿"]],
  ["prismarine_shard", "item", "プリズマリンの欠片", ["プリズマリンの欠片"]],
  ["ink_sac", "item", "イカスミ", ["イカスミ", "墨袋"]],
  ["cocoa_beans", "item", "カカオ豆", ["カカオ豆"]],
  ["name_tag", "item", "名札", ["名札"]],
  ["saddle", "item", "鞍", ["鞍", "サドル"]],
  // 食料
  ["wheat", "item", "小麦", ["小麦"]],
  ["carrot", "item", "ニンジン", ["にんじん", "ニンジン", "人参"]],
  ["potato", "item", "ジャガイモ", ["じゃがいも", "ジャガイモ"]],
  ["pumpkin", "block", "カボチャ", ["かぼちゃ", "カボチャ"]],
  ["melon_slice", "item", "スイカ", ["スイカ"]],
  ["apple", "item", "リンゴ", ["りんご", "リンゴ", "林檎"]],
  ["golden_apple", "item", "金のリンゴ", ["金のりんご", "金のリンゴ", "金りんご", "金リンゴ"]],
  ["beef", "item", "牛肉", ["牛肉"]],
  ["porkchop", "item", "豚肉", ["豚肉"]],
  ["chicken", "item", "鶏肉", ["鶏肉"]],
  ["mutton", "item", "羊肉", ["羊肉"]],
  ["egg", "item", "卵", ["卵"]],
  ["milk_bucket", "item", "牛乳", ["牛乳", "ミルク"]],
  ["bread", "item", "パン", ["パン"]],
  ["honey_bottle", "item", "ハチミツ", ["ハチミツ", "蜂蜜", "はちみつ"]],
  // 道具・設備（作る系の対象）
  ["torch", "block", "松明", ["松明", "たいまつ"]],
  ["crafting_table", "block", "作業台", ["作業台"]],
  ["furnace", "block", "かまど", ["かまど", "竈"]],
  ["chest", "block", "チェスト", ["チェスト"]],
  ["white_bed", "block", "ベッド", ["ベッド"]],
  ["water_bucket", "item", "水入りバケツ", ["水入りバケツ", "水バケツ", "水のバケツ"]],
  ["lava_bucket", "item", "溶岩バケツ", ["溶岩バケツ", "溶岩入りバケツ", "マグマバケツ"]],
  ["bucket", "item", "バケツ", ["バケツ"]],
  ["oak_sign", "block", "看板", ["看板", "サイン"]],
  // v0.4.67: 道具 (木・石・鉄・ダイヤ × ツルハシ・斧・シャベル・剣)。以前は「ピッケル」表記の鉄/ダイヤしか無く、
  // 「石のツルハシ」が「石」と読まれていた
  ["wooden_pickaxe", "item", "木のツルハシ", ["木のツルハシ", "木のつるはし", "木のピッケル"]],
  ["wooden_axe", "item", "木の斧", ["木の斧", "木のオノ", "木のおの"]],
  ["wooden_shovel", "item", "木のシャベル", ["木のシャベル", "木のスコップ"]],
  ["wooden_sword", "item", "木の剣", ["木の剣", "木のソード"]],
  ["stone_pickaxe", "item", "石のツルハシ", ["石のツルハシ", "石のつるはし", "石のピッケル"]],
  ["stone_axe", "item", "石の斧", ["石の斧", "石のオノ", "石のおの"]],
  ["stone_shovel", "item", "石のシャベル", ["石のシャベル", "石のスコップ"]],
  ["stone_sword", "item", "石の剣", ["石の剣", "石のソード"]],
  ["iron_pickaxe", "item", "鉄のツルハシ", ["鉄のツルハシ", "鉄のつるはし", "鉄のピッケル", "鉄のピケル"]],
  ["iron_axe", "item", "鉄の斧", ["鉄の斧", "鉄のオノ", "鉄のおの"]],
  ["iron_shovel", "item", "鉄のシャベル", ["鉄のシャベル", "鉄のスコップ"]],
  ["iron_sword", "item", "鉄の剣", ["鉄の剣", "鉄のソード"]],
  ["diamond_pickaxe", "item", "ダイヤのツルハシ", ["ダイヤのツルハシ", "ダイヤのつるはし", "ダイヤのピッケル", "ダイヤモンドのツルハシ", "ダイヤモンドのつるはし", "ダイヤモンドのピッケル"]],
  ["diamond_axe", "item", "ダイヤの斧", ["ダイヤの斧", "ダイヤのオノ", "ダイヤのおの", "ダイヤモンドの斧", "ダイヤモンドのオノ", "ダイヤモンドのおの"]],
  ["diamond_shovel", "item", "ダイヤのシャベル", ["ダイヤのシャベル", "ダイヤのスコップ", "ダイヤモンドのシャベル", "ダイヤモンドのスコップ"]],
  ["diamond_sword", "item", "ダイヤの剣", ["ダイヤの剣", "ダイヤのソード", "ダイヤモンドの剣", "ダイヤモンドのソード"]],
  // 0-F1 (cyc2003): 防具の素材×部位合成。道具だけ辞書にあり防具が無く、「ダイヤのチェストプレート」が
  // 素材そのもの (diamond) ＋副目標チェストへ誤分解していた非対称を是正する。
  ["leather_helmet", "item", "革のヘルメット", ['革のヘルメット', '革の兜', '革のかぶと', 'レザーのヘルメット', 'レザーの兜', 'レザーのかぶと']],
  ["leather_chestplate", "item", "革のチェストプレート", ['革のチェストプレート', '革の胸当て', 'レザーのチェストプレート', 'レザーの胸当て']],
  ["leather_leggings", "item", "革のレギンス", ['革のレギンス', '革のズボン', 'レザーのレギンス', 'レザーのズボン']],
  ["leather_boots", "item", "革のブーツ", ['革のブーツ', '革の靴', 'レザーのブーツ', 'レザーの靴']],
  ["golden_helmet", "item", "金のヘルメット", ['金のヘルメット', '金の兜', '金のかぶと', 'ゴールドのヘルメット', 'ゴールドの兜', 'ゴールドのかぶと']],
  ["golden_chestplate", "item", "金のチェストプレート", ['金のチェストプレート', '金の胸当て', 'ゴールドのチェストプレート', 'ゴールドの胸当て']],
  ["golden_leggings", "item", "金のレギンス", ['金のレギンス', '金のズボン', 'ゴールドのレギンス', 'ゴールドのズボン']],
  ["golden_boots", "item", "金のブーツ", ['金のブーツ', '金の靴', 'ゴールドのブーツ', 'ゴールドの靴']],
  ["iron_helmet", "item", "鉄のヘルメット", ['鉄のヘルメット', '鉄の兜', '鉄のかぶと']],
  ["iron_chestplate", "item", "鉄のチェストプレート", ['鉄のチェストプレート', '鉄の胸当て']],
  ["iron_leggings", "item", "鉄のレギンス", ['鉄のレギンス', '鉄のズボン']],
  ["iron_boots", "item", "鉄のブーツ", ['鉄のブーツ', '鉄の靴']],
  ["diamond_helmet", "item", "ダイヤのヘルメット", ['ダイヤのヘルメット', 'ダイヤの兜', 'ダイヤのかぶと', 'ダイヤモンドのヘルメット', 'ダイヤモンドの兜', 'ダイヤモンドのかぶと']],
  ["diamond_chestplate", "item", "ダイヤのチェストプレート", ['ダイヤのチェストプレート', 'ダイヤの胸当て', 'ダイヤモンドのチェストプレート', 'ダイヤモンドの胸当て']],
  ["diamond_leggings", "item", "ダイヤのレギンス", ['ダイヤのレギンス', 'ダイヤのズボン', 'ダイヤモンドのレギンス', 'ダイヤモンドのズボン']],
  ["diamond_boots", "item", "ダイヤのブーツ", ['ダイヤのブーツ', 'ダイヤの靴', 'ダイヤモンドのブーツ', 'ダイヤモンドの靴']],
  ["bow", "item", "弓", ["弓"]],
  ["crossbow", "item", "クロスボウ", ["クロスボウ"]],
  ["trident", "item", "トライデント", ["トライデント"]],
  ["arrow", "item", "矢", ["矢"]],
  ["shield", "item", "盾", ["盾"]],
  ["fishing_rod", "item", "釣竿", ["釣竿", "釣り竿"]],
  ["shears", "item", "ハサミ", ["ハサミ", "はさみ"]],
  ["compass", "item", "コンパス", ["コンパス"]],
  ["clock", "item", "時計", ["時計"]],
  ["bookshelf", "block", "本棚", ["本棚"]],
  ["enchanting_table", "block", "エンチャントテーブル", ["エンチャントテーブル"]],
  ["anvil", "block", "金床", ["金床"]],
  ["tnt", "block", "TNT", ["TNT", "ティーエヌティー"]],
  ["redstone_torch", "block", "レッドストーントーチ", ["レッドストーントーチ"]],
  ["lever", "block", "レバー", ["レバー"]],
  ["rail", "block", "レール", ["レール"]],
  ["minecart", "item", "トロッコ", ["トロッコ"]],
  ["oak_boat", "item", "ボート", ["ボート"]],
  ["oak_door", "block", "ドア", ["ドア", "扉"]],
];

// ---------------------------------------------------------------- エンティティ辞書
// [id, 表示名, 別名[]] 。'hostile' は「敵/モンスター」等の総称（制約 or 一括討伐の対象）。
const ENTITY_DEFS = [
  ["hostile", "敵", ["敵", "モンスター", "モブ"]],
  ["zombie", "ゾンビ", ["ゾンビ"]],
  ["skeleton", "スケルトン", ["スケルトン"]],
  ["spider", "クモ", ["クモ", "蜘蛛"]],
  ["cave_spider", "洞窟グモ", ["洞窟グモ", "洞窟蜘蛛"]],
  ["creeper", "クリーパー", ["クリーパー"]],
  ["enderman", "エンダーマン", ["エンダーマン"]],
  ["slime", "スライム", ["スライム"]],
  ["witch", "ウィッチ", ["ウィッチ", "魔女"]],
  ["drowned", "ドラウンド", ["ドラウンド", "溺死ゾンビ"]],
  ["husk", "ハスク", ["ハスク"]],
  ["stray", "ストレイ", ["ストレイ"]],
  ["phantom", "ファントム", ["ファントム"]],
  ["pillager", "ピリジャー", ["ピリジャー"]],
  ["blaze", "ブレイズ", ["ブレイズ"]],
  ["magma_cube", "マグマキューブ", ["マグマキューブ"]],
  ["ghast", "ガスト", ["ガスト"]],
  ["piglin", "ピグリン", ["ピグリン"]],
  ["hoglin", "ホグリン", ["ホグリン"]],
  ["wither_skeleton", "ウィザースケルトン", ["ウィザースケルトン"]],
  ["endermite", "エンダーマイト", ["エンダーマイト"]],
  ["silverfish", "シルバーフィッシュ", ["シルバーフィッシュ"]],
  ["sheep", "羊", ["羊", "ヒツジ"]],
  ["cow", "牛", ["牛"]],
  ["pig", "豚", ["豚", "ブタ"]],
  ["chicken_mob", "鶏", ["鶏", "ニワトリ"]],
  ["rabbit", "ウサギ", ["ウサギ", "うさぎ"]],
  ["squid", "イカ", ["イカ"]],
  ["cod", "タラ", ["タラ"]],
  ["salmon", "サケ", ["サケ", "鮭"]],
  ["villager", "村人", ["村人"]],
  ["iron_golem", "アイアンゴーレム", ["アイアンゴーレム", "ゴーレム"]],
  ["wolf", "オオカミ", ["オオカミ", "狼"]],
  ["cat", "猫", ["猫"]],
  ["horse", "馬", ["馬"]],
];

// 建築物（id を持たない名前だけの build 対象）。誤検出防止のため、
// build 動詞のある句か「〜を」に続く場合だけ採用する（parseClause 側で判定）。
const STRUCTURE_DEFS = [
  ["拠点", ["拠点", "基地"]],
  ["家", ["家", "おうち", "マイホーム"]],
  ["倉庫", ["倉庫"]],
  ["畑", ["畑", "農場"]],
  ["塔", ["塔", "タワー"]],
  ["橋", ["橋"]],
  ["部屋", ["部屋"]],
  ["城", ["城", "お城"]],
  ["壁", ["壁"]],
];

// ---------------------------------------------------------------- 辞書の索引化
// 全別名を「長い順」に並べ、左から貪欲に最長一致させる。
function buildIndex(defs, kind) {
  const list = [];
  for (const def of defs) {
    const aliases = kind === "structure" ? def[1] : def[3] ?? def[2];
    for (const alias of aliases) list.push({ alias, def, kind });
  }
  list.sort((a, b) => b.alias.length - a.alias.length);
  return list;
}
const MATERIAL_INDEX = buildIndex(MATERIAL_DEFS, "material");
const ENTITY_INDEX = buildIndex(ENTITY_DEFS, "entity");
const STRUCTURE_INDEX = buildIndex(STRUCTURE_DEFS, "structure");

function targetOf(hit) {
  if (hit.kind === "material") {
    const [id, type, name] = hit.def;
    return type === "block"
      ? { item: null, block: id, entity: null, name }
      : { item: id, block: null, entity: null, name };
  }
  if (hit.kind === "entity") {
    const [id, name] = hit.def;
    return { item: null, block: null, entity: id, name };
  }
  return { item: null, block: null, entity: null, name: hit.def[0] }; // structure
}

// テキストを左から走査し、辞書への最長一致メンションを返す（重なりなし）。
// indexes: 照合する索引の配列（優先順に適用され、先に確保した範囲は後から侵食されない）
function scanMentions(text, indexes) {
  const taken = new Array(text.length).fill(false);
  const hits = [];
  for (const index of indexes) {
    for (let i = 0; i < text.length; i++) {
      if (taken[i]) continue;
      for (const cand of index) {
        const a = cand.alias;
        if (a.length === 0 || i + a.length > text.length) continue;
        if (!text.startsWith(a, i)) continue;
        // 「砂」が「砂漠」の頭を食う誤検出だけ個別に防ぐ
        if (a === "砂" && text[i + a.length] === "漠") continue;
        let ok = true;
        for (let j = i; j < i + a.length; j++) if (taken[j]) { ok = false; break; }
        if (!ok) continue;
        for (let j = i; j < i + a.length; j++) taken[j] = true;
        hits.push({ ...cand, start: i, end: i + a.length });
        i += a.length - 1;
        break;
      }
    }
  }
  return hits.sort((x, y) => x.start - y.start);
}

// ---------------------------------------------------------------- 数量
const KANJI_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function parseNumberToken(s) {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (s === "十") return 10;
  if (s.includes("十")) {
    const [a, b] = s.split("十");
    const tens = a === "" ? 1 : KANJI_NUM[a];
    const ones = b === "" ? 0 : KANJI_NUM[b];
    if (tens == null || ones == null) return null;
    return tens * 10 + ones;
  }
  return KANJI_NUM[s] ?? null;
}
const AMOUNT_RE = /^(\d+|[一二三四五六七八九十]+)\s*(個|本|枚|つ|体|匹|スタック|組|セット|箱)?/;
function amountValue(numTok, unit, itemId) {
  const n = parseNumberToken(numTok);
  if (n == null) return null;
  // 0-C5 (cycle1256): スタック換算は品目別サイズ (amount_math が単一の正)。品目不明時は 64。
  return unit === "スタック" ? n * stackSizeOfItem(itemId ?? null).size : n;
}
// cycle0832 R1 (Phase5): N5 不要の gap 構成判定。距離 (文字数) ゲートは数量サフィックス
// 「3個は」等で常に外れ否定が反転したため、gap が「数量サフィックス＋係助詞・強調のみ」で
// 構成される場合に通過させる (語彙は AMOUNT_RE / amountNear と統一。新規の独自表は作らない)。
const N5_GAP_RE = /^を?(?:(?:\d+|[一二三四五六七八九十]+)\s*(?:個|本|枚|つ|体|匹|スタック|組|セット|箱)|半スタック)?\s*(?:は|が|も)?(?:もう|なんか)?$/;
function n5GapOk(text, hit, idx) { try { const gap = text.slice(hit.end, idx); if (gap.length <= 2) return true; return N5_GAP_RE.test(gap); } catch { return false; } }
// 0-C5 (cycle1256): 数量フレーズの所在だけを従来どおり前後で特定し、値の解釈
// (品目別スタック/複合合算/反復/相対/0個) は純粋核 amount_parse へ委ねる。
// 詳細は hit.amountDetail に保持し、候補・注文へ amountMeta として運ぶ。
// cyc1743 0-C5 R-1/R-3: 項の繰り返し (3項以上)・第2項以降のスタック/半スタック・小数スタックを許可し、値解釈は核 amount_parse へ委ねる
const QTY_TERM_SRC = String.raw`(?:(?:半|はん)スタック|(?:\d+(?:\.\d+)?|[一二三四五六七八九十]+|ゼロ|零)\s*(?:スタック|個|本|枚|つ|体|匹|組|セット|箱))`;
const QTY_PHRASE_RE = new RegExp(`(${QTY_TERM_SRC}(?:\\s*と\\s*${QTY_TERM_SRC})*(?:ずつ\\s*(?:\\d+|[一二三四五六七八九十]+)\\s*回|を\\s*(?:\\d+|[一二三四五六七八九十]+)\\s*回)?)`);
function amountNear(text, hit) {
  let itemId = null;
  try { const t = targetOf(hit); itemId = t?.item ?? t?.block ?? null; } catch { itemId = null; }
  const parsePhrase = (phrase) => {
    try {
      const r = amount_parse(phrase, { itemId });
      if (r && r.ok) { hit.amountDetail = r; return r.total; }
    } catch { /* 核の失敗は数量なしとして従来経路へ */ }
    return null;
  };
  const after = text.slice(hit.end, hit.end + 18);
  const am = after.match(new RegExp(`^[のがをもは]?(?:だけ)?\\s*(あと\\s*[、,]?\\s*(?:もう\\s*)?)?\\s*${QTY_PHRASE_RE.source}`)); // cyc2157 R1G2-c: 核 startRe と対称に「あと」の後ろの読点・「もう」を許す (従来は数量ごと脱落)
  if (am) { const v = parsePhrase((am[1] || "") + am[2]); if (v != null) return v; }
  // 0-C5 R-4 (v0.5.86): 反復前置（「丸石を2回、3個ずつ」）。裸数字フォールバックが
  // 「2回」の 2 を数量として先に拾うため、その前に前置反復つきフレーズを核へ渡す。
  const pm = after.match(new RegExp(`^[のがをもは]?\\s*(?:\\d+|[一二三四五六七八九十]+)\\s*回\\s*(?:分|繰り返して|繰り返し|、|,)?\\s*${QTY_PHRASE_RE.source}`));
  if (pm) { const v = parsePhrase(pm[0].replace(/^[のがをもは]/, "")); if (v != null) return v; }
  let m = after.match(/^[のがをもは]?(\d+)/); // 単位なしの裸の数字（「ダイヤ10掘って」）
  if (m) return parseInt(m[1], 10);
  const before = text.slice(Math.max(0, hit.start - 18), hit.start);
  const bm = before.match(new RegExp(`${QTY_PHRASE_RE.source}\\s*の\\s*$`));
  if (bm) { const v = parsePhrase(bm[1]); if (v != null) return v; }
  if (/(?:半|はん)スタック\s*$/.test(before)) { const v = parsePhrase("半スタック"); if (v != null) return v; }
  return null;
}

// ---------------------------------------------------------------- 動詞・句
const VERB_STEMS = [
  ["hunt", ["倒し", "倒せ", "殺し", "殺せ", "狩っ", "やっつけ", "退治", "討伐", "攻撃"]],
  ["build", ["作っ", "作成", "クラフト", "建て", "建築", "置い"]],
  ["gather", ["掘", "集め", "取っ", "採っ", "拾っ", "獲っ", "刈", "収穫", "切っ", "伐採"]],
  ["deliver", ["届け", "持ってき", "持って来", "持って行", "持ってい", "渡し", "渡せ", "運ん"]],
];
function classifyVerb(clause) {
  for (const [cls, stems] of VERB_STEMS) {
    if (stems.some((s) => clause.includes(s))) return cls;
  }
  return null;
}
const WANT_RE = /欲しい|ほしい|ちょうだい|ください|下さい|お願い/;
const ESCORT_RE = /ついてきて|付いてきて|ついて来て|一緒に来て|一緒について|こっち来て|護衛|守って/;
const WATCH_RE = /警戒して|見張って/;
const FREE_RE = /おまかせ|お任せ|自由にや|好きにし|任せるよ/;
const SIDE_START_RE = /^(ついでに|途中で|途中|あと|それと|さらに|また)/;

// 制約句: [正規表現, hostiles値]。マッチした句は文面から除去する（対象の誤読防止）。
const CONSTRAINT_PHRASES = [
  [/戦わずに|戦わないで|無視して|無視で|構わずに|相手にしないで|スルーして|スルーで/g, "ignore"],
  [/倒しながら|殺しながら|狩りながら|戦いながら|倒してから|殺してから/g, "engage"],
  [/(敵|モンスター|モブ)(は|を)?(全部|全員|みんな)?(倒せ|殺せ|やれ)/g, "engage"],
  [/逃げながら|避けながら|逃げて|避けて|見つからないように|こっそり/g, "avoid"],
];
const DIMENSION_PATTERNS = [
  ["nether", /ネザー/],
  ["the_end", /エンド/],
  ["overworld", /オーバーワールド|地上/],
];
const BIOME_PATTERNS = [
  ["cave", /洞窟|地下/],
  ["desert", /砂漠/],
  ["snow", /雪原|雪国/],
  ["jungle", /ジャングル/],
  ["ocean", /海|海洋/],
  ["mountain", /山|山岳/],
  ["swamp", /沼地|湿地|沼/],
  ["forest", /森林|森/],
  ["plains", /平原|草原/],
  ["badlands", /メサ|荒野/],
  ["mushroom", /キノコ島/],
];

// cyc1743 0-C5 R-3: 句分割は数字に挟まれた小数点・カンマを区切りとしない
// (「2.5スタック」が句分割で割れて核へ届かなかった)。
function splitClauses(text) {
  const out = []; let cur = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ("、。,.!?！？".includes(ch)) {
      if (ch === "." || ch === ",") {
        const pv = text[i-1], nx = text[i+1];
        if (pv && nx && /\d/.test(pv) && /\d/.test(nx)) { cur += ch; continue; }
      }
      if (cur) out.push(cur); cur = ""; continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function normalize(text) {
  let t = String(text ?? "");
  t = t.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
  t = t.replace(/[\s　]+/g, "");
  return t;
}


// ---------------------------------------------------------------- 否定抽出 (Phase 5)
// 設計: brain_parts/solutions/cycle2319-a17-negation-design §3-§4。汎用文法のみ。
const NEGATION_PATTERNS = Object.freeze({
correctionMarkers: ["じゃなくて", "ではなく", "じゃなく", "じゃなし", "でなく", "じゃない"],
exclusionMarker: "以外",
unwantedMarkers: ["要らない", "いらない", "不要", "欲しくない"],
deliverNegationRe: /持って(?:こないで|くるな|来ないで)/,
// N-1 (cycle0936): 免除・不要形「〜なくて(も)いい/よい」。意味は N5 unwanted と同族で、
// 産出は N5 と同じ pendingUnwanted 経路へ合流させる。形態素形としての汎用パターン。
dispensationRe: /なくて(?:も)?(?:いい|よい)(?:です)?/g,
referenceWords: ["それ", "これ", "あれ"],
});

const NEG_MORPHEME_RE = /(ないで|こないで|くるな|来ないで|るな|ない$|な$|ずに|ず$)/g; // 0-C2 (cycle1215): 「掘らずに」型の ず/ずに 否定も形態素として数える (従来は未検出で禁止対象が主目標に反転していた)

function hasGuardedForm(clause) {
return /なくては|ないと(?!いう)|なければ/.test(clause);
}

// 内部 hit (生 def 配列) / target 付き hit の両形から §2.2 target を得る。
function targetOfHit(hit) {
if (hit?.target) return hit.target;
if (Array.isArray(hit?.def)) {
if (hit.kind === "material") {
const [id, type, name] = hit.def;
return type === "block"
? { item: null, block: id, entity: null, name}
: { item: id, block: null, entity: null, name};
}
if (hit.kind === "entity") return { item: null, block: null, entity: hit.def[0], name: hit.def[1]};
if (hit.kind === "structure") return { item: null, block: null, entity: null, name: hit.def[0]};
}
// autonomy 側の export 形 ({id,type,name} / {id,name}) フォールバック
if (hit?.kind === "material" && hit.def?.id) {
return hit.def.type === "block"
? { item: null, block: hit.def.id, entity: null, name: hit.def.name}
: { item: hit.def.id, block: null, entity: null, name: hit.def.name};
}
if (hit?.kind === "entity" && hit.def?.id) {
return { item: null, block: null, entity: hit.def.id, name: hit.def.name};
}
return null;
}
function isGenericHostile(hit) {
return targetOfHit(hit)?.entity === "hostile";
}

function negationMorphemePositions(clause) {
const masked = NEGATION_PATTERNS.correctionMarkers
.reduce((s, m) => s.split(m).join(" ".repeat(m.length)), clause);
const out = [];
NEG_MORPHEME_RE.lastIndex = 0;
let m;
while ((m = NEG_MORPHEME_RE.exec(masked))!== null) {
out.push({ index: m.index, text: m[1]});
if (m[0].length === 0) break;
}
return out;
}

// 既存 VERB_STEMS を使う版 (元ドラフトの opts.verbStems 引数は統合で解消)。
function findNegatedVerb(clause) {
if (hasGuardedForm(clause)) return null;
const deliverHit = clause.match(NEGATION_PATTERNS.deliverNegationRe);
if (deliverHit) return { verb: "deliver", index: deliverHit.index};
for (const pos of negationMorphemePositions(clause)) {
let best = null;
for (const [cls, stems] of VERB_STEMS) {
for (const stem of stems) {
const forms = [stem];
if (stem.length > 1 && /[\u4e00-\u9fff]/.test(stem[0])) forms.push(stem[0]);
for (const form of forms) {
const i = clause.lastIndexOf(form, pos.index);
if (i >= 0 && (!best || i > best.index)) best = { verb: cls, index: i};
}
}
}
if (best) return best;
}
return null;
}

function nearestHitBefore(hits, pos) {
let best = null;
for (const h of hits?? []) if (h?.end <= pos && (!best || h.start > best.start)) best = h;
return best;
}
function nearestHitAfter(hits, pos) {
let best = null;
for (const h of hits?? []) if (h?.start >= pos && (!best || h.start < best.start)) best = h;
return best;
}

// Phase5 並列否定 単位A (cycle1503): アンカー hit から左へ、並列接続だけの gap が続く間だけ辿る。
function parallelChainBefore(hits, anchorHit, clauseText) {
try {
if (!anchorHit) return [];
const sorted = [...(hits ?? [])].filter((h) => h && typeof h.start === "number" && typeof h.end === "number").sort((a, b) => a.start - b.start);
const ai = sorted.indexOf(anchorHit);
if (ai < 0) return [anchorHit];
const text = String(clauseText ?? "");
const chain = [anchorHit];
for (let i = ai; i > 0; i--) {
const prev = sorted[i - 1], curr = sorted[i];
let gap = text.slice(prev.end, curr.start);
gap = gap.replace(/^(?:\d+|[一二三四五六七八九十]+)\s*(?:個|体|本|枚|つ|匹|スタック|組|セット|箱)/, "").replace(/^半スタック/, ""); // cycle0832 R1-F2: 数量語彙を AMOUNT_RE 系へ統一 (漢字数字・スタック・「つ」で第1項が漏れる部分反転の是正)
if (!gap) break;
if (!/^(?:も|と|や|とか|、|・|は|が|を)+$/.test(gap)) break;
chain.unshift(prev);
}
return chain;
} catch { return anchorHit ? [anchorHit] : []; }
}

// Phase5 並列否定 単位B (cycle1603): hitのみ節 (hit が1件以上あり、hit 範囲外の残りが
// 並列接続・助詞・数量だけ) の判定。動詞語幹を含む節は hitのみ節ではない (合流を止める節)。
function hitOnlyClauseHits(clause, hits) {
try {
if (!hits || hits.length === 0) return null;
let rest = "", pos = 0;
for (const h of [...hits].sort((a, b) => a.start - b.start)) { rest += clause.slice(pos, h.start); pos = Math.max(pos, h.end); }
rest += clause.slice(pos);
if (!/^(?:も|と|や|とか|は|が|を|の|どちらも|\d+(?:個|本|枚|つ|体|匹)?)*$/.test(rest)) return null;
if (VERB_STEMS.some(([, stems]) => stems.some((s) => clause.includes(s)))) return null;
return hits;
} catch { return null; }
}

// N-1 (cycle0936): 免除形の gap ゲート (N5 の n5GapOk に対応)。対象 hit とマーカーの間は
// 助詞・数量・動詞句 (未然形) だけで構成される場合のみ免除と認める。量表現 (「は少」等) は
// 動詞句として成立しないため落ちる。語幹が取れなければ verb:null で対象だけ隔離する。
function dispensationRestVerb(rest) {
  if (rest === "") return { ok: true, verb: null };
  if (rest === "要ら" || rest === "無") return { ok: true, verb: null };
  if (/^持って(?:こ|来)$/.test(rest) || /^持ってき$/.test(rest)) return { ok: true, verb: "deliver" };
  for (const [cls, stems] of VERB_STEMS) {
    for (const stem of stems) {
      const forms = [stem];
      if (stem.length > 1 && /[\u4e00-\u9fff]/.test(stem[0])) forms.push(stem[0]);
      for (const form of forms) {
        const i = rest.indexOf(form);
        if (i >= 0 && /(?:ら|え|か|さ|た|ま|わ|い|き|し|せ|れ|め|げ|べ|ぺ)$/.test(rest)) return { ok: true, verb: cls };
      }
    }
  }
  return { ok: false, verb: null };
}
function dispensationGapVerb(text, hit, markerIdx) {
  try {
    const gap = text.slice(hit.end, markerIdx);
    const rest = gap
      .replace(/^(?:は|が|を|も)/, "")
      .replace(/^(?:(?:\d+|[一二三四五六七八九十]+)\s*(?:個|本|枚|つ|体|匹|スタック|組|セット|箱)|半スタック)/, "")
      .replace(/^(?:は|が|を|も)/, "");
    return dispensationRestVerb(rest);
  } catch { return { ok: false, verb: null }; }
}

function extractNegations(clauses, hitsPerClause, opts = {}) {
const negations = [];
const caps = []; // 0-C2 (cycle1215): 「N体以上は狩らないで」型の上限。禁止に倒さず構造として保持する
const quarantinedHits = new Set();
const unresolved = [];
let hostileNegated = false;

const clauseList = Array.isArray(clauses)? clauses: [];
const hitsList = Array.isArray(hitsPerClause)? hitsPerClause: [];
const pendingUnwanted = [];
// Phase5 並列否定 単位B (cycle1603): 直前までの hitのみ節の連続ランを節 ci へ運ぶ。
// 要素は hit オブジェクトの参照のまま (隔離 Set の参照同一性に依存するため複製禁止)。
const carriedHits = [];
{
let run = [];
clauseList.forEach((clause2, ci2) => {
carriedHits[ci2] = run;
const only = hitOnlyClauseHits(String(clause2 ?? ""), hitsList[ci2] ?? []);
run = only ? [...run, ...only] : [];
});
}

clauseList.forEach((clause, ci) => {
const text = String(clause?? "");
const hits = hitsList[ci]?? [];
if (!text) return;
const done = new Set();

const pushNeg = (kind, hit, verb, marker) => {
const neg = { kind, target: hit? targetOfHit(hit): null, verb: verb?? null, marker, clause: ci};
negations.push(neg);
if (hit) { quarantinedHits.add(hit); done.add(hit);}
return neg;
};

// N1 訂正: M + 訂正辞
const claimedCorrIdx = new Set();
for (const marker of NEGATION_PATTERNS.correctionMarkers) {
let from = 0;
for (;;) {
const idx = text.indexOf(marker, from);
if (idx < 0) break;
from = idx + marker.length;
if (claimedCorrIdx.has(idx)) continue;
claimedCorrIdx.add(idx);
const hit = nearestHitBefore(hits.filter((h) =>!done.has(h)), idx);
// cyc1924 0-C5: 数量訂正 (「10個じゃなくて3個」) は対象訂正ではない。前方に数量があり
// 訂正辞の後に新しい対象が無く数量だけが続く場合は、対象否定として隔離しない
// (最終組立の数量訂正パスが後勝ちで反映する)。対象訂正 (「鉄じゃなくて銅」) は後に hit があるため従来どおり。
if (hit && !nearestHitAfter(hits.filter((h) =>!done.has(h)), idx + marker.length)
  && /(?:個|スタック|本|枚|組|[0-9０-９]|[一二三四五六七八九十])\s*$/.test(text.slice(Math.max(0, idx - 12), idx).replace(/\s+$/, ""))
  && (/^\s*[、,]?\s*に?\s*(?:[0-9０-９]+|[一二三四五六七八九十百]+)\s*(?:個|スタック|本|枚|つ|組)/.test(text.slice(idx + marker.length, idx + marker.length + 16))
    || (text.slice(idx + marker.length).trim() === "" && ci + 1 < clauseList.length && /^\s*(?:[0-9０-９]+|[一二三四五六七八九十百]+)\s*(?:個|スタック|本|枚|つ|組)/.test(String(clauseList[ci + 1] ?? ""))))) {
  continue;
}
if (hit) {
for (const ch of parallelChainBefore(hits.filter((h) =>!done.has(h)), hit, text)) {
if (isGenericHostile(ch)) hostileNegated = true;
pushNeg("not", ch, null, marker);
}
for (const ch of carriedHits[ci] ?? []) { if (done.has(ch)) continue; if (isGenericHostile(ch)) hostileNegated = true; pushNeg("not", ch, null, marker); }
} else if (NEGATION_PATTERNS.referenceWords.some((w) => text.slice(Math.max(0, idx - 2), idx).includes(w))) {
const neg = pushNeg("not", null, null, marker);
unresolved.push({ slot: "target", reason: "reference_unresolved", negations: [neg]});
} else if (ci === 0 &&!nearestHitAfter(hits, idx + marker.length) && clauseList.length > 1) {
const neg = pushNeg("not", null, null, marker);
unresolved.push({ slot: "target", reason: "correction_without_base", negations: [neg]});
}
}
}

// N4 除外: M + 以外
{
let from = 0;
for (;;) {
const idx = text.indexOf(NEGATION_PATTERNS.exclusionMarker, from);
if (idx < 0) break;
from = idx + NEGATION_PATTERNS.exclusionMarker.length;
const hit = nearestHitBefore(hits.filter((h) =>!done.has(h)), idx);
if (hit) {
for (const ch of parallelChainBefore(hits.filter((h) =>!done.has(h)), hit, text)) {
if (isGenericHostile(ch)) hostileNegated = true;
const ng = pushNeg("not", ch, null, NEGATION_PATTERNS.exclusionMarker); ng.scope = "except"; // 0-C2: 除外された側が「唯一の許可対象」であることを保持 (禁止への反転防止)
}
for (const ch of carriedHits[ci] ?? []) { if (done.has(ch)) continue; if (isGenericHostile(ch)) hostileNegated = true; const ng = pushNeg("not", ch, null, NEGATION_PATTERNS.exclusionMarker); ng.scope = "except"; }
}
}
}

// N5 不要: M + (は|が)? + 不要辞
for (const marker of NEGATION_PATTERNS.unwantedMarkers) {
let from = 0;
for (;;) {
const idx = text.indexOf(marker, from);
if (idx < 0) break;
from = idx + marker.length;
const hit = nearestHitBefore(hits.filter((h) =>!done.has(h)), idx);
if (hit && n5GapOk(text, hit, idx)) {
for (const ch of parallelChainBefore(hits.filter((h) =>!done.has(h)), hit, text)) {
if (isGenericHostile(ch)) hostileNegated = true;
const neg = pushNeg("not", ch, null, marker);
pendingUnwanted.push({ neg, hit: ch});
}
for (const ch of carriedHits[ci] ?? []) { if (done.has(ch)) continue; if (isGenericHostile(ch)) hostileNegated = true; const neg = pushNeg("not", ch, null, marker); pendingUnwanted.push({ neg, hit: ch}); }
} else if (!hit && (carriedHits[ci] ?? []).length > 0 && hits.filter((h) =>!done.has(h)).length === 0) {
// 単位B 亜型B2 (cycle1603): 節内に hit が無く不要辞だけがある場合、運ばれた hit をアンカーにする
const restB2 = (text.slice(0, idx) + text.slice(idx + marker.length)).trim();
if (/^(?:どちらも|どちら|全部|全員|みんな|は|が|も)*$/.test(restB2)) {
for (const ch of carriedHits[ci]) { if (done.has(ch)) continue; if (isGenericHostile(ch)) hostileNegated = true; const neg = pushNeg("not", ch, null, marker); pendingUnwanted.push({ neg, hit: ch}); }
}
}
}
}

// N7 免除 (N-1, cycle0936): M + [助詞/数量/動詞句] + なくて(も)いい/よい。
// 意味は N5 不要と同族: 正対象があれば not、無ければ pendingUnwanted 経由で forbid へ昇格。
// 義務形 (なくてはならない等) は dispensationRe が元々一致しない (なくての直後に いい/よい を要求)。
if (!/なくては(?:いけない|ならない)/.test(text)) {
NEGATION_PATTERNS.dispensationRe.lastIndex = 0;
let dm;
while ((dm = NEGATION_PATTERNS.dispensationRe.exec(text)) !== null) {
const idx = dm.index;
const marker = dm[0].replace(/です$/, "");
// 質問ガード: 疑問符つき文で節末がマーカーで終わる場合は許可確認の質問として扱い発動しない
if (opts?.hasQuestionMark && text.slice(idx + dm[0].length).trim() === "") continue;
const hit = nearestHitBefore(hits.filter((h) =>!done.has(h)), idx);
if (hit) {
const gate = dispensationGapVerb(text, hit, idx);
if (!gate.ok) continue;
for (const ch of parallelChainBefore(hits.filter((h) =>!done.has(h)), hit, text)) {
if (isGenericHostile(ch)) hostileNegated = true;
const neg = pushNeg("not", ch, gate.verb, marker);
pendingUnwanted.push({ neg, hit: ch});
}
for (const ch of carriedHits[ci] ?? []) { if (done.has(ch)) continue; if (isGenericHostile(ch)) hostileNegated = true; const neg = pushNeg("not", ch, gate.verb, marker); pendingUnwanted.push({ neg, hit: ch}); }
} else if ((carriedHits[ci] ?? []).length > 0 && hits.filter((h) =>!done.has(h)).length === 0) {
// 単位B 亜型: 「鉄と銅は、掘らなくていい」のように動詞句だけの節は運ばれた hit をアンカーにする
const gate = dispensationRestVerb(text.slice(0, idx).trim());
if (gate.ok) {
for (const ch of carriedHits[ci]) { if (done.has(ch)) continue; if (isGenericHostile(ch)) hostileNegated = true; const neg = pushNeg("not", ch, gate.verb, marker); pendingUnwanted.push({ neg, hit: ch}); }
}
}
}
}

// 0-C2 上限 (cycle1215): 「<対象>を N<単位>以上は <動詞>ないで」は一律禁止ではなく上限として保持する。
// 対象 hit は隔離するが forbid 否定は作らない (禁止として記録されると意味が反転・拡大するため)。
let capHandled = false;
{
const cm = text.match(/(\d+|[一二三四五六七八九十]+)\s*(?:個|体|本|枚|つ|匹)\s*以上/);
if (cm && !hasGuardedForm(text)) {
const nvCap = findNegatedVerb(text);
if (nvCap && nvCap.index > text.indexOf(cm[0])) {
const hitCap = nearestHitBefore(hits.filter((h) =>!done.has(h)), text.indexOf(cm[0]));
const capN = parseNumberToken(cm[1]);
if (hitCap && capN != null) {
caps.push({ target: targetOfHit(hitCap), cap: capN, verb: nvCap.verb, clause: ci });
quarantinedHits.add(hitCap); done.add(hitCap); capHandled = true;
}
}
}
}

// N2/N3/N6 動詞否定
if (!hasGuardedForm(text) && !capHandled) {
const nv = findNegatedVerb(text);
if (nv) {
const hit = nearestHitBefore(hits.filter((h) =>!done.has(h)), nv.index + 1)
?? nearestHitBefore(hits.filter((h) =>!done.has(h)), Number.POSITIVE_INFINITY);
if (hit) {
const marker = text.includes("ないで")? "ないで": (text.endsWith("な")? "な": "ないで");
for (const ch of parallelChainBefore(hits.filter((h) =>!done.has(h)), hit, text)) {
if (isGenericHostile(ch)) {
hostileNegated = true;
quarantinedHits.add(ch); done.add(ch);
} else {
pushNeg("forbid", ch, nv.verb, marker);
}
}
for (const ch of carriedHits[ci] ?? []) {
if (done.has(ch)) continue;
if (isGenericHostile(ch)) { hostileNegated = true; quarantinedHits.add(ch); done.add(ch); } else pushNeg("forbid", ch, nv.verb, marker);
}
} else if ((carriedHits[ci] ?? []).length > 0) {
// 単位B 亜型B2 (cycle1603): 節内に hit が無い動詞否定は、運ばれた hit をアンカーにする
const marker = text.includes("ないで")? "ないで": (text.endsWith("な")? "な": "ないで");
for (const ch of carriedHits[ci]) {
if (done.has(ch)) continue;
if (isGenericHostile(ch)) { hostileNegated = true; quarantinedHits.add(ch); done.add(ch); } else pushNeg("forbid", ch, nv.verb, marker);
}
}
}
}
});

const allHits = hitsList.flat();
const remaining = allHits.filter((h) =>!quarantinedHits.has(h));
const hasPositive = remaining.length > 0;

if (!hasPositive) for (const { neg} of pendingUnwanted) neg.kind = "forbid";

const exclusionNegs = negations.filter((n) => n.marker === NEGATION_PATTERNS.exclusionMarker);
if (!hasPositive && exclusionNegs.length > 0) {
unresolved.push({ slot: "target", reason: "excluded_only", negations: [...exclusionNegs]});
}
if (!hasPositive && negations.some((n) => NEGATION_PATTERNS.correctionMarkers.includes(n.marker))
&&!unresolved.some((u) => u.reason === "correction_without_base" || u.reason === "reference_unresolved")) {
const corr = negations.filter((n) => NEGATION_PATTERNS.correctionMarkers.includes(n.marker));
unresolved.push({ slot: "target", reason: "correction_without_base", negations: corr});
}

return { negations, quarantinedHits, hostileNegated, unresolved, caps };
}

// ---------------------------------------------------------------- 文法ガード
// 語幹が文中にあっても、過去・完了の報告や質問文は「これからの指示」ではない。
// 句ごとに、語幹の直後の活用形を見て判定する（文の丸写しではなく形で見る）。
//
// 動詞の出現形: 語幹の直後で分類する。
//   past    … タ形・レタ形（掘った/集めた/置いた/掘れた/作っちゃった 等）
//   request … テ形・命令形（掘って/集めて/倒せ 等）。依頼形が同じ句にあれば
//             過去形が混ざっていても指示として扱う（例: 掘った鉄を持ってきて）。
function verbOccurrenceForms(clause) {
  let past = false, request = false;
  for (const [, stems] of VERB_STEMS) {
    for (const stem of stems) {
      let i = clause.indexOf(stem);
      while (i >= 0) {
        const rest = clause.slice(i + stem.length);
        if (/^(た|だ|った|れた|した|ちゃ|ました|てしまった)/.test(rest)) past = true;
        else if (/^(て|で|って|ろ|ながら|して|します)/.test(rest)
          || stem === "倒せ" || stem === "殺せ" || stem === "渡せ") request = true;
        i = clause.indexOf(stem, i + 1);
      }
    }
  }
  return { past, request };
}
// 語幹辞書に無い動詞の過去・完了報告（見つけた/ゲットした/助かったよ 等）の文末形
const PAST_REPORT_RE = /(ちゃった|てしまった|ました|でした)([よねなぁ！!。…]|$)|た(よ|ね|んだ)([！!。…]|$)|た[！!。…]?$|(れた|られた)([よねなぁ！!。…]|$)/;
// 疑問形: 疑問詞、可能形＋文末（掘れるの）、疑問符つきの文末（〜か/〜の/〜ね）
const INTERROGATIVE_RE = /(何|なに|どう|どこ|いつ|なぜ|なんで|誰)/;
function isQuestionClause(clause, hasQuestionMark) {
  if (INTERROGATIVE_RE.test(clause)) return true;
  if (/(れる|られる|できる)(の|かな|か)?$/.test(clause)) return true;
  if (hasQuestionMark && /(か|の|かな|ね|よ)$/.test(clause)) return true;
  return false;
}
// その句が「指示ではない」句（過去・完了報告 / 質問）かどうか。
// 依頼形の動詞が同じ句にある場合は指示側を優先して落とさない。
function isNonOrderClause(clause, hasQuestionMark) {
  const forms = verbOccurrenceForms(clause);
  if (forms.request) return false;
  if (forms.past) return true;
  if (PAST_REPORT_RE.test(clause)) return true;
  return isQuestionClause(clause, hasQuestionMark);
}
// 願望の独り言ガード用のマーカー（数量指定や ください/ちょうだい/お願い のような
// 相手への依頼形が無い「欲しい」だけの発話で、独り言マーカーがある場合に使う）
const DESIRE_RE = /欲しい|ほしい/;
const DIRECTED_REQUEST_RE = /ください|下さい|ちょうだい|お願い/;
const SOLILOQUY_RE = /(なあ|なぁ|いいな|すごく|とても|めっちゃ|本当に|ほんとに|いつか)/;

// 0-C2 条件節 (cycle1215): 文頭の「〜たら／〜ている間」条件を Goal の構造として保持する。
// 条件節側に対象メンションが無く、後続に対象メンションがある場合だけ条件と認める (汎用形)。
function extractConditionPrefix(text) {
  try {
    const m = String(text ?? "").match(/^([^、。]{2,16}?(?:なったら|になったら|降ったら|やんだら|止んだら|ている間だけ|てる間だけ|間だけ|ている間|てる間|たら))、?(.*)$/);
    if (!m) return null;
    const seg = m[1], rest = m[2];
    if (!rest) return null;
    if (scanMentions(seg, [MATERIAL_INDEX, ENTITY_INDEX]).length) return null;
    if (!scanMentions(rest, [MATERIAL_INDEX, ENTITY_INDEX]).length) return null;
    let kind = "custom";
    if (/雨/.test(seg)) kind = "rain";
    else if (/満腹|お腹いっぱい|腹いっぱい/.test(seg)) kind = "satiety";
    else if (/夜/.test(seg)) kind = "night";
    else if (/朝/.test(seg)) kind = "morning";
    // R-C2-3+4 (cyc2380): 終端の形から役割と反転を構造として保持する。
    // 「間(だけ)」形は継続条件 (window)、たら系は開始トリガー (start)。
    // 「やんだら/止んだら」は雨の場合に限り rain_end (rain の反転) へ。非・雨では custom のまま。
    const role = /(?:間だけ|ている間|てる間)$/.test(seg) ? "window" : "start";
    if (/(?:やんだら|止んだら)$/.test(seg) && kind === "rain") kind = "rain_end";
    return { raw: seg, kind, role };
  } catch { return null; }
}

// 0-C4 (cycle1321): 道具指定の分離と設置位置の保持。判定は汎用文法のみで行い、
// 対象の型 (道具か/生き物か/アイテムか) が文面と矛盾する候補を開始処理へ渡さない。
const TOOL_IDS = new Set([
  "bow", "crossbow", "trident", "fishing_rod", "shears", "shield",
  "wooden_pickaxe", "wooden_axe", "wooden_shovel", "wooden_sword",
  "stone_pickaxe", "stone_axe", "stone_shovel", "stone_sword",
  "iron_pickaxe", "iron_axe", "iron_shovel", "iron_sword",
  "golden_pickaxe", "golden_axe", "golden_shovel", "golden_sword",
  "diamond_pickaxe", "diamond_axe", "diamond_shovel", "diamond_sword",
  "netherite_pickaxe", "netherite_axe", "netherite_shovel", "netherite_sword",
]);
// 「<道具>で<動詞>」: 道具 hit は対象候補から外し、手段として返す。
// 「を」を含む句 (目的語が先行する形) と、動詞が後続しない句では発動しない。
function toolPhraseOf(clause, hits) {
  try {
    const de = clause.indexOf("で");
    if (de < 0) return null;
    if (/を/.test(clause.slice(0, de))) return null;
    if (!/(倒|掘|狩|切|壊|攻撃|刈|伐|殴)/.test(clause.slice(de + 1))) return null;
    const hit = (hits || []).find((h) => h.kind === "material" && TOOL_IDS.has(h.def?.[0]) && h.end <= de && de - h.end <= 1);
    if (!hit) return null;
    return { hit, tool: targetOf(hit) };
  } catch { return null; }
}
const PLACE_DIR_RE = /^(上|右|左|前|後ろ|後|下|隣|となり|横)$/;
// 0-C R-C4-4 S6 (cyc2385 統合): 「<媒体>から<充填品目>を取って」の媒体分離。
// 媒体 (牛) は充填の相手であって採取対象ではない。道具 (toolPhraseOf)・
// 設置アンカー (anchorHitOf) と同型に、候補生成段で候補から外す。
// R-C4-3 ガード (gather 主目標 entity → clarify) 自体は変更しない:
// fill でない entity gather (牛から革を, 等) は従来どおりガードが受ける。
const FILL_SOURCE_ITEMS = { cow: "milk_bucket" }; // entity id -> 充填品目 id (媒体が entity の組のみ)
// ↑ fill_math.js の FILL_DEFS が正。本表は order_parser が fill_math を
//    import できない制約 (autonomy 副本に fill_math が無くバイト同期が前提)
//    のための写しであり、ドリフトは tests/test_fill_s6_cyc2385.mjs の突合で固定する。
function fillSourceHitOf(clause, hits, verbClass) {
  try {
    if (verbClass === "hunt" || verbClass === "build") return null;
    for (const h of hits || []) {
      if (h.kind !== "entity") continue;
      const itemId = FILL_SOURCE_ITEMS[h.def?.[0]];
      if (!itemId) continue;
      if (clause.slice(h.end, h.end + 2) !== "から") continue;
      const f = (hits || []).find((x) => x.kind === "material" && x.def?.[0] === itemId);
      if (f) return { hit: h, fillHit: f };
    }
    return null;
  } catch { return null; }
}
// 「<対象>の<方向>に置く」: 方向の直前の対象 hit は設置先 (アンカー) であり対象ではない。
function anchorHitOf(clause, hits) {
  try {
    if (!/(置|おい)/.test(clause)) return null;
    for (const h of hits || []) {
      if (clause[h.end] !== "の") continue;
      const dm = clause.slice(h.end + 1).match(/^(.{1,3}?)に/); // 目的語が後続する形 (「上に看板を置いて」) も許す。置 の存在は入口で確認済み
      if (dm && PLACE_DIR_RE.test(dm[1])) return { hit: h, dir: dm[1] };
    }
    return null;
  } catch { return null; }
}
// 設置位置の保持: ここ=発話者の現在位置、アンカー付きは相対位置として保持する。
function placementOf(clause, anchorInfo) {
  try {
    if (!/(置|おい)/.test(clause)) return null;
    if (anchorInfo) return { mode: "relative", anchor: targetOf(anchorInfo.hit), dir: anchorInfo.dir };
    if (/ここに/.test(clause)) return { mode: "here", anchor: null, dir: null };
    const dm = clause.match(/(上|右|左|前|後ろ|後|下|隣|となり|横)に(?=置|おい)/);
    if (dm) return { mode: "relative", anchor: null, dir: dm[1] };
    // 0-C4 R-C4-2 Step 0 (cyc2376): 位置語なしの設置動詞も設置指示として保持する (第4形)。
    // 「松明を3個置いて」で placement が付かず個数が作る数に化ける保持漏れの是正。
    // 解決側では here と同等に扱う。「作って」は設置動詞を含まないため影響しない。
    return { mode: "unspecified", anchor: null, dir: null };
  } catch { return null; }
}

// 0-F R-7a (cyc2397): 防具素材/部位表はモジュールスコープへ昇格し、後続の部位列挙
// プリパス (R-4a) と共有する (重複定義によるドリフト防止)。
const GEAR_MATS = [["ダイヤモンド", "diamond", "ダイヤ"], ["ダイヤ", "diamond", "ダイヤ"], ["鉄", "iron", "鉄"], ["アイアン", "iron", "鉄"], ["金", "golden", "金"], ["ゴールド", "golden", "金"], ["革", "leather", "革"], ["レザー", "leather", "革"]];
const GEAR_PARTS = [["helmet", "ヘルメット"], ["chestplate", "チェストプレート"], ["leggings", "レギンス"], ["boots", "ブーツ"]];
// 0-F R-7a U7-1: 引用/仮定形 (と言ったら等) では一式作製を発火させない。
const GEAR_QUOTE_RE = /(と言ったら|と言えば|って言ったら|って言えば)/;
// 0-F R-7b U7-3 (cyc2398): 一式のセット数を抽出する。一式句 (フル/一式) の末尾から
// 最初の作製動詞または句読点までの窓の中だけを探し、条件節側や副次句の数量を盗まない。
// 明示 0 は 0 を返し、呼び出し側が clarify へ倒す (0-C5: 0個は開始しない)。
function gearSetCountOf(text) {
  const ai = text.search(/(フル|一式)/);
  if (ai < 0) return 1;
  const rest = text.slice(ai + 2);
  const em = rest.match(/(作って|作る|ください|欲しい|ちょうだい|お願い|、|。)/);
  const win = em ? rest.slice(0, em.index) : rest;
  const m = win.match(/(\d+|[一二三四五六七八九十]+)\s*(セット|組|人分)/);
  if (!m) return 1;
  const n = parseNumberToken(m[1]);
  return n == null ? 1 : n;
}

// 0-F R-4a (cyc2399): 部位列挙プリパス用の別名つき部位走査表 (GEAR_PARTS は書き換えない。
// 別名は辞書と R-3a の PART_RE で確定済みの語彙)。
const GEAR_PART_ALIASES = [["helmet", ["ヘルメット", "兜", "かぶと"]], ["chestplate", ["チェストプレート", "胸当て"]], ["leggings", ["レギンス", "ズボン"]], ["boots", ["ブーツ", "靴"]]];
function scanGearPartMentions(text) {
  const out = [];
  for (const [pid, words] of GEAR_PART_ALIASES) {
    for (const w of words) {
      let i = text.indexOf(w);
      while (i >= 0) { out.push({ pid, start: i, end: i + w.length }); i = text.indexOf(w, i + w.length); }
    }
  }
  out.sort((a, b) => a.start - b.start);
  // 重なり (長い別名の中の短い別名) は先に始まる方を残す
  return out.filter((m, idx) => !out.some((o, j) => j !== idx && o.start <= m.start && o.end >= m.end && (o.end - o.start) > (m.end - m.start)));
}
// 列挙版のセット数: 最後の部位メンション終了位置から最初の作製動詞/句読点までの窓だけを見る。
function gearEnumCountOf(text, fromIndex) {
  const rest = text.slice(fromIndex);
  const em = rest.match(/(作って|作る|ください|欲しい|ちょうだい|お願い|、|。)/);
  const win = em ? rest.slice(0, em.index) : rest;
  const m = win.match(/(\d+|[一二三四五六七八九十]+)\s*(セット|組|人分)/);
  if (!m) return 1;
  const n = parseNumberToken(m[1]);
  return n == null ? 1 : n;
}

// ---------------------------------------------------------------- 本体
/**
 * parseOrder(text) -> 注文オブジェクト | null
 * 注文: { kind:'gather'|'build'|'hunt'|'escort'|'free',
 *         target:{item,block,entity,name} | null, amount:number|null,
 *         constraints:{hostiles:'ignore'|'engage'|'avoid'|'default', dimension?, biome?},
 *         sideTasks:[{target, amount}], returnTo:'owner'|'home', raw }
 */
export function parseOrder(input) {
  const raw = String(input ?? "");
  let text = normalize(raw);
  if (!text) return null;

  const constraints = { hostiles: "default" };

  // 0-C2 release (cycle1604): 制限の解除は否定処理より前に分離する (否定経路へ流すと
  // 再び禁止として記録されてしまう)。質問形・仮定形では発火しない (0-C1 ゲートと同方針)。
  try {
    const releaseGuarded = /[？?]/.test(text) || /^(もし|仮に)/.test(text) || /(したら|と言ったら|言えば|なら)/.test(text) || /(少なく|少し|ちょっと)/.test(text);
    if (!releaseGuarded) {
      if (/(もう)?(何でも|なんでも)(いい|よい|構わない)/.test(text) || /制限(を|は)?(なし|無し|解除)/.test(text)) {
        return { kind: "unforbid", target: null, amount: null, constraints, sideTasks: [], negations: [], unresolved: [], caps: [], releaseTarget: null, releaseScope: "all", returnTo: "owner", raw };
      }
      const mRel = text.match(/(てもいい|てもよい|て構わない|ても構わない)/);
      // 「掘らなくてもいい」は免除 (禁止側、cycle0936 N-1 の既存契約) であって解除ではない。
      // 解除は肯定許可形 (掘ってもいい) だけ: マッチ直前が「なく」で終わる形は除外する。
      if (mRel && !/なく$/.test(text.slice(0, mRel.index))) {
        const rh = scanMentions(text, [MATERIAL_INDEX, ENTITY_INDEX]);
        if (rh && rh.length) return { kind: "unforbid", target: null, amount: null, constraints, sideTasks: [], negations: [], unresolved: [], caps: [], releaseTarget: targetOf(rh[0]), releaseScope: "target", returnTo: "owner", raw };
      }
    }
  } catch { /* 解除として解釈できなければ従来経路へ */ }

  // 0-F1 残件 (cyc2020): 部位語だけ・鎖・ネザライト単品の作製指示は、素材が解決できないまま
  // 「チェストプレート」内の「チェスト」を block として拾う誤爆 (実測) を防ぐため、開始せず聞き返す。
  // 鎖防具はバニラでクラフト不可、ネザライトはダイヤ部位への鍛冶強化であり直接クラフトではない。
  try {
    if (!/[？?]/.test(text) && !/(何個|いくつ|要る|必要|コスト)/.test(text) && /(作って|作る|ください|欲しい|ちょうだい|お願い)/.test(text)) {
      const PART_RE = /(チェストプレート|胸当て|ヘルメット|兜|かぶと|レギンス|ブーツ|ズボン|靴)/;
      if (PART_RE.test(text)) {
        const craftableMat = /(ダイヤモンド|ダイヤ|鉄|アイアン|金|ゴールド|革|レザー)/.test(text);
        if (/鎖|チェーン/.test(text)) return { kind: "clarify", target: null, amount: null, constraints, sideTasks: [], negations: [], unresolved: [{ slot: "material", reason: "chainmail_not_craftable" }], caps: [], returnTo: "owner", raw };
        if (/ネザライト/.test(text)) return { kind: "clarify", target: null, amount: null, constraints, sideTasks: [], negations: [], unresolved: [{ slot: "material", reason: "netherite_upgrade_only" }], caps: [], returnTo: "owner", raw };
        if (!craftableMat) return { kind: "clarify", target: null, amount: null, constraints, sideTasks: [], negations: [], unresolved: [{ slot: "material", reason: "armor_part_without_material" }], caps: [], returnTo: "owner", raw };
      }
    }
  } catch { /* 部位の聞き返しとして解釈できなければ従来経路へ */ }

  // 0-F R-1 (cyc2395): フル/一式形でも単品ガードと同型の素材検査を行う。鎖・ネザライト・
  // 素材なしの一式は、素材アイテムへの誤目標開始や無言落ちをせず clarify へ倒す
  // (理由別発話は R-5 で main.js 側に接続済み)。作製可能素材の一式は後段の F2 へ通す。
  try {
    if (!/[？?]/.test(text) && !/(何個|いくつ|要る|必要|コスト)/.test(text) && /(作って|作る|ください|欲しい|ちょうだい|お願い)/.test(text) && /(フル|一式)/.test(text)) {
      if (/鎖|チェーン/.test(text)) return { kind: "clarify", target: null, amount: null, constraints, sideTasks: [], negations: [], unresolved: [{ slot: "material", reason: "chainmail_not_craftable" }], caps: [], returnTo: "owner", raw };
      if (/ネザライト/.test(text)) return { kind: "clarify", target: null, amount: null, constraints, sideTasks: [], negations: [], unresolved: [{ slot: "material", reason: "netherite_upgrade_only" }], caps: [], returnTo: "owner", raw };
      const craftableMatSet = /(ダイヤモンド|ダイヤ|鉄|アイアン|金|ゴールド|革|レザー)/.test(text);
      if (!craftableMatSet) return { kind: "clarify", target: null, amount: null, constraints, sideTasks: [], negations: [], unresolved: [{ slot: "material", reason: "armor_part_without_material" }], caps: [], returnTo: "owner", raw };
    }
  } catch { /* 一式の聞き返しとして解釈できなければ従来経路へ */ }

  // 0-F2 (cyc2003): 「<素材>フル」「防具一式作って」を防具4部位の作製指示として受ける。
  // 質問形 (コスト質問の一式応答は chat_tools 側の正常例) では発火しない。ネザライトは
  // 鍛冶強化で直接クラフトできないため対象外 (一式のコスト応答が既存の正)。
  try {
    if (!/[？?]/.test(text) && !/(何個|いくつ|要る|必要|コスト)/.test(text) && !GEAR_QUOTE_RE.test(text)) {
      let gm = null;
      for (const [word, mid, disp] of GEAR_MATS) { if (text.includes(word + "フル") || text.includes(word + "のフル") || text.includes(word + "一式") || text.includes(word + "の一式")) { gm = { mid, disp }; break; } }
      if (!gm && /(防具|装備)一式/.test(text)) { for (const [word, mid, disp] of GEAR_MATS) { if (text.includes(word)) { gm = { mid, disp }; break; } } }
      if (gm && /(作って|作る|ください|欲しい|ちょうだい|お願い)/.test(text)) {
        // 0-F R-7a U7-2: 文頭の条件節は constraints.condition として保持する
        // (消費側 startOrderFromParser は gearSet 判定より前段で条件保留へ回すため、
        //  parser が条件を付けるだけで保留→再投入で一式が保持される)。
        const gearCond = extractConditionPrefix(text);
        if (gearCond) constraints.condition = gearCond;
        // 0-F R-7b U7-3: セット数を amount へ保持する (展開は main 消費側の1点のみ)。
        // 明示 0 セットは開始せず聞き返す (D-7b-1)。
        const gearSets = gearSetCountOf(text);
        if (gearSets === 0) return { kind: "clarify", target: null, amount: null, constraints, sideTasks: [], negations: [], unresolved: [{ slot: "amount", reason: "zero_amount" }], caps: [], returnTo: "owner", raw };
        const ids = GEAR_PARTS.map(([pid]) => `${gm.mid}_${pid}`);
        return { kind: "build", target: { item: ids[0], block: null, entity: null, name: `${gm.disp}の${GEAR_PARTS[0][1]}` }, amount: gearSets, constraints, sideTasks: [], negations: [], unresolved: [], caps: [], tool: null, placement: null, gearSet: ids, gearMaterial: gm.disp, returnTo: "owner", raw };
      }
    }
  } catch { /* 一式として解釈できなければ従来経路へ */ }

  // 0-F R-4a (cyc2399): 部位列挙プリパス。「ダイヤのヘルメットとブーツ作って」のような
  // 単一素材・防具部位のみの純列挙を、通常経路で後続部位が脱落する前に gearSet として受ける。
  // 発火ガードは全て AND: 質問/コスト除外・引用ゲート・作製動詞・部位2種以上・素材単一一致・
  // 純列挙性 (列挙外に対象句なし)・部位ごと個数なし (D-4a-1: 個数つきは通常経路へ譲る)。
  // 混在素材・非防具混在・副次つきは現行の候補/sideTasks で届いているため対象外。
  try {
    if (!/[？?]/.test(text) && !/(何個|いくつ|要る|必要|コスト)/.test(text) && !GEAR_QUOTE_RE.test(text) && /(作って|作る|ください|欲しい|ちょうだい|お願い)/.test(text)) {
      const mentions = scanGearPartMentions(text);
      const distinct = [...new Set(mentions.map((m) => m.pid))];
      if (mentions.length >= 2 && distinct.length >= 2) {
        // 各メンションの素材: 直前セグメントの「<素材>の」を拾い、無ければ直前の素材を継承する
        let curMat = null, matOk = true;
        const matOf = [];
        for (let k = 0; k < mentions.length; k++) {
          const segStart = k === 0 ? 0 : mentions[k - 1].end;
          const seg = text.slice(segStart, mentions[k].start);
          let found = null;
          for (const [word, mid, disp] of GEAR_MATS) { const wi = seg.lastIndexOf(word); if (wi >= 0 && (!found || wi > found.wi)) found = { wi, mid, disp }; }
          if (found) { if (curMat && curMat.mid !== found.mid) matOk = false; curMat = found; }
          if (!curMat) matOk = false;
          matOf.push(curMat);
        }
        const first = mentions[0], last = mentions[mentions.length - 1];
        // 純列挙性: メンション間は接続詞・素材接頭辞・「を」だけ。列挙範囲内に個数句があれば譲る
        let pure = matOk;
        if (pure && /(\d+|[一二三四五六七八九十]+)\s*個/.test(text.slice(first.start, last.end))) pure = false;
        if (pure) {
          for (let k = 1; k < mentions.length; k++) {
            let between = text.slice(mentions[k - 1].end, mentions[k].start);
            for (const [word] of GEAR_MATS) between = between.split(word).join("");
            between = between.replace(/(の|と|、|・|を|\s)/g, "");
            if (between) { pure = false; break; }
          }
        }
        // 列挙外に対象メンション (素材/エンティティ/構造物) があれば通常経路へ譲る。
        // ただし先頭メンション直前の素材接頭辞と文頭条件節は対象句ではない。
        if (pure) {
          const before = text.slice(0, first.start);
          const after = text.slice(last.end).replace(/(\d+|[一二三四五六七八九十]+)\s*(セット|組|人分)/g, "");
          // before 側は素材接頭辞 (GEAR_MATS の素材語そのもの) のヒットだけ許容し、
          // after 側は対象ヒットが1件でもあれば副次句ありとして通常経路へ譲る
          const matWords = new Set(GEAR_MATS.map(([w]) => w));
          const badBefore = (scanMentions(before, [MATERIAL_INDEX, ENTITY_INDEX, STRUCTURE_INDEX]) || []).filter((h) => !matWords.has(h.alias));
          const badAfter = scanMentions(after, [MATERIAL_INDEX, ENTITY_INDEX, STRUCTURE_INDEX]) || [];
          if (badBefore.length || badAfter.length) pure = false;
          if (pure && matOf[0]) {
            const gm = matOf[0];
            const enumCond = extractConditionPrefix(text);
            if (enumCond) constraints.condition = enumCond;
            const enumSets = gearEnumCountOf(text, last.end);
            if (enumSets === 0) return { kind: "clarify", target: null, amount: null, constraints, sideTasks: [], negations: [], unresolved: [{ slot: "amount", reason: "zero_amount" }], caps: [], returnTo: "owner", raw };
            const ids = distinct.map((pid) => `${gm.mid}_${pid}`);
            const firstName = GEAR_PARTS.find(([pid]) => pid === distinct[0])?.[1] ?? distinct[0];
            return { kind: "build", target: { item: ids[0], block: null, entity: null, name: `${gm.disp}の${firstName}` }, amount: enumSets, constraints, sideTasks: [], negations: [], unresolved: [], caps: [], tool: null, placement: null, gearSet: ids, gearMaterial: gm.disp, returnTo: "owner", raw };
          }
        }
      }
    }
  } catch { /* 列挙として解釈できなければ従来経路へ */ }

  // 1) 制約句を抽出して除去（先に見つかった明示指定を優先し、上書きしない）
  for (const [re, value] of CONSTRAINT_PHRASES) {
    if (re.test(text)) {
      if (constraints.hostiles === "default") constraints.hostiles = value;
      text = text.replace(re, "、");
    }
    re.lastIndex = 0;
  }

  // 2) 次元・バイオーム（素材/エンティティに食われた範囲は除外）
  const allHits = scanMentions(text, [MATERIAL_INDEX, ENTITY_INDEX]);
  const inHit = (pos) => allHits.some((h) => pos >= h.start && pos < h.end);
  for (const [id, re] of DIMENSION_PATTERNS) {
    const m = re.exec(text);
    if (m && !inHit(m.index)) { constraints.dimension = id; break; }
  }
  for (const [id, re] of BIOME_PATTERNS) {
    const m = re.exec(text);
    if (m && !inHit(m.index)) { constraints.biome = id; break; }
  }

  // 3) 帰還先（拠点へ届ける/置く等）
  const returnTo = /(拠点|倉庫|家)に(届け|持って行|持ってい|運ん|置い|入れて)/.test(text) ? "home" : "owner";

  // 3.5) 0-C2 条件節 (cycle1215): 条件は constraints.condition へ保持し、即時発行しない根拠にする
  const condition = extractConditionPrefix(text);
  if (condition) constraints.condition = condition;

  // 4) 句ごとに候補を集める（過去・完了報告と質問文の句は候補にしない）
  const hasQuestionMark = /[？?]/.test(text);
  const clauses = splitClauses(text);
  // Phase 5: 否定抽出を候補決定の前に置く（手順3）。失敗時は否定なしで従来経路へ。
  const hitsPerClause = clauses.map((c) => scanMentions(c, [MATERIAL_INDEX, ENTITY_INDEX, STRUCTURE_INDEX]));
  let negResult = { negations: [], quarantinedHits: new Set(), hostileNegated: false, unresolved: [], caps: [] };
  try { negResult = extractNegations(clauses, hitsPerClause, { hasQuestionMark }); } catch { /* 否定なしとして継続 */ }
  const negations = negResult.negations || [];
  const caps = negResult.caps || [];
  const unresolved = [...(negResult.unresolved || [])];
  if (negResult.hostileNegated && constraints.hostiles === "default") constraints.hostiles = "ignore";
  const candidates = [];
  let anyVerb = false;
  let orderTool = null; // 0-C4: 手段として分離した道具
  let orderPlacement = null; // 0-C4: 設置位置 (絶対=here / 相対=relative)
  clauses.forEach((clause, ci) => {
    const nonOrder = isNonOrderClause(clause, hasQuestionMark);
    const verbClass = nonOrder ? null : classifyVerb(clause);
    if (verbClass) anyVerb = true;
    const side = SIDE_START_RE.test(clause);
    const hits = nonOrder ? [] : hitsPerClause[ci];
    // 0-C4: 道具 hit と設置アンカー hit は対象候補にしない
    const toolInfo = nonOrder ? null : toolPhraseOf(clause, hitsPerClause[ci]);
    if (toolInfo && !orderTool) orderTool = toolInfo.tool;
    const anchorInfo = nonOrder ? null : anchorHitOf(clause, hitsPerClause[ci]);
    const fillSrcInfo = nonOrder ? null : fillSourceHitOf(clause, hitsPerClause[ci], verbClass); // 0-C R-C4-4 S6 (cyc2385)
    if (!orderPlacement) { const pl = nonOrder ? null : placementOf(clause, anchorInfo); if (pl) orderPlacement = pl; }
    let first = true;
    for (const hit of hits) {
      if (negResult.quarantinedHits?.has(hit)) continue; // 否定側は候補にしない
      if (toolInfo && hit === toolInfo.hit) continue; // 0-C4: 道具は対象にしない
      if (anchorInfo && hit === anchorInfo.hit) continue; // 0-C4: 設置アンカーは対象にしない
      if (fillSrcInfo && hit === fillSrcInfo.hit) continue; // 0-C R-C4-4 S6 (cyc2385): 充填の媒体は対象にしない
      // 数量単位の消費: 数字の直後の単位字（本→book 等）はメンションにしない（§7-2、位置ベース）
      if (hit.kind === "material" && hit.def?.[0] === "book" && /[0-9一二三四五六七八九十]/.test(clause[hit.start - 1] ?? "")) continue;
      // 建築物は「〜を/が」に続くか直後に作/建が来る場合だけ採用
      // （「拠点に届けて」「拠点に置いて」のような句で拠点自体が対象に化けるのを防ぐ）
      if (hit.kind === "structure" && !/[をが]/.test(clause[hit.end] ?? "") && !/^(作|建)/.test(clause.slice(hit.end))) continue;
      candidates.push({
        target: targetOf(hit),
        generic: hit.kind === "entity" && hit.def[0] === "hostile",
        amount: amountNear(clause, hit),
        amountDetail: hit.amountDetail ?? null, // 0-C5 (cycle1256): 反復・相対・訂正・0個の保持
        verbClass,
        clause: ci,
        side: side || !first, // 1句に複数対象があれば2件目以降は寄り道扱い
      });
      first = false;
    }
  });

  // Phase 5 手順6: 正対象ゼロでも否定があれば消失させない（forbid / clarify）
  if (candidates.length === 0 && caps.length > 0) { // 0-C2 (cycle1215): 上限だけの発話は禁止にも注文にも倒さず cap として返す
    return { kind: "cap", target: null, amount: null, constraints, sideTasks: [], negations, unresolved, caps, returnTo, raw };
  }
  if (candidates.length === 0 && (negations.length > 0 || negResult.hostileNegated)) { // cycle1832 C1: 総称敵の動詞否定単独形 (negations 空でも hostileNegated が立てば forbid/clarify として保持する)
    if (unresolved.length > 0) {
      // 0-C2 (cycle1215): 「X以外は〜しないで」は X が唯一の許可対象 (allowOnly)。X を禁止として記録してはならない。
      let allowOnly = null;
      if (unresolved.some((u) => u.reason === "excluded_only")) {
        for (const n of negations) {
          if (n.marker !== NEGATION_PATTERNS.exclusionMarker) continue;
          const cl = clauses[n.clause] || "";
          const ai = cl.indexOf(NEGATION_PATTERNS.exclusionMarker);
          const after = ai >= 0 ? cl.slice(ai + NEGATION_PATTERNS.exclusionMarker.length) : "";
          if (/(ないで|こないで|るな|ない|ずに)/.test(after)) { allowOnly = { target: n.target || null, verb: n.verb ?? null }; break; }
        }
      }
      return { kind: "clarify", target: null, amount: null, constraints, sideTasks: [], negations, unresolved, caps, allowOnly, returnTo, raw };
    }
    return { kind: "forbid", target: null, amount: null, constraints, sideTasks: [], negations, unresolved, caps, returnTo, raw };
  }

  // 5) 対象ゼロなら、護衛/おまかせ の単独指示だけ拾う
  if (candidates.length === 0) {
    if (FREE_RE.test(text)) {
      return { kind: "free", target: null, amount: null, constraints, sideTasks: [], negations, unresolved, returnTo, raw };
    }
    if (WATCH_RE.test(text) && !/[？?]/.test(text) && !/(たら|れば|の間|間だけ|間は)/.test(text)) {
      return { kind: "watch", target: null, amount: null, constraints, sideTasks: [], negations, unresolved, returnTo, raw };
    }
    if (ESCORT_RE.test(text) && !/[？?]/.test(text) && !/(たら|れば|の間|間だけ|間は)/.test(text)) {
      return { kind: "escort", target: null, amount: null, constraints, sideTasks: [], negations, unresolved, returnTo, raw };
    }
    return null;
  }

  // Phase 5: 訂正だけの句＋動詞も願望も無い肯定候補は、発話の訂正表明として聞き返す
  // （例:「鉄じゃない、銅だよ」。「鉄じゃない、銅を掘って」は動詞があるので通常注文）
  {
    const corrAlone = negations.find((n) => NEGATION_PATTERNS.correctionMarkers.includes(n.marker)
      && !(hitsPerClause[n.clause] || []).some((h) => !negResult.quarantinedHits?.has(h)));
    if (corrAlone && candidates.length > 0 && candidates.every((c) => c.clause !== corrAlone.clause && !c.verbClass) && !WANT_RE.test(text)) {
      const un = [{ slot: "target", reason: "correction_without_base", negations: [corrAlone] }];
      return { kind: "clarify", target: null, amount: null, constraints, sideTasks: [], negations, unresolved: un, retainedCandidates: candidates.map((c) => ({ target: c.target, amount: c.amount ?? null, verbClass: c.verbClass ?? null })), returnTo, raw };
    }
  }

  // Phase 5 F1 (cycle2231): 単一節の動詞なし訂正文 (「鉄じゃなくて銅にして」) は corrAlone の
  // 別節条件を満たせず消失していた。同型の聞き返しへ倒し、保持候補は最終候補1件のみとする。
  {
    const corrSame = negations.find((n) => NEGATION_PATTERNS.correctionMarkers.includes(n.marker));
    if (corrSame && candidates.length > 0 && candidates.every((c) => !c.verbClass) && !WANT_RE.test(text)) {
      const last = candidates[candidates.length - 1];
      const un = [{ slot: "target", reason: "correction_without_base", negations: [corrSame] }];
      return { kind: "clarify", target: null, amount: null, constraints, sideTasks: [], negations, unresolved: un, retainedCandidates: [{ target: last.target, amount: last.amount ?? null, verbClass: last.verbClass ?? null }], returnTo, raw };
    }
  }

  // 6) 発話トリガーが無ければ雑談（所持報告・感想などの誤判定防止）
  if (!anyVerb && !WANT_RE.test(text)) return null;

  // 6.5) 願望の独り言ガード: トリガーが「欲しい」だけで、依頼形（ください等）も
  // 動詞も数量も無く、独り言マーカー（なあ/すごく等）がある場合は呟きとして譲る。
  // 数量つきの正規の注文（「ラピスラズリ10個欲しい」）は数量があるため対象外。
  if (!anyVerb && DESIRE_RE.test(text) && !DIRECTED_REQUEST_RE.test(text)
    && candidates.every((c) => c?.amount == null) && SOLILOQUY_RE.test(text)) return null;

  // 7) 主目的の決定。「敵（総称）」候補は、素材側の主目的がある場合は制約 engage に化ける
  let mainIdx = candidates.findIndex((c) => !c.side);
  if (mainIdx < 0) mainIdx = 0;
  const hasMaterialMain = candidates.some((c, i) => i !== mainIdx && !c.generic);
  if (candidates[mainIdx].generic && hasMaterialMain) {
    if (constraints.hostiles === "default") constraints.hostiles = "engage";
    candidates.splice(mainIdx, 1);
    mainIdx = candidates.findIndex((c) => !c.side);
    if (mainIdx < 0) mainIdx = 0;
  }
  // 主目的以外の「敵（総称）」候補は捨てる（engage 化は上記と同じ）
  const rest = [];
  candidates.forEach((c, i) => {
    if (i === mainIdx) return;
    if (c.generic) {
      if (constraints.hostiles === "default") constraints.hostiles = "engage";
      return;
    }
    rest.push(c);
  });
  const main = candidates[mainIdx];

  // 8) kind の決定（動詞優先、無ければ対象の種類から推定）
  let kind;
  if (main.verbClass === "build") kind = "build";
  else if (main.verbClass === "hunt") kind = "hunt";
  else if (main.verbClass === "gather" || main.verbClass === "deliver") kind = "gather";
  else if (main.target.entity) kind = "hunt";
  else if (main.target.item == null && main.target.block == null && !main.target.entity) kind = "build";
  else kind = "gather";

  // 最終防衛線（手順8）: 否定 id が寄り道に残っていたら落とす。主対象は隔離済みが前提で、
  // 別句で肯定として再メンションされた場合はそちらを正として残す（a06 ガード裁定）。
  const negIds = new Set(negations.map((n) => n.target?.item ?? n.target?.block ?? n.target?.entity).filter(Boolean));
  const safeSides = rest.filter((c) => !negIds.has(c.target?.item ?? c.target?.block ?? c.target?.entity));

  // 0-C5 (cycle1256): 句をまたぐ数量訂正 (「石炭を10個、いや3個集めて」) は後勝ち。
  // 訂正側の句が別の候補を生んでいない場合だけ主数量へ反映する (対象訂正とは混ぜない)。
  let amountMeta = main.amountDetail ?? null;
  try {
    // cyc1743 0-C5 R-2: 訂正マーカーは「いや」「やっぱり」。同一句内の訂正も、
    // その句に別対象の候補が無い場合に限り主数量へ反映する (対象訂正とは混ぜない)。
    let corrIdx = -1, corrLen = 0;
    // cyc-next R-4(a01): 訂正辞は amount_math の CORRECTION_RE と単一の正に揃える。
    // 従来は ["やっぱり","いや"] の2種だけで、「訂正して3個」「まちがえた3個」が
    // 読点の有無によらず脱落し、「訂正0個」は 0個ガードにも届かなかった。
    for (const mk of ["やっぱり", "いや", "じゃなくて", "ではなく", "じゃなしに", "まちがえた", "訂正して", "訂正"]) { const ix = text.lastIndexOf(mk); if (ix > corrIdx) { corrIdx = ix; corrLen = mk.length; } }
    if (corrIdx >= 0) {
      const corrClause = splitClauses(text.slice(0, corrIdx)).length - 1;
      const mainId = main.target?.item ?? main.target?.block ?? main.target?.entity ?? null;
      const otherInClause = candidates.some((c) => c.clause === corrClause && (c.target?.item ?? c.target?.block ?? c.target?.entity ?? null) !== mainId);
      if (!otherInClause) {
        const parsed = amount_parse(text.slice(corrIdx + corrLen, corrIdx + corrLen + 18), { itemId: main.target?.item ?? main.target?.block ?? null });
        if (parsed && parsed.ok) { main.amount = parsed.total; amountMeta = { ...parsed, corrected: true }; }
      }
    }
  } catch { /* 訂正の反映失敗は従来数量のまま */ }

  // 0-C5 R-4 (v0.5.86): 反復前置の横断パス。句分割で「2回、」が数量句と別句に
  // 割れるため amountNear では拾えず、裸数字が「2」を数量化していた。全文で
  // 「NUM回 (分/繰り返し)? 、? QTYずつ」が主対象の句並びに現れ、後置反復が
  // 無い場合だけ、核 amount_parse の解釈 (前置反復) で主数量を組み直す。
  try {
    if (!(amountMeta && amountMeta.repeats != null)) {
      const preRe = new RegExp(`(?:\\d+|[一二三四五六七八九十]+)\\s*回\\s*(?:分|繰り返して|繰り返し)?\\s*[、,]?\\s*${QTY_TERM_SRC}\\s*ずつ`);
      const xm = text.match(preRe);
      if (xm) {
        const parsed = amount_parse(xm[0], { itemId: main.target?.item ?? main.target?.block ?? null });
        if (parsed && parsed.ok && parsed.repeats != null) { main.amount = parsed.total; amountMeta = parsed; }
      }
    }
  } catch { /* 前置反復の反映失敗は従来数量のまま */ }

  // 0-C5 R1G2 (cyc2157): 文頭の「あと」が対象メンションを挟む形 (「あと丸石を3個」) と
  // 数量節が対象句より前に出る形 (「あと3個、丸石を集めて」) の横断パス。amountNear は
  // hit 後方しか見ず、核 startRe はメンション挟みを認めないため、両形とも relative が
  // 落ち、後者は数量自体も落ちていた。文頭 (発話開始位置) の「あと」だけを対象とし、
  // 「あとで/あとに」(後刻の指定) は相対指定にしない。対象なし (「あと3個集めて」単独) は
  // candidates が無いため従来どおり注文不成立のまま。
  try {
    const atoHead = text.match(/^\s*あと(?![でに])\s*[、,]?\s*(?:もう\s*)?/);
    if (atoHead && amountMeta && !amountMeta.relative) {
      amountMeta = { ...amountMeta, relative: true };
      if (main.amountDetail) main.amountDetail = { ...main.amountDetail, relative: true };
    }
    if (atoHead && main.amount == null) {
      const seg = text.slice(atoHead[0].length, atoHead[0].length + 18);
      const parsed = amount_parse(seg, { itemId: main.target?.item ?? main.target?.block ?? null });
      if (parsed && parsed.ok && parsed.startable) { main.amount = parsed.total; amountMeta = { ...parsed, relative: true }; }
    }
    if (main.amount == null) {
      // 「丸石をあと、3個集めて」: 読点で句が割れ数量が対象句の外に出る形 (R1G2-c 亜型)
      const cm = text.match(new RegExp(`あと\\s*[、,]\\s*${QTY_PHRASE_RE.source}`));
      if (cm) {
        const parsed = amount_parse("あと" + cm[1], { itemId: main.target?.item ?? main.target?.block ?? null });
        if (parsed && parsed.ok && parsed.startable) { main.amount = parsed.total; amountMeta = { ...parsed, relative: true }; }
      }
    }
  } catch { /* 「あと」横断パスの失敗は従来数量のまま */ }

  // 0-C5 (cycle1256): 0個の指示は開始処理へ渡さない (聞き返しへ倒す)。
  if (main.amount === 0) {
    return { kind: "clarify", target: main.target, amount: 0, constraints, sideTasks: [], negations, unresolved: [...unresolved, { slot: "amount", reason: "zero_amount" }], caps, returnTo, raw };
  }
  // 0-C4 R-C4-3 (cyc2373): gather の主目標が生き物 (entity) になった注文は型不整合。
  // gather の対象はアイテム/ブロックであるべきで、entity が主目標の形は調達元が無く
  // 必ず行き詰まる (例: 「牛から牛乳を取って」→ gather/cow)。開始処理へ渡さず聞き返しへ倒す。
  // hunt の entity 目標は正規なので対象外。R-C4-4 (バケツ類の調達元) は含めない。
  if (kind === "gather" && main.target?.entity) {
    return { kind: "clarify", target: main.target, amount: main.amount ?? null, constraints, sideTasks: [], negations, unresolved: [...unresolved, { slot: "target", reason: "gather_target_is_entity" }], caps, returnTo, raw };
  }
  // 0-C2 R-C2-6 U6-1 (cyc2384): 肯定形「<主対象>だけ集めて/倒して」の限定を allowOnly として保持する。
  // 従来は否定形「X以外は〜しないで」からしか allowOnly が立たず、肯定形の限定は落ちていた。
  // 発火条件: 主対象のメンション直後が「だけ」、kind が gather/hunt、否定が無いこと
  // (「鉄は掘らずに石炭だけ…」は否定側が正で、二重に立てない)。数量接頭辞の「だけ」
  // (「10個だけ」) はメンション直後ではないため発火しない。条件節の「間だけ」は主対象の
  // メンション直後には来ない。永続化はしない (U6-2: 注文自身の制約としてのみ伝播する)。
  let allowOnlyPos = null;
  try {
    if ((kind === "gather" || kind === "hunt") && negations.length === 0) {
      const cl = clauses[main.clause] || "";
      const hs = hitsPerClause[main.clause] || [];
      const mid = main.target?.item ?? main.target?.block ?? main.target?.entity ?? null;
      if (mid) for (const h of hs) {
        const t = targetOf(h);
        const hid = t?.item ?? t?.block ?? t?.entity ?? null;
        if (hid === mid && cl.slice(h.end, h.end + 2) === "だけ") { allowOnlyPos = { target: main.target, verb: kind }; break; }
      }
    }
  } catch { allowOnlyPos = null; }
  return {
    kind,
    target: main.target,
    allowOnly: allowOnlyPos,
    amount: main.amount,
    amountMeta: amountMeta ? { perRun: amountMeta.perRun ?? null, repeats: amountMeta.repeats ?? null, relative: amountMeta.relative === true, corrected: amountMeta.corrected === true } : null,
    constraints,
    sideTasks: safeSides.slice(0, 2).map((c) => ({ target: c.target, amount: c.amount })),
    negations,
    unresolved,
    caps,
    tool: orderTool,
    placement: orderPlacement,
    returnTo,
    raw,
  };
}

// 統合・テスト用に辞書を公開する
export const MATERIALS = MATERIAL_DEFS.map(([id, type, name, aliases]) => ({ id, type, name, aliases }));
export const ENTITIES = ENTITY_DEFS.map(([id, name, aliases]) => ({ id, name, aliases }));
export default parseOrder;

// ============================================================
// Phase5 clarify 再開 (SPEC §1.5): 保持された聞き返しへの短い回答を解釈する純粋関数。
// 戻り値: {action:"cancelled"} | {action:"order", order, reason} | {action:"unmatched"}
// 深さ1: ここで作る order が再び clarify になる場合は呼び出し側が unmatched として扱う。
// ============================================================
const CLARIFY_CANCEL_RE = /やっぱいい|なんでもない|忘れて|キャンセル|中止|やめて/;
export function resumeClarifyOrder(pc, text) {
  if (!pc || typeof pc !== "object") return { action: "unmatched" };
  const t = String(text || "").trim();
  if (!t) return { action: "unmatched" };
  if (CLARIFY_CANCEL_RE.test(t)) return { action: "cancelled" };
  const cands = Array.isArray(pc.retainedCandidates) ? pc.retainedCandidates : [];
  const negIds = new Set((pc.negations || []).map((n) => n?.target?.item || n?.target?.block || n?.target?.entity).filter(Boolean));
  const candOrder = (c, amountOverride, metaOverride) => ({
    kind: c.verbClass || "gather",
    target: c.target || null,
    amount: amountOverride ?? c.amount ?? null,
    amountMeta: metaOverride ?? null,
    constraints: pc.known?.constraints || { hostiles: "default" },
    sideTasks: [],
    negations: pc.negations || [],
    unresolved: [],
    returnTo: pc.known?.returnTo || "owner",
    raw: t,
  });
  // 0-C5 U1: 聞き返し回答の数量解釈も純粋核 amount_parse へ一本化する (従来は独自正規表現で
  // スタック/半スタック/反復/相対/訂正が落ち、0個まで開始へ渡っていた)。
  const clarifyAmount = (cand) => {
    try {
      if (/つ目|１つ目|２つ目/.test(t)) return null; // R1: 序数回答 (1つ目/2つ目) を数量と読まない
      const tg = cand?.target || {};
      const r = amount_parse(t, { itemId: tg.item ?? tg.block ?? null });
      if (!r) return null;
      if (r.ok && r.total === 0) return { zero: true };
      if (r.ok) return { amount: r.total, amountMeta: { perRun: r.perRun ?? null, repeats: r.repeats ?? null, relative: r.relative === true, corrected: r.corrected === true } };
      if (r.reason === "zero") return { zero: true };
    } catch { /* 核の失敗は数量なしとして従来経路へ */ }
    return null;
  };
  // 数量のみの回答は候補1件のときだけその候補へ数量を補う (数量形は核が解釈する)
  const QTY_ONLY_RE = /^(あと)?((半|はん)スタック|(\d+(?:\.\d+)?|[\d０-９]+|[一二三四五六七八九十]+|ゼロ|零)(スタック|個|つ|本|枚|体|匹))(と(\d+|[\d０-９]+|[一二三四五六七八九十]+)(個|つ|本|枚|体|匹))*(ずつ(\d+|[\d０-９]+|[一二三四五六七八九十]+)回)?$/;
  if (cands.length === 1 && cands[0]?.target && QTY_ONLY_RE.test(t.replace(/[、。\s]/g, ""))) {
    const ca = clarifyAmount(cands[0]);
    if (ca?.zero) return { action: "unmatched" };
    if (ca) return { action: "order", reason: "answered", order: candOrder(cands[0], ca.amount, ca.amountMeta) };
  }
  // 回答文中の数量（候補指定と一緒に言われた数量を落とさない。cycle0202 a14 H-1）
  const amtMatch = /つ目/.test(t) ? null : t.match(/(\d+|[一二三四五六七八九十]+)\s*(個|つ|本|枚|体|匹)/);
  const amtInText = amtMatch ? amountValue(amtMatch[1], amtMatch[2]) : null;
  const amtFor = (cand) => { const ca = clarifyAmount(cand); return ca?.zero ? { zero: true } : ca; };
  // 候補の直接指定（名前/id の部分一致＋辞書の通称解決、序数、肯定）
  // cycle0202 a08/a14: 正式名フル一致だけでは通称短答（「銅」）が当たらず、
  // 否定つき指定（「XじゃなくてY」）では否定された側が最後一致で勝つ欠陥があった。
  let hits = [];
  try { hits = scanMentions(t, [MATERIAL_INDEX, ENTITY_INDEX]); } catch { hits = []; }
  const matched = [];
  cands.forEach((c, i) => {
    const tg = c?.target || {};
    const id = tg.item || tg.block || tg.entity;
    let pos = tg.name ? t.indexOf(tg.name) : -1;
    if (pos < 0 && id) pos = t.indexOf(id);
    if (pos < 0 && id) { const h = hits.find((x) => (targetOf(x).item || targetOf(x).block || targetOf(x).entity) === id); if (h) pos = h.start; }
    if (pos >= 0) matched.push({ i, pos });
  });
  // 否定マーカーより前にだけ現れる候補は、後ろに別の候補がある場合は否定された側として落とす
  const markerPos = (() => { const m = t.match(/じゃなくて|じゃない|ではなく|じゃなしに/); return m ? m.index : -1; })();
  let pool = matched;
  if (markerPos >= 0 && matched.some((m) => m.pos > markerPos)) pool = matched.filter((m) => m.pos > markerPos);
  let idx = pool.length ? pool[pool.length - 1].i : -1;
  if (idx < 0 && /(1つ目|１つ目|最初|前者)/.test(t) && cands.length >= 1) idx = 0;
  if (idx < 0 && /(2つ目|２つ目|あっち|そっち|後者)/.test(t) && cands.length >= 2) idx = 1;
  // 発話側は候補2件でも先頭候補への yes/no を聞く形のため、肯定は先頭候補を選ぶ（a08 確定バグ2）
  if (idx < 0 && cands.length >= 1 && /^(うん|はい|それでいい|それで|了解|おｋ|ok)/i.test(t)) idx = 0;
  if (idx >= 0 && cands[idx]?.target) { const ca = amtFor(cands[idx]); if (ca?.zero) return { action: "unmatched" }; return { action: "order", reason: "answered", order: candOrder(cands[idx], ca ? ca.amount : amtInText, ca?.amountMeta ?? null) }; }
  // 候補名を含む完全でない回答（例: 「銅10個」）は候補照合で拾う。それ以外は新規発話として再パース
  let parsed = null;
  try { parsed = parseOrder(t); } catch { parsed = null; }
  if (parsed && parsed.kind !== "clarify" && parsed.target) {
    const tid = parsed.target?.item || parsed.target?.block || parsed.target?.entity;
    if (!negIds.has(tid)) {
      const merged = [...(pc.negations || [])];
      for (const n of parsed.negations || []) if (!merged.some((m) => (m?.target?.item || m?.target?.block || m?.target?.entity) === (n?.target?.item || n?.target?.block || n?.target?.entity))) merged.push(n);
      return { action: "order", reason: "superseded", order: { ...parsed, negations: merged } };
    }
    return { action: "order", reason: "superseded", order: parsed };
  }
  // cycle0202 a08 確定バグ1: excluded_only は候補0件で保持されるため、短答経路が
  // 全て不成立だった。発話側が誘導する「名前だけの回答」をここで受理する:
  // 辞書で一意に引け、否定対象でない対象が1件だけ言及されていれば注文化する。
  {
    const seen = new Map();
    for (const h of hits) {
      const tg = targetOf(h);
      const id = tg.item || tg.block || tg.entity;
      if (id && !negIds.has(id)) seen.set(id, tg);
    }
    if (seen.size === 1) {
      const tg = [...seen.values()][0];
      const ca = amtFor({ target: tg });
      if (ca?.zero) return { action: "unmatched" };
      return { action: "order", reason: "answered", order: {
        kind: tg.entity ? "hunt" : "gather", target: tg, amount: ca ? ca.amount : amtInText, amountMeta: ca?.amountMeta ?? null,
        constraints: pc.known?.constraints || { hostiles: "default" }, sideTasks: [],
        negations: pc.negations || [], unresolved: [], returnTo: pc.known?.returnTo || "owner", raw: t,
      } };
    }
  }
  return { action: "unmatched" };
}

// ============================================================
// cycle1640: 聞き返し保持の限定破棄判定 (純粋関数)。unmatched の発話が
// 「回答試行の失敗」か「会話の挟み言葉」かを分け、破棄は前者が2回連続した時だけ。
// 戻り値: "keep" | "strike" | "discard"。strikes は呼び出し側が保持する (同一保持での連続外れ回数)。
// ============================================================
const CLARIFY_SOCIAL_RE = /ありがとう|ごめん|すまん|笑|すごい|すごっ|えらい|ないす|ナイス|かわいい|さすが/;
const CLARIFY_ANSWERISH_RE = /それ|あれ|こっち|そっち|じゃない|じゃなく|ではなく|いらない|要らない|不要|個|つ|本|枚|番目|目$/;
export function classifyClarifyUnmatched(pc, text, und, strikes) {
  try {
    const t = String(text || "").trim();
    if (!t) return "keep";
    const f = (und && und.features) || {};
    if (f.isQuestion === true || /[？?]$/.test(t) || /(か|かな|かしら)$/.test(t)) return "keep"; // K1 質問形
    if (f.isGreeting === true || f.praise === true || CLARIFY_SOCIAL_RE.test(t)) return "keep"; // K2 社交
    const len = t.replace(/[\s、。,.!！]/g, "").length;
    if (len > 12) return "keep"; // K3 長文
    const cands = pc && Array.isArray(pc.retainedCandidates) ? pc.retainedCandidates : [];
    if (((!cands.length) || (pc && pc.reason === "excluded_only")) && /^(うん|はい|そう|ええ|おｋ|ok)/i.test(t)) return "keep"; // K4 候補0件への肯定
    const answerish = len <= 12 && (CLARIFY_ANSWERISH_RE.test(t) || /[0-9０-９]/.test(t) || len <= 6);
    if (answerish && (strikes || 0) >= 1) return "discard"; // D1: 回答試行の外れが2回連続
    if (answerish) return "strike"; // 回答試行の外れ1回目: 保持しつつ数える
    return "keep"; // K6 既定は保持
  } catch { return "keep"; }
}
