// rainpatter_math.js — POLISH-SND-RAINPATTER-01 純粋核 (cyc-next, v0.5.86)
// 雨中・屋外で待機/移動しているとき、自分の体に当たる雨粒の小さな当たり音の
// 発火判定だけを行う純粋モジュール。設計の正: tests/cyc1810_a14_polish.md §3。
// 音 ID は持たない (実在確認が済むまで消費側は記録のみ)。@minecraft/server を
// import しない。時刻は引数で受け取る (決定的)。例外を投げない。
// UNKNOWN (undefined) の観測では武装も連続カウントも保持し、発火しない。

export const RAINPATTER_ARM_OBSERVATIONS = 2;
export const RAINPATTER_FIRST_DELAY_MS = 1200;
export const RAINPATTER_INTERVAL_MIN_MS = 650;
export const RAINPATTER_INTERVAL_MAX_MS = 2100;
export const RAINPATTER_VOLUME_BASE = 0.10;
export const RAINPATTER_VOLUME_MAX = 0.22;
export const RAINPATTER_PITCH_MIN = 0.90;
export const RAINPATTER_PITCH_MAX = 1.15;
export const RAINPATTER_UNKNOWN_HOLD_LIMIT = 10;

// fireCount から決定的に間隔/音量/ピッチを導く疑似揺らぎ (乱数源を持たない)
function det01(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
export function rainPatterIntervalMs(fireCount) {
  const t = det01((fireCount | 0) + 1);
  return Math.round(RAINPATTER_INTERVAL_MIN_MS + t * (RAINPATTER_INTERVAL_MAX_MS - RAINPATTER_INTERVAL_MIN_MS));
}
export function rainPatterVolume(fireCount) {
  const v = RAINPATTER_VOLUME_BASE + det01((fireCount | 0) * 2 + 5) * (RAINPATTER_VOLUME_MAX - RAINPATTER_VOLUME_BASE);
  return Math.min(RAINPATTER_VOLUME_MAX, Math.max(RAINPATTER_VOLUME_BASE, v));
}
export function rainPatterPitch(fireCount) {
  const p = RAINPATTER_PITCH_MIN + det01((fireCount | 0) * 3 + 11) * (RAINPATTER_PITCH_MAX - RAINPATTER_PITCH_MIN);
  return Math.min(RAINPATTER_PITCH_MAX, Math.max(RAINPATTER_PITCH_MIN, p));
}

export function createRainPatterState() {
  return { rainSeenCount: 0, armed: false, armedAtMs: null, nextDueMs: null, fireCount: 0, lastFireMs: null, unknownStreak: 0 };
}

export function noteRainPatterTick(state, obs) {
  try {
    if (!state || typeof state !== "object") return { fired: false, reason: "unknown" };
    const now = obs?.nowMs;
    if (typeof now !== "number" || !Number.isFinite(now)) return { fired: false, reason: "unknown" };
    if (state.lastSeenMs != null && now < state.lastSeenMs) return { fired: false, reason: "unknown" };
    state.lastSeenMs = now;
    const raining = obs?.isRaining;
    const exposed = obs?.exposedToSky;
    // UNKNOWN: 武装・カウントは保持して不発。長く続けば安全側に武装解除。
    if (raining === undefined || exposed === undefined) {
      state.unknownStreak = (state.unknownStreak | 0) + 1;
      if (state.unknownStreak > RAINPATTER_UNKNOWN_HOLD_LIMIT) { state.armed = false; state.rainSeenCount = 0; state.nextDueMs = null; }
      return { fired: false, reason: "unknown" };
    }
    state.unknownStreak = 0;
    // 確定した不適格: 雨が止んだ/屋根下では即停止し数え直す
    if (raining !== true || exposed !== true) {
      state.armed = false; state.rainSeenCount = 0; state.nextDueMs = null;
      return { fired: false, reason: raining !== true ? "not_raining" : "sheltered" };
    }
    // 抑制 (次元・水中・戦闘): 武装は保持するが発火せず、過ぎた予定分は数え直す
    const dim = obs?.dimension;
    if ((dim !== undefined && dim !== "overworld" && dim !== "minecraft:overworld") || obs?.inWater === true || obs?.inCombat === true) {
      if (state.armed) state.nextDueMs = now + rainPatterIntervalMs(state.fireCount | 0);
      return { fired: false, reason: "suppressed" };
    }
    if (!state.armed) {
      state.rainSeenCount = (state.rainSeenCount | 0) + 1;
      if (state.rainSeenCount < RAINPATTER_ARM_OBSERVATIONS) return { fired: false, reason: "not_armed" };
      state.armed = true; state.armedAtMs = now;
      state.nextDueMs = now + RAINPATTER_FIRST_DELAY_MS;
      return { fired: false, reason: "waiting" };
    }
    if (state.nextDueMs == null) state.nextDueMs = now + RAINPATTER_FIRST_DELAY_MS;
    if (now < state.nextDueMs) return { fired: false, reason: "waiting" };
    // 発火は1回だけ。次回はこの tick から間隔を数え直す (バーストなし)。
    state.fireCount = (state.fireCount | 0) + 1;
    state.lastFireMs = now;
    const intervalMs = rainPatterIntervalMs(state.fireCount);
    state.nextDueMs = now + intervalMs;
    return { fired: true, reason: "due", volume: rainPatterVolume(state.fireCount), pitch: rainPatterPitch(state.fireCount), intervalMs };
  } catch { return { fired: false, reason: "unknown" }; }
}
export default noteRainPatterTick;
