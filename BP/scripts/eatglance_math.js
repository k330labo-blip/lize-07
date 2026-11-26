// eatglance_math.js — POLISH-ANIM-EATGLANCE-01 純粋核 (cyc2157 統合、cyc2363 feeder 接続済み・実機確認待ち)
// リゼ自身の飲食開始を発火源に、飲食中だけ視線ピッチを手元へ落とす表示層のみの演出。
// 食べ物は最大 +9度・約1300ms (咀嚼に合わせた ±2度の微振動つき)、飲み物は最大 +6度・
// 約1050ms。種別不明では発火しない。冷却20秒、連食では最初の1回だけ。
// 仕様の正: brain_parts/solutions/polish-eatglance/HANDOFF.md
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。時刻は引数で受け取る。
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX } from "./gaze_math.js";

export const EATGLANCE_FOOD_DURATION_MS = 1300;
export const EATGLANCE_DRINK_DURATION_MS = 1050;
export const EATGLANCE_FOOD_MAX_PITCH_DEG = 9;
export const EATGLANCE_DRINK_MAX_PITCH_DEG = 6;
export const EATGLANCE_CHEW_AMP_DEG = 2;
export const EATGLANCE_CONFIRM_COUNT = 2;
export const EATGLANCE_COOLDOWN_MS = 20000;

const RISE_END = 200, HOLD_END_RATIO = 0.62;

export function eatGlanceDurationMs(kind) { return kind === "drink" ? EATGLANCE_DRINK_DURATION_MS : EATGLANCE_FOOD_DURATION_MS; }
export function eatGlanceMaxPitchDeg(kind) { return kind === "drink" ? EATGLANCE_DRINK_MAX_PITCH_DEG : EATGLANCE_FOOD_MAX_PITCH_DEG; }

export function createEatGlanceState() {
  return { wasEating: false, candidateCount: 0, kind: null, firedAtMs: null, lastFiredMs: null, startedAtMs: null };
}

function validTime(v) { return typeof v === "number" && Number.isFinite(v); }
function validKind(k) { return k === "food" || k === "drink"; }

// リゼ自身の飲食観測を供給する (feeder は飲食成功辺から呼ぶ想定。新規走査なし)。
export function noteOwnEating(state, input) {
  try {
    if (!state || typeof state !== "object") return { fired: false, reason: "invalid" };
    if (!input || typeof input !== "object" || typeof input.eating !== "boolean") return { fired: false, reason: "invalid" };
    const nowMs = validTime(input.nowMs) ? input.nowMs : 0;
    if (!input.eating) {
      state.wasEating = false; state.candidateCount = 0; state.kind = null;
      return { fired: false, reason: "not_eating" };
    }
    if (state.wasEating && state.candidateCount >= EATGLANCE_CONFIRM_COUNT) {
      return { fired: false, reason: "continuing" }; // 連食では最初の1回だけ
    }
    if (!validKind(input.kind)) {
      // 種別不明の観測は候補に数えない (誤発火防止)
      return { fired: false, reason: "unknown_kind" };
    }
    if (state.kind !== input.kind) { state.kind = input.kind; state.candidateCount = 0; }
    state.candidateCount += 1;
    if (state.candidateCount < EATGLANCE_CONFIRM_COUNT) return { fired: false, reason: "confirming" };
    // 確定: 辺は消費する (抑制・重畳・冷却でも遅れて発火しない)
    state.wasEating = true;
    if (input.suppressed === true) return { fired: false, reason: "suppressed" };
    if (input.overlayActive === true) return { fired: false, reason: "overlay" };
    if (state.lastFiredMs != null && nowMs - state.lastFiredMs < EATGLANCE_COOLDOWN_MS) {
      return { fired: false, reason: "cooldown" };
    }
    state.firedAtMs = nowMs; state.lastFiredMs = nowMs; state.startedAtMs = nowMs;
    return { fired: true, reason: "fired", kind: state.kind };
  } catch { return { fired: false, reason: "invalid" }; }
}

export function eatGlanceOffset(elapsedMs, kind) {
  try {
    if (!validKind(kind)) return null;
    const dur = eatGlanceDurationMs(kind);
    if (!validTime(elapsedMs) || elapsedMs < 0 || elapsedMs >= dur) return null;
    const max = eatGlanceMaxPitchDeg(kind);
    const holdEnd = dur * HOLD_END_RATIO;
    const e = elapsedMs;
    if (e < RISE_END) {
      const t = e / RISE_END; const ease = 1 - (1 - t) * (1 - t);
      return { gazePitchDeg: max * ease, phase: "rise" };
    }
    if (e < holdEnd) {
      // 咀嚼の微振動は食べ物だけ (飲み物は静止保持)
      const chew = kind === "food" ? EATGLANCE_CHEW_AMP_DEG * Math.sin((e - RISE_END) / 140 * Math.PI) * 0.5 : 0;
      return { gazePitchDeg: max + chew, phase: "hold" };
    }
    const t = (e - holdEnd) / (dur - holdEnd);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    return { gazePitchDeg: max * (1 - ease), phase: "return" };
  } catch { return null; }
}

export function applyEatGlancePitch(basePitchDeg, elapsedMs, kind) {
  try {
    if (!validTime(basePitchDeg)) return basePitchDeg;
    const off = eatGlanceOffset(elapsedMs, kind);
    if (!off) return basePitchDeg;
    return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + off.gazePitchDeg));
  } catch { return basePitchDeg; }
}

export function isEatGlanceActive(startedAtMs, nowMs, kind) {
  try {
    if (!validTime(startedAtMs) || !validTime(nowMs)) return false;
    return eatGlanceOffset(nowMs - startedAtMs, kind) !== null;
  } catch { return false; }
}
