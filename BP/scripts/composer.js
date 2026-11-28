// ============================================================
// リゼ (LIZE-07) 応答コンポーザ — 純粋JS（@minecraft/server 非依存）
// 参考: HuggingFace PyBot の compose 層（返信の組み立て＋何も合わないときの言い方）。
// リゼの返信を「1文の固定文」から「部品の組み立て」に格上げする層。
//
// 役割:
//  - compose(parts, ctx): main（必須）＋detail（任意）を自然に接続し、
//    tone（normal/soft/dry）で語尾を整え、followup を1つまで付ける。
//    原則2文まで（チャットで読みやすい上限）。
//  - composeFallback(ctx, attempts): どの層も何も返せなかったときの
//    フォールバック文。同じ言い回しの連続を避け、会話の流れ
//    （質問が開いているか、連続失敗回数、状況）で文面を変える。
//
// tone の自動選択:
//  - parts.tone があればそれを優先。
//  - 無ければ bond（ctx.flags.bond、0〜100）が 70 以上で soft
//    （敬語が一言だけほどける）。危険が近い（ctx.danger.safetyNearestDist<=6）
//    ときは dry（短く真顔）。それ以外は normal。
//
// 履歴（重複回避）:
//  - ctx.recentFollowups: 直近で使った followup 文の配列（文字列）
//  - ctx.history: 直近の発話履歴（文字列 or {text} の配列）
//  - ctx.recentFallbacks: 直近で使った fallback 文の配列
//  いずれも無ければ空として扱う。呼び出し側は返した文を履歴へ積むこと。
// ============================================================

// ---------- 小物 ----------

function str(v) { return typeof v === "string" ? v : ""; }

function bondOf(ctx) {
  const b = ctx?.flags?.bond ?? ctx?.bond ?? ctx?.x?.bond;
  return typeof b === "number" ? b : 0;
}

function historyTexts(ctx) {
  const out = [];
  const push = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const e of arr) {
      if (typeof e === "string") out.push(e);
      else if (e && typeof e.text === "string") out.push(e.text);
    }
  };
  push(ctx?.recentFollowups);
  push(ctx?.recentFallbacks);
  push(ctx?.history);
  push(ctx?.usedLines);
  return out;
}

// 文の数を数える（。！？を区切りとする）
function countSentences(text) {
  const m = str(text).match(/[。！？]/g);
  return m ? m.length : (text ? 1 : 0);
}

// 末尾の句読点を落とす（接続の整形用）。！？は意味があるので残す。
function stripTailPunct(text) {
  return str(text).replace(/[。、]+$/u, "");
}

// ---------- 二重敬語・冗長表現の回避 ----------
// 安全に直せるものだけを対象にする（「ますます」等の正当な副詞には触らない）。
const POLITENESS_FIXES = [
  [/でございますです/gu, "でございます"],
  [/いたしましたです/gu, "いたしました"],
  [/でしたです/gu, "でした"],
  [/ますです/gu, "ます"],
  [/ですです/gu, "です"],
  [/ですます/gu, "です"],
  [/。。+/gu, "。"],
  [/、、+/gu, "、"],
];

export function fixPoliteness(text) {
  let t = str(text);
  for (const [re, rep] of POLITENESS_FIXES) t = t.replace(re, rep);
  return t;
}

// ---------- soft: 敬語が一言だけほどける小辞書 ----------
// 文全体ではなく「最後の文の語尾」だけを変換する（一言だけ、が仕様）。
// 変換が危険な動詞活用には触らない。安全な対応表のみ。
const SOFT_ENDING_PAIRS = [
  [/でございます$/u, "です"], // ほどけるというより馴染む形へ
  [/あります$/u, "ある"],
  [/行きます$/u, "行く"],
  [/来ます$/u, "来る"],
  [/します$/u, "する"],
  [/できます$/u, "できる"],
  [/わかります$/u, "わかる"],
  [/取ります$/u, "取る"],
  [/掘ります$/u, "掘る"],
  [/運びます$/u, "運ぶ"],
  [/帰ります$/u, "帰る"],
  [/見ます$/u, "見る"],
  [/います$/u, "いる"],
  [/でした$/u, "だった"],
  [/です$/u, "だ"],
];

export function applySoftTone(text) {
  const t = str(text);
  // 最後の文（最後の。の手前まで＋語尾）だけを対象にする
  const m = t.match(/^(.*?)([^。！？]*)([。！？])$/u);
  if (!m) return t;
  const [, head, lastSentence, punct] = m;
  // ？や！で終わる文、命令形（ください等）は変換しない
  if (punct !== "。") return t;
  if (/ください$|なさい$/u.test(lastSentence)) return t;
  for (const [re, rep] of SOFT_ENDING_PAIRS) {
    if (re.test(lastSentence)) {
      return head + lastSentence.replace(re, rep) + punct;
    }
  }
  return t;
}

// ---------- dry: 真顔・短く ----------
// 語尾の柔らかみ（よ/ね）を落とし、文を締める。
export function applyDryTone(text) {
  let t = str(text);
  t = t.replace(/ですね([。！？])/gu, "です$1");
  t = t.replace(/ですよ([。！？])/gu, "です$1");
  t = t.replace(/ますね([。！？])/gu, "ます$1");
  t = t.replace(/ますよ([。！？])/gu, "ます$1");
  t = t.replace(/でしょう([。！？])/gu, "のはずです$1");
  return t;
}

// ---------- tone の決定 ----------

export function resolveTone(parts, ctx) {
  if (parts?.tone === "soft" || parts?.tone === "dry" || parts?.tone === "normal") {
    return parts.tone;
  }
  const dangerDist = ctx?.danger?.safetyNearestDist ?? ctx?.danger?.nearestDist ?? ctx?.x?.dangerDist;
  if (typeof dangerDist === "number" && dangerDist >= 0 && dangerDist <= 6) return "dry";
  if (bondOf(ctx) >= 70) return "soft";
  return "normal";
}

// ---------- followup 候補 ----------
// { kind, text, when(ctx) } 。when が無いものは常時候補。
// dry のときは blunt（短い）版を優先する。
const FOLLOWUPS = [
  // ask: 問い返し
  { kind: "ask", text: "他に要りますか？", when: null },
  { kind: "ask", text: "続けますか、それとも休みますか？", when: (c) => (c?.flags?.workMinutes ?? 0) >= 30 },
  { kind: "ask", text: "先にコーヒー、淹れますか？", when: (c) => c?.env === "morning" || (c?.x?.timeOfDay ?? 99999) < 2000 },
  { kind: "ask", text: "夜が深いです。就寝の準備はしますか？", when: (c) => c?.env === "night" },
  { kind: "ask", text: "拠点に戻りますか？", when: (c) => !!c?.home && (c?.danger?.safetyNearestDist ?? 999) <= 12 },
  { kind: "ask", text: "……聞いていますか？", when: (c) => bondOf(c) >= 50 },
  // suggest: 提案
  { kind: "suggest", text: "ついでに、近くのドロップも拾っておきます。", when: (c) => (c?.drops?.nearestDist ?? -1) >= 0 },
  { kind: "suggest", text: "荷物が重そうです。先に入庫しますか。", when: (c) => !!c?.self?.invFull },
  { kind: "suggest", text: "松明を置いておくと、帰り道が安全です。", when: (c) => (c?.x?.lightLevel ?? 15) <= 7 },
  { kind: "suggest", text: "続きは私がやります。あなたは見ていてください。", when: (c) => bondOf(c) >= 60 },
  { kind: "suggest", text: "次は量を決めてから声をかけてください。そのほうが速いです。", when: null, blunt: true },
  // confirm: 確認
  { kind: "confirm", text: "このまま続けます。違ったら止めてください。", when: null },
  { kind: "confirm", text: "合っていますか？", when: null, blunt: true },
  { kind: "confirm", text: "……よければ、この調子で進めます。", when: (c) => bondOf(c) >= 40 },
];

export function pickFollowup(kind, ctx, tone) {
  if (!kind) return null;
  const used = new Set(historyTexts(ctx));
  let cands = FOLLOWUPS.filter((f) => f.kind === kind && (!f.when || safeWhen(f.when, ctx)));
  if (cands.length === 0) return null;
  if (tone === "dry") {
    const blunt = cands.filter((f) => f.blunt);
    if (blunt.length > 0) cands = blunt;
  }
  const fresh = cands.filter((f) => !used.has(f.text));
  const pool = fresh.length > 0 ? fresh : cands;
  // 決定的なローテーション（乱数があれば使う）
  const rng = typeof ctx?.rng === "function" ? ctx.rng : null;
  const idx = rng ? Math.floor(rng() * pool.length) : (historyTexts(ctx).length % pool.length);
  return pool[Math.min(idx, pool.length - 1)].text;
}

function safeWhen(fn, ctx) {
  try { return !!fn(ctx || {}); } catch { return false; }
}

// ---------- main + detail の接続 ----------

function joinMainDetail(main, detail) {
  const m = stripTailPunct(main.trim());
  const d = str(detail).trim();
  if (!d) return m;
  // main が ！？ で終わる → detail は独立した文として続ける
  if (/[！？]$/u.test(m)) return m + ensureSentenceEnd(d);
  // detail が「……」で始まる → 句点で区切ってそのまま
  if (/^……/u.test(d)) return m + "。" + d.replace(/^[。、]+/u, "");
  // main が接続形で終わる（て形・条件・逆接の助詞）→ 句読点なしで直結
  if (/(て|で|し|が|ので|から|たら|ば|けど|けれど)$/u.test(m)) return m + d;
  // main が読点で終わっていた → そのまま直結
  if (/、$/u.test(main.trim())) return main.trim() + d;
  // 既定: 句点で区切る
  return m + "。" + d;
}

function ensureSentenceEnd(text) {
  const t = str(text).trim();
  if (!t) return t;
  return /[。！？]$/u.test(t) ? t : t + "。";
}

// 文数キャップ: 原則2文まで。3文以上は先頭2文で切る。
function capSentences(text, max = 2) {
  const parts = str(text).match(/[^。！？]+[。！？]?/gu) || [];
  const sentences = parts.map((s) => s.trim()).filter(Boolean);
  if (sentences.length <= max) return str(text);
  return sentences.slice(0, max).join("");
}

// ---------- 本体: compose ----------

export function compose(parts, ctx) {
  const p = parts || {};
  const c = ctx || {};
  const main = str(p.main).trim();
  if (!main) return "";
  const tone = resolveTone(p, c);

  let text = joinMainDetail(main, p.detail);
  text = ensureSentenceEnd(text);
  text = fixPoliteness(text);

  // followup: 文数に余裕があるときだけ付ける（main+detail で2文なら付けない）
  if (p.followup) {
    if (countSentences(text) < 2) {
      const fu = pickFollowup(p.followup, c, tone);
      if (fu) text += fu;
    }
  }

  text = capSentences(text, 2);
  if (tone === "soft") text = applySoftTone(text);
  else if (tone === "dry") text = applyDryTone(text);
  return fixPoliteness(text);
}

// ---------- フォールバック ----------
// attempts: 連続でフォールバックになった回数（0始まり想定、1以上でも可）。
// 会話の流れ: ctx.openQuestion（未回答の質問が開いている）/
//           ctx.conv?.openQuestion も見る。
const FALLBACK_BASE = [
  "すみません。今のは、私の範囲外でした。",
  "分かりません。分かったふりは、しません。",
  "その件は、記録にありません。",
  "うまく拾えませんでした。別の言い方だと、助かります。",
];
const FALLBACK_OPEN_QUESTION = [
  "さっきの質問、まだ答えを持っていません。調べる手段も、今はありません。",
  "その質問は開いたままです。答えられないのは、私の側の問題です。",
  "……答えたいところですが、材料が足りません。",
];
const FALLBACK_ESCALATE = [
  "二度目です。言い方を少し変えてもらえると、拾えるかもしれません。",
  "続けて拾えていません。採取や運搬の指示なら、その場で動けます。",
  "私が確実にできるのは、付いて行くことと、物を運ぶことです。そこから試しませんか。",
];
const FALLBACK_SITUATIONAL = [
  { text: "戦闘中です。話は、後で聞きます。", when: (c) => (c?.danger?.safetyNearestDist ?? 999) <= 8 },
  { text: "作業中です。要件だけ、先にどうぞ。", when: (c) => !!c?.mission || c?.mode === "work" },
  { text: "夜です。長話は明日にして、まずは安全を。", when: (c) => c?.env === "night" },
  { text: "……分かりません。でも、隣にはいます。", when: (c) => bondOf(c) >= 70 },
];

export function composeFallback(ctx, attempts) {
  const c = ctx || {};
  const n = typeof attempts === "number" && attempts > 0 ? Math.floor(attempts) : 0;
  const used = new Set(historyTexts(c));

  // 状況専用が最優先（ただし使い回しは避ける）
  const situational = FALLBACK_SITUATIONAL.filter(
    (f) => safeWhen(f.when, c) && !used.has(f.text)
  );
  if (situational.length > 0 && n === 0) return situational[0].text;

  const openQ = !!(c.openQuestion || c.conv?.openQuestion);
  let pool;
  if (n >= 2) pool = FALLBACK_ESCALATE;
  else if (openQ) pool = FALLBACK_OPEN_QUESTION;
  else pool = FALLBACK_BASE;

  const fresh = pool.filter((t) => !used.has(t));
  const use = fresh.length > 0 ? fresh : pool;
  const idx = Math.min(n, use.length - 1);
  return use[idx];
}
