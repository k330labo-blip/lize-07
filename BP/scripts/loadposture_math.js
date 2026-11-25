// POLISH-ANIM-LOADPOSTURE-01 (cycle1832): 所持品の占有率が高い状態が続くと、荷を担ぐように
// 視線ピッチを小さく (+5度) 前傾させる。表示層のみ・行動判断には一切触らない。実機確認待ち。
// 仕様の正: brain_parts/solutions/cycle1832-a05/REPORT.md (契約 LP-01〜44)
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX } from "./gaze_math.js";

export const LOAD_ENTER_RATIO = 0.85;
export const LOAD_EXIT_RATIO = 0.70;
export const LOAD_SUSTAIN_MS = 3000;
export const LOAD_PITCH_DEG = 5;
export const LOAD_RAMP_IN_MS = 800;
export const LOAD_RAMP_OUT_MS = 1200;
export const LOAD_COOLDOWN_MS = 15000;
export const LOADPOSTURE_CONSTANTS = Object.freeze({
  LOAD_ENTER_RATIO, LOAD_EXIT_RATIO, LOAD_SUSTAIN_MS, LOAD_PITCH_DEG,
  LOAD_RAMP_IN_MS, LOAD_RAMP_OUT_MS, LOAD_COOLDOWN_MS,
});

const SUPPRESS_ALIASES = ["inCombat", "combat", "danger", "working", "digging", "attacking", "placing",
  "hasWorkTarget", "flinchActive", "falling", "selfFalling", "inWater", "swimming", "climbing",
  "flying", "hovering", "dead", "transitioning", "summonScanActive"];

export function createLoadPostureState() {
  return { enteredAtMs: null, sustainSinceMs: null, exitStartedAtMs: null, exitFromDeg: 0, cooldownUntilMs: 0, lastRatio: null };
}
export function resetLoadPostureState(state) {
  if (state && typeof state === "object") Object.assign(state, createLoadPostureState());
  return state;
}
export function normalizeLoadRatio(ratio) {
  return (typeof ratio === "number" && Number.isFinite(ratio) && ratio >= 0 && ratio <= 1) ? ratio : null;
}
export function loadRatioFromSlots(usedSlots, totalSlots) {
  if (typeof usedSlots !== "number" || typeof totalSlots !== "number") return null;
  if (!Number.isFinite(usedSlots) || !Number.isFinite(totalSlots) || totalSlots <= 0 || usedSlots < 0) return null;
  return Math.min(1, usedSlots / totalSlots);
}
export function isLoadSuppressed(sample) {
  if (!sample || typeof sample !== "object") return false;
  if (sample.suppressed === true) return true;
  return SUPPRESS_ALIASES.some((k) => sample[k] === true);
}
function sampleRatio(sample) {
  if (!sample || typeof sample !== "object") return null;
  const direct = normalizeLoadRatio(sample.ratio);
  if (direct != null) return direct;
  return loadRatioFromSlots(sample.usedSlots, sample.totalSlots);
}
function pitchAt(state, nowMs) {
  if (!state || typeof state !== "object") return 0;
  if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) return 0;
  if (state.exitStartedAtMs != null) {
    const t = nowMs - state.exitStartedAtMs;
    if (t <= 0) return state.exitFromDeg || 0;
    if (t >= LOAD_RAMP_OUT_MS) return 0;
    return (state.exitFromDeg || 0) * (1 - t / LOAD_RAMP_OUT_MS);
  }
  if (state.enteredAtMs == null) return 0;
  const t = nowMs - state.enteredAtMs;
  if (t <= 0) return 0;
  if (t >= LOAD_RAMP_IN_MS) return LOAD_PITCH_DEG;
  return LOAD_PITCH_DEG * (t / LOAD_RAMP_IN_MS);
}
export function noteLoadPosture(state, sample, nowMs) {
  try {
    if (!state || typeof state !== "object") return state;
    if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) return state;
    const ratio = sampleRatio(sample);
    if (ratio != null) state.lastRatio = ratio;
    const suppressed = isLoadSuppressed(sample);
    const entered = state.enteredAtMs != null;
    if (!entered) {
      if (suppressed || ratio == null || ratio < LOAD_ENTER_RATIO || nowMs < (state.cooldownUntilMs || 0)) {
        state.sustainSinceMs = null;
        return state;
      }
      if (state.sustainSinceMs == null) state.sustainSinceMs = nowMs;
      if (nowMs - state.sustainSinceMs >= LOAD_SUSTAIN_MS) {
        state.enteredAtMs = nowMs; state.sustainSinceMs = null; state.exitStartedAtMs = null; state.exitFromDeg = 0;
      }
      return state;
    }
    // 入り中
    if (state.exitStartedAtMs != null) {
      if (nowMs - state.exitStartedAtMs >= LOAD_RAMP_OUT_MS) {
        state.enteredAtMs = null; state.exitStartedAtMs = null; state.exitFromDeg = 0; // 抜け完了が取り消しより先 (ランプ完了後は同一tickで持続を始めない)
      } else if (ratio != null && ratio >= LOAD_ENTER_RATIO && !suppressed) {
        // 抜けの取り消し: 現在ピッチから再ランプインする
        const cur = pitchAt(state, nowMs);
        state.exitStartedAtMs = null; state.exitFromDeg = 0;
        state.enteredAtMs = nowMs - (cur / LOAD_PITCH_DEG) * LOAD_RAMP_IN_MS;
      } else if (nowMs - state.exitStartedAtMs >= LOAD_RAMP_OUT_MS) {
        state.enteredAtMs = null; state.exitStartedAtMs = null; state.exitFromDeg = 0;
      }
      return state;
    }
    if (suppressed) {
      state.exitStartedAtMs = nowMs; state.exitFromDeg = pitchAt(state, nowMs); // 抑制由来の抜けはクールダウンを立てない
      return state;
    }
    if (ratio != null && ratio <= LOAD_EXIT_RATIO) {
      state.exitStartedAtMs = nowMs; state.exitFromDeg = pitchAt(state, nowMs);
      state.cooldownUntilMs = nowMs + LOAD_COOLDOWN_MS;
    }
    return state;
  } catch { return state; }
}
export function loadPosturePitchOffset(state, nowMs) {
  try { const v = pitchAt(state, nowMs); return Number.isFinite(v) ? Math.max(0, Math.min(LOAD_PITCH_DEG, v)) : 0; }
  catch { return 0; }
}
export function loadPostureBand(state) {
  return (state && typeof state === "object" && state.enteredAtMs != null) ? "heavy" : "none";
}
export function sampleLoadPosture(state, nowMs) {
  const pitchDeg = loadPosturePitchOffset(state, nowMs);
  return { active: pitchDeg > 0 || loadPostureBand(state) === "heavy", pitchDeg, band: loadPostureBand(state), ratio: state?.lastRatio ?? null };
}
export function applyLoadPosturePitch(basePitchDeg, state, nowMs) {
  if (typeof basePitchDeg !== "number" || !Number.isFinite(basePitchDeg)) return basePitchDeg;
  return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + loadPosturePitchOffset(state, nowMs)));
}

export function runLoadPostureSelfTests() {
  const failures = []; let pass = 0;
  const ok = (c, n) => { if (c) pass++; else failures.push(n); };
  ok(LOAD_ENTER_RATIO === 0.85 && LOAD_EXIT_RATIO === 0.70 && LOAD_SUSTAIN_MS === 3000 && LOAD_PITCH_DEG === 5 && LOAD_RAMP_IN_MS === 800 && LOAD_RAMP_OUT_MS === 1200 && LOAD_COOLDOWN_MS === 15000, "LP-S-01 constants");
  ok(normalizeLoadRatio(0.5) === 0.5 && normalizeLoadRatio(1.2) === null && normalizeLoadRatio(NaN) === null && normalizeLoadRatio("0.5") === null, "LP-S-02 normalize");
  ok(loadRatioFromSlots(17, 20) === 0.85 && loadRatioFromSlots(5, 0) === null && loadRatioFromSlots(30, 20) === 1, "LP-S-03 slots");
  { const st = createLoadPostureState(); noteLoadPosture(st, { ratio: 0.9 }, 0); noteLoadPosture(st, { ratio: 0.9 }, 2999); ok(loadPostureBand(st) === "none", "LP-S-04a sustain 2999"); noteLoadPosture(st, { ratio: 0.9 }, 3000); ok(loadPostureBand(st) === "heavy", "LP-S-04b sustain 3000"); }
  { const st = createLoadPostureState(); noteLoadPosture(st, { ratio: 0.9 }, 0); noteLoadPosture(st, { ratio: 0.9 }, 3000); ok(Math.abs(loadPosturePitchOffset(st, 3400) - 2.5) < 1e-9, "LP-S-05a ramp mid"); ok(loadPosturePitchOffset(st, 3800) === 5, "LP-S-05b hold"); }
  { const st = createLoadPostureState(); noteLoadPosture(st, { ratio: 0.9 }, 0); noteLoadPosture(st, { ratio: 0.9 }, 3000); noteLoadPosture(st, { ratio: 0.78 }, 4000); ok(loadPostureBand(st) === "heavy" && st.exitStartedAtMs == null, "LP-S-06a band no exit"); noteLoadPosture(st, { ratio: 0.70 }, 4100); ok(st.exitStartedAtMs === 4100, "LP-S-06b exit at 0.70"); ok(loadPosturePitchOffset(st, 5300) === 0, "LP-S-07 ramp out 1200"); }
  { const st = createLoadPostureState(); noteLoadPosture(st, { ratio: 0.9 }, 0); noteLoadPosture(st, { ratio: 0.9 }, 3000); noteLoadPosture(st, { ratio: 0.5 }, 4000); ok(st.cooldownUntilMs === 19000, "LP-S-08a cooldown"); noteLoadPosture(st, { ratio: 0.9 }, 6000); noteLoadPosture(st, { ratio: 0.9 }, 9000); ok(loadPostureBand(st) === "none", "LP-S-08b cooldown blocks sustain"); }
  { const st = createLoadPostureState(); noteLoadPosture(st, { ratio: 0.9 }, 0); noteLoadPosture(st, { ratio: 0.9, suppressed: true }, 1000); ok(st.sustainSinceMs == null, "LP-S-09a suppress resets sustain"); const st2 = createLoadPostureState(); noteLoadPosture(st2, { ratio: 0.9 }, 0); noteLoadPosture(st2, { ratio: 0.9 }, 3000); noteLoadPosture(st2, { ratio: 0.9, working: true }, 4000); ok(st2.exitStartedAtMs === 4000 && st2.cooldownUntilMs === 0, "LP-S-09b suppress exit no cooldown"); }
  { let threw = false; try { noteLoadPosture(null, null, NaN); noteLoadPosture(createLoadPostureState(), "x", Infinity); loadPosturePitchOffset(null, 0); applyLoadPosturePitch(10, null, 0); } catch { threw = true; } ok(!threw, "LP-S-10 abnormal inputs"); }
  { const run = () => { const st = createLoadPostureState(); noteLoadPosture(st, { ratio: 0.9 }, 0); noteLoadPosture(st, { ratio: 0.9 }, 3000); return loadPosturePitchOffset(st, 3600); }; ok(run() === run(), "LP-S-11 deterministic"); }
  return { pass, fail: failures.length, failures };
}
