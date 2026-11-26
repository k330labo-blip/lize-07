// mappeek_math.js — POLISH-ANIM-MAPPEEK-01 (cycle1722): 主人が地図を広げて見ている間、一度だけ肩越しに覗き込む視線の純粋核。
//
// 主人が地図を広げて見ている間、一度だけ肩越しに覗き込む視線。
// 主人が地図アイテムを手に保持し続けていることを3回連続観測で確定したら、
// リゼが主人方向へヨーを寄せ、地図のある少し下方向へピッチ+9度で
// 1400ms だけ視線を向ける。表示層のみ。移動・作業・到達可能性は変えない。
//
// プレイヤーは相棒が地図を開くと「どこへ行くの」と
// 一度だけ覗き込むが、開くたび・持ち替えるたびには反応しない。本核は
// (1) ホットバー通過のような一瞬の保持では発火しない3回連続確定、
// (2) 1回の「地図セッション」につき1回だけ、(3) 冷却45秒、
// の3点で「稀に・小さく」というリゼの表現規約に寄せている。
//
// tests/test_*_math.mjs 全件と
// brain_parts/solutions/polish-backlog/BACKLOG.md を確認し、地図保持を
// 発火源にする要素は無いことを確認した。近縁要素との差分:
// - HEED-01: 主人の「発言」の辺が発火源。本件は発言ではなく所持品の保持。
// - CATCHSIGHT-01: 主人が「投げた物」の出現が発火源。本件は静止した保持。
// - MOUNTGLANCE-01 / SLEEPWATCH-01: 乗車/就寝フラグの遷移が発火源。
// - WORKGLANCE / ROUTECHECK: 自分の作業/移動が発火源。
// いずれも「主人が地図を保持し続ける状態」を扱っていない。
//
//
// feeder は主人の手持ち typeId (地図系) を既存の主人観測から供給すること。
// 正式版 API での安定供給が裏取りできない場合は、従来の純粋核先行統合と
// 同様に読み手ゼロの記録のみとし、推測で発火させないこと。
// 視線は 0-E1 の2tick視線レイヤー経由で applyGaze 最下位へ重畳する想定。
// leanDeg (体の小さな傾け最大3度) は RP 受け口が無い間は記録のみ。
// 統合後は「実機確認待ち」(覗き込みの読め方・頻度・ピッチ符号)。
//
// 本ファイルは自己完結の純粋核ドラフト+自己テスト。他ファイルは編集しない。


// ---- 定数 (単一の正) ----
export const MAPPEEK_CONFIRM_COUNT = 3; // 保持の確定に必要な連続観測回数
export const MAPPEEK_CONFIRM_WINDOW_MS = 1500; // 確定観測がこの窓を空けたら数え直し
export const MAPPEEK_MIN_DIST = 1.0; // 近すぎると覗き込みにならない
export const MAPPEEK_MAX_DIST = 5.0; // 肩越しに覗ける上限
export const MAPPEEK_DURATION_MS = 1400; // 波形全体
export const MAPPEEK_RISE_MS = 250;
export const MAPPEEK_FALL_MS = 350;
export const MAPPEEK_PEAK_PITCH_DEG = 9; // 地図は目の高さより下にある
export const MAPPEEK_YAW_PULL_RATIO = 0.45;
export const MAPPEEK_YAW_MAX_DEG = 28;
export const MAPPEEK_LEAN_DEG = 3; // 記録のみ (RP受け口なし)
export const MAPPEEK_COOLDOWN_MS = 45000;

// ---- 状態 ----
export function createMapPeekState() {
return {
confirmCount: 0,
confirmWindowStartMs: null,
sessionActive: false, // 地図保持セッション中 (発火済み/消費済みを含む)
firedAtMs: null,
cooldownUntilMs: 0,
};
}

function cloneState(s) {
const b = createMapPeekState();
if (s && typeof s === "object") {
if (Number.isFinite(s.confirmCount)) b.confirmCount = Math.max(0, Math.floor(s.confirmCount));
if (Number.isFinite(s.confirmWindowStartMs)) b.confirmWindowStartMs = s.confirmWindowStartMs;
b.sessionActive = s.sessionActive === true;
if (Number.isFinite(s.firedAtMs)) b.firedAtMs = s.firedAtMs;
if (Number.isFinite(s.cooldownUntilMs)) b.cooldownUntilMs = s.cooldownUntilMs;
}
return b;
}

// ---- 生産者: 主人の地図保持観測を1回与える ----
// obs: { nowMs, ownerHoldingMap:boolean|null, ownerDist, sameDimension, suppressed}
// 戻り: { state(新オブジェクト), fired, reason}
// 規則:
// - ownerHoldingMap が boolean でない (UNKNOWN) 観測は数えず、壊さず、保持する。
// - false 観測でセッション終了し再武装する (冷却は保持)。
// - 確定 (3回連続) の瞬間にゲート不合格/抑制/冷却中なら、そのセッションは
// 消費され遅れ発火しない (既存 polish 群と同規約)。
export function noteMapPeek(state, obs) {
const next = cloneState(state);
const o = obs && typeof obs === "object"? obs: {};
if (!Number.isFinite(o.nowMs)) return { state: next, fired: false, reason: "no_time"};
const now = o.nowMs;

if (typeof o.ownerHoldingMap!== "boolean") {
return { state: next, fired: false, reason: "unknown"};
}
if (o.ownerHoldingMap === false) {
next.confirmCount = 0;
next.confirmWindowStartMs = null;
next.sessionActive = false;
return { state: next, fired: false, reason: "not_holding"};
}

// ownerHoldingMap === true
if (next.sessionActive) return { state: next, fired: false, reason: "session"};

if (next.confirmCount > 0 &&
(next.confirmWindowStartMs === null || now - next.confirmWindowStartMs > MAPPEEK_CONFIRM_WINDOW_MS || now < next.confirmWindowStartMs)) {
next.confirmCount = 0;
next.confirmWindowStartMs = null;
}
if (next.confirmCount === 0) next.confirmWindowStartMs = now;
next.confirmCount += 1;
if (next.confirmCount < MAPPEEK_CONFIRM_COUNT) {
return { state: next, fired: false, reason: "confirming"};
}

// 確定: このセッションはここで消費される (成否によらず再発火しない)
next.confirmCount = 0;
next.confirmWindowStartMs = null;
next.sessionActive = true;

if (now < next.cooldownUntilMs) return { state: next, fired: false, reason: "cooldown"};
if (o.suppressed === true) return { state: next, fired: false, reason: "suppressed"};
if (o.sameDimension === false) return { state: next, fired: false, reason: "dimension"};
if (!Number.isFinite(o.ownerDist) || o.ownerDist < MAPPEEK_MIN_DIST || o.ownerDist > MAPPEEK_MAX_DIST) {
return { state: next, fired: false, reason: "distance"};
}
next.firedAtMs = now;
next.cooldownUntilMs = now + MAPPEEK_COOLDOWN_MS;
return { state: next, fired: true, reason: "fired"};
}

// ---- 波形: 台形包絡 0..1 (範囲外/不正は null) ----
export function mapPeekEnvelope(elapsedMs) {
if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= MAPPEEK_DURATION_MS) return null;
if (elapsedMs < MAPPEEK_RISE_MS) return elapsedMs / MAPPEEK_RISE_MS;
const fallStart = MAPPEEK_DURATION_MS - MAPPEEK_FALL_MS;
if (elapsedMs <= fallStart) return 1;
return (MAPPEEK_DURATION_MS - elapsedMs) / MAPPEEK_FALL_MS;
}

// 符号付き最短角差を [-180,180) へ
export function shortestAngleDiffDeg(diffDeg) {
if (!Number.isFinite(diffDeg)) return 0;
let d = ((diffDeg + 180) % 360 + 360) % 360 - 180;
return d;
}

// ヨー寄せ量: 目標との角差の 0.45 倍、上限 ±28度
export function mapPeekYawPullDeg(bearingDiffDeg) {
const d = shortestAngleDiffDeg(bearingDiffDeg);
const pull = d * MAPPEEK_YAW_PULL_RATIO;
return Math.max(-MAPPEEK_YAW_MAX_DEG, Math.min(MAPPEEK_YAW_MAX_DEG, pull));
}

// ---- 消費者: 現在時刻の視線オフセットを返す ----
// bearingDiffDeg: 主人方向と現在の顔向きとの符号付き最短角差
export function sampleMapPeek(state, nowMs, bearingDiffDeg) {
const inactive = { active: false, pitchDeg: 0, yawPullDeg: 0, leanDeg: 0, envelope: 0};
const s = cloneState(state);
if (s.firedAtMs === null ||!Number.isFinite(nowMs)) return inactive;
const env = mapPeekEnvelope(nowMs - s.firedAtMs);
if (env === null) return inactive;
return {
active: true,
pitchDeg: MAPPEEK_PEAK_PITCH_DEG * env,
yawPullDeg: mapPeekYawPullDeg(bearingDiffDeg) * env,
leanDeg: MAPPEEK_LEAN_DEG * env,
envelope: env,
};
}

export function isMapPeekActive(state, nowMs) {
return sampleMapPeek(state, nowMs, 0).active;
}
// 統合状態: 純粋核先行 (cycle1722)。feeder (主人の手持ち地図系 typeId の安定供給) が裏取りできるまで読み手ゼロ・記録のみとし、推測で発火させない。視線は 0-E1 の2tickレイヤー経由で applyGaze 最下位へ重畳する想定。実機確認待ち。
