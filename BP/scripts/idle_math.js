// idle_math.js — POLISH-ANIM-IDLE-01 純粋核 (cycle2020)
// 仕様の正: brain_parts/solutions/cycle2020-a09/DRAFT.md
// 待機3秒から持続する待機モーション: 呼吸相当の微小上下・稀な頭の傾け・待つ相手への視線。
// bodyYOffset / headTilt は受け口未整備の間は呼び出し側で記録のみ。視線だけ applyGaze 最下位へ重畳する。
// 純粋モジュール: importなし・例外なし・決定的 (乱数/Date.nowなし。種と時刻は入力)。
export const IDLE_QUALIFY_MS = 3000;
export const IDLE_MODE_QUALIFY_MS = 1500;
export const IDLE_BREATH_PERIOD_MS = 3800;
export const IDLE_BREATH_AMP_BLOCKS = 0.015;
export const IDLE_TILT_DEG = 6;
export const IDLE_TILT_DURATION_MS = 1400;
export const IDLE_LOOK_PERIOD_MS = 8000;
export const IDLE_LOOK_HOLD_MS = 2500;
export const IDLE_WORK_YAW_CLAMP_DEG = 40;
export const IDLE_OWNER_YAW_CLAMP_DEG = 50;
export const IDLE_OWNER_FOLLOW = 0.7;

export function createIdleState() {
  return { phase: "off", mode: null, idleSinceMs: null, activeSinceMs: null, episodeSeed: 0, nextTiltAtMs: null, tiltSign: 1, muted: false, lastRecord: null };
}
function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function hash01(seed, n) { let h = (seed >>> 0) ^ Math.imul(n + 1, 2654435761); h ^= h >>> 13; h = Math.imul(h, 2246822519); h ^= h >>> 15; return (h >>> 0) / 4294967296; }
function tiltStart(seed, idx) { return 9000 + hash01(seed, idx * 2) * 6000; }
function tiltGap(seed, idx) { return 18000 + hash01(seed, idx * 2 + 1) * 12000; }
function hardSuppressed(sm) {
  return sm.suppressed === true || sm.inCombat === true || sm.working === true || sm.moving === true || sm.falling === true || sm.inWater === true || sm.climbing === true || sm.hurt === true;
}
// noteIdle(state, sample, nowMs): feeder。sample.idle undefined は UNKNOWN 保持。
export function noteIdle(state, sample, nowMs) {
  const inv = { phase: state?.phase || "off", entered: false, exited: false, muted: false, reason: "invalid" };
  try {
    if (!state || typeof state !== "object" || !sample || typeof sample !== "object") return { ...inv };
    const now = fin(nowMs); if (now === null) return { ...inv };
    let entered = false, exited = false, reason = "hold";
    if (sample.idle === undefined || sample.idle === null) {
      reason = "unknown_hold";
    } else if (hardSuppressed(sample)) {
      if (state.phase !== "off") exited = true;
      state.phase = "off"; state.idleSinceMs = null; state.activeSinceMs = null; state.nextTiltAtMs = null; state.muted = false;
      reason = "exit_suppressed";
    } else if (sample.idle !== true) {
      if (state.phase !== "off") exited = true;
      state.phase = "off"; state.idleSinceMs = null; state.activeSinceMs = null; state.nextTiltAtMs = null; state.muted = false;
      reason = "exit_idle";
    } else {
      const mode = (sample.mode === "free" || sample.mode === "work_wait" || sample.mode === "owner_wait") ? sample.mode : (state.mode || "free");
      const switched = state.phase !== "off" && state.mode !== null && mode !== state.mode;
      if (state.phase === "off" || switched) {
        if (state.phase === "off") { state.episodeSeed = (fin(state.episodeSeed) || 0) + 1; }
        state.phase = "qualifying"; state.mode = mode; state.idleSinceMs = now; state.activeSinceMs = null; state.nextTiltAtMs = null;
        reason = switched ? "mode_switch" : "hold";
      }
      state.muted = sample.overlayActive === true;
      if (state.phase === "qualifying" && fin(state.idleSinceMs) !== null && now - state.idleSinceMs >= (state._qualMs ?? IDLE_QUALIFY_MS)) {
        state.phase = "active"; state.activeSinceMs = now; state.tiltSign = state.episodeSeed % 2 === 0 ? 1 : -1;
        state.nextTiltAtMs = now + tiltStart(state.episodeSeed, 0); state._tiltIdx = 0;
        entered = true; reason = "enter";
      }
      if (switched) state._qualMs = IDLE_MODE_QUALIFY_MS; else if (state.phase === "qualifying" && state._qualMs === undefined) state._qualMs = IDLE_QUALIFY_MS;
      if (entered) state._qualMs = undefined;
      state._lastYaw = { target: fin(sample.targetYawRelDeg), owner: fin(sample.ownerYawRelDeg) };
    }
    state.lastRecord = { atMs: now, reason, mode: state.mode };
    return { phase: state.phase, entered, exited, muted: state.muted === true, reason };
  } catch { return { ...inv }; }
}
export function sampleIdle(state, nowMs) {
  const zero = { active: false, muted: false, mode: null, bodyYOffsetBlocks: 0, gazeYawRelDeg: 0, gazePitchDeg: 0, headTiltDeg: 0, reason: "invalid" };
  try {
    if (!state || typeof state !== "object") return { ...zero };
    const now = fin(nowMs); if (now === null) return { ...zero };
    if (state.phase !== "active" || fin(state.activeSinceMs) === null) return { ...zero, mode: state.mode || null, reason: state.lastRecord?.reason || "hold" };
    const el = now - state.activeSinceMs;
    if (el < 0) return { ...zero, mode: state.mode, reason: "hold" };
    if (state.muted) return { ...zero, muted: true, mode: state.mode, reason: "muted" };
    const bodyY = IDLE_BREATH_AMP_BLOCKS * Math.sin((2 * Math.PI * el) / IDLE_BREATH_PERIOD_MS);
    let tilt = 0, pitch = 0, yaw = 0;
    if (state.mode !== "work_wait" && fin(state.nextTiltAtMs) !== null) {
      let start = state.nextTiltAtMs, idx = state._tiltIdx || 0, guard = 0;
      while (now > start + IDLE_TILT_DURATION_MS && guard++ < 100) { idx++; start += tiltGap(state.episodeSeed, idx); }
      if (idx !== (state._tiltIdx || 0)) { state._tiltIdx = idx; state.nextTiltAtMs = start; }
      const t = now - start;
      if (t >= 0 && t < IDLE_TILT_DURATION_MS) {
        const env = t < 300 ? t / 300 : t < 1000 ? 1 : (IDLE_TILT_DURATION_MS - t) / 400;
        tilt = state.tiltSign * IDLE_TILT_DEG * env; pitch += 3 * env;
      }
    }
    if (state.mode === "work_wait") {
      const ph = el % IDLE_LOOK_PERIOD_MS;
      if (ph < IDLE_LOOK_HOLD_MS) {
        const coef = ph < 400 ? ph / 400 : ph > IDLE_LOOK_HOLD_MS - 400 ? (IDLE_LOOK_HOLD_MS - ph) / 400 : 1;
        const ty = state._lastYaw?.target;
        yaw = ty === null || ty === undefined ? 0 : clamp(ty, -IDLE_WORK_YAW_CLAMP_DEG, IDLE_WORK_YAW_CLAMP_DEG) * coef;
      }
    } else if (state.mode === "owner_wait") {
      const oy = state._lastYaw?.owner;
      yaw = oy === null || oy === undefined ? 0 : clamp(oy, -IDLE_OWNER_YAW_CLAMP_DEG, IDLE_OWNER_YAW_CLAMP_DEG) * IDLE_OWNER_FOLLOW;
      pitch += 2;
    }
    return { active: true, muted: false, mode: state.mode, bodyYOffsetBlocks: clamp(bodyY, -IDLE_BREATH_AMP_BLOCKS, IDLE_BREATH_AMP_BLOCKS), gazeYawRelDeg: yaw, gazePitchDeg: clamp(pitch, -2, 6), headTiltDeg: clamp(tilt, -IDLE_TILT_DEG, IDLE_TILT_DEG), reason: "hold" };
  } catch { return { ...zero }; }
}
export function runIdleSelfTests() {
  let pass = 0; const failures = []; const ok = (c, n) => { if (c) pass++; else failures.push(n); };
  try {
    const s = createIdleState();
    noteIdle(s, { idle: true, mode: "free" }, 0);
    ok(sampleIdle(s, 2999).active === false, "I1a qualify 2999 off");
    ok(noteIdle(s, { idle: true, mode: "free" }, 3000).entered === true, "I1b enter at 3000");
    let max = 0, signFlip = false, prev = 0;
    for (let t = 3000; t < 3000 + 3800; t += 50) { const y = sampleIdle(s, t).bodyYOffsetBlocks; if (Math.abs(y) > max) max = Math.abs(y); if (prev > 0.005 && y < -0.005) signFlip = true; if (y > 0.005 || y < -0.005) prev = y; }
    ok(max <= 0.015 && max > 0.014 && signFlip, "I2 breath bounded+period");
    ok(Math.abs(sampleIdle(s, 3000).bodyYOffsetBlocks) < 1e-9, "I2b breath starts 0");
    noteIdle(s, { idle: false }, 4000);
    const z = sampleIdle(s, 4000); ok(z.active === false && z.bodyYOffsetBlocks === 0 && z.headTiltDeg === 0, "I3 exit zeroes");
    for (const k of ["suppressed", "inCombat", "working", "moving", "falling", "inWater", "climbing", "hurt"]) {
      const sx = createIdleState(); noteIdle(sx, { idle: true, mode: "free" }, 0); noteIdle(sx, { idle: true, mode: "free" }, 3000);
      const r = noteIdle(sx, { idle: true, [k]: true }, 3100);
      ok(r.exited === true && sampleIdle(sx, 3100).active === false, "I4 suppress " + k);
    }
    const s5 = createIdleState(); noteIdle(s5, { idle: true, mode: "free" }, 0); noteIdle(s5, { idle: true, mode: "free" }, 3000);
    noteIdle(s5, { idle: true, mode: "free", overlayActive: true }, 3500);
    const m = sampleIdle(s5, 3500); ok(m.muted === true && m.bodyYOffsetBlocks === 0, "I5a mute zeroes");
    noteIdle(s5, { idle: true, mode: "free" }, 3600);
    ok(Math.abs(sampleIdle(s5, 3600).bodyYOffsetBlocks - 0.015 * Math.sin(2 * Math.PI * 600 / 3800)) < 1e-9, "I5b phase continuous after mute");
    const s6 = createIdleState(); noteIdle(s6, { idle: true, mode: "free" }, 0); const ph = s6.phase; noteIdle(s6, { idle: undefined }, 5000);
    ok(s6.phase === ph && s6.activeSinceMs === null, "I6 unknown holds");
    const run = () => { const st = createIdleState(); noteIdle(st, { idle: true, mode: "free" }, 0); noteIdle(st, { idle: true, mode: "free" }, 3000); const out = []; for (let t = 3000; t < 60000; t += 100) out.push(sampleIdle(st, t).headTiltDeg); return out; };
    const a = run(), b = run(); ok(JSON.stringify(a) === JSON.stringify(b), "I7a deterministic");
    ok(Math.max(...a.map(Math.abs)) <= 6 && Math.max(...a.map(Math.abs)) > 0, "I7b tilt fires <=6");
    const s8 = createIdleState(); noteIdle(s8, { idle: true, mode: "work_wait", targetYawRelDeg: 90 }, 0); noteIdle(s8, { idle: true, mode: "work_wait", targetYawRelDeg: 90 }, 3000);
    ok(Math.abs(sampleIdle(s8, 3900).gazeYawRelDeg - 40) < 1e-9, "I8a work yaw clamp in window");
    ok(sampleIdle(s8, 3000 + 4000).gazeYawRelDeg === 0, "I8b work yaw 0 outside window");
    const s9 = createIdleState(); noteIdle(s9, { idle: true, mode: "owner_wait", ownerYawRelDeg: 100 }, 0); noteIdle(s9, { idle: true, mode: "owner_wait", ownerYawRelDeg: 100 }, 3000);
    const o9 = sampleIdle(s9, 3500); ok(Math.abs(o9.gazeYawRelDeg - 35) < 1e-9 && o9.gazePitchDeg >= 2, "I9 owner follow 0.7 + pitch");
    const s10 = createIdleState(); noteIdle(s10, { idle: true, mode: "free" }, 0); noteIdle(s10, { idle: true, mode: "free" }, 3000);
    noteIdle(s10, { idle: true, mode: "owner_wait", ownerYawRelDeg: 10 }, 4000);
    ok(sampleIdle(s10, 5400).active === false && noteIdle(s10, { idle: true, mode: "owner_wait", ownerYawRelDeg: 10 }, 5500).entered === true, "I10 mode switch requalify 1500");
    const s11 = createIdleState(); noteIdle(s11, { idle: true, mode: "work_wait", targetYawRelDeg: 0 }, 0); noteIdle(s11, { idle: true, mode: "work_wait", targetYawRelDeg: 0 }, 3000);
    let tiltSeen = false; for (let t = 3000; t < 90000; t += 100) if (sampleIdle(s11, t).headTiltDeg !== 0) tiltSeen = true;
    ok(!tiltSeen, "I11 no tilt in work_wait");
    let safe = true; try { noteIdle(null, null, NaN); sampleIdle(null, NaN); noteIdle(createIdleState(), { idle: true }, "x"); sampleIdle(createIdleState(), NaN); } catch { safe = false; }
    ok(safe, "I12 invalid safe");
    const s13 = createIdleState(); noteIdle(s13, { idle: true, mode: "owner_wait", ownerYawRelDeg: 30 }, 0); noteIdle(s13, { idle: true, mode: "owner_wait", ownerYawRelDeg: 30 }, 3000);
    let bounded = true; for (let t = 3000; t < 603000; t += 137) { const o = sampleIdle(s13, t); if (Math.abs(o.bodyYOffsetBlocks) > 0.015 || Math.abs(o.headTiltDeg) > 6 || o.gazePitchDeg < -2 || o.gazePitchDeg > 6 || Math.abs(o.gazeYawRelDeg) > 35) bounded = false; }
    ok(bounded, "I13 long-run bounded");
    const s14 = createIdleState(); noteIdle(s14, { idle: true, mode: "free" }, 0); noteIdle(s14, { idle: true, mode: "free" }, 3000);
    let yawFree = true; for (let t = 3000; t < 60000; t += 100) if (sampleIdle(s14, t).gazeYawRelDeg !== 0) yawFree = false;
    ok(yawFree, "I14 free yaw always 0");
  } catch (e) { failures.push("threw " + e.message); }
  return { pass, fail: failures.length, failures };
}
