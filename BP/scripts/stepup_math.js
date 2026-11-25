// stepup_math_draft.mjs — 1マス段差を上る瞬間の小さな膝上げ＋前傾＋視線
// POLISH-ANIM-STEPUP-01 (純粋核ドラフト, cycle1603-a03・作り込みトラック)
// 出典 (仕様の正): brain_parts/solutions/cycle1543-a16/POLISH_BACKLOG.md §3
//   「POLISH-ANIM-STEPUP-01 — 1マス段差を上る瞬間の小さな膝上げと前傾」
// 台帳: brain_parts/solutions/polish-backlog/BACKLOG.md
//   「POLISH-ANIM-STEPUP-01 1マス段差を上る瞬間の小さな膝上げ＋前傾
//     (新規発案, cycle1543-a16) … 未統合・候補。」
//
// 純粋モジュール: @minecraft/server を import しない。相対 import も持たない
// (ドラフト置き場から単体で node 実行できること。統合時に BP/scripts/
// stepup_math.js へ移す際、ピッチクランプ定数を gaze_math.js の
// GAZE_PITCH_MIN/MAX へ寄せてよいが本ドラフトは自己完結とする。
// heed_math.js / icebalance_math_draft.mjs の自己完結ドラフトと同作法)。
// 例外を投げない。現在時刻・エンティティ参照を持たない (時刻は引数で受ける)。
// 決定的: 乱数・Date.now・環境依存を持たない。同じ入力は常に同じ出力。
// 表示層のみ: 移動目標・速度・経路・段差の可否判定・ジャンプ/飛行の判断、
// 掘削ゲート、作業・戦闘・回収・納品の判定には一切触らない。戻り値を
// 表示 (applyGaze 重畳 + 体の前傾/膝上げの RP 受け口 + r.lastStepup 記録)
// 以外へ流さないことが統合条件。
// 音は含めない (段差を上った先の足音は POLISH-SND-STEP-01 の管轄)。
// 新規ボーン・スキン/ジオメトリ変更は不要。膝上げ (legLiftDeg) は純粋核が
// 値を返すところまでを正とし、RP 受け口が無ければ統合側は前傾＋視線のみ、
// それも難しければ r.lastStepup への記録のみへ倒す (仕様の正 §3 最小形)。
//
// 仕様 (cycle1543-a16/POLISH_BACKLOG.md §3 の固定値案):
// - 成分: 先行脚の膝上げ相当 22 度 / 体の前傾 5 度 / 視線ピッチ +4 度まで。
// - 軌道は全成分で共通の単一山形: 入り 90ms → 保持なし → 戻り 190ms、
//   合計 280ms。終了後は全成分が完全な 0 へ戻る (出口がある)。
// - 発火は「地上歩行中に足元 Y がちょうど +1 上がった辺」でのみ。
//   平地 (ΔY=0)・下降 (ΔY<0)・+2 以上の上昇 (テレポート/ホバー段差/
//   ジャンプ着地の段差など歩行の段差越えではないもの) では発火しない。
// - 冷却 600ms。階段の連続段は「前回の動作が終わってからの次の辺」でのみ
//   再発火させる: 冷却中・動作中に来た辺も消費し、遅れて発火しない
//   (段ごとに体が跳ね続ける人形化を防ぐ。icebalance の辺消費と同作法)。
// - 抑制: 登攀中 (CLIMB 管轄) / ホバー飛行・落下中 / 水中 / 掘削・攻撃・
//   設置の作業中 / FLINCH 発火中 / 潜行・螺旋階段・坑道の意図的な縦移動中 /
//   ジャンプによる上昇中 (歩行の段差越えと区別できない場合は発火しない
//   側へ倒す) / 他の視線重畳が再生中 (ピッチは最下位重畳のため
//   heed/icebalance と同規則)。
// - 辺の消費の担い手: 本核は noteStepup が毎 tick 呼ばれ、前回足元 Y を
//   結果に関わらず進める前提である。発火しなかった辺 (抑制・冷却・
//   非 +1) を呼び出し側が保持して再提示しない限り、遅れ発火は
//   構造的に起きない。

export const STEPUP_LEG_DEG = 22;          // 先行脚の膝上げ相当 (仕様の正 §3)
export const STEPUP_BODY_PITCH_DEG = 5;    // 体の前傾 (仕様の正 §3)
export const STEPUP_GAZE_PITCH_DEG = 4;    // 視線ピッチ補助 (仕様の正 §3)
export const STEPUP_DURATION_MS = 280;     // 合計 0.28 秒 (仕様の正 §3)
export const STEPUP_RAMP_IN_MS = 90;       // 入り 0.09 秒 (仕様の正 §3)
export const STEPUP_RAMP_OUT_MS = 190;     // 戻り 0.19 秒 (保持なし)
export const STEPUP_COOLDOWN_MS = 600;     // 冷却 0.6 秒 (仕様の正 §3)
export const STEPUP_DELTA_Y = 1;           // 発火する足元 Y の上昇量 (ちょうど +1)

// 足元 Y の差分を「段差の段数」として読むときの許容誤差。足元 Y は統合側が
// セル単位 (整数) で渡すのが正だが、浮動小数の座標をそのまま渡されても
// 0.9999999 のような表現誤差で +1 の辺を取りこぼさないための丸め幅。
// 0.25 を超えるずれは段差として読まない (半端な斜面・落下の途中経過を
// 段差越えと誤読しない側へ倒す)。
export const STEPUP_DELTA_EPS = 0.25;

export const STEPUP_CONSTANTS = Object.freeze({
  LEG_DEG: STEPUP_LEG_DEG,
  BODY_PITCH_DEG: STEPUP_BODY_PITCH_DEG,
  GAZE_PITCH_DEG: STEPUP_GAZE_PITCH_DEG,
  DURATION_MS: STEPUP_DURATION_MS,
  RAMP_IN_MS: STEPUP_RAMP_IN_MS,
  RAMP_OUT_MS: STEPUP_RAMP_OUT_MS,
  COOLDOWN_MS: STEPUP_COOLDOWN_MS,
  DELTA_Y: STEPUP_DELTA_Y,
  DELTA_EPS: STEPUP_DELTA_EPS,
});

// gaze_math.js のクランプと同値 (自己完結のため本モジュール内に持つ。
// 統合時は gaze_math の GAZE_PITCH_MIN/MAX へ寄せてよい。heed と同方式)。
const PITCH_MIN_DEG = -60;
const PITCH_MAX_DEG = 75;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// normalizeStepupDeltaY(deltaY) -> 整数段数 | null
// 差分を最も近い整数へ丸め、丸め誤差が EPS 以内のときだけその整数を返す。
// 例: 1 -> 1、0.9999999 -> 1、0.5 -> null (段差として読まない)、
// -1 -> -1 (下降。発火判定側で弾く)、NaN/非数 -> null。
export function normalizeStepupDeltaY(deltaY) {
  try {
    const d = finiteOrNull(deltaY);
    if (d === null) return null;
    const r = Math.round(d);
    if (Math.abs(d - r) > STEPUP_DELTA_EPS) return null;
    return r === 0 ? 0 : r; // -0 を 0 へ寄せる
  } catch { return null; }
}

// isStepupDelta(deltaY) -> boolean: ちょうど +1 の上昇辺かどうか
export function isStepupDelta(deltaY) {
  try { return normalizeStepupDeltaY(deltaY) === STEPUP_DELTA_Y; } catch { return false; }
}

// stepupEnvelope(elapsedMs) -> 0..1 の包絡 | 範囲外・無効入力は 0
// 波形: 0〜90ms は sin で寄せ (0→1)、保持なし、90〜280ms は cos で
// 復帰 (1→0)。t=0 と t>=280 は厳密に 0 (出口がある)。全成分で共有する。
export function stepupEnvelope(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= STEPUP_DURATION_MS) return 0;
    if (e < STEPUP_RAMP_IN_MS) return Math.sin((e / STEPUP_RAMP_IN_MS) * Math.PI / 2);
    const t = (e - STEPUP_RAMP_IN_MS) / STEPUP_RAMP_OUT_MS;
    const v = Math.cos(t * Math.PI / 2);
    return v === 0 ? 0 : v;
  } catch { return 0; }
}

// stepupOffsets(elapsedMs)
//   -> { active, legLiftDeg, bodyPitchDeg, gazePitchDeg }
// 仕様の正 §3 の出力形そのもの。非活動時は全成分が完全な 0。
// legLiftDeg は先行脚の膝上げ相当 (22 度 × 包絡、RP 受け口向け)、
// bodyPitchDeg は体の前傾 (5 度 × 包絡)、gazePitchDeg は視線ピッチ
// (+4 度 × 包絡、下向き正。視線の主制御は奪わない)。
export function stepupOffsets(elapsedMs) {
  try {
    const zero = { active: false, legLiftDeg: 0, bodyPitchDeg: 0, gazePitchDeg: 0 };
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= STEPUP_DURATION_MS) return { ...zero };
    const k = stepupEnvelope(e);
    if (k === 0) return { ...zero };
    return {
      active: true,
      legLiftDeg: STEPUP_LEG_DEG * k,
      bodyPitchDeg: STEPUP_BODY_PITCH_DEG * k,
      gazePitchDeg: STEPUP_GAZE_PITCH_DEG * k,
    };
  } catch { return { active: false, legLiftDeg: 0, bodyPitchDeg: 0, gazePitchDeg: 0 }; }
}

// stepupOffsetsAt(startedAtMs, nowMs) -> stepupOffsets と同形
export function stepupOffsetsAt(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return { active: false, legLiftDeg: 0, bodyPitchDeg: 0, gazePitchDeg: 0 };
    return stepupOffsets(n - s);
  } catch { return { active: false, legLiftDeg: 0, bodyPitchDeg: 0, gazePitchDeg: 0 }; }
}

// applyStepupPitch(basePitchDeg, elapsedMs) -> クランプ済みピッチ
// 視線ピッチ成分だけを applyGaze 重畳へ足すための形。base 非有限時は
// base をそのまま返す (heed/dryoff の apply* と同規則)。
export function applyStepupPitch(basePitchDeg, elapsedMs) {
  try {
    if (!Number.isFinite(basePitchDeg)) return basePitchDeg;
    const off = stepupOffsets(elapsedMs).gazePitchDeg;
    return Math.max(PITCH_MIN_DEG, Math.min(PITCH_MAX_DEG, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

// applyStepupBodyPitch(basePitchDeg, elapsedMs) -> クランプ済みピッチ
// 体の前傾成分を体のピッチへ足すための形 (RP 受け口がある統合向け)。
// クランプは視線と同値域を使う (前傾 5 度は十分に内側)。
export function applyStepupBodyPitch(basePitchDeg, elapsedMs) {
  try {
    if (!Number.isFinite(basePitchDeg)) return basePitchDeg;
    const off = stepupOffsets(elapsedMs).bodyPitchDeg;
    return Math.max(PITCH_MIN_DEG, Math.min(PITCH_MAX_DEG, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

// isStepupActive(startedAtMs, nowMs) -> boolean
// 0 <= nowMs - startedAtMs < 280 のときだけ true。時計巻き戻しは false。
export function isStepupActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    const e = n - s;
    return e >= 0 && e < STEPUP_DURATION_MS;
  } catch { return false; }
}

// stepupDue(lastFiredMs, nowMs) -> boolean: クールダウン判定 (600ms)
// 初回 (lastFiredMs が非有限) は true。nowMs 非有限は false。
// 境界: 前回 +599ms は false、+600ms は true。冷却 600ms は動作時間
// 280ms より長いため、この判定だけで「動作中の再発火なし」も担保する。
export function stepupDue(lastFiredMs, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    const last = finiteOrNull(lastFiredMs);
    if (last === null) return true;
    return n - last >= STEPUP_COOLDOWN_MS;
  } catch { return false; }
}

function isSuppressed(input) {
  // いずれも ===true のときだけ抑制として扱う (truthy な 1 等では倒さない。
  // heed/icebalance と同規則)。
  if (!input || typeof input !== "object") return false;
  if (input.suppressed === true) return true;
  if (input.inCombat === true || input.combat === true || input.danger === true) return true;
  if (input.working === true || input.digging === true || input.attacking === true
      || input.placing === true || input.hasWorkTarget === true) return true;
  if (input.flinchActive === true) return true;
  if (input.falling === true || input.selfFalling === true) return true;
  if (input.inWater === true || input.climbing === true) return true;
  if (input.flying === true || input.hovering === true) return true;
  // ジャンプによる上昇は歩行の段差越えと区別がつかないため抑制側へ倒す。
  // 縦速度が明示され、正の大きな値ならジャンプ上昇とみなす別名も受理する。
  if (input.jumping === true || input.jumpRising === true || input.airborne === true) return true;
  // 意図的な縦移動 (潜行・螺旋階段・坑道) は地上歩行の段差越えではない。
  if (input.intentionalDescent === true || input.descending === true
      || input.spiralDescent === true || input.tunnelDescent === true) return true;
  // ピッチは既存重畳チェーンの最下位へ足すため、他重畳の再生中は発火しない。
  if (input.otherOverlayActive === true) return true;
  return false;
}

function isGroundedWalk(input) {
  // 地上歩行中: grounded が明示されたら ===true を必須とする。
  // 未指定の場合は flying/hovering/falling 等の抑制側で判定する
  // (icebalance/isGroundedWalk と同規則・後方互換)。
  if (input.grounded !== undefined) return input.grounded === true;
  if (input.onGround !== undefined) return input.onGround === true;
  return true;
}

// classifyStepupTrigger(input) -> { kind, deltaY } | { kind: null, deltaY: null }
// 辺の種別だけを決める純粋判定 (状態を書き換えない)。input は
// 「辺が既に導出済み」の形を取る:
// {
//   deltaY, stepDeltaY,   // 足元 Y の差分 (deltaY 優先)。整数化して読む
//   prevFootY, footY,     // 差分が無い場合はこちらから導出する
//                         // (別名 prevGroundY/groundY, prevY/y も受理)
// }
// ちょうど +1 のときだけ { kind: "stepup", deltaY: 1 }。それ以外
// (平地・下降・+2 以上・半端な差分・無効入力) は kind: null。
export function classifyStepupTrigger(input) {
  try {
    const none = { kind: null, deltaY: null };
    if (!input || typeof input !== "object") return { ...none };
    let raw = finiteOrNull(input.deltaY) !== null ? finiteOrNull(input.deltaY)
      : finiteOrNull(input.stepDeltaY);
    if (raw === null) {
      const prev = finiteOrNull(input.prevFootY) !== null ? finiteOrNull(input.prevFootY)
        : finiteOrNull(input.prevGroundY) !== null ? finiteOrNull(input.prevGroundY)
        : finiteOrNull(input.prevY);
      const cur = finiteOrNull(input.footY) !== null ? finiteOrNull(input.footY)
        : finiteOrNull(input.groundY) !== null ? finiteOrNull(input.groundY)
        : finiteOrNull(input.y);
      if (prev === null || cur === null) return { ...none };
      raw = cur - prev;
    }
    const d = normalizeStepupDeltaY(raw);
    if (d === null) return { ...none };
    if (d !== STEPUP_DELTA_Y) return { kind: null, deltaY: d };
    return { kind: "stepup", deltaY: d };
  } catch { return { kind: null, deltaY: null }; }
}

// shouldStepup(input) -> boolean: 発火可否の純粋判定 (状態を書き換えない)
// input は classifyStepupTrigger と同じ「辺が導出済み」の形 + 抑制・冷却:
// {
//   deltaY, stepDeltaY, prevFootY, footY, prevGroundY, groundY, prevY, y,
//   grounded, onGround,                       // 地上歩行 (明示時は ===true 必須)
//   suppressed, inCombat, combat, danger, working, digging, attacking,
//   placing, hasWorkTarget, flinchActive, falling, selfFalling, inWater,
//   climbing, flying, hovering, jumping, jumpRising, airborne,
//   intentionalDescent, descending, spiralDescent, tunnelDescent,
//   otherOverlayActive,                       // 抑制群 (===true のみ)
//   lastFiredMs, lastFiredAtMs, nowMs,        // クールダウン用
// }
// 成立条件: (1) ちょうど +1 の上昇辺 (2) 地上歩行中で抑制に触れない
// (3) クールダウン明け。いずれも欠ければ false。
export function shouldStepup(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (classifyStepupTrigger(input).kind === null) return false;
    if (!isGroundedWalk(input)) return false;
    if (isSuppressed(input)) return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;
    const last = input.lastFiredMs !== undefined ? input.lastFiredMs : input.lastFiredAtMs;
    return stepupDue(last, input.nowMs);
  } catch { return false; }
}

// --- 状態の薄いラッパ (揮発メモリのみ。永続化は作らない) ---
// state:
// {
//   prevFootY,        // 前 tick の足元 Y (+1 の辺の導出用)
//   startedAtMs,      // 発火時刻 (sample 用)
//   deltaY,           // 発火時に固定した段数 (常に 1)
//   trigger,          // 発火時に固定した種別 ("stepup" | null)
//   lastFiredMs,      // クールダウン用
//   firedCount,
// }
export function createStepupState() {
  return {
    prevFootY: null,
    startedAtMs: null, deltaY: null, trigger: null,
    lastFiredMs: null, firedCount: 0,
  };
}

export function resetStepupState(state) {
  try {
    if (!state || typeof state !== "object") return state;
    state.prevFootY = null;
    state.startedAtMs = null;
    state.deltaY = null;
    state.trigger = null;
    state.lastFiredMs = null;
    state.firedCount = 0;
    return state;
  } catch { return state; }
}

// noteStepup(state, input) -> boolean (発火を記録したら true)
// 移動ループが毎 tick 呼ぶ想定の状態ful な入口。input:
// {
//   footY, groundY, y,        // 今 tick の足元 Y (footY 優先)
//   deltaY, stepDeltaY,       // 呼び出し側が辺を導出済みならこちらを優先
//   grounded, ...抑制群, nowMs,
// }
// 振る舞い:
// - 前回足元 Y は結果に関わらず毎回進める (辺の消費)。抑制中・冷却中・
//   非 +1 の辺も消費され、遅れて発火しない。
// - 足元 Y が非有限の tick は prevFootY を壊さず、その tick は辺に
//   ならない (次に有効な Y が来た tick で差分を測り直す)。
// - deltaY 供給時も、footY が有効なら次回の導出用に prevFootY を進める。
// - 発火したときだけ startedAtMs / deltaY / trigger / lastFiredMs を
//   記録する。不発の辺では lastFiredMs を進めない (クールダウンは
//   発火起点でのみ数える。heed/noteHeed と同規則)。
// - 連続段 (例: 辺 3 回・間隔 150ms) では、冷却 600ms のため発火は
//   最初の 1 回だけになり、動作完了後かつ冷却明けの辺で次が発火する
//   (仕様の正 §3 契約テスト案 (3))。
export function noteStepup(state, input) {
  try {
    if (!state || typeof state !== "object") return false;
    if (!input || typeof input !== "object") return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;

    // --- +1 の辺の導出 (prevFootY は結果に関わらず進める) ---
    const cur = finiteOrNull(input.footY) !== null ? finiteOrNull(input.footY)
      : finiteOrNull(input.groundY) !== null ? finiteOrNull(input.groundY)
      : finiteOrNull(input.y);
    let deltaY = finiteOrNull(input.deltaY) !== null ? finiteOrNull(input.deltaY)
      : finiteOrNull(input.stepDeltaY);
    if (deltaY === null && cur !== null) {
      const prev = finiteOrNull(state.prevFootY);
      if (prev !== null) deltaY = cur - prev;
    }
    if (cur !== null) state.prevFootY = cur;

    // --- 発火判定 (純粋層へ委譲) ---
    const cls = classifyStepupTrigger({ deltaY });
    const ok = shouldStepup({
      ...input,
      deltaY,
      lastFiredMs: state.lastFiredMs,
      nowMs: now,
    });
    if (!ok) return false;
    state.startedAtMs = now;
    state.deltaY = cls.deltaY;
    state.trigger = cls.kind;
    state.lastFiredMs = now;
    state.firedCount = (Number.isFinite(state.firedCount) ? state.firedCount : 0) + 1;
    return true;
  } catch { return false; }
}

// sampleStepup(state, nowMs)
//   -> { active, legLiftDeg, bodyPitchDeg, gazePitchDeg, trigger, deltaY }
// 統合時の applyGaze 重畳点 (最下位) が毎 tick 呼ぶ想定のサンプリング。
// deltaY / trigger は発火時点の値を保持する (毎 tick 取り直すと波形の
// 目標が動き続け「完全な 0 へ戻る」契約が崩れるため。heed と同規則)。
// 膝上げ (legLiftDeg) と体の前傾 (bodyPitchDeg) は RP 受け口が無い
// 統合では呼び出し側が r.lastStepup への記録だけに使い、視線ピッチ
// だけを applyGaze へ流してよい。
export function sampleStepup(state, nowMs) {
  try {
    const zero = { active: false, legLiftDeg: 0, bodyPitchDeg: 0, gazePitchDeg: 0, trigger: null, deltaY: null };
    if (!state || typeof state !== "object") return { ...zero };
    const s = finiteOrNull(state.startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return { ...zero };
    const off = stepupOffsets(n - s);
    if (!off.active) return { ...zero };
    return { ...off, trigger: state.trigger ?? null, deltaY: state.deltaY ?? null };
  } catch {
    return { active: false, legLiftDeg: 0, bodyPitchDeg: 0, gazePitchDeg: 0, trigger: null, deltaY: null };
  }
}

// isStepupActiveState(state, nowMs) -> boolean (状態形の active 判定)
export function isStepupActiveState(state, nowMs) {
  try { return sampleStepup(state, nowMs).active; } catch { return false; }
}

// --- 自己テスト (統合前の契約確認用。仕様の正 §3 契約テスト案 (1)〜(5)) ---
// runStepupSelfTests() -> { pass, fail, failures: string[] }
// 例外を投げない。失敗は failures へ名前だけを積む。直接実行
// (node stepup_math_draft.mjs) したときも同じ関数を回して結果を表示し、
// 失敗があれば終了コード 1 を返す。
export function runStepupSelfTests() {
  let pass = 0; const failures = [];
  const ok = (c, n) => { if (c) pass++; else failures.push(n); };
  const near = (a, b, eps = 1e-9) => typeof a === "number" && Math.abs(a - b) <= eps;
  try {
    // 定数 (仕様の正 §3 の固定値案)
    ok(STEPUP_DURATION_MS === 280 && STEPUP_RAMP_IN_MS === 90 && STEPUP_RAMP_OUT_MS === 190, "S-01 timing");
    ok(STEPUP_LEG_DEG === 22 && STEPUP_BODY_PITCH_DEG === 5 && STEPUP_GAZE_PITCH_DEG === 4, "S-02 amplitudes");
    ok(STEPUP_COOLDOWN_MS === 600 && STEPUP_DELTA_Y === 1, "S-03 cooldown/delta");
    ok(Object.isFrozen(STEPUP_CONSTANTS) && STEPUP_CONSTANTS.DURATION_MS === 280, "S-04 constants frozen");

    // 差分の整数化
    ok(normalizeStepupDeltaY(1) === 1 && normalizeStepupDeltaY(0) === 0 && normalizeStepupDeltaY(-1) === -1, "S-05 normalize ints");
    ok(normalizeStepupDeltaY(0.9999999) === 1 && normalizeStepupDeltaY(2) === 2, "S-06 normalize near/plus2");
    ok(normalizeStepupDeltaY(0.5) === null && normalizeStepupDeltaY(NaN) === null && normalizeStepupDeltaY("1") === null, "S-07 normalize invalid");
    ok(isStepupDelta(1) === true && isStepupDelta(0) === false && isStepupDelta(-1) === false && isStepupDelta(2) === false, "S-08 isStepupDelta");

    // 波形: 単一山形・出口で完全な 0 (契約 (1))
    ok(stepupEnvelope(0) === 0 && stepupEnvelope(280) === 0 && stepupEnvelope(-1) === 0 && stepupEnvelope(NaN) === 0, "S-09 envelope edges");
    ok(near(stepupEnvelope(45), Math.SQRT1_2, 1e-6), "S-10 ramp-in midpoint sin");
    ok(stepupEnvelope(90) === 1, "S-11 peak at 90ms");
    ok(near(stepupEnvelope(185), Math.SQRT1_2, 1e-6) && stepupEnvelope(279) > 0 && stepupEnvelope(279) < 0.05, "S-12 ramp-out");
    {
      let monoIn = true, prev = 0, bounded = true;
      for (let t = 0; t < 90; t += 5) { const k = stepupEnvelope(t); if (k < prev - 1e-12) monoIn = false; prev = k; }
      for (let t = 0; t <= 280; t += 7) { const k = stepupEnvelope(t); if (!(k >= 0 && k <= 1)) bounded = false; }
      ok(monoIn && bounded, "S-13 envelope monotone-in / bounded");
    }

    // オフセット: ピークで全成分が定数どおり、終了後は完全な 0 (契約 (1))
    {
      const o = stepupOffsets(90);
      ok(o.active === true && o.legLiftDeg === 22 && o.bodyPitchDeg === 5 && o.gazePitchDeg === 4, "S-14 peak offsets");
      const end = stepupOffsets(280);
      ok(end.active === false && end.legLiftDeg === 0 && end.bodyPitchDeg === 0 && end.gazePitchDeg === 0, "S-15 exit is exact zero");
      let boundsOk = true;
      for (let t = 0; t <= 280; t += 7) {
        const s = stepupOffsets(t);
        if (s.legLiftDeg < 0 || s.legLiftDeg > 22 || s.bodyPitchDeg < 0 || s.bodyPitchDeg > 5 || s.gazePitchDeg < 0 || s.gazePitchDeg > 4) boundsOk = false;
      }
      ok(boundsOk, "S-16 bounds over full waveform");
      ok(stepupOffsets(NaN).active === false && stepupOffsets("x").active === false, "S-17 invalid elapsed inactive");
    }
    ok(stepupOffsetsAt(1000, 1090).legLiftDeg === 22 && stepupOffsetsAt(1000, 1280).active === false, "S-18 offsetsAt");
    ok(applyStepupPitch(74, 90) === 75 && applyStepupPitch(0, 999) === 0 && Number.isNaN(applyStepupPitch(NaN, 90)), "S-19 apply gaze pitch clamp/passthrough");
    ok(applyStepupBodyPitch(10, 90) === 15 && applyStepupBodyPitch(-70, 90) === -60, "S-20 apply body pitch clamp");

    // active / due
    ok(isStepupActive(1000, 1000) === true && isStepupActive(1000, 1279) === true && isStepupActive(1000, 1280) === false && isStepupActive(1000, 999) === false, "S-21 active window");
    ok(stepupDue(null, 0) === true && stepupDue(1000, 1599) === false && stepupDue(1000, 1600) === true && stepupDue(1000, NaN) === false, "S-22 cooldown boundary");

    // classify: +1 のみ stepup (契約 (2))
    ok(classifyStepupTrigger({ deltaY: 1 }).kind === "stepup", "S-23 classify +1");
    ok(classifyStepupTrigger({ deltaY: 0 }).kind === null && classifyStepupTrigger({ deltaY: -1 }).kind === null && classifyStepupTrigger({ deltaY: 2 }).kind === null, "S-24 classify flat/down/+2 rejected");
    ok(classifyStepupTrigger({ prevFootY: 64, footY: 65 }).kind === "stepup" && classifyStepupTrigger({ prevY: 64, y: 63 }).kind === null, "S-25 classify from footY pair");
    ok(classifyStepupTrigger(null).kind === null && classifyStepupTrigger({}).kind === null && classifyStepupTrigger({ deltaY: NaN }).kind === null, "S-26 classify invalid");

    // shouldStepup: +1 + 地上歩行 + 非抑制 + 冷却明け (契約 (2)(4))
    const base = { deltaY: 1, grounded: true, nowMs: 5000, lastFiredMs: null };
    ok(shouldStepup(base) === true, "S-27 base fires");
    ok(shouldStepup({ ...base, deltaY: 0 }) === false && shouldStepup({ ...base, deltaY: -1 }) === false && shouldStepup({ ...base, deltaY: 2 }) === false, "S-28 non-+1 rejected");
    ok(shouldStepup({ ...base, grounded: false }) === false && shouldStepup({ deltaY: 1, nowMs: 5000 }) === true, "S-29 grounded explicit vs unspecified");
    for (const key of ["suppressed", "inCombat", "working", "digging", "attacking", "placing", "falling", "inWater", "climbing", "flying", "hovering", "jumping", "flinchActive", "intentionalDescent", "spiralDescent", "otherOverlayActive"]) {
      ok(shouldStepup({ ...base, [key]: true }) === false, `S-30 suppress ${key}`);
    }
    ok(shouldStepup({ ...base, suppressed: 1 }) === true, "S-31 suppression is strict-true only");
    ok(shouldStepup({ ...base, lastFiredMs: 4700 }) === false && shouldStepup({ ...base, lastFiredMs: 4400 }) === true, "S-32 shouldStepup cooldown");
    ok(shouldStepup(null) === false && shouldStepup("x") === false && shouldStepup({ ...base, nowMs: NaN }) === false, "S-33 invalid inputs");

    // noteStepup / sampleStepup: 発火・消費・連続段・遅れ発火なし (契約 (1)(3)(4)(5))
    {
      const st = createStepupState();
      ok(noteStepup(st, { footY: 64, grounded: true, nowMs: 1000 }) === false && st.prevFootY === 64, "S-34 first Y only seeds prev");
      ok(noteStepup(st, { footY: 65, grounded: true, nowMs: 1100 }) === true && st.startedAtMs === 1100 && st.deltaY === 1 && st.firedCount === 1, "S-35 +1 edge fires");
      const mid = sampleStepup(st, 1190);
      ok(mid.active === true && mid.legLiftDeg === 22 && mid.bodyPitchDeg === 5 && mid.gazePitchDeg === 4 && mid.trigger === "stepup", "S-36 sample at peak");
      ok(sampleStepup(st, 1380).active === false && sampleStepup(st, 1380).legLiftDeg === 0, "S-37 sample after end is zero");
      // 連続段: 150ms 間隔の辺 2 回は冷却中のため発火しない (契約 (3))
      ok(noteStepup(st, { footY: 66, grounded: true, nowMs: 1250 }) === false, "S-38 stair edge during cooldown consumed");
      ok(noteStepup(st, { footY: 67, grounded: true, nowMs: 1400 }) === false && st.firedCount === 1, "S-39 second stair edge still in cooldown");
      // 冷却明け (発火から 600ms) の辺で再発火する
      ok(noteStepup(st, { footY: 68, grounded: true, nowMs: 1750 }) === true && st.firedCount === 2, "S-40 refire after cooldown");
    }
    {
      const st = createStepupState();
      noteStepup(st, { footY: 64, grounded: true, nowMs: 1000 });
      // 抑制中の辺は消費: 抑制解除後に同じ辺の再提示なしでは発火しない (契約 (4))
      ok(noteStepup(st, { footY: 65, grounded: true, jumping: true, nowMs: 1100 }) === false && st.lastFiredMs === null && st.prevFootY === 65, "S-41 suppressed edge consumed, cooldown untouched");
      ok(sampleStepup(st, 1200).active === false && sampleStepup(st, 5000).active === false, "S-42 no delayed fire after suppression lifts");
      // 平地・下降・+2 の辺も state を発火方向へ進めない (契約 (2))
      ok(noteStepup(st, { footY: 65, grounded: true, nowMs: 2000 }) === false
        && noteStepup(st, { footY: 64, grounded: true, nowMs: 2100 }) === false
        && noteStepup(st, { footY: 66, grounded: true, nowMs: 2200 }) === false
        && st.firedCount === 0, "S-43 flat/down/+2 edges never fire");
      // 入力異常: 例外を投げず、有限値だけを返す (契約 (5))
      ok(noteStepup(st, { footY: NaN, nowMs: 2300 }) === false && st.prevFootY === 66, "S-44 NaN footY keeps prev");
      ok(noteStepup(st, { footY: 67, nowMs: NaN }) === false && noteStepup(null, base) === false && sampleStepup(null, 0).active === false, "S-45 invalid time/state safe");
      resetStepupState(st);
      ok(st.prevFootY === null && st.startedAtMs === null && st.firedCount === 0, "S-46 reset");
      ok(isStepupActiveState(st, 0) === false, "S-47 activeState after reset");
    }

    // 決定的: 同じ入力列は常に同じ発火列になる
    {
      const run = () => {
        const st = createStepupState(); const out = [];
        const seq = [[64, 1000], [65, 1100], [66, 1250], [67, 1800], [67, 1900], [68, 2500]];
        for (const [y, t] of seq) out.push(noteStepup(st, { footY: y, grounded: true, nowMs: t }));
        return out.join(",");
      };
      ok(run() === run() && run() === "false,true,false,true,false,true", "S-48 deterministic sequence");
    }
  } catch (e) {
    failures.push("S-XX self-test threw: " + (e && e.message ? e.message : String(e)));
  }
  return { pass, fail: failures.length, failures };
}

// 直接実行時のみ自己テストを回す (import 時は副作用なし)。
try {
  const isMain = typeof process !== "undefined" && Array.isArray(process.argv)
    && typeof process.argv[1] === "string" && import.meta.url.endsWith(process.argv[1].split("/").pop());
  if (isMain) {
    const r = runStepupSelfTests();
    console.log(`stepup_math_draft: ${r.pass} passed, ${r.fail} failed`);
    for (const f of r.failures) console.log("FAIL", f);
    if (typeof process !== "undefined") process.exitCode = r.fail ? 1 : 0;
  }
} catch { /* 自己テストの表示失敗は本体の契約に影響させない */ }
