// d2_spiral_math.js — 0-D2 (cycle1434): 発見済み地下鉱石への螺旋降下の純粋核。
// 深い降下は真下でも垂直掘りにせず螺旋階段にする。起点は降下開始時の足元で固定し、
// 降下中に別鉱石を検出しても作り直さない。@minecraft/server を import しない。例外を投げない方針は呼び出し側 try で担保。


// ---------------------------------------------------------------- constants

export const D2_DEFAULTS = Object.freeze({
  // 手が届く距離 (3Dユークリッド)。統合時は実機の到達距離定数に合わせること。
  reach: 4.5,
  // 「すぐ下の1個」とみなす深さ。これより深い降下は原則 spiral。
  directDepth: 1,
  // この深さ以上を「深い降下」とする (= directDepth + 1)。
  spiralMinDepth: 2,
});

// 3x3 螺旋の外周オフセット (時計回り)。連続要素同士は必ずマンハッタン距離1で、
// 末尾 -> 先頭の wrap も距離1。これにより各段が「水平1マス + 下降1」で連なり、
// プレイヤーが歩いて昇り降りできる (ジャンプ昇りは通常歩行の範囲)。
export const D2_PERIMETER = Object.freeze([
  Object.freeze({ x: 1, z: 0 }),
  Object.freeze({ x: 1, z: 1 }),
  Object.freeze({ x: 0, z: 1 }),
  Object.freeze({ x: -1, z: 1 }),
  Object.freeze({ x: -1, z: 0 }),
  Object.freeze({ x: -1, z: -1 }),
  Object.freeze({ x: 0, z: -1 }),
  Object.freeze({ x: 1, z: -1 }),
]);

// ---------------------------------------------------------------- helpers

function isPos(p) {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
}
function floorPos(p) {
  return { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
}
function keyOf(p) {
  const b = floorPos(p);
  return b.x + "," + b.y + "," + b.z;
}
function dist3d(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function chebyshevXZ(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}
function manhattanXZ(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}
function resolveOpts(opts) {
  const o = opts || {};
  return {
    reach: Number.isFinite(o.reach) ? o.reach : D2_DEFAULTS.reach,
    directDepth: Number.isFinite(o.directDepth) ? o.directDepth : D2_DEFAULTS.directDepth,
    spiralMinDepth: Number.isFinite(o.spiralMinDepth) ? o.spiralMinDepth : D2_DEFAULTS.spiralMinDepth,
    exposed: o.exposed === true,
    reachable: o.reachable === true,
  };
}

// ---------------------------------------------------------------- judgement

/**
 * 深い降下か直接掘りかの判定 (純粋関数)。
 *
 * @param {{x:number,y:number,z:number}} botPos    自分の足元/基準位置
 * @param {{x:number,y:number,z:number}} targetPos 対象ブロック位置
 * @param {object} [opts]
 * @param {boolean} [opts.exposed]   対象が露出している (空気に面している) か
 * @param {boolean} [opts.reachable] 呼び出し側で到達可能と確認済みか
 * @param {number}  [opts.reach]     手が届く距離 (既定 D2_DEFAULTS.reach)
 * @returns {{mode:"direct"|"adjacent"|"spiral"|"none", reason:string,
 *            dx:number, dy:number, dz:number, horiz:number, depth:number, dist:number}}
 *   mode:
 *     direct   — その場から直接掘ってよい (露出+到達圏内 / すぐ下の1個 / 同高さ到達圏内)
 *     adjacent — 深くはないが到達圏外。まず隣接位置へ移動してから掘る (階段は不要)
 *     spiral   — 深い降下。螺旋階段で降りる (真下の深い対象を含む。縦穴禁止)
 *     none     — 入力不正で判定不能
 *   dy は target - bot (下方向が負)。depth は bot - target (下方向が正)。
 */
export function classifyDescent(botPos, targetPos, opts) {
  if (!isPos(botPos) || !isPos(targetPos)) {
    return { mode: "none", reason: "invalid_position", dx: 0, dy: 0, dz: 0, horiz: 0, depth: 0, dist: Infinity };
  }
  const o = resolveOpts(opts);
  const dx = targetPos.x - botPos.x;
  const dy = targetPos.y - botPos.y;
  const dz = targetPos.z - botPos.z;
  const horiz = chebyshevXZ(botPos, targetPos);
  const depth = -dy;
  const dist = dist3d(botPos, targetPos);
  const base = { dx, dy, dz, horiz, depth, dist };

  // 1) 露出していて到達圏内なら、深さによらず直接掘ってよい。
  //    (露出鉱石の例外。ただし到達圏外の露出は深さで再判定する)
  if (o.exposed && (o.reachable || dist <= o.reach)) {
    return { ...base, mode: "direct", reason: "exposed_reachable" };
  }
  // 2) すぐ下の1個 (深さ directDepth 以内 かつ 水平1マス以内) は直接掘ってよい。
  if (depth >= 0 && depth <= o.directDepth && horiz <= 1) {
    return { ...base, mode: "direct", reason: "one_below" };
  }
  // 3) 同高さ〜上方向で到達圏内なら直接 (地下降下の話ではない)。
  if (depth <= 0 && (o.reachable || dist <= o.reach)) {
    return { ...base, mode: "direct", reason: "same_level_reachable" };
  }
  // 4) 深い降下は、真下・斜め下・水平に離れているかを問わず螺旋階段。
  //    旧 tickTunnel の垂直掘り分岐 (|dx|<=1,|dz|<=1,dy<-1) はここに吸収される。
  if (depth >= o.spiralMinDepth) {
    return { ...base, mode: "spiral", reason: depth >= o.spiralMinDepth && horiz <= 1 ? "deep_below_spiral_not_vertical" : "deep_descent_spiral" };
  }
  // 5) 浅いが到達圏外: 階段を作るほどではない。隣接位置へ移動してから掘る。
  return { ...base, mode: "adjacent", reason: "shallow_out_of_reach_move_adjacent" };
}

/** 手が届く範囲に来たので隣接採掘へ切り替えるべきか (純粋関数)。 */
export function shouldSwitchToAdjacent(botPos, targetPos, opts) {
  if (!isPos(botPos) || !isPos(targetPos)) return false;
  const o = resolveOpts(opts);
  if (opts && opts.reachable === true) return true;
  return dist3d(botPos, targetPos) <= o.reach;
}

// ---------------------------------------------------------------- anchor

/**
 * 螺旋階段の起点 (入口) を作る (純粋関数)。
 * 起点は「降下開始時点の自分の足元ブロック」で固定する。対象座標ではない
 * (対象へ寄せると降下の途中で入口がずれ、戻り路が壊れるため)。
 * 返り値は凍結した新規オブジェクト。入力は破壊しない。
 */
export function createSpiralAnchor(botPos, targetPos) {
  if (!isPos(botPos)) return null;
  const base = floorPos(botPos);
  return Object.freeze({
    x: base.x, y: base.y, z: base.z,
    targetKey: isPos(targetPos) ? keyOf(targetPos) : null,
  });
}

/**
 * 起点を固定する (純粋関数)。既存の起点があれば、対象が別の鉱石へ
 * 変わっていても・自分が移動していても、必ず既存をそのまま返す。
 * 「降下中に別鉱石を検出しても階段の起点を作り直さない」要件の実装点。
 * 起点が無い (null/undefined/不正) ときだけ新規作成する。
 * 降下完了・中止時に起点を捨てる判断は呼び出し側の責務 (本関数は捨てない)。
 */
export function ensureSpiralAnchor(existingAnchor, botPos, targetPos) {
  if (existingAnchor && Number.isFinite(existingAnchor.x) &&
      Number.isFinite(existingAnchor.y) && Number.isFinite(existingAnchor.z)) {
    return existingAnchor; // 同一参照を返す: 作り直しが起きていないことの証明に使える
  }
  return createSpiralAnchor(botPos, targetPos);
}

// ---------------------------------------------------------------- staircase shape

/**
 * 起点から stepIndex 段目 (0 = 起点そのもの) の階段セル (純粋関数)。
 * 各段は前段から「水平マンハッタン1 + 下降1」で連なる。
 */
export function spiralStepAt(anchor, stepIndex) {
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) ||
      !Number.isFinite(anchor.z) || !Number.isInteger(stepIndex) || stepIndex < 0) {
    return null;
  }
  if (stepIndex === 0) return { x: anchor.x, y: anchor.y, z: anchor.z };
  const off = D2_PERIMETER[(stepIndex - 1) % D2_PERIMETER.length];
  return { x: anchor.x + off.x, y: anchor.y - stepIndex, z: anchor.z + off.z };
}

/**
 * 起点から targetY に達するまでの階段セル列 (起点を含む、新規配列)。
 * targetY が起点以上なら [起点] のみ。歩いて戻れることの検証は
 * isWalkableReturn() で行う。
 */
export function spiralStepsToDepth(anchor, targetY) {
  if (!anchor || !Number.isFinite(targetY)) return [];
  const depth = Math.max(0, Math.floor(anchor.y - targetY));
  const steps = [];
  for (let i = 0; i <= depth; i++) steps.push(spiralStepAt(anchor, i));
  return steps;
}

/**
 * 階段セル列が「飛行・積み上げなしで入口まで歩いて戻れる」形かを検証する。
 * 条件: 連続セルの水平移動がマンハッタン1以内 かつ 高さ変化が -1..+1
 * (下降列として渡された場合は逆向きに +1 ずつ昇れることと等価)。
 */
export function isWalkableReturn(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return false;
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1], b = steps[i];
    if (!isPos(a) || !isPos(b)) return false;
    if (manhattanXZ(a, b) > 1) return false;
    if (Math.abs(b.y - a.y) > 1) return false;
  }
  return true;
}

