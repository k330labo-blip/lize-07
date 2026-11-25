// snowtread_math.js — POLISH-ANIM-SNOWTREAD-01 純粋核 (cycle2333 統合)
// 雪カテゴリの足元を「歩行し続けている間だけ」脚が小さく沈む体の上下+前傾で表す。
// 仕様の正: brain_parts/solutions/polish-backlog/cycle2333_a13_draft.md §3
//
// 純粋モジュール (ドラフト): @minecraft/server を import しない。相対 import も持たない
//   (ドラフト置き場から単体で node 実行できること。統合時は gaze_math.js の
//    GAZE_PITCH_MIN/MAX を import へ置換し、同値のローカル写しを消すこと)。
// 決定的: 時刻・距離・足元カテゴリは全て引数で受け取る。Date.now/乱数を持たない。
// 例外を投げない: 不正入力は 不発(false) / 0オフセット / baseそのまま に倒す。
// 表示層のみ: 移動・経路・速度・実座標には一切触らない。出力は表示オフセットのみ。
//   bodySinkBlocks は「表示上の沈み」であり、実 Y 座標へ加算してはならない。

import { GAZE_PITCH_MIN as SNOWTREAD_GAZE_MIN_DEG, GAZE_PITCH_MAX as SNOWTREAD_GAZE_MAX_DEG } from "./gaze_math.js";
export { SNOWTREAD_GAZE_MIN_DEG, SNOWTREAD_GAZE_MAX_DEG };

export const SNOWTREAD_SINK_BLOCKS = 0.06;   // 沈みの最大量 (表示オフセット, ブロック相当)
export const SNOWTREAD_PITCH_DEG = 3;        // 沈みピークでの前傾 (下向き正, 度)
export const SNOWTREAD_CYCLE_BLOCKS = 1.4;   // 沈み1周期 (= 左右2歩分) に進む水平距離
export const SNOWTREAD_ENTER_SAMPLES = 2;    // 発火に必要な雪上歩行サンプルの連続回数
export const SNOWTREAD_EXIT_SAMPLES = 3;     // 終了に必要な非該当サンプルの連続回数 (ちらつき防止)
export const SNOWTREAD_MIN_SPEED = 0.5;      // これ未満の水平速度 (blocks/s 相当) は歩行とみなさない

// 雪上として扱う足元カテゴリ (汎用カテゴリのみ。ブロック個別 ID は持たない:
// feeder 側が sfx.js の素材分類と同じ作法でカテゴリ化して渡す想定)
const SNOW_CATEGORIES = new Set(["snow", "powder_snow", "snow_layer"]);

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// isSnowtreadSurface(category) -> boolean
//   文字列カテゴリが雪系のときだけ true。未知/非文字列/大文字違いは false (安全側)。
export function isSnowtreadSurface(category) {
  try { return typeof category === "string" && SNOW_CATEGORIES.has(category); }
  catch { return false; }
}

// snowtreadOffset(phase) -> { sinkBlocks, pitchDeg }
//   phase は周期内の位置 [0,1)。域外は有限値へ wrap する (負値も可)。
//   非数/NaN は {0,0}。波形: sink は sin(π*phase) の単一山形 (歩幅の真ん中で最も沈む)、
//   pitch は sink に比例。phase=0/1 で必ず 0 に戻り、残留しない。
export function snowtreadOffset(phase) {
  try {
    const p = fin(phase);
    if (p === null) return { sinkBlocks: 0, pitchDeg: 0 };
    const w = ((p % 1) + 1) % 1;
    const k = Math.sin(Math.PI * w);
    return {
      sinkBlocks: SNOWTREAD_SINK_BLOCKS * k,
      pitchDeg: SNOWTREAD_PITCH_DEG * k,
    };
  } catch { return { sinkBlocks: 0, pitchDeg: 0 }; }
}

// applySnowtreadPitch(basePitchDeg, phase) -> 度
//   base が非有限なら base をそのまま返す。それ以外は base+pitch を gaze クランプ内へ。
export function applySnowtreadPitch(basePitchDeg, phase) {
  try {
    if (!Number.isFinite(basePitchDeg)) return basePitchDeg;
    const off = snowtreadOffset(phase);
    return clamp(basePitchDeg + off.pitchDeg, SNOWTREAD_GAZE_MIN_DEG, SNOWTREAD_GAZE_MAX_DEG);
  } catch { return basePitchDeg; }
}

// 抑制の内訳: いずれも ===true のときだけ抑制 (真値一般は抑制にしない。既存核の作法)
function isSuppressed(s) {
  return s.suppressed === true || s.falling === true || s.flying === true
    || s.inWater === true || s.combat === true || s.climbing === true
    || s.hurt === true;
}

// sample の歩行適格 (カテゴリ未確定=undefined/null は「不明」であって不適格ではない)
function sampleKind(s) {
  if (!s || typeof s !== "object") return "invalid";
  if (s.surfaceCategory === undefined || s.surfaceCategory === null) return "unknown";
  if (isSuppressed(s)) return "no";
  if (s.grounded !== true || s.moving !== true) return "no";
  const sp = fin(s.speed);
  if (sp === null || sp < SNOWTREAD_MIN_SPEED) return "no";
  return isSnowtreadSurface(s.surfaceCategory) ? "yes" : "no";
}

export function createSnowtreadState() {
  return {
    active: false,      // 雪上歩行の沈み表示が有効か
    enterCount: 0,      // 連続した適格サンプル数
    exitCount: 0,       // active 中の連続した非該当サンプル数
    phase: 0,           // 沈み波形の周期内位置 [0,1)
    lastDist: null,     // 前回サンプルの累積水平距離 (null=未観測)
    episode: 0,         // 発火エピソード数 (記録のみ)
  };
}

// noteSnowtread(state, sample, distTotal) -> { active, entered, exited, reason }
//   sample: { surfaceCategory, grounded, moving, speed, suppressed?, falling?,
//             flying?, inWater?, combat?, climbing?, hurt? }
//   distTotal: その bot の累積水平移動距離 (単調増加想定。巻き戻し/非数は前進なし扱い)
//   規則:
//     - kind="unknown" (カテゴリ未確定): 状態・位相を一切変えない (UNKNOWN 保持)。
//     - kind="invalid": 何も変えない。
//     - 非 active 時: "yes" が ENTER_SAMPLES 連続で初めて active 化 (entered:true, episode+1)。
//       "no" で enterCount は 0 に戻る。
//     - active 時: "yes" で exitCount=0 に戻し、distTotal の前進分だけで phase を進める。
//       "no" が EXIT_SAMPLES 連続で終了 (exited:true, phase は 0 へ戻す=出口で残留しない)。
//     - 位相は距離駆動のみ (時間では進めない)。止まればその場で止まる。
export function noteSnowtread(state, sample, distTotal) {
  const out = { active: false, entered: false, exited: false, reason: "invalid" };
  try {
    if (!state || typeof state !== "object") return out;
    out.active = state.active === true;
    const kind = sampleKind(sample);
    if (kind === "invalid") { out.reason = "invalid"; return out; }
    if (kind === "unknown") { out.reason = "unknown_hold"; return out; }

    const dist = fin(distTotal);
    const advanced = (dist !== null && fin(state.lastDist) !== null && dist > state.lastDist)
      ? dist - state.lastDist : 0;
    if (dist !== null) state.lastDist = dist;

    if (!state.active) {
      if (kind === "yes") {
        state.enterCount = (fin(state.enterCount) || 0) + 1;
        if (state.enterCount >= SNOWTREAD_ENTER_SAMPLES) {
          state.active = true; state.enterCount = 0; state.exitCount = 0;
          state.phase = 0; state.episode = (fin(state.episode) || 0) + 1;
          out.active = true; out.entered = true; out.reason = "entered";
          return out;
        }
        out.reason = "entering";
      } else {
        state.enterCount = 0; out.reason = "not_eligible";
      }
      return out;
    }

    // active 中
    if (kind === "yes") {
      state.exitCount = 0;
      if (advanced > 0) {
        state.phase = (((fin(state.phase) || 0) + advanced / SNOWTREAD_CYCLE_BLOCKS) % 1 + 1) % 1;
      }
      out.active = true; out.reason = "active";
      return out;
    }
    state.exitCount = (fin(state.exitCount) || 0) + 1;
    if (state.exitCount >= SNOWTREAD_EXIT_SAMPLES) {
      state.active = false; state.exitCount = 0; state.phase = 0;
      out.exited = true; out.reason = "exited";
      return out;
    }
    out.active = true; out.reason = "exiting";
    return out;
  } catch { return out; }
}

// snowtreadCurrentOffset(state) -> { sinkBlocks, pitchDeg, active }
//   非 active / 不正な state では必ず {0,0,false} (表示の残留を構造的に防ぐ)。
export function snowtreadCurrentOffset(state) {
  try {
    if (!state || typeof state !== "object" || state.active !== true) {
      return { sinkBlocks: 0, pitchDeg: 0, active: false };
    }
    const off = snowtreadOffset(state.phase);
    return { sinkBlocks: off.sinkBlocks, pitchDeg: off.pitchDeg, active: true };
  } catch { return { sinkBlocks: 0, pitchDeg: 0, active: false }; }
}
