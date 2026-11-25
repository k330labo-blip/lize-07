// sky_glance_math_draft.js — 雨の降り始めに空を一度だけ見上げる POLISH-ANIM-SKYGLANCE-01 (純粋核)
// 出典: brain_parts/solutions/cycle1110-a14/REPORT.md (仕様の正, §1 内容 / §4 純粋核の契約 / §5 検証方法)
// 統合: cycle1133 (v0.5.2) で BP へ正式統合。出典ドラフトは brain_parts/solutions/cycle1133-a10/。
// 純粋モジュール: サーバーAPIを import しない。現在時刻 / エンティティ参照を持たない (時刻は引数で受ける)。
// 例外を投げない。表示層のみ: 移動・作業・戦闘・掘削ゲート・天候取得・発話には一切触らない。音も足さない (仕様 §1)。
// 消費点は統合時に main.js applyGaze の既存ピッチ重畳点 (INSPECT -> NOD -> FLINCH の後ろ) へ
// 最下位優先 (FLINCH > INSPECT > NOD > SKYGLANCE) で1系統足すだけ。新規アセット・プロパティ・ボーンはなし。
// 流儀は flinch_math.js / nod_math.js / summon_scan_math.js に倣う: 波形 (Offset) / At / apply* /
// is*Active / *Due / should* のセット。ただし波形 Offset は仕様 §5 が「900ms 超過で 0 に戻る」
// ことを要求するため、範囲外は null でなく 0 を返す (summon_scan_math と同じ方式、nod/flinch との差異は意図的)。
// 統合時の注意: 本ドラフトは置き場所 (brain_parts/solutions/cycle1133-a10/) から gaze_math を相対参照する。
// BP/scripts/ へ移す際は import を "./gaze_math.js" へ直すこと (flinch_math.js / nod_math.js と同じ形)。
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX} from "./gaze_math.js";

export const SKYGLANCE_PEAK_DEG = 22; // 見上げ振幅 (仕様 §1/§4)。符号は gaze_math の系: 上向きが負
export const SKYGLANCE_DURATION_MS = 900; // 全体 (仕様 §1/§4: 入り300 / 保持300 / 戻り300)
export const SKYGLANCE_PHASE_MS = 300; // 1区間 (入り/保持/戻りは等分 300ms)
export const SKYGLANCE_COOLDOWN_MS = 600000; // 10分 (仕様 §1-5/§4: 降り始めの辺が短時間に繰り返し立っても最大10分に1回)

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v)? v: null;}

// skyglancePitchOffset(elapsedMs) -> 頭ピッチのオフセット (度, 見上げ = 負) 。範囲外・無効入力は 0。
// 波形 (仕様 §1: 0 -> -22 -> 0 の滑らかな往復。nod の台形と同じ sin 入り / cos 戻り):
// 0–300ms: 0 -> -22 (sin で滑らかに見上げる)
// 300–600ms: -22 保持
// 600–900ms: -22 -> 0 (cos で滑らかに戻る)
// 経過 <0 / >=900 / 非数 / NaN は 0 (無動作)。例外を投げない。どの入力でも |offset| <= 22。
export function skyglancePitchOffset(elapsedMs) {
try {
const e = finiteOrNull(elapsedMs);
if (e === null || e < 0 || e >= SKYGLANCE_DURATION_MS) return 0;
const P = SKYGLANCE_PHASE_MS, A = SKYGLANCE_PEAK_DEG;
const v = e < P? -A * Math.sin((e / P) * Math.PI / 2)
: e < 2 * P? -A
: -A * Math.cos(((e - 2 * P) / P) * Math.PI / 2);
return v === 0? 0: v; // -0 を 0 に正規化 (e=0 で -A*sin(0) が -0 になるため)
} catch { return 0;}
}

// skyglancePitchAt(startedAtMs, nowMs) -> 現在のピッチオフセット (度)。範囲外・無効入力は 0
// (flinchPitchAt / summonScanYawAt と同じ「呼び出し側を分岐させない」版)
export function skyglancePitchAt(startedAtMs, nowMs) {
try {
const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
if (s === null || n === null) return 0;
return skyglancePitchOffset(n - s);
} catch { return 0;}
}

// applySkyglancePitch(basePitchDeg, elapsedMs) -> クランプ済みピッチ
// クランプは gaze_math の GAZE_PITCH_MIN (-60) / MAX (75) を流用 (符号・上限の定数は新設しない)。
// 振幅 22 度は見上げ上限 -60 度の内側 (仕様 §1)。オフセット 0 (範囲外) でもクランプだけは適用される
// が、値が範囲内なら base と同一になる。base 非有限時は base をそのまま返す (nod/flinch の apply* と同規則)。
export function applySkyglancePitch(basePitchDeg, elapsedMs) {
try {
if (!Number.isFinite(basePitchDeg)) return basePitchDeg;
return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + skyglancePitchOffset(elapsedMs)));
} catch { return basePitchDeg;}
}

// isSkyglanceActive(stateOrStartedAtMs, nowMs) -> boolean
// 受け形は2通り (仕様 §4 の isSkyglanceActive(state, nowMs) と、nod/flinch 流の (startedAtMs, nowMs) の両対応):
// - 数値: startedAtMs として扱う
// - オブジェクト: state.startedAtMs を読む (呼び出し側の表示層状態 { startedAtMs, lastFiredAtMs} の形, 仕様 §4)
// 0 <= nowMs - startedAtMs < 900 のときだけ true。時計巻き戻し (now < start) は false (nod/flinch と同規則)。
export function isSkyglanceActive(stateOrStartedAtMs, nowMs) {
try {
const raw = stateOrStartedAtMs && typeof stateOrStartedAtMs === "object"
? stateOrStartedAtMs.startedAtMs: stateOrStartedAtMs;
const s = finiteOrNull(raw), n = finiteOrNull(nowMs);
if (s === null || n === null) return false;
const e = n - s;
return e >= 0 && e < SKYGLANCE_DURATION_MS;
} catch { return false;}
}

// skyglanceDue(lastFiredAtMs, nowMs) -> boolean: クールダウン判定 (仕様 §1-5/§4: 10分)
// 初回 (lastFiredAtMs が非有限) は true。nowMs 非有限は false (発火させない側)。
// 境界: 前回 +599999ms は false、+600000ms は true。
export function skyglanceDue(lastFiredAtMs, nowMs) {
try {
const n = finiteOrNull(nowMs);
if (n === null) return false;
const last = finiteOrNull(lastFiredAtMs);
if (last === null) return true;
return n - last >= SKYGLANCE_COOLDOWN_MS;
} catch { return false;}
}

// shouldSkyglance(input) -> boolean: 発火可否の純粋判定 (仕様 §1 発火条件 + 抑制条件 1〜5、§4 の契約)
// input (最小形は §4 の { wasRaining, isRaining, suppressed, lastFiredAtMs, nowMs}。
// 抑制の内訳を渡せる拡張形も受ける。いずれも ===true のときだけ抑制として扱う):
// {
// wasRaining, isRaining, // c.env.isRaining の前 tick 値 / 今 tick 値。発火は偽->真の「辺」でのみ (仕様 §1)
// suppressed, // 統合側で束ねた抑制フラグ (最小形はこちらだけでもよい)
// danger, // 抑制1: 危険対象が視界にある間 (applyGaze の danger 系が有効)
// hasWorkTarget, workTarget, // 抑制2: 作業対象へ視線が向いている間 (work_target 有効。hasWorkTarget 優先、workTarget は真値で判定)
// flinchActive, inspectActive, nodActive, otherOverlayActive, // 抑制3: FLINCH/INSPECT/NOD 等の重畳が再生中 (本件は最下位)
// underground, skyVisible, // 抑制4: 地下・屋内など空が見えない場所 (統合側に既存フラグがある場合のみ渡す。skyVisible===false も抑制)
// lastFiredAtMs, lastFiredMs, // クールダウン用 (仕様 §4 の lastFiredAtMs が正、lastFiredMs は別名)
// nowMs,
//}
// 成立条件: (1) wasRaining===false かつ isRaining===true の辺で (2) 抑制に触れず (3) クールダウン明け。
// いずれも欠ければ false。例外を投げない (null / NaN 時刻は発火しない側に倒す)。
// 本関数は純粋判定であり辺を消費しない。配線側は should の結果に関わらず
// 毎 tick prevRaining = isRaining を更新すること。それにより抑制中に立った辺は消費され、
// 抑制が解けた後に遅れて発火することはない (仕様 §1「タイミングを逃したらその雨では出さない」)。
// 戻り値が true のときだけ、呼び出し側が state.startedAtMs = state.lastFiredAtMs = nowMs を記録する (仕様 §4)。
export function shouldSkyglance(input) {
try {
if (!input || typeof input!== "object") return false;
if (input.wasRaining!== false || input.isRaining!== true) return false; // 辺でのみ (継続中・止んだ辺・初回観測は発火しない)
if (input.suppressed === true) return false;
if (input.danger === true) return false;
if (input.hasWorkTarget === true) return false;
if (input.hasWorkTarget === undefined && input.workTarget) return false;
if (input.flinchActive === true) return false;
if (input.inspectActive === true) return false;
if (input.nodActive === true) return false;
if (input.otherOverlayActive === true) return false;
if (input.underground === true) return false;
if (input.skyVisible === false) return false;
const now = finiteOrNull(input.nowMs);
if (now === null) return false;
const last = input.lastFiredAtMs!== undefined? input.lastFiredAtMs: input.lastFiredMs;
return skyglanceDue(last, input.nowMs);
} catch { return false;}
}
