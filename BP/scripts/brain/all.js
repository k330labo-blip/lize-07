// リゼの脳: 全ルールファイルの統合。読み込み順が同点時の決定順になる（監査指摘への対応）
// 優先度降順 + 安定ソート（同点は読み込み順＝この並び）で評価する。
import { RULES as safety } from "./rules_safety.js";
import { RULES as emergency2 } from "./rules_emergency2.js";
import { RULES as care } from "./rules_care.js";
import { RULES as orders } from "./rules_orders.js";
import { RULES as dimension } from "./rules_dimension.js";
import { RULES as mining } from "./rules_mining.js";
import { RULES as haul } from "./rules_haul.js";
import { RULES as inventory } from "./rules_inventory.js";
import { RULES as vehicles } from "./rules_vehicles.js";
import { RULES as farming } from "./rules_farming.js";
import { RULES as equipment } from "./rules_equipment.js";
import { RULES as orbitalLife } from "./rules_orbital_life.js";
import { RULES as crafting } from "./rules_crafting.js";
import { RULES as env } from "./rules_env.js";
import { RULES as biome } from "./rules_biome.js";
import { RULES as villager } from "./rules_villager.js";
import { RULES as mood } from "./rules_mood.js";
import { RULES as social } from "./rules_social.js";
import { RULES as bond } from "./rules_bond.js";
import { RULES as sleep } from "./rules_sleep.js";
import { RULES as life } from "./rules_life.js";
import { RULES as tactics } from "./rules_tactics.js";
import { RULES_HUMAN as human } from "./rules_human.js";
import { RULES as fallback } from "./rules_fallback.js";
import { RULES_BODY } from "./rules_body.js";

// LOAD_ORDER の並びについて: ALL_RULES はこの後に p 降順でソートされるため、
// 並びを変えてもソートは p 降順なので、同点時の決定順のみに効く。
// - orders は care の直後: 注文制約帯 p799 は care（800帯）の次に評価し、安全・ケアには必ず負け、通常行動には勝つ設計のため。
// - human は fallback の直前: p103〜120 の「空気の層」は既定層 fallback の手前。
// - equipment は farming の直後: 装備帯 p500〜557 は日常作業（農業・乗り物）より優先し、運搬・戦術・ケア・安全には必ず譲る設計のため。
const LOAD_ORDER = [safety, emergency2, care, orders, dimension, mining, tactics, haul, inventory, vehicles, farming, equipment, orbitalLife, crafting, env, biome, villager, mood, social, bond, sleep, life, human, fallback];
export const ALL_RULES = [];
for (const part of LOAD_ORDER) for (const r of part) ALL_RULES.push(r);
ALL_RULES.sort((a, b) => b.p - a.p); // Array.sort は安定ソート。同点は読み込み順を保持

// 視線は第三レイヤーとして分離。移動・発話の ALL_RULES には混ぜない（RULES_BODY は LOAD_ORDER に入れない）。
export const GAZE_RULES = [...RULES_BODY].sort((a, b) => b.p - a.p);

// 発話レイヤー（移動を占有しない act）— 監査指摘への対応
export const SPEECH_ACTS = new Set(["warn_creeper", "warn_hostile", "warn_lava", "warn_owner_low", "say_only", "greet", "celebrate", "chest_alert"]);

import { LINES } from "./lines.js";
import { LINES_LIZE } from "./lines_rei.js";
import { LINES_LIZE2 } from "./lines_lize2.js";
import { LINES_DAILY } from "./lines_daily.js";
import { LINES_LORE } from "./lines_lore.js";
import { LINES_EQUIP } from "./lines_equip.js";
// セリフはリゼ口調レイヤーを優先し、基本ラインをバリエーションとして後ろに足す
export const ALL_LINES = {};
for (const src of [LINES, LINES_DAILY, LINES_LIZE2, LINES_LIZE, LINES_LORE, LINES_EQUIP]) {
  for (const [k, v] of Object.entries(src)) {
    ALL_LINES[k] = ALL_LINES[k] || [];
    for (const line of v) if (!ALL_LINES[k].includes(line)) ALL_LINES[k].push(line);
  }
}
// リゼ口調を先頭に寄せるため、優先レイヤーの行を前に並べ替える
for (const src of [LINES_LIZE, LINES_LIZE2]) {
  for (const [k, v] of Object.entries(src)) {
    if (!ALL_LINES[k]) continue;
    ALL_LINES[k] = [...v.filter((l) => ALL_LINES[k].includes(l)), ...ALL_LINES[k].filter((l) => !v.includes(l))];
  }
}

import { CHAT_RULES } from "./chat_responses.js";
import { CHAT_LIZE } from "./chat_rei.js";
import { CHAT_TOPICS } from "./chat_topics.js";
import { CHAT_REPORTS } from "./chat_reports.js";
import { CHAT_FOLLOWUPS } from "./chat_followups.js";
import { CHAT_GENERAL } from "./chat_general.js";
import { CHAT_LORE as CHAT_LORE_SRC, LORE_DEEP_MIN_BOND as LORE_DEEP_MIN_BOND_SRC, LORE_CORE_MIN_BOND as LORE_CORE_MIN_BOND_SRC } from "./chat_lore.js";
// CHAT_LORE は CHAT_ALL に混ぜない: bond による shallow/deep 切替は main 側で行うため、再 export のみ。
export const CHAT_LORE = CHAT_LORE_SRC;
export const LORE_DEEP_MIN_BOND = LORE_DEEP_MIN_BOND_SRC;
export const LORE_CORE_MIN_BOND = LORE_CORE_MIN_BOND_SRC;
export const CHAT_ALL = [...CHAT_REPORTS, ...CHAT_LIZE, ...CHAT_RULES, ...CHAT_TOPICS, ...CHAT_GENERAL]; // 報告・感想（長いフレーズ限定）を先に、次にリゼ口調を判定。汎用会話はフォールバック寄り＝後段が設計意図のため末尾に追加
export const FOLLOWUPS = CHAT_FOLLOWUPS;

export const RULE_COUNT = ALL_RULES.length;
