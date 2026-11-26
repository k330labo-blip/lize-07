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
const QTY_PHRASE_RE = /((?:半|はん)スタック|(?:\d+(?:\.\d+)?|[一二三四五六七八九十]+|ゼロ|零)\s*(?:スタック|個|本|枚|つ|体|匹|組|セット|箱)(?:と\s*(?:\d+|[一二三四五六七八九十]+)\s*(?:個|本|枚|つ|体|匹))?(?:ずつ\s*(?:\d+|[一二三四五六七八九十]+)\s*回)?)/;
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
  const am = after.match(new RegExp(`^[のがをもは]?(?:だけ)?\\s*(あと)?\\s*${QTY_PHRASE_RE.source}`));
  if (am) { const v = parsePhrase((am[1] || "") + am[2]); if (v != null) return v; }
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
  ["hunt", ["倒し", "倒せ", "殺し", "殺せ", "狩っ", "やっつけ", "退治", "討伐"]],
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
const ESCORT_RE = /ついてきて|付いてきて|ついて来て|一緒に来て|一緒について|こっち来て|護衛|守って|案内して/;
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
    const m = String(text ?? "").match(/^([^、。]{2,16}?(?:たら|なったら|になったら|降ったら|ている間|てる間))、?(.*)$/);
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
    return { raw: seg, kind };
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
    return null;
  } catch { return null; }
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
  const clauses = text.split(/[、。,.!?！？]/).filter((s) => s.length > 0);
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
    if (!orderPlacement) { const pl = nonOrder ? null : placementOf(clause, anchorInfo); if (pl) orderPlacement = pl; }
    let first = true;
    for (const hit of hits) {
      if (negResult.quarantinedHits?.has(hit)) continue; // 否定側は候補にしない
      if (toolInfo && hit === toolInfo.hit) continue; // 0-C4: 道具は対象にしない
      if (anchorInfo && hit === anchorInfo.hit) continue; // 0-C4: 設置アンカーは対象にしない
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
    if (ESCORT_RE.test(text)) {
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
    const corrIdx = text.lastIndexOf("いや");
    if (corrIdx >= 0) {
      const corrClause = text.slice(0, corrIdx).split(/[、。,.!?！？]/).length - 1;
      if (!candidates.some((c) => c.clause === corrClause)) {
        const parsed = amount_parse(text.slice(corrIdx + 2, corrIdx + 18), { itemId: main.target?.item ?? main.target?.block ?? null });
        if (parsed && parsed.ok) { main.amount = parsed.total; amountMeta = { ...parsed, corrected: true }; }
      }
    }
  } catch { /* 訂正の反映失敗は従来数量のまま */ }

  // 0-C5 (cycle1256): 0個の指示は開始処理へ渡さない (聞き返しへ倒す)。
  if (main.amount === 0) {
    return { kind: "clarify", target: main.target, amount: 0, constraints, sideTasks: [], negations, unresolved: [...unresolved, { slot: "amount", reason: "zero_amount" }], caps, returnTo, raw };
  }
  return {
    kind,
    target: main.target,
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
  const candOrder = (c, amountOverride) => ({
    kind: c.verbClass || "gather",
    target: c.target || null,
    amount: amountOverride ?? c.amount ?? null,
    constraints: pc.known?.constraints || { hostiles: "default" },
    sideTasks: [],
    negations: pc.negations || [],
    unresolved: [],
    returnTo: pc.known?.returnTo || "owner",
    raw: t,
  });
  // 数量のみの回答（例: 「10個」）は候補1件のときだけその候補へ数量を補う
  const amtOnly = t.replace(/[、。\s]/g, "").match(/^(\d+)(個|つ)?$/);
  if (amtOnly && cands.length === 1 && cands[0]?.target) {
    return { action: "order", reason: "answered", order: candOrder(cands[0], Number(amtOnly[1])) };
  }
  // 回答文中の数量（候補指定と一緒に言われた数量を落とさない。cycle0202 a14 H-1）
  const amtMatch = t.match(/(\d+|[一二三四五六七八九十]+)\s*(個|つ|本|枚|体|匹)/);
  const amtInText = amtMatch ? amountValue(amtMatch[1], amtMatch[2]) : null;
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
  if (idx >= 0 && cands[idx]?.target) return { action: "order", reason: "answered", order: candOrder(cands[idx], amtInText) };
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
      return { action: "order", reason: "answered", order: {
        kind: tg.entity ? "hunt" : "gather", target: tg, amount: amtInText,
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
