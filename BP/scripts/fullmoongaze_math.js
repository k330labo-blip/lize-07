// fullmoongaze_math.js — POLISH-ANIM-FULLMOONGAZE-01 純粋核 (cycle-next v0.5.79 統合、純粋核先行・feeder未接続)
// 満月の夜、屋外で空が見え、作業・戦闘中でないときに、一晩に一度だけ月へ
// 小さく顔を上げる表示層のみの要素。既存要素との差分は a08_polish.md §2。
// 純粋・決定的・例外なし: @minecraft/server を import しない、相対 import も持たない、
// Date.now/乱数なし。月相・夜キー・天候・抑制条件は全て引数で受け取る。
// 実座標・移動・作業・発話には一切触らない。ピッチ符号は既存 gaze 規約に合わせ
// 「上向き = 負」(HORIZONGLANCE の -9度と同符号)。クランプ -60/+75 は gaze_math 同値のローカル写し。
"use strict";

export const FULLMOON_PITCH_DEG = 14;       // 月を見る見上げ量 (適用時は負)
export const FULLMOON_DURATION_MS = 1600;   // 全体: 入り450 / 保持700 / 戻り450
export const FULLMOON_ENTER_MS = 450;
export const FULLMOON_HOLD_END_MS = 1150;
export const FULLMOON_CONFIRM_SAMPLES = 2;  // 満月夜の確定に必要な連続サンプル数
export const FULLMOON_PHASE_INDEX = 0;      // 月相インデックス 0 = 満月 (0..7 の8相)

const PITCH_MIN = -60;
const PITCH_MAX = 75;

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clampPitch(v) { return Math.max(PITCH_MIN, Math.min(PITCH_MAX, v)); }

// 月相インデックスが満月か。0..7 の整数以外 (小数・文字列・範囲外) は false (UNKNOWN を満月扱いしない)
export function isFullMoonPhase(phaseIndex) {
  return Number.isInteger(phaseIndex) && phaseIndex >= 0 && phaseIndex <= 7 && phaseIndex === FULLMOON_PHASE_INDEX;
}

// 波形エンベロープ [0,1]: 入り sin / 保持 1 / 戻り cos。範囲外・非数は 0
export function fullMoonEnvelope(elapsedMs) {
  const e = fin(elapsedMs); if (e === null || e < 0 || e >= FULLMOON_DURATION_MS) return 0;
  if (e < FULLMOON_ENTER_MS) return Math.sin((e / FULLMOON_ENTER_MS) * Math.PI / 2);
  if (e < FULLMOON_HOLD_END_MS) return 1;
  return Math.cos(((e - FULLMOON_HOLD_END_MS) / (FULLMOON_DURATION_MS - FULLMOON_HOLD_END_MS)) * Math.PI / 2);
}

export function fullMoonPitchOffset(elapsedMs) {
  const v = -FULLMOON_PITCH_DEG * fullMoonEnvelope(elapsedMs);
  return v === 0 ? 0 : v;
}

export function applyFullMoonPitch(baseDeg, elapsedMs) {
  if (!Number.isFinite(baseDeg)) return baseDeg;
  return clampPitch(baseDeg + fullMoonPitchOffset(elapsedMs));
}

export function createFullMoonState() {
  return { active: false, startedAtMs: null, lastFiredNightKey: null, confirmCount: 0, confirmNightKey: null, prevEligible: false, episode: 0 };
}

// noteFullMoon(state, sample) -> { fired, active, reason }
// sample: { moonPhaseIndex, nightKey, isNight, nowMs,
//           suppressed?, danger?, combat?, falling?, inWater?, underground?,
//           skyVisible?, isRaining?, hasWorkTarget? }
//  - nightKey: その夜を一意に識別する整数 (統合時に絶対日数から供給する想定。a08_polish.md §4)
//  - 発火: 「夜 && 満月」が CONFIRM_SAMPLES 連続で確定した辺でのみ、かつ nightKey ごとに最大1回。
//  - 抑制中でも確定の辺は消費する (confirmCount は進み、遅れ発火しない)。
//  - moonPhaseIndex / nightKey / isNight が未観測 (型不正) のサンプルは UNKNOWN として状態不変。
//  - 夜でない/満月でないサンプルは confirmCount をリセットするが、lastFiredNightKey は保持する
//    (同じ夜に再入しても二重発火しないため)。
export function noteFullMoon(state, sample) {
  try {
    if (!state || typeof state !== "object" || !sample || typeof sample !== "object") return { fired: false, active: false, reason: "invalid" };
    const now = fin(sample.nowMs); if (now === null) return { fired: false, active: state.active === true, reason: "invalid_time" };
    if (!Number.isInteger(sample.moonPhaseIndex) || !Number.isInteger(sample.nightKey) || typeof sample.isNight !== "boolean") {
      return { fired: false, active: state.active === true, reason: "unknown" };
    }
    state.active = state.startedAtMs !== null && (now - state.startedAtMs) >= 0 && (now - state.startedAtMs) < FULLMOON_DURATION_MS;
    const eligible = sample.isNight === true && isFullMoonPhase(sample.moonPhaseIndex);
    if (!eligible) { state.confirmCount = 0; state.confirmNightKey = null; state.prevEligible = false; return { fired: false, active: state.active, reason: "not_fullmoon_night" }; }
    // 確認カウントは nightKey 単位: 夜が変わったら数え直す (引き継ぐと二度と確定辺に届かない)
    state.confirmCount = (state.prevEligible && state.confirmNightKey === sample.nightKey ? state.confirmCount : 0) + 1;
    state.confirmNightKey = sample.nightKey;
    state.prevEligible = true;
    if (state.confirmCount !== FULLMOON_CONFIRM_SAMPLES) return { fired: false, active: state.active, reason: "confirming" };
    // 確定の辺: ここでだけ発火判定。以後の連続サンプルは confirmCount != CONFIRM で素通りする
    if (state.lastFiredNightKey === sample.nightKey) return { fired: false, active: state.active, reason: "already_fired_this_night" };
    const suppressed = sample.suppressed === true || sample.danger === true || sample.combat === true ||
      sample.falling === true || sample.inWater === true || sample.underground === true ||
      sample.skyVisible === false || sample.isRaining === true || sample.hasWorkTarget === true;
    if (suppressed) return { fired: false, active: state.active, reason: "suppressed" };
    state.startedAtMs = now; state.lastFiredNightKey = sample.nightKey; state.episode += 1; state.active = true;
    return { fired: true, active: true, reason: "fired" };
  } catch { return { fired: false, active: false, reason: "error" }; }
}

export function fullMoonCurrentOffset(state, nowMs) {
  try {
    if (!state || typeof state !== "object" || state.startedAtMs == null) return { pitchDeg: 0, active: false };
    const n = fin(nowMs); if (n === null) return { pitchDeg: 0, active: false };
    const e = n - state.startedAtMs;
    if (e < 0 || e >= FULLMOON_DURATION_MS) return { pitchDeg: 0, active: false };
    return { pitchDeg: fullMoonPitchOffset(e), active: true };
  } catch { return { pitchDeg: 0, active: false }; }
}

// 自己テスト: 決定的ケースのみ。戻り値 { pass, fail }。例外は投げない
export function runFullMoonSelfTests() {
  let pass = 0, fail = 0;
  const eq = (a, b) => { if (a === b) pass++; else fail++; };
  const near = (a, b) => { if (typeof a === "number" && Math.abs(a - b) < 1e-9) pass++; else fail++; };
  try {
    eq(isFullMoonPhase(0), true); eq(isFullMoonPhase(1), false); eq(isFullMoonPhase(7), false);
    eq(isFullMoonPhase(8), false); eq(isFullMoonPhase(-1), false); eq(isFullMoonPhase(0.5), false);
    eq(isFullMoonPhase("0"), false); eq(isFullMoonPhase(null), false); eq(isFullMoonPhase(undefined), false);
    near(fullMoonEnvelope(0), 0); near(fullMoonEnvelope(450), 1); near(fullMoonEnvelope(800), 1);
    near(fullMoonEnvelope(1150), 1); eq(fullMoonEnvelope(1600), 0); eq(fullMoonEnvelope(-1), 0); eq(fullMoonEnvelope(NaN), 0);
    near(fullMoonPitchOffset(800), -14); eq(fullMoonPitchOffset(99999), 0);
    eq(applyFullMoonPitch(-70, 800), -60); eq(applyFullMoonPitch(80, 0), 75); eq(applyFullMoonPitch("x", 0), "x");
    // 発火: 2回連続確定で1回だけ、その夜は再発火しない
    const s = createFullMoonState();
    const base = { moonPhaseIndex: 0, nightKey: 101, isNight: true };
    eq(noteFullMoon(s, { ...base, nowMs: 1000 }).reason, "confirming");
    eq(noteFullMoon(s, { ...base, nowMs: 1200 }).fired, true);
    eq(noteFullMoon(s, { ...base, nowMs: 1400 }).fired, false);
    eq(fullMoonCurrentOffset(s, 2000).active, true); near(fullMoonCurrentOffset(s, 2000).pitchDeg, -14);
    eq(fullMoonCurrentOffset(s, 2800).active, false);
    // 昼を挟んでも同じ nightKey では再発火しない / 別の nightKey では発火できる
    eq(noteFullMoon(s, { moonPhaseIndex: 0, nightKey: 101, isNight: false, nowMs: 3000 }).reason, "not_fullmoon_night");
    noteFullMoon(s, { ...base, nowMs: 3200 }); eq(noteFullMoon(s, { ...base, nowMs: 3400 }).reason, "already_fired_this_night");
    noteFullMoon(s, { moonPhaseIndex: 0, nightKey: 109, isNight: true, nowMs: 4000 });
    eq(noteFullMoon(s, { moonPhaseIndex: 0, nightKey: 109, isNight: true, nowMs: 4200 }).fired, true);
    // 抑制中は辺を消費し、抑制解除後に遅れて発火しない
    const s2 = createFullMoonState();
    noteFullMoon(s2, { ...base, nightKey: 202, nowMs: 0 });
    eq(noteFullMoon(s2, { ...base, nightKey: 202, nowMs: 200, combat: true }).reason, "suppressed");
    eq(noteFullMoon(s2, { ...base, nightKey: 202, nowMs: 400 }).fired, false);
    // UNKNOWN (月相未観測) は状態不変: confirmCount を進めない
    const s3 = createFullMoonState();
    eq(noteFullMoon(s3, { nightKey: 303, isNight: true, nowMs: 0 }).reason, "unknown");
    eq(noteFullMoon(s3, { ...base, nightKey: 303, nowMs: 200 }).reason, "confirming");
    // 非満月・不正入力で例外なし
    eq(noteFullMoon(null, null).reason, "invalid");
    eq(noteFullMoon(createFullMoonState(), { moonPhaseIndex: 3, nightKey: 1, isNight: true, nowMs: 0 }).reason, "not_fullmoon_night");
    eq(fullMoonCurrentOffset(null, 0).active, false);
  } catch { fail++; }
  return { pass, fail };
}
