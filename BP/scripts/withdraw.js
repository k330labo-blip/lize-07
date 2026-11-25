// WITHDRAW (ブロックコンテナ→Bot) — Phase 2 Step A 実体 (v0.4.8)
// 純粋核+executor (ports注入, @minecraft/server 非依存)。実API接続は main.js の runWithdraw。
// 設計の正: brain_parts/solutions/cycle-0911/a05_withdraw_impl_draft.js (自己テスト49/49) / cycle-0923/a01 ports手順
// source は world_memory の正名 direct_inspect を統合側で使う (withdraw_scan は無効名のため不採用, cycle-0923/a14)
export const WITHDRAW_RANGE = 2.6; // STORE と同値（a05 §2.3-3）。新規値の発明をしない

/** バニラ分のコンテナ ID（config.js CONTAINER_IDS の複製。OF 分は opts.extraContainers で注入） */
export const BASE_CONTAINER_IDS = Object.freeze([
  "minecraft:chest", "minecraft:trapped_chest", "minecraft:barrel",
  "minecraft:shulker_box", "minecraft:undyed_shulker_box",
]);

/** 再構築でコンポーネントを失う恐れがある種別（a05 §2.4 手順4 / §7-確認1）。
 *  転送自体は止めないが detail.metaRisk=true で統合判断へ正直に申告する。 */
export const META_RISK_IDS = Object.freeze([
  "minecraft:enchanted_book", "minecraft:potion", "minecraft:splash_potion",
  "minecraft:lingering_potion", "minecraft:shulker_box", "minecraft:undyed_shulker_box",
]);

export const WITHDRAW_REASONS = Object.freeze({
  API_ERROR: "API_ERROR", WRONG_DIMENSION: "WRONG_DIMENSION",
  OUT_OF_RANGE: "OUT_OF_RANGE", TARGET_UNKNOWN: "TARGET_UNKNOWN",
  TARGET_MISSING: "TARGET_MISSING", NOT_A_CONTAINER: "NOT_A_CONTAINER",
  ITEM_NOT_FOUND: "ITEM_NOT_FOUND", INVENTORY_FULL: "INVENTORY_FULL",
  VERIFY_FAILED: "VERIFY_FAILED", NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
});

// ------------------------------------------------------------------ 結果形
// actions_contract.js の done/failed と同形（status が正、ok は射影）。
// 統合時は contract 側コンストラクタへ寄せること。

function done(detail, actualEffects) {
  const r = { status: "done", ok: true };
  if (detail !== undefined) r.detail = detail;
  if (actualEffects !== undefined) r.actualEffects = actualEffects;
  return r;
}
function failed(reason, detail, actualEffects) {
  const r = { status: "failed", ok: false, reason };
  if (detail !== undefined) r.detail = detail;
  if (actualEffects !== undefined) r.actualEffects = actualEffects;
  return r;
}

// ------------------------------------------------------------------ 純粋核 1: 判定部品

/** config.js isContainerBlock の純粋写し。extraContainers に OF_CONTAINERS を注入する。 */
export function isContainerBlockPure(typeId, extraContainers = []) {
  if (typeof typeId !== "string") return false;
  if (BASE_CONTAINER_IDS.includes(typeId)) return true;
  if (Array.isArray(extraContainers) && extraContainers.includes(typeId)) return true;
  return typeId.endsWith("shulker_box");
}

/** スロット配列から対象 typeId の合計を数える（countInv の純粋写し）。 */
export function countItem(slots, item) {
  if (!Array.isArray(slots) || typeof item !== "string") return 0;
  let n = 0;
  for (const s of slots) {
    if (s && s.typeId === item && typeof s.amount === "number" && s.amount > 0) n += s.amount;
  }
  return n;
}

/**
 * 引数検証（a05 §2.1/§2.3-1、a04 §3.2）。
 * args: { from:{x,y,z,dim}|{block:{x,y,z,dim}}|{home:true}|{entity:string},
 *         item:"typeId", count?:number }
 * count 省略時は 1（暗黙の全量禁止）。成功時は正規化した {from,item,count,form} を返す。
 * @returns {{ok:true, from:Object|null, item:string, count:number, form:string} |
 *           {ok:false, result:Object}}
 */
export function validateWithdrawArgs(args) {
  const a = args && typeof args === "object" ? args : {};
  if (typeof a.item !== "string" || !a.item.includes(":")) {
    return { ok: false, result: failed(WITHDRAW_REASONS.API_ERROR, { where: "args", why: "bad_item" }) };
  }
  const count = a.count === undefined ? 1 : a.count;
  if (typeof count !== "number" || !Number.isFinite(count) || count < 1 || Math.floor(count) !== count) {
    return { ok: false, result: failed(WITHDRAW_REASONS.API_ERROR, { where: "args", why: "bad_count" }) };
  }
  const from = a.from && typeof a.from === "object" ? a.from : null;
  if (!from) {
    return { ok: false, result: failed(WITHDRAW_REASONS.API_ERROR, { where: "args", why: "bad_from" }) };
  }
  // a04 §3.2: エンティティ形は Phase 2 では予約のみ。幻影動作をせず正直に失敗する。
  if (typeof from.entity === "string") {
    return { ok: false, result: failed(WITHDRAW_REASONS.NOT_IMPLEMENTED, { where: "args", why: "entity_form_reserved", entity: from.entity }) };
  }
  if (from.home === true) return { ok: true, from, item: a.item, count, form: "home" };
  const pos = from.block && typeof from.block === "object" ? from.block : from;
  if ([pos.x, pos.y, pos.z].every((v) => typeof v === "number" && Number.isFinite(v))
    && typeof pos.dim === "string" && pos.dim) {
    return { ok: true, from: { x: pos.x, y: pos.y, z: pos.z, dim: pos.dim }, item: a.item, count, form: "block" };
  }
  return { ok: false, result: failed(WITHDRAW_REASONS.API_ERROR, { where: "args", why: "bad_from" }) };
}

/**
 * 事前条件チェック（a05 §2.3 の評価順を固定。最初に失敗した理由を返す）。
 * snapshot（呼び出し側／ports が組む純粋な観測）:
 * {
 *   botDim: string|null,          // 読めなければ null
 *   distance: number|null,        // 不明は null（その場合は距離では弾かない）
 *   invKnown: boolean,            // c.x.obs.inv==="ok" 相当。false は unknown
 *   blockReadOk: boolean,         // getBlock が例外なく返ったか
 *   blockType: string|null,       // 読めたブロックの typeId
 *   wasKnownContainer?: boolean,  // world_memory に記録があった座標か（TARGET_MISSING 判定用）
 *   containerKnown: boolean,      // inventory component の取得を試行できたか
 *   containerPresent: boolean,    // component?.container が取れたか
 * }
 * norm は validateWithdrawArgs の成功形。opts.extraContainers は OF_CONTAINERS 注入用。
 * @returns {{ok:true} | {ok:false, result:Object}}
 */
export function checkWithdraw(snapshot, norm, opts = {}) {
  const s = snapshot && typeof snapshot === "object" ? snapshot : {};
  const from = norm?.from ?? {};
  // #2 次元（home 形は解決済み座標の次元を snapshot 側が fromDim として渡す。a04 §3.3 の解決順）
  const fromDim = typeof from.dim === "string" ? from.dim
    : (typeof s.fromDim === "string" ? s.fromDim : null);
  if (fromDim !== null && typeof s.botDim === "string" && s.botDim !== fromDim) {
    return { ok: false, result: failed(WITHDRAW_REASONS.WRONG_DIMENSION, { fromDim, botDim: s.botDim }) };
  }
  // #3 距離
  if (typeof s.distance === "number" && s.distance > WITHDRAW_RANGE) {
    return { ok: false, result: failed(WITHDRAW_REASONS.OUT_OF_RANGE, { distance: s.distance, range: WITHDRAW_RANGE }) };
  }
  // #4 自分側インベントリが読めない間は実行しない（読めない≠空）
  if (s.invKnown === false) {
    return { ok: false, result: failed(WITHDRAW_REASONS.TARGET_UNKNOWN, { why: "inventory_unreadable" }) };
  }
  // #5 ブロックが読めない（未読込チャンク等）は unknown。壊されたと断定しない
  if (s.blockReadOk === false || s.blockType == null) {
    return { ok: false, result: failed(WITHDRAW_REASONS.TARGET_UNKNOWN, { why: "block_unreadable" }) };
  }
  // #6 コンテナでない／消えている
  if (!isContainerBlockPure(s.blockType, opts.extraContainers)) {
    if (s.wasKnownContainer === true && (s.blockType === "minecraft:air" || s.blockType === "minecraft:cave_air" || s.blockType === "minecraft:void_air")) {
      return { ok: false, result: failed(WITHDRAW_REASONS.TARGET_MISSING, { blockType: s.blockType }), forget: true };
    }
    return { ok: false, result: failed(WITHDRAW_REASONS.NOT_A_CONTAINER, { blockType: s.blockType }) };
  }
  // #7 component が取れない: 試行自体ができなかったら unknown、取れなかったら NOT_A_CONTAINER
  if (s.containerKnown === false) {
    return { ok: false, result: failed(WITHDRAW_REASONS.TARGET_UNKNOWN, { why: "container_unreadable" }) };
  }
  if (s.containerPresent === false) {
    return { ok: false, result: failed(WITHDRAW_REASONS.NOT_A_CONTAINER, { blockType: s.blockType, why: "no_component" }) };
  }
  return { ok: true };
}

// ------------------------------------------------------------------ 純粋核 2: 計画（在庫・容量）

/**
 * Bot 側の受け入れ可能量を見積もる（a05 §2.4 手順3）。
 * 既存の同種スロットの空き＋空スロット×maxAmount。maxAmount は対象スタックの
 * 実測（srcSlots 側）を優先し、無ければ dst 側、最後に 64。
 */
export function estimateCapacity(dstSlots, item, sampleMaxAmount) {
  const dst = Array.isArray(dstSlots) ? dstSlots : [];
  let fallbackMax = 64;
  for (const s of dst) {
    if (s && s.typeId === item && typeof s.maxAmount === "number" && s.maxAmount > 0) { fallbackMax = s.maxAmount; break; }
  }
  const maxAmt = typeof sampleMaxAmount === "number" && sampleMaxAmount > 0 ? sampleMaxAmount : fallbackMax;
  let cap = 0;
  for (const s of dst) {
    if (!s) { cap += maxAmt; continue; }
    if (s.typeId === item) {
      const m = typeof s.maxAmount === "number" && s.maxAmount > 0 ? s.maxAmount : maxAmt;
      cap += Math.max(0, m - (typeof s.amount === "number" ? s.amount : 0));
    }
  }
  return cap;
}

/**
 * 取り出し計画（純粋）。stock / capacity / want / takeTarget を分離して返すことで、
 * 「在庫が無かった」のか「満杯だった」のかを結果の detail で区別できるようにする。
 * @returns {{stock:number, capacity:number, want:number, takeTarget:number, sampleMaxAmount:number|null}}
 */
export function planWithdraw(srcSlots, dstSlots, item, count) {
  const src = Array.isArray(srcSlots) ? srcSlots : [];
  const stock = countItem(src, item);
  let sampleMaxAmount = null;
  for (const s of src) {
    if (s && s.typeId === item && typeof s.maxAmount === "number" && s.maxAmount > 0) { sampleMaxAmount = s.maxAmount; break; }
  }
  const capacity = estimateCapacity(dstSlots, item, sampleMaxAmount);
  const want = Math.min(count, stock);
  const takeTarget = Math.min(want, capacity);
  return { stock, capacity, want, takeTarget, sampleMaxAmount };
}

// ------------------------------------------------------------------ 純粋核 3: 転送シミュレーション

function cloneSlots(slots) {
  return (Array.isArray(slots) ? slots : []).map((s) => (s ? { ...s } : null));
}

/** dst へ n 個入れ、入らなかった残量を返す（Container.addItem の純粋写し）。
 *  順序: 既存の同種スロットを先に埋め、次に空スロットを使う（バニラの実挙動に合わせる）。 */
function addToSlots(dst, item, n, maxAmount) {
  let rem = n;
  for (const s of dst) {
    if (rem <= 0) break;
    if (s && s.typeId === item) {
      const m = typeof s.maxAmount === "number" && s.maxAmount > 0 ? s.maxAmount : maxAmount;
      const room = Math.max(0, m - s.amount);
      const put = Math.min(room, rem);
      s.amount += put; rem -= put;
    }
  }
  for (let i = 0; i < dst.length && rem > 0; i++) {
    if (dst[i] === null) {
      const put = Math.min(maxAmount, rem);
      dst[i] = { typeId: item, amount: put, maxAmount };
      rem -= put;
    }
  }
  return rem;
}

/**
 * スロット単位転送の純粋核（a05 §2.4 手順4）。入力配列は変更せず、転送後の
 * 新しい配列を返す。「addItem で確定→入った分だけ元を減らす」順序を守るため、
 * 消失も複製も起きない: src の減少合計 === dst の増加合計 === taken を常に満たす。
 * @returns {{taken:number, srcAfter:Array, dstAfter:Array,
 *            transfers:Array<{srcSlot:number, moved:number}>, metaRisk:boolean}}
 */
export function transferWithdrawPure(srcSlots, dstSlots, item, takeTarget) {
  const srcAfter = cloneSlots(srcSlots);
  const dstAfter = cloneSlots(dstSlots);
  const transfers = [];
  let rem = typeof takeTarget === "number" && takeTarget > 0 ? Math.floor(takeTarget) : 0;
  let taken = 0;
  for (let i = 0; i < srcAfter.length && rem > 0; i++) {
    const s = srcAfter[i];
    if (!s || s.typeId !== item || typeof s.amount !== "number" || s.amount <= 0) continue;
    const maxAmt = typeof s.maxAmount === "number" && s.maxAmount > 0 ? s.maxAmount : 64;
    const offer = Math.min(s.amount, rem);
    const rest = addToSlots(dstAfter, item, offer, maxAmt);
    const moved = offer - rest;
    if (moved <= 0) break; // 見積りと実容量が乖離したら打ち切る（既取得分は保持）
    s.amount -= moved;
    if (s.amount <= 0) srcAfter[i] = null;
    transfers.push({ srcSlot: i, moved });
    taken += moved; rem -= moved;
  }
  return { taken, srcAfter, dstAfter, transfers, metaRisk: META_RISK_IDS.includes(item) };
}

// ------------------------------------------------------------------ 純粋核 4: 前後差分検証

/**
 * 前後カウント差分の検証（a04 §0-5 / EFF-09。二重検証が本核の中心）。
 * expected は転送で確定した合計。Bot 側差分とコンテナ側差分が両方 expected と
 * 一致しなければ VERIFY_FAILED（ただし取り出し自体は起きているので呼び出し側は
 * リトライもロールバックもしない。失敗は Phase 4 失敗学習の入力になる）。
 * @returns {{ok:true, taken:number} | {ok:false, result:Object}}
 */
export function verifyWithdraw(counts) {
  const c = counts && typeof counts === "object" ? counts : {};
  const takenBot = (c.afterBot ?? 0) - (c.beforeBot ?? 0);
  const takenSrc = (c.beforeSrc ?? 0) - (c.afterSrc ?? 0);
  const expected = c.expected;
  if (takenBot !== expected || takenSrc !== expected) {
    return {
      ok: false,
      result: failed(WITHDRAW_REASONS.VERIFY_FAILED,
        { expected, actualBot: takenBot, actualSrc: takenSrc },
        takenBot > 0 ? { taken: takenBot } : undefined),
    };
  }
  return { ok: true, taken: takenBot };
}

// ------------------------------------------------------------------ 実行層

/**
 * WITHDRAW 実行器。ports（全て任意・欠落/例外時は安全側に倒す）:
 *   readSnapshot: (norm) => snapshot（checkWithdraw の入力。次元・距離・blockType・
 *                 component 可否を統合側が実 API から組む。例外→TARGET_UNKNOWN）
 *   readSrcSlots: () => slots|null（コンテナ全スロットの中立形。例外→API_ERROR）
 *   readBotSlots: () => slots|null（Bot 全スロットの中立形）
 *   applyTransfer: (srcAfter, dstAfter, transfers) => boolean
 *                 統合側は元スタック由来オブジェクトで addItem→rest 確定→元減数を
 *                 行い、転送後の実スロットを srcAfter/dstAfter と一致させること。
 *   countBot / countSrc: (item) => number（省略時は read*Slots から countItem で算出）
 *   onScanned: (info) => void（recordContainer(source:"withdraw_scan",confidence:1) の受け皿）
 *   onForget: (norm) => void（forgetContainer の受け皿。TARGET_MISSING 時のみ呼ぶ）
 * opts: { extraContainers?: string[] }
 *
 * withdraw(args) は単発完了型: done|failed のみ（in_progress は返さない）。
 * done の detail は契約規約どおり {taken, requested, stock, capacity, partial?}、
 * actualEffects は検証済みの {taken, item} のみを載せる。
 */
export function createWithdrawExecutor(ports = {}, opts = {}) {
  const P = ports && typeof ports === "object" ? ports : {};
  const safe = (fn, fallback) => { try { const v = fn(); return v ?? fallback; } catch { return fallback; } };
  const safeCall = (fn, ...a) => { try { return { ok: true, value: fn(...a) }; } catch (e) { return { ok: false, error: e }; } };


  function notifyScanned(info) { if (typeof P.onScanned === "function") safe(() => P.onScanned(info)); }
  // Step2 (v0.4.18): スロット配列 -> {itemId: 個数} の完全スナップショット (読めた範囲のみ)
  function contentsOf(slots) {
    const out = Object.create(null); // cycle1834: 特殊キーでの喪失・型破壊を防ぐ
    if (!Array.isArray(slots)) return undefined;
    for (const sl of slots) {
      const id = sl?.typeId ?? sl?.item ?? sl?.id;
      const n = sl?.amount ?? sl?.count;
      if (typeof id === "string" && typeof n === "number" && n > 0) out[id] = (out[id] ?? 0) + n;
    }
    return out;
  }
  function notifyForget(norm) { if (typeof P.onForget === "function") safe(() => P.onForget(norm)); }

  function withdraw(args) {
    // 1. 引数（API_ERROR / NOT_IMPLEMENTED は在庫不在と混同しない）
    const normRes = validateWithdrawArgs(args);
    if (!normRes.ok) return normRes.result;
    const norm = normRes;
    const { item, count } = norm;

    // 2. check（snapshot が組めないこと自体が unknown）
    if (typeof P.readSnapshot !== "function") {
      return failed(WITHDRAW_REASONS.API_ERROR, { where: "withdraw:readSnapshot_unwired" });
    }
    const snapRes = safeCall(P.readSnapshot, norm);
    if (!snapRes.ok || !snapRes.value || typeof snapRes.value !== "object") {
      return failed(WITHDRAW_REASONS.TARGET_UNKNOWN, { why: "snapshot_failed" });
    }
    const chk = checkWithdraw(snapRes.value, norm, opts);
    if (!chk.ok) { if (chk.forget) notifyForget(norm); return chk.result; }

    // 3. 走査（ここで初めて在庫が確定する。読めなければ unknown 側の API_ERROR）
    if (typeof P.readSrcSlots !== "function" || typeof P.readBotSlots !== "function") {
      return failed(WITHDRAW_REASONS.API_ERROR, { where: "withdraw:slots_unwired" });
    }
    const srcRes = safeCall(P.readSrcSlots);
    const dstRes = safeCall(P.readBotSlots);
    if (!srcRes.ok || !Array.isArray(srcRes.value) || !dstRes.ok || !Array.isArray(dstRes.value)) {
      return failed(WITHDRAW_REASONS.API_ERROR, { where: "withdraw:scan", taken: 0 });
    }
    const srcSlots = srcRes.value, dstSlots = dstRes.value;
    const beforeBot = typeof P.countBot === "function" ? safe(() => P.countBot(item), countItem(dstSlots, item)) : countItem(dstSlots, item);
    const beforeSrc = typeof P.countSrc === "function" ? safe(() => P.countSrc(item), countItem(srcSlots, item)) : countItem(srcSlots, item);

    // 4. 計画: 不在と満杯をここで分離する（消費前に止まる原則）
    const plan = planWithdraw(srcSlots, dstSlots, item, count);
    if (plan.stock === 0) {
      // 読めた上での不在 = 確定情報。走査できた事実は記録更新へ回す（a05 §2.4 手順6）
      notifyScanned({ norm, blockType: snapRes.value.blockType ?? null, stock: 0, contents: contentsOf(srcSlots) });
      return failed(WITHDRAW_REASONS.ITEM_NOT_FOUND, { item, requested: count, stock: 0 });
    }
    if (plan.capacity === 0 || plan.takeTarget === 0) {
      return failed(WITHDRAW_REASONS.INVENTORY_FULL, { side: "self", item, requested: count, stock: plan.stock, capacity: 0 });
    }

    // 5. 転送（純粋核で確定させてから実 API へ 1 回だけ適用する）
    const tr = transferWithdrawPure(srcSlots, dstSlots, item, plan.takeTarget);
    if (tr.taken <= 0) {
      return failed(WITHDRAW_REASONS.INVENTORY_FULL, { side: "self", item, requested: count, stock: plan.stock, capacity: plan.capacity });
    }
    if (typeof P.applyTransfer !== "function") {
      return failed(WITHDRAW_REASONS.API_ERROR, { where: "withdraw:apply_unwired", taken: 0 });
    }
    const applied = safeCall(P.applyTransfer, tr.srcAfter, tr.dstAfter, tr.transfers);
    if (!applied.ok || applied.value === false) {
      // 適用の成否自体が分からない。実カウントで取れた分だけを正直に申告する
      const nowBot = typeof P.countBot === "function" ? safe(() => P.countBot(item), beforeBot) : beforeBot;
      const takenNow = Math.max(0, (nowBot ?? beforeBot) - beforeBot);
      return failed(WITHDRAW_REASONS.API_ERROR, { where: "withdraw:apply", taken: takenNow }, takenNow > 0 ? { taken: takenNow } : undefined);
    }

    // 6. 前後差分検証（二重照合。失敗してもリトライ・ロールバックはしない）
    const afterSrcSlots = safe(() => P.readSrcSlots(), null);
    const afterDstSlots = safe(() => P.readBotSlots(), null);
    const afterBot = typeof P.countBot === "function" ? safe(() => P.countBot(item), null) ?? (Array.isArray(afterDstSlots) ? countItem(afterDstSlots, item) : null) : (Array.isArray(afterDstSlots) ? countItem(afterDstSlots, item) : null);
    const afterSrc = typeof P.countSrc === "function" ? safe(() => P.countSrc(item), null) ?? (Array.isArray(afterSrcSlots) ? countItem(afterSrcSlots, item) : null) : (Array.isArray(afterSrcSlots) ? countItem(afterSrcSlots, item) : null);
    if (afterBot === null || afterSrc === null) {
      return failed(WITHDRAW_REASONS.VERIFY_FAILED, { expected: tr.taken, why: "recount_failed" }, { taken: tr.taken });
    }
    const ver = verifyWithdraw({ beforeBot, afterBot, beforeSrc, afterSrc, expected: tr.taken });
    notifyScanned({ norm, blockType: snapRes.value.blockType ?? null, stock: afterSrc, contents: Array.isArray(afterSrcSlots) ? contentsOf(afterSrcSlots) : undefined });
    if (!ver.ok) return ver.result;

    // 7. 成功（partial は在庫不足か容量不足かを detail.stock/capacity で区別可能にする）
    const taken = ver.taken;
    const detail = { taken, requested: count, stock: plan.stock, capacity: plan.capacity };
    if (taken < count) detail.partial = true;
    if (tr.metaRisk) detail.metaRisk = true;
    return done(detail, { taken, item });
  }

  return { withdraw, checkWithdraw, planWithdraw, validateWithdrawArgs };
}
