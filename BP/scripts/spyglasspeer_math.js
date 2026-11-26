// spyglasspeer_math.js — POLISH-ANIM-SPYGLASSPEER-01 純粋核（ドラフト）
// 主人が望遠鏡を覗き続けているとき、一度だけ同じ方位へ視線を向ける。
// 時刻は引数で受け、API・乱数・現在時刻には触らない。例外を投げない。

export const SPYGLASSPEER = Object.freeze({
  CONFIRM_SAMPLES: 3,
  MAX_OWNER_DIST: 16,
  DURATION_MS: 1600,
  RAMP_IN_MS: 350,
  HOLD_MS: 800,
  COOLDOWN_MS: 60000,
  YAW_GAIN: 0.55,
  YAW_CAP_DEG: 40,
  PITCH_GAIN: 0.6,
  PITCH_MIN_DEG: -10,
  PITCH_MAX_DEG: 6,
});

export function createSpyglassPeerState() {
  return {
    stableCount: 0,
    sessionLatched: false,
    firedAtMs: null,
    activeFromMs: null,
    targetYawDeg: 0,
    targetPitchDeg: 0,
    lastNowMs: null,
  };
}

function finite(x) { return typeof x === "number" && Number.isFinite(x); }
function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }

// -180..180 の最短角差
export function shortestYawDiffDeg(fromDeg, toDeg) {
  if (!finite(fromDeg) || !finite(toDeg)) return 0;
  let d = (toDeg - fromDeg) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

// 台形包絡: 0 -> (sin 入り) -> 1 -> (cos 戻り) -> 0
export function spyglassPeerEnvelope(tMs) {
  const C = SPYGLASSPEER;
  if (!finite(tMs) || tMs <= 0) return 0;
  if (tMs >= C.DURATION_MS) return 0;
  if (tMs < C.RAMP_IN_MS) {
    const p = tMs / C.RAMP_IN_MS;
    return Math.sin(p * Math.PI / 2);
  }
  if (tMs < C.RAMP_IN_MS + C.HOLD_MS) return 1;
  const p = (tMs - C.RAMP_IN_MS - C.HOLD_MS) / (C.DURATION_MS - C.RAMP_IN_MS - C.HOLD_MS);
  return Math.cos(p * Math.PI / 2);
}

// 観測を1件与える。発火したら true を返す（状態は引数の state を更新する）。
export function noteSpyglassPeer(state, obs) {
  if (!state || typeof state !== "object") return false;
  const o = (obs && typeof obs === "object") ? obs : {};
  const now = finite(o.nowMs) ? o.nowMs : null;
  if (now !== null && state.lastNowMs !== null && now < state.lastNowMs) return false; // 時刻逆行は無視
  if (now !== null) state.lastNowMs = now;

  if (o.ownerScoping !== true) {
    state.stableCount = 0;
    state.sessionLatched = false;
    return false;
  }
  // UNKNOWN（必須数値の欠落）は確定に数えず、数え直しにする
  if (!finite(o.ownerYawDeg) || !finite(o.selfYawDeg) || !finite(o.ownerDist)) {
    state.stableCount = 0;
    return false;
  }
  if (o.ownerDist > SPYGLASSPEER.MAX_OWNER_DIST) { state.stableCount = 0; return false; }
  if (o.inCombat === true || o.isWorking === true || o.isSleeping === true || o.isSubmerged === true) {
    state.stableCount = 0; // 抑制中は溜めない（遅れ発火の禁止）
    return false;
  }
  if (state.sessionLatched) return false;
  if (state.firedAtMs !== null && now !== null && now - state.firedAtMs < SPYGLASSPEER.COOLDOWN_MS) return false;

  state.stableCount += 1;
  if (state.stableCount < SPYGLASSPEER.CONFIRM_SAMPLES) return false;

  // 発火: 目標はこの瞬間に固定する
  const yawDiff = shortestYawDiffDeg(o.selfYawDeg, o.ownerYawDeg);
  state.targetYawDeg = clamp(yawDiff * SPYGLASSPEER.YAW_GAIN, -SPYGLASSPEER.YAW_CAP_DEG, SPYGLASSPEER.YAW_CAP_DEG);
  const ownerPitch = finite(o.ownerPitchDeg) ? o.ownerPitchDeg : 0;
  state.targetPitchDeg = clamp(ownerPitch * SPYGLASSPEER.PITCH_GAIN, SPYGLASSPEER.PITCH_MIN_DEG, SPYGLASSPEER.PITCH_MAX_DEG);
  state.activeFromMs = now;
  state.firedAtMs = now;
  state.sessionLatched = true;
  state.stableCount = 0;
  return true;
}

// 現在の重畳量を返す。再生中の抑制成立で即座に不活性化する。
export function sampleSpyglassPeer(state, nowMs, suppressed) {
  const idle = { active: false, yawDeg: 0, pitchDeg: 0 };
  if (!state || typeof state !== "object") return idle;
  if (state.activeFromMs === null || !finite(nowMs)) return idle;
  if (suppressed === true) { state.activeFromMs = null; return idle; }
  const t = nowMs - state.activeFromMs;
  const env = spyglassPeerEnvelope(t);
  if (env <= 0) { if (t >= SPYGLASSPEER.DURATION_MS) state.activeFromMs = null; return idle; }
  return {
    active: true,
    yawDeg: state.targetYawDeg * env,
    pitchDeg: state.targetPitchDeg * env,
  };
}
