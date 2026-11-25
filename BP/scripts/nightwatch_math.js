// nightwatch_math.js — 夜間待機中に一度だけ周囲をゆっくり見回す警戒視線
// POLISH-ANIM-NIGHTWATCH-01 (純粋核, cycle0320-a12 ドラフトを cycle0340 で正式統合)
// 仕様の正: 同フォルダ REPORT.md §3 (本ドラフトと対で正とする)
// 台帳照合: brain_parts/solutions/polish-backlog/BACKLOG.md 全文および
//   brain_parts/ 配下の POLISH-* 主題抽出に NIGHTWATCH / 夜の見回りは無い。
//
// 純粋モジュール: @minecraft/server を import しない。相対 import も持たない。
// 例外を投げない。時刻・位相・待機持続は全て引数で受ける (Date.now/乱数なし、
// 決定的)。位相は汎用文字列 ("night" のみ発火帯、他は feeder が分類して渡す。
// 純粋核にゲーム内時刻の数値帯は持たない。horizonglance と同作法)。
// 位相が非文字列のサンプルは UNKNOWN として状態を一切変えない (三状態の作法)。
// 表示層のみ: 出力は applyGaze への重畳オフセット (ヨー掃引+ピッチ) と
// r.lastNightwatch 記録専用。移動・経路・速度・実座標・作業・戦闘・発話の
// 判定へは一切流さない。音は足さない。新規ボーン/スキン変更は不要。

export const NIGHTWATCH_IDLE_QUALIFY_MS = 20000; // 夜に連続待機20秒で資格
export const NIGHTWATCH_DURATION_MS = 3800;      // 掃引全体 3.8秒
export const NIGHTWATCH_YAW_DEG = 38;            // 掃引の振幅 (左右それぞれ最大)
export const NIGHTWATCH_PITCH_DEG = 4;           // わずかな見下ろし気味 (足元〜中距離を見る)
export const NIGHTWATCH_COOLDOWN_MS = 180000;    // 冷却3分 (夜は1エピソード1回が原則で二重に絞る)

export const NIGHTWATCH_CONSTANTS = Object.freeze({
  IDLE_QUALIFY_MS: NIGHTWATCH_IDLE_QUALIFY_MS,
  DURATION_MS: NIGHTWATCH_DURATION_MS,
  YAW_DEG: NIGHTWATCH_YAW_DEG,
  PITCH_DEG: NIGHTWATCH_PITCH_DEG,
  COOLDOWN_MS: NIGHTWATCH_COOLDOWN_MS,
});

// gaze_math.js のクランプと同値 (自己完結のためローカル写し。統合時に寄せてよい)
const PITCH_MIN_DEG = -60;
const PITCH_MAX_DEG = 75;

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function smooth(t) { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); }

// isNightPhase(phase) -> boolean: 発火帯は "night" のみ
export function isNightPhase(phase) {
  try { return phase === "night"; } catch { return false; }
}

// isKnownPhase(phase) -> boolean: 三状態の FALSE 側 (帯外が確定している)
// 文字列で "night" 以外 (day/dawn/dusk 等) なら確定した帯外。非文字列は UNKNOWN。
export function isKnownPhase(phase) {
  try { return typeof phase === "string" && phase.length > 0; } catch { return false; }
}

// nightwatchSweep(elapsedMs) -> { yawFactor:-1..1, pitchFactor:0..1 } | 非活動は両方0
// 軌道 (合計3800ms):
//   0〜1000ms    : ヨー 0 → -1 (左へ、smoothstep)
//   1000〜1300ms : 左で保持 (-1)
//   1300〜2700ms : ヨー -1 → +1 (右へ横断、smoothstep)
//   2700〜3000ms : 右で保持 (+1)
//   3000〜3800ms : ヨー +1 → 0 (復帰、smoothstep)
// ピッチ係数は入り600msで 0→1、終わり600msで 1→0 の台形。
// t<0 / t>=3800 / 非数は全て 0 (出口があり、完全な0へ戻る)。
export function nightwatchSweep(elapsedMs) {
  try {
    const zero = { yawFactor: 0, pitchFactor: 0 };
    const e = fin(elapsedMs);
    if (e === null || e < 0 || e >= NIGHTWATCH_DURATION_MS) return { ...zero };
    let yaw;
    if (e < 1000) yaw = -smooth(e / 1000);
    else if (e < 1300) yaw = -1;
    else if (e < 2700) yaw = -1 + 2 * smooth((e - 1300) / 1400);
    else if (e < 3000) yaw = 1;
    else yaw = 1 - smooth((e - 3000) / 800);
    let pitch;
    if (e < 600) pitch = smooth(e / 600);
    else if (e < 3200) pitch = 1;
    else pitch = 1 - smooth((e - 3200) / 600);
    return { yawFactor: yaw === 0 ? 0 : yaw, pitchFactor: pitch };
  } catch { return { yawFactor: 0, pitchFactor: 0 }; }
}

// nightwatchOffsets(elapsedMs) -> { active, yawDeg, pitchDeg }
export function nightwatchOffsets(elapsedMs) {
  try {
    const s = nightwatchSweep(elapsedMs);
    const active = s.yawFactor !== 0 || s.pitchFactor !== 0;
    return {
      active,
      yawDeg: NIGHTWATCH_YAW_DEG * s.yawFactor,
      pitchDeg: NIGHTWATCH_PITCH_DEG * s.pitchFactor,
    };
  } catch { return { active: false, yawDeg: 0, pitchDeg: 0 }; }
}

// applyNightwatchPitch(basePitchDeg, elapsedMs) -> クランプ済みピッチ
// base 非有限時は base をそのまま返す (heed/stepup と同規則)。
export function applyNightwatchPitch(basePitchDeg, elapsedMs) {
  try {
    if (!Number.isFinite(basePitchDeg)) return basePitchDeg;
    return clamp(basePitchDeg + nightwatchOffsets(elapsedMs).pitchDeg, PITCH_MIN_DEG, PITCH_MAX_DEG);
  } catch { return basePitchDeg; }
}

// nightwatchDue(lastFiredMs, nowMs) -> boolean: 冷却判定 (初回は true)
export function nightwatchDue(lastFiredMs, nowMs) {
  try {
    const n = fin(nowMs);
    if (n === null) return false;
    const last = fin(lastFiredMs);
    if (last === null) return true;
    return n - last >= NIGHTWATCH_COOLDOWN_MS;
  } catch { return false; }
}

function isSuppressed(input) {
  // ===true のときだけ抑制 (truthy な 1 等では倒さない。他核と同規則)
  if (!input || typeof input !== "object") return false;
  if (input.suppressed === true) return true;
  if (input.inCombat === true || input.combat === true || input.danger === true) return true;
  if (input.hostileNear === true) return true; // 敵が見えている夜は「見回し」でなく警戒対象が実在する
  if (input.working === true || input.digging === true || input.attacking === true
      || input.placing === true || input.hasWorkTarget === true) return true;
  if (input.moving === true || input.falling === true || input.selfFalling === true) return true;
  if (input.inWater === true || input.climbing === true || input.flying === true || input.hovering === true) return true;
  if (input.flinchActive === true) return true;
  if (input.otherOverlayActive === true) return true; // ピッチ/ヨーは最下位重畳のため
  return false;
}

// --- 状態の薄いラッパ (揮発メモリのみ。永続化は作らない) ---
// state: { startedAtMs, lastFiredMs, firedCount, nightEpisodeSpent }
// nightEpisodeSpent: その夜のエピソードで発火済み、または資格到達時に
// 抑制/冷却で不発だったため消費済み。確定した帯外 (day/dawn/dusk 等) を
// 観測したときだけ解除される (UNKNOWN では解除しない)。
export function createNightwatchState() {
  return { startedAtMs: null, lastFiredMs: null, firedCount: 0, nightEpisodeSpent: false };
}

export function resetNightwatchState(state) {
  try {
    if (!state || typeof state !== "object") return state;
    state.startedAtMs = null;
    state.lastFiredMs = null;
    state.firedCount = 0;
    state.nightEpisodeSpent = false;
    return state;
  } catch { return state; }
}

// noteNightwatch(state, sample) -> { fired, reason }
// sample: {
//   phase,              // "night" | その他の文字列 (帯外確定) | 非文字列 (UNKNOWN)
//   idleSustainedMs,    // 連続待機の持続 (feeder 実測値。非有限は資格なし)
//   nowMs,
//   suppressed, inCombat, combat, danger, hostileNear, working, digging,
//   attacking, placing, hasWorkTarget, moving, falling, selfFalling,
//   inWater, climbing, flying, hovering, flinchActive, otherOverlayActive,
// }
// reason: fired / unknown / outside_band / episode_spent / not_idle_enough /
//         suppressed / cooldown / invalid
// 振る舞い:
// - UNKNOWN (位相が非文字列) は状態を一切変えず reason:"unknown"。
// - 確定した帯外では nightEpisodeSpent を解除して reason:"outside_band"。
// - 夜で資格 (待機20秒) に達した最初の観測で発火判定を1回だけ行い、
//   抑制・冷却で不発でもエピソードを消費する (遅れ発火しない)。
// - 資格未満の観測はエピソードを消費しない (待機が続いて資格に届けば発火する)。
export function noteNightwatch(state, sample) {
  try {
    if (!state || typeof state !== "object") return { fired: false, reason: "invalid" };
    if (!sample || typeof sample !== "object") return { fired: false, reason: "invalid" };
    const now = fin(sample.nowMs);
    if (now === null) return { fired: false, reason: "invalid" };
    if (!isKnownPhase(sample.phase)) return { fired: false, reason: "unknown" };
    if (!isNightPhase(sample.phase)) {
      state.nightEpisodeSpent = false;
      return { fired: false, reason: "outside_band" };
    }
    if (state.nightEpisodeSpent === true) return { fired: false, reason: "episode_spent" };
    const idle = fin(sample.idleSustainedMs);
    if (idle === null || idle < NIGHTWATCH_IDLE_QUALIFY_MS) return { fired: false, reason: "not_idle_enough" };
    // 資格到達: この観測でエピソードを確定消費する (発火可否によらない)
    state.nightEpisodeSpent = true;
    if (isSuppressed(sample)) return { fired: false, reason: "suppressed" };
    if (!nightwatchDue(state.lastFiredMs, now)) return { fired: false, reason: "cooldown" };
    state.startedAtMs = now;
    state.lastFiredMs = now;
    state.firedCount = (Number.isFinite(state.firedCount) ? state.firedCount : 0) + 1;
    return { fired: true, reason: "fired" };
  } catch { return { fired: false, reason: "invalid" }; }
}

// sampleNightwatch(state, nowMs) -> { active, yawDeg, pitchDeg }
export function sampleNightwatch(state, nowMs) {
  try {
    const zero = { active: false, yawDeg: 0, pitchDeg: 0 };
    if (!state || typeof state !== "object") return { ...zero };
    const s = fin(state.startedAtMs), n = fin(nowMs);
    if (s === null || n === null) return { ...zero };
    return nightwatchOffsets(n - s);
  } catch { return { active: false, yawDeg: 0, pitchDeg: 0 }; }
}

// --- 自己テスト ---
export function runNightwatchSelfTests() {
  let pass = 0; const failures = [];
  const ok = (c, n) => { if (c) pass++; else failures.push(n); };
  const near = (a, b, eps = 1e-9) => typeof a === "number" && Math.abs(a - b) <= eps;
  try {
    ok(NIGHTWATCH_DURATION_MS === 3800 && NIGHTWATCH_IDLE_QUALIFY_MS === 20000 && NIGHTWATCH_COOLDOWN_MS === 180000, "N-01 constants timing");
    ok(NIGHTWATCH_YAW_DEG === 38 && NIGHTWATCH_PITCH_DEG === 4 && Object.isFrozen(NIGHTWATCH_CONSTANTS), "N-02 constants amplitudes/frozen");
    ok(isNightPhase("night") === true && isNightPhase("day") === false && isNightPhase(undefined) === false, "N-03 night band");
    ok(isKnownPhase("day") === true && isKnownPhase("") === false && isKnownPhase(null) === false && isKnownPhase(123) === false, "N-04 known phase tri-state");

    // 掃引軌道: 出口で完全な0、左保持→右保持→復帰
    ok(nightwatchSweep(0).yawFactor === 0 && nightwatchSweep(3800).yawFactor === 0 && nightwatchSweep(-1).yawFactor === 0 && nightwatchSweep(NaN).yawFactor === 0, "N-05 sweep edges zero");
    ok(nightwatchSweep(1150).yawFactor === -1 && nightwatchSweep(2850).yawFactor === 1, "N-06 sweep holds");
    ok(near(nightwatchSweep(2000).yawFactor, 0, 1e-9), "N-07 sweep crosses zero at center");
    ok(nightwatchSweep(500).yawFactor < 0 && nightwatchSweep(500).yawFactor > -1, "N-08 sweep ramp-in partial");
    {
      let bounded = true;
      for (let t = 0; t <= 3800; t += 37) {
        const s = nightwatchSweep(t);
        if (!(s.yawFactor >= -1 && s.yawFactor <= 1 && s.pitchFactor >= 0 && s.pitchFactor <= 1)) bounded = false;
      }
      ok(bounded, "N-09 sweep bounded");
    }
    {
      const peak = nightwatchOffsets(1150);
      ok(peak.active === true && peak.yawDeg === -38 && peak.pitchDeg === 4, "N-10 peak offsets left");
      ok(nightwatchOffsets(2850).yawDeg === 38, "N-11 peak offsets right");
      const end = nightwatchOffsets(3800);
      ok(end.active === false && end.yawDeg === 0 && end.pitchDeg === 0, "N-12 exit exact zero");
    }
    ok(applyNightwatchPitch(74, 1150) === 75 && applyNightwatchPitch(0, 99999) === 0 && Number.isNaN(applyNightwatchPitch(NaN, 1150)), "N-13 pitch clamp/passthrough");
    ok(nightwatchDue(null, 0) === true && nightwatchDue(1000, 1000 + 179999) === false && nightwatchDue(1000, 1000 + 180000) === true && nightwatchDue(1000, NaN) === false, "N-14 cooldown boundary");

    // 状態機械: 資格・消費・エピソード再武装
    const base = { phase: "night", idleSustainedMs: 25000, nowMs: 100000 };
    {
      const st = createNightwatchState();
      ok(noteNightwatch(st, { ...base, idleSustainedMs: 19999 }).reason === "not_idle_enough" && st.nightEpisodeSpent === false, "N-15 below qualify does not spend");
      ok(noteNightwatch(st, base).fired === true && st.startedAtMs === 100000 && st.firedCount === 1, "N-16 qualify fires");
      ok(sampleNightwatch(st, 101150).yawDeg === -38 && sampleNightwatch(st, 103800).active === false, "N-17 sample waveform/exit");
      ok(noteNightwatch(st, { ...base, nowMs: 200000 }).reason === "episode_spent", "N-18 same night no refire");
      ok(noteNightwatch(st, { phase: undefined, idleSustainedMs: 99999, nowMs: 200100 }).reason === "unknown" && st.nightEpisodeSpent === true, "N-19 UNKNOWN preserves episode");
      ok(noteNightwatch(st, { phase: "day", idleSustainedMs: 0, nowMs: 200200 }).reason === "outside_band" && st.nightEpisodeSpent === false, "N-20 known day re-arms episode");
      // 翌夜: 冷却 (前回+180秒=280000) 前は消費だけして不発、遅れ発火しない
      ok(noteNightwatch(st, { ...base, nowMs: 250000 }).reason === "cooldown" && st.nightEpisodeSpent === true, "N-21 cooldown consumes episode");
      ok(noteNightwatch(st, { ...base, nowMs: 290000 }).reason === "episode_spent" && st.firedCount === 1, "N-22 no delayed fire after cooldown");
    }
    {
      const st = createNightwatchState();
      ok(noteNightwatch(st, { ...base, working: true }).reason === "suppressed" && st.nightEpisodeSpent === true && st.lastFiredMs === null, "N-23 suppression consumes, cooldown untouched");
      ok(noteNightwatch(st, { ...base, nowMs: 300000 }).reason === "episode_spent", "N-24 no delayed fire after suppression");
      ok(noteNightwatch(st, { ...base, suppressed: 1, phase: "dusk", nowMs: 300100 }).reason === "outside_band", "N-25 dusk is known outside band");
    }
    {
      const st = createNightwatchState();
      for (const key of ["suppressed", "inCombat", "danger", "hostileNear", "working", "digging", "attacking", "placing", "hasWorkTarget", "moving", "falling", "inWater", "climbing", "flying", "flinchActive", "otherOverlayActive"]) {
        const s2 = createNightwatchState();
        ok(noteNightwatch(s2, { ...base, [key]: true }).reason === "suppressed", `N-26 suppress ${key}`);
      }
      ok(noteNightwatch(st, { ...base, suppressed: 1 }).fired === true, "N-27 suppression is strict-true only");
      ok(noteNightwatch(null, base).reason === "invalid" && noteNightwatch(st, null).reason === "invalid" && noteNightwatch(st, { ...base, nowMs: NaN }).reason === "invalid", "N-28 invalid inputs safe");
      resetNightwatchState(st);
      ok(st.startedAtMs === null && st.firedCount === 0 && st.nightEpisodeSpent === false, "N-29 reset");
    }
    // 決定的: 同じ入力列は常に同じ結果列
    {
      const run = () => {
        const st = createNightwatchState(); const out = [];
        const seq = [
          { phase: "day", idleSustainedMs: 0, nowMs: 0 },
          { phase: "night", idleSustainedMs: 10000, nowMs: 10000 },
          { phase: "night", idleSustainedMs: 25000, nowMs: 30000 },
          { phase: "night", idleSustainedMs: 30000, nowMs: 40000 },
          { phase: "dawn", idleSustainedMs: 0, nowMs: 50000 },
          { phase: "night", idleSustainedMs: 25000, nowMs: 300000 },
        ];
        for (const s of seq) out.push(noteNightwatch(st, s).reason);
        return out.join(",");
      };
      ok(run() === run() && run() === "outside_band,not_idle_enough,fired,episode_spent,outside_band,fired", "N-30 deterministic sequence");
    }
  } catch (e) {
    failures.push("N-XX self-test threw: " + (e && e.message ? e.message : String(e)));
  }
  return { pass, fail: failures.length, failures };
}

// 直接実行時のみ自己テストを回す (import 時は副作用なし)。
try {
  const isMain = typeof process !== "undefined" && Array.isArray(process.argv)
    && typeof process.argv[1] === "string" && import.meta.url.endsWith(process.argv[1].split("/").pop());
  if (isMain) {
    const r = runNightwatchSelfTests();
    console.log(`nightwatch_math_draft: ${r.pass} passed, ${r.fail} failed`);
    for (const f of r.failures) console.log("FAIL", f);
    if (typeof process !== "undefined") process.exitCode = r.fail ? 1 : 0;
  }
} catch { /* 表示失敗は本体の契約に影響させない */ }
