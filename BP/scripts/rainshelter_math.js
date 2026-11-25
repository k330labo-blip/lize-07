// rainshelter_math.js — 持続雨の待機中に屋根のある方向へ視線を寄せる
// POLISH-ANIM-RAINSHELTER-01 (純粋核ドラフト, cycle2231-a08・作り込みトラック)
// 仕様の正: brain_parts/solutions/cycle2231-a08-polish/DESIGN.md §3
//
// 純粋モジュール: @minecraft/server を import しない。相対 import も持たない
// (ドラフト置き場から単体で node 実行できること。統合時は BP/scripts/
//  rainshelter_math.js へ移す想定)。
// 決定的: 時刻は全て引数で受け取る。例外を投げない (不正入力は不発+有限0)。
// 表示層のみ: 出力は gaze オフセットのみ。移動・作業判定へは流さない。

export const RAINSHELTER_SUSTAIN_MS = 20000;   // 降り始めから発火可能になるまでの持続 (SKYGLANCE の領域を避ける)
export const RAINSHELTER_DURATION_MS = 1100;   // 再生時間 (入り300+保持500+戻り300)
export const RAINSHELTER_COOLDOWN_MS = 45000;  // 「稀に・小さく」の間引き
export const RAINSHELTER_YAW_LIMIT_DEG = 35;   // 屋根方向へ寄せるヨーの上限 (ちらりと見る大きさ)
export const RAINSHELTER_PITCH_DEG = 6;        // やや下向き (軒先の足元を見る)
export const RAINSHELTER_STABLE_TOL_DEG = 15;  // 屋根方向の安定判定の許容円周差
export const RAINSHELTER_STABLE_COUNT = 2;     // 発火に必要な連続安定観測回数

const IDLE_MODES = new Set(["idle", "wait_owner"]);

function finiteOr(v, fallback) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

// 円周差 (-180, 180] を返す。入力が有限でなければ null。
export function wrapYawDiffDeg(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export function clampRainShelterYawDeg(deg) {
  const v = finiteOr(deg, 0);
  if (v > RAINSHELTER_YAW_LIMIT_DEG) return RAINSHELTER_YAW_LIMIT_DEG;
  if (v < -RAINSHELTER_YAW_LIMIT_DEG) return -RAINSHELTER_YAW_LIMIT_DEG;
  return v;
}

// 再生開始からの経過 ms -> 包絡 0..1 (入り300 / 保持500 / 戻り300、範囲外は0)
export function rainShelterEnvelope(elapsedMs) {
  const t = finiteOr(elapsedMs, -1);
  if (t < 0 || t >= RAINSHELTER_DURATION_MS) return 0;
  if (t < 300) return t / 300;
  if (t < 800) return 1;
  return 1 - (t - 800) / 300;
}

export function createRainShelterState() {
  return {
    lastCoverRelYawDeg: null, // 直近の屋根方向観測 (null=未観測/不明)
    stableCount: 0,           // 連続安定観測回数
    startedAtMs: null,        // 再生開始時刻 (null=未再生)
    lockedYawDeg: 0,          // 再生中に固定するヨー目標 (発火時点の値)
    lastFiredAtMs: null,      // 最終発火時刻 (クールダウン用)
  };
}

export function resetRainShelterState(state) {
  if (!state || typeof state !== "object") return createRainShelterState();
  state.lastCoverRelYawDeg = null;
  state.stableCount = 0;
  state.startedAtMs = null;
  state.lockedYawDeg = 0;
  state.lastFiredAtMs = null;
  return state;
}

// 発火条件のうち「その tick で崩れたら即終了」に使う素の適格判定。
// input: { isRaining, rainSinceMs, nowMs, mode, exposed,
//          inCombat, dangerNear, falling, inWater, underground,
//          workTargetActive, higherGazeActive }
export function isRainShelterEligible(input) {
  if (!input || typeof input !== "object") return false;
  if (input.isRaining !== true) return false;
  const now = finiteOr(input.nowMs, NaN);
  const since = finiteOr(input.rainSinceMs, NaN);
  if (!Number.isFinite(now) || !Number.isFinite(since)) return false;
  if (now - since < RAINSHELTER_SUSTAIN_MS) return false;
  if (!IDLE_MODES.has(input.mode)) return false;
  if (input.exposed !== true) return false; // 屋根下(false)/UNKNOWN(null) は不発 (安全側)
  if (input.inCombat || input.dangerNear || input.falling || input.inWater ||
      input.underground || input.workTargetActive || input.higherGazeActive) return false;
  return true;
}

// 1 tick 分の観測を state へ取り込み、必要なら発火させる。
// input は isRainShelterEligible の形 + coverRelYawDeg (数値 or null)。
// 戻り値: { fired:boolean } (表示値は sampleRainShelter で取る)
export function noteRainShelter(state, input) {
  const s = state && typeof state === "object" ? state : createRainShelterState();
  const now = input && Number.isFinite(input.nowMs) ? input.nowMs : NaN;

  // 屋根方向の安定カウント更新 (観測が無い/不適格なら 0 へ戻す)
  const yaw = input && Number.isFinite(input.coverRelYawDeg) ? input.coverRelYawDeg : null;
  if (yaw === null || !isRainShelterEligible(input)) {
    s.stableCount = 0;
    s.lastCoverRelYawDeg = yaw;
  } else {
    const diff = s.lastCoverRelYawDeg === null ? null : wrapYawDiffDeg(yaw, s.lastCoverRelYawDeg);
    s.stableCount = diff !== null && Math.abs(diff) <= RAINSHELTER_STABLE_TOL_DEG
      ? s.stableCount + 1
      : 1;
    s.lastCoverRelYawDeg = yaw;
  }

  // 再生中に適格が崩れたら即終了 (クールダウンは保持)
  if (s.startedAtMs !== null) {
    const elapsed = Number.isFinite(now) ? now - s.startedAtMs : RAINSHELTER_DURATION_MS;
    if (!isRainShelterEligible(input) || elapsed >= RAINSHELTER_DURATION_MS) {
      s.startedAtMs = null;
      s.lockedYawDeg = 0;
    }
  }

  // 発火判定
  let fired = false;
  if (s.startedAtMs === null && Number.isFinite(now) &&
      isRainShelterEligible(input) &&
      s.stableCount >= RAINSHELTER_STABLE_COUNT &&
      (s.lastFiredAtMs === null || now - s.lastFiredAtMs >= RAINSHELTER_COOLDOWN_MS)) {
    s.startedAtMs = now;
    s.lockedYawDeg = clampRainShelterYawDeg(yaw);
    s.lastFiredAtMs = now;
    fired = true;
  }
  return { state: s, fired };
}

// 現在時刻の表示オフセットを返す。再生中でなければ有限0。
export function sampleRainShelter(state, nowMs) {
  const inactive = { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 };
  if (!state || typeof state !== "object" || state.startedAtMs === null) return inactive;
  const now = finiteOr(nowMs, NaN);
  if (!Number.isFinite(now)) return inactive;
  const env = rainShelterEnvelope(now - state.startedAtMs);
  if (env <= 0) return inactive;
  return {
    active: true,
    gazeYawOffsetDeg: clampRainShelterYawDeg(state.lockedYawDeg) * env,
    gazePitchDeg: RAINSHELTER_PITCH_DEG * env,
  };
}

export const RAINSHELTER_CONSTANTS = Object.freeze({
  RAINSHELTER_SUSTAIN_MS, RAINSHELTER_DURATION_MS, RAINSHELTER_COOLDOWN_MS,
  RAINSHELTER_YAW_LIMIT_DEG, RAINSHELTER_PITCH_DEG,
  RAINSHELTER_STABLE_TOL_DEG, RAINSHELTER_STABLE_COUNT,
});
