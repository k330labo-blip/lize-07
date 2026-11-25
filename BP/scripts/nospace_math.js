// nospace_math.js — POLISH-ANIM-NOSPACE-01 (cycle0446 発案 / cycle0537 統合): 満杯で拾えない辺の小さな首振り (純粋核)
// 発火源は TAKE の INVENTORY_FULL (r.lastTake)。小さく左右へ2往復するヨーで「入りません」を伝える。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。表示層のみ。
export const NOSPACE_DURATION_MS = 600;
export const NOSPACE_MAX_YAW_DEG = 6;
export const NOSPACE_COOLDOWN_MS = 8000;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// nospaceYawOffset(elapsedMs) -> 追加ヨー (度) | null
export function nospaceYawOffset(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= NOSPACE_DURATION_MS) return null;
    const t = e / NOSPACE_DURATION_MS;
    const env = Math.sin(t * Math.PI); // 0->1->0 envelope
    return NOSPACE_MAX_YAW_DEG * env * Math.sin(t * Math.PI * 4);
  } catch { return null; }
}

export function applyNospaceYaw(baseYawDeg, elapsedMs) {
  try {
    const off = nospaceYawOffset(elapsedMs);
    if (off === null || !Number.isFinite(baseYawDeg)) return baseYawDeg;
    return baseYawDeg + off;
  } catch { return baseYawDeg; }
}

export function isNospaceActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    return nospaceYawOffset(n - s) !== null;
  } catch { return false; }
}

// shouldNospace(input): { full, suppressed, lastFiredMs, nowMs }
export function shouldNospace(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.full !== true || input.suppressed === true) return false;
    const n = finiteOrNull(input.nowMs);
    if (n === null) return false;
    const last = finiteOrNull(input.lastFiredMs);
    if (last === null) return true;
    return n - last >= NOSPACE_COOLDOWN_MS;
  } catch { return false; }
}
