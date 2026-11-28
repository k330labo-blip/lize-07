// warehouse_adapter.js — 倉庫 W2 実コンテナ接続のアダプタ純粋核 (cyc1939)
// 実 ItemStack 形の生データ (typeId/name/durability/enchants/amount) を
// warehouse_sort / warehouse_exec が扱う boxes 形式へ変換する層。
// 実コンテナの読み書き自体は main 側が行い、ここは変換と結果要約だけを担う。
// 純粋・例外なし。@minecraft/server を import しない。
"use strict";

import { WAREHOUSE_ITEM_CATEGORIES } from "./warehouse_categories.js";

export function itemSnapshotOf(raw) {
  try {
    if (!raw || typeof raw !== "object" || typeof raw.typeId !== "string" || !raw.typeId) return null;
    const amount = typeof raw.amount === "number" && Number.isFinite(raw.amount) ? Math.floor(raw.amount) : 0;
    if (amount <= 0) return null;
    const enchants = Array.isArray(raw.enchants) ? raw.enchants.filter((e) => typeof e === "string" && e) : [];
    return {
      item: {
        typeId: raw.typeId,
        name: typeof raw.name === "string" && raw.name ? raw.name : null,
        durability: typeof raw.durability === "number" && Number.isFinite(raw.durability) ? raw.durability : null,
        enchants,
      },
      amount,
    };
  } catch { return null; }
}

export function boxSnapshotOf(regBox, rawSlots) {
  try {
    if (!regBox || typeof regBox.key !== "string" || !regBox.key) return null;
    const slots = (Array.isArray(rawSlots) ? rawSlots : []).map((s) => itemSnapshotOf(s));
    return {
      key: regBox.key,
      role: typeof regBox.role === "string" ? regBox.role : null,
      category: typeof regBox.category === "string" && regBox.category ? regBox.category : null,
      needsRecheck: !!regBox.needsRecheck,
      slots,
    };
  } catch { return null; }
}

// 台帳 + スナップショット群 -> planSortMoves の入力形
export function buildSortInput(reg, snapshots, scopeKey) {
  try {
    const boxes = (Array.isArray(snapshots) ? snapshots : []).filter((b) => b && typeof b.key === "string");
    const itemRules = (Array.isArray(reg?.itemRules) ? reg.itemRules : [])
      .filter((x) => x && typeof x.item === "string" && typeof x.boxKey === "string")
      .map((x) => ({ typeId: x.item, destKey: x.boxKey }));
    // W3 (2): 既知分類 (完全一致 typeId -> カテゴリ) を sort 核へ供給する (cyc2059)。
    // これが無いと本番経路では category move が構造的に発火しなかった。
    const categories = { ...WAREHOUSE_ITEM_CATEGORIES };
    // WH-SCOPE-01 H2 (cyc2476): 単一箱スコープが指定されたときだけ scopeKeys を供給する (未指定時は従来形と完全一致)
    const out = { boxes, itemRules, categories };
    if (typeof scopeKey === "string" && scopeKey) out.scopeKeys = [scopeKey];
    return out;
  } catch { return { boxes: [], itemRules: [], categories: {} }; }
}

// 計画 + 実行結果 -> プレイヤー向け報告の材料 (件数と理由の内訳)
export function summarizeSort(plan, execRes) {
  try {
    const moves = Array.isArray(plan?.moves) ? plan.moves : [];
    const leftovers = Array.isArray(plan?.leftovers) ? plan.leftovers : [];
    const skipped = Array.isArray(plan?.skipped) ? plan.skipped : [];
    const applied = execRes && Number.isInteger(execRes.applied) ? execRes.applied : 0;
    const stopped = !!(execRes && execRes.ok === false);
    return {
      planned: moves.length,
      applied,
      stopped,
      stopReason: stopped ? (execRes.reason || "error") : null,
      remaining: stopped && Array.isArray(execRes.remaining) ? execRes.remaining.length : Math.max(0, moves.length - applied),
      leftoverCount: leftovers.length,
      unknownCount: typeof plan?.stats?.unknownCount === "number" ? plan.stats.unknownCount : 0,
      skippedBoxes: skipped.length,
    };
  } catch { return { planned: 0, applied: 0, stopped: false, stopReason: null, remaining: 0, leftoverCount: 0, unknownCount: 0, skippedBoxes: 0 }; }
}
