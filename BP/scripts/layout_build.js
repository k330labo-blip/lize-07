// レイアウト→建築変換（リゼ／LIZE-07）
// 工場設計（factory_design.js の出力レイアウト想定形式）を、建築ブループリント形式
// （blueprints.js の blocks と同形のセル列）に変換する純粋JS。@minecraft/server 非依存。
//
// 入力 design の想定形式（factory_design.js 未完成のため本ファイルが正として定義し、
// 差異は layout_build.md の申し送りに明記する）:
//   {
//     id?, name?,
//     lines: [                       // 生産ライン（複数可）
//       {
//         id?, name?,
//         input?:  { item },           // 投入素材（情報用。配置は storage が決める）
//         output?: { item },           // 産出素材（情報用）
//         stages: [                    // 工程順（=素材の流れる順）
//           { machine: "orbital_foundry:crusher", count?: 1, note? },
//           ...
//         ],
//       }, ...
//     ],
//     stages?: [...],                  // lines が無い場合の単一ライン省略形
//     machines?: [{ type|machine, count? }],  // stages も無い場合の省略形
//     power?: {
//       generators: [{ type: "orbital_foundry:coal_generator", count?: 1 }],
//       battery?: { type: "orbital_foundry:battery", count?: 1 } | null,
//       cable?: "orbital_foundry:power_cable",
//     },
//     storage?: { input?: itemId, output?: itemId },  // コンテナの上書き
//     belt?: itemId,                   // ベルトの上書き（既定 conveyor_1）
//     floor?: materialKey | null,      // 床素材（blueprints の material キー。null で床なし）
//   }
//
// 出力:
//   {
//     cells: [ { x, y, z, dx, dy, dz, item, material, role, facing?, io? } ],
//       // x/y/z と dx/dy/dz は同じ値（blueprints.js の blocks と同形にするための別名）。
//       // material は常に "specific:<itemId>"（床だけは material キーをそのまま使う）。
//       // cells は設置順（steps の連結順）に並んでいる。
//     materials: { "<itemId>": 個数 },   // materialsSummaryOf と同形
//     steps: [ { phase: "floor"|"machine"|"belt"|"power", cells: [...] } ],
//     size: { x, y, z },
//     lines: [ { index, bandZ, machineXs: [...], firstMachineX, lastMachineX } ],  // 実行部・検証用
//     warnings: [ string ],
//   }
//
// 配置の作法（軌道工廠 v0.8.311 の実仕様に基づく。出典は layout_build.md）:
//   - 機械は「背面給電・左右搬入・前面搬出」。ラインは +x 方向に流れ、機械は南向き
//     （前面=+z）に置く。帯（バンド）の構成は dz 相対で:
//       dz=0: 配線列（発電機→電線。機械の背面に電線が隣接する）
//       dz=1: 機械列（投入コンテナ → ベルト → [フィーダベルト, 機械] の繰り返し）
//       dz=2: 搬出ベルト列（各機械の前面。次工程のフィーダ列では北向きに曲がり、
//             dz=1 のフィーダへ合流する。末端に産出コンテナ）
//   - ライン間は1セルの通路を空ける（バンド周期 dz=4）。
//   - 設置順は 土台（床）→ 機械・コンテナ → ベルト → 配線・発電機。
//     同フェーズ内は奥（dz 大）から手前へ、x 昇順。自分を閉じ込めない順序。

import { resolveMaterialItem } from "./blueprints.js";

// ---------- 既定値・既知ID（v0.8.311 実データ） ----------
export const DEFAULT_BELT = "orbital_foundry:conveyor_1";
export const DEFAULT_CABLE = "orbital_foundry:power_cable";
export const DEFAULT_CONTAINER = "orbital_foundry:industrial_container_mk1";
export const DEFAULT_GENERATOR = "orbital_foundry:coal_generator";
export const DEFAULT_FLOOR = "stone"; // blueprints の material キー（→ cobblestone）

export const BELTS = [
  "orbital_foundry:conveyor_1", "orbital_foundry:conveyor_2", "orbital_foundry:conveyor_3",
];
export const KNOWN_MACHINES = new Set([
  "orbital_foundry:crusher", "orbital_foundry:electric_furnace", "orbital_foundry:alloy_furnace",
  "orbital_foundry:assembler", "orbital_foundry:press", "orbital_foundry:refinery",
  "orbital_foundry:ore_beneficiator", "orbital_foundry:auto_crafter",
  "orbital_foundry:grower_mk1", "orbital_foundry:grower_mk2", "orbital_foundry:grower_mk3",
  "orbital_foundry:mob_spawner", "orbital_foundry:mob_crusher", "orbital_foundry:incinerator",
  "orbital_foundry:oil_pump", "orbital_foundry:fixed_drill",
]);
export const KNOWN_GENERATORS = new Set([
  "orbital_foundry:coal_generator", "orbital_foundry:solar_generator",
  "orbital_foundry:thermal_generator", "orbital_foundry:nuclear_reactor",
  "orbital_foundry:creative_generator",
]);
export const KNOWN_CONTAINERS = new Set([
  "orbital_foundry:industrial_container_mk1", "orbital_foundry:industrial_container_mk2",
  "orbital_foundry:orbital_container_mk3", "orbital_foundry:singularity_container",
  "minecraft:chest",
]);
export const KNOWN_BATTERIES = new Set([
  "orbital_foundry:battery", "orbital_foundry:battery_mk2", "orbital_foundry:battery_mk3",
]);

// 設置フェーズの順序（土台→機械→ベルト→配線）
export const PHASE_ORDER = ["floor", "machine", "belt", "power"];
const PHASE_OF_ROLE = {
  floor: "floor",
  machine: "machine", container: "machine",
  belt: "belt",
  generator: "power", battery: "power", cable: "power",
};

// バンド形状（dz 相対）
const DZ_CABLE = 0, DZ_MACHINE = 1, DZ_OUT = 2, BAND_STRIDE = 4;

// ---------- 入力の正規化 ----------
function normStage(s) {
  if (!s || typeof s !== "object") return null;
  const machine = s.machine ?? s.type ?? s.block ?? null;
  if (!machine) return null;
  const count = Number.isFinite(s.count) && s.count > 0 ? Math.floor(s.count) : 1;
  return { machine, count, note: s.note ?? null };
}

function normLines(design) {
  if (Array.isArray(design.lines) && design.lines.length) {
    return design.lines.map((l) => ({
      id: l?.id ?? null, name: l?.name ?? null,
      stages: (Array.isArray(l?.stages) ? l.stages : []).map(normStage).filter(Boolean),
    }));
  }
  const stages = (Array.isArray(design.stages) ? design.stages
    : Array.isArray(design.machines) ? design.machines : []).map(normStage).filter(Boolean);
  return stages.length ? [{ id: null, name: null, stages }] : [];
}

function normPower(design, warnings) {
  const p = design.power ?? null;
  const generators = [];
  if (p && Array.isArray(p.generators)) {
    for (const g of p.generators) {
      const type = g?.type ?? g?.generator ?? null;
      if (!type) continue;
      const count = Number.isFinite(g.count) && g.count > 0 ? Math.floor(g.count) : 1;
      for (let i = 0; i < count; i++) generators.push(type);
    }
  }
  if (!generators.length) {
    generators.push(DEFAULT_GENERATOR);
    warnings.push(`power.generators 未指定のため既定の発電機 ${DEFAULT_GENERATOR} ×1 を仮定した`);
  }
  const batteries = [];
  if (p?.battery) {
    const type = p.battery.type ?? DEFAULT_BATTERY_FALLBACK;
    const count = Number.isFinite(p.battery.count) && p.battery.count > 0 ? Math.floor(p.battery.count) : 1;
    for (let i = 0; i < count; i++) batteries.push(type);
  }
  return { generators, batteries, cable: p?.cable ?? DEFAULT_CABLE };
}
const DEFAULT_BATTERY_FALLBACK = "orbital_foundry:battery";

// ---------- 本体 ----------
export function layoutToBuild(design, opts = {}) {
  const warnings = [];
  if (!design || typeof design !== "object") {
    return { cells: [], materials: Object.create(null), steps: [], size: { x: 0, y: 0, z: 0 }, lines: [], warnings: ["design が空"] };
  }
  const beltItem = opts.belt ?? design.belt ?? DEFAULT_BELT;
  // floor は null 明示で「床なし」。undefined のときだけ既定値を使う（?? では null が潰れる）
  const floorMaterial = opts.floor !== undefined ? opts.floor
    : design.floor !== undefined ? design.floor : DEFAULT_FLOOR;
  const inContainer = design.storage?.input ?? DEFAULT_CONTAINER;
  const outContainer = design.storage?.output ?? DEFAULT_CONTAINER;
  const power = normPower(design, warnings);
  const lines = normLines(design);
  if (!lines.length) warnings.push("ライン（stages）が空。機械は配置されない");

  const raw = []; // {x,y,z,item,material,role,facing?,io?} 設置前（正規化前の座標）
  const cell = (x, y, z, item, role, extra = {}) =>
    raw.push({ x, y, z, item, material: extra.material ?? `specific:${item}`, role, ...(extra.facing ? { facing: extra.facing } : {}), ...(extra.io ? { io: extra.io } : {}) });

  const lineInfos = [];

  lines.forEach((line, li) => {
    const bandZ = li * BAND_STRIDE;
    // 単位列の展開（stage × count → [フィーダ, 機械] の列）
    const units = [];
    for (const st of line.stages) {
      if (!KNOWN_MACHINES.has(st.machine)) warnings.push(`未知の機械ID: ${st.machine}（そのまま配置する）`);
      if (st.count > 1) warnings.push(`stage ${st.machine} が ${st.count} 台: 各台が前段ラインから取り込む直列配置にした。等分分配が必要なら分配器（splitter）の追加が要る`);
      for (let i = 0; i < st.count; i++) units.push(st.machine);
    }
    if (!units.length) { warnings.push(`ライン ${li} に工程がない`); return; }

    // x 配置: dz=1 列は [コンテナ(0), ベルト(1), フィーダ(2), 機械(3), フィーダ(4), 機械(5), ...]
    const machineXs = units.map((_, i) => 3 + i * 2);
    const firstMachineX = machineXs[0];
    const lastMachineX = machineXs[machineXs.length - 1];
    const outContainerX = lastMachineX + 2;

    // --- 機械フェーズ: 機械とコンテナ ---
    cell(0, 1, bandZ + DZ_MACHINE, inContainer, "container", { io: "input" });
    units.forEach((m, i) => cell(machineXs[i], 1, bandZ + DZ_MACHINE, m, "machine", { facing: "south" }));
    cell(outContainerX, 1, bandZ + DZ_OUT, outContainer, "container", { io: "output" });

    // --- ベルトフェーズ ---
    // dz=1: コンテナ→初台フィーダの接続ベルトと、各フィーダ（東向き＝機械の左側面へ搬入）
    cell(1, 1, bandZ + DZ_MACHINE, beltItem, "belt", { facing: "east" });
    for (const fx of machineXs.map((x) => x - 1)) cell(fx, 1, bandZ + DZ_MACHINE, beltItem, "belt", { facing: "east" });
    // dz=2: 搬出ライン（各機械の前面）。次工程のフィーダ列では北向きに曲がって合流する。
    const turnXs = new Set(machineXs.slice(1).map((x) => x - 1));
    for (let x = firstMachineX; x <= lastMachineX + 1; x++) {
      cell(x, 1, bandZ + DZ_OUT, beltItem, "belt", { facing: turnXs.has(x) ? "north" : "east" });
    }

    // --- 配線フェーズ: 発電機・蓄電池（dz=0 列の先頭）→ 電線（機械の背面に連続） ---
    const powerUnits = [...power.generators, ...power.batteries];
    powerUnits.forEach((t, i) => {
      const role = i < power.generators.length ? "generator" : "battery";
      if (role === "generator" && !KNOWN_GENERATORS.has(t)) warnings.push(`未知の発電機ID: ${t}（そのまま配置する）`);
      cell(i, 1, bandZ + DZ_CABLE, t, role, role === "generator" ? { facing: "south" } : {});
    });
    for (let x = powerUnits.length; x <= lastMachineX; x++) {
      cell(x, 1, bandZ + DZ_CABLE, power.cable, "cable");
    }

    // --- 床フェーズ: バンド全域（x は全セルの範囲、dz は帯の3列） ---
    if (floorMaterial !== null) {
      const maxX = Math.max(outContainerX, lastMachineX);
      const floorItem = resolveMaterialItem(floorMaterial);
      for (let x = 0; x <= maxX; x++) for (let dz = 0; dz <= 2; dz++) {
        cell(x, 0, bandZ + dz, floorItem, "floor", { material: floorMaterial });
      }
    }

    lineInfos.push({ index: li, bandZ, machineXs, firstMachineX, lastMachineX, outContainerX });
  });

  // 座標正規化（最小を 0 に）と blueprints 互換フィールドの付与
  let size = { x: 0, y: 0, z: 0 };
  let cells = [];
  if (raw.length) {
    const minX = Math.min(...raw.map((c) => c.x)), minY = Math.min(...raw.map((c) => c.y)), minZ = Math.min(...raw.map((c) => c.z));
    const maxX = Math.max(...raw.map((c) => c.x)), maxY = Math.max(...raw.map((c) => c.y)), maxZ = Math.max(...raw.map((c) => c.z));
    size = { x: maxX - minX + 1, y: maxY - minY + 1, z: maxZ - minZ + 1 };
    cells = raw.map((c) => {
      const x = c.x - minX, y = c.y - minY, z = c.z - minZ;
      const out = { x, y, z, dx: x, dy: y, dz: z, item: c.item, material: c.material, role: c.role };
      if (c.facing) out.facing = c.facing;
      if (c.io) out.io = c.io;
      return out;
    });
  }

  // 設置順: フェーズ順 → dz 降順（奥から） → x 昇順 → z 昇順で安定化
  const phaseIdx = (c) => PHASE_ORDER.indexOf(PHASE_OF_ROLE[c.role] ?? "belt");
  cells.sort((a, b) => (phaseIdx(a) - phaseIdx(b)) || (b.dz - a.dz) || (a.dx - b.dx) || (a.dz - b.dz));
  const steps = PHASE_ORDER.map((phase) => ({ phase, cells: cells.filter((c) => PHASE_OF_ROLE[c.role] === phase) })).filter((s) => s.cells.length);

  // 材料集計（item 基準。床は material キーの代表itemに解決できないため material キーで数える）
  const materials = Object.create(null);
  for (const c of cells) {
    const key = c.item ?? c.material;
    materials[key] = (materials[key] ?? 0) + 1;
  }

  return { cells, materials, steps, size, lines: lineInfos, warnings };
}
