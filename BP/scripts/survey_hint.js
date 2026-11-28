// survey_hint_draft.js — survey ヒントで坑道を誘導する純粋核 (ドラフト, cycle1443-a03)
// 出典: brain_parts/solutions/basics-orechain-audit/DESIGN.md 段4「地下検出」。
// 実測 D2 形状: ダイヤ潜行は目標深度帯 (depth=-54) 到達 3/3 に対し、ランダム方向の
// tickBranchMine では 15000tick 内に鉱脈検出 0/3。survey は heightRange 全高走査で
// 既知座標 (hits) を持っているのに、坑道の進行方向へ寄せる仕組みが無いことが断点。
// 本モジュールはその「寄せる」判断だけを純粋関数化する。移動・掘削・実世界読み取りは
// 持たない (spiral.js / underground_math.js と同型)。統合時は main.js 側が
// surveys (Map) と bot.location / r.mineLeg を渡し、返った方向・中継点だけを実行する。
//
// 入力の実データ形 (main.js v0.4.9x 時点で確認):
//   surveys: Map<"dim:rx,rz", { dim, rx, rz, at, doneMask, fails, hits: { typeId: [{x,y,z}] } }>
//            配列で渡してもよい (内部で両対応)。at は Date.now() ミリ秒。
//   leg:     r.mineLeg = { depth, item } (depth は絶対 Y、例 diamond → -54)
//   pos:     bot.location = { x, y, z } (小数可)
// 純粋モジュール: @minecraft/server を import しない。例外を投げない (全関数 try/catch)。
import { makeInferredRegion } from "./observability.js"; // 0-P (cyc2485 S3/S6): 区画ヒントの正規形は observability が正
// c.x 等への参照は持たない。ctx フィールドの削除・意味変更はしない (本モジュールは新規)。

export const SURVEY_HINT = {
  TTL_MS: 15 * 60 * 1000, // main.js SURVEY_TTL_MS と同一値 (単一の正は main.js 側、ここは既定値)
  DEPTH_BAND: 8,          // targetY ± この範囲のヒントを「深度帯内」とする (ダイヤ分布帯 ±8 の監査記述に合わせる)
  STEER_RADIUS: 64,       // 水平距離がこれ以内なら誘導対象 (REGION_SIZE=64 と同尺度: 隣接区画まで)
  CLUSTER_RADIUS: 4,      // 同一鉱脈とみなす近傍半径 (ダイヤ鉱脈 1〜8 個の広がり)
  DY_WEIGHT: 2.25,        // lookupSurvey の重み dy^2 * 2.25 と同一 (縦移動は掘削コストが高い)
  ARRIVE_H: 1.5,          // ヒント列へ到達とみなす水平距離
};

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const keyOf = (loc) => `${loc?.x},${loc?.y},${loc?.z}`;

// surveys (Map | 配列 | null) を sv 配列へ正規化する。不正な要素は捨てる。
export function surveyListOf(surveys) {
  try {
    if (!surveys) return [];
    const arr = surveys instanceof Map ? [...surveys.values()] : Array.isArray(surveys) ? surveys : [];
    return arr.filter((sv) => sv && typeof sv === "object" && sv.hits && typeof sv.hits === "object");
  } catch { return []; }
}

// ヒントが新鮮か。now を注入可能にする (テスト容易性)。at 不正は陳腐扱い。
export function hintFresh(sv, now = Date.now(), ttlMs = SURVEY_HINT.TTL_MS) {
  try { return !!sv && isNum(sv.at) && isNum(now) && now - sv.at < ttlMs && now - sv.at >= 0; }
  catch { return false; }
}

// loc が深度帯内か。depth が null/不正なら帯判定は常に true (帯で絞らない)。
export function inDepthBand(loc, depth, band = SURVEY_HINT.DEPTH_BAND) {
  try {
    if (!isNum(depth)) return true;
    if (!loc || !isNum(loc.y)) return false;
    return Math.abs(loc.y - depth) <= (isNum(band) && band >= 0 ? band : SURVEY_HINT.DEPTH_BAND);
  } catch { return false; }
}

// surveys から wantIds のヒント候補を平坦化する。
// 除外: 別次元 / 陳腐 / banKey 一致 / forbiddenKeys 一致。
// 返り値: [{ loc:{x,y,z}, typeId, at, svRx, svRz }] (重複座標は typeId 優先順で先勝ち)
// 0-P (cyc2485 S3/S6): 旧 collectHints は sv.hits の正確な座標をヒントとして返していた (X-ray の出口)。
// 置換後のヒントは inferred_region のみ: surveys のカバレッジ (自分が調べた区画) + 分布知識 (depth/expectTypeId)
// だけで生成し、隠れたブロックの座標・件数・有無は一切含めない。depth/expect が無い対象 (地表物) には出さない。
// opts 互換: wantIds/banKey/forbiddenKeys は受ける (wantIds は expect の代替、banKey/forbiddenKeys は regionKey の除外として解釈)。
export function collectHints(surveys, opts = {}) {
  try {
    const { dimId = null, wantIds = null, now = Date.now(), ttlMs = SURVEY_HINT.TTL_MS, banKey = null, forbiddenKeys = null, banRegionKey = null, depth = null, expectTypeId = null } = opts || {};
    const expect = expectTypeId || (Array.isArray(wantIds) && wantIds.length ? wantIds[0] : null);
    if (!isNum(depth) || !expect) return [];
    const forb = new Set();
    if (banRegionKey) forb.add(banRegionKey);
    if (banKey) forb.add(banKey);
    if (forbiddenKeys instanceof Set) for (const k of forbiddenKeys) forb.add(k);
    else if (Array.isArray(forbiddenKeys)) for (const k of forbiddenKeys) forb.add(k);
    const arr = surveys instanceof Map ? [...surveys.values()] : Array.isArray(surveys) ? surveys : [];
    const out = [], seen = new Set();
    for (const sv of arr) {
      if (!sv || typeof sv !== "object" || !isNum(sv.rx) || !isNum(sv.rz)) continue;
      if (dimId != null && sv.dim !== dimId) continue;
      if (!hintFresh(sv, now, ttlMs)) continue;
      const regionKey = `${sv.dim}:${sv.rx},${sv.rz}`;
      if (seen.has(regionKey) || forb.has(regionKey)) continue;
      seen.add(regionKey);
      out.push({
        loc: { x: sv.rx * 64 + 32, y: depth, z: sv.rz * 64 + 32 },
        typeId: expect, at: sv.at, svRx: sv.rx, svRz: sv.rz, regionKey,
        region: makeInferredRegion({ regionKey, dimension: sv.dim, yMin: depth - SURVEY_HINT.DEPTH_BAND, yMax: depth + SURVEY_HINT.DEPTH_BAND, expectTypeId: expect, at: now, confidence: 0.3 }),
      });
    }
    return out;
  } catch { return []; }
}

// 近傍ヒント数 (鉱脈らしさ)。同 typeId のみ数える。自身を含む。
export function clusterSize(hint, hints, radius = SURVEY_HINT.CLUSTER_RADIUS) {
  try {
    if (!hint?.loc || !Array.isArray(hints)) return 0;
    const r2 = (isNum(radius) && radius >= 0 ? radius : SURVEY_HINT.CLUSTER_RADIUS) ** 2;
    let n = 0;
    for (const h of hints) {
      if (!h?.loc || h.typeId !== hint.typeId) continue;
      const dx = h.loc.x - hint.loc.x, dy = h.loc.y - hint.loc.y, dz = h.loc.z - hint.loc.z;
      if (dx * dx + dy * dy + dz * dz <= r2) n++;
    }
    return n;
  } catch { return 0; }
}

// ヒントのスコア (小さいほど良い)。lookupSurvey の距離重みを土台に:
//   base = dx^2 + dz^2 + dy^2 * DY_WEIGHT
//   深度帯外は帯からの超過 1 セルごとに水平 4 セル相当の罰則 (帯内へ先に寄せる)
//   クラスタ (鉱脈) は 1 個ごとに base を 5% 割引 (上限 25%: 単体ヒントを潰さない)
//   陳腐化は最大 +10% (TTL 内の相対鮮度のみ。鮮度切れは collectHints で除外済み)
export function scoreHint(pos, hint, opts = {}) {
  try {
    if (!pos || !hint?.loc || !isNum(pos.x) || !isNum(pos.y) || !isNum(pos.z)) return Infinity;
    const { depth = null, cluster = 1, now = Date.now(), ttlMs = SURVEY_HINT.TTL_MS } = opts || {};
    const dx = hint.loc.x - pos.x, dy = hint.loc.y - pos.y, dz = hint.loc.z - pos.z;
    let s = dx * dx + dz * dz + dy * dy * SURVEY_HINT.DY_WEIGHT;
    if (isNum(depth) && !inDepthBand(hint.loc, depth)) {
      const over = Math.abs(hint.loc.y - depth) - SURVEY_HINT.DEPTH_BAND;
      s += over * over * 16;
    }
    const c = isNum(cluster) && cluster > 1 ? Math.min(cluster - 1, 5) : 0;
    s *= 1 - c * 0.05;
    if (isNum(hint.at) && isNum(now) && isNum(ttlMs) && ttlMs > 0) {
      const age = Math.min(Math.max(now - hint.at, 0), ttlMs);
      s *= 1 + (age / ttlMs) * 0.1;
    }
    return s;
  } catch { return Infinity; }
}

// 最良ヒントを 1 件選ぶ。無ければ null。
// 返り値: { loc, typeId, score, cluster, distH, distV }
export function chooseHint(pos, hints, opts = {}) {
  try {
    if (!pos || !Array.isArray(hints) || !hints.length) return null;
    let best = null;
    for (const h of hints) {
      if (!h?.loc) continue;
      const cluster = clusterSize(h, hints, opts?.clusterRadius);
      const score = scoreHint(pos, h, { ...opts, cluster });
      if (!Number.isFinite(score)) continue;
      if (!best || score < best.score) {
        best = {
          loc: { ...h.loc }, typeId: h.typeId, regionKey: h.regionKey || null, region: h.region || null, score, cluster,
          distH: Math.hypot(h.loc.x - pos.x, h.loc.z - pos.z),
          distV: h.loc.y - pos.y,
        };
      }
    }
    return best;
  } catch { return null; }
}

// pos から hint への 4 直交方向 (tickBranchMine の mineDir 形 {x,z})。
// 支配軸を取る (斜めを返さない: BM-12 の教訓)。同点・到達済みは null。
export function hintDirection(pos, hintLoc) {
  try {
    if (!pos || !hintLoc || !isNum(pos.x) || !isNum(pos.z) || !isNum(hintLoc.x) || !isNum(hintLoc.z)) return null;
    const dx = hintLoc.x - Math.floor(pos.x), dz = hintLoc.z - Math.floor(pos.z);
    if (dx === 0 && dz === 0) return null;
    if (Math.abs(dx) >= Math.abs(dz)) return { x: Math.sign(dx), z: 0 };
    return { x: 0, z: Math.sign(dz) };
  } catch { return null; }
}

// D2 形状の中核判断: 深度帯到達後の坑道をヒントへ誘導すべきか。
// 入力: { pos, leg:{depth,item}, surveys | hints, dimId, wantIds, banKey, forbiddenKeys, now, ... }
// 返り値 (判別共用体):
//   { mode:"steer", hint, dir, waypoint }  誘導する。waypoint は深度帯 Y に射影した中継点
//                                          (まず hint 列の深度帯まで掘り進み、最後に縦へ寄せる)
//   { mode:"arrived", hint }               hint 列の水平近傍にいる (呼び出し側は通常の対象接近へ)
//   { mode:"random", reason }              誘導しない。reason: "no_hint"|"stale_only"|"too_far"|"no_depth"|"bad_input"
//                                          呼び出し側は従来のランダム方向 (現行動作) へフォールバックする
// 設計原則: ヒントが無い/遠い/古い場合は現行動作と完全一致させる (回帰ゼロを狙う)。
// 半径外ヒントで遠回りさせない: STEER_RADIUS 超は too_far。
export function steerDecision(input = {}) {
  try {
    const o = input || {};
    const pos = o.pos, depth = o.leg?.depth ?? o.depth ?? null;
    if (!pos || !isNum(pos.x) || !isNum(pos.y) || !isNum(pos.z)) return { mode: "random", reason: "bad_input" };
    if (!isNum(depth)) return { mode: "random", reason: "no_depth" };
    // 深度帯に未到達なら誘導判断の対象外 (潜行/螺旋が先。呼び出し側の到達後に再評価する想定)
    if (Math.abs(pos.y - depth) > SURVEY_HINT.DEPTH_BAND) return { mode: "random", reason: "no_depth" };
    let hints = Array.isArray(o.hints) ? o.hints : null;
    if (!hints) {
      // stale_only の切り分けのため、鮮度を無視した生候補の有無も見る
      const raw = collectHints(o.surveys, { ...o, depth, expectTypeId: o.leg?.item || o.expectTypeId || null, now: o.now, ttlMs: Number.MAX_SAFE_INTEGER });
      hints = collectHints(o.surveys, { ...o, depth, expectTypeId: o.leg?.item || o.expectTypeId || null });
      if (!hints.length) return { mode: "random", reason: raw.length ? "stale_only" : "no_hint" };
    }
    if (!hints.length) return { mode: "random", reason: "no_hint" };
    const best = chooseHint(pos, hints, { depth, now: o.now, ttlMs: o.ttlMs });
    if (!best) return { mode: "random", reason: "no_hint" };
    if (best.distH <= (isNum(o.arriveH) ? o.arriveH : SURVEY_HINT.ARRIVE_H)) return { mode: "arrived", hint: best };
    const radius = isNum(o.steerRadius) && o.steerRadius > 0 ? o.steerRadius : SURVEY_HINT.STEER_RADIUS;
    if (best.distH > radius) return { mode: "random", reason: "too_far", hint: best };
    const dir = hintDirection(pos, best.loc);
    if (!dir) return { mode: "arrived", hint: best };
    return {
      mode: "steer", hint: best, dir,
      waypoint: { x: best.loc.x, y: depth, z: best.loc.z },
    };
  } catch { return { mode: "random", reason: "bad_input" }; }
}

// 誘導中の方向維持: 現在の mineDir が hint 方向と食い違う/行き過ぎた場合だけ差し替える。
// 毎 tick 差し替えると blocked 時の 90° 回転 (回避) を潰すため、呼び出し側は
// 「方向転換した直後」「N tick 進捗なし」のときだけ呼ぶ想定の純粋判定。
// 返り値: { dir, changed:boolean, overshoot:boolean }
export function reSteerDir(pos, hintLoc, curDir) {
  try {
    const want = hintDirection(pos, hintLoc);
    if (!want) return { dir: curDir ?? null, changed: false, overshoot: true };
    const changed = !curDir || curDir.x !== want.x || curDir.z !== want.z;
    // 行き過ぎ: hint 列を支配軸で通過した (符号反転) 場合も changed=true になる。
    // overshoot は「同一列/行に乗り、目標の手前後 1 セル以内」の近接通過として別途返す。
    const dx = hintLoc.x - Math.floor(pos?.x), dz = hintLoc.z - Math.floor(pos?.z);
    const overshoot = !!curDir && changed && Math.min(Math.abs(dx), Math.abs(dz)) <= 1;
    return { dir: want, changed, overshoot };
  } catch { return { dir: null, changed: false, overshoot: false }; }
}
