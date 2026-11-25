// surfacebreath_math.js — POLISH-ANIM-SURFACEBREATH-01 純粋核 (cycle1703 統合)
// 出典 (仕様の正): brain_parts/solutions/cycle1640-a12/DRAFT.md §3 / §5、ドラフト cycle1703-a09 (99/99)
// 統合: cycle1703 (v0.5.18)。敵対監査 cycle1703-a20 の条件 S2 により全体時間を 700ms から 1400ms へ拡大
//   クランプ定数は gaze_math.js の GAZE_PITCH_MIN / GAZE_PITCH_MAX を import して単一の正に揃えること
//   (本ドラフトはフォルダ内で自己完結させるため同値をローカル定数として持つ)。
// 純粋モジュール: @minecraft/server を import しない。現在時刻 / エンティティ参照を持たない
//   (時刻・観測は全て引数で受ける)。例外を投げない。どの入力でも有限値だけを返す。
// 表示層のみ: 水中移動・浮上/潜水・移動目標・経路・速度・掘削ゲート・作業/戦闘判定・
//   サウンド・発話には一切触らない。音は足さない (出水音は POLISH-SND-SWIM-01 の管轄)。
// 流儀は sky_glance_math.js / bridgegaze_math.js に倣う:
//   波形 (Offset) / At / apply* / is*Active / *Due / should* / create*State + step* + sample*。
//   波形 Offset は範囲外で null でなく 0 を返す (skyglance / summon_scan と同じ方式)。

// ---- 定数 (DRAFT §3 の定数案が正) ----
export const SURFACEBREATH_MIN_SUBMERGED_MS = 3000; // 水中滞在がこれ未満の出水は発火しない
export const SURFACEBREATH_DURATION_MS = 1400;     // 全体: 入り300 + 保持300 + 戻り800 (a20 S2: applyGaze周期対策で仕様案700msを拡大)
export const SURFACEBREATH_ENTER_MS = 300;         // 入り区間
export const SURFACEBREATH_HOLD_MS = 300;          // 保持区間
export const SURFACEBREATH_RETURN_MS = 800;        // 戻り区間 (= 1400 - 300 - 300)
export const SURFACEBREATH_PITCH_DEG = -14;        // 上向き (gaze_math の符号系: 上向きが負)
export const SURFACEBREATH_COOLDOWN_MS = 15000;    // 冷却 15秒

// gaze_math の GAZE_PITCH_MIN / MAX と同値のローカル写し (統合時に import へ置換すること)。
export const SURFACEBREATH_GAZE_MIN_DEG = -60;
export const SURFACEBREATH_GAZE_MAX_DEG = 75;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// 抑制の内訳 (DRAFT §4): いずれも ===true のときだけ抑制として扱う。
// suppressed は統合側で束ねたフラグ、その他は個別の内訳 (どちらか片方だけでもよい)。
function isSuppressed(src) {
  if (!src || typeof src !== "object") return false;
  return src.suppressed === true
    || src.danger === true        // 戦闘中 / 危険接近時 (FLINCH 管轄)
    || src.combat === true
    || src.falling === true       // 落下中
    || src.hasWorkTarget === true // 作業対象を向いている間
    || (src.hasWorkTarget === undefined && !!src.workTarget)
    || src.summonScanActive === true // 召喚・復元直後 (SUMMONSCAN 有効期間中)
    || src.otherOverlayActive === true;
}

// surfacebreathPitchOffset(elapsedMs) -> 頭ピッチのオフセット (度, 上向き = 負)。範囲外・無効入力は 0。
// 波形 (DRAFT §3: 入り 150ms で -14度 -> 保持 150ms -> 戻り 400ms で完全な 0 へ。戻り切らない状態を持たない):
//   0–300ms:   0 -> -14 (sin で滑らかに上げる)
//   300–600ms: -14 保持
//   600–1400ms: -14 -> 0 (cos で滑らかに戻る)
// 経過 <0 / >=1400 / 非数 / NaN は 0 (無動作)。例外を投げない。どの入力でも |offset| <= 14。
export function surfacebreathPitchOffset(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= SURFACEBREATH_DURATION_MS) return 0;
    const holdEnd = SURFACEBREATH_ENTER_MS + SURFACEBREATH_HOLD_MS; // 300
    const v = e < SURFACEBREATH_ENTER_MS
      ? SURFACEBREATH_PITCH_DEG * Math.sin((e / SURFACEBREATH_ENTER_MS) * Math.PI / 2)
      : e < holdEnd
        ? SURFACEBREATH_PITCH_DEG
        : SURFACEBREATH_PITCH_DEG * Math.cos(((e - holdEnd) / SURFACEBREATH_RETURN_MS) * Math.PI / 2);
    return v === 0 ? 0 : v; // -0 を 0 に正規化
  } catch { return 0; }
}

// surfacebreathPitchAt(startedAtMs, nowMs) -> 現在のピッチオフセット (度)。範囲外・無効入力は 0。
export function surfacebreathPitchAt(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return 0;
    return surfacebreathPitchOffset(n - s);
  } catch { return 0; }
}

// applySurfacebreathPitch(basePitchDeg, elapsedMs) -> クランプ済みピッチ
// クランプ範囲は gaze_math の -60..75 と同値 (統合時はそちらを import すること)。
// オフセット 0 (範囲外) でもクランプだけは適用されるが、値が範囲内なら base と同一になる。
// base 非有限時は base をそのまま返す (先行要素の apply* と同規則)。
export function applySurfacebreathPitch(basePitchDeg, elapsedMs) {
  try {
    if (!Number.isFinite(basePitchDeg)) return basePitchDeg;
    return Math.max(SURFACEBREATH_GAZE_MIN_DEG,
      Math.min(SURFACEBREATH_GAZE_MAX_DEG, basePitchDeg + surfacebreathPitchOffset(elapsedMs)));
  } catch { return basePitchDeg; }
}

// isSurfacebreathActive(stateOrStartedAtMs, nowMs) -> boolean
// 受け形は2通り: 数値 (startedAtMs) / オブジェクト (state.startedAtMs)。
// 0 <= nowMs - startedAtMs < 1400 のときだけ true。時計巻き戻しは false。
export function isSurfacebreathActive(stateOrStartedAtMs, nowMs) {
  try {
    const raw = stateOrStartedAtMs && typeof stateOrStartedAtMs === "object"
      ? stateOrStartedAtMs.startedAtMs : stateOrStartedAtMs;
    const s = finiteOrNull(raw), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    const e = n - s;
    return e >= 0 && e < SURFACEBREATH_DURATION_MS;
  } catch { return false; }
}

// surfacebreathDue(lastFiredAtMs, nowMs) -> boolean: クールダウン判定 (15秒)
// 初回 (lastFiredAtMs が非有限) は true。nowMs 非有限は false (発火させない側)。
// 境界: 前回 +14999ms は false、+15000ms は true。
export function surfacebreathDue(lastFiredAtMs, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    const last = finiteOrNull(lastFiredAtMs);
    if (last === null) return true;
    return n - last >= SURFACEBREATH_COOLDOWN_MS;
  } catch { return false; }
}

// shouldSurfacebreath(input) -> boolean: 発火可否の純粋判定 (DRAFT §3 の発火条件)
// input: {
//   submergedMs,            // 出水の辺における水中滞在時間 (ms)。配線側が滞在開始時刻から算出する
//   rising,                 // 出水直前が上昇中か (===true のときだけ発火。浅瀬へ水平に出た出水は不発)
//   suppressed, danger, combat, falling, hasWorkTarget, workTarget,
//   summonScanActive, otherOverlayActive, // 抑制の内訳 (isSuppressed 参照)
//   lastFiredAtMs, lastFiredMs,           // クールダウン用 (lastFiredAtMs が正)
//   nowMs,
// }
// 成立条件: (1) submergedMs >= 3000 (2) rising===true (3) 抑制なし (4) クールダウン明け。
// 本関数は「出水の辺」でだけ呼ぶ前提の純粋判定であり、辺そのものの検出は step 側の責務。
// 例外を投げない (null / NaN は発火しない側に倒す)。
export function shouldSurfacebreath(input) {
  try {
    if (!input || typeof input !== "object") return false;
    const sub = finiteOrNull(input.submergedMs);
    if (sub === null || sub < SURFACEBREATH_MIN_SUBMERGED_MS) return false;
    if (input.rising !== true) return false;
    if (isSuppressed(input)) return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;
    const last = input.lastFiredAtMs !== undefined ? input.lastFiredAtMs : input.lastFiredMs;
    return surfacebreathDue(last, input.nowMs);
  } catch { return false; }
}

// ---- 状態機械 (配線側が bot.isInWater の変化観測に相乗りする想定。DRAFT §3) ----
// state: {
//   wasInWater: true | false | null, // 前回観測。null = 未観測 (初回は辺として扱わない)
//   submergedSinceMs: number | null, // 水中滞在の開始時刻
//   startedAtMs: number | null,      // 発火中アニメの開始時刻
//   lastFiredAtMs: number | null,    // 前回発火時刻 (冷却判定 + 統合時の r.lastSurfaceBreath 記録元)
// }
export function createSurfacebreathState() {
  return { wasInWater: null, submergedSinceMs: null, startedAtMs: null, lastFiredAtMs: null };
}

// sampleSurfacebreath(state, nowMs) -> { active, gazePitchDeg }
// 発火中でなければ gazePitchDeg は常に完全な 0。状態は変更しない。例外を投げない。
export function sampleSurfacebreath(state, nowMs) {
  try {
    if (!state || typeof state !== "object") return { active: false, gazePitchDeg: 0 };
    const started = finiteOrNull(state.startedAtMs);
    if (started === null) return { active: false, gazePitchDeg: 0 };
    const pitch = surfacebreathPitchAt(started, nowMs);
    return { active: isSurfacebreathActive(started, nowMs), gazePitchDeg: pitch };
  } catch { return { active: false, gazePitchDeg: 0 }; }
}

// stepSurfacebreath(state, sample, nowMs) -> { active, gazePitchDeg }
// sample: { inWater, rising, suppressed, danger, combat, falling, hasWorkTarget,
//           workTarget, summonScanActive, otherOverlayActive }
// 振る舞い:
//  - inWater===true: 水中。滞在開始時刻を (再) 入水の辺で記録し、発火中なら即打ち切って 0 へ戻す (DRAFT §4/§5-6)。
//  - inWater===false かつ前回が true (出水の辺): 滞在時間・上昇・抑制・冷却を should* で判定し、
//    成立したときだけ1回発火する。成立しなかった辺も消費する (遅れ発火しない。先行要素の辺消費と同一)。
//  - inWater が真偽どちらでもない (undefined 等): UNKNOWN として状態を進めず、現在値だけを返す。
//  - nowMs が非有限: 状態を進めず、有限値だけを返す。
// 副作用は state の更新のみ。例外を投げない。
export function stepSurfacebreath(state, sample, nowMs) {
  try {
    if (!state || typeof state !== "object") return { active: false, gazePitchDeg: 0 };
    const now = finiteOrNull(nowMs);
    if (now === null) return sampleSurfacebreath(state, state.startedAtMs ?? 0);
    const sm = sample && typeof sample === "object" ? sample : {};

    if (sm.inWater === true) {
      if (state.wasInWater !== true) state.submergedSinceMs = now; // 入水の辺で滞在計測を開始
      state.wasInWater = true;
      state.startedAtMs = null; // 再入水で打ち切り: 水中で上向きが残らない
      return { active: false, gazePitchDeg: 0 };
    }

    if (sm.inWater === false) {
      if (state.wasInWater === true) {
        // 出水の辺 (1回だけ判定し、結果に関わらず消費する)
        const since = finiteOrNull(state.submergedSinceMs);
        const submergedMs = since === null ? 0 : now - since;
        const fire = shouldSurfacebreath({
          submergedMs,
          rising: sm.rising,
          suppressed: sm.suppressed, danger: sm.danger, combat: sm.combat,
          falling: sm.falling, hasWorkTarget: sm.hasWorkTarget, workTarget: sm.workTarget,
          summonScanActive: sm.summonScanActive, otherOverlayActive: sm.otherOverlayActive,
          lastFiredAtMs: state.lastFiredAtMs, nowMs: now,
        });
        if (fire) { state.startedAtMs = now; state.lastFiredAtMs = now; }
        state.submergedSinceMs = null;
      } else if (state.wasInWater === null) {
        state.submergedSinceMs = null; // 初回観測 (陸から開始) は辺として扱わない
      }
      state.wasInWater = false;
      return sampleSurfacebreath(state, now);
    }

    // inWater が UNKNOWN: streak/辺の状態を保持し、現在値だけ返す
    return sampleSurfacebreath(state, now);
  } catch { return { active: false, gazePitchDeg: 0 }; }
}
