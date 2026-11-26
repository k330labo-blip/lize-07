// torchpass_math.js — POLISH-ANIM-TORCHPASS-01 (cycle1434): 暗所で光源の横を通るとき視線が小さく光へ寄る純粋核。
// feeder (lightLevel 供給) が安定するまで記録のみ。@minecraft/server を import しない。
// cycle1434_polish_draft.js — POLISH-ANIM-TORCHPASS-01 純粋核ドラフト (cycle1434-a15)
// 暗所を移動中、近くの光源 (松明/ランタン等、feeder がカテゴリ化して渡す) の
// 横を通り過ぎるとき、一度だけ視線が小さく光へ寄る「光に目が引かれる」視線。
// 仕様の正: brain_parts/solutions/polish-backlog/cycle1434_polish_backlog.md
//
// 純粋モジュール (ドラフト): @minecraft/server を import しない。相対 import も持たない。
// 決定的: 時刻・明るさ・光源方位は全て引数で受け取る。Date.now/乱数を持たない。
// 例外を投げない: 不正入力は 不発(false) / 0オフセット に倒す。
// 表示層のみ: 移動・経路・実座標・作業には一切触らない。出力は視線オフセットのみ。
// 新規走査を持たない前提: feeder は既存知覚の光源候補・合成 lightLevel を束ねて渡す想定。
//   供給源が無い/未照合なら統合時は r.lastTorchPass への記録のみに倒すこと。

export const TORCHPASS_DURATION_MS = 800;    // 全体 (台形: 入り200 / 保持350 / 戻り250)
export const TORCHPASS_COOLDOWN_MS = 20000;  // 同一個体・連続光源での煩さを防ぐ
export const TORCHPASS_DARK_MAX = 6;         // これ以下を暗所とする (合成 lightLevel 0..15 想定)
export const TORCHPASS_DARK_SAMPLES = 2;     // 暗所の連続観測で武装 (入口のちらつき防止)
export const TORCHPASS_MIN_DIST = 1.5;       // 近すぎる光源 (自分の設置直後等) は対象外
export const TORCHPASS_MAX_DIST = 5.0;       // 横を通る範囲だけ
export const TORCHPASS_YAW_FACTOR = 0.5;     // 方位差への寄せ率
export const TORCHPASS_YAW_MAX_DEG = 28;     // ヨー寄せ上限
export const TORCHPASS_PITCH_DEG = -4;       // 光源は概ね目の高さ: わずかに上向き (上向き負)
export const TORCHPASS_GAZE_MIN_DEG = -60;   // gaze_math GAZE_PITCH_MIN のローカル写し
export const TORCHPASS_GAZE_MAX_DEG = 75;    // gaze_math GAZE_PITCH_MAX のローカル写し

const LIGHT_CATEGORIES = new Set(["torch", "lantern", "campfire_lit", "glowstone", "lamp_lit"]);

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function wrapDeg(d) { let x = ((d % 360) + 360) % 360; if (x > 180) x -= 360; return x; }

// isTorchPassLight(category) -> boolean: feeder が渡す汎用カテゴリのみ受理。
// ブロック個別 ID は持たない (個別 ID の分類は feeder / sfx と同じ作法で外側が行う)。
export function isTorchPassLight(category) {
  try { return typeof category === "string" && LIGHT_CATEGORIES.has(category); }
  catch { return false; }
}

function isSuppressed(s) {
  return s.suppressed === true || s.combat === true || s.working === true
    || s.falling === true || s.inWater === true || s.hurt === true || s.flying === true;
}

export function createTorchPassState() {
  return {
    darkCount: 0,       // 暗所の連続観測数
    armed: false,       // 暗所滞在で武装したか
    activeUntil: 0,     // 発火中波形の終了時刻 (ms, 引数時刻系)
    startedAt: null,    // 発火開始時刻
    yawDeg: 0,          // 発火時に固定したヨー寄せ量
    lastFiredAt: null,  // 最終発火時刻 (冷却判定)
    lastClusterKey: null, // 最後に反応した光源クラスタ (同一光源の再発防止)
    episode: 0,         // 発火回数 (記録のみ)
  };
}

// torchPassWaveform(elapsedMs) -> 0..1 台形。域外/非数は 0 (残留しない)。
export function torchPassWaveform(elapsedMs) {
  try {
    const t = fin(elapsedMs);
    if (t === null || t < 0 || t >= TORCHPASS_DURATION_MS) return 0;
    if (t < 200) return t / 200;
    if (t < 550) return 1;
    return 1 - (t - 550) / 250;
  } catch { return 0; }
}

// noteTorchPass(state, sample, nowMs) -> { fired, active, reason }
// sample: { lightLevel, category, clusterKey, dist, bearingDeg,
//           suppressed?, combat?, working?, falling?, inWater?, hurt?, flying? }
//   bearingDeg は「現在の視線ヨーから光源方位への符号付き差」(-180..180)。
// 規則:
//   - lightLevel が非数なら UNKNOWN として状態を変えない。
//   - 暗所 (<=DARK_MAX) が DARK_SAMPLES 連続で初めて armed。明るくなれば武装解除。
//   - 発火は armed 中のみ。同 clusterKey の再発なし。冷却中は発火せず候補も保持しない。
//   - 抑制中は発火せず、その光源候補は消費する (lastClusterKey へ記録し遅れ発火しない)。
export function noteTorchPass(state, sample, nowMs) {
  const out = { fired: false, active: false, reason: "invalid" };
  try {
    if (!state || typeof state !== "object" || !sample || typeof sample !== "object") return out;
    const now = fin(nowMs); if (now === null) return out;
    out.active = state.startedAt !== null && now < (fin(state.activeUntil) || 0);
    const lv = fin(sample.lightLevel);
    if (lv === null) { out.reason = "unknown_hold"; return out; }
    if (lv > TORCHPASS_DARK_MAX) {
      state.darkCount = 0; state.armed = false; out.reason = "bright"; return out;
    }
    state.darkCount = (fin(state.darkCount) || 0) + 1;
    if (state.darkCount >= TORCHPASS_DARK_SAMPLES) state.armed = true;
    if (!state.armed) { out.reason = "arming"; return out; }
    if (!isTorchPassLight(sample.category)) { out.reason = "no_light"; return out; }
    const key = typeof sample.clusterKey === "string" && sample.clusterKey ? sample.clusterKey : null;
    if (key === null) { out.reason = "no_key"; return out; }
    if (key === state.lastClusterKey) { out.reason = "same_cluster"; return out; }
    const dist = fin(sample.dist);
    if (dist === null || dist < TORCHPASS_MIN_DIST || dist > TORCHPASS_MAX_DIST) {
      out.reason = "out_of_range"; return out;
    }
    const bearing = fin(sample.bearingDeg);
    if (bearing === null) { out.reason = "no_bearing"; return out; }
    // ここから候補は成立。抑制・冷却でも候補は消費し、遅れて発火させない。
    state.lastClusterKey = key;
    if (isSuppressed(sample)) { out.reason = "suppressed_consumed"; return out; }
    if (state.lastFiredAt !== null && now - state.lastFiredAt < TORCHPASS_COOLDOWN_MS) {
      out.reason = "cooldown_consumed"; return out;
    }
    if (out.active) { out.reason = "already_active"; return out; }
    state.startedAt = now;
    state.activeUntil = now + TORCHPASS_DURATION_MS;
    state.lastFiredAt = now;
    state.yawDeg = clamp(wrapDeg(bearing) * TORCHPASS_YAW_FACTOR, -TORCHPASS_YAW_MAX_DEG, TORCHPASS_YAW_MAX_DEG);
    state.episode = (fin(state.episode) || 0) + 1;
    out.fired = true; out.active = true; out.reason = "fired";
    return out;
  } catch { return out; }
}

// torchPassOffset(state, nowMs) -> { yawDeg, pitchDeg, active }
// 非発火/終了後は必ず 0 (表示の残留を構造的に防ぐ)。終了時に startedAt を片付ける。
export function torchPassOffset(state, nowMs) {
  try {
    if (!state || typeof state !== "object" || state.startedAt === null) {
      return { yawDeg: 0, pitchDeg: 0, active: false };
    }
    const now = fin(nowMs); if (now === null) return { yawDeg: 0, pitchDeg: 0, active: false };
    const k = torchPassWaveform(now - state.startedAt);
    if (k <= 0) {
      if (now - state.startedAt >= TORCHPASS_DURATION_MS) { state.startedAt = null; state.yawDeg = 0; }
      return { yawDeg: 0, pitchDeg: 0, active: false };
    }
    return {
      yawDeg: (fin(state.yawDeg) || 0) * k,
      pitchDeg: clamp(TORCHPASS_PITCH_DEG * k, TORCHPASS_GAZE_MIN_DEG, TORCHPASS_GAZE_MAX_DEG),
      active: true,
    };
  } catch { return { yawDeg: 0, pitchDeg: 0, active: false }; }
}

// --- 自己テスト (node cycle1434_polish_draft.js で実行可能) ---
export function runSelfTests() {
  const results = [];
  const eq = (name, got, want) => results.push({ name, pass: got === want, got, want });
  const near = (name, got, want) => results.push({ name, pass: Math.abs(got - want) < 1e-9, got, want });
  const base = { lightLevel: 3, category: "torch", clusterKey: "c1", dist: 3, bearingDeg: 40 };
  // 暗所2回連続で武装し、2回目の光源候補で発火
  let s = createTorchPassState();
  eq("arm1_no_fire", noteTorchPass(s, base, 0).fired, false);
  eq("arm2_fire", noteTorchPass(s, base, 100).fired, true);
  near("yaw_half", torchPassOffset(s, 300).yawDeg, 20);
  near("pitch_peak", torchPassOffset(s, 300).pitchDeg, -4);
  eq("ends_zero", torchPassOffset(s, 1000).active, false);
  // 同一クラスタ再発なし / 明所では発火しない / 近すぎは対象外
  eq("same_cluster", noteTorchPass(s, base, 30000).reason, "same_cluster");
  let s2 = createTorchPassState();
  noteTorchPass(s2, { ...base, lightLevel: 12 }, 0);
  eq("bright_no_fire", noteTorchPass(s2, { ...base, lightLevel: 12 }, 100).fired, false);
  let s3 = createTorchPassState();
  noteTorchPass(s3, base, 0);
  eq("too_close", noteTorchPass(s3, { ...base, clusterKey: "c2", dist: 1 }, 100).reason, "out_of_range");
  // 抑制中は消費し遅れ発火しない
  let s4 = createTorchPassState();
  noteTorchPass(s4, base, 0);
  eq("suppressed", noteTorchPass(s4, { ...base, combat: true }, 100).reason, "suppressed_consumed");
  eq("suppressed_no_late", noteTorchPass(s4, base, 200).reason, "same_cluster");
  // 冷却: 別クラスタでも20秒内は発火しない
  let s5 = createTorchPassState();
  noteTorchPass(s5, base, 0); noteTorchPass(s5, base, 100);
  eq("cooldown", noteTorchPass(s5, { ...base, clusterKey: "c9" }, 5000).reason, "cooldown_consumed");
  // 不正入力で例外なく不発
  eq("invalid_safe", noteTorchPass(null, null, NaN).fired, false);
  eq("unknown_hold", noteTorchPass(createTorchPassState(), { ...base, lightLevel: undefined }, 0).reason, "unknown_hold");
  const failed = results.filter(r => !r.pass);
  return { total: results.length, passed: results.length - failed.length, failed };
}

if (typeof process !== "undefined" && process.argv && process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const r = runSelfTests();
  console.log(`torchpass self-tests: ${r.passed}/${r.total} passed`);
  if (r.failed.length) { console.error(r.failed); process.exitCode = 1; }
}
