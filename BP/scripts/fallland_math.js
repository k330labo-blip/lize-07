// fallland_math.js — POLISH-ANIM-FALLLAND-01 純粋核 (cycle0057)
// 落下ポーズ＋着地クッションの判定だけを行う純粋モジュール。
// 正: brain_parts/solutions/cycle0616-a05/BACKLOG.md + anim_fall_land_draft.js (テスト9/9)
// 純粋: @minecraft/server import なし・相対 import なし・Date.now/乱数なし・例外を投げない。
// 表示層のみ: 移動・落下ダメージ・掘削には一切触らない。sink/arm は RP 受け口が無い間は記録専用。
export const FALLLAND_TUNING = {
  fallEnterDyPerSec: -3.2, fallExitDyPerSec: -1.0, minFallBlocks: 1.6,
  landDurationMs: 280, landTierMid: 3.0, landTierHard: 6.0,
  landSink: [0.0, 0.08, 0.13, 0.18],
};
export const FALLLAND_LAND_PITCH_DEG = [0, 4, 7, 10]; // tier別の着地ピッチ (下向き正)
function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
export function createFallLandState() {
  return { mode: "ground", peakFall: 0, fallDist: 0, landUntil: 0, landTier: 0, landAt: 0, episode: 0 };
}
export function onVerticalStep(st, dy, dtSec, grounded, nowMs) {
  const T = FALLLAND_TUNING;
  const out = { animState: null, fallAmount: 0, event: null, landTier: 0 };
  try {
    if (!st || typeof st !== "object") return out;
    const d = fin(dy), dt = fin(dtSec), now = fin(nowMs);
    if (d === null || dt === null || dt <= 0 || now === null) return out;
    if (st.mode === "land") {
      if (now < st.landUntil) { out.animState = "land"; out.landTier = st.landTier; return out; }
      st.mode = "ground"; st.fallDist = 0; st.peakFall = 0;
    }
    const vy = d / dt;
    if (!grounded && vy < T.fallEnterDyPerSec) {
      if (st.mode !== "fall") { st.mode = "fall"; st.fallDist = 0; out.event = "fall_start"; }
      st.fallDist += -d; st.peakFall = Math.max(st.peakFall || 0, -vy);
      out.animState = "fall";
      out.fallAmount = Math.min(1, Math.max(0, (st.fallDist - T.minFallBlocks) / 6));
      return out;
    }
    if (st.mode === "fall") {
      const dist = st.fallDist || 0;
      st.mode = "ground"; st.fallDist = 0; st.peakFall = 0;
      if (grounded && dist >= T.minFallBlocks) {
        const tier = dist >= T.landTierHard ? 3 : dist >= T.landTierMid ? 2 : 1;
        st.mode = "land"; st.landTier = tier; st.landAt = now; st.landUntil = now + T.landDurationMs;
        st.episode = (fin(st.episode) || 0) + 1;
        out.animState = "land"; out.event = "land"; out.landTier = tier;
      }
      return out;
    }
    return out;
  } catch { return out; }
}
// falllandCurrent(state, nowMs) -> { active, mode, pitchDeg, sink, fallAmount, landTier, episode }
// land 中はピッチが sin 波で 0→peak→0、fall 中は fallAmount に応じた小さな上向き (-3度まで)。
export function falllandCurrent(st, nowMs) {
  const zero = { active: false, mode: "ground", pitchDeg: 0, sink: 0, fallAmount: 0, landTier: 0, episode: 0 };
  try {
    if (!st || typeof st !== "object") return zero;
    const now = fin(nowMs); if (now === null) return zero;
    const ep = fin(st.episode) || 0;
    if (st.mode === "land") {
      const at = fin(st.landAt) || 0, until = fin(st.landUntil) || 0;
      if (now < at || now >= until || until <= at) return { ...zero, episode: ep };
      const k = Math.sin(Math.PI * (now - at) / (until - at));
      const tier = [1,2,3].includes(st.landTier) ? st.landTier : 1;
      return { active: true, mode: "land", pitchDeg: FALLLAND_LAND_PITCH_DEG[tier] * k, sink: FALLLAND_TUNING.landSink[tier] * k, fallAmount: 0, landTier: tier, episode: ep };
    }
    if (st.mode === "fall") {
      const fa = Math.min(1, Math.max(0, ((fin(st.fallDist) || 0) - FALLLAND_TUNING.minFallBlocks) / 6));
      return { active: true, mode: "fall", pitchDeg: -3 * fa, sink: 0, fallAmount: fa, landTier: 0, episode: ep };
    }
    return { ...zero, episode: ep };
  } catch { return zero; }
}
