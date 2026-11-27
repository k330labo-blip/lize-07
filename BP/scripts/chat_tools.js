// チャット計算ユーティリティ層（リゼ／LIZE-07）
// チャットで頼める小さな計算・換算を正確にこなす。純粋JS、eval 禁止（式パーサ自作）。
// export: tryTool(text, ctx) → 文字列 | null（計算依頼と判定できなければ null を返し、通常会話に譲る）
// ctx: { home:{x,y,z}|null, pos:{x,y,z}|null, timeOfDay?: number(0-24000), bond?: number }
// 口調: 一人称「私」、短い敬語。数値は正確に、余計な装飾は付けない。

// ---------------------------------------------------------------- 共通
function norm(s) {
  return String(s ?? "")
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, ".").replace(/，/g, ",").replace(/、/g, ",")
    .replace(/＋/g, "+").replace(/－/g, "-").replace(/×/g, "*").replace(/÷/g, "/")
    .replace(/（/g, "(").replace(/）/g, ")")
    .replace(/\s+/g, "");
}
function fmt(n) {
  if (!Number.isFinite(n)) return null;
  if (Number.isInteger(n)) return String(n);
  // 小数は有効数字を整えて返す（誤差の桁は見せない）
  return String(Math.round(n * 10000) / 10000);
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------- (1) 四則演算パーサ
// 対応: 数字（小数・負数）、+ - * /、括弧、日本語演算子（かける/掛ける/わる/割る/足す/引く/たす/ひく）
// 再帰下降パーサ。式でない文字列は null。
function tokenizeExpr(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const v = Number(s.slice(i, j));
      if (!Number.isFinite(v)) return null;
      toks.push({ t: "num", v });
      i = j;
    } else if ("+-*/()".includes(ch)) {
      toks.push({ t: ch });
      i++;
    } else return null;
  }
  return toks;
}
function evalTokens(toks) {
  let pos = 0;
  const peek = () => toks[pos];
  function parseExpr() {
    let v = parseTerm();
    if (v === null) return null;
    while (peek() && (peek().t === "+" || peek().t === "-")) {
      const op = toks[pos++].t;
      const rhs = parseTerm();
      if (rhs === null) return null;
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  function parseTerm() {
    let v = parseFactor();
    if (v === null) return null;
    while (peek() && (peek().t === "*" || peek().t === "/")) {
      const op = toks[pos++].t;
      const rhs = parseFactor();
      if (rhs === null) return null;
      if (op === "/") { if (rhs === 0) return null; v = v / rhs; }
      else v = v * rhs;
    }
    return v;
  }
  function parseFactor() {
    const tk = peek();
    if (!tk) return null;
    if (tk.t === "-") { pos++; const v = parseFactor(); return v === null ? null : -v; }
    if (tk.t === "+") { pos++; return parseFactor(); }
    if (tk.t === "num") { pos++; return tk.v; }
    if (tk.t === "(") {
      pos++;
      const v = parseExpr();
      if (v === null || !peek() || peek().t !== ")") return null;
      pos++;
      return v;
    }
    return null;
  }
  const v = parseExpr();
  if (v === null || pos !== toks.length) return null;
  return v;
}
function tryArithmetic(text) {
  let s = text
    .replace(/かける|掛ける/g, "*").replace(/わる|割る/g, "/")
    .replace(/足す|たす/g, "+").replace(/引く|ひく/g, "-");
  // 式らしい部分だけを抜く（前後の「は」「？」「教えて」等を落とす）
  const m = s.match(/-?\(?[0-9][0-9.+\-*/()]*[0-9)]/);
  if (!m) return null;
  const expr = m[0];
  if (!/[+\-*/]/.test(expr.slice(1)) && !/[+\-*/]/.test(expr)) return null; // 単なる数字は計算依頼にしない
  const toks = tokenizeExpr(expr);
  if (!toks || toks.length < 3) return null;
  const v = evalTokens(toks);
  const out = fmt(v);
  if (out === null) return null;
  return `${out}です`;
}

// ---------------------------------------------------------------- (2) スタック換算
// 基本64。16: 卵/雪玉/エンダーパール/看板/バケツ等。1: 道具・武器・防具・ポーション等。
const STACK16 = ["卵", "雪玉", "エンダーパール", "看板", "サイン", "バケツ", "旗", "バナー", "本と羽ペン", "ケーキ"];
const STACK1 = ["剣", "ツルハシ", "斧", "シャベル", "クワ", "兜", "かぶと", "ヘルメット", "胸当て", "チェストプレート", "レギンス", "脚", "ブーツ", "靴", "盾", "弓", "クロスボウ", "トライデント", "ポーション", "釣り竿", "ハサミ", "鞍", "馬鎧", "エリトラ"];
function stackSizeFor(text) {
  for (const k of STACK16) if (text.includes(k)) return 16;
  for (const k of STACK1) if (text.includes(k)) return 1;
  return 64;
}
function itemNameIn(text) {
  const dict = ["エンダーパール", "雪玉", "卵", "ダイヤモンド", "鉄インゴット", "原木", "丸石", "土", "砂", "木材", "石炭", "小麦", "ニンジン", "矢", "火薬", "糸", "羽", "骨", "肉"];
  for (const d of dict) if (text.includes(d)) return d;
  return null;
}
function tryStack(text) {
  const size = stackSizeFor(text);
  const item = itemNameIn(text);
  const unit = item ? `${item}は1スタック${size}個で、` : "";
  // 「Nスタック(とM個)?は何個」
  let m = text.match(/(\d+(?:\.\d+)?)スタック(?:と(\d+)個)?(?:は)?何個/);
  if (m) {
    const total = Number(m[1]) * size + (m[2] ? Number(m[2]) : 0);
    return `${unit}${fmt(total)}個です`;
  }
  // 「N個は何スタック」
  m = text.match(/(\d+)個は(?:何|いくつ)スタック/);
  if (m) {
    const n = Number(m[1]);
    const st = Math.floor(n / size);
    const rest = n % size;
    if (size === 1) return `${unit}${n}スタックです。……1個ずつしか持てません`;
    if (rest === 0) return `${unit}ちょうど${st}スタックです`;
    if (st === 0) return `${unit}${rest}個だけです。1スタックに届きません`;
    return `${unit}${st}スタックと${rest}個です`;
  }
  // 「1スタック何個」
  if (/スタック(?:は|って)?何個/.test(text) || /スタック何個/.test(text)) {
    return `${unit}${size}個です`;
  }
  return null;
}

// ---------------------------------------------------------------- (3) 装備・道具の素材コスト
// 数は「素材インゴット/個」換算（棒などの副素材は注記側で触れる）
const GEAR_COST = {
  "兜": 5, "かぶと": 5, "頭": 5, "ヘルメット": 5,
  "胸当て": 8, "胸": 8, "チェストプレート": 8, "鎧": 8,
  "レギンス": 7, "脚": 7, "ズボン": 7,
  "ブーツ": 4, "靴": 4, "足": 4,
  "剣": 2, "ツルハシ": 3, "斧": 3, "オノ": 3, "シャベル": 1, "スコップ": 1, "クワ": 2, "鍬": 2,
  "盾": 1, "弓": 0, "ハサミ": 2,
};
const FULL_SET = { "兜": 5, "胸当て": 8, "レギンス": 7, "ブーツ": 4 }; // 合計24
const MATERIALS = [
  { keys: ["ネザライト"], ingot: "ネザライトインゴット", base: "ダイヤモンド" },
  { keys: ["ダイヤ"], ingot: "ダイヤモンド" },
  { keys: ["鉄", "アイアン"], ingot: "鉄インゴット" },
  { keys: ["金", "ゴールド", "黄金"], ingot: "金インゴット" },
  { keys: ["革", "レザー"], ingot: "革" },
  { keys: ["石", "丸石"], ingot: "丸石" },
  { keys: ["木"], ingot: "木材" },
];
function tryGearCost(text) {
  if (!/(一式|フル(?!ーツ)|装備|防具|剣|ツルハシ|斧|シャベル|クワ|兜|胸当て|チェストプレート|ヘルメット|レギンス|ブーツ|盾|ハサミ)/.test(text)) return null;
  // cyc2003 A01/A02: 作製動詞がある指示はコスト質問ではない (「ダイヤの防具一式作って」が
  // コスト応答に競合して作製へ進まなかった)。質問形の判定は下の既存ゲートに任せる。
  if (/(作って|作る|作製)/.test(text) && !/(何個|いくつ|要る|必要|コスト)/.test(text)) return null;
  if (!/(何個|いくつ|要る|いる|必要|コスト|素材)/.test(text) && !/(一式|フル(?!ーツ))/.test(text)) return null;
  const mat = MATERIALS.find((mm) => mm.keys.some((k) => text.includes(k)));
  if (!mat) return null;
  const isNetherite = mat.ingot === "ネザライトインゴット";
  if (/一式|フル(?!ーツ)|全部|全身/.test(text)) {
    const total = Object.values(FULL_SET).reduce((a, b) => a + b, 0); // 24
    if (isNetherite) {
      return `ネザライト一式は、まずダイヤ装備一式（${total}個分）を作って、ネザライトインゴット4個で強化します。……合金の分、手間は二重です`;
    }
    return `${mat.ingot}${total}個です（兜5・胸当て8・レギンス7・ブーツ4）。棒は別です`;
  }
  // 個別の道具・防具
  for (const [name, cost] of Object.entries(GEAR_COST)) {
    if (text.includes(name)) {
      if (cost === 0) return `弓は木の棒3本と糸3つです。${mat.ingot}は使いません`;
      if (isNetherite) {
        return `ネザライトの${name}は、ダイヤの${name}（${mat.base}${cost}個）にネザライトインゴット1個で強化します`;
      }
      const stick = ["剣", "ツルハシ", "斧", "オノ", "シャベル", "スコップ", "クワ", "鍬"].includes(name) ? "。あと棒が要ります" : "";
      return `${mat.ingot}${cost}個です${stick}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------- (4) 座標・距離
function parseTriples(text) {
  const re = /(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push({ x: Number(m[1]), y: Number(m[2]), z: Number(m[3]) });
  return out;
}
function tryDistance(text, ctx) {
  if (!/(距離|何ブロック|遠い|離れて)/.test(text) && !/から.*まで/.test(text)) return null;
  const pts = parseTriples(text);
  let a = null, b = null, bName = "";
  if (pts.length >= 2) { a = pts[0]; b = pts[1]; }
  else if (pts.length === 1 && /家|拠点|ホーム/.test(text) && ctx?.home) { a = pts[0]; b = ctx.home; bName = "家"; }
  else if (pts.length === 1 && ctx?.pos) { a = ctx.pos; b = pts[0]; }
  else if (pts.length === 0 && /家|拠点|ホーム/.test(text) && ctx?.home && ctx?.pos) { a = ctx.pos; b = ctx.home; bName = "家"; }
  if (!a || !b) return null;
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  const flat = Math.hypot(dx, dz);
  const d3 = Math.hypot(dx, dy, dz);
  const where = bName ? `${bName}まで` : "2点の間";
  return `${where}、水平で約${fmt(Math.round(flat * 10) / 10)}ブロック、直線で約${fmt(Math.round(d3 * 10) / 10)}ブロックです`;
}

// ---------------------------------------------------------------- (5) 時間換算
function tryTime(text, ctx) {
  // マイクラ: 1日 = 現実20分（1時間=50秒）
  const isMc = /マイクラ|マインクラフト|ゲーム内|ゲームの/.test(text);
  // 現実時間 → マイクラ日数（「現実で40分はマイクラ何日」）は先に判定する
  let m = text.match(/現実(?:で)?(\d+(?:\.\d+)?)(時間|分)/);
  if (m && isMc && /何日/.test(text)) {
    const mins = m[2] === "時間" ? Number(m[1]) * 60 : Number(m[1]);
    return `ゲーム内では約${fmt(mins / 20)}日分です`;
  }
  m = text.match(/(\d+(?:\.\d+)?)(時間|分|秒|日)/);
  if (m && /(何分|何秒|何時間|何日)/.test(text)) {
    const v = Number(m[1]);
    const from = m[2];
    const target = text.match(/何(分|秒|時間|日)/)[1];
    if (isMc) {
      // ゲーム内単位 → 現実: 1日=20分, 1時間(ゲーム内)=50秒, 1分=5/6秒, 1秒=1/72秒
      const toRealMin = from === "日" ? v * 20 : from === "時間" ? (v * 50) / 60 : from === "分" ? v / 72 : v / 4320;
      if (target === "分") return `現実で約${fmt(toRealMin)}分です。ゲーム内1日は、現実の20分です`;
      if (target === "秒") return `現実で約${fmt(toRealMin * 60)}秒です`;
      if (target === "時間") return `現実で約${fmt(toRealMin / 60)}時間です`;
    }
    const toSec = from === "時間" ? v * 3600 : from === "分" ? v * 60 : from === "日" ? v * 86400 : v;
    if (target === "分") return `${fmt(toSec / 60)}分です`;
    if (target === "秒") return `${fmt(toSec)}秒です`;
    if (target === "時間") return `${fmt(toSec / 3600)}時間です`;
    if (target === "日") return `${fmt(toSec / 86400)}日です`;
  }
  // 現在のゲーム内時刻 → 現実の目安（昼/夜まで）
  if (ctx?.timeOfDay !== undefined && /(今|現在).*(何時|時刻|時間)|あと.*(夜|朝|昼)/.test(text)) {
    const t = ctx.timeOfDay; // 0=朝6時, 6000=正午, 12000=夕方, 18000=深夜0時
    const hour = Math.floor(((t / 1000) + 6) % 24);
    const min = Math.floor((((t / 1000) + 6) % 1) * 60);
    if (/あと.*夜/.test(text)) {
      const ticks = t < 12000 ? 12000 - t : 24000 - t + 12000;
      return `夜まで、現実で約${fmt(Math.round((ticks / 20) * 10) / 10)}秒です`; // 20tick=1秒(現実)
    }
    if (/あと.*朝/.test(text)) {
      const ticks = t < 23000 ? (t <= 0 ? 0 : 24000 - t) : 24000 - t;
      return `朝まで、現実で約${fmt(Math.round((ticks / 20) * 10) / 10)}秒です`;
    }
    return `ゲーム内では${hour}時${min}分ごろです。現実の1分で、ゲーム内は約1.2時間進みます`;
  }
  return null;
}

// ---------------------------------------------------------------- (6) 確率・期待値
function tryProbability(text) {
  // 「1/200のドロップ、100体倒したら当たる確率」
  let m = text.match(/(\d+)\s*\/\s*(\d+)/);
  const trials = text.match(/(\d+)(?:体|回|個|人)/);
  if (m && trials && /(確率|当たる|出る|引ける)/.test(text)) {
    const p = Number(m[1]) / Number(m[2]);
    const n = Number(trials[1]);
    if (p > 0 && p <= 1 && n > 0) {
      const hit = 1 - Math.pow(1 - p, n);
      return `${n}回で少なくとも1回当たる確率は、約${fmt(Math.round(hit * 1000) / 10)}%です。期待値は${fmt(Math.round(p * n * 100) / 100)}個です`;
    }
  }
  // 「確率25%で40回」
  m = text.match(/(\d+(?:\.\d+)?)\s*[%％]/);
  if (m && trials && /(確率|当たる|期待値)/.test(text)) {
    const p = Number(m[1]) / 100;
    const n = Number(trials[1]);
    if (/期待値/.test(text)) return `期待値は${fmt(Math.round(p * n * 100) / 100)}個です`;
    const hit = 1 - Math.pow(1 - p, n);
    return `${n}回で少なくとも1回当たる確率は、約${fmt(Math.round(hit * 1000) / 10)}%です`;
  }
  // 期待値のみ: 「1/16の確率、期待値は」→ n回分が必要。n があれば
  m = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (m && trials && /期待値/.test(text)) {
    const p = Number(m[1]) / Number(m[2]);
    return `期待値は${fmt(Math.round(p * Number(trials[1]) * 100) / 100)}個です`;
  }
  return null;
}

// ---------------------------------------------------------------- 入口
export function tryTool(text, ctx) {
  if (!text) return null;
  const t = norm(text);
  try {
    return (
      tryProbability(t) ||
      tryStack(t) ||
      tryGearCost(t) ||
      tryDistance(t, ctx || {}) ||
      tryTime(t, ctx || {}) ||
      tryArithmetic(t) ||
      null
    );
  } catch {
    return null; // 計算層の失敗で会話全体を止めない
  }
}
