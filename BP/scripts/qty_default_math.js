// qty_default_math.js — 0-N1 QTY-DEFAULT-01 (cyc2447): 数量省略時の対象別デフォルトの純粋核。
// 旧来は parserOrderToMission の `amount: o.amount ?? 32` が対象種別を問わず効き、
// 「水バケツほしい」まで32個扱いになっていた。是正は種別テーブルによる一般化とし、
// 個別アイテムの直書きはしない:
//   - hunt (討伐): 変換層の現行既定 32 を凍結 (HANDOFF「討伐は既存の既定を踏襲」)。
//     mission.js 側の fallback 1 は変換を経ない内部経路専用であり、ここでは混同しない。
//   - build (作製): 成果物は 1 個 (build 経路の下流既定 `o.amount ?? 1` と同値)。
//   - gather: 数量の単一の正である amount_math のスタック表で size===1 の品目
//     (バケツ類・道具・防具・弓・盾・ハサミ等) は 1、それ以外 (資源) は 32。
// 明示数量は一切変えない。例外を投げない。
import { stackSizeOfItem } from "./amount_math.js";

export const QTY_DEFAULT_HUNT = 32;
export const QTY_DEFAULT_RESOURCE = 32;
export const QTY_DEFAULT_SINGLE = 1;

export function defaultAmountFor(kind, targetId) {
  try {
    if (kind === "hunt") return QTY_DEFAULT_HUNT;
    if (kind === "build") return QTY_DEFAULT_SINGLE;
    // O5-KURE-GIVE-01 (cyc2517): give は gather と同じ対象別デフォルトを使う
    // (下のスタック表分岐へそのまま通す。hunt/build の分岐へは入れない)。
    if (targetId && stackSizeOfItem(String(targetId)).size === 1) return QTY_DEFAULT_SINGLE;
    return QTY_DEFAULT_RESOURCE;
  } catch { return QTY_DEFAULT_RESOURCE; }
}

// 注文オブジェクト { kind, target:{item|block|entity}, amount } から mission 数量を決める。
// amount が有限数ならそのまま返す (0 はパーサー段で clarify 済みだが、ここでも素通しする)。
export function orderAmountOrDefault(o) {
  try {
    if (!o || typeof o !== "object") return QTY_DEFAULT_RESOURCE;
    if (typeof o.amount === "number" && Number.isFinite(o.amount)) return o.amount;
    const t = o.target || {};
    const id = typeof t === "string" ? t : (t.item || t.block || t.entity || null);
    return defaultAmountFor(o.kind || null, id);
  } catch { return QTY_DEFAULT_RESOURCE; }
}
export default orderAmountOrDefault;
