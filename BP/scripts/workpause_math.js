// workpause_math.js — POLISH-ANIM-WORKPAUSE-01 (cycle1256): 連続作業が節目に
// 達した瞬間に一度だけ、2〜3秒の小さな「一息」を表示層へ提案する純粋核。
// 設計: brain_parts/solutions/cycle1256-a10-polish.md §2。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// feeder 未接続 (純粋核先行統合)。作業の進行・完了判定には一切関与しない。

export const WORKPAUSE_MILESTONE = 8;        // 連続成功この回数で節目
export const WORKPAUSE_MIN_GAP_MS = 90000;   // 前回発火からの最小間隔
export const WORKPAUSE_WINDOW_MS = 4000;     // 節目後の提案有効窓
export const WORKPAUSE_DURATION_MS = 2600;   // 一息の長さ

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

export function createWorkpauseState() {
  return { streak: 0, lastOutcome: null, lastFiredMs: null, pendingAtMs: null, consumedKey: null };
}
function normalizeState(state) {
  const s = state && typeof state === "object" ? state : {};
  const st = fin(s.streak);
  return {
    streak: st !== null && st > 0 ? Math.floor(st) : 0,
    lastOutcome: typeof s.lastOutcome === "string" ? s.lastOutcome : null,
    lastFiredMs: fin(s.lastFiredMs),
    pendingAtMs: fin(s.pendingAtMs),
    consumedKey: typeof s.consumedKey === "string" ? s.consumedKey : null,
  };
}

// noteWorkpause(state, input) -> { state, fired }
// input = { nowMs, outcome: "success"|"fail"|"other"|null, workKey, suppressed, busy }
// 成功が WORKPAUSE_MIN_GAP_MS 以上空けて WORKPAUSE_MILESTONE 回連続し、
// その観測で suppressed/busy が無ければ fired:true を1回だけ返す。
// 失敗・別作業への切替で streak はリセットされる。
export function noteWorkpause(state, input) {
  try {
    const prev = normalizeState(state);
    const inp = input && typeof input === "object" ? input : {};
    const now = fin(inp.nowMs);
    if (now === null) return { state: prev, fired: false };
    const key = typeof inp.workKey === "string" ? inp.workKey : null;
    let streak = prev.streak;
    if (inp.outcome === "success") {
      streak = (prev.lastOutcome === "success" && (key === null || prev.consumedKey === null || key === prev.consumedKey || prev.streak === 0)) ? streak + 1 : 1;
      if (key !== null && prev.streak > 0 && prev.consumedKey !== null && key !== prev.consumedKey) streak = 1;
    } else if (inp.outcome === "fail" || inp.outcome === "other") {
      streak = 0;
    }
    const next = { ...prev, streak, lastOutcome: typeof inp.outcome === "string" ? inp.outcome : prev.lastOutcome, consumedKey: key ?? prev.consumedKey };
    if (streak < WORKPAUSE_MILESTONE) return { state: next, fired: false };
    // 節目到達: ここで消費する (遅れ発火なし)
    next.streak = 0;
    const gapOk = prev.lastFiredMs === null || now - prev.lastFiredMs >= WORKPAUSE_MIN_GAP_MS;
    if (!gapOk || inp.suppressed === true || inp.busy === true) return { state: next, fired: false };
    next.lastFiredMs = now;
    next.pendingAtMs = now;
    return { state: next, fired: true };
  } catch { return { state: normalizeState(state), fired: false }; }
}

// sampleWorkpause(state, nowMs) -> { active, phase, elapsedMs }
export function sampleWorkpause(state, nowMs) {
  try {
    const s = normalizeState(state);
    const now = fin(nowMs);
    if (s.pendingAtMs === null || now === null) return { active: false, phase: null, elapsedMs: null };
    const e = now - s.pendingAtMs;
    if (e < 0 || e >= WORKPAUSE_DURATION_MS) return { active: false, phase: null, elapsedMs: null };
    const phase = e < 500 ? "dip" : e < 1800 ? "hold" : "rise";
    return { active: true, phase, elapsedMs: e };
  } catch { return { active: false, phase: null, elapsedMs: null }; }
}
export default noteWorkpause;
