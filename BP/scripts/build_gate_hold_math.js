// build_gate_hold_math.js — BUILD-GATE-HOLD (cycle0553): 建築 PLACE ゲート hold の累計見切り (純粋核)
// 背景: PLACE-GATE段2 (cycle0522) の gate hold は出口が全体の300秒無進捗終端のみで、
// 近距離 (cellDist<=3.4) では45秒 skip 枝も評価されず、塞がれた1セルで最大300秒止まった
// (cycle0537-a15 実測確定)。本核は他 hold 系 (work/branch/tunnel) と同型の累計時計:
// キーは idx+座標のみ (why は揺らぐためキーに入れず診断に保持 = KEYFLAP 教訓)、
// 加算は1回最大 GAP_CAP_MS のキャップ付き (疎な tick でも到達可能にする)。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
export const BUILD_GATE_HOLD_LIMIT_MS = 45000;
export const BUILD_GATE_HOLD_GAP_CAP_MS = 2000;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

export function createBuildGateHoldState() {
  return { key: null, totalMs: 0, lastAtMs: null, lastWhy: null };
}

export function buildGateHoldKey(idx, pos) {
  try {
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return null;
    return `${idx}:${pos.x},${pos.y},${pos.z}`;
  } catch { return null; }
}

// noteBuildGateHold(state, {key, why, nowMs}) -> { exhausted, totalMs, key }
// 同一キーの hold が続く間だけ累計する。キーが変わればリセット。
export function noteBuildGateHold(state, input) {
  try {
    if (!state || typeof state !== "object") return { exhausted: false, totalMs: 0, key: null };
    if (!input || typeof input !== "object" || !input.key) return { exhausted: false, totalMs: state.totalMs || 0, key: state.key || null };
    const now = finiteOrNull(input.nowMs);
    if (now === null) return { exhausted: false, totalMs: state.totalMs || 0, key: state.key || null };
    if (state.key !== input.key) {
      state.key = input.key; state.totalMs = 0; state.lastAtMs = now; state.lastWhy = input.why || null;
      return { exhausted: false, totalMs: 0, key: state.key };
    }
    const last = finiteOrNull(state.lastAtMs);
    let dt = last === null ? 0 : now - last;
    if (dt < 0) dt = 0;
    if (dt > BUILD_GATE_HOLD_GAP_CAP_MS) dt = BUILD_GATE_HOLD_GAP_CAP_MS;
    state.totalMs = (Number.isFinite(state.totalMs) ? state.totalMs : 0) + dt;
    state.lastAtMs = now;
    if (input.why) state.lastWhy = input.why;
    return { exhausted: state.totalMs > BUILD_GATE_HOLD_LIMIT_MS, totalMs: state.totalMs, key: state.key };
  } catch { return { exhausted: false, totalMs: 0, key: null }; }
}

// BUILD-FLOOR-SELF-01 (cyc2368): 同一 why の GATE_HOLD skip が反復したら全体の異常として数える。
// 床セルのように移動目標の指定方式そのものが同じ hold を量産する形では、セル単位の45秒 skip が
// 無進捗時計を延命し、placed=0 のまま「完了」へ進んでしまう (cyc2367 A11 ハーネス9/9で確定)。
// 汎用層: セル種別・設計図には依存せず、why の連続回数だけを見る。
export const BUILD_GATE_SKIP_STREAK_LIMIT = 3;

export function createBuildGateSkipStreakState() {
  return { why: null, count: 0 };
}

export function noteBuildGateSkipStreak(state, why) {
  try {
    if (!state || typeof state !== "object") return { exhausted: false, count: 0, why: null };
    const w = why || "hold";
    if (state.why !== w) { state.why = w; state.count = 1; }
    else state.count = (Number.isFinite(state.count) ? state.count : 0) + 1;
    return { exhausted: state.count >= BUILD_GATE_SKIP_STREAK_LIMIT, count: state.count, why: state.why };
  } catch { return { exhausted: false, count: 0, why: null }; }
}

export function clearBuildGateSkipStreak(state) {
  try {
    if (!state || typeof state !== "object") return createBuildGateSkipStreakState();
    state.why = null; state.count = 0;
    return state;
  } catch { return createBuildGateSkipStreakState(); }
}

export function clearBuildGateHold(state) {
  try {
    if (!state || typeof state !== "object") return createBuildGateHoldState();
    state.key = null; state.totalMs = 0; state.lastAtMs = null; state.lastWhy = null;
    return state;
  } catch { return createBuildGateHoldState(); }
}
