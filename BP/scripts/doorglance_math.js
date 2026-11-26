// doorglance_math.js — POLISH-ANIM-DOORGLANCE-01 純粋核 (cycle1155, a08ドラフトから移設)
// 近くのドア開閉イベントへ一度だけ頭を向ける反応視線。表示層のみ。feeder は供給源が無いため読み手ゼロの記録のみ統合 (実機確認待ち)。
// 純粋: @minecraft/server を import しない。時刻は引数。例外を投げない。
export const DOORGLANCE_DURATION_MS = 700;   // 全体: 入り200 + 保持300 + 戻り200
export const DOORGLANCE_ENTER_MS = 200;
export const DOORGLANCE_HOLD_END_MS = 500;    // 保持の終端 (= 200 + 300)
export const DOORGLANCE_PITCH_DEG = 4;        // 扉の中段を見る小さな下げ (適用時は正)
export const DOORGLANCE_YAW_MAX_DEG = 30;     // 音源へ寄せるヨーの上限 (全回転はしない)
export const DOORGLANCE_YAW_FACTOR = 0.55;    // 方位差への寄せ率 (MOUNTGLANCE と同値)
export const DOORGLANCE_MIN_DIST = 1.0;       // これ未満は自分の真横 (向け直し不要)
export const DOORGLANCE_MAX_DIST = 12.0;      // これ超は音が届く範囲外として不発
export const DOORGLANCE_DEDUP_MS = 800;       // 二重セルの重複イベントを潰す窓
export const DOORGLANCE_COOLDOWN_MS = 12000;  // 12秒
const PITCH_MIN = -60, PITCH_MAX = 75;

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clampPitch(v) { return Math.max(PITCH_MIN, Math.min(PITCH_MAX, v)); }

// 最短角差 (-180,180] へ正規化。非数は null。
export function doorglanceAngleDeltaDeg(fromDeg, toDeg) {
  try {
    const a = fin(fromDeg), b = fin(toDeg); if (a === null || b === null) return null;
    let d = (b - a) % 360; if (d > 180) d -= 360; if (d <= -180) d += 360; return d;
  } catch { return null; }
}
export function wrapDoorglanceYawDeg(deg) {
  try {
    if (!Number.isFinite(deg)) return deg;
    let d = ((deg + 180) % 360 + 360) % 360 - 180; if (d === -180) d = 180; return d;
  } catch { return deg; }
}

// 台形ブレンド [0,1]: 入り sin / 保持 1 / 戻り cos。範囲外・非数は 0。
export function doorglanceEnvelope(elapsedMs) {
  try {
    const e = fin(elapsedMs); if (e === null || e < 0 || e >= DOORGLANCE_DURATION_MS) return 0;
    if (e < DOORGLANCE_ENTER_MS) return Math.sin((e / DOORGLANCE_ENTER_MS) * Math.PI / 2);
    if (e < DOORGLANCE_HOLD_END_MS) return 1;
    return Math.cos(((e - DOORGLANCE_HOLD_END_MS) / (DOORGLANCE_DURATION_MS - DOORGLANCE_HOLD_END_MS)) * Math.PI / 2);
  } catch { return 0; }
}

// doorglanceOffsets(elapsedMs, currentYawDeg, doorYawDeg) -> {pitchDeg, yawDeg}
// 方位差が取れなければヨーは 0 (ピッチだけの小さな反応に縮退する)。
export function doorglanceOffsets(elapsedMs, currentYawDeg, doorYawDeg) {
  try {
    const env = doorglanceEnvelope(elapsedMs);
    const d = doorglanceAngleDeltaDeg(currentYawDeg, doorYawDeg);
    const capped = d === null ? 0
      : Math.max(-DOORGLANCE_YAW_MAX_DEG, Math.min(DOORGLANCE_YAW_MAX_DEG, d * DOORGLANCE_YAW_FACTOR));
    const pitch = DOORGLANCE_PITCH_DEG * env, yaw = capped * env;
    return { pitchDeg: pitch === 0 ? 0 : pitch, yawDeg: yaw === 0 ? 0 : yaw };
  } catch { return { pitchDeg: 0, yawDeg: 0 }; }
}
export function doorglanceOffsetsAt(startedAtMs, nowMs, currentYawDeg, doorYawDeg) {
  try {
    const s = fin(startedAtMs), n = fin(nowMs);
    if (s === null || n === null) return { pitchDeg: 0, yawDeg: 0 };
    return doorglanceOffsets(n - s, currentYawDeg, doorYawDeg);
  } catch { return { pitchDeg: 0, yawDeg: 0 }; }
}
export function applyDoorglance(basePitchDeg, baseYawDeg, elapsedMs, doorYawDeg) {
  try {
    if (!Number.isFinite(basePitchDeg) || !Number.isFinite(baseYawDeg)) return { pitchDeg: basePitchDeg, yawDeg: baseYawDeg };
    const o = doorglanceOffsets(elapsedMs, baseYawDeg, doorYawDeg);
    return { pitchDeg: clampPitch(basePitchDeg + o.pitchDeg), yawDeg: wrapDoorglanceYawDeg(baseYawDeg + o.yawDeg) };
  } catch { return { pitchDeg: basePitchDeg, yawDeg: baseYawDeg }; }
}
export function isDoorglanceActive(stateOrStartedAtMs, nowMs) {
  try {
    const s = fin(stateOrStartedAtMs && typeof stateOrStartedAtMs === "object" ? stateOrStartedAtMs.startedAtMs : stateOrStartedAtMs);
    const n = fin(nowMs); if (s === null || n === null) return false;
    return n - s >= 0 && n - s < DOORGLANCE_DURATION_MS;
  } catch { return false; }
}
function isSuppressed(src) {
  if (!src || typeof src !== "object") return false;
  return src.suppressed === true || src.danger === true || src.combat === true
    || src.falling === true || src.inWater === true
    || src.hasWorkTarget === true || src.otherOverlayActive === true;
}
// shouldDoorglance(input) -> 純粋な発火可否。
// input: {distance, sameDimension, causedBySelf, lastFiredAtMs, nowMs, ...抑制}
export function shouldDoorglance(input) {
  try {
    if (!input || typeof input !== "object") return false;
    const dist = fin(input.distance), n = fin(input.nowMs);
    if (dist === null || n === null) return false;
    if (dist < DOORGLANCE_MIN_DIST || dist > DOORGLANCE_MAX_DIST) return false;
    if (input.sameDimension !== true) return false;
    if (input.causedBySelf === true) return false;
    if (isSuppressed(input)) return false;
    const last = fin(input.lastFiredAtMs);
    if (last !== null && (n < last || n - last < DOORGLANCE_COOLDOWN_MS)) return false;
    return true;
  } catch { return false; }
}
export function createDoorglanceState() {
  return { startedAtMs: null, lastFiredAtMs: null, doorYawDeg: null, lastClusterKey: null, lastEventAtMs: null };
}
// noteDoorglance(state, ev) -> boolean (この呼び出しで発火したら true)
// ev: {clusterKey, openState, distance, doorYawDeg, sameDimension, causedBySelf, nowMs, ...抑制}
// - clusterKey が文字列でない / nowMs・distance・doorYawDeg が非数 / sameDimension が
//   true でない入力は「イベント不成立」として状態を一切変えず false を返す。
// - 同一 clusterKey のイベントが前回から DEDUP_MS 以内なら二重セル由来の重複として
//   捨てる (状態は前回イベント時刻を維持し、窓は延長しない)。
// - 成立したイベントは結果に関わらず消費する: 抑制・冷却・距離外・自己原因でも
//   lastClusterKey/lastEventAtMs を記録し、遅れ発火を防ぐ。ただし発火しなかった
//   イベントでは lastFiredAtMs (冷却) を進めない。
// - openState は feeder が「反転した」ことの記録用に受けるだけで、本核は値で
//   分岐しない (反転の検出は feeder の管轄、という契約を明示するための受け口)。
export function noteDoorglance(state, ev) {
  try {
    if (!state || typeof state !== "object" || !ev || typeof ev !== "object") return false;
    if (typeof ev.clusterKey !== "string" || ev.clusterKey.length === 0) return false;
    const n = fin(ev.nowMs), dist = fin(ev.distance), yaw = fin(ev.doorYawDeg);
    if (n === null || dist === null || yaw === null) return false;
    if (ev.sameDimension !== true) return false;
    if (state.lastClusterKey === ev.clusterKey && fin(state.lastEventAtMs) !== null
        && n - state.lastEventAtMs >= 0 && n - state.lastEventAtMs < DOORGLANCE_DEDUP_MS) return false;
    const fire = shouldDoorglance({ ...ev, lastFiredAtMs: state.lastFiredAtMs, nowMs: n });
    state.lastClusterKey = ev.clusterKey; state.lastEventAtMs = n; // 成立イベントは消費
    if (!fire) return false;
    state.startedAtMs = n; state.lastFiredAtMs = n; state.doorYawDeg = yaw; return true;
  } catch { return false; }
}

