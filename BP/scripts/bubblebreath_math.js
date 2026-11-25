// bubblebreath_math.js — POLISH-FX-BUBBLEBREATH-01 純粋核 (cycle1909 統合)
// 仕様の正: brain_parts/solutions/cycle1850-a08/REPORT.md、実装ドラフト cycle1909-a03/DRAFT.md
// 水中滞在中の小さな冷却排気泡。粒子ID未照合 (PARTICLE_ID=null) の間は配線側で記録のみ。
// 純粋モジュール: @minecraft/server を import しない。時刻・観測は引数。例外を投げない。
export const BUBBLEBREATH_MIN_SUBMERGED_MS = 2000;
export const BUBBLEBREATH_INTERVAL_MIN_MS = 2800;
export const BUBBLEBREATH_INTERVAL_MAX_MS = 4600;
export const BUBBLEBREATH_INTERVAL_BASE_MS = 3700;
export const BUBBLEBREATH_JITTER_MS = 900;
export const BUBBLEBREATH_PARTICLE_COUNT = 4;
export const BUBBLEBREATH_PARTICLE_ID = null;
export const BUBBLEBREATH_FORWARD = 0.30;
export const BUBBLEBREATH_HEIGHT = 1.30;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function normCount(v) { const n = finiteOrNull(v); if (n === null || n < 0) return 0; return Math.floor(n); }

export function bubblebreathJitterMs(fireCount) {
  try {
    const n = normCount(fireCount);
    const frac = Math.abs(Math.sin((n + 1) * 12.9898) * 43758.5453) % 1;
    return Math.floor(frac * 2 * BUBBLEBREATH_JITTER_MS) - BUBBLEBREATH_JITTER_MS;
  } catch { return 0; }
}
export function bubblebreathIntervalFor(fireCount) {
  try { return BUBBLEBREATH_INTERVAL_BASE_MS + bubblebreathJitterMs(fireCount); }
  catch { return BUBBLEBREATH_INTERVAL_BASE_MS; }
}
export function isBubblebreathSuppressed(input) {
  try {
    if (!input || typeof input !== "object") return false;
    return input.suppressed === true || input.inCombat === true || input.combat === true
      || input.danger === true || input.falling === true || input.isFalling === true
      || input.selfFalling === true || input.portalSteadyActive === true || input.portalsteadyActive === true;
  } catch { return false; }
}
export function bubblebreathDue(lastFiredAtMs, nowMs, fireCount) {
  try {
    const last = finiteOrNull(lastFiredAtMs), now = finiteOrNull(nowMs);
    if (last === null || now === null || now < last) return false;
    return now - last >= bubblebreathIntervalFor(fireCount);
  } catch { return false; }
}
export function shouldBubblebreath(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.inWater !== true) return false;
    const sub = finiteOrNull(input.submergedMs);
    if (sub === null || sub < BUBBLEBREATH_MIN_SUBMERGED_MS) return false;
    if (isBubblebreathSuppressed(input)) return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;
    const next = input.nextDueAtMs !== undefined ? finiteOrNull(input.nextDueAtMs) : finiteOrNull(input.nextAtMs);
    if (next !== null) return now >= next;
    const last = input.lastFiredAtMs !== undefined ? input.lastFiredAtMs : input.lastFiredMs;
    if (finiteOrNull(last) !== null) return bubblebreathDue(last, now, input.fireCount);
    return true; // 初回: 滞在到達そのものが発火条件 (状態機械が入口予約を管理)
  } catch { return false; }
}
export function bubblebreathParticleCount(fireCount) {
  try {
    const n = finiteOrNull(fireCount);
    if (n === null || n < 0) return BUBBLEBREATH_PARTICLE_COUNT;
    return 3 + (Math.floor(n) % 3);
  } catch { return BUBBLEBREATH_PARTICLE_COUNT; }
}
export function bubblebreathOffset(headYawDeg, forwardArg) {
  try {
    const f0 = forwardArg === undefined ? BUBBLEBREATH_FORWARD : finiteOrNull(forwardArg);
    const f = f0 === null ? 0 : Math.max(0, Math.min(1, f0));
    const yaw = finiteOrNull(headYawDeg);
    if (yaw === null) return { x: 0, y: BUBBLEBREATH_HEIGHT, z: 0 };
    const rad = yaw * Math.PI / 180;
    const x = -Math.sin(rad) * f, z = Math.cos(rad) * f;
    return { x: x === 0 ? 0 : x, y: BUBBLEBREATH_HEIGHT, z: z === 0 ? 0 : z };
  } catch { return { x: 0, y: BUBBLEBREATH_HEIGHT, z: 0 }; }
}
export function createBubblebreathState() {
  return { wasInWater: null, submergedSinceMs: null, nextDueAtMs: null, lastFiredAtMs: null, fireCount: 0 };
}
export function sampleBubblebreath(state, nowMs) {
  try {
    if (!state || typeof state !== "object") return { submergedMs: null, nextDueInMs: null };
    const now = finiteOrNull(nowMs);
    const since = finiteOrNull(state.submergedSinceMs);
    const submergedMs = (state.wasInWater === true && since !== null && now !== null) ? Math.max(0, now - since) : null;
    const due = finiteOrNull(state.nextDueAtMs);
    const nextDueInMs = (due !== null && now !== null) ? Math.max(0, due - now) : null;
    return { submergedMs, nextDueInMs };
  } catch { return { submergedMs: null, nextDueInMs: null }; }
}
export function stepBubblebreath(state, sample, nowMs) {
  const idle = { fired: false, particleCount: 0, submergedMs: null };
  try {
    if (!state || typeof state !== "object") return idle;
    const now = finiteOrNull(nowMs);
    if (now === null) return idle;
    const sm = sample && typeof sample === "object" ? sample : {};
    if (sm.inWater === true) {
      if (state.wasInWater !== true || state.submergedSinceMs === null) {
        // 入水の辺 (または抑制で途切れた後の再開): 滞在計測と初回予約を最初から
        state.wasInWater = true; state.submergedSinceMs = now; state.nextDueAtMs = now + BUBBLEBREATH_MIN_SUBMERGED_MS;
        return { fired: false, particleCount: 0, submergedMs: 0 };
      }
      if (finiteOrNull(state.submergedSinceMs) !== null && now < state.submergedSinceMs) {
        state.submergedSinceMs = now; state.nextDueAtMs = now + BUBBLEBREATH_MIN_SUBMERGED_MS;
        return { fired: false, particleCount: 0, submergedMs: 0 };
      }
      if (isBubblebreathSuppressed(sm)) {
        // 抑制中は連続滞在を途切れさせる (pause しない: 解除直後の遅れ発火を構造的に防ぐ)
        state.submergedSinceMs = null; state.nextDueAtMs = null;
        return { fired: false, particleCount: 0, submergedMs: null };
      }
      const submergedMs = now - state.submergedSinceMs;
      const due = finiteOrNull(state.nextDueAtMs);
      if (due !== null && now >= due) {
        state.fireCount = normCount(state.fireCount) + 1;
        state.lastFiredAtMs = now;
        state.nextDueAtMs = now + bubblebreathIntervalFor(state.fireCount);
        return { fired: true, particleCount: bubblebreathParticleCount(state.fireCount), submergedMs };
      }
      return { fired: false, particleCount: 0, submergedMs };
    }
    if (sm.inWater === false) {
      state.wasInWater = false; state.submergedSinceMs = null; state.nextDueAtMs = null;
      return idle;
    }
    // UNKNOWN: 状態を保持し現在値だけ返す
    return { fired: false, particleCount: 0, submergedMs: sampleBubblebreath(state, now).submergedMs };
  } catch { return idle; }
}
export function noteBubblebreath(state, sample, nowMs) {
  try { return stepBubblebreath(state, sample, nowMs).fired === true; } catch { return false; }
}
