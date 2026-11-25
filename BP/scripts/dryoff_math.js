// dryoff_math.js — 雨上がりに水を払う小さな首振り POLISH-ANIM-DRYOFF-01 (純粋核)
// 出典: brain_parts/solutions/cycle1303-a16-polish-idea.md §2/§3/§4 (仕様の正)
// 純粋モジュール: @minecraft/server を import しない。現在時刻 / エンティティ参照を持たない
// (時刻は引数で受ける)。例外を投げない。表示層のみ: 移動・作業・戦闘・掘削ゲート・
// 天候取得・発話には一切触らない。音・パーティクルも足さない。
// 消費点は統合時に main.js applyGaze の既存ヨー重畳の末尾へ最下位優先で1系統足すだけ
// (優先: 危険・作業対象・FLINCH/INSPECT/NOD/SKYGLANCE/LOOKBACK/SUMMONSCAN > DRYOFF)。
// 流儀は sky_glance_math.js / lookback_math.js に倣う: 波形 (Offset) / At / apply* /
// is*Active / *Due / should* のセット + 状態記録の薄いラッパ note*。
// 波形 Offset は範囲外で null でなく 0 を返す (sky_glance / summon_scan と同じ方式)。
// ヨーの wrap は lookback_math.js の wrapYawDeg と同一式を本モジュール内に持つ:
// lookback 側へ import 依存を増やすと、片方だけの差し替えで静かに壊れるため。

export const DRYOFF_AMPLITUDE_DEG = 8;   // 首振りの振幅 (仕様 §2/§3)。±8度
export const DRYOFF_DURATION_MS = 600;   // 全体 0.6秒 (仕様 §2/§3)
export const DRYOFF_CYCLES = 2;          // 2往復 (仕様 §2/§3)
export const DRYOFF_COOLDOWN_MS = 600000; // 10分 (仕様 §3。SKYGLANCE と同値)

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// wrapDryoffYawDeg(deg) -> [-180, 180] へ正規化したヨー。-180 は 180 に寄せる
// (lookback_math.js wrapYawDeg と同一式・同一境界)。非有限はそのまま返す。
export function wrapDryoffYawDeg(deg) {
  try {
    if (!Number.isFinite(deg)) return deg;
    let d = ((deg + 180) % 360 + 360) % 360 - 180;
    if (d === -180) d = 180;
    return d;
  } catch { return deg; }
}

// dryoffYawOffset(elapsedMs) -> ヨーのオフセット (度)。範囲外・無効入力は 0。
// 受け形は2通り:
// - 数値: 発火からの経過 ms
// - オブジェクト: 状態 { startedAtMs } と第2引数 nowMs から経過を出す (a16 §3 の状態形)
// 波形 (仕様 §3 の式そのまま): A * sin(2π * CYCLES * t/D) * (1 - t/D), t は 0〜600ms。
// 零点は t = 0 / 150 / 300 / 450 / 600、符号区間は + / - / + / - (反転3回 = 2往復)。
// 代表値: t=75 -> +7, t=225 -> -5, t=375 -> +3, t=525 -> -1 (減衰が見える形)。
// どの入力でも |offset| <= 8。例外を投げない。
export function dryoffYawOffset(elapsedOrState, nowMs) {
  try {
    let e;
    if (elapsedOrState && typeof elapsedOrState === "object") {
      const s = finiteOrNull(elapsedOrState.startedAtMs), n = finiteOrNull(nowMs);
      if (s === null || n === null) return 0;
      e = n - s;
    } else {
      e = finiteOrNull(elapsedOrState);
    }
    if (e === null || e < 0 || e >= DRYOFF_DURATION_MS) return 0;
    const v = DRYOFF_AMPLITUDE_DEG
      * Math.sin(2 * Math.PI * DRYOFF_CYCLES * e / DRYOFF_DURATION_MS)
      * (1 - e / DRYOFF_DURATION_MS);
    return v === 0 ? 0 : v; // -0 を 0 に正規化
  } catch { return 0; }
}

// dryoffYawAt(startedAtMs, nowMs) -> 現在のヨーオフセット (度)。範囲外・無効入力は 0
// (skyglancePitchAt / flinchPitchAt と同じ「呼び出し側を分岐させない」版)
export function dryoffYawAt(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return 0;
    return dryoffYawOffset(n - s);
  } catch { return 0; }
}

// applyDryoffYaw(baseYawDeg, elapsedMs) -> wrap 済みヨー
// ピッチではないため gaze_math のクランプは使わない (ヨーは wrap のみ)。
// オフセット 0 (範囲外) でも wrap だけは適用されるが、値が範囲内なら base と同一になる。
// base 非有限時は base をそのまま返す (lookback の apply* と同規則)。
export function applyDryoffYaw(baseYawDeg, elapsedMs) {
  try {
    if (!Number.isFinite(baseYawDeg)) return baseYawDeg;
    return wrapDryoffYawDeg(baseYawDeg + dryoffYawOffset(elapsedMs));
  } catch { return baseYawDeg; }
}

// isDryoffActive(stateOrStartedAtMs, nowMs) -> boolean
// 受け形は2通り (sky_glance と同じ): 数値 = startedAtMs、オブジェクト = state.startedAtMs。
// 0 <= nowMs - startedAtMs < 600 のときだけ true。時計巻き戻しは false。
export function isDryoffActive(stateOrStartedAtMs, nowMs) {
  try {
    const raw = stateOrStartedAtMs && typeof stateOrStartedAtMs === "object"
      ? stateOrStartedAtMs.startedAtMs : stateOrStartedAtMs;
    const s = finiteOrNull(raw), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    const e = n - s;
    return e >= 0 && e < DRYOFF_DURATION_MS;
  } catch { return false; }
}

// dryoffDue(lastFiredAtMs, nowMs) -> boolean: クールダウン判定 (10分)
// 初回 (lastFiredAtMs が非有限) は true。nowMs 非有限は false (発火させない側)。
// 境界: 前回 +599999ms は false、+600000ms は true。
export function dryoffDue(lastFiredAtMs, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    const last = finiteOrNull(lastFiredAtMs);
    if (last === null) return true;
    return n - last >= DRYOFF_COOLDOWN_MS;
  } catch { return false; }
}

// shouldDryoff(input) -> boolean: 発火可否の純粋判定 (仕様 §2 発火条件 + §3-4 抑制条件)
// input (最小形は { wasRaining, isRaining, lastFiredAtMs, nowMs }。
// 抑制の内訳を渡せる拡張形も受ける。いずれも ===true のときだけ抑制として扱う):
// {
//   wasRaining, isRaining,   // c.env.isRaining の前 tick 値 / 今 tick 値。発火は真->偽の「辺」でのみ
//   suppressed,              // 統合側で束ねた抑制フラグ (最小形はこちらだけでもよい)
//   danger, inCombat,        // 抑制: 危険対象が視界にある間 / 戦闘中 (仕様 §3-4)
//   hasWorkTarget, workTarget, // 抑制: 作業対象へ視線が向いている間 (hasWorkTarget 優先)
//   flinchActive, inspectActive, nodActive, skyglanceActive, lookbackActive,
//   summonScanActive, otherOverlayActive, // 抑制: 他の重畳が再生中 (本件は最下位)。
//                            // summonScanActive は「復元直後」の抑制 (仕様 §3-4) も兼ねる
//   falling, inWater, justTeleported, justRespawned, // 抑制: 落下中 / 水中 / 復元直後
//   underground, skyVisible, // 抑制: 地下・屋内など雨を受けていない場所
//                            // (統合側に既存フラグがある場合のみ渡す。skyVisible===false も抑制)
//   lastFiredAtMs, lastFiredMs, // クールダウン用 (lastFiredAtMs が正、lastFiredMs は別名)
//   nowMs,
// }
// 成立条件: (1) wasRaining===true かつ isRaining===false の辺で (2) 抑制に触れず
// (3) クールダウン明け。真偽は厳密一致のみ (1/0 等の truthy は辺とみなさない、sky_glance と同規則)。
// いずれも欠ければ false。例外を投げない (null / NaN 時刻は発火しない側に倒す)。
// 本関数は純粋判定であり辺を消費しない。配線側は should の結果に関わらず
// 毎 tick prevRaining = isRaining を更新すること。それにより抑制中に立った辺は消費され、
// 抑制が解けた後に遅れて発火することはない (仕様 §3「雨上がりから時間が経ってから唐突に振らない」)。
// 戻り値が true のときだけ、呼び出し側が state.startedAtMs = state.lastFiredAtMs = nowMs を記録する。
export function shouldDryoff(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.wasRaining !== true || input.isRaining !== false) return false; // 辺でのみ
    if (input.suppressed === true) return false;
    if (input.danger === true || input.inCombat === true) return false;
    if (input.hasWorkTarget === true) return false;
    if (input.hasWorkTarget === undefined && input.workTarget) return false;
    if (input.flinchActive === true) return false;
    if (input.inspectActive === true) return false;
    if (input.nodActive === true) return false;
    if (input.skyglanceActive === true) return false;
    if (input.lookbackActive === true) return false;
    if (input.summonScanActive === true) return false;
    if (input.otherOverlayActive === true) return false;
    if (input.falling === true) return false;
    if (input.inWater === true) return false;
    if (input.justTeleported === true) return false;
    if (input.justRespawned === true) return false;
    if (input.underground === true) return false;
    if (input.skyVisible === false) return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;
    const last = input.lastFiredAtMs !== undefined ? input.lastFiredAtMs : input.lastFiredMs;
    return dryoffDue(last, input.nowMs);
  } catch { return false; }
}

// noteDryoff(state, isRainingOrInput, nowMsArg) -> boolean (発火を記録したら true)
// a16 §3 の状態記録ラッパ。state は配線側が保持する表示層状態:
//   { prevRaining, startedAtMs, lastFiredAtMs }
// 受け形は2通り:
// - noteDryoff(state, isRaining /* boolean */, nowMs)          … 抑制なしの最小形
// - noteDryoff(state, { isRaining, nowMs, danger, ... })       … 抑制の内訳を渡す拡張形
// 振る舞い:
// - 初回観測 (state.prevRaining が boolean でない) は記録だけで発火しない
//   (スポーン直後に「雨が上がった」と誤認しない。sky_glance の初回観測不発火と同趣旨)。
// - isRaining が boolean でない入力は無視し、prevRaining を壊さない (false を返す)。
// - 真->偽の辺でのみ shouldDryoff へ委譲し、true なら startedAtMs / lastFiredAtMs を記録する。
// - 辺の消費: isRaining が boolean の呼び出しでは結果に関わらず prevRaining を更新する。
//   抑制中に踏んだ辺も消費され、後から遅れて発火しない。
// - 抑制・クールダウンで発火しなかった辺では lastFiredAtMs を進めない (§2 差異2)。
// state がオブジェクトでない場合は何もせず false。例外を投げない。
export function noteDryoff(state, isRainingOrInput, nowMsArg) {
  try {
    if (!state || typeof state !== "object") return false;
    let isRaining, nowMs, extra = {};
    if (isRainingOrInput && typeof isRainingOrInput === "object") {
      isRaining = isRainingOrInput.isRaining;
      nowMs = isRainingOrInput.nowMs;
      extra = isRainingOrInput;
    } else {
      isRaining = isRainingOrInput;
      nowMs = nowMsArg;
    }
    if (typeof isRaining !== "boolean") return false;
    const was = state.prevRaining;
    state.prevRaining = isRaining; // 辺の消費: 結果に関わらず更新
    if (was !== true || isRaining !== false) return false;
    const fire = shouldDryoff({
      ...extra,
      wasRaining: true, isRaining: false, // 辺は本関数が確定済み (extra 側の値で上書きしない)
      lastFiredAtMs: state.lastFiredAtMs, nowMs,
    });
    if (!fire) return false;
    state.startedAtMs = nowMs;
    state.lastFiredAtMs = nowMs;
    return true;
  } catch { return false; }
}
