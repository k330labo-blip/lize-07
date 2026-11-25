// equipment.js — リゼ (LIZE-07) 装備システム中核
// プレイヤーと同じように「装備スロット＋所持品で戦い、回復する」ための実行部モジュール。
// 純粋JS: @minecraft/server には一切依存しない。実APIへのアクセスは全て adapter 経由。
//
//   const eq = createEquipmentSystem({
//     // --- EntityEquippableComponent 相当（統合側で entity.getComponent("minecraft:equippable") を包む）
//     equipGet: (slot) => ({ typeId, amount } | null),   // EquipmentSlot 名 → 現在の装備
//     equipSet: (slot, itemOrNull) => true/false,        // ItemStack 生成は統合側の責務
//     // --- 所持品コンテナ（entity.getComponent("minecraft:inventory").container を包む）
//     invCount: (typeId) => number,
//     invRemove: (typeId, n) => removedCount,
//     invList: () => [{ typeId, amount }, ...],
//     // --- 体力（minecraft:health を包む）
//     getHealth: () => ({ cur, max }),
//     addHealth: (delta) => newCur,                       // 上限/下限クランプは統合側
//     // --- 永続化（エンティティDP cb_equip を包む）
//     load: () => string | null,
//     save: (string) => {},
//     // --- 任意
//     now: () => ms, random: () => 0..1,
//     onShoot: (info) => {}, onHeal: (info) => {}, onEquipChange: (slot, item) => {},
//   });
//
// 設計判断（詳細は equipment.md）:
// - 武器ダメージは Mainhand のアイテムIDから表引きする（バニラ段位表＋素手2）。
// - 銃は GVC 実データ（gvc_handheld_v61.csv: damage/pellets/magazine/reload_sec/bullet）で定義。
//   射程・連射間隔・命中率は CSV に無いのでクラス別仮置き値（PROVISIONAL と明記、要確認）。
// - 防具は防御点を集計し、被弾ダメージをスクリプト側で軽減する（mitigateDamage）。
//   ネイティブ軽減と二重にしないため ARMOR_MODES で統合側が選べる。
// - 回復は所持品の食料/回復アイテムを自動使用する実行部（useHealItem）と残量API。
//   「いつ食べるか」の判断は脳ルール側、本モジュールは実行と在庫だけを担う。
// - 装備状態は cb_equip に JSON 保存し、再召喚時に restore() で装備し直せる。

import { GVC_VALUABLES } from "./brain/compat_gvc.js";

// ---------------------------------------------------------------- 定数・表

export const EQUIP_VERSION = 1;
export const DP_KEY = "cb_equip"; // 統合側のDPキー（申し送り参照）

// @minecraft/server の EquipmentSlot と同名
export const EQUIP_SLOTS = ["Head", "Chest", "Legs", "Feet", "Mainhand", "Offhand"];
export const ARMOR_SLOTS = ["Head", "Chest", "Legs", "Feet"];

// 防具軽減の方式。統合側は createEquipmentSystem({ armorMode }) で選ぶ。
//  "script": mitigateDamage() が軽減後の値を返す（既定。カスタムエンティティは
//            ネイティブ防具軽減が効かない前提の安全側）
//  "native": 実際に防具を着せてゲーム側の軽減に任せる。mitigateDamage は素通し。
//  "off":    軽減しない。
export const ARMOR_MODES = ["script", "native", "off"];
export const DEFAULT_ARMOR_MODE = "script";
// script 方式の軽減式: 防御点1点 = 4% 軽減、上限80%（バニラ満点防具の上限と同水準）
export const ARMOR_PCT_PER_POINT = 0.04;
export const ARMOR_PCT_CAP = 0.8;

export const BAREHAND_DAMAGE = 2; // 素手（仕様指定）

// 近接武器ダメージ（統合版バニラ実測値の段位表）
// 出典: バニラ統合版の剣/斧/ツルハシ/シャベル/クワ/トライデントの攻撃力
export const MELEE_DAMAGE = {
  // 剣
  "minecraft:wooden_sword": 4, "minecraft:golden_sword": 4,
  "minecraft:stone_sword": 5, "minecraft:iron_sword": 6,
  "minecraft:diamond_sword": 7, "minecraft:netherite_sword": 8,
  // 斧
  "minecraft:wooden_axe": 3, "minecraft:golden_axe": 3,
  "minecraft:stone_axe": 4, "minecraft:iron_axe": 5,
  "minecraft:diamond_axe": 6, "minecraft:netherite_axe": 7,
  // ツルハシ
  "minecraft:wooden_pickaxe": 2, "minecraft:golden_pickaxe": 2,
  "minecraft:stone_pickaxe": 3, "minecraft:iron_pickaxe": 4,
  "minecraft:diamond_pickaxe": 5, "minecraft:netherite_pickaxe": 6,
  // シャベル
  "minecraft:wooden_shovel": 1, "minecraft:golden_shovel": 1,
  "minecraft:stone_shovel": 2, "minecraft:iron_shovel": 3,
  "minecraft:diamond_shovel": 4, "minecraft:netherite_shovel": 5,
  // クワ
  "minecraft:wooden_hoe": 1, "minecraft:golden_hoe": 1,
  "minecraft:stone_hoe": 1, "minecraft:iron_hoe": 1,
  "minecraft:diamond_hoe": 1, "minecraft:netherite_hoe": 1,
  // その他
  "minecraft:trident": 8,
  "minecraft:mace": 6, // 落下距離で変動する分は実行部側の近似（素の値）
};

// 防具の防御点（統合版バニラ実測値）slot: Head/Chest/Legs/Feet
// 出典: バニラ統合版の防具防御点（革/金/鎖/鉄/ダイヤ/ネザライト/亀）
export const ARMOR_POINTS = {
  "minecraft:leather_helmet": ["Head", 1], "minecraft:leather_chestplate": ["Chest", 3],
  "minecraft:leather_leggings": ["Legs", 2], "minecraft:leather_boots": ["Feet", 1],
  "minecraft:golden_helmet": ["Head", 2], "minecraft:golden_chestplate": ["Chest", 5],
  "minecraft:golden_leggings": ["Legs", 3], "minecraft:golden_boots": ["Feet", 1],
  "minecraft:chainmail_helmet": ["Head", 2], "minecraft:chainmail_chestplate": ["Chest", 5],
  "minecraft:chainmail_leggings": ["Legs", 4], "minecraft:chainmail_boots": ["Feet", 1],
  "minecraft:iron_helmet": ["Head", 2], "minecraft:iron_chestplate": ["Chest", 6],
  "minecraft:iron_leggings": ["Legs", 5], "minecraft:iron_boots": ["Feet", 2],
  "minecraft:diamond_helmet": ["Head", 3], "minecraft:diamond_chestplate": ["Chest", 8],
  "minecraft:diamond_leggings": ["Legs", 6], "minecraft:diamond_boots": ["Feet", 3],
  "minecraft:netherite_helmet": ["Head", 3], "minecraft:netherite_chestplate": ["Chest", 8],
  "minecraft:netherite_leggings": ["Legs", 6], "minecraft:netherite_boots": ["Feet", 3],
  "minecraft:turtle_helmet": ["Head", 2],
};

// 銃の性能表。damage/pellets/magazine/reloadSec/ammo/armorPiercing は
// GVC 実データ gvc_handheld_v61.csv（~/workspace/gvc-analysis/、テキスト閲覧のみで転記）が出典。
// damage は CSV の damage_per_shot_all_pellets（全ペレット命中時の合計）。
// range / cooldownMs / hitBase は CSV に存在しないためクラス別仮置き（PROVISIONAL）。
// クラス別の仮置き: 射程[blocks] / 連射間隔[ms] / 基礎命中率
const GUN_CLASS_PROVISIONAL = {
  pistol:  { range: 20, cooldownMs: 350,  hitBase: 0.80 },
  smg:     { range: 24, cooldownMs: 150,  hitBase: 0.78 },
  rifle:   { range: 40, cooldownMs: 300,  hitBase: 0.85 },
  lmg:     { range: 40, cooldownMs: 120,  hitBase: 0.80 },
  shotgun: { range: 12, cooldownMs: 900,  hitBase: 0.90 },
  sniper:  { range: 64, cooldownMs: 1500, hitBase: 0.90 },
  launcher:{ range: 48, cooldownMs: 2000, hitBase: 0.85 },
  bow:     { range: 32, cooldownMs: 1000, hitBase: 0.85 },
  special: { range: 48, cooldownMs: 2000, hitBase: 0.90 },
};
// [damage(全弾合計), pellets, magazine, reloadSec, ammo, class, armorPiercing]
const GUN_ROWS = {
  "gun:fire":        [1,   1, 30, 3.0,  "zex:556m",        "rifle",   false],
  "gun:aa12":        [24, 12, 24, 5.0,  "zex:12m",         "shotgun", false],
  "gun:ak12":        [8,   1, 30, 3.0,  "zex:556m",        "rifle",   false],
  "gun:ak47":        [7,   1, 30, 3.0,  "zex:762m",        "rifle",   false],
  "gun:ak102":       [7,   1, 30, 3.0,  "zex:556m",        "rifle",   false],
  "gun:an94":        [6,   1, 30, 3.0,  "zex:556m",        "rifle",   false],
  "gun:awm":         [25,  1, 5,  4.0,  "zex:762m",        "sniper",  false],
  "gun:compoundbow": [20,  1, 1,  1.0,  "minecraft:arrow", "bow",     true],
  "gun:dp28":        [8,   1, 47, 5.0,  "zex:762m",        "lmg",     false],
  "gun:famas":       [30,  1, 6,  4.0,  "zex:40m",         "launcher",true],
  "gun:fgm148":      [50,  1, 1,  3.0,  "zex:missilem",    "launcher",true],
  "gun:fim92":       [30,  1, 1,  3.0,  "zex:missilem",    "launcher",true],
  "gun:g36":         [8,   1, 30, 3.0,  "zex:556m",        "rifle",   false],
  "gun:g3a3":        [8,   1, 20, 3.0,  "zex:556m",        "rifle",   false],
  "gun:glock17":     [6,   1, 20, 1.5,  "zex:mm9",         "pistol",  false],
  "gun:glock18":     [4,   1, 20, 1.5,  "zex:mm9",         "pistol",  false],
  "gun:hk416":       [8,   1, 30, 2.5,  "zex:556m",        "rifle",   false],
  "gun:lazer":       [100, 1, 5,  5.0,  "zex:1270m",       "special", true],
  "gun:lewis":       [8,   1, 47, 5.0,  "zex:762m",        "lmg",     false],
  "gun:m4":          [7,   1, 30, 2.5,  "zex:556m",        "rifle",   false],
  "gun:m4a1":        [7,   1, 30, 2.5,  "zex:556m",        "rifle",   false],
  "gun:m9":          [5,   1, 16, 1.5,  "zex:mm9",         "pistol",  false],
  "gun:m10":         [4,   1, 30, 2.0,  "zex:mm9",         "smg",     false],
  "gun:m14":         [12,  1, 10, 3.0,  "zex:762m",        "rifle",   false],
  "gun:m16a1":       [5,   1, 30, 3.0,  "zex:556m",        "rifle",   false],
  "gun:m16a4":       [9,   1, 30, 3.0,  "zex:556m",        "rifle",   false],
  "gun:m60":         [6,   1, 100,6.0,  "zex:762m",        "lmg",     false],
  "gun:m72":         [40,  1, 1,  4.0,  "zex:rocketm",     "launcher",true],
  "gun:m79":         [30,  1, 1,  3.0,  "zex:40m",         "launcher",true],
  "gun:m82":         [50,  1, 10, 4.0,  "zex:1270m",       "sniper",  true],
  "gun:m110":        [12,  1, 20, 4.0,  "zex:762m",        "rifle",   false],
  "gun:m202":        [30,  1, 4,  5.0,  "zex:rocketm",     "launcher",true],
  "gun:m249":        [10,  1, 100,6.0,  "zex:762m",        "lmg",     false],
  "gun:m590":        [24, 12, 8,  4.0,  "zex:12m",         "shotgun", false],
  "gun:m870":        [24, 12, 4,  4.0,  "zex:12m",         "shotgun", false],
  "gun:m1014":       [24, 12, 8,  4.0,  "zex:12m",         "shotgun", false],
  "gun:m1911":       [6,   1, 8,  1.5,  "zex:mm9",         "pistol",  false],
  "gun:mg36":        [8,   1, 100,6.0,  "zex:556m",        "lmg",     false],
  "gun:mg42":        [8,   1, 75, 6.0,  "zex:762m",        "lmg",     false],
  "gun:mosin":       [20,  1, 5,  3.0,  "zex:762m",        "sniper",  false],
  "gun:mp5":         [4,   1, 30, 3.0,  "zex:mm9",         "smg",     false],
  "gun:mp7":         [4,   1, 40, 1.75, "zex:mm9",         "smg",     false],
  "gun:mp40":        [4,   1, 20, 1.75, "zex:mm9",         "smg",     false],
  // CSV 上 p90 の display_name は Panzerfaust（ロケット弾使用）。データ通り転記（equipment.md 注記）
  "gun:p90":         [20,  1, 1,  4.0,  "zex:rocketm",     "launcher",true],
  "gun:pkm":         [8,   1, 100,6.0,  "zex:762m",        "lmg",     false],
  "gun:ppsh":        [5,   1, 72, 2.25, "zex:mm9",         "smg",     false],
  "gun:ptrd":        [50,  1, 1,  1.5,  "zex:1270m",       "sniper",  true],
  "gun:qbz95":       [8,   1, 30, 3.0,  "zex:556m",        "rifle",   false],
  "gun:rpg":         [25,  1, 1,  4.0,  "zex:rocketm",     "launcher",true],
  "gun:rpk":         [6,   1, 100,6.0,  "zex:556m",        "lmg",     false],
  "gun:saiga12":     [24, 12, 6,  3.0,  "zex:12m",         "shotgun", false],
  "gun:scar":        [10,  1, 20, 3.0,  "zex:762m",        "rifle",   false],
  "gun:stg44":       [6,   1, 30, 3.0,  "zex:762m",        "rifle",   false],
  "gun:svd":         [13,  1, 10, 3.0,  "zex:762m",        "rifle",   false],
  "gun:tt33":        [10,  1, 6,  2.5,  "zex:762m",        "pistol",  false],
  "gun:uzi":         [3,   1, 30, 2.0,  "zex:mm9",         "smg",     false],
  "gun:vz61":        [4,   1, 20, 2.0,  "zex:mm9",         "smg",     false],
  "gun:xm8":         [16,  1, 8,  4.0,  "zex:40m",         "launcher",true],
};
export const GUN_STATS = {};
for (const [id, r] of Object.entries(GUN_ROWS)) {
  const prov = GUN_CLASS_PROVISIONAL[r[5]];
  GUN_STATS[id] = {
    damage: r[0], pellets: r[1], magazine: r[2], reloadSec: r[3], ammo: r[4],
    gunClass: r[5], armorPiercing: r[6],
    range: prov.range, cooldownMs: prov.cooldownMs, hitBase: prov.hitBase, // 仮置き
  };
}
// compat_gvc.js の銃リスト（GVC_VALUABLES の gun:* 全59件）
export const GVC_GUNS = GVC_VALUABLES.filter((id) => id.startsWith("gun:"));
// 性能表が無い銃（CSV 未収録）: 撃てない扱いにし、要確認リスト行き（equipment.md）
export const GUNS_WITHOUT_STATS = GVC_GUNS.filter((id) => !GUN_STATS[id]);

// 回復アイテム表: hp は「そのアイテムで回復するHP」の近似。
// バニラ食料は満腹度回復量をそのままHP回復近似に使う（統合版の自然回復の近似）。
// eatMs はバニラの食事所要時間 1.6 秒 = 1600ms（飲料も同値）。
export const EAT_MS = 1600;
export const HEAL_ITEMS = {
  "minecraft:cooked_beef":    { hp: 8, eatMs: EAT_MS },
  "minecraft:cooked_porkchop":{ hp: 8, eatMs: EAT_MS },
  "minecraft:cooked_mutton":  { hp: 6, eatMs: EAT_MS },
  "minecraft:cooked_chicken": { hp: 6, eatMs: EAT_MS },
  "minecraft:cooked_salmon":  { hp: 6, eatMs: EAT_MS },
  "minecraft:cooked_cod":     { hp: 5, eatMs: EAT_MS },
  "minecraft:cooked_rabbit":  { hp: 5, eatMs: EAT_MS },
  "minecraft:bread":          { hp: 5, eatMs: EAT_MS },
  "minecraft:baked_potato":   { hp: 5, eatMs: EAT_MS },
  "minecraft:golden_carrot":  { hp: 6, eatMs: EAT_MS },
  "minecraft:carrot":         { hp: 3, eatMs: EAT_MS },
  "minecraft:apple":          { hp: 4, eatMs: EAT_MS },
  "minecraft:golden_apple":   { hp: 4, eatMs: EAT_MS, note: "本来は再生II+吸収。HP分のみ近似" },
  "minecraft:enchanted_golden_apple": { hp: 8, eatMs: EAT_MS, note: "本来は再生/耐性/吸収。HP分のみ近似" },
  "minecraft:beef":           { hp: 3, eatMs: EAT_MS },
  "minecraft:porkchop":       { hp: 3, eatMs: EAT_MS },
  "minecraft:mutton":         { hp: 2, eatMs: EAT_MS },
  "minecraft:chicken":        { hp: 2, eatMs: EAT_MS },
  "minecraft:potato":         { hp: 1, eatMs: EAT_MS },
  "minecraft:melon_slice":    { hp: 2, eatMs: EAT_MS },
  "minecraft:sweet_berries":  { hp: 2, eatMs: EAT_MS },
  "minecraft:cookie":         { hp: 2, eatMs: EAT_MS },
  "minecraft:pumpkin_pie":    { hp: 8, eatMs: EAT_MS },
  "minecraft:rabbit_stew":    { hp: 10, eatMs: EAT_MS },
  "minecraft:mushroom_stew":  { hp: 6, eatMs: EAT_MS },
  "minecraft:beetroot_soup":  { hp: 6, eatMs: EAT_MS },
  "minecraft:honey_bottle":   { hp: 6, eatMs: EAT_MS },
  // GVC医療系（存在は compat_gvc.md で確認。回復量は出典が無いため仮置き → 要確認）
  "zex:aidkit":   { hp: 10, eatMs: 2000, provisional: true },
  "zex:aidkit2":  { hp: 20, eatMs: 3000, provisional: true },
  "zex:selfkit":  { hp: 6,  eatMs: 1500, provisional: true },
};

// 命中率の距離減衰（仮置きモデル）: 8ブロックまで hitBase、その先1ブロックごとに -0.01、下限0.35
export const HIT_FALLOFF_PER_BLOCK = 0.01;
export const HIT_FLOOR = 0.35;

// ---------------------------------------------------------------- 補助

const cloneItem = (it) => (it ? { typeId: it.typeId, amount: it.amount ?? 1 } : null);
const isSlot = (s) => EQUIP_SLOTS.includes(s);

export function slotForItem(typeId) {
  if (!typeId) return null;
  if (ARMOR_POINTS[typeId]) return ARMOR_POINTS[typeId][0];
  if (typeId.endsWith("_helmet") || typeId === "minecraft:turtle_helmet") return "Head";
  if (typeId.endsWith("_chestplate") || typeId === "minecraft:elytra") return "Chest";
  if (typeId.endsWith("_leggings")) return "Legs";
  if (typeId.endsWith("_boots")) return "Feet";
  return null; // 武器・道具は Mainhand 想定（呼び出し側で指定）
}

export function classifyItem(typeId) {
  if (!typeId) return { kind: "none" };
  if (GUN_STATS[typeId]) return { kind: "gun", slot: "Mainhand", stats: GUN_STATS[typeId] };
  if (GVC_GUNS.includes(typeId)) return { kind: "gun_unknown_stats", slot: "Mainhand" };
  if (ARMOR_POINTS[typeId]) return { kind: "armor", slot: ARMOR_POINTS[typeId][0], points: ARMOR_POINTS[typeId][1] };
  const armorSlot = slotForItem(typeId);
  if (armorSlot) return { kind: "armor_unknown_points", slot: armorSlot };
  if (MELEE_DAMAGE[typeId] !== undefined) return { kind: "weapon", slot: "Mainhand", damage: MELEE_DAMAGE[typeId] };
  if (HEAL_ITEMS[typeId]) return { kind: "heal", heal: HEAL_ITEMS[typeId] };
  // 弾薬判定: 銃の ammo として参照されているID
  for (const st of Object.values(GUN_STATS)) if (st.ammo === typeId) return { kind: "ammo" };
  return { kind: "other" };
}

// ---------------------------------------------------------------- 本体

export function createEquipmentSystem(adapters = {}) {
  const A = {
    equipGet: () => null, equipSet: () => false,
    invCount: () => 0, invRemove: () => 0, invList: () => [],
    getHealth: () => ({ cur: 20, max: 20 }), addHealth: () => 0,
    load: () => null, save: () => {},
    now: () => Date.now(), random: () => Math.random(),
    onShoot: null, onHeal: null, onEquipChange: null,
    ...adapters,
  };
  const armorMode = ARMOR_MODES.includes(A.armorMode) ? A.armorMode : DEFAULT_ARMOR_MODE;

  const state = {
    equip: { Head: null, Chest: null, Legs: null, Feet: null, Mainhand: null, Offhand: null },
    mag: null, // { gun: typeId, left: number } 現在の主手銃の装弾状態
    lastShotAt: -Infinity,
    reloadingUntil: 0,
    eatingUntil: 0,
  };

  // ---- 永続化 ----
  function serialize() {
    return JSON.stringify({ v: EQUIP_VERSION, equip: state.equip, mag: state.mag });
  }
  function persist() { try { A.save(serialize()); } catch { /* 保存失敗は致命ではない */ } }

  // 実コンポーネント側から状態を取り込む（スポーン直後など）
  function refresh() {
    for (const slot of EQUIP_SLOTS) {
      try { state.equip[slot] = cloneItem(A.equipGet(slot)); } catch { state.equip[slot] = null; }
    }
    ensureMag();
    return getEquipment();
  }

  // DP から復元し、実コンポーネントへ装備し直す（再召喚時）
  // 戻り値: { ok, restored: [slot...], missing: [slot...] }（DPに有るが装備適用に失敗した等）
  function restore() {
    let data = null;
    try { const raw = A.load(); if (raw) data = JSON.parse(raw); } catch { data = null; }
    if (!data || data.v !== EQUIP_VERSION) { refresh(); return { ok: false, reason: "no_data", restored: [], missing: [] }; }
    const restored = [], missing = [];
    for (const slot of EQUIP_SLOTS) {
      const it = cloneItem(data.equip?.[slot] ?? null);
      state.equip[slot] = it;
      if (it) {
        let applied = false;
        try { applied = !!A.equipSet(slot, cloneItem(it)); } catch { applied = false; }
        (applied ? restored : missing).push(slot);
      }
    }
    state.mag = data.mag && typeof data.mag.left === "number" ? { gun: data.mag.gun, left: data.mag.left } : null;
    ensureMag();
    return { ok: true, restored, missing };
  }

  // ---- 装備 ----
  function getEquipment() {
    const out = {};
    for (const slot of EQUIP_SLOTS) out[slot] = cloneItem(state.equip[slot]);
    return out;
  }
  function getEquipped(slot) { return isSlot(slot) ? cloneItem(state.equip[slot]) : null; }

  function setEquip(slot, item) {
    if (!isSlot(slot)) return { ok: false, reason: "bad_slot" };
    const it = cloneItem(item);
    let applied = false;
    try { applied = !!A.equipSet(slot, cloneItem(it)); } catch { applied = false; }
    if (!applied) return { ok: false, reason: "equip_failed" };
    const prev = state.equip[slot];
    state.equip[slot] = it;
    if (slot === "Mainhand") ensureMag(true); // 銃が変わったら装弾は新しい銃の満タンから
    persist();
    if (A.onEquipChange) { try { A.onEquipChange(slot, cloneItem(it), cloneItem(prev)); } catch {} }
    return { ok: true, slot, item: cloneItem(it), prev: cloneItem(prev) };
  }
  function unequip(slot) { return setEquip(slot, null); }

  // ---- 武器・銃 ----
  function mainhand() { return state.equip.Mainhand; }
  function currentGun() {
    const mh = mainhand();
    if (!mh) return null;
    const st = GUN_STATS[mh.typeId];
    return st ? { typeId: mh.typeId, ...st } : null;
  }
  function ensureMag(reset = false) {
    const gun = currentGun();
    if (!gun) { state.mag = null; return; }
    if (reset || !state.mag || state.mag.gun !== gun.typeId) {
      state.mag = { gun: gun.typeId, left: gun.magazine };
    }
    if (state.mag.left > gun.magazine) state.mag.left = gun.magazine;
    if (state.mag.left < 0) state.mag.left = 0;
  }
  function weaponDamage() {
    const mh = mainhand();
    if (!mh) return { damage: BAREHAND_DAMAGE, source: "barehand", item: null };
    if (GUN_STATS[mh.typeId]) return { damage: BAREHAND_DAMAGE, source: "gun_melee", item: mh.typeId }; // 銃での殴打は素手相当（仮置き）
    if (MELEE_DAMAGE[mh.typeId] !== undefined) return { damage: MELEE_DAMAGE[mh.typeId], source: "melee_table", item: mh.typeId };
    return { damage: BAREHAND_DAMAGE, source: "unknown_item", item: mh.typeId };
  }
  function ammoCount() {
    const gun = currentGun();
    if (!gun) return 0;
    try { return A.invCount(gun.ammo) || 0; } catch { return 0; }
  }
  function magazineLeft() { ensureMag(); return state.mag ? state.mag.left : 0; }
  function totalAmmoLeft() { return magazineLeft() + ammoCount(); }
  function isReloading() { return A.now() < state.reloadingUntil; }
  function isEating() { return A.now() < state.eatingUntil; }

  function canShoot() {
    const gun = currentGun();
    if (!gun) return { ok: false, reason: "no_gun" };
    const now = A.now();
    if (now < state.reloadingUntil) return { ok: false, reason: "reloading", readyInMs: state.reloadingUntil - now };
    if (now - state.lastShotAt < gun.cooldownMs) return { ok: false, reason: "cooldown", readyInMs: gun.cooldownMs - (now - state.lastShotAt) };
    ensureMag();
    if (state.mag.left <= 0 && ammoCount() <= 0) return { ok: false, reason: "no_ammo" };
    return { ok: true, gun: gun.typeId, magLeft: state.mag.left, ammo: ammoCount() };
  }

  // リロード開始（装弾が空で予備弾があるとき）。消費は完了時ではなく開始時に行う
  // （中断されても弾が戻らない単純化。統合側でアニメ/音を reloadSec ぶん再生する想定）
  function reload() {
    const gun = currentGun();
    if (!gun) return { ok: false, reason: "no_gun" };
    ensureMag();
    if (state.mag.left >= gun.magazine) return { ok: false, reason: "mag_full" };
    if (isReloading()) return { ok: false, reason: "reloading" };
    const need = gun.magazine - state.mag.left;
    const avail = ammoCount();
    if (avail <= 0) return { ok: false, reason: "no_ammo" };
    const take = Math.min(need, avail);
    let removed = 0;
    try { removed = A.invRemove(gun.ammo, take) || 0; } catch { removed = 0; }
    if (removed <= 0) return { ok: false, reason: "remove_failed" };
    state.mag.left += removed;
    state.reloadingUntil = A.now() + Math.round(gun.reloadSec * 1000);
    persist();
    return { ok: true, loaded: removed, magLeft: state.mag.left, reloadMs: Math.round(gun.reloadSec * 1000) };
  }

  // ヒットスキャン射撃。target は { distance: number, applyDamage: (amount, opts) => any }
  // （統合側が対象エンティティの applyDamage を包んで渡す。テストではモック）
  function shootAt(target) {
    const gun = currentGun();
    if (!gun) return { ok: false, reason: "no_gun" };
    const chk = canShoot();
    if (!chk.ok) {
      // 装弾切れは自動でリロードを試みる
      if (chk.reason === "no_ammo") return { ok: false, reason: "no_ammo" };
      if (state.mag && state.mag.left <= 0 && ammoCount() > 0 && !isReloading()) {
        const r = reload();
        if (r.ok) return { ok: false, reason: "reloading_started", reloadMs: r.reloadMs };
      }
      return chk;
    }
    ensureMag();
    if (state.mag.left <= 0) { // canShoot を通過するのは予備弾がある場合のみ
      const r = reload();
      return r.ok ? { ok: false, reason: "reloading_started", reloadMs: r.reloadMs } : { ok: false, reason: "no_ammo" };
    }
    const dist = typeof target?.distance === "number" ? target.distance : Infinity;
    if (dist > gun.range) return { ok: false, reason: "out_of_range", range: gun.range };
    // 発射: 装弾を1発消費
    state.mag.left -= 1;
    state.lastShotAt = A.now();
    persist();
    const hitChance = Math.max(HIT_FLOOR, gun.hitBase - Math.max(0, dist - 8) * HIT_FALLOFF_PER_BLOCK);
    const hit = A.random() < hitChance;
    let dealt = 0;
    if (hit && target && typeof target.applyDamage === "function") {
      dealt = gun.damage;
      try { target.applyDamage(dealt, { cause: "projectile", gun: gun.typeId, armorPiercing: gun.armorPiercing }); } catch { dealt = 0; }
    }
    const info = { ok: true, gun: gun.typeId, hit, damage: dealt, hitChance, distance: dist, magLeft: state.mag.left, ammoLeft: ammoCount() };
    if (A.onShoot) { try { A.onShoot(info); } catch {} }
    return info;
  }

  // ---- 防具 ----
  function armorPoints() {
    let pts = 0; const detail = {};
    for (const slot of ARMOR_SLOTS) {
      const it = state.equip[slot];
      const p = it && ARMOR_POINTS[it.typeId] ? ARMOR_POINTS[it.typeId][1] : 0;
      detail[slot] = p; pts += p;
    }
    return { points: pts, detail, mode: armorMode };
  }
  // 被弾時の軽減。統合側は entityHurt 等で raw を受けたらこれを通し、
  // mode=script のとき「軽減分だけ回復」または「軽減後ダメージで再適用」する（equipment.md）
  function mitigateDamage(raw) {
    const d = typeof raw === "number" && raw > 0 ? raw : 0;
    if (armorMode !== "script" || d === 0) return { final: d, blocked: 0, points: armorPoints().points, mode: armorMode };
    const pts = armorPoints().points;
    const pct = Math.min(ARMOR_PCT_CAP, pts * ARMOR_PCT_PER_POINT);
    const final = Math.max(0, Math.round(d * (1 - pct) * 100) / 100);
    return { final, blocked: Math.round((d - final) * 100) / 100, points: pts, mode: armorMode };
  }

  // ---- 回復 ----
  function healStock() {
    const out = [];
    let items = [];
    try { items = A.invList() || []; } catch { items = []; }
    for (const it of items) {
      const h = HEAL_ITEMS[it.typeId];
      if (h && it.amount > 0) out.push({ typeId: it.typeId, amount: it.amount, hp: h.hp, eatMs: h.eatMs, provisional: !!h.provisional });
    }
    return out;
  }
  function bestHealItem() {
    const { cur, max } = A.getHealth();
    const missing = max - cur;
    if (missing <= 0) return null;
    const stock = healStock();
    if (!stock.length) return null;
    // 過剰回復が最小の「足りる」アイテムを優先し、無ければ最大回復を選ぶ
    const enough = stock.filter((s) => s.hp >= missing).sort((a, b) => a.hp - b.hp);
    if (enough.length) return enough[0];
    return stock.slice().sort((a, b) => b.hp - a.hp)[0];
  }
  function useHealItem() {
    const { cur, max } = A.getHealth();
    if (cur >= max) return { ok: false, reason: "full_hp" };
    if (isEating()) return { ok: false, reason: "eating", readyInMs: state.eatingUntil - A.now() };
    const pick = bestHealItem();
    if (!pick) return { ok: false, reason: "no_heal_item" };
    let removed = 0;
    try { removed = A.invRemove(pick.typeId, 1) || 0; } catch { removed = 0; }
    if (removed <= 0) return { ok: false, reason: "remove_failed" };
    const healed = Math.min(pick.hp, max - cur);
    let newCur = cur + healed;
    try { newCur = A.addHealth(healed); } catch { /* 近似値のまま */ }
    state.eatingUntil = A.now() + pick.eatMs; // 食べ終わるまで次は使えない（所要時間の近似）
    const info = { ok: true, item: pick.typeId, healed, hp: newCur, eatMs: pick.eatMs, remaining: (A.invCount(pick.typeId) || 0) };
    if (A.onHeal) { try { A.onHeal(info); } catch {} }
    return info;
  }

  // 脳ルール/実行部向けの状態スナップショット（c.x へ載せる想定）
  function snapshot() {
    const gun = currentGun();
    const wd = weaponDamage();
    const ap = armorPoints();
    const heal = healStock();
    return {
      hasWeapon: wd.source === "melee_table",
      weaponDamage: wd.damage, weaponItem: wd.item,
      hasGun: !!gun, gunItem: gun ? gun.typeId : null,
      gunDamage: gun ? gun.damage : 0, gunRange: gun ? gun.range : 0,
      magLeft: gun ? magazineLeft() : 0, ammoLeft: gun ? ammoCount() : 0,
      totalAmmoLeft: gun ? totalAmmoLeft() : 0,
      canShoot: gun ? canShoot().ok : false,
      reloading: isReloading(), eating: isEating(),
      armorPoints: ap.points, armorDetail: ap.detail,
      healItems: heal.reduce((n, s) => n + s.amount, 0),
      bestHealHp: heal.length ? Math.max(...heal.map((s) => s.hp)) : 0,
    };
  }

  return {
    // 装備
    getEquipment, getEquipped, setEquip, unequip, refresh, restore, persist, serialize,
    // 武器・銃
    weaponDamage, currentGun, canShoot, shootAt, reload,
    ammoCount, magazineLeft, totalAmmoLeft, isReloading,
    // 防具
    armorPoints, mitigateDamage, armorMode,
    // 回復
    healStock, bestHealItem, useHealItem, isEating,
    // その他
    snapshot, slotForItem, classifyItem,
    _state: state, // テスト/デバッグ用
  };
}

export default createEquipmentSystem;
