// deposit_guard_math.js — cycle0659: deposit (拠点入庫) の出口ガード純粋核 (deliver_guard_math.js と同型)
//   既存の deliver_guard_math.js (A18-TR-01, planner deliver_to_owner 用) と同型・同作法で書く。
//   純粋モジュール: @minecraft/server を import しない。例外を投げない。状態は引数の state のみを変更する。
//
// 解く欠陥 (原典: brain_parts/solutions/cycle0537-a20/REPORT.md F1/F3/F4、
//           再確認: tests/cycle0553_a05_deposit.md — v0.5.51 時点で残存、本ドラフト作成時に v0.5.54 実読でも残存を確認):
//   F1 deposit 満杯無出口: execArrive の deposit 分岐 (main.js:905-922 相当) は、コンテナあり・満杯時
//      (res.failed) に recordStore + chest_full 発話のみで、失敗カウンタ・冷却・noteFail が無い。
//      脳ルールが deposit を選び続ける限り transferFiltered の全スロット走査を無期限に繰り返す。
//      → 本核の noteDepositOutcome / isDepositCooling が deliver 側と同型の出口を与える。
//   F3 deposit 満杯が r.deliverFail に未反映: deliver 分岐は r.deliverFail = res.failed とするのに
//      deposit の cc あり分岐は更新しない (no_container 分岐だけ true にする非対称)。
//      → 本核の nextDepositDeliverFail が「次の deliverFail 値」を純粋に決める (統合側は代入1行)。
//   F4 planner deposit_at_home の次元ゲート欠落: main.js:1280 相当は homeOf があれば次元を見ず
//      r.target に拠点座標を張り execArrive を呼ぶ。execArrive 側ゲートが転送は止めるが、
//      到達不能な移動目標が張られ続け硬い見切りが無い。
//      → 本核の depositGate / planDepositDecision が planner 側の判定を fail-closed で一元化する。
//
// 設計判断:
//   - 上限・冷却の値は deliver_guard_math.js と同値 (3回 / 60000ms) に揃える。受け渡し系で
//     見切りの感覚を統一するため。longtask 側の LT_DELIVER_FAIL_LIMIT=60 / 300秒は
//     mission 文脈の出口であり、脳ルール/planner の毎tickループには長すぎるので流用しない。
//   - moved>0 (部分移送含む) は進捗として fails をリセットする (deliver 側と同義)。
//     残りが詰まるのは moved=0 の回だけで数える。
//   - moved=0 かつ failed でない「空振り」は recordStore の作法どおり失敗ではない (状態不変)。
//   - no_container は満杯と「同じ見切り」へ合流させる。現行 no_container 分岐は noteFail +
//     deliverFail=true + 60秒発話間引きまで持つが上限が無く、deposit ルールが勝ち続ければ
//     毎tick getBlock+走査が続く点では F1 と同根。理由は戻り値 reason で区別し、
//     統合側が noteFail のキーを出し分けられるようにする。
//   - 次元判定は fail-closed: dim が null/undefined/非文字列なら不一致として倒す
//     (P1/P8 で確立した作法。home.dim が欠けた旧データでも次元越し入庫をしない)。

export const DEPOSIT_FAIL_LIMIT = 3;
export const DEPOSIT_COOLDOWN_MS = 60000;

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function dimOrNull(v) { return typeof v === "string" && v.length > 0 ? v : null; }

// createDepositGuardState() -> { fails, cooldownUntil, lastReason }
// rt(bot) の初期化に r.depositGuard が無いため、統合側は deliverGuard と同型に
// 「無ければ作る」遅延初期化でよい (例: try { if (!r.depositGuard) r.depositGuard = createDepositGuardState(); } catch {})
export function createDepositGuardState() { return { fails: 0, cooldownUntil: 0, lastReason: null }; }

// noteDepositOutcome(state, outcome, nowMs) -> { action, fails, reason }
// outcome: { moved, failed, noContainer }
//  - moved>0: 進捗 (部分移送含む)。fails=0、reason=null。action="progress"
//  - moved=0 かつ !failed かつ !noContainer: 空振り。状態不変。action="empty"
//  - moved=0 かつ (failed || noContainer): 連続失敗として加算。action="fail"
//    上限到達で cooldownUntil=now+DEPOSIT_COOLDOWN_MS、fails=0 リセット。action="cooldown"
//    reason は "full" (failed) / "no_container" (noContainer) のどちらで倒れたかを返す。
//    failed と noContainer が同時 true の場合は "full" を優先する (実害の大きい側)。
//  - 入力不正 (state でない / now が有限数でない / outcome でない): 状態を変えず action="invalid"
export function noteDepositOutcome(state, outcome, nowMs) {
  try {
    if (!state || typeof state !== "object") return { action: "invalid", fails: 0, reason: null };
    const now = finiteOrNull(nowMs);
    if (now === null || !outcome || typeof outcome !== "object") return { action: "invalid", fails: state.fails || 0, reason: null };
    const moved = typeof outcome.moved === "number" && Number.isFinite(outcome.moved) ? outcome.moved : 0;
    if (moved > 0) { state.fails = 0; state.lastReason = null; return { action: "progress", fails: 0, reason: null }; }
    const isFull = outcome.failed === true;
    const isNoContainer = outcome.noContainer === true;
    if (!isFull && !isNoContainer) return { action: "empty", fails: state.fails || 0, reason: null };
    const reason = isFull ? "full" : "no_container";
    state.fails = (Number.isInteger(state.fails) && state.fails > 0 ? state.fails : 0) + 1;
    state.lastReason = reason;
    if (state.fails >= DEPOSIT_FAIL_LIMIT) {
      state.fails = 0;
      state.cooldownUntil = now + DEPOSIT_COOLDOWN_MS;
      return { action: "cooldown", fails: 0, reason };
    }
    return { action: "fail", fails: state.fails, reason };
  } catch { return { action: "invalid", fails: 0, reason: null }; }
}

// isDepositCooling(state, nowMs) -> boolean
// 冷却中は統合側で transferFiltered 自体を呼ばない (走査コストと無駄な移動目標を止めるのが F1 の出口)。
export function isDepositCooling(state, nowMs) {
  try {
    if (!state || typeof state !== "object") return false;
    const now = finiteOrNull(nowMs), until = finiteOrNull(state.cooldownUntil);
    if (now === null || until === null) return false;
    return now < until;
  } catch { return false; }
}

// nextDepositDeliverFail(prev, outcome) -> boolean  (F3 是正用の純粋判定)
//  - moved>0: false (入庫できた。部分移送でも「届いた」側)
//  - moved=0 かつ (failed || noContainer): true (満杯/コンテナ無しは deliverFail に反映する)
//  - 空振り (moved=0, !failed, !noContainer): prev を保持 (現行 deliver 分岐の代入と違い、
//    空振りで過去の失敗を消さない。deliver 側 r.deliverFail=res.failed の非対称解消が目的)
//  - 入力不正: prev を boolean 化して返す (例外なし)
export function nextDepositDeliverFail(prev, outcome) {
  try {
    if (!outcome || typeof outcome !== "object") return !!prev;
    const moved = typeof outcome.moved === "number" && Number.isFinite(outcome.moved) ? outcome.moved : 0;
    if (moved > 0) return false;
    if (outcome.failed === true || outcome.noContainer === true) return true;
    return !!prev;
  } catch { return !!prev; }
}

// depositGate(input) -> { ok, reason }
// input: { homePresent, homeDim, botDim, distToHome, range }
// 実行点 (execArrive deposit) の入口判定を純粋化したもの。現行の2条件
// (home 有無+home.dim 一致 / 距離 <= DELIVER_RANGE) に fail-closed を足した形。
//  - homePresent !== true            -> { ok:false, reason:"no_home" }
//  - homeDim と botDim が両方とも有効な文字列で一致しない (片方欠落含む)
//                                      -> { ok:false, reason:"dim_mismatch" }
//  - distToHome / range が有限数でない -> { ok:false, reason:"out_of_range" } (測れないものは届かない扱い)
//  - distToHome > range               -> { ok:false, reason:"out_of_range" }
//  - それ以外                          -> { ok:true,  reason:null }
export function depositGate(input) {
  try {
    if (!input || typeof input !== "object") return { ok: false, reason: "no_home" };
    if (input.homePresent !== true) return { ok: false, reason: "no_home" };
    const hd = dimOrNull(input.homeDim), bd = dimOrNull(input.botDim);
    if (hd === null || bd === null || hd !== bd) return { ok: false, reason: "dim_mismatch" };
    const d = finiteOrNull(input.distToHome), range = finiteOrNull(input.range);
    if (d === null || range === null || d > range) return { ok: false, reason: "out_of_range" };
    return { ok: true, reason: null };
  } catch { return { ok: false, reason: "no_home" }; }
}

// ---- DEPOSIT-SUPPRESS-AND-GATE 是正 (cycle0900, a13 cycle0832 実測確定) ----
// 旧計数は tickAutonomy の case "deposit_at_home" の yield 側にしか無く、「冷却中に goal として
// 選ばれている」ことを要求したが、冷却中は選択ゲート (depositBlocked→効用0) が選出を不可能に
// するため AND が両立せず、楽観200,000tick・冷却167周期でも抑制発動0回だった。
// 是正: 冷却の立ち上がりエッジを goal 選択に依存しない毎tickの場所 (buildContext) で数える純粋核。
// fields: { coolSeen, coolCycles, suppressedUntil } (rt の該当3フィールドを束ねたオブジェクト)
export const DEPOSIT_SUPPRESS_CYCLES = 3;
export const DEPOSIT_SUPPRESS_MS = 600000;
export function noteDepositCoolEdge(fields, cooling, suppressed, nowMs) {
  try {
    if (!fields || typeof fields !== "object") return { action: "invalid", cycles: 0 };
    const now = finiteOrNull(nowMs);
    if (now === null) return { action: "invalid", cycles: fields.coolCycles || 0 };
    if (cooling !== true) { fields.coolSeen = false; return { action: "none", cycles: fields.coolCycles || 0 }; }
    if (suppressed === true || fields.coolSeen === true) return { action: "none", cycles: fields.coolCycles || 0 };
    fields.coolSeen = true;
    fields.coolCycles = (Number.isInteger(fields.coolCycles) && fields.coolCycles > 0 ? fields.coolCycles : 0) + 1;
    if (fields.coolCycles >= DEPOSIT_SUPPRESS_CYCLES) {
      fields.coolCycles = 0;
      fields.suppressedUntil = now + DEPOSIT_SUPPRESS_MS;
      return { action: "suppress", cycles: 0, suppressedUntil: fields.suppressedUntil };
    }
    return { action: "counted", cycles: fields.coolCycles };
  } catch { return { action: "invalid", cycles: 0 }; }
}
// 成功入庫 (progress) で周期カウンタを戻す (潜在欠陥 C-2: 成功でも減らない単調カウンタの是正)
export function resetDepositCoolCycles(fields) {
  try { if (fields && typeof fields === "object") fields.coolCycles = 0; } catch {}
}

// planDepositDecision(input) -> { action, reason }  (F4 是正用: planner deposit_at_home の判断)
// input: { homePresent, homeDim, botDim, distToHome, range, cooling }
//  - cooling === true        -> { action:"yield", reason:"cooldown" }    (目標を張らず他 goal へ譲る)
//  - home 無し               -> { action:"yield", reason:"no_home" }
//  - 次元不一致 (fail-closed) -> { action:"yield", reason:"dim_mismatch" } (現行の無条件 target 張りを止める)
//  - 距離超過                -> { action:"approach", reason:"out_of_range" } (拠点座標へ移動目標を張るのは正当)
//  - 到達圏内                -> { action:"attempt", reason:null }          (execArrive deposit を呼んでよい)
// 優先順は cooldown > no_home > dim_mismatch > out_of_range > attempt。
// cooldown を最優先にするのは、満杯見切り中に approach で拠点へ張り付く往復を防ぐため。
export function planDepositDecision(input) {
  try {
    if (!input || typeof input !== "object") return { action: "yield", reason: "no_home" };
    if (input.cooling === true) return { action: "yield", reason: "cooldown" };
    const g = depositGate(input);
    if (g.ok) return { action: "attempt", reason: null };
    if (g.reason === "out_of_range") return { action: "approach", reason: "out_of_range" };
    return { action: "yield", reason: g.reason };
  } catch { return { action: "yield", reason: "no_home" }; }
}
