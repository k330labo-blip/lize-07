// flowersniff_math.js — POLISH-ANIM-FLOWERSNIFF-01 (cycle0583): 花の近くで一度だけ顔を寄せる視線の純粋核。表示層のみ。
// feeder未接続（花検出の安定供給源が無いため記録のみ）。例外を投げない。
export const FLOWERSNIFF_COOLDOWN_MS = 30000;
export const FLOWERSNIFF_DURATION_MS = 900;
export const FLOWERSNIFF_PEAK_PITCH_DEG = 10;
export function createFlowerSniffState() { return { lastFiredAt: 0, armed: true }; }
export function flowerSniffPitch(state, input) {
  try {
    const now = Number(input?.nowMs) || 0;
    if (!input?.nearFlower || input?.suppressed) return { state, pitch: 0, fired: false };
    if (!state.armed || (state.lastFiredAt && now - state.lastFiredAt < FLOWERSNIFF_COOLDOWN_MS)) return { state, pitch: 0, fired: false };
    const next = { lastFiredAt: now, armed: false };
    return { state: next, pitch: FLOWERSNIFF_PEAK_PITCH_DEG, fired: true, durationMs: FLOWERSNIFF_DURATION_MS };
  } catch { return { state, pitch: 0, fired: false }; }
}
export function rearmFlowerSniff(state, input) { try { if (input?.farFromFlower) return { ...state, armed: true }; return state; } catch { return state; } }
