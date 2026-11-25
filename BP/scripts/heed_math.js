// heed_math_draft.js — 主人が話しかけた瞬間に頭だけを主人へ向ける
// POLISH-ANIM-HEED-01 (純粋核ドラフト, cycle1443-a09)
// 出典 (仕様の正): brain_parts/solutions/cycle1421-a07/PROPOSAL.md §2/§5/§6
// 台帳: brain_parts/solutions/polish-backlog/BACKLOG.md
//   「POLISH-ANIM-HEED-01 主人が話しかけた瞬間に頭だけを主人へ向ける
//     聞き取りの視線 (新規発案, cycle1421-a07) … 未統合・候補。」
//
// 純粋モジュール: @minecraft/server を import しない。相対 import も持たない
// (ドラフト置き場から単体で node 実行できること。統合時に BP/scripts/heed_math.js
// へ移す際、必要なら gaze_math のクランプ定数へ寄せてよいが本ドラフトは自己完結)。
// 例外を投げない。現在時刻・エンティティ参照を持たない (時刻は引数で受ける)。
// 表示層のみ: 発言の本文・解析結果には一切触らない (Phase 5 の管轄)。
// 会話の内容・返信生成とタイミング・移動・作業・戦闘の挙動は変えない。
// 音・セリフ・名札表示は足さない。新規ボーン・スキン/ジオメトリ変更は不要。
//
// 仕様 (PROPOSAL §2 の固定値):
// - 発火条件は3点 AND: (a) 発言者が所有者(主人)本人 (isOwner===true)
//   (b) リゼ宛てとして会話層に受理された発言 (addressed===true)
//   (c) 主人が半径 16 ブロック以内 (distance <= 16)。別次元は不発。
// - 頭の可動域: 主人への相対ヨー |relYawDeg| <= 70 のときだけ発火
//   (ほぼ真後ろでは体ごと振り向く大動作をしない)。
// - 波形は計 0.8 秒の単一往復: 入り 250ms で主人方向へ寄せ、300ms 保持し、
//   250ms で元の視線へ戻る。終了後はオフセットが完全に 0 へ戻る (出口がある)。
// - ピッチは主人方向へ小さく +4 度まで (下向き正。NOD の 12 度より小さく保ち
//   頷きと混同させない)。
// - クールダウン 8 秒。クールダウン中の辺は消費され、遅れて発火しない。
// - 抑制: 戦闘中 / 掘削・攻撃・設置の作業中 / 落下中 / 水中 / 登攀中 /
//   FLINCH 発火中は発火しない。抑制中に来た辺も消費し、抑制解除後に
//   遅れて発火しない。優先順位は既存の視線重畳系すべてより下 (最下位):
//   統合側は otherOverlayActive / 個別の重畳 active フラグでも抑制できる。
// - 辺の消費の担い手: 本核は「辺が来たときに1回だけ noteHeed / shouldHeed を
//   呼ぶ」前提である。発火しなかった辺を呼び出し側が保持して再提示しない
//   限り、遅れ発火は構造的に起きない (noteHeed は発火時のみ state を進める)。

export const HEED_DURATION_MS = 800;    // 全体 0.8 秒 (PROPOSAL §2)
export const HEED_RAMP_IN_MS = 250;     // 入り 0.25 秒
export const HEED_HOLD_MS = 300;        // 保持 0.3 秒 (250〜550ms)
export const HEED_RAMP_OUT_MS = 250;    // 戻り 0.25 秒 (550〜800ms)
export const HEED_COOLDOWN_MS = 8000;   // クールダウン 8 秒
export const HEED_MAX_DISTANCE = 16;    // 半径 16 ブロック以内
export const HEED_YAW_LIMIT_DEG = 70;   // 相対ヨーの可動域 ±70 度
export const HEED_PITCH_MAX_DEG = 4;    // ピッチ補助 +4 度まで

export const HEED_CONSTANTS = Object.freeze({
  DURATION_MS: HEED_DURATION_MS,
  RAMP_IN_MS: HEED_RAMP_IN_MS,
  HOLD_MS: HEED_HOLD_MS,
  RAMP_OUT_MS: HEED_RAMP_OUT_MS,
  COOLDOWN_MS: HEED_COOLDOWN_MS,
  MAX_DISTANCE: HEED_MAX_DISTANCE,
  YAW_LIMIT_DEG: HEED_YAW_LIMIT_DEG,
  PITCH_MAX_DEG: HEED_PITCH_MAX_DEG,
});

// gaze_math.js のクランプと同値 (自己完結のため本モジュール内に持つ。
// 統合時は gaze_math の GAZE_PITCH_MIN/MAX へ寄せてよい)。
const PITCH_MIN_DEG = -60;
const PITCH_MAX_DEG = 75;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// wrapHeedYawDeg(deg) -> [-180, 180] へ正規化したヨー。-180 は 180 に寄せる
// (dryoff_math.js wrapDryoffYawDeg / lookback_math.js wrapYawDeg と同一式)。
// 非有限はそのまま返す。
export function wrapHeedYawDeg(deg) {
  try {
    if (!Number.isFinite(deg)) return deg;
    let d = ((deg + 180) % 360 + 360) % 360 - 180;
    if (d === -180) d = 180;
    return d;
  } catch { return deg; }
}

// clampHeedRelYawDeg(relYawDeg) -> ±70 度へクランプした相対ヨー | null
// 入力を wrap してからクランプする (例: 350 度は -10 度として扱う)。
export function clampHeedRelYawDeg(relYawDeg) {
  try {
    const r = finiteOrNull(relYawDeg);
    if (r === null) return null;
    const w = wrapHeedYawDeg(r);
    return Math.max(-HEED_YAW_LIMIT_DEG, Math.min(HEED_YAW_LIMIT_DEG, w));
  } catch { return null; }
}

// heedEnvelope(elapsedMs) -> 0..1 の包絡 | 範囲外・無効入力は 0
// 波形: 0〜250ms は sin で寄せ (0→1)、250〜550ms は保持 (1)、
// 550〜800ms は cos で復帰 (1→0)。t=0 と t>=800 は厳密に 0 (出口がある)。
export function heedEnvelope(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= HEED_DURATION_MS) return 0;
    if (e < HEED_RAMP_IN_MS) return Math.sin((e / HEED_RAMP_IN_MS) * Math.PI / 2);
    if (e < HEED_RAMP_IN_MS + HEED_HOLD_MS) return 1;
    const t = (e - HEED_RAMP_IN_MS - HEED_HOLD_MS) / HEED_RAMP_OUT_MS;
    const v = Math.cos(t * Math.PI / 2);
    return v === 0 ? 0 : v;
  } catch { return 0; }
}

// heedOffsets(elapsedMs, relYawDeg)
//   -> { active, gazeYawOffsetDeg, gazePitchDeg }
// PROPOSAL §2 の純粋核の出力形そのもの。非活動時は完全な 0 を返す。
// gazeYawOffsetDeg は relYawDeg を ±70 度へクランプした値 × 包絡。
// gazePitchDeg は +4 度 × 包絡 (下向き正)。
export function heedOffsets(elapsedMs, relYawDeg) {
  try {
    const zero = { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 };
    const e = finiteOrNull(elapsedMs);
    const rel = clampHeedRelYawDeg(relYawDeg);
    if (e === null || rel === null || e < 0 || e >= HEED_DURATION_MS) return { ...zero };
    const k = heedEnvelope(e);
    if (k === 0) return { ...zero };
    return {
      active: true,
      gazeYawOffsetDeg: rel * k === 0 ? 0 : rel * k,
      gazePitchDeg: HEED_PITCH_MAX_DEG * k,
    };
  } catch { return { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 }; }
}

// heedOffsetsAt(startedAtMs, relYawDeg, nowMs) -> heedOffsets と同形
export function heedOffsetsAt(startedAtMs, relYawDeg, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 };
    return heedOffsets(n - s, relYawDeg);
  } catch { return { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 }; }
}

// applyHeedYaw(baseYawDeg, elapsedMs, relYawDeg) -> wrap 済みヨー
// base 非有限時は base をそのまま返す (dryoff の apply* と同規則)。
export function applyHeedYaw(baseYawDeg, elapsedMs, relYawDeg) {
  try {
    if (!Number.isFinite(baseYawDeg)) return baseYawDeg;
    return wrapHeedYawDeg(baseYawDeg + heedOffsets(elapsedMs, relYawDeg).gazeYawOffsetDeg);
  } catch { return baseYawDeg; }
}

// applyHeedPitch(basePitchDeg, elapsedMs, relYawDeg) -> クランプ済みピッチ
// base 非有限時は base をそのまま返す。
export function applyHeedPitch(basePitchDeg, elapsedMs, relYawDeg) {
  try {
    if (!Number.isFinite(basePitchDeg)) return basePitchDeg;
    const off = heedOffsets(elapsedMs, relYawDeg).gazePitchDeg;
    return Math.max(PITCH_MIN_DEG, Math.min(PITCH_MAX_DEG, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

// isHeedActive(startedAtMs, nowMs) -> boolean
// 0 <= nowMs - startedAtMs < 800 のときだけ true。時計巻き戻しは false。
export function isHeedActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    const e = n - s;
    return e >= 0 && e < HEED_DURATION_MS;
  } catch { return false; }
}

// heedDue(lastFiredMs, nowMs) -> boolean: クールダウン判定 (8秒)
// 初回 (lastFiredMs が非有限) は true。nowMs 非有限は false。
// 境界: 前回 +7999ms は false、+8000ms は true。
export function heedDue(lastFiredMs, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    const last = finiteOrNull(lastFiredMs);
    if (last === null) return true;
    return n - last >= HEED_COOLDOWN_MS;
  } catch { return false; }
}

function isSuppressed(input) {
  // 統合側で束ねた汎用フラグ + PROPOSAL §2 の個別抑制 + 最下位優先の担保。
  // いずれも ===true のときだけ抑制として扱う (truthy な 1 等では倒さない)。
  if (input.suppressed === true) return true;
  if (input.inCombat === true || input.combat === true) return true;
  if (input.working === true || input.digging === true || input.attacking === true
      || input.placing === true || input.hasWorkTarget === true) return true;
  if (input.falling === true || input.inWater === true || input.climbing === true) return true;
  if (input.flinchActive === true) return true;
  if (input.otherOverlayActive === true) return true;
  if (input.inspectActive === true || input.nodActive === true || input.lookActive === true) return true;
  return false;
}

// shouldHeed(input) -> boolean: 発火可否の純粋判定 (状態を書き換えない)
// input {
//   isOwner,            // (a) 発言者が所有者本人。===true のみ
//   addressed,          // (b) リゼ宛てとして受理された発言。===true のみ
//                       //     別名 addressedToLize / isAddressed も受理する
//   distance,           // (c) 主人との距離 (ブロック)。有限数で <= 16 のみ
//   relYawDeg,          // 主人への相対ヨー (度)。wrap 後 |.| <= 70 のみ
//   sameDimension,      // ===false なら不発 (別次元)。未指定は不問
//   suppressed, inCombat, combat, working, digging, attacking, placing,
//   hasWorkTarget, falling, inWater, climbing, flinchActive,
//   otherOverlayActive, inspectActive, nodActive, lookActive, // 抑制群
//   lastFiredMs, lastFiredAtMs, // クールダウン用 (lastFiredMs が正)
//   nowMs,
// }
// 真偽は厳密一致のみ。本文・解析結果のフィールドは見ない (混入しても無視)。
export function shouldHeed(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.isOwner !== true) return false;
    const addressed = input.addressed !== undefined ? input.addressed
      : input.addressedToLize !== undefined ? input.addressedToLize
      : input.isAddressed;
    if (addressed !== true) return false;
    if (input.sameDimension === false) return false;
    const dist = finiteOrNull(input.distance);
    if (dist === null || dist < 0 || dist > HEED_MAX_DISTANCE) return false;
    const rel = finiteOrNull(input.relYawDeg);
    if (rel === null) return false;
    if (Math.abs(wrapHeedYawDeg(rel)) > HEED_YAW_LIMIT_DEG) return false;
    if (isSuppressed(input)) return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;
    const last = input.lastFiredMs !== undefined ? input.lastFiredMs : input.lastFiredAtMs;
    return heedDue(last, input.nowMs);
  } catch { return false; }
}

// --- 状態の薄いラッパ (揮発メモリのみ。永続化は作らない: PROPOSAL §5) ---

export function createHeedState() {
  return { startedAtMs: null, relYawDeg: null, lastFiredMs: null, firedCount: 0 };
}

export function resetHeedState(state) {
  try {
    if (!state || typeof state !== "object") return state;
    state.startedAtMs = null;
    state.relYawDeg = null;
    state.lastFiredMs = null;
    state.firedCount = 0;
    return state;
  } catch { return state; }
}

// noteHeed(state, input) -> boolean (発火を記録したら true)
// 発言イベントの辺で1回だけ呼ぶこと。shouldHeed が true のときだけ
// startedAtMs / relYawDeg / lastFiredMs を記録する。不発の辺では
// lastFiredMs を進めない (クールダウンは発火起点でのみ数える)。
// 不発の辺は本関数が消費する: 呼び出し側が同じ辺を再提示しない限り
// 抑制解除・接近・クールダウン経過の後に遅れて発火することはない。
export function noteHeed(state, input) {
  try {
    if (!state || typeof state !== "object") return false;
    if (!input || typeof input !== "object") return false;
    const ok = shouldHeed({
      ...input,
      lastFiredMs: state.lastFiredMs,
    });
    if (!ok) return false;
    state.startedAtMs = input.nowMs;
    state.relYawDeg = clampHeedRelYawDeg(input.relYawDeg);
    state.lastFiredMs = input.nowMs;
    state.firedCount = (Number.isFinite(state.firedCount) ? state.firedCount : 0) + 1;
    return true;
  } catch { return false; }
}

// sampleHeed(state, nowMs) -> { active, gazeYawOffsetDeg, gazePitchDeg }
// 統合時の applyGaze 重畳点 (最下位) が毎 tick 呼ぶ想定のサンプリング。
// relYawDeg は発火時点の値を保持する (追随で毎 tick 取り直すと波形の
// 目標が動き続け「元の視線へ戻る」契約が崩れるため、発火時に固定する)。
export function sampleHeed(state, nowMs) {
  try {
    const zero = { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 };
    if (!state || typeof state !== "object") return { ...zero };
    const s = finiteOrNull(state.startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return { ...zero };
    return heedOffsets(n - s, state.relYawDeg);
  } catch { return { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 }; }
}
