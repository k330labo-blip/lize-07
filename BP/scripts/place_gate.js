// place_gate.js — PLACE-GATE-01 設置側到達可能性ゲートの純粋核 (cycle0320 段1統合、cycle0522 段2で tickBuild (build) 配線済み。station/torch は段3)
//
// 正とする設計:
//   brain_parts/solutions/cycle2200-a16-placegate/DESIGN.md (§2 規則 / §3 モジュール仕様)
//   brain_parts/solutions/cycle0307-a17/REPORT.md §1 (要求骨格) / §3 (段-1 差し戻し点)
// 形式の手本: BP/scripts/dig_gate.js (evaluateDig) / BP/scripts/work_access.js
//   (segmentOccluder を再実装せず再利用する。dig_gate と同じ作法)
//
// 汎用規則 (DESIGN §2): 「置けるのは、自分の目から引いた線で実際にクリックできる
// 面に接したセルだけ」 = R1 到達 (目→中心 ≤ REACH) / R2 面 (目→面中心の区間に
// 別の固体が割り込まない支持面が1つ以上ある) / R3 非重なり (自分の体積・主人の
// 体積と一致しない) の3条件 AND。via では分岐しない (PG-43)。
//
// cycle0307-a17 §3 の差し戻し点を本ドラフトへ先行反映済み (段-1 相当):
//   B1-a (station carve): carve は固体セルを setType で直接置換するため、核に
//     preDug オプションは入れない。呼び出し側が「対象セルだけを air と見せ、
//     近傍走査でも対象を支持面候補にしない」blockAt ラップを渡す前提とする
//     (対象は自分自身の近傍ではないため、本核の近傍走査は対象を候補にしない。
//     ラップ側の責務は対象セルの typeId/solid/liquid の読み替えのみ)。
//   B2 (観測キー): 設置側の観測キーは r.lastPlaceGate ではない (同キーは
//     テレポート側 placeGateDest が使用中)。設置側は r.lastPlaceHold
//     = { why, cell, face?, via, at } とし、掘削側 r.lastDigHold と対にする。
//     本核は r を触らない。呼び出し側の記録形は末尾の placeHoldRecord() が正。
//   B3 (itemSolid): solidOfTypeId は nav の通行分類であり設置物の体積共存可否
//     ではない (実測: 作物 wheat/beetroot/carrots/potatoes は全て true になる)。
//     そのため核は itemSolid を計算しない。呼び出し側が明示して渡すこと:
//       build/station = solidOfTypeId(item) (既知の近似。専用分類は残件)
//       torch         = false (松明は非固体。solidOfTypeId でも false で一致)
//       replant       = false を明示 (作物は solidOfTypeId では true になるため、
//                       計算に任せると R3 免除が効かない。これが B3 の是正)
//     itemSolid 省略時は true (固体扱い、R3 を免除しない fail-closed 側) とする。
//   M1 (selfCells 注入形): 自分の体積セルは eye/feetCell から導出しない
//     (eye=+1.6 導出は足元小数部 [0.38,0.40) で bodyCells の +1.62 とずれる)。
//     呼び出し側が opts.selfCells = bodyCells(bot.location) を注入する。
//     主人も同じく opts.ownerCells = bodyCells(owner.location) を注入する。
//     selfCells 省略時のみ、後方互換の劣化フォールバックとして feetCell から
//     [足, 足+1] を使う (目のセルを含まない不完全な形であり、統合時は使わない)。
//   M4 (近傍未知の優先順): 開いた近傍が1つも無く未知近傍が残る配置では、
//     手順5で支持面が確定し面が開いた場合に限り place とし、それ以外は
//     wait(neighbor_unknown) とする (clear_first / occluded より優先する)。
//
// 統合時の注意 (コーディネータ向け):
//   - BP/scripts/place_gate.js へ移す際、import の相対パスを
//     "./work_access.js" から "./work_access.js" へ変えること。
//   - Block の isSolid プロパティは使わない (正式版 API のみ。キュー1)。固体は blockAt 注入
//     (main の digBlockAt、solid は solidOfTypeId 由来) で統一する。
//   - 呼び出し側 (main) は dig_gate と同型に try/catch で包み、例外時は
//     { action:"hold", why:"gate_error" } として消費も setType もしないこと。
//   - ゲートは消費 (takeFromInv) の直前・既存の事前検査の後に置き、原子性の列
//     (消費→setType→再読込検証→失敗時ロールバック) 自体は変えないこと。

import { segmentOccluder } from "./work_access.js";

export const PLACE_GATE = {
  REACH: 4.0, // 既定値。単一の正は main.js の WORK_REACH で、main は reach を必ず明示する
              // (dig_gate.js の DIG_GATE.REACH と同じ作法)
};

const centerOf = (c) => ({ x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 });
const sameCell = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;
const keyOf = (c) => `${c.x},${c.y},${c.z}`;

// 支持面の方向と §3.6 の決定的優先順 (同距離時のタイブレーク順):
// 下 → 北 → 南 → 西 → 東 → 上。dir は「対象セルから支持セルへの単位方向」。
const DIRS_FACE = [
  { dir: { x: 0, y: -1, z: 0 }, name: "down", order: 0 },
  { dir: { x: 0, y: 0, z: -1 }, name: "north", order: 1 },
  { dir: { x: 0, y: 0, z: 1 }, name: "south", order: 2 },
  { dir: { x: -1, y: 0, z: 0 }, name: "west", order: 3 },
  { dir: { x: 1, y: 0, z: 0 }, name: "east", order: 4 },
  { dir: { x: 0, y: 1, z: 0 }, name: "up", order: 5 },
];

// evaluatePlace(blockAt, eye, cell, opts)
//   blockAt: (x,y,z) -> { typeId, solid, liquid } | null (null = 未知)。
//            main の digBlockAt(bot) を掘削と共用する単一実装が正。
//   eye:     目の連続座標 {x,y,z} (呼び出し側が bot.location + 1.6 で作る)
//   cell:    対象セル (整数座標 {x,y,z})
//   opts:
//     reach      目→中心の上限 (既定 PLACE_GATE.REACH)
//     selfCells  自分の体積セル列 [{x,y,z}...] = bodyCells(bot.location) の注入 (M1)。
//                R3 の正はこちら。省略時は feetCell から [足, 足+1] の劣化導出
//     feetCell   自分の足元セル {x,y,z}。遮蔽セルの保護判定 (PG-44) と
//                selfCells 省略時のフォールバックにのみ使う
//     ownerCells 主人の体積セル列 [{x,y,z}...] = bodyCells(owner.location) の注入。
//                省略時は主人検査なし (M2: ensureStation / placeTorch は段3で省略可)
//     itemSolid  設置アイテムが固体か。呼び出し側が明示する (B3)。
//                false なら R3 を免除する。省略時は true
//     via        "build" | "station" | "torch" | "replant" (記録用。判定は分岐しない)
//
// 戻り値:
//   { action: "place", cell, face: { support, dir }, dist }
//   { action: "wait", why, cell, dist }        一時的。消費しない・skip しない
//   { action: "hold", why, cell, dist }        構造的。その場では置けない
//   { action: "clear_first", cell: 遮蔽セル, block, why: "occluded", target, dist }
//        dig_gate の dig_first と同型。v1 の呼び出し側は hold と同等に扱う (DESIGN §5.6)
//   why: target_unknown / neighbor_unknown / out_of_reach (wait),
//        target_occupied / self_overlap / owner_overlap / enclosed / no_face /
//        occluder_liquid / occluded (hold 系)
export function evaluatePlace(blockAt, eye, cell, opts = {}) {
  const reach = opts.reach ?? PLACE_GATE.REACH;
  const feetCell = opts.feetCell || null;
  const itemSolid = opts.itemSolid !== false; // B3: 明示 false のみ免除。省略 = 固体扱い

  // 手順1: 対象の実在 (設置は「air であること」が実在条件。置換可能ブロックの
  // 暗黙の上書きはしない。液体も占有として扱う)
  const b = blockAt(cell.x, cell.y, cell.z);
  if (!b) return { action: "wait", why: "target_unknown", cell, dist: null };
  if (b.typeId !== "minecraft:air") return { action: "hold", why: "target_occupied", cell, dist: null };

  // 手順2: 到達 R1 (目→中心。境界は掘削側と同じく > で判定し、reach ちょうどは可)
  const c = centerOf(cell);
  const dist = Math.hypot(c.x - eye.x, c.y - eye.y, c.z - eye.z);
  if (dist > reach) return { action: "wait", why: "out_of_reach", cell, dist };

  // 手順3: 非重なり R3 (固体アイテム時のみ。crown=足+2 は体積に含めない —
  // selfCells は bodyCells 由来の足・胴・目だけであり、crown は注入側に無い)
  if (itemSolid) {
    const selfCells = Array.isArray(opts.selfCells) && opts.selfCells.length
      ? opts.selfCells
      : (feetCell ? [feetCell, { x: feetCell.x, y: feetCell.y + 1, z: feetCell.z }] : []);
    if (selfCells.some((s) => sameCell(s, cell))) {
      return { action: "hold", why: "self_overlap", cell, dist };
    }
    if (Array.isArray(opts.ownerCells) && opts.ownerCells.some((s) => sameCell(s, cell))) {
      return { action: "hold", why: "owner_overlap", cell, dist };
    }
  }

  // 手順4: 近傍の棚卸し (6近傍のみ。斜め開口は数えない — PG-13、掘削側
  // cellFaceExposed の26近傍とは意図的に異なる)
  const neighbors = DIRS_FACE.map(({ dir, name, order }) => {
    const at = { x: cell.x + dir.x, y: cell.y + dir.y, z: cell.z + dir.z };
    return { at, dir, name, order, block: blockAt(at.x, at.y, at.z) };
  });
  const hasUnknown = neighbors.some((n) => !n.block);
  const hasOpen = neighbors.some((n) => n.block && !n.block.solid && !n.block.liquid);
  const supports = neighbors.filter((n) => n.block && n.block.solid && !n.block.liquid);
  // 開いた近傍が無く未知も無い = 閉空洞 (全面固体/液体)
  if (!hasOpen && !hasUnknown) return { action: "hold", why: "enclosed", cell, dist };
  // 支持面候補が無い: 未知が残れば断定せず wait、無ければ完全な宙
  if (!supports.length) {
    return hasUnknown
      ? { action: "wait", why: "neighbor_unknown", cell, dist }
      : { action: "hold", why: "no_face", cell, dist };
  }
  // M4: 開いた近傍が無く未知が残る場合は、手順5で面が開いた場合だけ place。
  // それ以外は occluded 系より wait(neighbor_unknown) を優先する
  const unknownNoOpen = !hasOpen && hasUnknown;

  // 手順5: 面の到達 R2。候補を §3.6 の順 (面中心までの区間距離→方向順) で
  // 全数試行する。終点は対象中心ではなく面中心とする。
  // 区間検査の除外対象 (segmentOccluder 第4引数) は対象セル cell とする
  // 【ドラフト実測による DESIGN §3.4 字面からの差異、段-1 で要確認】:
  // 設計字面どおり支持セル S を除外すると、厚さ1の壁の裏側のセル (PG-10) で
  // 「目→壁の裏面」の区間サンプルが全て壁セル (=S) の中に入り除外され、
  // 遮蔽なしと誤判定して place を返すことを本ドラフトの自己テストで実測した。
  // 対象セルを除外すれば、正常系 (床置き・壁の手前側) では区間は対象セル (air)
  // の中だけを通るため結果は変わらず、壁裏ケースでは壁セルが遮蔽として
  // 返る (PG-10 の契約どおり)。このとき遮蔽セル == その面の支持セル S に
  // なる場合があり、それは「その面が支持セルの裏面である」ことと同義なので、
  // clear_first ではなく hold(occluded) に倒す (isProtectedOccluder)。
  const ordered = supports.map((n) => {
    const face = { x: c.x + n.dir.x * 0.5, y: c.y + n.dir.y * 0.5, z: c.z + n.dir.z * 0.5 };
    const segDist = Math.hypot(face.x - eye.x, face.y - eye.y, face.z - eye.z);
    return { ...n, face, segDist };
  }).sort((a, b) => (a.segDist - b.segDist) || (a.order - b.order));

  // 遮蔽セルが自分の足元/支持セル/体積セルなら掘らせない (掘削側の保護と同型、PG-44)
  const feetBelow = feetCell ? { x: feetCell.x, y: feetCell.y - 1, z: feetCell.z } : null;
  const selfKeys = new Set();
  if (feetCell) { selfKeys.add(keyOf(feetCell)); if (feetBelow) selfKeys.add(keyOf(feetBelow)); }
  if (Array.isArray(opts.selfCells)) for (const s of opts.selfCells) selfKeys.add(keyOf(s));
  const isProtectedOccluder = (occCell, support) =>
    selfKeys.has(keyOf(occCell)) || sameCell(occCell, support);

  let firstSolidOcc = null; // { cell, block, support }
  let sawLiquidOcc = false;
  for (const cand of ordered) {
    const occ = segmentOccluder(blockAt, eye, cand.face, cell);
    if (!occ) {
      return {
        action: "place", cell, dist,
        face: { support: cand.at, dir: cand.dir },
      };
    }
    if (occ.block.liquid) { sawLiquidOcc = true; continue; }
    if (!firstSolidOcc) firstSolidOcc = { cell: occ.cell, block: occ.block, support: cand.at };
  }

  // M4 の優先: 面が1つも開かず、開いた近傍が無く未知が残るなら断定しない
  if (unknownNoOpen) return { action: "wait", why: "neighbor_unknown", cell, dist };
  if (firstSolidOcc) {
    if (isProtectedOccluder(firstSolidOcc.cell, firstSolidOcc.support)) {
      return { action: "hold", why: "occluded", cell, dist };
    }
    return {
      action: "clear_first", cell: firstSolidOcc.cell, block: firstSolidOcc.block,
      why: "occluded", target: cell, dist,
    };
  }
  if (sawLiquidOcc) return { action: "hold", why: "occluder_liquid", cell, dist };

  // 手順6: fail-closed の最終行 (通常は到達しない)
  return { action: "hold", why: "occluded", cell, dist };
}

// B2: 設置側の観測レコードの形 (r.lastPlaceHold) を固定する純粋ヘルパー。
// 呼び出し側 (main) はゲートが place 以外を返したときだけ
//   r.lastPlaceHold = placeHoldRecord(result, { via, at: Date.now() })
// と書く。place の場合は null を返す (成功系は記録しない、DESIGN §4.3)。
// テレポート側の r.lastPlaceGate には一切触れない。
export function placeHoldRecord(result, meta = {}) {
  if (!result || result.action === "place") return null;
  const rec = {
    why: result.why || null,
    cell: result.target || result.cell || null,
    via: meta.via || null,
    at: meta.at ?? null,
  };
  if (result.action === "clear_first") rec.occluder = result.cell || null;
  return rec;
}
