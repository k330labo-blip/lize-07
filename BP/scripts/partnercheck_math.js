// partnercheck_math.js — 主人が被弾した瞬間の小さな無事確認視線
// POLISH-ANIM-PARTNERCHECK-01 (純粋核ドラフト, cycle1850-a02・作り込みトラック)
// 仕様の正: brain_parts/solutions/cycle1832-a17/REPORT.md §4〜§6
// 先行統合済み workglance_math.js / flinch_math.js / heed_math.js と同じ型
// (純粋核＋記録＋applyGaze 最下位重畳) に揃えた自己完結ドラフト。
// 統合時は BP/scripts/partnercheck_math.js へ移す想定。本ドラフトは
// 共有ファイル (main.js / brain.js / all.js / manifest 等) を一切編集しない。
//
// 純粋モジュール: @minecraft/server を import しない。相対 import も持たない
// (ドラフト置き場から単体で node 実行できること)。例外を投げない。
// 現在時刻・エンティティ参照を持たない (時刻は引数で受ける)。決定的:
// 乱数・Date.now・環境依存を持たない。同じ入力は常に同じ出力。
// 表示層のみ: 移動・経路・迎撃/回復/警告の判断・作業・戦闘・発話・
// サウンド・名札表示には一切触らない。戻り値は表示 (applyGaze 重畳の
// 最下位) と r.lastPartnerCheck 記録以外へ流さないことが統合条件。
// 音・セリフ・パーティクルは足さない。新規ボーン・スキン/ジオメトリ
// 変更は不要。gen_lize_model.py は実行禁止 (本ドラフトでも未実行)。
//
// 仕様 (REPORT §4 の固定値):
// - 発火源はポーリングではなくイベントの辺: 既存配線済み entityHurt
//   (所有者プレイヤーの被弾で recordDanger(..., "owner_hurt", ...) が
//   呼ばれる経路と同源) から「自分の所有者が被弾した」という辺だけを
//   sample.ownerHurtEdge === true として受け取る。他プレイヤー (自分の
//   所有者でない) の被弾辺は呼び出し側が渡さない前提だが、核側でも
//   sample.isOwner === false が明示されれば不発に倒す (所有者単位に閉じる)。
// - 距離: 主人までの 3D 距離が 2.0 以上 24.0 以下 (両端含む)。
//   近すぎる場合は既に視界内として記録のみ、遠すぎる場合は出さない。
// - 軌道: 合計 700ms。入り 120ms で目標へ、保持 280ms、戻り 300ms で
//   完全な 0 へ (出口がある。残留状態を持たない)。目標角は発火時点で
//   固定し、窓の途中で主人を追い直さない (WORKGLANCE/EYECONTACT と同作法)。
//   sample.targetYawDeg / targetPitchDeg は「主人方向への相対重畳角」
//   として呼び出し側が発火時点で算出した値を渡す想定。
// - 冷却 8000ms。連続被弾で頭が振られ続けないための絞り。クールダウン中・
//   抑制中の辺は消費し、遅れて発火しない (辺は呼び出し側が 1 回だけ
//   提示する前提であり、不発の辺を保持・再提示しない限り遅れ発火は
//   構造的に起きない)。
// - 角度クランプは gaze_math の既存範囲 (ピッチ -60/+75 度) 内に収める。
//   核側で独自の角度上限は増やさない (REPORT §4)。ヨーは wrap のみ。
// - 環境ダメージ (落下・窒息等) は発生源の種別で絞らない (REPORT §5:
//   不意の事故こそ確認が出る場面。距離とクールダウンだけで絞る)。
//
// 抑制 (REPORT §5。いずれも ===true のときだけ。truthy な 1 等では倒さない):
// - リゼ自身が被弾/戦闘の最中 (selfHurt / inCombat / combat)
// - 掘削・設置・攻撃の作業動作中で視線が作業対象へ固定されている場面
//   (working / digging / placing / attacking / hasWorkTarget)
// - 落下中 (falling)・水中/遊泳中 (inWater / swimming / submerged)・
//   登攀中 (climbing)・死亡/復元遷移中 (dead / restoring)
// - 主人が既に視線の正面近くにいる場合 (ownerInFront === true。記録のみ)
// - 他の視線作り込みの高優先要素が有効な間は最下位として譲る
//   (otherOverlayActive / flinchActive / inspectActive / nodActive /
//    heedActive / workglanceActive)
// 抑制は表示だけに効く。抑制の有無で迎撃・回復・警告・帰還等の行動
// 判断は一切変わらない。
//
// 記録のみへの倒し方 (REPORT §4): 統合時に被弾イベントから所有者一致と
// 距離が安定して取れないと判明した場合は、表示を有効化せず
// r.lastPartnerCheck = { atMs, dist, fired: false, reason } への記録のみで
// 統合してよい。本核はその場合もそのまま使える: notePartnerCheck は
// 発火/不発にかかわらず state.lastRecord へ { atMs, dist, fired, reason }
// を残し、理由コード (REASONS) で不発要因を判別できる。

export const PARTNERCHECK_DURATION_MS = 700;  // 窓の合計 0.7 秒 (REPORT §4)
export const PARTNERCHECK_RISE_MS = 120;       // 入り 0.12 秒 (線形 0→1)
export const PARTNERCHECK_HOLD_MS = 280;       // 保持 0.28 秒 (係数 1)
export const PARTNERCHECK_FALL_MS = 300;       // 戻り 0.30 秒 (線形 1→0)
export const PARTNERCHECK_MIN_DIST = 2.0;      // 3D 距離の下限 (REPORT §4)
export const PARTNERCHECK_MAX_DIST = 24.0;     // 3D 距離の上限 (REPORT §4)
export const PARTNERCHECK_COOLDOWN_MS = 8000;  // 冷却 8 秒 (REPORT §4)

export const PARTNERCHECK_CONSTANTS = Object.freeze({
  DURATION_MS: PARTNERCHECK_DURATION_MS,
  RISE_MS: PARTNERCHECK_RISE_MS,
  HOLD_MS: PARTNERCHECK_HOLD_MS,
  FALL_MS: PARTNERCHECK_FALL_MS,
  MIN_DIST: PARTNERCHECK_MIN_DIST,
  MAX_DIST: PARTNERCHECK_MAX_DIST,
  COOLDOWN_MS: PARTNERCHECK_COOLDOWN_MS,
});

// gaze_math.js のクランプと同値 (自己完結のため本モジュール内に持つ。
// 統合時は gaze_math の GAZE_PITCH_MIN/MAX へ寄せてよい。workglance と同方式)。
const PITCH_MIN_DEG = -60;
const PITCH_MAX_DEG = 75;

// 不発理由コード (r.lastPartnerCheck.reason / state.lastReason 用)。
export const PARTNERCHECK_REASONS = Object.freeze({
  FIRED: "fired",
  NO_EDGE: "no_edge",               // 所有者被弾の辺でない (他者被弾含む)
  NOT_OWNER: "not_owner",           // isOwner === false が明示された
  BAD_INPUT: "bad_input",           // nowMs / dist / 目標角が有限でない
  TOO_CLOSE: "too_close",           // dist < MIN_DIST (記録のみ)
  TOO_FAR: "too_far",               // dist > MAX_DIST
  SUPPRESSED: "suppressed",         // REPORT §5 の抑制に該当
  OWNER_IN_FRONT: "owner_in_front", // 主人が既に正面近く (記録のみ)
  COOLDOWN: "cooldown",             // 冷却中 (辺は消費する)
  WINDOW_ACTIVE: "window_active",   // 窓の再生中 (目標角・窓は不変)
});

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

function posOrNull(p) {
  try {
    if (!p || typeof p !== "object") return null;
    const x = finiteOrNull(p.x), y = finiteOrNull(p.y), z = finiteOrNull(p.z);
    if (x === null || y === null || z === null) return null;
    return { x, y, z };
  } catch { return null; }
}

// wrapPartnerCheckYawDeg(deg) -> [-180, 180] へ正規化したヨー。
// -180 は 180 に寄せる (workglance/heed と同一式)。非有限はそのまま返す。
export function wrapPartnerCheckYawDeg(deg) {
  try {
    if (!Number.isFinite(deg)) return deg;
    let d = ((deg + 180) % 360 + 360) % 360 - 180;
    if (d === -180) d = 180;
    return d;
  } catch { return deg; }
}

// clampPartnerCheckPitchDeg(pitchDeg) -> gaze 範囲 [-60, +75] へ
// クランプしたピッチ | null (独自上限は増やさない。REPORT §4)
export function clampPartnerCheckPitchDeg(pitchDeg) {
  try {
    const p = finiteOrNull(pitchDeg);
    if (p === null) return null;
    return Math.max(PITCH_MIN_DEG, Math.min(PITCH_MAX_DEG, p));
  } catch { return null; }
}

// partnerCheckDistance3D(a, b) -> 3D 距離 | null (どちらか無効なら null)
// 本件の距離は 3D 距離が正 (REPORT §4。水平距離の workglance と混同しない)。
export function partnerCheckDistance3D(a, b) {
  try {
    const pa = posOrNull(a), pb = posOrNull(b);
    if (pa === null || pb === null) return null;
    return Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z);
  } catch { return null; }
}

// partnerCheckEnvelope(elapsedMs) -> 0..1 の包絡 | 範囲外・無効入力は 0
// 波形 (REPORT §4): 0〜120ms で 0→1、120〜400ms で保持 1、
// 400〜700ms で 1→0。t=0 と t>=700 は厳密に 0 (出口がある)。
export function partnerCheckEnvelope(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= PARTNERCHECK_DURATION_MS) return 0;
    if (e < PARTNERCHECK_RISE_MS) return e / PARTNERCHECK_RISE_MS;
    if (e < PARTNERCHECK_RISE_MS + PARTNERCHECK_HOLD_MS) return 1;
    const v = 1 - (e - PARTNERCHECK_RISE_MS - PARTNERCHECK_HOLD_MS) / PARTNERCHECK_FALL_MS;
    return v === 0 ? 0 : v;
  } catch { return 0; }
}

function isSuppressed(sample) {
  // REPORT §5 の抑制群。いずれも ===true のときだけ抑制として扱う。
  if (!sample || typeof sample !== "object") return false;
  if (sample.suppressed === true) return true;
  // リゼ自身が被弾/戦闘の最中 (自分の視線が主役の場面)
  if (sample.selfHurt === true || sample.inCombat === true || sample.combat === true) return true;
  // 作業動作中で視線が作業対象へ固定されている場面
  if (sample.working === true || sample.digging === true || sample.placing === true
      || sample.attacking === true || sample.hasWorkTarget === true) return true;
  // 落下中・水中/遊泳中・登攀中・死亡/復元遷移中
  if (sample.falling === true || sample.selfFalling === true) return true;
  if (sample.inWater === true || sample.swimming === true || sample.submerged === true
      || sample.diving === true) return true;
  if (sample.climbing === true) return true;
  if (sample.dead === true || sample.restoring === true || sample.summonActive === true) return true;
  // 高優先の視線作り込みが有効な間は最下位として譲る
  if (sample.otherOverlayActive === true) return true;
  if (sample.flinchActive === true || sample.inspectActive === true
      || sample.nodActive === true || sample.heedActive === true
      || sample.workglanceActive === true) return true;
  return false;
}

// resolveDist(sample) -> 有効な 3D 距離 | null
// sample.dist が有限ならそれを正とし、無ければ selfPos/ownerPos から導出する。
function resolveDist(sample) {
  const d = finiteOrNull(sample?.dist) !== null ? finiteOrNull(sample?.dist)
    : finiteOrNull(sample?.dist3d);
  if (d !== null) return d;
  return partnerCheckDistance3D(sample?.selfPos, sample?.ownerPos);
}

// partnerCheckDue(state, nowMs) -> boolean: クールダウン判定 (8000ms)
// state.cooldownUntilMs / state.lastFiredAtMs のどちらからでも判定できる。
// 初回 (発火履歴なし) は true。nowMs 非有限は false。
export function partnerCheckDue(state, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    if (!state || typeof state !== "object") return true;
    const until = finiteOrNull(state.cooldownUntilMs);
    if (until !== null && until > 0) return n >= until;
    const last = finiteOrNull(state.lastFiredAtMs);
    if (last === null) return true;
    return n - last >= PARTNERCHECK_COOLDOWN_MS;
  } catch { return false; }
}

// isPartnerCheckActive(state, nowMs) -> boolean
// 0 <= nowMs - activeFromMs < 700 のときだけ true。時計巻き戻しは false。
export function isPartnerCheckActive(state, nowMs) {
  try {
    if (!state || typeof state !== "object") return false;
    const s = finiteOrNull(state.activeFromMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    const e = n - s;
    return e >= 0 && e < PARTNERCHECK_DURATION_MS;
  } catch { return false; }
}

// classifyPartnerCheck(state, sample, nowMs) -> 理由コード文字列
// 発火可否の純粋判定 (状態を書き換えない)。FIRED のときだけ発火できる。
// 判定順は理由の安定性のため固定する: 辺 → 所有者 → 入力 → 距離 →
// 正面 → 抑制 → 窓 → 冷却。
export function classifyPartnerCheck(state, sample, nowMs) {
  try {
    const R = PARTNERCHECK_REASONS;
    if (!sample || typeof sample !== "object") return R.BAD_INPUT;
    if (sample.ownerHurtEdge !== true) return R.NO_EDGE;
    if (sample.isOwner === false) return R.NOT_OWNER;
    const now = finiteOrNull(nowMs) !== null ? finiteOrNull(nowMs) : finiteOrNull(sample.nowMs);
    if (now === null) return R.BAD_INPUT;
    const dist = resolveDist(sample);
    if (dist === null || dist < 0) return R.BAD_INPUT;
    if (finiteOrNull(sample.targetYawDeg) === null
        || finiteOrNull(sample.targetPitchDeg) === null) return R.BAD_INPUT;
    if (dist < PARTNERCHECK_MIN_DIST) return R.TOO_CLOSE;
    if (dist > PARTNERCHECK_MAX_DIST) return R.TOO_FAR;
    if (sample.ownerInFront === true) return R.OWNER_IN_FRONT;
    if (isSuppressed(sample)) return R.SUPPRESSED;
    if (isPartnerCheckActive(state, now)) return R.WINDOW_ACTIVE;
    if (!partnerCheckDue(state, now)) return R.COOLDOWN;
    return R.FIRED;
  } catch { return PARTNERCHECK_REASONS.BAD_INPUT; }
}

// shouldPartnerCheck(state, sample, nowMs) -> boolean (classify の FIRED 判定)
export function shouldPartnerCheck(state, sample, nowMs) {
  try { return classifyPartnerCheck(state, sample, nowMs) === PARTNERCHECK_REASONS.FIRED; }
  catch { return false; }
}

// --- 状態 (REPORT §4 の形。揮発メモリのみ。永続化しない) ---
// {
//   activeFromMs,     // 現在の窓の開始時刻 (発火時刻) | null
//   targetYawDeg,     // 発火時点で固定したヨー目標 (窓の途中では不変)
//   targetPitchDeg,   // 発火時点で固定したピッチ目標 (同上)
//   cooldownUntilMs,  // 冷却の終了時刻 (発火時刻 + 8000)
//   lastFiredAtMs,    // 前回発火時刻 | null
//   firedCount,       // 発火回数 (検証用)
//   lastRecord,       // 直近の辺の記録 { atMs, dist, fired, reason }
//                     // (r.lastPartnerCheck への転記用。記録のみ統合でも使う)
//   lastReason,       // 直近の辺の理由コード
// }
export function createPartnerCheckState() {
  return {
    activeFromMs: null, targetYawDeg: null, targetPitchDeg: null,
    cooldownUntilMs: 0, lastFiredAtMs: null,
    firedCount: 0, lastRecord: null, lastReason: null,
  };
}

export function resetPartnerCheckState(state) {
  try {
    if (!state || typeof state !== "object") return state;
    state.activeFromMs = null;
    state.targetYawDeg = null;
    state.targetPitchDeg = null;
    state.cooldownUntilMs = 0;
    state.lastFiredAtMs = null;
    state.firedCount = 0;
    state.lastRecord = null;
    state.lastReason = null;
    return state;
  } catch { return state; }
}

// notePartnerCheck(state, sample, nowMs) -> state 自身 (REPORT §4 の署名)
// 被弾イベントの辺で 1 回だけ呼ぶこと。
// sample = { ownerHurtEdge, isOwner?, dist? / dist3d? / (selfPos, ownerPos)?,
//            targetYawDeg, targetPitchDeg, suppressed, ...抑制群, ownerInFront?,
//            nowMs? (nowMs 引数が無い場合の予備) }
// - 発火する場合: 目標角を発火時点で固定して状態へ書き、冷却を開始する。
// - 発火しない場合: 辺は消費される (状態の窓・冷却は進めない)。呼び出し側が
//   同じ辺を再提示しない限り、抑制解除・冷却経過の後に遅れて発火しない。
// - いずれの場合も state.lastRecord / lastReason へ記録を残す
//   (記録のみ統合への倒し方。REPORT §4)。
// - state が無効な場合は何もせずそのまま返す。例外を投げない。
export function notePartnerCheck(state, sample, nowMs) {
  try {
    if (!state || typeof state !== "object") return state;
    const now = finiteOrNull(nowMs) !== null ? finiteOrNull(nowMs) : finiteOrNull(sample?.nowMs);
    const reason = classifyPartnerCheck(state, sample, now);
    const dist = sample && typeof sample === "object" ? resolveDist(sample) : null;
    state.lastRecord = { atMs: now, dist, fired: reason === PARTNERCHECK_REASONS.FIRED, reason };
    state.lastReason = reason;
    if (reason !== PARTNERCHECK_REASONS.FIRED) return state;
    state.activeFromMs = now;
    state.targetYawDeg = wrapPartnerCheckYawDeg(finiteOrNull(sample.targetYawDeg));
    state.targetPitchDeg = clampPartnerCheckPitchDeg(sample.targetPitchDeg);
    state.lastFiredAtMs = now;
    state.cooldownUntilMs = now + PARTNERCHECK_COOLDOWN_MS;
    state.firedCount = (Number.isFinite(state.firedCount) ? state.firedCount : 0) + 1;
    return state;
  } catch { return state; }
}

// partnerCheckOffset(state, nowMs) -> { active, yawDeg, pitchDeg }
// (REPORT §4 の署名。統合時の applyGaze 重畳点・最下位が毎 tick 呼ぶ想定)
// 窓内は発火時点で固定した目標角へ包絡を掛けた重畳量を返す。窓の終わりで
// 完全な 0 に戻る。入力が null/undefined/NaN の場合は発火せず有限値のみ返す。
// 注: 発火した同 tick (経過 0) は包絡が 0 のため active:false・0 を返すが、
// 窓の内側かどうかは isPartnerCheckActive で判定できる (workglance と同作法)。
export function partnerCheckOffset(state, nowMs) {
  try {
    const zero = { active: false, yawDeg: 0, pitchDeg: 0 };
    if (!state || typeof state !== "object") return { ...zero };
    const s = finiteOrNull(state.activeFromMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return { ...zero };
    const e = n - s;
    if (e < 0 || e >= PARTNERCHECK_DURATION_MS) return { ...zero };
    const k = partnerCheckEnvelope(e);
    if (k === 0) return { ...zero };
    const ty = finiteOrNull(state.targetYawDeg);
    const tp = finiteOrNull(state.targetPitchDeg);
    if (ty === null || tp === null) return { ...zero };
    const yaw = wrapPartnerCheckYawDeg(ty) * k;
    const pitch = (clampPartnerCheckPitchDeg(tp) ?? 0) * k;
    return {
      active: true,
      yawDeg: yaw === 0 ? 0 : yaw,
      pitchDeg: pitch === 0 ? 0 : pitch,
    };
  } catch { return { active: false, yawDeg: 0, pitchDeg: 0 }; }
}

// --- 自己テスト (統合前の契約確認用。REPORT §6 の検証 1 に対応) ---
// runPartnerCheckSelfTests() -> { pass, fail, failures: string[] }
// 例外を投げない。失敗は failures へ名前だけを積む。直接実行
// (node partnercheck_math.js) したときも同じ関数を回して結果を
// 表示し、失敗があれば終了コード 1 を返す。
export function runPartnerCheckSelfTests() {
  let pass = 0; const failures = [];
  const ok = (c, n) => { if (c) pass++; else failures.push(n); };
  const near = (a, b, eps = 1e-9) => typeof a === "number" && Math.abs(a - b) <= eps;
  try {
    const edge = (over = {}) => ({
      ownerHurtEdge: true, dist: 8, targetYawDeg: 30, targetPitchDeg: 10, suppressed: false, ...over,
    });

    // 定数 (REPORT §4 の固定値)
    ok(PARTNERCHECK_DURATION_MS === 700 && PARTNERCHECK_COOLDOWN_MS === 8000, "P-01 duration/cooldown");
    ok(PARTNERCHECK_MIN_DIST === 2.0 && PARTNERCHECK_MAX_DIST === 24.0, "P-02 dist band 3D");
    ok(PARTNERCHECK_RISE_MS === 120 && PARTNERCHECK_HOLD_MS === 280 && PARTNERCHECK_FALL_MS === 300
      && PARTNERCHECK_RISE_MS + PARTNERCHECK_HOLD_MS + PARTNERCHECK_FALL_MS === PARTNERCHECK_DURATION_MS,
      "P-03 rise+hold+fall=duration");
    ok(Object.isFrozen(PARTNERCHECK_CONSTANTS) && PARTNERCHECK_CONSTANTS.DURATION_MS === 700, "P-04 constants frozen");

    // 包絡: 入り線形・保持 1・戻り線形・出口で完全な 0
    ok(partnerCheckEnvelope(0) === 0 && partnerCheckEnvelope(700) === 0
      && partnerCheckEnvelope(-1) === 0 && partnerCheckEnvelope(NaN) === 0, "P-05 envelope edges");
    ok(partnerCheckEnvelope(60) === 0.5 && partnerCheckEnvelope(120) === 1
      && partnerCheckEnvelope(399) === 1, "P-06 envelope rise/hold");
    ok(near(partnerCheckEnvelope(550), 0.5) && partnerCheckEnvelope(699) > 0
      && partnerCheckEnvelope(699) < 0.01, "P-07 envelope fall linear");

    // 検証 1: 所有者の被弾辺 1 回 (距離 8・抑制なし) → 発火 1 回、
    // 700ms で目標角へ出て完全な 0 へ戻る
    {
      const st = createPartnerCheckState();
      const ret = notePartnerCheck(st, edge(), 1000);
      ok(ret === st && st.firedCount === 1 && st.activeFromMs === 1000
        && st.targetYawDeg === 30 && st.targetPitchDeg === 10, "P-08 v1 fires once, target fixed");
      ok(st.lastRecord?.fired === true && st.lastRecord?.reason === "fired"
        && st.lastRecord?.dist === 8 && st.lastRecord?.atMs === 1000, "P-09 v1 record written");
      const peak = partnerCheckOffset(st, 1120);
      ok(peak.active === true && peak.yawDeg === 30 && peak.pitchDeg === 10, "P-10 v1 peak offsets");
      ok(partnerCheckOffset(st, 1300).yawDeg === 30, "P-11 v1 hold keeps target");
      ok(near(partnerCheckOffset(st, 1550).yawDeg, 15), "P-12 v1 fall midpoint half");
      const end = partnerCheckOffset(st, 1700);
      ok(end.active === false && end.yawDeg === 0 && end.pitchDeg === 0, "P-13 v1 exact zero at 700ms");
      ok(isPartnerCheckActive(st, 1699) === true && isPartnerCheckActive(st, 1700) === false, "P-14 v1 active window");
    }

    // 検証 2: 連続被弾 (辺が 1 秒間隔で 5 回) → クールダウンにより発火は初回のみ
    {
      const st = createPartnerCheckState(); let fires = 0;
      for (let i = 0; i < 5; i++) {
        const before = st.firedCount;
        notePartnerCheck(st, edge(), 1000 + i * 1000);
        if (st.firedCount > before) fires++;
      }
      ok(fires === 1 && st.firedCount === 1 && st.lastReason === "cooldown", "P-15 v2 five edges -> one fire");
      ok(partnerCheckDue(st, 8999) === false && partnerCheckDue(st, 9000) === true, "P-16 v2 due boundary");
      notePartnerCheck(st, edge(), 9000);
      ok(st.firedCount === 2, "P-17 v2 refire at cooldown boundary");
    }

    // 検証 3: 距離 1.5 / 距離 30 の辺 → 発火しない (記録のみ)。境界は発火
    {
      const st = createPartnerCheckState();
      notePartnerCheck(st, edge({ dist: 1.5 }), 0);
      ok(st.firedCount === 0 && st.lastReason === "too_close" && st.lastRecord?.fired === false, "P-18 v3 too close record-only");
      notePartnerCheck(st, edge({ dist: 30 }), 100);
      ok(st.firedCount === 0 && st.lastReason === "too_far", "P-19 v3 too far");
      ok(shouldPartnerCheck(createPartnerCheckState(), edge({ dist: 2.0 }), 0) === true
        && shouldPartnerCheck(createPartnerCheckState(), edge({ dist: 24.0 }), 0) === true, "P-20 v3 boundaries inclusive");
      // 3D 距離: 真上 8 (水平 0・鉛直 8) でも距離帯に入れば発火する
      ok(shouldPartnerCheck(createPartnerCheckState(),
        edge({ dist: undefined, selfPos: { x: 0, y: 64, z: 0 }, ownerPos: { x: 0, y: 72, z: 0 } }), 0) === true,
        "P-21 v3 vertical distance is 3D");
      ok(near(partnerCheckDistance3D({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }), 5)
        && partnerCheckDistance3D(null, { x: 0, y: 0, z: 0 }) === null, "P-22 v3 distance helper");
    }

    // 検証 4: 他プレイヤーの被弾辺 → 発火しない
    {
      const st = createPartnerCheckState();
      notePartnerCheck(st, edge({ ownerHurtEdge: false }), 0);
      ok(st.firedCount === 0 && st.lastReason === "no_edge", "P-23 v4 no edge no fire");
      notePartnerCheck(st, edge({ isOwner: false }), 100);
      ok(st.firedCount === 0 && st.lastReason === "not_owner", "P-24 v4 non-owner no fire");
    }

    // 検証 5: 抑制中の辺 → 発火せず、抑制解除後にも遅れて発火しない (辺の消費)
    {
      const st = createPartnerCheckState();
      notePartnerCheck(st, edge({ suppressed: true }), 1000);
      ok(st.firedCount === 0 && st.lastReason === "suppressed"
        && st.lastFiredAtMs === null && st.activeFromMs === null, "P-25 v5 suppressed no fire, cooldown untouched");
      ok(partnerCheckOffset(st, 1100).active === false && partnerCheckOffset(st, 99999).active === false,
        "P-26 v5 no delayed fire");
      for (const key of ["selfHurt", "inCombat", "working", "digging", "placing", "attacking",
        "falling", "inWater", "swimming", "climbing", "dead", "restoring", "flinchActive", "otherOverlayActive"]) {
        ok(shouldPartnerCheck(createPartnerCheckState(), edge({ [key]: true }), 0) === false, `P-27 v5 suppress ${key}`);
      }
      ok(shouldPartnerCheck(createPartnerCheckState(), edge({ suppressed: 1, inCombat: "yes" }), 0) === true,
        "P-28 v5 suppression is strict-true only");
      // 正面にいる場合は記録のみ。環境ダメージは種別で絞らない (damageKind は無視される)
      const st2 = createPartnerCheckState();
      notePartnerCheck(st2, edge({ ownerInFront: true }), 0);
      ok(st2.firedCount === 0 && st2.lastReason === "owner_in_front", "P-29 v5 owner in front record-only");
      ok(shouldPartnerCheck(createPartnerCheckState(), edge({ damageKind: "fall" }), 0) === true,
        "P-30 v5 environmental damage not filtered");
    }

    // 窓の再生中の第 2 の辺 → 目標角不変・窓は延長されない
    {
      const st = createPartnerCheckState();
      notePartnerCheck(st, edge(), 1000);
      notePartnerCheck(st, edge({ targetYawDeg: -50, targetPitchDeg: -20 }), 1300);
      ok(st.firedCount === 1 && st.activeFromMs === 1000 && st.targetYawDeg === 30
        && st.lastReason === "window_active", "P-31 window active: target/window unchanged");
      ok(partnerCheckOffset(st, 1700).active === false, "P-32 window not extended");
    }

    // 検証 6: NaN / 欠けた入力列 → 例外 0、発火 0、有限値のみ返す
    {
      const badSamples = [
        edge({ dist: NaN }), edge({ dist: undefined, selfPos: null, ownerPos: null }),
        edge({ targetYawDeg: NaN }), edge({ targetPitchDeg: Infinity }),
        edge({ ownerHurtEdge: undefined }), null, undefined, "x", {},
      ];
      let allSafe = true;
      for (const s of badSamples) {
        const st = createPartnerCheckState();
        let out;
        try { notePartnerCheck(st, s, 1000); out = partnerCheckOffset(st, 1100); }
        catch { allSafe = false; continue; }
        if (st.firedCount !== 0 || out.active !== false
          || !Number.isFinite(out.yawDeg) || !Number.isFinite(out.pitchDeg)) allSafe = false;
      }
      ok(allSafe, "P-33 v6 invalid inputs safe, no fire, finite outputs");
      ok(notePartnerCheck(null, edge(), 0) === null && partnerCheckOffset(null, 0).active === false
        && partnerCheckOffset(undefined, NaN).yawDeg === 0, "P-34 v6 null state safe");
      ok(shouldPartnerCheck(null, null, NaN) === false && classifyPartnerCheck(null, null, NaN) === "bad_input",
        "P-35 v6 classify null safe");
      // 時計巻き戻し: 発火時刻より前のサンプルは不活性
      const st = createPartnerCheckState();
      notePartnerCheck(st, edge(), 5000);
      ok(partnerCheckOffset(st, 4000).active === false && isPartnerCheckActive(st, 4000) === false,
        "P-36 v6 clock rollback inactive");
    }

    // 角度: ピッチは gaze 範囲 [-60, +75] に収まる。ヨーは wrap のみ
    {
      const st = createPartnerCheckState();
      notePartnerCheck(st, edge({ targetYawDeg: 350, targetPitchDeg: 120 }), 0);
      ok(st.targetYawDeg === -10 && st.targetPitchDeg === 75, "P-37 yaw wraps, pitch clamps to gaze max");
      const st2 = createPartnerCheckState();
      notePartnerCheck(st2, edge({ targetPitchDeg: -120 }), 0);
      ok(st2.targetPitchDeg === -60, "P-38 pitch clamps to gaze min");
      ok(wrapPartnerCheckYawDeg(190) === -170 && wrapPartnerCheckYawDeg(-180) === 180, "P-39 wrap helper");
      ok(clampPartnerCheckPitchDeg(NaN) === null, "P-40 pitch clamp NaN -> null");
    }

    // 決定的 / reset
    {
      const run = () => {
        const st = createPartnerCheckState(); const out = [];
        const seq = [[0, {}], [1000, {}], [2000, { suppressed: true }], [8000, {}], [9000, {}]];
        for (const [t, over] of seq) { notePartnerCheck(st, edge(over), t); out.push(st.lastReason); }
        return out.join(",");
      };
      ok(run() === run() && run() === "fired,cooldown,suppressed,fired,cooldown", "P-41 deterministic sequence");
      const st = createPartnerCheckState();
      notePartnerCheck(st, edge(), 0);
      resetPartnerCheckState(st);
      ok(st.activeFromMs === null && st.lastFiredAtMs === null && st.firedCount === 0
        && st.lastRecord === null && partnerCheckDue(st, 0) === true, "P-42 reset");
    }
  } catch (e) {
    failures.push("P-XX self-test threw: " + (e && e.message ? e.message : String(e)));
  }
  return { pass, fail: failures.length, failures };
}

// 直接実行時のみ自己テストを回す (import 時は副作用なし)。
try {
  const isMain = typeof process !== "undefined" && Array.isArray(process.argv)
    && typeof process.argv[1] === "string" && import.meta.url.endsWith(process.argv[1].split("/").pop());
  if (isMain) {
    const r = runPartnerCheckSelfTests();
    console.log(`partnercheck_math_draft: ${r.pass} passed, ${r.fail} failed`);
    for (const f of r.failures) console.log("FAIL", f);
    if (typeof process !== "undefined") process.exitCode = r.fail ? 1 : 0;
  }
} catch { /* 自己テストの表示失敗は本体の契約に影響させない */ }
