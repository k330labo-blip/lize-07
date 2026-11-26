// decomposer_draft.js — リゼ (LIZE-07) 長期自律タスク「目標分解エンジン」（ドラフト）
// TANAKA指示: 「ダイヤブロック100個集めて」「原木100スタック集めて」のような最終目標を、
// Bot が自分で考えて達成できるようにするための最上流の計画層。
//
// 役割: 目標（アイテム×個数）→ レシピ木を逆向きに辿って必要素材を逆算し、
//       「採取（葉）→ 精錬/クラフト（深さ順）」のステップ列に分解する。
//       実行そのものはしない（実行は mission.js / 長期タスクランナー側の責務）。
// 純粋JS（@minecraft/server 非依存）。Node でそのままテスト可能。
//
// 統合時の注意: 本ドラフトは solutions/ 配下のため sourcing を相対パスで引いている。
// BP/scripts/ へ取り込む際は import を "./sourcing.js" に変えること（SPEC.md 参照）。

import { findSources } from "./sourcing.js";
import { stackSizeOfItem } from "./amount_math.js"; // cyc1743 0-C5 R-5: スタック表の単一の正
import { buildRecipes, WOOD_SPECIES, smeltPerFuel } from "./recipes.js";

// ============================================================
// レシピ表
// sourcing.js は「単一素材の採取元」は持つが、複数素材レシピの数量構造は
// note の文章でしか持たない。分解には数量構造が必須なので、ここで構造化して持つ。
// 形式: outputItemId -> { out, inputs: {itemId: n}, kind: 'craft'|'smelt',
//                          station: 'hand'|'table'|'furnace', noDecompose?: true }
//   noDecompose: 実在するレシピだが「それで素材を調達する」逆向き分解には使わない
//                （圧縮解除系。ダイヤを集めるのにダイヤブロックを壊す計画は立てない）
// ============================================================

// レシピ表は recipes.js（単一の正, Phase 0 統合）に移管した。ここでは import して使うだけ。
const DEFAULT_SPECIES = WOOD_SPECIES[0]; // オーク

// 圧縮解除は「調達手段」としては使わない（noDecompose 相当）。記録だけ残す。
export const DECOMPRESSION_RECIPES = [
  ["minecraft:diamond", "minecraft:diamond_block"], ["minecraft:iron_ingot", "minecraft:iron_block"],
  ["minecraft:gold_ingot", "minecraft:gold_block"], ["minecraft:emerald", "minecraft:emerald_block"],
  ["minecraft:coal", "minecraft:coal_block"], ["minecraft:redstone", "minecraft:redstone_block"],
  ["minecraft:lapis_lazuli", "minecraft:lapis_block"], ["minecraft:copper_ingot", "minecraft:copper_block"],
  ["minecraft:netherite_ingot", "minecraft:netherite_block"], ["minecraft:raw_iron", "minecraft:raw_iron_block"],
  ["minecraft:raw_gold", "minecraft:raw_gold_block"], ["minecraft:raw_copper", "minecraft:raw_copper_block"],
].map(([unit, block]) => ({ out: 9, inputs: { [block]: 1 }, kind: "craft", station: "hand", noDecompose: true, output: unit }));

// ============================================================
// 名前解決（sourcing に無い圧縮ブロック等を引けるようにする）
// ============================================================
const NAME_INDEX = new Map();
const DISPLAY_NAME = new Map();
function defName(id, name, aliases = []) {
  NAME_INDEX.set(id, id);
  NAME_INDEX.set(name, id);
  for (const a of aliases) NAME_INDEX.set(a, id);
  NAME_INDEX.set(id.replace("minecraft:", ""), id);
  DISPLAY_NAME.set(id, name);
}
defName("minecraft:diamond_block", "ダイヤモンドブロック", ["ダイヤブロック"]);
defName("minecraft:iron_block", "鉄ブロック");
defName("minecraft:gold_block", "金ブロック");
defName("minecraft:emerald_block", "エメラルドブロック");
defName("minecraft:coal_block", "石炭ブロック");
defName("minecraft:redstone_block", "レッドストーンブロック");
defName("minecraft:lapis_block", "ラピスラズリブロック");
defName("minecraft:copper_block", "銅ブロック");
defName("minecraft:netherite_block", "ネザライトブロック");
defName("minecraft:crafting_table", "作業台");
defName("minecraft:furnace", "かまど");
defName("minecraft:chest", "チェスト");
defName("minecraft:torch", "松明", ["たいまつ"]);
defName("minecraft:wooden_pickaxe", "木のツルハシ");
defName("minecraft:stone_pickaxe", "石のツルハシ");
defName("minecraft:iron_pickaxe", "鉄のツルハシ");
defName("minecraft:diamond_pickaxe", "ダイヤのツルハシ");

export function resolveItem(query) {
  if (!query) return null;
  const q = String(query).trim();
  const viaSourcing = findSources(q);
  if (viaSourcing) return viaSourcing.item;
  const byName = NAME_INDEX.get(q) || NAME_INDEX.get(q.toLowerCase()) || null;
  if (byName) return byName;
  // Phase 0: レシピ単一の正（recipes.js）に載るアイテムIDは、sourcing 未登録でも解決する
  try { const R = buildRecipes(DEFAULT_SPECIES); if (R[q]) return q; if (R[q.toLowerCase()]) return q.toLowerCase(); } catch {}
  return null;
}

// ============================================================
// スタック換算（「原木10スタック」→ 640）
// ============================================================
// cyc1743 0-C5 R-5: 独自表を廃し amount_math.stackSizeOfItem (単一の正) へ委譲する。
// 従来表は bucket=16 (正は1)・中身入りバケツ/ハチミツ/他樹種看板=64 (正は1/16/16) と分裂していた。
export function stackSizeOf(item) {
  if (!item) return 64;
  const id = item.includes(":") ? item : "minecraft:" + item;
  return stackSizeOfItem(id).size;
}

// amount + unit（'個' | 'stack' | 'スタック'）→ 個数
export function toCount(item, amount, unit = "個") {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (unit === "stack" || unit === "スタック" || unit === "LC") return n * stackSizeOf(item);
  return n;
}

// ============================================================
// 葉（採取で直接得られる物）判定
// sourcing に「壊す/倒すとそのまま落ちる」ソースがあれば、レシピより葉を優先する。
// （原木・ダイヤ・丸石などを、わざわざ合成で作る計画にしないため）
// ============================================================
// sourcing 上は収量ありに見えるが、実行手段（ハサミ等）が API 制約で無い物
const KNOWN_UNSUPPORTED = new Set(["minecraft:vine", "minecraft:honeycomb"]);

function directSourceOf(item) {
  // 「直接採取」とみなすのは sourcing の推奨順 先頭ソースだけ。
  // 全ソース走査だと、棒（葉からの副産物）や鉄インゴット（ゴーレム討伐）まで
  // 直接扱いになり、クラフト/精錬の計画が崩れるため。
  // さらに yield の下限 >= 1（1回の採取で確実に1個以上出る）ことを要求し、
  // 確率ドロップ（矢・革など）は工程側または確率付き葉へ回す。
  const entry = findSources(item);
  if (!entry) return null;
  const s = entry.sources[0];
  if (!s) return null;
  const okKind = s.kind === "block" || s.kind === "entity";
  if (okKind && s.dropItem === entry.item && !s.process && (s.yield?.[0] ?? 0) >= 1) return { entry, source: s };
  return null;
}

function fillSourceOf(item) {
  // R-C4-4 S2: 充填 (fill) 品目の判定。先頭ソースが kind:"fill" の場合のみ。
  // 直接採取 (directSourceOf) には含めない: 容器の調達が前提の工程品として扱う。
  const entry = findSources(item);
  if (!entry) return null;
  const s = entry.sources[0];
  if (s && s.kind === "fill") return { entry, source: s };
  return null;
}

function leafSourceOf(item) {
  // 葉の採取元は sourcing の推奨順先頭（直接ソースと一致する場合はそれが先頭）
  const entry = findSources(item);
  if (!entry) return null;
  return { entry, source: entry.sources[0] };
}

// ============================================================
// 分解エンジン本体
// decompose(itemOrName, count, opts)
//   opts: { inventory?: {itemId: n},   … 既に持っている分は必要量から差し引く
//           woodSpecies?: 'oak'|..., … 棒・木ツールに使う樹種（デフォルト oak）
//           fuelItem?: itemId,         … 精錬燃料（デフォルト石炭。1個で8回精錬）
//           forbiddenTargets?: [itemId] } … 禁止対象（Phase5 Slice 2）。葉（新規調達分）と
//                                            id 完全一致した場合のみ feasible:false にする。
//                                            工程品・燃料・在庫充足分へは広げない
// 返り値: plan {
//   target: { item, name, count },
//   feasible: boolean,                 // 全ての葉が調達可能なら true
//   requirements: [ { item, name, count, sourceKind, sourceId, dropItem,
//                     yield:[min,max], where, estActions:{min,max},
//                     unsupported?, unknown?, probabilistic? } ],
//   steps: [ 採取ステップ（基幹度順）..., 工程ステップ（深さ昇順）... ],
//   surplus: { itemId: n },            // 工程の端数で余る分
//   fuel: { item, count, forOps } | null,
//   totals: { smeltOps, craftOps, gatherActionsMin, gatherActionsMax },
//   warnings: [string]
// }
// ============================================================
export function decompose(itemOrName, count, opts = {}) {
  const item = resolveItem(itemOrName);
  const warnings = [];
  // Phase5 forbidden gate Slice2 (decomposer 葉ゲート): 正規化は Slice 1
  // (mission.js createMission 冒頭) と同一作法 — 文字列のみ・空文字除外・重複排除。
  // 配列でない値（文字列・数値等）は「禁止なし」として安全に倒す。
  const forbiddenTargets = Array.isArray(opts.forbiddenTargets) ? [...new Set(opts.forbiddenTargets.filter((x) => typeof x === "string" && x))] : [];
  if (!item) {
    return { target: { item: null, name: String(itemOrName), count }, feasible: false, requirements: [], steps: [], surplus: {}, fuel: null, totals: { smeltOps: 0, craftOps: 0, gatherActionsMin: 0, gatherActionsMax: 0 }, warnings: [`「${itemOrName}」が何のアイテムか特定できませんでした`] };
  }
  const total = Math.max(1, Math.floor(Number(count) || 1));
  const want = opts.woodSpecies || "oak";
  const species = WOOD_SPECIES.find((s) => s.log === `minecraft:${want}_log` || s.log === `minecraft:${want}_stem`) || DEFAULT_SPECIES;
  const RECIPES = buildRecipes(species);
  const targetEntry = findSources(item);

  const ctx = {
    inventory: { ...(opts.inventory || {}) },
    pool: {},              // 工程の余り（後続の必要量に充当できる）
    leaves: new Map(),     // itemId -> 必要個数（葉）
    crafts: new Map(),     // itemId -> { item, kind, station, crafts, inputs }
    fills: new Map(),      // R-C4-4 S2: itemId -> { item, container, medium, mediumKind, fills }
    expanding: new Set(),  // 循環ガード
  };

  function takeFromStock(id, qty) {
    let rest = qty;
    const inv = ctx.inventory[id] || 0;
    if (inv > 0) { const use = Math.min(inv, rest); ctx.inventory[id] = inv - use; rest -= use; }
    if (rest > 0) {
      const pool = ctx.pool[id] || 0;
      if (pool > 0) { const use = Math.min(pool, rest); ctx.pool[id] = pool - use; rest -= use; }
    }
    return rest;
  }

  function expand(id, qty) {
    let rest = takeFromStock(id, qty);
    if (rest <= 0) return;
    // R-C4-4 S2: 充填品目は葉にもレシピ工程にもせず、fill 工程として記録し、
    // 容器 (バケツ) x 必要数を子として展開する (バケツは既存レシピで鉄へ繋がる)。
    const fill = fillSourceOf(id);
    if (fill && !ctx.expanding.has(id)) {
      const rec = ctx.fills.get(id) || { item: id, container: fill.source.container, medium: fill.source.id, mediumKind: fill.source.mediumKind || null, fills: 0 };
      rec.fills += rest;
      ctx.fills.set(id, rec);
      ctx.expanding.add(id);
      expand(fill.source.container, rest);
      ctx.expanding.delete(id);
      return;
    }
    const recipe = RECIPES[id];
    const direct = directSourceOf(id);
    // 葉を優先する条件: 直接採取ソースがあり、かつ「圧縮/精錬の産物」でない素の素材であること。
    // 判定は単純に: 直接ソースがあり、レシピが圧縮ブロック系（inputs が単一素材9個）でない場合は葉。
    // ただし板材・棒のように sourcing 側が craft ソースしか持たない物は direct が null になるため自然に工程へ進む。
    const isCompression = recipe && Object.keys(recipe.inputs).length === 1 && Object.values(recipe.inputs)[0] === 9;
    if (direct && !isCompression) {
      ctx.leaves.set(id, (ctx.leaves.get(id) || 0) + rest);
      return;
    }
    if (recipe && !recipe.noDecompose && !ctx.expanding.has(id)) {
      const crafts = Math.ceil(rest / recipe.out);
      const produced = crafts * recipe.out;
      if (produced > rest) ctx.pool[id] = (ctx.pool[id] || 0) + (produced - rest);
      const rec = ctx.crafts.get(id) || { item: id, kind: recipe.kind, station: recipe.station, crafts: 0, inputs: recipe.inputs };
      rec.crafts += crafts;
      ctx.crafts.set(id, rec);
      ctx.expanding.add(id);
      for (const [inId, inN] of Object.entries(recipe.inputs)) expand(inId, inN * crafts);
      ctx.expanding.delete(id);
      return;
    }
    // レシピが無い/循環 → 葉として採取に回す
    ctx.leaves.set(id, (ctx.leaves.get(id) || 0) + rest);
  }

  expand(item, total);

  // Slice2 葉ゲート: この時点で ctx.leaves にあるのは「レシピ木を辿って新規調達が
  // 必要になった素材」だけ（在庫・pool で賄えた分は takeFromStock で消えている）。
  // 燃料ブロック（下記）より前に判定することで、燃料として注入される葉は対象に
  // ならず、材料として立つ同じ id の葉だけを捕捉できる（位置による役の分離）。
  // 葉は落とさない: 落とした feasible:true 計画は下流の虚偽完了の種になるため、
  // feasible:false + 警告で正直に倒す。
  const forbiddenLeaves = [...ctx.leaves.keys()].filter((id) => forbiddenTargets.includes(id));
  for (const id of forbiddenLeaves) warnings.push(`禁止対象 ${id} が必要なため、この手段では作れません`);

  // --- 深さ（工程の実行順序）: 葉=0、工程品=1+max(材料の深さ) ---
  const depthMemo = new Map();
  function depthOf(id, guard = new Set()) {
    if (depthMemo.has(id)) return depthMemo.get(id);
    const recipe = RECIPES[id];
    if (!recipe || guard.has(id)) { depthMemo.set(id, 0); return 0; }
    guard.add(id);
    const d = 1 + Math.max(0, ...Object.keys(recipe.inputs).map((i) => depthOf(i, guard)));
    depthMemo.set(id, d);
    return d;
  }

  // --- 精錬の燃料（石炭1個 = 8回）。燃料自体が葉に含まれていれば合算する ---
  let smeltOps = 0;
  for (const rec of ctx.crafts.values()) if (rec.kind === "smelt") smeltOps += rec.crafts;
  let fuel = null;
  if (smeltOps > 0) {
    const fuelItem = opts.fuelItem || "minecraft:coal";
    const fuelCount = Math.ceil(smeltOps / smeltPerFuel(fuelItem));
    fuel = { item: fuelItem, count: fuelCount, forOps: smeltOps };
    ctx.leaves.set(fuelItem, (ctx.leaves.get(fuelItem) || 0) + fuelCount);
    warnings.push(`精錬 ${smeltOps} 回分の燃料として ${fuelItem} が ${fuelCount} 個別途必要です`);
  }

  // --- 葉 → requirements / 採取ステップ ---
  const requirements = [];
  const gatherSteps = [];
  let feasible = forbiddenLeaves.length === 0;
  let gatherMin = 0, gatherMax = 0;
  const leafList = [...ctx.leaves.entries()].map(([id, n]) => {
    const ls = leafSourceOf(id);
    return { id, n, ls, priority: ls?.entry?.priority ?? 9 };
  }).sort((a, b) => a.priority - b.priority);

  for (const { id, n, ls } of leafList) {
    if (!ls) {
      feasible = false;
      requirements.push({ item: id, name: id, count: n, sourceKind: null, sourceId: null, dropItem: id, yield: [1, 1], where: null, estActions: { min: n, max: n }, unknown: true });
      gatherSteps.push({ type: "gather", item: id, need: n, unknown: true });
      warnings.push(`${id} の入手方法が知識にありません`);
      continue;
    }
    const { entry, source } = ls;
    const [ymin, ymax] = source.yield || [1, 1];
    const zeroYield = ymax <= 0;
    const unsupported = zeroYield || KNOWN_UNSUPPORTED.has(id);
    if (unsupported) { feasible = false; warnings.push(`${entry.name} は現行の実行手段では採取できません（代替手段の検討が必要です）`); }
    const est = { min: ymax > 0 ? Math.ceil(n / ymax) : null, max: ymin > 0 ? Math.ceil(n / ymin) : null };
    if (ymin <= 0 && ymax > 0) warnings.push(`${entry.name} は確率ドロップのため、必要回数は目安です`);
    if (est.min !== null) gatherMin += est.min;
    if (est.max !== null) gatherMax += est.max; else gatherMax = null;
    requirements.push({
      item: id, name: entry.name, count: n,
      sourceKind: source.kind, sourceId: source.id, dropItem: source.dropItem,
      yield: source.yield, where: source.where || null, estActions: est,
      ...(unsupported ? { unsupported: true } : {}),
      ...(ymin <= 0 && ymax > 0 ? { probabilistic: true } : {}),
    });
    gatherSteps.push({
      type: source.kind === "entity" ? "hunt" : "gather",
      item: id, need: n, via: source.id, dropItem: source.dropItem,
      dim: source.where?.dim || "overworld", biome: source.where?.biome || null, yRange: source.where?.yRange || null,
      estActions: est, ...(unsupported ? { unsupported: true } : {}),
    });
  }

  // --- 工程ステップ（深さ昇順 = 基礎工程から） ---
  const processSteps = [...ctx.crafts.values()]
    .map((rec) => ({
      type: rec.kind, // 'craft' | 'smelt'
      item: rec.item, crafts: rec.crafts,
      output: rec.crafts * (RECIPES[rec.item]?.out || 1),
      inputs: Object.fromEntries(Object.entries(rec.inputs).map(([i, n]) => [i, n * rec.crafts])),
      station: rec.station, depth: depthOf(rec.item),
    }))
    .sort((a, b) => a.depth - b.depth);

  // --- 充填ステップ (R-C4-4 S2): 容器のクラフトより後に実行する工程として末尾へ。
  // S4 (cyc2382) で実行部を接続済み。
  const fillSteps = [...ctx.fills.values()].map((rec) => ({
    type: "fill",
    item: rec.item, fills: rec.fills,
    container: rec.container, needContainer: rec.fills,
    medium: rec.medium, mediumKind: rec.mediumKind,
    supported: true, // R-C4-4 S4 (cyc2382): 充填tx接続済み
  }));
  const fillOps = fillSteps.reduce((a, s) => a + s.fills, 0);

  const craftOps = processSteps.filter((s) => s.type === "craft").reduce((a, s) => a + s.crafts, 0);
  const surplus = Object.fromEntries(Object.entries(ctx.pool).filter(([, n]) => n > 0));

  return {
    target: { item, name: targetEntry?.name || DISPLAY_NAME.get(item) || item, count: total },
    feasible,
    requirements,
    steps: [...gatherSteps, ...processSteps, ...fillSteps],
    surplus,
    fuel,
    // fillOps は充填工程がある場合のみ載せる (0 のときは従来形を保ち、既存の分解結果と等価性を壊さない)
    totals: { smeltOps, craftOps, gatherActionsMin: gatherMin, gatherActionsMax: gatherMax, ...(fillOps > 0 ? { fillOps } : {}) },
    warnings,
  };
}

export default decompose;
