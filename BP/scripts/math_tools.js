// math_tools.js — リゼ (LIZE-07) の数学ツール層
// 純粋JS、eval 禁止。チャットで頼める数学の計算（割合・分数・累乗根・一次方程式・
// 単位換算・図形の公式・平均合計・割引税込・速さ）を正確に解く。
// export: tryMath(text) → { text, category } | null
//   数学の計算依頼と判定できなければ null を返し、通常会話に譲る。
// 答えには途中式を1行添える。口調は LIZE_SETTING.md（私、短い敬語、クール基調）。
// 既存 chat_tools.js（四則演算・スタック換算等）とは別ファイルで、そちらは触らない。

// ---------------------------------------------------------------- 共通
function norm(s) {
  return String(s ?? "")
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/．/g, ".").replace(/，/g, ",").replace(/、/g, ",")
    .replace(/＋/g, "+").replace(/－/g, "-").replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/")
    .replace(/（/g, "(").replace(/）/g, ")")
    .replace(/％/g, "%").replace(/＾/g, "^")
    .replace(/Ｘ/g, "x").replace(/ｘ/g, "x")
    .replace(/\s+/g, "")
    .toLowerCase();
}
function fmt(n) {
  if (!Number.isFinite(n)) return null;
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10000) / 10000);
}
const NUM = "-?\\d+(?:\\.\\d+)?";
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const r = a % b; a = b; b = r; }
  return a || 1;
}

// ---------------------------------------------------------------- (1) 一次方程式 ax+b=c
function tryEquation(t) {
  if (!t.includes("x") || !t.includes("=")) return null;
  const s = t
    .replace(/を解いて$/, "").replace(/を解く$/, "")
    .replace(/の?x(は|って)?(いくつ|なに|何)?$/, "")
    .replace(/は(いくつ|なに|何)?$/, "");
  let a, b = 0, c;
  let m = s.match(new RegExp(`^([+-]?\\d+(?:\\.\\d+)?)x([+-]\\d+(?:\\.\\d+)?)?=([+-]?\\d+(?:\\.\\d+)?)$`));
  if (m) { a = +m[1]; if (m[2]) b = +m[2]; c = +m[3]; }
  else {
    m = s.match(new RegExp(`^x([+-]\\d+(?:\\.\\d+)?)?=([+-]?\\d+(?:\\.\\d+)?)$`));
    if (!m) return null;
    a = 1; if (m[1]) b = +m[1]; c = +m[2];
  }
  if (a === 0) return null;
  const rhs = c - b, x = rhs / a;
  if (!Number.isFinite(x) || fmt(x) === null) return null;
  let work;
  if (a === 1) work = b !== 0 ? `移項すると x=${fmt(rhs)} になります` : `そのまま x=${fmt(x)} です`;
  else if (b !== 0) work = `移項すると ${fmt(a)}x=${fmt(rhs)}、${fmt(a)}で割って x=${fmt(x)} です`;
  else work = `${fmt(a)}x=${fmt(c)} を ${fmt(a)} で割って x=${fmt(x)} です`;
  return { text: `x=${fmt(x)}です。${work}。`, category: "equation" };
}

// ---------------------------------------------------------------- (2) 温度換算 ℃⇔℉
function tryTemperature(t) {
  if (!/華氏|℉|摂氏|℃/.test(t)) return null;
  let m = t.match(new RegExp(`(${NUM})(℃|℉|摂氏|華氏)`));
  let src = null, v = null;
  if (m) { v = +m[1]; src = (m[2] === "℃" || m[2] === "摂氏") ? "C" : "F"; }
  else {
    m = t.match(new RegExp(`(${NUM})度`));
    if (m && /華氏|℉/.test(t)) { v = +m[1]; src = "C"; }
  }
  if (src === null || v === null) return null;
  const wantsF = /華氏|℉/.test(t), wantsC = /摂氏|℃/.test(t);
  if (src === "C" && wantsF) {
    const f = v * 9 / 5 + 32;
    return { text: `${fmt(f)}℉です。式は ${fmt(v)}×9/5+32=${fmt(f)} です。`, category: "unit" };
  }
  if (src === "F" && wantsC) {
    const c = (v - 32) * 5 / 9;
    return { text: `${fmt(c)}℃です。式は (${fmt(v)}-32)×5/9=${fmt(c)} です。`, category: "unit" };
  }
  return null;
}

// ---------------------------------------------------------------- (3) 割合（何%か）
function tryPercentInverse(t) {
  const m = t.match(new RegExp(`(${NUM})は(${NUM})の(?:何%|何パーセント|割合)`));
  if (!m) return null;
  const a = +m[1], b = +m[2];
  if (b === 0) return null;
  const p = a / b * 100;
  if (fmt(p) === null) return null;
  return { text: `${fmt(p)}%です。式は ${fmt(a)}÷${fmt(b)}×100=${fmt(p)} です。`, category: "percent" };
}

// ---------------------------------------------------------------- (4) 割引・税込・税抜
function money(v) { // 円は整数に丸め、丸めたら「約」を付ける
  const r = Math.round(v);
  return { s: fmt(r), approx: r !== v };
}
function tryDiscountTax(t) {
  const rate = (t.includes("8%") || t.includes("軽減")) ? 0.08 : 0.10;
  const rateNote = `税率${rate * 100}%として計算しました`;
  let m;
  // 消費税の額だけ
  m = t.match(new RegExp(`(${NUM})円の消費税`));
  if (m && !t.includes("税込")) {
    const v = +m[1], tax = v * rate;
    const mm = money(tax);
    return { text: `${mm.approx ? "約" : ""}${mm.s}円です。式は ${fmt(v)}×${rate}=${fmt(tax)} です。${rateNote}。`, category: "discount" };
  }
  // 税抜（税込価格から）
  if (t.includes("税抜") && t.includes("税込")) {
    m = t.match(new RegExp(`(${NUM})円`));
    if (m) {
      const v = +m[1], ans = v / (1 + rate);
      const mm = money(ans);
      return { text: `${mm.approx ? "約" : ""}${mm.s}円です。式は ${fmt(v)}÷${1 + rate}=${fmt(ans)} です。${rateNote}。`, category: "discount" };
    }
  }
  // 税込
  if (t.includes("税込") || t.includes("消費税")) {
    m = t.match(new RegExp(`(${NUM})円`));
    if (m) {
      const v = +m[1], ans = v * (1 + rate);
      const mm = money(ans);
      return { text: `${mm.approx ? "約" : ""}${mm.s}円です。式は ${fmt(v)}×${1 + rate}=${fmt(ans)} です。${rateNote}。`, category: "discount" };
    }
  }
  // %引き・%オフ
  m = t.match(new RegExp(`(${NUM})(円)?の(${NUM})%(?:引き|引|オフ)`));
  if (m) {
    const v = +m[1], p = +m[3], ans = v * (1 - p / 100);
    if (fmt(ans) === null) return null;
    const unit = m[2] ? "円" : "";
    return { text: `${fmt(ans)}${unit}です。式は ${fmt(v)}×${fmt(1 - p / 100)}=${fmt(ans)} です。`, category: "discount" };
  }
  // 割引（○割○分引）
  m = t.match(new RegExp(`(${NUM})(円)?の(${NUM})割(?:(${NUM})分)?(?:引き|引)`));
  if (m) {
    const v = +m[1], p = (+m[3]) * 10 + (m[4] ? +m[4] : 0), ans = v * (1 - p / 100);
    if (fmt(ans) === null) return null;
    const unit = m[2] ? "円" : "";
    return { text: `${fmt(ans)}${unit}です。式は ${fmt(v)}×${fmt(1 - p / 100)}=${fmt(ans)} です。`, category: "discount" };
  }
  return null;
}

// ---------------------------------------------------------------- (5) 割合（○の○%・○%増し）
function tryPercent(t) {
  let m = t.match(new RegExp(`(${NUM})の(${NUM})%(?:増し|アップ)(?:は)?(?:いくつ|なに|何)?$`));
  if (m) {
    const b = +m[1], p = +m[2], ans = b * (1 + p / 100);
    if (fmt(ans) === null) return null;
    return { text: `${fmt(ans)}です。式は ${fmt(b)}×${fmt(1 + p / 100)}=${fmt(ans)} です。`, category: "percent" };
  }
  m = t.match(new RegExp(`(${NUM})の(${NUM})(?:%|パーセント)(?:は|って)?(?:いくつ|なに|何)?$`));
  if (m) {
    const b = +m[1], p = +m[2], ans = b * p / 100;
    if (fmt(ans) === null) return null;
    return { text: `${fmt(ans)}です。式は ${fmt(b)}×${fmt(p / 100)}=${fmt(ans)} です。`, category: "percent" };
  }
  return null;
}

// ---------------------------------------------------------------- (6) 分数
function reduceFrac(n, d) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
function fracStr(f) { return f.d === 1 ? String(f.n) : `${f.n}/${f.d}`; }
function tryFraction(t) {
  let m;
  // 約分
  m = t.match(/(-?\d+)\/(\d+)を?約分/);
  if (m) {
    const n = +m[1], d = +m[2];
    if (d === 0) return null;
    const g = gcd(n, d);
    if (g === 1) return { text: `${n}/${d}のままです。これ以上約分できません。`, category: "fraction" };
    const f = reduceFrac(n, d);
    return { text: `${fracStr(f)}です。最大公約数${g}で割って ${n}/${d}=${fracStr(f)} です。`, category: "fraction" };
  }
  // 分数→小数
  m = t.match(/(-?\d+)\/(\d+)を?小数/);
  if (m) {
    const n = +m[1], d = +m[2];
    if (d === 0) return null;
    const v = n / d;
    return { text: `${fmt(v)}です。式は ${n}÷${d}=${fmt(v)} です。`, category: "fraction" };
  }
  // 小数→分数
  m = t.match(/(-?\d+\.\d+)を?分数/);
  if (m) {
    const v = +m[1];
    const dec = (m[1].split(".")[1] || "").length;
    const den = Math.pow(10, dec), num = Math.round(v * den);
    const f = reduceFrac(num, den);
    return { text: `${fracStr(f)}です。${m[1]}=${num}/${den} を約分しました。`, category: "fraction" };
  }
  // 分数どうしの四則
  m = t.match(/^(-?\d+)\/(\d+)([+\-*\/])(-?\d+)\/(\d+)(?:は|って)?(?:いくつ|なに|何)?$/);
  if (m) {
    const n1 = +m[1], d1 = +m[2], op = m[3], n2 = +m[4], d2 = +m[5];
    if (d1 === 0 || d2 === 0) return null;
    let rn, rd;
    const opSym = { "+": "+", "-": "-", "*": "×", "/": "÷" }[op];
    if (op === "+") { rn = n1 * d2 + n2 * d1; rd = d1 * d2; }
    else if (op === "-") { rn = n1 * d2 - n2 * d1; rd = d1 * d2; }
    else if (op === "*") { rn = n1 * n2; rd = d1 * d2; }
    else { if (n2 === 0) return null; rn = n1 * d2; rd = d1 * n2; }
    const f = reduceFrac(rn, rd);
    const raw = (rd < 0 ? `${-rn}/${-rd}` : `${rn}/${rd}`);
    const reduced = fracStr(f);
    const step = raw !== reduced ? `${raw}=${reduced}` : raw;
    const decNote = f.d !== 1 ? `（小数では約${fmt(f.n / f.d)}）` : "";
    return { text: `${reduced}です。式は ${n1}/${d1}${opSym}${n2}/${d2}=${step} です${decNote}。`, category: "fraction" };
  }
  return null;
}

// ---------------------------------------------------------------- (7) 累乗・平方根・立方根
function tryPower(t) {
  let m = t.match(new RegExp(`(${NUM})の(${NUM})乗`)) || t.match(new RegExp(`(${NUM})\\^(${NUM})`));
  if (m) {
    const a = +m[1], b = +m[2];
    if (Number.isInteger(a) && Number.isInteger(b) && b >= 0 && b <= 1000 && Math.abs(a) <= 1000) {
      const v = (BigInt(a) ** BigInt(b)).toString();
      return { text: `${v}です。式は ${fmt(a)}^${fmt(b)} = ${v} です。`, category: "power" };
    }
    const v = Math.pow(a, b);
    if (fmt(v) === null) return null;
    return { text: `${fmt(v)}です。式は ${fmt(a)}^${fmt(b)} = ${fmt(v)} です。`, category: "power" };
  }
  m = t.match(new RegExp(`(${NUM})の平方根`));
  if (m) {
    const a = +m[1];
    if (a < 0) return null;
    const v = Math.sqrt(a);
    return { text: `±${fmt(v)}です。${fmt(a)}の平方根は ${fmt(v)} と ${fmt(-v)} です。`, category: "power" };
  }
  m = t.match(new RegExp(`√(${NUM})`)) || t.match(new RegExp(`ルート(${NUM})`));
  if (m) {
    const a = +m[1];
    if (a < 0) return null;
    const v = Math.sqrt(a);
    return { text: `${fmt(v)}です。式は √${fmt(a)}=${fmt(v)} です。`, category: "power" };
  }
  m = t.match(new RegExp(`(${NUM})の立方根`));
  if (m) {
    const a = +m[1], v = Math.cbrt(a);
    return { text: `${fmt(v)}です。${fmt(a)}の立方根は ${fmt(v)}、${fmt(v)}×${fmt(v)}×${fmt(v)} が ${fmt(a)} になります。`, category: "power" };
  }
  return null;
}

// ---------------------------------------------------------------- (8) 単位換算
const UNIT_DEFS = [
  { fam: "length", toBase: 0.001, label: "mm", aliases: ["mm", "ミリメートル", "ミリ"] },
  { fam: "length", toBase: 0.01, label: "cm", aliases: ["cm", "センチメートル", "センチ"] },
  { fam: "length", toBase: 1, label: "m", aliases: ["m", "メートル"] },
  { fam: "length", toBase: 1000, label: "km", aliases: ["km", "キロメートル", "キロ"] },
  { fam: "length", toBase: 0.0254, label: "インチ", aliases: ["インチ", "inch"] },
  { fam: "length", toBase: 0.3048, label: "フィート", aliases: ["フィート", "feet", "ft"] },
  { fam: "length", toBase: 0.9144, label: "ヤード", aliases: ["ヤード", "yd"] },
  { fam: "length", toBase: 1609.344, label: "マイル", aliases: ["マイル", "mile"] },
  { fam: "weight", toBase: 0.001, label: "mg", aliases: ["mg", "ミリグラム"] },
  { fam: "weight", toBase: 1, label: "g", aliases: ["g", "グラム"] },
  { fam: "weight", toBase: 1000, label: "kg", aliases: ["kg", "キログラム", "キロ"] },
  { fam: "weight", toBase: 1e6, label: "t", aliases: ["t", "トン"] },
  { fam: "weight", toBase: 453.59237, label: "ポンド", aliases: ["ポンド", "lb"] },
  { fam: "weight", toBase: 28.3495231, label: "オンス", aliases: ["オンス", "oz"] },
  { fam: "volume", toBase: 0.001, label: "mL", aliases: ["ml", "ミリリットル", "cc"] },
  { fam: "volume", toBase: 1, label: "L", aliases: ["l", "リットル"] },
  { fam: "volume", toBase: 1000, label: "kL", aliases: ["kl", "キロリットル"] },
  { fam: "volume", toBase: 1000, label: "m³", aliases: ["m3", "立方メートル"] },
  { fam: "time", toBase: 1, label: "秒", aliases: ["秒"] },
  { fam: "time", toBase: 60, label: "分", aliases: ["分"] },
  { fam: "time", toBase: 3600, label: "時間", aliases: ["時間"] },
  { fam: "time", toBase: 86400, label: "日", aliases: ["日"] },
  { fam: "time", toBase: 604800, label: "週間", aliases: ["週間", "週"] },
  { fam: "time", toBase: 31536000, label: "年", aliases: ["年"] },
];
const ALIAS_TO_DEFS = new Map();
for (const d of UNIT_DEFS) for (const a of d.aliases) {
  if (!ALIAS_TO_DEFS.has(a)) ALIAS_TO_DEFS.set(a, []);
  ALIAS_TO_DEFS.get(a).push(d);
}
const UNIT_ALT = [...ALIAS_TO_DEFS.keys()].sort((x, y) => y.length - x.length)
  .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
function tryUnit(t) {
  const pats = [
    new RegExp(`(${NUM})(${UNIT_ALT})は何(${UNIT_ALT})`),
    new RegExp(`(${NUM})(${UNIT_ALT})を(${UNIT_ALT})に`),
    new RegExp(`(${NUM})(${UNIT_ALT})は(${UNIT_ALT})で(?:いくつ|なに|何)?`),
  ];
  for (const p of pats) {
    const m = t.match(p);
    if (!m) continue;
    const v = +m[1];
    const defs1 = ALIAS_TO_DEFS.get(m[2]) || [], defs2 = ALIAS_TO_DEFS.get(m[3]) || [];
    for (const d1 of defs1) for (const d2 of defs2) {
      if (d1.fam !== d2.fam) continue;
      const ratio = d1.toBase / d2.toBase, ans = v * ratio;
      if (fmt(ans) === null) return null;
      const yearNote = (d1.label === "年" || d2.label === "年") ? "（1年=365日として計算しました）" : "";
      return { text: `${fmt(ans)}${d2.label}です。式は ${fmt(v)}×${fmt(ratio)}=${fmt(ans)} です${yearNote}。`, category: "unit" };
    }
    return null;
  }
  return null;
}

// ---------------------------------------------------------------- (9) 図形の公式計算
function numAfter(t, kw) {
  const m = t.match(new RegExp(`${kw}(${NUM})`));
  return m ? +m[1] : null;
}
function geo(ans, work) {
  if (fmt(ans) === null) return null;
  return { text: `${fmt(ans)}です。式は ${work} です。`, category: "geometry" };
}
function tryGeometry(t) {
  const PI = Math.PI;
  // 球
  if (t.includes("球")) {
    const r = numAfter(t, "半径");
    if (r !== null) {
      if (t.includes("表面積")) return geo(4 * PI * r * r, `4×π×${fmt(r)}×${fmt(r)}=${fmt(4 * PI * r * r)}`);
      return geo(4 / 3 * PI * r * r * r, `4/3×π×${fmt(r)}×${fmt(r)}×${fmt(r)}=${fmt(4 / 3 * PI * r * r * r)}`);
    }
  }
  // 円柱
  if (t.includes("円柱")) {
    const r = numAfter(t, "半径"), h = numAfter(t, "高さ");
    if (r !== null && h !== null) return geo(PI * r * r * h, `π×${fmt(r)}×${fmt(r)}×${fmt(h)}=${fmt(PI * r * r * h)}`);
  }
  // 立方体
  if (t.includes("立方体")) {
    const a = numAfter(t, "一辺");
    if (a !== null) {
      if (t.includes("表面積")) return geo(6 * a * a, `6×${fmt(a)}×${fmt(a)}=${fmt(6 * a * a)}`);
      return geo(a * a * a, `${fmt(a)}×${fmt(a)}×${fmt(a)}=${fmt(a * a * a)}`);
    }
  }
  // 直方体
  if (t.includes("直方体")) {
    const a = numAfter(t, "縦"), b = numAfter(t, "横"), h = numAfter(t, "高さ");
    if (a !== null && b !== null && h !== null) {
      if (t.includes("表面積")) return geo(2 * (a * b + b * h + h * a), `2×(${fmt(a)}×${fmt(b)}+${fmt(b)}×${fmt(h)}+${fmt(h)}×${fmt(a)})=${fmt(2 * (a * b + b * h + h * a))}`);
      return geo(a * b * h, `${fmt(a)}×${fmt(b)}×${fmt(h)}=${fmt(a * b * h)}`);
    }
  }
  // 台形
  if (t.includes("台形")) {
    const a = numAfter(t, "上底"), b = numAfter(t, "下底"), h = numAfter(t, "高さ");
    if (a !== null && b !== null && h !== null) return geo((a + b) * h / 2, `(${fmt(a)}+${fmt(b)})×${fmt(h)}÷2=${fmt((a + b) * h / 2)}`);
  }
  // 円
  if (t.includes("円")) {
    let r = numAfter(t, "半径"), diaNote = "";
    if (r === null) {
      const d = numAfter(t, "直径");
      if (d !== null) { r = d / 2; diaNote = `直径${fmt(d)}÷2=${fmt(r)}が半径です。`; }
    }
    if (r !== null) {
      if (t.includes("円周") || t.includes("周りの長さ") || t.includes("周長"))
        return geo(2 * PI * r, `${diaNote}2×π×${fmt(r)}=${fmt(2 * PI * r)}`);
      return geo(PI * r * r, `${diaNote}π×${fmt(r)}×${fmt(r)}=${fmt(PI * r * r)}`);
    }
  }
  // 三角形
  if (t.includes("三角形")) {
    const a = numAfter(t, "底辺"), h = numAfter(t, "高さ");
    if (a !== null && h !== null) return geo(a * h / 2, `${fmt(a)}×${fmt(h)}÷2=${fmt(a * h / 2)}`);
  }
  // 長方形
  if (t.includes("長方形")) {
    const a = numAfter(t, "縦"), b = numAfter(t, "横");
    if (a !== null && b !== null) {
      if (t.includes("周り") || t.includes("周長")) return geo(2 * (a + b), `2×(${fmt(a)}+${fmt(b)})=${fmt(2 * (a + b))}`);
      return geo(a * b, `${fmt(a)}×${fmt(b)}=${fmt(a * b)}`);
    }
  }
  // 正方形
  if (t.includes("正方形")) {
    const a = numAfter(t, "一辺");
    if (a !== null) {
      if (t.includes("周り") || t.includes("周長")) return geo(4 * a, `4×${fmt(a)}=${fmt(4 * a)}`);
      return geo(a * a, `${fmt(a)}×${fmt(a)}=${fmt(a * a)}`);
    }
  }
  return null;
}

// ---------------------------------------------------------------- (10) 速さ・距離・時間
function trySpeed(t) {
  let m = t.match(new RegExp(`(${NUM})kmを(${NUM})時間で`));
  if (m && (t.includes("速さ") || t.includes("時速"))) {
    const d = +m[1], h = +m[2];
    if (h === 0) return null;
    const v = d / h;
    return { text: `時速${fmt(v)}kmです。式は ${fmt(d)}÷${fmt(h)}=${fmt(v)} です。`, category: "speed" };
  }
  m = t.match(new RegExp(`(${NUM})kmを(${NUM})分で`));
  if (m && (t.includes("速さ") || t.includes("時速"))) {
    const d = +m[1], min = +m[2];
    if (min === 0) return null;
    const v = d / (min / 60);
    return { text: `時速${fmt(v)}kmです。式は ${fmt(d)}÷(${fmt(min)}÷60)=${fmt(v)} です。`, category: "speed" };
  }
  m = t.match(new RegExp(`時速(${NUM})kmで(${NUM})時間`));
  if (m && (t.includes("距離") || t.includes("何km") || t.includes("進"))) {
    const v = +m[1], h = +m[2], d = v * h;
    return { text: `${fmt(d)}kmです。式は ${fmt(v)}×${fmt(h)}=${fmt(d)} です。`, category: "speed" };
  }
  m = t.match(new RegExp(`(${NUM})kmを時速(${NUM})kmで`));
  if (m && t.includes("時間")) {
    const d = +m[1], v = +m[2];
    if (v === 0) return null;
    const h = d / v;
    return { text: `${fmt(h)}時間です。式は ${fmt(d)}÷${fmt(v)}=${fmt(h)} です。`, category: "speed" };
  }
  m = t.match(new RegExp(`(${NUM})mを(${NUM})秒で`));
  if (m && t.includes("速さ")) {
    const d = +m[1], s = +m[2];
    if (s === 0) return null;
    const v = d / s;
    return { text: `秒速${fmt(v)}mです。式は ${fmt(d)}÷${fmt(s)}=${fmt(v)} です。`, category: "speed" };
  }
  m = t.match(new RegExp(`秒速(${NUM})mで(${NUM})秒`));
  if (m && (t.includes("距離") || t.includes("何m") || t.includes("進"))) {
    const v = +m[1], s = +m[2], d = v * s;
    return { text: `${fmt(d)}mです。式は ${fmt(v)}×${fmt(s)}=${fmt(d)} です。`, category: "speed" };
  }
  return null;
}

// ---------------------------------------------------------------- (11) 平均・合計
function extractNumbers(t) {
  const out = [];
  const reG = new RegExp(`(${NUM})`, "g");
  let mm;
  while ((mm = reG.exec(t))) {
    const after = t[mm.index + mm[0].length];
    if (after && "つ個人本枚回".includes(after)) continue; // 「3つの数」の3等は除外
    out.push(+mm[1]);
  }
  return out;
}
function tryAverageSum(t) {
  if (t.includes("平均")) {
    const ns = extractNumbers(t);
    if (ns.length >= 2) {
      const sum = ns.reduce((x, y) => x + y, 0), avg = sum / ns.length;
      if (fmt(avg) === null) return null;
      return { text: `${fmt(avg)}です。式は (${ns.map(fmt).join("+")})÷${ns.length}=${fmt(avg)} です。`, category: "average" };
    }
  }
  if (t.includes("合計") || t.includes("総和") || t.includes("全部足す") || t.includes("足すと")) {
    const ns = extractNumbers(t);
    if (ns.length >= 2) {
      const sum = ns.reduce((x, y) => x + y, 0);
      if (fmt(sum) === null) return null;
      return { text: `${fmt(sum)}です。式は ${ns.map(fmt).join("+")}=${fmt(sum)} です。`, category: "average" };
    }
  }
  return null;
}

// ---------------------------------------------------------------- 入口
export function tryMath(text) {
  try {
    let t = norm(text);
    if (!t) return null;
    t = t.replace(/[？?。]+$/, "")
      .replace(/(教えて|ください|計算して|求めて|知りたい|お願いします|お願い)$/, "")
      .replace(/[？?。]+$/, "");
    if (!t) return null;
    return tryEquation(t)
      || tryTemperature(t)
      || tryPercentInverse(t)
      || tryDiscountTax(t)
      || tryPercent(t)
      || tryFraction(t)
      || tryPower(t)
      || tryUnit(t)
      || tryGeometry(t)
      || trySpeed(t)
      || tryAverageSum(t)
      || null;
  } catch {
    return null;
  }
}
