// homesight_math.js — POLISH-ANIM-HOMESIGHT-01 (cycle0900): 帰還中に拠点が見える距離まで来たとき一度だけ小さく頷く (表示層のみ)
// 純粋モジュール: import なし・例外なし。発火源は ctx.home.dist の帯域遷移 (遠い→近い) のみで新規走査なし。
// 既存要素との差別: DELIVERBOW (手渡し成功の辺)・OWNERRETURN (主人の再接近)・PLACESETTLE (設置完了) とは発火源が別。
export const HOMESIGHT_ENTER_DIST = 8;
export const HOMESIGHT_EXIT_DIST = 16;
export const HOMESIGHT_DURATION_MS = 650;
export const HOMESIGHT_COOLDOWN_MS = 600000;
export const HOMESIGHT_PITCH_DEG = 7;
export function createHomesightState() { return { zone: "far", firedAt: null, lastFiredAt: null }; }
function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
// noteHomesight(state, sample, nowMs) -> { fired }
// sample: { distHome, homeRegistered, dimensionSame, suppressed }
export function noteHomesight(state, sample, nowMs) {
  try {
    if (!state || typeof state !== "object" || !sample || typeof sample !== "object") return { fired: false };
    const now = fin(nowMs); if (now === null) return { fired: false };
    const d = fin(sample.distHome);
    if (sample.homeRegistered !== true || sample.dimensionSame !== true || d === null) { state.zone = "far"; return { fired: false }; }
    if (d > HOMESIGHT_EXIT_DIST) { state.zone = "far"; return { fired: false }; }
    if (state.zone === "near") return { fired: false };
    if (d > HOMESIGHT_ENTER_DIST) return { fired: false };
    state.zone = "near";
    if (sample.suppressed === true) return { fired: false };
    if (state.lastFiredAt !== null && now - state.lastFiredAt < HOMESIGHT_COOLDOWN_MS) return { fired: false };
    state.firedAt = now; state.lastFiredAt = now;
    return { fired: true };
  } catch { return { fired: false }; }
}
export function sampleHomesight(state, nowMs) {
  try {
    if (!state || typeof state !== "object") return { active: false, pitchDeg: 0 };
    const now = fin(nowMs), at = fin(state.firedAt);
    if (now === null || at === null) return { active: false, pitchDeg: 0 };
    const el = now - at;
    if (el < 0 || el >= HOMESIGHT_DURATION_MS) return { active: false, pitchDeg: 0 };
    const ph = el / HOMESIGHT_DURATION_MS;
    return { active: true, pitchDeg: HOMESIGHT_PITCH_DEG * Math.sin(Math.PI * ph) };
  } catch { return { active: false, pitchDeg: 0 }; }
}
