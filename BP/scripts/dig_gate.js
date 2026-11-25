// dig_gate.js — 掘削の統一ゲート (要望バッチA 正式統合 v0.4.88、出典 brain_parts/solutions/dig-reach-spiral)
//
// 問題: 現行の掘削可否は tickWork の「目→対象中心の距離 ≤ 4.0」だけ (main.js tickWork)。
// 距離さえ届けば、間の壁・岩を一切掘らずに対象を掘れてしまう (壁裏掘削)。
// work_access (v0.4.76) は startWork 時点・立ち位置の目・12ブロック以内・対象決定時の
// 1 回だけの評価で、実際の掘削瞬間 (tickWork の setType) は無検査のまま。
//
// 統一ルール (本ドラフト): 「掘れるのは、自分の目から引いた線で最初にぶつかる固体だけ」
//   = プレイヤーのレイキャストと同じ規則。壁の裏・岩の中のセルは、間のセルを
//     自分のいる空間側から順に掘って初めて掘れるようになる。
//   副条件: 対象セルが「開いた空間に面している」こと (6 近傍のいずれかが非固体)。
//     全面を固体に囲まれたセルは、どの面も視線が届かないため掘れない。
//   副条件: 距離 (目→中心) ≤ REACH は現行 WORK_REACH = 4.0 を維持する。
//
// 形は teleport_gate.js / work_access.js と同型: 純粋関数 + blockAt 注入。
// blockAt(x, y, z) -> { typeId, solid, liquid } | null (未知)。未知セルは素通り
// せず「未確認」として hold に倒す (INSPECT P0 の原則: 未知を空洞と断定しない。
// ただし区間サンプルの未知は work_access.segmentOccluder と同じく素通りさせる
// — 区間の未知で全掘削が止まると未読込境界で何も掘れなくなるため。対象セル
// 自身と近傍の未知は hold 側に倒す)。
//
// 戻り値:
//   { action: "dig", cell }                    そのまま掘ってよい
//   { action: "dig_first", cell, why }         先に掘るべきセル (目から見て最初の固体)。
//                                              呼び出し側は canBreakForPath 等の安全判定を
//                                              通した場合だけそちらへ作業を差し替える
//   { action: "hold", why }                    掘らない (到達不能・液体・自己支持・未確認)
//
// opts:
//   reach    目→中心の上限 (既定 4.0 = WORK_REACH)
//   feetCell 自分の足元セル {x,y,z}。その真下 (支持セル) は dig_first 候補から除外し、
//            対象が支持セル自身なら hold("self_support") を返す (work_access の保護と同一)
//   via      "work" (通常作業) | "path" (clearPathAhead/breakForPath) |
//            "rescue" (自分の体セル: 区間検査は自明なため免除。安全判定は呼び出し側)
//            "tunnel" (坑道・螺旋: 対象は自分のセルの隣接セル。区間検査は行う)

import { segmentOccluder } from "./work_access.js";

export const DIG_GATE = {
  REACH: 4.0, // 既定値。単一の正は main.js の WORK_REACH で、main は reach を必ず明示する
};

const centerOf = (c) => ({ x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 });
const sameCell = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;
const DIRS6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// 対象セルが開いた空間に面しているか (6 近傍のいずれかが非固体・非液体)。
// 戻り値: true (面している) / false (全面固体) / null (近傍に未知があり断定できない)
// cycle0841 (キュー0 石層停止の是正): 6近傍だけで判定すると、1マス縦穴の中で
// 足元列に斜め隣接するセルが「全面固体」と誤判定され enclosed で潜行が止まる
// (basics-stone-stop REPORT の実測)。プレイヤーの視線はセルの角・稜にも届くため、
// 6近傍が全て固体でも、稜・角で接する近傍 (26近傍の残り20) に開いた空間が
// あれば「面している」と扱う。全面 (26近傍全て) 固体なら従来どおり enclosed。
// cycle1234 (キュー0是正の限定化、a01/a20 敵対監査): 斜め開口は無条件では数えない。
// 開口セルが「自分の側」(nearCells = 足元セル・目セルと同一または面隣接) にある
// ときだけ露出として数える。裏側だけに斜め開口があるセルは enclosed のままにし、
// 壁裏掘削の禁止 (要望バッチA) の露出側の歯止めを回復する。nearCells 省略時は
// 従来どおり無条件に数える (単体呼び出し・既存テスト互換)。なお近距離で対象を
// かすめる視線を segmentOccluder の点サンプリングが見落とす件 (a20 実測) は
// DDA 化が別件として残る。
const DIRS_DIAG = [];
for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
  if (dx === 0 && dy === 0 && dz === 0) continue;
  if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) === 1) continue; // 6近傍は DIRS6 側
  DIRS_DIAG.push([dx, dy, dz]);
}
export function cellFaceExposed(blockAt, cell, nearCells = null) {
  let unknown = false;
  for (const [dx, dy, dz] of DIRS6) {
    const b = blockAt(cell.x + dx, cell.y + dy, cell.z + dz);
    if (!b) { unknown = true; continue; }
    if (!b.solid && !b.liquid) return true;
  }
  // 斜め開口の「自分の側」判定: 開口セルが nearCells のいずれかと同一セル、
  // または面隣接 (マンハッタン距離 <= 1) なら自分の空間に繋がっていると扱う
  const onOwnSide = (x, y, z) => {
    if (!nearCells) return true;
    for (const n of nearCells) {
      if (!n) continue;
      if (Math.abs(x - n.x) + Math.abs(y - n.y) + Math.abs(z - n.z) <= 1) return true;
    }
    return false;
  };
  for (const [dx, dy, dz] of DIRS_DIAG) {
    const b = blockAt(cell.x + dx, cell.y + dy, cell.z + dz);
    if (!b) { unknown = true; continue; }
    if (!b.solid && !b.liquid && onOwnSide(cell.x + dx, cell.y + dy, cell.z + dz)) return true;
  }
  return unknown ? null : false;
}

export function evaluateDig(blockAt, eye, cell, opts = {}) {
  const reach = opts.reach ?? DIG_GATE.REACH;
  const feetCell = opts.feetCell || null;
  const via = opts.via || "work";

  const b = blockAt(cell.x, cell.y, cell.z);
  if (!b) return { action: "hold", why: "target_unknown" };
  // cycle0753 CC-5a 案A: 入口の実体判定は nav の solid (上に立てるか) を流用しない。
  // サボテン/スイートベリー/つる等の非固体ブロックは掘削対象として実在するため、
  // 入口で止めるのは空セルと液体だけにし、残りは到達・露出・視線・支持保護へ委ねる。
  if (!b.typeId || b.typeId === "minecraft:air") return { action: "hold", why: "target_empty" };
  if (b.liquid) return { action: "hold", why: "target_liquid" };

  // 距離 (現行 tickWork と同じ測り方: 目→中心)
  const c = centerOf(cell);
  const d = Math.hypot(c.x - eye.x, c.y - eye.y, c.z - eye.z);
  if (d > reach) return { action: "hold", why: "out_of_reach" };

  // 自分の支持セルは掘らない (掘ると自分が落ちる。work_access isProtected と同一規則)。
  // ただし tunnel (坑道・縦穴の下降は支持セルを掘って落ちるのが設計) と rescue は免除する (cycle0616-a01 M1)。
  if (via !== "tunnel" && via !== "rescue" && feetCell && cell.x === feetCell.x && cell.z === feetCell.z && cell.y === feetCell.y - 1) {
    return { action: "hold", why: "self_support" };
  }
  // 自分の体セル (埋没救済) は区間検査を免除する。目そのものがセル内/隣接にあるため
  // 視線の概念が自明で、免除しないと救済が成立しない。安全判定 (人工物・岩盤等) は
  // 呼び出し側の canBreakForPath が担う (現行どおり)。
  if (via === "rescue") return { action: "dig", cell };

  // 面の露出: 全面固体に囲まれたセルは掘れない。斜め開口は自分の側
  // (足元セルと目セル) にあるものだけを数える (cycle1234)
  const eyeCell = { x: Math.floor(eye.x), y: Math.floor(eye.y), z: Math.floor(eye.z) };
  const exposed = cellFaceExposed(blockAt, cell, [feetCell, eyeCell]);
  if (exposed === false) return { action: "hold", why: "enclosed" };
  if (exposed === null) return { action: "hold", why: "neighbor_unknown" };

  // 視線: 目→中心の区間で、対象より手前に固体があればそれが「掘るべきセル」
  const occ = segmentOccluder(blockAt, eye, c, cell);
  if (occ) {
    if (occ.block.liquid) return { action: "hold", why: "occluder_liquid" };
    // 遮蔽が自分の足元/支持セルなら掘らずに待つ (work_access と同じ保護)
    if (feetCell && (sameCell(occ.cell, feetCell)
      || (occ.cell.x === feetCell.x && occ.cell.z === feetCell.z && occ.cell.y === feetCell.y - 1))) {
      return { action: "hold", why: "occluder_is_self" };
    }
    return { action: "dig_first", cell: occ.cell, block: occ.block, why: "occluded" };
  }
  return { action: "dig", cell };
}
