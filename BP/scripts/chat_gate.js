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
    // cyc2363 A06 (0-C1 N4/過剰遮断是正): 誰/何 系を追加し、疑問詞は境界付きにする
    // (「いつも」「なぜか」「なんでか」の部分一致で正当な指令まで遮断していた)
    || /(いつ(?![も、])|なぜ(?![か、])|どうして|なんで(?![か、])|誰が|誰なの|のは誰|何を|何のために|何のこと|って何)/.test(t)
    || /のか[。．]?$/.test(t.trim());
}
// cyc2457 (GATE-QUOTE-TEXT-01): 書記引用 (看板・本・メモ等に「書いてある／書かれた」文面の言及) も
// 引用・伝聞である。口頭伝聞だけを覆い書記形を覆わないため、他人の文面を伝えただけで
// 中止・工場・倉庫整理が発火していた (書記引用17形 全て fire:true を実測、cyc2432〜cyc2456)。
// 純粋言及形に限る: 指令語が引用内または引用助詞「と／って／という」に後続し、
// 書記動詞の後に別の実行依頼 (〜して形) が残る文は言及だけの文ではないため対象外とする。
function isWrittenQuoteMention(t) {
  const m = /(書いてある|書かれている|書いてあった|書かれた|記載され|記載された|貼ってある|貼ってあった|記され|表示され|印刷され|刻まれ)/.exec(t);
  if (!m) return false;
  const before = t.slice(0, m.index);
  if (!/(「|『|と|って|という)/.test(before)) return false;
  const after = t.slice(m.index + m[0].length);
  if (/(して|してください|してくれ|しなさい)/.test(after)) return false;
  return true;
}
function isHypothetical(t) {
  return /もし/.test(t) || /と言ったら|って言ったら|と言えば|と仮定/.test(t) || /「[^」]*」と言/.test(t)
    // cyc2347 A06 R-B (0-C1): 『』括弧と括弧なし伝聞も引用・伝聞 (括弧種別で結果を割らない)
    || /『[^』]*』と言/.test(t) || /(と言われた|って言ってた|って聞いた|と言われ)/.test(t)
    // cyc2363 A06 (0-C1 N3): 伝聞の完了形「言った/言いました」と「という話を聞いた」も伝聞
    || /(と言った|って言った|と言いました|って言いました|という話を聞いた)/.test(t)
    // cyc2457 (GATE-QUOTE-TEXT-01): 書記引用も引用・伝聞 (純粋言及形に限る)
    || isWrittenQuoteMention(t);
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
  // cyc2363 A06 (0-C1 N1): 意志否定の基本形「したくない/したくはない」と助詞挟み「ほしくはない」
  if (/(したくない|したくはない|ほしくはない)/.test(t)) return true;
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
  // cyc2363 A06 (0-C1 N2): 素の「か＋決めてない」と確認求め「かどうか＋教えて/知りたい」も熟慮/確認 (3ゲート共有)
  if (/か決めてない/.test(t)) return true;
  if (/かどうか/.test(t) && /(教えて|知りたい)/.test(t)) return true;
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

// cyc2450 (0-N2 NONCMD-GATE-01): 発話種別の共有非命令分類。過去形・報告／能力質問／
// 引用・伝聞／完了報告／翻訳等のメタ依頼は、文の形 (動詞の活用と文末形) で一般に判定し、
// 例文・対象名は直書きしない。通常パーサー経路と側経路ゲートの両方がこの述語を使う。
// 戻り値: "past_report"|"ability_question"|"quote_hearsay"|"completion_report"|"meta_request"|null
const NONCMD_LANG = "(英語|日本語|中国語|韓国語|フランス語|ドイツ語|スペイン語|イタリア語|ポルトガル語|ロシア語)";
const NONCMD_POTENTIAL = "(?:[えけせてねへめれべげぜで]る|られる|できる)";
export function classifyNonCommand(text) {
  try {
    const t = s(text).trim();
    if (!t) return null;
    // cyc2454 (NONCMD残存拡張 Q1): 引用助詞+受身の言及動詞 (言われ/頼まれ) は活用・尾・括弧に依らず伝聞
    if (isHypothetical(t) || /(って言ってた|と言ってた|って言ってました|と言ってました|って聞いた|と言われた|という話)/.test(t) || /(と|って)(言われ|頼まれ)/.test(t)) return "quote_hearsay";
    // cyc2454 (Q2): 文末伝聞「って」単独は、希望の引用か第三者主語の手がかりがある場合のみ伝聞とする
    if (/(てって|ほしいって)(よ|ね|さ)?[。．]?$/.test(t) && (/ほしい/.test(t) || /^[^、。]{1,12}が/.test(t))) return "quote_hearsay";
    if (/(んだって|だって)(よ|ね)?[。．]?$/.test(t)) return "quote_hearsay";
    if (/を(英訳|翻訳)(して|しなさい|してください|してくれ)?/.test(t) || /(英訳|翻訳)(して|してください)[。．]?$/.test(t)) return "meta_request";
    // cyc2454 (M1): 引用文+言語名スロット+文末の言語操作述語 (言語名の名詞修飾だけの形は対象外)
    if (new RegExp(`(を|って)${NONCMD_LANG}で(言って|何て言う|何と言う)`).test(t) || new RegExp(`(を|って)${NONCMD_LANG}に(直して|訳して|して|変換して)`).test(t)) return "meta_request";
    if (/(を|って)何て言う(の)?[？?。．]?$/.test(t)) return "meta_request";
    // cyc2454 (M2): 引用文+テキスト操作述語の閉集合 (素の「直して」「まとめて」は逐次命令と区別できないため含めない)
    if (/(を|って)(要約|書き直|言い換え|まとめ直|短くまとめ)(て|して|してください|してくれ|しなさい)?[。．]?$/.test(t)) return "meta_request";
    // cyc2454 (M3): 引用文+意味・説明の対象指定がある形だけをメタとする (素の説明要求の素通し接続はしない)
    if (/(の意味を|ってどういう意味|の意味は何|を説明して)/.test(t) && /(教えて|聞きたい|知りたい|ください|何|意味|説明)/.test(t)) return "meta_request";
    // megabench-100m 移行6 (NONCMD-GATE-02): 将来予定・例文・解析依頼も非命令 (文の形のみで判定、対象名は直書きしない)
    if (/例文(です|だ)?\s*[:：]/.test(t) || /^例\s*[:：]/.test(t)) return "noncommand";
    if (/という文を(解析|分析|解釈)(して|してください|してくれ)?/.test(t) || /文を(解析|分析)して/.test(t)) return "meta_request";
    if (/(予定|つもり)(だ|です|だよ|ですね)?[。．]?$/.test(t.trim())) return "noncommand";
    if (/(せますか|できますか|れますか|ますか)[？?。．]?$/.test(t)) return "ability_question";
    // cyc2454 (ABIL 是正B): 可能形の口語疑問尾 (〜せる/れる+か・かな・？) も能力質問。尾が無い可能形単独は断定であり得るため対象外
    if (new RegExp(`${NONCMD_POTENTIAL}(?:かな|か)[。．]?$`).test(t) || new RegExp(`${NONCMD_POTENTIAL}[？?][。．]?$`).test(t)) return "ability_question";
    if (/(もう|すでに|既に).{0,24}(した|済んだ|終わった|片付けた)(よ|ね|です|ます)?[。．]?$/.test(t)) return "completion_report";
    // cyc2454 (COMP): 従属節の後続は報告・安心述語のときだけ完了報告 (作業指令が続く文は遮断しない)
    if (/(もう|すでに|既に).{0,24}(した|済んだ|終わった|片付けた)(ので|から)(大丈夫|安心|問題ない)/.test(t)) return "completion_report";
    // cyc2454 (COMP): 文末完了形の活用集合 (丁寧過去・複合完了・可能形過去・状態名詞「済み」は述語位置のみ)
    if (/(整理|仕分け|片付け)(した|しました|し終わった|し終えた|済ませた|できた|できました|完了した|しておいた|しておきました)(よ|ね|です|ます)?[。．]?$/.test(t)) return "completion_report";
    if (/(整理|仕分け|片付け)(済み|済)(です|ます|だ)?[。．]?$/.test(t)) return "completion_report";
    if (/(整理|仕分け|片付け)(は|が|も)(終わった|終わりました|済んだ|済みました|済みです)[。．]?$/.test(t)) return "completion_report";
    // cyc2454 (PAST v3): 過去形の核は文末アンカーを維持し、尾は終助詞・言いさし接続・ので/から+報告/提示述語のみ許可する
    if (/(てきた|てきました|ってきた|ってきました|てきちゃった|ってきちゃった|てきちゃいました|ておいた|ておきました|っておいた|っておきました|ておいちゃった|ちゃった|てしまった|てしまいました)(?:(?:よ|ね|よね|わ|ぞ|さ|んだ|んです|のです|んだけど|けど|けれど|が|から|ので)[。．]?|(?:ので|から)(?:報告します|報告する|報告|見て|見てね|見てください|確認して|確認してください)[。．]?|[。．])?$/.test(t)) return "past_report";
    return null;
  } catch { return null; }
}
function nonCommandKind(k) {
  return k === "quote_hearsay" ? "hypothetical" : (k === "ability_question" || k === "meta_request") ? "question" : "noncommand";
}

// cyc2433 (GATE-EXPLAIN-BARE-01): 素の説明要求 (教えて/知りたい/聞きたい/説明して だけの形)。
// isHowToRequest は「方法+教えて」等の複合形しか拾わず、倉庫ゲートだけが cyc2330 で
// この補いを持っていた非対称を共有化し、cancel/factory へ横展開する。
export function isBareExplainRequest(t) {
  return /(教えて|知りたい|聞きたい|説明して)/.test(t);
}
// cyc2461 (GATE-EXPLAIN-OVERBLOCK-01): 主節命令＋後続節のみ説明語彙の節境界。
// 「やめて、終わったら教えて」は主節の指令であり素の説明要求ではない。文頭から
// 最初の読点・句点までの主節がゲート対象の命令形で完結し、主節内に説明語彙が無く、
// 説明語彙が後続節にのみ現れる場合に限り、その主節を返す (呼び出し側が以後
// 説明系・質問・条件判定を主節へスコープするために使う)。安全側述語は全文で先に通す。
const EXPLAIN_VOCAB_RE = /(教えて|知りたい|聞きたい|説明して)/;
function postClauseExplainHead(t, headRe, entryRe) {
  const m = /[、,。.]/.exec(t); if (!m) return null;
  const head = t.slice(0, m.index).trim();
  const tail = t.slice(m.index + 1);
  if (!entryRe.test(head) || !headRe.test(head)) return null;
  if (EXPLAIN_VOCAB_RE.test(head)) return null;
  if (!EXPLAIN_VOCAB_RE.test(tail)) return null;
  return head;
}
const CANCEL_HEAD_RE = /(やめて|中止して|止めて|キャンセルして)(ほしい|ください|ね)?$/;
const FACTORY_HEAD_RE = /(自動化して|ラインを組んで|ライン化して)(ください|ね)?$/;
const WAREHOUSE_HEAD_RE = /(整理をして|整理して|仕分けして)(ください|ね)?$/;

// 中止ゲート: {fire, kind} kind: none|cancel|question|hypothetical|negation|partial|conditional
export function gateCancel(text) {
  try {
    const t = s(text);
    if (!CANCEL_RE.test(t)) return { fire: false, kind: "none" };
    const nc0 = classifyNonCommand(t); if (nc0 && !(nc0 === "meta_request" && postClauseExplainHead(t, CANCEL_HEAD_RE, CANCEL_RE))) return { fire: false, kind: nonCommandKind(nc0) };
    if (isHypothetical(t)) return { fire: false, kind: "hypothetical" };
    // 部分スコープ: 「Aは続けて、Bだけやめて」は全体中止ではない
    if (/だけ(やめて|中止|止めて|キャンセル)/.test(t) || /(続けて|継続して).{0,16}(やめて|中止|止めて)/.test(t)) return { fire: false, kind: "partial" };
    // cyc2248 A02 G4 (0-C1): 部分スコープの語順逆転・助詞挟み (だけを/のみ/中止は…だけにして/指令語の後に継続)
    if (/だけを(やめて|中止|止めて|キャンセル)/.test(t) || /のみ(やめて|中止|止めて|キャンセル)/.test(t) || /中止は.{0,12}だけにして/.test(t) || /(やめて|中止して|止めて).{0,24}(他は|ほかは|採掘は|石炭集めは).{0,8}(続けて|継続)/.test(t)) return { fire: false, kind: "partial" };
    // cyc2347 A06 R-F2 (0-C1): 「のみを＋指令語」も部分スコープ (助詞「を」挟み)
    if (/のみを(やめて|中止|止めて|キャンセル)/.test(t)) return { fire: false, kind: "partial" };
    // cyc2363 A06 (0-C1 N6): 中止が名詞形「中止、」で置かれ継続が後続する文も部分スコープ
    if (/(中止|キャンセル)[、,].{0,16}(他は|ほかは).{0,8}(続けて|継続)/.test(t)) return { fire: false, kind: "partial" };
    // cyc2363 A06 (0-C1 N5): cancel 側にも先送り「〜た後に＋指令語」遮断を入れる (factory と対称)
    if (/(た後に|だ後に|なった後に|の後に).{0,16}(やめて|中止|止めて|キャンセル)/.test(t)) return { fire: false, kind: "conditional" };
    if (isNegatedDirective(t)) return { fire: false, kind: "negation" };
    const tc = postClauseExplainHead(t, CANCEL_HEAD_RE, CANCEL_RE) ?? t;
    // cyc2347 A06 R-E (0-C1): gateCancel にも howto 遮断を入れ3ゲート対称にする
    if (isHowToRequest(tc)) return { fire: false, kind: "question" };
    // cyc2433 (GATE-EXPLAIN-BARE-01): 素の説明要求「中止について教えて」も質問
    if (isBareExplainRequest(tc)) return { fire: false, kind: "question" };
    // cyc2347 A06 R-F3 (0-C1): 「まだ今じゃない」は即時中止ではない
    if (/まだ今じゃない|まだ今ではない/.test(tc)) return { fire: false, kind: "conditional" };
    if (isDeliberating(tc)) return { fire: false, kind: "question" };
    if (isQuestionForm(tc)) return { fire: false, kind: "question" };
    // cyc2003 A13 + cyc2134 A01: 条件節 (たら/だら/れば一般/動詞＋と) では発火しない
    if (isConditionalForm(tc)) return { fire: false, kind: "conditional" };
    return { fire: true, kind: "cancel" };
  } catch { return { fire: false, kind: "error" }; }
}

// 工場 (自動化) ゲート: {fire, kind} kind: none|start|question|hypothetical|negation|conditional
export function gateFactory(text) {
  try {
    const t = s(text);
    if (!FACTORY_RE.test(t)) return { fire: false, kind: "none" };
    const nc1 = classifyNonCommand(t); if (nc1 && !(nc1 === "meta_request" && postClauseExplainHead(t, FACTORY_HEAD_RE, FACTORY_RE))) return { fire: false, kind: nonCommandKind(nc1) };
    if (isHypothetical(t)) return { fire: false, kind: "hypothetical" };
    // cyc2221 A15 R-1 (0-C1): 工場対象＋「やめて」は工場への否定であり開始ではない
    // (「自動化するのやめて」「鉄の自動化はやめて」「ラインを組むのはやめて」)。
    if (/(自動化|ライン).{0,20}やめて/.test(t)) return { fire: false, kind: "negation" };
    if (isNegatedDirective(t)) return { fire: false, kind: "negation" };
    const tf = postClauseExplainHead(t, FACTORY_HEAD_RE, FACTORY_RE) ?? t;
    // cycle1722 A13 R1: 「自動化の方法を教えて」は説明要求。工場経路は通常解釈より先に呼ばれるため、ここでも howto を止める
    if (isHowToRequest(tf)) return { fire: false, kind: "question" };
    // cyc2433 (GATE-EXPLAIN-BARE-01): 素の説明要求「鉄の自動化について教えて/説明して」も質問 (建築を開始しない)
    if (isBareExplainRequest(tf)) return { fire: false, kind: "question" };
    if (isDeliberating(tf)) return { fire: false, kind: "question" };
    if (isQuestionForm(tf)) return { fire: false, kind: "question" };
    if (/(なったら|たら|だら|れば|ときは|時は).{0,20}(自動化|ライン)/.test(tf)) return { fire: false, kind: "conditional" };
    // cyc2134 A01: 前置条件の一般形 (動詞＋と/れば一般) も中止側と対称に止める
    if (isConditionalForm(tf)) return { fire: false, kind: "conditional" };
    // cyc2003 A13: 後置条件 (「自動化するのは雨が降ってからにして」) も条件節
    if (/(自動化|ライン).{0,40}(降ってから|なってから|たら|だら|れば)/.test(tf)) return { fire: false, kind: "conditional" };
    // cyc2134 A02: 後置先送り (一般の「てからにして」/明日/後で) も即時開始しない
    if (isDeferredFactory(tf)) return { fire: false, kind: "conditional" };
    // cyc2347 A06 R-F1/R-F3 (0-C1): 「〜の後に＋工場語」と「まだ今じゃない」も即時開始しない
    // cyc2363 A06 (0-C1 N5): 完了形「〜た後に」も先送りとして一般化
    if (/(なった後|の後に|た後に|だ後に).{0,20}(自動化|ライン)/.test(tf)) return { fire: false, kind: "conditional" };
    if (/まだ今じゃない|まだ今ではない/.test(tf)) return { fire: false, kind: "conditional" };
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
    const nc2 = classifyNonCommand(t); if (nc2 && !(nc2 === "meta_request" && postClauseExplainHead(t, WAREHOUSE_HEAD_RE, WAREHOUSE_RE))) return { fire: false, kind: nonCommandKind(nc2) };
    if (isHypothetical(t)) return { fire: false, kind: "hypothetical" };
    if (/(整理|仕分け).{0,16}(やめて|止めて|するな|るな)/.test(t)) return { fire: false, kind: "negation" };
    if (isNegatedDirective(t)) return { fire: false, kind: "negation" };
    const tw = postClauseExplainHead(t, WAREHOUSE_HEAD_RE, WAREHOUSE_RE) ?? t;
    // cyc2330 A01 R6-1/R6-2: 旧インライン除外 (教えて) で遮断されていた形の後退是正。
    // isHowToRequest は裸の「教えて」/「仕分け方」を拾わないため倉庫ゲート内で補う
    if (isBareExplainRequest(tw)) return { fire: false, kind: "question" }; // cyc2433: 共有述語へ寄せた (判定は不変)
    // cyc2330 A01 R6-4/R6-5: 後置・前置の先送りは即時開始しない
    if (/(整理|仕分け).{0,40}(降ってから|なってから|てからにして|明日|後で|あとで|後日)/.test(tw)) return { fire: false, kind: "conditional" };
    if (/(明日|後で|あとで).{0,16}(整理|仕分け)/.test(tw)) return { fire: false, kind: "conditional" };
    if (isHowToRequest(tw)) return { fire: false, kind: "question" };
    if (isDeliberating(tw)) return { fire: false, kind: "question" };
    if (isQuestionForm(tw)) return { fire: false, kind: "question" };
    if (isConditionalForm(tw)) return { fire: false, kind: "conditional" };
    // WH-SCOPE-01 H1 (cyc2476): 単一箱指定の形だけ scope を併記する (全体形・「全部」形はキー無しで現行どおり)
    const single = /(この|その)チェスト/.test(t) && !/(ぜんぶ|全部|全て)/.test(t);
    return single ? { fire: true, kind: "start", scope: "single" } : { fire: true, kind: "start" };
  } catch { return { fire: false, kind: "error" }; }
}

// 倉庫 W3-TEACH ゲート (cyc2355, cyc2347 A05 案): 「<素材>はこっち/この箱/その箱に入れて」だけを
// 行き先学習の指令として発火させる。質問・否定・仮定・条件・先送りでは学習しない (0-C1 と同作法)。
// 素材名の typeId 解決はしない (ハンドラ側の責務)。戻り値は既存ゲートと同形 {fire, kind} + itemName。
const TEACH_RE = /^(.+?)は(こっち|この箱|その箱)に入れて/;
export function gateTeachItemDest(text) {
  try {
    const t = s(text).trim();
    const m = TEACH_RE.exec(t);
    if (!m) return { fire: false, kind: "none" };
    // 「入れて」の後に続くのは丁寧形・終助詞・句点だけを許す (「入れてほしくない」等は命令形でない)
    const rest = t.slice(m[0].length);
    if (!/^(ください|ね|よ)?[。．]?$/.test(rest)) return { fire: false, kind: "none" };
    const nc3 = classifyNonCommand(t); if (nc3) return { fire: false, kind: nonCommandKind(nc3) };
    if (isHypothetical(t)) return { fire: false, kind: "hypothetical" };
    // teach 固有の否定 (指令語が中止系でないため共有述語だけでは拾えない。倉庫ゲートの固有否定と同型)
    if (/(入れて|入れる).{0,8}(ほしくない|ないで)/.test(t) || /(入れないで|入れなくていい|入れるな)/.test(t)) return { fire: false, kind: "negation" };
    if (isNegatedDirective(t)) return { fire: false, kind: "negation" };
    if (/(入れ方|入れる方法|どうやって入れる)/.test(t) || isHowToRequest(t)) return { fire: false, kind: "question" };
    if (isDeliberating(t)) return { fire: false, kind: "question" };
    if (isQuestionForm(t)) return { fire: false, kind: "question" };
    if (isConditionalForm(t)) return { fire: false, kind: "conditional" };
    if (/(入れて).{0,24}(てからにして|明日|後で|あとで|後日)/.test(t)) return { fire: false, kind: "conditional" };
    return { fire: true, kind: "start", itemName: m[1].trim() };
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
    // cyc2363 A06 (0-C1 N4): 「理由/目的を教えて・知りたい」は説明要求 (howto 語彙に理由は入らないため構造で拾う)
    if (/(理由|目的)を(教えて|知りたい|聞きたい)/.test(t)) return true;
    return false;
  } catch { return false; }
}
