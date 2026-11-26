// tool_invest_math.js — 0-J 道具投資判断 純粋核 (cyc2313 統合、純粋核先行・プランナ接続は次段)
// 要望の正: brain_parts/solutions/efficiency-planning/HANDOFF.md
// 「何個以上なら道具を作る」という固定閾値は置かない。候補道具について
//   投資コスト (調達+作製にかかる時間換算コスト。呼び出し側が工程計画から渡す)
// と
//   節約量 = 残り個数 × (現道具の1個あたり所要時間 − 候補道具の1個あたり所要時間)
// を比較し、節約量がコストを上回る候補のうち純節約が最大のものを選ぶ。
// 依頼数が大きいほど投資が勝ち、小さいほど現有道具が勝つ結果は、この比較から自然に出る。
// 既に候補以上の道具を持っている場合は節約量が 0 以下になり、自動的に投資しない。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。状態を持たない。

// 道具 tier の掘削速度倍率 (バニラの道具速度: 素手1 / 木2 / 石4 / 鉄6 / ダイヤ8 / ネザライト9)
// 適切な道具種で掘る場合のみ倍率が効く。不適合な道具種は素手扱い (倍率1)。
export const TOOL_TIER_SPEED = Object.freeze({
  none: 1, wooden: 2, stone: 4, iron: 6, diamond: 8, netherite: 9,
});

// 道具種ごとの代表アイテムID (候補生成の呼び出し側が使うための参照表)
export const TOOL_CLASS_ITEMS = Object.freeze({
  axe: Object.freeze({ wooden: "minecraft:wooden_axe", stone: "minecraft:stone_axe", iron: "minecraft:iron_axe", diamond: "minecraft:diamond_axe", netherite: "minecraft:netherite_axe" }),
  pickaxe: Object.freeze({ wooden: "minecraft:wooden_pickaxe", stone: "minecraft:stone_pickaxe", iron: "minecraft:iron_pickaxe", diamond: "minecraft:diamond_pickaxe", netherite: "minecraft:netherite_pickaxe" }),
  shovel: Object.freeze({ wooden: "minecraft:wooden_shovel", stone: "minecraft:stone_shovel", iron: "minecraft:iron_shovel", diamond: "minecraft:diamond_shovel", netherite: "minecraft:netherite_shovel" }),
  sword: Object.freeze({ wooden: "minecraft:wooden_sword", stone: "minecraft:stone_sword", iron: "minecraft:iron_sword", diamond: "minecraft:diamond_sword", netherite: "minecraft:netherite_sword" }),
});

function num(v, fallback) { return (typeof v === "number" && Number.isFinite(v)) ? v : fallback; }

// 1個あたり所要時間 (tick換算の抽象コスト)。baseTime は素手・適合道具なしでの1個あたり時間。
// toolClass が対象ブロックの適合道具種 (effectiveClass) と一致するときだけ tier 倍率が効く。
export function timePerBlock(input) {
  try {
    if (!input || typeof input !== "object") return null;
    const base = num(input.baseTime, NaN);
    if (!Number.isFinite(base) || base <= 0) return null;
    const tier = (typeof input.tier === "string" && Object.prototype.hasOwnProperty.call(TOOL_TIER_SPEED, input.tier)) ? input.tier : "none";
    const effective = typeof input.effectiveClass === "string" ? input.effectiveClass : null;
    const toolClass = typeof input.toolClass === "string" ? input.toolClass : null;
    const speed = (effective && toolClass && effective === toolClass) ? TOOL_TIER_SPEED[tier] : 1;
    return base / speed;
  } catch { return null; }
}

// 投資判断の中核比較。
// input: {
//   remaining: 残り個数,
//   baseTime: 素手での1個あたり時間,
//   effectiveClass: 対象に効く道具種 ("axe"|"pickaxe"|"shovel"|"sword"|null),
//   current: { tier, toolClass } | null  … 現在の最良の手持ち道具 (無ければ null=素手),
//   candidates: [{ tier, toolClass, itemId, investCost }]  … 作製候補。investCost は調達+作製の時間換算コスト
// }
// 戻り値: { invest: boolean, candidate: 選ばれた候補|null, saving, netSaving, currentTimePer, reason }
// 固定閾値は使わない: 判定は saving > investCost のみ。
export function decideToolInvestment(input) {
  try {
    if (!input || typeof input !== "object") return { invest: false, candidate: null, saving: 0, netSaving: 0, currentTimePer: null, reason: "invalid" };
    const remaining = num(input.remaining, NaN);
    if (!Number.isFinite(remaining) || remaining <= 0) return { invest: false, candidate: null, saving: 0, netSaving: 0, currentTimePer: null, reason: "no_remaining" };
    const cur = (input.current && typeof input.current === "object") ? input.current : { tier: "none", toolClass: null };
    const currentTimePer = timePerBlock({ baseTime: input.baseTime, tier: cur.tier, toolClass: cur.toolClass, effectiveClass: input.effectiveClass });
    if (currentTimePer == null) return { invest: false, candidate: null, saving: 0, netSaving: 0, currentTimePer: null, reason: "invalid_base" };
    const cands = Array.isArray(input.candidates) ? input.candidates : [];
    let best = null;
    for (const c of cands) {
      if (!c || typeof c !== "object") continue;
      const cost = num(c.investCost, NaN);
      if (!Number.isFinite(cost) || cost < 0) continue;
      const t = timePerBlock({ baseTime: input.baseTime, tier: c.tier, toolClass: c.toolClass, effectiveClass: input.effectiveClass });
      if (t == null) continue;
      const saving = remaining * (currentTimePer - t);
      const net = saving - cost;
      if (best == null || net > best.netSaving) best = { candidate: c, saving, netSaving: net, timePer: t };
    }
    if (!best) return { invest: false, candidate: null, saving: 0, netSaving: 0, currentTimePer, reason: "no_candidate" };
    if (best.saving <= 0) return { invest: false, candidate: null, saving: best.saving, netSaving: best.netSaving, currentTimePer, reason: "already_better" };
    if (best.netSaving <= 0) return { invest: false, candidate: null, saving: best.saving, netSaving: best.netSaving, currentTimePer, reason: "not_worth" };
    return { invest: true, candidate: best.candidate, saving: best.saving, netSaving: best.netSaving, currentTimePer, reason: "worth" };
  } catch { return { invest: false, candidate: null, saving: 0, netSaving: 0, currentTimePer: null, reason: "invalid" }; }
}
