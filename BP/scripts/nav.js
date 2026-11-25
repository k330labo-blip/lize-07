// nav.js — リゼ（LIZE-07）移動の人間化：列グラフ A* ライト版＋歩行コントローラ
// 設計の正は autonomy/navigation_spec.md。本ファイルは純粋JS（@minecraft/server 非依存）で、
// ブロック参照は probe(x, y, z) コールバック注入式。node テスト可能（tests/test_nav.mjs）。
//
// probe(x, y, z) の返り値（セル記述子）:
//   { solid, pass, water, lava, hazard, cost, door, doorOpenable, top }
//   solid: 支持あり（上に立てる） / pass: 体が入れる / water: 水セル / lava: 溶岩
//   hazard: 占有・支持とも不可（火・サボテン等） / cost: その列に立つ追加コスト
//   door: ドア/ゲートのセル / doorOpenable: 開閉可能か / top: 支持面の高さ（ブロック内 0..1、既定1）
//   null/undefined は「不明（未読み込み等）」として通行不可に倒す。
//
// 使い方（main.js 側の想定。詳細は nav_integration.md）:
//   const nav = createNav(probe);
//   navSetGoal(nav, goalPos, { arriveRadius: 1 });
//   const res = navTick(nav, bot.location, 0.1, { act: r.moveAct });
//   if (res.mode === "path" && res.move) bot.teleport(res.move, { rotation: { x: 0, y: res.move.yaw } });
//   else if (res.mode === "direct") { /* 現行 moveDirect() を使う */ }

export const NAV = {
  RADIUS: 16,               // グリッド半径（ブロック）
  REBUILD_DIST: 4,          // 中心からこれだけ離れたら再構築
  BUDGET_PER_TICK: 400,     // 分割構築の1tickあたり probe 上限
  ASTAR_MAX_EXPAND: 800,    // 探索の展開上限
  REPATH_MIN_STEPS: 10,     // 再探索の最短間隔（2tickステップ数。=20tick）
  SPEED_WALK: 4.3,          // 通常歩行（ブロック/秒）
  SPEED_DASH: 5.6,          // ダッシュ相当
  SPEED_FINE: 2.0,          // 微調整
  WAYPOINT_REACH: 0.4,      // ウェイポイント到達の水平距離
  DOOR_OPEN_DIST: 1.2,
  DOOR_CLOSE_DIST: 1.5,
  SCAN_UP: 2,               // 床探索：現在Yから上へ
  SCAN_DOWN: 4,             // 床探索：現在Yから下へ
};

const AIR = Object.freeze({ solid: false, pass: true, water: false, lava: false, hazard: false, cost: 0, door: false, doorOpenable: false, top: 1, unknown: false });

export function cellAir() { return { ...AIR }; }

// 未知セル（未読込・probe例外）。他フィールドは「証拠なし」の値であり、消費者は unknown を見て解釈すること
const UNKNOWN = Object.freeze({ unknown: true, solid: false, pass: false, water: false, lava: false, hazard: false, cost: Infinity, door: false, doorOpenable: false, top: 1 });
export function cellUnknown() { return { ...UNKNOWN }; }
export function isUnknownCell(c) { return !!c && c.unknown === true; }

// ---------- typeId → セル記述子（ゲーム内アダプタ用ヘルパー） ----------
// 正式版 @minecraft/server 2.0.0 では Block の isSolid プロパティは常に undefined (ベータ専用) のため使わない。
// 固体判定は typeId のリスト照合のみで行う (api は isLiquid のみ受け付ける)。
const PASS_SUFFIX = ["_grass", "_flower", "_tulip", "_orchid", "_daisy", "_lily", "_fern", "_bush_dead"];
const PASS_EXACT = new Set([
  "minecraft:air", "minecraft:tall_grass", "minecraft:short_grass", "minecraft:grass",
  "minecraft:fern", "minecraft:large_fern", "minecraft:dead_bush", "minecraft:torch",
  "minecraft:soul_torch", "minecraft:redstone_torch", "minecraft:redstone_wire",
  "minecraft:rail", "minecraft:golden_rail", "minecraft:detector_rail", "minecraft:activator_rail",
  "minecraft:carpet", "minecraft:moss_carpet", "minecraft:lever", "minecraft:stone_button",
  "minecraft:vine", "minecraft:glow_lichen", "minecraft:snow_layer", "minecraft:lily_pad",
  "minecraft:sugar_cane", // cycle1110 CANE-01段1: サトウキビは水辺に立つ細い茎で体は通る (不明=固体に落ちると立ち位置探索が壊れる)
]);
const COSTLY_PASS = [ // [部分一致, コスト]
  ["sweet_berry_bush", 4.0], ["powder_snow", 4.0], ["cobweb", 8.0],
];
const COSTLY_SOLID = [ // [部分一致, コスト]
  ["magma", 6.0], ["campfire", 6.0],
];

export function classifyTypeId(typeId, api = null) {
  const id = String(typeId || "minecraft:air");
  const c = cellAir();
  if (id.includes("lava")) { c.lava = true; c.pass = false; return c; }
  if (id.includes("water")) { c.water = true; return c; } // pass=true のまま（泳ぎ/水ノード）
  if (id.endsWith("_door") || id.endsWith("_fence_gate") || id === "minecraft:iron_door") {
    c.door = true; c.pass = false;
    c.doorOpenable = !id.includes("iron");
    return c;
  }
  if (id.endsWith("_trapdoor")) { c.solid = true; c.pass = false; return c; } // 閉じている前提で支持（開は統合側で要確認）
  if (id.includes("fire") || id.endsWith("cactus") || id.includes("wither_rose")) { c.hazard = true; c.pass = false; return c; }
  if (id.endsWith("_leaves")) { c.solid = true; c.pass = false; c.leaves = true; return c; } // v0.4.59: 葉は体は通さないが「地面」ではない (fly.groundNear が区別する)
  for (const [sub, cost] of COSTLY_PASS) if (id.includes(sub)) { c.cost = cost; return c; }
  for (const [sub, cost] of COSTLY_SOLID) if (id.includes(sub)) { c.solid = true; c.pass = false; c.cost = cost; return c; }
  if (PASS_EXACT.has(id) || PASS_SUFFIX.some((s) => id.endsWith(s)) || id.endsWith("_carpet") || id.endsWith("_sign") || id.endsWith("_pressure_plate")) {
    return c; // 通過可能
  }
  if (id.endsWith("_slab") && !id.includes("double")) c.top = 0.5; // 下付きハーフブロック近似
  if (api && api.isLiquid) { c.water = true; return c; }
  c.solid = true; c.pass = false; // 不明なブロックは固体として倒す（安全側）
  return c;
}

// 固体判定の共通ヘルパー (キュー1 v0.4.85): isSolid プロパティ直接読みの置換先はこれだけにする。
export function solidOfTypeId(typeId) { return classifyTypeId(typeId).solid; }
export function liquidOfTypeId(typeId) { const id = String(typeId || ""); return id.includes("water") || id.includes("lava"); }

// ---------- 列スキャン：その列で立てる床面を探す ----------
function probeSafe(probe, x, y, z) {
  try { const c = probe(x, y, z); return c || cellUnknown(); } catch { return cellUnknown(); }
}

// 戻り値 node: { x, z, floorY, water, submerged, cost, doors:[{x,y,z}] } | null
export function scanColumn(probe, x, z, refY) {
  const yTop = Math.floor(refY) + NAV.SCAN_UP;
  const yBot = Math.floor(refY) - NAV.SCAN_DOWN;
  const cache = new Map();
  const at = (y) => { if (!cache.has(y)) cache.set(y, probeSafe(probe, x, y, z)); return cache.get(y); };
  let best = null;
  for (let feet = yBot; feet <= yTop; feet++) {
    const below = at(feet - 1), body = at(feet), head = at(feet + 1);
    if (!body || !head || isUnknownCell(body) || isUnknownCell(head)) continue;
    if (body.lava || head.lava || body.hazard || head.hazard) continue;
    // ドア/ゲートが体・頭にある列：開閉可能なら通過可（支持は下で判定）
    const doorCells = [];
    let bodyOk = body.pass, headOk = head.pass;
    if (body.door) { if (!body.doorOpenable) bodyOk = false; else { bodyOk = true; doorCells.push({ x, y: feet, z }); } }
    if (head.door) { if (!head.doorOpenable) headOk = false; else { headOk = true; doorCells.push({ x, y: feet + 1, z }); } }
    if (!bodyOk || !headOk) continue;
    if (!below || isUnknownCell(below) || below.hazard || below.lava) continue;
    let node = null;
    if (below.solid) {
      node = { x, z, floorY: (feet - 1) + (below.top ?? 1), water: false, submerged: false, cost: below.cost || 0, doors: doorCells };
    } else if (body.water) {
      // 水ノード：足元が水。頭も水なら潜水＝歩行対象外（フォールバック領分）
      node = { x, z, floorY: feet, water: true, submerged: !!head.water, cost: 0, doors: doorCells };
    }
    if (!node) continue;
    if (body.cost) node.cost = Math.max(node.cost, body.cost); //  berry/cobweb 等、体セルのコスト
    if (!best || Math.abs(node.floorY - refY) < Math.abs(best.floorY - refY)) best = node;
  }
  return best;
}

// 行き先セル検査 (テレポート系の汎用規則, BASICS-03残部): 実際に体が入るセル (dest.y 基準の体・頭) と
// 着地床の支持セル (floorY-1) を分けて見る。未知セルは fail-closed (fly の isBlockedDestCell と同じ作法)。
export function isSafeTeleportDest(probe, dest, floorY) {
  if (!dest || typeof floorY !== "number" || !isFinite(floorY)) return false;
  const fx = Math.floor(dest.x), fz = Math.floor(dest.z), fy = Math.floor(dest.y);
  const body = probeSafe(probe, fx, fy, fz);
  const head = probeSafe(probe, fx, fy + 1, fz);
  const support = probeSafe(probe, fx, Math.floor(floorY) - 1, fz);
  if (isUnknownCell(body) || isUnknownCell(head) || isUnknownCell(support)) return false;
  const blocked = (c) => !!(c.solid || c.lava || c.hazard || c.door);
  if (blocked(body) || blocked(head)) return false;
  if (support.lava || support.hazard) return false;
  if (!support.solid && !support.water) return false;
  return true;
}

// 歩行ステップの行き先セル検査 (BASICS-04 案2): 位置 pos の体・頭セルのみを見る (支持は見ない。
// ジャンプ弧・落下途中の正常ステップを塞がないため)。fly の isBlockedDestCell と同じ fail-closed 集合。
// 戻り値: "blocked" (solid/lava/hazard) / "door_hard" (開閉不能ドア) / "door" (開閉可能ドア) /
//         "unknown" (未知セル) / null (通過可。水・pass・costly pass は通過可)。
export function stepDestBlock(probe, pos) {
  if (!pos) return "unknown";
  const fx = Math.floor(pos.x), fz = Math.floor(pos.z), fy = Math.round(pos.y);
  const cells = [probeSafe(probe, fx, fy, fz), probeSafe(probe, fx, fy + 1, fz)];
  let door = false, unknown = false;
  for (const c of cells) {
    if (c.solid || c.lava || c.hazard) return "blocked";
    if (c.door && !c.doorOpenable) return "door_hard";
    if (isUnknownCell(c)) unknown = true;
    else if (c.door) door = true;
  }
  if (unknown) return "unknown";
  return door ? "door" : null;
}

// ---------- グリッド（分割構築） ----------
export function createGrid(cx, cz, refY) {
  const cols = [];
  for (let dx = -NAV.RADIUS; dx <= NAV.RADIUS; dx++)
    for (let dz = -NAV.RADIUS; dz <= NAV.RADIUS; dz++)
      if (dx * dx + dz * dz <= NAV.RADIUS * NAV.RADIUS) cols.push([cx + dx, cz + dz]);
  return { cx, cz, refY, nodes: new Map(), cols, idx: 0, done: false };
}

export function nodeKey(x, z) { return x + "," + z; }
export function nodeAt(grid, x, z) { return grid ? grid.nodes.get(nodeKey(x, z)) || null : null; }

// 1回で最大 budget 回まで probe を消費して構築を進める。完了したら true。
export function buildGridStep(grid, probe, budget = NAV.BUDGET_PER_TICK) {
  if (!grid || grid.done) return true;
  let used = 0;
  const counting = (x, y, z) => { used++; return probe(x, y, z); };
  while (grid.idx < grid.cols.length) {
    const [x, z] = grid.cols[grid.idx];
    const n = scanColumn(counting, x, z, grid.refY);
    if (n && !n.submerged) grid.nodes.set(nodeKey(x, z), n);
    grid.idx++;
    if (used >= budget && grid.idx < grid.cols.length) return false;
  }
  grid.done = true;
  return true;
}

export function buildGridFull(probe, cx, cz, refY) {
  const g = createGrid(cx, cz, refY);
  while (!buildGridStep(g, probe, Number.MAX_SAFE_INTEGER)) { /* 全構築 */ }
  return g;
}

// ---------- 移動コスト（仕様 §3） ----------
const DIRS = [
  [1, 0, 1.0], [-1, 0, 1.0], [0, 1, 1.0], [0, -1, 1.0],
  [1, 1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [-1, -1, 1.42],
];

// a→b の1歩が可能ならコスト、不可なら Infinity。b は node、a は node。
export function stepCost(grid, a, b) {
  if (!a || !b) return Infinity;
  const dx = b.x - a.x, dz = b.z - a.z;
  const diag = dx !== 0 && dz !== 0;
  if (diag) {
    // 角抜け禁止（厳密版）：両隣の直交列が「存在する」だけでは不十分で、
    // 実際に歩いて回り込める（a から到達可能）ことも要求する。
    // 2段壁の天面ノード等、存在するが届かない列では斜めを通さない。
    const o1 = nodeAt(grid, b.x, a.z), o2 = nodeAt(grid, a.x, b.z);
    if (!o1 || !o2) return Infinity;
    if (!isFinite(stepCost(grid, a, o1)) || !isFinite(stepCost(grid, a, o2))) return Infinity;
  }
  const dy = b.floorY - a.floorY;
  if (dy > 1) return Infinity;                    // +2以上は登れない
  let step = diag ? 1.42 : 1.0;
  if (dy > 0) step += 0.6;                        // 上り（ジャンプ相当）
  else if (dy >= -1) step += dy < 0 ? 0.2 : 0;    // 段差0〜−1
  else if (dy >= -3) step += b.water ? 0.8 : 2.5; // 落差2〜3
  else { if (!b.water) return Infinity; step += 0.8; } // 落差4以上は水面へのみ
  let c = b.water ? step * 3 + 1.0 : step;        // 水ノードは重い
  c += b.cost || 0;
  if (b.doors && b.doors.length) c += 1.5;        // 扉を開ける手間
  return c;
}

function heuristic(ax, az, bx, bz) {
  const dx = Math.abs(ax - bx), dz = Math.abs(az - bz);
  return Math.max(dx, dz) + 0.42 * Math.min(dx, dz); // オクトイル距離（admissible）
}

function nearestNode(grid, x, z, maxCheb) {
  let best = null, bestD = Infinity;
  for (let r = 0; r <= maxCheb; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const n = nodeAt(grid, x + dx, z + dz);
      if (!n) continue;
      const d = heuristic(x, z, n.x, n.z);
      if (d < bestD) { bestD = d; best = n; }
    }
    if (best) return best;
  }
  return null;
}

// ---------- A* ライト版（仕様 §4） ----------
// start/goal はワールド座標 {x, z}（小数可、列へ丸める）。
// 戻り値: { points:[{x,y,z,doors?}], reached, partial, expanded } | null
//   points は開始列を含まない（最初のウェイポイントからゴールまで）。
//   到達不能/上限でも、ゴールに最も近い展開済みノードへの部分経路を返す（partial:true）。
export function findPath(grid, start, goal, opts = {}) {
  if (!grid || !grid.nodes.size) return null;
  const arriveRadius = opts.arriveRadius ?? 0;
  const maxExpand = opts.maxExpand ?? NAV.ASTAR_MAX_EXPAND;
  const sx = Math.floor(start.x), sz = Math.floor(start.z);
  const gx = Math.floor(goal.x), gz = Math.floor(goal.z);
  const startNode = nodeAt(grid, sx, sz) || nearestNode(grid, sx, sz, 1);
  if (!startNode) return null;
  // ゴール列にノードが無い（壁の中・範囲外）場合は、ゴールに一番近いノードを代替ゴールにする
  let goalNode = nodeAt(grid, gx, gz);
  let goalPartial = false;
  if (!goalNode) {
    goalNode = nearestNode(grid, gx, gz, 2);
    if (!goalNode) { // グリッド内の全ノードから最も近いもの（範囲外ゴール用）
      let bd = Infinity;
      for (const n of grid.nodes.values()) { const d = heuristic(gx, gz, n.x, n.z); if (d < bd) { bd = d; goalNode = n; } }
    }
    goalPartial = true;
  }
  if (!goalNode) return null;
  const isGoal = (n) => Math.max(Math.abs(n.x - gx), Math.abs(n.z - gz)) <= arriveRadius && nodeAt(grid, n.x, n.z) === n;
  if (isGoal(startNode) || (startNode === goalNode && arriveRadius >= 0 && Math.max(Math.abs(sx - gx), Math.abs(sz - gz)) <= arriveRadius)) {
    return { points: [], reached: true, partial: false, expanded: 0 };
  }
  const open = new Map(); // key -> {n, g, f, parent}
  const closed = new Map();
  const k0 = nodeKey(startNode.x, startNode.z);
  open.set(k0, { n: startNode, g: 0, f: heuristic(startNode.x, startNode.z, gx, gz), parent: null });
  let best = open.get(k0); // ゴールに最も近い展開済み（部分経路用）
  let expanded = 0, found = null;
  while (open.size) {
    let cur = null;
    for (const e of open.values()) if (!cur || e.f < cur.f || (e.f === cur.f && e.g > cur.g)) cur = e;
    open.delete(nodeKey(cur.n.x, cur.n.z));
    closed.set(nodeKey(cur.n.x, cur.n.z), cur);
    if (heuristic(cur.n.x, cur.n.z, gx, gz) < heuristic(best.n.x, best.n.z, gx, gz)) best = cur;
    if (isGoal(cur.n) || cur.n === goalNode) { found = cur; break; }
    if (++expanded > maxExpand) break;
    for (const [dx, dz] of DIRS) {
      const nb = nodeAt(grid, cur.n.x + dx, cur.n.z + dz);
      if (!nb) continue;
      const ck = nodeKey(nb.x, nb.z);
      if (closed.has(ck)) continue;
      const c = stepCost(grid, cur.n, nb);
      if (!isFinite(c)) continue;
      const g = cur.g + c;
      const e = open.get(ck);
      if (e && e.g <= g) continue;
      open.set(ck, { n: nb, g, f: g + heuristic(nb.x, nb.z, gx, gz), parent: cur });
    }
  }
  const endEntry = found || (best && best.n !== startNode ? best : null);
  if (!endEntry) return null; // 1歩も進めない＝到達不能としてフォールバックへ
  const chain = [];
  for (let e = endEntry; e && e.n !== startNode; e = e.parent) chain.push(e.n);
  chain.reverse();
  const reached = !!found && !goalPartial;
  const nodes = smoothNodes(grid, [startNode, ...chain]);
  const points = nodes.slice(1).map((n) => {
    const p = { x: n.x + 0.5, y: n.floorY, z: n.z + 0.5 };
    if (n.doors && n.doors.length) p.doors = n.doors;
    return p;
  });
  return { points, reached, partial: !reached, expanded };
}

// ---------- 経路平滑化（仕様 §4：見通しで間引き、間隔は最大4ブロック） ----------
// 直線区間のコスト：直線上の列をサンプルし、列間の stepCost を合計する。
// 通行不可な列が1つでもあれば Infinity。
// 平滑化は「直線コスト ≦ 置き換える経路区間のコスト」のときだけ許可する
// （コスト無視の近道で magma 等の高コスト列を踏ませないため）。
export function segmentCost(grid, a, b) {
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.ceil(dist / 0.4));
  let prev = a, total = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const colX = Math.round(a.x + (b.x - a.x) * t), colZ = Math.round(a.z + (b.z - a.z) * t);
    const n = nodeAt(grid, colX, colZ);
    if (!n) return Infinity;
    if (n !== prev) {
      const c = stepCost(grid, prev, n);
      if (!isFinite(c)) return Infinity;
      total += c;
      prev = n;
    }
  }
  return total;
}

export function smoothNodes(grid, nodes) {
  if (!nodes || nodes.length <= 2) return nodes ? nodes.slice() : [];
  const chain = [0]; // 経路区間の累積コスト
  for (let i = 1; i < nodes.length; i++) chain.push(chain[i - 1] + stepCost(grid, nodes[i - 1], nodes[i]));
  const out = [nodes[0]];
  let i = 0;
  while (i < nodes.length - 1) {
    let j = nodes.length - 1;
    while (j > i + 1) {
      const seg = segmentCost(grid, nodes[i], nodes[j]);
      if (isFinite(seg) && seg <= chain[j] - chain[i] + 1e-9) break;
      j--;
    }
    // BASICS-04: 副作用イベント（開扉）を持つノードは間引き対象から外す。
    // i の次にある doors 付きノードを区間終端の上限とし、それを越えて間引かない。
    for (let k = i + 1; k < j; k++) { if (nodes[k].doors && nodes[k].doors.length) { j = k; break; } }
    // 間隔が4ブロックを超える場合は、経路上の4ブロック付近のノードで分割する
    while (j > i + 1 && Math.hypot(nodes[j].x - nodes[i].x, nodes[j].z - nodes[i].z) > 4) j--;
    // 分割でコスト条件が崩れたら隣接ノードに落とす（安全側）
    if (j > i + 1 && segmentCost(grid, nodes[i], nodes[j]) > chain[j] - chain[i] + 1e-9) j = i + 1;
    out.push(nodes[j]);
    i = j;
  }
  return out;
}

// ---------- 歩行コントローラ（仕様 §5：速度・小ジャンプ弧・向き） ----------
export function createWalker() {
  return { points: [], idx: 0, segFrom: null, segLen: 0, yaw: 0 };
}

export function walkerSetPath(w, points, pos) {
  w.points = points || [];
  w.idx = 0;
  w.segFrom = pos ? { ...pos } : null;
  w.segLen = 0;
}

// yaw は Bedrock の rotation.y 想定（0=+Z向き、反時計回り正）。
// 進行方向→yaw の換算符号は実機で1回確認して固定すること（nav_integration.md 参照）。
export function yawToward(dx, dz) { return Math.atan2(-dx, dz) * 180 / Math.PI; }

function turnClamp(cur, want, maxDeg) {
  let d = ((want - cur + 540) % 360) - 180;
  d = Math.max(-maxDeg, Math.min(maxDeg, d));
  return cur + d;
}

// 1ステップ（移動ループ1回ぶん）進める。戻り値:
//   { pos:{x,y,z,yaw}, arrived:boolean(全ウェイポイント消化), wpArrived:boolean, target:{x,y,z}|null }
// pos は「この tick でテレポートすべき位置」。points が空なら pos=null。
export function walkerStep(w, pos, dtSec, speed) {
  if (!w.points.length || w.idx >= w.points.length) return { pos: null, arrived: true, wpArrived: false, target: null };
  if (!w.segFrom) { w.segFrom = { ...pos }; w.segLen = 0; }
  let wp = w.points[w.idx];
  let dx = wp.x - pos.x, dz = wp.z - pos.z;
  let hd = Math.hypot(dx, dz);
  if (hd <= NAV.WAYPOINT_REACH) {
    // ウェイポイント到達：Y を床面へ確定して次へ
    const done = { x: wp.x, y: wp.y, z: wp.z, yaw: w.yaw };
    w.idx++;
    w.segFrom = { x: wp.x, y: wp.y, z: wp.z };
    w.segLen = 0;
    if (w.idx >= w.points.length) return { pos: done, arrived: true, wpArrived: true, target: null };
    return { pos: done, arrived: false, wpArrived: true, target: w.points[w.idx] };
  }
  if (w.segLen <= 0) w.segLen = Math.max(hd, 0.001);
  const stepLen = Math.min(speed * dtSec, hd);
  const nx = pos.x + (dx / hd) * stepLen;
  const nz = pos.z + (dz / hd) * stepLen;
  const progress = Math.min(1, (w.segLen - (hd - stepLen)) / w.segLen);
  let ny = w.segFrom.y + (wp.y - w.segFrom.y) * progress;
  if (wp.y > w.segFrom.y + 0.05) ny += Math.sin(progress * Math.PI) * 0.35; // 段差+1の小ジャンプ弧
  if (stepLen >= hd - 1e-9) ny = wp.y;
  w.yaw = turnClamp(w.yaw, yawToward(dx, dz), 60);
  return { pos: { x: nx, y: ny, z: nz, yaw: w.yaw }, arrived: false, wpArrived: false, target: wp };
}

// ---------- ナビ・コントローラ（main が呼ぶファサード） ----------
// 状態を保持し、グリッド分割構築・再探索トリガー・スタック段階フォールバック・
// ドア開閉イベントをまとめて面倒を見る。移動の実テレポートは呼び出し側。
const NO_CLOSE_ACTS = new Set(["flee", "guard", "zap"]);

export function createNav(probe, opts = {}) {
  return {
    probe,
    budget: opts.budget ?? NAV.BUDGET_PER_TICK,
    grid: null, building: null,
    walker: createWalker(),
    goal: null, goalKey: "", arriveRadius: 0,
    mode: "idle",           // "path" | "direct" | "idle"
    stepsSinceRepath: 999,  // 再探索間隔の管理（2tickステップ数）
    repaths: 0,             // 同一ゴールでの再探索回数（スタック時）
    stuckSec: 0, lastPos: null,
    openedDoors: [],        // 閉め待ちの扉 [{x,y,z}]
    forceRepath: true,
    destBlocked: false,     // BASICS-04案2: 直近tickで行き先が塞がっていたか (スタック降格の迂回防止)
  };
}

function goalKeyOf(goal, arriveRadius) {
  return Math.floor(goal.x) + "," + Math.floor(goal.z) + "," + arriveRadius;
}

export function navSetGoal(nav, goal, opts = {}) {
  const key = goalKeyOf(goal, opts.arriveRadius ?? 0);
  if (key !== nav.goalKey) {
    // cycle0202 a09: 近い目標移動では stuckSec/repaths を引き継ぐ（fly と同型の
    // 到達不能バグ: 動く目標ではカウンタが sync のたびに消え救済が発動しない）。
    const near = !!(nav.goal && (opts.arriveRadius ?? 0) === nav.arriveRadius
      && dist2d(nav.goal, goal) <= 2 && Math.abs(goal.y - nav.goal.y) <= 2);
    nav.goal = { x: goal.x, y: goal.y, z: goal.z };
    nav.goalKey = key;
    nav.arriveRadius = opts.arriveRadius ?? 0;
    if (!near) {
      nav.repaths = 0;
      nav.stuckSec = 0;
      nav.forceRepath = true;
      nav.mode = "path";
      walkerSetPath(nav.walker, [], null);
    }
  }
  return nav;
}

export function navClearGoal(nav) {
  nav.goal = null; nav.goalKey = ""; nav.mode = "idle";
  walkerSetPath(nav.walker, [], null);
}

function dist2d(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

// 移動ループ1回ぶん。dtSec はループ間隔（現行は2tick=0.1秒）。
// 戻り値: { mode, move:{x,y,z,yaw}|null, arrived, openDoors:[], closeDoors:[], repathed, gridReady }
export function navTick(nav, pos, dtSec, opts = {}) {
  const out = { mode: nav.mode, move: null, arrived: false, openDoors: [], closeDoors: [], repathed: false, gridReady: !!(nav.grid && nav.grid.done) };
  if (!nav.goal) { nav.mode = "idle"; out.mode = "idle"; return out; }
  nav.stepsSinceRepath++;
  const act = opts.act || "follow";

  // --- グリッド管理：中心から離れたら分割で再構築（旧グリッドで移動継続） ---
  const pcx = Math.floor(pos.x), pcz = Math.floor(pos.z);
  if (!nav.grid && !nav.building) nav.building = createGrid(pcx, pcz, pos.y);
  const yDrift = nav.grid ? Math.abs(pos.y - nav.grid.refY) : 0; // BASICS-05 (cycle2036): 床探索窓の寸断是正 — 縦ずれでも refY を追随させる
  if (nav.grid && !nav.building &&
      (Math.hypot(nav.grid.cx - pcx, nav.grid.cz - pcz) >= NAV.REBUILD_DIST || yDrift >= 2)) {
    nav.building = createGrid(pcx, pcz, pos.y);
  }
  if (nav.building) {
    if (buildGridStep(nav.building, nav.probe, nav.budget)) { nav.grid = nav.building; nav.building = null; nav.forceRepath = true; }
  }
  out.gridReady = !!(nav.grid && nav.grid.done);
  if (!nav.grid) { nav.mode = "direct"; out.mode = "direct"; return out; } // 構築中は現行方式

  // --- 深水チェック：足元・頭の両方が水なら泳ぎ＝フォールバック ---
  const feetC = probeSafe(nav.probe, pcx, Math.floor(pos.y), pcz);
  const headC = probeSafe(nav.probe, pcx, Math.floor(pos.y) + 1, pcz);
  if (feetC && headC && feetC.water && headC.water) { nav.mode = "direct"; out.mode = "direct"; return out; }

  // --- 到達判定（経路ゴール圏内） ---
  const goalDist = dist2d(pos, nav.goal);
  const inGoalArea = Math.max(Math.abs(pcx - Math.floor(nav.goal.x)), Math.abs(pcz - Math.floor(nav.goal.z))) <= nav.arriveRadius;
  if (inGoalArea || goalDist <= Math.max(0.6, nav.arriveRadius)) { out.arrived = true; }

  // --- 再探索トリガー（仕様 §7） ---
  const w = nav.walker;
  const pathEmpty = !w.points.length || w.idx >= w.points.length;
  // forceRepath（目標変更・グリッド再構築・スタック）なら direct 中でも復帰を試みる。
  // 経路消化後の再探索は path モード時のみ（direct の無限リトライ防止）。
  const needRepath = nav.forceRepath || (nav.mode !== "direct" && pathEmpty && !out.arrived && nav.stepsSinceRepath >= NAV.REPATH_MIN_STEPS);
  if (needRepath) {
    const res = findPath(nav.grid, pos, nav.goal, { arriveRadius: nav.arriveRadius });
    nav.stepsSinceRepath = 0;
    nav.forceRepath = false;
    out.repathed = true;
    if (!res || (!res.points.length && !res.reached)) {
      nav.mode = "direct"; out.mode = "direct"; return out; // 引けない＝現行方式へ
    }
    walkerSetPath(w, res.points, pos);
    nav.mode = "path";
    if (res.reached && !res.points.length) { out.arrived = true; out.mode = "path"; return out; }
  }
  if (nav.mode === "direct") { out.mode = "direct"; return out; }

  // --- スタック検出（仕様 §5.3：1秒で再探索、それでもダメなら direct） ---
  // BASICS-04案2: 行き先が塞がっている間はスタック扱いにしない (stay-move で静止するのが正解で、
  // ここで加算すると約2秒で無検査の direct へ降格し、塞がったセルを結局踏む)。
  if (nav.destBlocked) nav.stuckSec = 0;
  if (nav.lastPos) {
    const moved = Math.hypot(pos.x - nav.lastPos.x, (typeof nav.lastPos.y === "number" ? pos.y - nav.lastPos.y : 0), pos.z - nav.lastPos.z); // queue0-A bug1 (cycle1728): 3D moved
    if (moved < 0.05 && (typeof nav.goal?.y === "number" && nav.lastPos && typeof nav.lastPos.y === "number" ? Math.hypot(goalDist, pos.y - nav.goal.y) : goalDist) > 2) nav.stuckSec += dtSec; else nav.stuckSec = 0; // queue0-A bug1 (cycle1728): 3D goal distance
  }
  nav.lastPos = { x: pos.x, y: pos.y, z: pos.z }; // queue0-A bug1 (cycle1728): keep y
  if (nav.stuckSec >= 1.0) {
    nav.stuckSec = 0;
    nav.repaths++;
    if (nav.repaths >= 2) { nav.mode = "direct"; out.mode = "direct"; return out; }
    nav.forceRepath = true;
    out.repathed = true;
    const res = findPath(nav.grid, pos, nav.goal, { arriveRadius: nav.arriveRadius });
    if (!res || (!res.points.length && !res.reached)) { nav.mode = "direct"; out.mode = "direct"; return out; }
    walkerSetPath(w, res.points, pos);
    nav.stepsSinceRepath = 0;
  }

  // --- 歩行ステップ ---
  const hereNode = nodeAt(nav.grid, pcx, pcz);
  let speed = NAV.SPEED_WALK;
  if (goalDist <= 2) speed = NAV.SPEED_FINE;
  else if (goalDist > 6 || act === "catchup") speed = NAV.SPEED_DASH;
  if (hereNode && hereNode.water) speed *= 0.5;
  // BASICS-04案2: 行き先衝突検査 (2層)。事前=現在ウェイポイントを見て到達スナップの副作用
  // (w.idx の先行) を防ぎ、事後=実ステップを見て平滑化区間途中の動的障害を捕まえる。
  // 塞がり時は move を消さず現在位置を返す (stay-move)。消すと main が無検査の moveDirect へ落とす。
  const synthDoor = (atPos) => {
    const fx = Math.floor(atPos.x), fz = Math.floor(atPos.z), fy = Math.round(atPos.y);
    const tgtWp = w.points[w.idx] || null;
    for (const cy of [fy, fy + 1]) {
      const c = probeSafe(nav.probe, fx, cy, fz);
      if (!c || !c.door || !c.doorOpenable) continue;
      if (tgtWp && tgtWp.doors && tgtWp.doors.some((d) => d.x === fx && d.y === cy && d.z === fz)) continue;
      if (nav.openedDoors.some((o) => o.x === fx && o.y === cy && o.z === fz)) continue;
      const d = { x: fx, y: cy, z: fz };
      nav.openedDoors.push(d);
      out.openDoors.push(d);
    }
  };
  const blockedStay = (kind, yawHint) => {
    nav.destBlocked = true;
    // 再探索は既存の最短間隔に乗せる (毎tickの A* 再実行を防ぐ)。unknown は待てば回復しうるため予約しない。
    if (kind !== "unknown" && nav.stepsSinceRepath >= NAV.REPATH_MIN_STEPS) nav.forceRepath = true;
    out.move = { x: pos.x, y: pos.y, z: pos.z, yaw: yawHint ?? w.yaw };
    out.mode = nav.mode;
    return out;
  };
  const wpNow = w.points[w.idx] || null;
  const preKind = wpNow ? stepDestBlock(nav.probe, wpNow) : null;
  if (preKind === "blocked" || preKind === "door_hard" || preKind === "unknown") return blockedStay(preKind);
  if (preKind === "door") synthDoor(wpNow);
  const step = walkerStep(w, pos, dtSec, speed);
  const stepKind = step.pos ? stepDestBlock(nav.probe, step.pos) : null;
  if (stepKind === "blocked" || stepKind === "door_hard" || stepKind === "unknown") return blockedStay(stepKind, step.pos?.yaw);
  if (stepKind === "door") synthDoor(step.pos);
  nav.destBlocked = false;
  if (step.pos) out.move = step.pos;
  // 経路を歩き切ったが到達圏外のケースは、次tick以降の pathEmpty 判定が
  // REPATH_MIN_STEPS の間隔を守って再探索する（仕様 §7 トリガー2・4）。
  out.mode = nav.mode;

  // --- ドア：次のウェイポイントの扉を開け、通過後に閉める（仕様 §6） ---
  const tgt = step.target || (w.points[w.idx] || null);
  if (tgt && tgt.doors) {
    for (const d of tgt.doors) {
      const dc = { x: d.x + 0.5, y: d.y, z: d.z + 0.5 };
      if (dist2d(pos, dc) <= NAV.DOOR_OPEN_DIST && !nav.openedDoors.some((o) => o.x === d.x && o.y === d.y && o.z === d.z)) {
        nav.openedDoors.push(d);
        out.openDoors.push(d);
      }
    }
  }
  if (!NO_CLOSE_ACTS.has(act) && nav.openedDoors.length) {
    const remain = [];
    for (const d of nav.openedDoors) {
      const dc = { x: d.x + 0.5, z: d.z + 0.5 };
      if (dist2d(pos, dc) > NAV.DOOR_CLOSE_DIST) out.closeDoors.push(d);
      else remain.push(d);
    }
    nav.openedDoors = remain;
  }
  return out;
}
