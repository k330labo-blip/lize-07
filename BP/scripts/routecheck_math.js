// routecheck_math.js — POLISH-ANIM-ROUTECHECK-01 純粋核 (cycle0117)
// 長距離移動中に一度だけ手元へ目を落とす進路確認の判定だけを行う純粋モジュール。
// 正: brain_parts/solutions/cycle0057-a16/POLISH_IDEA.md (§4〜§9) / 台帳 polish-backlog cycle0057追記。
// 純粋: @minecraft/server import なし・相対 import なし・Date.now/乱数なし・例外を投げない。
// 表示層のみ: 移動・経路・到達可能性には一切触らない。腕ピッチは RP 受け口が無い間は記録専用。
export const ROUTECHECK_FIRST_DIST = 32;
export const ROUTECHECK_REPEAT_DIST = 24;
export const ROUTECHECK_COOLDOWN_MS = 25000;
export const ROUTECHECK_DURATION_MS = 800;
export const ROUTECHECK_RAMP_IN_MS = 180;
export const ROUTECHECK_HOLD_END_MS = 520;
export const ROUTECHECK_PITCH_DEG = 20;
export const ROUTECHECK_STALL_MS = 3000;
export const ROUTECHECK_ARM_PITCH_DEG = -30; // RP受け口なし: r.lastRoutecheck 記録専用 (仕様§6)
export const ROUTECHECK_MAX_STEP = 16; // 1呼び出しの加算上限 (テレポート相当の跳びを距離にしない)
export const ROUTECHECK_REASONS = Object.freeze([
"fire_first", "fire_repeat", "accumulating", "cooldown", "stalled_reset",
"arrived_reset", "suppressed", "invalid",
]);
const SUPPRESS_KEYS = Object.freeze([
"working", "digging", "attacking", "placing", "inCombat", "danger",
"falling", "inWater", "climbing", "justTeleported", "justRespawned",
"dead", "otherOverlayActive",
]);
function fin(v) { return typeof v === "number" && Number.isFinite(v)? v: null;}
export function createRoutecheckState() {
return { accumDist: 0, firedOnce: false, lastFiredAtMs: null, activeSinceMs: null, lastMoveAtMs: null, lastRecord: null};
}
function normState(s) {
if (!s || typeof s!== "object") return null;
const a = fin(s.accumDist), lf = fin(s.lastFiredAtMs), ac = fin(s.activeSinceMs), lm = fin(s.lastMoveAtMs);
return {
accumDist: a!== null && a > 0? a: 0,
firedOnce: s.firedOnce === true,
lastFiredAtMs: lf, activeSinceMs: ac, lastMoveAtMs: lm,
lastRecord: (s.lastRecord && typeof s.lastRecord === "object")? s.lastRecord: null,
};
}
export function routecheckEnvelope(elapsedMs) {
const e = fin(elapsedMs);
if (e === null || e < 0 || e >= ROUTECHECK_DURATION_MS) return 0;
if (e < ROUTECHECK_RAMP_IN_MS) return e / ROUTECHECK_RAMP_IN_MS;
if (e < ROUTECHECK_HOLD_END_MS) return 1;
return 1 - (e - ROUTECHECK_HOLD_END_MS) / (ROUTECHECK_DURATION_MS - ROUTECHECK_HOLD_END_MS);
}
function isSuppressed(sample) {
for (const k of SUPPRESS_KEYS) if (sample[k] === true) return true;
return false;
}
// noteRoutecheck(state, sample, nowMs) -> { fired, reason}
// state は呼び出し側が保持するオブジェクトを直接更新する (先行核の feeder 作法)。
// 抑制中は stepDist を破棄 (加算しない) し、既に閾値到達済みの累積は 0 へ消費する:
// 抑制解除の瞬間に遅れて発火しない (仕様§4.3-6「抑制中も辺は消費」)。
export function noteRoutecheck(state, sample, nowMs) {
try {
const now = fin(nowMs);
const st = normState(state);
if (now === null || st === null ||!sample || typeof sample!== "object") return { fired: false, reason: "invalid"};
Object.assign(state, st);
// 到着リセット (抑制より優先: 到着は移動エピソードの終了)
if (sample.arrived === true) {
const had = state.accumDist > 0;
state.accumDist = 0;
return { fired: false, reason: had? "arrived_reset": "accumulating"};
}
// 静止リセット: 最後の水平移動から STALL_MS 超で累積のみ消す (firedOnce・冷却は保持)
if (sample.moving !== true && state.lastMoveAtMs!== null && now - state.lastMoveAtMs > ROUTECHECK_STALL_MS && state.accumDist > 0) { // cycle0117 統合時是正: 移動中サンプルでは静止リセットを発動しない (冷却保持中の距離を消さない)
state.accumDist = 0;
return { fired: false, reason: "stalled_reset"};
}
if (isSuppressed(sample)) {
const threshold = state.firedOnce? ROUTECHECK_REPEAT_DIST: ROUTECHECK_FIRST_DIST;
if (state.accumDist >= threshold) state.accumDist = 0; // 到達分を消費 (遅れ発火防止)
return { fired: false, reason: "suppressed"};
}
// 累積: 移動中かつ有限・正・上限内の stepDist のみ
if (sample.moving === true) {
const step = fin(sample.stepDist);
if (step!== null && step > 0 && step <= ROUTECHECK_MAX_STEP) {
state.accumDist += step;
state.lastMoveAtMs = now;
}
}
// 発火判定
if (!state.firedOnce) {
if (state.accumDist >= ROUTECHECK_FIRST_DIST) {
state.accumDist = 0; state.firedOnce = true;
state.lastFiredAtMs = now; state.activeSinceMs = now;
state.lastRecord = { atMs: now, fired: true, reason: "fire_first", pitchDeg: ROUTECHECK_PITCH_DEG, yawDeg: 0, armPitchDeg: ROUTECHECK_ARM_PITCH_DEG};
return { fired: true, reason: "fire_first"};
}
return { fired: false, reason: "accumulating"};
}
if (state.accumDist >= ROUTECHECK_REPEAT_DIST) {
const cooled = state.lastFiredAtMs === null || (now - state.lastFiredAtMs) >= ROUTECHECK_COOLDOWN_MS;
if (cooled) {
state.accumDist = 0;
state.lastFiredAtMs = now; state.activeSinceMs = now;
state.lastRecord = { atMs: now, fired: true, reason: "fire_repeat", pitchDeg: ROUTECHECK_PITCH_DEG, yawDeg: 0, armPitchDeg: ROUTECHECK_ARM_PITCH_DEG};
return { fired: true, reason: "fire_repeat"};
}
return { fired: false, reason: "cooldown"}; // 距離は保持し、冷却明けの次tickで発火しうる (ANDの正)
}
return { fired: false, reason: "accumulating"};
} catch { return { fired: false, reason: "invalid"};}
}
// sampleRoutecheck(state, nowMs) -> { active, gazePitchDeg, gazeYawDeg, coef, reason}
// ヨーは常に 0 (進行方向を保つことが本件の意味)。窓が終われば activeSinceMs を畳む (出口保証)。
export function sampleRoutecheck(state, nowMs) {
const zero = { active: false, gazePitchDeg: 0, gazeYawDeg: 0, coef: 0, reason: "inactive"};
try {
const now = fin(nowMs);
const st = normState(state);
if (now === null || st === null) return {...zero, reason: "invalid"};
if (st.activeSinceMs === null) return zero;
const coef = routecheckEnvelope(now - st.activeSinceMs);
if (coef <= 0) {
if (state && typeof state === "object") state.activeSinceMs = null;
return zero;
}
return { active: true, gazePitchDeg: ROUTECHECK_PITCH_DEG * coef, gazeYawDeg: 0, coef, reason: "active"};
} catch { return {...zero, reason: "invalid"};}
}
