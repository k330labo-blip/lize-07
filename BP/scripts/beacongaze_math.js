// beacongaze_math.js — POLISH-ANIM-BEACONGAZE-01 純粋核 (cyc2020 統合、実機確認待ち)
// ビーコンの光柱を見上げる視線演出。表示層のみ、例外を投げない。feeder (近傍 beacon 走査+視界判定) は main 側の後続配線。
// を feeder 側で用意すること)・頻度感は実機でしか確認できない。

export const BEACONGAZE_DURATION_MS = 1100;
export const BEACONGAZE_RAMP_IN_MS = 300;
export const BEACONGAZE_HOLD_MS = 500;          // 300〜800ms 保持
export const BEACONGAZE_RAMP_OUT_MS = 300;      // 800〜1100ms 復帰
export const BEACONGAZE_GLOBAL_COOLDOWN_MS = 60000;
export const BEACONGAZE_PER_BEACON_COOLDOWN_MS = 600000; // 同一ビーコン10分
export const BEACONGAZE_CONFIRM_SAMPLES = 2;    // 2回連続観測で確定 (ちらつき対策)
export const BEACONGAZE_CONFIRM_GAP_MS = 1500;  // 確認観測の最大間隔
export const BEACONGAZE_MIN_DISTANCE = 4;
export const BEACONGAZE_MAX_DISTANCE = 64;
export const BEACONGAZE_YAW_LIMIT_DEG = 55;
export const BEACONGAZE_PITCH_DEG = -24;        // 上向き (下向き正の規約で負)

export const BEACONGAZE_CONSTANTS = Object.freeze({
  DURATION_MS: BEACONGAZE_DURATION_MS,
  GLOBAL_COOLDOWN_MS: BEACONGAZE_GLOBAL_COOLDOWN_MS,
  PER_BEACON_COOLDOWN_MS: BEACONGAZE_PER_BEACON_COOLDOWN_MS,
  CONFIRM_SAMPLES: BEACONGAZE_CONFIRM_SAMPLES,
  PITCH_DEG: BEACONGAZE_PITCH_DEG,
});

const PITCH_MIN_DEG = -60, PITCH_MAX_DEG = 75; // gaze_math と同値
const fin = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function wrapBeacongazeYawDeg(deg) {
  try {
    if (!Number.isFinite(deg)) return deg;
    let d = ((deg + 180) % 360 + 360) % 360 - 180;
    if (d === -180) d = 180;
    return d;
  } catch { return deg; }
}

export function beacongazeEnvelope(elapsedMs) {
  try {
    const e = fin(elapsedMs);
    if (e === null || e < 0 || e >= BEACONGAZE_DURATION_MS) return 0;
    if (e < BEACONGAZE_RAMP_IN_MS) return Math.sin((e / BEACONGAZE_RAMP_IN_MS) * Math.PI / 2);
    if (e < BEACONGAZE_RAMP_IN_MS + BEACONGAZE_HOLD_MS) return 1;
    const t = (e - BEACONGAZE_RAMP_IN_MS - BEACONGAZE_HOLD_MS) / BEACONGAZE_RAMP_OUT_MS;
    const v = Math.cos(t * Math.PI / 2);
    return v === 0 ? 0 : v;
  } catch { return 0; }
}

// beacongazeOffsets(elapsedMs, relYawDeg) -> {active, gazeYawOffsetDeg, gazePitchDeg}
export function beacongazeOffsets(elapsedMs, relYawDeg) {
  try {
    const zero = { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 };
    const e = fin(elapsedMs), r = fin(relYawDeg);
    if (e === null || r === null || e < 0 || e >= BEACONGAZE_DURATION_MS) return { ...zero };
    const k = beacongazeEnvelope(e);
    if (k === 0) return { ...zero };
    const yaw = Math.max(-BEACONGAZE_YAW_LIMIT_DEG, Math.min(BEACONGAZE_YAW_LIMIT_DEG, wrapBeacongazeYawDeg(r)));
    return { active: true, gazeYawOffsetDeg: yaw * k === 0 ? 0 : yaw * k, gazePitchDeg: BEACONGAZE_PITCH_DEG * k };
  } catch { return { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 }; }
}

export function applyBeacongazePitch(basePitchDeg, elapsedMs, relYawDeg) {
  try {
    if (!Number.isFinite(basePitchDeg)) return basePitchDeg;
    return Math.max(PITCH_MIN_DEG, Math.min(PITCH_MAX_DEG, basePitchDeg + beacongazeOffsets(elapsedMs, relYawDeg).gazePitchDeg));
  } catch { return basePitchDeg; }
}

export function applyBeacongazeYaw(baseYawDeg, elapsedMs, relYawDeg) {
  try {
    if (!Number.isFinite(baseYawDeg)) return baseYawDeg;
    return wrapBeacongazeYawDeg(baseYawDeg + beacongazeOffsets(elapsedMs, relYawDeg).gazeYawOffsetDeg);
  } catch { return baseYawDeg; }
}

function suppressed(input) {
  return input.suppressed === true || input.inCombat === true || input.combat === true
    || input.working === true || input.digging === true || input.attacking === true
    || input.placing === true || input.falling === true || input.inWater === true
    || input.climbing === true || input.otherOverlayActive === true
    || input.flinchActive === true || input.sleeping === true;
}

// shouldBeacongaze(input) -> 発火可否 (状態を書き換えない)
// input {beamVisible===true, beaconKey:非空文字列, distance:4..64,
//        relYawDeg:|wrap|<=55, sameDimension!==false, nowMs, lastFiredMs,
//        lastByKey:{[key]:ms}, ...抑制群}
export function shouldBeacongaze(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.beamVisible !== true) return false;
    if (typeof input.beaconKey !== "string" || input.beaconKey.length === 0) return false;
    if (input.sameDimension === false) return false;
    const d = fin(input.distance);
    if (d === null || d < BEACONGAZE_MIN_DISTANCE || d > BEACONGAZE_MAX_DISTANCE) return false;
    const rel = fin(input.relYawDeg);
    if (rel === null || Math.abs(wrapBeacongazeYawDeg(rel)) > BEACONGAZE_YAW_LIMIT_DEG) return false;
    if (suppressed(input)) return false;
    const now = fin(input.nowMs);
    if (now === null) return false;
    const last = fin(input.lastFiredMs);
    if (last !== null && now - last < BEACONGAZE_GLOBAL_COOLDOWN_MS) return false;
    const byKey = input.lastByKey && typeof input.lastByKey === "object" ? fin(input.lastByKey[input.beaconKey]) : null;
    if (byKey !== null && now - byKey < BEACONGAZE_PER_BEACON_COOLDOWN_MS) return false;
    return true;
  } catch { return false; }
}

export function createBeacongazeState() {
  return { startedAtMs: null, relYawDeg: null, beaconKey: null, lastFiredMs: null, lastByKey: {}, pendingKey: null, pendingCount: 0, pendingLastMs: null, firedCount: 0 };
}

// noteBeacongaze(state, input) -> boolean
// 観測の度に呼ぶ。同一 beaconKey の2回連続観測 (間隔<=1500ms) で初めて発火。
// beamVisible!==true / 別キー / 抑制中 の観測は pending を消す (遅れ発火なし)。
export function noteBeacongaze(state, input) {
  try {
    if (!state || typeof state !== "object" || !input || typeof input !== "object") return false;
    if (input.beamVisible !== true || typeof input.beaconKey !== "string" || !input.beaconKey || suppressed(input)) {
      state.pendingKey = null; state.pendingCount = 0; state.pendingLastMs = null; return false;
    }
    const now = fin(input.nowMs);
    if (now === null) return false;
    if (state.pendingKey === input.beaconKey && fin(state.pendingLastMs) !== null && now - state.pendingLastMs <= BEACONGAZE_CONFIRM_GAP_MS && now >= state.pendingLastMs) {
      state.pendingCount += 1;
    } else { state.pendingKey = input.beaconKey; state.pendingCount = 1; }
    state.pendingLastMs = now;
    if (state.pendingCount < BEACONGAZE_CONFIRM_SAMPLES) return false;
    const ok = shouldBeacongaze({ ...input, lastFiredMs: state.lastFiredMs, lastByKey: state.lastByKey });
    state.pendingKey = null; state.pendingCount = 0; state.pendingLastMs = null;
    if (!ok) return false;
    state.startedAtMs = now; state.relYawDeg = input.relYawDeg; state.beaconKey = input.beaconKey;
    state.lastFiredMs = now;
    if (!state.lastByKey || typeof state.lastByKey !== "object") state.lastByKey = {};
    state.lastByKey[input.beaconKey] = now;
    state.firedCount = (Number.isFinite(state.firedCount) ? state.firedCount : 0) + 1;
    return true;
  } catch { return false; }
}

export function sampleBeacongaze(state, nowMs) {
  try {
    const zero = { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 };
    if (!state || typeof state !== "object") return { ...zero };
    const s = fin(state.startedAtMs), n = fin(nowMs);
    if (s === null || n === null) return { ...zero };
    return beacongazeOffsets(n - s, state.relYawDeg);
  } catch { return { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 }; }
}

