// リゼ (LIZE-07) 建築ブループリント — 「こういう拠点を作りたい」の土台データ
// 純粋JS。@minecraft/server には依存しない。実建築の実行部は次段の担当で、
// ここは「何を・どこに・どの順で・材料いくつ」のデータと順序までを担う。
//
// ブループリント形式:
//   { id, name, size: {x, y, z}, blocks: [ {dx, dy, dz, role, material, skipCount?} ],
//     materialsSummary(), buildOrder() }
//   - dx/dy/dz は設置原点からの相対座標（0 <= dx < size.x など）。dy=0 が最下段。
//   - role: 'floor' | 'wall' | 'roof' | 'pillar' | 'door' | 'window'
//         | 'torch' | 'chest' | 'bed' | 'crafting' | 'furnace'
//   - material: 'any_log' | 'any_planks' | 'stone' | 'glass' | 'specific:<itemId>'
//   - skipCount: true のセルは複数セル家具（ドア・ベッド）の続きセル。
//     空間は占有するが materialsSummary では数えない（本体セルで1個分だけ数える）。
//
// materialsSummary() の返り値:
//   { "<itemId>": 個数, ... } — 指示パーサ / sourcing がそのまま読める形。
//   汎用素材は代表 itemId に解決する（any_log → minecraft:oak_log 等）。
//   「どの itemId なら代用可か」は MATERIAL_ACCEPT を参照（sourcing 側の受け入れ表）。
//   併せて summaryByMaterial() で素材キー単位の集計も返せる。

// ---------- 素材の解決 ----------
export const MATERIAL_ITEMS = {
  any_log: "minecraft:oak_log",
  any_planks: "minecraft:oak_planks",
  stone: "minecraft:cobblestone",
  glass: "minecraft:glass",
};

// 汎用素材の代用受け入れ表（sourcing が在庫・採取物を照合するときの候補）
export const MATERIAL_ACCEPT = {
  any_log: [
    "minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log",
    "minecraft:jungle_log", "minecraft:acacia_log", "minecraft:dark_oak_log",
    "minecraft:mangrove_log", "minecraft:cherry_log", "minecraft:pale_oak_log",
    "minecraft:crimson_stem", "minecraft:warped_stem",
  ],
  any_planks: [
    "minecraft:oak_planks", "minecraft:spruce_planks", "minecraft:birch_planks",
    "minecraft:jungle_planks", "minecraft:acacia_planks", "minecraft:dark_oak_planks",
    "minecraft:mangrove_planks", "minecraft:cherry_planks", "minecraft:pale_oak_planks",
    "minecraft:bamboo_planks", "minecraft:crimson_planks", "minecraft:warped_planks",
  ],
  stone: [
    "minecraft:cobblestone", "minecraft:stone", "minecraft:stone_bricks",
    "minecraft:mossy_cobblestone", "minecraft:andesite", "minecraft:diorite", "minecraft:granite",
  ],
  glass: ["minecraft:glass"],
};

export function resolveMaterialItem(material) {
  if (typeof material !== "string") return null;
  if (material.startsWith("specific:")) return material.slice("specific:".length);
  return Object.prototype.hasOwnProperty.call(MATERIAL_ITEMS, material) ? MATERIAL_ITEMS[material] : null;
}

// ---------- 設置順序 ----------
// dy 昇順（下から上）が大原則。同段内は role 順:
// 床 → 柱 → 壁 → 家具（チェスト/ベッド/作業台/かまど）→ ドア → 窓 → 屋根 → 松明。
// 屋根は最上段なので dy だけでも最後になるが、role 順でも末尾側に置き、
// 足場なしで「下の段に乗らずに」置ける順を保証する。
export const ROLE_ORDER = {
  floor: 0, pillar: 1, wall: 2,
  chest: 3, bed: 3, crafting: 3, furnace: 3,
  door: 4, window: 5, roof: 6, torch: 7,
};
export const ROLES = Object.keys(ROLE_ORDER);

export function buildOrderOf(blocks) {
  return [...blocks].sort((a, b) =>
    (a.dy - b.dy) ||
    ((ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)) ||
    (a.dz - b.dz) || (a.dx - b.dx));
}

export function materialsSummaryOf(blocks) {
  const out = Object.create(null);
  for (const b of blocks) {
    if (b.skipCount) continue;
    const item = resolveMaterialItem(b.material);
    if (!item) continue;
    out[item] = (out[item] ?? 0) + 1;
  }
  return out;
}

export function summaryByMaterialOf(blocks) {
  const out = Object.create(null);
  for (const b of blocks) {
    if (b.skipCount) continue;
    out[b.material] = (out[b.material] ?? 0) + 1;
  }
  return out;
}

// ---------- 検証（データ整合性） ----------
export function validateBlueprint(bp) {
  const errors = [];
  const seen = new Set();
  for (const b of bp.blocks) {
    const key = `${b.dx},${b.dy},${b.dz}`;
    if (seen.has(key)) errors.push(`重複座標: ${key}`);
    seen.add(key);
    if (b.dx < 0 || b.dx >= bp.size.x || b.dy < 0 || b.dy >= bp.size.y || b.dz < 0 || b.dz >= bp.size.z) {
      errors.push(`範囲外座標: ${key} (size ${bp.size.x}x${bp.size.y}x${bp.size.z})`);
    }
    if (!(b.role in ROLE_ORDER)) errors.push(`未知の role: ${b.role} @ ${key}`);
    if (!resolveMaterialItem(b.material)) errors.push(`解決できない material: ${b.material} @ ${key}`);
  }
  return errors;
}

function defineBlueprint(def) {
  const bp = {
    id: def.id,
    name: def.name,
    size: def.size,
    blocks: def.blocks,
    materialsSummary() { return materialsSummaryOf(bp.blocks); },
    summaryByMaterial() { return summaryByMaterialOf(bp.blocks); },
    buildOrder() { return buildOrderOf(bp.blocks); },
    validate() { return validateBlueprint(bp); },
  };
  return bp;
}

// ---------- テンプレート生成ヘルパ ----------
const B = (dx, dy, dz, role, material, extra) => ({ dx, dy, dz, role, material, ...(extra || {}) });

// 床（全面）と屋根（全面。ただし除外セルあり）
function slab(size, dy, role, material, except) {
  const out = [];
  for (let x = 0; x < size.x; x++) for (let z = 0; z < size.z; z++) {
    if (except && except.has(`${x},${z}`)) continue;
    out.push(B(x, dy, z, role, material));
  }
  return out;
}
// 壁（周囲1周。隅は pillarRole があればそちら）
function perimeter(size, dy, material, pillarMaterial) {
  const out = [];
  for (let x = 0; x < size.x; x++) for (let z = 0; z < size.z; z++) {
    const edge = x === 0 || z === 0 || x === size.x - 1 || z === size.z - 1;
    if (!edge) continue;
    const corner = (x === 0 || x === size.x - 1) && (z === 0 || z === size.z - 1);
    if (corner && pillarMaterial) out.push(B(x, dy, z, "pillar", pillarMaterial));
    else out.push(B(x, dy, z, "wall", material));
  }
  return out;
}
// 指定セルを差し替える（ドア・窓など）。既存セルがなければ追加。
function put(blocks, cell) {
  const i = blocks.findIndex((b) => b.dx === cell.dx && b.dy === cell.dy && b.dz === cell.dz);
  if (i >= 0) blocks[i] = cell; else blocks.push(cell);
  return blocks;
}

// ---------- テンプレート1: 小屋 (5x4x5) ----------
// 前面は dz = size.z-1 側。ドア・窓・松明・チェスト・作業台・ベッド・かまど入り。
function buildHut() {
  const size = { x: 5, y: 4, z: 5 };
  const blocks = [];
  blocks.push(...slab(size, 0, "floor", "any_planks"));
  blocks.push(...perimeter(size, 1, "any_planks", "any_log"));
  blocks.push(...perimeter(size, 2, "any_planks", "any_log"));
  blocks.push(...slab(size, 3, "roof", "any_planks"));
  // ドア（前面中央、2セル・下段のみ数える）
  put(blocks, B(2, 1, 4, "door", "specific:minecraft:oak_door"));
  put(blocks, B(2, 2, 4, "door", "specific:minecraft:oak_door", { skipCount: true }));
  // 窓（左右の壁と背面、2段目）
  put(blocks, B(0, 2, 2, "window", "glass"));
  put(blocks, B(4, 2, 2, "window", "glass"));
  put(blocks, B(2, 2, 0, "window", "glass"));
  put(blocks, B(1, 2, 4, "window", "glass"));
  put(blocks, B(3, 2, 4, "window", "glass"));
  // 家具（内装、1段目）
  put(blocks, B(1, 1, 1, "chest", "specific:minecraft:chest"));
  put(blocks, B(3, 1, 1, "crafting", "specific:minecraft:crafting_table"));
  put(blocks, B(3, 1, 2, "furnace", "specific:minecraft:furnace"));
  // ベッド（2セル・頭側のみ数える）
  put(blocks, B(1, 1, 3, "bed", "specific:minecraft:red_bed"));
  put(blocks, B(2, 1, 3, "bed", "specific:minecraft:red_bed", { skipCount: true }));
  // 松明（内装の壁際、2段目）
  put(blocks, B(1, 2, 1, "torch", "specific:minecraft:torch"));
  put(blocks, B(3, 2, 3, "torch", "specific:minecraft:torch"));
  return defineBlueprint({ id: "hut_5x4x5", name: "小屋", size, blocks });
}

// ---------- テンプレート2: 仮拠点ミニ (3x3x3) ----------
// 一晩しのぐ最小構成。ドア上の1セルはドアの続きとして屋根から除く。
function buildMini() {
  const size = { x: 3, y: 3, z: 3 };
  const blocks = [];
  blocks.push(...slab(size, 0, "floor", "stone"));
  blocks.push(...perimeter(size, 1, "stone", "stone"));
  blocks.push(...slab(size, 2, "roof", "stone", new Set(["1,2"])));
  put(blocks, B(1, 1, 2, "door", "specific:minecraft:oak_door"));
  put(blocks, B(1, 2, 2, "door", "specific:minecraft:oak_door", { skipCount: true }));
  put(blocks, B(1, 1, 0, "chest", "specific:minecraft:chest"));
  put(blocks, B(1, 1, 1, "torch", "specific:minecraft:torch"));
  return defineBlueprint({ id: "mini_3x3x3", name: "仮拠点ミニ", size, blocks });
}

// ---------- テンプレート3: 壁一面（防壁セグメント 5x4x1） ----------
// 横に連結して防壁にする1面分。両端は柱、最上段に松明。
function buildWall() {
  const size = { x: 5, y: 4, z: 1 };
  const blocks = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < size.x; x++) {
    const end = x === 0 || x === size.x - 1;
    blocks.push(B(x, y, 0, end ? "pillar" : "wall", end ? "any_log" : "stone"));
  }
  for (const x of [0, 2, 4]) blocks.push(B(x, 3, 0, "torch", "specific:minecraft:torch"));
  return defineBlueprint({ id: "wall_5x4x1", name: "壁一面（防壁セグメント）", size, blocks });
}

// ---------- テンプレート4: 収納小屋 (5x4x4) ----------
// チェスト列が主役。背面側に2列、作業台1つ、ドア・窓・松明あり。
function buildStorage() {
  const size = { x: 5, y: 4, z: 4 };
  const blocks = [];
  blocks.push(...slab(size, 0, "floor", "any_planks"));
  blocks.push(...perimeter(size, 1, "any_planks", "any_log"));
  blocks.push(...perimeter(size, 2, "any_planks", "any_log"));
  blocks.push(...slab(size, 3, "roof", "any_planks"));
  // ドア（前面中央、2セル）
  put(blocks, B(2, 1, 3, "door", "specific:minecraft:oak_door"));
  put(blocks, B(2, 2, 3, "door", "specific:minecraft:oak_door", { skipCount: true }));
  // 窓（左右の壁、2段目）
  put(blocks, B(0, 2, 1, "window", "glass"));
  put(blocks, B(4, 2, 1, "window", "glass"));
  // チェスト列（奥の列 dz=1 に3つ、手前の列 dz=2 に2つ）
  for (const x of [1, 2, 3]) put(blocks, B(x, 1, 1, "chest", "specific:minecraft:chest"));
  for (const x of [1, 3]) put(blocks, B(x, 1, 2, "chest", "specific:minecraft:chest"));
  put(blocks, B(2, 1, 2, "crafting", "specific:minecraft:crafting_table"));
  // 松明（内装の壁際、2段目）
  put(blocks, B(1, 2, 1, "torch", "specific:minecraft:torch"));
  put(blocks, B(3, 2, 2, "torch", "specific:minecraft:torch"));
  return defineBlueprint({ id: "storage_5x4x4", name: "収納小屋", size, blocks });
}

export const BLUEPRINTS = [buildHut(), buildMini(), buildWall(), buildStorage()];
export const BLUEPRINT_BY_ID = Object.fromEntries(BLUEPRINTS.map((b) => [b.id, b]));
export function getBlueprint(id) { return BLUEPRINT_BY_ID[id] ?? null; }
