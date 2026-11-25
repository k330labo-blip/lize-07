// リゼ (LIZE-07) 理解エンジン — チャット入力の正規化と特徴抽出
// 純粋JS。@minecraft/server には依存しない。統合時は BP/scripts/ へコピーして使う想定。
//
// 位置づけ（PyBot の understanding 層の日本語版）:
//   チャット入力はまず本モジュールで「正規化＋特徴抽出」してから、
//   指示パーサ（order_parser）・実況QA・知識ベース・チャット反応へ渡す。
//   表記ゆれ・タイプミス・スラングをここで吸収し、下流は正規形だけを見ればよい。
//
// understand(text) の返り値:
//   {
//     raw,                       // 入力そのまま
//     normalized,                // 正規化済み文字列（幅統一・別名寄せ・誤字補正・長音/促音ゆれ吸収）
//     clauses: [string],         // 複合文を句に割ったもの（normalized ベース）
//     tokens: {
//       materials: [{id, name, matched}],   // 素材（id は order_parser の MATERIALS と互換）
//       numbers:   [{value, text}],          // 数値（漢数字・スタック換算つき）
//       verbs:     [{verb, tag, matched}],   // 動詞（verb=正規形, tag=意味タグ）
//       constraints: [{kind, value, text}],  // 制約（hostiles は order_parser と同じ値域）
//       slang:     [{word, tag, text}],      // スラング（意味タグつき）
//     },
//     features: {
//       isQuestion, isOrder, isGreeting,
//       sentiment: 'pos'|'neg'|'neu',
//       hasReference,              // それ/あれ/さっき 等の指示語・省略参照を含むか
//       praise,                    // 褒め・照れ誘発（かわいい/さすが/ありがとう/スラングpraise）。
//                                  // 後段の soft 変換・ランプ表現の判断材料。pos 感情とは別軸
//     },
//   }
//
// 同義語辞書 SYNONYMS は他モジュール（order_parser / mc_knowledge 等）が import して使う。
// 形式: [{ canonical, kind, variants: [..] }]。canonicalizeTerm(word) で1語の寄せも可能。

// ---------------------------------------------------------------- 幅・かな変換

const HALF_KANA = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝｧｨｩｪｫｯｬｭｮｰ";
const FULL_KANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォッャュョー";
const DAKU_BASE = "カキクケコサシスセソタチツテトハヒフヘホウ";
const DAKU_FULL = "ガギグゲゴザジズゼゾダヂヅデドバビブベボヴ";
const HANDAKU_BASE = "ハヒフヘホ";
const HANDAKU_FULL = "パピプペポ";

function unifyWidth(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = s.charCodeAt(i);
    // 全角英数・記号 → 半角
    if (code >= 0xff01 && code <= 0xff5e) { out += String.fromCharCode(code - 0xfee0); continue; }
    if (code === 0x3000) { out += " "; continue; }
    // 半角カナ → 全角カナ（濁点・半濁点の合成つき）
    const ki = HALF_KANA.indexOf(ch);
    if (ki >= 0) {
      let base = FULL_KANA[ki];
      const next = s[i + 1];
      if (next === "ﾞ") {
        const di = DAKU_BASE.indexOf(base);
        if (di >= 0) { base = DAKU_FULL[di]; i++; }
      } else if (next === "ﾟ") {
        const hi = HANDAKU_BASE.indexOf(base);
        if (hi >= 0) { base = HANDAKU_FULL[hi]; i++; }
      }
      out += base; continue;
    }
    out += ch;
  }
  return out;
}

// カタカナ → ひらがな（読み寄せ・照合用）
export function kataToHira(s) {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// 長音・促音・繰り返しのゆれ吸収（照合用の読み文字列を作る）
// 例: ダイヤー→ダイヤ / すっごい→すごい寄せの前段 / おっけー→おけー
function yureKey(s) {
  let h = kataToHira(s);
  h = h.replace(/ー/g, "");          // 長音を落とす（ダイヤー/ダイヤ を同一視）
  h = h.replace(/っ/g, "");          // 促音を落とす（ピッケル/ピケル を同一視）
  h = h.replace(/(.)\1+/g, "$1");    // 連続同一かな圧縮（すごーい等の伸ばし対策の下地）
  return h;
}

// ---------------------------------------------------------------- 同義語辞書
// kind: material | tool | block | mob | concept | place | food | action
// variants には表記ゆれ・読み・略称・英語寄せを含める。canonical が正規形。

export const SYNONYMS = [
  // --- 鉱物・素材 ---
  { canonical: "ダイヤモンド", kind: "material", variants: ["ダイヤ", "ダイア", "だいや", "ダイヤモンド", "ダイアモンド", "dia", "diamond"] },
  { canonical: "ダイヤモンド鉱石", kind: "material", variants: ["ダイヤ鉱石", "ダイヤモンド鉱石", "ダイヤの鉱石"] },
  { canonical: "鉄", kind: "material", variants: ["鉄", "てつ", "アイアン", "鉄インゴット", "iron"] },
  { canonical: "鉄鉱石", kind: "material", variants: ["鉄鉱石", "鉄の鉱石"] },
  { canonical: "金", kind: "material", variants: ["金", "きん", "ゴールド", "金インゴット", "gold"] },
  { canonical: "金鉱石", kind: "material", variants: ["金鉱石", "金の鉱石"] },
  { canonical: "銅", kind: "material", variants: ["銅", "どう", "カッパー", "銅インゴット", "copper"] },
  { canonical: "石炭", kind: "material", variants: ["石炭", "せきたん", "コール", "coal"] },
  { canonical: "石炭鉱石", kind: "material", variants: ["石炭鉱石"] },
  { canonical: "レッドストーン", kind: "material", variants: ["レッドストーン", "赤石", "レッドストーンダスト", "redstone"] },
  { canonical: "ラピスラズリ", kind: "material", variants: ["ラピスラズリ", "ラピス", "瑠璃"] },
  { canonical: "エメラルド", kind: "material", variants: ["エメラルド", "エメ", "emerald"] },
  { canonical: "ネザライト", kind: "material", variants: ["ネザライト", "ネザライトインゴット", "netherite"] },
  { canonical: "古代の残骸", kind: "material", variants: ["古代の残骸", "残骸", "古代のざんがい", "デブリ"] },
  { canonical: "ネザークォーツ", kind: "material", variants: ["ネザークォーツ", "クォーツ", "石英", "quartz"] },
  { canonical: "アメジスト", kind: "material", variants: ["アメジスト", "アメジストの欠片", "紫水晶"] },
  { canonical: "黒曜石", kind: "material", variants: ["黒曜石", "こくようせき", "オブシディアン", "obsidian"] },
  { canonical: "グロウストーン", kind: "material", variants: ["グロウストーン", "グローストーン"] },
  { canonical: "原木", kind: "material", variants: ["原木", "げんぼく", "まるた", "丸太", "ログ", "log"] },
  { canonical: "板材", kind: "material", variants: ["板材", "木の板", "木材", "もくざい", "プランク"] },
  { canonical: "棒", kind: "material", variants: ["棒", "ぼう", "スティック"] },
  { canonical: "丸石", kind: "material", variants: ["丸石", "まるいし", "コブルストーン", "コブル"] },
  { canonical: "石", kind: "material", variants: ["石", "いし", "ストーン"] },
  { canonical: "深層岩", kind: "material", variants: ["深層岩", "しんそうがん", "ディープスレート"] },
  { canonical: "砂", kind: "material", variants: ["砂", "すな", "サンド"] },
  { canonical: "砂利", kind: "material", variants: ["砂利", "じゃり", "グラベル"] },
  { canonical: "土", kind: "material", variants: ["土", "つち", "ダート"] },
  { canonical: "ガラス", kind: "material", variants: ["ガラス", "硝子", "がらす"] },
  { canonical: "羊毛", kind: "material", variants: ["羊毛", "ようもう", "ウール", "毛糸"] },
  { canonical: "糸", kind: "material", variants: ["糸", "いと", "ストリング"] },
  { canonical: "革", kind: "material", variants: ["革", "かわ", "レザー"] },
  { canonical: "羽", kind: "material", variants: ["羽", "はね", "フェザー"] },
  { canonical: "卵", kind: "material", variants: ["卵", "たまご", "タマゴ"] },
  { canonical: "骨", kind: "material", variants: ["骨", "ほね", "ボーン"] },
  { canonical: "骨粉", kind: "material", variants: ["骨粉", "こっぷん", "ボーンミール"] },
  { canonical: "火薬", kind: "material", variants: ["火薬", "かやく", "ガンパウダー"] },
  { canonical: "松明", kind: "material", variants: ["松明", "たいまつ", "トーチ", "torch"] },
  { canonical: "種", kind: "material", variants: ["種", "たね", "小麦の種"] },
  { canonical: "小麦", kind: "material", variants: ["小麦", "こむぎ"] },
  { canonical: "パン", kind: "food", variants: ["パン", "ぱん"] },
  { canonical: "肉", kind: "food", variants: ["肉", "にく", "焼き肉", "ステーキ"] },
  { canonical: "食料", kind: "food", variants: ["食料", "食べ物", "ごはん", "飯", "めし", "フード"] },
  { canonical: "牛乳", kind: "food", variants: ["牛乳", "ぎゅうにゅう", "ミルク"] },
  { canonical: "水", kind: "material", variants: ["水", "みず", "ウォーター"] },
  { canonical: "溶岩", kind: "material", variants: ["溶岩", "ようがん", "マグマ", "ラバ"] },
  { canonical: "氷", kind: "material", variants: ["氷", "こおり", "アイス"] },
  { canonical: "雪", kind: "material", variants: ["雪", "ゆき", "スノー"] },
  { canonical: "経験値", kind: "concept", variants: ["経験値", "けいけんち", "XP", "経験"] },
  // --- 道具 ---
  { canonical: "ツルハシ", kind: "tool", variants: ["ツルハシ", "つるはし", "ピッケル", "ピケル", "pickaxe"] },
  { canonical: "斧", kind: "tool", variants: ["斧", "おの", "アックス", "axe"] },
  { canonical: "シャベル", kind: "tool", variants: ["シャベル", "スコップ", "しゃべる"] },
  { canonical: "クワ", kind: "tool", variants: ["クワ", "鍬", "くわ"] },
  { canonical: "剣", kind: "tool", variants: ["剣", "けん", "ソード", "sword"] },
  { canonical: "弓", kind: "tool", variants: ["弓", "ゆみ", "ボウ"] },
  { canonical: "矢", kind: "tool", variants: ["矢", "や", "アロー"] },
  { canonical: "盾", kind: "tool", variants: ["盾", "たて", "シールド"] },
  { canonical: "ハサミ", kind: "tool", variants: ["ハサミ", "はさみ", "鋏"] },
  { canonical: "釣竿", kind: "tool", variants: ["釣竿", "釣り竿", "つりざお"] },
  { canonical: "バケツ", kind: "tool", variants: ["バケツ", "ばけつ"] },
  { canonical: "ベッド", kind: "block", variants: ["ベッド", "寝床", "寝具"] },
  { canonical: "チェスト", kind: "block", variants: ["チェスト", "箱", "はこ", "収納箱", "宝箱"] },
  { canonical: "かまど", kind: "block", variants: ["かまど", "竈", "溶鉱炉", "燻製器"] },
  { canonical: "作業台", kind: "block", variants: ["作業台", "クラフト台", "クラフティングテーブル"] },
  { canonical: "エンチャントテーブル", kind: "block", variants: ["エンチャントテーブル", "エンチャ台", "付与台"] },
  { canonical: "金床", kind: "block", variants: ["金床", "かなとこ", "アンビル"] },
  { canonical: "地図", kind: "tool", variants: ["地図", "ちず", "マップ"] },
  { canonical: "コンパス", kind: "tool", variants: ["コンパス", "方位磁石"] },
  { canonical: "エリトラ", kind: "tool", variants: ["エリトラ", "鞘翅"] },
  { canonical: "トーテム", kind: "tool", variants: ["トーテム", "不死のトーテム"] },
  // --- 概念・作業 ---
  { canonical: "湧き潰し", kind: "concept", variants: ["湧き潰し", "湧きつぶし", "わきつぶし", "スポーン防止", "湧き止め"] },
  { canonical: "ブランチマイニング", kind: "concept", variants: ["ブランチマイニング", "ブラマイ", "魚骨掘り"] },
  { canonical: "エンチャント", kind: "concept", variants: ["エンチャント", "エンチャ", "付与"] },
  { canonical: "精錬", kind: "concept", variants: ["精錬", "せいれん", "焼く", "焼成"] },
  { canonical: "拠点", kind: "place", variants: ["拠点", "きょてん", "ベース", "家", "本拠地", "うち"] },
  { canonical: "洞窟", kind: "place", variants: ["洞窟", "どうくつ", "ケーブ", "穴"] },
  { canonical: "鉱石", kind: "concept", variants: ["鉱石", "こうせき", "オア", "鉱脈"] },
  { canonical: "畑", kind: "place", variants: ["畑", "はたけ", "農場", "ファーム"] },
  { canonical: "体力", kind: "concept", variants: ["体力", "たいりょく", "HP", "ライフ", "ハート"] },
  { canonical: "空腹", kind: "concept", variants: ["空腹", "満腹度", "お腹", "おなか", "空腹度"] },
  { canonical: "ポータル", kind: "block", variants: ["ポータル", "ゲート", "ネザーゲート"] },
  { canonical: "要塞", kind: "place", variants: ["要塞", "ようさい", "フォートレス", "ネザー要塞"] },
  { canonical: "村", kind: "place", variants: ["村", "むら", "村落"] },
  // --- 次元・時間 ---
  { canonical: "ネザー", kind: "place", variants: ["ネザー", "地獄", "ねざー"] },
  { canonical: "エンド", kind: "place", variants: ["エンド", "ジ・エンド", "終界"] },
  { canonical: "夜", kind: "concept", variants: ["夜", "よる", "夜中", "深夜"] },
  { canonical: "朝", kind: "concept", variants: ["朝", "あさ", "夜明け"] },
  // --- モブ ---
  { canonical: "ゾンビ", kind: "mob", variants: ["ゾンビ", "ぞんび", "zombie"] },
  { canonical: "スケルトン", kind: "mob", variants: ["スケルトン", "ガイコツ", "がいこつ", "すけさん", "骨弓"] },
  { canonical: "クリーパー", kind: "mob", variants: ["クリーパー", "くりーぱー", "爆弾魔"] },
  { canonical: "クモ", kind: "mob", variants: ["クモ", "蜘蛛", "くも", "スパイダー"] },
  { canonical: "エンダーマン", kind: "mob", variants: ["エンダーマン", "エンダー"] },
  { canonical: "スライム", kind: "mob", variants: ["スライム", "すらいむ"] },
  { canonical: "ウィッチ", kind: "mob", variants: ["ウィッチ", "魔女", "まじょ"] },
  { canonical: "ブレイズ", kind: "mob", variants: ["ブレイズ", "ぶれいず"] },
  { canonical: "ガスト", kind: "mob", variants: ["ガスト", "がすと"] },
  { canonical: "ウィザー", kind: "mob", variants: ["ウィザー", "うぃざー"] },
  { canonical: "エンダードラゴン", kind: "mob", variants: ["エンダードラゴン", "エンドラ", "ドラゴン"] },
  { canonical: "ウォーデン", kind: "mob", variants: ["ウォーデン", "うぉーでん"] },
  { canonical: "村人", kind: "mob", variants: ["村人", "むらびと", "村の人"] },
  { canonical: "羊", kind: "mob", variants: ["羊", "ひつじ", "ヒツジ"] },
  { canonical: "牛", kind: "mob", variants: ["牛", "うし", "ウシ"] },
  { canonical: "豚", kind: "mob", variants: ["豚", "ぶた", "ブタ"] },
  { canonical: "鶏", kind: "mob", variants: ["鶏", "にわとり", "ニワトリ", "鳥"] },
  { canonical: "馬", kind: "mob", variants: ["馬", "うま", "ウマ"] },
  { canonical: "猫", kind: "mob", variants: ["猫", "ねこ", "ネコ"] },
  { canonical: "オオカミ", kind: "mob", variants: ["オオカミ", "犬", "いぬ", "狼"] },
  { canonical: "ミツバチ", kind: "mob", variants: ["ミツバチ", "蜂", "はち", "ビー"] },
  { canonical: "アイアンゴーレム", kind: "mob", variants: ["アイアンゴーレム", "ゴーレム", "鉄のゴーレム"] },
];

// canonical → エントリ、variant（ゆれキー）→ canonical の索引
const SYN_BY_CANONICAL = new Map(SYNONYMS.map((e) => [e.canonical, e]));
const SYN_BY_YURE = new Map();
for (const e of SYNONYMS) {
  for (const v of e.variants) {
    const k = yureKey(v);
    if (!SYN_BY_YURE.has(k)) SYN_BY_YURE.set(k, e.canonical);
  }
  const ck = yureKey(e.canonical);
  if (!SYN_BY_YURE.has(ck)) SYN_BY_YURE.set(ck, e.canonical);
}

/** 1語を同義語辞書で正規形に寄せる。見つからなければ null。 */
export function canonicalizeTerm(word) {
  if (!word) return null;
  const w = unifyWidth(String(word)).trim();
  if (SYN_BY_CANONICAL.has(w)) return w;
  return SYN_BY_YURE.get(yureKey(w)) ?? null;
}

// テキスト内の同義語を最長一致で canonical に置換する（normalized 生成用）
// 置換対象は canonical と異なる variant のみ。長い variant から順に処理する。
// テキスト置換の拒否リスト: 通常語に埋没して誤置換する短い別名。
// かわ(かわいい/川), きん(最近), いし(おいしい), たて(立てて), はこ(運ぶ), ぼう(冒険), うち(内)
// これらは canonicalizeTerm の照合では使うが、本文の置換では使わない。
const REPLACE_DENYLIST = new Set(["かわ", "きん", "いし", "たて", "はこ", "ぼう", "うち"]);
const REPLACE_VARIANTS = [];
for (const e of SYNONYMS) {
  for (const v of e.variants) {
    // 1文字の別名（や=矢 等）は通常語を壊す（やばい→矢ばい）ので置換対象から外す。照合（canonicalizeTerm）では使う。
    if (v !== e.canonical && v.length >= 2 && !REPLACE_DENYLIST.has(v) && /^[^a-zA-Z]+$/.test(v)) REPLACE_VARIANTS.push([v, e.canonical]);
  }
}
REPLACE_VARIANTS.sort((a, b) => b[0].length - a[0].length);

// canonical 自身も照合対象に入れる（マッチしたらそのまま保持＝保護）。
// これにより「ダイヤモンド」の中の「ダイヤ」が再置換されて二重化する事故を防ぐ。
const SCAN_MATCHERS = [];
for (const e of SYNONYMS) {
  if (e.canonical.length >= 2 && /^[^a-zA-Z]+$/.test(e.canonical)) SCAN_MATCHERS.push([e.canonical, e.canonical]);
}
for (const [v, c] of REPLACE_VARIANTS) SCAN_MATCHERS.push([v, c]);
SCAN_MATCHERS.sort((a, b) => b[0].length - a[0].length);

function applySynonyms(s) {
  // 左から右へ1パス走査。各位置で最長一致（canonical=保持 / variant=canonicalへ置換）。
  // 置換結果を再走査しないので、置換の連鎖・二重化が起きない。
  let out = "";
  let i = 0;
  while (i < s.length) {
    let hit = null;
    for (const [pat, rep] of SCAN_MATCHERS) {
      if (s.startsWith(pat, i)) { hit = [pat, rep]; break; }
    }
    if (hit) { out += hit[1]; i += hit[0].length; }
    else { out += s[i]; i++; }
  }
  return out;
}

// ---------------------------------------------------------------- タイプミス補正
// 編集距離ではなく「よくある脱字・転置・読み違い」の辞書式補正。
// [誤り, 正] 。正規化の最終段で適用する（同義語寄せで拾えない形だけを置く）。

const TYPO_FIXES = [
  [/ダイヤモン(?!ド)/g, "ダイヤモンド"], [/ダイアモン(?!ド)/g, "ダイヤモンド"], ["ダイヤモンドウ", "ダイヤモンド"],
  ["つるはしし", "ツルハシ"], ["ツルハシシ", "ツルハシ"],
  ["ピッケルル", "ピッケル"], ["ぴっける", "ピッケル"],
  ["まいんくらふと", "マインクラフト"], ["マイクラフト", "マインクラフト"],
  ["くりーぱ", "クリーパー"], ["スケルトトン", "スケルトン"],
  ["チェストト", "チェスト"], ["かまどど", "かまど"],
  ["てつこうせき", "鉄鉱石"], ["だいやこうせき", "ダイヤモンド鉱石"],
  ["ひつじじ", "羊"], ["うしし", "牛"],
  ["掘ってきてて", "掘ってきて"], ["集めてて", "集めて"],
  ["持ってきてて", "持ってきて"], ["ついてきてて", "ついてきて"],
  ["くださいい", "ください"], ["ほしいい", "ほしい"],
  ["おはよ", "おはよう"], ["おはよー", "おはよう"],
  ["ありがと", "ありがとう"], ["ありがとうございま", "ありがとうございます"],
  ["つかれたあ", "つかれた"], ["ねむいい", "ねむい"],
  ["わきつぶしし", "湧き潰し"],
];

function applyTypoFixes(s) {
  let out = s;
  for (const [bad, good] of TYPO_FIXES) {
    if (bad instanceof RegExp) out = out.replace(bad, good);
    else if (out.includes(bad)) out = out.split(bad).join(good);
  }
  return out;
}

// ---------------------------------------------------------------- スラング
// [語, 意味タグ] 。tag: ok(了解) / emphasis(強調) / intense(強い感情・良し悪し両用)
// laugh(笑い) / praise(称賛) / tired(疲労) / greet(挨拶) / thanks(感謝) / sorry(謝罪)

export const SLANG = [
  ["まじで", "emphasis"], ["まじ", "emphasis"], ["マジ", "emphasis"],
  ["やばい", "intense"], ["ヤバい", "intense"], ["やば", "intense"],
  ["えぐい", "intense"], ["エグい", "intense"],
  ["おけ", "ok"], ["おｋ", "ok"], ["オケ", "ok"], ["ok", "ok"],
  ["りょ", "ok"], ["りょうかい", "ok"], ["了解", "ok"], ["らじゃ", "ok"],
  ["草", "laugh"], ["ｗｗｗ", "laugh"], ["www", "laugh"], ["ワロタ", "laugh"],
  ["神", "praise"], ["つよい", "praise"], ["つよ", "praise"], ["最強", "praise"],
  ["すごい", "praise"], ["すご", "praise"], ["えらい", "praise"],
  ["しんどい", "tired"], ["つかれた", "tired"], ["疲れた", "tired"], ["ねむい", "tired"], ["眠い", "tired"],
  ["おは", "greet"], ["こんちゃ", "greet"], ["おつ", "greet"], ["おつかれ", "greet"],
  ["あり", "thanks"], ["あざ", "thanks"], ["あざます", "thanks"], ["サンキュ", "thanks"],
  ["ごめん", "sorry"], ["すまん", "sorry"], ["わりい", "sorry"],
  ["ないす", "praise"], ["ナイス", "praise"],
  ["だるい", "tired"], ["めんどい", "tired"],
  ["きつい", "intense"], ["つらい", "intense"],
  ["わからん", "unknown"], ["知らん", "unknown"],
];

const SLANG_SORTED = [...SLANG].sort((a, b) => b[0].length - a[0].length);

// ---------------------------------------------------------------- 素材トークン
// order_parser の MATERIALS と互換の id を持つ主要素材＋読みゆれ。
// [id, 正規名, 照合語[]]

const MATERIAL_TOKENS = [
  ["diamond", "ダイヤモンド", ["ダイヤモンド", "ダイヤ", "ダイア", "だいや"]],
  ["diamond_ore", "ダイヤモンド鉱石", ["ダイヤモンド鉱石", "ダイヤ鉱石"]],
  ["iron_ingot", "鉄", ["鉄インゴット", "鉄", "てつ", "アイアン"]],
  ["iron_ore", "鉄鉱石", ["鉄鉱石"]],
  ["gold_ingot", "金", ["金インゴット", "金", "きん", "ゴールド"]],
  ["gold_ore", "金鉱石", ["金鉱石"]],
  ["copper_ingot", "銅", ["銅インゴット", "銅", "カッパー"]],
  ["coal", "石炭", ["石炭", "せきたん"]],
  ["redstone", "レッドストーン", ["レッドストーン", "赤石"]],
  ["lapis_lazuli", "ラピスラズリ", ["ラピスラズリ", "ラピス"]],
  ["emerald", "エメラルド", ["エメラルド"]],
  ["netherite_ingot", "ネザライト", ["ネザライトインゴット", "ネザライト"]],
  ["ancient_debris", "古代の残骸", ["古代の残骸", "残骸"]],
  ["quartz", "ネザークォーツ", ["ネザークォーツ", "クォーツ", "石英"]],
  ["obsidian", "黒曜石", ["黒曜石", "オブシディアン"]],
  ["glowstone", "グロウストーン", ["グロウストーン"]],
  ["log", "原木", ["原木", "まるた", "丸太"]],
  ["oak_planks", "板材", ["板材", "木の板", "木材"]],
  ["stick", "棒", ["棒", "スティック"]],
  ["cobblestone", "丸石", ["丸石", "まるいし"]],
  ["stone", "石", ["石"]],
  ["sand", "砂", ["砂"]],
  ["gravel", "砂利", ["砂利", "じゃり"]],
  ["dirt", "土", ["土"]],
  ["glass", "ガラス", ["ガラス", "硝子"]],
  ["wool", "羊毛", ["羊毛", "ウール"]],
  ["string", "糸", ["糸"]],
  ["leather", "革", ["革", "レザー"]],
  ["torch", "松明", ["松明", "たいまつ", "トーチ"]],
  ["wheat", "小麦", ["小麦"]],
  ["bread", "パン", ["パン"]],
  ["bone", "骨", ["骨"]],
  ["gunpowder", "火薬", ["火薬"]],
  ["egg", "卵", ["卵", "たまご"]],
  ["milk", "牛乳", ["牛乳", "ミルク"]],
];
// 最長一致のため照合語の長い順
const MATERIAL_MATCHERS = [];
for (const [id, name, words] of MATERIAL_TOKENS) {
  for (const w of words) MATERIAL_MATCHERS.push({ id, name, word: w });
}
MATERIAL_MATCHERS.sort((a, b) => b.word.length - a.word.length);

// ---------------------------------------------------------------- 数値

const KANJI_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, "１": 1, "２": 2, "３": 3, "４": 4, "５": 5, "６": 6, "７": 7, "８": 8, "９": 9 };

function kanjiNumber(s) {
  if (!s) return null;
  if (s.includes("十")) {
    const [a, b] = s.split("十");
    const tens = a === "" ? 1 : KANJI_NUM[a];
    const ones = b === "" ? 0 : KANJI_NUM[b];
    if (tens == null || ones == null) return null;
    return tens * 10 + ones;
  }
  return KANJI_NUM[s] ?? null;
}

function extractNumbers(s) {
  const out = [];
  const seen = new Set();
  const push = (value, text, idx) => {
    const key = idx + ":" + text;
    if (seen.has(key) || value == null) return;
    seen.add(key);
    out.push({ value, text });
  };
  // スタック換算（64/32）を先に拾う
  for (const m of s.matchAll(/(半|はん)?\s*(\d+|[一二三四五六七八九十]+)?\s*スタック/g)) {
    const n = m[2] ? (/^\d+$/.test(m[2]) ? parseInt(m[2], 10) : kanjiNumber(m[2])) : 1;
    if (n != null) push(m[1] ? n * 32 : n * 64, m[0].trim(), m.index);
  }
  for (const m of s.matchAll(/\d+(?:\.\d+)?/g)) push(parseFloat(m[0]), m[0], m.index);
  for (const m of s.matchAll(/[一二三四五六七八九]+十[一二三四五六七八九]?|[一二三四五六七八九]/g)) {
    push(kanjiNumber(m[0]), m[0], m.index);
  }
  return out.sort((a, b) => a.value - b.value).filter((v, i, a) => i === 0 || v.text !== a[i - 1].text || v.value !== a[i - 1].value);
}

// ---------------------------------------------------------------- 動詞
// [正規形, 意味タグ, 照合パターン(文字列の配列)]

const VERB_DEFS = [
  ["掘る", "mine", ["掘って", "掘る", "掘り", "ほって", "採掘"]],
  ["集める", "gather", ["集めて", "集める", "集め", "あつめて", "拾って", "拾う", "回収して", "回収"]],
  ["倒す", "hunt", ["倒して", "倒す", "殺して", "殺す", "狩って", "やっつけて", "倒せ", "戦って"]],
  ["作る", "craft", ["作って", "作る", "つくって", "クラフトして", "クラフト"]],
  ["建てる", "build", ["建てて", "建てる", "たてて", "建築して", "建築"]],
  ["焼く", "smelt", ["焼いて", "焼く", "精錬して", "精錬"]],
  ["持ってくる", "deliver", ["持ってきて", "持ってくる", "持って来て", "届けて", "届ける", "渡して", "ちょうだい", "ください", "下さい", "ほしい", "欲しい"]],
  ["ついてくる", "follow", ["ついてきて", "ついて来て", "来て", "きて", "来い", "ついてくる"]],
  ["待つ", "wait", ["待って", "待つ", "待機して", "待機", "止まって", "とまって", "ストップ"]],
  ["入れる", "store", ["入れて", "入れる", "しまって", "しまう", "預けて", "納品して", "納品"]],
  ["取る", "take", ["取って", "取る", "とって", "取り"]],
  ["植える", "plant", ["植えて", "植える", "植え"]],
  ["刈る", "harvest", ["刈って", "刈る", "収穫して", "収穫"]],
  ["寝る", "sleep", ["寝て", "寝る", "寝よう", "就寝"]],
  ["守る", "guard", ["守って", "守る", "警戒して", "警戒", "見張って"]],
  ["探す", "search", ["探して", "探す", "さがして", "探し"]],
  ["戻る", "return", ["戻って", "戻る", "帰って", "帰る", "もどって"]],
  ["手伝う", "help", ["手伝って", "手伝う", "手伝い", "たすけて", "助けて"]],
  ["見る", "look", ["見て", "見る", "みて", "確認して", "確認"]],
  ["教える", "tell", ["教えて", "教える", "おしえて"]],
];
const VERB_MATCHERS = [];
for (const [verb, tag, forms] of VERB_DEFS) for (const f of forms) VERB_MATCHERS.push({ verb, tag, form: f });
VERB_MATCHERS.sort((a, b) => b.form.length - a.form.length);

// ---------------------------------------------------------------- 制約
// hostsiles の値域は order_parser と一致させる（ignore/engage/avoid）。

const CONSTRAINT_DEFS = [
  { kind: "hostiles", value: "ignore", patterns: ["戦わずに", "戦わないで", "無視して", "無視で", "構わずに", "相手にしないで", "スルーして", "スルーで", "敵は無視", "無視しながら"] },
  { kind: "hostiles", value: "engage", patterns: ["倒しながら", "殺しながら", "狩りながら", "戦いながら", "倒してから", "殺してから", "敵は倒して", "迎撃して"] },
  { kind: "hostiles", value: "avoid", patterns: ["逃げながら", "避けながら", "逃げて", "避けて", "見つからないように", "こっそり", "静かに"] },
  { kind: "pace", value: "hurry", patterns: ["急いで", "早く", "はやく", "至急", "なる早で", "ダッシュで"] },
  { kind: "pace", value: "slow", patterns: ["ゆっくり", "のんびり", "慌てず"] },
  { kind: "amount", value: "all", patterns: ["全部", "ぜんぶ", "全て", "すべて", "あるだけ"] },
  { kind: "amount", value: "some", patterns: ["少し", "ちょっと", "いくつか"] },
  { kind: "side", value: "along_the_way", patterns: ["ついでに", "途中で", "行きがけに", "帰りに", "ながら"] },
  { kind: "return", value: "home", patterns: ["拠点に届けて", "拠点に持って", "家に届けて", "拠点に戻って"] },
  { kind: "return", value: "owner", patterns: ["私に届けて", "私に持って", "こっちに持って", "届けに来て"] },
];

// ---------------------------------------------------------------- 特徴

const QUESTION_HINTS = ["?", "？", "か?", "の?", "何", "なに", "どこ", "いつ", "なぜ", "どうして", "どう", "どれ", "だれ", "誰", "いる?", "ある?", "できる?", "教えて", "知ってる", "分かる", "わかる", "かな", "でしょ", "なの"];
const ORDER_HINTS = ["して", "しといて", "しておいて", "ください", "下さい", "ちょうだい", "ほしい", "欲しい", "てきて", "ってきて", "てくれ", "てほしい", "お願い", "頼む", "やれ", "しろ", "来い", "行け", "掘れ", "取れ"];
const GREETING_PATTERNS = ["おはよう", "おはよ", "こんにちは", "こんばんは", "おかえり", "ただいま", "やあ", "おつかれ", "お疲れ", "ひさしぶり", "久しぶり", "ねむいけどおは", "起きた"];
const POS_WORDS = ["ありがとう", "うれしい", "嬉しい", "楽しい", "たのしい", "好き", "すき", "かわいい", "可愛い", "やった", "最高", "すごい", "神", "助かる", "助かった", "よかった", "良かった", "ないす", "ナイス", "えらい"];
const NEG_WORDS = ["つかれた", "疲れた", "しんどい", "だるい", "ねむい", "眠い", "こわい", "怖い", "さみしい", "寂しい", "つらい", "むり", "無理", "だめ", "ダメ", "死んだ", "やられた", "最悪", "めんどい", "面倒"];
const REFERENCE_WORDS = ["それ", "あれ", "これ", "その", "あの", "この", "さっき", "あそこ", "そこ", "あっち", "そっち", "こっち", "前に言った", "例の", "あいつ", "そいつ", "あの場所", "さっきの"];
// 褒め・照れ誘発（praise）: リゼへの称賛・感謝・容姿/性格への好意的言及。
// 後段（コンポーザの soft 変換・こめかみランプ表現）の判断材料。単なる pos 感情とは分ける
// （「楽しい」は pos だが praise ではない。「かわいい」「さすが」は praise）。
const PRAISE_WORDS = ["かわいい", "可愛い", "カワイイ", "さすが", "流石", "えらい", "偉い", "よくやった", "よくでき", "天才", "助かる", "助かった", "ありがとう", "大好き", "頼りになる", "頼れる", "優秀", "完璧", "素晴らしい", "すばらしい", "綺麗", "きれい", "美人", "クール", "かっこいい", "格好いい", "かっこよ", "やるね", "やるじゃん", "でかした", "いい子", "優しい", "やさしい", "賢い", "かしこい", "すごい", "凄い", "すげー", "すげえ", "ナイス", "ないす", "好きだ", "すきだ", "惚れ", "ほれ"];

// ---------------------------------------------------------------- 句分割

function splitClauses(s) {
  const parts = s
    .split(/(?<=[、。!！?？])\s*|\s*(?:けど|けれど|から|ので)\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  // 「〜て、〜」の連用も粗く割る（2句以上ある場合のみ）
  const out = [];
  for (const p of parts) {
    const sub = p.split(/(?<=て)、|(?<=て)から、/).map((x) => x.trim()).filter(Boolean);
    out.push(...(sub.length > 1 ? sub : [p]));
  }
  return out;
}

// ---------------------------------------------------------------- 本体


// ---------------------------------------------------------------- 否定検出 (Phase 5, §2.1)
// 検出のみ: id解決はしない（order_parser が正）。spanは normalized 座標のデバッグ専用。
export const NEGATION_PATTERNS = [
  { kind: "prohibition", markers: ["持ってこないで", "持って来ないで", "持ってくるな", "持って来るな", "こないで", "来ないで", "くるな", "来るな"] },
  { kind: "correction",  markers: ["じゃなくて", "ではなくて", "じゃなく", "ではなく", "でなく", "じゃなし", "じゃない"] },
  { kind: "prohibition", markers: ["ないで"] },
  { kind: "exclusion",   markers: ["以外"] },
  { kind: "unwanted",    markers: ["要らない", "いらない", "欲しくない", "不要"] },
];

// Detection kind -> order_parser kind (§2.2). Exported for the §2.2 cycle so
// the conversion table exists in exactly one place.
export const NEG_KIND_TO_ORDER_KIND = {
  correction: "not",
  exclusion: "not",       // + unresolved:excluded_only when nothing positive remains
  prohibition: "forbid",
  unwanted: "contextual", // not | forbid(verb:null), decided by order_parser
};

// Verb-stem + clause-final な (prohibition imperative). Stems are vocabulary
// data drawn from understanding's own VERB_DEFS, not per-sentence rules.
const STEM_NA_RE = /(掘る|集める|倒す|作る|取る|持ってくる|持って来る|焼く|建てる|植える|刈る|探す|守る)な(?=[、。！!？?]|$)/g;
// Existing constraint phrases must NOT be double-detected: 戦わないで /
// 戦わずに are CONSTRAINT_DEFS hostiles=ignore in understanding.
const CONSTRAINT_PREFIX = /戦わ$/;
// Weak-affirmation frames: Xわけじゃない / Xこともない / Xなくはない — the
// じゃない there negates the frame, not the preceding mention.
const WEAK_AFFIRM_PREFIX = /(わけ|ことも|なくは)$/;

function detectNegations(normalized) {
  const s = String(normalized ?? "");
  const taken = []; const out = [];
  const clauseStart = (idx) => Math.max(s.lastIndexOf("、", idx - 1), s.lastIndexOf("。", idx - 1)) + 1;
  const push = (kind, mStart, mEnd) => {
    if (taken.some(([a, b]) => mStart < b && mEnd > a)) return;
    const marker = s.slice(mStart, mEnd);
    // A guarded span still occupies its range: sub-markers inside it
    // (e.g. ない inside じゃない) must not fire afterwards.
    const blocked = () => taken.push([mStart, mEnd]);
    if (CONSTRAINT_PREFIX.test(s.slice(Math.max(0, mStart - 2), mStart))) { blocked(); return; }
    // じゃない？ / じゃないか — interrogative invitation, not correction.
    if (marker === "じゃない" && /^[？?か]/.test(s.slice(mEnd, mEnd + 1))) { blocked(); return; }
    // Sentence-final じゃない with no following clause — confirmation.
    if (marker === "じゃない" && mEnd >= s.length) { blocked(); return; }
    if (WEAK_AFFIRM_PREFIX.test(s.slice(Math.max(0, mStart - 4), mStart))) { blocked(); return; }
    taken.push([mStart, mEnd]);
    const start = clauseStart(mStart);
    out.push({ kind, text: s.slice(start, mEnd), span: [start, mEnd] });
  };
  // Flatten all markers and match globally longest-first.
  const flat = [];
  for (const { kind, markers } of NEGATION_PATTERNS) for (const mk of markers) flat.push({ kind, mk });
  flat.sort((a, b) => b.mk.length - a.mk.length);
  for (const { kind, mk } of flat) {
    let i = s.indexOf(mk);
    while (i >= 0) { push(kind, i, i + mk.length); i = s.indexOf(mk, i + 1); }
  }
  for (const m of s.matchAll(STEM_NA_RE)) push("prohibition", m.index, m.index + m[0].length);
  return out.sort((a, b) => a.span[0] - b.span[0]);
}

export function understand(text) {
  const raw = text == null ? "" : String(text);
  // 1) 幅統一
  let normalized = unifyWidth(raw).trim();
  // 2) 長音・波形の表記統一（〜→ー、カタカナ語の伸ばし圧縮はゆれキー照合側で吸収）
  normalized = normalized.replace(/〜/g, "ー").replace(/!+/g, "!").replace(/\?+/g, "?");
  // 3) タイプミス補正（先に直す。同義語寄せで生まれた正規形を誤字パターンが壊さないため）
  normalized = applyTypoFixes(normalized);
  // 4) 同義語の別名寄せ（ダイヤモンド等へ。canonical は保護される）
  normalized = applySynonyms(normalized);
  // 5) スペース整理
  normalized = normalized.replace(/\s+/g, " ");

  const clauses = splitClauses(normalized);

  // --- 素材トークン（最長一致、重なり排除）
  const materials = [];
  {
    const used = [];
    for (const m of MATERIAL_MATCHERS) {
      let idx = normalized.indexOf(m.word);
      while (idx >= 0) {
        const end = idx + m.word.length;
        if (!used.some(([a, b]) => idx < b && end > a)) {
          used.push([idx, end]);
          if (!materials.some((x) => x.id === m.id)) materials.push({ id: m.id, name: m.name, matched: m.word });
          break;
        }
        idx = normalized.indexOf(m.word, idx + 1);
      }
    }
  }

  // --- 数値
  const numbers = extractNumbers(normalized);

  // --- 動詞
  const verbs = [];
  for (const v of VERB_MATCHERS) {
    if (normalized.includes(v.form) && !verbs.some((x) => x.verb === v.verb)) {
      verbs.push({ verb: v.verb, tag: v.tag, matched: v.form });
    }
  }

  // --- 制約
  const constraints = [];
  for (const c of CONSTRAINT_DEFS) {
    for (const p of c.patterns) {
      if (normalized.includes(p)) {
        if (!constraints.some((x) => x.kind === c.kind)) constraints.push({ kind: c.kind, value: c.value, text: p });
        break;
      }
    }
  }

  // --- スラング
  const slang = [];
  for (const [word, tag] of SLANG_SORTED) {
    if (normalized.includes(word) && !slang.some((x) => x.word === word)) slang.push({ word, tag, text: word });
  }

  // --- 特徴
  const isQuestion = QUESTION_HINTS.some((h) => normalized.includes(h));
  const hasOrderVerb = verbs.length > 0;
  const isOrder = hasOrderVerb && ORDER_HINTS.some((h) => normalized.includes(h))
    || ORDER_HINTS.some((h) => ["ちょうだい", "ください", "下さい", "お願い", "頼む"].includes(h) && normalized.includes(h));
  const isGreeting = GREETING_PATTERNS.some((g) => normalized.includes(g));
  let pos = 0, neg = 0;
  for (const w of POS_WORDS) if (normalized.includes(w)) pos++;
  for (const w of NEG_WORDS) if (normalized.includes(w)) neg++;
  for (const s of slang) { if (s.tag === "praise") pos++; if (s.tag === "tired") neg++; }
  const sentiment = pos > neg ? "pos" : neg > pos ? "neg" : "neu";
  const hasReference = REFERENCE_WORDS.some((r) => normalized.includes(r));
  // praise: 褒め言葉そのもの、または praise タグのスラング（神/ナイス等）を含むか
  const praise = PRAISE_WORDS.some((w) => normalized.includes(w)) || slang.some((s) => s.tag === "praise");

  return {
    raw,
    normalized,
    clauses,
    tokens: { materials, numbers, verbs, constraints, slang, negations: detectNegations(normalized) },
    features: { isQuestion, isOrder, isGreeting, sentiment, hasReference, praise },
  };
}

export default understand;
