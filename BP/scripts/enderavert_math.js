// enderavert_math.js — エンダーマンと目を合わせない、小さな視線逸らし
// POLISH-ANIM-ENDERAVERT-01 (純粋核ドラフト, cycle1940-a07・作り込みトラック)
// 仕様の正: brain_parts/solutions/cycle1923-a07-polish-idea/REPORT.md §4〜§6, §8
// 先行統合済み portalsteady_math.js / bridgegaze_math.js / partnercheck_math.js
// と同じ型 (純粋核＋状態＋applyGaze 重畳) に揃えた自己完結ドラフト。
// 統合時は BP/scripts/enderavert_math.js へ移す想定。本ドラフトは
// 共有ファイル (main.js / brain.js / all.js / manifest 等) を一切編集しない。
//
// 純粋モジュール: @minecraft/server を import しない。相対 import も持たない
// (ドラフト置き場から単体で node 実行できること)。例外を投げない。
// 現在時刻・エンティティ参照を持たない (時刻は引数で受ける)。決定的:
// 乱数・Date.now・環境依存を持たない。同じ入力は常に同じ出力。
// 表示層のみ: 移動・経路・対象選択・掘削ゲート・戦闘/迎撃/警告の判断・
// 発話・サウンド・名札表示には一切触らない。エンダーマンの実際の怒り
// 条件・敵対化にも干渉しない (REPORT §2, §6)。戻り値は表示
// (applyGaze 重畳。統合時は FLINCH の直下 1 箇所) と r.lastEnderAvert
// 記録以外へ流さないことが統合条件。音・セリフ・パーティクルは足さない。
// 新規ボーン・スキン/ジオメトリ変更は不要。gen_lize_model.py は実行禁止
// (本ドラフトでも未実行)。
//
// 仕様 (REPORT §4 の固定値):
// - 持続型: 最も近いエンダーマンが前方コーン内にいることが確定した間
//   だけ、ヨーを対象と反対側へ最大 26 度、ピッチを下向きへ最大 +16 度
//   ずらし続ける。辺で発火して終わる型ではない (FLINCH/WORKGLANCE と別)。
// - 進入: 3D 距離 <= 12.0 かつ |相対ヨー| <= 50 度が CONFIRM_TICKS (2) 回
//   連続し、抑制が無ければ active 化する。逸らし方向 (対象 relYaw の
//   反対符号) は発火時点で固定し、保持中に窓の途中で追い直さない。
// - 保持/退出: 退出側は距離 <= 14.0 かつ |相対ヨー| <= 70 度と緩い
//   ヒステリシス。退出が確定したら FALL_MS (400) かけて係数を完全な
//   0 へ戻す (出口があり、残留状態を持たない)。
// - UNKNOWN 保持: dist / relYawDeg が undefined の tick は進入も退出も
//   せず、UNKNOWN_HOLD_MS (750) までは直前状態を保持し、過ぎたら
//   退出へ倒す (BRIDGEGAZE-01 の UNKNOWN 保持と同作法)。
// - 係数: 入り RISE_MS (150) で線形 0→1、戻り FALL_MS (400) で線形
//   1→0。途中値から再開する場合は残り距離に比例した時間で寄せる
//   (単調性と 0..1 の範囲は常に保つ。REPORT §8 契約 10)。
// - ピッチの最終クランプは統合側の gaze_math 範囲 (-60/+75) に任せる。
//   核側では重畳量そのものが +16 度を超えないことだけを保証し、
//   独自クランプは増やさない (REPORT §7-3)。
//
// 抑制 (REPORT §5。いずれも ===true のときだけ。truthy な 1 等では倒さない):
// - そのエンダーマン自体を攻撃対象にしている/戦闘中
//   (hostileToSelf / inCombat / attackingTarget)
// - 落下中 (falling)・水中/遊泳中 (inWater / swimming / submerged)・
//   登攀中 (climbing)・死亡/復元遷移中 (dead / restoring)
// - FLINCH 等の高優先の視線作り込みが有効な間 (otherOverlayActive)。
//   本件は applyGaze チェーンで FLINCH の直下に置く想定。
// 抑制中に進入条件を満たしても発火せず、抑制が解けても遅れて発火
// しない (確認カウントは抑制で消費・リセットされる)。保持中に抑制が
// 立ったら退出へ倒す (reason: exit_suppressed)。
//
// feeder (統合時・main.js 側 1 箇所。REPORT §7-2): 既存の走査が既に
// 得ている近傍エンティティから typeId === "minecraft:enderman" の
// 最寄り 1 体を選び、3D 距離と頭正面からの相対ヨーを算出して
// noteEnderavert へ渡す。新規の走査は増やさない。対象が取れない
// 構成なら表示を有効化せず r.lastEnderAvert 記録のみへ倒してよい
// (本核はその場合もそのまま使える: noteEnderavert は発火/不発に
// かかわらず state.lastRecord へ { atMs, fired, reason } を残す)。

export const ENDERAVERT_ENTER_DIST = 12.0;     // 進入: 3D 距離の上限
export const ENDERAVERT_EXIT_DIST = 14.0;      // 退出: ヒステリシス (+2.0)
export const ENDERAVERT_ENTER_CONE_DEG = 50;   // 進入: 正面からの相対ヨー上限
export const ENDERAVERT_EXIT_CONE_DEG = 70;    // 退出: ヒステリシス (+20 度)
export const ENDERAVERT_CONFIRM_TICKS = 2;     // 進入確定に必要な連続観測回数
export const ENDERAVERT_YAW_MAX_DEG = 26;      // 逸らしヨーの最大 (対象と反対側)
export const ENDERAVERT_PITCH_DEG = 16;        // 視線下げ (下向き正)
export const ENDERAVERT_RISE_MS = 150;         // 入り (線形 0→1)
export const ENDERAVERT_FALL_MS = 400;         // 戻り (線形 1→0)
export const ENDERAVERT_UNKNOWN_HOLD_MS = 750; // 観測が欠けた間の状態保持上限

export const ENDERAVERT_CONSTANTS = Object.freeze({
  ENTER_DIST: ENDERAVERT_ENTER_DIST,
  EXIT_DIST: ENDERAVERT_EXIT_DIST,
  ENTER_CONE_DEG: ENDERAVERT_ENTER_CONE_DEG,
  EXIT_CONE_DEG: ENDERAVERT_EXIT_CONE_DEG,
  CONFIRM_TICKS: ENDERAVERT_CONFIRM_TICKS,
  YAW_MAX_DEG: ENDERAVERT_YAW_MAX_DEG,
  PITCH_DEG: ENDERAVERT_PITCH_DEG,
  RISE_MS: ENDERAVERT_RISE_MS,
  FALL_MS: ENDERAVERT_FALL_MS,
  UNKNOWN_HOLD_MS: ENDERAVERT_UNKNOWN_HOLD_MS,
});

// 理由コード (REPORT §4.1 の配列が正。順序・文字列を変えないこと)。
// noteEnderavert / sampleEnderavert の reason と state.lastRecord.reason は
// 原則としてこの集合の値だけを返す。例外は 1 つだけ: 進入条件を満たした
// 観測が CONFIRM_TICKS に届いていない「確定待ち」の tick は、発火でも
// 保持でも退出でもないため "hold" を entered:false と併せて返す
// (新しい理由コードを足さないための既存集合内での運用。契約テストで固定)。
export const ENDERAVERT_REASONS = Object.freeze([
  "enter", "hold", "exit_target_gone", "exit_cone", "exit_suppressed",
  "unknown_hold", "unknown_expired", "too_far", "behind", "suppressed", "invalid",
]);

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// wrapEnderavertYawDeg(deg) -> [-180, 180] へ正規化したヨー。
// -180 は 180 に寄せる (portalsteady/partnercheck と同一式)。非有限はそのまま返す。
export function wrapEnderavertYawDeg(deg) {
  try {
    if (!Number.isFinite(deg)) return deg;
    let d = ((deg + 180) % 360 + 360) % 360 - 180;
    if (d === -180) d = 180;
    return d;
  } catch { return deg; }
}

function isSuppressed(sample) {
  // REPORT §5 の抑制群。いずれも ===true のときだけ抑制として扱う。
  if (!sample || typeof sample !== "object") return false;
  if (sample.suppressed === true) return true;
  // 戦うと決めた相手からは逸らさない (戦闘判定が本件を消すのであって逆はない)
  if (sample.hostileToSelf === true || sample.inCombat === true
      || sample.attackingTarget === true) return true;
  // 落下中・水中/遊泳中・登攀中・死亡/復元遷移中
  if (sample.falling === true) return true;
  if (sample.inWater === true || sample.swimming === true || sample.submerged === true) return true;
  if (sample.climbing === true) return true;
  if (sample.dead === true || sample.restoring === true) return true;
  // FLINCH 等の高優先の視線作り込みが有効な間は譲る
  if (sample.otherOverlayActive === true) return true;
  return false;
}

// --- 係数の時間発展 (内部) ---
// 状態はアンカー方式で持つ: coefAnchor (anchorAtMs 時点の係数) から
// coefTarget (active なら 1、退出中なら 0) へ、入りは RISE_MS・
// 戻りは FALL_MS を「全振幅あたりの時間」として線形に寄せる。
// 途中値からの再開でも単調で、0..1 を出ない。
function coefAt(state, nowMs) {
  const anchor = finiteOrNull(state.coefAnchor);
  const at = finiteOrNull(state.anchorAtMs);
  const target = state.active === true ? 1 : 0;
  if (anchor === null) return state.active === true ? 1 : 0;
  if (at === null) return clamp01(anchor);
  const elapsed = nowMs - at;
  if (elapsed <= 0) return clamp01(anchor);
  if (anchor === target) return clamp01(anchor);
  const span = target > anchor ? ENDERAVERT_RISE_MS : ENDERAVERT_FALL_MS;
  const need = Math.abs(target - anchor) * span;
  if (need <= 0 || elapsed >= need) return target;
  return clamp01(anchor + (target - anchor) * (elapsed / need));
}

// 現在の係数をアンカーへ固定する (遷移の起点をそろえる内部処理)。
function anchorCoef(state, nowMs) {
  const c = coefAt(state, nowMs);
  state.coefAnchor = c;
  state.anchorAtMs = nowMs;
  state.coef = c;
  return c;
}

// 退出を開始する (内部)。既に退出済みなら何もしない。
// 戻り値: この呼び出しで退出が始まったら true。
function beginExit(state, nowMs) {
  if (state.active !== true) return false;
  anchorCoef(state, nowMs);
  state.active = false;
  state.exiting = true;
  state.exitStartedAtMs = nowMs;
  state.confirmCount = 0;
  return true;
}

// 退出が完了していたら残留を掃除する (内部)。係数が完全な 0 に
// 達した時点で方向固定を解放し、次の進入で新しい方向を取れるようにする。
function settleExit(state, nowMs) {
  if (state.active === true || state.exiting !== true) return;
  if (coefAt(state, nowMs) <= 0) {
    state.exiting = false;
    state.exitStartedAtMs = null;
    state.targetYawDeg = null;
    state.coefAnchor = 0;
    state.anchorAtMs = nowMs;
    state.coef = 0;
  }
}

// --- 状態 (REPORT §4.2 の形＋内部アンカー。揮発メモリのみ。永続化しない) ---
// {
//   active,        // 逸らし保持中か (係数の目標が 1 か)
//   coef,          // 直近に確定した係数 0..1 (sample でも更新される)
//   startedAtMs,   // 現在の保持の開始時刻 (発火時刻) | null
//   lastSeenAtMs,  // 対象を最後に有効観測した時刻 | null (UNKNOWN 保持の起点)
//   confirmCount,  // 進入条件の連続観測回数
//   targetYawDeg,  // 発火時点で固定した符号付き逸らしヨー (最大重畳量) | null
//   lastRecord,    // 直近の観測の記録 { atMs, fired, reason }
//                  // (r.lastEnderAvert への転記用。記録のみ統合でも使う)
//   // 以下は内部用 (追加フィールド。意味の変更ではなく §4.2 への追加):
//   coefAnchor, anchorAtMs, exiting, exitStartedAtMs, unknownSinceMs,
//   lastReason, firedCount,
// }
export function createEnderavertState() {
  return {
    active: false, coef: 0, startedAtMs: null, lastSeenAtMs: null,
    confirmCount: 0, targetYawDeg: null, lastRecord: null,
    coefAnchor: 0, anchorAtMs: null, exiting: false, exitStartedAtMs: null,
    unknownSinceMs: null, lastReason: null, firedCount: 0,
  };
}

export function resetEnderavertState(state) {
  try {
    if (!state || typeof state !== "object") return state;
    const fresh = createEnderavertState();
    for (const k of Object.keys(fresh)) state[k] = fresh[k];
    return state;
  } catch { return state; }
}

// enderavertCoefAt(state, nowMs) -> 0..1 の現在係数 | 入力異常時は 0
// 状態を書き換えない純粋な読み取り。
export function enderavertCoefAt(state, nowMs) {
  try {
    if (!state || typeof state !== "object") return 0;
    const n = finiteOrNull(nowMs);
    if (n === null) return 0;
    return coefAt(state, n);
  } catch { return 0; }
}

// isEnderavertActive(state, nowMs) -> boolean
// 保持中、または戻りの途中 (係数 > 0) のとき true。
export function isEnderavertActive(state, nowMs) {
  try {
    if (!state || typeof state !== "object") return false;
    if (state.active === true) return true;
    return enderavertCoefAt(state, nowMs) > 0;
  } catch { return false; }
}

// classifyEnderavert(state, sample, nowMs) -> 理由コード文字列
// 発火/保持/退出の純粋な事前判定 (状態を書き換えない)。noteEnderavert の
// 遷移規則と同じ順序で判定する: 入力 → 抑制 → UNKNOWN → 喪失 → 範囲。
// 戻り値の意味:
// - "enter": この観測で進入が確定する (confirmCount が閾値に達する)
// - "hold": 保持が続く、または進入の確定待ち (confirmCount < 閾値)
// - "suppressed" / "exit_suppressed": 抑制 (非保持時 / 保持時)
// - "unknown_hold" / "unknown_expired": 観測欠落 (保持上限内 / 超過)
// - "exit_target_gone": 対象喪失、または保持中に退出距離を超えた
// - "exit_cone": 保持中に退出コーンを超えた
// - "too_far" / "behind": 非保持時に進入範囲外 (距離 / コーン)
// - "invalid": nowMs が有限でない、state/sample が使えない
export function classifyEnderavert(state, sample, nowMs) {
  try {
    if (!state || typeof state !== "object") return "invalid";
    if (!sample || typeof sample !== "object") return "invalid";
    const now = finiteOrNull(nowMs) !== null ? finiteOrNull(nowMs) : finiteOrNull(sample.nowMs);
    if (now === null) return "invalid";
    const active = state.active === true;
    if (isSuppressed(sample)) return active ? "exit_suppressed" : "suppressed";
    if (sample.hasTarget !== true) {
      // 対象が取れていない: 明示的な喪失 (hasTarget === false) は即退出。
      // hasTarget 自体が欠けている場合は観測欠落として UNKNOWN 扱いにする。
      if (sample.hasTarget === false) return active ? "exit_target_gone" : "exit_target_gone";
      return unknownReason(state, now, active);
    }
    const dist = finiteOrNull(sample.dist);
    const rel = finiteOrNull(sample.relYawDeg);
    if (dist === null || rel === null) return unknownReason(state, now, active);
    const aRel = Math.abs(wrapEnderavertYawDeg(rel));
    if (active) {
      if (dist > ENDERAVERT_EXIT_DIST) return "exit_target_gone";
      if (aRel > ENDERAVERT_EXIT_CONE_DEG) return "exit_cone";
      return "hold";
    }
    if (dist > ENDERAVERT_ENTER_DIST) return "too_far";
    if (aRel > ENDERAVERT_ENTER_CONE_DEG) return "behind";
    const count = (finiteOrNull(state.confirmCount) || 0) + 1;
    return count >= ENDERAVERT_CONFIRM_TICKS ? "enter" : "hold";
  } catch { return "invalid"; }
}

function unknownReason(state, nowMs, active) {
  const last = finiteOrNull(state.lastSeenAtMs);
  if (last === null) return active ? "unknown_hold" : "unknown_expired";
  return nowMs - last <= ENDERAVERT_UNKNOWN_HOLD_MS ? "unknown_hold" : "unknown_expired";
}

// noteEnderavert(state, sample, nowMs) -> { active, entered, exited, reason }
// (REPORT §4.2 の署名。毎 tick 呼んでよい)
// sample: { hasTarget:boolean, dist:number|undefined,
//           relYawDeg:number|undefined,  // 頭の正面から対象への相対ヨー (-180..180)
//           hostileToSelf?, inCombat?, attackingTarget?, falling?, inWater?,
//           swimming?, submerged?, climbing?, dead?, restoring?,
//           otherOverlayActive?, suppressed?, nowMs? }
// - entered はこの呼び出しで保持が始まったときだけ true、exited は
//   この呼び出しで退出が始まったときだけ true (辺の遷移だけを返す)。
// - active は遷移後の保持状態 (戻りの途中で係数 > 0 でも false。
//   表示の有無は sampleEnderavert の active / coef で判定すること)。
// - いずれの場合も state.lastRecord / lastReason へ記録を残す
//   (記録のみ統合への倒し方。REPORT §7-2)。
// - state が無効・nowMs が有限でない場合は例外を投げず
//   { active:false, entered:false, exited:false, reason:"invalid" } を返す。
export function noteEnderavert(state, sample, nowMs) {
  const invalid = { active: false, entered: false, exited: false, reason: "invalid" };
  try {
    if (!state || typeof state !== "object") return { ...invalid };
    if (!sample || typeof sample !== "object") {
      state.lastRecord = { atMs: finiteOrNull(nowMs), fired: false, reason: "invalid" };
      state.lastReason = "invalid";
      return { ...invalid };
    }
    const now = finiteOrNull(nowMs) !== null ? finiteOrNull(nowMs) : finiteOrNull(sample.nowMs);
    if (now === null) {
      state.lastRecord = { atMs: null, fired: false, reason: "invalid" };
      state.lastReason = "invalid";
      return { ...invalid };
    }
    settleExit(state, now);
    const reason = classifyEnderavert(state, sample, now);
    let entered = false, exited = false;

    if (reason === "enter" || reason === "hold" || reason === "too_far" || reason === "behind") {
      // 有効観測 (対象あり・距離と相対ヨーが有限) の経路
      state.lastSeenAtMs = now;
      state.unknownSinceMs = null;
      if (reason === "enter") {
        const rel = wrapEnderavertYawDeg(finiteOrNull(sample.relYawDeg));
        anchorCoef(state, now);
        state.active = true;
        state.exiting = false;
        state.exitStartedAtMs = null;
        state.startedAtMs = now;
        state.confirmCount = 0;
        // 逸らし方向は発火時点で固定する: 対象と反対符号。
        // rel が 0 (真正面) のときは + 側へ倒す (決定的にするため)。
        state.targetYawDeg = (rel > 0 ? -1 : 1) * ENDERAVERT_YAW_MAX_DEG;
        state.firedCount = (Number.isFinite(state.firedCount) ? state.firedCount : 0) + 1;
        entered = true;
      } else if (reason === "hold" && state.active !== true) {
        // 進入の確定待ち: 連続観測を数える (classify と同じ条件を通過済み)
        state.confirmCount = (finiteOrNull(state.confirmCount) || 0) + 1;
      } else if (reason === "too_far" || reason === "behind") {
        state.confirmCount = 0; // 進入条件が途切れたら数え直し
      }
      // reason === "hold" かつ保持中: 方向は固定したまま何もしない
    } else if (reason === "unknown_hold") {
      if (state.unknownSinceMs === null) state.unknownSinceMs = now;
      // 進入も退出もしない。confirmCount も保持する (BRIDGEGAZE と同作法)
    } else if (reason === "unknown_expired") {
      if (state.unknownSinceMs === null) state.unknownSinceMs = now;
      exited = beginExit(state, now);
      state.confirmCount = 0;
    } else if (reason === "exit_target_gone" || reason === "exit_cone"
        || reason === "exit_suppressed") {
      exited = beginExit(state, now);
      state.confirmCount = 0;
      state.unknownSinceMs = null;
      if (sample.hasTarget === true && finiteOrNull(sample.dist) !== null
          && finiteOrNull(sample.relYawDeg) !== null) state.lastSeenAtMs = now;
    } else if (reason === "suppressed") {
      // 抑制中の辺消費: 確認をリセットし、抑制が解けても遅れて発火しない
      state.confirmCount = 0;
      state.unknownSinceMs = null;
    }

    state.coef = coefAt(state, now);
    state.lastRecord = { atMs: now, fired: entered, reason };
    state.lastReason = reason;
    return { active: state.active === true, entered, exited, reason };
  } catch { return { ...invalid }; }
}

// sampleEnderavert(state, nowMs)
//   -> { active, gazeYawOffsetDeg, gazePitchDeg, coef, reason }
// (REPORT §4.2 の署名。統合時の applyGaze 重畳点が毎 tick 呼ぶ想定)
// - gazeYawOffsetDeg は発火時点で固定した targetYawDeg に係数を掛けた
//   符号付き重畳量 (対象と反対側)。保持中に方向は変わらない。
// - gazePitchDeg は ENDERAVERT_PITCH_DEG * coef (下向き正)。
// - active は「表示が効いているか」: 保持中、または戻りの途中で
//   係数 > 0 の間 true。係数が完全な 0 に戻れば全成分 0・active:false。
// - reason は直近の noteEnderavert の理由 (未観測なら "invalid" ではなく
//   初期値として "hold" でも "enter" でもないことを示すため、
//   lastReason が無い場合は "invalid" を返す。契約テストで固定)。
// - 入力異常 (state が空、nowMs が NaN 等) では例外を投げず、
//   全成分 0・有限値だけを返す。
export function sampleEnderavert(state, nowMs) {
  const zero = { active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0, coef: 0, reason: "invalid" };
  try {
    if (!state || typeof state !== "object") return { ...zero };
    const n = finiteOrNull(nowMs);
    if (n === null) return { ...zero };
    settleExit(state, n);
    const coef = coefAt(state, n);
    state.coef = coef;
    if (coef <= 0) {
      return {
        active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0, coef: 0,
        reason: state.lastReason || "invalid",
      };
    }
    const ty = finiteOrNull(state.targetYawDeg);
    if (ty === null) {
      return {
        active: false, gazeYawOffsetDeg: 0, gazePitchDeg: 0, coef: 0,
        reason: state.lastReason || "invalid",
      };
    }
    const yaw = ty * coef;
    const pitch = ENDERAVERT_PITCH_DEG * coef;
    return {
      active: true,
      gazeYawOffsetDeg: yaw === 0 ? 0 : yaw,
      gazePitchDeg: pitch === 0 ? 0 : pitch,
      coef,
      reason: state.lastReason || "invalid",
    };
  } catch { return { ...zero }; }
}

// --- 自己テスト (統合前の契約確認用。REPORT §8 の契約 1〜10 に対応) ---
// runEnderavertSelfTests() -> { pass, fail, failures: string[] }
// 例外を投げない。失敗は failures へ名前だけを積む。直接実行
// (node enderavert_math.js) したときも同じ関数を回して結果を表示し、
// 失敗があれば終了コード 1 を返す。
export function runEnderavertSelfTests() {
  let pass = 0; const failures = [];
  const ok = (c, n) => { if (c) pass++; else failures.push(n); };
  const near = (a, b, eps = 1e-9) => typeof a === "number" && Math.abs(a - b) <= eps;
  try {
    const front = (over = {}) => ({
      hasTarget: true, dist: 10, relYawDeg: 30, ...over,
    });

    // 定数 (REPORT §4.1 の固定値)
    ok(ENDERAVERT_ENTER_DIST === 12.0 && ENDERAVERT_EXIT_DIST === 14.0
      && ENDERAVERT_EXIT_DIST - ENDERAVERT_ENTER_DIST === 2.0, "E-01 dist hysteresis");
    ok(ENDERAVERT_ENTER_CONE_DEG === 50 && ENDERAVERT_EXIT_CONE_DEG === 70
      && ENDERAVERT_CONFIRM_TICKS === 2, "E-02 cone/confirm");
    ok(ENDERAVERT_YAW_MAX_DEG === 26 && ENDERAVERT_PITCH_DEG === 16
      && ENDERAVERT_RISE_MS === 150 && ENDERAVERT_FALL_MS === 400
      && ENDERAVERT_UNKNOWN_HOLD_MS === 750, "E-03 magnitudes/timings");
    ok(Object.isFrozen(ENDERAVERT_CONSTANTS) && ENDERAVERT_CONSTANTS.YAW_MAX_DEG === 26
      && Object.isFrozen(ENDERAVERT_REASONS) && ENDERAVERT_REASONS.length === 11
      && ENDERAVERT_REASONS.includes("enter") && ENDERAVERT_REASONS.includes("invalid"),
      "E-04 constants/reasons frozen");

    // 契約 1: 前方 10・相対ヨー +30 が 2 回連続 → 発火 1 回。
    // ヨー重畳は負符号 (対象と反対側) で |値| <= 26、ピッチ <= +16。
    {
      const st = createEnderavertState();
      const r1 = noteEnderavert(st, front(), 0);
      ok(r1.entered === false && r1.active === false && st.confirmCount === 1, "E-05 c1 first obs pending");
      const r2 = noteEnderavert(st, front(), 50);
      ok(r2.entered === true && r2.active === true && r2.reason === "enter"
        && st.firedCount === 1 && st.targetYawDeg === -26, "E-06 c1 fires once, direction fixed away");
      const peak = sampleEnderavert(st, 200); // 発火 (t=50) + RISE 150 で係数 1
      ok(peak.active === true && peak.coef === 1 && peak.gazeYawOffsetDeg === -26
        && peak.gazePitchDeg === 16, "E-07 c1 peak offsets");
      let bounded = true;
      for (let t = 50; t <= 500; t += 10) {
        const s = sampleEnderavert(st, t);
        if (!(s.gazeYawOffsetDeg <= 0 && Math.abs(s.gazeYawOffsetDeg) <= 26
          && s.gazePitchDeg >= 0 && s.gazePitchDeg <= 16)) bounded = false;
      }
      ok(bounded, "E-08 c1 offsets bounded throughout");
    }

    // 契約 2: 1 回だけ観測して消える揺らぎ → 発火しない
    {
      const st = createEnderavertState();
      noteEnderavert(st, front(), 0);
      const r = noteEnderavert(st, { hasTarget: false }, 50);
      ok(st.firedCount === 0 && st.active === false && r.entered === false
        && sampleEnderavert(st, 100).coef === 0, "E-09 c2 single flicker never fires");
      noteEnderavert(st, front(), 100);
      ok(st.confirmCount === 1 && st.firedCount === 0, "E-10 c2 count restarts after loss");
    }

    // 契約 3: 背後 (|relYaw| 120)・距離 13 → 発火しない (behind / too_far)
    {
      const st = createEnderavertState();
      const rb = noteEnderavert(st, front({ relYawDeg: 120 }), 0);
      noteEnderavert(st, front({ relYawDeg: 120 }), 50);
      ok(st.firedCount === 0 && rb.reason === "behind", "E-11 c3 behind no fire");
      const st2 = createEnderavertState();
      const rf = noteEnderavert(st2, front({ dist: 13 }), 0);
      noteEnderavert(st2, front({ dist: 13 }), 50);
      ok(st2.firedCount === 0 && rf.reason === "too_far", "E-12 c3 too_far no fire");
      // 進入境界は含む: 距離 12.0・|relYaw| 50 は 2 回で発火する
      const st3 = createEnderavertState();
      noteEnderavert(st3, front({ dist: 12.0, relYawDeg: -50 }), 0);
      ok(noteEnderavert(st3, front({ dist: 12.0, relYawDeg: -50 }), 50).entered === true
        && st3.targetYawDeg === 26, "E-13 c3 boundaries inclusive, left target averts right");
    }

    // 契約 4: 保持中に距離 13 (進入上限超・退出上限内) → 保持継続。
    // 15 → 退出し、FALL_MS 後に全成分が完全な 0 へ戻る
    {
      const st = createEnderavertState();
      noteEnderavert(st, front(), 0);
      noteEnderavert(st, front(), 50);
      const rh = noteEnderavert(st, front({ dist: 13 }), 300);
      ok(rh.active === true && rh.reason === "hold" && rh.exited === false, "E-14 c4 hysteresis holds at 13");
      const rx = noteEnderavert(st, front({ dist: 15 }), 400);
      ok(rx.exited === true && rx.active === false && rx.reason === "exit_target_gone", "E-15 c4 exits at 15");
      const mid = sampleEnderavert(st, 600); // 退出開始 +200: 係数 0.5
      ok(mid.active === true && near(mid.coef, 0.5) && near(mid.gazePitchDeg, 8), "E-16 c4 fall midpoint");
      const end = sampleEnderavert(st, 800); // 退出開始 +400 = FALL_MS
      ok(end.active === false && end.coef === 0 && end.gazeYawOffsetDeg === 0
        && end.gazePitchDeg === 0 && st.targetYawDeg === null, "E-17 c4 exact zero after FALL_MS");
      // コーン側の退出: 保持中に |relYaw| 75 (>70) → exit_cone
      const st2 = createEnderavertState();
      noteEnderavert(st2, front(), 0);
      noteEnderavert(st2, front(), 50);
      ok(noteEnderavert(st2, front({ relYawDeg: 60 }), 100).active === true, "E-18 c4 cone hysteresis holds at 60");
      ok(noteEnderavert(st2, front({ relYawDeg: 75 }), 150).reason === "exit_cone", "E-19 c4 exit_cone at 75");
    }

    // 契約 5: 保持中に対象が戦闘化 (hostileToSelf) → 退出し、
    // 戦闘が終わっても遅れて再発火しない (再発火には新規の 2 回確認が要る)
    {
      const st = createEnderavertState();
      noteEnderavert(st, front(), 0);
      noteEnderavert(st, front(), 50);
      const rx = noteEnderavert(st, front({ hostileToSelf: true }), 300);
      ok(rx.exited === true && rx.reason === "exit_suppressed" && st.active === false, "E-20 c5 combat exits");
      const after = noteEnderavert(st, front(), 1000);
      ok(after.entered === false && st.firedCount === 1 && st.confirmCount === 1, "E-21 c5 no delayed refire");
      ok(noteEnderavert(st, front(), 1050).entered === true && st.firedCount === 2, "E-22 c5 fresh confirm refires");
    }

    // 契約 6: 抑制中 (落下中) に進入条件を満たす → 発火せず、
    // 抑制解除後も遅れて発火しない
    {
      const st = createEnderavertState();
      const rs = noteEnderavert(st, front({ falling: true }), 0);
      noteEnderavert(st, front({ falling: true }), 50);
      ok(st.firedCount === 0 && rs.reason === "suppressed" && st.confirmCount === 0, "E-23 c6 suppressed no fire");
      const after = noteEnderavert(st, front(), 100);
      ok(after.entered === false && st.confirmCount === 1, "E-24 c6 no delayed fire after lift");
      // 抑制は ===true のときだけ (truthy な 1 では倒さない)
      const st2 = createEnderavertState();
      noteEnderavert(st2, front({ falling: 1, inCombat: "yes" }), 0);
      ok(noteEnderavert(st2, front({ falling: 1 }), 50).entered === true, "E-25 c6 suppression strict-true only");
      for (const key of ["hostileToSelf", "inCombat", "attackingTarget", "inWater",
        "swimming", "submerged", "climbing", "dead", "restoring", "otherOverlayActive"]) {
        const s3 = createEnderavertState();
        ok(noteEnderavert(s3, front({ [key]: true }), 0).reason === "suppressed", `E-26 c6 suppress ${key}`);
      }
    }

    // 契約 7: 観測欠落 (dist undefined) が 750ms 以内 → 状態保持。超過 → 退出
    {
      const st = createEnderavertState();
      noteEnderavert(st, front(), 0);
      noteEnderavert(st, front(), 50); // 発火。lastSeen = 50
      const rh = noteEnderavert(st, { hasTarget: true, dist: undefined, relYawDeg: undefined }, 800);
      ok(rh.active === true && rh.reason === "unknown_hold" && rh.exited === false, "E-27 c7 unknown within 750 holds");
      const rx = noteEnderavert(st, { hasTarget: true, dist: undefined, relYawDeg: undefined }, 801);
      ok(rx.exited === true && rx.reason === "unknown_expired", "E-28 c7 unknown past 750 exits");
      // 非保持時の欠落は進入も退出もしない (カウント保持)
      const st2 = createEnderavertState();
      noteEnderavert(st2, front(), 0);
      const ru = noteEnderavert(st2, { hasTarget: true }, 50);
      ok(ru.entered === false && st2.confirmCount === 1, "E-29 c7 unknown keeps confirm count");
    }

    // 契約 8: 対象が左右へ入れ替わる (relYaw の符号反転) → 保持中は
    // 逸らし方向を固定したまま追い直さない。退出→再進入で初めて新しい方向
    {
      const st = createEnderavertState();
      noteEnderavert(st, front({ relYawDeg: 30 }), 0);
      noteEnderavert(st, front({ relYawDeg: 30 }), 50);
      noteEnderavert(st, front({ relYawDeg: -30 }), 300);
      const s = sampleEnderavert(st, 300);
      ok(st.targetYawDeg === -26 && s.gazeYawOffsetDeg === -26, "E-30 c8 direction fixed during hold");
      noteEnderavert(st, { hasTarget: false }, 400);
      sampleEnderavert(st, 900); // 戻り完了で方向解放
      noteEnderavert(st, front({ relYawDeg: -30 }), 1000);
      const re = noteEnderavert(st, front({ relYawDeg: -30 }), 1050);
      ok(re.entered === true && st.targetYawDeg === 26, "E-31 c8 re-entry takes new direction");
    }

    // 契約 9: 入力異常 (nowMs が NaN、sample が空、state が空) →
    // 例外を投げず、返す数値はすべて有限
    {
      let allSafe = true;
      for (const badState of [null, undefined, "x"]) {
        const r = noteEnderavert(badState, front(), 0);
        const s = sampleEnderavert(badState, 0);
        if (r.reason !== "invalid" || s.reason !== "invalid"
          || !Number.isFinite(s.gazeYawOffsetDeg) || !Number.isFinite(s.gazePitchDeg)
          || !Number.isFinite(s.coef)) allSafe = false;
      }
      // 空オブジェクトの state は先行核と同様に「使える状態」として扱い、
      // 例外なく有限値だけを返す (発火はしない: 確認 1 回目で止まる)
      const emptyState = {};
      const re = noteEnderavert(emptyState, front(), 0);
      const se = sampleEnderavert(emptyState, 0);
      if (re.entered !== false || !Number.isFinite(se.coef)) allSafe = false;
      ok(allSafe, "E-32 c9 bad state safe");
      const st = createEnderavertState();
      ok(noteEnderavert(st, front(), NaN).reason === "invalid"
        && noteEnderavert(st, null, 0).reason === "invalid"
        && noteEnderavert(st, {}, 0).reason !== "enter"
        && sampleEnderavert(st, NaN).coef === 0
        && st.firedCount === 0, "E-33 c9 bad sample/now safe, no fire");
      ok(classifyEnderavert(null, null, NaN) === "invalid"
        && enderavertCoefAt(null, 0) === 0 && isEnderavertActive(null, 0) === false,
        "E-34 c9 helpers safe");
    }

    // 契約 10: 係数は単調な入り/戻りで、どの tick でも 0..1 の範囲を出ない
    {
      const st = createEnderavertState();
      noteEnderavert(st, front(), 0);
      noteEnderavert(st, front(), 50);
      let mono = true, prev = -1, inRange = true;
      for (let t = 50; t <= 200; t += 5) {
        const c = sampleEnderavert(st, t).coef;
        if (c < prev - 1e-12) mono = false;
        if (!(c >= 0 && c <= 1)) inRange = false;
        prev = c;
      }
      ok(mono && inRange && prev === 1, "E-35 c10 rise monotonic within 0..1");
      noteEnderavert(st, { hasTarget: false }, 200);
      mono = true; prev = 2;
      for (let t = 200; t <= 700; t += 5) {
        const c = sampleEnderavert(st, t).coef;
        if (c > prev + 1e-12) mono = false;
        if (!(c >= 0 && c <= 1)) inRange = false;
        prev = c;
      }
      ok(mono && inRange && prev === 0, "E-36 c10 fall monotonic to exact 0");
      // 戻りの途中からの再進入でも係数は跳ねない (単調・範囲内)
      const st2 = createEnderavertState();
      noteEnderavert(st2, front(), 0);
      noteEnderavert(st2, front(), 50);
      noteEnderavert(st2, { hasTarget: false }, 200);
      noteEnderavert(st2, front(), 300);
      const beforeRe = sampleEnderavert(st2, 350).coef; // 再進入確定の瞬間の係数
      const re = noteEnderavert(st2, front(), 350);
      const afterRe = sampleEnderavert(st2, 350).coef;
      ok(re.entered === true && near(afterRe, beforeRe) && afterRe <= 1
        && sampleEnderavert(st2, 500).coef === 1,
        "E-37 c10 re-entry resumes from current coef");
    }

    // 決定的 / reset / wrap
    {
      const run = () => {
        const st = createEnderavertState(); const out = [];
        const seq = [[0, front()], [50, front()], [300, front({ dist: 13 })],
          [400, front({ dist: 15 })], [1000, front()]];
        for (const [t, s] of seq) out.push(noteEnderavert(st, s, t).reason);
        return out.join(",");
      };
      ok(run() === run() && run() === "hold,enter,hold,exit_target_gone,hold", "E-38 deterministic sequence");
      const st = createEnderavertState();
      noteEnderavert(st, front(), 0);
      noteEnderavert(st, front(), 50);
      resetEnderavertState(st);
      ok(st.active === false && st.coef === 0 && st.targetYawDeg === null
        && st.firedCount === 0 && st.lastRecord === null, "E-39 reset");
      ok(wrapEnderavertYawDeg(190) === -170 && wrapEnderavertYawDeg(-180) === 180
        && wrapEnderavertYawDeg(30) === 30, "E-40 wrap helper");
    }
  } catch (e) {
    failures.push("E-XX self-test threw: " + (e && e.message ? e.message : String(e)));
  }
  return { pass, fail: failures.length, failures };
}

// 直接実行時のみ自己テストを回す (import 時は副作用なし)。
try {
  const isMain = typeof process !== "undefined" && Array.isArray(process.argv)
    && typeof process.argv[1] === "string" && import.meta.url.endsWith(process.argv[1].split("/").pop());
  if (isMain) {
    const r = runEnderavertSelfTests();
    console.log(`enderavert_math_draft: ${r.pass} passed, ${r.fail} failed`);
    for (const f of r.failures) console.log("FAIL", f);
    if (typeof process !== "undefined") process.exitCode = r.fail ? 1 : 0;
  }
} catch { /* 自己テストの表示失敗は本体の契約に影響させない */ }
