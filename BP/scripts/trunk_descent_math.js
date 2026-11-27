// trunk_descent_math.js — 0-C R-C6-2 (cyc2391 統合, 設計は tests/cyc2390_a01_0c.md):
// startWork の幹下降補正の純粋核。現行の「同一 x/z を真下へ辿る while」は横枝から
// 幹最下段へ戻れない (経路が構造的に無い)。本核は同一 typeId の連結成分
// (tree_cont_math と同一の18近傍) から run 最大の幹列を選び、その最下段へ寄せる。
// 失敗時は常に入力 target のまま返す (fail-closed: 補正は最適化であり開始の前提にしない)。
// @minecraft/server を import しない。例外を投げない。決定的。
import { isTrunkType } from "./trunk_ban.js";

export const TRUNK_DESCENT_LIMITS = Object.freeze({ maxVisited: 256, radiusXZ: 6, downMax: 32, upMax: 4 });

const DIRS = Object.freeze((() => { const out = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { if (!dx && !dy && !dz) continue; if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) === 3) continue; out.push([dx, dy, dz]); } return out; })());

export function resolveTrunkBase(target, typeIdAt, limits) {
  const fallback = (reason) => ({ loc: target ? { x: target.x, y: target.y, z: target.z } : null, typeId: target ? target.typeId : null, resolved: false, reason });
  try {
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.z) || typeof typeIdAt !== "function") return fallback("unreadable");
    if (!isTrunkType(target.typeId)) return fallback("not_trunk");
    const L = { ...TRUNK_DESCENT_LIMITS, ...(limits || {}) };
    const cache = new Map(); let readError = false;
    const read = (x, y, z) => {
      const k = `${x},${y},${z}`;
      if (cache.has(k)) return cache.get(k);
      let v = null; try { v = typeIdAt({ x, y, z }); } catch { readError = true; v = null; }
      if (typeof v !== "string") v = null;
      cache.set(k, v); return v;
    };
    if (read(target.x, target.y, target.z) !== target.typeId) return fallback("unreadable");
    const inBox = (x, y, z) => Math.abs(x - target.x) <= L.radiusXZ && Math.abs(z - target.z) <= L.radiusXZ && y >= target.y - L.downMax && y <= target.y + L.upMax;
    const comp = new Map(); const startK = `${target.x},${target.y},${target.z}`;
    comp.set(startK, { x: target.x, y: target.y, z: target.z });
    const queue = [{ x: target.x, y: target.y, z: target.z }];
    let truncated = false;
    while (queue.length) {
      const c = queue.shift();
      for (const [dx, dy, dz] of DIRS) {
        const nx = c.x + dx, ny = c.y + dy, nz = c.z + dz, nk = `${nx},${ny},${nz}`;
        if (comp.has(nk)) continue;
        if (!inBox(nx, ny, nz)) { // 箱外に同 typeId が続けば成分は閉じていない
          if (read(nx, ny, nz) === target.typeId) truncated = true;
          continue;
        }
        if (read(nx, ny, nz) !== target.typeId) continue;
        if (comp.size >= L.maxVisited) { truncated = true; continue; }
        const cell = { x: nx, y: ny, z: nz }; comp.set(nk, cell); queue.push(cell);
      }
    }
    if (readError || truncated) return fallback("truncated");
    // 列ごとの列底と run
    const cols = new Map();
    for (const cell of comp.values()) {
      const ck = `${cell.x},${cell.z}`;
      if (!cols.has(ck)) cols.set(ck, []);
      cols.get(ck).push(cell.y);
    }
    let best = null;
    for (const [ck, ys] of cols) {
      ys.sort((a, b) => a - b);
      const baseY = ys[0]; const set = new Set(ys);
      let run = 0; while (set.has(baseY + run)) run++;
      const [cx, cz] = ck.split(",").map(Number);
      const cand = { x: cx, y: baseY, z: cz, run, dist: Math.max(Math.abs(cx - target.x), Math.abs(cz - target.z)) };
      if (!best || cand.run > best.run || (cand.run === best.run && (cand.y < best.y || (cand.y === best.y && (cand.dist < best.dist || (cand.dist === best.dist && (cand.x < best.x || (cand.x === best.x && cand.z < best.z)))))))) best = cand;
    }
    if (!best) return fallback("no_base");
    if (best.run < 2) {
      if (comp.size === 1) return { loc: { x: target.x, y: target.y, z: target.z }, typeId: target.typeId, resolved: true, reason: "already_base" };
      return fallback("no_base");
    }
    const isInput = best.x === target.x && best.y === target.y && best.z === target.z;
    return { loc: { x: best.x, y: best.y, z: best.z }, typeId: target.typeId, resolved: true, reason: isInput ? "already_base" : "descended" };
  } catch { return fallback("unreadable"); }
}
