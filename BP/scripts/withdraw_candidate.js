// withdraw_candidate.js — Phase3 candKey B1 (v0.4.26, cycle1436): WITHDRAW候補選定の純粋関数群
// 設計原典: brain_parts/solutions/cycle1416-a03-candkey-b-shared/DESIGN.md §4/§5/§7-B1
// 候補選定・キー化・材料検証・第一手射影を main/mission から切り出した単一の正。
// mission.js は withdrawKeyOf を本モジュールから再輸出し、main.js の
// buildWithdrawCandidate は snapshot を組むアダプタ、採用tick の射影は candKeyForFirstStep。
// 純粋性契約 (a03 §5): Date.now()/Math.random()/外部状態を読まない、
//   入力を変更しない、全 export は例外を投げず失敗は null/false。
// B1 同値性: 選定 filter は現行どおり c.x の型のみ (y/z 検証は追加しない、
//   a03 §6 D2)。同距離タイブレークは現行どおり入力順保持 (安定ソート、
//   a04 SPEC §3.4 の t/座標キー明示化は B1 では入れない)。K3 は対象外 (D1-b)。

/** item 適格 (現行 buildWithdrawCandidate の item guard と同値)。 */
export const WITHDRAW_CONTENTS_FRESH_MS = 300000;
function _freshMsOrDefault(f){return (typeof f==="number"&&Number.isFinite(f)&&f>=0)?f:WITHDRAW_CONTENTS_FRESH_MS;}
export function isKnownAbsent(c,item,now,freshMs){try{if(!c||typeof c!=="object")return false;const ct=c.ct,contents=c.contents;if(typeof ct!=="number"||!Number.isFinite(ct))return false;if(typeof now!=="number"||!Number.isFinite(now))return false;const fm=_freshMsOrDefault(freshMs);if(now-ct<0||now-ct>fm)return false;if(!contents||typeof contents!=="object"||Array.isArray(contents))return false;return !(contents[item]>0);}catch{return false;}}
export function isWithdrawItemEligible(item, logBlockIds) {
  try {
    if (typeof item !== "string" || !item.includes(":")) return false;
    const tail = item.split(":").pop();
    if (tail === "log" || (typeof tail === "string" && tail.endsWith("_log"))) {
      const listed = Array.isArray(logBlockIds) ? logBlockIds.includes(item)
        : (logBlockIds instanceof Set ? logBlockIds.has(item) : false);
      if (!listed) return false; // 合算原木 (樹種不定) は対象外
    }
    return true;
  } catch { return false; }
}

/** キー生成の正 (mission.js withdrawKeyOf の式を一字も変えない移設)。 */
export function withdrawKeyOf(stepIndex, cand) {
  try {
    if (!cand) return null;
    // 材料は1回だけ読み切る (a03 §5-3: getter の検査/返値ずれ防止)
    const dim = cand.dim, x = cand.x, y = cand.y, z = cand.z, item = cand.item;
    return `${stepIndex}:${dim || ""}:${x},${y},${z}:${item}`;
  } catch { return null; }
}

/** キー化してよい材料か (Phase A L1450 guard の検証部、a03 §4)。 */
export function isValidCandMaterial(stepIndex, cand) {
  try {
    if (typeof stepIndex !== "number" || !Number.isFinite(stepIndex)) return false;
    if (!cand || typeof cand !== "object") return false;
    const x = cand.x, y = cand.y, z = cand.z, dim = cand.dim, item = cand.item;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
    if (typeof dim !== "string" || !dim) return false;
    if (typeof item !== "string" || !item) return false;
    return true;
  } catch { return false; }
}

/**
 * 候補選定 (現行 buildWithdrawCandidate の意味論を入力化したもの)。
 * input: { stepType, detour, blockedStatus, need, have, now, cooldownUntil,
 *          item, logBlockIds, containers, selfPos, dim, blockedKeys, stepIndex }
 * @returns {{x,y,z,dim,item}|null} 理由は区別しない (現行同値、a03 §4 補足)。
 */
export function selectWithdrawCandidate(input) {
  try {
    // 入力は冒頭で1回だけ読み切る
    const stepType = input?.stepType, detour = input?.detour,
      blockedStatus = input?.blockedStatus,
      need = input?.need, have = input?.have,
      now = input?.now, cooldownUntil = input?.cooldownUntil,
      item = input?.item, logBlockIds = input?.logBlockIds,
      containers = input?.containers, selfPos = input?.selfPos,
      dim = input?.dim, blockedKeys = input?.blockedKeys,
      stepIndex = input?.stepIndex;
    if (stepType !== "gather_block" && stepType !== "side_collect") return null;
    if (detour) return null;
    if (blockedStatus === "critical_hp") return null;
    if ((need || 0) - (have || 0) <= 0) return null;
    if (now < (cooldownUntil || 0)) return null;
    if (!isWithdrawItemEligible(item, logBlockIds)) return null;
    if (!Array.isArray(containers) || !containers.length) return null;
    const sx = selfPos?.x, sy = selfPos?.y, sz = selfPos?.z;
    const blockedHas = blockedKeys instanceof Set
      ? (k) => blockedKeys.has(k)
      : (Array.isArray(blockedKeys) ? (k) => blockedKeys.includes(k) : () => false);
    // filter の返却配列を sort する (入力配列は変更しない)。安定ソートで
    // 同距離は入力順 (= knownContainers の t 降順) を保持 (現行同値)。
    const sorted = containers
      .filter((c) => c && typeof c.x === "number" && !c.full && !isKnownAbsent(c, item, now, input?.contentsFreshMs))
      .sort((a, b) => Math.hypot(sx - a.x, sy - a.y, sz - a.z) - Math.hypot(sx - b.x, sy - b.y, sz - b.z));
    for (const c of sorted) {
      const cand = { x: c.x, y: c.y, z: c.z, dim, item };
      // blocked 照合は K2 手組みでなく withdrawKeyOf で作る (a03 §7 B1-3)
      if (blockedHas(withdrawKeyOf(stepIndex, cand))) continue;
      return cand;
    }
    return null;
  } catch { return null; }
}

/**
 * 第一手 → candKey 射影 (a03 §4、計画側・採用側共通)。
 * args: { firstStep, stepTarget, stepIndex, cand }
 * 非 WITHDRAW / 中間材料 (item 不一致) / 候補なし / 材料不正は全て明示 null
 * (CK15-26: 非 WITHDRAW で cand が実在しても null)。
 */
export function candKeyForFirstStep(args) {
  try {
    const firstStep = args?.firstStep, stepTarget = args?.stepTarget,
      stepIndex = args?.stepIndex, cand = args?.cand;
    if (typeof firstStep !== "string" || !firstStep.startsWith("WITHDRAW:")) return null;
    // NQ-03 ステップ3 (v0.4.38, a02 F2): 保持者サフィックス @h<n>#<k> は item 比較の
    // 前に剥がす。candKey 自体は座標ベースの従来形のまま (別名は評価ごとに付け直さ
    // れるため永続キーにはしない)。異形サフィックスは剥がさず不一致として null。
    let stepItem = firstStep.slice("WITHDRAW:".length);
    const mSfx = /^(.*?)(?:@h(?:0|[1-9]\d*))?(?:#[1-9]\d*)?$/.exec(stepItem ?? "");
    if (mSfx && mSfx[1]) stepItem = mSfx[1];
    if (!stepItem || stepItem !== stepTarget) return null;
    if (!cand || cand.item !== stepItem) return null;
    if (!isValidCandMaterial(stepIndex, cand)) return null;
    return withdrawKeyOf(stepIndex, cand);
  } catch { return null; }
}

