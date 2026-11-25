// flinch_math.js — 近傍の落雷・点火TNTへの身構え POLISH-ANIM-FLINCH-01 (純粋核, cycle1051 統合)
// 出典: brain_parts/solutions/cycle1036-a21/REPORT.md §1 (仕様の正) / polish-backlog 正本の同 ID 行
// 出典ドラフト: brain_parts/solutions/cycle1051-a12/flinch_math_draft.js (単体テスト40/40)
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// 表示層のみ: 移動・作業・戦闘・掘削ゲート・発話には一切触らない。消費点は統合時に
// applyGaze のピッチオフセットのみを想定 (INSPECT / NOD と同じ接続点・同じクランプ)。
// 流儀は nod_math.js / inspect_math.js に倣う: 波形 (Offset) / apply*Pitch /
// is*Active / *Due / should* の5点セット + 対象解決の補助関数。
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX } from "./gaze_math.js";

export const FLINCH_DURATION_MS = 350;   // すくみの全体 (a21 指定: 0.35秒 ≒ 7 tick)
export const FLINCH_MAX_DEG = 18;        // 頭を下げる深さ (a21 指定: 18度。NOD 12度より大きく INSPECT 32度より小さい)
export const FLINCH_COOLDOWN_MS = 3000;  // 雷雨などで震え続けないための間引き (a21 指定: 3秒)

// 予兆エンティティ種別 -> 発火する水平距離の上限 (a21 §1.2 の表が正)。
// 対象は「HP変化のない予兆」だけ。爆発そのもの・ダメージは対象外 (hurt 系が正)。
// クリーパーは種別だけでは予兆にならないため shouldFlinch 側で ignited===true を必須とする。
export const FLINCH_RANGES = Object.freeze({
  "minecraft:lightning_bolt": 24,
  "minecraft:tnt": 10,
  "minecraft:creeper": 6,
});

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// flinchRangeFor(typeId) -> 距離上限 | null (対象外種別・非文字列は null)
export function flinchRangeFor(typeId) {
  try {
    if (typeof typeId !== "string") return null;
    return Object.prototype.hasOwnProperty.call(FLINCH_RANGES, typeId) ? FLINCH_RANGES[typeId] : null;
  } catch { return null; }
}

// flinchPitchOffset(elapsedMs) -> 追加ピッチ (度, 下向き正) | null (範囲外=無効)
// 驚きの波形: t 0〜0.2 で素早くピークへ (sin), 0.2〜1 で滑らかに復帰 (cos)。
// NOD/INSPECT の台形 (保持区間あり) と違い保持区間を持たない単発のすくみ。
// 負値・非数・NaN・DURATION 以上は例外なく null。
export function flinchPitchOffset(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= FLINCH_DURATION_MS) return null;
    const t = e / FLINCH_DURATION_MS;
    const k = t < 0.2 ? Math.sin((t / 0.2) * Math.PI / 2)
            : Math.cos(((t - 0.2) / 0.8) * Math.PI / 2);
    return FLINCH_MAX_DEG * k;
  } catch { return null; }
}

// flinchPitchAt(startedAtMs, nowMs) -> 現在の追加ピッチ (度)。範囲外は 0
// (a21 §1.4 の flinchPitchAt 相当。呼び出し側を null 分岐させない版)
export function flinchPitchAt(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return 0;
    const off = flinchPitchOffset(n - s);
    return off === null ? 0 : off;
  } catch { return 0; }
}

// applyFlinchPitch(basePitchDeg, elapsedMs) -> クランプ済みピッチ
// クランプは gaze_math の GAZE_PITCH_MIN/MAX を流用 (符号定数は新設しない)。
// オフセット無効時・base 非有限時は base をそのまま返す。
export function applyFlinchPitch(basePitchDeg, elapsedMs) {
  try {
    const off = flinchPitchOffset(elapsedMs);
    if (off === null || !Number.isFinite(basePitchDeg)) return basePitchDeg;
    return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

// isFlinchActive(startedAtMs, nowMs): 発火時刻が有効で DURATION 内にあるか。
// 時計巻き戻し (now < start) は無効に倒す (nod/inspect と同規則)。
export function isFlinchActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    return flinchPitchOffset(n - s) !== null;
  } catch { return false; }
}

// flinchDue(lastFiredMs, nowMs): クールダウン判定。
// 初回 (lastFiredMs が非有限) は true。nowMs 非有限は false (発火させない側)。
export function flinchDue(lastFiredMs, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    const last = finiteOrNull(lastFiredMs);
    if (last === null) return true;
    return n - last >= FLINCH_COOLDOWN_MS;
  } catch { return false; }
}

// shouldFlinch(input) -> boolean: 発火条件の純粋判定。
// input: {
//   typeId,                 // 予兆エンティティの typeId (FLINCH_RANGES のいずれか)
//   horizDist, distance,    // Bot から予兆までの水平距離 (horizDist 優先, distance は別名)
//   appeared,               // 「出現の辺」: 前 tick の観測集合に無く今 tick にある場合のみ true
//   ignited,                // クリーパーの点火状態 (typeId が creeper のとき必須, 他では無視)
//   lastFiredMs, nowMs,     // クールダウン判定用
//   hurtEdge, inCombat, falling, inWater,  // 抑制条件 (a21 §1.3, ===true のときだけ抑制)
//   headBusyUntilMs,        // 頭ピッチを使う他の作り込みの再生終了時刻 (先行側が勝つ)
//   lastOrderMs,            // 主人から新しい指示を受けた時刻 (直後1秒は指示応答が優先)
//   landMs,                 // 直近の着地時刻 (前後0.5秒は FALLLAND が正)
// }
// 成立条件: (1) 種別が対象で (2) 出現の辺で (3) creeper は点火済みで
// (4) 距離が上限以内 (境界含む) で (5) 抑制条件に触れず (6) クールダウン明け。
// いずれも欠ければ false。例外を投げない。距離は水平距離のみ (3D距離と混同しない)。
export function shouldFlinch(input) {
  try {
    if (!input || typeof input !== "object") return false;
    const range = flinchRangeFor(input.typeId);
    if (range === null) return false;
    if (input.appeared !== true) return false;
    if (input.typeId === "minecraft:creeper" && input.ignited !== true) return false;
    const dist = finiteOrNull(input.horizDist) !== null ? finiteOrNull(input.horizDist) : finiteOrNull(input.distance);
    if (dist === null || dist < 0 || dist > range) return false;
    // 抑制条件 (a21 §1.3): 先行する表現・状態が常に勝つ。表示の競合回避のみが目的。
    if (input.hurtEdge === true) return false;
    if (input.inCombat === true) return false;
    if (input.falling === true) return false;
    if (input.inWater === true) return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;
    const busy = finiteOrNull(input.headBusyUntilMs);
    if (busy !== null && now < busy) return false;
    const order = finiteOrNull(input.lastOrderMs);
    if (order !== null && now - order < 1000) return false; // 巻き戻し (負差) も抑制側に倒す
    const land = finiteOrNull(input.landMs);
    if (land !== null && Math.abs(now - land) < 500) return false;
    return flinchDue(input.lastFiredMs, input.nowMs);
  } catch { return false; }
}

// decideFlinch(prevTypeIds, curEntries, state) -> { flinch, sourceTypeId }
// a21 §1.4 の decideFlinch 相当の薄いラッパ: 観測差分から「出現の辺」を作り
// shouldFlinch へ委譲する。統合時の呼び出し側はこの形でも、shouldFlinch 単体でもよい。
// prevTypeIds: 前 tick に観測した entityId の配列/Set。curEntries: [{ id, typeId, horizDist, ignited }]
// state: shouldFlinch の input から typeId/horizDist/appeared/ignited を除いた残り。
// 複数の予兆が同時に出た場合は curEntries の先頭側 (呼び出し側で近い順に並べる想定) を採る。
export function decideFlinch(prevTypeIds, curEntries, state) {
  const none = { flinch: false, sourceTypeId: null };
  try {
    if (!Array.isArray(curEntries)) return none;
    const prev = prevTypeIds instanceof Set ? prevTypeIds
      : Array.isArray(prevTypeIds) ? new Set(prevTypeIds) : new Set();
    const base = state && typeof state === "object" ? state : {};
    for (const e of curEntries) {
      if (!e || typeof e !== "object" || typeof e.id !== "string") continue;
      if (prev.has(e.id)) continue; // 居座っている実体は出現の辺ではない
      if (shouldFlinch({ ...base, typeId: e.typeId, horizDist: e.horizDist, distance: e.distance, ignited: e.ignited, appeared: true })) {
        return { flinch: true, sourceTypeId: e.typeId };
      }
    }
    return none;
  } catch { return none; }
}
