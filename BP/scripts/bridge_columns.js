// bridge_columns.js — ground-walk Stage 1A 列分類アダプタ (cycle0740, DESIGN §3 / cycle0740-a05 仕様)
// scanColumn (nav.js) と実 probe から、橋純粋核 bridgeScan(columns) へ渡せる列配列を生成する層。
// 未配線 (main から import しない。発火配線は Stage 1B)。例外を投げない。@minecraft/server 非依存。
import { scanColumn, isUnknownCell } from "./nav.js";

export const BRIDGE_COLUMNS_MAX = 64;

function probeSafe(probe, x, y, z) {
  try { const c = probe(x, y, z); return c || null; } catch { return null; }
}
function isUnknown(c) { return !c || isUnknownCell(c); }

// Bresenham 列挙 (両端含む)
function enumerateColumns(x0, z0, x1, z1) {
  const cols = [];
  let dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
  let err = dx - dz, x = x0, z = z0;
  for (let guard = 0; guard < 10000; guard++) {
    cols.push({ x, z });
    if (x === x1 && z === z1) break;
    const e2 = 2 * err;
    if (e2 > -dz) { err -= dz; x += sx; }
    if (e2 < dx) { err += dx; z += sz; }
  }
  return cols;
}

function classifyColumn(probe, x, z, refY) {
  const baseY = Math.floor(refY);
  let node = null;
  try { node = scanColumn(probe, x, z, refY); } catch { node = null; }
  if (node && !node.water && node.floorY - refY <= 1.5) return { kind: "walkable", floorY: node.floorY };
  // 床が基準+2以上 (2段壁等) は歩行列ではない。直接読みの分類へ落とす
  if (node && node.water) {
    // 水深: 水面 (node.floorY) から下向きに water の連続を数える。5で読み切り (deep_water 棄却が正)
    let depth = 0;
    for (let y = Math.floor(node.floorY); y > Math.floor(node.floorY) - 5; y--) {
      const c = probeSafe(probe, x, y, z);
      if (isUnknown(c)) return { kind: "unknown", floorY: null };
      if (c.water) { depth++; continue; }
      break;
    }
    return { kind: "gap", waterDepth: Math.max(1, depth), floorY: null };
  }
  // ノードなし: null の3義 (窓外の床/封鎖/未知) を baseY-1..baseY+1 の直接読みで切り分ける
  const below = probeSafe(probe, x, baseY - 1, z);
  const body = probeSafe(probe, x, baseY, z);
  const head = probeSafe(probe, x, baseY + 1, z);
  if (isUnknown(below) || isUnknown(body) || isUnknown(head)) return { kind: "unknown", floorY: null };
  if (below.lava || body.lava || head.lava) return { kind: "lava", floorY: null };
  const blockedCell = (c) => !!(c.solid || c.hazard || (c.door && !c.doorOpenable));
  if (blockedCell(body) || blockedCell(head)) return { kind: "blocked", floorY: null };
  if (below.solid) return { kind: "walkable", floorY: (baseY - 1) + (below.top ?? 1) };
  return { kind: "gap", floorY: null };
}

// classifyBridgeColumns(probe, from, to, opts) -> { ok, reason?, columns, floorYs }
// from/to: {x, z}。opts.refY: 分類の基準床面 (有限数でなければ推測せず no_refy)
export function classifyBridgeColumns(probe, from, to, opts = {}) {
  try {
    if (typeof probe !== "function" || !from || !to || !Number.isFinite(from.x) || !Number.isFinite(from.z) || !Number.isFinite(to.x) || !Number.isFinite(to.z)) {
      return { ok: false, reason: "bad_input", columns: [], floorYs: [] };
    }
    const refY = opts && typeof opts === "object" ? opts.refY : undefined;
    if (!Number.isFinite(refY)) return { ok: false, reason: "no_refy", columns: [], floorYs: [] };
    const cols = enumerateColumns(Math.floor(from.x), Math.floor(from.z), Math.floor(to.x), Math.floor(to.z));
    if (!cols.length || cols.length > BRIDGE_COLUMNS_MAX) return { ok: false, reason: "bad_input", columns: [], floorYs: [] };
    const columns = [], floorYs = [];
    for (const { x, z } of cols) {
      const r = classifyColumn(probe, x, z, refY);
      const col = { kind: r.kind };
      if (typeof r.waterDepth === "number") col.waterDepth = r.waterDepth;
      columns.push(col);
      floorYs.push(typeof r.floorY === "number" ? r.floorY : null);
    }
    return { ok: true, columns, floorYs };
  } catch {
    return { ok: false, reason: "bad_input", columns: [], floorYs: [] };
  }
}
