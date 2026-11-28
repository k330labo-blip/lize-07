// amount_math.js — 0-C5 (cycle1256): 数量解釈の純粋核。
// 設計: brain_parts/solutions/cycle1256-a02-0c5-design.md
// 品目別スタックサイズ / 複合数量の合算 / 訂正の後勝ち / 「あと」の残量 /
// 反復の保持 / 0個ガード を、開始処理から分離した純粋関数で提供する。
// @minecraft/server を import しない。例外を投げない。副作用なし・決定的。

const KANJI_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
export function parseNumberToken(s) {
  try {
    if (typeof s !== "string" || !s) return null;
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    // O5-KURE-GIVE-01 (cyc2517): 位取り単位「億」「万」。係数は parseNumberToken 自身で
    // 再帰して読む (一億=1×10^8、二億=2×10^8、十万=10×10^4、二十万=20×10^4)。
    // 単位だけ (「億」「万」単独) は係数1として読む (日本語の数詞として正)。
    for (const [unit, mag] of [["億", 100000000], ["万", 10000]]) {
      const ui = s.indexOf(unit);
      if (ui >= 0) {
        const head = s.slice(0, ui), tail = s.slice(ui + 1);
        const hv = head === "" ? 1 : parseNumberToken(head);
        const tv = tail === "" ? 0 : parseNumberToken(tail);
        if (hv == null || tv == null) return null;
        return hv * mag + tv;
      }
    }
    if (s === "十") return 10;
    if (s === "ゼロ" || s === "零") return 0;
    if (s.includes("十")) {
      const [a, b] = s.split("十");
      const tens = a === "" ? 1 : KANJI_NUM[a];
      const ones = b === "" ? 0 : KANJI_NUM[b];
      if (tens == null || ones == null) return null;
      return tens * 10 + ones;
    }
    return KANJI_NUM[s] ?? null;
  } catch { return null; }
}

// --- スタック表（この表が注文数量の単一の正。decomposer 側の移行は次段） ---
// バケツ系は HANDOFF 0-C5 の基準（1スタック=1）に従い独立定数へ分離する。
// 空バケツ単体の実機仕様で問題が出たら、この定数の対象だけを戻せる。
export const STACK_1_BUCKET = Object.freeze([/bucket$/]);
const STACK_1_PATTERNS = Object.freeze([
  /_pickaxe$/, /_axe$/, /_sword$/, /_shovel$/, /_hoe$/,
  /_helmet$/, /_chestplate$/, /_leggings$/, /_boots$/,
  /minecraft:bow$/, /minecraft:shield$/, /minecraft:fishing_rod$/,
  /minecraft:shears$/, /minecraft:flint_and_steel$/, /minecraft:crossbow$/,
  /minecraft:trident$/, /minecraft:elytra$/, /minecraft:saddle$/,
  /minecraft:potion$/, /minecraft:splash_potion$/, /minecraft:lingering_potion$/,
  /minecraft:cake$/, /_stew$/, /_soup$/,
  // --- cyc1810 R-6: スタック1の広い系統 (実測で64に落ちていたもの) ---
  /_boat$/, /_chest_boat$/, /_raft$/, /_chest_raft$/,
  /minecart$/,
  /_bed$/, /minecraft:bed$/,
  /^minecraft:music_disc_/,
  /_horse_armor$/,
  /(^|:)shulker_box$/, /_shulker_box$/,
  /_on_a_stick$/,
  /_bundle$/, /minecraft:bundle$/,
]);
const STACK_1_IDS = new Set([ // パターン化すると誤爆する個別品 (本系は ID 単位でしか分けられない)
  "minecraft:totem_of_undying", "minecraft:spyglass", "minecraft:brush",
  "minecraft:mace", "minecraft:goat_horn", "minecraft:wolf_armor",
  "minecraft:enchanted_book", "minecraft:knowledge_book", "minecraft:writable_book",
]);
const STACK_16_IDS = new Set([
  "minecraft:ender_pearl", "minecraft:egg", "minecraft:snowball", "minecraft:honey_bottle", "minecraft:sign", // cyc1743 R-5前提: 素の看板も16
  "minecraft:armor_stand", // cyc1810 R-6: 防具立ては1ではなく16
  "minecraft:written_book", // cyc1810 R-6: 記入済みの本は16 (書ける本=1・通常の本=64)
]);
const STACK_16_PATTERNS = Object.freeze([/_sign$/, /_hanging_sign$/, /banner$/]);

export function stackSizeOfItem(itemId) {
  try {
    if (typeof itemId !== "string" || !itemId) return { size: 64, sizeSource: "fallback" };
    const id = itemId.includes(":") ? itemId : "minecraft:" + itemId;
    if (STACK_1_BUCKET.some((re) => re.test(id))) return { size: 1, sizeSource: "id" };
    if (STACK_1_PATTERNS.some((re) => re.test(id))) return { size: 1, sizeSource: "pattern" };
    if (STACK_1_IDS.has(id)) return { size: 1, sizeSource: "id" };
    if (STACK_16_IDS.has(id)) return { size: 16, sizeSource: "id" };
    if (STACK_16_PATTERNS.some((re) => re.test(id))) return { size: 16, sizeSource: "pattern" };
    return { size: 64, sizeSource: "id" };
  } catch { return { size: 64, sizeSource: "fallback" }; }
}
export function stackSize(itemId) { return stackSizeOfItem(itemId).size; }
export function halfStack(size) { return size === 1 ? 1 : Math.floor(size / 2); }

const NUM = "(\\d+(?:\\.\\d+)?|[一二三四五六七八九十]+|ゼロ|零)";
const UNIT = "(個|本|枚|つ|体|匹|組|セット|箱)";
const CORRECTION_RE = /(やっぱり|いや|じゃなくて|ではなく|じゃなしに|まちがえた|訂正)/; // cyc1743 R-2: やっぱり追加

// 数量項1つを読む: { value, consumed(number of chars), isStack } | null
function readTerm(s, size) {
  let m = s.match(new RegExp(`^(半|はん)スタック`));
  if (m) return { value: halfStack(size), len: m[0].length, half: true };
  m = s.match(new RegExp(`^${NUM}\\s*(億|万)?\\s*スタック`));
  if (m) {
    const raw = m[1];
    if (/^\d+\.\d+$/.test(raw)) {
      const whole = Math.floor(parseFloat(raw));
      const frac = parseFloat(raw) - whole;
      const v = whole * size + (frac >= 0.5 ? halfStack(size) : 0);
      return { value: v, len: m[0].length };
    }
    const n0 = parseNumberToken(raw);
    if (n0 == null) return null;
    const n = n0 * (m[2] === "億" ? 100000000 : m[2] === "万" ? 10000 : 1);
    return { value: n * size, len: m[0].length };
  }
  m = s.match(new RegExp(`^${NUM}\\s*(億|万)?\\s*${UNIT}`));
  if (m) {
    const n0 = parseNumberToken(m[1]);
    if (n0 == null) return null;
    const n = n0 * (m[2] === "億" ? 100000000 : m[2] === "万" ? 10000 : 1);
    return { value: n, len: m[0].length };
  }
  return null;
}

function emptyResult(sizeInfo) {
  return {
    ok: false, reason: "none", startable: false, total: null, amount: null,
    perRun: null, repeats: null, relative: false, corrected: false,
    stackSize: sizeInfo.size, sizeSource: sizeInfo.sizeSource, consumed: "", note: null,
  };
}

// segment 内の数量表現を読む。対象メンション周辺の節を渡すのが原則。
export function amount_parse(segment, ctx = {}) {
  const sizeInfo = stackSizeOfItem(ctx?.itemId ?? null);
  const size = sizeInfo.size;
  try {
    if (typeof segment !== "string" || !segment) return emptyResult(sizeInfo);
    let s = segment.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

    // 訂正の後勝ち: 最後の訂正マーカー以降だけを読む
    let corrected = false;
    let lastCorr = -1, lastCorrLen = 0;
    for (const m of s.matchAll(new RegExp(CORRECTION_RE.source, "g"))) { lastCorr = m.index; lastCorrLen = m[0].length; }
    if (lastCorr >= 0) {
      const after = s.slice(lastCorr + lastCorrLen);
      // 訂正後に数量がある場合だけ後勝ちにする（無ければ前値を保持）
      if (/(半|はん)スタック|\d|一|二|三|四|五|六|七|八|九|十|ゼロ|零/.test(after)) {
        corrected = true;
        s = after;
      }
    }

    // 「あと」残量: 数量の直前にある「あと」だけを相対指定として消費する
    let relative = false;
    // 反復: <数量>ずつ<M>回
    let repeats = null;

    // 数量の開始位置を探す（メンション等の前置語は読み飛ばす）
    // cyc-next R-4: 「あと、3個」「あともう3個」でも相対指定が落ちないよう、
    // 読点と「もう」を「あと」の後ろに許す。
    const startRe = new RegExp(`(あと\\s*[、,]?\\s*(?:もう\\s*)?)?((半|はん)スタック|${NUM}\\s*(?:億|万)?\\s*(スタック|${UNIT}))`);
    const sm = s.match(startRe);
    if (!sm) return { ...emptyResult(sizeInfo), corrected };
    if (sm[1]) relative = true;
    let rest = s.slice(sm.index + sm[0].length - (sm[2]?.length ?? 0));
    // rest は数量表現の先頭から
    rest = s.slice(sm.index + (sm[1] ? sm[1].length : 0));

    // 項の合算（「と」で接続された項だけを足す）
    let total = 0, terms = 0, consumedLen = (sm[1] ? sm[1].length : 0);
    let halfOfOne = false;
    let cur = rest;
    for (;;) {
      const t = readTerm(cur, size);
      if (!t) break;
      if (t.half && size === 1) halfOfOne = true;
      total += t.value; terms++;
      consumedLen += t.len;
      cur = cur.slice(t.len);
      const conn = cur.match(/^と\s*/);
      if (!conn) break;
      const next = readTerm(cur.slice(conn[0].length), size);
      if (!next) break;
      consumedLen += conn[0].length;
      cur = cur.slice(conn[0].length);
    }
    if (terms === 0) return { ...emptyResult(sizeInfo), corrected };

    // 反復（ずつ M 回）は数量の直後で読む
    const rep = cur.match(new RegExp(`^ずつ\\s*${NUM}\\s*回`));
    let perRun = total;
    // cyc-next R-4: 反復前置（「2回、3個ずつ」「2回分3個ずつ」「2回繰り返して3個ずつ」）と
    // 「3個を2回」形。従来は数量直後の「ずつM回」しか読めず、前置の回数は黙って落ち、
    // 「0回、3個ずつ」は 0回ガードを素通りして開始可能になっていた。
    // 前置は数量の開始位置より前に現れる最後の「NUM回」を採用する。ただし反復として
    // 読むのは、数量項が「ずつ」を伴う（1回量の明示）か、前置自体が「分／繰り返し」を
    // 伴う場合に限る（単なる回数メンションの誤読を避ける）。
    if (!rep) {
      const woRep = cur.match(new RegExp(`^を\\s*${NUM}\\s*回`));
      if (woRep) {
        const m2 = parseNumberToken(woRep[1]);
        if (m2 != null && m2 >= 0) { repeats = m2; total = perRun * repeats; consumedLen += woRep[0].length; }
      } else if (/^ずつ/.test(cur)) {
        const prefix = s.slice(0, sm.index + (sm[1] ? sm[1].length : 0));
        let preM = null;
        for (const mm of prefix.matchAll(new RegExp(`${NUM}\\s*回\\s*(分|繰り返して|繰り返し|、|,)?`, "g"))) preM = mm;
        if (preM) {
          const m2 = parseNumberToken(preM[1]);
          if (m2 != null && m2 >= 0) { repeats = m2; total = perRun * repeats; }
        }
      } else {
        // 「ずつ」が無くても「2回分、3個」「2回繰り返して3個」は前置反復として読む
        const prefix = s.slice(0, sm.index + (sm[1] ? sm[1].length : 0));
        let preM = null;
        for (const mm of prefix.matchAll(new RegExp(`${NUM}\\s*回\\s*(分|繰り返して|繰り返し)`, "g"))) preM = mm;
        if (preM) {
          const m2 = parseNumberToken(preM[1]);
          if (m2 != null && m2 >= 0) { repeats = m2; total = perRun * repeats; }
        }
      }
    }
    if (rep) {
      const m2 = parseNumberToken(rep[1]);
      // 0-C5 U4 (v0.5.80): 反復0回は「反復なし」ではなく総量0として返す。
      // 従来は m2>0 の場合だけ repeats を立てたため、3個ずつ0回 が perRun の
      // まま開始可能な注文に化けていた。0 は既存の 0個ガード (zero) へ合流させる。
      if (m2 != null && m2 >= 0) { repeats = m2; total = perRun * repeats; consumedLen += rep[0].length; }
    } else if (/^ずつ/.test(cur)) {
      // ずつ のみ: repeats は未指定 (null) のまま保持する
    }

    // cyc1810 (a11ファズ実測): 巨大桁数で total が Infinity になり startable:true で
    // 素通りしていた。非有限の総量は開始可能な注文にしない (too_large)。
    if (!Number.isFinite(total)) {
      return { ...emptyResult(sizeInfo), reason: "too_large", corrected, repeats: Number.isFinite(repeats) ? repeats : null, perRun: null }; // cyc1924 F-1: too_large 時に repeats=Infinity が残らないよう有限化
    }
    const isZero = total === 0;
    return {
      ok: true,
      reason: isZero ? "zero" : "ok",
      startable: !isZero,
      total, amount: total, perRun, repeats, relative, corrected,
      stackSize: size, sizeSource: sizeInfo.sizeSource,
      consumed: s.slice(0, consumedLen),
      note: halfOfOne ? "half_of_one" : null,
    };
  } catch { return emptyResult(sizeInfo); }
}
export default amount_parse;
