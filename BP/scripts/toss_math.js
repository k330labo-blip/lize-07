// toss_math.js — アイテム出現時の小さな投げ出し表現 POLISH-ANIM-TOSS-01 (純粋核)
// 出典: brain_parts/solutions/polish-backlog/POLISH-NEW-cycle1343-a14.md
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// 表示層のみ: アイテム出現のタイミング・位置・個数には一切触らない。
// 軌道: 0→150ms で前方 -35 度 (ピーク) →400ms で 0 へ戻る単一の山形。
// 視線は連動して +10 度まで下がる。クールダウン 2 秒。抑制中は辺を消費する。
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX } from "./gaze_math.js";

export const TOSS_DURATION_MS = 400;
export const TOSS_PEAK_MS = 150;
export const TOSS_ARM_MAX_DEG = 35;
export const TOSS_GAZE_MAX_DEG = 10;
export const TOSS_COOLDOWN_MS = 2000;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// tossArmPitchDeg(elapsedMs) -> 腕ピッチ (度, 前方へ振り出す向きを負) | null
export function tossArmPitchDeg(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= TOSS_DURATION_MS) return null;
    const k = e <= TOSS_PEAK_MS ? e / TOSS_PEAK_MS : 1 - (e - TOSS_PEAK_MS) / (TOSS_DURATION_MS - TOSS_PEAK_MS);
    return -TOSS_ARM_MAX_DEG * k;
  } catch { return null; }
}

export function tossGazePitchOffset(elapsedMs) {
  try {
    const a = tossArmPitchDeg(elapsedMs);
    if (a === null) return null;
    return TOSS_GAZE_MAX_DEG * (-a / TOSS_ARM_MAX_DEG);
  } catch { return null; }
}

export function applyTossPitch(basePitchDeg, elapsedMs) {
  try {
    const off = tossGazePitchOffset(elapsedMs);
    if (off === null || !Number.isFinite(basePitchDeg)) return basePitchDeg;
    return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

export function isTossActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    return tossArmPitchDeg(n - s) !== null;
  } catch { return false; }
}

// shouldToss(input): { spawned===true, suppressed===true?, lastFiredMs, nowMs }
// 出現成功の辺でのみ。抑制中・クールダウン中は false (辺は消費され遅れ発火しない)。
export function shouldToss(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.spawned !== true) return false;
    if (input.suppressed === true) return false;
    const n = finiteOrNull(input.nowMs);
    if (n === null) return false;
    const last = finiteOrNull(input.lastFiredMs);
    if (last === null) return true;
    return n - last >= TOSS_COOLDOWN_MS;
  } catch { return false; }
}
