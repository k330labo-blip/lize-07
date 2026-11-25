// bridgegaze_math.js — POLISH-ANIM-BRIDGEGAZE-01 純粋核 (cycle1621-a08)
// 1マス幅の足場を渡る時の慎重な足元視線: ピッチ+11度・ヨー抑制0.4、持続型。
// 純粋JS・例外なし・表示層のみ。0-A と同様に本版は未配線 (記録/消費は次段)。
export const BRIDGEGAZE_PITCH_DEG = 11;
export const BRIDGEGAZE_ENTER_TICKS = 3;
export const BRIDGEGAZE_EXIT_TICKS = 5;
export const BRIDGEGAZE_RAMP_MS = 250;
export const BRIDGEGAZE_MIN_DROP = 3;
export const BRIDGEGAZE_COOLDOWN_MS = 4000;
export const BRIDGEGAZE_YAW_DAMP = 0.4;
function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
export function createBridgegazeState() {
  return { enterStreak: 0, exitStreak: 0, active: false, rampFrom: 0, rampTo: 0, rampStartMs: null, lastExitMs: null };
}
function rampValue(st, now) {
  const s = fin(st.rampStartMs); if (s === null) return st.rampTo;
  const t = (now - s) / BRIDGEGAZE_RAMP_MS;
  if (t <= 0) return st.rampFrom; if (t >= 1) return st.rampTo;
  return st.rampFrom + (st.rampTo - st.rampFrom) * t;
}
function startRamp(st, now, to) { st.rampFrom = rampValue(st, now); st.rampTo = to; st.rampStartMs = now; }
// sample: { leftDrop, rightDrop, grounded, suppressed } — drop が null は UNKNOWN (streak保持)
export function stepBridgegaze(st, sample, nowMs) {
  try {
    const zero = { active: false, pitchDeg: 0, yawDamp: 1 };
    if (!st || typeof st !== "object") return { ...zero };
    const now = fin(nowMs); if (now === null) return { active: st.active === true, pitchDeg: rampValue(st, st.rampStartMs ?? 0), yawDamp: st.active ? BRIDGEGAZE_YAW_DAMP : 1 };
    const sm = sample && typeof sample === "object" ? sample : {};
    if (sm.suppressed === true) { st.enterStreak = 0; st.exitStreak = 0; /* 辺も消費: 抑制中は状態を進めない */ return sampleBridgegaze(st, now); }
    if (sm.grounded !== undefined && sm.grounded !== true) {
      if (st.active) { st.active = false; st.lastExitMs = now; startRamp(st, now, 0); }
      st.enterStreak = 0; st.exitStreak = 0; return sampleBridgegaze(st, now);
    }
    const l = fin(sm.leftDrop), r = fin(sm.rightDrop);
    if (l === null || r === null) return sampleBridgegaze(st, now); // UNKNOWN は streak 保持
    const narrow = l >= BRIDGEGAZE_MIN_DROP && r >= BRIDGEGAZE_MIN_DROP;
    if (!st.active) {
      if (narrow) {
        const cooled = st.lastExitMs === null || now - st.lastExitMs >= BRIDGEGAZE_COOLDOWN_MS;
        st.enterStreak = cooled ? st.enterStreak + 1 : 0;
        if (st.enterStreak >= BRIDGEGAZE_ENTER_TICKS) { st.active = true; st.enterStreak = 0; st.exitStreak = 0; startRamp(st, now, BRIDGEGAZE_PITCH_DEG); }
      } else st.enterStreak = 0;
    } else {
      if (narrow) st.exitStreak = 0;
      else { st.exitStreak++; if (st.exitStreak >= BRIDGEGAZE_EXIT_TICKS) { st.active = false; st.exitStreak = 0; st.lastExitMs = now; startRamp(st, now, 0); } }
    }
    return sampleBridgegaze(st, now);
  } catch { return { active: false, pitchDeg: 0, yawDamp: 1 }; }
}
export function sampleBridgegaze(st, nowMs) {
  try {
    if (!st || typeof st !== "object") return { active: false, pitchDeg: 0, yawDamp: 1 };
    const now = fin(nowMs) ?? st.rampStartMs ?? 0;
    const pitch = rampValue(st, now);
    return { active: st.active === true || pitch > 0, pitchDeg: pitch, yawDamp: (st.active || pitch > 0) ? BRIDGEGAZE_YAW_DAMP : 1 };
  } catch { return { active: false, pitchDeg: 0, yawDamp: 1 }; }
}
export function runBridgegazeSelfTests() {
  let pass = 0; const failures = [];
  const ok = (c, n) => { if (c) pass++; else failures.push(n); };
  const narrow = { leftDrop: 3, rightDrop: 4, grounded: true };
  const wide = { leftDrop: 0, rightDrop: 0, grounded: true };
  try {
    const st = createBridgegazeState();
    stepBridgegaze(st, narrow, 0); stepBridgegaze(st, narrow, 50);
    ok(st.active === false, "B-01 not yet at 2 ticks");
    stepBridgegaze(st, narrow, 100); ok(st.active === true, "B-02 active at 3 ticks");
    ok(Math.abs(sampleBridgegaze(st, 350).pitchDeg - 11) < 1e-9, "B-03 pitch 11 after ramp");
    ok(sampleBridgegaze(st, 350).yawDamp === 0.4, "B-04 yawDamp 0.4");
    for (let i = 0; i < 4; i++) stepBridgegaze(st, wide, 400 + i * 50);
    ok(st.active === true, "B-05 still active at 4 wide ticks");
    stepBridgegaze(st, wide, 650); ok(st.active === false, "B-06 exits at 5 wide ticks");
    ok(Math.abs(sampleBridgegaze(st, 900).pitchDeg) < 1e-9, "B-07 pitch back to exact 0");
    // 片側のみは不発
    const st2 = createBridgegazeState();
    for (let i = 0; i < 6; i++) stepBridgegaze(st2, { leftDrop: 5, rightDrop: 0, grounded: true }, i * 50);
    ok(st2.active === false, "B-08 one-sided never fires");
    // 落差2は不発
    const st3 = createBridgegazeState();
    for (let i = 0; i < 6; i++) stepBridgegaze(st3, { leftDrop: 2, rightDrop: 2, grounded: true }, i * 50);
    ok(st3.active === false, "B-09 drop 2 never fires");
    // UNKNOWN保持・冷却
    const st4 = createBridgegazeState();
    stepBridgegaze(st4, narrow, 0); stepBridgegaze(st4, { leftDrop: null, rightDrop: 3, grounded: true }, 50);
    ok(st4.enterStreak === 1, "B-10 UNKNOWN keeps streak");
    ok(stepBridgegaze(null, narrow, 0).pitchDeg === 0 && stepBridgegaze(st4, narrow, NaN).pitchDeg >= 0, "B-11 invalid safe");
  } catch (e) { failures.push("B-XX threw " + (e && e.message)); }
  return { pass, fail: failures.length, failures };
}
