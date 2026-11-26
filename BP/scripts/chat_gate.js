// chat_gate.js — 0-C1 (cycle1155): 発話の「指令としての発火」を判定する純粋核。
// 質問形・否定形・引用/仮定・条件節・部分スコープでは、仕事の中止・工場の建築開始・
// 採取指示の発行をしない。合否は返答文でなく呼び出しの有無で判定する (外部レビュー v0.5.63)。
// 純粋: @minecraft/server を import しない。例外を投げない。迷ったら発火しない (fail-closed)。
const CANCEL_RE = /やめて|中止|キャンセル|止めて/;
const FACTORY_RE = /自動化|ラインを組|ライン化/;

function s(v) { return typeof v === "string" ? v : ""; }
function isQuestionForm(t) {
  return /[？?]/.test(t)
    || /どうなる|どうする|どうやって|何をする|なんですか|ですか|でしょうか/.test(t)
    || /ますか/.test(t) // cyc2330 G6: 「整理できますか」は「ですか」を含まない質問形
    || /(したら|すると|すれば|したらば).{0,12}(どう|何|なる)/.test(t)
    // cyc2347 A06 R-A (0-C1): 疑問詞＋終助詞「の」／文末「のか」は「？」無しでも質問形
    || /(いつ|なぜ|どうして|なんで)/.test(t)
    || /のか[。．]?$/.test(t.trim());
}
function isHypothetical(t) {
  return /もし/.test(t) || /と言ったら|って言ったら|と言えば|と仮定/.test(t) || /「[^」]*」と言/.test(t)
    // cyc2347 A06 R-B (0-C1): 『』括弧と括弧なし伝聞も引用・伝聞 (括弧種別で結果を割らない)
    || /『[^』]*』と言/.test(t) || /(と言われた|って言ってた|って聞いた|と言われ)/.test(t);
}
function isNegatedDirective(t, re) {
  // 「〜しないで」「〜してほしくない」「まだ〜てほしくない」など、指令語への否定
  if (/(しないで|しちゃだめ|してはだめ|やめてほしくない|止めてほしくない|ほしくない|ないでください|ないでね|ないで$|ないで。)/.test(t)) return true;
  // cycle1722 A13 R2: 命令形の否定「中止するな／やめるな／止めるな」も否定 (現行は fire してしまう実測あり)
  if (/(中止|キャンセル|やめ|止め).{0,4}(するな|るな)/.test(t)) return true;
  // cyc2003 A13: 工場側の命令形否定も対称に否定とする (「自動化するな」「ラインを組むな」
  // 「鉄の自動化はするな」)。促音便形「組んではだめ」も否定形に含める。
  if (/(自動化|ライン).{0,10}(するな|組むな|すんな)/.test(t)) return true;
  if (/(んではだめ|んじゃだめ|んではダメ)/.test(t)) return true;
  if (/まだ.{0,8}(やめて|中止|止めて|キャンセル)/.test(t) && /ほしくない|ないで/.test(t)) return true;
  // cyc2248 A02 G1 (0-C1): 否定素形 (しない/しません/はなし/禁止/はいけない/組まない/しなくていい/わけじゃない)
  if (/(しない|しません|はしない|はなし|禁止|はいけない|組まない|しなくていい|わけじゃない)/.test(t)) return true;
  // cyc2330 A13 X2: 否定の意思表示 (〜するつもりはない)
  if (/つもりはない|つもりはありません/.test(t)) return true;
  // cyc2347 A06 R-C (0-C1): 「気はない/ありません」と漢字「欲しくない」も否定 (表記ゆれを述語側で吸収)
  if (/気はない|気はありません|欲しくない/.test(t)) return true;
  return false;
}

// cyc2134 A01/A02 (0-C1 R1): 条件節の語形を一般化し両ゲートで共有する。
// 「たら」だけでなく濁点形「だら」、仮定形「〜れば/けば/…ば」一般、動詞辞書形＋「と」
// (暗くなると/終わると、指令語が直後〜6文字以内にある場合のみ) を条件節とする。
// 名詞中の偶然一致 (片仮名「タラ」、漢字＋「と」等) は拾わない。
function isConditionalForm(t) {
  return /(したら|すると|すれば|たら|だら|れば|けば|げば|せば|てば|ねば|べば|めば|えば)/.test(t)
    // cyc2248 A02 G2 (0-C1): 条件接続形 (なら/場合/次第/際に/間は) と とき・前に・だと+指令語
    || /(なら|場合|次第|際に|間は|間だけ)/.test(t)
    || /(とき|時に|ときは).{0,24}(中止|やめて|止めて|キャンセル|自動化|ライン|整理|仕分け)/.test(t)
    || /前に.{0,6}(やめて|中止|止めて|キャンセル)/.test(t)
    || /だと.{0,12}(中止|やめて|止めて|キャンセル|自動化|ライン)/.test(t)
    || /[うくぐすつぬぶむる]と(?=.{0,6}(中止|やめて|止めて|キャンセル|自動化|ライン))/.test(t);
}
// cyc2134 A02 (0-C1 R4): 熟慮形「〜かどうか＋迷ってる/考えて/検討/聞いて」は意思決定前の
// 発話であり指令ではない。確認作業そのもの (「かどうか確認して」) は熟慮述語を含まないため対象外。
function isDeliberating(t) {
  if (/かどうか/.test(t) && /(迷|考え|検討|悩|聞いて|決めてない|決まってない|まだ決め)/.test(t)) return true;
  // cyc2221 A15 R-2 (0-C1): 「？」無しの熟慮・許可求めも指令ではない。
  // 「しようかな/ようかな」「するか迷ってる」は意思決定前、「〜てもいい」は許可求め。
  if (/(しようかな|ようかな|するか迷|ようか迷|迷って|迷い中)/.test(t)) return true;
  if (/(てもいい|てもよい|ても大丈夫)[。．]?$/.test(t.trim())) return true;
  // cyc2248 A02 G3 (0-C1): 熟慮変形 (しようか/考え中/検討中/まだ決めてない/すべきか/するか悩/決めかね/ても平気/〜かな許可求め)
  if (/(しようか|考え中|検討中|まだ決めてない|すべきか|するか悩|決めかね|ても平気|てもいいかな|ても大丈夫かな|したほうがいいかな)/.test(t)) return true;
  // cyc2330 A13 X1: 熟慮口語形 (考えてる/検討してる)
  if (/(考えてる|検討してる|考えています|検討しています)/.test(t)) return true;
  // cyc2347 A06 R-D (0-C1): 裸の「か＋熟慮述語 (検討したい/考えたい/聞きたい)」も熟慮
  if (/か(検討したい|考えたい|聞きたい)/.test(t)) return true;
  return false;
}
// cyc2134 A02 (0-C1 R2/R3): 工場の後置先送り。「〜は…てからにして」(先送り構文) と
// 明日/後での先送りを条件扱いにする。逐次構文「自動化してから中止して」(てから＋別指令で
// 「にして」を伴わない) は開始として維持する。
function isDeferredFactory(t) {
  return /(自動化|ライン).{0,48}てからにして/.test(t)
    || /(自動化|ライン).{0,24}(明日から|明日やって|明日以降|後で|あとで|後日)/.test(t);
}

// 中止ゲート: {fire, kind} kind: none|cancel|question|hypothetical|negation|partial|conditional
export function gateCancel(text) {
  try {
    const t = s(text);
    if (!CANCEL_RE.test(t)) return { fire: false, kind: "none" };
    if (isHypothetical(t)) return { fire: false, kind: "hypothetical" };
    // 部分スコープ: 「Aは続けて、Bだけやめて」は全体中止ではない
    if (/だけ(やめて|中止|止めて|キャンセル)/.test(t) || /(続けて|継続して).{0,16}(やめて|中止|止めて)/.test(t)) return { fire: false, kind: "partial" };
    // cyc2248 A02 G4 (0-C1): 部分スコープの語順逆転・助詞挟み (だけを/のみ/中止は…だけにして/指令語の後に継続)
    if (/だけを(やめて|中止|止めて|キャンセル)/.test(t) || /のみ(やめて|中止|止めて|キャンセル)/.test(t) || /中止は.{0,12}だけにして/.test(t) || /(やめて|中止して|止めて).{0,24}(他は|ほかは|採掘は|石炭集めは).{0,8}(続けて|継続)/.test(t)) return { fire: false, kind: "partial" };
    // cyc2347 A06 R-F2 (0-C1): 「のみを＋指令語」も部分スコープ (助詞「を」挟み)
    if (/のみを(やめて|中止|止めて|キャンセル)/.test(t)) return { fire: false, kind: "partial" };
    if (isNegatedDirective(t)) return { fire: false, kind: "negation" };
    // cyc2347 A06 R-E (0-C1): gateCancel にも howto 遮断を入れ3ゲート対称にする
    if (isHowToRequest(t)) return { fire: false, kind: "question" };
    // cyc2347 A06 R-F3 (0-C1): 「まだ今じゃない」は即時中止ではない
    if (/まだ今じゃない|まだ今ではない/.test(t)) return { fire: false, kind: "conditional" };
    if (isDeliberating(t)) return { fire: false, kind: "question" };
    if (isQuestionForm(t)) return { fire: false, kind: "question" };
    // cyc2003 A13 + cyc2134 A01: 条件節 (たら/だら/れば一般/動詞＋と) では発火しない
    if (isConditionalForm(t)) return { fire: false, kind: "conditional" };
    return { fire: true, kind: "cancel" };
  } catch { return { fire: false, kind: "error" }; }
}

// 工場 (自動化) ゲート: {fire, kind} kind: none|start|question|hypothetical|negation|conditional
export function gateFactory(text) {
  try {
    const t = s(text);
    if (!FACTORY_RE.test(t)) return { fire: false, kind: "none" };
    if (isHypothetical(t)) return { fire: false, kind: "hypothetical" };
    // cyc2221 A15 R-1 (0-C1): 工場対象＋「やめて」は工場への否定であり開始ではない
    // (「自動化するのやめて」「鉄の自動化はやめて」「ラインを組むのはやめて」)。
    if (/(自動化|ライン).{0,20}やめて/.test(t)) return { fire: false, kind: "negation" };
    if (isNegatedDirective(t)) return { fire: false, kind: "negation" };
    // cycle1722 A13 R1: 「自動化の方法を教えて」は説明要求。工場経路は通常解釈より先に呼ばれるため、ここでも howto を止める
    if (isHowToRequest(t)) return { fire: false, kind: "question" };
    if (isDeliberating(t)) return { fire: false, kind: "question" };
    if (isQuestionForm(t)) return { fire: false, kind: "question" };
    if (/(なったら|たら|だら|れば|ときは|時は).{0,20}(自動化|ライン)/.test(t)) return { fire: false, kind: "conditional" };
    // cyc2134 A01: 前置条件の一般形 (動詞＋と/れば一般) も中止側と対称に止める
    if (isConditionalForm(t)) return { fire: false, kind: "conditional" };
    // cyc2003 A13: 後置条件 (「自動化するのは雨が降ってからにして」) も条件節
    if (/(自動化|ライン).{0,40}(降ってから|なってから|たら|だら|れば)/.test(t)) return { fire: false, kind: "conditional" };
    // cyc2134 A02: 後置先送り (一般の「てからにして」/明日/後で) も即時開始しない
    if (isDeferredFactory(t)) return { fire: false, kind: "conditional" };
    // cyc2347 A06 R-F1/R-F3 (0-C1): 「〜の後に＋工場語」と「まだ今じゃない」も即時開始しない
    if (/(なった後|の後に).{0,20}(自動化|ライン)/.test(t)) return { fire: false, kind: "conditional" };
    if (/まだ今じゃない|まだ今ではない/.test(t)) return { fire: false, kind: "conditional" };
    return { fire: true, kind: "start" };
  } catch { return { fire: false, kind: "error" }; }
}

// 倉庫整理ゲート (cyc2330, 0-C1 G6): チャット直結経路は従来インライン正規表現のみで
// 否定・熟慮・条件・質問形が runWarehouseSort へ漏れていた (cyc2313 A02 実測 W6系10件+X系9件)。
// 共有述語へ寄せ、倉庫固有の否定2形 (整理/仕分け+するな・対象語+やめて) を追加する。
const WAREHOUSE_RE = /(倉庫|チェスト).*(整理|仕分け)/;
export function gateWarehouseSort(text) {
  try {
    const t = s(text);
    if (!WAREHOUSE_RE.test(t)) return { fire: false, kind: "none" };
    if (isHypothetical(t)) return { fire: false, kind: "hypothetical" };
    if (/(整理|仕分け).{0,16}(やめて|止めて|するな|るな)/.test(t)) return { fire: false, kind: "negation" };
    if (isNegatedDirective(t)) return { fire: false, kind: "negation" };
    // cyc2330 A01 R6-1/R6-2: 旧インライン除外 (教えて) で遮断されていた形の後退是正。
    // isHowToRequest は裸の「教えて」/「仕分け方」を拾わないため倉庫ゲート内で補う
    if (/(教えて|知りたい|聞きたい|説明して)/.test(t)) return { fire: false, kind: "question" };
    // cyc2330 A01 R6-4/R6-5: 後置・前置の先送りは即時開始しない
    if (/(整理|仕分け).{0,40}(降ってから|なってから|てからにして|明日|後で|あとで|後日)/.test(t)) return { fire: false, kind: "conditional" };
    if (/(明日|後で|あとで).{0,16}(整理|仕分け)/.test(t)) return { fire: false, kind: "conditional" };
    if (isHowToRequest(t)) return { fire: false, kind: "question" };
    if (isDeliberating(t)) return { fire: false, kind: "question" };
    if (isQuestionForm(t)) return { fire: false, kind: "question" };
    if (isConditionalForm(t)) return { fire: false, kind: "conditional" };
    return { fire: true, kind: "start" };
  } catch { return { fire: false, kind: "error" }; }
}

// 「方法を教えて」型: 説明を求める発話。指示として発行しない。
export function isHowToRequest(text) {
  try {
    const t = s(text);
    if (/方法|やり方|集め方|作り方|掘り方|取り方/.test(t) && /(教えて|知りたい|聞きたい|説明)/.test(t)) return true;
    if (/どうやって/.test(t) && /(集め|作|掘|取|倒)/.test(t)) return true;
    // cyc2248 A02 G5 (0-C1): howto 語彙拡張 (手順/仕方/仕組み/ポイント/つくり方) と どうすれば・どうしたら
    if (/(手順|仕方|仕組み|ポイント|つくり方)/.test(t) && /(教えて|知りたい|聞きたい|説明)/.test(t)) return true;
    if (/(どうすれば|どうしたら)/.test(t)) return true;
    if (/(集め方|作り方|つくり方)は[？?]?$/.test(t.trim())) return true;
    // cyc2347 A06 R-E: 「〜する方法は」で終わる説明要求も howto (教えて無し形)
    if (/(方法|やり方)は[？?]?$/.test(t.trim())) return true;
    return false;
  } catch { return false; }
}
