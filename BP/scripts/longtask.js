// longtask.js — 長期自律タスクの計画器（純粋JS）
// 「ダイヤモンドブロックを集めて」のような最終目標を、
//   目標分解（decomposer: 葉＝採取、工程＝クラフト/精錬）
//   ＋ ツール技術ツリー（bootstrap: 素手→木→石→鉄→ダイヤ）
// を合成して「工程（leg）の列」に変換する。実行は main.js の tickLongTask が担い、
// 採取 leg は既存ミッション、工程 leg は crafting.js が実行する。
import { decompose } from "./decomposer.js";
import { planBootstrap, requiredLevelFor, TIERS, TIER_LEVEL, GROUPS, bestToolTierFromCounts, toolItemId } from "./bootstrap.js";
import { decideToolInvestment, timePerBlock } from "./tool_invest_math.js";

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

// cycle1940 案A': 板材 leg の跨層合体 (boot の group:planks craft と dec の *_planks craft が
// 両方ある場合だけ、dec 分の crafts を boot 側へ寄せ、dec 側の板材 craft とその原料分の
// 原木 gather を畳む)。逐次 replay (板材/原木のみ集計、bootstrap 設計B と同指標) で
// 不足ゼロかつ元より悪化しないことを確認できなければ元の legs をそのまま返す。
function replayPlankShortage(legs, invCounts) {
  const v = { ...(invCounts || {}) };
  const consume = (k, n) => {
    const ids = GROUPS[k] || [k];
    let left = n;
    for (const id of ids) { const t = Math.min(v[id] || 0, left); v[id] = (v[id] || 0) - t; left -= t; if (left <= 0) break; }
    return n - left;
  };
  const isPlankLog = (k) => k === "group:planks" || k === "group:logs" || /_planks$/.test(k) || /_log$/.test(k);
  let short = 0;
  for (const l of legs || []) {
    if (l.needs) for (const [k, n] of Object.entries(l.needs)) { const got = consume(k, n); if (got < n && isPlankLog(k)) short += n - got; }
    if (l.type === "gather" || l.type === "craft" || l.type === "smelt" || l.type === "hunt") {
      const id = GROUPS[l.item] ? GROUPS[l.item][0] : l.item;
      if (id) v[id] = (v[id] || 0) + (l.need || 0);
    }
  }
  return short;
}
export function normalizePlankLegs(legs, invCounts) {
  try {
    if (!Array.isArray(legs) || legs.length < 2) return legs;
    const bootIdx = legs.findIndex((l) => l.fromBootstrap && l.type === "craft" && l.item === "group:planks");
    const decPlankIdxs = [];
    legs.forEach((l, i) => { if (!l.fromBootstrap && l.type === "craft" && /_planks$/.test(l.item || "")) decPlankIdxs.push(i); });
    if (bootIdx < 0 || decPlankIdxs.length === 0) return legs;
    let decCrafts = 0, decLogs = 0;
    for (const i of decPlankIdxs) {
      const dp = legs[i];
      const c = dp.crafts || Math.ceil((dp.need || 0) / 4);
      decCrafts += c;
      let lg = 0;
      if (dp.needs) for (const [k, n] of Object.entries(dp.needs)) if (k === "group:logs" || /_log$/.test(k)) lg += n;
      decLogs += lg > 0 ? lg : c;
    }
    if (decCrafts <= 0 || decLogs <= 0) return legs;
    const work = legs.map((l) => ({ ...l, needs: l.needs ? { ...l.needs } : l.needs }));
    const bp = work[bootIdx];
    const decPlankCopies = new Set(decPlankIdxs.map((i) => work[i]));
    bp.crafts = (bp.crafts || Math.ceil((bp.need || 0) / 4)) + decCrafts;
    bp.need = bp.crafts * 4;
    bp.needs = { ...(bp.needs || {}), "group:logs": bp.crafts };
    const bootLog = work.find((l) => l.fromBootstrap && l.type === "gather" && l.item === "group:logs");
    if (bootLog) bootLog.need = (bootLog.need || 0) + decLogs;
    else work.splice(bootIdx, 0, { type: "gather", item: "group:logs", need: decLogs, crafts: 0, needs: null, via: "minecraft:oak_log", yRange: null, depth: null, station: null, fromBootstrap: true, dim: null });
    const decLog = work.find((l) => !l.fromBootstrap && l.type === "gather" && /_log$/.test(l.item || ""));
    if (decLog) decLog.need = (decLog.need || 0) - decLogs;
    const out = work.filter((l) => !decPlankCopies.has(l) && !(decLog && l === decLog && (decLog.need || 0) <= 0));
    if (replayPlankShortage(out, invCounts) > 0) return legs;
    if (replayPlankShortage(out, invCounts) > replayPlankShortage(legs, invCounts)) return legs;
    return out;
  } catch { return legs; }
}

// ===== 0-J 道具投資アダプタ (cyc2364 統合、cyc2347 §5-2/§5-3) =====
// 判断ロジックは置かず、純粋核 decideToolInvestment への入力供給に限定する。
// BASE_TIME は候補間比較のための抽象単位 (実測源はコード内に無い。絶対値ではなく比較が目的)。
const INVEST_BASE_TIME = 60;
export function toInvestTier(bootstrapTier) {
  if (bootstrapTier === "wood") return "wooden";
  if (bootstrapTier === "stone" || bootstrapTier === "iron" || bootstrapTier === "diamond" || bootstrapTier === "netherite") return bootstrapTier;
  return null; // golden/未知は核の速度表に無いため変換しない (既知制限)
}
export function fromInvestTier(tier) {
  if (tier === "wooden") return "wood";
  if (tier === "stone" || tier === "iron" || tier === "diamond") return tier;
  return null;
}
// 主道具種: dec.steps の採取/討伐葉の need 合計が最大の種。sword は第1段では候補生成から外す。
export function investKindFor(dec) {
  try {
    const totals = {};
    for (const s of (dec?.steps || [])) {
      if (s.type !== "gather" && s.type !== "hunt") continue;
      const key = `${s.item || ""} ${s.via || ""}`;
      let kind = null;
      if (s.type === "hunt") kind = "sword";
      else if (/_log|_wood|_stem/.test(key)) kind = "axe";
      else if (/_ore|stone|cobble|deepslate|netherrack|raw_|diamond|obsidian/.test(key) || (requiredLevelFor(s.item) || 0) > 0) kind = "pickaxe";
      else if (/dirt|sand|gravel|clay|snow/.test(key)) kind = "shovel";
      if (kind) totals[kind] = (totals[kind] || 0) + (s.need || 1);
    }
    let best = null, bestN = 0;
    for (const [k, n] of Object.entries(totals)) if (n > bestN) { best = k; bestN = n; }
    if (!best || best === "sword") return null;
    return best;
  } catch { return null; }
}
function investRemainingBlocks(dec, order) {
  try {
    let sum = 0;
    for (const s of (dec?.steps || [])) if (s.type === "gather" || s.type === "hunt") sum += (s.need || 1);
    return sum > 0 ? sum : Math.max(1, Math.floor(order?.amount || 1));
  } catch { return Math.max(1, Math.floor(order?.amount || 1)); }
}
// 候補1件の投資コストを planBootstrap の probe 実行から積算する (汚染なし investTier 経由)。
export function probeInvestCost(candTier, kind, invCounts, invDurability, currentBootTier) {
  try {
    const probe = planBootstrap({ invCounts: invCounts || {}, invDurability: invDurability || {}, goal: { tools: [kind], investTier: candTier, amount: 1 } });
    if (!probe || !Array.isArray(probe.steps) || !probe.steps.length) return null;
    if (!(probe.toolsNeeded || []).some((t) => t.kind === kind)) return null; // probe 汚染ガード: 対象 kind 以外はコスト化しない
    let avail = currentBootTier || null;
    let cost = 0;
    for (const s of probe.steps) {
      if (s.type === "gather") {
        const t = timePerBlock({ baseTime: INVEST_BASE_TIME, tier: toInvestTier(avail) || "none", toolClass: kind, effectiveClass: kind });
        cost += (s.count || 1) * (t == null ? INVEST_BASE_TIME : t);
      } else if (s.type === "craft") {
        cost += 6 * (s.crafts || 1);
        const m = /^(?:minecraft:)?(wooden|stone|iron|diamond)_(axe|pickaxe|shovel|sword)$/.exec(s.item || "");
        if (m) { const bt = m[1] === "wooden" ? "wood" : m[1]; if (!avail || (TIER_LEVEL[bt] || 0) > (TIER_LEVEL[avail] || 0)) avail = bt; }
      } else if (s.type === "smelt") {
        cost += 6 + 200 * (s.count || 1);
      }
    }
    return cost;
  } catch { return null; }
}
// アダプタ本体: 戻り値は核の判定結果そのまま。判定不能なら null (呼び出し側は investTier を渡さない従来形へ)。
export function decideLongtaskInvestment(dec, order, invCounts, invDurability, reqLevel) {
  try {
    const kind = investKindFor(dec);
    if (!kind) return null;
    const bestBoot = bestToolTierFromCounts(invCounts || {}, kind, "wood");
    const curMathTier = bestBoot === "netherite" ? "netherite" : toInvestTier(bestBoot);
    const curLevel = bestBoot === "netherite" ? 5 : (bestBoot ? (TIER_LEVEL[bestBoot] || 0) : 0);
    const current = curMathTier ? { tier: curMathTier, toolClass: kind } : null;
    const candidates = [];
    for (const t of TIERS) {
      if ((TIER_LEVEL[t] || 0) < (reqLevel || 0)) continue;
      if ((TIER_LEVEL[t] || 0) <= curLevel) continue;
      const c = probeInvestCost(t, kind, invCounts, invDurability, bestBoot);
      if (c == null) continue;
      candidates.push({ tier: toInvestTier(t), toolClass: kind, itemId: toolItemId(t, kind), investCost: c });
    }
    if (!candidates.length && !current) return null;
    return decideToolInvestment({ remaining: investRemainingBlocks(dec, order), baseTime: INVEST_BASE_TIME, effectiveClass: kind, current, candidates });
  } catch { return null; }
}

// 注文 → 長期タスク計画。工程が無い純採取なら null（通常ミッションで足りる）。
// 分解不能なら { feasible:false, warnings } を返す。
export function planLongTask(order, invCounts, invDurability) { // cycle2311: 第3引数 invDurability を planBootstrap へ中継 (従来は供給者が無く耐久予備が発動しなかった)
  const target = order?.target;
  const amount = Math.max(1, Math.floor(order?.amount || 1));
  if (!target) return null;
  // Phase5 forbidden Slice2 中継: order.constraints.forbiddenTargets を Slice 1
  // (mission.js) と同一作法で正規化し、decomposer の葉ゲートへ渡す。
  const forbiddenTargets = Array.isArray(order?.constraints?.forbiddenTargets) ? [...new Set(order.constraints.forbiddenTargets.filter((x) => typeof x === "string" && x).map((x) => (x.includes(":") ? x : `minecraft:${x}`)))] : []; // forbids G4 (cycle0505): コメントどおり正規化する防御是正
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

  // 0-J: 道具投資判断 (アダプタ)。例外・判定不能時は investTier を渡さない従来形へフォールバック。
  let inv = null;
  try { inv = decideLongtaskInvestment(dec, order, invCounts || {}, invDurability || {}, reqLevel); } catch { inv = null; }
  const investTierArg = inv ? (inv.invest && inv.candidate ? fromInvestTier(inv.candidate.tier) : null) : undefined;

  let boot = null;
  try { boot = planBootstrap({ invCounts: invCounts || {}, invDurability: invDurability || {}, goal: { targetItem: dec.target.item, ...(reqTier ? { targetTier: reqTier } : {}), ...(investTierArg !== undefined ? { investTier: investTierArg } : {}), activity: "gather", amount } }); } catch { boot = null; } // cycle2311: amount も中継 (消費見積もり・数量予備が従来は届いていなかった)

  const legs = [];
  if (boot && boot.status !== "ready" && Array.isArray(boot.steps)) for (const s of boot.steps) legs.push(normalizeBootStep(s));
  for (const s of dec.steps) legs.push(normalizeDecStep(s));

  // cycle1940 案A': 板材 leg の跨層合体 (判定より前に置く — 正規化後の legs で判定する)
  const finalLegs = normalizePlankLegs(legs, invCounts || {});

  // 長期タスクにする条件：工程がある／ツール自作が要る／地下へ掘り進む採取がある。
  // どれも無い純粋な地表採取だけ通常ミッションに任せる。
  const hasProcess = finalLegs.some((l) => l.type === "craft" || l.type === "smelt");
  const hasBoot = boot && boot.status !== "ready" && Array.isArray(boot.steps) && boot.steps.length > 0;
  const hasMine = finalLegs.some((l) => l.depth != null);
  if (!hasProcess && !hasBoot && !hasMine) return null;
  return { feasible: true, target: dec.target, legs: finalLegs, warnings: dec.warnings || [], totals: dec.totals || null };
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
