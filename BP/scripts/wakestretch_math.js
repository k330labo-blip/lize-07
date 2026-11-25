// wakestretch_math.js — POLISH-ANIM-WAKESTRETCH-01 純粋核ドラフト (cycle2350-a12)
// 長い待機が明けて活動を再開する最初の瞬間に、一度だけ小さく伸びをする
// (顔を少し上げ、左右へ小さく揺れる) 表示を出すための純粋核。
// 仕様の正: brain_parts/solutions/cycle2350-a12/DESIGN.md §3
//
// 純粋モジュール (ドラフト): @minecraft/server を import しない。相対 import も持たない
//   (ドラフト置き場から単体で node 実行できること。統合時は gaze_math.js の
//    GAZE_PITCH_MIN/MAX を import へ置換し、同値のローカル写しを消すこと)。
// 決定的: 時刻は全て引数。Date.now/乱数を持たない。
// 例外を投げない: 不正入力は 不発(false) / null オフセット / baseそのまま に倒す。
// 表示層のみ: 移動・作業・再開そのものの可否には一切触らない。出力は表示オフセットと
//   記録用フィールドのみ。armPitchDeg は RP 受け口が無い間は記録専用 (統合側で実配線禁止)。

export const WAKESTRETCH_GAZE_MIN_DEG = -60; // gaze_math GAZE_PITCH_MIN のローカル写し
export const WAKESTRETCH_GAZE_MAX_DEG = 75;  // gaze_math GAZE_PITCH_MAX のローカル写し

export const WAKESTRETCH_MIN_IDLE_MS = 60000;  // 発火に必要な連続待機の最小時間 (TOOLCHECK の45秒より長く置き、待機中の点検と競合させない)
export const WAKESTRETCH_DURATION_MS = 1100;   // 伸び全体の長さ
export const WAKESTRETCH_COOLDOWN_MS = 600000; // 冷却 10分 (待機→再開のたびに出さない)
export const WAKESTRETCH_PITCH_DEG = -11;      // ピーク時のピッチ (上向き=負。下向き正の既存規約に従う)
export const WAKESTRETCH_YAW_DEG = 4;          // ヨーの小さな揺れの振幅 (符号は波形側で決定的に作る)
export const WAKESTRETCH_ARM_PITCH_DEG = -40;  // 腕上げ相当 (記録専用。RP 受け口整備までは表示しない)

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// wakestretchPitchOffset(elapsedMs) -> 追加ピッチ (度, 上向き負) | null
//   波形: 0-300ms で 0→ピークへ滑らかに上がり、300-600ms 保持、600-1100ms で 0 へ戻る。
//   範囲外・非数は null (=重畳なし)。開始・終了で必ず 0 相当になり残留しない。
export function wakestretchPitchOffset(elapsedMs) {
  try {
    const e = fin(elapsedMs);
    if (e === null || e < 0 || e >= WAKESTRETCH_DURATION_MS) return null;
    const k = e < 300 ? Math.sin((e / 300) * Math.PI / 2)
            : e < 600 ? 1
            : Math.cos(((e - 600) / 500) * Math.PI / 2);
    return WAKESTRETCH_PITCH_DEG * k;
  } catch { return null; }
}

// wakestretchYawOffset(elapsedMs) -> 追加ヨー (度) | null
//   全体で1往復だけの小さな揺れ: sin(2π * e/DURATION) * 4度。開始・終了で 0。
export function wakestretchYawOffset(elapsedMs) {
  try {
    const e = fin(elapsedMs);
    if (e === null || e < 0 || e >= WAKESTRETCH_DURATION_MS) return null;
    return WAKESTRETCH_YAW_DEG * Math.sin((2 * Math.PI * e) / WAKESTRETCH_DURATION_MS);
  } catch { return null; }
}

// applyWakestretchPitch(basePitchDeg, elapsedMs) -> 度
//   オフセットが無い/ base が非有限なら base をそのまま。それ以外は gaze クランプ内へ。
export function applyWakestretchPitch(basePitchDeg, elapsedMs) {
  try {
    const off = wakestretchPitchOffset(elapsedMs);
    if (off === null || !Number.isFinite(basePitchDeg)) return basePitchDeg;
    return clamp(basePitchDeg + off, WAKESTRETCH_GAZE_MIN_DEG, WAKESTRETCH_GAZE_MAX_DEG);
  } catch { return basePitchDeg; }
}

export function isWakestretchActive(startedAtMs, nowMs) {
  try {
    const s = fin(startedAtMs), n = fin(nowMs);
    if (s === null || n === null) return false;
    return wakestretchPitchOffset(n - s) !== null;
  } catch { return false; }
}

export function createWakestretchState() {
  return {
    idleSinceMs: null,  // 現在の連続待機の開始時刻 (待機中でない間は null)
    startedAtMs: null,  // 直近の伸びの開始時刻
    lastFiredMs: null,  // 直近の発火時刻 (冷却判定用。startedAtMs と同値だが意味を分けて保持)
    episode: 0,         // 発火エピソード数 (記録のみ)
  };
}

// 抑制の内訳: 再開の瞬間にいずれかが ===true なら、その再開では出さない。
// 抑制でも「待機明けの辺」は消費する (遅れて作業中に突然伸びをしない。SKYGLANCE/DRYOFF と同じ作法)。
function isSuppressed(s) {
  return s.suppressed === true || s.combat === true || s.hurt === true
    || s.falling === true || s.flying === true || s.inWater === true
    || s.climbing === true;
}

// noteWakestretch(state, sample, nowMs) -> { fired, reason }
//   sample: { idle, suppressed?, combat?, hurt?, falling?, flying?, inWater?, climbing? }
//     idle === true  : 待機中 (作業・移動・受動行動のいずれでもない静止が続いている)
//     idle === false : 活動中/再開した
//     idle が undefined/null: UNKNOWN として待機の計測も辺も一切進めない (三状態保持)。
//   規則:
//     - idle=true が続く間 idleSinceMs を保持するだけ (待機中は絶対に発火しない)。
//     - idle=true -> false の辺でのみ判定する: 連続待機 >= MIN_IDLE_MS かつ抑制なし
//       かつ冷却経過で fired (startedAtMs=now, episode+1)。
//     - 待機不足・抑制・冷却中の辺は消費して終わる (再開後に遅れ発火しない)。
//     - 時刻の巻き戻し (now < idleSinceMs) は待機時間を 0 とみなし発火しない。
export function noteWakestretch(state, sample, nowMs) {
  const out = { fired: false, reason: "invalid" };
  try {
    if (!state || typeof state !== "object" || !sample || typeof sample !== "object") return out;
    const now = fin(nowMs);
    if (now === null) return out;
    if (sample.idle === undefined || sample.idle === null) { out.reason = "unknown_hold"; return out; }

    if (sample.idle === true) {
      if (fin(state.idleSinceMs) === null) state.idleSinceMs = now;
      out.reason = "idle_hold";
      return out;
    }

    // idle === false: 待機明けの辺 (または最初から活動中)
    const since = fin(state.idleSinceMs);
    state.idleSinceMs = null;
    if (since === null) { out.reason = "not_idle_before"; return out; }
    const idleMs = now - since;
    if (idleMs < WAKESTRETCH_MIN_IDLE_MS) { out.reason = "idle_too_short"; return out; }
    if (isSuppressed(sample)) { out.reason = "suppressed_consumed"; return out; }
    const last = fin(state.lastFiredMs);
    if (last !== null && now - last < WAKESTRETCH_COOLDOWN_MS) { out.reason = "cooldown_consumed"; return out; }

    state.startedAtMs = now;
    state.lastFiredMs = now;
    state.episode = (fin(state.episode) || 0) + 1;
    out.fired = true; out.reason = "fired";
    return out;
  } catch { return out; }
}

// wakestretchCurrent(state, nowMs) -> { pitchDeg, yawDeg, armPitchDeg, active, episode }
//   非アクティブ/不正では pitch/yaw/arm は全て 0 で active:false (表示の残留を構造的に防ぐ)。
//   armPitchDeg はピッチ波形と同位相の記録専用値 (ピークで WAKESTRETCH_ARM_PITCH_DEG)。
export function wakestretchCurrent(state, nowMs) {
  const zero = { pitchDeg: 0, yawDeg: 0, armPitchDeg: 0, active: false, episode: 0 };
  try {
    if (!state || typeof state !== "object") return { ...zero };
    const ep = fin(state.episode) || 0;
    const s = fin(state.startedAtMs), n = fin(nowMs);
    if (s === null || n === null) return { ...zero, episode: ep };
    const pitch = wakestretchPitchOffset(n - s);
    if (pitch === null) return { ...zero, episode: ep };
    const k = WAKESTRETCH_PITCH_DEG !== 0 ? pitch / WAKESTRETCH_PITCH_DEG : 0;
    return {
      pitchDeg: pitch,
      yawDeg: wakestretchYawOffset(n - s) || 0,
      armPitchDeg: WAKESTRETCH_ARM_PITCH_DEG * k,
      active: true,
      episode: ep,
    };
  } catch { return { ...zero }; }
}
