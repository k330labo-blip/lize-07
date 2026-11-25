// goap_unified.js — Phase3 S1b P5 合成レコード (v0.4.21, cycle1230-p5 §3.4 の記録専用先行導入)
// 純粋関数 buildUnifiedRecord(gateP3, revalP4(基本版), planAt)
//   -> { p3:{verdict,reason,firstStep}, p4:{verdict,reason,firstStep}, conjunction, scope, at } | null
// - 合成は複写のみ。再計算しない (P3/P4 本体と二重の正を作らない)。
// - conjunction は両段 allow のときだけ "allow"。フィールド名を verdict にしない:
//   読み手が(廃止済みの)旧第一手ゲートと同じ感覚で分岐に使う事故を構造的に防ぐ。
// - conjunction が "allow" でも意味は「第一手 pre の known 充足 (P3)」と
//   「計画の同一性保持 (P4)」の並記までであり、実行成功・完遂は保証しない。
//   P4 拡張 (Full) は実装済み (v0.4.22)。本モジュールの計画時点合成は基本版 P4 を
//   材料とし、採用 tick 合成は buildAdoptUnifiedRecord が担う。いずれも記録専用で、
//   読み手化は解禁後の別版とする (本モジュールは記録のみ、分岐・実行には使わない)。
// - 材料が壊れている場合は null (stale 誤読防止の既存作法どおり)。
// - 契約: 入力を変更しない / 例外を絶対に投げない / Date.now() を呼ばない。

const isObj = (v) => {
  try { return v !== null && typeof v === "object" && !Array.isArray(v); }
  catch { return false; }
};
const copyRec = (r) => {
  try {
    if (!isObj(r) || typeof r.verdict !== "string" || !r.verdict) return null;
    return { verdict: r.verdict, reason: typeof r.reason === "string" ? r.reason : null, firstStep: r.firstStep ?? null };
  } catch { return null; }
};

export function buildUnifiedRecord(gateP3, revalP4, planAt) {
  try {
    if (typeof planAt !== "number" || !Number.isFinite(planAt)) return null;
    const p3 = copyRec(gateP3);
    const p4 = copyRec(revalP4);
    if (!p3 || !p4) return null;
    const conjunction = (p3.verdict === "allow" && p4.verdict === "allow") ? "allow" : "not_allow";
    return { p3, p4, conjunction, scope: "first_step_pre_and_identity", at: planAt };
  } catch { return null; }
}

// Phase3 S1b SYN-1 (v0.4.45, cycle1916-a07 / cycle1929-a01): 採用 tick 合成レコード (記録専用)
// 純粋関数 buildAdoptUnifiedRecord(gateP3Rec, fullAdoptRec, planAt)
//   -> { p3:{verdict,reason,firstStep}, full:{verdict,reason,firstStep}, conjunction, scope, at, adoptAt } | null
// - 合成相手は採用 tick の Full (r.lastPlanRevalFullAdopt) のみ。計画時点の Full
//   (r.lastPlanRevalFull) は生成直後の自己整合であり、取り違えると自己充足になる。
// - 合成は複写と対同一性のみ。再判定しない (判定の正は P3 と Full の2か所に保つ)。
// - 対同一性: gateP3Rec.at === planAt でなければ null (別計画の P3 との取り違え)。
//   fullAdoptRec.at が有限数でなく planAt 未満でも null。
//   第一手は両段とも空でない文字列で厳密一致しなければ conjunction は "not_allow"
//   (計画時点合成にあった firstStep 不一致でも allow になる穴の合成側対処)。
// - conjunction が "allow" でも意味は「第一手 pre の計画時点での known 充足 (P3)」と
//   「計画の同一性・範囲・安全の採用 tick 保持 (Full)」の並記まで。pre は採用時点で
//   再検証されない非対称を scope で正直に表す。実行成功・完遂は保証しない。
// - 契約は buildUnifiedRecord と同一: 入力を変更しない / 例外を投げない / Date.now() を呼ばない。
export function buildAdoptUnifiedRecord(gateP3Rec, fullAdoptRec, planAt) {
  try {
    if (typeof planAt !== "number" || !Number.isFinite(planAt)) return null;
    const p3 = copyRec(gateP3Rec);
    const full = copyRec(fullAdoptRec);
    if (!p3 || !full) return null;
    if (gateP3Rec.at !== planAt) return null;
    const adoptAt = fullAdoptRec.at;
    if (typeof adoptAt !== "number" || !Number.isFinite(adoptAt) || adoptAt < planAt) return null;
    const stepOk = typeof p3.firstStep === "string" && p3.firstStep.length > 0
      && typeof full.firstStep === "string" && full.firstStep.length > 0
      && p3.firstStep === full.firstStep;
    const conjunction = (stepOk && p3.verdict === "allow" && full.verdict === "allow") ? "allow" : "not_allow";
    return { p3, full, conjunction, scope: "first_step_pre_at_plan_time_and_identity_full_at_adoption_tick", at: planAt, adoptAt };
  } catch { return null; }
}
