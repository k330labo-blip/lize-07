// deliver_guard_math.js — A18-TR-01 (cycle0446): planner deliver_to_owner の満杯失敗への出口 (純粋核)
// 背景: planner 経路だけが失敗フラグ・失敗記録・上限の三点を欠き、主人満杯時に同一 goal が
// 毎 tick 再選定され transferFiltered の全スロット走査を繰り返す無出口経路だった
// (tests/cycle0403_a18_transfer.md)。mission/longtask 側の出口 (LT_DELIVER_FAIL_LIMIT 等) と同型に、
// 連続全滅失敗を数え、上限で冷却へ倒して他 goal へ譲る。部分移送 (moved>0) は進捗として数えない。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
export const DELIVER_FAIL_LIMIT = 3;
export const DELIVER_COOLDOWN_MS = 60000;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

export function createDeliverGuardState() { return { fails: 0, cooldownUntil: 0 }; }

// noteDeliverOutcome(state, outcome, nowMs) -> { action, fails }
// outcome: { moved, failed, invUnavailable }
//  - moved>0: 進捗。fails を 0 へ (部分移送も含む。残りが詰まるのは moved=0 の回で数える)
//  - moved=0 かつ failed でない (空振り): recordStore の作法どおり失敗ではない。状態不変
//  - moved=0 かつ (failed || invUnavailable): 連続失敗として加算。上限で cooldown + fails リセット
export function noteDeliverOutcome(state, outcome, nowMs) {
  try {
    if (!state || typeof state !== "object") return { action: "invalid", fails: 0 };
    const now = finiteOrNull(nowMs);
    if (now === null || !outcome || typeof outcome !== "object") return { action: "invalid", fails: state.fails || 0 };
    const moved = typeof outcome.moved === "number" && Number.isFinite(outcome.moved) ? outcome.moved : 0;
    if (moved > 0) { state.fails = 0; return { action: "progress", fails: 0 }; }
    if (outcome.failed !== true && outcome.invUnavailable !== true) return { action: "empty", fails: state.fails || 0 };
    state.fails = (Number.isInteger(state.fails) && state.fails > 0 ? state.fails : 0) + 1;
    if (state.fails >= DELIVER_FAIL_LIMIT) {
      state.fails = 0;
      state.cooldownUntil = now + DELIVER_COOLDOWN_MS;
      return { action: "cooldown", fails: 0 };
    }
    return { action: "fail", fails: state.fails };
  } catch { return { action: "invalid", fails: 0 }; }
}

export function isDeliverCooling(state, nowMs) {
  try {
    if (!state || typeof state !== "object") return false;
    const now = finiteOrNull(nowMs), until = finiteOrNull(state.cooldownUntil);
    if (now === null || until === null) return false;
    return now < until;
  } catch { return false; }
}
