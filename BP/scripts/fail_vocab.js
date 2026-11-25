// fail_vocab.js — failAgg 純粋核 (Phase 4 S1+S2, cycle2303 v0.4.64 で正式化)
// 設計の正: cycle1430-a14-failagg/DRAFT.md (§4 形 / §4.2 キー合成 / §4.3 where丸め /
//   §4.4 分類列 / §6 streak) + cycle2153-a19 (F1: byReason へ cls 併記、
//   計画スコープ連続失敗カウンタは streak と別本立て、UNKNOWN は cls:null)
// 境界: 純粋関数のみ。Date.now() を内部で呼ばない (時刻は引数/レコードから受ける)。
//   入力レコードは変更しない。例外を投げない (不正入力は無視して集計を壊さない)。
//   接続は main.js の2関門 (noteFail / commitLastAction) の内側だけ (S2)。読み手は S3 以降。
//   集計は個体 DP へ永続化する (cb_failagg キー分割、S3b)。clearPlanRecords へ登録しない
//   (失敗学習はミッション境界をまたぐ)。

// --- 契約 REASONS は actions_contract.js が単一の正 (転記しない: cycle2303-a01/a02、集合差分0を実測) ---
import { REASONS } from "./actions_contract.js";
export const KNOWN_REASONS = Object.freeze(new Set(Object.values(REASONS)));

// 既知 Action 名 (これ以外で act が来たら USE_ITEM/<act> へ寄せる汎用規則, 1430 §4.2-1)
export const KNOWN_ACTIONS = Object.freeze(new Set([
  "BREAK","TAKE","STORE","WITHDRAW","PLACE","CRAFT","SMELT","MOVE","NAV","ATTACK","EQUIP",
]));

// M3: 失敗でない ok:false (実測確定分のみ。推測で増やさない)
export const NON_FAILURE_REASONS = Object.freeze(new Set(["EATING","POTION_KIND_UNKNOWN"]));

// UNKNOWN 系: 分類・streak・計画カウンタのいずれにも倒さない (Phase1 三状態 / a19 §2.2)
export const UNKNOWN_REASONS = Object.freeze(new Set(["TARGET_UNKNOWN","CELL_UNKNOWN"]));

// Cortex 写像: 計画側分類 cls (a19 §2.2)。表に無い reason は null (最も近い分類へ寄せない)
export const CLS_BY_REASON = Object.freeze({
  NO_PATH:"NO_PATH", GRID_BUILDING:"NO_PATH",
  STUCK_OSCILLATING:"STUCK", STUCK_FROZEN:"STUCK", STUCK_FALLBACK:"STUCK",
  TARGET_GONE:"TARGET_LOST", TARGET_MISSING:"TARGET_LOST",
  PATH_BLOCKED:"BLOCKED", GOAL_BLOCKED:"BLOCKED", DEST_BLOCKED:"BLOCKED",
  FLIGHT_BLOCKED:"BLOCKED", CELL_OCCUPIED:"BLOCKED",
  GUARDED_STRUCTURE:"OBSTACLE_UNBREAKABLE", UNSUPPORTED_CELL:"OBSTACLE_UNBREAKABLE",
  DANGER_NEAR:"DANGER",
  COOLDOWN:"COOLDOWN", RELOADING:"COOLDOWN", ON_COOLDOWN:"COOLDOWN",
  NO_TOOL:"PRECONDITION", NO_MATERIAL:"PRECONDITION", NO_FUEL:"PRECONDITION",
  ITEM_NOT_FOUND:"PRECONDITION",
  NOT_A_CONTAINER:"MISSING_INFRASTRUCTURE",
  LOW_CEILING:"UNSUITABLE", SUBMERGED:"UNSUITABLE", WRONG_DIMENSION:"UNSUITABLE",
  // 意図的に付けない: TARGET_UNKNOWN / CELL_UNKNOWN (UNKNOWN), API_ERROR 等 (未分類)
});

// fail_vocab 差分表: where の code (小文字) -> REASONS (1430 §4.3 第2規則、残差のみ)
export const WHERE_DIFF = Object.freeze({
  verify:"VERIFY_FAILED", build_unreachable:"OUT_OF_RANGE", set_failed:"SET_FAILED",
  inventory_full:"INVENTORY_FULL", no_container:null, // 小裁定待ち: 寄せない (UNMAPPED)
});

// STORE kind 正規化 (1430 §4.2-4)。cycle2303-a03 裁定: 駆動源の異なる kind (deliver/doDeliver/
//   deliver_to_owner) を1キーへ寄せるのは不可逆 (集計は生 kind を保存しない) ため寄せない。
//   寄せは読み手側 (S3以降) で行う。現行は恒等写像。
export const STORE_KIND_NORM = Object.freeze({});

export const MAX_KEYS_DEFAULT = 64;
export const STREAK_THRESHOLD = 3;
export const STREAK_WINDOW_MS_DEFAULT = 600000; // 仮値 (1430 §6: 実測で詰める)

const s = (v) => (typeof v === "string" && v.length ? v : null);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** reason の分類列: "failure" | "non_failure" | "unknown" | "unclassified" */
export function classifyKind(reason) {
  if (!s(reason)) return "unclassified";
  if (NON_FAILURE_REASONS.has(reason)) return "non_failure";
  if (UNKNOWN_REASONS.has(reason)) return "unknown";
  if (!KNOWN_REASONS.has(reason)) return "unclassified";
  return "failure";
}
/** 計画側分類 cls。UNKNOWN・non_failure・未分類は null */
export function classifyFailure(reason) {
  if (classifyKind(reason) !== "failure") return null;
  return CLS_BY_REASON[reason] ?? null;
}

/** commit 引数 rec -> actKey (1430 §4.2)。rec は変更しない */
export function actKeyOf(rec) {
  if (!rec || typeof rec !== "object") return null;
  const act = s(rec.act); if (!act) return null;
  if (!KNOWN_ACTIONS.has(act)) return "USE_ITEM/" + act;
  if (act === "PLACE" && s(rec.mode)) return "PLACE/" + rec.mode;
  if (act === "STORE" && s(rec.kind)) return "STORE/" + (STORE_KIND_NORM[rec.kind] ?? rec.kind);
  if (act === "TAKE" && s(rec.via)) return "TAKE/" + rec.via;
  return act;
}

/** noteFail where -> {domain, code, key, raw, mapped} (1430 §4.3) */
export function normalizeWhere(where) {
  const raw = s(where);
  if (!raw) return null;
  const i = raw.indexOf(":");
  if (i < 0) return { domain: raw, code: "BARE", key: raw + ":BARE", raw, mapped: true };
  const domain = raw.slice(0, i), codeRaw = raw.slice(i + 1);
  if (domain === "dp" || domain === "dps")
    return { domain, code: "DP_ACCESS", key: domain + ":DP_ACCESS", raw, mapped: true };
  const up = codeRaw.toUpperCase();
  if (KNOWN_REASONS.has(up)) return { domain, code: up, key: domain + ":" + up, raw, mapped: true };
  const diff = WHERE_DIFF[codeRaw];
  if (diff) return { domain, code: diff, key: domain + ":" + diff, raw, mapped: true };
  return { domain, code: "UNMAPPED", key: domain + ":UNMAPPED", raw, mapped: false };
}

export function createFailAgg(opts = {}) {
  return {
    maxKeys: num(opts.maxKeys) ?? MAX_KEYS_DEFAULT,
    streakWindowMs: num(opts.streakWindowMs) ?? STREAK_WINDOW_MS_DEFAULT,
    actionTotal: 0, actionFail: 0, noteTotal: 0,
    byReason: Object.create(null), byWhere: Object.create(null),
    streak: null, advice: null, streaks: Object.create(null), advices: Object.create(null), // cycle1003: キー別 streak/advice (streak/advice は最新分のミラーとして維持)
    planStreak: { n: 0, lastSeq: null, lastAt: null }, // 計画スコープ連続失敗 (理由不問, a19 §5.1)
    overflowAt: null,
  };
}
function keyFor(agg, table, key, at) {
  if (table[key]) return key;
  if (Object.keys(table).length >= agg.maxKeys) { agg.overflowAt = at ?? agg.overflowAt; return "OVERFLOW"; }
  return key;
}

/** commit 軸へ1件記録。rec={act,ok,reason,item,at,mode?,kind?,via?,detail?}、seq=actionSeq */
export function recordAction(agg, rec, seq) {
  try {
    if (!agg || !rec || typeof rec !== "object") return agg;
    const actKey = actKeyOf(rec); if (!actKey) return agg;
    const at = num(rec.at) ?? 0, sq = num(seq);
    const ok = rec.ok === true;
    const reason = ok ? "OK" : (s(rec.reason) ?? "OK");
    const kind = ok ? "ok" : classifyKind(rec.reason);
    const key = keyFor(agg, agg.byReason, actKey + ":" + reason, at);
    const e = agg.byReason[key] ?? (agg.byReason[key] = {
      n: 0, ok: 0, fail: 0, cls: ok ? null : classifyFailure(rec.reason), kind,
      firstAt: at, lastAt: at, lastItem: null, lastSeq: sq, empty: 0, partial: 0,
    });
    e.n++; e.lastAt = at; e.lastSeq = sq; e.lastItem = s(rec.item) ?? e.lastItem;
    if (rec.detail?.empty === true) e.empty++;
    if (rec.detail?.partial === true) e.partial++;
    agg.actionTotal++;
    if (ok) {
      e.ok++;
      // 同一 actKey の成功: streak リセット + 同 actKey の advice 解除 + planStreak リセット
      // cycle1003: キー別マップ側も同 actKey 分だけ消す (他キーの streak/advice は保持する)
      for (const k of Object.keys(agg.streaks || {})) if (k.startsWith(actKey + ":")) delete agg.streaks[k];
      for (const k of Object.keys(agg.advices || {})) if (k.startsWith(actKey + ":")) delete agg.advices[k];
      if (agg.streak && agg.streak.actKey === actKey) agg.streak = null;
      if (agg.advice && agg.advice.actKey === actKey) agg.advice = Object.values(agg.advices || {})[0] || null;
      agg.planStreak = { n: 0, lastSeq: sq, lastAt: at };
      return agg;
    }
    if (kind !== "failure") return agg; // non_failure/unknown/unclassified は分子・streak 対象外
    e.fail++; agg.actionFail++;
    agg.planStreak = { n: agg.planStreak.n + 1, lastSeq: sq, lastAt: at };
    // cycle1003: streak はキー (actKey:reason) 別に累積する。別キーの失敗が割り込んでも進行中の n は消えない。
    // OVERFLOW キー (byReason の合算先) では streak を作らない (内容を代表しないため)。
    if (key !== "OVERFLOW") {
      if (!agg.streaks) agg.streaks = Object.create(null);
      if (!agg.advices) agg.advices = Object.create(null);
      const st = agg.streaks[key];
      const cont = st && st.actKey === actKey && st.reason === reason &&
        (sq == null || st.lastSeq == null || sq > st.lastSeq) &&
        (at - st.lastAt <= agg.streakWindowMs);
      const cur = { actKey, reason, n: cont ? st.n + 1 : 1, sinceAt: cont ? st.sinceAt : at, lastAt: at, lastSeq: sq };
      agg.streaks[key] = cur; agg.streak = cur; // ミラーは最新キー分
      if (cur.n === STREAK_THRESHOLD && !agg.advices[key]) {
        agg.advices[key] = { actKey, reason, n: STREAK_THRESHOLD, kind: "repeat_failure", at, seq: sq };
        agg.advice = agg.advices[key];
      }
    }
    return agg;
  } catch { return agg; }
}

/** noteFail 軸へ1件記録。2軸の総数は混ぜない (M1) */
export function recordNote(agg, where, msg, at) {
  try {
    if (!agg) return agg;
    // S3b 再帰防止 (M-2): 自分の永続化 (cb_failagg) の DP 失敗は集計へ入れない。
    // normalizeWhere が dp/dps を丸めてキーを捨てるため、必ず入口・正規化前に判定する。
    if (isFailAggInternalWhere(where)) return agg;
    const w = normalizeWhere(where); if (!w) return agg;
    const t = num(at) ?? 0;
    const key = keyFor(agg, agg.byWhere, w.key, t);
    const e = agg.byWhere[key] ?? (agg.byWhere[key] = { n: 0, firstAt: t, lastAt: t, lastMsg: null, lastRaw: null });
    e.n++; e.lastAt = t;
    e.lastMsg = s(msg) ? msg.slice(0, 120) : e.lastMsg;
    if (!w.mapped) e.lastRaw = w.raw;
    agg.noteTotal++;
    return agg;
  } catch { return agg; }
}

/** 読み手 (純粋): 失敗数上位。率の分母は actionTotal */
export function failRate(agg, actKey) {
  if (!agg || !agg.actionTotal) return null;
  let f = 0, t = 0;
  for (const [k, e] of Object.entries(agg.byReason)) {
    if (actKey && !k.startsWith(actKey + ":")) continue;
    t += e.n; f += e.fail;
  }
  return t ? { trials: t, fails: f, rate: f / t } : null;
}

/** S0 (cycle1543, Phase4 failAgg D1/D2 是正の純粋核・未配線。読み手は S1 以降):
 *  経験的成功集計。D1: failRate は actKey + ":" で絞るため "/" 合成キー
 *  (PLACE/build, STORE/deliver, TAKE/<via>) を拾えない。本関数はセグメント一致
 *  (actKey + ":" と actKey + "/" の両接頭辞) で拾い、部分一致で別系統を拾わない。
 *  D2: 分母は分類済みの ok + failure のみ (non_failure/unknown/unclassified は
 *  分子・分母のどちらにも入れない)。OVERFLOW は内容を代表しないため対象外。
 *  不正入力では例外を投げず {n:0, ok:0, fails:0}。入力は変更しない。 */
export function empiricalSuccess(agg, actKey) {
  try {
    if (!agg || typeof agg !== "object" || !agg.byReason || typeof agg.byReason !== "object") return { n: 0, ok: 0, fails: 0 };
    const ak = s(actKey); if (!ak) return { n: 0, ok: 0, fails: 0 };
    let ok = 0, fails = 0;
    for (const [k, e] of Object.entries(agg.byReason)) {
      if (k === "OVERFLOW" || !e || typeof e !== "object") continue;
      if (!(k.startsWith(ak + ":") || k.startsWith(ak + "/"))) continue;
      const reason = k.slice(k.lastIndexOf(":") + 1);
      if (reason === "OK") ok += num(e.ok) ?? 0;
      else if (e.kind === "failure") fails += num(e.fail) ?? 0;
    }
    return { n: ok + fails, ok, fails };
  } catch { return { n: 0, ok: 0, fails: 0 }; }
}
/** S0: 事前成功率 prior と経験 emp のブレンド (純粋式のみ。クランプは消費側の既存が正)。
 *  emp が無い・n=0・W が不正なら prior と完全一致で返す。例外を投げない。 */
export function blendSuccessP(prior, emp, W) {
  try {
    const p = num(prior); if (p == null) return prior;
    if (!emp || typeof emp !== "object") return prior;
    const n = num(emp.n) ?? 0, ok = num(emp.ok) ?? 0;
    if (!(n > 0)) return prior;
    const w = num(W); if (w == null || w < 0) return prior;
    return (p * w + ok) / (w + n);
  } catch { return prior; }
}
export function topReasons(agg, n = 5) {
  if (!agg) return [];
  return Object.entries(agg.byReason).filter(([, e]) => e.fail > 0)
    .sort((a, b) => b[1].fail - a[1].fail).slice(0, n)
    .map(([key, e]) => ({ key, fail: e.fail, n: e.n, cls: e.cls }));
}
/** S3a 表示読み手 (純粋): 行動軸の失敗傾向を最大1行へ整形する。byWhere は走査しない (M1)。
 *  同点選出は全件を fail降順→key昇順で整列してから先頭2件 (topReasons(2) の先行 slice では
 *  同点境界が挿入順依存になるため整形側で全件整列する, cycle0026-a01/a05)。
 *  OVERFLOW は合算エントリで cls が内容を代表しないため分類を付けない。入力は変更しない。 */
export function formatFailSummaryLines(agg) {
  try {
    if (!agg || typeof agg !== "object") return [];
    const af = num(agg.actionFail); if (af == null || af <= 0) return [];
    const at = num(agg.actionTotal);
    if (!agg.byReason || typeof agg.byReason !== "object") return [];
    const rows = [];
    for (const [key, e] of Object.entries(agg.byReason)) {
      if (!e || typeof e !== "object") continue;
      if (typeof e.fail !== "number" || !Number.isFinite(e.fail) || e.fail <= 0) continue;
      rows.push({ key, fail: Math.floor(e.fail), cls: s(e.cls) });
    }
    if (!rows.length) return [];
    rows.sort((a, b) => (b.fail - a.fail) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const adv = (agg.advice && typeof agg.advice === "object" && s(agg.advice.actKey) && s(agg.advice.reason))
      ? `繰り返し失敗: ${agg.advice.actKey}:${agg.advice.reason}` : null;
    const build = (parts, withAdv) => {
      const segs = parts.map((r) => {
        const disp = r.key.startsWith("OVERFLOW") ? "その他（集計上限）" : r.key;
        const cls = (!r.key.startsWith("OVERFLOW") && r.cls) ? `（分類 ${r.cls}）` : "";
        return `${disp} ${r.fail}回${cls}`;
      });
      if (withAdv && adv) segs.push(adv);
      return `§7（失敗の傾向（記録）: ${segs.join(" / ")} / 行動失敗 ${Math.floor(af)}/${at == null ? 0 : Math.floor(at)}）§r`;
    };
    let parts = rows.slice(0, 2);
    let line = build(parts, true);
    while (line.length > 160 && parts.length > 1) { parts = parts.slice(0, -1); line = build(parts, true); }
    if (line.length > 160 && adv) line = build(parts, false);
    if (line.length > 160) line = line.slice(0, 160);
    return [line];
  } catch { return []; }
}
export function runSelfTests() { return { note: "use test.mjs" }; }

// --- S3b 永続化 (キー分割保存, cycle0220-a02 ドラフトを正式化, v0.4.77) ---
// 保存先は個体 DP: meta "cb_failagg" をコミット点とし、byReason/byWhere を
// シャード "cb_failagg:r:<i>" / "cb_failagg:w:<i>" へ分割する。書き込み順は
// シャード→meta。復元は meta と全シャードの gen 一致 + FNV-1a ハッシュ一致を
// 必須とし、torn write・世代混在は空開始に倒す (半端な復元をしない)。
// 保存対象は集計本体+総数のみ (streak/advice/planStreak/maxKeys/streakWindowMs は保存しない)。
// 判断への読み手は増やさない (表示のみ)。clearPlanRecords へは登録しない。
export const FAILAGG_VERSION = 1;
export const FAILAGG_META_KEY = "cb_failagg";
export const FAILAGG_SHARD_MAX_BYTES = 8192;
export const FAILAGG_MAX_SHARDS_PER_TABLE = 8;
export const FAILAGG_MAX_KEYS = MAX_KEYS_DEFAULT;
export const FAILAGG_STREAK_WINDOW_MS = STREAK_WINDOW_MS_DEFAULT;

const nonNeg = (v) => { const n = num(v); return n != null && n >= 0 ? Math.floor(n) : null; };

/** UTF-8 バイト数 (Bedrock には TextEncoder が無い場合があるため手計算併用) */
export function utf8Bytes(str) {
  if (typeof str !== "string") return 0;
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str).length;
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
    else n += 3;
  }
  return n;
}

/** FNV-1a 32bit (部分書き込み検出用) */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  const t = typeof str === "string" ? str : "";
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

export function shardKey(table, i) {
  if ((table !== "r" && table !== "w") || !Number.isInteger(i) || i < 0) return null;
  return `${FAILAGG_META_KEY}:${table}:${i}`;
}

/** 再帰防止述語: dp:/dps: の cb_failagg 本体 + 全シャードキーのみ true。
 *  recordNote の入口 (normalizeWhere の前) でだけ効く (cycle0238-a04 M-2)。 */
export function isFailAggInternalWhere(where) {
  if (!s(where)) return false;
  const i = where.indexOf(":");
  if (i < 0) return false;
  const domain = where.slice(0, i), key = where.slice(i + 1);
  if (domain !== "dp" && domain !== "dps") return false;
  return key === FAILAGG_META_KEY || key.startsWith(FAILAGG_META_KEY + ":");
}

function reasonEntryOut(e) {
  if (!e || typeof e !== "object") return null;
  const n = nonNeg(e.n); if (n == null) return null;
  return {
    n, ok: nonNeg(e.ok) ?? 0, fail: nonNeg(e.fail) ?? 0,
    cls: s(e.cls), kind: s(e.kind) ?? "unclassified",
    firstAt: num(e.firstAt) ?? 0, lastAt: num(e.lastAt) ?? 0,
    lastItem: s(e.lastItem), lastSeq: num(e.lastSeq),
    empty: nonNeg(e.empty) ?? 0, partial: nonNeg(e.partial) ?? 0,
  };
}
function whereEntryOut(e) {
  if (!e || typeof e !== "object") return null;
  const n = nonNeg(e.n); if (n == null) return null;
  return {
    n, firstAt: num(e.firstAt) ?? 0, lastAt: num(e.lastAt) ?? 0,
    lastMsg: s(e.lastMsg), lastRaw: s(e.lastRaw),
  };
}
const entryOut = (table, e) => (table === "r" ? reasonEntryOut(e) : whereEntryOut(e));

function shardString(table, i, gen, pairs) {
  return JSON.stringify({ v: FAILAGG_VERSION, gen, t: table, i, e: pairs });
}

function packTable(table, src, gen, maxShardBytes) {
  const pairs = [];
  if (src && typeof src === "object") {
    for (const [k, e] of Object.entries(src)) {
      if (!s(k)) continue;
      const out = entryOut(table, e);
      if (out) pairs.push([k, out]);
    }
  }
  const shards = [];
  let cur = [], oversize = false;
  for (const pair of pairs) {
    const trial = [...cur, pair];
    if (cur.length && utf8Bytes(shardString(table, shards.length, gen, trial)) > maxShardBytes) {
      shards.push(shardString(table, shards.length, gen, cur));
      cur = [pair];
    } else cur = trial;
    if (cur.length === 1 && utf8Bytes(shardString(table, shards.length, gen, cur)) > maxShardBytes) oversize = true;
  }
  if (cur.length || !shards.length) shards.push(shardString(table, shards.length, gen, cur));
  return { shards, pairs, oversize };
}

/** agg → DP 書き込み集合 { writes, meta, pruned, droppedInvalid, oversize }。入力不変・例外0 */
export function serializeFailAggShards(agg, opts = {}) {
  try {
    if (!agg || typeof agg !== "object") return null;
    const gen = Number.isInteger(opts.gen) && opts.gen > 0 ? opts.gen : 1;
    const maxShardBytes = num(opts.maxShardBytes) > 0 ? Math.floor(opts.maxShardBytes) : FAILAGG_SHARD_MAX_BYTES;
    const maxShards = Number.isInteger(opts.maxShardsPerTable) && opts.maxShardsPerTable > 0
      ? opts.maxShardsPerTable : FAILAGG_MAX_SHARDS_PER_TABLE;
    const work = { r: null, w: null };
    let droppedInvalid = 0;
    for (const [table, src] of [["r", agg.byReason], ["w", agg.byWhere]]) {
      let packed = packTable(table, src, gen, maxShardBytes);
      const rawCount = src && typeof src === "object" ? Object.keys(src).length : 0;
      droppedInvalid += Math.max(0, rawCount - packed.pairs.length);
      let prunedHere = 0;
      while (packed.shards.length > maxShards) {
        const cand = packed.pairs
          .filter(([k]) => k !== "OVERFLOW")
          .sort((a, b) => (a[1].lastAt - b[1].lastAt) || (a[0] < b[0] ? -1 : 1))[0];
        if (!cand) break;
        packed.pairs = packed.pairs.filter(([k]) => k !== cand[0]);
        prunedHere++;
        packed = { ...packTable(table, Object.fromEntries(packed.pairs), gen, maxShardBytes), pairs: packed.pairs };
      }
      work[table] = { ...packed, pruned: prunedHere };
    }
    const writes = {};
    work.r.shards.forEach((str, i) => { writes[shardKey("r", i)] = str; });
    work.w.shards.forEach((str, i) => { writes[shardKey("w", i)] = str; });
    const hash = fnv1a([...work.r.shards, ...work.w.shards].join("\n"));
    const meta = {
      v: FAILAGG_VERSION, gen, hash,
      at: nonNeg(agg.actionTotal) ?? 0, af: nonNeg(agg.actionFail) ?? 0, nt: nonNeg(agg.noteTotal) ?? 0,
      overflowAt: num(agg.overflowAt),
      shards: { r: work.r.shards.length, w: work.w.shards.length },
      pruned: work.r.pruned + work.w.pruned,
    };
    writes[FAILAGG_META_KEY] = JSON.stringify(meta);
    return { writes, meta, pruned: meta.pruned, droppedInvalid, oversize: work.r.oversize || work.w.oversize || work.r.shards.length > maxShards || work.w.shards.length > maxShards };
  } catch { return null; }
}

function readerOf(read) {
  if (typeof read === "function") return (k) => { try { const v = read(k); return typeof v === "string" ? v : null; } catch { return null; } };
  if (read instanceof Map) return (k) => { const v = read.get(k); return typeof v === "string" ? v : null; };
  if (read && typeof read === "object") return (k) => { const v = read[k]; return typeof v === "string" ? v : null; };
  return () => null;
}
function parseJson(str) { try { const v = JSON.parse(str); return v && typeof v === "object" ? v : null; } catch { return null; } }

/** DP 読み取り集合 → { agg, status: "ok"|"empty"|"corrupt", dropped }。復元先は createFailAgg() */
export function restoreFailAggShardsWithReport(read) {
  const empty = () => createFailAgg();
  try {
    const get = readerOf(read);
    const metaRaw = get(FAILAGG_META_KEY);
    if (!metaRaw) return { agg: empty(), status: "empty", dropped: 0 };
    const meta = parseJson(metaRaw);
    if (!meta || meta.v !== FAILAGG_VERSION || !Number.isInteger(meta.gen) || meta.gen <= 0
      || !meta.shards || !Number.isInteger(meta.shards.r) || !Number.isInteger(meta.shards.w)
      || meta.shards.r < 1 || meta.shards.w < 1
      || meta.shards.r > FAILAGG_MAX_SHARDS_PER_TABLE * 4 || meta.shards.w > FAILAGG_MAX_SHARDS_PER_TABLE * 4
      || typeof meta.hash !== "string")
      return { agg: empty(), status: "corrupt", dropped: 0 };
    const raws = { r: [], w: [] };
    for (const table of ["r", "w"]) {
      for (let i = 0; i < meta.shards[table]; i++) {
        const raw = get(shardKey(table, i));
        if (raw == null) return { agg: empty(), status: "corrupt", dropped: 0 };
        raws[table].push(raw);
      }
    }
    if (fnv1a([...raws.r, ...raws.w].join("\n")) !== meta.hash)
      return { agg: empty(), status: "corrupt", dropped: 0 };
    const agg = empty();
    agg.actionTotal = nonNeg(meta.at) ?? 0;
    agg.actionFail = nonNeg(meta.af) ?? 0;
    agg.noteTotal = nonNeg(meta.nt) ?? 0;
    agg.overflowAt = num(meta.overflowAt);
    let dropped = 0;
    for (const table of ["r", "w"]) {
      const target = table === "r" ? agg.byReason : agg.byWhere;
      const seen = new Set();
      for (let i = 0; i < raws[table].length; i++) {
        const sh = parseJson(raws[table][i]);
        if (!sh || sh.v !== FAILAGG_VERSION || sh.gen !== meta.gen || sh.t !== table || sh.i !== i || !Array.isArray(sh.e))
          return { agg: empty(), status: "corrupt", dropped: 0 };
        for (const pair of sh.e) {
          if (!Array.isArray(pair) || pair.length !== 2 || !s(pair[0])) { dropped++; continue; }
          const [k, e] = pair;
          const out = entryOut(table, e);
          if (!out || seen.has(k)) { dropped++; continue; }
          if (Object.keys(target).length >= FAILAGG_MAX_KEYS + 1 && !(k in target)) { dropped++; continue; }
          seen.add(k); target[k] = out;
        }
      }
    }
    return { agg, status: "ok", dropped };
  } catch { return { agg: empty(), status: "corrupt", dropped: 0 }; }
}

/** 互換形: agg だけを返す */
export function restoreFailAggShards(read) {
  return restoreFailAggShardsWithReport(read).agg;
}

/** 前回書き込み集合と今回の差分 (純粋): { set, del }。残骸は del へ (統合側は "" を書く) */
export function planShardWrites(prevWrites, nextWrites) {
  const set = {}, del = [];
  const prev = prevWrites && typeof prevWrites === "object" ? prevWrites : {};
  const next = nextWrites && typeof nextWrites === "object" ? nextWrites : {};
  for (const [k, v] of Object.entries(next)) if (prev[k] !== v) set[k] = v;
  for (const k of Object.keys(prev)) if (!(k in next) && (k === FAILAGG_META_KEY || k.startsWith(FAILAGG_META_KEY + ":"))) del.push(k);
  return { set, del };
}
