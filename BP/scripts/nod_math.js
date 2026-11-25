// nod_math.js — 納品完了時の小さな頷き POLISH-ANIM-NOD-01 (純粋核)
// 出典: brain_parts/solutions/polish-backlog/BACKLOG.md (cycle0841 発案)
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// 表示層のみ: 納品可否・個数・統計には一切触らない。INSPECT (取得時・32度・0.8秒)
// とは別イベント (納品時・12度・0.6秒の単一の沈み込み) で、消費点は applyGaze のみ。
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX } from "./gaze_math.js";

export const NOD_DURATION_MS = 600;
export const NOD_MAX_DEG = 12;
export const NOD_COOLDOWN_MS = 10000;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// nodPitchOffset(elapsedMs) -> 追加ピッチ (度, 下向き正) | null
// 単一の沈み込み: 0〜0.35 で沈み (sin), 0.35〜0.6 保持, 0.6〜1 復帰 (cos)。
export function nodPitchOffset(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= NOD_DURATION_MS) return null;
    const t = e / NOD_DURATION_MS;
    const k = t < 0.35 ? Math.sin((t / 0.35) * Math.PI / 2)
            : t < 0.6 ? 1
            : Math.cos(((t - 0.6) / 0.4) * Math.PI / 2);
    return NOD_MAX_DEG * k;
  } catch { return null; }
}

export function applyNodPitch(basePitchDeg, elapsedMs) {
  try {
    const off = nodPitchOffset(elapsedMs);
    if (off === null || !Number.isFinite(basePitchDeg)) return basePitchDeg;
    return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

export function isNodActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    return nodPitchOffset(n - s) !== null;
  } catch { return false; }
}

export function nodDue(lastFiredMs, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    const last = finiteOrNull(lastFiredMs);
    if (last === null) return true;
    return n - last >= NOD_COOLDOWN_MS;
  } catch { return false; }
}

// shouldNod(input): input { moved, lastFiredMs, nowMs }
// 納品で実際に1個以上渡せたときだけ。moved 非正・非数は false。
export function shouldNod(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (typeof input.moved !== "number" || !Number.isFinite(input.moved) || input.moved <= 0) return false;
    return nodDue(input.lastFiredMs, input.nowMs);
  } catch { return false; }
}
