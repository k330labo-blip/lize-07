// dustoff_math.js — POLISH-ANIM-DUSTOFF-01 (cyc1924、新規発案): 採掘・伐採の仕事を
// 一区切り終えた直後、服についた粉塵を払うように小さく見下ろして頭を振る所作の純粋核。
// プレイヤーは「仕事が終わった」ことを所作でも読み取れる。表示層のみ、移動・作業判定には
// 関与しない。feeder 未接続 (読み手ゼロ) で先行統合する。実機確認待ち。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
export const DUSTOFF_COOLDOWN_MS = 300000;
export const DUSTOFF_DURATION_MS = 1100;
export const DUSTOFF_PITCH_DEG = 14;
export const DUSTOFF_YAW_DEG = 6;
export const DUSTOFF_MIN_BLOCKS = 10;
function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
export function createDustoffState() { return { lastFiredMs: null }; }
function normalizeState(state) { const s = state && typeof state === "object" ? state : {}; return { lastFiredMs: fin(s.lastFiredMs) }; }
export function noteWorkFinished(state, input) {
  try {
    const prev = normalizeState(state);
    const inp = input && typeof input === "object" ? input : {};
    const now = fin(inp.nowMs);
    if (now === null) return { state: prev, fired: false };
    const blocks = fin(inp.blocksBroken);
    if (blocks === null || blocks < DUSTOFF_MIN_BLOCKS) return { state: prev, fired: false };
    if (inp.suppressed === true || inp.danger === true || inp.inWater === true || inp.falling === true) return { state: prev, fired: false };
    if (inp.workKind !== "mine" && inp.workKind !== "chop") return { state: prev, fired: false };
    if (prev.lastFiredMs !== null && now - prev.lastFiredMs < DUSTOFF_COOLDOWN_MS) return { state: prev, fired: false };
    return { state: { lastFiredMs: now }, fired: true };
  } catch { return { state: normalizeState(state), fired: false }; }
}
export function sampleDustoff(state, nowMs) {
  try {
    const s = normalizeState(state);
    const now = fin(nowMs);
    if (s.lastFiredMs === null || now === null) return { active: false, pitchDeg: 0, yawDeg: 0 };
    const t = now - s.lastFiredMs;
    if (t < 0 || t >= DUSTOFF_DURATION_MS) return { active: false, pitchDeg: 0, yawDeg: 0 };
    const phase = t / DUSTOFF_DURATION_MS;
    const pitchDeg = DUSTOFF_PITCH_DEG * Math.sin(Math.PI * Math.min(1, phase * 1.15));
    const yawDeg = DUSTOFF_YAW_DEG * Math.sin(phase * Math.PI * 4) * (1 - phase);
    return { active: true, pitchDeg, yawDeg };
  } catch { return { active: false, pitchDeg: 0, yawDeg: 0 }; }
}
