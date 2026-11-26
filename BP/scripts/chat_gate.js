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
    || /(したら|すると|すれば|したらば).{0,12}(どう|何|なる)/.test(t);
}
function isHypothetical(t) {
  return /もし/.test(t) || /と言ったら|って言ったら|と言えば|と仮定/.test(t) || /「[^」]*」と言/.test(t);
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
  return false;
}

// cyc2134 A01/A02 (0-C1 R1): 条件節の語形を一般化し両ゲートで共有する。
// 「たら」だけでなく濁点形「だら」、仮定形「〜れば/けば/…ば」一般、動詞辞書形＋「と」
// (暗くなると/終わると、指令語が直後〜6文字以内にある場合のみ) を条件節とする。
// 名詞中の偶然一致 (片仮名「タラ」、漢字＋「と」等) は拾わない。
function isConditionalForm(t) {
  return /(したら|すると|すれば|たら|だら|れば|けば|げば|せば|てば|ねば|べば|めば|えば)/.test(t)
    || /[うくぐすつぬぶむる]と(?=.{0,6}(中止|やめて|止めて|キャンセル|自動化|ライン))/.test(t);
}
// cyc2134 A02 (0-C1 R4): 熟慮形「〜かどうか＋迷ってる/考えて/検討/聞いて」は意思決定前の
// 発話であり指令ではない。確認作業そのもの (「かどうか確認して」) は熟慮述語を含まないため対象外。
function isDeliberating(t) {
  return /かどうか/.test(t) && /(迷|考え|検討|悩|聞いて|決めてない|決まってない|まだ決め)/.test(t);
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
    if (isNegatedDirective(t)) return { fire: false, kind: "negation" };
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
    return { fire: true, kind: "start" };
  } catch { return { fire: false, kind: "error" }; }
}

// 「方法を教えて」型: 説明を求める発話。指示として発行しない。
export function isHowToRequest(text) {
  try {
    const t = s(text);
    if (/方法|やり方|集め方|作り方|掘り方|取り方/.test(t) && /(教えて|知りたい|聞きたい|説明)/.test(t)) return true;
    if (/どうやって/.test(t) && /(集め|作|掘|取|倒)/.test(t)) return true;
    return false;
  } catch { return false; }
}
