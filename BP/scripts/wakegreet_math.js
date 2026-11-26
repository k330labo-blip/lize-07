// wakegreet_math.js — POLISH-ANIM-WAKEGREET-01 (新規発案, cyc1939 統合 (cycle-next-a13 ドラフト))
// 主人が目覚めた瞬間に一度だけそちらへ頭を向け直し、小さく会釈する「おはよう」の視線。
// 表示層のみ。純粋核: 副作用なし・例外なし (不正入力は不発で倒す)。
//
// 発火源 (既存との分離は REPORT.md §2 で検証):
//   「確定した就寝エピソードの終了 = ownerSleeping の真→偽の辺」でのみ発火する。
//   既存 SLEEPWATCH-01 は就寝開始の辺 (偽→真) で発火し、起床の辺は streak リセット
//   専用で視線を一切出さない (BP/scripts/sleepwatch_math.js noteSleepwatch 実測)。
//   WAKESTRETCH-01 はリゼ自身の長い待機の終了が発火源で、主人の睡眠とは無関係。
//
// 契約:
// - 就寝が WAKEGREET_SLEEP_CONFIRM 回連続観測されて初めて「眠った」と確定する。
//   確定していない就寝 (1回だけのちらつき) の終了では発火しない。
// - 確定後の起床は WAKEGREET_WAKE_CONFIRM 回連続の非就寝観測で確定し、その観測でのみ判定。
// - 距離 <= MAX_DIST・同次元・非抑制を起床確定の観測で満たさなければ辺は消費し遅れ発火しない。
// - 波形は台形 900ms、ピッチ最大 +6 度 (小さな会釈)、ヨー寄せは呼び出し側が
//   wakegreetYawPullDeg で計算する (比率 0.55・上限 32 度)。
// - 冷却 10 分。次元が違う/距離不明 (null) の観測は起床 streak を進めない (UNKNOWN 保持)。

export const WAKEGREET_MAX_DIST = 10;
export const WAKEGREET_SLEEP_CONFIRM = 2;
export const WAKEGREET_WAKE_CONFIRM = 2;
export const WAKEGREET_DURATION_MS = 900;
export const WAKEGREET_MAX_PITCH_DEG = 6;
export const WAKEGREET_YAW_PULL_RATIO = 0.55;
export const WAKEGREET_YAW_MAX_DEG = 32;
export const WAKEGREET_COOLDOWN_MS = 600000;
export const WAKEGREET_FADE_MS = 200;

export const WAKEGREET_CONSTANTS = Object.freeze({
  MAX_DIST: WAKEGREET_MAX_DIST,
  SLEEP_CONFIRM: WAKEGREET_SLEEP_CONFIRM,
  WAKE_CONFIRM: WAKEGREET_WAKE_CONFIRM,
  DURATION_MS: WAKEGREET_DURATION_MS,
  MAX_PITCH_DEG: WAKEGREET_MAX_PITCH_DEG,
  YAW_PULL_RATIO: WAKEGREET_YAW_PULL_RATIO,
  YAW_MAX_DEG: WAKEGREET_YAW_MAX_DEG,
  COOLDOWN_MS: WAKEGREET_COOLDOWN_MS,
  FADE_MS: WAKEGREET_FADE_MS,
});

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

export function createWakegreetState() {
  return {
    sleepingStreak: 0,   // 就寝の連続観測
    sleepConfirmed: false, // 確定した就寝エピソード中か
    awakeStreak: 0,      // 確定就寝中の非就寝の連続観測
    firedAtMs: null,     // 直近の発火開始時刻
    lastFiredMs: null,   // 冷却判定の正
  };
}

function normalizeState(s) {
  const d = createWakegreetState();
  if (!s || typeof s !== "object") return d;
  return {
    sleepingStreak: Math.max(0, Math.floor(fin(s.sleepingStreak) ?? 0)),
    sleepConfirmed: s.sleepConfirmed === true,
    awakeStreak: Math.max(0, Math.floor(fin(s.awakeStreak) ?? 0)),
    firedAtMs: fin(s.firedAtMs),
    lastFiredMs: fin(s.lastFiredMs),
  };
}

// noteWakegreet(state, input) -> { state, fired }
// input = { nowMs, ownerSleeping, ownerDist, sameDimension, suppressed }
export function noteWakegreet(state, input) {
  try {
    const prev = normalizeState(state);
    const inp = input && typeof input === "object" ? input : {};
    const now = fin(inp.nowMs);
    if (now === null) return { state: prev, fired: false };

    if (inp.ownerSleeping === true) {
      const streak = prev.sleepingStreak + 1;
      return {
        state: {
          ...prev,
          sleepingStreak: streak,
          sleepConfirmed: prev.sleepConfirmed || streak >= WAKEGREET_SLEEP_CONFIRM,
          awakeStreak: 0,
        },
        fired: false,
      };
    }

    if (inp.ownerSleeping !== false) {
      // UNKNOWN (欠損/null): streak を進めず保持する。
      return { state: prev, fired: false };
    }

    // 非就寝の観測。
    if (!prev.sleepConfirmed) {
      // 確定した就寝が無い起床は発火源ではない (ちらつき・途中参加を除外)。
      return { state: { ...prev, sleepingStreak: 0, awakeStreak: 0 }, fired: false };
    }
    // 距離不明・異次元は起床確定に数えない (UNKNOWN 保持)。
    if (fin(inp.ownerDist) === null || inp.sameDimension !== true) {
      return { state: prev, fired: false };
    }

    const awakeStreak = prev.awakeStreak + 1;
    if (awakeStreak < WAKEGREET_WAKE_CONFIRM) {
      return { state: { ...prev, sleepingStreak: 0, awakeStreak }, fired: false };
    }

    // 起床確定の観測: ここでエピソードを消費する (成否によらない、遅れ発火なし)。
    const consumed = { ...prev, sleepingStreak: 0, sleepConfirmed: false, awakeStreak: 0 };
    const cooled = prev.lastFiredMs === null || now - prev.lastFiredMs >= WAKEGREET_COOLDOWN_MS;
    const ok = cooled && fin(inp.ownerDist) <= WAKEGREET_MAX_DIST && inp.suppressed !== true;
    if (!ok) return { state: consumed, fired: false };
    return { state: { ...consumed, firedAtMs: now, lastFiredMs: now }, fired: true };
  } catch {
    return { state: normalizeState(state), fired: false };
  }
}

// sampleWakegreet(state, nowMs) -> { active, pitchDeg, phase }
// 台形波形: FADE_MS で上がり、終わりの FADE_MS で下がる。
export function sampleWakegreet(state, nowMs) {
  try {
    const s = normalizeState(state);
    const now = fin(nowMs);
    if (s.firedAtMs === null || now === null) return { active: false, pitchDeg: 0, phase: 0 };
    const t = now - s.firedAtMs;
    if (t < 0 || t >= WAKEGREET_DURATION_MS) return { active: false, pitchDeg: 0, phase: 0 };
    const phase = t / WAKEGREET_DURATION_MS;
    const up = Math.min(1, t / WAKEGREET_FADE_MS);
    const down = Math.min(1, (WAKEGREET_DURATION_MS - t) / WAKEGREET_FADE_MS);
    const k = Math.max(0, Math.min(up, down));
    return { active: k > 0, pitchDeg: WAKEGREET_MAX_PITCH_DEG * k, phase };
  } catch {
    return { active: false, pitchDeg: 0, phase: 0 };
  }
}

// 現在ヨーから主人方向ヨーへの寄せ量 (符号付き・上限クランプ)。角度差は ±180 へ正規化。
export function wakegreetYawPullDeg(currentYawDeg, targetYawDeg) {
  try {
    const c = fin(currentYawDeg), t = fin(targetYawDeg);
    if (c === null || t === null) return 0;
    let diff = (t - c) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const pull = diff * WAKEGREET_YAW_PULL_RATIO;
    return Math.max(-WAKEGREET_YAW_MAX_DEG, Math.min(WAKEGREET_YAW_MAX_DEG, pull));
  } catch {
    return 0;
  }
}
