// goap_exec.js — Phase3 Plan実行移行: GOAP計画の第一手ゲート (記録専用)
// P3本体化 (v0.4.24, cycle1416): 旧ゲート evaluateFirstStep は廃止し、判定の正は
// evaluateFirstStepP3 のみとした。旧ゲートは tests/frozen_legacy_gate.mjs に凍結保存し
// 遷移検証専用とする (BP から import 禁止)。
//   verdict: "allow" | "deny" | "unknown"
//   plan は goap.js の plan() 結果、または main.js の r.lastPlan 形。
//   meta は goap_state.js の meta (unknownReasons / factStatus)。
// (履歴) v0.4.21 時点の旧ゲートの allow は第一手 pre の known 充足を意味しない
// 近似判定だった。旧ゲートは v0.4.24 の P3 本体化で廃止済みであり、現行の
// allow の限定文言の正は P3 節 (evaluateFirstStepP3) のみである。
// P3 の材料は a1/snap であり、正規化は normalizeSteps の実装が正とする。
// 空計画は reason already_satisfied + scope no_first_step の分離済み形である。
//
// ===== 契約 =====
// - 純粋関数。入力 (plan / meta) は変更しない。例外は絶対に投げない。
// - c.x は読まない (本関数は plan と meta だけを見る)。ctx の意味変更なし。
// - decide の p 意味論・effMove.id 接頭辞には触れない。本関数の verdict は
//   新しい名前空間であり、既存の制御フローとは独立。
//
// ---------- 内部ユーティリティ (全て例外安全) ----------
function normalizeSteps(plan) {
  try {
    if (Array.isArray(plan)) return plan;
    if (!plan || typeof plan !== "object") return null;
    if (Array.isArray(plan.steps)) return plan.steps;
    if (Array.isArray(plan.actions)) return plan.actions;
    // goap.js の失敗結果 { ok:false, reason, expanded } は steps を持たない。
    // ok が boolean として明示されている計画は「一手なし」として扱う。
    if (typeof plan.ok === "boolean") return [];
    return null;
  } catch { return null; }
}

function stepToString(step) {
  try {
    if (typeof step === "string") return step;
    if (step && typeof step === "object" && typeof step.id === "string") return step.id;
    return null;
  } catch { return null; }
}

/** "KIND:target" を分解する。分解できなければ null。 */
export function parseStep(step) {
  try {
    const s = stepToString(step);
    if (typeof s !== "string" || !s) return null;
    const i = s.indexOf(":");
    if (i <= 0) return null;
    const kind = s.slice(0, i);
    const target = s.slice(i + 1);
    if (!kind || !target) return null;
    // NQ-03 ステップ3 (v0.4.38, 設計 §4.1): サフィックスは #<k> -> @h<n> の順に
    // 末尾から剥がす。正準形 (先行ゼロなし・量は1以上) のときだけ剥がし、
    // 異形は剥がさず従来形として返す (安全側: ゲートは unknown へ倒れる)。
    let item = target, holder = null, amount = null;
    let rest = target;
    const mAmt = /#([1-9]\d*)$/.exec(rest);
    if (mAmt) { amount = Number(mAmt[1]); rest = rest.slice(0, mAmt.index); }
    if (/@h\d+$/.test(rest) && !/@h(0|[1-9]\d*)$/.test(rest)) {
      // 保持者部が非正準 (例 @h01) なら部分的に剥がさず全体を従来形として返す
      amount = null; rest = target;
    } else {
      const mHold = /@h(0|[1-9]\d*)$/.exec(rest);
      if (mHold) { holder = `h${mHold[1]}`; rest = rest.slice(0, mHold.index); }
    }
    if ((holder !== null || amount !== null) && rest) item = rest;
    else { holder = null; amount = null; }
    return { kind, target: item, item, holder, amount, raw: s };
  } catch { return null; }
}


// ---------- 自己テスト ----------
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
function assert(cond, msg) { if (!cond) throw new Error(msg ?? "assertion failed"); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg ?? "not equal"}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }

const LOG = "minecraft:oak_log";
const snapKnown = (state) => ({ factStatus: Object.fromEntries(Object.entries(state).map(([k, v]) => [k, { status: "known", value: v }])), state: { ...state } });

test("P3S-01 allow: 第一手 pre が known 充足", () => {
  const r = evaluateFirstStepP3({ ok: true, steps: [`GATHER:${LOG}`], a1: { id: `GATHER:${LOG}`, pre: [{ fact: `near.${LOG}_source`, op: ">=", value: 1 }] }, snap: snapKnown({ [`near.${LOG}_source`]: 1 }) });
  eq(r.verdict, "allow"); eq(r.reason, "first_step_pre_known_satisfied");
});
test("P3S-02 deny: 第一手 pre が known 未充足", () => {
  const r = evaluateFirstStepP3({ ok: true, steps: [`GATHER:${LOG}`], a1: { id: `GATHER:${LOG}`, pre: [{ fact: `near.${LOG}_source`, op: ">=", value: 1 }] }, snap: snapKnown({ [`near.${LOG}_source`]: 0 }) });
  eq(r.verdict, "deny");
});
test("P3S-03 unknown: 第一手 pre の fact が unknown", () => {
  const snap = { factStatus: { [`near.${LOG}_source`]: { status: "unknown", reason: "source_unknown" } }, state: {} };
  const r = evaluateFirstStepP3({ ok: true, steps: [`GATHER:${LOG}`], a1: { id: `GATHER:${LOG}`, pre: [{ fact: `near.${LOG}_source`, op: ">=", value: 1 }] }, snap });
  eq(r.verdict, "unknown");
});
test("P3S-04 unknown: 材料欠落は推測で埋めない", () => {
  eq(evaluateFirstStepP3({ ok: true, steps: [`GATHER:${LOG}`] }).verdict, "unknown");
  eq(evaluateFirstStepP3(null, null).verdict, "unknown");
});
test("P3S-05 allow: 空計画は already_satisfied", () => {
  const r = evaluateFirstStepP3({ ok: true, steps: [] });
  eq(r.verdict, "allow"); eq(r.reason, "already_satisfied");
});
test("P3S-06 決定性: 同一入力は同一結果", () => {
  const plan = { ok: true, steps: [`GATHER:${LOG}`], a1: { id: `GATHER:${LOG}`, pre: [{ fact: `near.${LOG}_source`, op: ">=", value: 1 }] }, snap: snapKnown({ [`near.${LOG}_source`]: 1 }) };
  eq(evaluateFirstStepP3(plan), evaluateFirstStepP3(plan));
});

// ---------- ランナー (ファイル末尾で実行) ----------
export function runSelfTests(log = (...a) => { try { console.log(...a); } catch {} }) {
  let pass = 0, fail = 0;
  for (const [name, fn] of tests) {
    try { fn(); pass++; log(`PASS ${name}`); }
    catch (e) { fail++; log(`FAIL ${name}: ${e?.message ?? e}`); }
  }
  log(`RESULT ${pass}/${tests.length} passed, ${fail} failed`);
  return { pass, fail, total: tests.length };
}

// ---------- Phase3 S1b P3 (v0.4.19, cycle1156/a02 統合): applicable 三状態再確認 ----------
// evaluateFirstStepP3 は第一手の実 pre (a1) と計画時点スナップショット (snap) だけを
// 見て判定する。KIND 対応表は持たない。v0.4.24 で P3 本体化し旧ゲートは廃止した
// (main は P3 のみを記録する。読み手化は S1b 解禁後)。
// allow の意味は「計画時点 snap で第一手 pre が known かつ充足」だけ (P5 文言限定)。
// ---------- goap.js 意味論の複写 (統合時は import へ置換) ----------
const OPS = new Set([">=", ">", "<=", "<", "==", "!="]);
const NUMERIC_OPS = new Set([">=", ">", "<=", "<"]);

export function satisfiesP3(state, pred) {
  try {
    const v = state?.[pred?.fact];
    if (v === undefined || v === null) return false; // UNKNOWN は未充足 (goap.js と同一)
    switch (pred?.op) {
      case ">=": return typeof v === "number" && v >= pred.value;
      case ">":  return typeof v === "number" && v >  pred.value;
      case "<=": return typeof v === "number" && v <= pred.value;
      case "<":  return typeof v === "number" && v <  pred.value;
      case "==": return v === pred.value;
      case "!=": return v !== pred.value;
      default: return false;
    }
  } catch { return false; }
}

export function applicableP3(state, action) {
  try { return (action?.pre ?? []).every(p => satisfiesP3(state, p)); }
  catch { return false; }
}

// ---------- 内部ユーティリティ (全て例外安全) ----------
const isObj = (v) => { try { return v !== null && typeof v === "object"; } catch { return false; } };
const has = (o, k) => { try { return isObj(o) && Object.prototype.hasOwnProperty.call(o, k); } catch { return false; } };



/**
 * 材料 (a1 / snap) の解決。優先順: 第2引数の明示形 > plan 自身の a1/snap >
 * plan.actions[0] (goap.js plan() 結果を直接渡された場合)。
 * ev 形 { state, meta } が第2引数なら snap を { factStatus: meta.factStatus, state } で組む。
 * 解決できない部分は null のままにし、捏造しない。
 */
function resolveMaterial(plan, extra) {
  try {
    let a1 = null, snap = null;
    const takeA1 = (cand) => {
      if (a1 || !isObj(cand)) return;
      a1 = { id: typeof cand.id === "string" ? cand.id : null,
             pre: Array.isArray(cand.pre) ? cand.pre : (cand.pre === undefined ? [] : null) };
    };
    const takeSnap = (cand) => {
      if (snap || !isObj(cand)) return;
      snap = cand;
    };
    // 第2引数: {a1, snap} / {a1, factStatus, state} / ev {state, meta, actions}
    if (isObj(extra)) {
      takeA1(extra.a1);
      if (Array.isArray(extra.actions)) takeA1(extra.actions[0]);
      takeSnap(extra.snap);
      if (!snap && (isObj(extra.meta) || isObj(extra.state) || has(extra, "factStatus")))
        snap = { factStatus: isObj(extra.meta?.factStatus) ? extra.meta.factStatus
                 : (isObj(extra.factStatus) ? extra.factStatus : null),
                 state: isObj(extra.state) ? extra.state : null,
                 ...(has(extra, "chest") ? { chest: extra.chest } : {}),
                 ...(isObj(extra.stationStatus) ? { stationStatus: extra.stationStatus } : {}) };
    }
    // plan 自身
    if (isObj(plan)) {
      takeA1(plan.a1);
      if (Array.isArray(plan.actions)) takeA1(plan.actions[0]);
      takeSnap(plan.snap);
    }
    return { a1, snap };
  } catch { return { a1: null, snap: null }; }
}

/**
 * buildP3Material(res, ev) -> { a1, snap }
 * main.js 影評価部が r.lastPlan へ保持する形 (実コードの複写規則) と同じ材料を、
 * goap.js plan() 結果 res と goap_state の評価 ev から組み立てる純粋ヘルパ。
 * a1 は res.actions[0] の {id, pre} 複写 (第一手が無ければ null を明示。
 * main は v0.4.19 以降この対を局所完成後に r.lastPlan へ公開する)。
 * snap は { factStatus: 深い複写, state: 複写, chest, stationStatus, unknownFacts }。
 * 例外時は丸ごと {a1:null, snap:null}。
 */
export function buildP3Material(res, ev) {
  try {
    const a1raw = Array.isArray(res?.actions) ? res.actions[0] : null;
    const a1 = a1raw
      ? { id: typeof a1raw.id === "string" ? a1raw.id : null,
          pre: Array.isArray(a1raw.pre) ? a1raw.pre.map(p => ({ ...p })) : [] }
      : null;
    const fs = ev?.meta?.factStatus;
    const snap = {
      factStatus: isObj(fs) ? JSON.parse(JSON.stringify(fs)) : null,
      state: isObj(ev?.state) ? { ...ev.state } : null,
      // R-a (v0.4.21): gradePredicate の傍系材料を保持側でも運ぶ (判定側は変更なし)。
      // chest は下限性、stationStatus は station 第二チャネル、unknownFacts は unknown 先行判定に使う。
      chest: isObj(ev?.meta?.chest) ? JSON.parse(JSON.stringify(ev.meta.chest)) : (ev?.meta?.chest ?? null),
      stationStatus: isObj(ev?.meta?.stationStatus) ? { ...ev.meta.stationStatus } : null,
      unknownFacts: isObj(fs) ? Object.keys(fs).filter((k) => fs[k]?.status === "unknown") : [],
    };
    return { a1, snap };
  } catch { return { a1: null, snap: null }; }
}

function validPredValue(v) {
  try {
    return (typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean" || typeof v === "string";
  } catch { return false; }
}

function compareKnown(value, pred) {
  // known 値に対する比較。型が合わなければ null (= 解釈不能 -> UNKNOWN 側)。
  try {
    if (NUMERIC_OPS.has(pred.op)) {
      if (typeof value !== "number" || !Number.isFinite(value) || typeof pred.value !== "number") return null;
    }
    return satisfiesP3({ [pred.fact]: value }, pred);
  } catch { return null; }
}

// chest の下限性による格下げ (a14 §2.3)。snap に chest キーが有る場合だけ効く。
function chestDowngrades(snap, fact) {
  try {
    if (!fact.startsWith("chest.") || !has(snap, "chest")) return false;
    const c = snap.chest;
    if (c === null || c === undefined) return true;
    if (!isObj(c)) return false;
    return (typeof c.unobserved === "number" && c.unobserved > 0)
        || (typeof c.stale === "number" && c.stale > 0);
  } catch { return false; }
}

/**
 * 述語1件の三状態格付け。
 * -> { fact, op, value, outcome:"satisfied"|"unsatisfied"|"unknown", reason? }
 */
function gradePredicate(pred, snap) {
  const base = { fact: pred?.fact, op: pred?.op, value: pred?.value };
  try {
    const state = isObj(snap?.state) ? snap.state : null;
    const fs = isObj(snap?.factStatus) ? snap.factStatus : null;

    if (fs) {
      if (Array.isArray(snap?.unknownFacts) && snap.unknownFacts.includes(pred.fact))
        return { ...base, outcome: "unknown", reason: "pre_fact_unknown" };
      if (!has(fs, pred.fact)) {
        // factStatus が渡されている以上、エントリ無しは未確認 = UNKNOWN (a14 I3)。
        // state に値が残っていても出所不明として known 扱いしない。
        // station の第二チャネル併読 (a14 §2.4、stationStatus が有る場合だけ)
        if (pred.fact.startsWith("station.") && isObj(snap?.stationStatus)) {
          const item = pred.fact.slice("station.".length);
          const st = snap.stationStatus[item];
          if (st === "present" || st === "absent") {
            const cmp = compareKnown(st === "present", pred);
            if (cmp === null) return { ...base, outcome: "unknown", reason: "pre_value_type_unrecognized" };
            return { ...base, outcome: cmp ? "satisfied" : "unsatisfied" };
          }
        }
        return { ...base, outcome: "unknown", reason: "pre_fact_missing" };
      }
      const entry = fs[pred.fact];
      if (!isObj(entry)) return { ...base, outcome: "unknown", reason: "pre_fact_status_malformed" };
      if (entry.status === "unknown")
        return { ...base, outcome: "unknown", reason: typeof entry.reason === "string" ? entry.reason : "pre_fact_unknown" };
      if (entry.status !== "known")
        return { ...base, outcome: "unknown", reason: "pre_fact_status_unrecognized" };
      // known: snap.state との対整合 (state が有るのに食い違う対は信用しない、a14 §2.2-5)
      if (state) {
        if (!has(state, pred.fact) || state[pred.fact] !== entry.value)
          return { ...base, outcome: "unknown", reason: "snapshot_inconsistent" };
      }
      const cmp = compareKnown(entry.value, pred);
      if (cmp === null) return { ...base, outcome: "unknown", reason: "pre_value_type_unrecognized" };
      if (!cmp && chestDowngrades(snap, pred.fact))
        return { ...base, outcome: "unknown", reason: "chest_lower_bound_unproven" };
      return { ...base, outcome: cmp ? "satisfied" : "unsatisfied" };
    }

    // factStatus 無し: snap.state だけで格付け (欠落 = UNKNOWN)
    if (!state) return { ...base, outcome: "unknown", reason: "snapshot_missing" };
    if (!has(state, pred.fact)) return { ...base, outcome: "unknown", reason: "pre_fact_missing" };
    const cmp = compareKnown(state[pred.fact], pred);
    if (cmp === null) return { ...base, outcome: "unknown", reason: "pre_value_type_unrecognized" };
    if (!cmp && chestDowngrades(snap, pred.fact))
      return { ...base, outcome: "unknown", reason: "chest_lower_bound_unproven" };
    return { ...base, outcome: cmp ? "satisfied" : "unsatisfied" };
  } catch { return { ...base, outcome: "unknown", reason: "grade_internal_error" }; }
}

function snapHasUnknown(snap) {
  try {
    const fs = snap?.factStatus;
    if (!isObj(fs)) return null; // 証明材料が無い
    return Object.values(fs).some(e => e?.status === "unknown");
  } catch { return null; }
}

// ---------- 本体 ----------
/**
 * evaluateFirstStepP3(plan, extra?) -> { verdict, reason, firstStep, checks }
 * - verdict: "allow" | "deny" | "unknown"
 * - allow の意味は「計画時点 snap で第一手 a1.pre が known かつ充足」だけ (P5)。
 * - reason: 機械可読な安定コード。checks: 述語ごとの格付け (第一手が有る場合)。
 * 例外は投げない。KIND 対応表は持たない (pre に無い fact は前提にしない)。
 */
export function evaluateFirstStepP3(plan, extra) {
  try {
    // 直接形 (a1, snap) の正規化: 第一手 Action 本体そのものが渡された場合は
    // ok:true の1手計画として読み替える (契約テスト/ファズの呼出形)。
    if (isObj(plan) && Array.isArray(plan.pre) && typeof plan.id === "string" && !Array.isArray(plan.steps) && typeof plan.ok !== "boolean")
      plan = { ok: true, steps: [plan.id], a1: plan, snap: isObj(extra) && !isObj(extra.a1) && !isObj(extra.snap) ? extra : undefined };
    const rawSteps = normalizeSteps(plan);
    if (rawSteps === null) return { verdict: "unknown", reason: "plan_missing_or_malformed", firstStep: null, checks: [] };

    const steps = [];
    for (const s of rawSteps) {
      const str = stepToString(s);
      if (str === null) return { verdict: "unknown", reason: "step_malformed", firstStep: null, checks: [] };
      steps.push(str);
    }
    const firstStep = steps.length ? steps[0] : null;
    const ok = Array.isArray(plan) ? undefined : plan?.ok;
    const { a1, snap } = resolveMaterial(plan, extra);

    // --- 計画が失敗している場合 ---
    if (ok === false) {
      const planReason = (typeof plan?.reason === "string" && plan.reason) ? plan.reason : "NO_PLAN";
      const hasUnk = snapHasUnknown(snap);
      if (hasUnk === true) return { verdict: "unknown", reason: `plan_failed_with_unknown:${planReason}`, firstStep, checks: [] };
      if (hasUnk === false) return { verdict: "deny", reason: `plan_failed:${planReason}`, firstStep, checks: [] };
      return { verdict: "unknown", reason: `plan_failed_material_missing:${planReason}`, firstStep, checks: [] };
    }

    // --- 空計画 ---
    if (steps.length === 0) {
      if (ok === true) return { verdict: "allow", reason: "already_satisfied", firstStep: null, checks: [] };
      return { verdict: "unknown", reason: "empty_plan_no_verdict", firstStep: null, checks: [] };
    }

    // --- P3 材料の検証 (欠ければ推測で埋めず unknown) ---
    // pre 省略は goap の意味論で無条件 (空 pre と同義)。非配列は壊れた材料として unknown。
    if (a1 && typeof a1.id === "string" && a1.pre === undefined) a1 = { ...a1, pre: [] };
    if (!a1 || typeof a1.id !== "string" || !a1.id || !Array.isArray(a1.pre))
      return { verdict: "unknown", reason: "p3_material_missing:a1_pre", firstStep, checks: [] };
    if (a1.id !== firstStep)
      return { verdict: "unknown", reason: "p3_material_mismatch:a1_id", firstStep, checks: [] };
    if (!isObj(snap) || (!isObj(snap.state) && !isObj(snap.factStatus)))
      return { verdict: "unknown", reason: "p3_material_missing:snap", firstStep, checks: [] };
    if (has(snap, "at") && has(plan, "at") && snap.at !== plan.at)
      return { verdict: "unknown", reason: "p3_material_mismatch:snap_at", firstStep, checks: [] };

    for (const p of a1.pre) {
      if (!isObj(p) || typeof p.fact !== "string" || !p.fact || !OPS.has(p.op) || !validPredValue(p.value))
        return { verdict: "unknown", reason: "pre_malformed", firstStep, checks: [] };
    }

    // --- applicable の三状態再確認 ---
    // 二値の applicableP3(snap.state, a1) と一致するのは全件 known の場合だけ。
    // unknown が混ざる場合は applicable の false を deny と読まず格付けで切り分ける。
    const checks = a1.pre.map(p => gradePredicate(p, snap));
    const firstUnsat = checks.find(c => c.outcome === "unsatisfied");
    if (firstUnsat)
      return { verdict: "deny", reason: `precondition_unsatisfied_known:${firstUnsat.fact}`, firstStep, checks };
    const firstUnk = checks.find(c => c.outcome === "unknown");
    if (firstUnk)
      return { verdict: "unknown", reason: `first_step_precondition_unknown:${firstUnk.fact}`, firstStep, checks };
    return { verdict: "allow", reason: "first_step_pre_known_satisfied", firstStep, checks };
  } catch {
    return { verdict: "unknown", reason: "gate_internal_error", firstStep: null, checks: [] };
  }
}

