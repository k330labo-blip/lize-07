// goap_state.js — GOAP 影評価用 state builder (Phase 3, v0.4.14 で cycle-1052/a10 を統合)
// GOAP 影評価用 state builder 改良版（ctx / inventory / knownContainers / recipes
// から計画状態を組み立てる純粋関数群）。共有ファイルは編集していない。
// 前身: cycle-1040/a13-goap-state-builder.mjs。本版の改良点は §改良 を参照。
//
// ===== 改良（a13 からの差分） =====
// 1. ctx アダプタ層 buildStateFromCtx(ctx, opts) を新設。a13 は呼び出し側が
//    事前に消化した input を要求していたが、本版は実 ctx（c.x.items /
//    c.x.obs.inv / c.x.obs.perc / c.x.nearCraft / c.x.nearFurnace /
//    c.x.knownChestDist）を optional chaining で直接読み、消化済み input と
//    同じ {state, meta} を返す。main.js 影評価の差し替えが 1 呼び出しになる。
// 2. knownContainers の中身集計 aggregateChestCounts() を新設。a13 は
//    withdraw 候補 1 件の count しか扱えなかった。本版は複数コンテナの
//    contents（中身が観測済みのものだけ）を item 単位で合算し
//    chest.<item> fact を作る。中身未観測のコンテナは「0 個」とも
//    「在る」とも言わず meta.unobservedContainers に数だけ残す。
// 3. 鮮度（freshness）判定: コンテナ記録の t が opts.now から
//    CHEST_FRESH_MS（既定 10 分）より古ければ stale として集計から外し、
//    meta.staleContainers に残す。古い記憶を現在の在庫と混同しない。
// 4. 三状態の明示: meta.factStatus に問い合わせ集合の全 fact について
//    "known" | "unknown" を理由付きで記録する（a13 は unknownReasons の
//    文字列列挙のみ）。state にキーが無い = UNKNOWN であり、false や 0 と
//    混同しない原則は a13 から維持（下記 §三状態）。
// 5. station の perc ゲート: nearCraft/nearFurnace は c.x.obs.perc が
//    "unknown" のとき boolean 値が残っていても採用しない（知覚できて
//    いないのに「作業台が無い確定」にしない）。
//
// ===== §三状態（不変の原則） =====
// - 分からない fact は state にキー自体を入れない（UNKNOWN）。
//   goap.js の satisfies() は欠落 fact を未充足として扱うため、
//   UNKNOWN を false/0 に潰すと「無い確定」と誤認した計画になる。
// - inv.*: c.x.obs.inv === "ok"（閉世界が成立）のときだけ 0 埋め可。
// - near.<item>_source: present 確定は 1（存在であって量ではない）、
//   absent 確定は 0、どちらでもなければ欠落。99 番兵は廃止した
//   （a13 の compatSentinel99 は本版に持ち込まない。捏造は meta にも
//   残さない方針へ一本化）。
// - chest.<item>: 中身が観測済み かつ 鮮度内のコンテナ合算のみ。
//   コンテナの存在だけでは fact 化しない。
// - station.*: perc が有効で boolean が確定した分だけ。false は
//   「無い確定」として出し、PLACE が set:true で立て直せる。
//
// ===== 契約 =====
// - 純粋関数。入力（ctx / containers / recipes）は変更しない。API 呼び出し
//   ゼロ。全読み取りは optional chaining、例外は投げない。
// - レシピは引数 recipes（recipes.js buildRecipes() の出力形:
//   outputId -> {out, inputs:{itemId:n}, kind, station:"hand"|"table"|"furnace"}）
//   として注入する。本ファイルにレシピを複写しない（単一の正は recipes.js）。
// - station 語彙は a13 と同じ橋渡し: kind -> STATION_ITEM の itemId で
//   fact 名 station.<itemId> に統一。hand は述語なし。
// - 戻り値 {state, goal, actions, meta} は goap.js plan() へそのまま渡せる。
// - ctx フィールドの削除・意味変更はしない（読むだけ）。decide の p 意味論・
//   effMove.id 接頭辞には触れない。生成 Action id は goap.js 側の
//   GATHER:/WITHDRAW:/PICKUP:/RECEIVE:/CRAFT:/PLACE: 名前空間のみ。
//
// ===== 統合手順（コーディネータが直列で行う） =====
// - BP/scripts/goap_state.js 等へ移し、main.js 影評価を
//     const ev = buildEvaluationFromCtx(ctx, { target, need, have,
//        recipes: buildRecipes(species), containers: wm?.knownContainers?.(dim) });
//     const res = goapPlan(ev.state, ev.goal, ev.actions);
//   へ差し替える（記録のみ、実行・分岐は変えない）。
// - world_memory のコンテナ記録に contents が載るまでは、containers を
//   渡しても中身未観測として扱われ chest fact は出ない（安全側）。
//   recordContainer 側へ contents を配線する変更は別担当の範囲。

import { plan as goapPlan, sourcingActions, craftAction, smeltAction, smeltVariantAction, batchFor, placeStationAction }
  from "./goap.js";
import { buildRecipes, WOOD_SPECIES, FUEL_TABLE, FUEL_VARIANT_EXCLUDED } from "./recipes.js";

// ---------- 定数 ----------
export const STATION_ITEM = Object.freeze({
  table: "minecraft:crafting_table",
  furnace: "minecraft:furnace",
});
export const LOG_IDS = Object.freeze(WOOD_SPECIES.map(s => s.log));
export const CHEST_FRESH_MS = 10 * 60 * 1000; // 既定の鮮度窓: 10分
const isLog = (id) => typeof id === "string" && LOG_IDS.includes(id);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// ---------- レシピ閉包（a13 と同仕様: 循環安全・決定的） ----------
export function recipeClosure(target, recipes, opts = {}) {
  const maxDepth = opts.maxDepth ?? 8, maxItems = opts.maxItems ?? 64;
  const items = [], used = new Map(), cycles = [];
  let truncated = false;
  const visit = (item, depth) => {
    if (used.has(item) || items.includes(item)) { if (depth > 0) cycles.push(item); return; }
    if (items.length >= maxItems) { truncated = true; return; }
    items.push(item);
    const r = recipes?.[item];
    if (!r) return;
    used.set(item, r);
    if (depth >= maxDepth) { truncated = true; return; }
    for (const inp of Object.keys(r.inputs ?? {}).sort()) visit(inp, depth + 1);
  };
  if (typeof target === "string" && target) visit(target, 0);
  return { items, recipesUsed: used, cycles, truncated };
}

export function mergedClosure(target, recipes) {
  let cur = recipeClosure(target, recipes);
  for (let round = 0; round < 4; round++) {
    const stations = [...new Set([...cur.recipesUsed.values()]
      .map(r => r?.station && r.station !== "hand" ? STATION_ITEM[r.station] : null).filter(Boolean))];
    const missing = stations.filter(s => !cur.items.includes(s));
    if (!missing.length) break;
    for (const s of missing) {
      const sub = recipeClosure(s, recipes);
      for (const it of sub.items) if (!cur.items.includes(it)) cur.items.push(it);
      for (const [k, v] of sub.recipesUsed) if (!cur.recipesUsed.has(k)) cur.recipesUsed.set(k, v);
      cur.cycles.push(...sub.cycles); cur.truncated = cur.truncated || sub.truncated;
    }
  }
  return cur;
}

export function toGoapRecipe(outputId, recipe) {
  const stationItem = recipe?.station && recipe.station !== "hand"
    ? (STATION_ITEM[recipe.station] ?? null) : null;
  // kind を保持する (v0.4.16): smelt は buildActions で SMELT へ振り分ける。
  // 欠落時は craft として扱う後方互換。
  return { out: outputId, n: recipe?.out ?? 1, inputs: { ...(recipe?.inputs ?? {}) },
           kind: recipe?.kind ?? "craft",
           ...(stationItem ? { station: stationItem } : {}) };
}

// ---------- 燃料集約 fact (Phase3 SMELT, v0.4.16) ----------
// 所持品から精錬可能個数の集約値 fuel.burn を換算する純粋関数。
// 換算表は recipes.js FUEL_TABLE が単一の正。加えて全樹種の原木/板材は
// FUEL_TABLE のオーク値 (1.5) を WOOD_SPECIES から汎用的に適用する
// (表がオーク系のみで他樹種が 0 になる穴 D-F1 の是正)。
// 戻り値: 有限の burn 値。異常値が混ざれば null (=UNKNOWN 側に倒す)。
// 燃料値マップの単一構築点 (知識層, Phase3 SMELT L1, v0.4.39)。FUEL_TABLE を正とし、
// 表に無い樹種の log/planks へオーク値 1.5 を汎用的に適用する (fuelBurnFromItems と
// 変種生成が共用する)。null-proto で構築し own 判定のみ使う: 特殊キー
// (constructor/__proto__ 等) が継承値として候補・Action id へ昇格する経路を作らない。
// 値が有限正数でないキーは落とす。smeltPerFuel の「表外は既定値 8」は使わない。
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export function fuelValueMap(fuelTable = FUEL_TABLE, species = WOOD_SPECIES) {
  const values = Object.create(null);
  for (const [k, v] of Object.entries(fuelTable ?? {}))
    if (typeof v === "number" && Number.isFinite(v) && v > 0) values[k] = v;
  for (const sp of species ?? []) {
    if (sp?.log && !hasOwn(values, sp.log)) values[sp.log] = 1.5;
    if (sp?.planks && !hasOwn(values, sp.planks)) values[sp.planks] = 1.5;
  }
  return values;
}
export function fuelBurnFromItems(items) {
  if (!items || typeof items !== "object") return null;
  const values = fuelValueMap();
  const excluded = new Set(FUEL_VARIANT_EXCLUDED ?? []);
  let burn = 0;
  for (const [item, n] of Object.entries(items)) {
    if (!isNum(n) || n < 0) return null;
    if (excluded.has(item)) continue;
    const v = hasOwn(values, item) ? values[item] : undefined;
    if (isNum(v) && v > 0 && n > 0) burn += n * v;
  }
  return burn;
}

// ---------- SMELT L1 変種生成 (Phase3, v0.4.39) ----------
// 第1級 spec: 実行部 (crafting.js) の消費可能集合 FUEL_FALLBACK の id/グループ列。
// crafting.js は @minecraft/server を import するため本モジュールから import できず、
// 対応は tools/validate.py が両ファイルの列一致を機械検査する (二重定義の検出)。
// 導出結果 (第1級) は石炭/木炭/棒 + 全樹種 log/planks = 25キー。第2級 (溶岩バケツ/
// 石炭ブロック/ブレイズロッド/木ツルハシ/オークハーフブロック/竹) は実行部が
// 消費できないため変種を作らない (V-3 再導入禁止)。
export const FUEL_TIER1_SPEC = Object.freeze(["minecraft:coal", "minecraft:charcoal", "group:planks", "group:logs", "minecraft:stick"]);
// SMELT P2 (v0.4.44): 変種候補の供給集合は fuelValueMap 全キーから宣言的例外
// (FUEL_VARIANT_EXCLUDED) を引いたもの。実行部 FUEL_FALLBACK の消費集合と一致させる
// (集合一致は validate.py が導出で検査する)。第1級 spec/resolveTier1Fuels は
// 実行部の系統列との対応検査のため温存する。
export function resolveVariantFuels(valueMap, excluded = FUEL_VARIANT_EXCLUDED) {
  const ex = new Set(excluded ?? []);
  return Object.keys(valueMap ?? {}).filter((k) => !ex.has(k)).sort();
}
export function resolveTier1Fuels(fallbackSpec, valueMap, species = WOOD_SPECIES) {
  const out = new Set();
  for (const entry of fallbackSpec ?? []) {
    const id = Array.isArray(entry) ? entry[0] : entry;
    if (typeof id !== "string") continue;
    if (id === "group:logs") {
      for (const sp of species ?? []) if (sp?.log && hasOwn(valueMap ?? {}, sp.log)) out.add(sp.log);
    } else if (id === "group:planks") {
      for (const sp of species ?? []) if (sp?.planks && hasOwn(valueMap ?? {}, sp.planks)) out.add(sp.planks);
    } else if (!id.startsWith("group:") && hasOwn(valueMap ?? {}, id)) out.add(id);
  }
  return [...out].sort();
}
// 当該燃料が初期 inv. に既知として存在するか (案A′ (P) の出所は knownInv のみ。
// chest/drop/owner_has 経由のみで既知な燃料には付けない)。
export function fuelInitiallyInInv(knownInv, fuelId) {
  if (!knownInv || typeof knownInv !== "object" || typeof fuelId !== "string") return false;
  if (!hasOwn(knownInv, fuelId)) return false;
  const n = knownInv[fuelId];
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}
// 候補絞り込み。次を全て満たす燃料だけ変種を作る:
//  (1) 値マップに実在 (2) 第1級 (3) quarter バッチが導出できる
//  (4) inv./chest./drop./owner_has. のいずれかが既知として存在するか、
//      レシピ閉包の items に含まれる (5) 目標保護に抵触しない
// 生成順は決定的: batchUnits 小さい順 -> fuelId 辞書順。
export function selectVariantFuels(recipe, opts = {}) {
  const valueMap = opts?.valueMap ?? {};
  const tier1 = new Set(opts?.tier1 ?? []);
  const known = new Set(opts?.knownItems ?? []);
  const closure = new Set(opts?.closureItems ?? []);
  const picked = [];
  for (const fuelId of Object.keys(valueMap)) {
    if (!tier1.has(fuelId)) continue;
    const batch = batchFor(valueMap[fuelId]);
    if (!batch) continue;
    if (!known.has(fuelId) && !closure.has(fuelId)) continue;
    if (opts?.goalItem && fuelId === opts.goalItem) {
      if (!fuelInitiallyInInv(opts?.knownInv, fuelId)) continue;
      if (opts.knownInv[fuelId] < batch.units) continue; // 目標保護: バッチ分未満は使わない
    }
    picked.push({ fuelId, burn: valueMap[fuelId], batch,
      fuelInitiallyInInv: fuelInitiallyInInv(opts?.knownInv, fuelId) });
  }
  picked.sort((a, b) => (a.batch.units - b.batch.units) || (a.fuelId < b.fuelId ? -1 : a.fuelId > b.fuelId ? 1 : 0));
  return picked;
}
// L3 抑制規則 (精緻化版): レシピ入力が燃料値マップと交わり L1 が1件以上あるときだけ
// 抑制する。L1 が0件なら L3 は残る (その局面の V-2 は既存残件)。
export function shouldSuppressAggregate(recipe, valueMap, variantCount) {
  if (!(variantCount > 0)) return false;
  return Object.keys(recipe?.inputs ?? {}).some((it) => hasOwn(valueMap ?? {}, it));
}
// 統合生成: { variants, aggregate, suppressed }。kind が "smelt" 以外は空。
// aggregate は現行 smeltAction(recipe) そのもの (新規実装しない)。
export function buildSmeltActions(recipe, opts = {}) {
  if (!recipe || (recipe.kind ?? "smelt") !== "smelt")
    return { variants: [], aggregate: null, suppressed: false };
  const valueMap = opts?.valueMap ?? fuelValueMap();
  const tier1 = opts?.tier1 ?? resolveVariantFuels(valueMap);
  const variants = selectVariantFuels(recipe, { ...opts, valueMap, tier1 })
    .map(({ fuelId, burn, fuelInitiallyInInv: fii }) => smeltVariantAction(recipe, fuelId, burn, fii)).filter(Boolean);
  const suppressed = shouldSuppressAggregate(recipe, valueMap, variants.length);
  return { variants, aggregate: suppressed ? null : smeltAction(recipe), suppressed };
}
// 燃料 sourcing の局所式 (暫定: NQ-03 の需要マップへ寄せるまでの暫定式であり、
// 現行の lack 一律伝播は流用しない)。必要 units = ceil(不足精錬回数 / batchOps) * batchUnits。
export function fuelUnitsNeeded(lackOps, burn) {
  const batch = batchFor(burn);
  if (!batch || typeof lackOps !== "number" || !Number.isFinite(lackOps) || lackOps <= 0) return null;
  return Math.ceil(lackOps / batch.ops) * batch.units;
}

// ---------- 改良2+3: knownContainers の中身集計（鮮度つき） ----------
/**
 * aggregateChestCounts(containers, opts?) -> { counts, observed, unobserved, stale, fullSkipped, perHolder }
 * perHolder: 適格レコード (鮮度内・contents 観測済み・数値座標あり) ごとの
 *   { dim, x, y, z, ct, counts } の写し (NQ-03 ステップ1, design §3.1)。
 *   counts の適格条件は合算本体と同一 (R-05: 正整数のみ)。
 * containers: world_memory.knownContainers() 形の配列を想定するが、中身は
 *   rec.contents（{itemId: 個数}）が観測済みのレコードだけが持つ前提。
 *   contents が無いレコードは「中身 UNKNOWN」であって 0 ではない。
 * opts: { now?:number(ms, 既定 Date.now()), freshMs?:number, excludeFull?:boolean }
 * - t が now - freshMs より古いレコードは stale として数え、集計しない。
 * - t が無いレコードは鮮度不明として stale 扱い（安全側）。
 * - full なレコードは既定では集計する（在庫の取り出しは可能）が、
 *   excludeFull:true では fullSkipped に数えて外す。
 */
export function aggregateChestCounts(containers, opts = {}) {
  const now = isNum(opts?.now) ? opts.now : Date.now();
  const freshMs = isNum(opts?.freshMs) ? opts.freshMs : CHEST_FRESH_MS;
  const counts = Object.create(null); // cycle1834: 特殊キー (__proto__/constructor) での喪失・型破壊を防ぐ (fuelValueMap と同方針)
  const perHolder = [];
  let observed = 0, unobserved = 0, stale = 0, fullSkipped = 0;
  for (const rec of containers ?? []) {
    if (!rec || typeof rec !== "object") continue;
    const stamp = isNum(rec.ct) ? rec.ct : rec.t; // N1 (v0.4.18): contents 専用時刻 ct 優先、欠落時は t (後方互換)
    if (!isNum(stamp) || now - stamp > freshMs) { stale++; continue; }
    if (opts?.excludeFull && rec.full) { fullSkipped++; continue; }
    const contents = rec.contents ?? rec.items;
    if (!contents || typeof contents !== "object") { unobserved++; continue; }
    observed++;
    for (const [item, n] of Object.entries(contents))
      // NQ-03 R-05 (v0.4.36): 個数は正整数のみ適格。非整数 (0.5 等) を素通しすると
      // 0.5+0.5=1 のような幻影在庫で計画が成立するため、適格外として数えない。
      if (typeof item === "string" && Number.isInteger(n) && n > 0) counts[item] = (counts[item] ?? 0) + n;
    // NQ-03 ステップ1 (design §3.1): 保持者別の写し。収録条件は集計本体と同一の
    // 適格レコードに数値座標ありを追加したもの。座標が無い保持者は別名を貰え
    // ないため入れない (合算 counts には従来どおり入る)。counts の適格条件は
    // 本体の R-05 と完全一致させる (片方だけ違うと不変条件が初期 state で崩れる)。
    if (isNum(rec.x) && isNum(rec.y) && isNum(rec.z)) {
      const hc = Object.create(null);
      for (const [item, n] of Object.entries(contents))
        if (typeof item === "string" && Number.isInteger(n) && n > 0) hc[item] = n;
      perHolder.push({ dim: typeof rec.dim === "string" ? rec.dim : null,
        x: rec.x, y: rec.y, z: rec.z, ct: stamp, counts: hc });
    }
  }
  return { counts, observed, unobserved, stale, fullSkipped, perHolder };
}

// ---------- NQ-01 P1 (v0.4.18): アイテム別チェスト実距離 ----------
// 適格条件は aggregateChestCounts と同一 (鮮度は ct 優先・contents 観測済み・個数>0)。
// 適格が無ければ null (=距離 UNKNOWN、0 に潰さない)。中心寄せは実行部と同式。
export function eligibleChestDist(containers, item, selfPos, opts = {}) {
  if (!selfPos || !isNum(selfPos.x) || !isNum(selfPos.y) || !isNum(selfPos.z)) return null;
  const now = isNum(opts?.now) ? opts.now : Date.now();
  const freshMs = isNum(opts?.freshMs) ? opts.freshMs : CHEST_FRESH_MS;
  let best = null;
  for (const rec of containers ?? []) {
    if (!rec || typeof rec !== "object") continue;
    const stamp = isNum(rec.ct) ? rec.ct : rec.t;
    if (!isNum(stamp) || now - stamp > freshMs) continue;
    if (opts?.excludeFull && rec.full) continue;
    const contents = rec.contents ?? rec.items;
    if (!contents || typeof contents !== "object") continue;
    const n = contents[item];
    if (!Number.isInteger(n) || n <= 0) continue; // R-05: aggregate と適格条件を同一に保つ
    if (!isNum(rec.x) || !isNum(rec.y) || !isNum(rec.z)) continue;
    const d = Math.hypot(rec.x + 0.5 - selfPos.x, rec.y + 0.5 - selfPos.y, rec.z + 0.5 - selfPos.z);
    if (best === null || d < best) best = d;
  }
  return best;
}
// ---------- NQ-03 ステップ1〜2 (v0.4.37): 保持者別距離と別名割当 ----------
// holderDist: eligibleChestDist の距離式 (中心寄せ +0.5, Math.hypot) を保持者
// 1件に対して読む純粋関数。適格判定は入れない (呼び出し側の責務)。
// 測れない文脈では null (=距離 UNKNOWN、0 に潰さない)。
export function holderDist(holder, selfPos) {
  if (!selfPos || !isNum(selfPos.x) || !isNum(selfPos.y) || !isNum(selfPos.z)) return null;
  if (!holder || !isNum(holder.x) || !isNum(holder.y) || !isNum(holder.z)) return null;
  return Math.hypot(holder.x + 0.5 - selfPos.x, holder.y + 0.5 - selfPos.y, holder.z + 0.5 - selfPos.z);
}

export const HOLDER_MAX = 8; // 設計 §2.2 の H_MAX 初期値 (単一の正はここ)
const isPosInt = (v) => typeof v === "number" && Number.isInteger(v) && v > 0;
function holderSpatialKey(h) {
  return [String(h?.dim ?? ""), isNum(h?.x) ? h.x : 0, isNum(h?.y) ? h.y : 0, isNum(h?.z) ? h.z : 0];
}
function cmpHolderSpatial(a, b) {
  const ka = holderSpatialKey(a), kb = holderSpatialKey(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

/**
 * assignHolders(perHolder, item, opts?) -> { holders, truncated, dimMixed }
 * 設計 cycle1301-nq03 §3.2 + R-04 改訂規則 (cycle1724-a07) 適用形。
 * opts: { hMax = HOLDER_MAX, selfPos = null, selfDim = null }
 * - 適格: 対象 item の個数が正整数 (R-05) かつ数値座標を持つ保持者のみ。
 *   同一 (dim,x,y,z) は先勝ちで畳む (畳みは truncated に混ぜない)。
 * - 距離は自己次元と同一次元の保持者についてのみ定義する。次元不一致・
 *   座標欠落・自己位置不明は null。自己次元不明で複数次元が混在する場合は
 *   距離選択を行わない (dimMixed:true を返す)。
 * - 打ち切り時の選択: dist が引けた保持者を (dist 昇順, count 降順, 空間順)
 *   で優先し、dist 不明は残り枠を空間順で埋める。打ち切り後の maxSingle が
 *   打ち切り前と等しくなるよう、最大個数保持者が漏れたら末尾と入れ替える。
 * - 別名は選択後の集合へ空間順で付け直す (別名順は優先順位を意味しない)。
 * - 発動判定 (設計 §2.4) は呼び出し側が打ち切り後の holders で行うこと (R04-3)。
 * 純粋・例外安全・入力不変。読み手はまだ無く、ステップ3で配線する。
 */
export function assignHolders(perHolder, item, opts = {}) {
  if (!Array.isArray(perHolder) || typeof item !== "string" || item === "") {
    return { holders: [], truncated: 0, dimMixed: false };
  }
  const hMax = isPosInt(opts?.hMax) ? opts.hMax : HOLDER_MAX;
  const selfPos = opts?.selfPos ?? null;
  const selfDim = typeof opts?.selfDim === "string" ? opts.selfDim : null;
  const eligible = [];
  const seenCoord = new Set();
  for (const h of perHolder) {
    const n = h?.counts?.[item];
    if (!isPosInt(n)) continue;
    if (!isNum(h?.x) || !isNum(h?.y) || !isNum(h?.z)) continue;
    const key = `${String(h?.dim ?? "")}|${h.x}|${h.y}|${h.z}`;
    if (seenCoord.has(key)) continue;
    seenCoord.add(key);
    eligible.push(h);
  }
  eligible.sort(cmpHolderSpatial);
  const dims = new Set(eligible.map((h) => String(h?.dim ?? "")));
  const dimMixed = dims.size > 1;
  const distOf = (h) => {
    if (selfDim !== null && String(h?.dim ?? "") !== selfDim) return null;
    if (selfDim === null && dimMixed) return null;
    return holderDist(h, selfPos);
  };
  let kept = eligible;
  let truncated = 0;
  if (eligible.length > hMax) {
    truncated = eligible.length - hMax;
    const withDist = eligible.map((h) => ({ h, d: distOf(h) }));
    const known = withDist.filter((e) => isNum(e.d))
      .sort((a, b) => (a.d - b.d) || ((b.h.counts[item] ?? 0) - (a.h.counts[item] ?? 0)) || cmpHolderSpatial(a.h, b.h));
    const unknown = withDist.filter((e) => !isNum(e.d)).map((e) => e.h);
    kept = [...known.map((e) => e.h), ...unknown].slice(0, hMax);
    // maxSingle 保存: 打ち切り後の最大個数が打ち切り前より下がる場合だけ、
    // 最大個数保持者 (空間順で最初のもの) を最小個数の保持者と入れ替える。
    // 同点最大が既に残っている場合は値が保存されているため入れ替えない。
    const maxCount = Math.max(...eligible.map((h) => h.counts[item] ?? 0));
    if (!kept.some((h) => (h.counts[item] ?? 0) >= maxCount)) {
      const maxH = eligible.find((h) => (h.counts[item] ?? 0) === maxCount);
      let minIdx = 0;
      for (let i = 1; i < kept.length; i++) if ((kept[i].counts[item] ?? 0) <= (kept[minIdx].counts[item] ?? 0)) minIdx = i;
      if (maxH) kept[minIdx] = maxH;
    }
  }
  const holders = [...kept].sort(cmpHolderSpatial).map((h, i) => ({
    alias: `h${i}`, dim: h.dim ?? null, x: h.x, y: h.y, z: h.z,
    count: h.counts[item], dist: distOf(h),
  }));
  return { holders, truncated, dimMixed };
}

// 距離マップ組み立て: 供給できる文脈 (selfPos 既知 + containers 配列あり) のときだけ返す。
// それ以外は null (= dist を渡さず従来定数。距離が引けない文脈を UNKNOWN で潰さないための限定)
export function buildDistsByItem(input, items) {
  const selfPos = input?.selfPos ?? null;
  if (!selfPos || !Array.isArray(input?.containers)) return null;
  const dists = Object.create(null), unknownReasons = []; // cycle1844 N1: 値がオブジェクトのため __proto__ 代入で dists 自身のプロトタイプが差し替わる欠陥を防ぐ
  for (const it of items ?? []) {
    const w = eligibleChestDist(input.containers, it, selfPos, { now: input?.now, freshMs: input?.freshMs, excludeFull: input?.excludeFullContainers });
    const d = { withdraw: w, gather: it === input?.target ? (input?.sourceDist ?? null) : null,
      pickup: it === input?.target ? (input?.dropDist ?? null) : null, receive: input?.ownerDist ?? null };
    for (const [k, v] of Object.entries(d)) if (v === null) unknownReasons.push(`cost_distance_unknown:${k}:${it}`);
    dists[it] = d;
  }
  return { dists: { ...dists }, unknownReasons }; // cycle1844 N1: 境界では通常オブジェクトへ戻す (spread は own __proto__ を保持する)
}

// ---------- コア state 構築 ----------
/**
 * buildGoapState(input) -> { state, meta }
 * input: {
 *   target, have?, items?, invKnown?,
 *   sourceStatus?: "present"|"absent"|"unknown",
 *   chestCounts?,                 // aggregateChestCounts().counts（実測合算のみ）
 *   holderCounts?,                // { "h<n>": {itemId: 個数} } 保持者別実測（任意、NQ-03 §3.3）
 *   dropCounts?, ownerCounts?, ownerNear?,
 *   stations?,                    // { itemId: boolean } 既知分だけ
 *   closureItems?,                // 問い合わせ集合（省略時は target のみ）
 * }
 * meta.factStatus: { fact名: {status:"known", value} | {status:"unknown", reason} }
 */
export function buildGoapState(input = {}) {
  const state = {};
  const meta = { factStatus: {}, unknownReasons: [], omitted: [] };
  const markKnown = (fact, value) => { meta.factStatus[fact] = { status: "known", value }; };
  const markUnknown = (fact, reason) => {
    meta.factStatus[fact] = { status: "unknown", reason };
    meta.omitted.push(fact); meta.unknownReasons.push(reason);
  };
  const target = input?.target;
  const universe = [...new Set([target, ...(input?.closureItems ?? [])]
    .filter(x => typeof x === "string" && x))];

  // inv: 閉世界が成立するときだけ
  if (input?.invKnown === true) {
    const items = input?.items ?? {};
    for (const it of universe) {
      // own 判定で読む: universe に特殊キーが来ても継承値 (constructor 等) を
      // known fact にしない (cycle1755-a22 R1 是正, SMELT 候補追加と同一変更)。
      let v = hasOwn(items, it) && isNum(items[it]) ? items[it] : 0;
      if (it === target && isLog(target) && isNum(input?.have)) v = input.have; // 原木は合算進捗が定義
      else if (it === target && !isLog(target) && isNum(input?.have)) v = input.have;
      state[`inv.${it}`] = v; markKnown(`inv.${it}`, v);
    }
  } else for (const it of universe) markUnknown(`inv.${it}`, "inv_unknown");

  // near source
  if (typeof target === "string") {
    const f = `near.${target}_source`;
    if (input?.sourceStatus === "present") { state[f] = 1; markKnown(f, 1); }
    else if (input?.sourceStatus === "absent") { state[f] = 0; markKnown(f, 0); }
    else markUnknown(f, "source_unknown");
  }
  // chest: 実測合算がある item だけ (GP-06, v0.4.16: target のみから universe
  // 全件へ拡大。中間材料の WITHDRAW 前提が構造的に満たせなかった欠落の是正)。
  // 合算に無い item は 0 に潰さず UNKNOWN のままにする。
  for (const it of universe) {
    const cf = `chest.${it}`;
    if (input?.chestCounts && isNum(input.chestCounts[it])) {
      state[cf] = input.chestCounts[it]; markKnown(cf, state[cf]);
    } else markUnknown(cf, "chest_count_unknown");
  }
  // chest@h<n>: 保持者別実測 (NQ-03 §3.3、v0.4.37、追加のみ)。holderCounts が
  // 渡されなければ無動作で戻り値は従来と完全一致する。値がある保持者×item の
  // 組だけ fact を置き、組が無い場合は fact も unknown 登録もしない
  // (三状態は合算 chest.<it> 側で既に表現されている)。適格は R-05 と同一。
  const holderCountsIn = input?.holderCounts;
  if (holderCountsIn && typeof holderCountsIn === "object") {
    for (const alias of Object.keys(holderCountsIn).sort()) {
      if (!/^h\d+$/.test(alias)) continue;
      const perItem = holderCountsIn[alias];
      if (!perItem || typeof perItem !== "object") continue;
      for (const it of universe) {
        const n = perItem[it];
        if (!Number.isInteger(n) || n <= 0) continue;
        const hf = `chest@${alias}.${it}`;
        state[hf] = n; markKnown(hf, n);
      }
    }
  }
  // fuel.burn: 在庫の閉世界が成立し items が実在するときだけ集約値を出す。
  // それ以外は UNKNOWN (燃料なし確定と混同しない)。
  if (input?.invKnown === true && input?.itemsPresent !== false) {
    const burn = fuelBurnFromItems(input?.items ?? {});
    if (isNum(burn)) { state["fuel.burn"] = burn; markKnown("fuel.burn", burn); }
    else markUnknown("fuel.burn", "fuel_count_invalid");
  } else markUnknown("fuel.burn", "fuel_unknown");
  // drop / owner: 実測マップが渡された item だけ
  for (const [prefix, m] of [["drop", input?.dropCounts], ["owner_has", input?.ownerCounts]]) {
    if (!m) continue;
    for (const it of universe) if (isNum(m[it])) { state[`${prefix}.${it}`] = m[it]; markKnown(`${prefix}.${it}`, m[it]); }
  }
  if (typeof input?.ownerNear === "boolean") { state.owner_near = input.ownerNear; markKnown("owner_near", input.ownerNear); }
  else markUnknown("owner_near", "owner_near_unknown");
  // station: 既知分だけ
  for (const [item, v] of Object.entries(input?.stations ?? {}))
    if (typeof v === "boolean") { state[`station.${item}`] = v; markKnown(`station.${item}`, v); }
  return { state, meta };
}

// ---------- 改良1+5: ctx アダプタ ----------
/**
 * ctxToStateInput(ctx, opts) -> buildGoapState への input（消化済み形）
 * 実 ctx の読み取りは全て optional chaining。ctx が null/欠落でも例外なし。
 * opts: { target, have?, sourceStatus?, chestCounts?, dropCounts?,
 *         ownerCounts?, ownerNear?, closureItems? }
 * - invKnown は c.x.obs.inv === "ok" のときだけ true。obs が無い旧形では
 *   c.x.invOk === true のときだけ true（どちらも無ければ UNKNOWN 側）。
 * - station は c.x.obs.perc が "unknown" の間は採用しない。
 *   nearCraft -> crafting_table / nearFurnace -> furnace。
 */
export function ctxToStateInput(ctx, opts = {}) {
  const x = ctx?.x ?? {};
  const obs = x?.obs ?? null;
  const invKnown = obs ? obs.inv === "ok" : x?.invOk === true;
  const percKnown = obs ? obs.perc !== "unknown" : true;
  const stations = {};
  if (percKnown) {
    if (typeof x?.nearCraft === "boolean") stations[STATION_ITEM.table] = x.nearCraft;
    if (typeof x?.nearFurnace === "boolean") stations[STATION_ITEM.furnace] = x.nearFurnace;
    for (const [item, v] of Object.entries(opts?.stations ?? {}))
      if (typeof v === "boolean") stations[item] = v;
  }
  return {
    target: opts?.target,
    have: opts?.have,
    items: (x?.items && typeof x.items === "object") ? x.items : {},
    itemsPresent: !!(x?.items && typeof x.items === "object"),
    invKnown,
    sourceStatus: opts?.sourceStatus,
    chestCounts: opts?.chestCounts,
    dropCounts: opts?.dropCounts,
    ownerCounts: opts?.ownerCounts,
    ownerNear: opts?.ownerNear,
    stations,
    closureItems: opts?.closureItems,
    // 傍系（planner は読まない）: 最寄り既知チェストまでの距離が測れているか
    knownChestDist: isNum(x?.knownChestDist) ? x.knownChestDist : null,
    // NQ-01 P1 (v0.4.18): 実距離の供給源 (追加のみ)。selfPos は有限な xyz のときだけ、
    // ownerDist は主人不在の番兵 (999 等の異常大値) を UNKNOWN として落とす
    selfPos: (x?.selfPos && isNum(x.selfPos.x) && isNum(x.selfPos.y) && isNum(x.selfPos.z)) ? { x: x.selfPos.x, y: x.selfPos.y, z: x.selfPos.z } : null,
    ownerDist: (isNum(ctx?.self?.distOwner) && ctx.self.distOwner >= 0 && ctx.self.distOwner < 900) ? ctx.self.distOwner : null,
    sourceDist: isNum(opts?.sourceDist) && opts.sourceDist >= 0 ? opts.sourceDist : null,
    dropDist: isNum(opts?.dropDist) && opts.dropDist >= 0 ? opts.dropDist : null,
  };
}

export function buildStateFromCtx(ctx, opts = {}) {
  const input = ctxToStateInput(ctx, opts);
  const r = buildGoapState(input);
  r.meta.knownChestDist = input.knownChestDist;
  return r;
}

// ---------- actions 構築（a13 と同仕様: sourcing + CRAFT 閉包 + PLACE、id 重複なし） ----------
export function buildActions(target, need, recipes, closure, distsByItem = null, holderPack = null, smeltCtx = null) {
  const acts = [], seen = new Set();
  const push = (...list) => { for (const a of list) if (a?.id && !seen.has(a.id)) { seen.add(a.id); acts.push(a); } };
  const amount = Math.max(1, need || 1);
  let holderDropped = 0;
  for (const it of closure?.items ?? [target]) {
    const hp = holderPack?.[it] ?? null;
    if (!hp) { push(...(distsByItem ? sourcingActions(it, amount, { dist: distsByItem[it] ?? {} }) : sourcingActions(it, amount))); continue; }
    let list = distsByItem ? sourcingActions(it, amount, { dist: distsByItem[it] ?? {}, holders: hp.holders }) : sourcingActions(it, amount, { holders: hp.holders });
    // R-07 (v0.4.38): itemあたり変種総数上限36の所有者はここ buildActions 1か所。
    // 生成関数 (holderWithdrawActions) は上限を知らず候補を全て返す。絞り込みは
    // (a) 全量チャンク min(A,D) を保護 -> (b) 距離昇順 -> (c) 別名順・k降順。
    const variants = list.filter(a => typeof a?.id === "string" && a.id.includes("@h"));
    if (variants.length > 36) {
      const D = Math.max(1, hp.demand || amount);
      const byAlias = new Map((hp.holders ?? []).map(h => [h.alias, h]));
      const keyOf = (a) => {
        const m = /@h(\d+)#(\d+)$/.exec(a.id);
        const alias = m ? `h${m[1]}` : "", k = m ? Number(m[2]) : 0;
        const full = byAlias.get(alias) && k === Math.min(byAlias.get(alias).count, D) ? 0 : 1;
        return [full, typeof a.cost?.distance === "number" ? a.cost.distance : Infinity, alias, -k];
      };
      const sorted = [...variants].sort((x, y) => {
        const kx = keyOf(x), ky = keyOf(y);
        for (let i = 0; i < kx.length; i++) { if (kx[i] < ky[i]) return -1; if (kx[i] > ky[i]) return 1; }
        return 0;
      });
      const keep = new Set(sorted.slice(0, 36).map(a => a.id));
      holderDropped += variants.length - 36;
      list = list.filter(a => !variants.includes(a) || keep.has(a.id));
    }
    push(...list);
  }
  if (holderDropped > 0) acts.holderVariantsDropped = holderDropped;
  for (const [outId, r] of closure?.recipesUsed ?? []) {
    const gr = toGoapRecipe(outId, r);
    // kind 振り分け (v0.4.16): smelt は燃料述語つき SMELT へ置換する。
    // 追加でなく置換であること (燃料不要の偽 CRAFT を残すと SMELT が死ぬ)。
    // SMELT L1 (v0.4.39): smeltCtx が供給された局面では燃料別変種 (L1) と
    // 集約 (L3) を buildSmeltActions で生成する (抑制規則込み)。smeltCtx が
    // 無い直接呼び出しは従来の L3 のみへ縮退する (後方互換)。
    if (gr.kind === "smelt") {
      if (smeltCtx) {
        const built = buildSmeltActions(gr, smeltCtx);
        push(...built.variants);
        if (built.aggregate) push(built.aggregate);
      } else push(smeltAction(gr));
    } else push(craftAction(gr));
  }
  const stationItems = new Set();
  for (const r of (closure?.recipesUsed ?? new Map()).values()) {
    const si = r?.station && r.station !== "hand" ? STATION_ITEM[r.station] : null;
    if (si) stationItems.add(si);
  }
  for (const si of stationItems) push(placeStationAction(si));
  return acts;
}

// ---------- 統合入口 ----------
/**
 * buildEvaluation(input) -> { state, goal, actions, meta }
 * input は buildGoapState の入力 + { need, recipes, containers?, now?, freshMs?, excludeFullContainers? }
 * containers を渡すと aggregateChestCounts で chestCounts を自動導出する
 * （明示 chestCounts があればそちらを優先）。
 */
export function buildEvaluation(input = {}) {
  const target = input?.target;
  const need = Math.max(1, input?.need || 1);
  const lack = Math.max(1, need - (isNum(input?.have) ? input.have : 0));
  let chestCounts = input?.chestCounts, chestMeta = null, aggPerHolder = null;
  if (Array.isArray(input?.containers)) {
    const agg = aggregateChestCounts(input.containers,
      { now: input?.now, freshMs: input?.freshMs, excludeFull: input?.excludeFullContainers });
    aggPerHolder = agg.perHolder;
    if (!chestCounts) {
      chestCounts = agg.counts;
      // G1 (cycle1724-a22): meta.chest は従来5フィールドに固定する。perHolder を
      // そのまま載せると P3 材料の深複写経由で lastPlan.snap へ漏れ、ステップ1の
      // 「挙動不変」が崩れる。perHolder の正は aggregateChestCounts の戻り値側。
      chestMeta = { counts: agg.counts, observed: agg.observed, unobserved: agg.unobserved, stale: agg.stale, fullSkipped: agg.fullSkipped };
    }
  }
  // NQ-03 ステップ3 (v0.4.38, 設計 §3.5/§2.4 + a01 G5 + a20 W1/W4): 保持者モードの配線。
  // containers 経路では同一集計 (agg) の perHolder からだけ導出し、外部 holderCounts は
  // 内部生成で上書き遮断する。発動は対象 item のみ・暫定需要 D=lack で、条件は
  // 保持者2件以上 / Σ>=D / 全保持者<D / 保持者別距離が全件引ける / 合算==Σ (G5:
  // 座標なし保持者が合算にだけ入る場合は等式が崩れるため発動しない)。
  let holderCounts = (input?.holderCounts && typeof input.holderCounts === "object") ? input.holderCounts : undefined;
  let holderPack = null, holdersMeta = null, holdersTruncated = 0;
  if (aggPerHolder) {
    holderCounts = undefined;
    if (typeof target === "string" && target) {
      const asg = assignHolders(aggPerHolder, target, { selfPos: input?.selfPos ?? null });
      const hs = asg.holders;
      const sumH = hs.reduce((s, h) => s + h.count, 0);
      // G5 の等式は perHolder 完全性で判定する (a01案を MH-08 と両立するよう改訂):
      // 合算の全量が座標あり保持者から来ていること。打ち切り分は等式の対象外
      // (meta.holdersTruncated に記録され、台帳は調達量だけ両辺から減る)。
      const perHolderSum = aggPerHolder.reduce((s, h) => s + (Number.isInteger(h?.counts?.[target]) && h.counts[target] > 0 ? h.counts[target] : 0), 0);
      if (hs.length >= 2 && sumH >= lack && hs.every(h => h.count < lack)
          && hs.every(h => isNum(h.dist)) && isNum(chestCounts?.[target]) && chestCounts[target] === perHolderSum) {
        holderCounts = {};
        for (const h of hs) holderCounts[h.alias] = { [target]: h.count };
        holderPack = { [target]: { holders: hs, demand: lack } };
        holdersMeta = {};
        for (const h of hs) holdersMeta[h.alias] = { dim: h.dim, x: h.x, y: h.y, z: h.z, dist: h.dist };
        holdersTruncated = asg.truncated;
      }
    }
  } else if (holderCounts && typeof target === "string" && target) {
    // 明示 holderCounts (builder 単体経路): 呼び出し側の opt-in を保持者パックへ変換する。
    const hs = Object.keys(holderCounts).filter(a => /^h\d+$/.test(a)).sort()
      .map(a => ({ alias: a, count: holderCounts[a]?.[target], dist: null }))
      .filter(h => Number.isInteger(h.count) && h.count > 0);
    if (hs.length) holderPack = { [target]: { holders: hs, demand: lack } };
  }
  const closure = mergedClosure(target, input?.recipes ?? null);
  const stationItems = [...new Set([...closure.recipesUsed.values()]
    .map(r => r?.station && r.station !== "hand" ? STATION_ITEM[r.station] : null).filter(Boolean))];
  // SMELT L1 (v0.4.39): 閉包に smelt レシピがあるときだけ、第1級候補燃料の
  // itemId を universe へ同一変更で追加する (C4)。追加しないと変種 pre の
  // inv.<fuel> が factStatus に載らず恒常 unknown になる。集合の正は
  // fuelValueMap + FUEL_TIER1_SPEC からの導出1か所のみ (buildGoapState 側の
  // universe には追加しない: builder は recipes を入力契約に持たない)。
  const valueMap = fuelValueMap();
  const tier1Fuels = resolveVariantFuels(valueMap);
  const hasSmelt = [...closure.recipesUsed.values()].some(r => (r?.kind ?? "craft") === "smelt");
  const universeExtra = [...closure.items, ...stationItems, ...(isLog(target) ? LOG_IDS : []),
    ...(hasSmelt ? tier1Fuels : [])];
  const { state, meta } = buildGoapState({ ...input, chestCounts, holderCounts, closureItems: universeExtra });
  // SMELT L1 の候補材料: 既知性は構築後 factStatus から導出する (確定手順)。
  // knownItems = inv./chest./drop./owner_has. のいずれかが known かつ正値の item。
  // knownInv = 初期 inv. の個数 (案A′ (P) の出所はこれのみ。chest@h<n>. は
  // 候補根拠にも (P) の根拠にも含めない)。
  let smeltCtx = null;
  if (hasSmelt) {
    const knownItems = new Set();
    for (const it of universeExtra) {
      for (const p of ["inv", "chest", "drop", "owner_has"]) {
        const fs = meta.factStatus[`${p}.${it}`];
        if (fs?.status === "known" && isNum(fs.value) && fs.value > 0) { knownItems.add(it); break; }
      }
    }
    const knownInv = Object.create(null);
    if (input?.invKnown === true && input?.items && typeof input.items === "object") {
      for (const it of universeExtra) if (fuelInitiallyInInv(input.items, it)) knownInv[it] = input.items[it];
    }
    smeltCtx = { valueMap, tier1: tier1Fuels, knownItems: [...knownItems], closureItems: closure.items, goalItem: target, knownInv };
  }
  const distPack = buildDistsByItem(input, closure.items);
  const actions = buildActions(target, lack, input?.recipes, closure, distPack?.dists ?? null, holderPack, smeltCtx);
  if (holdersMeta) {
    meta.holders = holdersMeta; meta.holdersTruncated = holdersTruncated;
    meta.holderMode = { [target]: true };
  }
  if (typeof actions.holderVariantsDropped === "number" && actions.holderVariantsDropped > 0)
    meta.holderVariantsDropped = actions.holderVariantsDropped;
  meta.dists = distPack?.dists ?? null; meta.distUnknownReasons = distPack?.unknownReasons ?? [];
  meta.closure = closure.items; meta.cycles = closure.cycles; meta.truncated = closure.truncated;
  meta.chest = chestMeta;
  meta.stationStatus = {};
  for (const si of new Set(Object.values(STATION_ITEM))) {
    const k = `station.${si}`;
    meta.stationStatus[si] = k in state ? (state[k] ? "present" : "absent") : "unknown";
  }
  const goal = typeof target === "string" && target
    ? [{ fact: `inv.${target}`, op: ">=", value: need }] : [];
  return { state, goal, actions, meta };
}

/** ctx から直接の統合入口（main 影評価の差し替え単位） */
export function buildEvaluationFromCtx(ctx, opts = {}) {
  const input = ctxToStateInput(ctx, opts);
  const ev = buildEvaluation({ ...opts, ...input, target: opts?.target });
  ev.meta.knownChestDist = input.knownChestDist;
  return ev;
}

