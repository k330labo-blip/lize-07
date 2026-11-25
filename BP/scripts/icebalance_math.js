// icebalance_math.js — 氷上で止まる/向きを変える瞬間の小さなバランス取り
// POLISH-ANIM-ICEBALANCE-01 (純粋核, cycle1543 で統合。設計の正は cycle1543-a05/ICEBALANCE.md)
// 出典 (仕様の正): brain_parts/solutions/cycle1518-b04/PROPOSAL.md §3/§4
// 台帳: brain_parts/solutions/polish-backlog/BACKLOG.md
//   「POLISH-ANIM-ICEBALANCE-01 氷上で止まる/向きを変える瞬間の小さな
//     バランス取り (新規発案, cycle1518-b04) … 未統合・候補。」
//
// 純粋モジュール: @minecraft/server を import しない。相対 import も持たない
// (ドラフト置き場から単体で node 実行できること。統合時に BP/scripts/
// icebalance_math.js へ移す際、ピッチクランプ定数を gaze_math.js の
// GAZE_PITCH_MIN/MAX へ寄せてよいが本ドラフトは自己完結とする。
// heed_math.js / edgepeek_math.js の自己完結ドラフトと同作法)。
// 例外を投げない。現在時刻・エンティティ参照を持たない (時刻は引数で受ける)。
// 表示層のみ: 移動目標・速度・加減速・摩擦・経路・停止判定、掘削ゲート、
// 作業・戦闘・回収・納品の判定には一切触らない。戻り値を表示 (applyGaze
// 重畳 + r.lastIcebalance 記録) 以外へ流さないことが統合条件。
// 音・セリフ・名札表示は足さない (氷上の step 音は POLISH-SND-ENV-01 の管轄)。
// 新規ボーン・スキン/ジオメトリ変更は不要。腕の開き (armSpreadDeg) は
// 純粋核が値を返すところまでを正とし、RP 受け口が無ければ統合側は
// 記録のみへ倒す (PROPOSAL §5 (e))。
//
// 仕様 (PROPOSAL §3 の固定値):
// - 成分: 体ロール最大 6 度 / 両腕の開き最大 14 度 / 頭ピッチ +5 度まで。
// - 軌道は全成分で共通の単一山形: 入り 150ms → 保持なし → 戻り 300ms、
//   合計 450ms。終了後は全成分が完全な 0 へ戻る (出口がある)。
// - ロールの符号は「滑った方向と逆」の 1 規則だけで決める: 旋回時は
//   旋回方向の逆、減速時は横滑り方向 (slideSign) の逆。減速で横滑り方向が
//   観測できない場合は直近の旋回符号、それも無ければ +1 (右傾きの逆 = 左)
//   へ決定的に倒す (ICEBALANCE.md §6 の未決点1。乱数は使わない)。
// - 冷却 4 秒。冷却中・抑制中に起きた辺も消費し、遅れて発火しない。
// - 発火は 3 条件が同じ tick にそろった辺でのみ (PROPOSAL §3.1):
//   (1) 足元が氷カテゴリ (sfx.js の ice 分類 = 完全一致 4 形のみ。
//       雪・粉雪・土・石は対象外)
//   (2) 立て直しが要る動きの辺: (a) 減速の辺 (水平速度が歩行相当以上から
//       停止相当へ落ちた) または (b) 旋回の辺 (地上歩行中にヨーが
//       300ms 窓内で累積 60 度以上変わった)
//   (3) 地上歩行中 (ホバー飛行・落下・水中・登攀・潜行ではない)
// - 抑制: 戦闘中 / 掘削・攻撃・設置の作業中 / FLINCH 発火中 / 落下中 /
//   水中 / 登攀中 / ホバー飛行中 / 意図的な縦移動 (潜行・螺旋階段) 中 /
//   他の視線重畳が再生中 (ピッチは最下位重畳のため heed/edgepeek と同規則)。
// - 辺の消費の担い手: 本核は noteIcebalance が毎 tick 呼ばれ、前回速度・
//   前回ヨー・旋回累積を結果に関わらず進める前提である。発火しなかった
//   辺 (抑制・冷却・非氷) を呼び出し側が保持して再提示しない限り、
//   遅れ発火は構造的に起きない。

export const ICEBALANCE_ROLL_DEG = 6;        // PROPOSAL §3.2/§4
export const ICEBALANCE_ARM_DEG = 14;        // PROPOSAL §3.2/§4
export const ICEBALANCE_PITCH_DEG = 5;       // PROPOSAL §3.2/§4
export const ICEBALANCE_DURATION_MS = 450;   // PROPOSAL §3.2/§4
export const ICEBALANCE_RAMP_IN_MS = 150;    // 入り 0.15 秒 (PROPOSAL §3.2)
export const ICEBALANCE_RAMP_OUT_MS = 300;   // 戻り 0.30 秒 (保持なし)
export const ICEBALANCE_COOLDOWN_MS = 4000;  // PROPOSAL §3.3/§4
export const ICEBALANCE_TURN_MIN_DEG = 60;   // PROPOSAL §3.1/§4
export const ICEBALANCE_TURN_WINDOW_MS = 300; // PROPOSAL §3.1/§4

// 減速の辺の速度しきい (水平速度、blocks/tick 単位で統合側が渡す想定)。
// TO_MAX = 0.05 は main.js の既存「移動中」判定 (速度の水平成分の絶対値和
// > 0.05) と同値。FROM_MIN = 0.12 は歩行相当の下限 (ドラフト値:
// ICEBALANCE.md §6 の未決点2。統合時に実測速度で確定させる)。
export const ICEBALANCE_DECEL_FROM_MIN = 0.12;
export const ICEBALANCE_DECEL_TO_MAX = 0.05;

// sfx.js materialOfTypeId の ice 分類 (完全一致 4 形) の写し。
// 統合時は分類関数の結果 (groundCategory === "ice") を正とし、本集合は
// typeId を直接受ける供給路向けの予備とする。二重管理を避けるため、
// sfx.js 側の集合が変わったらこちらも追随すること (PROPOSAL §3.1:
// includes("ice") の部分一致は将来の無関係 ID を巻き込むため不採用)。
export const ICEBALANCE_ICE_TYPE_IDS = Object.freeze([
  "ice", "packed_ice", "blue_ice", "frosted_ice",
]);

export const ICEBALANCE_CONSTANTS = Object.freeze({
  ROLL_DEG: ICEBALANCE_ROLL_DEG,
  ARM_DEG: ICEBALANCE_ARM_DEG,
  PITCH_DEG: ICEBALANCE_PITCH_DEG,
  DURATION_MS: ICEBALANCE_DURATION_MS,
  RAMP_IN_MS: ICEBALANCE_RAMP_IN_MS,
  RAMP_OUT_MS: ICEBALANCE_RAMP_OUT_MS,
  COOLDOWN_MS: ICEBALANCE_COOLDOWN_MS,
  TURN_MIN_DEG: ICEBALANCE_TURN_MIN_DEG,
  TURN_WINDOW_MS: ICEBALANCE_TURN_WINDOW_MS,
  DECEL_FROM_MIN: ICEBALANCE_DECEL_FROM_MIN,
  DECEL_TO_MAX: ICEBALANCE_DECEL_TO_MAX,
});

// gaze_math.js のクランプと同値 (自己完結のため本モジュール内に持つ。
// 統合時は gaze_math の GAZE_PITCH_MIN/MAX へ寄せてよい。heed_math と同方式)。
const PITCH_MIN_DEG = -60;
const PITCH_MAX_DEG = 75;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

function bareId(typeId) {
  if (typeof typeId !== "string") return "";
  const i = typeId.indexOf(":");
  return i >= 0 ? typeId.slice(i + 1) : typeId;
}

// wrapIcebalanceYawDeg(deg) -> [-180, 180] へ正規化したヨー。-180 は 180 に寄せる
// (heed_math.js wrapHeedYawDeg / dryoff_math.js と同一式)。非有限はそのまま返す。
export function wrapIcebalanceYawDeg(deg) {
  try {
    if (!Number.isFinite(deg)) return deg;
    let d = ((deg + 180) % 360 + 360) % 360 - 180;
    if (d === -180) d = 180;
    return d;
  } catch { return deg; }
}

// isIceCategory(category) -> boolean
// sfx.js の素材カテゴリ文字列が厳密に "ice" のときだけ true。
// "snow" / "powder_snow" は柔らかい足元であり滑りとは別現象 (PROPOSAL §3.1)。
export function isIceCategory(category) {
  try { return category === "ice"; } catch { return false; }
}

// isIceTypeId(typeId) -> boolean
// "minecraft:" 接頭辞を外した完全一致 4 形のみ (sfx.js と同一集合)。
export function isIceTypeId(typeId) {
  try { return ICEBALANCE_ICE_TYPE_IDS.includes(bareId(typeId)); } catch { return false; }
}

// isSlipperyGround(input) -> boolean: 足元が氷/滑りやすい足元かの純粋判定
// 供給路は 3 通り (いずれか 1 つが氷を示せば true にはしない: 明示された
// 氷判定を優先し、カテゴリが文字列で渡された場合はそれを正とする):
// - groundCategory / category: sfx 分類の結果。"ice" のみ true、それ以外の
//   文字列 (例 "snow") が渡されたら typeId 側は見ず false (分類が正)。
// - groundTypeId / typeId / footTypeId: ブロック typeId。完全一致 4 形のみ。
// - onIce / slippery: 統合側が既に判定済みの場合は ===true のみ受理する。
export function isSlipperyGround(input) {
  try {
    if (!input || typeof input !== "object") return false;
    const cat = input.groundCategory !== undefined ? input.groundCategory : input.category;
    if (typeof cat === "string") return isIceCategory(cat);
    const tid = input.groundTypeId !== undefined ? input.groundTypeId
      : input.typeId !== undefined ? input.typeId : input.footTypeId;
    if (typeof tid === "string") return isIceTypeId(tid);
    if (input.onIce !== undefined) return input.onIce === true;
    if (input.slippery !== undefined) return input.slippery === true;
    return false;
  } catch { return false; }
}

// icebalanceEnvelope(elapsedMs) -> 0..1 の包絡 | 範囲外・無効入力は 0
// 波形: 0〜150ms は sin で寄せ (0→1)、保持なし、150〜450ms は cos で
// 復帰 (1→0)。t=0 と t>=450 は厳密に 0 (出口がある)。全成分で共有する。
export function icebalanceEnvelope(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= ICEBALANCE_DURATION_MS) return 0;
    if (e < ICEBALANCE_RAMP_IN_MS) return Math.sin((e / ICEBALANCE_RAMP_IN_MS) * Math.PI / 2);
    const t = (e - ICEBALANCE_RAMP_IN_MS) / ICEBALANCE_RAMP_OUT_MS;
    const v = Math.cos(t * Math.PI / 2);
    return v === 0 ? 0 : v;
  } catch { return 0; }
}

// icebalanceOffsets(elapsedMs, rollSign)
//   -> { active, bodyRollDeg, armSpreadDeg, gazePitchDeg }
// PROPOSAL §3.2 の出力形。非活動時は全成分が完全な 0。
// bodyRollDeg は rollSign (-1 | 0 | +1) × 6 度 × 包絡。rollSign が
// 有効な符号でない場合は 0 として扱い、ロールだけが 0 になる
// (腕・ピッチは符号に依存しないため通常どおり返す)。
// gazePitchDeg は +5 度 × 包絡 (下向き正。視線の主制御は奪わない)。
export function icebalanceOffsets(elapsedMs, rollSign) {
  try {
    const zero = { active: false, bodyRollDeg: 0, armSpreadDeg: 0, gazePitchDeg: 0 };
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= ICEBALANCE_DURATION_MS) return { ...zero };
    const k = icebalanceEnvelope(e);
    if (k === 0) return { ...zero };
    const sign = rollSign === -1 || rollSign === 1 ? rollSign : 0;
    const roll = sign * ICEBALANCE_ROLL_DEG * k;
    return {
      active: true,
      bodyRollDeg: roll === 0 ? 0 : roll,
      armSpreadDeg: ICEBALANCE_ARM_DEG * k,
      gazePitchDeg: ICEBALANCE_PITCH_DEG * k,
    };
  } catch { return { active: false, bodyRollDeg: 0, armSpreadDeg: 0, gazePitchDeg: 0 }; }
}

// icebalanceOffsetsAt(startedAtMs, rollSign, nowMs) -> icebalanceOffsets と同形
export function icebalanceOffsetsAt(startedAtMs, rollSign, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return { active: false, bodyRollDeg: 0, armSpreadDeg: 0, gazePitchDeg: 0 };
    return icebalanceOffsets(n - s, rollSign);
  } catch { return { active: false, bodyRollDeg: 0, armSpreadDeg: 0, gazePitchDeg: 0 }; }
}

// applyIcebalancePitch(basePitchDeg, elapsedMs, rollSign)
//   -> クランプ済みピッチ (applyGaze 重畳向け)
// ピッチ成分は符号に依存しないため rollSign は受け口の対称性のためだけに
// 取り、計算には使わない。base 非有限時は base をそのまま返す
// (heed/dryoff の apply* と同規則)。オフセットは gaze クランプ内へ収める。
export function applyIcebalancePitch(basePitchDeg, elapsedMs, rollSign) {
  try {
    if (!Number.isFinite(basePitchDeg)) return basePitchDeg;
    const off = icebalanceOffsets(elapsedMs, rollSign).gazePitchDeg;
    return Math.max(PITCH_MIN_DEG, Math.min(PITCH_MAX_DEG, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

// isIcebalanceActive(startedAtMs, nowMs) -> boolean
// 0 <= nowMs - startedAtMs < 450 のときだけ true。時計巻き戻しは false。
export function isIcebalanceActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    const e = n - s;
    return e >= 0 && e < ICEBALANCE_DURATION_MS;
  } catch { return false; }
}

// icebalanceDue(lastFiredMs, nowMs) -> boolean: クールダウン判定 (4秒)
// 初回 (lastFiredMs が非有限) は true。nowMs 非有限は false。
// 境界: 前回 +3999ms は false、+4000ms は true。
export function icebalanceDue(lastFiredMs, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    const last = finiteOrNull(lastFiredMs);
    if (last === null) return true;
    return n - last >= ICEBALANCE_COOLDOWN_MS;
  } catch { return false; }
}

function isSuppressed(input) {
  // いずれも ===true のときだけ抑制として扱う (truthy な 1 等では倒さない。
  // heed/edgepeek と同規則)。
  if (!input || typeof input !== "object") return false;
  if (input.suppressed === true) return true;
  if (input.inCombat === true || input.combat === true || input.danger === true) return true;
  if (input.working === true || input.digging === true || input.attacking === true
      || input.placing === true || input.hasWorkTarget === true) return true;
  if (input.flinchActive === true) return true;
  if (input.falling === true || input.selfFalling === true) return true;
  if (input.inWater === true || input.climbing === true) return true;
  if (input.flying === true || input.hovering === true) return true;
  // 意図的な縦移動 (潜行・螺旋階段・坑道) は地上歩行ではないため抑制する。
  if (input.intentionalDescent === true || input.descending === true
      || input.spiralDescent === true || input.tunnelDescent === true) return true;
  // ピッチは既存重畳チェーンの最下位へ足すため、他重畳の再生中は発火しない。
  if (input.otherOverlayActive === true) return true;
  return false;
}

function isGroundedWalk(input) {
  // 条件 (3) 地上歩行中: grounded が明示されたら ===true を必須とする。
  // 未指定の場合は flying/hovering/falling 等の抑制側で判定する (後方互換)。
  if (input.grounded !== undefined) return input.grounded === true;
  if (input.onGround !== undefined) return input.onGround === true;
  return true;
}

// classifyIcebalanceTrigger(input) -> { kind, rollSign } | { kind: null, rollSign: 0 }
// 辺の種別とロールの符号だけを決める純粋判定 (状態を書き換えない)。
// input は「辺が既に導出済み」の形を取る:
// {
//   decelEdge,        // ===true: 減速の辺 (速度が FROM_MIN 以上 -> TO_MAX 以下)
//   turnDeltaDeg,     // 300ms 窓内の累積ヨー変化 (符号つき)。|.| >= 60 で旋回の辺
//   slideSign,        // 減速時の横滑り方向 (-1 | +1)。無ければ null
//   lastTurnSign,     // 直近の旋回の符号 (-1 | +1)。減速時の予備。無ければ null
// }
// 優先順位: 旋回と減速が同じ tick に重なったら旋回を採る (符号が観測可能で
// 確実なため)。ロールの符号は常に「滑った方向と逆」= -滑り方向。
export function classifyIcebalanceTrigger(input) {
  try {
    const none = { kind: null, rollSign: 0 };
    if (!input || typeof input !== "object") return { ...none };
    const turn = finiteOrNull(input.turnDeltaDeg);
    if (turn !== null && Math.abs(turn) >= ICEBALANCE_TURN_MIN_DEG) {
      return { kind: "turn", rollSign: turn > 0 ? -1 : 1 };
    }
    if (input.decelEdge === true) {
      const slide = input.slideSign === -1 || input.slideSign === 1 ? input.slideSign : null;
      const lastTurn = input.lastTurnSign === -1 || input.lastTurnSign === 1 ? input.lastTurnSign : null;
      const slip = slide !== null ? slide : lastTurn !== null ? lastTurn : 1;
      return { kind: "decel", rollSign: -slip };
    }
    return { ...none };
  } catch { return { kind: null, rollSign: 0 }; }
}

// shouldIcebalance(input) -> boolean: 発火可否の純粋判定 (状態を書き換えない)
// input は classifyIcebalanceTrigger と同じ「辺が導出済み」の形 + 足元・抑制:
// {
//   groundCategory, category, groundTypeId, typeId, footTypeId, onIce, slippery,
//   decelEdge, turnDeltaDeg, slideSign, lastTurnSign,
//   grounded, onGround,                       // 地上歩行 (明示時は ===true 必須)
//   suppressed, inCombat, combat, danger, working, digging, attacking, placing,
//   hasWorkTarget, flinchActive, falling, selfFalling, inWater, climbing,
//   flying, hovering, intentionalDescent, descending, spiralDescent,
//   tunnelDescent, otherOverlayActive,        // 抑制群 (===true のみ)
//   lastFiredMs, lastFiredAtMs, nowMs,        // クールダウン用
// }
// 成立条件: (1) 足元が氷 (2) 減速または旋回の辺 (3) 地上歩行中で
// 抑制に触れず (4) クールダウン明け。いずれも欠ければ false。
export function shouldIcebalance(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (!isSlipperyGround(input)) return false;
    if (classifyIcebalanceTrigger(input).kind === null) return false;
    if (!isGroundedWalk(input)) return false;
    if (isSuppressed(input)) return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;
    const last = input.lastFiredMs !== undefined ? input.lastFiredMs : input.lastFiredAtMs;
    return icebalanceDue(last, input.nowMs);
  } catch { return false; }
}

// --- 状態の薄いラッパ (揮発メモリのみ。永続化は作らない) ---
// state:
// {
//   prevSpeed,        // 前 tick の水平速度 (減速の辺の導出用)
//   prevYawDeg,       // 前 tick のヨー (旋回の辺の導出用)
//   prevOnIce,        // 前 tick の足元が氷だったか
//   turnAccumDeg,     // 300ms 窓内の同方向ヨー変化の累積 (符号つき)
//   turnWindowStartMs,// 現在の旋回累積の窓の開始時刻
//   lastTurnSign,     // 直近に観測した旋回の符号 (減速時の符号の予備)
//   startedAtMs,      // 発火時刻 (sample 用)
//   rollSign,         // 発火時に固定したロールの符号
//   trigger,          // 発火時に固定した種別 ("decel" | "turn" | null)
//   lastFiredMs,      // クールダウン用
//   firedCount,
// }
export function createIcebalanceState() {
  return {
    prevSpeed: null, prevYawDeg: null, prevOnIce: undefined,
    turnAccumDeg: 0, turnWindowStartMs: null, lastTurnSign: null,
    startedAtMs: null, rollSign: 0, trigger: null,
    lastFiredMs: null, firedCount: 0,
  };
}

export function resetIcebalanceState(state) {
  try {
    if (!state || typeof state !== "object") return state;
    state.prevSpeed = null;
    state.prevYawDeg = null;
    state.prevOnIce = undefined;
    state.turnAccumDeg = 0;
    state.turnWindowStartMs = null;
    state.lastTurnSign = null;
    state.startedAtMs = null;
    state.rollSign = 0;
    state.trigger = null;
    state.lastFiredMs = null;
    state.firedCount = 0;
    return state;
  } catch { return state; }
}

// noteIcebalance(state, input) -> boolean (発火を記録したら true)
// 移動ループが毎 tick 呼ぶ想定の状態ful な入口。input:
// {
//   groundCategory, groundTypeId, ... (isSlipperyGround と同じ供給形)
//   horizSpeed, speed,        // 今 tick の水平速度 (horizSpeed 優先)
//   speedBefore, speedAfter,  // 呼び出し側が辺を導出済みならこちらを優先
//   yawDeg,                   // 今 tick のヨー (旋回累積の導出用)
//   yawDeltaDeg,              // 呼び出し側が窓内累積を導出済みならこちらを優先
//   slideSign, grounded, ...抑制群, nowMs,
// }
// 振る舞い:
// - 前回速度・前回ヨー・旋回累積は結果に関わらず毎回進める (辺の消費)。
//   抑制中・冷却中・非氷の辺も消費され、遅れて発火しない。
// - 減速の辺: 前回速度 >= DECEL_FROM_MIN かつ今回 <= DECEL_TO_MAX。
//   速度が非有限の tick は prevSpeed を壊さず、その tick は辺にならない。
// - 旋回の辺: 同方向のヨー変化を 300ms 窓で累積し、|累積| が 60 度へ
//   到達した tick が辺。到達 (発火・消費のいずれでも) の後は累積を 0 へ
//   戻すため、回り続けても再到達までは次の辺にならない。逆方向への変化は
//   累積をその方向へ張り替える。窓を過ぎた累積は破棄する。
// - ヨーが非有限の tick は prevYawDeg / 累積を壊さない。
// - 発火したときだけ startedAtMs / rollSign / trigger / lastFiredMs を
//   記録する。不発の辺では lastFiredMs を進めない (クールダウンは
//   発火起点でのみ数える。heed/noteHeed と同規則)。
export function noteIcebalance(state, input) {
  try {
    if (!state || typeof state !== "object") return false;
    if (!input || typeof input !== "object") return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;

    // --- 減速の辺の導出 (prevSpeed は結果に関わらず進める) ---
    let decelEdge = false;
    const before = finiteOrNull(input.speedBefore);
    const after = finiteOrNull(input.speedAfter);
    if (before !== null && after !== null) {
      decelEdge = before >= ICEBALANCE_DECEL_FROM_MIN && after <= ICEBALANCE_DECEL_TO_MAX;
      state.prevSpeed = after;
    } else {
      const sp = finiteOrNull(input.horizSpeed) !== null ? finiteOrNull(input.horizSpeed)
        : finiteOrNull(input.speed);
      if (sp !== null) {
        const prev = finiteOrNull(state.prevSpeed);
        if (prev !== null) {
          decelEdge = prev >= ICEBALANCE_DECEL_FROM_MIN && sp <= ICEBALANCE_DECEL_TO_MAX;
        }
        state.prevSpeed = sp;
      }
    }

    // --- 旋回の辺の導出 (累積は結果に関わらず進める) ---
    let turnDeltaDeg = finiteOrNull(input.yawDeltaDeg);
    const yaw = finiteOrNull(input.yawDeg);
    if (turnDeltaDeg === null && yaw !== null) {
      const prevYaw = finiteOrNull(state.prevYawDeg);
      if (prevYaw !== null) {
        const d = wrapIcebalanceYawDeg(yaw - prevYaw);
        if (d !== 0) {
          const winStart = finiteOrNull(state.turnWindowStartMs);
          const accum = finiteOrNull(state.turnAccumDeg) ?? 0;
          if (winStart === null || now - winStart > ICEBALANCE_TURN_WINDOW_MS
              || (accum !== 0 && Math.sign(d) !== Math.sign(accum))) {
            state.turnAccumDeg = d;
            state.turnWindowStartMs = now;
          } else {
            state.turnAccumDeg = accum + d;
          }
          state.lastTurnSign = state.turnAccumDeg > 0 ? 1 : -1;
        }
      }
      state.prevYawDeg = yaw;
      const accumNow = finiteOrNull(state.turnAccumDeg) ?? 0;
      if (Math.abs(accumNow) >= ICEBALANCE_TURN_MIN_DEG) {
        turnDeltaDeg = accumNow;
        state.turnAccumDeg = 0; // 到達した辺はここで消費する (発火可否によらない)
        state.turnWindowStartMs = null;
      }
    } else if (yaw !== null) {
      state.prevYawDeg = yaw; // yawDeltaDeg 供給時も次回の導出用に進める
    }

    state.prevOnIce = isSlipperyGround(input);

    // --- 発火判定 (純粋層へ委譲) ---
    const cls = classifyIcebalanceTrigger({
      decelEdge, turnDeltaDeg,
      slideSign: input.slideSign, lastTurnSign: state.lastTurnSign,
    });
    const ok = shouldIcebalance({
      ...input,
      decelEdge, turnDeltaDeg,
      slideSign: input.slideSign, lastTurnSign: state.lastTurnSign,
      lastFiredMs: state.lastFiredMs,
      nowMs: now,
    });
    if (!ok) return false;
    state.startedAtMs = now;
    state.rollSign = cls.rollSign;
    state.trigger = cls.kind;
    state.lastFiredMs = now;
    state.firedCount = (Number.isFinite(state.firedCount) ? state.firedCount : 0) + 1;
    return true;
  } catch { return false; }
}

// sampleIcebalance(state, nowMs)
//   -> { active, bodyRollDeg, armSpreadDeg, gazePitchDeg, trigger, rollSign }
// 統合時の applyGaze 重畳点 (最下位) が毎 tick 呼ぶ想定のサンプリング。
// rollSign / trigger は発火時点の値を保持する (毎 tick 取り直すと波形の
// 目標が動き続け「完全な 0 へ戻る」契約が崩れるため。heed/sampleHeed と同規則)。
// 腕の開き (armSpreadDeg) は RP 受け口が無い統合では呼び出し側が
// r.lastIcebalance への記録だけに使い、表示へ流さなくてよい。
export function sampleIcebalance(state, nowMs) {
  try {
    const zero = { active: false, bodyRollDeg: 0, armSpreadDeg: 0, gazePitchDeg: 0, trigger: null, rollSign: 0 };
    if (!state || typeof state !== "object") return { ...zero };
    const s = finiteOrNull(state.startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return { ...zero };
    const off = icebalanceOffsets(n - s, state.rollSign);
    if (!off.active) return { ...zero };
    return { ...off, trigger: state.trigger ?? null, rollSign: state.rollSign ?? 0 };
  } catch {
    return { active: false, bodyRollDeg: 0, armSpreadDeg: 0, gazePitchDeg: 0, trigger: null, rollSign: 0 };
  }
}

// isIcebalanceActiveState(state, nowMs) -> boolean (状態形の active 判定)
export function isIcebalanceActiveState(state, nowMs) {
  try { return sampleIcebalance(state, nowMs).active; } catch { return false; }
}
