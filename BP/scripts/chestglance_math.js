// chestglance_math.js — POLISH-ANIM-CHESTGLANCE-01 純粋核先行 (cyc2363 A15)
// 近くで主人が収納を開けた閉→開の辺で一度だけ送る「出し入れを待つ目線」。
// 表示層のみ。供給源(容器open状態+原因者)の裏取りが済むまで feeder は接続せず、
// 本核は読み手ゼロの記録のみ統合が前提 (発火有効化はしない。実機確認待ち)。
// 純粋: @minecraft/server を import しない。時刻は引数。Date.now/乱数なし。例外を投げない。
// 契約の正: brain_parts/solutions/polish-cyc2355/ANIM_DRAFT.md §3 (cyc2355 A15)
// §4.1 #9 の固定 (cyc2363): false 確定 → undefined×N → true は「辺」として
//   true 確定時点で1回だけ評価する。undefined は lastOpen を進めない (UNKNOWN保持)。
export const CHESTGLANCE_DURATION_MS = 950;
export const CHESTGLANCE_RISE_MS = 180;
export const CHESTGLANCE_HOLD_MS = 450;
export const CHESTGLANCE_FALL_MS = 320;
export const CHESTGLANCE_HOLD_END_MS = CHESTGLANCE_RISE_MS + CHESTGLANCE_HOLD_MS; // 630
export const CHESTGLANCE_YAW_BLEND = 0.50;
export const CHESTGLANCE_YAW_MAX_DEG = 30;
export const CHESTGLANCE_PITCH_DEG = 6;
export const CHESTGLANCE_COOLDOWN_MS = 15000;
export const CHESTGLANCE_DEDUPE_MS = 2500;
export const CHESTGLANCE_MAX_DIST = 6;
export const CHESTGLANCE_CONFIRM = 1;
// gaze クランプは gaze_math/doorglance_math の正 [-60,+75] と同値 (doorglance の前例どおり核内定数)
const PITCH_MIN = -60, PITCH_MAX = 75;

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clampPitch(v) { return Math.max(PITCH_MIN, Math.min(PITCH_MAX, v)); }
function suppressed(s) {
  return s.suppressed === true || s.combat === true || s.falling === true
    || s.climbing === true || s.hurtRecent === true;
}

export function createChestGlanceState() {
  return {
    lastOpenByKey: {},      // key -> true|false (確定値のみ。undefined は記録しない)
    clusterUntil: 0,        // dedupe 窓の終端 (firedAt + DEDUPE_MS)
    lastClusterKey: null,   // 直近に発火した clusterKey
    cooldownUntil: 0,
    firedAt: null,
    episode: 0,
    lastKey: null,
  };
}

// noteChestGlance(state, sample, nowMs) -> { fired, reason }
// sample: { key, clusterKey?, open, actorIsOwner, selfCaused, dist, dimSame,
//           suppressed?, combat?, falling?, climbing?, hurtRecent? }
// 消費規則: open が確定値 (true/false) のサンプルは lastOpen をその値へ進める。
//   辺 (false→true) はゲート不成立でも消費し遅れ発火しない。
//   open===undefined は lastOpen を進めず fired:false/reason:"unknown"。
//   原因者不明の辺は発火せず冷却も消費しない。
export function noteChestGlance(state, sample, nowMs) {
  try {
    if (!state || typeof state !== "object" || !sample || typeof sample !== "object")
      return { fired: false, reason: "invalid" };
    if (typeof sample.key !== "string" || sample.key.length === 0)
      return { fired: false, reason: "invalid" };
    const now = fin(nowMs); if (now === null) return { fired: false, reason: "invalid" };
    if (!state.lastOpenByKey || typeof state.lastOpenByKey !== "object") state.lastOpenByKey = {};
    const key = sample.key;
    const clusterKey = (typeof sample.clusterKey === "string" && sample.clusterKey.length > 0)
      ? sample.clusterKey : key;
    if (sample.open === undefined) return { fired: false, reason: "unknown" };
    if (sample.open !== true && sample.open !== false) return { fired: false, reason: "invalid" };
    const prev = state.lastOpenByKey[key]; // undefined | false | true
    state.lastOpenByKey[key] = sample.open;
    state.lastKey = key;
    if (sample.open === false) return { fired: false, reason: "closed" };
    if (prev !== false) return { fired: false, reason: "no_edge" }; // 初回観測true/開継続は辺を作らない
    // ここから閉→開の辺。以下いずれで落ちても辺は消費済み (lastOpen=true)。
    if (sample.selfCaused === true) return { fired: false, reason: "self_caused" };
    if (sample.actorIsOwner === undefined) return { fired: false, reason: "actor_unknown" };
    if (sample.actorIsOwner !== true) return { fired: false, reason: "not_owner" };
    const dist = fin(sample.dist);
    if (dist === null || dist < 0 || dist > CHESTGLANCE_MAX_DIST) return { fired: false, reason: "dist" };
    if (sample.dimSame !== true) return { fired: false, reason: "dim" };
    if (suppressed(sample)) return { fired: false, reason: "suppressed" };
    if (state.lastClusterKey === clusterKey && now < (fin(state.clusterUntil) ?? 0))
      return { fired: false, reason: "dedupe" };
    if (now < (fin(state.cooldownUntil) ?? 0)) return { fired: false, reason: "cooldown" };
    state.firedAt = now;
    state.cooldownUntil = now + CHESTGLANCE_COOLDOWN_MS;
    state.clusterUntil = now + CHESTGLANCE_DEDUPE_MS;
    state.lastClusterKey = clusterKey;
    state.episode = (fin(state.episode) ?? 0) + 1;
    return { fired: true, reason: "fired" };
  } catch { return { fired: false, reason: "invalid" }; }
}

// chestGlanceOffset(state, nowMs) -> { yawBlend, yawMaxDeg, pitchDeg, active, phase }
// 台形 (線形): 0-180 上昇 / 180-630 保持 / 630-950 復帰。ヨーは寄せ率と上限を返すのみで
// 実際の角度合成は applyGaze 側の既存ヨー合成へ委ねる。
export function chestGlanceOffset(state, nowMs) {
  const idle = { yawBlend: 0, yawMaxDeg: 0, pitchDeg: 0, active: false, phase: "idle" };
  try {
    if (!state || typeof state !== "object") return idle;
    const start = fin(state.firedAt), now = fin(nowMs);
    if (start === null || now === null) return idle;
    const t = now - start;
    if (t < 0 || t >= CHESTGLANCE_DURATION_MS) return idle;
    let coeff, phase;
    if (t < CHESTGLANCE_RISE_MS) { coeff = t / CHESTGLANCE_RISE_MS; phase = "rise"; }
    else if (t < CHESTGLANCE_HOLD_END_MS) { coeff = 1; phase = "hold"; }
    else { coeff = 1 - (t - CHESTGLANCE_HOLD_END_MS) / CHESTGLANCE_FALL_MS; phase = "fall"; }
    return {
      yawBlend: CHESTGLANCE_YAW_BLEND * coeff,
      yawMaxDeg: CHESTGLANCE_YAW_MAX_DEG,
      pitchDeg: CHESTGLANCE_PITCH_DEG * coeff,
      active: true, phase,
    };
  } catch { return idle; }
}

// applyChestGlancePitch(basePitchDeg, offset) -> 度
// base が非有限なら base をそのまま返す。それ以外は base + offset.pitchDeg を [-60,+75] へ。
export function applyChestGlancePitch(basePitchDeg, offset) {
  try {
    if (!Number.isFinite(basePitchDeg)) return basePitchDeg;
    const p = offset && typeof offset === "object" ? fin(offset.pitchDeg) : null;
    return clampPitch(basePitchDeg + (p ?? 0));
  } catch { return basePitchDeg; }
}
