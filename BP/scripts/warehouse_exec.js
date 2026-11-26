// warehouse_exec.js — 倉庫 W2 実行側の純粋核 (v0.5.80)
// warehouse_sort.js の計画 (moves) を実箱へ適用する前に、各 move を
// 「移動直前のスロット再確認」つきで検証・適用する層。実コンテナ読み書きの
// アダプタ (main 側) はこの核へスナップショットを渡し、ok な move だけを実行する。
// 規約 (crafting_tx 準拠): 再確認で食い違った move は実行せず理由を返す。
// 失敗した move 以降は計画全体を止める (部分適用の所在を確定させるため、
// 適用済み件数と未適用の move を必ず返す)。消失・複製は作らない:
// 適用は「元から減らす→先へ足す」を1つの検証済みステップとしてのみ行う。
// 純粋・決定的・例外なし。入力 boxes は変更せず、適用後の新しい boxes を返す。
"use strict";

import { identityKeyOf } from "./warehouse_sort.js";

function cloneBoxes(boxes) {
  return (Array.isArray(boxes) ? boxes : []).map((b) => ({
    ...b,
    slots: (Array.isArray(b?.slots) ? b.slots : []).map((s) => (s ? { item: { ...s.item }, amount: s.amount } : null)),
  }));
}

function findBox(boxes, key) { return boxes.find((b) => b && b.key === key) || null; }

// 1 move の再確認: 元スロットに計画どおりの品が計画以上の量あるか、
// 先スロットが「空き」または「同一 identity で上限未満」か、上限を超えないか。
export function verifyMove(boxes, move, stackSizes) {
  try {
    if (!move || typeof move !== "object") return { ok: false, reason: "invalid_move" };
    const from = findBox(boxes, move.fromKey); const to = findBox(boxes, move.toKey);
    if (!from) return { ok: false, reason: "from_missing" };
    if (!to) return { ok: false, reason: "to_missing" };
    if (to.role === "excluded") return { ok: false, reason: "to_excluded" };
    if (to.needsRecheck) return { ok: false, reason: "to_needs_recheck" };
    const fs = from.slots?.[move.fromSlot]; const ts = to.slots?.[move.toSlot];
    if (!fs || !fs.item) return { ok: false, reason: "from_empty" };
    if (identityKeyOf(fs.item) !== identityKeyOf(move.item)) return { ok: false, reason: "from_changed" };
    if (typeof fs.amount !== "number" || fs.amount < move.amount) return { ok: false, reason: "from_short" };
    const cap = (stackSizes && typeof stackSizes[fs.item.typeId] === "number" ? stackSizes[fs.item.typeId] : 64);
    if (ts && ts.item) {
      if (identityKeyOf(ts.item) !== identityKeyOf(move.item)) return { ok: false, reason: "to_occupied_other" };
      if (ts.amount + move.amount > cap) return { ok: false, reason: "to_overflow" };
    }
    return { ok: true };
  } catch { return { ok: false, reason: "error" }; }
}

// 計画を順に再確認しながら適用する。途中で失敗したらそこで止め、
// applied (適用済み件数) と failedAt / reason、未適用 moves を返す。
// boxes は変更しない (適用後の写しを返す)。
export function applyMovesVerified(boxes, moves, stackSizes) {
  try {
    const work = cloneBoxes(boxes);
    const list = Array.isArray(moves) ? moves : [];
    let applied = 0;
    for (let i = 0; i < list.length; i++) {
      const mv = list[i];
      const v = verifyMove(work, mv, stackSizes);
      if (!v.ok) return { ok: false, boxes: work, applied, failedAt: i, reason: v.reason, remaining: list.slice(i) };
      const from = findBox(work, mv.fromKey); const to = findBox(work, mv.toKey);
      const fs = from.slots[mv.fromSlot];
      fs.amount -= mv.amount; if (fs.amount <= 0) from.slots[mv.fromSlot] = null;
      const ts = to.slots[mv.toSlot];
      if (ts && ts.item) ts.amount += mv.amount;
      else to.slots[mv.toSlot] = { item: { ...mv.item }, amount: mv.amount };
      applied++;
    }
    return { ok: true, boxes: work, applied, failedAt: -1, reason: null, remaining: [] };
  } catch { return { ok: false, boxes: cloneBoxes(boxes), applied: 0, failedAt: 0, reason: "error", remaining: Array.isArray(moves) ? moves.slice() : [] }; }
}
