// move_state.js — ground-walk Stage 0-A 純粋層 (cycle1621-a05)
// STRIDE_LEN は歩幅の単一の正。他ファイルへの複製禁止 (ground-walk DESIGN §2.4)。
// 純粋JS: @minecraft/server import なし・相対 import なし・例外を投げない。
// 0-B (cycle1703): main.js の noteMove から記録のみ配線済み (挙動不変)。消費側は Stage 1。
export const STRIDE_LEN = 2.0; // blocks/cycle。1サイクル=左右2歩、一歩=1.0ブロック
const SPEED_DASH = 5.0, SPEED_WALK = 3.0, SPEED_FINE = 0.05;
const LAND_DROP = 2, EVENT_CAP = 32;
function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
export function createMoveTracker() {
  return { state: { mode: "idle", speed: 0, phase: 0, grounded: true, surface: "minecraft:air", at: 0 },
    prevPos: null, airDrop: 0, wasWet: false, events: [] };
}
function pushEvent(tr, ev) { tr.events.push(ev); while (tr.events.length > EVENT_CAP) tr.events.shift(); }
export function moveTrackStep(tr, pos, dtSec, ctx) {
  try {
    if (!tr || typeof tr !== "object" || !tr.state) return tr?.state;
    const c = ctx && typeof ctx === "object" ? ctx : {};
    const p = pos && typeof pos === "object" ? pos : {};
    const x = fin(p.x), y = fin(p.y), z = fin(p.z);
    const dt = fin(dtSec);
    let dx = 0, dz = 0, dy = 0;
    if (x !== null && z !== null && tr.prevPos) { dx = x - tr.prevPos.x; dz = z - tr.prevPos.z; dy = (y ?? 0) - (tr.prevPos.y ?? 0); }
    const hDist = Math.hypot(dx, dz);
    const speed = dt && dt > 0 ? hDist / dt : 0;
    const grounded = c.grounded !== undefined ? c.grounded === true : true;
    const wet = c.wet === true;
    // splash: wet の立ち上がり/立ち下がり
    if (wet !== tr.wasWet) { pushEvent(tr, { kind: "splash", enter: wet, at: fin(c.nowMs) ?? 0 }); tr.wasWet = wet; }
    // land: 非接地中の累積下降 >=2 で接地に戻った時1回
    if (!grounded && dy < 0) tr.airDrop += -dy;
    if (grounded && tr.prevPos && tr.airDrop >= LAND_DROP) pushEvent(tr, { kind: "land", drop: tr.airDrop, at: fin(c.nowMs) ?? 0 });
    if (grounded) tr.airDrop = 0;
    // mode (先勝ち。climb/drop/bridge/dig は生成しない)
    let mode;
    if (c.engine === "teleport") mode = "teleport";
    else if (c.engine === "fly") mode = "fly";
    else if (wet) mode = "swim";
    else if (speed >= SPEED_DASH) mode = "dash";
    else if (speed >= SPEED_WALK) mode = "walk";
    else if (speed > SPEED_FINE) mode = "fine";
    else mode = "idle";
    // phase: 距離駆動。fly/teleport/idle では進めない
    let phase = tr.state.phase;
    if (mode !== "fly" && mode !== "teleport" && mode !== "idle" && hDist > 0) {
      const before = phase;
      phase = (phase + hDist / STRIDE_LEN) % 1;
      // footstep: 位相が 0.5 / 1.0 境界を跨いだ時1回。getSurface はこの時だけ呼ぶ
      const crossed = Math.floor((before + hDist / STRIDE_LEN) * 2) > Math.floor(before * 2);
      if (crossed) {
        let surface = "minecraft:air";
        try { const s = typeof c.getSurface === "function" ? c.getSurface() : null; if (typeof s === "string" && s) surface = s; } catch { surface = "minecraft:air"; }
        tr.state.surface = surface;
        pushEvent(tr, { kind: "footstep", surface, at: fin(c.nowMs) ?? 0 });
      }
    }
    tr.state = { mode, speed, phase, grounded, surface: tr.state.surface, at: fin(c.nowMs) ?? 0 };
    if (x !== null && z !== null) tr.prevPos = { x, y: y ?? 0, z };
    return tr.state;
  } catch { return tr?.state; }
}
export function drainMoveEvents(tr) {
  try { if (!tr || !Array.isArray(tr.events)) return []; const out = tr.events; tr.events = []; return out; } catch { return []; }
}
