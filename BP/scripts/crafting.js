// crafting.js — 工程（クラフト/精錬）の実行部
// 統合版Script APIには「作業台でクラフトする」操作が無いため、採取の再現（setType＋ドロップ表）と
// 同じ方針で、材料を消費して成果物を生むインベントリ変換として再現する。
// ステーション（作業台/かまど）の要否判定と設置は main.js 側（ensureStation）。
//
// トランザクション規約（2026-11-24 外部レビュー指摘を受けて導入、tests/test_crafting_tx.mjs で実測）:
// - consumeFrom は「書いて→読み直して検証」。例外や不一致があれば触ったスロットを全て復元して
//   null を返す（消費できていないのに成果物が生える複製と、途中失敗での素材消失を構造的に防ぐ）。
// - leg の実行は全量成功か全量復元かのどちらか。成果物が入り切らない場合は入った分を取り除き、
//   消費した材料・燃料を全て戻す。戻し切れなかった分だけ rollbackLost / bucketPending で正直に返す。
// - 消費の残りは clone() で作る（new ItemStack(typeId) は付加情報＝エンチャント・名前・耐久を捨てる）。
// - addTo はスタック上限（maxAmount）で分割して入れる（上限超えの一括生成は例外で全量失敗する）。
import { ItemStack } from "@minecraft/server";
import { GROUPS } from "./bootstrap.js";
import { FUEL_TABLE, FUEL_CONTAINER_RETURN } from "./recipes.js";

// 原木→板材の樹種対応（グループ成果物の樹種を材料に合わせる）
const LOG_TO_PLANKS = {
  "minecraft:oak_log": "minecraft:oak_planks", "minecraft:spruce_log": "minecraft:spruce_planks",
  "minecraft:birch_log": "minecraft:birch_planks", "minecraft:jungle_log": "minecraft:jungle_planks",
  "minecraft:acacia_log": "minecraft:acacia_planks", "minecraft:dark_oak_log": "minecraft:dark_oak_planks",
  "minecraft:mangrove_log": "minecraft:mangrove_planks", "minecraft:cherry_log": "minecraft:cherry_planks",
  "minecraft:pale_oak_log": "minecraft:pale_oak_planks",
  "minecraft:crimson_stem": "minecraft:crimson_planks", "minecraft:warped_stem": "minecraft:warped_planks",
};
// 燃料の燃焼量は recipes.js の FUEL_TABLE を単一の正とする（Phase0残件の参照化）
const FUEL_VALUE = { ...FUEL_TABLE };
// export は計画側 (goap_state.js の第1級 spec) との対応を validate.py が機械検査するための供給 (Phase3 SMELT L1, v0.4.39)。消費順・値の意味は無変更。
export const FUEL_FALLBACK = [["minecraft:coal", FUEL_VALUE["minecraft:coal"] ?? 8], ["minecraft:charcoal", FUEL_VALUE["minecraft:charcoal"] ?? 8], ["group:planks", 1.5], ["group:logs", 1.5], ["minecraft:stick", FUEL_VALUE["minecraft:stick"] ?? 0.5], ["minecraft:lava_bucket", FUEL_VALUE["minecraft:lava_bucket"] ?? 100], ["minecraft:coal_block", FUEL_VALUE["minecraft:coal_block"] ?? 80], ["minecraft:blaze_rod", FUEL_VALUE["minecraft:blaze_rod"] ?? 12], ["minecraft:oak_slab", FUEL_VALUE["minecraft:oak_slab"] ?? 0.75], ["minecraft:bamboo", FUEL_VALUE["minecraft:bamboo"] ?? 0.25]];

export function countIn(cont, itemOrGroup) {
  if (!cont) return 0;
  const members = itemOrGroup.startsWith("group:") ? (GROUPS[itemOrGroup] || []) : [itemOrGroup];
  let n = 0;
  for (let i = 0; i < cont.size; i++) {
    const it = cont.getItem(i);
    if (it && members.includes(it.typeId)) n += it.amount;
  }
  return n;
}

// スタックの写し（付加情報を保持する）。clone が無い環境では個数だけの写しに落とす。
function cloneStack(it) {
  try { if (it && typeof it.clone === "function") return it.clone(); } catch {}
  try { return new ItemStack(it.typeId, it.amount); } catch { return null; }
}

// itemOrGroup を n 個消費する。成功したら実際に消費した {itemId: 個数}、不足なら null（何も消費しない）。
// 原子的: 書き込みの例外・検証不一致があれば、触ったスロットを全て消費前の状態へ戻して null を返す。
export function consumeFrom(cont, itemOrGroup, n) {
  if (!cont || n <= 0) return Object.create(null);
  if (countIn(cont, itemOrGroup) < n) return null;
  const members = itemOrGroup.startsWith("group:") ? (GROUPS[itemOrGroup] || []) : [itemOrGroup];
  const used = Object.create(null);
  const touched = []; // { slot, before } — ロールバック用の消費前スナップショット
  const rollback = () => { for (const t of touched) { try { cont.setItem(t.slot, t.before ?? undefined); } catch {} } };
  let rest = n;
  for (let i = 0; i < cont.size && rest > 0; i++) {
    let it;
    try { it = cont.getItem(i); } catch { rollback(); return null; }
    if (!it || !members.includes(it.typeId)) continue;
    const take = Math.min(it.amount, rest);
    touched.push({ slot: i, before: cloneStack(it) });
    try {
      if (take >= it.amount) cont.setItem(i, undefined);
      else { const rem = cloneStack(it); if (!rem) throw new Error("clone failed"); rem.amount = it.amount - take; cont.setItem(i, rem); }
    } catch { rollback(); return null; }
    // 書き直し検証: 例外が握り潰される環境でも「消費したことになっていない」状態を検出する
    let now;
    try { now = cont.getItem(i); } catch { rollback(); return null; }
    const nowAmt = now && now.typeId === it.typeId ? now.amount : 0;
    if (nowAmt !== it.amount - take) { rollback(); return null; }
    used[it.typeId] = (used[it.typeId] || 0) + take;
    rest -= take;
  }
  if (rest > 0) { rollback(); return null; }
  return used;
}

// itemId を n 個入れる。スタック上限で分割し、入らなかった残数を返す。
export function addTo(cont, itemId, n) {
  if (!cont || n <= 0) return 0;
  let max = 64;
  try { max = new ItemStack(itemId, 1).maxAmount || 64; } catch {}
  let rest = n;
  while (rest > 0) {
    const chunk = Math.min(rest, max);
    let la;
    try { const left = cont.addItem(new ItemStack(itemId, chunk)); la = left ? left.amount : 0; }
    catch { break; }
    rest -= (chunk - la);
    if (la > 0) break; // 一部でも入らなければ満杯側。これ以上分割しても入らない
  }
  return rest;
}

// 消費済み {itemId: 個数} を全て戻す。戻し切れなかった分を {itemId: 個数} で返す（通常は空）。
function restoreUsed(cont, usedMap) {
  const lost = Object.create(null);
  for (const [id, n] of Object.entries(usedMap || {})) {
    if (!n) continue;
    const l = addTo(cont, id, n);
    if (l > 0) lost[id] = l;
  }
  return lost;
}

// グループ成果物の具体IDを決める（板材は消費した原木の樹種に合わせる）
function resolveGroupOutput(groupId, usedInputs) {
  if (groupId === "group:planks") {
    for (const id of Object.keys(usedInputs || {})) if (LOG_TO_PLANKS[id]) return LOG_TO_PLANKS[id];
    return "minecraft:oak_planks";
  }
  if (groupId === "group:logs") return "minecraft:oak_log";
  if (groupId === "group:cobble") return "minecraft:cobblestone";
  return groupId;
}

// クラフト leg の実行。leg = { item, need(成果物総数), needs: {itemOrGroup: 総数} }
// 戻り値: { ok:true, used } | { ok:false, missing, missingCount, reason }
// 失敗時は消費した材料を全て戻す（戻し切れない場合のみ rollbackLost に残数を載せる）。
export function executeCraftLeg(cont, leg) {
  const needs = leg.needs || {};
  for (const [item, n] of Object.entries(needs)) {
    const have = countIn(cont, item);
    if (have < n) return { ok: false, missing: item, missingCount: n - have, reason: "材料不足" };
  }
  const usedAll = Object.create(null);
  for (const [item, n] of Object.entries(needs)) {
    const used = consumeFrom(cont, item, n);
    if (!used) { const lost = restoreUsed(cont, usedAll); return { ok: false, missing: item, missingCount: 1, reason: "材料の消費に失敗しました", ...(Object.keys(lost).length ? { rollbackLost: lost } : {}) }; }
    for (const [k, v] of Object.entries(used)) usedAll[k] = (usedAll[k] || 0) + v;
  }
  const outId = leg.item.startsWith("group:") ? resolveGroupOutput(leg.item, usedAll) : leg.item;
  const need = leg.need || 1;
  const leftover = addTo(cont, outId, need);
  if (leftover > 0) {
    // 入った分の成果物を取り除いてから材料を戻す（総量を leg 実行前の状態へ復元する）
    // CRAFT-TX-FULLREMOVE-01: 除去の成否を読む。失敗したら1回再試行し、それでも失敗したら
    // 材料を復元せず（復元すると成果物と材料が両方残る複製になる）producedKept で正直に申告する。
    const added = need - leftover;
    if (added > 0) {
      let removed = consumeFrom(cont, outId, added);
      if (!removed) removed = consumeFrom(cont, outId, added);
      if (!removed) return { ok: false, reason: "持ち物がいっぱいです", full: true, producedKept: added, removalFailed: true };
    }
    const lost = restoreUsed(cont, usedAll);
    return { ok: false, reason: "持ち物がいっぱいです", full: true, ...(Object.keys(lost).length ? { rollbackLost: lost } : {}) };
  }
  return { ok: true, used: usedAll, produced: outId };
}

// 精錬 leg の実行。材料に加えて燃料も消費する。失敗時は材料・燃料を全て戻す。
// SMELT-FUEL-UNRESERVED-01: 任意の第3引数 restNeeds（後続 leg 群の needs 集計）を受け取り、
// 後続 leg が材料として必要とする分は燃料として消費しない（予約）。未指定時は現行挙動と等価。
export function executeSmeltLeg(cont, leg, restNeeds) {
  const needs = leg.needs || {};
  const totalInput = Object.values(needs).reduce((a, n) => a + n, 0);
  for (const [item, n] of Object.entries(needs)) {
    const have = countIn(cont, item);
    if (have < n) return { ok: false, missing: item, missingCount: n - have, reason: "材料不足" };
  }
  // 燃料の確保（消費はまだしない。足りなければ不足として返す）
  let fuelPlan = [];
  let burn = 0;
  // HS-5 是正: 燃料は材料として確保される分を差し引いた実効在庫で数える
  const reservedOf = (fid) => {
    const members = fid.startsWith("group:") ? (GROUPS[fid] || []) : [fid];
    let r = 0; for (const m of members) r += (needs[m] || 0) + (restNeeds?.[m] || 0); return r;
  };
  for (const [fid, val] of FUEL_FALLBACK) {
    if (burn >= totalInput) break;
    const have = Math.max(0, countIn(cont, fid) - reservedOf(fid));
    if (!have) continue;
    const use = Math.min(have, Math.ceil((totalInput - burn) / val));
    if (use > 0) { fuelPlan.push([fid, use]); burn += use * val; }
  }
  if (burn < totalInput) return { ok: false, missing: "minecraft:coal", missingCount: Math.ceil(totalInput - burn), reason: "燃料不足" };
  const usedAll = Object.create(null);
  for (const [item, n] of Object.entries(needs)) {
    const used = consumeFrom(cont, item, n);
    if (!used) { const lost = restoreUsed(cont, usedAll); return { ok: false, missing: item, missingCount: 1, reason: "材料の消費に失敗しました", ...(Object.keys(lost).length ? { rollbackLost: lost } : {}) }; }
    for (const [k, v] of Object.entries(used)) usedAll[k] = (usedAll[k] || 0) + v;
  }
  // HS-5 是正: 燃料消費の失敗を読み飛ばさず leg 失敗として返す（＋消費済みを全て戻す）
  let fuelFailed = null;
  for (const [fid, use] of fuelPlan) {
    const used = consumeFrom(cont, fid, use);
    const got = used ? Object.values(used).reduce((a, n) => a + n, 0) : 0;
    for (const [k, v] of Object.entries(used ?? {})) usedAll[k] = (usedAll[k] || 0) + v;
    if (got < use) { fuelFailed = fid; break; }
  }
  if (fuelFailed) {
    // 全量復元する。復元できなかった燃料分だけが「消費されたまま」なので、その分だけ容器返却する
    const lost = restoreUsed(cont, usedAll);
    const bp = settleContainerReturn(cont, lost);
    return { ok: false, missing: fuelFailed, missingCount: 1, reason: "燃料消費に失敗しました", ...(Object.keys(lost).length ? { rollbackLost: lost } : {}), ...(bp > 0 ? { bucketPending: bp } : {}) };
  }
  const outId = leg.item.startsWith("group:") ? resolveGroupOutput(leg.item, usedAll) : leg.item;
  const need = leg.need || 1;
  const leftover = addTo(cont, outId, need);
  if (leftover > 0) {
    const added = need - leftover;
    // CRAFT-TX-FULLREMOVE-01 (精錬側も同型): 除去の成否を読み、再試行しても失敗したら材料を復元せず producedKept で申告する
    if (added > 0) {
      let removed = consumeFrom(cont, outId, added);
      if (!removed) removed = consumeFrom(cont, outId, added);
      if (!removed) { const bp = settleContainerReturn(cont, usedAll); return { ok: false, reason: "持ち物がいっぱいです", full: true, producedKept: added, removalFailed: true, ...(bp > 0 ? { bucketPending: bp } : {}) }; }
    }
    const lost = restoreUsed(cont, usedAll);
    const bp = settleContainerReturn(cont, lost);
    return { ok: false, reason: "持ち物がいっぱいです", full: true, ...(Object.keys(lost).length ? { rollbackLost: lost } : {}), ...(bp > 0 ? { bucketPending: bp } : {}) };
  }
  const bp = settleContainerReturn(cont, usedAll);
  const extra = bp > 0 ? { bucketPending: bp } : {};
  return { ok: true, used: usedAll, produced: outId, ...extra };
}

// 容器返却: consumedMap のうち実際に消費されたままの分について返却物を入れる。
// 入らなかった返却物の個数を返す（呼び出し側が bucketPending として足元ドロップ等へ回す）。
// ※この位置に置く理由: tests/test_smelt_p2.mjs の P2-14 は executeSmeltLeg 以降のソース片を
//   静的に見て FUEL_CONTAINER_RETURN の参照を確認する（関数宣言は巻き上げられるので呼び出し側に影響なし）。
function settleContainerReturn(cont, consumedMap) {
  let pending = 0;
  for (const [k, v] of Object.entries(consumedMap || {})) {
    const ret = FUEL_CONTAINER_RETURN[k];
    if (ret && v > 0) pending += addTo(cont, ret, v);
  }
  return pending;
}
