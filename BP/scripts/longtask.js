// longtask.js — 長期自律タスクの計画器（純粋JS）
// 「ダイヤモンドブロックを集めて」のような最終目標を、
//   目標分解（decomposer: 葉＝採取、工程＝クラフト/精錬）
//   ＋ ツール技術ツリー（bootstrap: 素手→木→石→鉄→ダイヤ）
// を合成して「工程（leg）の列」に変換する。実行は main.js の tickLongTask が担い、
// 採取 leg は既存ミッション、工程 leg は crafting.js が実行する。
import { decompose } from "./decomposer.js";
import { planBootstrap, requiredLevelFor, TIERS, TIER_LEVEL, GROUPS } from "./bootstrap.js";

export { GROUPS };

// ブランチマイニングの目標深度（その素材が狙うべきY）。無い素材は地表・洞窟探索で探す。
const DEPTH_RULES = [
  [/diamond|redstone/, -54],
  [/lapis/, -16],
  [/raw_gold|gold_ore/, -18],
  [/raw_iron|iron_ore/, 14],
  [/ancient_debris/, 15],
];
export function mineDepthFor(item) {
  if (!item) return null;
  if (/nether_gold_ore/.test(item)) return null; // queue2: /gold_ore/ 部分一致でネザー専用鉱石に -18 が付く誤判定を是正 (オーバーワールド潜行の誤動作防止)
  for (const [re, y] of DEPTH_RULES) if (re.test(item)) return y;
  return null;
}

// グループ（group:logs 等）・素のIDどちらの在庫数も数える
export function countOfGroup(inv, itemOrGroup) {
  if (!itemOrGroup) return 0;
  if (itemOrGroup.startsWith("group:")) {
    const members = GROUPS[itemOrGroup] || [];
    return members.reduce((a, id) => a + (inv[id] || 0), 0);
  }
  return inv[itemOrGroup] || 0;
}

// 採取 leg を通常ミッションへ渡すときの対象ID
export function legMissionTarget(leg) {
  if (leg.item === "group:logs") return "log";
  if (leg.item === "group:cobble") return "minecraft:cobblestone";
  if (leg.item === "group:planks") return "minecraft:oak_planks";
  return leg.item;
}

function normalizeBootStep(s) {
  return { type: s.type, item: s.item, need: s.count || 1, crafts: s.crafts || 0, needs: s.needs || null, via: s.from || null, yRange: null, depth: mineDepthFor(s.from || s.item), station: null, fromBootstrap: true, dim: s.dim || null };
}
function normalizeDecStep(s) {
  if (s.type === "craft" || s.type === "smelt") {
    return { type: s.type, item: s.item, need: s.output || 1, crafts: s.crafts || 1, needs: s.inputs || null, station: s.station || null, via: null, yRange: null, depth: null, dim: s.dim || null };
  }
  return { type: s.type, item: s.item, need: s.need || 1, via: s.via || null, yRange: s.yRange || null, depth: mineDepthFor(s.item) ?? mineDepthFor(s.via), crafts: 0, needs: null, station: null, dim: s.dim || null }; // queue2: dim を落とさない (decomposer の gather step が持つ次元情報を下流の次元ガードへ渡す)
}

// 注文 → 長期タスク計画。工程が無い純採取なら null（通常ミッションで足りる）。
// 分解不能なら { feasible:false, warnings } を返す。
export function planLongTask(order, invCounts) {
  const target = order?.target;
  const amount = Math.max(1, Math.floor(order?.amount || 1));
  if (!target) return null;
  // Phase5 forbidden Slice2 中継: order.constraints.forbiddenTargets を Slice 1
  // (mission.js) と同一作法で正規化し、decomposer の葉ゲートへ渡す。
  const forbiddenTargets = Array.isArray(order?.constraints?.forbiddenTargets) ? [...new Set(order.constraints.forbiddenTargets.filter((x) => typeof x === "string" && x))] : [];
  let dec = null;
  try { dec = decompose(target, amount, { inventory: invCounts || {}, forbiddenTargets }); } catch { dec = null; }
  if (!dec || !dec.target?.item) return null;
  if (!dec.feasible) return { feasible: false, warnings: dec.warnings || [], target: dec.target, legs: [] };

  // 必要ツール等級：最終目標と全採取葉の最大値
  let reqLevel = 0;
  try { reqLevel = Math.max(0, requiredLevelFor(dec.target.item) || 0); } catch {}
  for (const s of dec.steps) {
    if (s.type === "gather" || s.type === "hunt") {
      try { reqLevel = Math.max(reqLevel, requiredLevelFor(s.item) || 0); } catch {}
    }
  }
  const reqTier = reqLevel > 0 ? TIERS[reqLevel - 1] : null;

  let boot = null;
  try { boot = planBootstrap({ invCounts: invCounts || {}, goal: { targetItem: dec.target.item, ...(reqTier ? { targetTier: reqTier } : {}), activity: "gather" } }); } catch { boot = null; }

  const legs = [];
  if (boot && boot.status !== "ready" && Array.isArray(boot.steps)) for (const s of boot.steps) legs.push(normalizeBootStep(s));
  for (const s of dec.steps) legs.push(normalizeDecStep(s));

  // 長期タスクにする条件：工程がある／ツール自作が要る／地下へ掘り進む採取がある。
  // どれも無い純粋な地表採取だけ通常ミッションに任せる。
  const hasProcess = legs.some((l) => l.type === "craft" || l.type === "smelt");
  const hasBoot = boot && boot.status !== "ready" && Array.isArray(boot.steps) && boot.steps.length > 0;
  const hasMine = legs.some((l) => l.depth != null);
  if (!hasProcess && !hasBoot && !hasMine) return null;
  return { feasible: true, target: dec.target, legs, warnings: dec.warnings || [], totals: dec.totals || null };
}

// 工程の短い表示名（節目報告・名札用）
export function legLabel(leg, nameOf) {
  const nm = nameOf ? nameOf(leg.item) : leg.item;
  if (leg.type === "gather") return `${nm}を${leg.need}個集める`;
  if (leg.type === "hunt") return `${nm}を${leg.need}体分狩る`;
  if (leg.type === "craft") return `${nm}を作る`;
  if (leg.type === "smelt") return `${nm}を精錬する`;
  return nm;
}
