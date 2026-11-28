// follow_fail_math.js — FOLLOW-WALK-NOEXIT-01 縮小形 (cyc2492 A09 確定・cyc2501 A03 パッチ化):
// 純 follow の未到達を数える壁時計。救済 (再探索/direct降格/watchdogホップ) が全て失敗し続けた場合の
// 出口 (記録+1回通知+stay格下げ) の発火判定だけを担う。移動・救済そのものには触れない。
// 45秒は mission の対象 ban と同水準 (cyc2492 §3-2)。
export const FOLLOW_FAIL_LIMIT_MS = 45000;
export const FOLLOW_ARRIVE_DIST = 1.0; // nav_radius_math の follow 到達半径1と同値 (到達側は数えない)

// state: { followFailSince, followFailKey, followFailAnchor, followFail, followNotifiedKey } (rt の部分集合)
// input: { eligible, signal, targetKey, dist, pos:{x,y,z}|null, partial, stuckSec }
// 戻り: { action: "none"|"tracking"|"fire"|"reset"|"suppressed", reason }
export function noteFollowFail(state, input, nowMs) {
  try {
    if (!state || typeof state !== "object") return { action: "none", reason: "invalid" };
    const now = (typeof nowMs === "number" && Number.isFinite(nowMs)) ? nowMs : null;
    if (now === null || !input || typeof input !== "object") return { action: "none", reason: "invalid" };
    const fold = (reason) => { state.followFailSince = 0; state.followFailKey = ""; state.followFailAnchor = null; return { action: "reset", reason }; };
    if (!input.eligible) return state.followFailSince ? fold("not_eligible") : { action: "none", reason: "not_eligible" };
    // 到達 (到達半径内) は進捗。再通知の抑止もここで解く
    if (typeof input.dist === "number" && Number.isFinite(input.dist) && input.dist <= FOLLOW_ARRIVE_DIST) {
      if (state.followNotifiedKey) state.followNotifiedKey = "";
      return state.followFailSince ? fold("arrived") : { action: "none", reason: "arrived" };
    }
    // アンカーから1.0以上動けた = 進捗 (watchdogホップ成功・移動再開。stuckSec のリセット経路と対応)
    const a = state.followFailAnchor, p = input.pos;
    if (a && p && Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z) >= 1.0) return fold("progress");
    if (!input.signal) return state.followFailSince ? fold("no_signal") : { action: "none", reason: "no_signal" };
    const key = typeof input.targetKey === "string" ? input.targetKey : "";
    if (!state.followFailSince || state.followFailKey !== key) {
      state.followFailSince = now; state.followFailKey = key;
      state.followFailAnchor = p ? { x: p.x, y: p.y, z: p.z } : null;
      return { action: "tracking", reason: "start" };
    }
    if (now - state.followFailSince < FOLLOW_FAIL_LIMIT_MS) return { action: "tracking", reason: "waiting" };
    if (state.followNotifiedKey === key) return { action: "suppressed", reason: "already_notified" };
    state.followFail = { at: now, key, partial: !!input.partial, stuckSec: (typeof input.stuckSec === "number" ? input.stuckSec : null) };
    state.followNotifiedKey = key;
    state.followFailSince = 0; state.followFailKey = ""; state.followFailAnchor = null;
    return { action: "fire", reason: "timeout" };
  } catch { return { action: "none", reason: "invalid" }; }
}
