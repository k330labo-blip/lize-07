// warehouse_sort.js — 倉庫 W2 仕分けエンジンの純粋核 (cycle-next v0.5.79 統合)
// 要件の正は brain_parts/solutions/warehouse/REQUIREMENTS.md のステージ W2。
// 実行側 (箱を開く実測・スロット再確認つき適用) は次段。本核は計画のみ。
//
// 設計方針:
// - 純粋・決定的・例外なし。@minecraft/server を import しない。入力を一切変更しない
//   (内部でディープクローンしたシミュレーション状態だけを操作する)。
// - 計画 (plan) と適用 (applyPlan, 検証・ドライラン用) を分離する。実行側 (main) は
//   計画の各 move を「移動直前にスロット再確認」してから適用する想定で、
//   本核はスナップショットに対する計画だけに責任を持つ。
// - 行き先の判定順 (W3 の先取り分): (1) itemRules の教えた行き先 (2) カテゴリ分類データ
//   による category 一致の dest 箱。(3)(4) のタグ・推測は本核の対象外:
//   行き先不明の品は元箱に残す (leftovers, reason "unknown_destination")。
// - 書いてはいけない箱: role "excluded" の箱と needsRecheck の箱へは書かない。
//   excluded は読み出し (移動元) にもしない (要件 §2「除外箱なら作業しない」)。
//   needsRecheck は移動元にはなりうるが移動先にはならない
//   (W1 台帳の規則「再確認まで書き込み先に使わない」に一致)。
// - 同一性: typeId + name + durability + enchants の完全一致でのみ同一視する。
//   名前・耐久・エンチャントが異なる品は、同一 typeId でも部分スタックへ合流させない。
// - 部分スタック優先: 移動先では「同一 identity の部分スタック (上限未満)」を先に詰め、
//   次に空きスロットを使う。同カテゴリの dest 箱が複数ある場合もこの順序は箱を跨いで適用する。
// - 正しい箱にある品は維持する: アイテムが既に正しい dest 箱 (ルール先、または
//   カテゴリ一致の dest 箱のいずれか) にある場合は箱間移動をしない。
//   ただし同箱内のスタック圧縮 (compaction) は行う。
// - 冪等性: 計画を applyPlan で適用した状態へ再計画すると moves は 0 件になる。
//   根拠: (a) 移動後の品は正しい箱にあり「維持」対象になる (b) 行き先不明・満杯の
//   残りは再計画でも同じ理由で残る (c) 圧縮後は 1 箱 1 identity につき
//   部分スタックが最大 1 つしか残らない。
//
// 入力 (input):
// {
//   boxes: [{ key, role: "intake"|"dest"|"source"|"excluded"|"unclassified",
//             category: string|null, needsRecheck?: boolean,
//             slots: [{ item: { typeId, name?, durability?, enchants? }, amount } | null],
//             capacity?: number }],   // capacity は総スロット数 (省略時は slots.length)
//   itemRules: [{ typeId, destKey }], // W1 台帳の { item, boxKey } 形も受理する
//   categories: { [typeId]: category },                 // 分類データ (その1: 写像)
//   categoryRules: [{ typeId, category }],              // 分類データ (その2: 一覧)
//   categoryItems: [{ category, typeIds: [typeId] }],   // 分類データ (その3: 逆引き)
//   stackSizes: { [typeId]: number },                   // 任意: スタック上限の上書き
//   scopeKeys: [key],  // 任意: 指定時はその箱だけを移動元にする (単一箱整理)
// }
// 出力:
// {
//   ok: true,
//   moves: [{ fromKey, fromSlot, toKey, toSlot, item, amount, reason: "rule"|"category"|"compact" }],
//   leftovers: [{ key, slot, item, amount, reason: "unknown_destination"|"dest_full"|"dest_unavailable" }],
//   skipped: [{ key, reason: "excluded"|"needs_recheck_dest_only" }],  // 触らなかった/先にできない箱
//   stats: { moveCount, movedTotal, keptCount, leftoverCount, unknownCount },
// }

// --- スタック表 (amount_math.js の STACK 表と同値の自己完結コピー。統合時に単一の正へ寄せる) ---
const STACK_1_PATTERNS = Object.freeze([
  /_pickaxe$/, /_axe$/, /_sword$/, /_shovel$/, /_hoe$/,
  /_helmet$/, /_chestplate$/, /_leggings$/, /_boots$/,
  /minecraft:bow$/, /minecraft:shield$/, /minecraft:fishing_rod$/,
  /minecraft:shears$/, /minecraft:flint_and_steel$/, /minecraft:crossbow$/,
  /minecraft:trident$/, /minecraft:elytra$/, /minecraft:saddle$/,
  /minecraft:potion$/, /minecraft:splash_potion$/, /minecraft:lingering_potion$/,
  /minecraft:cake$/, /_stew$/, /_soup$/, /bucket$/,
  // cyc1810 R-6: amount_math と同値に保つ (自己完結コピーの再分裂防止)
  /_boat$/, /_chest_boat$/, /_raft$/, /_chest_raft$/, /minecart$/,
  /_bed$/, /minecraft:bed$/, /^minecraft:music_disc_/, /_horse_armor$/,
  /(^|:)shulker_box$/, /_shulker_box$/, /_on_a_stick$/, /_bundle$/, /minecraft:bundle$/,
]);
const STACK_1_IDS = new Set([
  "minecraft:totem_of_undying", "minecraft:spyglass", "minecraft:brush",
  "minecraft:mace", "minecraft:goat_horn", "minecraft:wolf_armor",
  "minecraft:enchanted_book", "minecraft:knowledge_book", "minecraft:writable_book",
]);
const STACK_16_IDS = new Set([
  "minecraft:ender_pearl", "minecraft:egg", "minecraft:snowball", "minecraft:honey_bottle",
  "minecraft:sign", "minecraft:armor_stand", "minecraft:written_book", // cyc1810: amount_math と一致 (sign は R-5 で warehouse だけ漏れていた)
]);
const STACK_16_PATTERNS = Object.freeze([/_sign$/, /_hanging_sign$/, /banner$/]);

export function stackSizeOf(typeId, overrides) {
  try {
    if (overrides && typeof overrides === "object" && typeof typeId === "string") {
      const o = overrides[typeId];
      if (typeof o === "number" && Number.isFinite(o) && o >= 1) return Math.floor(o);
    }
    if (typeof typeId !== "string" || !typeId) return 64;
    const id = typeId.includes(":") ? typeId : "minecraft:" + typeId;
    if (STACK_1_PATTERNS.some((re) => re.test(id))) return 1;
    if (STACK_1_IDS.has(id)) return 1;
    if (STACK_16_IDS.has(id)) return 16;
    if (STACK_16_PATTERNS.some((re) => re.test(id))) return 16;
    return 64;
  } catch { return 64; }
}

// --- identity: typeId + name + durability + enchants の完全一致 ---
function normEnchants(enchants) {
  try {
    if (Array.isArray(enchants)) {
      return enchants.map((e) => {
        if (typeof e === "string") return e;
        if (e && typeof e === "object") {
          const id = typeof e.id === "string" ? e.id : (typeof e.typeId === "string" ? e.typeId : "");
          const lv = typeof e.level === "number" && Number.isFinite(e.level) ? e.level : 1;
          return id ? `${id}:${lv}` : "";
        }
        return "";
      }).filter(Boolean).sort();
    }
    if (enchants && typeof enchants === "object") {
      return Object.keys(enchants).sort().map((k) => `${k}:${enchants[k]}`);
    }
    return [];
  } catch { return []; }
}

function normItem(item) {
  try {
    if (!item || typeof item !== "object" || typeof item.typeId !== "string" || !item.typeId) return null;
    return {
      typeId: item.typeId,
      name: typeof item.name === "string" && item.name ? item.name : null,
      durability: typeof item.durability === "number" && Number.isFinite(item.durability) ? item.durability : null,
      enchants: normEnchants(item.enchants),
    };
  } catch { return null; }
}

export function identityKeyOf(item) {
  try {
    const n = normItem(item);
    if (!n) return null;
    return JSON.stringify([n.typeId, n.name, n.durability, n.enchants]);
  } catch { return null; }
}

function cloneItem(n) { return { typeId: n.typeId, name: n.name, durability: n.durability, enchants: [...n.enchants] }; }

// --- 入力の正規化 (壊れた要素は落とす。例外なし) ---
function normBoxes(input) {
  const out = [];
  const seen = new Set();
  for (const b of Array.isArray(input?.boxes) ? input.boxes : []) {
    try {
      if (!b || typeof b !== "object" || typeof b.key !== "string" || !b.key || seen.has(b.key)) continue;
      seen.add(b.key);
      const capRaw = typeof b.capacity === "number" && Number.isFinite(b.capacity) && b.capacity >= 0 ? Math.floor(b.capacity) : null;
      const rawSlots = Array.isArray(b.slots) ? b.slots : [];
      const slotCount = Math.max(rawSlots.length, capRaw ?? 0);
      const slots = [];
      for (let i = 0; i < slotCount; i++) {
        const s = rawSlots[i];
        const item = s && typeof s === "object" ? normItem(s.item) : null;
        const amount = s && typeof s.amount === "number" && Number.isFinite(s.amount) ? Math.floor(s.amount) : 0;
        slots.push(item && amount > 0 ? { item, amount } : null);
      }
      out.push({
        key: b.key,
        role: typeof b.role === "string" ? b.role : null,
        category: typeof b.category === "string" && b.category ? b.category : null,
        needsRecheck: !!b.needsRecheck,
        slots,
      });
    } catch { /* 壊れた箱は読み飛ばす */ }
  }
  return out;
}

function normItemRules(input) {
  const map = new Map(); // typeId -> destKey (先勝ちで決定的に)
  const add = (typeId, destKey) => {
    if (typeof typeId === "string" && typeId && typeof destKey === "string" && destKey && !map.has(typeId)) map.set(typeId, destKey);
  };
  for (const r of Array.isArray(input?.itemRules) ? input.itemRules : []) {
    try {
      if (!r || typeof r !== "object") continue;
      add(r.typeId ?? r.item, r.destKey ?? r.boxKey ?? r.dest);
    } catch { /* ignore */ }
  }
  return map;
}

function normCategories(input) {
  const map = new Map(); // typeId -> category (先勝ち)
  const add = (typeId, category) => {
    if (typeof typeId === "string" && typeId && typeof category === "string" && category && !map.has(typeId)) map.set(typeId, category);
  };
  try {
    if (input?.categories && typeof input.categories === "object" && !Array.isArray(input.categories)) {
      for (const [k, v] of Object.entries(input.categories)) add(k, v);
    }
    for (const r of Array.isArray(input?.categoryRules) ? input.categoryRules : []) {
      if (r && typeof r === "object") add(r.typeId ?? r.item, r.category);
    }
    for (const r of Array.isArray(input?.categoryItems) ? input.categoryItems : []) {
      if (r && typeof r === "object" && Array.isArray(r.typeIds)) for (const t of r.typeIds) add(t, r.category);
    }
  } catch { /* ignore */ }
  return map;
}

const WRITABLE_ROLES = new Set(["dest", "unclassified"]);
function isWritableDest(box) { return !!box && box.role !== "excluded" && !box.needsRecheck && WRITABLE_ROLES.has(box.role); }
function isSource(box, scope) {
  if (!box || box.role === "excluded") return false;
  if (scope && !scope.has(box.key)) return false;
  // 移動元は intake / source / dest (誤分類の是正) / unclassified。role 不明の箱は触らない。
  return ["intake", "source", "dest", "unclassified"].includes(box.role);
}

// シミュレーション上の移動先スロット候補: 部分スタック (同一 identity) → 空きスロット の順。
// 候補箱の並び順は呼び出し側が決める (決定的順序)。
function fillInto(simBoxes, candKeys, idKey, maxStack, amount) {
  const fills = []; // { box, slotIdx, amount }
  let rest = amount;
  // 1) 部分スタック優先 (箱を跨いで先に全て見る)
  for (const key of candKeys) {
    if (rest <= 0) break;
    const box = simBoxes.get(key);
    if (!box) continue;
    for (let i = 0; i < box.slots.length && rest > 0; i++) {
      const s = box.slots[i];
      if (s && identityKeyOf(s.item) === idKey && s.amount < maxStack) {
        const put = Math.min(rest, maxStack - s.amount);
        fills.push({ box, slotIdx: i, amount: put });
        rest -= put;
      }
    }
  }
  // 2) 空きスロット
  for (const key of candKeys) {
    if (rest <= 0) break;
    const box = simBoxes.get(key);
    if (!box) continue;
    for (let i = 0; i < box.slots.length && rest > 0; i++) {
      if (!box.slots[i]) {
        const put = Math.min(rest, maxStack);
        fills.push({ box, slotIdx: i, amount: put });
        rest -= put;
      }
    }
  }
  return { fills, rest };
}

export function planSortMoves(input) {
  const empty = { ok: true, moves: [], leftovers: [], skipped: [], stats: { moveCount: 0, movedTotal: 0, keptCount: 0, leftoverCount: 0, unknownCount: 0 } };
  try {
    if (!input || typeof input !== "object") return empty;
    const boxes = normBoxes(input);
    if (!boxes.length) return empty;
    const rules = normItemRules(input);
    const categories = normCategories(input);
    const overrides = input.stackSizes && typeof input.stackSizes === "object" ? input.stackSizes : null;
    const scope = Array.isArray(input.scopeKeys) && input.scopeKeys.length
      ? new Set(input.scopeKeys.filter((k) => typeof k === "string")) : null;

    // シミュレーション状態 (入力のクローン。正規化済みなので安全)
    const sim = new Map(boxes.map((b) => [b.key, { ...b, slots: b.slots.map((s) => (s ? { item: cloneItem(s.item), amount: s.amount } : null)) }]));
    const boxByKey = new Map(boxes.map((b) => [b.key, b]));

    const skipped = [];
    for (const b of boxes) {
      if (b.role === "excluded") skipped.push({ key: b.key, reason: "excluded" });
      else if (b.needsRecheck) skipped.push({ key: b.key, reason: "needs_recheck_dest_only" });
    }

    const moves = [];
    const leftovers = [];
    let keptCount = 0;

    const destBoxesByCategory = new Map(); // category -> [box] (入力順 = 決定的)
    for (const b of boxes) {
      if (isWritableDest(b) && b.role === "dest" && b.category) {
        if (!destBoxesByCategory.has(b.category)) destBoxesByCategory.set(b.category, []);
        destBoxesByCategory.get(b.category).push(b);
      }
    }

    // --- 主計画: 箱間移動 ---
    for (const src of boxes) {
      if (!isSource(src, scope)) continue;
      const simSrc = sim.get(src.key);
      for (let slotIdx = 0; slotIdx < simSrc.slots.length; slotIdx++) {
        const cur = simSrc.slots[slotIdx];
        if (!cur || cur.amount <= 0) continue;
        const item = cur.item;
        const idKey = identityKeyOf(item);
        const maxStack = stackSizeOf(item.typeId, overrides);

        // 行き先候補の決定 (判定順: ルール → カテゴリ)
        let candKeys = null;
        let reason = null;
        let destUnavailable = false;
        const ruleDest = rules.get(item.typeId);
        if (ruleDest != null) {
          reason = "rule";
          const db = boxByKey.get(ruleDest);
          if (db && isWritableDest(db)) candKeys = [db.key];
          else destUnavailable = true; // ルール先が除外・要再確認・未登録: 他へは流さない
        } else {
          const cat = categories.get(item.typeId);
          if (cat) {
            const dests = destBoxesByCategory.get(cat) || [];
            if (dests.length) { reason = "category"; candKeys = dests.map((d) => d.key); }
          }
        }
        if (!candKeys) {
          leftovers.push({
            key: src.key, slot: slotIdx, item: cloneItem(item), amount: cur.amount,
            reason: destUnavailable ? "dest_unavailable" : "unknown_destination",
          });
          continue;
        }
        // 既に正しい箱にある品は維持する (ルール先そのもの、またはカテゴリ一致 dest のいずれか)
        if (candKeys.includes(src.key)) { keptCount += cur.amount; continue; }

        const { fills, rest } = fillInto(sim, candKeys, idKey, maxStack, cur.amount);
        let taken = 0;
        for (const f of fills) {
          const dst = f.box.slots[f.slotIdx];
          if (dst) dst.amount += f.amount;
          else f.box.slots[f.slotIdx] = { item: cloneItem(item), amount: f.amount };
          moves.push({
            fromKey: src.key, fromSlot: slotIdx, toKey: f.box.key, toSlot: f.slotIdx,
            item: cloneItem(item), amount: f.amount, reason,
          });
          taken += f.amount;
        }
        if (taken > 0) {
          cur.amount -= taken;
          if (cur.amount <= 0) simSrc.slots[slotIdx] = null;
        }
        if (rest > 0) {
          leftovers.push({ key: src.key, slot: slotIdx, item: cloneItem(item), amount: rest, reason: "dest_full" });
        }
      }
    }

    // --- 同箱内スタック圧縮: 1 箱 1 identity の部分スタックを前方へ寄せる ---
    for (const b of boxes) {
      if (b.role === "excluded" || b.needsRecheck) continue; // 書かない箱には触らない
      if (scope && !scope.has(b.key) && !moves.some((m) => m.toKey === b.key)) continue;
      const simBox = sim.get(b.key);
      const firstPartial = new Map(); // idKey -> slotIdx
      for (let i = 0; i < simBox.slots.length; i++) {
        const s = simBox.slots[i];
        if (!s) continue;
        const idKey = identityKeyOf(s.item);
        const maxStack = stackSizeOf(s.item.typeId, overrides);
        if (s.amount >= maxStack) continue;
        if (!firstPartial.has(idKey)) { firstPartial.set(idKey, i); continue; }
        const targetIdx = firstPartial.get(idKey);
        const target = simBox.slots[targetIdx];
        const put = Math.min(s.amount, maxStack - target.amount);
        if (put <= 0) continue;
        target.amount += put;
        s.amount -= put;
        moves.push({
          fromKey: b.key, fromSlot: i, toKey: b.key, toSlot: targetIdx,
          item: cloneItem(s.item), amount: put, reason: "compact",
        });
        if (s.amount <= 0) simBox.slots[i] = null;
        if (target.amount >= maxStack) firstPartial.delete(idKey);
      }
    }

    const movedTotal = moves.reduce((a, m) => a + m.amount, 0);
    return {
      ok: true,
      moves,
      leftovers,
      skipped,
      stats: {
        moveCount: moves.length,
        movedTotal,
        keptCount,
        leftoverCount: leftovers.reduce((a, l) => a + l.amount, 0),
        unknownCount: leftovers.filter((l) => l.reason === "unknown_destination").reduce((a, l) => a + l.amount, 0),
      },
    };
  } catch { return empty; }
}

// applyPlan(boxes, moves) -> 新しい boxes 配列 (純粋)。検証ハーネスと実行側ドライラン用。
// move が現状態と矛盾する場合はその move を読み飛ばす (例外なし)。
// 注意: 同一 fromSlot から複数 move がある場合に備え、スロット残量は逐次引く。
// item の同一性が合わない宛先スロットへは重ねない。
export function applyPlan(boxes, moves) {
  try {
    const norm = normBoxes({ boxes: Array.isArray(boxes) ? boxes : [] });
    const byKey = new Map(norm.map((b) => [b.key, b]));
    for (const m of Array.isArray(moves) ? moves : []) {
      try {
        if (!m || typeof m !== "object") continue;
        const from = byKey.get(m.fromKey);
        const to = byKey.get(m.toKey);
        const amount = typeof m.amount === "number" && Number.isFinite(m.amount) ? Math.floor(m.amount) : 0;
        if (!from || !to || amount <= 0) continue;
        const srcSlot = from.slots[m.fromSlot];
        if (!srcSlot || identityKeyOf(srcSlot.item) !== identityKeyOf(m.item)) continue;
        const take = Math.min(amount, srcSlot.amount);
        if (take <= 0) continue;
        if (m.fromKey === m.toKey && m.fromSlot === m.toSlot) continue;
        const dstSlot = to.slots[m.toSlot];
        if (dstSlot && identityKeyOf(dstSlot.item) !== identityKeyOf(m.item)) continue;
        srcSlot.amount -= take;
        if (srcSlot.amount <= 0) from.slots[m.fromSlot] = null;
        if (dstSlot) dstSlot.amount += take;
        else to.slots[m.toSlot] = { item: cloneItem(normItem(m.item)), amount: take };
      } catch { /* 壊れた move は読み飛ばす */ }
    }
    return norm.map((b) => ({
      key: b.key, role: b.role, category: b.category, needsRecheck: b.needsRecheck,
      capacity: b.slots.length, slots: b.slots,
    }));
  } catch { return []; }
}

export default planSortMoves;
