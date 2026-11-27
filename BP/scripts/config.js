// 分類リスト: バニラ + GVC + 軌道工廠（実IDは brain/compat_*.js）
import { GVC_HOSTILES, GVC_VALUABLES } from "./brain/compat_gvc.js";
import { OF_CONTAINERS, OF_VALUABLES, OF_FOODS } from "./brain/compat_orbital.js";

export const BOT_ID = "companion_bot:lize";
export const REMOTE_ID = "companion_bot:lize_remote";

export const GVC_HOSTILE_SET = new Set(GVC_HOSTILES);
export const CONTAINER_IDS = new Set([
  "minecraft:chest", "minecraft:trapped_chest", "minecraft:barrel",
  "minecraft:shulker_box", "minecraft:undyed_shulker_box",
  ...OF_CONTAINERS,
]);
export function isContainerBlock(typeId) {
  return CONTAINER_IDS.has(typeId) || typeId.endsWith("shulker_box");
}

const VALUABLE_SUBSTR = ["diamond", "netherite", "emerald", "totem_of_undying", "elytra", "enchanted_book", "nether_star", "dragon_egg", "beacon", "conduit", "heart_of_the_sea", "echo_shard", "smithing_template", "end_crystal", "golden_apple", "shulker_box", "trident", "mace", "heavy_core", "ominous_trial_key", "trial_key", "music_disc", "goat_horn", "recovery_compass", "turtle_helmet", "nautilus_shell", "wither_skeleton_skull", "skeleton_skull", "zombie_head", "creeper_head", "dragon_head", "piglin_head", "player_head"];
const VALUABLE_SET = new Set([...GVC_VALUABLES, ...OF_VALUABLES]);
export function isValuable(typeId) {
  if (VALUABLE_SET.has(typeId)) return true;
  return VALUABLE_SUBSTR.some((s) => typeId.includes(s));
}

const FOOD_SET = new Set([...OF_FOODS,
  "minecraft:beef", "minecraft:cooked_beef", "minecraft:porkchop", "minecraft:cooked_porkchop",
  "minecraft:chicken", "minecraft:cooked_chicken", "minecraft:mutton", "minecraft:cooked_mutton",
  "minecraft:rabbit", "minecraft:cooked_rabbit", "minecraft:cod", "minecraft:cooked_cod",
  "minecraft:salmon", "minecraft:cooked_salmon", "minecraft:tropical_fish", "minecraft:pufferfish",
  "minecraft:bread", "minecraft:apple", "minecraft:golden_apple", "minecraft:enchanted_golden_apple",
  "minecraft:carrot", "minecraft:golden_carrot", "minecraft:potato", "minecraft:baked_potato",
  "minecraft:poisonous_potato", "minecraft:beetroot", "minecraft:beetroot_soup", "minecraft:melon_slice",
  "minecraft:sweet_berries", "minecraft:glow_berries", "minecraft:cookie", "minecraft:cake",
  "minecraft:pumpkin_pie", "minecraft:mushroom_stew", "minecraft:rabbit_stew", "minecraft:suspicious_stew",
  "minecraft:honey_bottle", "minecraft:dried_kelp", "minecraft:chorus_fruit"]);
export function isFood(typeId) { return FOOD_SET.has(typeId); }

const JUNK_SET = new Set(["minecraft:cobblestone", "minecraft:dirt", "minecraft:gravel", "minecraft:sand", "minecraft:rotten_flesh", "minecraft:andesite", "minecraft:diorite", "minecraft:granite", "minecraft:netherrack", "minecraft:cobbled_deepslate", "minecraft:tuff", "minecraft:flint", "minecraft:wheat_seeds", "minecraft:bone", "minecraft:string", "minecraft:spider_eye", "minecraft:feather", "minecraft:leather"]);
export function isJunk(typeId) { return JUNK_SET.has(typeId); }

export function isWeaponish(typeId) {
  return /sword|axe|bow|crossbow|trident|mace|gun:|rifle|pistol|smg|shotgun/.test(typeId);
}
export const RANGED_IDS = new Set(["minecraft:skeleton", "minecraft:stray", "minecraft:bogged", "minecraft:pillager", "minecraft:witch", "minecraft:blaze", "minecraft:ghast", "minecraft:evocation_illager", "minecraft:vindicator"]);
export const BOSS_IDS = new Set(["minecraft:wither", "minecraft:ender_dragon", "minecraft:warden", "minecraft:elder_guardian", "orbital_foundry:overseer"]);

// act → セリフカテゴリ
export const ACT_LINE_CATEGORY = {
  warn_creeper: "creeper_warn", warn_hostile: "hostile_warn", warn_lava: "lava_warn",
  warn_owner_low: "owner_low_hp", deliver_food: "deliver_food", deposit: "deposit_done",
  chest_alert: "chest_full", pickup_valuable: "pickup_valuable", pickup_nearest: "pickup_done",
  pickup_food: "pickup_done", pickup_owner_drops: "death_drop_found", catchup: "catchup",
  low_self_hp: "low_self_hp",
};
export const ACT_LABEL = {
  follow: "追従中", follow_close: "そばにいます", follow_high: "追従中", go_owner: "向かっています",
  catchup: "合流中", stay_anchor: "待機中", idle_hover: "待機中", patrol_home: "見回り中",
  deposit: "入庫中", deliver_all: "お届け中", deliver_food: "お届け中", deliver_valuable: "お届け中",
  pickup_nearest: "回収中", pickup_valuable: "回収中", pickup_food: "回収中", pickup_owner_drops: "回収中",
  guard: "警戒中", zap: "迎撃中", flee: "退避中", rest_at_home: "休憩中", return_home: "帰還中", go_home: "帰還中",
  place_block_escape: "足場を作って脱出中",
  say_only: "", greet: "", celebrate: "", warn_creeper: "警告", warn_hostile: "警告", warn_lava: "警告", warn_owner_low: "警告", chest_alert: "報告",
};

// 飛行（ホバー移動）の kill switch。false で従来の地上移動（nav/direct）のみになる。
export const FLY_ENABLE = true;
export const WALK_DEFAULT = false; // ground-walk Stage 0-C (cycle0403): 宣言のみ・未参照 (既定は fly のまま、Stage 2 で反転予定)
export const DELIVER_RANGE = 2.6; // 納品の到達/実行半径の単一の正 (v0.4.79, N-1)。WITHDRAW_RANGE (withdraw.js) と同値 — 受け渡し系は同距離に揃える
export const LT_DELIVER_FAIL_LIMIT = 60; // LT-DELIVER-NOEXIT (cycle1322): 長期タスク deliver 相で到達済み入庫失敗の上限回数 (mission STALL_LIMIT と桁を揃える)
export const LT_DELIVER_TIMEOUT_MS = 300000; // LT-DELIVER-NOEXIT (cycle1322): deliver 相全体の滞留上限 (未到達含む最終出口)
export const BUILD_NO_PROGRESS_TIMEOUT_MS = 300000; // BUILD-HOLD-NOEXIT (cycle1343, 案A): 建築 build 相で idx/placed が5分間進まなければ終端 (保留中も数える)
// 版数の単一の正（v0.4.1〜）。manifest説明・main.jsヘッダもこれに合わせる
export const VERSION = "0.5.173";
// Phase3 S1b 解禁フラグ (v0.4.21 導入、v0.4.54 READ-1 で解禁): true の間は採用tick合成の読み手 (READ-1) が有効。
// 充足記録 (v0.4.48) と正式裁定 (v0.4.54) を経て、本版で読み手化と一体に切り替えた。
export const GOAP_ADOPT_S1B = true;
// 開発デバッグ: 失敗を [LIZE DEBUG] ログと本人の文脈（lastFail）に残す
export const LIZE_DEBUG = true;

// v0.4.71 統合: 模擬プレイヤーの体 (body_sim.js)。ベータAPI (server-gametest) が必要なため
// 現行構成では false。true にするには main.js の gametest import と manifest 依存の追加が必要。
export const BODY_SIM_ENABLE = false;
