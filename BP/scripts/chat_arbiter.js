// chat_arbiter.js — リゼ (LIZE-07) チャット調停者（アービター）
// 参考: HuggingFace PyBot の構造。各モジュールが返信「候補を提案」し、
//       アービターが最良の1つだけを選ぶ。現行の「先にマッチしたもの勝ち」を置き換える。
// 純粋JS: @minecraft/server に依存しない。乱数なし（決定的）。例外を出さない。
//
// 使い方（統合側）:
//   const proposals = [
//     adaptOrder(parseOrder(msg)),
//     adaptQA(answerQuestion(msg, ctx)),
//     adaptTool(tryTool(msg, ctx)),
//     adaptKnowledge(lookupKnowledge(msg), msg),
//     ...chat系マッチを adaptChat / adaptFollowup で変換,
//   ];
//   const win = arbitrate(proposals, conv.getContext());
//   if (win?.source === 'order') { /* 注文として実行層へ */ }
//   else if (win) { /* win.text を発話。win.act があれば行動も */ }
//   else { /* 全候補が低信頼 → 沈黙 or 汎用フォールバックに譲る */ }
//
// 調停ルール（chat_arbiter.md に詳述）:
//   (1) 明確な指示（order かつ confidence >= ORDER_CLARITY）は最優先
//   (2) 実況QA・計算・知識など「事実系」は雑談より優先
//   (3) 文脈継続（followup）は直近話題との整合でボーナス
//   (4) 同点は source 基礎優先度 → confidence → 提案順 で決定的に決定
//   (5) 全提案が低信頼なら null

// ---------------------------------------------------------------- 定数
// source の基礎優先度。事実系 > 文脈継続 > 知識 > 雑談 > 汎用の順。
export const BASE_PRIORITY = {
  order: 90,     // 指示は会話ではなく「命令」。明確なら何より優先
  qa: 70,        // 実況QA（実値で答える）
  tool: 68,      // 計算ツール（実値で答える）
  followup: 55,  // 文脈継続（ボーナスで浮上する）
  knowledge: 50, // マイクラ知識ベース
  chat: 35,      // 雑談（chat系カテゴリ）
  general: 25,   // 汎用会話（chat_general。最も広く・浅い）
};
const SOURCE_ORDER = ["order", "qa", "tool", "followup", "knowledge", "chat", "general"];

export const CONF_WEIGHT = 25;        // confidence 0..1 をスコアへ換算する重み
export const ORDER_CLARITY = 0.6;     // これ未満の order は「曖昧な指示」として基礎優先度を下げる
export const ORDER_AMBIGUOUS_BASE = 40; // 曖昧な指示の基礎優先度（事実系未満、雑談並み）
export const FOLLOWUP_BONUS_MAX = 15; // 文脈整合ボーナスの上限
export const MIN_CONFIDENCE = 0.35;   // 全提案がこれ未満なら null（ルール5）
export const MIN_SCORE = 40;          // 勝者のスコア下限。これ未満なら null（ルール5）

// ---------------------------------------------------------------- 小物
const clamp01 = (v) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0.5;
  return Math.min(1, Math.max(0, n));
};
function baseOf(source) {
  return typeof BASE_PRIORITY[source] === "number" ? BASE_PRIORITY[source] : 20;
}
function sourceRank(source) {
  const i = SOURCE_ORDER.indexOf(source);
  return i >= 0 ? i : SOURCE_ORDER.length;
}

// convCtx の正規化。conversation.js の getContext() 形式と、
// main.js 実行時形式（{ lastTopic: 'found_diamond', lastTopicAt: epochMs }）の両対応。
function normConv(convCtx) {
  const c = convCtx || {};
  let lastIntent = c.lastIntent ?? null;
  if (!lastIntent && typeof c.lastTopic === "string") lastIntent = c.lastTopic;
  if (!lastIntent && c.lastTopic && typeof c.lastTopic === "object") lastIntent = c.lastTopic.intent ?? null;
  const stack = Array.isArray(c.topicStack) ? c.topicStack : [];
  let sinceLastSec = typeof c.sinceLastSec === "number" ? c.sinceLastSec : null;
  if (sinceLastSec === null && typeof c.lastTopicAt === "number") {
    const now = typeof c.now === "number" ? c.now : Date.now();
    sinceLastSec = Math.max(0, (now - c.lastTopicAt) / 1000);
  }
  return { lastIntent, stack, sinceLastSec };
}

// followup 提案の文脈整合度 0..1。
// prev（継続元のカテゴリid群）と直近話題が一致するほど高い。
// 時間が経つと減衰する（90秒まで全開、300秒でほぼ消滅。現行 main.js の90秒窓に合わせた）。
export function followupCoherence(proposal, convCtx) {
  const { lastIntent, stack, sinceLastSec } = normConv(convCtx);
  const prev = Array.isArray(proposal?.prev) ? proposal.prev : [];
  let coh = 0;
  if (lastIntent && (prev.includes(lastIntent) || proposal?.category === lastIntent)) coh = 1;
  if (coh === 0) {
    for (const e of stack) {
      if (e && prev.includes(e.intent)) coh = Math.max(coh, clamp01(e.weight ?? 0.5));
    }
  }
  if (coh === 0) return 0;
  let fresh = 1;
  if (typeof sinceLastSec === "number") {
    if (sinceLastSec > 300) fresh = 0;
    else if (sinceLastSec > 90) fresh = 0.4;
  }
  return coh * fresh;
}

// ---------------------------------------------------------------- スコアリング
// 1提案のスコア内訳を返す（テスト・デバッグ・勝者理由の表示用）。
export function scoreProposal(proposal, convCtx) {
  const p = proposal || {};
  const confidence = clamp01(p.confidence);
  let base = baseOf(p.source);
  let ambiguousOrder = false;
  if (p.source === "order" && confidence < ORDER_CLARITY) {
    base = ORDER_AMBIGUOUS_BASE;
    ambiguousOrder = true;
  }
  const bonus = p.source === "followup" ? FOLLOWUP_BONUS_MAX * followupCoherence(p, convCtx) : 0;
  const score = base + confidence * CONF_WEIGHT + bonus;
  return { score, base, confidence, bonus, ambiguousOrder };
}

// 全提案を順位付けして返す（スコア降順、同点は基礎優先度→confidence→source順→提案順）。
// 各要素は { proposal, score, base, confidence, bonus } 。決定的（乱数なし）。
export function rankProposals(proposals, convCtx) {
  const list = (Array.isArray(proposals) ? proposals : [])
    .map((p, idx) => (p && typeof p === "object" ? { p, idx } : null))
    .filter(Boolean)
    .map(({ p, idx }) => ({ proposal: p, idx, ...scoreProposal(p, convCtx) }));
  list.sort((a, b) =>
    b.score - a.score ||
    b.base - a.base ||
    b.confidence - a.confidence ||
    sourceRank(a.proposal.source) - sourceRank(b.proposal.source) ||
    a.idx - b.idx
  );
  return list.map(({ proposal, score, base, confidence, bonus }) => ({ proposal, score, base, confidence, bonus }));
}

// ---------------------------------------------------------------- 本体
// proposals から最良の1つを選んで返す。全提案が低信頼なら null。
// 返り値は提案オブジェクトそのもの（source / text / order / act / category を含む）。
export function arbitrate(proposals, convCtx) {
  const ranked = rankProposals(proposals, convCtx);
  if (ranked.length === 0) return null;
  const top = ranked[0];
  // ルール(5): 全提案が低信頼なら、勝手に答えず沈黙/フォールバックに譲る
  const maxConf = Math.max(...ranked.map((r) => r.confidence));
  if (maxConf < MIN_CONFIDENCE) return null;
  if (top.score < MIN_SCORE) return null;
  return top.proposal;
}

// ---------------------------------------------------------------- アダプタ群
// 既存モジュールの出力を proposals 形式へ変換する。入力が null なら null を返す
// （統合側で配列に入れても arbitrate が無視する）。

// order_parser.parseOrder の戻り値 → order 提案。
// confidence は注文の具体性から付ける:
//   おまかせ/護衛などの明示コマンド 0.95 / 対象+数量あり 0.9 / 建築（構造物指定）0.85
//   対象あり・数量なし（全部/たくさん）0.8 / 敵一括などの集合対象 0.75 / その他 0.7
export function adaptOrder(order) {
  if (!order || typeof order !== "object") return null;
  let confidence = 0.7;
  const t = order.target || {};
  const hasTarget = !!(t.item || t.block || t.entity);
  if (order.kind === "free" || order.kind === "escort" || order.kind === "watch" || order.kind === "forbid" || order.kind === "clarify") confidence = 0.95;
  else if (order.kind === "build" && hasTarget) confidence = 0.85;
  else if (hasTarget && typeof order.amount === "number") confidence = 0.9;
  else if (hasTarget && t.generic) confidence = 0.75;
  else if (hasTarget) confidence = 0.8;
  return { source: "order", order, confidence, category: order.kind || null };
}

// grounded_qa.answerQuestion の戻り値（文字列|null）→ qa 提案。
// 実値で答えた文は 0.9。「分かりません」系の正直な不明回答は、事実系として
// 雑談には勝たせたいが弱い主張なので 0.4。
export function adaptQA(answer) {
  if (typeof answer !== "string" || !answer) return null;
  const isUnknown = answer.includes("分かりません");
  return { source: "qa", text: answer, confidence: isUnknown ? 0.4 : 0.9, category: null };
}

// chat_tools.tryTool の戻り値（文字列|null）→ tool 提案。
// ツール系は数値パターンが揃ったときだけ発火するので一律 0.9。
export function adaptTool(result) {
  if (typeof result !== "string" || !result) return null;
  return { source: "tool", text: result, confidence: 0.9, category: null };
}

// mc_knowledge.lookupKnowledge の戻り値（エントリ|null）→ knowledge 提案。
// confidence は「マッチしたキーの最長長」から推定する（lookupKnowledge はスコアを返さないため）。
//   キー長 2 → 0.6 / 3 → 0.7 / 4 → 0.8 / 5以上 → 0.9。text 省略時は 0.6。
export function adaptKnowledge(entry, text) {
  if (!entry || typeof entry !== "object" || typeof entry.answer !== "string") return null;
  let confidence = 0.6;
  if (typeof text === "string" && Array.isArray(entry.keys)) {
    const t = text.toLowerCase();
    let longest = 0;
    for (const k of entry.keys) {
      const nk = String(k).toLowerCase();
      if (nk && t.includes(nk)) longest = Math.max(longest, nk.length);
    }
    if (longest > 0) confidence = Math.min(0.9, 0.4 + longest * 0.1);
  }
  return { source: "knowledge", text: entry.answer, confidence, category: entry.topic || null, ref: entry.id || null };
}

// chat系カテゴリ {id, keys, replies, act} → chat / general / followup 提案。
// opts: { source='chat', text（選んだ返信文）, keyLen（マッチしたキーの長さ）, pickedIndex }
// confidence はマッチしたキー長から: 1→0.35 / 2→0.5 / 3→0.65 / 4以上→0.8。keyLen 省略時は 0.55。
// text 省略時は replies[0] を仮置きする（統合側で乱択して差し替えても調停結果は変わらない）。
export function adaptChat(cat, opts = {}) {
  if (!cat || typeof cat !== "object") return null;
  const source = opts.source || "chat";
  const replies = Array.isArray(cat.replies) ? cat.replies : [];
  const text = typeof opts.text === "string" ? opts.text : (replies[0] ?? null);
  if (!text) return null;
  let confidence = 0.55;
  if (typeof opts.keyLen === "number") {
    confidence = opts.keyLen >= 4 ? 0.8 : opts.keyLen === 3 ? 0.65 : opts.keyLen === 2 ? 0.5 : 0.35;
  }
  const p = { source, text, confidence, category: cat.id || null, act: cat.act ?? null };
  if (source === "followup" && Array.isArray(cat.prev)) p.prev = cat.prev;
  return p;
}

// chat_followups のカテゴリ → followup 提案（adaptChat の source 固定版）。
export function adaptFollowup(cat, opts = {}) {
  return adaptChat(cat, { ...opts, source: "followup" });
}

export default arbitrate;
