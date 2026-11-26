// ownerjumpsignal_math.js — POLISH-ANIM-OWNERJUMPSIGNAL-01 (新規発案, cyc2003-a14 ドラフト)
// 主人がその場で2回続けてジャンプしたとき、一度だけ主人へ頭を向け直して
// 小さく頷く「気づきました」の視線。表示層のみ。純粋核: 副作用なし・例外なし
// (不正入力は不発で倒す)。時刻は全て引数 nowMs で受ける (決定的)。
//
// 発火源の分離: MIRROR-01 はスニーク開始の辺、HEED-01 は発話、
// OWNERFALLTRACK-01 は落下距離3以上。本件は小振幅 (0.5〜2.0) の鉛直往復が
// 2500ms 以内に2回確定したときにだけ発火し、落下・段差移動では発火しない。

export const OJS_RISE_MIN = 0.5;
export const OJS_RISE_MAX = 2.0;
export const OJS_DRIFT_MAX = 0.5;
export const OJS_JUMPS_REQUIRED = 2;
export const OJS_WINDOW_MS = 2500;
export const OJS_MAX_DIST = 12;
export const OJS_DURATION_MS = 800;
export const OJS_FADE_IN_MS = 200;
export const OJS_FADE_OUT_MS = 250;
export const OJS_MAX_PITCH_DEG = 5;
export const OJS_YAW_PULL_RATIO = 0.55;
export const OJS_YAW_MAX_DEG = 32;
export const OJS_COOLDOWN_MS = 30000;

export const OJS_CONSTANTS = Object.freeze({
  RISE_MIN: OJS_RISE_MIN, RISE_MAX: OJS_RISE_MAX, DRIFT_MAX: OJS_DRIFT_MAX,
  JUMPS_REQUIRED: OJS_JUMPS_REQUIRED, WINDOW_MS: OJS_WINDOW_MS,
  MAX_DIST: OJS_MAX_DIST, DURATION_MS: OJS_DURATION_MS,
  MAX_PITCH_DEG: OJS_MAX_PITCH_DEG, YAW_PULL_RATIO: OJS_YAW_PULL_RATIO,
  YAW_MAX_DEG: OJS_YAW_MAX_DEG, COOLDOWN_MS: OJS_COOLDOWN_MS,
});

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

export function createOwnerJumpSignalState() {
  return {
    baseY: null,        // 直近の着地基準高
    airborne: false,    // 上昇相に入っているか
    peakY: null,        // 上昇相のピーク
    jumpCount: 0,       // 窓内の確定ジャンプ数
    firstJumpAtMs: null,
    firedAtMs: null,
    lastFiredMs: null,
  };
}

function normalizeState(s) {
  const d = createOwnerJumpSignalState();
  if (!s || typeof s !== "object") return d;
  const jc = fin(s.jumpCount);
  return {
    baseY: fin(s.baseY),
    airborne: s.airborne === true,
    peakY: fin(s.peakY),
    jumpCount: jc !== null && jc > 0 ? Math.floor(jc) : 0,
    firstJumpAtMs: fin(s.firstJumpAtMs),
    firedAtMs: fin(s.firedAtMs),
    lastFiredMs: fin(s.lastFiredMs),
  };
}

// noteOwnerJumpSignal(state, input) -> { state, fired, reason }
// input = { nowMs, ownerY, ownerGrounded, ownerDist, sameDimension, suppressed }
export function noteOwnerJumpSignal(state, input) {
  try {
    const prev = normalizeState(state);
    const inp = input && typeof input === "object" ? input : {};
    const now = fin(inp.nowMs);
    if (now === null) return { state: prev, fired: false, reason: "no_time" };
    const y = fin(inp.ownerY);
    // UNKNOWN (位置不明・着地状態不明): 相もカウントも進めず保持する。
    if (y === null || (inp.ownerGrounded !== true && inp.ownerGrounded !== false)) {
      return { state: prev, fired: false, reason: "unknown" };
    }

    let s = { ...prev };

    if (!s.airborne) {
      if (inp.ownerGrounded === true) {
        // 着地観測で基準高を更新する (緩やかな地形追従。合図の判定には使わない)。
        return { state: { ...s, baseY: y }, fired: false, reason: "grounded" };
      }
      if (s.baseY === null) return { state: s, fired: false, reason: "no_base" };
      if (y - s.baseY >= OJS_RISE_MIN) {
        s = { ...s, airborne: true, peakY: y };
        return { state: s, fired: false, reason: "takeoff" };
      }
      return { state: s, fired: false, reason: "rising_small" };
    }

    // 上昇相: ピークを追跡する。着地するまでは確定しない。
    if (inp.ownerGrounded !== true) {
      const peakY = s.peakY === null ? y : Math.max(s.peakY, y);
      return { state: { ...s, peakY }, fired: false, reason: "airborne" };
    }

    // 着地観測: この相を畳んで判定する。
    const rise = (s.peakY === null ? y : s.peakY) - (s.baseY === null ? y : s.baseY);
    const drift = Math.abs(y - (s.baseY === null ? y : s.baseY));
    const landed = { ...s, airborne: false, peakY: null, baseY: y };
    if (rise < OJS_RISE_MIN) return { state: landed, fired: false, reason: "too_small" };
    if (rise > OJS_RISE_MAX || drift >= OJS_DRIFT_MAX) {
      // 落下・段差移動は合図に数えない (OWNERFALLTRACK 等の領域)。
      return { state: { ...landed, jumpCount: 0, firstJumpAtMs: null }, fired: false, reason: "not_in_place" };
    }

    // その場ジャンプ1回が確定した。
    const within = s.firstJumpAtMs !== null && now - s.firstJumpAtMs <= OJS_WINDOW_MS;
    const count = within ? s.jumpCount + 1 : 1;
    const counted = { ...landed, jumpCount: count, firstJumpAtMs: within ? s.firstJumpAtMs : now };
    if (count < OJS_JUMPS_REQUIRED) return { state: counted, fired: false, reason: "counting" };

    // 2回確定: ここで集計は消費する (抑制・冷却・距離不良でも遅れ発火しない)。
    const consumed = { ...counted, jumpCount: 0, firstJumpAtMs: null };
    const cooled = s.lastFiredMs === null || now - s.lastFiredMs >= OJS_COOLDOWN_MS;
    const dist = fin(inp.ownerDist);
    const ok = cooled && dist !== null && dist <= OJS_MAX_DIST
      && inp.sameDimension === true && inp.suppressed !== true;
    if (!ok) return { state: consumed, fired: false, reason: "consumed_not_fired" };
    return { state: { ...consumed, firedAtMs: now, lastFiredMs: now }, fired: true, reason: "fired" };
  } catch {
    return { state: normalizeState(state), fired: false, reason: "error" };
  }
}

// sampleOwnerJumpSignal(state, nowMs) -> { active, pitchDeg, phase }
// 台形波形: FADE_IN で上がり、終わりの FADE_OUT で下がる。
export function sampleOwnerJumpSignal(state, nowMs) {
  try {
    const s = normalizeState(state);
    const now = fin(nowMs);
    if (s.firedAtMs === null || now === null) return { active: false, pitchDeg: 0, phase: 0 };
    const t = now - s.firedAtMs;
    if (t < 0 || t >= OJS_DURATION_MS) return { active: false, pitchDeg: 0, phase: 0 };
    const up = Math.min(1, t / OJS_FADE_IN_MS);
    const down = Math.min(1, (OJS_DURATION_MS - t) / OJS_FADE_OUT_MS);
    const k = Math.max(0, Math.min(up, down));
    return { active: k > 0, pitchDeg: OJS_MAX_PITCH_DEG * k, phase: t / OJS_DURATION_MS };
  } catch {
    return { active: false, pitchDeg: 0, phase: 0 };
  }
}

// 現在ヨーから主人方向ヨーへの寄せ量 (符号付き・上限クランプ)。角度差は ±180 へ正規化。
export function ownerJumpSignalYawPullDeg(currentYawDeg, targetYawDeg) {
  try {
    const c = fin(currentYawDeg), t = fin(targetYawDeg);
    if (c === null || t === null) return 0;
    let diff = (t - c) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const pull = diff * OJS_YAW_PULL_RATIO;
    return Math.max(-OJS_YAW_MAX_DEG, Math.min(OJS_YAW_MAX_DEG, pull));
  } catch {
    return 0;
  }
}
