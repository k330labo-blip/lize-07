// darkentry_math.js — POLISH-ANIM-DARKENTRY-01 純粋核 (cycle0423, a11ドラフトが正)
// 暗所へ入った瞬間に一度だけ左右を小さく見回す警戒視線。表示層専用 (出力は pitch/yaw のみ)。
export const DARKENTRY = Object.freeze({ DURATION_MS: 750, COOLDOWN_MS: 20000, CONFIRM_TICKS: 2, DARK_BAND_MAX: 1, BRIGHT_BAND_MIN: 2, DROP_MIN: 2, YAW_DEG: 14, PITCH_DEG: 4 });
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
export const clampBand = (v) => (isNum(v) ? Math.min(3, Math.max(0, Math.trunc(v))) : null);
// 既存の合成 lightLevel (main: 地下5/夜7/昼13) を帯域へ写す。新規走査はしない。
export function lightBandOf(lightLevel) { if (!isNum(lightLevel)) return null; return lightLevel >= 12 ? 3 : lightLevel >= 9 ? 2 : lightLevel >= 6 ? 1 : 0; }
export function darkEntryInit() { return { armed: true, confirm: 0, prevBand: null, lastFiredMs: null, activeFromMs: null }; }
export function noteDarkEntry(state, obs) {
  const s = state && typeof state === "object" ? { ...darkEntryInit(), ...state } : darkEntryInit();
  if (!obs || typeof obs !== "object" || !isNum(obs.nowMs)) return { state: s, fired: false };
  const band = clampBand(obs.band);
  if (band === null) return { state: s, fired: false };
  const prev = s.prevBand; s.prevBand = band;
  if (band >= DARKENTRY.BRIGHT_BAND_MIN) { s.armed = true; s.confirm = 0; return { state: s, fired: false }; }
  if (band > DARKENTRY.DARK_BAND_MAX) { s.confirm = 0; return { state: s, fired: false }; }
  if (prev !== null && prev - band >= DARKENTRY.DROP_MIN) s.confirm = Math.max(s.confirm, 1);
  else if (s.confirm > 0) s.confirm += 1;
  if (!s.armed || s.confirm < DARKENTRY.CONFIRM_TICKS) return { state: s, fired: false };
  s.armed = false; s.confirm = 0; // 確定した辺は抑制・冷却でも消費する (遅れ発火禁止)
  const suppressed = !!(obs.inCombat || obs.falling || obs.inWater || obs.justTeleported || obs.higherGazeActive);
  const cooling = s.lastFiredMs !== null && obs.nowMs - s.lastFiredMs < DARKENTRY.COOLDOWN_MS;
  if (suppressed || cooling || (s.lastFiredMs !== null && obs.nowMs < s.lastFiredMs)) return { state: s, fired: false };
  s.lastFiredMs = obs.nowMs; s.activeFromMs = obs.nowMs;
  return { state: s, fired: true };
}
export function darkEntryOffset(elapsedMs) {
  if (!isNum(elapsedMs) || elapsedMs < 0 || elapsedMs >= DARKENTRY.DURATION_MS) return null;
  const t = elapsedMs / DARKENTRY.DURATION_MS;
  const yaw = t < 0.33 ? -DARKENTRY.YAW_DEG * (t / 0.33) : t < 0.72 ? -DARKENTRY.YAW_DEG + 2 * DARKENTRY.YAW_DEG * ((t - 0.33) / 0.39) : DARKENTRY.YAW_DEG * (1 - (t - 0.72) / 0.28);
  return { pitchDeg: DARKENTRY.PITCH_DEG * Math.sin(Math.PI * t), yawDeg: yaw };
}
export function darkEntryActive(state, nowMs) { if (!state || !isNum(state.activeFromMs) || !isNum(nowMs)) return false; const e = nowMs - state.activeFromMs; return e >= 0 && e < DARKENTRY.DURATION_MS; }
export function applyDarkEntry(basePitch, baseYaw, state, nowMs) {
  if (!darkEntryActive(state, nowMs)) return { pitch: basePitch, yaw: baseYaw };
  const off = darkEntryOffset(nowMs - state.activeFromMs); if (!off) return { pitch: basePitch, yaw: baseYaw };
  return { pitch: Math.min(75, Math.max(-60, basePitch + off.pitchDeg)), yaw: baseYaw + off.yawDeg };
}
