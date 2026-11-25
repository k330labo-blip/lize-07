// portalsteady_math.js — 次元移動直後の小さな立て直し POLISH-ANIM-PORTALSTEADY-01 (純粋核)
// 出典: brain_parts/solutions/polish-backlog-cycle1603.md §4 (仕様の正)
// 純粋モジュール: @minecraft/server を import しない。現在時刻 / エンティティ参照を
// 持たない (時刻・次元 ID は引数で受ける)。例外を投げない。決定的 (乱数・Date.now なし)。
// 表示層のみ: 次元移動の可否・移動・作業・戦闘・掘削ゲート・発話には一切触らない。
// 消費点は統合時に main.js applyGaze の重畳チェーン最下位 (HEED/THRESHOLD 等より下) へ
// 1 系統足すだけ。流儀は dryoff_math.js / stepup_math.js に倣う。

export const PORTALSTEADY_DURATION_MS = 700; // 合計 0.7 秒 (仕様 §4)
export const PORTALSTEADY_RAMP_IN_MS = 180; // 入り: ピッチが +13 度へ寄る
export const PORTALSTEADY_HOLD_MS = 120; // 保持: 足元確認の間
export const PORTALSTEADY_RAMP_OUT_MS = 400; // 戻り: 全成分が完全な 0 へ (出口がある)
// 180 + 120 + 400 = 700 (DURATION と一致させること。契約テストで固定する)
export const PORTALSTEADY_PITCH_DEG = 13; // 足元確認のピッチ (下向き正)
export const PORTALSTEADY_YAW_SWAY_DEG = 3; // ヨー揺れの初期振幅 (FLINCH 18 / SUMMONSCAN 28 より明確に小さい)
export const PORTALSTEADY_YAW_PERIOD_MS = 350; // ヨー揺れの周期 (700ms で 2 周期し線形減衰で 0 へ収束)
export const PORTALSTEADY_COOLDOWN_MS = 20000; // 冷却 20 秒 (往復の連続使用で煩くしない)
export const PORTALSTEADY_CONFIRM_COUNT = 2; // 次元変化の確定に必要な連続観測回数 (読取りノイズ対策)

export const PORTALSTEADY_CONSTANTS = Object.freeze({
DURATION_MS: PORTALSTEADY_DURATION_MS,
RAMP_IN_MS: PORTALSTEADY_RAMP_IN_MS,
HOLD_MS: PORTALSTEADY_HOLD_MS,
RAMP_OUT_MS: PORTALSTEADY_RAMP_OUT_MS,
PITCH_DEG: PORTALSTEADY_PITCH_DEG,
YAW_SWAY_DEG: PORTALSTEADY_YAW_SWAY_DEG,
YAW_PERIOD_MS: PORTALSTEADY_YAW_PERIOD_MS,
COOLDOWN_MS: PORTALSTEADY_COOLDOWN_MS,
CONFIRM_COUNT: PORTALSTEADY_CONFIRM_COUNT,
});

// gaze_math.js のクランプと同値 (自己完結のため本モジュール内に持つ。統合時は寄せてよい)
const PITCH_MIN_DEG = -60;
const PITCH_MAX_DEG = 75;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v)? v: null;}
function clampPitch(deg) { return Math.min(PITCH_MAX_DEG, Math.max(PITCH_MIN_DEG, deg));}

// isValidPortalDim(dimId) -> boolean: 有効な次元 ID は空でない文字列のみ。
// undefined / null / "" / 非文字列は「読取りの揺らぎ」として無効 (発火源にしない)。
export function isValidPortalDim(dimId) {
try { return typeof dimId === "string" && dimId.length > 0;} catch { return false;}
}

// wrapPortalYawDeg(deg) -> [-180, 180] へ正規化 (-180 は 180 に寄せる。dryoff と同一式)
export function wrapPortalYawDeg(deg) {
try {
if (!Number.isFinite(deg)) return deg;
let d = ((deg + 180) % 360 + 360) % 360 - 180;
if (d === -180) d = 180;
return d;
} catch { return deg;}
}

// portalsteadyEnvelope(elapsedMs) -> 0..1 のピッチ包絡。範囲外・無効入力は 0。
// 波形: 0〜180ms は sin で寄せ (0→1)、180〜300ms は保持 (1)、300〜700ms は cos で
// 復帰 (1→0)。t=0 と t>=700 は厳密に 0。
export function portalsteadyEnvelope(elapsedMs) {
try {
const e = finiteOrNull(elapsedMs);
if (e === null || e < 0 || e >= PORTALSTEADY_DURATION_MS) return 0;
if (e < PORTALSTEADY_RAMP_IN_MS) return Math.sin((e / PORTALSTEADY_RAMP_IN_MS) * Math.PI / 2);
const holdEnd = PORTALSTEADY_RAMP_IN_MS + PORTALSTEADY_HOLD_MS;
if (e < holdEnd) return 1;
const t = (e - holdEnd) / PORTALSTEADY_RAMP_OUT_MS;
const v = Math.cos(t * Math.PI / 2);
return v === 0? 0: v;
} catch { return 0;}
}

// portalsteadyYawSway(elapsedMs) -> ヨー揺れ (度)。範囲外・無効入力は 0。
// 波形: 3 * sin(2π * e / 350) * (1 - e / 700)。符号区間は + / - / + / - で
// 振幅が線形に減衰し、700ms で範囲外=0 へ収束する。どの入力でも |値| <= 3。
export function portalsteadyYawSway(elapsedMs) {
try {
const e = finiteOrNull(elapsedMs);
if (e === null || e < 0 || e >= PORTALSTEADY_DURATION_MS) return 0;
const v = PORTALSTEADY_YAW_SWAY_DEG
* Math.sin(2 * Math.PI * e / PORTALSTEADY_YAW_PERIOD_MS)
* (1 - e / PORTALSTEADY_DURATION_MS);
return v === 0? 0: v;
} catch { return 0;}
}

// portalsteadyOffsets(elapsedMs) -> { active, gazePitchDeg, yawSwayDeg}
// 仕様 §4 の出力形そのもの。非活動時は全成分が完全な 0。
export function portalsteadyOffsets(elapsedMs) {
try {
const e = finiteOrNull(elapsedMs);
if (e === null || e < 0 || e >= PORTALSTEADY_DURATION_MS) {
return { active: false, gazePitchDeg: 0, yawSwayDeg: 0};
}
return {
active: true,
gazePitchDeg: PORTALSTEADY_PITCH_DEG * portalsteadyEnvelope(e),
yawSwayDeg: portalsteadyYawSway(e),
};
} catch { return { active: false, gazePitchDeg: 0, yawSwayDeg: 0};}
}

// portalsteadyOffsetsAt(startedAtMs, nowMs) -> portalsteadyOffsets(nowMs - startedAtMs)
// 時刻が無効・巻き戻しの場合は非活動の 0 形を返す。
export function portalsteadyOffsetsAt(startedAtMs, nowMs) {
try {
const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
if (s === null || n === null) return { active: false, gazePitchDeg: 0, yawSwayDeg: 0};
return portalsteadyOffsets(n - s);
} catch { return { active: false, gazePitchDeg: 0, yawSwayDeg: 0};}
}

// applyPortalsteadyPitch(basePitchDeg, elapsedMs) -> クランプ済みピッチ
// base 非有限時は base をそのまま返す (dryoff の apply* と同規則)。
export function applyPortalsteadyPitch(basePitchDeg, elapsedMs) {
try {
if (!Number.isFinite(basePitchDeg)) return basePitchDeg;
return clampPitch(basePitchDeg + portalsteadyOffsets(elapsedMs).gazePitchDeg);
} catch { return basePitchDeg;}
}

// applyPortalsteadyYaw(baseYawDeg, elapsedMs) -> wrap 済みヨー
export function applyPortalsteadyYaw(baseYawDeg, elapsedMs) {
try {
if (!Number.isFinite(baseYawDeg)) return baseYawDeg;
return wrapPortalYawDeg(baseYawDeg + portalsteadyOffsets(elapsedMs).yawSwayDeg);
} catch { return baseYawDeg;}
}

// isPortalsteadyActive(stateOrStartedAtMs, nowMs) -> boolean
// 受け形は 2 通り: 数値 = startedAtMs、オブジェクト = state.startedAtMs。
export function isPortalsteadyActive(stateOrStartedAtMs, nowMs) {
try {
const raw = stateOrStartedAtMs && typeof stateOrStartedAtMs === "object"
? stateOrStartedAtMs.startedAtMs: stateOrStartedAtMs;
const s = finiteOrNull(raw), n = finiteOrNull(nowMs);
if (s === null || n === null) return false;
const e = n - s;
return e >= 0 && e < PORTALSTEADY_DURATION_MS;
} catch { return false;}
}

// portalsteadyDue(lastFiredAtMs, nowMs) -> boolean: クールダウン判定 (20 秒)
// 初回 (lastFiredAtMs が非有限) は true。nowMs 非有限・巻き戻しは false。
// 境界: 前回 +19999ms は false、+20000ms は true。
export function portalsteadyDue(lastFiredAtMs, nowMs) {
try {
const n = finiteOrNull(nowMs);
if (n === null) return false;
const last = finiteOrNull(lastFiredAtMs);
if (last === null) return true;
return n - last >= PORTALSTEADY_COOLDOWN_MS;
} catch { return false;}
}

// shouldPortalsteady(input) -> boolean: 発火可否の純粋判定
// input: {
// edgeConfirmed, // 次元変化の辺が確定済みか (note* が 2 回連続観測で立てる。本関数は辺を作らない)
// suppressed, // 統合側で束ねた抑制フラグ (最小形はこちらだけでもよい)
// danger, inCombat, // 抑制: 危険接近 / 戦闘中 (FLINCH 管轄を優先)
// falling, inWater, // 抑制: 落下中 / 水中
// hasWorkTarget, workTarget, // 抑制: 作業対象を向いている間 (hasWorkTarget 優先)
// summonScanActive, // 抑制: 召喚・復元直後 (SUMMONSCAN を優先)
// deadOrRespawning, // 抑制: 死亡・復活の遷移中
// otherOverlayActive, // 抑制: 他の視線重畳が再生中 (本件は最下位)
// lastFiredAtMs, lastFiredMs, nowMs,
//}
// 真偽は厳密一致 (===true) のときだけ抑制として扱う。例外を投げない。
// 本関数は純粋判定であり辺を消費しない。辺の消費は notePortalsteady が担う。
export function shouldPortalsteady(input) {
try {
if (!input || typeof input!== "object") return false;
if (input.edgeConfirmed!== true) return false;
if (input.suppressed === true) return false;
if (input.danger === true || input.inCombat === true) return false;
if (input.falling === true || input.inWater === true) return false;
if (input.hasWorkTarget === true) return false;
if (input.hasWorkTarget === undefined && input.workTarget) return false;
if (input.summonScanActive === true) return false;
if (input.deadOrRespawning === true) return false;
if (input.otherOverlayActive === true) return false;
const now = finiteOrNull(input.nowMs);
if (now === null) return false;
const last = input.lastFiredAtMs!== undefined? input.lastFiredAtMs: input.lastFiredMs;
return portalsteadyDue(last, input.nowMs);
} catch { return false;}
}

// notePortalsteady(state, dimIdOrInput, nowMsArg) -> boolean (発火を記録したら true)
// state は配線側が保持する表示層状態:
// { confirmedDim, candidateDim, candidateCount, startedAtMs, lastFiredAtMs}
// 受け形は 2 通り:
// - notePortalsteady(state, dimId /* string */, nowMs) … 抑制なしの最小形
// - notePortalsteady(state, { dimId, nowMs, danger,...}) … 抑制の内訳を渡す拡張形
// 振る舞い:
// - 初回観測 (confirmedDim が未確定) は記録だけで発火しない (スポーン直後に誤発火しない)。
// - 無効な次元 ID (undefined / "" / 非文字列) は無視し、状態を一切壊さない (false を返す)。
// 読取りが 1 回だけ別値を返して戻る揺らぎでは候補が確定値と異なるまま終わり発火しない。
// - confirmedDim と異なる有効値が CONFIRM_COUNT 回連続で観測された時点で辺が確定する。
// その時点で confirmedDim を新値へ進める (= 辺の消費)。抑制中・冷却中でも消費は行い、
// 抑制解除・冷却明け後に遅れて発火することはない。
// - 発火したときだけ startedAtMs / lastFiredAtMs を nowMs で記録する。
// 抑制・冷却で発火しなかった辺では lastFiredAtMs を進めない。
// state がオブジェクトでない場合は何もせず false。例外を投げない。
export function notePortalsteady(state, dimIdOrInput, nowMsArg) {
try {
if (!state || typeof state!== "object") return false;
let dimId, nowMs, extra = {};
if (dimIdOrInput && typeof dimIdOrInput === "object") {
dimId = dimIdOrInput.dimId;
nowMs = dimIdOrInput.nowMs;
extra = dimIdOrInput;
} else {
dimId = dimIdOrInput;
nowMs = nowMsArg;
}
if (!isValidPortalDim(dimId)) return false; // 揺らぎは無視し状態を壊さない
if (!isValidPortalDim(state.confirmedDim)) {
// 初回観測: 確定値として記録するだけ
state.confirmedDim = dimId;
state.candidateDim = null;
state.candidateCount = 0;
return false;
}
if (dimId === state.confirmedDim) {
state.candidateDim = null; // 候補は棄却 (揺らぎの確定防止)
state.candidateCount = 0;
return false;
}
if (dimId === state.candidateDim) {
state.candidateCount = (finiteOrNull(state.candidateCount) || 0) + 1;
} else {
state.candidateDim = dimId;
state.candidateCount = 1;
}
if (state.candidateCount < PORTALSTEADY_CONFIRM_COUNT) return false;
// 辺の確定 + 消費: 結果に関わらず確定値を進める
state.confirmedDim = dimId;
state.candidateDim = null;
state.candidateCount = 0;
const fire = shouldPortalsteady({
...extra,
edgeConfirmed: true, // 辺は本関数が確定済み (extra 側の値で上書きしない)
lastFiredAtMs: state.lastFiredAtMs, nowMs,
});
if (!fire) return false;
state.startedAtMs = nowMs;
state.lastFiredAtMs = nowMs;
return true;
} catch { return false;}
}

