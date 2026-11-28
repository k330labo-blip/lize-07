// actions_contract.js — Phase 2: Atomic Action 契約の型定義 (cycle-0849 統合 v0.4.5)
// 純粋モジュール: import なし・副作用なし・状態なし。node --check 可能。
// 統合時は BP/scripts/actions/contract.js へ移す想定。本ファイル単体では何も実行しない。
//
//
// - equipment.js (brain_parts/equipment.js = BP/scripts/equipment.js と同系統):
// setEquip/unequip -> {ok:true, slot, item, prev}
// | {ok:false, reason:"bad_slot"|"equip_failed"}
// restore -> {ok, restored:[slot], missing:[slot]} (+ ok:false 時 reason:"no_data")
// canShoot -> {ok:true, gun, magLeft, ammo}
// | {ok:false, reason:"no_gun"|"reloading"|"cooldown"|"no_ammo", readyInMs?}
// reload -> {ok:true, loaded, magLeft, reloadMs}
// | {ok:false, reason:"no_gun"|"mag_full"|"reloading"|"no_ammo"|"remove_failed"}
// shootAt -> {ok:true, gun, hit, damage, hitChance, distance, magLeft, ammoLeft}
// | {ok:false, reason: canShoot系 | "reloading_started" | "out_of_range", reloadMs?}
// useHealItem -> {ok:true, item, healed, hp, eatMs, remaining}
// | {ok:false, reason:"full_hp"|"eating"|"no_heal_item"|"remove_failed", readyInMs?}
// weaponDamage -> {damage, source:"barehand"|"gun_melee"|"melee_table"|"unknown_item", item}
// (ok を持たない参照系。BAREHAND_DAMAGE=2 が単一の正)
// armorPoints -> {points, detail, mode} / mitigateDamage -> {final, blocked, points, mode}
// (ok を持たない参照/受動系。ActionResult には包まない: §6 参照)
// - crafting.js (BP/scripts/crafting.js):
// executeCraftLeg(cont, leg{ item, need, needs:{itemOrGroup:総数}})
// -> {ok:true, used:{itemId:n}, produced}
// | {ok:false, missing, missingCount, reason:"材料不足"}
// | {ok:false, reason:"持ち物がいっぱいです", full:true}
// executeSmeltLeg -> 同型 + {ok:false, missing:"minecraft:coal", missingCount, reason:"燃料不足"}
// consumeFrom -> used{...} | {} (n<=0) | null (不足・無消費) / addTo -> leftover(残量)
// ※ 既知の欠陥 (audit_actions): 満杯時は材料消費済み+成果物一部追加済みで失敗を返す
// (ロールバックなし)。本契約では actualEffects.consumed/producedPartial で正直に申告する。
// - fly.js flyTick -> {mode:"fly"|"ground", move, arrived, reason:""|"submerged"|"low_ceiling"
// |"blocked_goal"|"flight_blocked"|"dest_blocked"} (main は現行 reason を破棄)
// - 先行設計: brain_parts/solutions/phase2-actions/DESIGN.md §1 (契約形・理由列挙) と整合させ、
// 本書はその「型+定数+写像表」の実装ドラフト。理由の正規形は UPPER_SNAKE、
// 中核の既存 reason (小文字) は中核側を変えず境界で写像する (中核の消費者は equip_ui 等にもいる)。
//
// ctx フィールドは追加のみ / decide の p 意味論・effMove.id 接頭辞には触れない /
// 本モジュールは c.x を読まない (述語評価は呼び出し側が snapshot を渡す形を想定)。

// ------------------------------------------------------------------ 基本型 (JSDoc)

/**
* 三状態述語の評価結果。Phase 1 の World Model (TRUE/FALSE/UNKNOWN) と同値。
* @typedef {"true"|"false"|"unknown"} TriState
*/

/**
* 述語 (preconditions / expectedEffects / Goal で同一文法。Phase 3 GOAP-lite の入力)。
* 例: {pred:"inventory", item:"minecraft:iron_ingot", gte:32}
* {pred:"self.at", ref:"$to", within:"$arriveRadius"}
* {pred:"block", at:"$at", eq:"minecraft:air"} / eq:"unknown" で未確認を表す
* {pred:"effect", target:"self", effect:"fire_resistance", eq:true|false|"unknown"}
* @typedef {Object} Predicate
* @property {string} pred 述語名 (PREDICATES のいずれか)
* @property {string} [item] 対象アイテムID ("group:..." 可。crafting.js の itemOrGroup と同義)
* @property {string} [at] 座標参照 ("$to" 等のパラメータ参照可)
* @property {string} [ref] 参照先パラメータ名
* @property {number|string} [within] 距離 (数値 or "$param")
* @property {number} [gte] 以上
* @property {number} [lt] 未満
* @property {*} [eq] 等値 (true/false/"unknown" を含む)
* @property {"fail"|"run"|"result"} [onUnknown]
* 述語が unknown のときの倒し先。安全系="fail"(実行しない) / 調達系="run"(実行して確定)
* / 情報系 (INSPECT 自身) ="result"(unknown を結果として返す)。未指定時は "fail"。
*/

/**
* コスト見積り。純粋関数の返り値で副作用なし。通貨は ticks に統一し内訳を併記する。
* 現行で実在するコスト源: fly.js FLY 速度定数 (巡航5.0/追いつき7.0/微調整1.8/上昇3.5/下降3.0),
* nav.js stepCost (距離・水・危険・扉)。他 Action は初期値を持ち Phase 4 で実績補正する。
* @typedef {Object} ActionCost
* @property {number} ticks 推定所要 tick (脳tick/移動tick の別は Action の drive で区別)
* @property {number} distance 推定移動距離 [blocks] (移動しない Action は 0)
* @property {number} danger 経路・対象周辺の危険度 0..1 (dangerSpots weight 由来)
* @property {number} durability 想定する道具耐久消費 (現行 BREAK は実消費なし=0 を正直に申告)
* @property {number} successP 成功確率 0..1 の初期見積り
*/

/**
* Action の実行結果。本契約の中核。
* ok は互換射影であり、正は status: ok === (status === "done")。
* 単発 Action (EQUIP/CRAFT/SMELT/USE_ITEM/STORE/WITHDRAW) は done|failed のみ、
* 多tick Action (MOVE/BREAK/PLACE/INSPECT) は in_progress を返す。
* @typedef {Object} ActionResult
* @property {"done"|"in_progress"|"failed"} status
* @property {boolean} ok status==="done" と一致させること
* @property {string} [reason] REASONS の正規コード。failed 時は必須。
* in_progress でも委譲理由等 (例: MOVE の SUBMERGED) を載せてよい
* @property {Object} [detail] Action 固有の構造化詳細 (下記 detail 規約)
* @property {Object} [actualEffects] 検証済みの実効果。expectedEffects との差分が
* Phase 4 の再計画・失敗学習の入力になる。
* 未検証の効果は載せない (正直な申告)。
* @property {number} [progress] 0..1 (任意。BREAK の割り進捗、MOVE の残距離比等)
*
* detail 規約 (既存返り値の置き場を固定する。新規キーの発明はしない):
* missing/missingCount crafting.js 由来そのまま (NO_MATERIAL / NO_FUEL 時)
* moved/failed transferFiltered {moved, failed} 由来 (STORE)
* taken/partial TAKE/WITHDRAW の取得量と部分成功
* hit/damage/magLeft/ammoLeft/hitChance shootAt 由来 (ATTACK)
* healed/hp useHealItem 由来 (USE_ITEM heal)
* loaded/reloadMs/readyInMs reload/canShoot 由来
* engineReason 下層エンジンの生理由 (fly/nav の小文字 reason を detail に保持)
* side:"self"|"target" 満杯が自分側か相手コンテナ側か (INVENTORY_FULL 時)
* consumed/producedPartial ロールバックできない部分適用の申告 (CRAFT/SMELT 満杯時)
*/

/**
* Action 定義オブジェクト。各 Action が 1 件 export し、レジストリが集約する。
* @typedef {Object} ActionDef
* @property {string} id ACTION_IDS のいずれか (大文字スネーク、脳 act とは別 namespace)
* @property {Object<string,string>} params 引数仕様 (文書+実行時チェック用。値=型名文字列)
* @property {Predicate[]} preconditions 事前条件 (述語配列)
* @property {Predicate[]} expectedEffects 期待効果 (述語配列)。検証できない効果は書かない
* @property {"brain"|"move"} drive 駆動周期: MOVE のみ "move" (2tick)、他は "brain"
* @property {(rt:Object, args:Object)=>({ok:true}|{ok:false, reason:string, detail?:Object})} check
* 述語を現在状態で評価する。失敗したら run を呼ばずに ActionResult(failed) へ変換される
* @property {(rt:Object, args:Object)=>ActionCost} cost 見積り (純粋関数)
* @property {(rt:Object, args:Object)=>ActionResult} run 1tick ぶん進めて結果を返す。
* 内部状態は rt に保持する (現行 r.work / fly・nav オブジェクトが相当)
* @property {(rt:Object, args:Object)=>void} [onAbort] 中断時の後片付け (任意)。
* 状態を保持したまま再開できるものは消さない (例: BREAK の r.work)
*/

// ------------------------------------------------------------------ 定数: ID と状態

/** Phase 2 初期セット (ARCHITECTURE_PLAN.md §4)。REST/SPEAK は補助として末尾に置く。 */
export const ACTION_IDS = Object.freeze([
"MOVE", "BREAK", "PLACE", "TAKE", "STORE", "WITHDRAW", "ATTACK",
"USE_ITEM", "EQUIP", "CRAFT", "SMELT", "INSPECT", "WAIT", "SPEAK",
]);

/** 補助 Action (初期セット外。DESIGN.md §2.12 / §4 の REST 定義に準拠) */
export const AUX_ACTION_IDS = Object.freeze(["REST"]);

export const ACTION_STATUS = Object.freeze({
DONE: "done", IN_PROGRESS: "in_progress", FAILED: "failed",
});

/** 述語名の語彙 (preconditions / expectedEffects / Goal 共通) */
export const PREDICATES = Object.freeze([
"target.exists", "self.dimension", "self.at", "self.hp", "self.hpPct",
"inventory", "container.has", "block", "effect", "tool.level", "danger.nearest",
]);

// ------------------------------------------------------------------ 定数: 理由コード

/**
* 失敗/委譲理由の正規形 (UPPER_SNAKE)。DESIGN.md §1.3 の列挙を正とし、
* 実測で確認した発生源をコメントに併記する。新規コードの追加は GUARDED_STRUCTURE のみ
* (人工物保護は「失敗」でなく「方針による拒否」であり Planner は別対象を選ぶべきもの)。
*/
export const REASONS = Object.freeze({
// 移動 (fly 5種は実在。nav 側はフォールバック箇所への付与が Phase 2 の作業)
NO_PATH: "NO_PATH", PATH_BLOCKED: "PATH_BLOCKED", GRID_BUILDING: "GRID_BUILDING",
SUBMERGED: "SUBMERGED", LOW_CEILING: "LOW_CEILING", GOAL_BLOCKED: "GOAL_BLOCKED",
FLIGHT_BLOCKED: "FLIGHT_BLOCKED", DEST_BLOCKED: "DEST_BLOCKED",
STUCK_OSCILLATING: "STUCK_OSCILLATING", STUCK_FROZEN: "STUCK_FROZEN",
STUCK_FALLBACK: "STUCK_FALLBACK", TELEPORT_FAILED: "TELEPORT_FAILED",
// 共通
TIMEOUT: "TIMEOUT", OUT_OF_RANGE: "OUT_OF_RANGE", WRONG_DIMENSION: "WRONG_DIMENSION",
TARGET_MISSING: "TARGET_MISSING", TARGET_GONE: "TARGET_GONE", TARGET_UNKNOWN: "TARGET_UNKNOWN",
INTERRUPTED: "INTERRUPTED", API_ERROR: "API_ERROR", NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
// 配置・破壊
NOT_A_CONTAINER: "NOT_A_CONTAINER", CELL_OCCUPIED: "CELL_OCCUPIED",
CELL_UNKNOWN: "CELL_UNKNOWN", UNSUPPORTED_CELL: "UNSUPPORTED_CELL",
SET_FAILED: "SET_FAILED", VERIFY_FAILED: "VERIFY_FAILED",
GUARDED_STRUCTURE: "GUARDED_STRUCTURE", DANGER_NEAR: "DANGER_NEAR", NO_TOOL: "NO_TOOL",
// 材料・在庫 (detail.missing / missingCount を伴う)
NO_MATERIAL: "NO_MATERIAL", NO_FUEL: "NO_FUEL", INVENTORY_FULL: "INVENTORY_FULL",
ITEM_NOT_FOUND: "ITEM_NOT_FOUND",
// 戦闘 (equipment.js canShoot/shootAt 由来)
NO_GUN: "NO_GUN", NO_AMMO: "NO_AMMO", RELOADING: "RELOADING", COOLDOWN: "COOLDOWN",
DAMAGE_REJECTED: "DAMAGE_REJECTED",
// 装備・使用 (equipment.js setEquip/useHealItem 由来)
BAD_SLOT: "BAD_SLOT", EQUIP_FAILED: "EQUIP_FAILED", REMOVE_FAILED: "REMOVE_FAILED",
EQUIP_CORE_UNAVAILABLE: "EQUIP_CORE_UNAVAILABLE",
FULL_HP: "FULL_HP", EATING: "EATING", MAG_FULL: "MAG_FULL",
POTION_KIND_UNKNOWN: "POTION_KIND_UNKNOWN",
// 発話 (失敗ではなく情報扱い: done の detail.reason に載せる)
ON_COOLDOWN: "ON_COOLDOWN",
});

// ------------------------------------------------------------------ 境界写像表

/**
* equipment.js 中核の小文字 reason -> 正規コード。中核の返り値は変えない (境界変換のみ)。
* 実測した全 reason を網羅する: setEquip 2 / canShoot 4 / reload 5 / shootAt +2 / useHealItem 4。
* "reloading_started" は status 射影が他と違うため REASON_MAP ではなく shootAt 専用処理 (§6)。
*/
export const EQUIP_REASON_MAP = Object.freeze({
bad_slot: REASONS.BAD_SLOT, equip_failed: REASONS.EQUIP_FAILED,
no_data: REASONS.TARGET_MISSING, // restore の DP 無し (装備の復元対象が無い)
no_gun: REASONS.NO_GUN, no_ammo: REASONS.NO_AMMO,
reloading: REASONS.RELOADING, cooldown: REASONS.COOLDOWN,
mag_full: REASONS.MAG_FULL, remove_failed: REASONS.REMOVE_FAILED,
out_of_range: REASONS.OUT_OF_RANGE,
full_hp: REASONS.FULL_HP, eating: REASONS.EATING,
no_heal_item: REASONS.ITEM_NOT_FOUND, // 「読めた上で回復アイテムが無い」= 確定した不在
});

/** crafting.js の日本語 reason -> 正規コード (missing 系は detail へそのまま移す) */
export const CRAFT_REASON_MAP = Object.freeze({
"材料不足": REASONS.NO_MATERIAL,
"燃料不足": REASONS.NO_FUEL,
"持ち物がいっぱいです": REASONS.INVENTORY_FULL,
});

/** fly.js の reason -> 正規コード (値は同一文字列の大文字化。engineReason に生値を保持) */
export const FLY_REASON_MAP = Object.freeze({
submerged: REASONS.SUBMERGED, low_ceiling: REASONS.LOW_CEILING,
blocked_goal: REASONS.GOAL_BLOCKED, flight_blocked: REASONS.FLIGHT_BLOCKED,
dest_blocked: REASONS.DEST_BLOCKED,
});

// ------------------------------------------------------------------ 結果コンストラクタ (純粋)

/** @returns {ActionResult} */
export function done(actualEffects, detail) {
const r = { status: ACTION_STATUS.DONE, ok: true};
if (detail!== undefined) r.detail = detail;
if (actualEffects!== undefined) r.actualEffects = actualEffects;
return r;
}

/** @returns {ActionResult} reason は REASONS の値であること */
export function failed(reason, detail) {
const r = { status: ACTION_STATUS.FAILED, ok: false, reason};
if (detail!== undefined) r.detail = detail;
return r;
}

/** @returns {ActionResult} 多tick Action の継続中。progress は 0..1 に丸める */
export function inProgress(progress, reason, detail) {
const r = { status: ACTION_STATUS.IN_PROGRESS, ok: false};
if (typeof progress === "number" && Number.isFinite(progress)) {
r.progress = Math.min(1, Math.max(0, progress));
}
if (reason) r.reason = reason;
if (detail!== undefined) r.detail = detail;
return r;
}

/**
* check() の失敗を ActionResult へ変換する共通形。
* @param {{ok:boolean, reason?:string, detail?:Object}} chk
* @returns {ActionResult|null} ok なら null (run へ進む)、失敗なら failed 結果
*/
export function fromCheck(chk) {
if (!chk || chk.ok) return null;
return failed(chk.reason || REASONS.API_ERROR, chk.detail);
}

// ------------------------------------------------------------------ 既存中核の結果の正規化 (純粋)

/**
* equipment.js の結果オブジェクトを ActionResult へ正規化する。
* 対応: setEquip / canShoot / reload / shootAt / useHealItem / restore。
* ok:true の固有フィールドは actualEffects ではなく detail へ写す
* (actualEffects は「検証済み効果」専用であり、中核の返り値は未検証の報告を含むため。
* 例外: useHealItem の healed/hp は addHealth の戻り値で裏付けられるため actualEffects にも写す)。
* @param {Object} raw 中核の返り値 (null/undefined は API_ERROR)
* @param {string} [kind] "shootAt" の場合のみ reloading_started の特殊射影を適用する
* @returns {ActionResult}
*/
export function fromEquipmentResult(raw, kind) {
if (!raw || typeof raw!== "object") return failed(REASONS.API_ERROR, { where: "equipment"});
if (raw.ok) {
const detail = {};
for (const k of ["slot", "item", "prev", "gun", "magLeft", "ammo", "loaded", "reloadMs",
"hit", "damage", "hitChance", "distance", "ammoLeft", "healed", "hp", "eatMs",
"remaining", "restored", "missing"]) {
if (raw[k]!== undefined) detail[k] = raw[k];
}
const r = done(undefined, Object.keys(detail).length? detail: undefined);
if (raw.healed!== undefined || raw.hp!== undefined) {
r.actualEffects = {};
if (raw.healed!== undefined) r.actualEffects.healed = raw.healed;
if (raw.hp!== undefined) r.actualEffects.hp = raw.hp;
}
return r;
}
// shootAt の reloading_started: 「撃てなかったが回復行動が始まった」。
// DESIGN.md §1.4 の裁定どおり failed(RELOADING) とし reloadMs は detail に保持する。
if (kind === "shootAt" && raw.reason === "reloading_started") {
return failed(REASONS.RELOADING, { reloadMs: raw.reloadMs, autoReload: true});
}
const reason = EQUIP_REASON_MAP[raw.reason] || REASONS.API_ERROR;
const detail = {};
if (raw.readyInMs!== undefined) detail.readyInMs = raw.readyInMs;
if (raw.range!== undefined) detail.range = raw.range;
if (raw.reason &&!EQUIP_REASON_MAP[raw.reason]) detail.rawReason = raw.reason;
return failed(reason, Object.keys(detail).length? detail: undefined);
}

/**
* crafting.js の executeCraftLeg / executeSmeltLeg の結果を ActionResult へ正規化する。
* 満杯時 (full:true) は材料消費済みの可能性があるため、actualEffects に正直に申告する:
* 消費の内訳は失敗返り値に含まれない (実測) ので consumed は "unknown" とし、
* 推測で used を捏造しない。検証済みの produced は成功時にのみ載せる。
* @param {Object} raw
* @returns {ActionResult}
*/
export function fromCraftResult(raw) {
if (!raw || typeof raw!== "object") return failed(REASONS.API_ERROR, { where: "crafting"});
if (raw.ok) {
const r = done({ produced: raw.produced}, { used: raw.used});
return r;
}
const reason = CRAFT_REASON_MAP[raw.reason] || REASONS.API_ERROR;
const detail = {};
if (raw.missing!== undefined) detail.missing = raw.missing;
if (raw.missingCount!== undefined) detail.missingCount = raw.missingCount;
if (raw.rollbackLost && Object.keys(raw.rollbackLost).length) detail.rollbackLost = raw.rollbackLost;
if (raw.producedKept) detail.producedKept = raw.producedKept;
if (raw.reason &&!CRAFT_REASON_MAP[raw.reason]) detail.rawReason = raw.reason;
const r = failed(reason, Object.keys(detail).length? detail: undefined);
if (raw.full) {
r.detail = {...(r.detail || {}), side: "self"};
r.actualEffects = { consumed: "unknown", producedPartial: "unknown"}; // §冒頭の欠陥申告
}
return r;
}

/**
* 歩行既定 (WALK_DEFAULT=true, cyc2489) では fly 経路は不発で、本契約は FLY_ENABLE かつ歩行既定を戻した緊急時のみ有効。
* flyTick の結果を MOVE の ActionResult へ写像する (a18/DESIGN §2.1 の案を型に固定)。
* reason!=="" のとき常に move===null && arrived===false という fly の不変条件が前提。
* ground 委譲は失敗ではなく in_progress (委譲先 nav が MOVE を継続する) として表す。
* @param {{mode:string, move:Object|null, arrived:boolean, reason:string}} fres
* @returns {ActionResult}
*/
export function fromFlyResult(fres) {
if (!fres || typeof fres!== "object") return failed(REASONS.API_ERROR, { where: "flyTick"});
if (fres.arrived) return done({ at: "goal"}, { engine: "fly"});
const code = fres.reason? (FLY_REASON_MAP[fres.reason] || REASONS.API_ERROR): undefined;
const detail = { engine: "fly", mode: fres.mode};
if (fres.reason) detail.engineReason = fres.reason;
if (fres.mode === "ground" && fres.reason) {
return inProgress(undefined, code, {...detail, delegated: "ground"});
}
if (!fres.move && fres.reason === "dest_blocked") {
return inProgress(undefined, code, {...detail, blockedStep: true});
}
if (fres.move) return inProgress(undefined, undefined, detail);
return failed(REASONS.TARGET_MISSING, {...detail, noGoal: true}); // goal 未設定の曖昧さの解消
}

// ------------------------------------------------------------------ Action 定義 (参照実装)

/**
* EQUIP の定義。run は core.setEquip への委譲を想定し、本ドラフトでは
* rt.core (統合側が注入する equipment 中核) が無い場合の正直な失敗までを定義する。
* 実測整合: 事前条件 bad_slot は中核も持つが、Action 側 check で先に弾くことで
* equipSet の無駄な呼び出しを避ける (中核側の判定は二重防御として残る)。
*/
export const ACTION_EQUIP = Object.freeze({
id: "EQUIP",
params: { slot: "EquipmentSlot", item: "ItemRef|null"}, // item=null は UNEQUIP
preconditions: [
{ pred: "inventory", item: "$item", gte: 1, onUnknown: "fail"}, // item=null 時は適用しない
],
expectedEffects: [{ pred: "inventory", item: "$item", gte: 0}], // 装備スロット側の検証は中核 snapshot が担う
drive: "brain",
costHint: Object.freeze({ ticks: 1, distance: 0, danger: 0, durability: 0, successP: 0.95}),
});

/** CRAFT の定義。leg は recipes.js (単一の正) から組み立てられたものを引数で受ける。 */
export const ACTION_CRAFT = Object.freeze({
id: "CRAFT",
params: { leg: "CraftLeg"}, // {item, need, needs:{itemOrGroup:総数}} (crafting.js の leg と同形)
preconditions: [
{ pred: "inventory", item: "$needs.each", gte: "$needs.count", onUnknown: "fail"},
// station 要否は leg.station 由来。現行は longtask 側が ensureStation を先行させる順序依存であり、
// Action 化では check に含め Executor/Planner が PLACE(station) を先行させる (DESIGN §2.10)
],
expectedEffects: [{ pred: "inventory", item: "$leg.item", gte: "$leg.need"}],
drive: "brain",
costHint: Object.freeze({ ticks: 1, distance: 0, danger: 0, durability: 0, successP: 0.9}),
});

/** SMELT の定義。CRAFT に燃料述語が加わる。燃料表は recipes.js FUEL_TABLE が単一の正。 */
export const ACTION_SMELT = Object.freeze({
id: "SMELT",
params: { leg: "SmeltLeg"},
preconditions: [
{ pred: "inventory", item: "$needs.each", gte: "$needs.count", onUnknown: "fail"},
{ pred: "inventory", item: "$fuel.anyOf(FUEL_TABLE)", gte: "$fuel.need", onUnknown: "fail"},
],
expectedEffects: [{ pred: "inventory", item: "$leg.item", gte: "$leg.need"}],
drive: "brain",
costHint: Object.freeze({ ticks: 1, distance: 0, danger: 0, durability: 0, successP: 0.9}),
});

/**
* 全 Action の宣言的スケルトン (preconditions / expectedEffects / drive / costHint)。
* check/run の実体は各ラップ作業 (DESIGN §2) で差し込む。本表は Planner (Phase 3) が
* 「宣言だけ先に読む」ための単一の置き場であり、未実装 Action を done と偽らないよう
* implemented フラグを必須とする (false の Action の run は NOT_IMPLEMENTED を返す想定)。
*/
export const ACTION_DEFS = Object.freeze({
MOVE: Object.freeze({ id: "MOVE", drive: "move", implemented: "wrap", // fly reason 回収が残作業
preconditions: [{ pred: "target.exists"}, { pred: "self.dimension", eq: "$to.dimension"}],
expectedEffects: [{ pred: "self.at", ref: "$to", within: "$arriveRadius"}],
costHint: Object.freeze({ ticks: -1, distance: -1, danger: 0, durability: 0, successP: 0.9})}), // ticks/distance は距離依存 (-1=可変)
BREAK: Object.freeze({ id: "BREAK", drive: "brain", implemented: "wrap", // v0.4.7: setType例外の成功形を廃止 (SET_FAILED) + r.lastBreak 記録
preconditions: [{ pred: "block", at: "$at", eq: "$typeId"},
{ pred: "danger.nearest", gte: 4, onUnknown: "fail"}], // tickWork の危険接近中止を check 側へ
expectedEffects: [{ pred: "block", at: "$at", eq: "minecraft:air"}], // ドロップは再現表前提を注記 (DESIGN §2.2)
costHint: Object.freeze({ ticks: 4, distance: 0, danger: 0, durability: 0, successP: 0.85})}), // durability 実消費なし
PLACE: Object.freeze({ id: "PLACE", drive: "brain", implemented: "wrap", // v0.4.8: station のみ消費後失敗ロールバック+r.lastPlace 実装。torch/build 統一は残件
preconditions: [{ pred: "inventory", item: "$item", gte: 1, onUnknown: "fail"},
{ pred: "block", at: "$at", eq: "minecraft:air", onUnknown: "fail"}],
expectedEffects: [{ pred: "block", at: "$at", eq: "$item"}], // 設置後の再読込で検証する
costHint: Object.freeze({ ticks: 1, distance: 0, danger: 0, durability: 0, successP: 0.9})}),
TAKE: Object.freeze({ id: "TAKE", drive: "brain", implemented: "wrap", // v0.4.7: r.lastTake 記録 (満杯は INVENTORY_FULL で理由化)
preconditions: [{ pred: "target.exists"}, { pred: "self.at", ref: "$entity", within: 1.9}],
expectedEffects: [{ pred: "inventory", item: "$item", gte: "$before+1"}],
costHint: Object.freeze({ ticks: 1, distance: 0, danger: 0, durability: 0, successP: 0.9})}),
STORE: Object.freeze({ id: "STORE", drive: "brain", implemented: "wrap", // v0.4.7: r.lastStore 記録 (planner deliver_to_owner の結果破棄を解消)。transferFiltered {moved, failed} が土台
preconditions: [{ pred: "target.exists"}, { pred: "self.at", ref: "$to", within: 2.6},
{ pred: "self.dimension", eq: "$to.dimension"}],
expectedEffects: [{ pred: "container.has", item: "$filter.each", gte: "$before+1"}],
costHint: Object.freeze({ ticks: 1, distance: 0, danger: 0, durability: 0, successP: 0.9})}),
WITHDRAW: Object.freeze({ id: "WITHDRAW", drive: "brain", implemented: "wrap", // v0.4.8 Step A: withdraw.js executor + main runWithdraw ports 実体化 (呼び出し口 mission/planner は Step B)
preconditions: [{ pred: "block", at: "$from", eq: "$containerType", onUnknown: "result"},
{ pred: "self.at", ref: "$from", within: 2.6},
{ pred: "container.has", item: "$item", gte: 1, onUnknown: "run"}], // run が走査して確定させる
expectedEffects: [{ pred: "inventory", item: "$item", gte: "$before+1"}],
costHint: Object.freeze({ ticks: 1, distance: 0, danger: 0, durability: 0, successP: 0.8})}),
ATTACK: Object.freeze({ id: "ATTACK", drive: "brain", implemented: "wrap", // shootAt の結果伝播が残作業
preconditions: [{ pred: "target.exists"}],
expectedEffects: [], // applyDamage は成否を返さないため、検証可能な効果を宣言しない (正直な申告)
costHint: Object.freeze({ ticks: 1, distance: 0, danger: 0, durability: 0, successP: 0.8})}),
USE_ITEM: Object.freeze({ id: "USE_ITEM", drive: "brain", implemented: "partial",
// heal は中核あり (useHealItem)。milk は v0.4.6 で main execArrive に実体化済み
// (消費→毒/衰弱の対象除去→バケツ返却→再読検証、結果は r.lastUseItem へ記録)。
// fire_res はポーション識別が前提で識別不能なら POTION_KIND_UNKNOWN で消費しない (幻影 act を作らない)
preconditions: [{ pred: "inventory", item: "$item", gte: 1, onUnknown: "fail"}],
expectedEffects: [{ pred: "effect", target: "self", effect: "$effect", eq: "$after"}],
costHint: Object.freeze({ ticks: 2, distance: 0, danger: 0, durability: 0, successP: 0.85})}),
EQUIP: ACTION_EQUIP,
CRAFT: ACTION_CRAFT,
SMELT: ACTION_SMELT,
INSPECT: Object.freeze({ id: "INSPECT", drive: "brain", implemented: "wrap", // v0.4.8: 失敗計数+peek unknown+inspectBlockNear 実体化 (前提の probe unknown は v0.4.4 解消済み)
preconditions: [],
expectedEffects: [], // 結果自体が {state:"present"|"absent"|"unknown", source, confidence} の観測である
costHint: Object.freeze({ ticks: 1, distance: 0, danger: 0, durability: 0, successP: 1})}),
WAIT: Object.freeze({ id: "WAIT", drive: "brain", implemented: "wrap",
preconditions: [], expectedEffects: [],
costHint: Object.freeze({ ticks: -1, distance: 0, danger: 0, durability: 0, successP: 1})}),
SPEAK: Object.freeze({ id: "SPEAK", drive: "brain", implemented: "wrap",
// クールダウンで送れない場合は failed にせず done(detail:{sent:false, reason:ON_COOLDOWN})
preconditions: [], expectedEffects: [],
costHint: Object.freeze({ ticks: 1, distance: 0, danger: 0, durability: 0, successP: 1})}),
});

// ------------------------------------------------------------------ 検証 (純粋)

/**
* ActionDef の最小整合チェック (統合時の契約テスト用)。
* @param {Object} def
* @returns {{ok:boolean, errors:string[]}}
*/
export function validateActionDef(def) {
const errors = [];
if (!def || typeof def!== "object") return { ok: false, errors: ["not_an_object"]};
if (!ACTION_IDS.includes(def.id) &&!AUX_ACTION_IDS.includes(def.id)) errors.push("unknown_id");
if (!Array.isArray(def.preconditions)) errors.push("preconditions_not_array");
if (!Array.isArray(def.expectedEffects)) errors.push("expectedEffects_not_array");
if (def.drive!== undefined && def.drive!== "brain" && def.drive!== "move") errors.push("bad_drive");
for (const p of def.preconditions || []) {
if (!p ||!PREDICATES.includes(p.pred)) errors.push("unknown_pred:" + (p && p.pred));
}
for (const p of def.expectedEffects || []) {
if (!p ||!PREDICATES.includes(p.pred)) errors.push("unknown_pred:" + (p && p.pred));
}
return { ok: errors.length === 0, errors};
}

/**
* ActionResult の最小整合チェック (ok と status の射影一致、failed 時の reason 必須)。
* @param {Object} r
* @returns {{ok:boolean, errors:string[]}}
*/
export function validateActionResult(r) {
const errors = [];
if (!r || typeof r!== "object") return { ok: false, errors: ["not_an_object"]};
if (!Object.values(ACTION_STATUS).includes(r.status)) errors.push("bad_status");
if (r.ok!== (r.status === ACTION_STATUS.DONE)) errors.push("ok_status_mismatch");
if (r.status === ACTION_STATUS.FAILED) {
if (!r.reason) errors.push("failed_without_reason");
else if (!Object.values(REASONS).includes(r.reason)) errors.push("unknown_reason:" + r.reason);
}
if (r.progress!== undefined && (typeof r.progress!== "number" || r.progress < 0 || r.progress > 1)) {
errors.push("progress_out_of_range");
}
return { ok: errors.length === 0, errors};
}
