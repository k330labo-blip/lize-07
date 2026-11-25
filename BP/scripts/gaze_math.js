// gaze_math.js — 視線の回転計算 (POLISH-ANIM-LOOK-01 最小形, cycle0821)
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// ピッチ符号: Minecraft 慣行で下向きが正 (autonomy/body_language.md の sky=-35°=上向きが根拠)。
// 符号は GAZE_PITCH_SIGN の1定数に閉じ込める。実機確認待ち。
export const GAZE_EYE_HEIGHT = 1.4;
export const GAZE_PITCH_MIN = -60;
export const GAZE_PITCH_MAX = 75;
export const GAZE_DEADZONE = 0.3;
export const GAZE_PITCH_SIGN = -1;

// botLoc: {x,y,z} (足元), target: {x,y,z} (注視点)
// 戻り値: { x: pitchDeg, y: yawDeg } | null (水平距離が deadzone 以下 / 入力異常)
export function gazeRotation(botLoc, target, eyeHeight = GAZE_EYE_HEIGHT, pitchSign = GAZE_PITCH_SIGN) {
  if (!botLoc || !target) return null;
  const dx = target.x - botLoc.x;
  const dz = target.z - botLoc.z;
  const horiz = Math.hypot(dx, dz);
  if (!(horiz > GAZE_DEADZONE)) return null;
  const dy = target.y - (botLoc.y + eyeHeight);
  if (!Number.isFinite(dy)) return null;
  const yaw = Math.atan2(-dx, dz) * 180 / Math.PI;
  let pitch = pitchSign * Math.atan2(dy, horiz) * 180 / Math.PI;
  pitch = Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, pitch));
  if (!Number.isFinite(pitch) || !Number.isFinite(yaw)) return null;
  return { x: pitch, y: yaw };
}
