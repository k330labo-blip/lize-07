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

// S5 (cyc2383): 溶岩充填の安全な立ち位置の選択 (純粋)。
// 罠 (cyc2382 A16 §2-1/§3-1): lavaNear を媒体セルへ当てると常時 true で全拒否になる。
// 判定対象は媒体セルでなく立ち位置候補であり、候補の lavaAround は「媒体セル方向の
// 近傍を除外して」呼び出し側が数える (溶岩源に隣接するだけで全候補が危険になるため)。
// candidates: [{ loc, free, lavaAround }]、selfPos からの最寄りの安全候補を返す。
export function selectSafeFillStand(input) {
  try {
    const self = input?.selfPos; if (!self) return { stand: null, reason: "no_safe_stand" };
    let best = null;
    for (const c of input?.candidates || []) {
      if (!c || !c.loc || c.free !== true || c.lavaAround === true) continue;
      const d = Math.hypot(c.loc.x + 0.5 - self.x, c.loc.y - self.y, c.loc.z + 0.5 - self.z);
      if (!best || d < best.d) best = { stand: c.loc, d };
    }
    return best ? { stand: best.stand, reason: null } : { stand: null, reason: "no_safe_stand" };
  } catch { return { stand: null, reason: "no_safe_stand" }; }
}

// S5 (cyc2383): 現在位置が溶岩に対して危険か (純粋)。neighborTypeIds は媒体セルを
// 除外した近傍の typeId 群を呼び出し側が渡す。
export function fillStandUnsafe(input) {
  try {
    const isLava = (t) => typeof t === "string" && t.includes("lava");
    if (isLava(input?.selfTypeId)) return true;
    for (const t of input?.neighborTypeIds || []) if (isLava(t)) return true;
    return false;
  } catch { return false; }
}

// S3 (cyc2381): entity 媒体の選択 (純粋)。ban 形式は trunk_ban.js banKeyFor の実形式:
// fill 媒体 (cow/water/lava) は幹・落下ブロックではないため常に cellKey
// "floor(x),floor(y),floor(z)" (typeId なし)。trunk:/fall: 形式は fill では発生しない (cyc2380 A16 確定)。
export function selectFillMedium(input) {
  try {
    const def = input?.def; if (!def || def.mediumKind !== "entity") return null;
    const mediaIds = Array.isArray(input?.mediaIds) && input.mediaIds.length ? input.mediaIds : [def.medium];
    const self = input?.selfPos; if (!self) return null;
    const now = Number(input?.now) || 0;
    const banned = (loc, id) => { try { if (!input?.banKey || !(now < (Number(input?.banUntil) || 0))) return false; if (typeof input.banKey === "string" && input.banKey.startsWith("ent:")) return id != null && input.banKey === `ent:${id}`; return input.banKey === `${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`; } catch { return false; } }; // FILL-BAN-CELL-01 (cyc2409): ent: キーは実体IDで照合 (セルキーでは移動で即すり抜けた)
    let best = null;
    for (const a of input?.animals || []) {
      if (!a || !mediaIds.includes(a.typeId) || !a.loc) continue;
      if (banned(a.loc, a.id)) continue;
      const d = Math.hypot(a.loc.x - self.x, a.loc.y - self.y, a.loc.z - self.z);
      const rank = mediaIds.indexOf(a.typeId);
      if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && rank < best.rank)) best = { entityId: a.id ?? null, typeId: a.typeId, loc: a.loc, d, rank };
    }
    return best ? { entityId: best.entityId, typeId: best.typeId, loc: best.loc } : null;
  } catch { return null; }
}
