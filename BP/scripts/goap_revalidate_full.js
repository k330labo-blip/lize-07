// goap_revalidate_full.js — Phase3 S1b P4 拡張 (v0.4.22, cycle1301 A06): 採用時同一性再検証・全項目版
// 純粋関数 revalidateFull(lastPlan, currentGoalKey, now, opts)
//   -> { verdict, reason, firstStep, checks }
// v0.4.22 で BP へ統合。呼び出しは記録専用 (main の影評価・採用tick記録)。読み手化は S1b 解禁後。
//
// ■ 既存 revalidateP4 (BP/scripts/goap_revalidate.js) の契約を継承する:
// - verdict は "allow" | "unknown" のみ。deny は出さない (前提の known な不成立の
//   判定は P3 evaluateFirstStepP3 の領分。本関数は同一性・鮮度・材料整合だけを
//   見て、証明できなければ全て unknown に倒す)。
// - allow の意味は「この計画は採用時点の現在 Goal に対する計画のまま」だけであり、
//   第一手 pre の充足・実行成功・完遂は保証しない (P5)。
// - 入力を変更しない / 例外を絶対に投げない / c.x・ctx を読まない /
//   Date.now() を呼ばない (時刻は引数 now が唯一の材料。決定性のため)。
// - decide の p 意味論・effMove.id 接頭辞 (mood_/fb_/compiled_matrix) には触れない。
// - 基本5チェック (planOk/goalMatch/fresh/firstStepMatch/snapMatch) の判定順序・
//   reason (p4_*) は現行 goap_revalidate.js と同一。F5 (goalKey は "goal:" 接頭辞を
//   要求) と F7 (steps/snap は冒頭で1回だけ読む) も現行どおり取り込む。
//
// ■ 拡張 (a06_s1b_p4_design §4 の G3/G5/G7 を opts 経由で足す):
// 基本5チェックを全て通過した計画についてのみ、追加4チェックを順に判定する。
// 追加チェックは全て必須ゲートであり、1つでも証明できなければ unknown。
// 特に opts が欠落・非オブジェクトの場合、追加4チェックは全て false となり
// allow にはならない (材料が無い同一性・安全性は証明できない、という fail-closed)。
//
// opts の形 (呼び出し側が採用時点で組み立てる現在値の射影。新規観測は作らない):
// {
//   sig: string,          // 現在の sig。計画側 lastPlan.sig と同じ生成式
//                         // (`${m.id}:${m.currentStep}:${step.target}:${step.need}`) で作り直したもの
//   needRemain: number,   // 現在の不足数 Math.max(0, step.need - step.have)。計画側 lastPlan.needRemain と照合
//   stepTarget: string,   // 現在の step.target (R4, v0.4.40)。範囲判定の材料。
//                         // 計画へ保存して読み戻す自己複写は禁止 (恒真式化する)。
//   candKey: string|null, // 現在の WITHDRAW 候補キー (withdrawKeyOf 由来)。
//                         // 第一手が WITHDRAW でない計画では「候補は適用外」を
//                         // 明示する null を渡すこと (下記 candMatch の規則)
//   safety: {             // 現在の安全/三状態の射影 (既存 obs の写し)
//     missionActive: boolean,   // === true が必要
//     stepType: string,         // === "gather_block" が必要 (a06 R7)
//     detour: boolean,          // === false が必要 (寄り道中でないことの明示)
//     mineLeg: boolean,         // === false が必要
//     invKnown: boolean,        // === true が必要 (在庫が known)
//     invFull: boolean,         // === false が必要 (満杯でないことの明示)
//     selfHpPct: number,        // 有限数かつ >= 0.25 (mission.js CRITICAL_HP と同値)
//     targetKnown: boolean,     // === true が必要 (=== false は凍結優位で不許可, a06 R8)
//     foundTarget: boolean,     // === false が必要 (発見済みなら従来経路の領分)
//     withdrawBlocked: string[],// 任意。渡す場合は配列であり、candKey を含まないこと
//     cooldownUntil: number,    // 任意。渡す場合は有限数であり now >= cooldownUntil のこと
//   },
// }
//
// 追加チェックの規則:
// - sigMatch:     lastPlan.sig と opts.sig が共に空でない文字列で厳密一致 (正規化しない)。
//                 材料欠落/型不正は p4full_sig_missing、食い違いは p4full_sig_mismatch。
// - needRemainOk: lastPlan.needRemain と opts.needRemain が共に有限数 (>=0) で厳密一致。
//                 許容誤差は設けない (a06 R3)。欠落/型不正は p4full_need_missing、
//                 食い違いは p4full_need_mismatch。
// - candMatch:    第一手が "WITHDRAW:" で始まる場合のみ候補同一性を要求する (a06 R5):
//                 lastPlan.candKey と opts.candKey が共に空でない文字列で厳密一致。
//                 どちらか null/欠落は p4full_cand_missing、食い違いは p4full_cand_mismatch。
//                 第一手が WITHDRAW 以外の場合、候補は適用外であり、
//                 lastPlan.candKey === null かつ opts.candKey === null の
//                 「両側とも明示 null」のときだけ true とする。opts 自体が欠落して
//                 明示 null を確認できない場合は false のまま allow にしない。
// - safetyOk:     opts.safety がオブジェクトで上表の全条件を満たすときだけ true。
//                 safety 自体の欠落/非オブジェクトは p4full_safety_missing、
//                 条件を1つでも満たさない場合は p4full_unsafe_or_unknown。
//                 「フィールドが無いから多分大丈夫」という推定はしない (三状態の
//                 UNKNOWN を安全へ潰さない、Phase1 の原則の P4 における対応物)。

import { parseStep } from "./goap_exec.js"; // R4 (v0.4.40): 範囲判定の parse は既存の単一の正を使う (Full 内に第3の正規表現を作らない)

export const P4_FRESH_MS = 6000; // goap_revalidate.js と同値 (a09 G3: 間引き 5000ms + 余裕 1000ms)
export const P4FULL_MIN_HP_PCT = 0.25; // mission.js CRITICAL_HP と同値 (a06 R7)

const GOAL_KEY_INVALID = "goal:invalid"; // goal_pred.js goalKey() の不正形

const isObj = (v) => {
  try { return v !== null && typeof v === "object" && !Array.isArray(v); }
  catch { return false; }
};
const isFiniteNum = (v) => {
  try { return typeof v === "number" && Number.isFinite(v); } catch { return false; }
};
const isNonNegNum = (v) => {
  try { return isFiniteNum(v) && v >= 0; } catch { return false; }
};
const isGoalKey = (v) => {
  // F5: goal_pred.js goalKey() の正規形は "goal:" 接頭辞を持つ
  try { return typeof v === "string" && v.startsWith("goal:") && v.length > 5 && v !== GOAL_KEY_INVALID; }
  catch { return false; }
};
const isNonEmptyStr = (v) => {
  try { return typeof v === "string" && v.length > 0; } catch { return false; }
};

const emptyChecks = () => ({
  planOk: false, goalMatch: false, fresh: false,
  firstStepMatch: false, snapMatch: false,
  sigMatch: false, needRemainOk: false, candMatch: false, scopeOk: false, safetyOk: false,
});

const unknownFull = (reason, firstStep, checks) => ({
  verdict: "unknown",
  reason,
  firstStep: firstStep ?? null,
  checks: checks ?? emptyChecks(),
});

export function revalidateFull(lastPlan, currentGoalKey, now, opts) {
  try {
    const checks = emptyChecks();
    if (!isFiniteNum(now)) return unknownFull("p4_now_invalid", null, checks);
    if (!isObj(lastPlan)) return unknownFull("p4_input_malformed", null, checks);
    // F7: 揮発性 getter での検査/返値のずれを防ぐため、材料は冒頭で1回だけ読む
    const stepsArr = lastPlan?.steps;
    const snapObj = lastPlan?.snap;
    const planSig = lastPlan?.sig;
    const planNeedRemain = lastPlan?.needRemain;
    const planCandKey = lastPlan?.candKey;
    const optsObj = isObj(opts) ? opts : null;
    const curSig = optsObj ? optsObj?.sig : undefined;
    const curNeedRemain = optsObj ? optsObj?.needRemain : undefined;
    const curCandKey = optsObj ? optsObj?.candKey : undefined;
    const curStepTarget = optsObj ? optsObj?.stepTarget : undefined;
    const safetyObj = optsObj && isObj(optsObj?.safety) ? optsObj.safety : null;
    const firstStep =
      (Array.isArray(stepsArr) && typeof stepsArr?.[0] === "string"
        && stepsArr[0].length > 0)
        ? stepsArr[0]
        : null;
    // C1: 計画が成功形であること (現行 revalidateP4 と同一)
    if (lastPlan?.ok !== true || lastPlan?.reason != null)
      return unknownFull("p4_plan_not_ok", firstStep, checks);
    checks.planOk = true;
    // C2: Goal 同一性 (厳密一致のみ、正規化しない)
    const planGoalKey = lastPlan?.goalKey;
    if (!isGoalKey(planGoalKey) || !isGoalKey(currentGoalKey))
      return unknownFull("p4_goal_key_missing", firstStep, checks);
    if (planGoalKey !== currentGoalKey)
      return unknownFull("p4_goal_mismatch", firstStep, checks);
    checks.goalMatch = true;
    // C3: 鮮度 (未来時刻は新鮮と証明できない)
    const at = lastPlan?.at;
    if (!isFiniteNum(at)) return unknownFull("p4_at_missing", firstStep, checks);
    const age = now - at;
    if (age < 0) return unknownFull("p4_clock_skew", firstStep, checks);
    if (age > P4_FRESH_MS) return unknownFull("p4_stale", firstStep, checks);
    checks.fresh = true;
    // C4: 第一手と a1 の対同一性 (2手目以降は読まない)
    if (firstStep === null)
      return unknownFull("p4_first_step_missing", null, checks);
    if (lastPlan?.a1?.id !== firstStep)
      return unknownFull("p4_first_step_mismatch", firstStep, checks);
    checks.firstStepMatch = true;
    // C5: snap の対同一性
    if (!isObj(snapObj) || snapObj?.at !== at)
      return unknownFull("p4_snap_mismatch", firstStep, checks);
    checks.snapMatch = true;
    // C6: sig 同一性 (G3)。opts 欠落時は材料なしとして倒す
    if (!isNonEmptyStr(planSig) || !isNonEmptyStr(curSig))
      return unknownFull("p4full_sig_missing", firstStep, checks);
    if (planSig !== curSig)
      return unknownFull("p4full_sig_mismatch", firstStep, checks);
    checks.sigMatch = true;
    // C7: needRemain 同一性 (G3)。許容誤差なし
    if (!isNonNegNum(planNeedRemain) || !isNonNegNum(curNeedRemain))
      return unknownFull("p4full_need_missing", firstStep, checks);
    if (planNeedRemain !== curNeedRemain)
      return unknownFull("p4full_need_mismatch", firstStep, checks);
    checks.needRemainOk = true;
    // C8: 候補同一性 (G5)。WITHDRAW 第一手でのみ文字列照合、それ以外は両側明示 null
    if (firstStep.startsWith("WITHDRAW:")) {
      if (!isNonEmptyStr(planCandKey) || !isNonEmptyStr(curCandKey))
        return unknownFull("p4full_cand_missing", firstStep, checks);
      if (planCandKey !== curCandKey)
        return unknownFull("p4full_cand_mismatch", firstStep, checks);
    } else if (planCandKey !== null || curCandKey !== null) {
      // 適用外の明示 (両側 null) が確認できない。opts 欠落 (curCandKey=undefined) もここで倒れる
      return unknownFull("p4full_cand_missing", firstStep, checks);
    }
    checks.candMatch = true;
    // C8b: 範囲 (R4, v0.4.40)。S1b 初段の範囲は「parseStep 正規化で WITHDRAW かつ
    // item が現在の step.target と一致する第一手 (保持者変種 @h<n>#<k> を含む)」だけ。
    // 文字列完全一致では保持者変種が全件落ちるため使わない。stepTarget 自体に
    // サフィックスが混入した材料は範囲を証明できない (a02 U06 対策)。
    // 不合格・材料欠落は全て unknown + first_step_out_of_scope (deny は出さない)。
    const parsedFirst = parseStep(firstStep);
    const scopeOk = isNonEmptyStr(curStepTarget)
      && !curStepTarget.includes("@") && !curStepTarget.includes("#")
      && parsedFirst !== null && parsedFirst.kind === "WITHDRAW"
      && parsedFirst.item === curStepTarget;
    if (!scopeOk)
      return unknownFull("first_step_out_of_scope", firstStep, checks);
    checks.scopeOk = true;
    // C9: 安全/三状態 (G7)。全フィールドが明示的に安全側であることだけを許可する
    if (safetyObj === null)
      return unknownFull("p4full_safety_missing", firstStep, checks);
    const blocked = safetyObj?.withdrawBlocked;
    const cooldownUntil = safetyObj?.cooldownUntil;
    const safetyOk =
      safetyObj?.missionActive === true
      && safetyObj?.stepType === "gather_block"
      && safetyObj?.detour === false
      && safetyObj?.mineLeg === false
      && safetyObj?.invKnown === true
      && safetyObj?.invFull === false
      && isFiniteNum(safetyObj?.selfHpPct) && safetyObj.selfHpPct >= P4FULL_MIN_HP_PCT
      && safetyObj?.targetKnown === true // === false は凍結優位 (a06 R8)
      && safetyObj?.foundTarget === false
      && (blocked === undefined
        || (Array.isArray(blocked) && !(isNonEmptyStr(curCandKey) && blocked.includes(curCandKey))))
      && (cooldownUntil === undefined
        || (isFiniteNum(cooldownUntil) && now >= cooldownUntil));
    if (!safetyOk)
      return unknownFull("p4full_unsafe_or_unknown", firstStep, checks);
    checks.safetyOk = true;
    return { verdict: "allow", reason: "p4full_identity_preserved", firstStep, checks };
  } catch {
    return unknownFull("p4full_internal_error", null, null);
  }
}
