// levelupnod_math.js — POLISH-ANIM-LEVELUPNOD-01 純粋核 (cyc2059 統合、純粋核先行・feeder 未接続)
// 主人の経験値レベルの上昇を2回連続観測で確定した辺でのみ、小さな無言の頷き
// (ピッチ +7度・550ms・冷却30秒) の波形と発火判定を提供する。表示層のみ・挙動不変。
// 仕様の正: brain_parts/solutions/polish-backlog/cyc2043_a10_newidea.md
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。時刻は引数で受け取る。
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX } from "./gaze_math.js";

export const LEVELUPNOD_DURATION_MS = 550;
export const LEVELUPNOD_MAX_PITCH_DEG = 7;
export const LEVELUPNOD_CONFIRM_COUNT = 2;
export const LEVELUPNOD_COOLDOWN_MS = 30000;

const DIP_END = 180, HOLD_END = 330;

export function createLevelupNodState() {
  return { baselineLevel: null, candidateLevel: null, candidateCount: 0, firedAtMs: null, lastFiredMs: null, startedAtMs: null };
}

function validLevel(v) { return typeof v === "number" && Number.isFinite(v) && v >= 0; }
function validTime(v) { return typeof v === "number" && Number.isFinite(v); }

export function noteOwnerLevel(state, input) {
  try {
    if (!state || typeof state !== "object") return { fired: false, fromLevel: null, toLevel: null, reason: "invalid" };
    if (!input || typeof input !== "object" || !validLevel(input.level)) {
      return { fired: false, fromLevel: state.baselineLevel ?? null, toLevel: null, reason: "invalid" };
    }
    const level = Math.floor(input.level);
    const nowMs = validTime(input.nowMs) ? input.nowMs : 0;
    if (state.baselineLevel == null || input.dimensionChanged === true) {
      state.baselineLevel = level; state.candidateLevel = null; state.candidateCount = 0;
      return { fired: false, fromLevel: level, toLevel: level, reason: "baseline" };
    }
    const base = state.baselineLevel;
    if (level < base) {
      state.baselineLevel = level; state.candidateLevel = null; state.candidateCount = 0;
      return { fired: false, fromLevel: base, toLevel: level, reason: "decrease" };
    }
    if (level === base) {
      state.candidateLevel = null; state.candidateCount = 0;
      return { fired: false, fromLevel: base, toLevel: level, reason: "same" };
    }
    // level > base: 候補として数える
    if (state.candidateLevel === level) state.candidateCount += 1;
    else { state.candidateLevel = level; state.candidateCount = 1; }
    if (state.candidateCount < LEVELUPNOD_CONFIRM_COUNT) {
      return { fired: false, fromLevel: base, toLevel: level, reason: "confirming" };
    }
    // 確定: 基準値は常時更新し、辺は消費する (遅れて発火しない)
    const from = base;
    state.baselineLevel = level; state.candidateLevel = null; state.candidateCount = 0;
    if (input.suppressed === true) return { fired: false, fromLevel: from, toLevel: level, reason: "suppressed" };
    if (input.overlayActive === true) return { fired: false, fromLevel: from, toLevel: level, reason: "overlay" };
    if (state.lastFiredMs != null && nowMs - state.lastFiredMs < LEVELUPNOD_COOLDOWN_MS) {
      return { fired: false, fromLevel: from, toLevel: level, reason: "cooldown" };
    }
    state.firedAtMs = nowMs; state.lastFiredMs = nowMs; state.startedAtMs = nowMs;
    return { fired: true, fromLevel: from, toLevel: level, reason: "fired" };
  } catch { return { fired: false, fromLevel: null, toLevel: null, reason: "invalid" }; }
}

export function levelupNodOffset(elapsedMs) {
  try {
    if (!validTime(elapsedMs) || elapsedMs < 0 || elapsedMs >= LEVELUPNOD_DURATION_MS) return null;
    const e = elapsedMs;
    if (e < DIP_END) {
      const t = e / DIP_END; const ease = 1 - (1 - t) * (1 - t);
      return { gazePitchDeg: LEVELUPNOD_MAX_PITCH_DEG * ease, phase: "dip" };
    }
    if (e < HOLD_END) return { gazePitchDeg: LEVELUPNOD_MAX_PITCH_DEG, phase: "hold" };
    const t = (e - HOLD_END) / (LEVELUPNOD_DURATION_MS - HOLD_END);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    return { gazePitchDeg: LEVELUPNOD_MAX_PITCH_DEG * (1 - ease), phase: "return" };
  } catch { return null; }
}

export function applyLevelupNodPitch(basePitchDeg, elapsedMs) {
  try {
    if (!validTime(basePitchDeg)) return basePitchDeg;
    const off = levelupNodOffset(elapsedMs);
    if (!off) return basePitchDeg;
    return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + off.gazePitchDeg));
  } catch { return basePitchDeg; }
}

export function isLevelupNodActive(startedAtMs, nowMs) {
  try {
    if (!validTime(startedAtMs) || !validTime(nowMs)) return false;
    return levelupNodOffset(nowMs - startedAtMs) !== null;
  } catch { return false; }
}
