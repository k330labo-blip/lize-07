// draft.js — 火のそばで手を温める小さな待機仕草 POLISH-ANIM-WARMHANDS-01 (純粋核ドラフト)
// 担当: cycle0721-a08 (作り込みトラック常設枠・新規発案)。未統合ドラフト。本ファイルが核の正。
// 純粋モジュール: @minecraft/server を import しない、相対 import を持たない、例外を投げない、
// 乱数・Date.now を持たない (時刻・距離は引数で受ける決定的モジュール)。
// 表示層のみ: 移動・作業・戦闘・掘削ゲート・発話・音・パーティクルには一切触らない。
// 熱源の走査はしない。呼び出し側が既存観測から束ねた素の真偽 (nearHeat) だけを受ける。
// c.x 参照は呼び出し側で optional chaining 済みの素の値だけを渡すこと。真偽は ===true のときだけ効く。
// 統合想定: BP/scripts/warmhands_math.js として新設し、main.js applyGaze の既存ピッチ重畳の
// 末尾へ最下位優先で1系統足すだけ。腕ピッチは r.lastWarmhands への記録のみ (RP配線は統合時に別途判断)。

export const WARMHANDS_SUSTAIN_MS = 4000;   // 熱源のそばで静止が続いてから発火するまでの滞在
export const WARMHANDS_DURATION_MS = 2400;  // 1回の全体
export const WARMHANDS_RAMP_IN_MS = 400;    // 入り (線形 0→1)
export const WARMHANDS_HOLD_END_MS = 1900;  // 保持の終わり (以降は線形で戻る)
export const WARMHANDS_COOLDOWN_MS = 90000; // 発火開始からの最小間隔
export const WARMHANDS_PITCH_DEG = 10;      // 手元・火元への見下ろし (下向き正)
export const WARMHANDS_ARM_PITCH_DEG = -30; // 手をかざす腕ピッチ (記録のみ、負=前方へ上げる向きは統合側の符号規約に従う)
export const WARMHANDS_STILL_MAX_DIST = 1.0; // 滞在中に許す水平移動量の上限 (ブロック、これを超えたら滞在リセット)
export const WARMHANDS_REASONS = Object.freeze([
  "fire", "warming", "sustaining", "cooldown", "no_heat",
  "moved_reset", "suppressed", "invalid",
]);

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// createWarmhandsState() -> 表示層状態 (呼び出し側が保持する)
// { heatSinceMs:null, startedAtMs:null, lastFiredAtMs:null, anchorDist:0, lastRecord:null }
export function createWarmhandsState() {
  return { heatSinceMs: null, startedAtMs: null, lastFiredAtMs: null, anchorDist: 0, lastRecord: null };
}

// warmhandsEnvelope(elapsedMs) -> 0..1 の台形エンベロープ。範囲外・無効入力は 0。例外を投げない。
// 区間: [0,400) 線形で入り / [400,1900] 保持 1 / (1900,2400) 線形で戻る / 2400以上は 0。
export function warmhandsEnvelope(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= WARMHANDS_DURATION_MS) return 0;
    if (e < WARMHANDS_RAMP_IN_MS) return clamp01(e / WARMHANDS_RAMP_IN_MS);
    if (e <= WARMHANDS_HOLD_END_MS) return 1;
    return clamp01((WARMHANDS_DURATION_MS - e) / (WARMHANDS_DURATION_MS - WARMHANDS_HOLD_END_MS));
  } catch { return 0; }
}

// warmhandsPitchAt(startedAtMs, nowMs) -> 現在のピッチオフセット (度)。無効・範囲外は 0。
export function warmhandsPitchAt(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return 0;
    return WARMHANDS_PITCH_DEG * warmhandsEnvelope(n - s);
  } catch { return 0; }
}

// isWarmhandsActive(state, nowMs) -> 再生中か。時計巻き戻しは false。
export function isWarmhandsActive(state, nowMs) {
  try {
    if (!state || typeof state !== "object") return false;
    const s = finiteOrNull(state.startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    const e = n - s;
    return e >= 0 && e < WARMHANDS_DURATION_MS;
  } catch { return false; }
}

// warmhandsDue(lastFiredAtMs, nowMs) -> クールダウン明けか。初回 (非有限) は true、nowMs 非有限は false。
export function warmhandsDue(lastFiredAtMs, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    const last = finiteOrNull(lastFiredAtMs);
    if (last === null) return true;
    return n - last >= WARMHANDS_COOLDOWN_MS;
  } catch { return false; }
}

const SUPPRESS_KEYS = Object.freeze([
  "working", "digging", "attacking", "placing", "crafting",
  "inCombat", "danger", "falling", "inWater", "climbing",
  "justTeleported", "justRespawned", "dead", "otherOverlayActive",
]);

// noteWarmhands(state, sample, nowMs) -> { fired:boolean, reason:string }
// sample: {
//   nearHeat:boolean,        // 熱源 (焚き火・点火中かまど等の近傍) にいるか。呼び出し側の既存観測の素の真偽
//   idle:boolean,            // 待機中 (目的地への移動中でない) か
//   stepDist:number|undefined, // 前回呼び出しからの水平移動量 (有限値のみ加算)
//   ...SUPPRESS_KEYS の各真偽 (===true のときだけ抑制)
// }
// 振る舞い:
// - nearHeat!==true または idle!==true の間は滞在 (heatSinceMs) をリセットし発火しない。
// - 滞在中の累積移動が WARMHANDS_STILL_MAX_DIST を超えたら滞在をその時点から数え直す (moved_reset)。
// - 滞在が SUSTAIN_MS に達し、抑制が無く、クールダウン明けのときにだけ1回発火し
//   startedAtMs / lastFiredAtMs を記録する。発火後は滞在をリセットする (連続発火しない)。
// - 抑制中に滞在が満ちても発火は保留せず破棄する (滞在リセット)。抑制が解けた直後に
//   唐突に温まり始めないため (先行核の「辺の消費」と同趣旨)。
// - 再生中の再呼び出しは { fired:false, reason:"warming" } を返し状態を壊さない。
// 例外を投げない。state がオブジェクトでない場合は { fired:false, reason:"invalid" }。
export function noteWarmhands(state, sample, nowMs) {
  try {
    if (!state || typeof state !== "object") return { fired: false, reason: "invalid" };
    const n = finiteOrNull(nowMs);
    if (n === null || !sample || typeof sample !== "object") {
      state.lastRecord = { fired: false, reason: "invalid", atMs: n };
      return { fired: false, reason: "invalid" };
    }
    if (isWarmhandsActive(state, n)) {
      state.lastRecord = { fired: false, reason: "warming", atMs: n };
      return { fired: false, reason: "warming" };
    }
    if (sample.nearHeat !== true || sample.idle !== true) {
      state.heatSinceMs = null; state.anchorDist = 0;
      state.lastRecord = { fired: false, reason: "no_heat", atMs: n };
      return { fired: false, reason: "no_heat" };
    }
    if (state.heatSinceMs === null || !Number.isFinite(state.heatSinceMs)) {
      state.heatSinceMs = n; state.anchorDist = 0;
      state.lastRecord = { fired: false, reason: "sustaining", atMs: n };
      return { fired: false, reason: "sustaining" };
    }
    const step = finiteOrNull(sample.stepDist);
    if (step !== null && step > 0) state.anchorDist = (finiteOrNull(state.anchorDist) ?? 0) + step;
    if (state.anchorDist > WARMHANDS_STILL_MAX_DIST) {
      state.heatSinceMs = n; state.anchorDist = 0;
      state.lastRecord = { fired: false, reason: "moved_reset", atMs: n };
      return { fired: false, reason: "moved_reset" };
    }
    if (n - state.heatSinceMs < WARMHANDS_SUSTAIN_MS) {
      state.lastRecord = { fired: false, reason: "sustaining", atMs: n };
      return { fired: false, reason: "sustaining" };
    }
    // 滞在が満ちた。この辺は消費する (発火・抑制・冷却のいずれでも滞在はリセット)。
    state.heatSinceMs = null; state.anchorDist = 0;
    for (const k of SUPPRESS_KEYS) {
      if (sample[k] === true) {
        state.lastRecord = { fired: false, reason: "suppressed", atMs: n };
        return { fired: false, reason: "suppressed" };
      }
    }
    if (!warmhandsDue(state.lastFiredAtMs, n)) {
      state.lastRecord = { fired: false, reason: "cooldown", atMs: n };
      return { fired: false, reason: "cooldown" };
    }
    state.startedAtMs = n; state.lastFiredAtMs = n;
    state.lastRecord = { fired: true, reason: "fire", atMs: n };
    return { fired: true, reason: "fire" };
  } catch {
    return { fired: false, reason: "invalid" };
  }
}

// sampleWarmhands(state, nowMs) -> { active, pitchDeg, armPitchDeg, reason }
// 統合側は pitchDeg を applyGaze のピッチへ最下位で重畳し、armPitchDeg は記録のみに使う。
export function sampleWarmhands(state, nowMs) {
  try {
    if (!isWarmhandsActive(state, nowMs)) {
      return { active: false, pitchDeg: 0, armPitchDeg: 0, reason: "idle" };
    }
    const env = warmhandsEnvelope(nowMs - state.startedAtMs);
    return {
      active: true,
      pitchDeg: WARMHANDS_PITCH_DEG * env,
      armPitchDeg: WARMHANDS_ARM_PITCH_DEG * env,
      reason: "warming",
    };
  } catch {
    return { active: false, pitchDeg: 0, armPitchDeg: 0, reason: "invalid" };
  }
}
