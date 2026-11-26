// warehouse_categories.js — 倉庫 W1/W3: 仕分け先カテゴリ語彙の単一の正 (cyc1908)。
// UI・台帳・仕分け核 (warehouse_sort の category 一致) はこの語彙の id を共有する。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
export const WAREHOUSE_CATEGORIES = [
  { id: "ore", label: "鉱石・金属" },
  { id: "wood", label: "木材" },
  { id: "food", label: "食料" },
  { id: "block", label: "建材ブロック" },
  { id: "misc", label: "雑貨" },
];
export function isWarehouseCategory(id) {
  try { return typeof id === "string" && WAREHOUSE_CATEGORIES.some((c) => c.id === id); } catch { return false; }
}
export function categoryLabelOf(id) {
  try {
    if (typeof id !== "string") return null;
    const hit = WAREHOUSE_CATEGORIES.find((c) => c.id === id);
    return hit ? hit.label : null;
  } catch { return null; }
}
