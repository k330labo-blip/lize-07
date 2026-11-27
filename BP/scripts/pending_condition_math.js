// pending_condition_math.js — E-01 (cycle1722): 条件保留 (pendingConditionOrder) の永続化純粋核。
// 保留は従来メモリ内 rt(bot) にしか無く、再起動・回収・死亡で約束した指示が無言消失していた。
// 保存形式の単一の正をここに置く: 検証を通らない保存は復元しない (fail-closed、壊れた保留で誤発火させない)。
// Pure: no @minecraft/server import, never throws.
export function normalizePendingCondition(pend) {
  try {
    if (!pend || typeof pend !== "object") return null;
    const o = pend.order;
    if (!o || typeof o !== "object") return null;
    const cond = o.constraints?.condition;
    if (!cond || typeof cond !== "object" || typeof cond.kind !== "string" || !cond.kind) return null;
    const at = pend.at;
    if (typeof at !== "number" || !Number.isFinite(at) || at <= 0) return null;
    // JSON 往復で複製し、保存できない値 (関数・循環) を含む注文は落とす
    const orderCopy = JSON.parse(JSON.stringify(o));
    if (!orderCopy || typeof orderCopy !== "object") return null;
    // PENDING-FIRE-BUSY-NOLATCH-01 (cyc2410): 繁忙中の成立ラッチ metAt も往復で保持する (正の有限数だけ。不正値は落とす)
    const metAt = (typeof pend.metAt === "number" && Number.isFinite(pend.metAt) && pend.metAt > 0) ? Math.floor(pend.metAt) : null;
    return { order: orderCopy, at: Math.floor(at), ownerId: typeof pend.ownerId === "string" ? pend.ownerId : null, ...(metAt ? { metAt } : {}) };
  } catch { return null; }
}
export function serializePendingCondition(pend) {
  try { const n = normalizePendingCondition(pend); return n ? JSON.stringify(n) : ""; } catch { return ""; }
}
export function deserializePendingCondition(json) {
  try {
    if (!json || typeof json !== "string") return null;
    return normalizePendingCondition(JSON.parse(json)); // 破損・形違い・条件なし => null (保留なしとして開始)
  } catch { return null; }
}
