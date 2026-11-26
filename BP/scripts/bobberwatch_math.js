// bobberwatch_math.js — POLISH-ANIM-BOBBERWATCH-01 純粋核 (cycle1134, a08 設計)
// 主人が釣りをしている間、浮きを見守る持続視線 + ヒット時の小さな頷き。
// 純粋: @minecraft/server を import しない。時刻は引数。例外を投げない。表示層のみ。
// 本版は純粋核先行統合 (読み手ゼロ・feeder 未接続)。推測発火はしない。
export const BOBBER_CONFIRM_TICKS = 2;
export const BOBBER_YAW_PULL = 0.7;
export const BOBBER_YAW_MAX_DEG = 40;
export const BOBBER_PITCH_MAX_DEG = 18;
export const BOBBER_BITE_DIP = 0.18;
export const BOBBER_NOD_DEG = 6;
export const BOBBER_NOD_MS = 220;
export const BOBBER_NOD_COOLDOWN_MS = 4000;
export const BOBBER_OWNER_RANGE = 12;
export const BOBBER_RANGE = 20;
function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function createBobberWatchState() { return { watching: false, confirm: 0, lastBobberY: null, nodUntil: 0, nodCooldownUntil: 0, nodStartedAt: 0 }; }
// stepBobberWatch(state, obs, nowMs) -> { gaze:{yawDeg,pitchDeg}|null, nod:boolean }
// obs: { ownerFishing, ownerDist, bobber:{dx,dy,dz,y}|null, suppressed }
export function stepBobberWatch(st, obs, nowMs) {
  try {
    if (!st || typeof st !== "object") return { gaze: null, nod: false };
    const now = fin(nowMs) ?? 0;
    if (obs?.suppressed === true) return { gaze: null, nod: false };
    const bob = obs?.bobber || null;
    const ownerDist = fin(obs?.ownerDist);
    const bobDist = bob ? Math.hypot(fin(bob.dx) || 0, fin(bob.dy) || 0, fin(bob.dz) || 0) : null;
    const eligible = obs?.ownerFishing === true && !!bob && ownerDist !== null && ownerDist <= BOBBER_OWNER_RANGE && bobDist !== null && bobDist <= BOBBER_RANGE;
    if (!eligible) { st.watching = false; st.confirm = 0; st.lastBobberY = bob ? fin(bob.y) : null; return { gaze: null, nod: false }; }
    st.confirm = (st.confirm || 0) + 1;
    if (st.confirm < BOBBER_CONFIRM_TICKS) { st.lastBobberY = fin(bob.y); return { gaze: null, nod: false }; }
    st.watching = true;
    let nod = false;
    const y = fin(bob.y);
    if (y !== null && st.lastBobberY !== null && st.lastBobberY - y >= BOBBER_BITE_DIP && now >= (st.nodCooldownUntil || 0)) { nod = true; st.nodStartedAt = now; st.nodUntil = now + BOBBER_NOD_MS; st.nodCooldownUntil = now + BOBBER_NOD_COOLDOWN_MS; }
    if (y !== null) st.lastBobberY = y;
    const yawRaw = Math.atan2(-(fin(bob.dx) || 0), fin(bob.dz) || 0) * 180 / Math.PI;
    // feeder が相対角を渡す作法に合わせ、ここでは dx/dz から絶対角を作らず寄せ量は呼び手の相対角前提でクランプする。
    // 純粋核契約テストでは相対角を obs.relYawDeg で渡せる (任意)。
    const relYaw = fin(obs?.relYawDeg) ?? yawRaw;
    const yawDeg = clamp(relYaw * BOBBER_YAW_PULL, -BOBBER_YAW_MAX_DEG, BOBBER_YAW_MAX_DEG);
    const dy = fin(bob.dy) || 0;
    const pitchDeg = clamp(dy < 0 ? Math.atan2(-dy, Math.max(0.001, bobDist || 1)) * 180 / Math.PI : 0, 0, BOBBER_PITCH_MAX_DEG);
    let nodAdd = 0;
    if (now < (st.nodUntil || 0)) { const t = now - (st.nodStartedAt || now); const k = t < 60 ? t / 60 : t < 160 ? 1 : Math.max(0, 1 - (t - 160) / 60); nodAdd = BOBBER_NOD_DEG * k; }
    return { gaze: { yawDeg, pitchDeg: pitchDeg + nodAdd }, nod };
  } catch { return { gaze: null, nod: false }; }
}
