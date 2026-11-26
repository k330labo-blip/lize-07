// shiver_math.js — POLISH-ANIM-SHIVER-01 純粋核 (cyc2134 統合、純粋核先行・feeder 未接続)
// 寒冷環境 (雪原・凍結帯・冷水上がり) で待機しているときだけ、小刻みな震え
// (視線ヨー ±1.1度・約9Hz・900ms の減衰波形) を提供する。表示層のみ・挙動不変。
// 発火は「寒冷が2回連続観測で確定」「移動中・作業中は出さない」「冷却20秒」で抑制する。
// 仕様の正: brain_parts/solutions/polish-backlog/cyc2134_shiver.md
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。時刻は引数で受け取る。
const YAW_MIN = -180, YAW_MAX = 180;

export const SHIVER_DURATION_MS = 900;
export const SHIVER_MAX_YAW_DEG = 1.1;
export const SHIVER_FREQ_HZ = 9;
export const SHIVER_CONFIRM_COUNT = 2;
export const SHIVER_COOLDOWN_MS = 20000;

export function createShiverState() {
  return { coldCount: 0, firedAtMs: null, lastFiredMs: null, startedAtMs: null };
}

function validTime(v) { return typeof v === "number" && Number.isFinite(v); }

// input: { cold: boolean, busy: boolean, moving: boolean, suppressed: boolean, nowMs }
// cold は feeder 側が「雪系バイオーム/凍結水際/夜間の高所」等の観測から決める真偽値。
export function noteShiverSample(state, input) {
  try {
    if (!state || typeof state !== "object") return { fired: false, reason: "invalid" };
    if (!input || typeof input !== "object") return { fired: false, reason: "invalid" };
    const nowMs = validTime(input.nowMs) ? input.nowMs : 0;
    if (input.cold !== true) {
      state.coldCount = 0;
      return { fired: false, reason: "warm" };
    }
    state.coldCount += 1;
    if (state.coldCount < SHIVER_CONFIRM_COUNT) return { fired: false, reason: "confirming" };
    // 寒冷の辺はここで消費する (後から条件が揃っても遅れて発火しない)
    state.coldCount = 0;
    if (input.busy === true) return { fired: false, reason: "busy" };
    if (input.moving === true) return { fired: false, reason: "moving" };
    if (input.suppressed === true) return { fired: false, reason: "suppressed" };
    if (state.lastFiredMs != null && nowMs - state.lastFiredMs < SHIVER_COOLDOWN_MS) {
      return { fired: false, reason: "cooldown" };
    }
    state.firedAtMs = nowMs; state.lastFiredMs = nowMs; state.startedAtMs = nowMs;
    return { fired: true, reason: "fired" };
  } catch { return { fired: false, reason: "invalid" }; }
}

export function shiverOffset(elapsedMs) {
  try {
    if (!validTime(elapsedMs) || elapsedMs < 0 || elapsedMs >= SHIVER_DURATION_MS) return null;
    const decay = 1 - elapsedMs / SHIVER_DURATION_MS;
    const yaw = SHIVER_MAX_YAW_DEG * decay * Math.sin((elapsedMs / 1000) * SHIVER_FREQ_HZ * Math.PI * 2);
    return { gazeYawDeg: yaw, phase: elapsedMs < 450 ? "strong" : "fading" };
  } catch { return null; }
}

export function applyShiverYaw(baseYawDeg, elapsedMs) {
  try {
    if (!validTime(baseYawDeg)) return baseYawDeg;
    const off = shiverOffset(elapsedMs);
    if (!off) return baseYawDeg;
    return Math.max(YAW_MIN, Math.min(YAW_MAX, baseYawDeg + off.gazeYawDeg));
  } catch { return baseYawDeg; }
}

export function isShiverActive(startedAtMs, nowMs) {
  try {
    if (!validTime(startedAtMs) || !validTime(nowMs)) return false;
    return shiverOffset(nowMs - startedAtMs) !== null;
  } catch { return false; }
}
