// catchsight_math.js — 主人が投げた物の行方を一瞬だけ目で追う
// POLISH-ANIM-CATCHSIGHT-01 (純粋核ドラフト, cycle2200-a06・作り込みトラック)
// 出典 (仕様の正): brain_parts/solutions/cycle2136-a07-polish-idea/PROPOSAL.md
//   (CATCHSIGHT-01) §3〜§3.5。本ファイルはドラフト置き場の自己完結版であり、
//   統合時に BP/scripts/catchsight_math.js へ移す想定。共有ファイルは編集しない。
//
// 純粋モジュール: @minecraft/server を import しない。相対 import も持たない。
// 例外を投げない。現在時刻・エンティティ参照を持たない (時刻・距離・角度は
// 全て引数)。乱数・Date.now を持たない (決定的)。
// 真偽は厳密一致 (===true) のみを条件として扱い、truthy な数値では発火しない。
// 表示層のみ: 回収・納品・移動目標・経路・掘削ゲート・戦闘・発話・サウンド
// には一切触らない。戻り値は applyGaze 最下位への重畳値と r.lastCatchSight
// 記録以外へ流さないことが統合条件。音・セリフ・パーティクル・新規ボーン・
// スキン/ジオメトリ変更はなし。gen_lize_model.py は実行禁止 (未実行)。
//
// 仕様 (PROPOSAL §3.1 の固定値):
// - 全体 550ms: 入り 0〜120ms は sin で寄せ、120〜320ms は係数 1 で保持、
//   320〜550ms は cos で復帰。終了後はオフセットが完全に 0 へ戻る (出口がある)。
// - 発火は「主人が投げた/落としたアイテムが新規に出現した」辺でのみ:
//   距離 (3D) が 1.5〜10 (両端含む)、相対ヨー |.| <= 50 度。
// - ヨー寄せは clamp(relYaw, -50, 50) × 包絡。相対ヨーが非有限なら全体 0
//   (対象の無い追視を作らない)。
// - ピッチ寄せは clamp(relPitch, -45, 45) / 45 × 12 × 包絡。相対ピッチが
//   非有限ならピッチ寄せ 0 で、ヨーだけの追視に落とす。
// - クールダウン 3000ms (発火開始基準)。抑制中・冷却中・範囲外で立った辺は
//   消費し、遅れて発火しない。連続投棄では最初の 1 個だけに反応する。
// - 抑制 (§3.5): 危険/戦闘/被弾直後、作業・掘削・攻撃・設置、落下/水中/
//   登攀/テレポート直後/復活直後、他の視線重畳が再生中、統合側の suppressed。
//   再生中に抑制が立つと即時打ち切る (sample 側で 0 へ倒す)。打ち切り時は
//   lastFiredAtMs を打ち切り時刻へ進めない (クールダウンは発火開始基準)。
// - 本件は重畳の最下位であり、自分より上の重畳を押しのけない。

export const CATCHSIGHT_DURATION_MS = 550;         // 1回の追視の全体 (§3.1)
export const CATCHSIGHT_RAMP_IN_MS = 120;          // 入り (0〜120ms, sin)
export const CATCHSIGHT_HOLD_END_MS = 320;         // 保持の終わり (120〜320ms は係数1)
export const CATCHSIGHT_COOLDOWN_MS = 3000;        // 発火開始から次の発火までの最小間隔
export const CATCHSIGHT_MIN_DISTANCE = 1.5;        // 3D距離の下限 (両端含む)
export const CATCHSIGHT_MAX_DISTANCE = 10;         // 3D距離の上限 (両端含む)
export const CATCHSIGHT_YAW_LIMIT_DEG = 50;        // 相対ヨーの可動域 ±50 度
export const CATCHSIGHT_PITCH_MAX_DEG = 12;        // ピッチ寄せの最大絶対値
export const CATCHSIGHT_PITCH_INPUT_LIMIT_DEG = 45; // 入力相対ピッチのクランプ ±45 度

export const CATCHSIGHT_CONSTANTS = Object.freeze({
  DURATION_MS: CATCHSIGHT_DURATION_MS,
  RAMP_IN_MS: CATCHSIGHT_RAMP_IN_MS,
  HOLD_END_MS: CATCHSIGHT_HOLD_END_MS,
  COOLDOWN_MS: CATCHSIGHT_COOLDOWN_MS,
  MIN_DISTANCE: CATCHSIGHT_MIN_DISTANCE,
  MAX_DISTANCE: CATCHSIGHT_MAX_DISTANCE,
  YAW_LIMIT_DEG: CATCHSIGHT_YAW_LIMIT_DEG,
  PITCH_MAX_DEG: CATCHSIGHT_PITCH_MAX_DEG,
  PITCH_INPUT_LIMIT_DEG: CATCHSIGHT_PITCH_INPUT_LIMIT_DEG,
});

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function zeroOffset() { return { pitchDeg: 0, yawDeg: 0 }; }

// isCatchsightSuppressed(input) -> boolean: §3.5 の抑制判定
// いずれも ===true のときだけ効く (truthy な 1 等では倒さない)。
export function isCatchsightSuppressed(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.suppressed === true) return true;
    // 危険・戦闘
    if (input.danger === true || input.inCombat === true || input.hurtRecent === true) return true;
    // 作業・移動の優先 (作業対象への視線を奪わない)
    if (input.working === true || input.digging === true
      || input.attacking === true || input.placing === true) return true;
    // 身体状態
    if (input.falling === true || input.inWater === true || input.climbing === true
      || input.justTeleported === true || input.justRespawned === true) return true;
    // 他の視線重畳が再生中 (本件は最下位)
    if (input.overlayActive === true) return true;
    if (input.flinchActive === true || input.inspectActive === true
      || input.nodActive === true || input.heedActive === true
      || input.lookleadActive === true || input.workglanceActive === true
      || input.partnercheckActive === true || input.settleActive === true) return true;
    return false;
  } catch { return false; }
}

// catchsightEnvelope(elapsedMs) -> 0..1 の包絡 k(t) | 範囲外・無効入力は 0
// t<0 または t>=550 で 0。0<=t<120 で sin((t/120)·π/2)。
// 120<=t<320 で 1。320<=t<550 で cos(((t-320)/230)·π/2)。
export function catchsightEnvelope(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= CATCHSIGHT_DURATION_MS) return 0;
    if (e < CATCHSIGHT_RAMP_IN_MS) return Math.sin((e / CATCHSIGHT_RAMP_IN_MS) * Math.PI / 2);
    if (e < CATCHSIGHT_HOLD_END_MS) return 1;
    const v = Math.cos(((e - CATCHSIGHT_HOLD_END_MS) / (CATCHSIGHT_DURATION_MS - CATCHSIGHT_HOLD_END_MS)) * Math.PI / 2);
    return v === 0 ? 0 : v;
  } catch { return 0; }
}

// catchsightOffset(elapsedMs, itemRelYawDeg, itemRelPitchDeg)
//   -> { pitchDeg, yawDeg } (§3.3 の戻り値形そのもの)
// 範囲外・無効入力では例外なく全て 0 のオブジェクトを返す。
// 相対ヨーが非有限なら全体を 0 とする。相対ピッチが非有限なら pitchDeg=0。
export function catchsightOffset(elapsedMs, itemRelYawDeg, itemRelPitchDeg) {
  try {
    const e = finiteOrNull(elapsedMs);
    const relYaw = finiteOrNull(itemRelYawDeg);
    if (e === null || relYaw === null || e < 0 || e >= CATCHSIGHT_DURATION_MS) return zeroOffset();
    const k = catchsightEnvelope(e);
    if (k === 0) return zeroOffset();
    const yawDeg = clamp(relYaw, -CATCHSIGHT_YAW_LIMIT_DEG, CATCHSIGHT_YAW_LIMIT_DEG) * k;
    const relPitch = finiteOrNull(itemRelPitchDeg);
    const pitchDeg = relPitch === null ? 0
      : clamp(relPitch, -CATCHSIGHT_PITCH_INPUT_LIMIT_DEG, CATCHSIGHT_PITCH_INPUT_LIMIT_DEG)
        / CATCHSIGHT_PITCH_INPUT_LIMIT_DEG * CATCHSIGHT_PITCH_MAX_DEG * k;
    return {
      pitchDeg: pitchDeg === 0 ? 0 : pitchDeg,
      yawDeg: yawDeg === 0 ? 0 : yawDeg,
    };
  } catch { return zeroOffset(); }
}

// catchsightAt(startedAtMs, nowMs, itemRelYawDeg, itemRelPitchDeg)
//   -> { pitchDeg, yawDeg } (catchsightOffset と同形の時刻引き版)
export function catchsightAt(startedAtMs, nowMs, itemRelYawDeg, itemRelPitchDeg) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return zeroOffset();
    return catchsightOffset(n - s, itemRelYawDeg, itemRelPitchDeg);
  } catch { return zeroOffset(); }
}

// isCatchsightActive(stateOrStartedAtMs, nowMs) -> boolean
// 0 <= now-started < 550 のみ true、時計巻き戻しは false。
// state オブジェクト ({ startedAtMs }) も開始時刻の数値も受ける。
export function isCatchsightActive(stateOrStartedAtMs, nowMs) {
  try {
    const started = stateOrStartedAtMs && typeof stateOrStartedAtMs === "object"
      ? finiteOrNull(stateOrStartedAtMs.startedAtMs)
      : finiteOrNull(stateOrStartedAtMs);
    const n = finiteOrNull(nowMs);
    if (started === null || n === null) return false;
    const e = n - started;
    return e >= 0 && e < CATCHSIGHT_DURATION_MS;
  } catch { return false; }
}

// catchsightDue(lastFiredAtMs, nowMs) -> boolean: クールダウン判定 (3000ms)
// 初回 (前回が非有限) なら true。境界は前回+2999ms で false・+3000ms で true。
// nowMs 非有限は false。
export function catchsightDue(lastFiredAtMs, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    const last = finiteOrNull(lastFiredAtMs);
    if (last === null) return true;
    return n - last >= CATCHSIGHT_COOLDOWN_MS;
  } catch { return false; }
}

// shouldCatchsight(input) -> boolean: 発火可否の純粋判定 (§3.2, 状態を書き換えない)
// input {
//   ownerTossedItem,   // 必須。===true のみ有効 (出現の辺)
//   itemDistance,      // アイテムまでの3D距離。有限で 1.5 <= d <= 10
//   itemRelYawDeg,     // 現在の頭ヨーからアイテム方向への最短角。有限で |.| <= 50
//   itemRelPitchDeg,   // 任意 (発火判定には使わない。ピッチ寄せ用)
//   suppressed, danger, inCombat, hurtRecent, working, digging, attacking,
//   placing, falling, inWater, climbing, justTeleported, justRespawned,
//   overlayActive, flinchActive, inspectActive, nodActive, heedActive,
//   lookleadActive, workglanceActive, partnercheckActive, settleActive, // 抑制群
//   lastFiredAtMs,     // 前回発火 (note* が管理する state 側が正。直接渡しも受ける)
//   lastFiredMs,       // 別名 (lastFiredAtMs が優先)
//   nowMs,
// }
export function shouldCatchsight(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.ownerTossedItem !== true) return false;
    const dist = finiteOrNull(input.itemDistance);
    if (dist === null || dist < CATCHSIGHT_MIN_DISTANCE || dist > CATCHSIGHT_MAX_DISTANCE) return false;
    const relYaw = finiteOrNull(input.itemRelYawDeg);
    if (relYaw === null || Math.abs(relYaw) > CATCHSIGHT_YAW_LIMIT_DEG) return false;
    if (isCatchsightSuppressed(input)) return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;
    const last = input.lastFiredAtMs !== undefined ? input.lastFiredAtMs : input.lastFiredMs;
    return catchsightDue(last, now);
  } catch { return false; }
}

// --- 状態の薄いラッパ (揮発メモリのみ。永続化は作らない) ---
// state は配線側が保持する表示層状態 (§3.4):
// { startedAtMs, lastFiredAtMs } + サンプリング用に発火時点で固定した
// 相対角 itemRelYawDeg / itemRelPitchDeg と firedCount を併せて保持する
// (heed の relYawDeg 保持と同作法: 毎 tick 取り直すと波形の目標が動き続け
// 「完全な 0 へ戻る」契約が崩れるため発火時に固定する)。
export function createCatchsightState() {
  return {
    startedAtMs: null, lastFiredAtMs: null,
    itemRelYawDeg: null, itemRelPitchDeg: null, firedCount: 0,
  };
}

export function resetCatchsightState(state) {
  try {
    if (!state || typeof state !== "object") return state;
    state.startedAtMs = null;
    state.lastFiredAtMs = null;
    state.itemRelYawDeg = null;
    state.itemRelPitchDeg = null;
    state.firedCount = 0;
    return state;
  } catch { return state; }
}

// noteCatchsight(state, input, nowMsArg) -> boolean (発火したら true) (§3.4)
// §3.2 を満たした tick で1回だけ true を返し、startedAtMs = lastFiredAtMs =
// nowMs を記録する。tick が間引かれても取り戻し発火はしない (1回の呼び出し
// で最大1回)。抑制中・冷却中・距離/ヨー範囲外で立った辺は消費し、遅れて
// 発火しない (呼び出し側が同じ辺を再提示しない限り構造的に起きない)。
// nowMs は nowMsArg (第3引数) が有限ならそれを優先し、無ければ input.nowMs。
// nowMs が非有限の呼び出しは何も変えず false。state がオブジェクトでない
// 場合は何もせず false。クールダウンの前回発火は state 側が正であり、
// state に有限値があれば input 側の lastFiredAtMs より優先する。
export function noteCatchsight(state, input, nowMsArg) {
  try {
    if (!state || typeof state !== "object") return false;
    if (!input || typeof input !== "object") return false;
    const now = finiteOrNull(nowMsArg) !== null ? finiteOrNull(nowMsArg) : finiteOrNull(input.nowMs);
    if (now === null) return false;
    const stateLast = finiteOrNull(state.lastFiredAtMs);
    const ok = shouldCatchsight({
      ...input,
      nowMs: now,
      lastFiredAtMs: stateLast !== null ? stateLast
        : (input.lastFiredAtMs !== undefined ? input.lastFiredAtMs : input.lastFiredMs),
    });
    if (!ok) return false;
    state.startedAtMs = now;
    state.lastFiredAtMs = now;
    state.itemRelYawDeg = clamp(finiteOrNull(input.itemRelYawDeg), -CATCHSIGHT_YAW_LIMIT_DEG, CATCHSIGHT_YAW_LIMIT_DEG);
    state.itemRelPitchDeg = finiteOrNull(input.itemRelPitchDeg);
    state.firedCount = (Number.isFinite(state.firedCount) ? state.firedCount : 0) + 1;
    return true;
  } catch { return false; }
}

// sampleCatchsight(state, nowMs, suppressInput?) -> { active, pitchDeg, yawDeg }
// 統合時の applyGaze 重畳点 (最下位) が毎 tick 呼ぶ想定のサンプリング。
// 相対角は発火時点の値を保持する。suppressInput (§3.5 の抑制フラグ群を
// 持つオブジェクト) が抑制を示す tick では即時打ち切りとして 0 を返す
// (§3.5 / 契約6)。打ち切りでも state.lastFiredAtMs は進めない
// (クールダウンは発火開始基準)。
export function sampleCatchsight(state, nowMs, suppressInput) {
  try {
    const zero = { active: false, pitchDeg: 0, yawDeg: 0 };
    if (!state || typeof state !== "object") return { ...zero };
    if (suppressInput !== undefined && isCatchsightSuppressed(suppressInput)) return { ...zero };
    const s = finiteOrNull(state.startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return { ...zero };
    if (!isCatchsightActive(s, n)) return { ...zero };
    const off = catchsightOffset(n - s, state.itemRelYawDeg, state.itemRelPitchDeg);
    return { active: true, pitchDeg: off.pitchDeg, yawDeg: off.yawDeg };
  } catch { return { active: false, pitchDeg: 0, yawDeg: 0 }; }
}

// --- 自己テスト (統合前の契約確認用。PROPOSAL §4 の契約 1〜9 に対応) ---
// runCatchsightSelfTests() -> { pass, fail, failures: string[] }
// 例外を投げない。直接実行 (node catchsight_math.js) したときも同じ関数を
// 回して結果を表示し、失敗があれば終了コード 1 を返す。
export function runCatchsightSelfTests() {
  let pass = 0; const failures = [];
  const ok = (c, n) => { if (c) pass++; else failures.push(n); };
  const near = (a, b, eps = 1e-6) => typeof a === "number" && Math.abs(a - b) <= eps;
  try {
    // 定数 (§3.1 の固定値)
    ok(CATCHSIGHT_DURATION_MS === 550 && CATCHSIGHT_RAMP_IN_MS === 120 && CATCHSIGHT_HOLD_END_MS === 320, "C-01 duration/ramp/hold");
    ok(CATCHSIGHT_COOLDOWN_MS === 3000 && CATCHSIGHT_MIN_DISTANCE === 1.5 && CATCHSIGHT_MAX_DISTANCE === 10, "C-02 cooldown/distance");
    ok(CATCHSIGHT_YAW_LIMIT_DEG === 50 && CATCHSIGHT_PITCH_MAX_DEG === 12 && CATCHSIGHT_PITCH_INPUT_LIMIT_DEG === 45, "C-03 angle limits");
    ok(Object.isFrozen(CATCHSIGHT_CONSTANTS) && CATCHSIGHT_CONSTANTS.DURATION_MS === 550, "C-04 constants frozen");

    // 包絡 (§3.3)
    ok(catchsightEnvelope(0) === 0 && catchsightEnvelope(550) === 0 && catchsightEnvelope(-1) === 0 && catchsightEnvelope(NaN) === 0, "C-05 envelope edges");
    ok(near(catchsightEnvelope(60), Math.SQRT1_2) && catchsightEnvelope(120) === 1 && catchsightEnvelope(319) === 1, "C-06 envelope ramp-in/hold");
    ok(near(catchsightEnvelope(435), Math.SQRT1_2) && catchsightEnvelope(549) > 0 && catchsightEnvelope(549) < 0.01, "C-07 envelope ramp-out");

    // 代表値 (§3.3 の表, relYaw=30, relPitch=22.5)
    {
      const at = (t) => catchsightOffset(t, 30, 22.5);
      ok(at(0).yawDeg === 0 && at(0).pitchDeg === 0, "C-08 table t=0");
      ok(near(at(60).yawDeg, 21.213, 1e-3) && near(at(60).pitchDeg, 4.243, 1e-3), "C-09 table t=60");
      ok(at(200).yawDeg === 30 && at(200).pitchDeg === 6, "C-10 table t=200 hold");
      ok(near(at(435).yawDeg, 21.213, 1e-3) && near(at(435).pitchDeg, 4.243, 1e-3), "C-11 table t=435");
      ok(near(at(549).yawDeg, 0.205, 1e-3) && near(at(549).pitchDeg, 0.041, 1e-3), "C-12 table t=549");
      ok(at(550).yawDeg === 0 && at(550).pitchDeg === 0 && at(-5).yawDeg === 0, "C-13 table t=550/outside zero");
    }
    // クランプ: ヨー ±50、ピッチ入力 ±45 → ±12
    ok(catchsightOffset(200, 90, 90).yawDeg === 50 && catchsightOffset(200, 90, 90).pitchDeg === 12, "C-14 clamps +");
    ok(catchsightOffset(200, -90, -90).yawDeg === -50 && catchsightOffset(200, -90, -90).pitchDeg === -12, "C-15 clamps -");
    // 契約7: ピッチ非有限 → ヨーのみ。ヨー非有限 → 全体 0
    ok(catchsightOffset(200, 30, NaN).yawDeg === 30 && catchsightOffset(200, 30, NaN).pitchDeg === 0, "C-16 pitch non-finite yaw only");
    ok(catchsightOffset(200, NaN, 22.5).yawDeg === 0 && catchsightOffset(200, NaN, 22.5).pitchDeg === 0, "C-17 yaw non-finite all zero");
    ok(catchsightOffset(NaN, 30, 22.5).yawDeg === 0 && catchsightOffset(200, undefined, 22.5).pitchDeg === 0, "C-18 invalid elapsed/yaw zero");
    // catchsightAt / isCatchsightActive / catchsightDue
    ok(catchsightAt(1000, 1200, 30, 22.5).yawDeg === 30 && catchsightAt(1000, 1550, 30, 22.5).yawDeg === 0 && catchsightAt(NaN, 0, 30, 0).yawDeg === 0, "C-19 at");
    ok(isCatchsightActive(1000, 1000) === true && isCatchsightActive(1000, 1549) === true && isCatchsightActive(1000, 1550) === false && isCatchsightActive(1000, 999) === false, "C-20 active window");
    ok(isCatchsightActive({ startedAtMs: 1000 }, 1200) === true && isCatchsightActive({}, 1200) === false && isCatchsightActive(null, 1200) === false, "C-21 active state form");
    ok(catchsightDue(null, 0) === true && catchsightDue(1000, 3999) === false && catchsightDue(1000, 4000) === true && catchsightDue(1000, NaN) === false && catchsightDue(NaN, 0) === true, "C-22 due boundary");

    const base = { ownerTossedItem: true, itemDistance: 5, itemRelYawDeg: 30, itemRelPitchDeg: 22.5, nowMs: 5000, lastFiredAtMs: null };
    // 契約1/9: 基本発火 + 厳密一致
    ok(shouldCatchsight(base) === true, "C-23 base fires");
    ok(shouldCatchsight({ ...base, ownerTossedItem: 1 }) === false && shouldCatchsight({ ...base, ownerTossedItem: false }) === false && shouldCatchsight({ ...base, ownerTossedItem: undefined }) === false, "C-24 owner strict-true only");
    // 契約2/3: 距離・ヨーの範囲外と境界 (両端含む)
    ok(shouldCatchsight({ ...base, itemDistance: 1.4 }) === false && shouldCatchsight({ ...base, itemDistance: 10.1 }) === false && shouldCatchsight({ ...base, itemRelYawDeg: 51 }) === false && shouldCatchsight({ ...base, itemRelYawDeg: -51 }) === false, "C-25 out of range");
    ok(shouldCatchsight({ ...base, itemDistance: 1.5 }) === true && shouldCatchsight({ ...base, itemDistance: 10 }) === true && shouldCatchsight({ ...base, itemRelYawDeg: 50 }) === true && shouldCatchsight({ ...base, itemRelYawDeg: -50 }) === true, "C-26 boundaries inclusive");
    // 契約7 (発火側): ヨー非有限は不発、ピッチ非有限は発火する
    ok(shouldCatchsight({ ...base, itemRelYawDeg: NaN }) === false && shouldCatchsight({ ...base, itemRelYawDeg: undefined }) === false && shouldCatchsight({ ...base, itemRelPitchDeg: NaN }) === true && shouldCatchsight({ ...base, itemDistance: NaN }) === false, "C-27 non-finite handling");
    // 契約4: 冷却境界
    ok(shouldCatchsight({ ...base, lastFiredAtMs: 2000, nowMs: 4999 }) === false && shouldCatchsight({ ...base, lastFiredAtMs: 2000, nowMs: 5000 }) === true, "C-28 should cooldown boundary");
    // 契約5/§3.5: 抑制は全キー ===true のみ
    for (const key of ["suppressed", "danger", "inCombat", "hurtRecent", "working", "digging", "attacking", "placing", "falling", "inWater", "climbing", "justTeleported", "justRespawned", "overlayActive", "flinchActive", "inspectActive", "nodActive", "heedActive", "lookleadActive", "workglanceActive", "partnercheckActive", "settleActive"]) {
      ok(shouldCatchsight({ ...base, [key]: true }) === false, `C-29 suppress ${key}`);
    }
    ok(shouldCatchsight({ ...base, digging: 1 }) === true && shouldCatchsight({ ...base, suppressed: "yes" }) === true, "C-30 suppression strict-true only");
    // 契約8: 入力異常
    ok(shouldCatchsight(null) === false && shouldCatchsight("x") === false && shouldCatchsight({}) === false && shouldCatchsight({ ...base, nowMs: NaN }) === false && shouldCatchsight({ ...base, itemDistance: undefined }) === false, "C-31 invalid inputs");

    // 契約1/4/5: note → 発火1回・550ms後に完全な0・冷却内2回目は不発・辺消費
    {
      const st = createCatchsightState();
      ok(noteCatchsight(st, { ...base, nowMs: 1000 }) === true && st.startedAtMs === 1000 && st.lastFiredAtMs === 1000 && st.firedCount === 1, "C-32 note fires and records");
      const hold = sampleCatchsight(st, 1200);
      ok(hold.active === true && hold.yawDeg === 30 && hold.pitchDeg === 6, "C-33 sample hold");
      const end = sampleCatchsight(st, 1550);
      ok(end.active === false && end.yawDeg === 0 && end.pitchDeg === 0, "C-34 sample exact zero at 550ms");
      ok(noteCatchsight(st, { ...base, nowMs: 2000 }) === false && noteCatchsight(st, { ...base, nowMs: 3999 }) === false && st.firedCount === 1, "C-35 cooldown consumes edges");
      ok(noteCatchsight(st, { ...base, nowMs: 4000 }) === true && st.firedCount === 2, "C-36 refire at +3000ms");
      // 第3引数 nowMsArg の優先
      const st2 = createCatchsightState();
      ok(noteCatchsight(st2, { ...base, nowMs: NaN }, 7000) === true && st2.startedAtMs === 7000, "C-37 nowMsArg overrides");
      ok(noteCatchsight(st2, { ...base, nowMs: NaN }) === false, "C-38 non-finite now no fire");
    }
    // 契約5: 抑制中の辺は消費し、遅れて発火しない。lastFired は進めない
    {
      const st = createCatchsightState();
      ok(noteCatchsight(st, { ...base, nowMs: 1000, digging: true }) === false && st.lastFiredAtMs === null && st.startedAtMs === null, "C-39 suppressed edge consumed, cooldown untouched");
      ok(sampleCatchsight(st, 1100).active === false && sampleCatchsight(st, 5000).active === false, "C-40 no delayed fire");
    }
    // 契約6: 再生中に抑制が立つ → その tick からオフセット 0。打ち切りで lastFired 不変
    {
      const st = createCatchsightState();
      noteCatchsight(st, { ...base, nowMs: 1000 });
      const before = sampleCatchsight(st, 1200);
      const aborted = sampleCatchsight(st, 1200, { digging: true });
      ok(before.yawDeg === 30 && aborted.active === false && aborted.yawDeg === 0 && aborted.pitchDeg === 0 && st.lastFiredAtMs === 1000, "C-41 abort on suppression, cooldown start kept");
      ok(sampleCatchsight(st, 1200, { digging: 1 }).yawDeg === 30, "C-42 abort is strict-true only");
    }
    // 異常な state / 決定的 / reset
    ok(noteCatchsight(null, base) === false && noteCatchsight({}, null) === false && sampleCatchsight(null, 0).active === false && sampleCatchsight({}, 0).active === false, "C-43 null/empty safe");
    {
      const run = () => {
        const st = createCatchsightState(); const out = [];
        for (const t of [0, 100, 1000, 3000, 3100]) out.push(noteCatchsight(st, { ...base, nowMs: t }));
        return out.join(",");
      };
      ok(run() === run() && run() === "true,false,false,true,false", "C-44 deterministic sequence");
      const st = createCatchsightState();
      noteCatchsight(st, { ...base, nowMs: 0 });
      resetCatchsightState(st);
      ok(st.startedAtMs === null && st.lastFiredAtMs === null && st.firedCount === 0 && isCatchsightActive(st, 0) === false, "C-45 reset");
    }
  } catch (e) {
    failures.push("C-XX self-test threw: " + (e && e.message ? e.message : String(e)));
  }
  return { pass, fail: failures.length, failures };
}

// 直接実行時のみ自己テストを回す (import 時は副作用なし)。
try {
  const isMain = typeof process !== "undefined" && Array.isArray(process.argv)
    && typeof process.argv[1] === "string" && import.meta.url.endsWith(process.argv[1].split("/").pop());
  if (isMain) {
    const r = runCatchsightSelfTests();
    console.log(`catchsight_math: ${r.pass} passed, ${r.fail} failed`);
    for (const f of r.failures) console.log("FAIL", f);
    if (typeof process !== "undefined") process.exitCode = r.fail ? 1 : 0;
  }
} catch { /* 自己テストの表示失敗は本体の契約に影響させない */ }
