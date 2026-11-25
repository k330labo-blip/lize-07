// POLISH-ANIM-VILLAGERGREET-01 (cycle0855): 村人とすれ違うときの小さな会釈 (純粋核)
// 仕様の正: brain_parts/solutions/cycle0740-a11/PROPOSAL.md §5。配線確認: cycle0855-a10。
// 純粋モジュール: @minecraft/server を import しない、例外を投げない、乱数・Date.now を持たない。
// 表示層のみ: 移動・取引・護衛・発話・音には一切触らない。核はエンティティ種別を知らない
// (対象の同一性は feeder が渡す villagerId の文字列比較だけ)。

export const VILLAGERGREET_ENTER_DIST = 3.5;
export const VILLAGERGREET_EXIT_DIST = 5.0;
export const VILLAGERGREET_CONFIRM_OBS = 2;
export const VILLAGERGREET_ABSENT_REARM_OBS = 2;
export const VILLAGERGREET_DURATION_MS = 650;
export const VILLAGERGREET_RAMP_IN_MS = 180;
export const VILLAGERGREET_HOLD_END_MS = 420;
export const VILLAGERGREET_PITCH_DEG = 7;
export const VILLAGERGREET_YAW_MAX_DEG = 30;
export const VILLAGERGREET_COOLDOWN_MS = 20000;
export const VILLAGERGREET_REASONS = Object.freeze([
  "greet", "confirming", "cooldown", "rearmed", "out_of_range", "unknown_hold", "suppressed", "invalid",
]);

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function createVillagergreetState() {
  return { candidateId: null, confirmCount: 0, absentCount: 0, greetedId: null, startedAtMs: null, lockedYawDeg: 0, lastFiredAtMs: null, lastRecord: null };
}

export function villagergreetDue(lastFiredAtMs, nowMs) {
  try {
    const n = finiteOrNull(nowMs); if (n === null) return false;
    const last = finiteOrNull(lastFiredAtMs); if (last === null) return true;
    return n - last >= VILLAGERGREET_COOLDOWN_MS;
  } catch { return false; }
}

export function isVillagergreetActive(state, nowMs) {
  try {
    if (!state || typeof state !== "object") return false;
    const s = finiteOrNull(state.startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    const e = n - s; return e >= 0 && e < VILLAGERGREET_DURATION_MS;
  } catch { return false; }
}

// villagergreetOffset(elapsedMs, lockedYawDeg) -> { pitchDeg, yawDeg }。範囲外・無効は全て 0。
export function villagergreetOffset(elapsedMs, lockedYawDeg) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= VILLAGERGREET_DURATION_MS) return { pitchDeg: 0, yawDeg: 0 };
    let k;
    if (e < VILLAGERGREET_RAMP_IN_MS) k = Math.sin((e / VILLAGERGREET_RAMP_IN_MS) * Math.PI / 2);
    else if (e < VILLAGERGREET_HOLD_END_MS) k = 1;
    else k = Math.cos(((e - VILLAGERGREET_HOLD_END_MS) / (VILLAGERGREET_DURATION_MS - VILLAGERGREET_HOLD_END_MS)) * Math.PI / 2);
    const yaw = finiteOrNull(lockedYawDeg);
    return { pitchDeg: VILLAGERGREET_PITCH_DEG * k, yawDeg: (yaw === null ? 0 : clamp(yaw, -VILLAGERGREET_YAW_MAX_DEG, VILLAGERGREET_YAW_MAX_DEG)) * k };
  } catch { return { pitchDeg: 0, yawDeg: 0 }; }
}

const SUPPRESS_KEYS = Object.freeze([
  "suppressed", "danger", "inCombat", "raid", "working", "digging",
  "attacking", "placing", "falling", "inWater", "climbing", "justTeleported", "justRespawned", "overlayActive",
]);

// noteVillagergreet(state, sample, nowMs) -> { fired, reason }
// sample: { villagerId, villagerDist, villagerRelYawDeg, scanOk, ...SUPPRESS_KEYS }
export function noteVillagergreet(state, sample, nowMs) {
  try {
    if (!state || typeof state !== "object") return { fired: false, reason: "invalid" };
    const n = finiteOrNull(nowMs);
    if (n === null || !sample || typeof sample !== "object") { state.lastRecord = { fired: false, reason: "invalid", atMs: n }; return { fired: false, reason: "invalid" }; }
    if (sample.scanOk !== true) { state.lastRecord = { fired: false, reason: "unknown_hold", atMs: n }; return { fired: false, reason: "unknown_hold" }; }
    const id = typeof sample.villagerId === "string" && sample.villagerId ? sample.villagerId : null;
    const d = finiteOrNull(sample.villagerDist);
    // 再武装: 会釈済み対象が圏外へ出た/候補から外れた観測が連続したら greetedId を解除
    if (state.greetedId) {
      const gone = id !== state.greetedId || d === null || d > VILLAGERGREET_EXIT_DIST;
      if (gone) { state.absentCount = (state.absentCount | 0) + 1; if (state.absentCount >= VILLAGERGREET_ABSENT_REARM_OBS) { state.greetedId = null; state.absentCount = 0; state.lastRecord = { fired: false, reason: "rearmed", atMs: n }; return { fired: false, reason: "rearmed" }; } }
      else state.absentCount = 0;
    }
    if (!id || d === null || d < 0 || d > VILLAGERGREET_ENTER_DIST) {
      // 3.5〜5.0 帯は同一性だけ保持しカウントは戻す。それ以外は候補も戻す
      if (id && d !== null && d > VILLAGERGREET_ENTER_DIST && d <= VILLAGERGREET_EXIT_DIST && state.candidateId === id) { state.confirmCount = 0; }
      else { state.candidateId = null; state.confirmCount = 0; }
      state.lastRecord = { fired: false, reason: "out_of_range", atMs: n };
      return { fired: false, reason: "out_of_range" };
    }
    if (state.greetedId === id) { state.candidateId = null; state.confirmCount = 0; state.lastRecord = { fired: false, reason: "out_of_range", atMs: n }; return { fired: false, reason: "out_of_range" }; }
    if (state.candidateId !== id) { state.candidateId = id; state.confirmCount = 1; }
    else state.confirmCount = (state.confirmCount | 0) + 1;
    if (state.confirmCount < VILLAGERGREET_CONFIRM_OBS) { state.lastRecord = { fired: false, reason: "confirming", atMs: n }; return { fired: false, reason: "confirming" }; }
    // 確定の辺。抑制・冷却でも辺は消費する (遅れて発火しない)
    state.candidateId = null; state.confirmCount = 0;
    for (const k of SUPPRESS_KEYS) if (sample[k] === true) { state.lastRecord = { fired: false, reason: "suppressed", atMs: n }; return { fired: false, reason: "suppressed" }; }
    if (!villagergreetDue(state.lastFiredAtMs, n)) { state.lastRecord = { fired: false, reason: "cooldown", atMs: n }; return { fired: false, reason: "cooldown" }; }
    const yaw = finiteOrNull(sample.villagerRelYawDeg);
    state.startedAtMs = n; state.lastFiredAtMs = n; state.greetedId = id; state.absentCount = 0;
    state.lockedYawDeg = yaw === null ? 0 : yaw;
    state.lastRecord = { fired: true, reason: "greet", atMs: n };
    return { fired: true, reason: "greet" };
  } catch { return { fired: false, reason: "invalid" }; }
}

// sampleVillagergreet(state, nowMs) -> { active, pitchDeg, yawDeg, reason }
export function sampleVillagergreet(state, nowMs) {
  try {
    if (!isVillagergreetActive(state, nowMs)) return { active: false, pitchDeg: 0, yawDeg: 0, reason: "idle" };
    const off = villagergreetOffset(nowMs - state.startedAtMs, state.lockedYawDeg);
    return { active: true, pitchDeg: off.pitchDeg, yawDeg: off.yawDeg, reason: "greet" };
  } catch { return { active: false, pitchDeg: 0, yawDeg: 0, reason: "invalid" }; }
}
