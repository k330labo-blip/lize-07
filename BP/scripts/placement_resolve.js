// placement_resolve.js — 0-C4 R-C4-2 (cyc2376): 設置位置 (placement) の実行側 reader 純粋核。
// 設計: tests/cyc2374_a02_rc4.md §4 (Step 2)。世界を読まない・例外を投げない・決定的。
// 解決は「受理した同一呼び出しのスナップショット」(ownerPos/viewDir/anchorCell) に対してのみ行う。
// 方向は主人視点で固定: viewDir は水平量子化済みの単位ベクトル {x,z}。
// 右手ベクトル: 視線 (dx,dz) に対し (-dz, dx)。南向き (0,1) → 西 (-1,0) が右、東向き (1,0) → 南 (0,1) が右。

export function dirOffsetOf(dir, viewDir) {
  try {
    if (!dir) return null;
    const v = viewDir && Number.isFinite(viewDir.x) && Number.isFinite(viewDir.z) ? { x: Math.sign(viewDir.x), z: Math.sign(viewDir.z) } : null;
    switch (dir) {
      case "上": return { x: 0, y: 1, z: 0 };
      case "下": return { x: 0, y: -1, z: 0 };
      case "前": return v ? { x: v.x, y: 0, z: v.z } : null;
      case "後": case "後ろ": return v ? { x: -v.x, y: 0, z: -v.z } : null;
      case "右": case "隣": case "となり": case "横": return v ? { x: -v.z, y: 0, z: v.x } : null;
      case "左": return v ? { x: v.z, y: 0, z: -v.x } : null;
      default: return null;
    }
  } catch { return null; }
}

// 入力: { placement, ownerPos, viewDir, anchorCell, anchorExpected }
//   placement: {mode:"here"|"relative"|"unspecified", anchor, dir}
//   ownerPos: 受理時スナップショットの発話者セル {x,y,z}
//   anchorCell: relative+アンカー指定時に呼び出し側が探した実セル。anchorExpected=true で null なら anchor_not_found
// 出力: { ok:true, cell:{x,y,z}, via } | { ok:false, reason:"no_snapshot"|"anchor_not_found"|"bad_dir"|"no_placement" }
export function resolvePlacement(input) {
  try {
    const pl = input?.placement;
    if (!pl || typeof pl.mode !== "string") return { ok: false, reason: "no_placement" };
    const owner = input?.ownerPos;
    if (!owner || !Number.isFinite(owner.x) || !Number.isFinite(owner.y) || !Number.isFinite(owner.z)) return { ok: false, reason: "no_snapshot" };
    const base = { x: Math.floor(owner.x), y: Math.floor(owner.y), z: Math.floor(owner.z) };
    if (pl.mode === "here" || pl.mode === "unspecified") return { ok: true, cell: base, via: pl.mode };
    if (pl.mode === "relative") {
      if (input?.anchorExpected) {
        const a = input?.anchorCell;
        if (!a || !Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.z)) return { ok: false, reason: "anchor_not_found" };
        if (!pl.dir) return { ok: true, cell: { x: Math.floor(a.x), y: Math.floor(a.y), z: Math.floor(a.z) }, via: "relative" };
        const off = dirOffsetOf(pl.dir, input?.viewDir);
        if (!off) return { ok: false, reason: "bad_dir" };
        return { ok: true, cell: { x: Math.floor(a.x) + off.x, y: Math.floor(a.y) + off.y, z: Math.floor(a.z) + off.z }, via: "relative" };
      }
      if (!pl.dir) return { ok: true, cell: base, via: "relative" };
      const off = dirOffsetOf(pl.dir, input?.viewDir);
      if (!off) return { ok: false, reason: "bad_dir" };
      return { ok: true, cell: { x: base.x + off.x, y: base.y + off.y, z: base.z + off.z }, via: "relative" };
    }
    return { ok: false, reason: "no_placement" };
  } catch { return { ok: false, reason: "no_placement" }; }
}

// 数量付き設置: 解決セルから step 方向へ連結した相対セル列 (startBuild の cells 形式)。
// step が null/ゼロなら +x を既定にする (設計 §4 Step 5: 連結方向は viewDir 側を呼び出し側が渡す)。
export function linkedPlacementCells(amount, step) {
  try {
    const n = Math.max(1, Math.min(64, Math.floor(Number(amount) || 1)));
    let s = step && (step.x || step.z) ? { x: Math.sign(step.x || 0), z: Math.sign(step.z || 0) } : { x: 1, z: 0 };
    if (s.x && s.z) s = { x: s.x, z: 0 };
    const cells = [];
    for (let i = 0; i < n; i++) cells.push({ dx: s.x * i, dy: 0, dz: s.z * i });
    return cells;
  } catch { return [{ dx: 0, dy: 0, dz: 0 }]; }
}

export function placementItemIdOf(target) {
  try {
    if (!target) return null;
    const raw = typeof target === "string" ? target : (target.block || target.item || null);
    if (typeof raw !== "string" || !raw) return null;
    return raw.includes(":") ? raw : "minecraft:" + raw;
  } catch { return null; }
}
