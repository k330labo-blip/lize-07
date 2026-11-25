// trace.js — リゼ (LIZE-07) Phase 4 判断トレース cb_trace の器 (cycle1430 a10 ドラフトを正として統合、v0.4.56)
// Phase 3 完了 (READ-1 実装) を受けて統合。当初は fail (noteFail) + result (commitLastAction) の
// 先行2種のみ・記録専用 (分岐の入力にしない: TRC-18)。その後 goal/plan (v0.4.57)、replan (v0.4.60)、
// act (v0.4.65、仲裁後の実効行動・seen ガード付き) を順に接続し、全6種が配線済み。
//
// 正の設計 (再定義しない):
//   brain_parts/solutions/cycle-0849/a23_trace_design.md (§2)
//   tests/cycle1217_trace_cases.md (TRC-01〜TRC-18)
// 先行器: brain_parts/solutions/cycle1315-trace/cb_trace.mjs (自己テスト 35/35)
// 本ドラフトの差分 (DESIGN.md §2):
//   D1 R4 再帰防止を器側にも内蔵: recordFail が dp:cb_trace / dps:cb_trace を落とす
//   D2 退避の純粋ヘルパ: snapshotForEvict / restoreFromEvict (TRC-10c, DP には触れない)
//   D3 材料写像の純粋関数群: mapGoalEvent / mapPlanEvent / mapFailEvent /
//      mapInterruptAct / buildCtxX / planSummary (v0.4.24 の材料形に更新)
//   D4 shouldRecordAct: act は p>=900 のときだけ渡す接続規則を純粋述語として固定
//      (p の数値意味論・制御フローには触れない。読むだけ)
// 純粋性: サーバーモジュール非依存。永続化は adapter {load, save} 注入のみ。
// 材料は読むだけ・コピーだけ (TRC-14)。分岐の入力にしない (TRC-18)。

export const TRACE_VERSION = 1;
export const TRACE_MAX_ITEMS = 50;
export const TRACE_MAX_BYTES = 16384;
export const TRACE_MSG_MAX = 120;
export const TRACE_KINDS = Object.freeze(["goal", "plan", "act", "result", "fail", "replan"]);
const KIND_SET = new Set(TRACE_KINDS);
const STR_MAX = 256;

export function byteLen(s) {
  try { return new TextEncoder().encode(s).length; }
  catch { return unescape(encodeURIComponent(s)).length; }
}
function asStr(v, max = STR_MAX) {
  if (v == null) return null;
  if (typeof v === "string") return v.length > max ? v.slice(0, max) : v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return String(v);
  return null; // オブジェクトは推測で文字列化しない (TRC-05/13)
}
function asNum(v) { return (typeof v === "number" && Number.isFinite(v)) ? v : null; }
function asResult(v) { return v === "ok" || v === "ng" ? v : null; }

// ---- D1: 再帰防止 (REVIEW R4 の (a) を器側にも内蔵) ----
// dp/dps は失敗時に noteFail("dp:"+k) / noteFail("dps:"+k) を自動で呼ぶ計装済み。
// trace 自身の保存失敗が fail として戻ってきたものは、接続側が誤って渡しても落とす。
export function isTraceInternalFail(where) {
  return where === "dp:cb_trace" || where === "dps:cb_trace";
}

// ---- D3/D4: 材料写像 (純粋関数・凍結材料でも例外0・材料不変) ----

// x は a23 の4点 {hp, dg, scan, inv} に固定 (1301案 §4 の別定義は REVIEW R2 で差し戻し済み)
export function buildCtxX(src) {
  try {
    if (!src || typeof src !== "object") return null;
    const x = {
      hp: asNum(src.hp), dg: asNum(src.dg),
      scan: asStr(src.scan, 32), inv: asStr(src.inv, 32),
    };
    return (x.hp == null && x.dg == null && x.scan == null && x.inv == null) ? null : x;
  } catch { return null; }
}

// plan 要約: steps 先頭8件 + 残件数畳み (構造の複製はしない。a23 §2.3)
export function planSummary(steps) {
  try {
    if (!Array.isArray(steps)) return null;
    const parts = [];
    for (const s of steps) { const v = asStr(s, 64); if (v != null) parts.push(v); }
    if (!parts.length) return null;
    if (parts.length > 8) return parts.slice(0, 8).join(",") + `+${parts.length - 8}`;
    return parts.join(",");
  } catch { return null; }
}

// chooseGoal 返り値 {goal, utility, scores} -> goal イベント材料 (u は次点1件まで: TRC-01)
export function mapGoalEvent(src) {
  try {
    if (!src || typeof src !== "object") return null;
    const g = asStr(src.goal ?? src.g);
    if (g == null) return null;
    return { k: "goal", g, utility: asNum(src.utility), scores: Array.isArray(src.scores) ? src.scores : undefined, x: buildCtxX(src.x) };
  } catch { return null; }
}

// r.lastPlan / r.lastGoal (v0.4.24 形) -> plan イベント材料。
// g の優先順: lastGoal.key -> lastPlan.goalKey -> null (直前値の引き継ぎはしない: TRC-05)
// gate 群 (GateP3/RevalP4/RevalFull/Unified 等)・snap・a1・sig・needRemain・candKey は入れない。
export function mapPlanEvent(lastPlan, lastGoal) {
  try {
    if (!lastPlan || typeof lastPlan !== "object") return null;
    const p = planSummary(lastPlan.steps);
    if (p == null) return null;
    return {
      k: "plan",
      g: asStr(lastGoal?.key) ?? asStr(lastPlan.goalKey),
      p,
      r: lastPlan.ok === true ? "ok" : lastPlan.ok === false ? "ng" : null,
    };
  } catch { return null; }
}

// noteFail 材料 {where, msg} -> fail イベント材料。内部 fail (D1) は null を返す。
export function mapFailEvent(src) {
  try {
    if (!src || typeof src !== "object") return null;
    const w = asStr(src.where ?? src.w);
    if (w != null && isTraceInternalFail(w)) return null;
    const m = asStr(src.msg ?? src.m, TRACE_MSG_MAX);
    if (w == null && m == null) return null;
    return { k: "fail", fr: { w, m } };
  } catch { return null; }
}

// TRC-06: act は p>=900 の生命危機割込みのときだけ記録対象にする (接続側規則の純粋述語化)
export function shouldRecordAct(p) {
  return typeof p === "number" && Number.isFinite(p) && p >= 900;
}
export function mapInterruptAct(src) {
  try {
    if (!src || typeof src !== "object" || !shouldRecordAct(src.p)) return null;
    const a = asStr(src.act ?? src.a);
    if (a == null) return null;
    return { k: "act", g: asStr(src.goal ?? src.g), a, x: buildCtxX(src.x) };
  } catch { return null; }
}

// mission の suspend 遷移 -> replan イベント材料 (v0.4.60, cycle2213-a18/a03 裁定の実施)。
// 行き先は実在の計画/目標ではなく "suspended" を明示する (再計画が起きたことと同一視しない)。
// why は directive.reason の "suspended:" 後段を素通りさせる (再分類・言い換え・語彙チェックをしない)。
// 材料は読むだけ・コピーだけ。欠けた材料は推測で埋めず null に倒す。
export function mapReplanEvent(mission, directive) {
  try {
    if (!mission || typeof mission !== "object") return null;
    if (!directive || typeof directive !== "object") return null;
    const reason = typeof directive.reason === "string" ? directive.reason : null;
    if (!reason || !reason.startsWith("suspended:")) return null;
    const why = asStr(reason.slice("suspended:".length));
    if (why == null || why === "") return null;
    const target = asStr(mission.order?.target);
    return {
      k: "replan",
      g: target != null ? `mission:${target}` : null,
      rr: { from: asStr(directive.step), to: "suspended", why },
    };
  } catch { return null; }
}

// ---- レコード正規化 (先行器から継承。s/t は呼び出し側で付与) ----
export function normalizeRecord(input, seq, now) {
  try {
    if (!input || typeof input !== "object") return null;
    const k = asStr(input.k ?? input.kind, 16);
    if (!k || !KIND_SET.has(k)) return null; // 未知 kind は作らない (TRC-13d)
    const rec = {
      s: seq, t: asNum(now) ?? 0, k,
      g: asStr(input.g ?? input.goal),
      p: asStr(input.p ?? input.plan),
      a: asStr(input.a ?? input.act),
      r: asResult(input.r ?? input.result),
      fr: null, rr: null, u: null, x: null,
    };
    const fr = input.fr ?? input.failReason;
    if (fr && typeof fr === "object") {
      const w = asStr(fr.w ?? fr.where), m = asStr(fr.m ?? fr.msg, TRACE_MSG_MAX);
      if (w != null || m != null) rec.fr = { w, m: m == null ? null : m.slice(0, TRACE_MSG_MAX) };
    } else if (k === "fail") {
      const w = asStr(input.w ?? input.where), m = asStr(input.m ?? input.msg, TRACE_MSG_MAX);
      if (w != null || m != null) rec.fr = { w, m };
    }
    const rr = input.rr ?? input.replanReason;
    if (rr && typeof rr === "object") {
      rec.rr = { from: asStr(rr.from), to: asStr(rr.to), why: asStr(rr.why) };
    }
    const uObj = (input.u && typeof input.u === "object") ? input.u : null;
    let uBest = uObj ? asNum(uObj.best) : asNum(input.utility);
    let uNext = null;
    if (uObj && Array.isArray(uObj.next) && uObj.next.length >= 2) {
      const id = asStr(uObj.next[0]), val = asNum(uObj.next[1]);
      if (id != null && val != null) uNext = [id, val];
    }
    if (!uNext && Array.isArray(input.scores)) {
      const sorted = input.scores
        .filter(e => Array.isArray(e) && asStr(e[0]) != null && asNum(e[1]) != null)
        .map(e => [asStr(e[0]), asNum(e[1])]).sort((a, b) => b[1] - a[1]);
      const cand = sorted.find(e => e[0] !== rec.g) ?? sorted[1];
      if (cand) uNext = cand;
      if (uBest == null && sorted.length) uBest = sorted.find(e => e[0] === rec.g)?.[1] ?? null;
    }
    if (uBest != null || uNext != null) rec.u = { best: uBest, next: uNext };
    rec.x = buildCtxX(input.x ?? input.ctx);
    return rec;
  } catch { return null; }
}

// ---- 読み手 (純粋・表示専用。TRC-15/16/17) ----
export function formatRecord(rec) {
  if (!rec || typeof rec !== "object") return "(記録なし)";
  const parts = [`#${rec.s ?? "?"}`, rec.k ?? "?"];
  if (rec.g != null) parts.push(`goal=${rec.g}`);
  if (rec.p != null) parts.push(`plan=${rec.p}`);
  if (rec.a != null) parts.push(`act=${rec.a}`);
  if (rec.r != null) parts.push(`result=${rec.r}`);
  if (rec.fr) parts.push(`fail=${rec.fr.w ?? "?"}: ${rec.fr.m ?? ""}`.trimEnd());
  if (rec.rr) parts.push(`replan=${rec.rr.from ?? "?"}->${rec.rr.to ?? "?"} (${rec.rr.why ?? "?"})`);
  if (rec.u) parts.push(`utility=${rec.u.best ?? "?"}${rec.u.next ? ` next=${rec.u.next[0]}:${rec.u.next[1]}` : ""}`);
  return parts.join(" ");
}
export function summarizeTrace(items) {
  const out = { goal: null, plan: null, action: null, fail: null, replan: null, utility: null };
  if (!Array.isArray(items)) return out;
  for (let i = items.length - 1; i >= 0; i--) {
    const r = items[i]; if (!r || typeof r !== "object") continue;
    if (out.goal == null && r.g != null) out.goal = r.g;
    if (out.plan == null && r.p != null) out.plan = r.p;
    if (out.action == null && r.a != null) out.action = r.a;
    if (out.fail == null && r.k === "fail" && r.fr) out.fail = r.fr;
    if (out.replan == null && r.k === "replan" && r.rr) out.replan = r.rr;
    if (out.utility == null && r.u) out.utility = r.u;
    if (out.goal && out.plan && out.action && out.fail && out.replan && out.utility) break;
  }
  return out;
}
// 表示 U1 (cycle2239, Phase4): summarizeTrace の結果 -> 最大2行の表示文字列 (純粋・例外安全)
// 行1: 目標/計画 (ラベルは stale 誤認防止のため「直近の判断（記録）」)。行2: 失敗理由 (w+m)。
// replan は厳密最小のため出さない (TD2239-04)。欠落項目は行ごと省略し、推測で埋めない。
export function formatTraceSummaryLines(sum) {
  try {
    if (!sum || typeof sum !== "object") return [];
    const lines = [];
    const g = typeof sum.goal === "string" && sum.goal ? sum.goal : null;
    const p = typeof sum.plan === "string" && sum.plan ? sum.plan : null;
    if (g != null || p != null) {
      const parts = [];
      if (g != null) parts.push(`目標 ${g}`);
      if (p != null) parts.push(`計画 ${p}`);
      lines.push(`§7（直近の判断（記録）: ${parts.join(" / ")}）§r`);
    }
    const f = sum.fail && typeof sum.fail === "object" ? sum.fail : null;
    if (f && (typeof f.w === "string" && f.w || typeof f.m === "string" && f.m)) {
      const w = typeof f.w === "string" && f.w ? f.w : "?";
      const m = typeof f.m === "string" && f.m ? `: ${f.m}` : "";
      lines.push(`§7（直近の失敗（記録）: ${w}${m}）§r`);
    }
    return lines.slice(0, 2);
  } catch { return []; }
}
export function recentTrace(items, n = 3) {
  if (!Array.isArray(items)) return [];
  const lim = Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
  return items.slice().sort((a, b) => (b?.s ?? 0) - (a?.s ?? 0)).slice(0, lim);
}

// ---- 保存全体 (TRC-11: 破損は例外0で空から開始) ----
export function serializeTrace(state) {
  return JSON.stringify({ v: TRACE_VERSION, seq: state.seq, items: state.items });
}
export function parseTrace(raw) {
  const empty = { v: TRACE_VERSION, seq: 1, items: [] };
  try {
    if (raw == null || raw === "") return empty;
    const o = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!o || typeof o !== "object" || Array.isArray(o)) return empty;
    if (o.v !== TRACE_VERSION || !Array.isArray(o.items)) return empty;
    const items = [];
    let maxS = 0;
    for (const it of o.items) {
      const rec = normalizeRecord(it, asNum(it?.s) ?? 0, asNum(it?.t) ?? 0);
      if (rec && rec.s > 0) { items.push(rec); if (rec.s > maxS) maxS = rec.s; }
    }
    items.sort((a, b) => a.s - b.s);
    const seq = asNum(o.seq);
    // seq が items の最大 s 以下なら破損として全体初期化 (1301案 §3-5 / REVIEW §1-4)
    if (seq != null && items.length && seq <= maxS) return empty;
    return { v: TRACE_VERSION, seq: Math.max(seq ?? 1, maxS + 1, 1), items: items.slice(-TRACE_MAX_ITEMS) };
  } catch { return empty; }
}

export function createTrace(adapter, options = {}) {
  const maxItems = options.maxItems ?? TRACE_MAX_ITEMS;
  const maxBytes = options.maxBytes ?? TRACE_MAX_BYTES;
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  let state = { v: TRACE_VERSION, seq: 1, items: [] };
  let dirty = false, loaded = false;

  function enforceLimits() {
    while (state.items.length > maxItems) state.items.shift();
    // バイト上限 (UTF-8 実測) が件数上限より先に効く (TRC-08)。切詰めはレコード単位。
    while (state.items.length > 1 && byteLen(serializeTrace(state)) > maxBytes) state.items.shift();
    if (state.items.length === 1 && byteLen(serializeTrace(state)) > maxBytes) state.items.shift();
  }
  function load() {
    loaded = true;
    try { state = parseTrace(adapter?.load?.()); }
    catch { state = { v: TRACE_VERSION, seq: 1, items: [] }; }
    dirty = false;
    return api;
  }
  function ensureLoaded() { if (!loaded) load(); }
  // TRC-12: save 例外は隔離し dirty を残す。noteFail は呼ばない (D1 と対の再帰防止)
  function flush(force = false) {
    ensureLoaded();
    if (!dirty && !force) return false;
    try {
      adapter?.save?.(serializeTrace(state));
      dirty = false; return true;
    } catch { return false; }
  }
  function record(input) {
    try {
      ensureLoaded();
      const rec = normalizeRecord(input, state.seq, now());
      if (!rec) return null;
      // TRC-04/01: goal/plan は直前と k/g/p/a 同一なら畳む。fail/result/replan/act は畳まない。
      if (rec.k === "goal" || rec.k === "plan") {
        const last = state.items[state.items.length - 1];
        if (last && last.k === rec.k && last.g === rec.g && last.p === rec.p && last.a === rec.a) return null;
      }
      state.items.push(rec); state.seq += 1; dirty = true;
      enforceLimits();
      if (rec.k === "result") flush(true); // TRC-03: result のみ即時 flush
      return rec;
    } catch { return null; }
  }
  // noteFail 接続の器側入口: 内部 fail はここでも落とす (D1)
  function recordFail(src, snap) {
    const ev = mapFailEvent(src);
    if (!ev) return null;
    return record({ ...ev, g: asStr(snap?.g), p: asStr(snap?.p), a: asStr(snap?.a), x: buildCtxX(snap?.x) });
  }
  const api = {
    load, flush, record, recordFail,
    items: () => { ensureLoaded(); return state.items.slice(); },
    serialize: () => { ensureLoaded(); return serializeTrace(state); },
    summarize: () => summarizeTrace(api.items()),
    recent: (n) => recentTrace(api.items(), n),
    format: formatRecord,
    // D2/TRC-10c: 退避は「文字列を渡す/受け取る」までが器の仕事。DP 書込は統合側。
    snapshotForEvict: () => { ensureLoaded(); return serializeTrace(state); },
    restoreFromEvict: (raw) => {
      try {
        const st = parseTrace(raw);
        loaded = true; state = st; dirty = st.items.length > 0;
        return st.items.length;
      } catch { loaded = true; state = { v: TRACE_VERSION, seq: 1, items: [] }; dirty = false; return 0; }
    },
    get dirty() { return dirty; },
    get seq() { return state.seq; },
    get size() { ensureLoaded(); return state.items.length; },
  };
  return api;
}

// ---- node 自己テスト (直接実行時のみ) ----
export function runSelfTests() {
  let pass = 0, fail = 0; const fails = [];
  const eq = (name, got, want) => {
    const g = JSON.stringify(got), w = JSON.stringify(want);
    if (g === w) pass++; else { fail++; fails.push(`${name}: got=${g} want=${w}`); }
  };
  const ok = (name, cond) => { if (cond) pass++; else { fail++; fails.push(name); } };
  let tick = 1000; const now = () => tick++;
  const mem = () => { let s = ""; return { load: () => s, save: v => { s = v; }, get: () => s }; };

  // TRC-01/04: goal+utility、同一 goal 再選択は増えない、fail は畳まない
  { const a = mem(), tr = createTrace(a, { now }); tr.load();
    tr.record(mapGoalEvent({ goal: "gather_wood", utility: 0.83, scores: [["gather_wood", 0.83], ["guard_owner", 0.61]] }));
    eq("TRC01 size", tr.size, 1); eq("TRC01 u", tr.items()[0].u, { best: 0.83, next: ["guard_owner", 0.61] });
    tr.record({ k: "goal", g: "gather_wood" }); eq("TRC04 goal dedup", tr.size, 1);
    tr.record({ k: "fail", fr: { w: "x:y", m: "e" } }); tr.record({ k: "fail", fr: { w: "x:y", m: "e" } });
    eq("TRC04 fail not dedup", tr.size, 3); }
  // TRC-03/10: result 即時 flush、通常記録は flush まで書かない、dirty でない flush は no-op
  { const a = mem(); let saves = 0; const ad = { load: a.load, save: v => { saves++; a.save(v); } };
    const tr = createTrace(ad, { now }); tr.load();
    eq("TRC10 clean flush", tr.flush(), false); eq("TRC10 saves0", saves, 0);
    tr.record({ k: "plan", g: "mission:oak_log", p: "gather:1/3" }); eq("TRC03 plan no save", saves, 0);
    tr.record({ k: "result", g: "mission:oak_log", r: "ok", p: "done" }); eq("TRC03 result save", saves, 1);
    eq("TRC10 dirty after flush", tr.dirty, false); }
  // TRC-05: 材料欠落は null (推測しない)
  { const tr = createTrace(mem(), { now }); tr.load(); const r = tr.record({ k: "plan" });
    eq("TRC05 nulls", [r.g, r.p, r.a, r.r, r.u], [null, null, null, null, null]); }
  // TRC-06/D4: act は p>=900 のみ
  { eq("TRC06 p899", shouldRecordAct(899), false); eq("TRC06 p900", shouldRecordAct(900), true);
    eq("TRC06 map low", mapInterruptAct({ p: 100, act: "work" }), null);
    const hi = mapInterruptAct({ p: 950, act: "flee", x: { hp: 0.2, dg: 3, scan: "ok", inv: "ok" } });
    eq("TRC06 map high", [hi.k, hi.a, hi.x.hp], ["act", "flee", 0.2]); }
  // TRC-07/08/09: 環状50件・バイト上限先行 (日本語=UTF-8で効く)・seq 単調と復元後継続
  { const a = mem(), tr = createTrace(a, { now }); tr.load();
    for (let i = 0; i < 55; i++) tr.record({ k: "fail", fr: { w: "w" + i, m: "m" } });
    eq("TRC07 cap50", tr.size, 50); eq("TRC07 oldest dropped", tr.items()[0].fr.w, "w5");
    tr.flush(true); const tr2 = createTrace(a, { now }); tr2.load();
    const before = tr2.items()[49].s; tr2.record({ k: "fail", fr: { w: "new", m: "m" } });
    ok("TRC09 seq continues", tr2.items()[49].s > before); }
  { const tr = createTrace(mem(), { now, maxBytes: 600 }); tr.load();
    for (let i = 0; i < 20; i++) tr.record({ k: "fail", fr: { w: "w" + i, m: "あ".repeat(60) } });
    ok("TRC08 bytes utf8", byteLen(tr.serialize()) <= 600); ok("TRC08 under cap", tr.size < 20); }
  // TRC-11/12/13/14: 破損読込 (seq 矛盾を含む)・save例外隔離・壊れた材料・凍結材料
  { for (const bad of ["{broken", "[]", '{"v":99,"items":[]}', "", undefined,
      '{"v":1,"seq":2,"items":[{"s":5,"t":1,"k":"fail"}]}']) {
      const tr = createTrace({ load: () => bad, save: () => {} }, { now }); tr.load(); eq("TRC11 empty", tr.size, 0); } }
  { const tr = createTrace({ load: () => "", save: () => { throw new Error("dp down"); } }, { now }); tr.load();
    let threw = false; try { tr.record({ k: "result", r: "ng" }); } catch { threw = true; }
    eq("TRC12 no throw", threw, false); eq("TRC12 kept", tr.size, 1); eq("TRC12 dirty kept", tr.dirty, true); }
  { const tr = createTrace(mem(), { now }); tr.load(); const circ = { k: "fail" }; circ.fr = circ;
    let circThrew = false, circRec = "unset";
    try { circRec = tr.record(circ); } catch { circThrew = true; }
    eq("TRC13 circ no throw", circThrew, false);
    ok("TRC13 circ safe", circRec === null || circRec.fr === null);
    eq("TRC13 bad kind", tr.record({ k: "nope" }), null);
    eq("TRC13 null input", tr.record(null), null);
    const long = tr.record({ k: "fail", fr: { w: "w", m: "y".repeat(300) } });
    eq("TRC13 msg120", long.fr.m.length, 120);
    const frozen = Object.freeze({ k: "goal", g: "idle", u: Object.freeze({ best: 0.5, next: Object.freeze(["x", 0.4]) }) });
    ok("TRC14 frozen ok", !!tr.record(frozen)); eq("TRC14 input intact", frozen.s, undefined); }
  // D1: 再帰防止 — trace 自身の保存失敗由来の fail は器でも落とす
  { const tr = createTrace(mem(), { now }); tr.load();
    eq("D1 dps filtered", tr.recordFail({ where: "dps:cb_trace", msg: "boom" }), null);
    eq("D1 dp filtered", tr.recordFail({ where: "dp:cb_trace", msg: "boom" }), null);
    eq("D1 size still 0", tr.size, 0);
    const kept = tr.recordFail({ where: "dps:cb_mission", msg: "other key is kept" });
    ok("D1 other key kept", !!kept && kept.fr.w === "dps:cb_mission");
    eq("D1 isInternal", [isTraceInternalFail("dp:cb_trace"), isTraceInternalFail("bts_break:set_failed")], [true, false]); }
  // D2/TRC-10c: 退避スナップショット -> 別個体で復元 (文字列の受け渡しのみ)
  { const tr = createTrace(mem(), { now }); tr.load();
    tr.record({ k: "goal", g: "follow_owner" }); tr.record({ k: "fail", fr: { w: "w1", m: "m1" } });
    const snap = tr.snapshotForEvict();
    const tr2 = createTrace(mem(), { now });
    eq("D2 restored count", tr2.restoreFromEvict(snap), 2);
    eq("D2 restored goal", tr2.items()[0].g, "follow_owner");
    eq("D2 dirty for rewrite", tr2.dirty, true);
    tr2.record({ k: "plan", p: "after-restore" });
    ok("D2 seq continues", tr2.items()[2].s > tr2.items()[1].s);
    eq("D2 broken evict", createTrace(mem(), { now }).restoreFromEvict("{broken"), 0); }
  // D3: 写像 — plan 要約の畳み・g 優先順・gate/snap 等を入れない
  { eq("D3 summary cap", planSummary(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]), "a,b,c,d,e,f,g,h+2");
    eq("D3 summary null", planSummary(null), null);
    const ev = mapPlanEvent(
      { ok: true, steps: ["BREAK:minecraft:oak_log", "WITHDRAW:minecraft:oak_log"], goalKey: "plan-side",
        snap: { state: { big: 1 } }, a1: { pre: [1] }, sig: "s", candKey: "c" },
      { key: "goal:inv[minecraft:oak_log>=100]" });
    eq("D3 plan g priority", ev.g, "goal:inv[minecraft:oak_log>=100]");
    eq("D3 plan p", ev.p, "BREAK:minecraft:oak_log,WITHDRAW:minecraft:oak_log");
    eq("D3 plan no extra keys", Object.keys(ev).sort(), ["g", "k", "p", "r"]);
    eq("D3 plan null src", mapPlanEvent(null, null), null);
    eq("D3 x deviation guard", buildCtxX({ dimension: "o", hasMission: true }), null); }
  // TRC-15/16/17: 表示6項目・欠落耐性・降順コピー (保存順不変)
  { const tr = createTrace(mem(), { now }); tr.load();
    eq("TRC16 empty summary", tr.summarize(), { goal: null, plan: null, action: null, fail: null, replan: null, utility: null });
    tr.record({ k: "goal", g: "gather_wood", a: "work", utility: 0.9 });
    tr.record({ k: "plan", p: "gather:3/100" });
    tr.record({ k: "fail", fr: { w: "break:x", m: "boom" } });
    tr.record({ k: "replan", rr: { from: "a", to: "b", why: "target_lost" } });
    const s = tr.summarize();
    eq("TRC15 summary", [s.goal, s.plan, s.action, s.fail.w, s.replan.why, s.utility.best],
       ["gather_wood", "gather:3/100", "work", "break:x", "target_lost", 0.9]);
    const before = tr.items().map(r => r.s).join(",");
    eq("TRC17 recent desc", tr.recent(3).map(r => r.k), ["replan", "fail", "plan"]);
    eq("TRC17 order kept", tr.items().map(r => r.s).join(","), before);
    ok("format line", formatRecord(tr.items()[2]).includes("fail=break:x")); }
  // ファズ (決定的 LCG): 例外0・s 重複0・上限内・三状態の潰し0 (r は ok/ng/null のみ)
  { const tr = createTrace(mem(), { now }); tr.load();
    let seed = 1430, threw = 0;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const kinds = ["goal", "plan", "act", "result", "fail", "replan", "bogus", null];
    try {
      for (let i = 0; i < 2000; i++) {
        tr.record({ k: kinds[Math.floor(rnd() * kinds.length)],
          g: rnd() < 0.3 ? null : "g" + Math.floor(rnd() * 5),
          p: rnd() < 0.5 ? "p" + i : null, a: "a" + Math.floor(rnd() * 3),
          r: ["ok", "ng", "maybe", null][Math.floor(rnd() * 4)],
          fr: { w: "w" + Math.floor(rnd() * 9), m: "m".repeat(Math.floor(rnd() * 200)) },
          rr: { from: "f", to: "t", why: "target_lost" },
          utility: rnd(), scores: [["g0", 0.9], ["g1", 0.5]] });
      }
    } catch { threw++; }
    const ss = tr.items().map(r => r.s);
    eq("FUZZ no throw", threw, 0);
    eq("FUZZ seq unique", new Set(ss).size, ss.length);
    ok("FUZZ caps", tr.size <= 50 && byteLen(tr.serialize()) <= 16384);
    ok("FUZZ r vocab", tr.items().every(r => r.r === "ok" || r.r === "ng" || r.r === null)); }
  return { pass, fail, fails };
}

const isMain = (() => { try { return import.meta.url === new URL(`file://${process.argv[1]}`).href; } catch { return false; } })();
if (isMain) {
  const r = runSelfTests();
  console.log(`cb_trace self-test: ${r.pass} passed, ${r.fail} failed`);
  for (const f of r.fails) console.log("  FAIL " + f);
  process.exitCode = r.fail ? 1 : 0;
}
