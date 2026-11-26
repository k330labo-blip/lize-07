// fill_math.js — 0-C R-C4-4 (cyc2378): 容器充填 (fill) の純粋核。
// 設計: tests/cyc2374_a16_rc4_4.md §2/§3、tests/cyc2378_a15_rc44_design.md §1。
// 世界を読まない・例外を投げない・決定的。在庫スナップショットと媒体状態を
// 入力に、充填 tx (S4) の事前条件と事後検証を純粋判定として返すだけ。
// 実行 (takeFromInv / setType / addTo) は S4 で main.js 側が行う。

// 充填定義表: 充填品目 -> { container, medium, mediumKind }
//   mediumKind "entity": 媒体は生物 (牛)。殺さない・傷つけない。
//   mediumKind "block" : 媒体は源泉ブロック (typeId 完全一致のみ)。
//                        flowing_water / flowing_lava は源泉ではないため不可。
export const FILL_DEFS = {
  "minecraft:milk_bucket": { container: "minecraft:bucket", medium: "minecraft:cow", mediumKind: "entity" },
  "minecraft:water_bucket": { container: "minecraft:bucket", medium: "minecraft:water", mediumKind: "block" },
  "minecraft:lava_bucket": { container: "minecraft:bucket", medium: "minecraft:lava", mediumKind: "block" },
};

// 代替源 (推奨順2位)。定義表の正は cow のみとし、mooshroom は sourcing 側の
// alternatives として保持する (scan.animals の対象外のため実行判定には使わない。
// tests/cyc2377_a16_rc4_4.md §3-2)。
export const FILL_ALT_MEDIA = {
  "minecraft:milk_bucket": ["minecraft:mooshroom"],
};

export function fillDefOf(itemId) {
  try {
    if (typeof itemId !== "string") return null;
    return FILL_DEFS[itemId] || null;
  } catch { return null; }
}

export function isFillItem(itemId) {
  return fillDefOf(itemId) !== null;
}

// 媒体セルの typeId が「汲める源泉」か。block medium のみ意味を持つ。
// 完全一致のみ: "minecraft:flowing_water" 等は false。
export function isSourceMediumCell(def, cellTypeId) {
  try {
    if (!def || def.mediumKind !== "block") return false;
    return cellTypeId === def.medium;
  } catch { return false; }
}

// tx 事前条件の純粋判定。
// 入力: { item, inv, mediumTypeId, mediumPresent, sameDim, inRange, isAdult }
// 出力: { ok:true, def } | { ok:false, reason }
//   reason: "unknown_item" | "no_medium" | "medium_mismatch" | "not_adult"
//         | "wrong_dim" | "out_of_range" | "no_container"
export function checkFillPreconditions(input) {
  try {
    const def = fillDefOf(input?.item);
    if (!def) return { ok: false, reason: "unknown_item" };
    if (!input?.mediumPresent) return { ok: false, reason: "no_medium" };
    if (input?.mediumTypeId !== def.medium) {
      const alt = FILL_ALT_MEDIA[input.item] || [];
      if (!alt.includes(input?.mediumTypeId)) return { ok: false, reason: "medium_mismatch" };
    }
    if (def.mediumKind === "entity" && input?.isAdult === false) return { ok: false, reason: "not_adult" };
    if (input?.sameDim === false) return { ok: false, reason: "wrong_dim" };
    if (input?.inRange === false) return { ok: false, reason: "out_of_range" };
    const have = Number(input?.inv?.[def.container]) || 0;
    if (have < 1) return { ok: false, reason: "no_container" };
    return { ok: true, def };
  } catch { return { ok: false, reason: "unknown_item" }; }
}

// tx 事後検証の純粋判定。before/after は {itemId: 個数}、dropped は足元へ
// 落とした充填品目の個数 (所在確定分として充填品目の増加に算入する)。
// 合格条件: 容器がちょうど -1、充填品目が (所持 + dropped) でちょうど +1。
export function verifyFillPost(input) {
  try {
    const def = fillDefOf(input?.item);
    if (!def) return { ok: false, reason: "unknown_item" };
    const b = input?.before || {}, a = input?.after || {};
    const dropped = Math.max(0, Math.floor(Number(input?.dropped) || 0));
    const dContainer = (Number(a[def.container]) || 0) - (Number(b[def.container]) || 0);
    const dFilled = (Number(a[input.item]) || 0) + dropped - (Number(b[input.item]) || 0);
    if (dContainer !== -1) return { ok: false, reason: "container_delta", dContainer, dFilled };
    if (dFilled !== 1) return { ok: false, reason: "filled_delta", dContainer, dFilled };
    return { ok: true, dContainer, dFilled };
  } catch { return { ok: false, reason: "unknown_item" }; }
}

// 残必要数に対する tx 実行上限 (余分に汲まない。cyc2374 §2-3)。
export function fillRunsNeeded(def, haveFilled, want) {
  try {
    if (!def) return 0;
    const w = Math.max(0, Math.floor(Number(want) || 0));
    const h = Math.max(0, Math.floor(Number(haveFilled) || 0));
    return Math.max(0, w - h);
  } catch { return 0; }
}
