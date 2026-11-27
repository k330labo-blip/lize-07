// move_state.js — ground-walk Stage 0-A 純粋層 (cycle1621-a05)
// STRIDE_LEN は歩幅の単一の正。他ファイルへの複製禁止 (ground-walk DESIGN §2.4)。
// 純粋JS: @minecraft/server import なし・相対 import なし・例外を投げない。
// 0-B (cycle1703): main.js の noteMove から記録のみ配線済み (挙動不変)。消費側は Stage 1。
export const STRIDE_LEN = 2.0; // blocks/cycle。1サイクル=左右2歩、一歩=1.0ブロック
const SPEED_DASH = 5.0, SPEED_WALK = 3.0, SPEED_FINE = 0.05;
const LAND_DROP = 0.6, EVENT_CAP = 32; // cycle1940: 到達可能性監査 (a05) で確定した欠陥の是正。旧値2では main の接地供給 (足元-0.5セル) が早期反転し空中蓄積が最大でも通常ホバー着地で約0.7にしかならず land が 0/100 回だった。0.6 で通常着地 (下降1.2) が発動し、強弱は event.drop を受ける側が付ける
function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
export function createMoveTracker() {
  return { state: { mode: "idle", speed: 0, phase: 0, grounded: true, surface: "minecraft:air", at: 0 },
    prevPos: null, airDrop: 0, wasWet: null, events: [] };
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
    // splash: wet の立ち上がり/立ち下がり。cyc2414 MOVE-SPLASH-INIT-01 是正: 初回サンプルと teleport 到着は遷移でなく基準の取り直し (発火せず wasWet だけ合わせる)
    if (tr.wasWet === null || c.engine === "teleport") tr.wasWet = wet;
    else if (wet !== tr.wasWet) { pushEvent(tr, { kind: "splash", enter: wet, at: fin(c.nowMs) ?? 0 }); tr.wasWet = wet; }
    // land: 累積下降 >= LAND_DROP (0.6) で接地に戻った時1回。cyc2412 MOVE-LAND-LASTSTEP-EXCLUDE-01 是正: 接地した歩の下降も数える (旧形は非接地歩のみ蓄積し、最後の1歩の下降が常に対象外で1歩落下が発火しなかった)
    // cyc2415 MOVE-LAND-TELEPORT-01 是正: teleport 歩は不連続であり落下ではない。dy を数えず、発火判定より前に蓄積をリセットする (splash の teleport 再基準化と同型。リセットを判定後に置くと事前蓄積で偽発火が残る)
    if (c.engine === "teleport") tr.airDrop = 0;
    else {
      if (dy < 0) tr.airDrop += -dy;
      if (grounded && tr.prevPos && tr.airDrop >= LAND_DROP) pushEvent(tr, { kind: "land", drop: tr.airDrop, at: fin(c.nowMs) ?? 0 });
      if (grounded) tr.airDrop = 0;
    }
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
      // footstep: 位相が 0.5 / 1.0 境界を跨いだ回数ぶん。getSurface は歩あたり1回だけ呼んで共用する
      // cyc2413 MOVE-FOOTSTEP-MULTICROSS-01 是正: 旧形は真偽値判定で d>1.0 の歩で2跨ぎ時に1件喪失した
      const crosses = Math.floor((before + hDist / STRIDE_LEN) * 2) - Math.floor(before * 2);
      if (crosses > 0) {
        let surface = "minecraft:air";
        try { const s = typeof c.getSurface === "function" ? c.getSurface() : null; if (typeof s === "string" && s) surface = s; } catch { surface = "minecraft:air"; }
        tr.state.surface = surface;
        for (let i = 0; i < crosses; i++) pushEvent(tr, { kind: "footstep", surface, at: fin(c.nowMs) ?? 0 });
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
