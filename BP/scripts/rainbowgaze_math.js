// rainbowgaze_math.js — POLISH-ANIM-RAINBOWGAZE-01 純粋核 (cycle0955 統合: 記録のみ先行統合)
// 虹の方位の供給源 (feeder) は現行に無いため、本版では読み手ゼロ。推測発火は入れない。
// ドラフト正本: tests/cycle0955_a08_polish.mjs (契約 C-01〜C-26)
export const RAINBOWGAZE_DURATION_MS = 1800; // 全体: 入り400 + 保持900 + 戻り500
export const RAINBOWGAZE_ENTER_MS = 400;
export const RAINBOWGAZE_HOLD_END_MS = 1300; // 保持の終端 (= 400 + 900)
export const RAINBOWGAZE_PITCH_DEG = 12; // 見上げ量 (適用時は負)
export const RAINBOWGAZE_YAW_MAX_DEG = 35; // 虹方位へ寄せるヨーの上限 (全回転はしない)
export const RAINBOWGAZE_WINDOW_MS = 45000; // 雨上がり保留の窓
export const RAINBOWGAZE_CONFIRM = 2; // 虹観測の連続確定回数
export const RAINBOWGAZE_COOLDOWN_MS = 600000; // 10分 (SKYGLANCE/DRYOFF と同値)
const PITCH_MIN = -60, PITCH_MAX = 75;

function fin(v) { return typeof v === "number" && Number.isFinite(v)? v: null;}
function clampPitch(v) { return Math.max(PITCH_MIN, Math.min(PITCH_MAX, v));}

// 最短角差 (-180,180] へ正規化。非数は null。
export function rainbowgazeAngleDeltaDeg(fromDeg, toDeg) {
try {
const a = fin(fromDeg), b = fin(toDeg); if (a === null || b === null) return null;
let d = (b - a) % 360; if (d > 180) d -= 360; if (d <= -180) d += 360; return d;
} catch { return null;}
}
export function wrapRainbowgazeYawDeg(deg) {
try {
if (!Number.isFinite(deg)) return deg;
let d = ((deg + 180) % 360 + 360) % 360 - 180; if (d === -180) d = 180; return d;
} catch { return deg;}
}

// 台形ブレンド [0,1]: 入り sin / 保持 1 / 戻り cos。範囲外・非数は 0。
export function rainbowgazeEnvelope(elapsedMs) {
try {
const e = fin(elapsedMs); if (e === null || e < 0 || e >= RAINBOWGAZE_DURATION_MS) return 0;
if (e < RAINBOWGAZE_ENTER_MS) return Math.sin((e / RAINBOWGAZE_ENTER_MS) * Math.PI / 2);
if (e < RAINBOWGAZE_HOLD_END_MS) return 1;
return Math.cos(((e - RAINBOWGAZE_HOLD_END_MS) / (RAINBOWGAZE_DURATION_MS - RAINBOWGAZE_HOLD_END_MS)) * Math.PI / 2);
} catch { return 0;}
}

// rainbowgazeOffsets(elapsedMs, currentYawDeg, rainbowYawDeg) -> {pitchDeg, yawDeg}
// 方位差が取れなければヨーは 0 (ピッチだけの小さな見上げに縮退する)。
export function rainbowgazeOffsets(elapsedMs, currentYawDeg, rainbowYawDeg) {
try {
const env = rainbowgazeEnvelope(elapsedMs);
const d = rainbowgazeAngleDeltaDeg(currentYawDeg, rainbowYawDeg);
const capped = d === null? 0: Math.max(-RAINBOWGAZE_YAW_MAX_DEG, Math.min(RAINBOWGAZE_YAW_MAX_DEG, d));
const pitch = -RAINBOWGAZE_PITCH_DEG * env, yaw = capped * env;
return { pitchDeg: pitch === 0? 0: pitch, yawDeg: yaw === 0? 0: yaw};
} catch { return { pitchDeg: 0, yawDeg: 0};}
}
export function rainbowgazeOffsetsAt(startedAtMs, nowMs, currentYawDeg, rainbowYawDeg) {
try {
const s = fin(startedAtMs), n = fin(nowMs);
if (s === null || n === null) return { pitchDeg: 0, yawDeg: 0};
return rainbowgazeOffsets(n - s, currentYawDeg, rainbowYawDeg);
} catch { return { pitchDeg: 0, yawDeg: 0};}
}
export function applyRainbowgaze(basePitchDeg, baseYawDeg, elapsedMs, rainbowYawDeg) {
try {
if (!Number.isFinite(basePitchDeg) ||!Number.isFinite(baseYawDeg)) return { pitchDeg: basePitchDeg, yawDeg: baseYawDeg};
const o = rainbowgazeOffsets(elapsedMs, baseYawDeg, rainbowYawDeg);
return { pitchDeg: clampPitch(basePitchDeg + o.pitchDeg), yawDeg: wrapRainbowgazeYawDeg(baseYawDeg + o.yawDeg)};
} catch { return { pitchDeg: basePitchDeg, yawDeg: baseYawDeg};}
}
export function isRainbowgazeActive(stateOrStartedAtMs, nowMs) {
try {
const s = fin(stateOrStartedAtMs && typeof stateOrStartedAtMs === "object"? stateOrStartedAtMs.startedAtMs: stateOrStartedAtMs);
const n = fin(nowMs); if (s === null || n === null) return false;
return n - s >= 0 && n - s < RAINBOWGAZE_DURATION_MS;
} catch { return false;}
}
function isSuppressed(src) {
if (!src || typeof src!== "object") return false;
return src.suppressed === true || src.danger === true || src.combat === true
|| src.falling === true || src.inWater === true || src.underground === true
|| src.hasWorkTarget === true || src.otherOverlayActive === true;
}
// shouldRainbowgaze(input) -> 純粋な発火可否。input: {pendingSinceMs, confirm, lastFiredAtMs, nowMs,...抑制}
export function shouldRainbowgaze(input) {
try {
if (!input || typeof input!== "object") return false;
const p = fin(input.pendingSinceMs), n = fin(input.nowMs);
if (p === null || n === null || n < p || n - p > RAINBOWGAZE_WINDOW_MS) return false;
if (!(input.confirm >= RAINBOWGAZE_CONFIRM)) return false;
if (isSuppressed(input)) return false;
const last = fin(input.lastFiredAtMs);
if (last!== null && (n < last || n - last < RAINBOWGAZE_COOLDOWN_MS)) return false;
return true;
} catch { return false;}
}
export function createRainbowgazeState() {
return { prevRaining: null, pendingSinceMs: null, confirm: 0, startedAtMs: null, lastFiredAtMs: null, rainbowYawDeg: null};
}
// noteRainbowgaze(state, obs) -> boolean (この呼び出しで発火したら true)
// obs: {isRaining, rainbowVisible, rainbowYawDeg, nowMs,...抑制フラグ}
// - 初回観測 (prevRaining が boolean でない) は記録だけで保留を立てない。
// - isRaining が boolean でない入力は無視し、状態を壊さない (false を返す)。
// - true->false の辺でのみ保留を立てる。雨が降り直したら保留を破棄する。
// - 保留中、虹観測 (rainbowVisible===true かつ有限な rainbowYawDeg) が連続2回で確定。
// 虹が見えない観測は confirm を 0 に戻す (連続性の担保)。窓切れは保留を破棄する。
// - 確定時は shouldRainbowgaze へ委譲し、抑制・冷却でも保留を消費する (遅れ発火の禁止)。
// 発火しなかった確定では lastFiredAtMs を進めない。
export function noteRainbowgaze(state, obs) {
try {
if (!state || typeof state!== "object" ||!obs || typeof obs!== "object") return false;
if (typeof obs.isRaining!== "boolean") return false;
const n = fin(obs.nowMs); if (n === null) return false;
const was = state.prevRaining; state.prevRaining = obs.isRaining;
if (obs.isRaining === true) { state.pendingSinceMs = null; state.confirm = 0; return false;}
if (was === true) { state.pendingSinceMs = n; state.confirm = 0;}
if (state.pendingSinceMs === null || state.pendingSinceMs === undefined) return false;
if (n < state.pendingSinceMs || n - state.pendingSinceMs > RAINBOWGAZE_WINDOW_MS) {
state.pendingSinceMs = null; state.confirm = 0; return false;
}
const yaw = fin(obs.rainbowYawDeg);
if (obs.rainbowVisible === true && yaw!== null) { state.confirm = (state.confirm | 0) + 1; state.rainbowYawDeg = yaw;}
else state.confirm = 0;
if (!(state.confirm >= RAINBOWGAZE_CONFIRM)) return false;
const fire = shouldRainbowgaze({...obs, pendingSinceMs: state.pendingSinceMs, confirm: state.confirm, lastFiredAtMs: state.lastFiredAtMs, nowMs: n});
state.pendingSinceMs = null; state.confirm = 0; // 確定は結果に関わらず消費
if (!fire) return false;
state.startedAtMs = n; state.lastFiredAtMs = n; return true;
} catch { return false;}
}

