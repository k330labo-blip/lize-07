// side_chase.js — SIDE-COOLDOWN-CHASE 是正の純粋核 (cycle1134)
// 寄り道候補への接近を保持し、クールダウン書込みは終端 (complete/abandon) でのみ行う。
// 純粋: @minecraft/server を import しない。時刻は引数。例外を投げない。
export const SIDE_CHASE = Object.freeze({ HOLD_MAX_MS: 30000, WORSEN_LIMIT: 3, DEFAULT_RANGE: 1.9 });
export function createSideChase() { return { activeKey: null, startedAtMs: null, lastDist: null, worsen: 0, task: null }; }
function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
// chaseTick(state, {task, distNow, candAlive, nowMs, range}) -> {phase, writeCooldown, key, reason?}
// task は scan が返した候補 (key を持つ)。candAlive は候補実体の存続 (scan の幾何ゲート合否ではない)。
export function chaseTick(st, inp) {
  try {
    if (!st || typeof st !== "object") return { phase: "idle", writeCooldown: false, key: null };
    if (!("activeKey" in st)) Object.assign(st, createSideChase());
    const now = fin(inp?.nowMs) ?? 0;
    const range = fin(inp?.range) ?? SIDE_CHASE.DEFAULT_RANGE;
    if (st.activeKey === null) {
      if (!inp?.task) return { phase: "idle", writeCooldown: false, key: null };
      st.activeKey = inp.task.key || null; st.task = inp.task; st.startedAtMs = now; st.lastDist = fin(inp.distNow); st.worsen = 0;
      if (st.activeKey === null) return { phase: "idle", writeCooldown: false, key: null };
      if (range > 0 && fin(inp.distNow) !== null && inp.distNow < range) { const key = st.activeKey; Object.assign(st, createSideChase()); return { phase: "complete", writeCooldown: true, key }; }
      return { phase: "adopt", writeCooldown: false, key: st.activeKey };
    }
    const key = st.activeKey;
    if (!inp?.candAlive) { Object.assign(st, createSideChase()); return { phase: "abandon", writeCooldown: true, key, reason: "candidate_gone" }; }
    if (inp.task && inp.task.key && inp.task.key !== key) { Object.assign(st, createSideChase()); return { phase: "abandon", writeCooldown: true, key, reason: "superseded" }; }
    if (inp.task) st.task = inp.task;
    if (range > 0 && fin(inp?.distNow) !== null && inp.distNow < range) { Object.assign(st, createSideChase()); return { phase: "complete", writeCooldown: true, key }; }
    if (now - (st.startedAtMs ?? now) > SIDE_CHASE.HOLD_MAX_MS) { Object.assign(st, createSideChase()); return { phase: "abandon", writeCooldown: true, key, reason: "hold_timeout" }; }
    const d = fin(inp?.distNow);
    if (d !== null && st.lastDist !== null) { st.worsen = d > st.lastDist + 0.01 ? (st.worsen || 0) + 1 : 0; st.lastDist = d; }
    else if (d !== null) st.lastDist = d;
    if ((st.worsen || 0) >= SIDE_CHASE.WORSEN_LIMIT) { Object.assign(st, createSideChase()); return { phase: "abandon", writeCooldown: true, key, reason: "receding" }; }
    return { phase: "continue", writeCooldown: false, key };
  } catch { return { phase: "idle", writeCooldown: false, key: null }; }
}
export function sideChaseRangeFor(type) { return type === "pickup" ? 1.9 : type === "hunt" ? 3.2 : -1; }
