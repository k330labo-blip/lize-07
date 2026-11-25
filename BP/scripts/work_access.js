// work_access.js — 作業アクセス解決の純粋核 (v0.4.76 統合、出典 brain_parts/solutions/basics-leaves-work/)。
//
// 一般規則: 「掘る前に、その作業が本当に届く形になっているかを確認し、
// 届かない/遮られているなら、遮っている『壊してよい自然ブロック』を先に掘る」。
// 葉っぱ専用の分岐は持たない。原木・鉱石・土など全てのブロック作業に同じ形で効く。
//
// 過去ドラフト (basics-leaves/blocker_draft.js) との違い:
//   1. 発動条件が「詰まってから 3 秒」ではない。startWork の対象決定の一部として
//      毎回評価するので、「届いてはいるが葉越しに掘っている」ケース (今回の実機症状)
//      でも発動する (旧案は stuck 蓄積が前提で、この症状では永遠に発動しなかった)。
//   2. 区間の始点が現在位置ではなく「実際に掘る位置 (立ち位置) の目」である。
//      旧案のベンチ不合格 BW-01/02 (区間非交差) は、現在位置から引いた区間が
//      遮蔽と交わらなかったことが原因。立ち位置の目から引けば作業の実態と一致する。
//   3. 立ち位置が無い場合は「立ち位置を塞いでいるセル」自体を候補にする
//      (stand_denier)。区間が遮蔽と交わらない配置でも開通できる。
//   4. 移動層 (fly の low_ceiling 委譲など、旧 BW-03 の真因) には依存しない。
//      判定は作業層だけで完結し、先掘り対象は通常の作業対象として掘らせる。
//
// 注入式: blockAt(x,y,z) -> { typeId, solid, liquid } | null (未知)
//         canBreak(cell, block) -> boolean (統合時は main.js の canBreakForPath を注入し、
//         人工物・容器・岩盤・溶岩近接・道具不足を既存の安全判定に委ねる)

export const ACCESS = {
  MAX_CHAIN: 24,     // 1 つの主対象に対して先掘りできる上限 (樹冠半径3でも開通に足り、暴走はしない)
  SEG_STEP: 0.4,     // 区間探索の歩幅 (旧ドラフトと同じ)
  STAND_DY: [0, -1, -2, -3, -4], // workStandPoint と同じ探索順
  DIRS: [[1, 0], [-1, 0], [0, 1], [0, -1]],
};

const centerOf = (loc) => ({ x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 });
const sameCell = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;

function freeAt(blockAt, x, y, z) {
  const b = blockAt(x, y, z);
  return !!b && !b.solid && !b.liquid;
}

// 立ち位置候補: findStand と同じ探索順 (dy 浅い順→段内は水平距離昇順、タイは列挙順)。
// 候補が存在する最も浅い dy 段の全候補だけを返す (深い段は見ない)。
// 各候補は { x, y, z, d } (d は fromPos からの水平距離)。
export function standCandidates(blockAt, loc, fromPos) {
  for (const dy of ACCESS.STAND_DY) {
    const row = [];
    ACCESS.DIRS.forEach(([dx, dz], seq) => {
      const x = loc.x + dx, y = loc.y + dy, z = loc.z + dz;
      if (!freeAt(blockAt, x, y, z) || !freeAt(blockAt, x, y + 1, z)) return;
      const d = Math.hypot(x + 0.5 - fromPos.x, z + 0.5 - fromPos.z);
      row.push({ x, y, z, d, seq });
    });
    if (row.length) { row.sort((a, b) => (a.d - b.d) || (a.seq - b.seq)); return row.map(({ x, y, z, d }) => ({ x, y, z, d })); }
  }
  return [];
}

// workStandPoint の純粋版: dy の浅い順に、体・頭が入る隣接セルを探す。
// 戻り値 { x, y, z } (セル座標) | null
export function findStand(blockAt, loc, fromPos) {
  const cands = standCandidates(blockAt, loc, fromPos);
  return cands.length ? { x: cands[0].x, y: cands[0].y, z: cands[0].z } : null;
}

// crown セル (立ち位置の足元+2) の遮蔽。モデル頭頂 1.875 + ホバー +0.075 と
// fly 干渉降下 (足元 stand.y+0.2) で視覚頭頂は stand.y+2.15 に達するため、
// 足・頭だけの検査では頭が葉にめり込む (basics-leaves-body)。
// 戻り値: 塞いでいる場合は { cell, block }、空いていれば null、未知なら "unknown"
// (未知は掘らない・塞がれたとも断定しない)。
export function crownBlocker(blockAt, stand) {
  const cell = { x: stand.x, y: stand.y + 2, z: stand.z };
  const b = blockAt(cell.x, cell.y, cell.z);
  if (!b) return "unknown";
  if (!b.solid && !b.liquid) return null;
  return { cell, block: b };
}

// 体積を考慮した立ち位置選択: 同一 dy 段内でのみ、crown が空いている候補を
// 塞がれた候補より優先する。深い段の crown-free を優先すると立ち位置の意味論が
// 壊れるため、段を跨いだ優先はしない。全候補が塞がれていれば先頭候補と
// その crown 遮蔽を返す。
// 戻り値: { stand, crown } | null (crown は crownBlocker の戻り値)
export function findStandWithVolume(blockAt, loc, fromPos) {
  const cands = standCandidates(blockAt, loc, fromPos);
  if (!cands.length) return null;
  let firstBlocked = null;
  for (const s of cands) {
    const stand = { x: s.x, y: s.y, z: s.z };
    const crown = crownBlocker(blockAt, stand);
    if (crown === null) return { stand, crown: null };
    if (!firstBlocked) firstBlocked = { stand, crown };
  }
  return firstBlocked;
}

// 立ち位置探索で調べる全候補セル (体・頭)。stand_denier の母集合。
export function standCandidateCells(loc) {
  const out = [];
  for (const dy of ACCESS.STAND_DY) for (const [dx, dz] of ACCESS.DIRS) {
    out.push({ x: loc.x + dx, y: loc.y + dy, z: loc.z + dz });
    out.push({ x: loc.x + dx, y: loc.y + dy + 1, z: loc.z + dz });
  }
  return out;
}

// from -> to の区間で最初にぶつかる固体セル。未知セルは壁と断定せず素通りする
// (INSPECT P0 の原則)。目標セル自身と始点セルは候補にしない。
export function segmentOccluder(blockAt, from, to, targetCell) {
  const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const steps = Math.max(1, Math.floor(d / ACCESS.SEG_STEP));
  const startCell = { x: Math.floor(from.x), y: Math.floor(from.y), z: Math.floor(from.z) };
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cell = {
      x: Math.floor(from.x + (to.x - from.x) * t),
      y: Math.floor(from.y + (to.y - from.y) * t),
      z: Math.floor(from.z + (to.z - from.z) * t),
    };
    if (sameCell(cell, targetCell) || sameCell(cell, startCell)) continue;
    const b = blockAt(cell.x, cell.y, cell.z);
    if (!b) continue;                    // 未知は素通り
    if (b.liquid) return { cell, block: b }; // v0.4.76 a22 V4: 液体 (溶岩等) を透明扱いしない。呼び出し側が work_anyway へ倒す
    if (b.solid) return { cell, block: b };
  }
  return null;
}

// 作業アクセスの解決。target = { x, y, z, typeId }、eye = 現在の目の位置。
// opts: { chain = 0, maxChain = ACCESS.MAX_CHAIN, feetCell = null }
// 戻り値:
//   { kind: "work", stand }                        そのまま掘ってよい
//   { kind: "dig_first", cell, block, via, stand } 先に掘る自然ブロック (via: "occluder" | "stand_denier" | "crown")
//   { kind: "work_anyway", reason, stand }         先掘りできない → 従来動作 (見切り等) に委ねる
export function resolveWorkAccess(blockAt, canBreak, eye, target, opts = {}) {
  const chain = opts.chain || 0;
  const maxChain = opts.maxChain ?? ACCESS.MAX_CHAIN;
  const feetCell = opts.feetCell || null;
  const sv = findStandWithVolume(blockAt, target, eye);
  const stand = sv ? sv.stand : null;
  const crown = sv ? sv.crown : null;
  // 実際に掘る位置の目: 立ち位置があれば (fly 干渉到達で足元 ≈ セル+0.2、目 +1.6)、
  // 無ければ現在の目 (樹冠の上に立っている等の実位置)。
  const viewEye = stand ? { x: stand.x + 0.5, y: stand.y + 1.8, z: stand.z + 0.5 } : eye;
  const occ = segmentOccluder(blockAt, viewEye, centerOf(target), target);
  // v0.4.76 a22 V1/V3: 自分の足元セルと、その真下の支持セルは絶対に先掘りしない (掘ると落下する)
  const feetBelow = feetCell ? { x: feetCell.x, y: feetCell.y - 1, z: feetCell.z } : null;
  const isProtected = (cell) => sameCell(cell, feetCell) || sameCell(cell, feetBelow);

  if (stand && !occ) {
    // crown (滞在側の体積検査、貫通ゲート統合ステップ④ / basics-leaves-body):
    // 区間が開いていて立ち位置もあるのに頭上だけが塞がれている場合。
    // 遮蔽 (occluder) の判定が先で、crown はここでのみ発動する。
    // 掘れる自然ブロックなら dig_first (via: "crown")、人工物・液体・未知・
    // 対象セル自身・足元保護セルは掘らず従来動作 (crownBlocked は観測用)。
    if (crown && crown !== "unknown" && !sameCell(crown.cell, target) && !isProtected(crown.cell)) {
      if (!crown.block.liquid && canBreak(crown.cell, crown.block)) {
        if (chain >= maxChain) return { kind: "work_anyway", reason: "chain_cap", stand };
        return { kind: "dig_first", cell: crown.cell, block: crown.block, via: "crown", stand };
      }
      return { kind: "work", stand, crownBlocked: true };
    }
    return { kind: "work", stand };
  }

  if (occ && occ.block.liquid) return { kind: "work_anyway", reason: "occluder_liquid", stand };
  if (occ && !isProtected(occ.cell)) {
    if (!canBreak(occ.cell, occ.block)) return { kind: "work_anyway", reason: "occluder_unbreakable", stand };
    if (chain >= maxChain) return { kind: "work_anyway", reason: "chain_cap", stand };
    return { kind: "dig_first", cell: occ.cell, block: occ.block, via: "occluder", stand };
  }

  if (!stand) {
    // 立ち位置が無い: 「候補 (体セル+頭セル) の固体が全て壊してよいものだけ」の候補を
    // 開通候補とし、その最初の固体を掘る。候補の評価単位を体・頭の組にすることで、
    // 「頭の葉だけが塞いでいる候補」を「地面を掘る候補」より優先でき、
    // 掘っても開かない候補 (固体が人工物を含む等) は候補から外れる。
    let best = null;
    ACCESS.STAND_DY.forEach((dy, dyi) => {
      for (const [dx, dz] of ACCESS.DIRS) {
        const F = { x: target.x + dx, y: target.y + dy, z: target.z + dz };
        const H = { x: F.x, y: F.y + 1, z: F.z };
        if (isProtected(F) || isProtected(H)) continue; // v0.4.76 a22 V1: 頭セル側の足元も保護する
        const solids = [];
        let openable = true;
        for (const cell of [F, H]) {
          if (sameCell(cell, target)) { openable = false; break; }
          const b = blockAt(cell.x, cell.y, cell.z);
          if (!b) { openable = false; break; }              // 未知を含む候補は開通を断定しない
          if (b.solid && !b.liquid) { if (!canBreak(cell, b)) { openable = false; break; } solids.push({ cell, block: b }); }
          else if (b.liquid) { openable = false; break; }
        }
        if (!openable || !solids.length) return;
        const fc = centerOf(F);
        const d = Math.hypot(fc.x - eye.x, fc.y - eye.y, fc.z - eye.z);
        const cand = { solids, removals: solids.length, dyi, d };
        if (!best || cand.removals < best.removals
          || (cand.removals === best.removals && (cand.dyi < best.dyi || (cand.dyi === best.dyi && cand.d < best.d)))) best = cand;
      }
    });
    if (best) {
      if (chain >= maxChain) return { kind: "work_anyway", reason: "chain_cap", stand };
      // 掘るのは、その候補の固体のうち目に最も近いもの (開通の実感が早い順)
      let pick = best.solids[0];
      for (const s of best.solids) {
        const c = centerOf(s.cell);
        if (Math.hypot(c.x - eye.x, c.y - eye.y, c.z - eye.z) < Math.hypot(pick.cell.x + 0.5 - eye.x, pick.cell.y + 0.5 - eye.y, pick.cell.z + 0.5 - eye.z)) pick = s;
      }
      return { kind: "dig_first", cell: pick.cell, block: pick.block, via: "stand_denier", stand };
    }
    return { kind: "work_anyway", reason: occ ? "occluded_no_stand" : "no_stand", stand };
  }

  // stand はあるが区間の遮蔽が自分の足元セルのみ等 → 従来動作
  return { kind: "work_anyway", reason: "occluder_is_self", stand };
}
