// fly.js — リゼ（LIZE-07）ホバー飛行エンジン
// 設計の正は brain_parts/solutions/flight-movement/SOLUTION.md。
// nav.js と同じ流儀の純粋JS：probe(x, y, z) 注入式で、実テレポートは呼び出し側（main.js）。
// 既定はホバー飛行。低天井・潜水・到達不能が続く目標では "ground" を返し、
// 呼び出し側が従来の nav/direct に委ねる（復帰はクリアランス1秒継続のヒステリシス）。
import { yawToward, cellUnknown, isUnknownCell } from "./nav.js";

export const FLY = {
  SPEED_CRUISE: 5.0,   // 巡航（主人のダッシュ5.6未満・歩行4.3超）
  SPEED_CATCHUP: 7.0,  // 主人から離れた時の追いつき
  SPEED_FINE: 1.8,     // 目標 2.5 ブロック以内の微調整
  SPEED_UP: 3.5,
  SPEED_DOWN: 3.0,
  HOVER_HEIGHT: 1.2,   // 地形追従ホバー：足元〜地面の間隔
  CEIL_MIN: 2.2,       // これ未満の天井クリアランスでは飛ばない
  CEIL_CAP: 6,         // 天井探索の上限
  LEASH_SOFT: 24,      // これを超えたら CATCHUP 速度
  ARRIVE_R: 0.5,       // 飛行到達の3D距離（干渉系は呼び出し側の閾値と併せて判定）
  DEADBAND_Y: 0.15,    // 高度の不感帯（ホバーの点滅防止）
};

export function createFly(probe, opts = {}) {
  return {
    probe,
    goal: null, goalKey: "", interact: false,
    mode: "fly",          // "fly" | "ground"
    clearSec: 0,          // クリアランス良好の継続時間（ground→fly 復帰用）
    escSec: 0, raise: 0,  // 障害物エスカレーション
    bestHd: Infinity, noProgSec: 0, // v0.4.65: 目標への水平距離が縮まらない時間（樹冠の周回などを打ち切る）
    descBlockedSec: 0,    // 真上降下中の dest_blocked 継続時間（秒）。escSec とは分ける（水平側は checkAhead クリアで毎tick 0 に戻るため共有すると蓄積が消える）
    blocked: new Map(),   // goalKey -> ground 委譲した時刻（nowSec）。30秒で失効
    yaw: 0,
    colCache: new Map(),  // "x,z" -> { g, at, refY } 地面高さの短期キャッシュ
    nowSec: 0,
  };
}

function goalKeyOf(goal) { return Math.floor(goal.x) + "," + Math.floor(goal.y) + "," + Math.floor(goal.z); }

export function flySetGoal(fly, goal, opts = {}) {
  const key = goal ? goalKeyOf(goal) : "";
  if (key !== fly.goalKey) {
    // cycle0202 a06/a09: 目標が近い移動（歩行中の主人など）ではエスカレーション
    // カウンタを引き継ぐ。全リセットだと goalKey が sync のたびに変わり、
    // 委譲閾値（2〜3秒）に数学的に到達できない（ハーネス実測: 600tick 委譲0回）。
    const near = !!(fly.goal && goal
      && Math.hypot(goal.x - fly.goal.x, goal.y - fly.goal.y, goal.z - fly.goal.z) <= 3);
    if (near) {
      // A18-F4 (cycle2200): blocked の引継ぎは新旧目標が同一セル列 (floor x,z 一致) の場合のみ。
      // 歩行・ダッシュ中の主人のように目標が列を変えながら動き続けると、blocked が
      // 毎tick伝播して ground/blocked_goal が途切れず飛行が復帰しない (a04 実測: 100tick連続)。
      // カウンタ群 (escSec 等) の near 引継ぎは従来どおり (cycle0202 の樹冠対策の土台)。
      const sameColumn = !!(fly.goal && goal
        && Math.floor(goal.x) === Math.floor(fly.goal.x)
        && Math.floor(goal.z) === Math.floor(fly.goal.z));
      if (sameColumn) {
        const blk = fly.blocked.get(fly.goalKey);
        if (blk !== undefined) { fly.blocked.set(key, blk); fly.blocked.delete(fly.goalKey); }
      }
    }
    fly.goal = goal ? { x: goal.x, y: goal.y, z: goal.z } : null;
    fly.goalKey = key;
    if (!near) {
      fly.escSec = 0; fly.raise = 0; fly.descBlockedSec = 0;
      fly.bestHd = Infinity; fly.noProgSec = 0;
    }
  }
  fly.interact = !!opts.interact;
  return fly;
}

export function flyClearGoal(fly) { fly.goal = null; fly.goalKey = ""; fly.interact = false; }

function cellAt(fly, x, y, z) { try { return fly.probe(x, y, z) || cellUnknown(); } catch { return cellUnknown(); } }
// 体が入ってはいけないセル（水は通過可）
function isBlockedCell(c) { return !!c && (c.solid || c.lava || c.hazard || c.door); }
// 行き先専用: 未知セルには入らない（水平方向の未知は塞がっている扱い）。checkAhead 等の素の判定は不変
function isBlockedDestCell(c) { return isBlockedCell(c) || isUnknownCell(c); }

// refY の近くでその列の地面（固体上面 or 水面）を返す。範囲内に無ければ null（奈落・未読込＝高度維持）。
function groundNear(fly, x, z, refY) {
  const key = x + "," + z;
  const hit = fly.colCache.get(key);
  if (hit && fly.nowSec - hit.at < 0.5 && Math.abs(hit.refY - refY) < 3) return hit.g;
  let g = null, leafG = null;
  const top = Math.floor(refY) + 3, bot = Math.floor(refY) - 8;
  for (let y = top; y >= bot; y--) {
    const c = cellAt(fly, x, y, z);
    if (!c) continue;
    // v0.4.59 (外部レビュー指摘1): 葉を地面とみなすと木に近づくたび葉の上に乗ってしまう。
    // 葉は候補として控え、本当の地面 (葉でない固体・水面) が窓内にあればそちらを優先する。
    if (c.leaves) { if (leafG === null) leafG = y + (c.top ?? 1); continue; }
    if (c.solid) { g = y + (c.top ?? 1); break; }
    if (c.water) { g = y + 1; break; }
  }
  if (g === null) g = leafG; // 窓内に葉しかない (樹冠の上・奈落際) 場合は葉の上面で高度を保つ
  if (fly.colCache.size > 96) fly.colCache.clear();
  fly.colCache.set(key, { g, at: fly.nowSec, refY });
  return g;
}

// 頭上 y+2 から CEIL_CAP までで最初に solid なセルの下面。無ければ Infinity。
function ceilingAt(fly, x, y, z) {
  const base = Math.floor(y);
  for (let dy = 2; dy <= FLY.CEIL_CAP; dy++) {
    const c = cellAt(fly, x, base + dy, z);
    if (c && c.solid) return base + dy;
  }
  return Infinity;
}

function turnClamp(cur, want, maxDeg) {
  let d = ((want - cur + 540) % 360) - 180;
  d = Math.max(-maxDeg, Math.min(maxDeg, d));
  return cur + d;
}

// 移動ループ1回ぶん。戻り値 { mode:"fly"|"ground", move:{x,y,z,yaw}|null, arrived, reason }
export function flyTick(fly, pos, dtSec, opts = {}) {
  fly.nowSec += dtSec;
  const out = { mode: fly.mode, move: null, arrived: false, reason: "" };
  if (!fly.goal) { fly.mode = "fly"; out.mode = "fly"; return out; }
  const goal = fly.goal;
  const fx = Math.floor(pos.x), fz = Math.floor(pos.z), fy = Math.floor(pos.y);

  // --- ground 委譲の判定（潜水／低天井／委譲済みゴール） ---
  const feetC = cellAt(fly, fx, fy, fz), headC = cellAt(fly, fx, fy + 1, fz);
  const submerged = !!(feetC && headC && feetC.water && headC.water);
  const gHere = groundNear(fly, fx, fz, pos.y);
  const ceil = ceilingAt(fly, fx, pos.y, fz);
  const clearance = (ceil === Infinity ? 99 : ceil) - (gHere ?? pos.y);
  const lowCeiling = ceil !== Infinity && clearance < FLY.CEIL_MIN + FLY.HOVER_HEIGHT;
  const blk = fly.blocked.get(fly.goalKey);
  const goalBlocked = blk !== undefined && (fly.nowSec - blk) < 30;
  if (blk !== undefined && !goalBlocked) fly.blocked.delete(fly.goalKey);

  const wantGround = submerged || lowCeiling || goalBlocked;
  if (fly.mode === "fly" && wantGround) { fly.mode = "ground"; fly.clearSec = 0; }
  else if (fly.mode === "ground") {
    if (!wantGround) fly.clearSec += dtSec; else fly.clearSec = 0;
    if (fly.clearSec >= 1.0) { fly.mode = "fly"; fly.clearSec = 0; }
  }
  out.mode = fly.mode;
  if (fly.mode === "ground") { out.reason = submerged ? "submerged" : goalBlocked ? "blocked_goal" : "low_ceiling"; return out; }

  // --- 距離 ---
  const dx = goal.x - pos.x, dy = goal.y - pos.y, dz = goal.z - pos.z;
  const hd = Math.hypot(dx, dz);
  const d3 = Math.hypot(dx, dy, dz);

  // --- 高度プロファイル（地形追従ホバーが下限、天井が上限） ---
  const dirx = hd > 0.01 ? dx / hd : 0, dirz = hd > 0.01 ? dz / hd : 0;
  const gAhead = groundNear(fly, Math.floor(pos.x + dirx * 1.2), Math.floor(pos.z + dirz * 1.2), pos.y);
  const gBase = Math.max(gHere ?? (pos.y - FLY.HOVER_HEIGHT), gAhead ?? -Infinity);
  let targetY;
  let descend = false; // 真上降下フェーズ（水平を止めて垂直に降りる）
  if (fly.interact && hd < 2.5) {
    // 干渉降下：対象の少し上まで。対象の足元が溶岩・危険なら降下拒否（ホバー維持）
    const belowGoal = cellAt(fly, Math.floor(goal.x), Math.floor(goal.y) - 1, Math.floor(goal.z));
    const dangerBelow = !!(belowGoal && (belowGoal.lava || belowGoal.hazard));
    targetY = dangerBelow ? Math.max(goal.y + 1.6, gBase + FLY.HOVER_HEIGHT) : goal.y + 0.2;
  } else if (!fly.interact && hd <= 1.5) {
    // 真上降下（追随用）: 目標列の地面を目標高度基準で探し、実在する場合だけ
    // その地面+ホバーを下限にして目標高度へ降りる。目標列にも地面が無い（奈落・
    // 未読込）場合は従来どおり高度維持に倒す（＝落ちない設計を維持）。
    const gGoal = groundNear(fly, Math.floor(goal.x), Math.floor(goal.z), goal.y);
    if (gGoal != null && gGoal + FLY.HOVER_HEIGHT < gBase + FLY.HOVER_HEIGHT - 0.01) {
      targetY = Math.max(goal.y, gGoal + FLY.HOVER_HEIGHT);
      descend = targetY < pos.y - FLY.DEADBAND_Y;
    } else {
      targetY = Math.max(goal.y, gBase + FLY.HOVER_HEIGHT);
    }
  } else {
    targetY = Math.max(goal.y, gBase + FLY.HOVER_HEIGHT);
  }
  if (ceil !== Infinity) targetY = Math.min(targetY, ceil - 2.0);
  targetY += fly.raise;

  // 真上降下でない tick が挟まれば、垂直封鎖の継続は途切れたものとする。
  // v0.4.59: 干渉降下 (interact で目標が足元より下) も「降下中」に数える。ここで毎tick消すと
  // 後段のカウンタが永遠に 0.1 から増えず、エスカレーションが発動しない (実測で確認)。
  const wantDescend = descend || (fly.interact && targetY < pos.y - 0.05) || (!fly.interact && hd <= 1.5 && goal.y < pos.y - 1.0);
  if (!wantDescend) fly.descBlockedSec = 0;

  // --- 到達判定：3Dで十分近い、または目標の真上でホバー高度に収まっている ---
  // 第2条件は「目標高度付近でホバーできている」場合だけ。到達には 3D 距離の上限を課し、
  // 高度維持のまま真上に来ただけで到達扱いになる（＝その場で静止し続ける）経路を断つ。
  if (d3 <= (fly.interact ? 1.2 : FLY.ARRIVE_R) || (hd <= 0.5 && d3 <= 2.5 && Math.abs(targetY - pos.y) <= 0.4)) { out.arrived = true; return out; }

  // v0.4.65: 進捗の見張り。横回避が見つかり続けると escSec が増えず、障害物（樹冠など）の周りを
  // 永遠に回れてしまう。水平距離が 3 秒縮まらなければ、このゴールを ground へ委譲する。
  if (hd < fly.bestHd - 0.3) { fly.bestHd = hd; fly.noProgSec = 0; } else fly.noProgSec += dtSec;
  if (fly.noProgSec >= 3 && hd > 1.5) {
    fly.blocked.set(fly.goalKey, fly.nowSec);
    fly.mode = "ground"; out.mode = "ground"; out.reason = "no_progress";
    fly.noProgSec = 0; fly.bestHd = Infinity; fly.escSec = 0; fly.raise = 0;
    return out;
  }

  // --- 前方障害：段1 上昇 → 段2 横回避 → 段3 ground 委譲 ---
  let moveDirX = dirx, moveDirZ = dirz;
  if (hd > 0.6) {
    const checkAhead = (ux, uz) => {
      for (const s of [0.8, 1.6, 2.4]) {
        if (s >= hd - (fly.interact ? 0.6 : 0)) break; // v0.4.65: 目標より先（干渉時は目標セル自身も）を障害物として見ない
        const cx = Math.floor(pos.x + ux * s), cz = Math.floor(pos.z + uz * s), cy = Math.floor(targetY);
        if (isBlockedCell(cellAt(fly, cx, cy, cz)) || isBlockedCell(cellAt(fly, cx, cy + 1, cz))) return true;
      }
      return false;
    };
    if (checkAhead(dirx, dirz)) {
      let stillBlocked = true;
      if (fly.raise < 3 && !((fly.interact && goal.y < pos.y - 1) || descend) && (ceil === Infinity || targetY + 1 <= ceil - 2.0)) { // v0.4.65: 目標が下にある干渉移動では上昇で回避しない（樹冠に押し上げられる）/ FOLLOW-VERT-RAISE-CANCEL-01: 真上降下中も上昇で回避しない
        fly.raise += 1; targetY += 1;
        stillBlocked = checkAhead(dirx, dirz);
      }
      if (stillBlocked) {
        let found = false;
        for (const ang of [45, -45, 90, -90]) {
          const rad = ang * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
          const ux = dirx * cos - dirz * sin, uz = dirx * sin + dirz * cos;
          if (!checkAhead(ux, uz)) { moveDirX = ux; moveDirZ = uz; found = true; break; }
        }
        if (!found) {
          fly.escSec += dtSec;
          if (fly.escSec >= 2) {
            fly.blocked.set(fly.goalKey, fly.nowSec);
            fly.mode = "ground"; out.mode = "ground"; out.reason = "flight_blocked";
            fly.escSec = 0; fly.raise = 0;
            return out;
          }
        } else fly.escSec = 0;
      } else fly.escSec = 0;
    } else { fly.escSec = 0; if (fly.raise > 0 && hd < 3) fly.raise = 0; }
  }

  // --- 速度と次位置 ---
  const ownerDist = opts.ownerPos ? Math.hypot(opts.ownerPos.x - pos.x, opts.ownerPos.y - pos.y, opts.ownerPos.z - pos.z) : 0;
  let speedH = hd <= 2.5 ? FLY.SPEED_FINE : FLY.SPEED_CRUISE;
  if (ownerDist > FLY.LEASH_SOFT) speedH = FLY.SPEED_CATCHUP;
  const stepH = descend ? 0 : Math.min(speedH * dtSec, hd, 0.7);
  let nx = pos.x + moveDirX * stepH, nz = pos.z + moveDirZ * stepH;
  let ny = pos.y;
  const dyT = targetY - pos.y;
  if (Math.abs(dyT) > FLY.DEADBAND_Y) {
    const stepV = Math.min((dyT > 0 ? FLY.SPEED_UP : FLY.SPEED_DOWN) * dtSec, Math.abs(dyT), 0.35);
    ny = pos.y + Math.sign(dyT) * stepV;
  }

  // --- 硬い規則：行き先の体・頭セルが塞がっているステップは発行しない ---
  const destFx = Math.floor(nx), destFz = Math.floor(nz), destFy = Math.floor(ny);
  const destCell = cellAt(fly, destFx, destFy, destFz), destHead = cellAt(fly, destFx, destFy + 1, destFz);
  // v0.4.68: 目の高さ (足 +1.62) は端数によって 2 マス上に入る。そこが葉・土だと頭が埋まって窒息するので一緒に見る
  const eyeY = Math.floor(ny + 1.62), destEye = eyeY !== destFy + 1 ? cellAt(fly, destFx, eyeY, destFz) : null;
  if (isBlockedDestCell(destCell) || isBlockedDestCell(destHead) || (destEye && isBlockedDestCell(destEye))) {
    // 水平を止めて上昇だけなら出せる場合のみ出す
    if (ny > pos.y && !isBlockedDestCell(cellAt(fly, fx, destFy, fz)) && !isBlockedDestCell(cellAt(fly, fx, destFy + 1, fz)) && !isBlockedDestCell(cellAt(fly, fx, eyeY, fz))) {
      nx = pos.x; nz = pos.z;
    } else {
      // 垂直封鎖エスカレーション（汎用規則）: 真上降下中に既知の遮蔽で
      // dest_blocked が続く場合だけ数え、前方障害と同じ 2 秒で
      // fly.blocked 登録＋ground 委譲する。未知セルのみが理由の場合は
      // 「塞がっている」ことが確定していないため数えない。
      if (wantDescend && (isBlockedCell(destCell) || isBlockedCell(destHead) || (destEye && isBlockedCell(destEye)))) { // v0.4.59 (外部レビュー指摘2): 採集などの干渉降下でも、塞がれ続けたら同じく ground へ逃がす
        fly.descBlockedSec += dtSec;
        if (fly.descBlockedSec >= 2) {
          fly.blocked.set(fly.goalKey, fly.nowSec);
          fly.mode = "ground"; out.mode = "ground"; out.reason = "flight_blocked";
          fly.descBlockedSec = 0;
          return out;
        }
      }
      out.reason = "dest_blocked"; return out;
    }
  }
  fly.descBlockedSec = 0; // ステップを発行できた＝封鎖の継続は途切れた
  fly.yaw = turnClamp(fly.yaw, yawToward(dx, dz), 60);
  out.move = { x: nx, y: ny, z: nz, yaw: fly.yaw };
  return out;
}
