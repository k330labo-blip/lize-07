// mountglance_math.js — POLISH-ANIM-MOUNTGLANCE-01 (cycle0936): 主人が乗り物に跨った瞬間に一度だけそちらへ頭を向け直す出発の見届け視線 (表示層のみ・実機確認待ち)
// 仕様の正: brain_parts/solutions/cycle0936-a07-polish-newidea.md §3〜§4。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。入力を破壊しない。
// 時刻は引数で受ける。表示層のみ: 移動・追随・作業の判定へは流さない。act/say は持たない。

export const MOUNTGLANCE_MAX_DIST = 10;
export const MOUNTGLANCE_CONFIRM_TICKS = 2;
export const MOUNTGLANCE_DURATION_MS = 750;
export const MOUNTGLANCE_YAW_PULL = 0.55;
export const MOUNTGLANCE_YAW_MAX_DEG = 32;
export const MOUNTGLANCE_PITCH_DEG = -5; // 負=やや上向き (符号は実機確認待ち)
export const MOUNTGLANCE_COOLDOWN_MS = 20000;

export const MOUNTGLANCE_CONSTANTS = Object.freeze({
  MAX_DIST: MOUNTGLANCE_MAX_DIST,
  CONFIRM_TICKS: MOUNTGLANCE_CONFIRM_TICKS,
  DURATION_MS: MOUNTGLANCE_DURATION_MS,
  YAW_PULL: MOUNTGLANCE_YAW_PULL,
  YAW_MAX_DEG: MOUNTGLANCE_YAW_MAX_DEG,
  PITCH_DEG: MOUNTGLANCE_PITCH_DEG,
  COOLDOWN_MS: MOUNTGLANCE_COOLDOWN_MS,
});

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function normDeltaDeg(d) { return ((d + 180) % 360 + 360) % 360 - 180; }

// state: { confirmCount, armed, firedAtMs, cooldownUntilMs }
// armed は降車 (ownerRiding 偽) の観測でのみ true へ戻る。再武装なしに再発火しない。
export function createMountglanceState() {
  return { confirmCount: 0, armed: true, firedAtMs: null, cooldownUntilMs: null };
}
function normalizeState(state) {
  const s = state && typeof state === "object" ? state : {};
  const cc = fin(s.confirmCount);
  return {
    confirmCount: cc !== null && cc > 0 ? Math.floor(cc) : 0,
    armed: s.armed !== false,
    firedAtMs: fin(s.firedAtMs),
    cooldownUntilMs: fin(s.cooldownUntilMs),
  };
}

// noteMountglance(state, input) -> { state, fired }
// input = { nowMs, ownerRiding, ownerDist, sameDimension, suppressed }
// - ownerRiding===true が CONFIRM_TICKS 回連続した確定観測でのみ発火判定する。
// - 確定時に条件を満たさなければ、その乗車エピソードは消費する (armed=false、遅れ発火なし)。
// - ownerRiding が偽に戻れば confirmCount=0 かつ armed=true (再武装は降車観測のみ)。
export function noteMountglance(state, input) {
  try {
    const prev = normalizeState(state);
    const inp = input && typeof input === "object" ? input : {};
    const now = fin(inp.nowMs);
    if (now === null) return { state: prev, fired: false };
    if (inp.ownerRiding !== true) {
      return { state: { ...prev, confirmCount: 0, armed: true }, fired: false };
    }
    const count = prev.confirmCount + 1;
    const next = { ...prev, confirmCount: count };
    if (count < MOUNTGLANCE_CONFIRM_TICKS) return { state: next, fired: false };
    if (count > MOUNTGLANCE_CONFIRM_TICKS || !prev.armed) {
      return { state: { ...next, armed: false }, fired: false };
    }
    // 確定観測: 辺を消費する (成否によらない)
    next.armed = false;
    const dist = fin(inp.ownerDist);
    const cooldownOk = prev.cooldownUntilMs === null || now >= prev.cooldownUntilMs;
    const ok = dist !== null && dist <= MOUNTGLANCE_MAX_DIST
      && inp.sameDimension === true
      && inp.suppressed !== true
      && cooldownOk;
    if (!ok) return { state: next, fired: false };
    next.firedAtMs = now;
    next.cooldownUntilMs = now + MOUNTGLANCE_COOLDOWN_MS;
    return { state: next, fired: true };
  } catch { return { state: normalizeState(state), fired: false }; }
}

// mountglanceEnvelope(elapsedMs) -> 0..1 | null (台形: 0-130ms 入り、130-500ms 保持、500-750ms 抜け)
export function mountglanceEnvelope(elapsedMs) {
  try {
    const e = fin(elapsedMs);
    if (e === null || e < 0 || e >= MOUNTGLANCE_DURATION_MS) return null;
    if (e < 130) return e / 130;
    if (e < 500) return 1;
    return 1 - (e - 500) / (MOUNTGLANCE_DURATION_MS - 500);
  } catch { return null; }
}

export function isMountglanceActive(state, nowMs) {
  try {
    const s = state && typeof state === "object" ? state : null;
    if (!s) return false;
    const at = fin(s.firedAtMs), now = fin(nowMs);
    if (at === null || now === null) return false;
    const e = now - at;
    return e >= 0 && e < MOUNTGLANCE_DURATION_MS;
  } catch { return false; }
}

// sampleMountglance(state, nowMs) -> { active, pitchDeg, phase }
export function sampleMountglance(state, nowMs) {
  try {
    const s = state && typeof state === "object" ? state : null;
    if (!s || !isMountglanceActive(s, nowMs)) return { active: false, pitchDeg: 0, phase: null };
    const e = nowMs - s.firedAtMs;
    const env = mountglanceEnvelope(e);
    if (env === null) return { active: false, pitchDeg: 0, phase: null };
    const phase = e < 130 ? "turn" : e < 500 ? "hold" : "return";
    return { active: true, pitchDeg: MOUNTGLANCE_PITCH_DEG * env, phase };
  } catch { return { active: false, pitchDeg: 0, phase: null }; }
}

// mountglanceYawPullDeg(currentYawDeg, targetYawDeg) -> number
export function mountglanceYawPullDeg(currentYawDeg, targetYawDeg) {
  try {
    const cur = fin(currentYawDeg), tgt = fin(targetYawDeg);
    if (cur === null || tgt === null) return 0;
    const pull = normDeltaDeg(tgt - cur) * MOUNTGLANCE_YAW_PULL;
    const v = clamp(pull, -MOUNTGLANCE_YAW_MAX_DEG, MOUNTGLANCE_YAW_MAX_DEG);
    return v === 0 ? 0 : v;
  } catch { return 0; }
}
