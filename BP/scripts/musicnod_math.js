// musicnod_math.js — POLISH-ANIM-MUSICNOD-01 純粋核 (cycle2006)
// 仕様の正: brain_parts/solutions/cycle1940-a08-polish-idea/REPORT.md
// 半径10以内の jukebox/note_block 近傍滞在を「音楽が鳴っている」代理条件とし、
// 2回連続確定で最大12秒・ピッチ最大+5度・周期2400ms の持続型頷きを出す。
// 正式版APIでは再生事実は取れないため近傍滞在が代理であることを明記する。
// 純粋モジュール: importなし・例外なし・決定的 (乱数/Date.nowなし)。
export const MUSICNOD_PITCH_DEG = 5;
export const MUSICNOD_PERIOD_MS = 2400;
export const MUSICNOD_MAX_MS = 12000;
export const MUSICNOD_REST_MS = 20000;
export const MUSICNOD_CONFIRM = 2;
export const MUSICNOD_RISE_MS = 400;
export const MUSICNOD_FALL_MS = 600;

export function createMusicnodState() {
  return { phase: "idle", confirm: 0, startedAtMs: null, restUntilMs: 0, lastRecord: null, firedCount: 0 };
}
export function resetMusicnodState(s) { try { const f = createMusicnodState(); for (const k of Object.keys(f)) s[k] = f[k]; } catch {} return s; }
function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function suppressed(sm) {
  if (!sm || typeof sm !== "object") return false;
  return sm.suppressed === true || sm.inCombat === true || sm.falling === true || sm.inWater === true || sm.climbing === true || sm.working === true || sm.otherOverlayActive === true || sm.ownerFar === true;
}
// noteMusicnod(state, sample, nowMs) sample:{nearMusic: true|false|undefined, source?, ...suppressFlags}
export function noteMusicnod(state, sample, nowMs) {
  const inv = { active: false, entered: false, exited: false, reason: "invalid" };
  try {
    if (!state || typeof state !== "object" || !sample || typeof sample !== "object") return { ...inv };
    const now = fin(nowMs) ?? fin(sample.nowMs); if (now === null) return { ...inv };
    let entered = false, exited = false, reason = "hold";
    if (state.phase === "resting" && now >= (state.restUntilMs || 0)) state.phase = "idle";
    if (sample.nearMusic === undefined || sample.nearMusic === null) {
      reason = "unknown_hold"; // 状態もオフセットも変えない
    } else if (suppressed(sample)) {
      if (state.phase === "nodding") { state.phase = "idle"; exited = true; }
      state.confirm = 0; reason = "suppressed";
    } else if (sample.nearMusic !== true) {
      if (state.phase === "nodding") exited = true;
      state.phase = state.phase === "resting" ? "resting" : "idle"; state.confirm = 0; reason = "exit_gone";
    } else if (state.phase === "resting") {
      reason = "resting";
    } else if (state.phase === "nodding") {
      if (now - (state.startedAtMs || now) >= MUSICNOD_MAX_MS) { state.phase = "resting"; state.restUntilMs = now + MUSICNOD_REST_MS; exited = true; reason = "exit_max"; }
      else reason = "hold";
    } else {
      state.confirm = (fin(state.confirm) || 0) + 1;
      if (state.confirm >= MUSICNOD_CONFIRM) { state.phase = "nodding"; state.startedAtMs = now; state.confirm = 0; state.firedCount = (fin(state.firedCount) || 0) + 1; entered = true; reason = "enter"; }
      else reason = "hold";
    }
    state.lastRecord = { atMs: now, fired: entered, reason, source: sample.source || null };
    return { active: state.phase === "nodding", entered, exited, reason };
  } catch { return { ...inv }; }
}
export function sampleMusicnod(state, nowMs) {
  const zero = { active: false, gazePitchDeg: 0, coef: 0, reason: "invalid" };
  try {
    if (!state || typeof state !== "object") return { ...zero };
    const now = fin(nowMs); if (now === null) return { ...zero };
    if (state.phase !== "nodding" || fin(state.startedAtMs) === null) return { active: false, gazePitchDeg: 0, coef: 0, reason: state.lastRecord?.reason || "hold" };
    const el = now - state.startedAtMs;
    if (el < 0 || el >= MUSICNOD_MAX_MS) return { active: false, gazePitchDeg: 0, coef: 0, reason: "exit_max" };
    const env = Math.min(1, el / MUSICNOD_RISE_MS, (MUSICNOD_MAX_MS - el) / MUSICNOD_FALL_MS, 1);
    const pitch = MUSICNOD_PITCH_DEG * env * (0.5 - 0.5 * Math.cos((2 * Math.PI * el) / MUSICNOD_PERIOD_MS));
    return { active: pitch > 0, gazePitchDeg: pitch, coef: env, reason: "hold" };
  } catch { return { ...zero }; }
}
export function runMusicnodSelfTests() {
  let pass = 0; const failures = []; const ok = (c, n) => { if (c) pass++; else failures.push(n); };
  try {
    const s = createMusicnodState();
    ok(noteMusicnod(s, { nearMusic: true }, 0).entered === false, "M1 one obs no fire");
    ok(noteMusicnod(s, { nearMusic: true }, 100).entered === true, "M2 two obs fire");
    let max = 0, mono = true; for (let t = 100; t < 12100; t += 50) { const p = sampleMusicnod(s, t).gazePitchDeg; if (p > max) max = p; if (!(p >= 0 && p <= 5)) mono = false; }
    ok(max <= 5 && max > 4 && mono, "M3 pitch bounded <=5");
    noteMusicnod(s, { nearMusic: true }, 12100);
    ok(s.phase === "resting", "M4 max 12s -> resting");
    ok(noteMusicnod(s, { nearMusic: true }, 13000).entered === false && noteMusicnod(s, { nearMusic: true }, 13100).entered === false, "M5 rest blocks refire");
    const s2 = createMusicnodState(); noteMusicnod(s2, { nearMusic: true, inCombat: true }, 0); noteMusicnod(s2, { nearMusic: true, inCombat: true }, 100);
    ok(s2.firedCount === 0, "M6 suppressed no fire");
    const s3 = createMusicnodState(); noteMusicnod(s3, { nearMusic: true }, 0); const before = s3.confirm; noteMusicnod(s3, { nearMusic: undefined }, 50);
    ok(s3.confirm === before && s3.phase === "idle", "M7 unknown holds");
    let safe = true; try { noteMusicnod(null, null, NaN); sampleMusicnod(null, NaN); noteMusicnod(createMusicnodState(), {}, 0); } catch { safe = false; }
    ok(safe, "M8 invalid safe");
    const s4 = createMusicnodState(); noteMusicnod(s4, { nearMusic: true }, 0); noteMusicnod(s4, { nearMusic: true }, 100); noteMusicnod(s4, { nearMusic: false }, 200);
    ok(s4.phase === "idle" && sampleMusicnod(s4, 200).gazePitchDeg === 0, "M9 gone exits");
  } catch (e) { failures.push("threw " + e.message); }
  return { pass, fail: failures.length, failures };
}
