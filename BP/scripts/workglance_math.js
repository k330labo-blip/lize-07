// workglance_math.js — 近くで主人が作業した瞬間の一瞬の注意視線
// POLISH-ANIM-WORKGLANCE-01 (純粋核ドラフト, cycle1728-a17・作り込みトラック)
// 出典 (仕様の正): brain_parts/solutions/cycle1703-a10/DRAFT.md §3〜§5
// 台帳追記行案は DRAFT.md §7 (統合担当が正本へ追記すること。本ドラフトは
// 共有ファイルを一切編集しない)。
//
// 純粋モジュール: @minecraft/server を import しない。相対 import も持たない
// (ドラフト置き場から単体で node 実行できること。統合時に BP/scripts/
// workglance_math.js へ移す際、ピッチクランプ定数を gaze_math.js の
// GAZE_PITCH_MIN/MAX へ寄せてよいが本ドラフトは自己完結とする。
// stepup_math.js / heed_math.js の自己完結ドラフトと同作法)。
// 例外を投げない。現在時刻・エンティティ参照を持たない (時刻は引数で受ける)。
// 決定的: 乱数・Date.now・環境依存を持たない。同じ入力は常に同じ出力。
// 表示層のみ: 移動目標・経路・速度、作業の対象選択と実行判定、掘削ゲート、
// 戦闘判定、発話、サウンド、名札表示には一切触らない。戻り値は表示
// (applyGaze 重畳の最下位) と r.lastWorkGlance 記録以外へ流さないことが
// 統合条件。音は足さない (破壊/設置音は主人側のバニラ音が既にある)。
// 新規ボーン・スキン/ジオメトリ変更は不要。
//
// 仕様 (DRAFT.md §3 の固定値):
// - 発火源: プレイヤーによるブロック破壊 ("break") / 設置 ("place") の
//   イベントのみ。種別で条件に差を付けない。リゼはエンティティであり
//   プレイヤーではないため、自分の dig/place は原理的に混ざらない
//   (DRAFT §3.3)。前提が崩れる場合のフォールバックとして「直近 1 秒以内に
//   自分が dig/place したセルと同一座標のイベントは除外する」条件を
//   isSelfActionEcho() として核内に用意し、should/evaluate/note の全入口で
//   任意入力 (selfActionPos + selfActionAtMs) により有効化できる。
// - 距離: イベントセルまでの水平距離が 1.5 以上 12 以下 (両端含む)。
// - 軌道: 合計 500ms。発火からの経過 t に対し振幅係数は線形で
//   t<120ms で 0→1、120≦t<500ms で 1→0 (入りは速く、戻りはゆっくり)。
//   終了後は全成分が完全な 0 へ戻る (出口がある。残留状態を持たない)。
// - ヨー/ピッチの目標角は発火時点で固定し、窓の途中で対象を追い直さない
//   (第 2 のイベントが来ても目標角は不変で、窓も延長されない)。
// - ヨーは頭だけの範囲 ±40 度へクランプ (体は回さない。体の回転は
//   TURN-01 の管轄)。ピッチは対象セル方向へ最大 ±18 度 (下向き正)。
// - 冷却 4000ms。連続イベントでは最初の 1 回だけ発火する。冷却中・抑制中の
//   イベントも消費する (遅れ発火しない。先行要素の辺消費と同作法):
//   本核は「イベントの辺で 1 回だけ呼ぶ」前提であり、発火しなかった辺を
//   呼び出し側が保持して再提示しない限り遅れ発火は構造的に起きない。
// - 抑制 (DRAFT §3.4): 自分の作業の実行中 (dig/attack/place の有効窓) /
//   戦闘中・危険接近時 (FLINCH 管轄) / 落下中 / 水中で潜水中 / 召喚・復元
//   直後 (SUMMONSCAN 有効期間) / 次元移動直後 (PORTALSTEADY 有効期間) /
//   他の視線作り込みの高優先要素 (INSPECT/NOD/FLINCH/SUMMONSCAN 等) が
//   有効な間。本件は重畳チェーンの最下位として譲る。

export const WORKGLANCE_RADIUS = 12;          // 水平距離の上限 (DRAFT §3.2)
export const WORKGLANCE_MIN_DIST = 1.5;       // 水平距離の下限 (DRAFT §3.2)
export const WORKGLANCE_DURATION_MS = 500;    // 窓の合計 0.5 秒 (DRAFT §3.2)
export const WORKGLANCE_COOLDOWN_MS = 4000;   // 冷却 4 秒 (DRAFT §3.2)
export const WORKGLANCE_YAW_MAX_DEG = 40;     // ヨーのクランプ ±40 度
export const WORKGLANCE_PITCH_MAX_DEG = 18;   // ピッチのクランプ ±18 度
export const WORKGLANCE_RISE_MS = 120;        // 入り 0.12 秒 (線形 0→1)
export const WORKGLANCE_FALL_MS = 380;        // 戻り 0.38 秒 (線形 1→0)
export const WORKGLANCE_SELF_ECHO_MS = 1000;  // 自分 dig/place の除外窓 1 秒

export const WORKGLANCE_CONSTANTS = Object.freeze({
  RADIUS: WORKGLANCE_RADIUS,
  MIN_DIST: WORKGLANCE_MIN_DIST,
  DURATION_MS: WORKGLANCE_DURATION_MS,
  COOLDOWN_MS: WORKGLANCE_COOLDOWN_MS,
  YAW_MAX_DEG: WORKGLANCE_YAW_MAX_DEG,
  PITCH_MAX_DEG: WORKGLANCE_PITCH_MAX_DEG,
  RISE_MS: WORKGLANCE_RISE_MS,
  FALL_MS: WORKGLANCE_FALL_MS,
  SELF_ECHO_MS: WORKGLANCE_SELF_ECHO_MS,
});

// gaze_math.js のクランプと同値 (自己完結のため本モジュール内に持つ。
// 統合時は gaze_math の GAZE_PITCH_MIN/MAX へ寄せてよい。heed と同方式)。
const PITCH_MIN_DEG = -60;
const PITCH_MAX_DEG = 75;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

function posOrNull(p) {
  try {
    if (!p || typeof p !== "object") return null;
    const x = finiteOrNull(p.x), y = finiteOrNull(p.y), z = finiteOrNull(p.z);
    if (x === null || y === null || z === null) return null;
    return { x, y, z };
  } catch { return null; }
}

// wrapWorkglanceYawDeg(deg) -> [-180, 180] へ正規化したヨー。-180 は 180 に
// 寄せる (heed_math.js wrapHeedYawDeg と同一式)。非有限はそのまま返す。
export function wrapWorkglanceYawDeg(deg) {
  try {
    if (!Number.isFinite(deg)) return deg;
    let d = ((deg + 180) % 360 + 360) % 360 - 180;
    if (d === -180) d = 180;
    return d;
  } catch { return deg; }
}

// clampWorkglanceYawDeg(relYawDeg) -> ±40 度へクランプした相対ヨー | null
// 入力を wrap してからクランプする (例: 350 度は -10 度として扱う)。
export function clampWorkglanceYawDeg(relYawDeg) {
  try {
    const r = finiteOrNull(relYawDeg);
    if (r === null) return null;
    const w = wrapWorkglanceYawDeg(r);
    return Math.max(-WORKGLANCE_YAW_MAX_DEG, Math.min(WORKGLANCE_YAW_MAX_DEG, w));
  } catch { return null; }
}

// clampWorkglancePitchDeg(pitchDeg) -> ±18 度へクランプしたピッチ | null
export function clampWorkglancePitchDeg(pitchDeg) {
  try {
    const p = finiteOrNull(pitchDeg);
    if (p === null) return null;
    return Math.max(-WORKGLANCE_PITCH_MAX_DEG, Math.min(WORKGLANCE_PITCH_MAX_DEG, p));
  } catch { return null; }
}

// workglanceEnvelope(elapsedMs) -> 0..1 の包絡 | 範囲外・無効入力は 0
// 波形は DRAFT §3.2 の線形: 0〜120ms で 0→1、120〜500ms で 1→0。
// t=0 と t>=500 は厳密に 0 (出口がある)。
export function workglanceEnvelope(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= WORKGLANCE_DURATION_MS) return 0;
    if (e < WORKGLANCE_RISE_MS) return e / WORKGLANCE_RISE_MS;
    const v = 1 - (e - WORKGLANCE_RISE_MS) / WORKGLANCE_FALL_MS;
    return v === 0 ? 0 : v;
  } catch { return 0; }
}

// horizontalDistance(a, b) -> 水平距離 | null (どちらか無効なら null)
export function workglanceHorizontalDistance(a, b) {
  try {
    const pa = posOrNull(a), pb = posOrNull(b);
    if (pa === null || pb === null) return null;
    return Math.hypot(pb.x - pa.x, pb.z - pa.z);
  } catch { return null; }
}

// computeWorkglanceTarget(selfPos, eventPos, selfYawDeg)
//   -> { horizDist, relYawDeg, targetYawOffsetDeg, targetPitchDeg } | null
// 目標角の導出 (発火時点で 1 回だけ計算し固定する想定)。
// - 方位角は Minecraft のヨー規約: bearing = atan2(-dx, dz) (度)。
//   selfYawDeg が有限なら relYaw = wrap(bearing - selfYawDeg) を ±40 度へ
//   クランプする。selfYawDeg が無い場合は相対角が定義できないため
//   targetYawOffsetDeg は 0 とする (DRAFT §3.1 の最小入力にはヨーが
//   含まれない。統合側は selfYawDeg を渡すことで実方位へ追随できる)。
//   input.relYawDeg が直接与えられた場合の扱いは should/note/evaluate 側
//   (resolveTarget) を参照: relYawDeg が selfYawDeg より優先される。
// - ピッチは下向き正: targetPitch = atan2(-(eventY - selfY), horizDist)
//   を ±18 度へクランプする。水平距離が 0 のときはピッチを符号付き
//   ±18 度 (真上は -18 / 真下は +18) とし、ヨーは 0 で不定にならない。
export function computeWorkglanceTarget(selfPos, eventPos, selfYawDeg) {
  try {
    const s = posOrNull(selfPos), ev = posOrNull(eventPos);
    if (s === null || ev === null) return null;
    const dx = ev.x - s.x, dz = ev.z - s.z, dy = ev.y - s.y;
    const horiz = Math.hypot(dx, dz);
    let targetYawOffsetDeg = 0;
    const yaw = finiteOrNull(selfYawDeg);
    if (yaw !== null && horiz > 0) {
      const bearing = Math.atan2(-dx, dz) * 180 / Math.PI;
      targetYawOffsetDeg = clampWorkglanceYawDeg(bearing - yaw) ?? 0;
    }
    let targetPitchDeg;
    if (horiz > 0) {
      targetPitchDeg = clampWorkglancePitchDeg(Math.atan2(-dy, horiz) * 180 / Math.PI) ?? 0;
    } else {
      targetPitchDeg = dy > 0 ? -WORKGLANCE_PITCH_MAX_DEG
        : dy < 0 ? WORKGLANCE_PITCH_MAX_DEG : 0;
    }
    return {
      horizDist: horiz,
      relYawDeg: yaw !== null && horiz > 0
        ? wrapWorkglanceYawDeg(Math.atan2(-dx, dz) * 180 / Math.PI - yaw) : null,
      targetYawOffsetDeg: targetYawOffsetDeg === 0 ? 0 : targetYawOffsetDeg,
      targetPitchDeg: targetPitchDeg === 0 ? 0 : targetPitchDeg,
    };
  } catch { return null; }
}

function resolveTarget(input) {
  // relYawDeg の直接指定があれば方位の正とする (テスト・統合側の事前計算用)。
  const base = computeWorkglanceTarget(input?.selfPos, input?.eventPos, input?.selfYawDeg ?? input?.facingYawDeg ?? input?.selfYaw);
  if (base === null) return null;
  const rel = finiteOrNull(input?.relYawDeg);
  if (rel !== null) {
    return { ...base, relYawDeg: wrapWorkglanceYawDeg(rel), targetYawOffsetDeg: clampWorkglanceYawDeg(rel) ?? 0 };
  }
  return base;
}

// isSelfActionEcho(input) -> boolean: DRAFT §3.3 のフォールバック除外条件
// 「直近 1 秒以内に自分が dig/place したセルと同一座標のイベント」かどうか。
// input.selfActionPos / lastSelfActionPos (別名 selfDigPos / selfPlacePos) と
// input.selfActionAtMs / lastSelfActionAtMs を任意で受ける。情報が欠ける
// 場合は false (原理的に混ざらない前提の通常経路を妨げない)。
export function isSelfActionEcho(input) {
  try {
    if (!input || typeof input !== "object") return false;
    const ev = posOrNull(input.eventPos);
    if (ev === null) return false;
    const act = posOrNull(input.selfActionPos) ?? posOrNull(input.lastSelfActionPos)
      ?? posOrNull(input.selfDigPos) ?? posOrNull(input.selfPlacePos);
    if (act === null) return false;
    if (act.x !== ev.x || act.y !== ev.y || act.z !== ev.z) return false;
    const at = finiteOrNull(input.selfActionAtMs) !== null ? finiteOrNull(input.selfActionAtMs)
      : finiteOrNull(input.lastSelfActionAtMs);
    const now = finiteOrNull(input.nowMs);
    if (at === null || now === null) return false;
    const dt = now - at;
    return dt >= 0 && dt <= WORKGLANCE_SELF_ECHO_MS;
  } catch { return false; }
}

function isSuppressed(input) {
  // いずれも ===true のときだけ抑制として扱う (truthy な 1 等では倒さない。
  // heed/stepup と同規則)。DRAFT §3.4 の抑制群。
  if (!input || typeof input !== "object") return false;
  if (input.suppressed === true) return true;
  // 自分の作業の実行中 (自分の対象への視線が正であり横取りしない)
  if (input.working === true || input.digging === true || input.attacking === true
      || input.placing === true || input.hasWorkTarget === true) return true;
  // 戦闘中・危険接近時 (FLINCH 管轄)
  if (input.inCombat === true || input.combat === true || input.danger === true) return true;
  if (input.flinchActive === true) return true;
  // 落下中・水中潜水中
  if (input.falling === true || input.selfFalling === true) return true;
  if (input.inWater === true || input.submerged === true || input.diving === true) return true;
  // 召喚・復元直後 / 次元移動直後
  if (input.summonScanActive === true || input.summonActive === true) return true;
  if (input.portalSteadyActive === true || input.dimensionChangeActive === true) return true;
  // 高優先の視線作り込みが有効な間は最下位として譲る
  if (input.otherOverlayActive === true) return true;
  if (input.inspectActive === true || input.nodActive === true || input.heedActive === true) return true;
  return false;
}

// workglanceDue(lastFiredMs, nowMs) -> boolean: クールダウン判定 (4000ms)
// 初回 (lastFiredMs が非有限) は true。nowMs 非有限は false。
// 境界: 前回 +3999ms は false、+4000ms は true。
export function workglanceDue(lastFiredMs, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    const last = finiteOrNull(lastFiredMs);
    if (last === null) return true;
    return n - last >= WORKGLANCE_COOLDOWN_MS;
  } catch { return false; }
}

// isWorkglanceActive(startedAtMs, nowMs) -> boolean
// 0 <= nowMs - startedAtMs < 500 のときだけ true。時計巻き戻しは false。
export function isWorkglanceActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    const e = n - s;
    return e >= 0 && e < WORKGLANCE_DURATION_MS;
  } catch { return false; }
}

// workglanceOffsets(elapsedMs, targetYawOffsetDeg, targetPitchDeg)
//   -> { active, gazeYawOffsetDeg, gazePitchDeg }
// 非活動時は完全な 0。目標角は呼び出し側が発火時点で固定した値を渡す。
export function workglanceOffsets(elapsedMs, targetYawOffsetDeg, targetPitchDeg) {
  try {
    const zero = { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 };
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= WORKGLANCE_DURATION_MS) return { ...zero };
    const k = workglanceEnvelope(e);
    if (k === 0) return { ...zero };
    const ty = clampWorkglanceYawDeg(targetYawOffsetDeg) ?? 0;
    const tp = clampWorkglancePitchDeg(targetPitchDeg) ?? 0;
    return {
      active: true,
      gazeYawOffsetDeg: ty * k === 0 ? 0 : ty * k,
      gazePitchDeg: tp * k === 0 ? 0 : tp * k,
    };
  } catch { return { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 }; }
}

// applyWorkglanceYaw(baseYawDeg, elapsedMs, targetYawOffsetDeg) -> wrap 済みヨー
// base 非有限時は base をそのまま返す (heed の apply* と同規則)。
export function applyWorkglanceYaw(baseYawDeg, elapsedMs, targetYawOffsetDeg) {
  try {
    if (!Number.isFinite(baseYawDeg)) return baseYawDeg;
    return wrapWorkglanceYawDeg(baseYawDeg + workglanceOffsets(elapsedMs, targetYawOffsetDeg, 0).gazeYawOffsetDeg);
  } catch { return baseYawDeg; }
}

// applyWorkglancePitch(basePitchDeg, elapsedMs, targetPitchDeg)
//   -> クランプ済みピッチ。base 非有限時は base をそのまま返す。
export function applyWorkglancePitch(basePitchDeg, elapsedMs, targetPitchDeg) {
  try {
    if (!Number.isFinite(basePitchDeg)) return basePitchDeg;
    const off = workglanceOffsets(elapsedMs, 0, targetPitchDeg).gazePitchDeg;
    return Math.max(PITCH_MIN_DEG, Math.min(PITCH_MAX_DEG, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

// shouldWorkglance(input) -> boolean: 発火可否の純粋判定 (状態を書き換えない)
// input (DRAFT §3.1 の形 + 統合用の任意項目):
// {
//   nowMs,                                  // 必須・有限数
//   selfPos: {x,y,z},                       // 必須・全成分が有限数
//   eventPos: {x,y,z} | null,               // 必須 (null は不発)
//   eventKind: "break" | "place" | null,    // この 2 種のみ・差を付けない
//   selfYawDeg, facingYawDeg, selfYaw,      // 自分のヨー (任意・方位導出用)
//   relYawDeg,                              // 相対ヨーの直接指定 (任意・優先)
//   suppressed, working, digging, attacking, placing, hasWorkTarget,
//   inCombat, combat, danger, flinchActive, falling, selfFalling,
//   inWater, submerged, diving, summonScanActive, summonActive,
//   portalSteadyActive, dimensionChangeActive, otherOverlayActive,
//   inspectActive, nodActive, heedActive,   // 抑制群 (===true のみ)
//   sameDimension,                          // ===false なら不発 (別次元)
//   selfActionPos, selfActionAtMs, ...      // 自分 dig/place 除外 (任意)
//   lastFiredMs, lastFiredAtMs,             // クールダウン用
//   activeStartedAtMs,                      // 窓の再生中は再発火しない
// }
// 成立条件 (DRAFT §3.3 の全て): (1) break/place イベントで同次元
// (2) 水平距離が [1.5, 12] (3) 冷却明けかつ窓の再生中でない
// (4) 抑制に一つも該当しない (5) 自分 dig/place の反響でない。
export function shouldWorkglance(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.eventKind !== "break" && input.eventKind !== "place") return false;
    if (input.sameDimension === false) return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;
    const target = resolveTarget(input);
    if (target === null) return false;
    if (target.horizDist < WORKGLANCE_MIN_DIST || target.horizDist > WORKGLANCE_RADIUS) return false;
    if (isSuppressed(input)) return false;
    if (isSelfActionEcho(input)) return false;
    if (input.activeStartedAtMs !== undefined && isWorkglanceActive(input.activeStartedAtMs, now)) return false;
    const last = input.lastFiredMs !== undefined ? input.lastFiredMs : input.lastFiredAtMs;
    return workglanceDue(last, now);
  } catch { return false; }
}

// --- 状態の薄いラッパ (揮発メモリのみ。永続化は作らない) ---
// state (DRAFT §3.1: 前回発火時刻と現在の窓の開始時刻だけを持つ小さな形
// + 発火時点で固定した目標角):
// {
//   startedAtMs,          // 現在の窓の開始時刻 (発火時刻)
//   lastFiredMs,          // クールダウン用
//   targetYawOffsetDeg,   // 発火時点で固定したヨー目標 (窓の途中では不変)
//   targetPitchDeg,       // 発火時点で固定したピッチ目標 (同上)
//   firedCount,
// }
export function createWorkglanceState() {
  return {
    startedAtMs: null, lastFiredMs: null,
    targetYawOffsetDeg: null, targetPitchDeg: null, firedCount: 0,
  };
}

export function resetWorkglanceState(state) {
  try {
    if (!state || typeof state !== "object") return state;
    state.startedAtMs = null;
    state.lastFiredMs = null;
    state.targetYawOffsetDeg = null;
    state.targetPitchDeg = null;
    state.firedCount = 0;
    return state;
  } catch { return state; }
}

function normalizeState(state) {
  // evaluateWorkglance 用: 入力 state (空・欠落・壊れた値でも可) を
  // 安全な内部形へ寄せる。元のオブジェクトは書き換えない。
  const src = state && typeof state === "object" ? state : {};
  return {
    startedAtMs: finiteOrNull(src.startedAtMs),
    lastFiredMs: finiteOrNull(src.lastFiredMs) !== null ? finiteOrNull(src.lastFiredMs)
      : finiteOrNull(src.lastFiredAtMs),
    targetYawOffsetDeg: clampWorkglanceYawDeg(src.targetYawOffsetDeg),
    targetPitchDeg: clampWorkglancePitchDeg(src.targetPitchDeg),
    firedCount: Number.isFinite(src.firedCount) ? src.firedCount : 0,
  };
}

// noteWorkglance(state, input) -> boolean (発火を記録したら true)
// イベントの辺で 1 回だけ呼ぶこと。shouldWorkglance が true のときだけ
// startedAtMs / 目標角 / lastFiredMs を記録する。不発の辺では lastFiredMs
// を進めない (クールダウンは発火起点でのみ数える。heed と同規則)。
// 不発の辺は本関数が消費する: 呼び出し側が同じ辺を再提示しない限り、
// 抑制解除・クールダウン経過の後に遅れて発火することはない。
// 窓の再生中に来た第 2 のイベントでは発火せず、目標角も窓も不変
// (DRAFT §5 検証 7)。
export function noteWorkglance(state, input) {
  try {
    if (!state || typeof state !== "object") return false;
    if (!input || typeof input !== "object") return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;
    const ok = shouldWorkglance({
      ...input,
      lastFiredMs: state.lastFiredMs,
      activeStartedAtMs: state.startedAtMs,
      nowMs: now,
    });
    if (!ok) return false;
    const target = resolveTarget(input);
    if (target === null) return false;
    state.startedAtMs = now;
    state.targetYawOffsetDeg = target.targetYawOffsetDeg;
    state.targetPitchDeg = target.targetPitchDeg;
    state.lastFiredMs = now;
    state.firedCount = (Number.isFinite(state.firedCount) ? state.firedCount : 0) + 1;
    return true;
  } catch { return false; }
}

// sampleWorkglance(state, nowMs)
//   -> { active, gazeYawOffsetDeg, gazePitchDeg }
// 統合時の applyGaze 重畳点 (最下位) が毎 tick 呼ぶ想定のサンプリング。
// 目標角は発火時点の値を保持する (毎 tick 取り直すと波形の目標が動き続け
// 「完全な 0 へ戻る」契約が崩れるため。heed と同規則)。
export function sampleWorkglance(state, nowMs) {
  try {
    const zero = { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 };
    if (!state || typeof state !== "object") return { ...zero };
    const s = finiteOrNull(state.startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return { ...zero };
    return workglanceOffsets(n - s, state.targetYawOffsetDeg, state.targetPitchDeg);
  } catch { return { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 }; }
}

// isWorkglanceActiveState(state, nowMs) -> boolean (状態形の active 判定)
export function isWorkglanceActiveState(state, nowMs) {
  try { return sampleWorkglance(state, nowMs).active; } catch { return false; }
}

// evaluateWorkglance(input) -> { active, gazeYawOffsetDeg, gazePitchDeg, state }
// DRAFT §3.1 の入出力形そのもの。input.state は書き換えず、結果の state は
// 新しいオブジェクトで返す (純粋形)。振る舞い:
// - eventKind が break/place でイベントが発火条件を全て満たせば、その
//   nowMs を窓の開始として発火し、同 tick のサンプル (経過 0 → 包絡 0 の
//   ためオフセットは 0、ただし active は窓の内側) を返す代わりに、発火の
//   検出は戻り値の state.startedAtMs === nowMs と firedCount の増加で
//   判定できる。tick 消費側は noteWorkglance + sampleWorkglance の組を
//   使うのが正で、本関数はハーネス・単発評価用に用意する。
// - イベントが無い/不発でも、既存の窓が再生中ならそのサンプルを返す。
// - 入力が欠ける/NaN の場合は発火せず、有限値だけを返す (例外なし)。
export function evaluateWorkglance(input) {
  try {
    const zero = { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0 };
    if (!input || typeof input !== "object") {
      return { ...zero, state: createWorkglanceState() };
    }
    const state = normalizeState(input.state);
    const now = finiteOrNull(input.nowMs);
    if (now === null) return { ...zero, state };
    if (input.eventKind === "break" || input.eventKind === "place") {
      const ok = shouldWorkglance({
        ...input,
        lastFiredMs: state.lastFiredMs,
        activeStartedAtMs: state.startedAtMs,
        nowMs: now,
      });
      if (ok) {
        const target = resolveTarget(input);
        if (target !== null) {
          state.startedAtMs = now;
          state.targetYawOffsetDeg = target.targetYawOffsetDeg;
          state.targetPitchDeg = target.targetPitchDeg;
          state.lastFiredMs = now;
          state.firedCount += 1;
        }
      }
    }
    const s = sampleWorkglance(state, now);
    // 発火した同 tick は包絡が 0 で sample が inactive になるため、
    // 窓の内側かどうかは isWorkglanceActive で判定して active に反映する
    // (オフセット自体は 0 のまま)。
    const active = s.active || isWorkglanceActive(state.startedAtMs, now);
    return { active, gazeYawOffsetDeg: s.gazeYawOffsetDeg, gazePitchDeg: s.gazePitchDeg, state };
  } catch {
    return { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0, state: createWorkglanceState() };
  }
}

// --- 自己テスト (統合前の契約確認用。DRAFT §5 検証 1〜9 に対応) ---
// runWorkglanceSelfTests() -> { pass, fail, failures: string[] }
// 例外を投げない。失敗は failures へ名前だけを積む。直接実行
// (node workglance_math.js) したときも同じ関数を回して結果を表示し、
// 失敗があれば終了コード 1 を返す。
export function runWorkglanceSelfTests() {
  let pass = 0; const failures = [];
  const ok = (c, n) => { if (c) pass++; else failures.push(n); };
  const near = (a, b, eps = 1e-9) => typeof a === "number" && Math.abs(a - b) <= eps;
  try {
    const SELF = { x: 0, y: 64, z: 0 };

    // 定数 (DRAFT §3.2 の固定値)
    ok(WORKGLANCE_RADIUS === 12 && WORKGLANCE_MIN_DIST === 1.5, "W-01 radius/min-dist");
    ok(WORKGLANCE_DURATION_MS === 500 && WORKGLANCE_COOLDOWN_MS === 4000, "W-02 duration/cooldown");
    ok(WORKGLANCE_YAW_MAX_DEG === 40 && WORKGLANCE_PITCH_MAX_DEG === 18, "W-03 angle clamps");
    ok(WORKGLANCE_RISE_MS === 120 && WORKGLANCE_FALL_MS === 380
      && WORKGLANCE_RISE_MS + WORKGLANCE_FALL_MS === WORKGLANCE_DURATION_MS, "W-04 rise+fall=duration");
    ok(Object.isFrozen(WORKGLANCE_CONSTANTS) && WORKGLANCE_CONSTANTS.RADIUS === 12, "W-05 constants frozen");

    // 包絡: 線形・非対称・出口で完全な 0
    ok(workglanceEnvelope(0) === 0 && workglanceEnvelope(500) === 0
      && workglanceEnvelope(-1) === 0 && workglanceEnvelope(NaN) === 0, "W-06 envelope edges");
    ok(workglanceEnvelope(60) === 0.5 && workglanceEnvelope(120) === 1, "W-07 envelope rise linear/peak");
    ok(near(workglanceEnvelope(310), 0.5) && workglanceEnvelope(499) > 0 && workglanceEnvelope(499) < 0.01, "W-08 envelope fall linear");

    // 検証 1: 距離 6・横方向の break → 発火 1 回、ヨーが相対角度 (クランプ内)
    // と一致し、500ms 後に完全な 0 へ戻る。selfYaw=0 で +X 方向のセルは
    // bearing atan2(-6,0) = -90 度 → クランプ -40 度。
    {
      const st = createWorkglanceState();
      const fired = noteWorkglance(st, { nowMs: 1000, selfPos: SELF, selfYawDeg: 0, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "break" });
      ok(fired === true && st.firedCount === 1 && st.targetYawOffsetDeg === -40, "W-09 v1 fires, yaw clamped -40");
      const peak = sampleWorkglance(st, 1120);
      ok(peak.active === true && peak.gazeYawOffsetDeg === -40 && peak.gazePitchDeg === 0, "W-10 v1 peak offsets");
      const mid = sampleWorkglance(st, 1060);
      ok(mid.gazeYawOffsetDeg === -20, "W-11 v1 rise midpoint half amplitude");
      const end = sampleWorkglance(st, 1500);
      ok(end.active === false && end.gazeYawOffsetDeg === 0 && end.gazePitchDeg === 0, "W-12 v1 exact zero at 500ms");
    }
    // 検証 1b: クランプ内の相対角度はそのまま一致する (真横でない方向)。
    // selfYaw=0、セル (dx=-3, dz=4): bearing atan2(3,4) ≒ 36.87 度。
    {
      const t = computeWorkglanceTarget(SELF, { x: -3, y: 64, z: 4 }, 0);
      ok(t !== null && near(t.targetYawOffsetDeg, Math.atan2(3, 4) * 180 / Math.PI, 1e-9)
        && Math.abs(t.targetYawOffsetDeg) < 40, "W-13 v1b unclamped yaw matches bearing");
    }

    // 検証 2: 距離が RADIUS 超 / MIN_DIST 未満 → 一度も発火しない (境界は発火)
    ok(shouldWorkglance({ nowMs: 0, selfPos: SELF, eventPos: { x: 12.1, y: 64, z: 0 }, eventKind: "break" }) === false, "W-14 v2 beyond radius");
    ok(shouldWorkglance({ nowMs: 0, selfPos: SELF, eventPos: { x: 1.4, y: 64, z: 0 }, eventKind: "break" }) === false, "W-15 v2 below min dist");
    ok(shouldWorkglance({ nowMs: 0, selfPos: SELF, eventPos: { x: 12, y: 64, z: 0 }, eventKind: "break" }) === true
      && shouldWorkglance({ nowMs: 0, selfPos: SELF, eventPos: { x: 1.5, y: 64, z: 0 }, eventKind: "break" }) === true, "W-16 v2 boundaries inclusive");

    // 検証 3: place でも break と同じ条件で発火する
    ok(shouldWorkglance({ nowMs: 0, selfPos: SELF, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "place" }) === true
      && shouldWorkglance({ nowMs: 0, selfPos: SELF, eventPos: { x: 20, y: 64, z: 0 }, eventKind: "place" }) === false
      && shouldWorkglance({ nowMs: 0, selfPos: SELF, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "other" }) === false
      && shouldWorkglance({ nowMs: 0, selfPos: SELF, eventPos: { x: 6, y: 64, z: 0 }, eventKind: null }) === false, "W-17 v3 place same as break, other kinds rejected");

    // 検証 4: 4 秒以内に 10 回のイベント → 発火は 1 回だけ
    {
      const st = createWorkglanceState(); let fires = 0;
      for (let i = 0; i < 10; i++) {
        if (noteWorkglance(st, { nowMs: i * 300, selfPos: SELF, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "break" })) fires++;
      }
      ok(fires === 1 && st.firedCount === 1, "W-18 v4 ten events in cooldown -> one fire");
      ok(noteWorkglance(st, { nowMs: 4000, selfPos: SELF, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "break" }) === true
        && st.firedCount === 2, "W-19 v4 refire at cooldown boundary");
      ok(workglanceDue(0, 3999) === false && workglanceDue(0, 4000) === true && workglanceDue(null, 0) === true, "W-20 due boundary");
    }

    // 検証 5: 抑制中のイベント → 発火せず、抑制解除後に遅れて発火しない
    {
      const st = createWorkglanceState();
      ok(noteWorkglance(st, { nowMs: 1000, selfPos: SELF, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "break", suppressed: true }) === false
        && st.lastFiredMs === null && st.startedAtMs === null, "W-21 v5 suppressed no fire, cooldown untouched");
      ok(sampleWorkglance(st, 1100).active === false && sampleWorkglance(st, 5000).active === false, "W-22 v5 no delayed fire");
      for (const key of ["working", "digging", "attacking", "placing", "inCombat", "danger", "falling", "inWater", "submerged", "flinchActive", "summonScanActive", "portalSteadyActive", "inspectActive", "nodActive", "otherOverlayActive"]) {
        ok(shouldWorkglance({ nowMs: 0, selfPos: SELF, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "break", [key]: true }) === false, `W-23 v5 suppress ${key}`);
      }
      ok(shouldWorkglance({ nowMs: 0, selfPos: SELF, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "break", suppressed: 1 }) === true, "W-24 v5 suppression is strict-true only");
    }

    // 検証 6: 自分の dig/place と同一座標・直近 1 秒 → フォールバック除外
    {
      const base = { nowMs: 5000, selfPos: SELF, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "break" };
      ok(shouldWorkglance({ ...base, selfActionPos: { x: 6, y: 64, z: 0 }, selfActionAtMs: 5000 }) === false, "W-25 v6 same cell same tick excluded");
      ok(shouldWorkglance({ ...base, selfActionPos: { x: 6, y: 64, z: 0 }, selfActionAtMs: 3999 }) === true, "W-26 v6 echo older than 1s fires");
      ok(shouldWorkglance({ ...base, selfActionPos: { x: 7, y: 64, z: 0 }, selfActionAtMs: 5000 }) === true, "W-27 v6 different cell fires");
      ok(isSelfActionEcho({ ...base, selfActionPos: { x: 6, y: 64, z: 0 }, selfActionAtMs: 4500 }) === true
        && isSelfActionEcho(base) === false, "W-28 v6 echo helper");
    }

    // 検証 7: 窓の途中の第 2 イベント (別方向) → 目標角不変・窓は延長されない
    {
      const st = createWorkglanceState();
      noteWorkglance(st, { nowMs: 1000, selfPos: SELF, selfYawDeg: 0, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "break" });
      const second = noteWorkglance(st, { nowMs: 1200, selfPos: SELF, selfYawDeg: 0, eventPos: { x: -6, y: 64, z: 0 }, eventKind: "place" });
      ok(second === false && st.startedAtMs === 1000 && st.targetYawOffsetDeg === -40, "W-29 v7 target/window unchanged");
      ok(sampleWorkglance(st, 1500).active === false, "W-30 v7 window not extended");
    }

    // 検証 8: 入力異常 → 例外を投げず active:false と有限値だけを返す
    {
      const cases = [
        { nowMs: 0, selfPos: SELF, eventPos: null, eventKind: "break" },
        { nowMs: 0, selfPos: SELF, eventPos: { x: NaN, y: 64, z: 0 }, eventKind: "break" },
        { nowMs: 0, selfPos: SELF, eventPos: null, eventKind: "break", state: { startedAtMs: NaN, lastFiredMs: "x" } },
        { nowMs: 0, selfPos: SELF, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "break", sameDimension: false },
        { nowMs: NaN, selfPos: SELF, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "break" },
        null, undefined, "x", {},
      ];
      let allSafe = true;
      for (const c of cases) {
        const r = evaluateWorkglance(c && typeof c === "object" && !Array.isArray(c) ? { ...c, state: c.state } : c);
        if (r.active !== false || !Number.isFinite(r.gazeYawOffsetDeg) || !Number.isFinite(r.gazePitchDeg)
          || !r.state || typeof r.state !== "object") allSafe = false;
      }
      // sameDimension:false 単体でも発火しないこと (上のループは state 付き入力の再評価を含むため個別にも確認)
      ok(allSafe && shouldWorkglance({ nowMs: 0, selfPos: SELF, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "break", sameDimension: false }) === false, "W-31 v8 invalid inputs safe, other dimension rejected");
      ok(shouldWorkglance(null) === false && noteWorkglance(null, {}) === false && sampleWorkglance(null, 0).active === false, "W-32 v8 null state/input safe");
    }

    // 検証 9: 上下方向のイベント → ピッチは ±18 度クランプ、ヨーは不定にならない
    {
      // 真下寄り (水平 2, 下 10): pitch = atan2(10,2) ≒ 78.7 度 → +18 クランプ
      const down = computeWorkglanceTarget(SELF, { x: 2, y: 54, z: 0 }, 0);
      ok(down !== null && down.targetPitchDeg === 18, "W-33 v9 pitch clamped +18 below");
      const up = computeWorkglanceTarget(SELF, { x: 2, y: 74, z: 0 }, 0);
      ok(up !== null && up.targetPitchDeg === -18, "W-34 v9 pitch clamped -18 above");
      // 水平距離が極小 (真上) は MIN_DIST で除外され、目標導出でもヨーが有限
      ok(shouldWorkglance({ nowMs: 0, selfPos: SELF, eventPos: { x: 0, y: 74, z: 0 }, eventKind: "break" }) === false, "W-35 v9 directly above excluded by min dist");
      const vert = computeWorkglanceTarget(SELF, { x: 0, y: 74, z: 0 }, 0);
      ok(vert !== null && Number.isFinite(vert.targetYawOffsetDeg) && vert.targetPitchDeg === -18, "W-36 v9 vertical target finite");
      // クランプ内ピッチはそのまま: 水平 6, 下 2 → atan2(2,6) ≒ 18.43 は上限超えのため
      // 水平 6, 下 1 → atan2(1,6) ≒ 9.46 度で一致を確認
      const gentle = computeWorkglanceTarget(SELF, { x: 6, y: 63, z: 0 }, 0);
      ok(gentle !== null && near(gentle.targetPitchDeg, Math.atan2(1, 6) * 180 / Math.PI, 1e-9), "W-37 v9 unclamped pitch matches");
    }

    // evaluateWorkglance: DRAFT §3.1 の入出力形 (発火→窓→0 復帰、入力 state 不変)
    {
      const inputState = {};
      const r1 = evaluateWorkglance({ nowMs: 1000, selfPos: SELF, selfYawDeg: 0, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "break", suppressed: false, state: inputState });
      ok(r1.state.startedAtMs === 1000 && r1.state.firedCount === 1 && Object.keys(inputState).length === 0, "W-38 evaluate fires, input state untouched");
      const r2 = evaluateWorkglance({ nowMs: 1120, selfPos: SELF, eventPos: null, eventKind: null, state: r1.state });
      ok(r2.active === true && r2.gazeYawOffsetDeg === -40, "W-39 evaluate samples active window");
      const r3 = evaluateWorkglance({ nowMs: 1500, selfPos: SELF, eventPos: null, eventKind: null, state: r1.state });
      ok(r3.active === false && r3.gazeYawOffsetDeg === 0 && r3.gazePitchDeg === 0, "W-40 evaluate window exits to zero");
    }

    // apply* / active / reset / 決定的
    ok(applyWorkglancePitch(70, 120, 18) === 75 && applyWorkglancePitch(0, 999, 18) === 0
      && Number.isNaN(applyWorkglancePitch(NaN, 120, 18)), "W-41 apply pitch clamp/passthrough");
    ok(applyWorkglanceYaw(170, 120, 40) === -150 && Number.isNaN(applyWorkglanceYaw(NaN, 120, 40)), "W-42 apply yaw wraps");
    ok(isWorkglanceActive(1000, 1000) === true && isWorkglanceActive(1000, 1499) === true
      && isWorkglanceActive(1000, 1500) === false && isWorkglanceActive(1000, 999) === false, "W-43 active window");
    {
      const run = () => {
        const st = createWorkglanceState(); const out = [];
        const seq = [[1000, "break"], [1300, "break"], [2000, "place"], [5000, "break"], [5300, "place"]];
        for (const [t, k] of seq) out.push(noteWorkglance(st, { nowMs: t, selfPos: SELF, selfYawDeg: 0, eventPos: { x: 6, y: 64, z: 0 }, eventKind: k }));
        return out.join(",");
      };
      ok(run() === run() && run() === "true,false,false,true,false", "W-44 deterministic sequence");
      const st = createWorkglanceState();
      noteWorkglance(st, { nowMs: 0, selfPos: SELF, eventPos: { x: 6, y: 64, z: 0 }, eventKind: "break" });
      resetWorkglanceState(st);
      ok(st.startedAtMs === null && st.lastFiredMs === null && st.firedCount === 0
        && isWorkglanceActiveState(st, 0) === false, "W-45 reset");
    }
  } catch (e) {
    failures.push("W-XX self-test threw: " + (e && e.message ? e.message : String(e)));
  }
  return { pass, fail: failures.length, failures };
}

// 直接実行時のみ自己テストを回す (import 時は副作用なし)。
try {
  const isMain = typeof process !== "undefined" && Array.isArray(process.argv)
    && typeof process.argv[1] === "string" && import.meta.url.endsWith(process.argv[1].split("/").pop());
  if (isMain) {
    const r = runWorkglanceSelfTests();
    console.log(`workglance_math: ${r.pass} passed, ${r.fail} failed`);
    for (const f of r.failures) console.log("FAIL", f);
    if (typeof process !== "undefined") process.exitCode = r.fail ? 1 : 0;
  }
} catch { /* 自己テストの表示失敗は本体の契約に影響させない */ }
