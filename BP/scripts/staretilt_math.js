// staretilt_math.js — POLISH-ANIM-STARETILT-01 (cyc2043): 主人にじっと見つめられたとき
// 一度だけ小さく首をかしげる所作の純粋核。設計は tests/cyc1939_a18_polish.md が正。
// 表示層のみ (視線重畳の数値と傾けの記録)。feeder 未接続: 主人の視線角の安定供給源が
// 確認できるまで読み手ゼロで記録のみ統合する。例外を投げない。時刻は引数 nowMs のみ。
export const STARETILT_COOLDOWN_MS = 60000;
export const STARETILT_DURATION_MS = 1200;
export const STARETILT_MIN_STARE_MS = 1500;
export const STARETILT_MIN_COUNT = 3;
export const STARETILT_MAX_DIST = 6;
export const STARETILT_PEAK_TILT_DEG = 6;
export const STARETILT_PEAK_PITCH_DEG = -2;
export const STARETILT_YAW_GAIN = 0.4;
export const STARETILT_YAW_CAP_DEG = 28;

export function createStareTiltState() {
  return { stareCount: 0, stareSinceMs: null, lastFiredAtMs: -Infinity, sessionArmed: true, active: null };
}

function wrapDeg(d) { try { let x = ((d + 180) % 360 + 360) % 360 - 180; return x; } catch { return 0; } }

// 観測1件を蓄積し、発火条件 (全て AND・UNKNOWN は不成立) が揃った辺で1回だけ発火する。
// 抑制中に条件が揃った場合はそのセッションの辺を消費する (遅れて傾けない)。
export function noteStareTilt(state, obs) {
  try {
    const s = state && typeof state === "object" ? { ...state } : createStareTiltState();
    const now = Number(obs?.nowMs);
    if (!Number.isFinite(now)) return { state: s, fired: false };
    if (obs?.ownerLookingAtBot === false) { s.sessionArmed = true; s.stareCount = 0; s.stareSinceMs = null; return { state: s, fired: false }; }
    if (obs?.ownerLookingAtBot !== true || obs?.ownerStill !== true) { s.stareCount = 0; s.stareSinceMs = null; return { state: s, fired: false }; }
    if (s.stareCount === 0 || s.stareSinceMs === null) s.stareSinceMs = now;
    s.stareCount += 1;
    const ready = s.stareCount >= STARETILT_MIN_COUNT && now - s.stareSinceMs >= STARETILT_MIN_STARE_MS
      && typeof obs?.dist === "number" && obs.dist <= STARETILT_MAX_DIST
      && obs?.sameDim === true
      && typeof obs?.ownerYawDeg === "number" && typeof obs?.botYawDeg === "number";
    if (!ready) return { state: s, fired: false };
    if (obs?.suppressed === true) { s.sessionArmed = false; return { state: s, fired: false }; }
    if (obs?.suppressed !== false) return { state: s, fired: false };
    if (!s.sessionArmed || now - s.lastFiredAtMs < STARETILT_COOLDOWN_MS) return { state: s, fired: false };
    const diff = wrapDeg(obs.ownerYawDeg - obs.botYawDeg);
    s.active = { startedAtMs: now, tiltSign: diff >= 0 ? 1 : -1, yawDeg: Math.max(-STARETILT_YAW_CAP_DEG, Math.min(STARETILT_YAW_CAP_DEG, diff * STARETILT_YAW_GAIN)) };
    s.lastFiredAtMs = now;
    s.sessionArmed = false;
    return { state: s, fired: true };
  } catch { return { state, fired: false }; }
}

// 発火中は台形波形 (入り300ms/保持600ms/抜け300ms) の重畳量を返す。発火が無ければ全て0。
export function stareTiltOffset(state, nowMs) {
  try {
    const a = state?.active;
    if (!a || typeof a.startedAtMs !== "number") return { yawDeg: 0, pitchDeg: 0, tiltDeg: 0, active: false };
    const t = Number(nowMs) - a.startedAtMs;
    if (!Number.isFinite(t) || t < 0 || t >= STARETILT_DURATION_MS) return { yawDeg: 0, pitchDeg: 0, tiltDeg: 0, active: false };
    const k = t < 300 ? t / 300 : (t < 900 ? 1 : (STARETILT_DURATION_MS - t) / 300);
    return { yawDeg: a.yawDeg * k, pitchDeg: STARETILT_PEAK_PITCH_DEG * k, tiltDeg: a.tiltSign * STARETILT_PEAK_TILT_DEG * k, active: true };
  } catch { return { yawDeg: 0, pitchDeg: 0, tiltDeg: 0, active: false }; }
}
