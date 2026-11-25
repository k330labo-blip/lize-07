// goap_inspect_agg.js — Phase6 INSPECT S0-1 (cycle0153 統合): 記録専用カウンタ純粋核
// Phase 6 UNKNOWN→INSPECT S0-1: 記録専用カウンタの純粋核ドラフト。
// 正の設計: tests/cycle2117_a08_goap.md §3/§5、状態確認: tests/cycle0141_a07_inspect.md §1.1。
//
// 境界 (fail_vocab / exp_recorder の純粋核と同型):
// - @minecraft/server 非依存、import なし、Date.now() を呼ばない (時刻は rec.at 引数由来のみ)
// - 入力 (agg 以外) 不変、例外を投げない、永続化しない、EXP/trace/failAgg へ転記しない
// - 戻り値・集計値を分岐/実行/ゲート/計画の入力にしない (統合側の不変条件、validate 案は DRAFT.md §4)
// - 状態の置き場は統合側で r.inspectAgg のみとし、clearPlanRecords には登録しない (DRAFT.md §3)
export const INSPECT_AGG_MAX_KEYS = 64;
const SCOPES = ["source", "chest", "station"];
const OVERFLOW_KEY = "OVERFLOW";

function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
function finiteAt(v) { return (typeof v === "number" && Number.isFinite(v)) ? v : null; }

export function createInspectAgg() {
  return {
    evals: 0, fires: 0, needEvents: 0, keyHits: 0,
    byScope: { source: 0, chest: 0, station: 0 },
    evalsWithScope: { source: 0, chest: 0, station: 0 },
    firesByPlan: { ok: 0, ng: 0 },
    bySkipWhy: Object.create(null),
    byKey: Object.create(null), // key -> { n, firstAt, lastAt, scope }
    overflowFires: 0, firstAt: null, lastAt: null,
  };
}

function keyOf(need) {
  const id = (typeof need.item === "string" && need.item) ? need.item
    : (typeof need.fact === "string" && need.fact) ? need.fact : null;
  return id ? `${need.scope}:${id}` : null;
}

// 1評価 = 1回だけ呼ぶ。rec は r.lastPlanInspect 形
// { needed, needs:[{scope,item,fact,via}], skipped:[{why}], planOk, at }。
// 不正入力 (null/非オブジェクト/needs 非配列) は evals も増やさず agg をそのまま返す (IA-01)。
export function recordInspectEval(agg, rec) {
  try {
    if (!isObj(agg) || !isObj(rec) || !Array.isArray(rec.needs)) return agg;
    // 有効な need だけを数える (scope が3種以外は導出側の契約外として無視。導出規則は変えない)
    const valid = [];
    for (const n of rec.needs) {
      if (!isObj(n) || !SCOPES.includes(n.scope)) continue;
      const key = keyOf(n);
      if (key) valid.push({ scope: n.scope, key });
    }
    const at = finiteAt(rec.at);
    agg.evals += 1;
    if (at !== null) {
      if (agg.firstAt === null) agg.firstAt = at;
      agg.lastAt = at;
    }
    // skipped は需要軸を汚染しない: bySkipWhy にのみ入れる (IA-10)
    if (Array.isArray(rec.skipped)) {
      for (const s of rec.skipped) {
        if (isObj(s) && typeof s.why === "string" && s.why) {
          agg.bySkipWhy[s.why] = (agg.bySkipWhy[s.why] || 0) + 1;
        }
      }
    }
    const fired = rec.needed === true && valid.length > 0;
    if (!fired) return agg;
    agg.fires += 1;
    if (rec.planOk === true) agg.firesByPlan.ok += 1; else agg.firesByPlan.ng += 1;
    const scopesSeen = new Set();
    const keysSeen = new Set();
    for (const v of valid) {
      agg.needEvents += 1;
      agg.byScope[v.scope] += 1;
      scopesSeen.add(v.scope);
      if (keysSeen.has(v.key)) continue; // 同一評価内の同一キーは byKey/keyHits へ +1 のみ (IA-04)
      keysSeen.add(v.key);
      agg.keyHits += 1;
      const existing = agg.byKey[v.key];
      if (existing) {
        existing.n += 1;
        if (at !== null) { if (existing.firstAt === null) existing.firstAt = at; existing.lastAt = at; }
        continue;
      }
      const realKeys = Object.keys(agg.byKey).filter((k) => k !== OVERFLOW_KEY).length;
      if (realKeys >= INSPECT_AGG_MAX_KEYS) { // 65種目以降は OVERFLOW へ合算 (IA-07)
        agg.overflowFires += 1;
        const ov = agg.byKey[OVERFLOW_KEY] || (agg.byKey[OVERFLOW_KEY] = { n: 0, firstAt: null, lastAt: null, scope: null });
        ov.n += 1;
        if (at !== null) { if (ov.firstAt === null) ov.firstAt = at; ov.lastAt = at; }
        continue;
      }
      agg.byKey[v.key] = { n: 1, firstAt: at, lastAt: at, scope: v.scope };
    }
    for (const s of scopesSeen) agg.evalsWithScope[s] += 1;
    return agg;
  } catch { return agg; }
}

// 読み手は集計表示/掲載のみ。純粋・入力不変。
// repeatRate: keyHits (評価×キーの重複排除後ヒット数) を分母とする一般形。
//   1評価1キーのとき先行設計の (fires-distinct)/fires と一致する (IA-05)。
//   fires===0 では 0 でなく null (未発火を「反復なし」と誤読させない, IA-06)。
export function summarizeInspectAgg(agg) {
  const empty = { evals: 0, fires: 0, fireRate: null, needEvents: 0, byScope: { source: 0, chest: 0, station: 0 }, evalsWithScope: { source: 0, chest: 0, station: 0 }, firesByPlan: { ok: 0, ng: 0 }, bySkipWhy: {}, distinctKeys: 0, keyHits: 0, repeatRate: null, max: null, overflowFires: 0, window: { firstAt: null, lastAt: null } };
  try {
    if (!isObj(agg)) return empty;
    const keys = Object.keys(agg.byKey || {}).filter((k) => k !== OVERFLOW_KEY);
    let max = null;
    for (const k of keys) { const n = agg.byKey[k]?.n || 0; if (!max || n > max.n) max = { key: k, n }; }
    const keyHits = agg.keyHits || 0;
    return {
      evals: agg.evals || 0,
      fires: agg.fires || 0,
      fireRate: (agg.evals > 0) ? (agg.fires || 0) / agg.evals : null,
      needEvents: agg.needEvents || 0,
      byScope: { ...agg.byScope },
      evalsWithScope: { ...agg.evalsWithScope },
      firesByPlan: { ...agg.firesByPlan },
      bySkipWhy: { ...(agg.bySkipWhy || {}) },
      distinctKeys: keys.length,
      keyHits,
      repeatRate: (agg.fires > 0 && keyHits > 0) ? (keyHits - keys.length) / keyHits : null,
      max,
      overflowFires: agg.overflowFires || 0,
      window: { firstAt: agg.firstAt ?? null, lastAt: agg.lastAt ?? null },
    };
  } catch { return empty; }
}

// Phase6 INSPECT S0-1.5 (cycle0252): 集計の表示整形 (純粋・例外安全・入力不変)。
// 読み手は main のメニュー selection 6 の表示1点のみ。判断・計画・ゲートには使わない。
// evals===0 では何も出さない (未観測を発火0%と誤読させない)。率は null の節を省略する。各行160字上限。
export function formatInspectSummaryLines(sum) {
  try {
    if (!isObj(sum)) return [];
    const ev = finiteAt(sum.evals); if (ev == null || ev <= 0) return [];
    const fires = finiteAt(sum.fires) || 0;
    const pct = (v) => (typeof v === "number" && Number.isFinite(v)) ? `${(v * 100).toFixed(1)}%` : null;
    const win = isObj(sum.window) ? sum.window : {};
    const elapsed = (finiteAt(win.firstAt) != null && finiteAt(win.lastAt) != null) ? Math.max(0, Math.round((win.lastAt - win.firstAt) / 1000)) : null;
    const fr = pct(sum.fireRate);
    const l1 = `§7（INSPECT集計（記録）: 評価${Math.floor(ev)} / 発火${Math.floor(fires)}${fr ? `（${fr}）` : ""} / 需要${Math.floor(finiteAt(sum.needEvents) || 0)}件${elapsed != null ? ` / 窓${elapsed}秒` : ""}）§r`;
    const bs = isObj(sum.byScope) ? sum.byScope : {}, es = isObj(sum.evalsWithScope) ? sum.evalsWithScope : {};
    const l2 = `§7（INSPECT対象（記録）: source ${Math.floor(finiteAt(bs.source) || 0)}（評価${Math.floor(finiteAt(es.source) || 0)}）/ chest ${Math.floor(finiteAt(bs.chest) || 0)}（評価${Math.floor(finiteAt(es.chest) || 0)}）/ station ${Math.floor(finiteAt(bs.station) || 0)}（評価${Math.floor(finiteAt(es.station) || 0)}））§r`;
    const lines = [l1, l2];
    if (fires > 0) {
      const rr = pct(sum.repeatRate);
      const mx = isObj(sum.max) ? sum.max : null;
      const ov = Math.floor(finiteAt(sum.overflowFires) || 0);
      const kh = Math.floor(finiteAt(sum.keyHits) || 0);
      let parts3 = [`種別${Math.floor(finiteAt(sum.distinctKeys) || 0)}`, `ヒット${kh}`];
      if (rr) parts3.push(`反復率${rr}`);
      if (mx && typeof mx.key === "string") parts3.push(`最多 ${mx.key}×${Math.floor(finiteAt(mx.n) || 0)}`);
      if (ov > 0) parts3.push(`上限超過${ov}`);
      let l3 = `§7（INSPECT反復（記録）: ${parts3.join(" / ")}）§r`;
      if (l3.length > 160 && ov > 0) { parts3 = parts3.filter((s) => !s.startsWith("上限超過")); l3 = `§7（INSPECT反復（記録）: ${parts3.join(" / ")}）§r`; }
      if (l3.length > 160) { parts3 = parts3.filter((s) => !s.startsWith("ヒット")); l3 = `§7（INSPECT反復（記録）: ${parts3.join(" / ")}）§r`; }
      if (l3.length > 160) l3 = l3.slice(0, 160);
      lines.push(l3);
      const fp = isObj(sum.firesByPlan) ? sum.firesByPlan : {};
      const skips = isObj(sum.bySkipWhy) ? Object.entries(sum.bySkipWhy).filter(([, n]) => typeof n === "number" && n > 0).sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1)) : [];
      if (fires > 0 || skips.length) {
        const build4 = (ns) => `§7（INSPECT内訳（記録）: 計画ok ${Math.floor(finiteAt(fp.ok) || 0)}・ng ${Math.floor(finiteAt(fp.ng) || 0)}${ns.length ? ` / スキップ ${ns.map(([k, n]) => `${k}×${Math.floor(n)}`).join("、")}` : ""}）§r`;
        let l4 = build4(skips.slice(0, 2));
        if (l4.length > 160) l4 = build4(skips.slice(0, 1));
        if (l4.length > 160) l4 = l4.slice(0, 160);
        lines.push(l4);
      }
    }
    return lines.map((l) => (l.length > 160 ? l.slice(0, 160) : l));
  } catch { return []; }
}

export function runInspectAggSelfTests() {
  let pass = 0, fail = 0; const failures = [];
  const ok = (name, cond) => { if (cond) pass++; else { fail++; failures.push(name); } };
  const need = (scope, item) => ({ scope, item, fact: scope === "source" ? `near.${item}_source` : `${scope}.${item}`, via: "x" });
  // IA-05 相当: 同一キー3評価
  const a = createInspectAgg();
  for (let i = 0; i < 3; i++) recordInspectEval(a, { needed: true, needs: [need("source", "minecraft:iron_ore")], skipped: [], planOk: false, at: 1000 + i });
  const s = summarizeInspectAgg(a);
  ok("repeat", s.distinctKeys === 1 && Math.abs(s.repeatRate - 2 / 3) < 1e-9 && s.max?.n === 3 && s.window.firstAt === 1000 && s.window.lastAt === 1002);
  // IA-06 相当: 未発火では null
  const b = createInspectAgg(); recordInspectEval(b, { needed: false, needs: [], skipped: [], planOk: true, at: 5 });
  const sb = summarizeInspectAgg(b);
  ok("zero-fire-null", sb.evals === 1 && sb.fires === 0 && sb.repeatRate === null && sb.max === null && sb.fireRate === 0);
  // IA-01 相当: 不正入力で不変
  const before = JSON.stringify(b); recordInspectEval(b, null); recordInspectEval(b, { needs: "x" });
  ok("invalid-noop", JSON.stringify(b) === before);
  return { pass, fail, failures };
}
