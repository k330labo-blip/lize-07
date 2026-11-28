// follow_fail_math.js — FOLLOW-WALK-NOEXIT-01 縮小形 (cyc2502) + FOLLOW-EXIT-MOVING-TARGET-01 是正 (cyc2503):
// 純 follow の未到達を数える壁時計。救済 (再探索/direct降格/watchdogホップ) が全て失敗し続けた場合の
// 出口 (記録+1回通知+stay格下げ) の発火判定だけを担う。移動・救済そのものには触れない。
// 45秒は mission の対象 ban と同水準 (cyc2492 §3-2)。
// cyc2503 是正: (1) 追跡の同一性は目標セルでなく trackId (主人ID+bot次元。未指定時は targetKey へ後方互換)
// に分離し、主人が歩き続けても時計は張り直されない。followFailKey/followNotifiedKey は従来どおり
// 目標セルキーの記録用ミラーとして保持し判定には使わない (意味変更禁止のため新規フィールドで分離)。
// (2) dist が開始時固定基準 followStartDist から 2.0 以上縮んだら進捗として畳む。
// (3) signal/eligible の一過性 false は gap-hold+pause (上限10秒) で保持し、周期ちらつきで時計が消えない。
// 持続 false は上限超過で従来どおり畳む。到達・移動進捗の畳みは gap 中でも即時。
export const FOLLOW_FAIL_LIMIT_MS = 45000;
export const FOLLOW_ARRIVE_DIST = 1.0; // nav_radius_math の follow 到達半径1と同値 (到達側は数えない)
export const FOLLOW_DIST_PROGRESS = 2.0; // 開始時 dist からこの値以上縮んだら進捗 (cyc2503 A13 裁定で固定)
export const FOLLOW_FAIL_GAP_GRACE_MS = 10000; // signal/eligible 一過性 false の保持上限 (cyc2503 A06)

// state: { followFailSince, followFailKey, followFailAnchor, followFail, followNotifiedKey,
//          followTrackId, followStartDist, followNotifiedAnchorKey, followFailGapSince, followFailGapKind } (rt の部分集合)
// input: { eligible, signal, targetKey, dist, pos:{x,y,z}|null, partial, stuckSec, trackId?, dim? }
// 戻り: { action: "none"|"tracking"|"fire"|"reset"|"suppressed"|"exit_silent", reason }
// exit_silent (FOLLOW-SUPPRESSED-NOEXIT-01): 通知済みアンカーでの再未到達。通知は出さないが
// 出口 (stay格下げ) はエピソードごとに必要なので、時計を畳んで呼び出し側の出口へ接続する。
// "suppressed" は後方互換のため型に残すが、現行の resumeCheck は返さない。
export function noteFollowFail(state, input, nowMs) {
  try {
    if (!state || typeof state !== "object") return { action: "none", reason: "invalid" };
    const now = (typeof nowMs === "number" && Number.isFinite(nowMs)) ? nowMs : null;
    if (now === null || !input || typeof input !== "object") return { action: "none", reason: "invalid" };
    const clearTrack = () => { state.followFailSince = 0; state.followFailKey = ""; state.followFailAnchor = null; state.followTrackId = ""; state.followStartDist = null; state.followFailGapSince = 0; state.followFailGapKind = ""; };
    const fold = (reason) => { clearTrack(); return { action: "reset", reason }; };
    const key = typeof input.targetKey === "string" ? input.targetKey : "";
    const identity = (typeof input.trackId === "string" && input.trackId) ? input.trackId : key;
    const dim = typeof input.dim === "string" ? input.dim : "";
    const distOk = typeof input.dist === "number" && Number.isFinite(input.dist);
    const tracking = !!state.followFailSince;
    const anchorKeyOf = () => {
      const a = state.followFailAnchor || input.pos;
      if (!a || !dim) return "";
      return `${dim}:${Math.floor(a.x)},${Math.floor(a.y)},${Math.floor(a.z)}`;
    };
    if (tracking) {
      // 到達 (到達半径内) は進捗。gap 中でも即時。再通知の抑止もここで解く
      if (distOk && input.dist <= FOLLOW_ARRIVE_DIST) {
        if (state.followNotifiedKey) state.followNotifiedKey = "";
        if (state.followNotifiedAnchorKey) state.followNotifiedAnchorKey = "";
        return fold("arrived");
      }
      // アンカーから1.0以上動けた = 進捗 (watchdogホップ成功・移動再開)
      const a = state.followFailAnchor, p = input.pos;
      if (a && p && Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z) >= 1.0) return fold("progress");
      // dist が開始時基準から 2.0 以上縮んだ = 進捗 (主人が近づいた場合も含む)
      if (distOk && typeof state.followStartDist === "number" && state.followStartDist - input.dist >= FOLLOW_DIST_PROGRESS) return fold("dist_progress");
    } else if (distOk && input.dist <= FOLLOW_ARRIVE_DIST) {
      if (state.followNotifiedKey) state.followNotifiedKey = "";
      if (state.followNotifiedAnchorKey) state.followNotifiedAnchorKey = "";
      return { action: "none", reason: "arrived" };
    }
    if (!input.eligible || !input.signal) {
      const kind = !input.eligible ? "not_eligible" : "no_signal";
      if (!tracking) return { action: "none", reason: kind };
      // gap-hold: 一過性 false は保持し、pause として数える (上限超過で畳む)
      if (!state.followFailGapSince) { state.followFailGapSince = now; state.followFailGapKind = kind; return { action: "tracking", reason: "hold_" + kind }; }
      if (now - state.followFailGapSince > FOLLOW_FAIL_GAP_GRACE_MS) return fold(kind);
      return { action: "tracking", reason: "hold_" + kind };
    }
    // eligible かつ signal が戻った: gap の精算
    if (tracking && state.followFailGapSince) {
      const gapLen = now - state.followFailGapSince;
      const gapKind = state.followFailGapKind || "no_signal";
      state.followFailGapSince = 0; state.followFailGapKind = "";
      if (gapLen > FOLLOW_FAIL_GAP_GRACE_MS) { clearTrack(); /* fallthrough: この tick から新規 tracking */ }
      else state.followFailSince += gapLen; // pause: gap 区間は45秒に数えない
      if (!state.followFailSince) { /* folded above */ }
      else if (state.followTrackId !== identity) { /* identity changed during gap: retrack below */ }
      else return resumeCheck(state, input, now, identity, key, anchorKeyOf, distOk);
    }
    if (!state.followFailSince || state.followTrackId !== identity) {
      state.followFailSince = now; state.followTrackId = identity; state.followFailKey = key;
      state.followFailAnchor = input.pos ? { x: input.pos.x, y: input.pos.y, z: input.pos.z } : null;
      state.followStartDist = distOk ? input.dist : null;
      state.followFailGapSince = 0; state.followFailGapKind = "";
      return { action: "tracking", reason: "start" };
    }
    return resumeCheck(state, input, now, identity, key, anchorKeyOf, distOk);
  } catch { return { action: "none", reason: "invalid" }; }
}

function resumeCheck(state, input, now, identity, key, anchorKeyOf, distOk) {
  if (now - state.followFailSince < FOLLOW_FAIL_LIMIT_MS) return { action: "tracking", reason: "waiting" };
  const aKey = anchorKeyOf();
  const foldTrack = () => { state.followFailSince = 0; state.followFailKey = ""; state.followFailAnchor = null; state.followTrackId = ""; state.followStartDist = null; state.followFailGapSince = 0; state.followFailGapKind = ""; };
  const notified = aKey ? (state.followNotifiedAnchorKey === aKey) : !!(state.followNotifiedKey && state.followNotifiedKey === key);
  if (notified) {
    // FOLLOW-SUPPRESSED-NOEXIT-01: 通知の抑止と出口の抑止を分離する。通知済みキーは保持し
    // (再通知はしない)、記録と時計の畳みは fire と同じに行い、発話なし出口として返す。
    state.followFail = { at: now, key, partial: !!input.partial, stuckSec: (typeof input.stuckSec === "number" ? input.stuckSec : null), trackId: identity, anchorKey: aKey, silent: true };
    foldTrack();
    return { action: "exit_silent", reason: "already_notified" };
  }
  state.followFail = { at: now, key, partial: !!input.partial, stuckSec: (typeof input.stuckSec === "number" ? input.stuckSec : null), trackId: identity, anchorKey: aKey };
  state.followNotifiedKey = key;
  if (aKey) state.followNotifiedAnchorKey = aKey;
  foldTrack();
  return { action: "fire", reason: "timeout" };
}
