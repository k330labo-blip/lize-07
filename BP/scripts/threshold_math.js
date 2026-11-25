// threshold_math.js — POLISH-ANIM-THRESHOLD-01 (cycle1503)
// 出入口をくぐる瞬間の小さな「くぐり視線」: 狭い開口部へ入った辺でのみ
// ピッチ +9度・0.55秒の単一山形を返す純粋核。表示層のみ・挙動不変・実機確認待ち。
// 仕様の正: brain_parts/solutions/cycle1443-a10/PROPOSAL.md
export const THRESHOLD_PITCH_DEG = 9;
export const THRESHOLD_DURATION_MS = 550;
export const THRESHOLD_COOLDOWN_MS = 6000;
export const THRESHOLD_RAMP_IN_MS = 200;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

export function thresholdEnvelope(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= THRESHOLD_DURATION_MS) return 0;
    if (e < THRESHOLD_RAMP_IN_MS) return Math.sin((e / THRESHOLD_RAMP_IN_MS) * Math.PI / 2);
    const t = (e - THRESHOLD_RAMP_IN_MS) / (THRESHOLD_DURATION_MS - THRESHOLD_RAMP_IN_MS);
    return Math.cos(t * Math.PI / 2);
  } catch { return 0; }
}

export function createThresholdState() {
  return { prevInOpening: undefined, startedAtMs: null, lastFiredMs: null, firedCount: 0 };
}

function isSuppressed(input) {
  if (!input) return false;
  if (input.suppressed === true) return true;
  if (input.inCombat === true || input.combat === true || input.danger === true) return true;
  if (input.working === true || input.digging === true || input.attacking === true || input.placing === true || input.hasWorkTarget === true) return true;
  if (input.falling === true || input.inWater === true || input.climbing === true || input.flying === true || input.hovering === true) return true;
  if (input.flinchActive === true) return true;
  return false;
}

// noteThreshold(state, {inOpening, nowMs, ...suppression}) -> boolean
// inOpening の false/undefined -> true の辺でのみ発火。辺は常に prevInOpening へ記録され、
// 抑制中・冷却中の辺も消費する (遅れ発火しない)。
export function noteThreshold(state, input) {
  try {
    if (!state || typeof state !== "object") return false;
    if (!input || typeof input !== "object") return false;
    const now = finiteOrNull(input.nowMs);
    const cur = input.inOpening === true;
    const prev = state.prevInOpening;
    state.prevInOpening = cur;
    if (now === null) return false;
    if (!(prev !== true && cur === true)) return false;
    if (isSuppressed(input)) return false;
    const last = finiteOrNull(state.lastFiredMs);
    if (last !== null && now - last < THRESHOLD_COOLDOWN_MS) return false;
    state.startedAtMs = now;
    state.lastFiredMs = now;
    state.firedCount = (Number.isFinite(state.firedCount) ? state.firedCount : 0) + 1;
    return true;
  } catch { return false; }
}

export function sampleThreshold(state, nowMs) {
  try {
    const zero = { active: false, gazePitchDeg: 0 };
    if (!state || typeof state !== "object") return { ...zero };
    const s = finiteOrNull(state.startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return { ...zero };
    const k = thresholdEnvelope(n - s);
    if (k === 0) return { ...zero };
    return { active: true, gazePitchDeg: THRESHOLD_PITCH_DEG * k };
  } catch { return { active: false, gazePitchDeg: 0 }; }
}

export function isThresholdActive(state, nowMs) {
  try { return sampleThreshold(state, nowMs).active; } catch { return false; }
}
