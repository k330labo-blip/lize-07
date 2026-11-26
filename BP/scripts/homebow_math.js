// homebow_math.js — POLISH-ANIM-HOMEBOW-01 (cyc1908、新規発案): 拠点へ入庫して仕事を終えた直後、
// 拠点の方へ小さく一度だけ頭を下げる「ただいま戻りました」の所作の純粋核。
// プレイヤーは帰還が完了したことを所作でも確認できる。表示層のみ、移動・作業判定には関与しない。実機確認待ち。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
export const HOMEBOW_COOLDOWN_MS = 30000;
export const HOMEBOW_DURATION_MS = 900;
export const HOMEBOW_BOW_DEG = 10;
function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
export function createHomebowState() { return { lastFiredMs: null }; }
function normalizeState(state) { const s = state && typeof state === "object" ? state : {}; return { lastFiredMs: fin(s.lastFiredMs) }; }
export function noteHomeArrival(state, input) {
  try {
    const prev = normalizeState(state);
    const inp = input && typeof input === "object" ? input : {};
    const now = fin(inp.nowMs);
    if (now === null) return { state: prev, fired: false };
    if (inp.suppressed === true || inp.danger === true || inp.falling === true || inp.deposited !== true) return { state: prev, fired: false };
    if (prev.lastFiredMs !== null && now - prev.lastFiredMs < HOMEBOW_COOLDOWN_MS) return { state: prev, fired: false };
    return { state: { lastFiredMs: now }, fired: true };
  } catch { return { state: normalizeState(state), fired: false }; }
}
export function sampleHomebow(state, nowMs) {
  try {
    const s = normalizeState(state);
    const now = fin(nowMs);
    if (s.lastFiredMs === null || now === null) return { active: false, pitchDeg: 0 };
    const t = now - s.lastFiredMs;
    if (t < 0 || t >= HOMEBOW_DURATION_MS) return { active: false, pitchDeg: 0 };
    const half = HOMEBOW_DURATION_MS / 2;
    const pitchDeg = t <= half ? HOMEBOW_BOW_DEG * (t / half) : HOMEBOW_BOW_DEG * (1 - (t - half) / half);
    return { active: true, pitchDeg };
  } catch { return { active: false, pitchDeg: 0 }; }
}
