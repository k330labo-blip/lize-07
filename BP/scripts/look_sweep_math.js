// look_sweep_math.js — 能動知覚・見回しスイープの純粋核 (横断基盤 FOV+見回し 第1単位, cyc2491)。
// ACTIVE_PERCEPTION.md の要件: 水平8方向 (45度刻み) × 上下3段を tick 分散でレイキャストし、
// 1tick につき1〜2方向ずつ処理して一巡1〜2秒に収める。一括全方位スキャンはしない。
// 本モジュールは「どの方向を・どの順で・いつ回すか」の計画だけを担う純粋関数群であり、
// 実レイキャスト (observability.canObserve への方向別呼び出し) と視線の実回転は統合側が行う。
// 例外を投げない。
export const SWEEP_YAW_STEPS = 8; // 水平8方向 (45度刻み)
export const SWEEP_PITCHES = Object.freeze([-30, 0, 30]); // 上下3段 (度)。pitchDeg は setRotation の x 空間 (下向きが正): -30=上 / 0=水平 / +30=下 (gaze_math の規約と同一)
export const SWEEP_TOTAL = SWEEP_YAW_STEPS * SWEEP_PITCHES.length; // 24方向
export const SWEEP_PER_TICK = 2; // 1tick あたりの処理方向数 (上限)
export const SWEEP_STEP_INTERVAL_MS = 100; // 前進の最小間隔 (ms)。12回前進で一巡 1.2 秒に固定する (FOV第2単位 cyc2492, A02 F1)
export const SWEEP_DEFAULT_FOV_DEG = 120; // observability の FOV 既定と一致させる単一の正

// step (0..SWEEP_TOTAL-1) → その方向の { yawOffsetDeg, pitchDeg }。
// 順序は pitch 段ごとに水平を一巡する形 (同じ高さで一周してから段を変える)。
export function sweepDirection(step) {
  if (!Number.isFinite(step)) return null;
  const s = ((Math.floor(step) % SWEEP_TOTAL) + SWEEP_TOTAL) % SWEEP_TOTAL;
  const pitchIdx = Math.floor(s / SWEEP_YAW_STEPS);
  const yawIdx = s % SWEEP_YAW_STEPS;
  return { yawOffsetDeg: yawIdx * (360 / SWEEP_YAW_STEPS), pitchDeg: SWEEP_PITCHES[pitchIdx] };
}

// 基準 yaw (現在の顔の向き) に対する step 方向の絶対 yaw を -180..180 へ正規化して返す。
export function sweepAbsoluteYaw(baseYawDeg, step) {
  const dir = sweepDirection(step);
  if (!dir || !Number.isFinite(baseYawDeg)) return null;
  const raw = baseYawDeg + dir.yawOffsetDeg;
  return ((raw + 540) % 360) - 180;
}

// 見回し状態を作る。lastFoundAt は「対象が最後に見つかった時刻 (ms)」で、
// 発動条件は既存の進捗監視と共有する前提のため専用タイマーは持たない。
export function createLookSweepState() {
  return { step: 0, active: false, startedAt: 0, lastFoundAt: 0, baseYawDeg: 0, lastAdvanceAt: 0, lastCompletedAt: 0 };
}

// 見つからない時間が thresholdMs 以上続いたら見回しを開始してよいか。
// 既に active の間は再開始しない。時刻が有限でない場合は開始しない (unknown を倒さない)。
export function sweepDue(state, nowMs, thresholdMs = 20000) {
  if (!state || state.active) return false;
  if (!Number.isFinite(nowMs)) return false;
  const base = Math.max(Number.isFinite(state.lastFoundAt) ? state.lastFoundAt : -Infinity, state.lastCompletedAt || 0);
  if (!Number.isFinite(base)) return false;
  const th = Number.isFinite(thresholdMs) && thresholdMs > 0 ? thresholdMs : 20000;
  return nowMs - base >= th;
}

// 1tick 分の前進: 最大 SWEEP_PER_TICK 方向を返し、状態を進める。
// 一巡 (SWEEP_TOTAL) に達したら active=false へ戻し { done:true } を返す。
export function advanceLookSweep(state, baseYawDeg, nowMs) {
  if (!state || !state.active) return { dirs: [], done: true };
  if (Number.isFinite(nowMs) && state.lastAdvanceAt && nowMs - state.lastAdvanceAt < SWEEP_STEP_INTERVAL_MS) return { dirs: [], done: false };
  const base = Number.isFinite(state.baseYawDeg) ? state.baseYawDeg : baseYawDeg;
  const dirs = [];
  for (let i = 0; i < SWEEP_PER_TICK && state.step < SWEEP_TOTAL; i++) {
    const dir = sweepDirection(state.step);
    dirs.push({ step: state.step, yawDeg: sweepAbsoluteYaw(base, state.step), pitchDeg: dir ? dir.pitchDeg : 0 });
    state.step++;
  }
  if (Number.isFinite(nowMs)) state.lastAdvanceAt = nowMs;
  const done = state.step >= SWEEP_TOTAL;
  if (done) { state.active = false; state.step = 0; if (Number.isFinite(nowMs)) state.lastCompletedAt = nowMs; }
  return { dirs, done };
}

// 見回し開始 (状態の初期化)。開始できたら true。
export function startLookSweep(state, nowMs, baseYawDeg) {
  if (!state) return false;
  state.step = 0;
  state.active = true;
  state.startedAt = Number.isFinite(nowMs) ? nowMs : 0;
  state.lastAdvanceAt = 0;
  if (Number.isFinite(baseYawDeg)) state.baseYawDeg = baseYawDeg;
  return true;
}

// 対象が見つかったことを記録し、見回しを止める。
export function noteSweepFound(state, nowMs) {
  if (!state) return;
  if (Number.isFinite(nowMs)) state.lastFoundAt = nowMs;
  state.active = false;
  state.step = 0;
}
