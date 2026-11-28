// survey_look_math.js — survey（区画調査）の観測被覆の純粋核 (0-O1 SURVEY-LOOK-SYNC-01, cyc2510)。
// 問題: survey はユニット走査が終われば、そのとき向いていた方向を問わず done ビットを立てていた。
// 0-P 統合後は生ヒットが FOV ゲートで破棄されるため、「向いていない方向のユニットは
// ヒットを破棄したまま done になる」状態が起こり、一度 done になった区画は再調査されなかった。
// 本モジュールは「その区画をどの水平方向から実際に観測したか」を yaw 8セクターの
// 被覆ビットマスクとして保持し、調査完了の定義を「全方向を実際に観測した」ことへ寄せる。
//
// 規約は observability.js の outOfView と同一に揃える:
// - bearing は gaze 規約 atan2(-dx, +dz)（度）。yawDeg は getRotation().y と同じ空間。
// - FOV 既定は 120 度（observability / look_sweep_math の SWEEP_DEFAULT_FOV_DEG と一致）。
// - 向き1回で被覆できるのは、セクター中心が視野（±FOV/2）内に入るセクターとする。
// pitch の扱い: FOV は水平（yaw）のみを仕様とする確定（cyc2492）に揃え、本被覆も水平のみ。
// 見回しの pitch 段（上下3段）は顔を上下へ向ける見た目と将来の pitch 拡張のためであり、
// 上下方向の観測可否は距離・LOS・露出が決める（observability.js の確定文と同一）。
// 例外を投げない。
export const LOOK_SECTORS = 8; // 水平8方向（45度刻み。look_sweep_math の SWEEP_YAW_STEPS と一致）
export const FULL_LOOK_MASK = 0xff;
export const LOOK_DEFAULT_FOV_DEG = 120;

function normDeg(d) {
  return ((d + 540) % 360) - 180;
}

// bearing（度）→ セクター番号 0..7。セクター s の中心は s*45 度（正規化空間）。
export function lookSectorOf(bearingDeg) {
  if (!Number.isFinite(bearingDeg)) return -1;
  const b = normDeg(bearingDeg);
  const s = Math.round(b / 45);
  return ((s % LOOK_SECTORS) + LOOK_SECTORS) % LOOK_SECTORS;
}

// 向き yawDeg を向いたときに被覆できるセクターのビットマスク。
// セクター中心と yaw の角差が FOV/2 以下なら被覆したとみなす（outOfView の境界と同値: 中心方向のセルは視野内）。
// yawDeg が有限でない場合は 0 を返す（向き不明を「全方向見た」へ倒さない。呼び出し側が互換扱いを決める）。
export function lookMaskForYaw(yawDeg, fovDeg = LOOK_DEFAULT_FOV_DEG) {
  if (!Number.isFinite(yawDeg)) return 0;
  const fov = Number.isFinite(fovDeg) && fovDeg > 0 ? fovDeg : LOOK_DEFAULT_FOV_DEG;
  let mask = 0;
  for (let s = 0; s < LOOK_SECTORS; s++) {
    const center = normDeg(s * 45);
    const diff = Math.abs(normDeg(center - yawDeg));
    if (diff <= fov / 2) mask |= (1 << s);
  }
  return mask;
}

// 観測した向きを被覆マスクへ足す。マスクは単調増加のみ（観測した事実は消えない）。
export function noteSurveyLook(mask, yawDeg, fovDeg = LOOK_DEFAULT_FOV_DEG) {
  const m = Number.isFinite(mask) ? (mask & FULL_LOOK_MASK) : 0;
  return m | lookMaskForYaw(yawDeg, fovDeg);
}

// 全方向を実際に観測したか。調査完了（done）の前提条件。
export function lookCoverageComplete(mask) {
  return Number.isFinite(mask) && (mask & FULL_LOOK_MASK) === FULL_LOOK_MASK;
}

// まだ観測していないセクター番号の一覧（報告・見回しの誘導用）。
export function lookCoverageMissing(mask) {
  const m = Number.isFinite(mask) ? (mask & FULL_LOOK_MASK) : 0;
  const out = [];
  for (let s = 0; s < LOOK_SECTORS; s++) if (!(m & (1 << s))) out.push(s);
  return out;
}
