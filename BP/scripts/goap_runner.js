// goap_runner.js — Phase 4 P4-A S2-0 (v0.5.102 base, cyc2363 A09)
// system.runJob 非同期プランナーのランナー正式化。未接続・挙動変化なし:
// 本モジュールは main.js からまだ import されない (S2-2 で配線予定)。
// 依存は ./goap.js の planGen のみ。サーバ API への依存を持たない
// (system は呼び出し側から createSystemScheduler(system) で注入する)。
// planGen の複写・再実装はしない。
// 出典設計: brain_parts/solutions/runjob-planner/DESIGN.md,
//   brain_parts/solutions/cycle0517-a10/PLAN.md,
//   tests/cyc2355_a09_phase4.md (S2-0/S2-1, C-3/C-4)
// P4-B の createFailureBias は持ち込まない (S2 対象外)。

import { planGen } from "./goap.js";

/**
 * 取消理由の語彙 (凍結)。
 * "new_order" 新しい命令 / "recall" 呼び戻し / "death" 死亡・再召喚 /
 * "superseded" 世代交代・記録消去 / "shutdown" 終了
 */
export const CANCEL_REASONS = Object.freeze(["new_order", "recall", "death", "superseded", "shutdown"]);

/**
 * createPlanRunner(deps)
 * deps: { schedule, cancel?, maxSlices? }
 * - schedule(generator) -> jobId: ジョブ登録 (BP: system.runJob / テスト: Manual)
 * - cancel(jobId): ジョブ取消 (BP: system.clearJob)。省略時は no-op。
 * - maxSlices: 1要求あたりの上限。意味は「yield 回数の上限 (tick 数ではない)」
 *   (C-4)。runJob は 1tick のバジェット内で複数ステップ進みうるため tick 数と
 *   一致しない。0/未指定 = 無制限 (本モジュール既定。240 等の初期値は
 *   呼び出し側 S2-2 が生成引数で渡す)。
 * 戻り値: { request, cancelCurrent, pendingGen, stats }
 * stats: { issued, completed, droppedStale, cancelled, timedOut, failed, lastCancelReason }
 *
 * request(req) -> { gen, jobId }
 * - スナップショット固定: state 浅複写 (fact はスカラー前提で完全)、
 *   goal/actions 配列複写、options 浅複写。要求後の元データ書換えは計画に効かない。
 * - 世代交代: 新規 request は旧ジョブを cancel し、旧世代の完了は
 *   onDone を呼ばず stats.droppedStale へ数えて捨てる (二重防御: cancel + 世代照合)。
 * - request() は複写とジョブ登録だけを行い即座に返す (ジェネレータを同期駆動しない)。
 * - onDone(result, gen) は最新世代の完了のみ。onTimeout(gen) は完了扱いにしない。
 *   onError(err, gen) は最新世代のみ。いずれも例外でランナーは死なない。
 * - C-3 修正: schedule が例外を投げたら rec を settled=true に畳み、
 *   stats.failed++ のうえで例外を伝播させる。settled=false の残留を作らない
 *   (残留すると pendingGen() が永久に非0になり後続要求が止まる)。
 */
export function createPlanRunner(deps = {}) {
  const schedule = deps.schedule;
  const cancelJob = typeof deps.cancel === "function" ? deps.cancel : () => {};
  const maxSlices = typeof deps.maxSlices === "number" && deps.maxSlices > 0 ? Math.floor(deps.maxSlices) : 0;
  if (typeof schedule !== "function")
    throw new Error("createPlanRunner: schedule(generator)->jobId is required");
  let genCounter = 0;
  let current = null; // { gen, jobId, settled }
  const stats = { issued: 0, completed: 0, droppedStale: 0, cancelled: 0, timedOut: 0, failed: 0, lastCancelReason: null };

  function supersedeCurrent(reason) {
    if (current && !current.settled) {
      current.settled = true;
      stats.cancelled++;
      stats.lastCancelReason = reason ?? "superseded";
      try { cancelJob(current.jobId); } catch {}
    }
  }

  function snapshotInput(req) {
    return {
      state: req?.state && typeof req.state === "object" ? { ...req.state } : req?.state,
      goal: Array.isArray(req?.goal) ? req.goal.slice() : req?.goal,
      actions: Array.isArray(req?.actions) ? req.actions.slice() : req?.actions,
      options: req?.options && typeof req.options === "object" ? { ...req.options } : req?.options,
    };
  }

  function request(req) {
    supersedeCurrent("superseded");
    const gen = ++genCounter;
    const rec = { gen, jobId: null, settled: false };
    current = rec;
    stats.issued++;
    const input = snapshotInput(req ?? {});
    const job = function* () {
      let result;
      let slices = 0;
      try {
        const inner = planGen(input.state, input.goal, input.actions, input.options);
        while (true) {
          const step = inner.next();
          if (step.done) { result = step.value; break; }
          slices++;
          if (maxSlices > 0 && slices > maxSlices) {
            if (!rec.settled && gen === genCounter) {
              rec.settled = true; stats.timedOut++;
              try { req?.onTimeout?.(gen); } catch {}
            }
            return;
          }
          yield step.value;
        }
      } catch (e) {
        if (!rec.settled && gen === genCounter) {
          rec.settled = true; stats.failed++;
          try { req?.onError?.(e, gen); } catch {}
        }
        return;
      }
      if (rec.settled || gen !== genCounter) { stats.droppedStale++; return; }
      rec.settled = true;
      stats.completed++;
      try { req?.onDone?.(result, gen); } catch {}
    };
    // C-3: schedule 例外時に settled=false 残留を作らない
    try {
      rec.jobId = schedule(job());
    } catch (e) {
      rec.settled = true;
      stats.failed++;
      if (current === rec) current = rec; // settled 済みなので pendingGen() は 0 を返す
      throw e;
    }
    return { gen, jobId: rec.jobId };
  }

  function cancelCurrent(reason) {
    supersedeCurrent(typeof reason === "string" ? reason : "superseded");
    if (current) current = null;
  }
  function pendingGen() { return current && !current.settled ? current.gen : 0; }

  return { request, cancelCurrent, pendingGen, stats };
}

/**
 * createSystemScheduler(system) -> { schedule, cancel }
 * system.runJob / system.clearJob が無ければ例外を投げる
 * (呼び出し側が同期経路へ倒すための契約)。
 */
export function createSystemScheduler(system) {
  if (!system || typeof system.runJob !== "function" || typeof system.clearJob !== "function")
    throw new Error("createSystemScheduler: system.runJob/clearJob unavailable");
  return {
    schedule: (gen) => system.runJob(gen),
    cancel: (jobId) => { try { system.clearJob(jobId); } catch {} },
  };
}

/**
 * createManualScheduler() -> { schedule, cancel, pump, activeCount }
 * テスト用手動ポンプ。1tick = 各ジョブを next() 1回だけ進める最保守モデル。
 * 契約の正しさはスライス粒度に依存しないことをこのモデルで検証する。
 */
export function createManualScheduler() {
  const jobs = new Map();
  let nextId = 1;
  return {
    schedule(gen) { const id = nextId++; jobs.set(id, gen); return id; },
    cancel(id) { jobs.delete(id); },
    pump(maxTicks = 1000000) {
      let t = 0;
      while (jobs.size && t < maxTicks) {
        t++;
        for (const [id, g] of [...jobs]) {
          let r;
          try { r = g.next(); } catch { jobs.delete(id); continue; }
          if (r.done) jobs.delete(id);
        }
      }
      return t;
    },
    activeCount() { return jobs.size; },
  };
}
