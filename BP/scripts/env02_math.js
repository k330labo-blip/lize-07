// env02_math.js — ENV-02 溶岩海の足場脱出 (cycle0340): 純粋核
// 知覚 (岸走査・材料選定・必要数) と出口 (lavaStuck 累計) の判断だけを持つ。
// @minecraft/server を import しない。例外を投げない。走査は probe 関数経由。
// 材料適格は「不燃・非重力落下・フルブロック」の許可リスト方式 (安全側)。
// ground-walk 0-C の橋材選択と除外方針 (砂・砂利・葉・貴重品・設置物を除く) を共有する。

export const ESCAPE_BLOCK_IDS = Object.freeze([
  "minecraft:cobblestone", "minecraft:stone", "minecraft:cobbled_deepslate",
  "minecraft:blackstone", "minecraft:netherrack", "minecraft:dirt",
  "minecraft:andesite", "minecraft:diorite", "minecraft:granite",
  "minecraft:tuff", "minecraft:deepslate", "minecraft:basalt",
  "minecraft:end_stone", "minecraft:obsidian",
]);
const ESCAPE_SET = new Set(ESCAPE_BLOCK_IDS);
export const SHORE_SENTINEL = 999;
export const SHORE_MAX_SCAN = 32;
export const LAVA_STUCK_DECLARE_MS = 30000;

// pickEscapeBlock(items) -> { id, count, total }
// items: { typeId: count } マップ。代表 id は最多所持の許可ブロック。
export function pickEscapeBlock(items) {
  try {
    let bestId = null, bestCnt = 0, total = 0;
    if (items && typeof items === "object") {
      for (const id of ESCAPE_BLOCK_IDS) {
        const n = items[id];
        if (typeof n === "number" && Number.isFinite(n) && n > 0) {
          total += n;
          if (n > bestCnt) { bestCnt = n; bestId = id; }
        }
      }
    }
    return { id: bestId, count: bestCnt, total };
  } catch { return { id: null, count: 0, total: 0 }; }
}
export function isEscapeBlockId(id) { try { return ESCAPE_SET.has(id); } catch { return false; } }

// shoreNeedFor(dist, sink) -> 必要ブロック数。岸なし圏 (8..32) 以外は番兵 999。
export function shoreNeedFor(dist, sink) {
  try {
    if (typeof dist !== "number" || !Number.isFinite(dist) || dist < 8 || dist > SHORE_MAX_SCAN) return SHORE_SENTINEL;
    const s = typeof sink === "number" && Number.isFinite(sink) ? Math.max(0, Math.min(3, Math.floor(sink))) : 0;
    return Math.ceil(dist) + 3 + s;
  } catch { return SHORE_SENTINEL; }
}

const SOLID_EXCLUDE = new Set(["minecraft:air", "minecraft:lava", "minecraft:flowing_lava", "minecraft:water", "minecraft:flowing_water", "minecraft:fire", "minecraft:soul_fire"]);
export function isShoreSolid(typeId) {
  try { return typeof typeId === "string" && typeId.length > 0 && !SOLID_EXCLUDE.has(typeId); } catch { return false; }
}
export function isLavaId(typeId) { try { return typeId === "minecraft:lava" || typeId === "minecraft:flowing_lava"; } catch { return false; } }

// scanShore(probe, origin) -> { dist, dirX, dirZ }
// probe(x,y,z) -> typeId | null (読めないセルは null=UNKNOWN として固体扱いしない)
// 8方位を距離昇順に走査し、足元セルが溶岩でなく支持セル (足元-1) が固体な列を岸とする。
export function scanShore(probe, origin) {
  try {
    if (typeof probe !== "function" || !origin) return { dist: SHORE_SENTINEL, dirX: 0, dirZ: 0 };
    const ox = Math.floor(origin.x), oy = Math.floor(origin.y), oz = Math.floor(origin.z);
    const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (let d = 1; d <= SHORE_MAX_SCAN; d++) {
      for (const [dx, dz] of DIRS) {
        const cx = ox + dx * d, cz = oz + dz * d;
        const feet = probe(cx, oy, cz);
        if (isLavaId(feet)) continue;
        const support = probe(cx, oy - 1, cz);
        if (isShoreSolid(support) || isShoreSolid(feet)) {
          const m = Math.hypot(dx, dz) || 1;
          return { dist: Math.round(Math.hypot(dx * d, dz * d) * 10) / 10, dirX: dx / m, dirZ: dz / m };
        }
      }
    }
    return { dist: SHORE_SENTINEL, dirX: 0, dirZ: 0 };
  } catch { return { dist: SHORE_SENTINEL, dirX: 0, dirZ: 0 }; }
}

// lavaStuckStep(state, inLava, nowMs, progressed) -> { state, declare }
// 出口カウンタ: 溶岩浸漬が続き進捗も無い時間が LAVA_STUCK_DECLARE_MS を超えたら
// 1回だけ declare=true。溶岩を出ればリセット。別経路で毎tick消されないよう
// state は呼び出し側が保持し、この関数だけが更新する。
export function lavaStuckStep(state, inLava, nowMs, progressed) {
  try {
    const now = typeof nowMs === "number" && Number.isFinite(nowMs) ? nowMs : 0;
    if (!inLava) return { state: null, declare: false };
    let s = state && typeof state === "object" ? state : null;
    if (!s || typeof s.since !== "number" || !Number.isFinite(s.since) || s.since > now) s = { since: now, noted: false, lastProgressAt: now };
    if (progressed) s = { ...s, lastProgressAt: now };
    const base = Math.max(s.since, s.lastProgressAt || s.since);
    const declare = !s.noted && now - base >= LAVA_STUCK_DECLARE_MS;
    if (declare) s = { ...s, noted: true };
    return { state: s, declare };
  } catch { return { state: null, declare: false }; }
}
