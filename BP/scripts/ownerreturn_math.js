// ownerreturn_math.js — POLISH-ANIM-OWNERRETURN-01 純粋核 (cycle1923 統合)
// 仕様の正: brain_parts/solutions/cycle1909-a14/REPORT.md §6 (発案) +
//   brain_parts/solutions/cycle1923-a06-ownerreturn/ (ドラフト・自己テスト 26/26)
// 長く離れていた主人が戻った瞬間に、一度だけ小さく頭を主人へ向ける「帰還の気付き」。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。時刻は引数で受ける。
// 表示層のみ: 移動・判断・発話には一切触らない。重畳は applyGaze の最下位でのみ使う。
export const OWNER_RETURN = Object.freeze({
  farDist: 16,        // これ以上 (または主人不在) を「不在」と数える
  nearDist: 6,        // 再接近の到達 (a14 仕様: 距離6以内)
  minFarMs: 60000,    // 不在が60秒以上続いた場合のみ (a14 仕様)
  confirmObs: 2,      // 到達の2回連続観測で確定 (a14 仕様)
  cooldownMs: 600000, // 冷却10分 (a14 仕様)
  durationMs: 700,    // 動作は700ms・1回だけ (a14 仕様)
  maxPitchDeg: 6,     // 小さな会釈 (正=下向き)
  maxYawDeg: 40,      // 主人方向への相対ヨーの上限 (gaze_math のクランプ内)
});

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createOwnerReturnState() {
  return { farSinceMs: null, nearObs: 0, lastFiredAtMs: null, startedAtMs: null, yawDeg: 0, lastRecord: null };
}

// sample: { dist:number|null (主人不在/別次元は null), busy:boolean, targetYawDeg:number }
// 戻り値: { fired, reason }。state.lastRecord へ { atMs, dist, fired, reason } を残す。
export function noteOwnerReturn(state, sample, nowMs) {
  const st = state && typeof state === "object" ? state : createOwnerReturnState();
  const dist = finite(sample?.dist) ? sample.dist : null;
  const done = (fired, reason) => { st.lastRecord = { atMs: nowMs, dist, fired, reason }; return { fired, reason }; };
  if (!finite(nowMs)) return done(false, "invalid_input");
  if (dist === null || dist >= OWNER_RETURN.farDist) {
    if (!finite(st.farSinceMs)) st.farSinceMs = nowMs;
    st.nearObs = 0;
    return done(false, "away");
  }
  if (dist > OWNER_RETURN.nearDist) { st.nearObs = 0; return done(false, "in_transit"); }
  // 到達圏内
  if (!finite(st.farSinceMs)) return done(false, "was_not_far");
  if (nowMs - st.farSinceMs < OWNER_RETURN.minFarMs) { st.farSinceMs = null; st.nearObs = 0; return done(false, "far_too_brief"); }
  st.nearObs = (st.nearObs || 0) + 1;
  if (st.nearObs < OWNER_RETURN.confirmObs) return done(false, "confirming");
  // 確定。ここからは辺を消費する (遅れ発火しない)
  st.farSinceMs = null; st.nearObs = 0;
  if (sample?.busy === true) return done(false, "busy");
  if (finite(st.lastFiredAtMs) && nowMs - st.lastFiredAtMs < OWNER_RETURN.cooldownMs) return done(false, "cooldown");
  st.lastFiredAtMs = nowMs;
  st.startedAtMs = nowMs;
  st.yawDeg = clamp(finite(sample?.targetYawDeg) ? sample.targetYawDeg : 0, -OWNER_RETURN.maxYawDeg, OWNER_RETURN.maxYawDeg);
  return done(true, "owner_returned");
}

// 発火後の重畳量。窓を過ぎたら不発 (残留状態を持たない)。
export function ownerReturnOffset(state, nowMs) {
  const idle = { active: false, pitchDeg: 0, yawDeg: 0 };
  if (!state || !finite(state.startedAtMs) || !finite(nowMs)) return idle;
  const elapsed = nowMs - state.startedAtMs;
  if (elapsed < 0 || elapsed >= OWNER_RETURN.durationMs) return idle;
  const t = elapsed / OWNER_RETURN.durationMs;
  const envelope = Math.sin(Math.PI * t);
  const bowT = clamp((t - 0.15) / 0.85, 0, 1);
  return { active: true, pitchDeg: OWNER_RETURN.maxPitchDeg * Math.sin(Math.PI * bowT), yawDeg: (finite(state.yawDeg) ? state.yawDeg : 0) * envelope };
}
