// sleepwatch_math.js — POLISH-ANIM-SLEEPWATCH-01 (cycle0910): 主人が眠り始めた瞬間に一度だけ主人の方へ頭を向け直す見守り視線 (表示層のみ・実機確認待ち)
// 仕様の正: brain_parts/solutions/polish-backlog/cycle0900_a16_newidea.md §4。ドラフト cycle0910-a03 (自己テスト40/40) を正式化。
//
// 純粋モジュール: @minecraft/server を import しない。相対 import も持たない。
// 例外を投げない。入力 (state / input) を破壊しない (更新は新しい state を返す)。
// 時刻は引数で受ける (内部で現在時刻を読まない)。乱数を使わない (決定的)。
// c.x 等の観測オブジェクトへは直接触らない。欠損・null・非有限数は全て
// 「就寝なし／抑制あり」側へ倒す。
// 表示層のみ: 出力は applyGaze 最下位への重畳 (ピッチ加算 + ヨー寄せ) 専用。
// 移動・追随・作業・戦闘・睡眠可否の判定へは一切流さない。音は含めない
// (音は別 ID POLISH-SND-SLEEPWATCH-01)。スキン/ジオメトリには触らない。

export const SLEEPWATCH_MAX_DIST = 10;          // 発火可能な主人との距離 (ブロック)
export const SLEEPWATCH_CONFIRM_TICKS = 2;      // 就寝が真の連続観測回数 (確定条件)
export const SLEEPWATCH_DURATION_MS = 1100;
export const SLEEPWATCH_MAX_PITCH_DEG = 7;
export const SLEEPWATCH_YAW_PULL_RATIO = 0.6;   // 主人方向ヨーへの寄せ割合
export const SLEEPWATCH_YAW_MAX_DEG = 40;       // ヨー寄せの上限
export const SLEEPWATCH_COOLDOWN_MS = 600000;   // 10分

export const SLEEPWATCH_CONSTANTS = Object.freeze({
  MAX_DIST: SLEEPWATCH_MAX_DIST,
  CONFIRM_TICKS: SLEEPWATCH_CONFIRM_TICKS,
  DURATION_MS: SLEEPWATCH_DURATION_MS,
  MAX_PITCH_DEG: SLEEPWATCH_MAX_PITCH_DEG,
  YAW_PULL_RATIO: SLEEPWATCH_YAW_PULL_RATIO,
  YAW_MAX_DEG: SLEEPWATCH_YAW_MAX_DEG,
  COOLDOWN_MS: SLEEPWATCH_COOLDOWN_MS,
});

// gaze_math.js の GAZE_PITCH_MIN / MAX と同値のローカル写し (自己完結のため。
// 統合時は gaze_math からの import へ置換し、この写しを消すこと)
const GAZE_PITCH_MIN = -60;
const GAZE_PITCH_MAX = 75;

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function easeOutCubic(t) { const x = clamp(t, 0, 1); return 1 - Math.pow(1 - x, 3); }
function easeInOutQuad(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
// 角度差を -180..180 へ正規化する
function normDeltaDeg(d) { return ((d + 180) % 360 + 360) % 360 - 180; }

// --- 状態 (呼び出し側が保持する不透明なオブジェクト。揮発のみ・永続化しない) ---
// { prevSleeping, sleepingStreak, episodeConsumed, firedAtMs, lastFiredMs }
// episodeConsumed: その就寝エピソードの辺は消費済み (発火済み、または確定時に
// 抑制・重畳・距離外・別次元・クールダウンで不発だった)。ownerSleeping が
// 偽に戻ったときだけ解除される (遅れ発火を構造的に防ぐ)。
export function createSleepwatchState() {
  return {
    prevSleeping: false,
    sleepingStreak: 0,
    episodeConsumed: false,
    firedAtMs: null,
    lastFiredMs: null,
  };
}

// 欠損・壊れた state を安全な形へ写す (入力は破壊しない)
function normalizeState(state) {
  const s = state && typeof state === "object" ? state : {};
  const streak = fin(s.sleepingStreak);
  return {
    prevSleeping: s.prevSleeping === true,
    sleepingStreak: streak !== null && streak > 0 ? Math.floor(streak) : 0,
    episodeConsumed: s.episodeConsumed === true,
    firedAtMs: fin(s.firedAtMs),
    lastFiredMs: fin(s.lastFiredMs),
  };
}

// noteSleepwatch(state, input) -> { state, fired }
// input = { nowMs, ownerSleeping, ownerDist, sameDimension, suppressed, overlayActive }
// 振る舞い (契約 §4.2):
// - ownerSleeping === true が SLEEPWATCH_CONFIRM_TICKS 回連続した最初の観測で
//   確定し、その観測でのみ発火判定を行う。全条件 (距離が有限で MAX_DIST 以内、
//   sameDimension === true、suppressed !== true、overlayActive !== true、
//   クールダウン経過済み) を満たせば fired:true はちょうど1回だけ。
// - 確定時に条件を満たさなければ、その就寝の辺は消費する (遅れ発火なし)。
// - ownerSleeping が偽 (欠損・null・非真を含む) に戻ったら streak と
//   エピソード消費はリセットされる (起床の辺で保留を持ち越さない)。
// - nowMs が非有限なら発火せず、状態も進めない (観測として数えない)。
export function noteSleepwatch(state, input) {
  try {
    const prev = normalizeState(state);
    const inp = input && typeof input === "object" ? input : {};
    const now = fin(inp.nowMs);
    if (now === null) return { state: prev, fired: false };

    if (inp.ownerSleeping !== true) {
      // 就寝なし側へ倒す: streak・保留・エピソード消費をリセット。
      // firedAtMs / lastFiredMs (発火履歴とクールダウンの正) は保持する。
      return {
        state: { ...prev, prevSleeping: false, sleepingStreak: 0, episodeConsumed: false },
        fired: false,
      };
    }

    const streak = prev.prevSleeping ? prev.sleepingStreak + 1 : 1;
    const next = { ...prev, prevSleeping: true, sleepingStreak: streak };

    if (streak < SLEEPWATCH_CONFIRM_TICKS) return { state: next, fired: false };
    if (streak > SLEEPWATCH_CONFIRM_TICKS || prev.episodeConsumed) {
      // 確定済みの同じ就寝が続いているだけ。再発火しない。
      return { state: { ...next, episodeConsumed: true }, fired: false };
    }

    // streak === CONFIRM_TICKS: 確定の観測。ここで辺を消費する (成否によらない)。
    next.episodeConsumed = true;
    const dist = fin(inp.ownerDist);
    const cooldownOk = prev.lastFiredMs === null || now - prev.lastFiredMs >= SLEEPWATCH_COOLDOWN_MS;
    const ok = dist !== null && dist <= SLEEPWATCH_MAX_DIST
      && inp.sameDimension === true
      && inp.suppressed !== true
      && inp.overlayActive !== true
      && cooldownOk;
    if (!ok) return { state: next, fired: false };
    next.firedAtMs = now;
    next.lastFiredMs = now;
    return { state: next, fired: true };
  } catch { return { state: normalizeState(state), fired: false }; }
}

// sleepwatchOffset(elapsedMs) -> { gazePitchDeg, phase } | null
// 波形: 0〜300ms ease-out で 0 -> +7 度、300〜750ms 保持、
//       750〜1100ms ease-in-out で +7 -> 0 度。
// phase: "turn" (0<=e<300) | "hold" (300<=e<750) | "return" (750<=e<1100)。
// 範囲外・非有限数は null (= 完全に素へ戻る出口がある)。
export function sleepwatchOffset(elapsedMs) {
  try {
    const e = fin(elapsedMs);
    if (e === null || e < 0 || e >= SLEEPWATCH_DURATION_MS) return null;
    if (e < 300) return { gazePitchDeg: SLEEPWATCH_MAX_PITCH_DEG * easeOutCubic(e / 300), phase: "turn" };
    if (e < 750) return { gazePitchDeg: SLEEPWATCH_MAX_PITCH_DEG, phase: "hold" };
    const t = (e - 750) / (SLEEPWATCH_DURATION_MS - 750);
    return { gazePitchDeg: SLEEPWATCH_MAX_PITCH_DEG * (1 - easeInOutQuad(t)), phase: "return" };
  } catch { return null; }
}

// sleepwatchYawPullDeg(currentYawDeg, ownerYawDeg) -> number
// (ownerYaw - currentYaw) の最短差分 x YAW_PULL_RATIO を ±YAW_MAX_DEG でクランプ。
// 非有限数入力では 0。
export function sleepwatchYawPullDeg(currentYawDeg, ownerYawDeg) {
  try {
    const cur = fin(currentYawDeg), own = fin(ownerYawDeg);
    if (cur === null || own === null) return 0;
    const pull = normDeltaDeg(own - cur) * SLEEPWATCH_YAW_PULL_RATIO;
    const v = clamp(pull, -SLEEPWATCH_YAW_MAX_DEG, SLEEPWATCH_YAW_MAX_DEG);
    return v === 0 ? 0 : v;
  } catch { return 0; }
}

// applySleepwatchPitch(basePitchDeg, elapsedMs) -> number
// オフセットが null または base が非有限数なら base をそのまま返す。
// それ以外は base + gazePitchDeg を GAZE_PITCH_MIN/MAX でクランプする。
export function applySleepwatchPitch(basePitchDeg, elapsedMs) {
  try {
    if (!Number.isFinite(basePitchDeg)) return basePitchDeg;
    const off = sleepwatchOffset(elapsedMs);
    if (off === null) return basePitchDeg;
    return clamp(basePitchDeg + off.gazePitchDeg, GAZE_PITCH_MIN, GAZE_PITCH_MAX);
  } catch { return basePitchDeg; }
}

// isSleepwatchActive(startedAtMs, nowMs) -> boolean
export function isSleepwatchActive(startedAtMs, nowMs) {
  try {
    const s = fin(startedAtMs), n = fin(nowMs);
    if (s === null || n === null) return false;
    const e = n - s;
    return e >= 0 && e < SLEEPWATCH_DURATION_MS;
  } catch { return false; }
}


// sampleSleepwatch(state, nowMs) -> { active, pitchDeg, elapsedMs }
// overlay 消費側の便宜関数: 発火中なら sleepwatchOffset のピッチを返す。
export function sampleSleepwatch(state, nowMs) {
  try {
    const s = state && typeof state === "object" ? state : null;
    if (!s) return { active: false, pitchDeg: 0, elapsedMs: null };
    const at = fin(s.firedAtMs), now = fin(nowMs);
    if (at === null || now === null || !isSleepwatchActive(at, now)) return { active: false, pitchDeg: 0, elapsedMs: null };
    const off = sleepwatchOffset(now - at);
    if (!off) return { active: false, pitchDeg: 0, elapsedMs: null };
    return { active: true, pitchDeg: off.gazePitchDeg, elapsedMs: now - at };
  } catch { return { active: false, pitchDeg: 0, elapsedMs: null }; }
}
