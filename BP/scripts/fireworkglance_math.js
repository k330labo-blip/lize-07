// fireworkglance_math.js — POLISH-ANIM-FIREWORKGLANCE-01 純粋核 (cycle1058, a08 契約)
// 近くで花火 (minecraft:fireworks_rocket) が上がった瞬間に一度だけ空を見上げる視線の波形。
// 純粋: @minecraft/server を import しない。Date.now/乱数なし (時刻は引数)。例外を投げない。
// 表示層のみ: 移動・作業・掘削には触らない。種別 (fireworks_rocket) の絞りは feeder の責務で、本核は種別を知らない。
// 本サイクルは純粋核先行統合 (読み手ゼロ・記録のみ想定、RAINBOWGAZE と同作法)。feeder 接続は次段。
export const FIREWORK_PITCH_DEG = -22;      // 上向き (符号の最終確認は実機確認待ち)
export const FIREWORK_DURATION_MS = 1100;   // 台形: 立ち上がり200 + 保持600 + 復帰300
export const FIREWORK_RISE_MS = 200;
export const FIREWORK_HOLD_END_MS = 800;
export const FIREWORK_COOLDOWN_MS = 20000;
export const FIREWORK_DIST_MIN = 4;
export const FIREWORK_DIST_MAX = 24;
export const FIREWORK_DY_MIN = 2.0;
export const FIREWORK_YAW_BLEND = 0.5;
export const FIREWORK_YAW_MAX_DEG = 35;

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function createFireworkGlanceState() {
  return { lastFiredAtMs: null, pendingId: null, pendingCount: 0, firedId: null, active: null };
}
function sane(state) {
  if (!state || typeof state !== "object") return createFireworkGlanceState();
  if (!("lastFiredAtMs" in state)) state.lastFiredAtMs = null;
  if (!("pendingId" in state)) state.pendingId = null;
  if (!("pendingCount" in state)) state.pendingCount = 0;
  if (!("firedId" in state)) state.firedId = null;
  if (!("active" in state)) state.active = null;
  return state;
}
// noteFireworkGlance(state, input, nowMs) -> { fired, reason }
// input: { appeared, entityId, dist, dy, yawToDeg, suppressed }
export function noteFireworkGlance(state, input, nowMs) {
  try {
    const st = sane(state);
    const now = fin(nowMs); if (now === null) return { fired: false, reason: "invalid_time" };
    if (!input || typeof input !== "object") return { fired: false, reason: "invalid_input" };
    if (input.appeared !== true) {
      // 出現が消えたら pending/fired の保持を解除する (同一 id の再出現を別件として扱えるように)
      st.pendingId = null; st.pendingCount = 0; st.firedId = null;
      return { fired: false, reason: "absent" };
    }
    const id = typeof input.entityId === "string" && input.entityId ? input.entityId : null;
    if (id === null) return { fired: false, reason: "invalid_id" };
    if (st.firedId === id) return { fired: false, reason: "already_fired" };
    // 確定: 同一 id の2回連続観測
    if (st.pendingId === id) st.pendingCount = (st.pendingCount || 0) + 1;
    else { st.pendingId = id; st.pendingCount = 1; }
    if (st.pendingCount < 2) return { fired: false, reason: "pending" };
    // ここから先は確定済み。抑制・条件外でも辺と確定は消費する (遅れ発火しない)
    st.pendingId = null; st.pendingCount = 0; st.firedId = id;
    if (input.suppressed === true) return { fired: false, reason: "suppressed" };
    const dist = fin(input.dist), dy = fin(input.dy);
    if (dist === null || dy === null) return { fired: false, reason: "unknown_geometry" };
    if (dist < FIREWORK_DIST_MIN || dist > FIREWORK_DIST_MAX) return { fired: false, reason: "out_of_range" };
    if (dy < FIREWORK_DY_MIN) return { fired: false, reason: "too_low" };
    if (st.lastFiredAtMs !== null && now - st.lastFiredAtMs < FIREWORK_COOLDOWN_MS) return { fired: false, reason: "cooldown" };
    if (st.active && now - st.active.startedAtMs < FIREWORK_DURATION_MS) return { fired: false, reason: "already_active" };
    const yawIn = fin(input.yawToDeg);
    const yawDeg = yawIn === null ? 0 : clamp(yawIn * FIREWORK_YAW_BLEND, -FIREWORK_YAW_MAX_DEG, FIREWORK_YAW_MAX_DEG);
    st.active = { startedAtMs: now, yawDeg };
    st.lastFiredAtMs = now;
    return { fired: true, reason: "fired" };
  } catch { return { fired: false, reason: "error" }; }
}
// fireworkGlanceOffset(state, nowMs) -> { pitchDeg, yawDeg, active }
export function fireworkGlanceOffset(state, nowMs) {
  try {
    const st = sane(state); const now = fin(nowMs);
    if (now === null || !st.active) return { pitchDeg: 0, yawDeg: 0, active: false };
    const t = now - st.active.startedAtMs;
    if (t < 0 || t >= FIREWORK_DURATION_MS) return { pitchDeg: 0, yawDeg: 0, active: false };
    let k; if (t < FIREWORK_RISE_MS) k = t / FIREWORK_RISE_MS; else if (t < FIREWORK_HOLD_END_MS) k = 1; else k = 1 - (t - FIREWORK_HOLD_END_MS) / (FIREWORK_DURATION_MS - FIREWORK_HOLD_END_MS);
    return { pitchDeg: FIREWORK_PITCH_DEG * k, yawDeg: (fin(st.active.yawDeg) || 0) * k, active: true };
  } catch { return { pitchDeg: 0, yawDeg: 0, active: false }; }
}
