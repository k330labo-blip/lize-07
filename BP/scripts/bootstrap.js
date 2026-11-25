// bootstrap_draft.js — リゼ (LIZE-07) ツール自給チェーン（ブートストラップ計画）
// TANAKA指示: 「タスクに必要なツールは、Bot が自分で計算して作り出せるように」。
//
// 役割: 現在の所持品スナップショットとタスク目標を受け取り、技術ツリー
//   素手 → 木のツール → 作業台 → 石のツール → かまど → 鉄のツール → ダイヤのツール
// のどこに居て、「次に何を・いくつ・どの順で」作る/集めるべきかを返す計画層。
// 純粋JS（@minecraft/server 非依存）。状態を持たず、毎サイクル新しい所持品で
// 再計算する（mission.js の advance と同じ「観測→指令」方式）。
//
// 入力 (planBootstrap の引数):
//   {
//     invCounts: { itemId: n },        // 所持品の実測カウント（mission.js の observation.invCounts と同形式）
//     invDurability: { itemId: frac }, // 任意。そのアイテム種別の「最も傷んだ個体」の残耐久割合 0..1。
//                                      // 統合側が在庫アイテムの durability コンポーネントから集計して渡す想定。
//                                      // 無い場合は耐久ポリシーは「不明」として扱い、数量ベースの予備計画のみ効く。
//     goal: {
//       activity: 'chop'|'mine'|'dig'|'gather'|'combat'|'build'|'any',  // 作業の種類
//       targetItem: itemId,            // 任意。採取対象（必要ツルハシ等級の判定に使う）
//       amount: number,                // 任意。目標個数（ツールの消費＝耐久見積もりに使う）
//       targetTier: 'wood'|'stone'|'iron'|'diamond',  // 任意。最低でもこのティアまで上げる指定
//       tools: ['pickaxe','axe',...],  // 任意。必要ツールの明示指定（最優先）
//     },
//     opts: { tablePlaced: boolean }   // 任意。作業台が既に設置済みなら true（所持していなくても使える）
//   }
//
// 出力:
//   {
//     status: 'ready'|'in_progress'|'blocked',  // ready = 必要ツールが揃っている
//     stage: 'barehand'|'wood'|'stone'|'iron'|'diamond',  // 現在の到達段階（所持ツールの最高ティア）
//     stageName, requiredLevel, desiredTier,
//     toolsNeeded: [{ kind, tier, item, reason }],   // このタスクに必要なツール一式
//     steps: [ step... ],   // 残りの全ステップ（依存順）。step = 下記
//     next: step | null,    // 今すぐ実行すべき一手（= steps[0]）
//     health: [ { item, kind, tier, durabilityFrac, action, reason } ],  // 耐久ポリシーの判定
//     notes: [ string ],    // 統合側・主人への申し送り（見積もりの前提など）
//   }
//   step = { type: 'gather'|'craft'|'smelt', item, count, from?, needs?: {itemId|group: n}, note }
//
// 注意: クラフト/精錬の「実行」（材料消費→成果物生成の近似）は実行部の領分で、
// 本モジュールは計画のみを返す。レシピ数値はバニラ統合版の実値。

// ================= 基礎データ =================

// ティア定義。gold は耐久32と極端に低く自給チェーンの段として不適なため除外。
// netherite はダイヤ装備＋鍛冶型＋ネザライト強化という別系統のため対象外（SPEC 参照）。
export const TIERS = ["wood", "stone", "iron", "diamond"];
export const TIER_LABEL = { barehand: "素手", wood: "木", stone: "石", iron: "鉄", diamond: "ダイヤ" };
export const TIER_LEVEL = { wood: 1, stone: 2, iron: 3, diamond: 4 }; // 収穫レベル
export const TIER_ITEM_PREFIX = { wood: "wooden", stone: "stone", iron: "iron", diamond: "diamond" };
// バニラ統合版の最大耐久
export const TIER_DURABILITY = { wood: 59, stone: 131, iron: 250, diamond: 1561 };

// ツール種別ごとの「頭」素材数と棒の数（バニラレシピ）
export const TOOL_KINDS = {
  pickaxe: { head: 3, sticks: 2, label: "ツルハシ" },
  axe:     { head: 3, sticks: 2, label: "斧" },
  shovel:  { head: 1, sticks: 2, label: "シャベル" },
  sword:   { head: 2, sticks: 1, label: "剣" },
  hoe:     { head: 2, sticks: 2, label: "クワ" },
};

// cycle0942 キュー0副次: 収穫レベル→必要ツルハシの単一の正 (toolNeed 消費点が使う)
export function pickaxeItemForLevel(lv) {
  const n = Number(lv) || 0;
  return n >= 4 ? "minecraft:diamond_pickaxe" : n >= 3 ? "minecraft:iron_pickaxe" : n >= 2 ? "minecraft:stone_pickaxe" : "minecraft:wooden_pickaxe";
}
// queue0-B (cycle1728, v0.5.19): count tools of the requested tier OR HIGHER (was exact-tier only in ensureTool)
export function countToolAtLeastFromCounts(counts, kind, tier) { try { const lv = TIER_LEVEL[tier] || 0; let n = 0; for (const t of TIERS) if ((TIER_LEVEL[t]||0) >= lv) n += (counts?.[toolItemId(t, kind)] || 0); if (lv <= 1) n += (counts?.[`minecraft:golden_${kind}`] || 0); if (lv <= 4) n += (counts?.[`minecraft:netherite_${kind}`] || 0); return n; } catch { return 0; } } // counting-side only: golden counts as Lv1, netherite as Lv4 (never crafted by the chain)
export function bestToolTierFromCounts(counts, kind, tier) { try { const lv = TIER_LEVEL[tier] || 0; let best = null; for (const t of TIERS) if ((TIER_LEVEL[t]||0) >= lv && (counts?.[toolItemId(t, kind)] || 0) > 0) best = t; if (lv <= 4 && (counts?.[`minecraft:netherite_${kind}`] || 0) > 0) best = "netherite"; else if (!best && lv <= 1 && (counts?.[`minecraft:golden_${kind}`] || 0) > 0) best = "golden"; return best; } catch { return null; } }
export const EXTRA_TOOL_DURABILITY = { golden: 32, netherite: 2031 };
export function toolItemId(tier, kind) {
  return `minecraft:${TIER_ITEM_PREFIX[tier]}_${kind}`;
}

// 素材グループ（どの樹種でも可・どの石材でも可、を吸収する）
export const LOG_ITEMS = [
  "minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log", "minecraft:jungle_log",
  "minecraft:acacia_log", "minecraft:dark_oak_log", "minecraft:mangrove_log", "minecraft:cherry_log",
  "minecraft:pale_oak_log", "minecraft:crimson_stem", "minecraft:warped_stem",
];
export const PLANK_ITEMS = [
  "minecraft:oak_planks", "minecraft:spruce_planks", "minecraft:birch_planks", "minecraft:jungle_planks",
  "minecraft:acacia_planks", "minecraft:dark_oak_planks", "minecraft:mangrove_planks", "minecraft:cherry_planks",
  "minecraft:pale_oak_planks", "minecraft:crimson_planks", "minecraft:warped_planks",
];
export const COBBLE_ITEMS = ["minecraft:cobblestone", "minecraft:cobbled_deepslate", "minecraft:blackstone"];
export const GROUPS = { "group:logs": LOG_ITEMS, "group:planks": PLANK_ITEMS, "group:cobble": COBBLE_ITEMS };

// 対象アイテム → 採取に必要な収穫レベル（ドロップ条件）。0 = 素手で可。
// 出典: バニラ統合版のドロップ条件（鉄鉱石=石以上、ダイヤ/金/レッドストーン/エメラルド=鉄以上、黒曜石/古代の残骸=ダイヤ）。
// ラピスラズリは統合版では石ツルハシで採取可。
export const TARGET_REQUIREMENTS = {
  "minecraft:diamond": 3, "minecraft:emerald": 3, "minecraft:gold_ingot": 3, "minecraft:raw_gold": 3,
  "minecraft:redstone": 3, "minecraft:obsidian": 4, "minecraft:ancient_debris": 4,
  "minecraft:iron_ingot": 2, "minecraft:raw_iron": 2, "minecraft:lapis_lazuli": 2,
  "minecraft:coal": 1, "minecraft:raw_copper": 1, "minecraft:copper_ingot": 1,
  "minecraft:cobblestone": 1, "minecraft:stone": 1,
};
export function requiredLevelFor(targetItem) {
  if (!targetItem) return 0;
  if (TARGET_REQUIREMENTS[targetItem] !== undefined) return TARGET_REQUIREMENTS[targetItem];
  if (/_log$|_wood$|_stem$/.test(targetItem)) return 0;      // 原木系は素手で可（斧は速度用）
  if (/_ore$/.test(targetItem)) return 2;                    // 未知の鉱石は安全側に石以上とみなす
  return 0;
}

// 作業種別 → 主に使うツール
const ACTIVITY_MAIN_TOOL = { chop: "axe", mine: "pickaxe", dig: "shovel", combat: "sword" };

// 精錬の燃料価値: 個別燃料は recipes.js の FUEL_TABLE を単一の正として参照する。
// グループ燃料（板材/原木）は FUEL_TABLE の1.5を切り捨て側に倒し1として数える（従来の保守的見積もりを維持）
import { FUEL_TABLE } from "./recipes.js";
export const FUEL_VALUES = {
  "minecraft:coal": FUEL_TABLE["minecraft:coal"] ?? 8, "minecraft:charcoal": FUEL_TABLE["minecraft:charcoal"] ?? 8,
  "group:planks": 1, "group:logs": 1, "minecraft:stick": 0,
};

// ================= 耐久ポリシー =================

export const DURABILITY_WATCH = 0.30;   // これ未満で「予備作成を計画に入れる」
export const DURABILITY_CRITICAL = 0.15; // これ未満で「壊れる前に対処」

// 1本のツールの健康状態を判定する純粋関数。
// input: { item, kind, tier, durabilityFrac (0..1|null), spareCount, canCraftNow }
// spareCount = 同種同ティアの予備の本数（使用中の1本を除く）
export function evaluateToolHealth(input) {
  const { item, kind, tier } = input;
  const frac = typeof input.durabilityFrac === "number" ? input.durabilityFrac : null;
  const spares = input.spareCount || 0;
  const base = { item, kind, tier, durabilityFrac: frac };
  if (frac === null) {
    return { ...base, action: "unknown", reason: "残耐久が供給されていないため、破損は数量ベースの予備計画でのみ備える" };
  }
  if (frac >= DURABILITY_WATCH) {
    return { ...base, action: "ok", reason: `残耐久 ${Math.round(frac * 100)}%。まだ余裕がある` };
  }
  if (frac >= DURABILITY_CRITICAL) {
    if (spares >= 1) return { ...base, action: "watch", reason: `残耐久 ${Math.round(frac * 100)}%。予備があるので継続可` };
    if (input.canCraftNow) return { ...base, action: "craft_spare", reason: `残耐久 ${Math.round(frac * 100)}%。壊れる前に予備を作る` };
    return { ...base, action: "watch", reason: `残耐久 ${Math.round(frac * 100)}%。予備も材料も無いため、素材集めを優先する` };
  }
  // CRITICAL
  if (spares >= 1) return { ...base, action: "swap", reason: `残耐久 ${Math.round(frac * 100)}%。予備へ持ち替える` };
  if (input.canCraftNow) return { ...base, action: "craft_spare", reason: `残耐久 ${Math.round(frac * 100)}%で危険域。直ちに予備を作る` };
  return { ...base, action: "warn", reason: `残耐久 ${Math.round(frac * 100)}%で予備も材料も無い。破損が近いことを主人へ報告し、素材集めへ切り替える` };
}

// ================= 内部: 仮想インベントリ =================
// 計画は「仮想所持品」を消費・生産しながらステップを積む。実所持品は変更しない。

function makeVirtualInv(invCounts) {
  const v = { ...(invCounts || {}) };
  const count = (idOrGroup) => {
    if (GROUPS[idOrGroup]) return GROUPS[idOrGroup].reduce((s, id) => s + (v[id] || 0), 0);
    return v[idOrGroup] || 0;
  };
  const consume = (idOrGroup, n) => {
    let left = n;
    const ids = GROUPS[idOrGroup] || [idOrGroup];
    for (const id of ids) {
      const take = Math.min(v[id] || 0, left);
      if (take > 0) { v[id] -= take; left -= take; }
      if (left <= 0) break;
    }
    return n - left; // 実際に消費できた数
  };
  const produce = (idOrGroup, n) => {
    const id = GROUPS[idOrGroup] ? GROUPS[idOrGroup][0] : idOrGroup; // グループは代表ID（オーク系）に寄せる
    v[id] = (v[id] || 0) + n;
  };
  return { v, count, consume, produce };
}

// ================= 計画本体 =================

export function planBootstrap(input) {
  const inv = (input && input.invCounts) || {};
  const invDur = (input && input.invDurability) || {};
  const goal = (input && input.goal) || {};
  const opts = (input && input.opts) || {};
  const notes = [];

  // --- 1. 必要なツールとティアを決める ---
  const requiredLevel = Math.max(
    requiredLevelFor(goal.targetItem),
    goal.targetTier ? (TIER_LEVEL[goal.targetTier] || 0) : 0,
  );
  let desiredTier = TIERS.find((t) => TIER_LEVEL[t] >= requiredLevel) || null;
  if (requiredLevel === 0 && goal.targetTier) desiredTier = goal.targetTier;

  let kinds = [];
  if (Array.isArray(goal.tools) && goal.tools.length) kinds = goal.tools.filter((k) => TOOL_KINDS[k]);
  else if (ACTIVITY_MAIN_TOOL[goal.activity]) kinds = [ACTIVITY_MAIN_TOOL[goal.activity]];
  else if (requiredLevel > 0) kinds = ["pickaxe"];
  else if (goal.activity === "gather" && goal.targetItem && /_log$|_wood$|_stem$/.test(goal.targetItem)) kinds = ["axe"];

  if (requiredLevel > 0 && !kinds.includes("pickaxe")) kinds = ["pickaxe", ...kinds];
  if (!desiredTier && kinds.length) desiredTier = "wood"; // ツールが要るが等級指定なし → まず木から
  const mainKind = ACTIVITY_MAIN_TOOL[goal.activity] || kinds[0] || null;

  const toolsNeeded = kinds.map((kind) => ({
    kind, tier: desiredTier, item: desiredTier ? toolItemId(desiredTier, kind) : null,
    reason:
      kind === "pickaxe" && requiredLevel > 0 ? `対象の採取には収穫レベル${requiredLevel}以上が必要` :
      kind === mainKind ? `${goal.activity || "作業"}の主ツール` : "補助ツール",
  }));

  // --- 2. 現在の段階 ---
  let stageLevel = 0;
  for (const t of TIERS) for (const k of Object.keys(TOOL_KINDS)) {
    if ((inv[toolItemId(t, k)] || 0) > 0) stageLevel = Math.max(stageLevel, TIER_LEVEL[t]);
  }
  const stage = stageLevel === 0 ? "barehand" : TIERS[stageLevel - 1];

  if (!kinds.length || !desiredTier) {
    return { status: "ready", stage, stageName: TIER_LABEL[stage], requiredLevel, desiredTier: null,
      toolsNeeded: [], steps: [], next: null, health: [], notes: ["このタスクにツールは不要"] };
  }

  // --- 3. 必要本数（消費見積もり＋耐久ポリシー） ---
  const health = [];
  const wantCount = {}; // itemId -> 目標本数
  for (const tn of toolsNeeded) {
    let want = 1;
    const ownedExact = inv[tn.item] || 0;
    const owned = countToolAtLeastFromCounts(inv, tn.kind, tn.tier); // queue0-B (cycle1728): tier-or-higher counts as owned
    const frac = ownedExact > 0 && invDur[tn.item] !== undefined ? invDur[tn.item] : null; // queue0-B: frac belongs to the exact item only
    // 主ツールは目標個数ぶんの消費を見積もる（1ブロック≒耐久1消費。道中の掘削は含まない）
    if (tn.kind === mainKind && typeof goal.amount === "number" && goal.amount > 0) {
      const dur = (owned > ownedExact ? (TIER_DURABILITY[bestToolTierFromCounts(inv, tn.kind, tn.tier)] ?? EXTRA_TOOL_DURABILITY[bestToolTierFromCounts(inv, tn.kind, tn.tier)]) : TIER_DURABILITY[tn.tier]) || TIER_DURABILITY[tn.tier]; // queue0-B: durability of the best owned higher tool
      const availUses = owned > 0 ? (frac !== null ? frac : 1) * dur + Math.max(0, owned - 1) * dur : 0;
      const need = Math.ceil(Math.max(0, goal.amount - availUses) / dur);
      want = Math.max(1, owned + need);
      if (goal.amount > dur * 0.8) notes.push(`目標${goal.amount}個は${TIER_LABEL[tn.tier]}の${TOOL_KINDS[tn.kind].label}の耐久(${dur})に近い/超えるため、予備を含めて${want}本体制で計画した。道中の掘削ぶんは含まない見積もり`);
    }
    // 耐久ポリシー: 傷んだ個体があり予備が無ければ +1 本
    if (ownedExact > 0) { // queue0-B: health policy stays on the exact item
      const h = evaluateToolHealth({ item: tn.item, kind: tn.kind, tier: tn.tier, durabilityFrac: frac, spareCount: Math.max(0, ownedExact - 1), canCraftNow: false });
      if ((h.action === "craft_spare" || h.action === "warn") && want <= owned) want = owned + 1;
      health.push(h);
    }
    wantCount[tn.item] = Math.max(wantCount[tn.item] || 0, want);
  }

  // --- 4. 仮想インベントリで依存チェーンを解決する ---
  const V = makeVirtualInv(inv);
  if (opts.tablePlaced) V.produce("minecraft:crafting_table", 1); // 設置済み作業台は「使える」として数える
  const steps = [];
  const pushStep = (s) => { steps.push(s); };

  // 汎用: アイテム/グループを n 個そろえる（不足分は採取ステップ）
  function ensureGather(idOrGroup, n, fromBlock, note) {
    const lack = n - V.count(idOrGroup);
    if (lack <= 0) return;
    pushStep({ type: "gather", item: idOrGroup.startsWith("group:") ? idOrGroup : idOrGroup, count: lack, ...(fromBlock ? { from: fromBlock } : {}), note: note || "" });
    V.produce(idOrGroup, lack);
  }

  // 板材を n 枚そろえる（原木から変換）
  function ensurePlanks(n) {
    let lack = n - V.count("group:planks");
    if (lack <= 0) return;
    const crafts = Math.ceil(lack / 4);
    ensureGather("group:logs", crafts, "minecraft:oak_log", "板材の原料。素手で集められる");
    V.consume("group:logs", crafts);
    pushStep({ type: "craft", item: "group:planks", count: crafts * 4, crafts, needs: { "group:logs": crafts }, note: "原木1個→板材4枚。作業台不要" });
    V.produce("group:planks", crafts * 4);
  }

  // 棒を n 本そろえる
  function ensureSticks(n) {
    const lack = n - (V.v["minecraft:stick"] || 0);
    if (lack <= 0) return;
    const crafts = Math.ceil(lack / 4);
    ensurePlanks(crafts * 2);
    V.consume("group:planks", crafts * 2);
    pushStep({ type: "craft", item: "minecraft:stick", count: crafts * 4, crafts, needs: { "group:planks": crafts * 2 }, note: "板材2枚→棒4本。作業台不要" });
    V.produce("minecraft:stick", crafts * 4);
  }

  // 作業台を使える状態にする
  function ensureTable() {
    if (V.count("minecraft:crafting_table") > 0) return;
    ensurePlanks(4);
    V.consume("group:planks", 4);
    pushStep({ type: "craft", item: "minecraft:crafting_table", count: 1, crafts: 1, needs: { "group:planks": 4 }, note: "板材4枚。作業台不要（手作業）" });
    V.produce("minecraft:crafting_table", 1);
  }

  // 丸石系を n 個そろえる（ツルハシが前提）
  function ensureCobble(n, why) {
    const lack = n - V.count("group:cobble");
    if (lack <= 0) return;
    ensureTool("pickaxe", "wood", 1); // 石を掘るには木以上のツルハシ
    pushStep({ type: "gather", item: "group:cobble", count: lack, from: "minecraft:stone", note: why || "石を掘って丸石を得る" });
    V.produce("group:cobble", lack);
  }

  // かまどを使える状態にする
  function ensureFurnace() {
    if (V.count("minecraft:furnace") > 0) return;
    ensureTable();
    ensureCobble(8, "かまどの材料");
    V.consume("group:cobble", 8);
    pushStep({ type: "craft", item: "minecraft:furnace", count: 1, crafts: 1, needs: { "group:cobble": 8 }, note: "丸石8個。要作業台" });
    V.produce("minecraft:furnace", 1);
  }

  // 精錬の燃料を units ぶんそろえ、消費する
  function ensureFuel(units) {
    let need = units;
    const burn = (idOrGroup, val) => {
      if (need <= 0 || val <= 0) return;
      const have = V.count(idOrGroup);
      const use = Math.min(have, Math.ceil(need / val));
      if (use > 0) { V.consume(idOrGroup, use); need -= use * val; }
    };
    burn("minecraft:coal", FUEL_VALUES["minecraft:coal"]); burn("minecraft:charcoal", FUEL_VALUES["minecraft:charcoal"]);
    burn("group:planks", FUEL_VALUES["group:planks"]); burn("group:logs", FUEL_VALUES["group:logs"]);
    if (need > 0) {
      const coals = Math.ceil(need / FUEL_VALUES["minecraft:coal"]);
      pushStep({ type: "gather", item: "minecraft:coal", count: coals, from: "minecraft:coal_ore", note: "精錬の燃料。石炭1個で8個精錬できる" });
      V.produce("minecraft:coal", coals);
      V.consume("minecraft:coal", coals);
      notes.push("燃料は石炭を新規調達する計画にした（板材・原木の流用でも可）");
    }
  }

  // 鉄インゴットを n 個そろえる（精錬チェーン）
  function ensureIronIngots(n) {
    const lack = n - (V.v["minecraft:iron_ingot"] || 0);
    if (lack <= 0) return;
    ensureFurnace();
    ensureTool("pickaxe", "stone", 1); // 鉄鉱石は石以上のツルハシでないとドロップしない
    ensureGather("minecraft:raw_iron", lack, "minecraft:iron_ore", "鉄鉱石を掘る（石ツルハシ以上が必要）");
    V.consume("minecraft:raw_iron", lack);
    ensureFuel(lack);
    pushStep({ type: "smelt", item: "minecraft:iron_ingot", count: lack, needs: { "minecraft:raw_iron": lack }, note: "かまどで精錬。要かまど＋燃料" });
    V.produce("minecraft:iron_ingot", lack);
  }

  // ダイヤを n 個そろえる
  function ensureDiamonds(n) {
    const lack = n - (V.v["minecraft:diamond"] || 0);
    if (lack <= 0) return;
    ensureTool("pickaxe", "iron", 1); // ダイヤ鉱石は鉄以上のツルハシでないとドロップしない
    pushStep({ type: "gather", item: "minecraft:diamond", count: lack, from: "minecraft:deepslate_diamond_ore", note: "深層のダイヤ鉱石（Y-59前後）。鉄ツルハシ以上が必要" });
    V.produce("minecraft:diamond", lack);
  }

  // ツールを total 本そろえる（技術ツリーの再帰本体）
  function ensureTool(kind, tier, total) {
    const item = toolItemId(tier, kind);
    const lack = total - countToolAtLeastFromCounts(V.v, kind, tier); // queue0-B (cycle1728): a higher-tier tool satisfies the requirement; craft only the shortfall
    if (lack <= 0) return;
    const spec = TOOL_KINDS[kind];
    ensureTable();
    // 頭素材をそろえる
    if (tier === "wood") ensurePlanks(spec.head * lack);
    else if (tier === "stone") ensureCobble(spec.head * lack, `${TIER_LABEL[tier]}の${spec.label}の材料`);
    else if (tier === "iron") ensureIronIngots(spec.head * lack);
    else if (tier === "diamond") ensureDiamonds(spec.head * lack);
    ensureSticks(spec.sticks * lack);
    // 消費して成果物を積む
    const headKey = tier === "wood" ? "group:planks" : tier === "stone" ? "group:cobble" : tier === "iron" ? "minecraft:iron_ingot" : "minecraft:diamond";
    V.consume(headKey, spec.head * lack);
    V.consume("minecraft:stick", spec.sticks * lack);
    pushStep({ type: "craft", item, count: lack, crafts: lack, needs: { [headKey]: spec.head * lack, "minecraft:stick": spec.sticks * lack }, note: `${TIER_LABEL[tier]}の${spec.label}。要作業台` });
    V.produce(item, lack);
  }

  for (const tn of toolsNeeded) ensureTool(tn.kind, tn.tier, wantCount[tn.item] || 1);

  const status = steps.length === 0 ? "ready" : "in_progress";
  return {
    status, stage, stageName: TIER_LABEL[stage], requiredLevel, desiredTier,
    toolsNeeded, steps, next: steps[0] || null, health, notes,
  };
}
