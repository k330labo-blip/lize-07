// gaze_cadence_math.js — 0-E1 GAZE-CADENCE-01: 視線サンプリングの純粋核。
// 本体ループ (10tick=500ms) では 450〜600ms 級の視線波形が 1〜2 回しか
// サンプリングされず、位相0のサンプルだけだとピークが一度も適用されない。
// 視線レイヤーを 2tick (100ms) で回すと同波形は 4〜6 回サンプリングされ、
// ピーク近傍が必ず適用されることを、波形サンプリングの実測で担保する。
// @minecraft/server を import しない。例外を投げない。
export const GAZE_REPLAY_INTERVAL_TICKS = 2;
export const GAZE_ARGS_MAX_AGE_MS = 1200;
// 掘り終わりの見下ろし等と同じ形: 0→peak→0 の三角波 (持続 durationMs)
export function triangleWave(elapsedMs, durationMs, peakDeg) {
  try {
    if (!(durationMs > 0) || elapsedMs < 0 || elapsedMs > durationMs) return 0;
    const half = durationMs / 2;
    const v = elapsedMs <= half ? (elapsedMs / half) : (1 - (elapsedMs - half) / half);
    return v * peakDeg;
  } catch { return 0; }
}
// intervalMs ごとにサンプリングしたとき、実際に適用される最大角度と回数
export function sampleWavePeak(durationMs, peakDeg, intervalMs, phaseMs = 0) {
  try {
    let max = 0, samples = 0;
    for (let t = phaseMs; t <= durationMs; t += intervalMs) { const v = triangleWave(t, durationMs, peakDeg); if (v > max) max = v; samples++; }
    return { maxDeg: max, samples };
  } catch { return { maxDeg: 0, samples: 0 }; }
}
// 最悪位相 (発火直後が位相0) でもピーク比が guarantee 以上になるか
export function worstPhasePeakRatio(durationMs, intervalMs) {
  try {
    let worst = 1;
    for (let phase = 0; phase < intervalMs; phase += 10) {
      const r = sampleWavePeak(durationMs, 1, intervalMs, phase);
      // 位相サンプルが波形内に入らない場合は 0 扱い
      const ratio = r.samples ? r.maxDeg : 0;
      if (ratio < worst) worst = ratio;
    }
    return worst;
  } catch { return 0; }
}
// キャッシュした視線引数を再適用してよいか (古い走査結果を長く使わない)
export function shouldReplayGaze(nowMs, argsAtMs) {
  try {
    if (!Number.isFinite(nowMs) || !Number.isFinite(argsAtMs) || !argsAtMs) return false;
    const age = nowMs - argsAtMs;
    return age >= 0 && age <= GAZE_ARGS_MAX_AGE_MS;
  } catch { return false; }
}
