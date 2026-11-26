// shieldup_math.js — 主人の盾構えへの警戒の合図視線 POLISH-ANIM-SHIELDUP-01 (純粋核先行統合・feeder未接続: 主人の盾構え状態の安定供給源が正式版APIに無いため読み手ゼロ)
// 純粋モジュール: @minecraft/server を import しない。Date.now・乱数へ触らない
// (時刻は引数 nowMs のみ、決定的)。例外を投げない (不正入力は不発+オフセット0)。
// 表示層のみ: 出力は gaze オフセットのみ。戦闘・移動・作業判定へは流さない。
// 統合時: ピッチクランプは gaze_math.js の GAZE_PITCH_MIN/MAX import へ寄せる
// (下の自前定数はドラフト単体で読めるようにするための同値コピー)。

export const SHIELDUP_CONSTANTS = {
  CONFIRM_OBSERVATIONS: 2,  // §3.1-1 構えの連続観測
  DURATION_MS: 750,
  RISE_MS: 200, HOLD_MS: 300, // 残り 250ms が復帰
  YAW_BLEND: 0.55,          // §3.2 主人方向への寄せ率
  YAW_LIMIT_DEG: 32,
  PITCH_DEG: 6,             // §3.2 下向き正
  COOLDOWN_MS: 20000,
  DIST_MIN: 1.5, DIST_MAX: 10, // §3.1-2
};
const PITCH_MIN = -60, PITCH_MAX = 75; // gaze_math と同値 (統合時に import 化)

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function wrapYawDeg(d) { let x = d % 360; if (x > 180) x -= 360; if (x <= -180) x += 360; return x; }
function clampPitch(v) { return Math.max(PITCH_MIN, Math.min(PITCH_MAX, v)); }

export function createShieldUpState() {
  return { lastFiredAtMs: null, active: null /* {startedAtMs, yawDeg} */,
           pending: 0, armed: true, prevUp: false };
}

// noteShieldUp(state, input, nowMs) -> { fired, reason }
// input: { ownerPresent, ownerShieldUp, sameDimension,
//          dist, relYawDeg, suppressed }
// relYawDeg は「現在の頭ヨーから見た主人方向の相対ヨー」(-180..180)。
// 盾を下ろした観測 (ownerShieldUp:false) は pending を畳み armed を戻す。
export function noteShieldUp(state, input, nowMs) {
  try {
    if (!state || typeof state !== "object") return { fired: false, reason: "bad_state" };
    if (!input || typeof input !== "object") return { fired: false, reason: "bad_input" };
    const now = finiteOrNull(nowMs);
    if (now === null) return { fired: false, reason: "bad_time" };
    const up = input.ownerShieldUp === true;
    if (!up) { // 下ろした: 再武装と確定リセット (この観測自体は発火しない)
      state.pending = 0; state.armed = true; state.prevUp = false;
      return { fired: false, reason: "lowered" };
    }
    const rising = state.prevUp !== true;
    state.prevUp = true;
    if (rising) state.pending = 0;
    if (!state.armed) return { fired: false, reason: "not_armed" };
    if (input.ownerPresent !== true) { state.pending = 0; return { fired: false, reason: "no_owner" }; }
    state.pending += 1;
    if (state.pending < SHIELDUP_CONSTANTS.CONFIRM_OBSERVATIONS)
      return { fired: false, reason: "confirming" };
    // 確定: ここから先の不発はすべて「辺を消費する」 (遅れ発火禁止)
    state.pending = 0; state.armed = false;
    if (input.suppressed === true) return { fired: false, reason: "suppressed" };
    if (input.sameDimension !== true) return { fired: false, reason: "dimension" };
    const dist = finiteOrNull(input.dist);
    if (dist === null || dist < SHIELDUP_CONSTANTS.DIST_MIN || dist > SHIELDUP_CONSTANTS.DIST_MAX)
      return { fired: false, reason: "distance" };
    const relYaw = finiteOrNull(input.relYawDeg);
    if (relYaw === null) return { fired: false, reason: "no_yaw" };
    if (state.lastFiredAtMs !== null && now - state.lastFiredAtMs < SHIELDUP_CONSTANTS.COOLDOWN_MS)
      return { fired: false, reason: "cooldown" };
    const yaw = Math.max(-SHIELDUP_CONSTANTS.YAW_LIMIT_DEG,
      Math.min(SHIELDUP_CONSTANTS.YAW_LIMIT_DEG,
        wrapYawDeg(relYaw) * SHIELDUP_CONSTANTS.YAW_BLEND));
    state.active = { startedAtMs: now, yawDeg: yaw };
    state.lastFiredAtMs = now;
    return { fired: true, reason: "fired" };
  } catch { return { fired: false, reason: "error" }; }
}

// sampleShieldUp(state, nowMs, opts) -> { pitchDeg, yawDeg, active }
// opts: { cancelled?: boolean } — 主人が盾を下ろしたら feeder が立てる (§3.4)
export function sampleShieldUp(state, nowMs, opts) {
  const zero = { pitchDeg: 0, yawDeg: 0, active: false };
  try {
    if (!state || typeof state !== "object" || !state.active) return zero;
    const now = finiteOrNull(nowMs);
    if (now === null) return zero;
    if (opts && opts.cancelled === true) { state.active = null; return zero; }
    const e = now - state.active.startedAtMs;
    const C = SHIELDUP_CONSTANTS;
    if (e < 0 || e >= C.DURATION_MS) { if (e >= C.DURATION_MS) state.active = null; return zero; }
    const k = e < C.RISE_MS ? Math.sin((e / C.RISE_MS) * Math.PI / 2)
            : e < C.RISE_MS + C.HOLD_MS ? 1
            : Math.cos(((e - C.RISE_MS - C.HOLD_MS) / (C.DURATION_MS - C.RISE_MS - C.HOLD_MS)) * Math.PI / 2);
    return { pitchDeg: clampPitch(C.PITCH_DEG * k), yawDeg: state.active.yawDeg * k, active: true };
  } catch { return zero; }
}
