// tool_request_math.js — 0-C4 R-C4-1 (cyc2375): 道具指定の実行側 reader 純粋核。
// 設計: tests/cyc2374_a02_rc4.md §3.1。注文に保持された tool（手段の指定）を、
// 装備中／所持／作製可能／不可能へ振り分ける。世界を読まない・例外を投げない・決定的。
// 「指定は指定として扱う」: 上位道具での代替はしない（tier 代替は 0-B/0-J の既存判断の領分）。

export function toolItemIdOf(tool) {
  try {
    if (!tool) return null;
    const raw = typeof tool === "string" ? tool : (tool.item || tool.typeId || tool.id || null);
    if (typeof raw !== "string" || !raw) return null;
    return raw.includes(":") ? raw : "minecraft:" + raw;
  } catch { return null; }
}

// 入力: { tool, invCounts, equippedMainhand, feasible }
//   tool: 注文の tool（{item:"iron_pickaxe"} / 文字列 / null）
//   invCounts: countInv(bot) の {typeId(接頭辞付き): n}
//   equippedMainhand: equipCore.getEquipped("Mainhand")?.typeId または null
//   feasible: 未所持時に planLongTask で作製可能か（呼び出し側が判定して渡す）
// 出力: { action: "none"|"already"|"equip"|"procure"|"clarify", itemId, reason }
export function resolveRequestedTool(input) {
  try {
    const itemId = toolItemIdOf(input?.tool);
    if (!itemId) return { action: "none", itemId: null, reason: "no_tool_specified" };
    const eq = typeof input?.equippedMainhand === "string" ? input.equippedMainhand : null;
    if (eq === itemId) return { action: "already", itemId, reason: "already_equipped" };
    const inv = input?.invCounts || {};
    if ((inv[itemId] || 0) > 0) return { action: "equip", itemId, reason: "in_inventory" };
    if (input?.feasible) return { action: "procure", itemId, reason: "craftable" };
    return { action: "clarify", itemId, reason: "not_owned_not_craftable" };
  } catch { return { action: "none", itemId: null, reason: "no_tool_specified" }; }
}
