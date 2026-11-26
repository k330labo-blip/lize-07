// lowvigor_math.js — POLISH-ANIM-LOWVIGOR-01 純粋核 (cycle1215, a13 発案)
// 低体力が続く間の「肩落とし＋浅い呼吸」持続姿勢。表示層のみ: 判断 (decide/rules) へは一切使わない。
// 入力は素朴な値だけを受け、例外を投げない。時刻は引数で渡し、核内では実時刻・乱数を使わない (決定的)。
export const LOWVIGOR_ENTER_RATIO = 0.30;
export const LOWVIGOR_EXIT_RATIO = 0.45;
export const LOWVIGOR_CONFIRM = 2;
export const LOWVIGOR_PITCH_DEG = 7;
export const LOWVIGOR_PITCH_LOAD = 3;
export const LOWVIGOR_AMP_DEG = 2;
export const LOWVIGOR_PERIOD_MS = 1600;
export const LOWVIGOR_FADE_MS = 400;

export function lowvigorBand(ratio) {
  if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio < 0 || ratio > 1) return "unknown";
  if (ratio <= LOWVIGOR_ENTER_RATIO) return "low";
  if (ratio >= LOWVIGOR_EXIT_RATIO) return "recover";
  return "mid";
}

export function createLowvigorState() {
  return { active: false, lowStreak: 0, enteredAtMs: null, exitedAtMs: null };
}

// 観測を1回消費する。suppressed でも帯域は消費する (遅れ発火・遅れ退場なし)。
export function noteLowvigor(state, input) {
  const s = state && typeof state === "object" ? state : createLowvigorState();
  const nowMs = Number.isFinite(input?.nowMs) ? input.nowMs : null;
  const band = lowvigorBand(input?.hpRatio);
  let entered = false, exited = false;
  if (band === "low") {
    s.lowStreak = (s.lowStreak || 0) + 1;
    if (!s.active && s.lowStreak >= LOWVIGOR_CONFIRM && nowMs !== null) {
      s.active = true; s.enteredAtMs = nowMs; s.exitedAtMs = null; entered = true;
    }
  } else if (band === "recover") {
    s.lowStreak = 0;
    if (s.active && nowMs !== null) { s.active = false; s.exitedAtMs = nowMs; exited = true; }
  } else if (band === "mid") {
    s.lowStreak = 0;
  } // "unknown" は状態を一切進めない
  return { state: s, entered, exited };
}

// 現在の表示オフセット。active でない/フェードアウト完了後は null (出口があること)。
export function lowvigorOffset(state, input) {
  const nowMs = input?.nowMs;
  if (!state || !Number.isFinite(nowMs)) return null;
  const base = input?.loadActive ? LOWVIGOR_PITCH_LOAD : LOWVIGOR_PITCH_DEG;
  let env = 0, since = null;
  if (state.active && Number.isFinite(state.enteredAtMs)) {
    since = nowMs - state.enteredAtMs;
    if (since < 0) return null;
    env = Math.min(1, since / LOWVIGOR_FADE_MS);
  } else if (!state.active && Number.isFinite(state.exitedAtMs)) {
    since = nowMs - state.exitedAtMs;
    if (since < 0 || since >= LOWVIGOR_FADE_MS) return null;
    env = 1 - since / LOWVIGOR_FADE_MS;
  } else return null;
  if (input?.suppressed) return { gazePitchDeg: 0, breathPhase: 0, env };
  const phase = ((since % LOWVIGOR_PERIOD_MS) + LOWVIGOR_PERIOD_MS) % LOWVIGOR_PERIOD_MS / LOWVIGOR_PERIOD_MS;
  const breath = Math.sin(phase * Math.PI * 2) * LOWVIGOR_AMP_DEG;
  return { gazePitchDeg: (base + breath) * env, breathPhase: phase, env };
}
