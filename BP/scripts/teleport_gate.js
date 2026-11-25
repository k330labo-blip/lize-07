// teleport_gate.js — 位置設定の統一ゲート (basics-clip-audit gate_draft を正式統合, cycle0504)
// キュー3ステップ①: ウォッチドッグのホップが mode:"hop" で本ゲートを通る。
//
// 設計: 「位置設定は単一のゲートを通す」。fly.js / nav.js と同じ流儀の純粋JS
// (probe(x,y,z) 注入式、実テレポートは呼び出し側)。セル分類は nav.js の
// classifyTypeId 形式 { solid, lava, hazard, door, water, pass, unknown } を前提とする。
//
// 体積の定義 (2 層):
//   Tier1 (hard): 足・頭・目 (main.js bodyCells と同じ floor(y), floor(y+1), floor(y+1.62))
//                 — 全ての位置設定で必須。未知セルは fail-closed。
//   Tier2 (crown): 足+2 のセル (原点列のみ)
//                 — 離散テレポート (ホップ/フォールバック/召喚/坑道/救済) と
//                   作業の立ち位置では hard。通過ステップでは hard にしない
//                   (樹冠の下を飛ぶたび ground 委譲になる副作用が大きいため。
//                    basics-leaves-body §3 の結論どおり、crown は「滞在」側で塞ぐ)。
//
// guardedTeleport の代替ポリシーはモードで選ぶ:
//   "hop"   (ウォッチドッグ): 区間が塞がれていたら壁の手前で止まる (shift)。
//             着地が塞がれていたら近傍の空きへ shift、それも無ければ hold。
//   "work"  (作業文脈の離散移動): 掘れる自然ブロックが区間を塞ぐなら dig を返す。
//             掘れない場合は hop と同じ (shift/hold)。
//   "place" (召喚/catchup/go_owner/帰還): 着地の空きだけを見る (区間は見ない:
//             長距離テレポートで区間検査は無意味)。塞がれていたら shift、
//             無ければ hold (呼び出し側は「置かない」= 現位置維持 or 主人の位置)。
//   "tunnel"(坑道前進/帰路): 1 セル移動。塞がれていたら dig (外から掘る)、
//             掘れなければ hold。basics-suffocate の guardedStepTeleport を内包する。
//
// 戻り値: { action: "go", dest } | { action: "shift", dest, why }
//       | { action: "dig", cells, dest } | { action: "hold", why }

export function tier1Rows(y) {
  return [...new Set([Math.floor(y), Math.floor(y + 1), Math.floor(y + 1.62)])];
}

function cellBlocked(c) {
  return !c || c.unknown === true || !!(c.solid || c.lava || c.hazard || c.door);
}
function cellUnknown(c) { return !c || c.unknown === true; }

// 点 pos の体積検査。crown: true なら Tier2 も hard に含める。
// 戻り値: { ok, tier1: [blockedCells], crown: cell|null, unknown: bool }
export function volumeClearAt(probe, pos, opts = {}) {
  const fx = Math.floor(pos.x), fz = Math.floor(pos.z);
  const tier1 = [];
  let unknown = false;
  for (const y of tier1Rows(pos.y)) {
    const c = probe(fx, y, fz);
    if (cellUnknown(c)) unknown = true;
    if (cellBlocked(c)) tier1.push({ x: fx, y, z: fz });
  }
  let crown = null;
  if (opts.crown) {
    const cy = Math.floor(pos.y) + 2;
    const c = probe(fx, cy, fz);
    if (cellUnknown(c)) unknown = true;
    if (cellBlocked(c)) crown = { x: fx, y: cy, z: fz };
  }
  return { ok: tier1.length === 0 && !crown && !unknown, tier1, crown, unknown };
}

// from→to の区間を step 刻みでサンプルし、Tier1 体積が固体に触れる最初の点を返す。
// 戻り値: { ok, at: 点|null, cells: [塞いでいるセル] }
export function segmentBlocked(probe, from, to, opts = {}) {
  const step = opts.step ?? 0.5;
  const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  if (d > (opts.maxDist ?? 16)) return { ok: true, at: null, cells: [], skipped: true };
  const n = Math.max(1, Math.ceil(d / step));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t };
    const v = volumeClearAt(probe, p, { crown: false });
    if (v.tier1.length) return { ok: false, at: p, cells: v.tier1 };
  }
  return { ok: true, at: null, cells: [] };
}

// 近傍の空き (safeSpotNear の意味論 + crown)。見つからなければ null。
// 探索窓は safeSpotNear と同じ: 水平 13 オフセット × dy [0,1,-1,2,3,-2,4]。
export function nearestClearVolume(probe, loc, opts = {}) {
  const bx = Math.floor(loc.x), by = Math.floor(loc.y), bz = Math.floor(loc.z);
  const offs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
  const dys = opts.upFirst ? [0, 1, 2, 3, 4, 5, 6, 7, 8, -1] : [0, 1, -1, 2, 3, -2, 4];
  for (const dy of dys) for (const [dx, dz] of offs) {
    const dest = { x: bx + dx + 0.5, y: by + dy, z: bz + dz + 0.5 };
    if (volumeClearAt(probe, dest, { crown: true }).ok) return dest;
  }
  return null;
}

// 区間が塞がれている場合に「手前で止まる」点: 最初の遮蔽点の手前 pullback だけ
// 戻った点で、体積 (Tier1+crown) が空いているもの。無ければ null。
export function stopBeforeBlock(probe, from, to, opts = {}) {
  const seg = segmentBlocked(probe, from, to, opts);
  if (seg.ok) return { ...to };
  const pullback = opts.pullback ?? 0.4;
  const d = Math.hypot(seg.at.x - from.x, seg.at.y - from.y, seg.at.z - from.z);
  if (d <= pullback) return null;
  const t = (d - pullback) / Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const dest = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t };
  return volumeClearAt(probe, dest, { crown: true }).ok ? dest : null;
}

// 統一ゲート本体。
// opts: { mode: "hop"|"work"|"place"|"tunnel", canDig?: (cell) => bool }
export function guardedTeleport(probe, from, to, opts = {}) {
  const mode = opts.mode || "hop";
  // tunnel モード (queue3 step3, cycle0543): 高さ2坑道では crown(足+2) は天井そのもので
  // 常に固体になるため crown を hard にすると坑道が到達不能になる (監査 a06)。
  // tunnel では Tier1 のみ hard。Tier1 が塞がれていれば掘れる自然ブロックだけ dig、
  // それ以外は shift せず hold (道を外れない)。crown は無視する。
  if (mode === "tunnel") {
    const landT = volumeClearAt(probe, to, { crown: false });
    if (landT.unknown) return { action: "hold", why: "landing_unknown" };
    if (landT.tier1.length) {
      const cells = [...new Map(landT.tier1.map((c) => [`${c.x},${c.y},${c.z}`, c])).values()];
      if (opts.canDig && cells.every((c) => opts.canDig(c))) return { action: "dig", cells, dest: { ...to } };
      return { action: "hold", why: "landing_blocked" };
    }
    const segT = segmentBlocked(probe, from, to, opts);
    if (!segT.ok) {
      const cells = [...new Map(segT.cells.map((c) => [`${c.x},${c.y},${c.z}`, c])).values()];
      if (opts.canDig && cells.length && cells.every((c) => opts.canDig(c))) return { action: "dig", cells, dest: { ...to } };
      return { action: "hold", why: "segment_blocked" };
    }
    return { action: "go", dest: { ...to } };
  }
  // 1) 着地の体積 (離散テレポートは crown も hard)
  const land = volumeClearAt(probe, to, { crown: true });
  if (!land.ok) {
    const alt = nearestClearVolume(probe, to, { upFirst: mode === "tunnel" });
    if (alt) return { action: "shift", dest: alt, why: land.crown ? "crown_blocked" : "landing_blocked" };
    return { action: "hold", why: land.crown ? "crown_blocked" : "landing_blocked" };
  }
  // 2) place モードは区間を見ない (長距離前提)
  if (mode === "place") return { action: "go", dest: { ...to } };
  // 3) 区間検査 (Tier1)
  const seg = segmentBlocked(probe, from, to, opts);
  if (!seg.ok) {
    if ((mode === "work" || mode === "tunnel") && opts.canDig) {
      const cells = [...new Map(seg.cells.map((c) => [`${c.x},${c.y},${c.z}`, c])).values()];
      if (cells.length && cells.every((c) => opts.canDig(c))) return { action: "dig", cells, dest: { ...to } };
    }
    const stop = stopBeforeBlock(probe, from, to, opts);
    if (stop) return { action: "shift", dest: stop, why: "segment_blocked" };
    return { action: "hold", why: "segment_blocked" };
  }
  return { action: "go", dest: { ...to } };
}

// 通過ステップ用 (fly/nav/moveDirect の行き先): Tier1 のみ hard。
// crown は「滞在」側 (作業の立ち位置・離散テレポート) で塞ぐため、ここでは報告のみ。
export function guardedStepDest(probe, pos) {
  const v = volumeClearAt(probe, pos, { crown: true });
  return { blocked: v.tier1.length > 0 || v.unknown, crownBlocked: !!v.crown, cells: v.tier1 };
}
