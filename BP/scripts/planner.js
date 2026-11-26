// リゼ (LIZE-07) 自律プランナー — 目標選択層（ユーティリティ方式）
// 純粋JS。@minecraft/server には依存しない。統合時は BP/scripts/ へコピーして使う想定。
//
// 位置づけ（二層構造）:
//   上: 反応層（brain/all.js の意思決定表1,300件超）… 安全・ケア等の即時反応。常に優先。
//   下: 本プランナー … 反応層が「暇」と判断したとき（おまかせ/作業モード等）に、
//       リゼ自身が「次に何をするか」を効用最大化で選ぶ層。
// 反応層が危険を検知している文脈では、ここも guard/rest 系に寄るが、
// 最終的な割り込み判断は反応層が握る（planner.md 参照）。
//
// ctx: BP/scripts/main.js の buildContext が作る文脈と同形 + 知覚v2（ctx.x 内を想定。
//      ctx.perception / ctx 直下に置かれた場合も拾う）。無いフィールドは既定値で安全に動く。
//   知覚v2: nearestTreeDist / nearestOreDist / nearestStoneDist / cropReadyDist
//           （距離系は「なし = -1」が drops 系の既存規約）
//           lightLevel（0-15、無ければ昼15扱い）/ indoor / selfPos {x,y,z}
//           woodCount / stoneCount / torchCount / oreValuable / currentChunk
// mem: { visitedChunks: [], knownContainers: [], dangerSpots: [{x,z,r?}],
//        lastGoal: string|null, goalSince: number(ms epoch), now?: number }
//        now があればそれを現在時刻として使う（テスト再現性のため）。

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, fb) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
const distScore = (d, range) => (d < 0 ? 0 : clamp(1 - d / range, 0, 1)); // 近いほど高い

// 知覚v2フィールドの取得（x → perception → 直下の順に探す）
function per(ctx, key, fb) {
  const v = ctx?.x?.[key] ?? ctx?.perception?.[key] ?? ctx?.[key];
  return v === undefined || v === null ? fb : v;
}

// Phase1 読み手移行: obs 三状態の解釈（obs 無しは従来解釈）
function obsOf(c) { return c?.x?.obs ?? c?.perception?.obs ?? c?.obs ?? null; }
function scanKnown(c) { const o = obsOf(c); if (!o) return c?.x?.scanOk !== false; return o.scan === "ok"; }
function percKnown(c) { const o = obsOf(c); if (!o) return true; const p = o.perc; if (p === undefined || p === null) return true; if (typeof p === "string") return p === "ok"; if (p.state === "unavailable") return false; const f = p.failedCells, t = p.totalCells; if (typeof f === "number" && typeof t === "number" && t > 0 && f * 2 > t) return false; return true; }
function percDist(c, key) { return percKnown(c) ? per(c, key, undefined) : undefined; }

// ---------- 各目標の効用関数 ----------
// 返り値は概ね 0..1。強い必然性があるものだけ 1 を超える。

function uFollowOwner(c) {
  if (!c.owner?.present) return 0;
  const d = num(c.self?.distOwner, 999);
  if (d <= 3) return 0.05; // もう隣にいる。付いていく必要はない
  let u = 0.3 + 0.35 * clamp((d - 3) / 25, 0, 1);
  if (c.owner?.sprinting || c.x?.fastMove) u += 0.08; // 置いていかれないように
  if (!c.owner?.dimensionSame) u += 0.25; // 次元が違うなら合流が先
  return u;
}

function uGuardOwner(c) {
  const n = num(c.danger?.count, 0);
  if (n <= 0) return scanKnown(c) ? 0.02 : 0.30; // 走査失敗時の番兵0を「敵なし」と読まない
  let u = 0.55 + 0.1 * Math.min(n, 3);
  const nd = num(c.danger?.nearestDist, 999);
  if (nd < 8) u += 0.2;
  if (num(c.danger?.creeperDist, 999) < 10) u += 0.12;
  if (c.danger?.ownerTargeted) u += 0.1;
  if ((c.owner?.hpPct ?? 1) < 0.5) u += 0.1; // 主人が弱っているなら盾になる
  return u;
}

function uGatherWood(c) {
  const _rawTree = percDist(c, "nearestTreeDist"); if (_rawTree === undefined) return 0;
  const d = num(_rawTree, -1);
  if (d < 0) return 0;
  if (c.inv?.full) return 0;
  let u = 0.34 + 0.26 * distScore(d, 32);
  const wood = num(per(c, "woodCount", 0), 0);
  if (wood < 8) u += 0.2; else if (wood < 32) u += 0.08;
  if (per(c, "dimension", "overworld") !== "overworld") u *= 0.4; // ネザー等では木が貴重だが危険も増す
  if (c.env?.isNight) u *= 0.7;
  return u;
}

function uGatherStone(c) {
  if (c.inv?.full) return 0;
  const stone = num(per(c, "stoneCount", 0), 0);
  const _rawStone = percDist(c, "nearestStoneDist");
  const dStone = _rawStone === undefined ? -1 : num(_rawStone, -1);
  let u = 0;
  if (dStone >= 0) u = 0.3 + 0.22 * distScore(dStone, 24);
  else if (c.owner?.underground) u = 0.38; // 地下にいるならその場で掘れる
  else return 0;
  if (stone < 16) u += 0.18; else if (stone < 64) u += 0.06;
  return u;
}

function uMineOre(c) {
  const _rawOre = percDist(c, "nearestOreDist"); if (_rawOre === undefined) return 0.03;
  const d = num(_rawOre, -1);
  if (d < 0) return 0.03; // 見えていない。探すのは explore の仕事
  if (c.inv?.full) return 0;
  let u = 0.44 + 0.26 * distScore(d, 24);
  if (per(c, "oreValuable", false)) u += 0.15; // ダイヤ等の貴重鉱石
  if (c.owner?.underground) u += 0.06;
  return u;
}

function uFarmCrops(c) {
  const _rawCrop = percDist(c, "cropReadyDist"); if (_rawCrop === undefined) return 0;
  const d = num(_rawCrop, -1);
  if (d < 0) return 0;
  if (c.inv?.full) return 0.05; // 収穫しても持てない
  let u = 0.48 + 0.24 * distScore(d, 24);
  if (!(c.inv?.hasFood) || num(c.inv?.foodCount, 0) < 4) u += 0.1; // 食料が乏しいなら優先
  return u;
}

function uPickupDrops(c) {
  const n = num(c.drops?.count, 0);
  if (n <= 0) return 0;
  let u = 0.5 + 0.08 * Math.min(n, 4);
  if (num(c.drops?.ownerDroppedDist, -1) >= 0) u += 0.3; // 主人の落とし物は最優先級
  else if (num(c.drops?.valuableDist, -1) >= 0) u += 0.22;
  const nd = num(c.drops?.nearestDist, -1);
  if (nd >= 0) u += 0.1 * distScore(nd, 20);
  if (c.inv?.full) u *= 0.3;
  return u;
}

function uDepositAtHome(c) {
  if (!c.home?.registered) return 0;
  if (c.home?.dimensionSame === false) return 0; // cycle0740 deposit P1: 別次元では占有しない (UNKNOWN は不可と読まない)
  if (c.home?.depositBlocked) return 0; // cycle0740 deposit P1: 冷却/抑制中は他 goal へ譲る
  if (c.home?.chestFull || c.home?.chestMissing) return 0;
  if (c.flags?.justDeposited) return 0.02; // 入れたばかり
  const ratio = num(c.inv?.size, 27) > 0 ? num(c.inv?.used, 0) / num(c.inv?.size, 27) : 0;
  if (c.inv?.full) return 0.88;
  if (c.inv?.nearFull) return 0.62;
  if (ratio > 0.6 && num(c.inv?.valuableCount, 0) > 0) return 0.45; // 貴重品だけでも預ける価値
  return 0.04;
}

function uDeliverToOwner(c) {
  if (!c.owner?.present) return 0;
  if (c.flags?.justDelivered) return 0.03; // 渡したばかり
  let u = 0;
  if (c.inv?.hasFood && num(c.owner?.hunger, 20) < 14) u = Math.max(u, 0.66); // お腹が空いているなら食料を
  if (c.inv?.hasValuable && num(c.self?.distOwner, 999) < 20) u = Math.max(u, 0.46); // 貴重品は手渡しが本筋
  if (c.inv?.hasFood && (c.owner?.hpPct ?? 1) < 0.4) u = Math.max(u, 0.6); // 回復用に
  return u;
}

function uExploreNearby(c, mem) {
  if ((c.self?.hpPct ?? 1) < 0.4) return 0;
  let u = 0.24;
  const chunk = per(c, "currentChunk", null);
  const visited = Array.isArray(mem?.visitedChunks) ? mem.visitedChunks : [];
  if (!percKnown(c)) { /* chunk・距離が信頼できない時は未踏/資源ボーナスを付けない */ }
  else if (chunk != null && !visited.includes(chunk)) u += 0.18; // 未踏のチャンクは知らない場所
  else if (visited.length > 0) u += 0.04;
  // 資源が見えないなら探す。ただし知覚v2自体が未提供のときは「見えない」と誤認しない
  const oreSeen = percDist(c, "nearestOreDist"), treeSeen = percDist(c, "nearestTreeDist");
  if (oreSeen !== undefined && treeSeen !== undefined && num(oreSeen, -1) < 0 && num(treeSeen, -1) < 0) u += 0.06;
  if (c.env?.isNight) u -= 0.14;
  if (scanKnown(c) && num(c.danger?.count, 0) > 0) u -= 0.15;
  return Math.max(0, u);
}

function uReturnHome(c) {
  if (!c.home?.registered) return 0;
  if (c.home?.dimensionSame === false) return 0; // FW-03/RR-08 (cycle1058): 別次元拠点は deposit と同形に不可 (UNKNOWN は不可と読まない)
  const d = num(c.home?.dist, 999);
  let u = 0;
  if (c.env?.isNight && d > 24) u = Math.max(u, 0.52); // 夜に遠出しているなら帰る
  if (d > 64) u = Math.max(u, 0.4);
  if ((c.self?.hpPct ?? 1) < 0.35) u = Math.max(u, 0.55); // 弱っているなら拠点へ
  if (c.home?.chestMissing) u *= 0.5; // 帰る場所自体が壊れているなら様子見に行く程度
  return u;
}

// 汎用 viable 枠 (cycle0404): 目標自身の作用で完了へ前進できる経路が無い目標は無期限に保持しない。
// viable===false の目標は scoreGoals で効用 0 へ降ろされる (受け皿の dwell 減衰後にも負けないためキャップではなく 0)。例外時は降ろさない (UNKNOWN を不可と読まない)。
function restViable(c) {
  if (c.home?.registered && c.home?.dimensionSame !== false) return true; // FW-03/RR-08 (cycle1058): 別次元拠点だけでは viable にしない (回復アイテム項は下で別途判定)
  // RR-01 (cycle1153): 食料項は「useHealItem で回復に変換できる在庫」がある場合に限る。
  // 実 buildContext では HEAL_ITEMS の食料は hasHealItem も必ず立てるため正規の回復食は従来どおり viable。
  // HEAL_ITEMS 外の食料だけが外れる (従来も実行側で回復しなかった)。
  if (per(c, "hasHealItem", false)) return true;
  return false;
}
function guardViable(c) { return true; } // 警戒は位置取り自体が作用で、資源・拠点を要しない

function uRestRecover(c) {
  const hp = num(c.self?.hpPct, 1);
  if (hp >= 0.95) return 0;
  if (hp < 0.3) return 0.98;
  if (hp < 0.5) return 0.72 + (0.5 - hp) * 0.5;
  if (hp < 0.7) return 0.3;
  return 0.08;
}

function uPlaceTorchDark(c) {
  const light = num(per(c, "lightLevel", 15), 15);
  if (light > 7) return 0;
  const torches = num(per(c, "torchCount", -1), -1);
  const has = torches > 0 || c.inv?.hasTorch;
  if (!has) return 0.02; // 置きたいが松明がない
  let u = 0.5 + 0.2 * clamp((7 - light) / 7, 0, 1);
  if (c.owner?.underground) u += 0.1;
  if (per(c, "indoor", false)) u += 0.04;
  return u;
}

// cycle2117 torchfix: place_torch_dark の実行可能性 (restViable と同型: 確定した不能だけを降ろし UNKNOWN は不可と読まない)
function torchViable(c) {
  if (per(c, "torchPlaceable", undefined) === false) return false;
  const doneAt = num(per(c, "torchDoneAt", -1), -1);
  if (doneAt >= 0) {
    const cell = per(c, "torchDoneCell", null), pos = per(c, "selfPos", null);
    if (cell && pos && cell === `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`) return false;
  }
  return true;
}

function uIdleNearOwner(c) {
  // 最後の受け皿。chooseGoal が null を返さないための常時候補。
  let u = 0.22;
  if (!c.owner?.present) return 0.1;
  if (num(c.owner?.idleSec, 0) > 120) u += 0.1; // 主人が止まっているなら、そばにいること自体が仕事
  if (num(c.self?.distOwner, 999) <= 3) u += 0.04;
  return u;
}

// ---------- 目標定義（配列順 = 同点時の優先順） ----------
export const GOALS = [
  { id: "rest_recover", score: uRestRecover, noDecay: true, viable: restViable, reason: () => "少し、休ませてください。……無理は、しません" },
  { id: "guard_owner", score: uGuardOwner, noDecay: true, viable: guardViable, reason: () => "敵影を確認。あなたの周囲を固めます" },
  { id: "pickup_drops", score: uPickupDrops, reason: (c) => num(c.drops?.ownerDroppedDist, -1) >= 0 ? "あなたの落とし物です。先に回収します" : "落ちている物を回収します。放置は、勿体ないので" },
  { id: "deposit_at_home", score: uDepositAtHome, reason: () => "荷物がいっぱいです。拠点へ預けてきます" },
  { id: "deliver_to_owner", score: uDeliverToOwner, reason: (c) => c.inv?.hasFood && num(c.owner?.hunger, 20) < 14 ? "食料をお持ちしました。……ちゃんと食べてください" : "お渡ししたい物があります" },
  { id: "return_home", score: uReturnHome, reason: () => "拠点へ戻ります。帰る場所は、登録済みですから" },
  { id: "place_torch_dark", score: uPlaceTorchDark, viable: torchViable, reason: () => "暗いですね。松明を置いておきます" },
  { id: "farm_crops", score: uFarmCrops, reason: () => "作物が育っています。収穫しておきますね" },
  { id: "mine_ore", score: uMineOre, reason: () => "鉱石を見つけました。掘ってきます" },
  { id: "gather_wood", score: uGatherWood, reason: () => "木が近いので、少し切ってきます" },
  { id: "gather_stone", score: uGatherStone, reason: () => "石材を補充しておきます" },
  { id: "follow_owner", score: uFollowOwner, reason: () => "ついていきます。定位置は、あなたの隣です" },
  { id: "explore_nearby", score: uExploreNearby, reason: () => "周囲を確認してきます。……すぐ戻ります" },
  { id: "idle_near_owner", score: uIdleNearOwner, reason: () => "今は、そばにいます。それが仕事です" },
];
export const GOAL_IDS = GOALS.map((g) => g.id);

// ---------- 目標固着の防止（減衰）と危険スポット回避 ----------
const DECAY_START_SEC = 45; // これまでは小さな継続ボーナスでチラつきを防ぐ
const DECAY_SPAN_SEC = 300; // 開始からこの秒数で下限まで減衰
const DECAY_FLOOR = 0.25;

function dwellFactor(goalId, mem, now) {
  if (!mem || mem.lastGoal !== goalId) return 1;
  const since = num(mem.goalSince, NaN);
  if (!Number.isFinite(since)) return 1;
  const dwellSec = Math.max(0, (now - since) / 1000);
  if (dwellSec <= DECAY_START_SEC) return 1.03; // 慣性: 短時間は目標をコロコロ変えない
  return clamp(1 - (dwellSec - DECAY_START_SEC) / DECAY_SPAN_SEC, DECAY_FLOOR, 1);
}

// 危険スポット: mem.dangerSpots = [{x, z, r?}]。自位置が圏内なら探索・採取系を下げ、帰還・休憩を上げる
function inDangerSpot(c, mem) {
  const pos = per(c, "selfPos", null);
  if (!pos || !Array.isArray(mem?.dangerSpots)) return false;
  for (const s of mem.dangerSpots) {
    const sx = num(s?.x ?? s?.pos?.x, NaN), sz = num(s?.z ?? s?.pos?.z, NaN);
    if (!Number.isFinite(sx) || !Number.isFinite(sz)) continue;
    const r = num(s?.r ?? s?.radius, 12);
    if (Math.hypot(num(pos.x, 0) - sx, num(pos.z, 0) - sz) <= r) return true;
  }
  return false;
}
const DANGER_DAMPED = new Set(["explore_nearby", "gather_wood", "gather_stone", "mine_ore", "farm_crops"]);
const DANGER_BOOSTED = new Set(["return_home", "rest_recover"]);

// ---------- 公開API ----------
export function scoreGoals(ctx, mem) {
  const c = ctx || {};
  const now = num(mem?.now, NaN);
  const nowMs = Number.isFinite(now) ? now : Date.now();
  const danger = inDangerSpot(c, mem);
  return GOALS.map((g) => {
    let u = 0;
    try { u = num(g.score(c, mem), 0); } catch { u = 0; }
    if (danger && DANGER_DAMPED.has(g.id)) u *= 0.4;
    if (danger && DANGER_BOOSTED.has(g.id)) u += 0.1;
    if (typeof g.viable === "function") { try { if (g.viable(c, mem) === false) u = 0; } catch { /* UNKNOWN は不可と読まない */ } }
    if (!g.noDecay) u *= dwellFactor(g.id, mem, nowMs);
    return { goal: g.id, utility: Math.round(u * 1000) / 1000 };
  });
}

function hintFor(goalId, c) {
  switch (goalId) {
    case "follow_owner": case "guard_owner": case "deliver_to_owner": case "idle_near_owner":
      return { kind: "owner" };
    case "gather_wood": return { kind: "nearest", what: "tree", dist: num(per(c, "nearestTreeDist", -1), -1) };
    case "gather_stone": return { kind: "nearest", what: "stone", dist: num(per(c, "nearestStoneDist", -1), -1) };
    case "mine_ore": return { kind: "nearest", what: "ore", dist: num(per(c, "nearestOreDist", -1), -1), valuable: !!per(c, "oreValuable", false) };
    case "farm_crops": return { kind: "nearest", what: "crop_ready", dist: num(per(c, "cropReadyDist", -1), -1) };
    case "pickup_drops": {
      const prio = num(c.drops?.ownerDroppedDist, -1) >= 0 ? "owner" : num(c.drops?.valuableDist, -1) >= 0 ? "valuable" : "nearest";
      return { kind: "drops", priority: prio, dist: num(c.drops?.nearestDist, -1) };
    }
    case "deposit_at_home": case "return_home":
      return { kind: "home", dist: num(c.home?.dist, 999) };
    case "rest_recover":
      return c.home?.registered ? { kind: "home", dist: num(c.home?.dist, 999) } : { kind: "here" };
    case "place_torch_dark":
      return { kind: "here", lightLevel: num(per(c, "lightLevel", 15), 15) };
    case "explore_nearby":
      return { kind: "explore", avoidDangerSpots: true, chunk: per(c, "currentChunk", null) };
    default:
      return { kind: "none" };
  }
}

// 目標を選ぶ。返り値: { goal, hint, reason, utility, scores }
// scores は全目標の効用一覧（デバッグ・テスト用）。
export function chooseGoal(ctx, mem) {
  const c = ctx || {};
  const scores = scoreGoals(c, mem);
  let best = null;
  for (let i = 0; i < GOALS.length; i++) {
    const s = scores[i];
    // 厳密に大きい場合だけ更新 → 同点は GOALS の定義順（=優先順）で安定決定
    if (!best || s.utility > best.utility) best = s;
  }
  const def = GOALS.find((g) => g.id === best.goal);
  let reason = "";
  try { reason = def.reason(c) || ""; } catch { reason = ""; }
  return { goal: best.goal, hint: hintFor(best.goal, c), reason, utility: best.utility, scores };
}
