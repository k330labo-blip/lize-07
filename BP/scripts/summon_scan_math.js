// summon_scan_math.js — 召喚・復元直後の「周囲を見回す」 POLISH-ANIM-SUMMONSCAN-01 (純粋核)
// 出典: brain_parts/solutions/cycle1051-a21/REPORT.md (仕様の正)、ドラフト cycle1110-a13 (59/59)
// 統合: cycle1110 v0.5.1。発火点は main.js の明示召喚・復元の成功分岐のみ。実機確認待ち。
// 純粋モジュール: サーバーAPIを import しない。現在時刻やエンティティ参照を持たない (時刻は引数で受ける)。
// 例外を投げない。表示層のみ: 移動・追随・テレポート条件・作業・発話には一切触らない。
// 消費点は統合時に applyGaze のヨー加算のみを想定 (ピッチには触れない。LOOK-01 と干渉しない)。
// 流儀は flinch_math.js / nod_math.js に倣う: 波形 (Offset) / At / apply* /
// is*Active / *Due / should* のセット。ただし本件は仕様 §2.2 が「範囲外は 0」を
// 明示するため、Offset は null を返さず 0 を返す (nod/flinch の null 方式との差異は意図的)。

export const SUMMON_SCAN_DURATION_MS = 900;    // 見回しの全体 (仕様 §2.2: 900ms)
export const SUMMON_SCAN_AMPLITUDE_DEG = 28;   // 左右の振幅 (仕様 §2.2: ±28度)
export const SUMMON_SCAN_COOLDOWN_MS = 5000;  // 連打・連続復元で重ねない (仕様 §2.2: 5秒)
export const SUMMON_SCAN_PHASE_MS = 300;       // 1区間 (左行程/右行程/復帰行程は等分 300ms)

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// ヨーを (-180, 180] へ正規化する。ピッチのクランプ (nod/flinch) と違い、
// ヨーは回転角なので端で止めずに巻き戻すのが正しい。
function wrapYawDeg(deg) {
  let d = ((deg + 180) % 360 + 360) % 360 - 180;
  if (d === -180) d = 180;
  return d;
}

// summonScanYawOffset(elapsedMs) -> 頭ヨーのオフセット (度, 左が負)
// 波形 (仕様 §2.2, 全区間線形補間):
//   0–300ms:    0 -> -28 (左)
//   300–600ms: -28 -> +28 (右, 450ms で正面 0 を通過)
//   600–900ms: +28 -> 0   (正面へ戻る)
// 経過 <0 / >=900 / 非数 / NaN は 0 (無動作)。例外を投げない。
export function summonScanYawOffset(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= SUMMON_SCAN_DURATION_MS) return 0;
    const A = SUMMON_SCAN_AMPLITUDE_DEG, P = SUMMON_SCAN_PHASE_MS;
    const v = e < P ? -A * (e / P)
            : e < 2 * P ? -A + 2 * A * ((e - P) / P)
            : A * (1 - (e - 2 * P) / P);
    return v === 0 ? 0 : v; // -0 を 0 に正規化 (e=0 で -A*0 が -0 になるため)
  } catch { return 0; }
}

// summonScanYawAt(startMs, nowMs) -> 現在のヨーオフセット (度)。範囲外・無効入力は 0
// (flinchPitchAt と同じ「呼び出し側を分岐させない」版)
export function summonScanYawAt(startMs, nowMs) {
  try {
    const s = finiteOrNull(startMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return 0;
    return summonScanYawOffset(n - s);
  } catch { return 0; }
}

// applySummonScanYaw(baseYawDeg, elapsedMs) -> オフセット加算済みヨー ((-180,180] 正規化)
// base 非有限時は base をそのまま返す (nod/flinch の apply* と同規則)。
export function applySummonScanYaw(baseYawDeg, elapsedMs) {
  try {
    if (!Number.isFinite(baseYawDeg)) return baseYawDeg;
    return wrapYawDeg(baseYawDeg + summonScanYawOffset(elapsedMs));
  } catch { return baseYawDeg; }
}

// isSummonScanActive(startMs, nowMs) -> boolean (仕様 §2.2)
// startMs が有限数でない -> false。0 <= nowMs - startMs < 900 のときだけ true。
// 時計巻き戻し (now < start) は false に倒す (nod/flinch と同規則)。
export function isSummonScanActive(startMs, nowMs) {
  try {
    const s = finiteOrNull(startMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    const e = n - s;
    return e >= 0 && e < SUMMON_SCAN_DURATION_MS;
  } catch { return false; }
}

// summonScanDue(lastFiredMs, nowMs) -> boolean: クールダウン判定 (仕様 §2.2: 5秒)
// 初回 (lastFiredMs が非有限) は true。nowMs 非有限は false (発火させない側)。
// 境界: 前回 +4999ms は false、+5000ms は true。
export function summonScanDue(lastFiredMs, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    const last = finiteOrNull(lastFiredMs);
    if (last === null) return true;
    return n - last >= SUMMON_SCAN_COOLDOWN_MS;
  } catch { return false; }
}

// shouldSummonScan(input) -> boolean: 発火可否の純粋判定 (抑制条件は仕様 §2.3)
// input: {
//   hasGazeTarget,   // 作業対象への視線 (dig/attack/place の対象セル) がある -> 抑制 (§2.3-1)
//   hurtActive,      // 被弾系の頭部表現が有効 -> 抑制 (§2.3-2)
//   falling,         // 落下系の頭部表現が有効 -> 抑制 (§2.3-2)
//   inWater,         // 頭部ヨーを既存アニメが専有する状態 -> 抑制 (§2.3-4)
//   headBusyUntilMs, // 頭部を使う他の作り込みの再生終了時刻 (先行側が勝つ, §2.3-4)
//   lastFiredMs, nowMs, // クールダウン判定用 (§2.3-3)
// }
// 本件は常に最下位の優先度: いずれかの抑制に触れれば false。例外を投げない。
// 実際の発火点 (召喚/復元の成功辺) の判定は配線側の責務で、本関数は扱わない。
export function shouldSummonScan(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.hasGazeTarget === true) return false;
    if (input.hurtActive === true) return false;
    if (input.falling === true) return false;
    if (input.inWater === true) return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;
    const busy = finiteOrNull(input.headBusyUntilMs);
    if (busy !== null && now < busy) return false;
    return summonScanDue(input.lastFiredMs, input.nowMs);
  } catch { return false; }
}
