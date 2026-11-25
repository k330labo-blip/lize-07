// edgepeek_math.js — 段差を降りる直前に足元を一度だけ覗き込む「覗き込み視線」
// POLISH-ANIM-EDGEPEEK-01 (純粋核, cycle1518-a08 ドラフトを統合)
// 出典 (仕様の正): brain_parts/solutions/cycle1503-a08/PROPOSAL.md §3.1/§3.3/§4
// 先行核の作法に倣う: threshold_math.js / heed_math.js
//   - @minecraft/server を import しない。相対 import も持たない (自己完結)。
//   - 例外を投げない。現在時刻を持たない (時刻は引数で受ける)。
//   - 状態は呼び出し側が保持する (本核は生成器と薄い更新関数のみを提供)。
//   - 統合時は BP/scripts/edgepeek_math.js へ移す。
//
// 表示層のみ: 降下の可否・経路・移動の判定には一切使わない。ヨーには触らない。
// 音・表情・セリフ・名札表示は足さない。新規ボーン・スキン/ジオメトリ変更は不要。
//
// 仕様 (PROPOSAL §3.1 の固定値):
// - ピッチ +26 度、全体 0.65 秒の単一山形: 入り 0.25 秒・保持 0.15 秒・戻り 0.25 秒。
//   期間外は完全な 0 を返す (出口がある)。
// - 発火は「進行方向 1 セル先の落差 dropDepth が 2〜4 マスの範囲へ入った辺」でのみ。
//   1 マスは日常の起伏として無視し、5 マス以上は落下経路側の管轄として扱わない。
// - 同じ段差の連続観測では発火は 1 回だけ (辺で扱う)。冷却 7 秒。
// - 冷却中・抑制中に起きた辺も消費し、後から条件が揃っても遅れて発火しない。
// - 抑制: 戦闘中 / 掘削・攻撃・設置の作業中 / 既に落下中 / 水中 / 登攀中 /
//   ホバー飛行中 / FLINCH 発火中 / 潜行・螺旋階段など意図的な縦方向の降下中。

export const EDGEPEEK_PITCH_DEG = 26;       // PROPOSAL §3.1
export const EDGEPEEK_DURATION_MS = 650;    // 全体 0.65 秒
export const EDGEPEEK_RAMP_IN_MS = 250;     // 入り 0.25 秒
export const EDGEPEEK_HOLD_MS = 150;        // 保持 0.15 秒 (250〜400ms)
export const EDGEPEEK_RAMP_OUT_MS = 250;    // 戻り 0.25 秒 (400〜650ms)
export const EDGEPEEK_COOLDOWN_MS = 7000;   // 冷却 7 秒
export const EDGEPEEK_MIN_DROP = 2;         // 落差の下限 (マス)
export const EDGEPEEK_MAX_DROP = 4;         // 落差の上限 (マス)

export const EDGEPEEK_CONSTANTS = Object.freeze({
  PITCH_DEG: EDGEPEEK_PITCH_DEG,
  DURATION_MS: EDGEPEEK_DURATION_MS,
  RAMP_IN_MS: EDGEPEEK_RAMP_IN_MS,
  HOLD_MS: EDGEPEEK_HOLD_MS,
  RAMP_OUT_MS: EDGEPEEK_RAMP_OUT_MS,
  COOLDOWN_MS: EDGEPEEK_COOLDOWN_MS,
  MIN_DROP: EDGEPEEK_MIN_DROP,
  MAX_DROP: EDGEPEEK_MAX_DROP,
});

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// isEdgepeekDropInRange(dropDepth) -> boolean
// 有限数で MIN_DROP <= dropDepth <= MAX_DROP のときだけ true。
// 非数・NaN・無限大は範囲外 (発火しない・辺にもならない)。
export function isEdgepeekDropInRange(dropDepth) {
  try {
    const d = finiteOrNull(dropDepth);
    if (d === null) return false;
    return d >= EDGEPEEK_MIN_DROP && d <= EDGEPEEK_MAX_DROP;
  } catch { return false; }
}

// edgepeekEnvelope(elapsedMs) -> 0..1 の包絡 | 範囲外・無効入力は 0
// 波形: 0〜250ms は sin で寄せ (0→1)、250〜400ms は保持 (1)、
// 400〜650ms は cos で復帰 (1→0)。t=0 と t>=650 は厳密に 0 (出口がある)。
export function edgepeekEnvelope(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= EDGEPEEK_DURATION_MS) return 0;
    if (e < EDGEPEEK_RAMP_IN_MS) return Math.sin((e / EDGEPEEK_RAMP_IN_MS) * Math.PI / 2);
    if (e < EDGEPEEK_RAMP_IN_MS + EDGEPEEK_HOLD_MS) return 1;
    const t = (e - EDGEPEEK_RAMP_IN_MS - EDGEPEEK_HOLD_MS) / EDGEPEEK_RAMP_OUT_MS;
    const v = Math.cos(t * Math.PI / 2);
    return v === 0 ? 0 : v;
  } catch { return 0; }
}

export function createEdgepeekState() {
  return { prevInRange: undefined, startedAtMs: null, lastFiredMs: null, firedCount: 0 };
}

export function resetEdgepeekState(state) {
  try {
    if (!state || typeof state !== "object") return state;
    state.prevInRange = undefined;
    state.startedAtMs = null;
    state.lastFiredMs = null;
    state.firedCount = 0;
    return state;
  } catch { return state; }
}

function isSuppressed(input) {
  // いずれも ===true のときだけ抑制として扱う (truthy な 1 等では倒さない)。
  if (!input || typeof input !== "object") return false;
  if (input.suppressed === true) return true;
  if (input.inCombat === true || input.combat === true || input.danger === true) return true;
  if (input.working === true || input.digging === true || input.attacking === true
      || input.placing === true || input.hasWorkTarget === true) return true;
  if (input.falling === true || input.selfFalling === true) return true;
  if (input.inWater === true || input.climbing === true) return true;
  if (input.flying === true || input.hovering === true) return true;
  if (input.flinchActive === true) return true;
  // 意図的な縦方向の降下 (潜行・螺旋階段・坑道) では常に下を見ているため重ねない。
  if (input.intentionalDescent === true || input.descending === true
      || input.spiralDescent === true || input.tunnelDescent === true) return true;
  // 最下位重畳の担保: 統合側が他重畳の active を束ねて渡した場合も抑制する。
  if (input.otherOverlayActive === true) return true;
  return false;
}

// 引数の正規化: PROPOSAL §3.1 の位置引数形 noteEdgepeek(state, dropDepth, nowMs, suppressed)
// と、threshold_math 式のオブジェクト形 noteEdgepeek(state, {dropDepth, nowMs, ...抑制})
// の両方を受ける。suppressed (第4引数) は boolean または抑制フラグのオブジェクト。
function normalizeNoteArgs(dropDepthOrInput, nowMsArg, suppressedArg) {
  if (dropDepthOrInput && typeof dropDepthOrInput === "object") return dropDepthOrInput;
  const input = { dropDepth: dropDepthOrInput, nowMs: nowMsArg };
  if (typeof suppressedArg === "boolean") input.suppressed = suppressedArg;
  else if (suppressedArg && typeof suppressedArg === "object") Object.assign(input, suppressedArg);
  return input;
}

// noteEdgepeek(state, dropDepth|input, nowMs?, suppressed?) -> boolean (発火したら true)
// dropDepth が範囲外 -> 範囲内 へ入った辺でのみ発火する。辺は常に prevInRange へ
// 記録されるため、抑制中・冷却中の辺も消費し、遅れて発火しない。
// dropDepth が非有限の観測は辺として扱わない (prevInRange を書き換えず不発)。
// nowMs が非有限なら不発 (辺の記録もしない: 時刻なき発火は追跡できないため)。
export function noteEdgepeek(state, dropDepthOrInput, nowMsArg, suppressedArg) {
  try {
    if (!state || typeof state !== "object") return false;
    const input = normalizeNoteArgs(dropDepthOrInput, nowMsArg, suppressedArg);
    if (!input || typeof input !== "object") return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;
    if (finiteOrNull(input.dropDepth) === null) return false;
    const cur = isEdgepeekDropInRange(input.dropDepth);
    const prev = state.prevInRange;
    state.prevInRange = cur;
    if (!(prev !== true && cur === true)) return false;
    if (isSuppressed(input)) return false;
    const last = finiteOrNull(state.lastFiredMs);
    if (last !== null && now - last < EDGEPEEK_COOLDOWN_MS) return false;
    state.startedAtMs = now;
    state.lastFiredMs = now;
    state.firedCount = (Number.isFinite(state.firedCount) ? state.firedCount : 0) + 1;
    return true;
  } catch { return false; }
}

// edgepeekPitchOffset(state, nowMs) -> ピッチ加算量 (度)。PROPOSAL §3.1 の出力形。
// 発火からの経過で 0 -> +26 -> 0 の単一山形。期間外・無効入力は完全な 0。
// +26 度を常に超えない。
export function edgepeekPitchOffset(state, nowMs) {
  try {
    if (!state || typeof state !== "object") return 0;
    const s = finiteOrNull(state.startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return 0;
    return EDGEPEEK_PITCH_DEG * edgepeekEnvelope(n - s);
  } catch { return 0; }
}

// sampleEdgepeek(state, nowMs) -> { active, gazePitchDeg }
// 統合時の applyGaze 重畳点 (最下位) が毎 tick 呼ぶ想定。threshold/heed と同形。
export function sampleEdgepeek(state, nowMs) {
  try {
    const gazePitchDeg = edgepeekPitchOffset(state, nowMs);
    if (gazePitchDeg === 0) return { active: false, gazePitchDeg: 0 };
    return { active: true, gazePitchDeg };
  } catch { return { active: false, gazePitchDeg: 0 }; }
}

export function isEdgepeekActive(state, nowMs) {
  try { return sampleEdgepeek(state, nowMs).active; } catch { return false; }
}
