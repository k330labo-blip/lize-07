// goap_revalidate.js — Phase3 S1b P4 (v0.4.20, cycle1217; v0.4.21 F5/F7是正): 採用時同一性再検証
// 純粋関数 revalidateP4(lastPlan, currentGoalKey, now)
//   -> { verdict, reason, firstStep, checks }
// - verdict は "allow" | "unknown" のみ。deny は出さない (前提の known な
//   不成立の判定は P3 evaluateFirstStepP3 の領分。本関数は同一性・鮮度・
//   材料整合だけを見て、証明できなければ全て unknown に倒す)。
// - allow の意味は「この計画は採用時点の現在 Goal に対する計画のまま」
//   だけであり、第一手 pre の充足・実行成功・完遂は保証しない (P5)。
// - 契約: 入力を変更しない / 例外を絶対に投げない / c.x・ctx を読まない /
//   Date.now() を呼ばない (時刻は引数 now が唯一の材料。決定性のため)。
// - decide の p 意味論・effMove.id 接頭辞には触れない。

export const P4_FRESH_MS = 6000; // a09 G3: 影の間引き 5000ms + 余裕 1000ms

const GOAL_KEY_INVALID = "goal:invalid"; // goal_pred.js goalKey() の不正形

const isObj = (v) => {
  try { return v !== null && typeof v === "object" && !Array.isArray(v); }
  catch { return false; }
};
const isFiniteNum = (v) => {
  try { return typeof v === "number" && Number.isFinite(v); } catch { return false; }
};
const isGoalKey = (v) => {
  // F5 (v0.4.21): goal_pred.js goalKey() の正規形は "goal:" 接頭辞を持つ。接頭辞を要求し、
  // 両辺が同じゴミ文字列でも allow になる経路を閉じる (cycle1230-p4audit F5)。
  try { return typeof v === "string" && v.startsWith("goal:") && v.length > 5 && v !== GOAL_KEY_INVALID; }
  catch { return false; }
};

const unknownP4 = (reason, firstStep, checks) => ({
  verdict: "unknown",
  reason,
  firstStep: firstStep ?? null,
  checks: checks ?? {
    planOk: false, goalMatch: false, fresh: false,
    firstStepMatch: false, snapMatch: false,
  },
});

export function revalidateP4(lastPlan, currentGoalKey, now) {
  try {
    const checks = {
      planOk: false, goalMatch: false, fresh: false,
      firstStepMatch: false, snapMatch: false,
    };
    if (!isFiniteNum(now)) return unknownP4("p4_now_invalid", null, checks);
    if (!isObj(lastPlan)) return unknownP4("p4_input_malformed", null, checks);
    // F7 (v0.4.21): steps/snap は冒頭で1回だけ読む (揮発性 getter での検査/返値のずれを防ぐ)
    const stepsArr = lastPlan?.steps;
    const snapObj = lastPlan?.snap;
    const firstStep =
      (Array.isArray(stepsArr) && typeof stepsArr?.[0] === "string"
        && stepsArr[0].length > 0)
        ? stepsArr[0]
        : null;
    // C1: 計画が成功形であること
    if (lastPlan?.ok !== true || lastPlan?.reason != null)
      return unknownP4("p4_plan_not_ok", firstStep, checks);
    checks.planOk = true;
    // C2: Goal 同一性 (厳密一致のみ、正規化しない)
    const planGoalKey = lastPlan?.goalKey;
    if (!isGoalKey(planGoalKey) || !isGoalKey(currentGoalKey))
      return unknownP4("p4_goal_key_missing", firstStep, checks);
    if (planGoalKey !== currentGoalKey)
      return unknownP4("p4_goal_mismatch", firstStep, checks);
    checks.goalMatch = true;
    // C3: 鮮度 (未来時刻は新鮮と証明できない)
    const at = lastPlan?.at;
    if (!isFiniteNum(at)) return unknownP4("p4_at_missing", firstStep, checks);
    const age = now - at;
    if (age < 0) return unknownP4("p4_clock_skew", firstStep, checks);
    if (age > P4_FRESH_MS) return unknownP4("p4_stale", firstStep, checks);
    checks.fresh = true;
    // C4: 第一手と a1 の対同一性 (2手目以降は読まない)
    if (firstStep === null)
      return unknownP4("p4_first_step_missing", null, checks);
    if (lastPlan?.a1?.id !== firstStep)
      return unknownP4("p4_first_step_mismatch", firstStep, checks);
    checks.firstStepMatch = true;
    // C5: snap の対同一性
    if (!isObj(snapObj) || snapObj?.at !== at)
      return unknownP4("p4_snap_mismatch", firstStep, checks);
    checks.snapMatch = true;
    return { verdict: "allow", reason: "p4_identity_preserved", firstStep, checks };
  } catch {
    return unknownP4("p4_internal_error", null, null);
  }
}
