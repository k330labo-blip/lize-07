// orespot_math.js — 通りがかりに貴重鉱石へ一度だけする二度見 POLISH-ANIM-ORESPOT-01 (純粋核ドラフト)
// 出典: brain_parts/solutions/cycle0855-a11/PROPOSAL.md §5 (仕様の正)
//       brain_parts/solutions/polish-backlog/BACKLOG.md (POLISH-ANIM-ORESPOT-01、未統合・候補)
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// 表示層のみ: 採掘・プランナー効用 (oreValuable)・対象選択・移動には一切触らない。
//
// feeder が束ねる素の観測だけを受ける:
//   { cellKey, relYawDeg, relPitchDeg, isCurrentWorkTarget, scanOk, suppressed }
// - cellKey: "x,y,z:typeId" 形式の不透明な文字列。核は鉱石種別を解釈しない
//   (貴重かどうかの判定は feeder 側が既存 VALUABLE_ORES 集合で済ませる)。
// - scanOk !== true は UNKNOWN: 辺・前回キー・確定を一切進めない。
// - isCurrentWorkTarget === true の辺は発火せず、辺も消費しない
//   (PROPOSAL §6 の文面どおり。作業対象でなくなった後に同じセルが
//    観測され続ければ、その時点で初めて発火しうる。LOOKLEAD-01 との二重表示防止)。
// - suppressed === true / 冷却中の辺は消費する (見たセルとして seen に記録し、
//   遅れて発火しない。FLINCH / SKYGLANCE 等の先行核と同じ作法)。
// 波形は全体 900ms の二山: 寄せ (0.7) → 戻し (0) → 再寄せ (0.85) → 復帰 (0)。

export const ORESPOT_DURATION_MS = 900;
export const ORESPOT_COOLDOWN_MS = 20000;
export const ORESPOT_SEEN_LIMIT = 32;
export const ORESPOT_PEAK1 = 0.7;
export const ORESPOT_PEAK2 = 0.85;
export const GAZE_PITCH_MIN_DEG = -60; // gaze_math のクランプと一致させる
export const GAZE_PITCH_MAX_DEG = 75;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function smooth(u) { const x = clamp(u, 0, 1); return x * x * (3 - 2 * x); }

export function createOreSpotState() {
  return {
    prevCellKey: null,   // 直近の scanOk な観測の cellKey (null = 貴重鉱石なし)
    seenKeys: [],        // 発火済み + 消費済み (抑制/冷却) のセルキー、直近32件 FIFO
    lastFiredMs: null,
    active: null,        // { startedMs, cellKey, relYawDeg, relPitchDeg }
    firedCount: 0,
  };
}

function pushSeen(state, key) {
  if (!state.seenKeys.includes(key)) {
    state.seenKeys.push(key);
    while (state.seenKeys.length > ORESPOT_SEEN_LIMIT) state.seenKeys.shift();
  }
}

// orespotBlendAt(elapsedMs) -> k (0..0.85)。区間外は 0。
export function orespotBlendAt(elapsedMs) {
  try {
    const t = finiteOrNull(elapsedMs);
    if (t === null || t < 0 || t >= ORESPOT_DURATION_MS) return 0;
    if (t < 250) return ORESPOT_PEAK1 * smooth(t / 250);
    if (t < 450) return ORESPOT_PEAK1 * (1 - smooth((t - 250) / 200));
    if (t < 650) return ORESPOT_PEAK2 * smooth((t - 450) / 200);
    if (t < 700) return ORESPOT_PEAK2;
    return ORESPOT_PEAK2 * (1 - smooth((t - 700) / 200));
  } catch { return 0; }
}

// noteOreSpot(state, input, nowMs) -> plan | null
// plan: { cellKey, startedMs, durationMs }。発火時のみ active / lastFiredMs を更新する。
// 消費 (抑制・冷却) の場合は発火しないが seen へ記録し、plan は返さない。
export function noteOreSpot(state, input, nowMs) {
  try {
    if (!state || typeof state !== "object" || !Array.isArray(state.seenKeys)) return null;
    if (!input || typeof input !== "object") return null;
    const now = finiteOrNull(nowMs);
    if (now === null) return null;
    if (input.scanOk !== true) return null; // UNKNOWN: 何も進めない

    const key = (typeof input.cellKey === "string" && input.cellKey !== "") ? input.cellKey : null;
    if (key === null) { state.prevCellKey = null; return null; } // 鉱石なし観測で辺をリセット
    if (key === state.prevCellKey) return null; // 同じセルの連続観測は辺ではない
    if (state.seenKeys.includes(key)) { state.prevCellKey = key; return null; } // 二度と出さない

    // 新しいセルの辺。ここから先は分岐ごとに「消費するか否か」が決まる。
    if (input.isCurrentWorkTarget === true) return null; // 辺を消費しない (prev も進めない)

    const yaw = finiteOrNull(input.relYawDeg);
    const pitch = finiteOrNull(input.relPitchDeg);
    if (yaw === null || pitch === null) return null; // 角度が束ねられていない観測は UNKNOWN 扱い

    // 抑制中・冷却中は辺を消費する (遅れ発火しない)
    const last = finiteOrNull(state.lastFiredMs);
    const cooling = last !== null && now - last < ORESPOT_COOLDOWN_MS;
    if (input.suppressed === true || cooling) {
      state.prevCellKey = key;
      pushSeen(state, key);
      return null;
    }

    state.prevCellKey = key;
    pushSeen(state, key);
    state.lastFiredMs = now;
    state.firedCount = (finiteOrNull(state.firedCount) ?? 0) + 1;
    state.active = {
      startedMs: now,
      cellKey: key,
      relYawDeg: clamp(yaw, -180, 180),
      relPitchDeg: clamp(pitch, GAZE_PITCH_MIN_DEG, GAZE_PITCH_MAX_DEG),
    };
    return { cellKey: key, startedMs: now, durationMs: ORESPOT_DURATION_MS };
  } catch { return null; }
}

// sampleOreSpot(state, nowMs) -> { active, k, yawDeg, pitchDeg, cellKey }
// 合成側は現在視線へ yawDeg / pitchDeg を「寄せ量」として加える (絶対角で上書きしない)。
// 900ms 経過後は active:false で、active は掃除される。
export function sampleOreSpot(state, nowMs) {
  const idle = { active: false, k: 0, yawDeg: 0, pitchDeg: 0, cellKey: null };
  try {
    if (!state || typeof state !== "object" || !state.active) return idle;
    const now = finiteOrNull(nowMs);
    const started = finiteOrNull(state.active.startedMs);
    if (now === null || started === null) return idle;
    const t = now - started;
    if (t < 0) return idle;
    if (t >= ORESPOT_DURATION_MS) { state.active = null; return idle; }
    const k = orespotBlendAt(t);
    return {
      active: true,
      k,
      yawDeg: state.active.relYawDeg * k,
      pitchDeg: clamp(state.active.relPitchDeg * k, GAZE_PITCH_MIN_DEG, GAZE_PITCH_MAX_DEG),
      cellKey: state.active.cellKey,
    };
  } catch { return idle; }
}
