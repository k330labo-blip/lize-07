// inspect_math.js — 依頼品入手時の検分 POLISH-ANIM-INSPECT-01 (純粋核)
// 出典: brain_parts/solutions/cycle0942-a08/DRAFT.md §2 (仕様の正)
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// 表示層のみ: 取得可否・個数・進捗記録・移動には一切触らない。
// ピッチ符号: gaze_math の戻り値 x と同じ系 (下向きが正)。符号定数は新設しない。
import { GAZE_PITCH_MIN, GAZE_PITCH_MAX } from "./gaze_math.js";

export const INSPECT_DURATION_MS = 800;   // 見下ろし→保持→復帰の全体
export const INSPECT_MAX_DEG = 32;        // 手元を見る深さ (NOD の 12 度より深い)
export const INSPECT_COOLDOWN_MS = 15000; // 連続取得・一括回収で乱発させない

function finiteOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// inspectPitchOffset(elapsedMs) -> 追加ピッチ (度, 下向き正) | null (範囲外=無効)
// 台形波: t 0〜0.3 上昇 (sin で滑らかに) / 0.3〜0.65 保持 / 0.65〜1 復帰 (cos)。
// 負値・非数・NaN・DURATION 以上は例外なく null。
export function inspectPitchOffset(elapsedMs) {
  try {
    const e = finiteOrNull(elapsedMs);
    if (e === null || e < 0 || e >= INSPECT_DURATION_MS) return null;
    const t = e / INSPECT_DURATION_MS;
    const k = t < 0.3 ? Math.sin((t / 0.3) * Math.PI / 2)
            : t < 0.65 ? 1
            : Math.cos(((t - 0.65) / 0.35) * Math.PI / 2);
    return INSPECT_MAX_DEG * k;
  } catch { return null; }
}

// applyInspectPitch(basePitchDeg, elapsedMs) -> クランプ済みピッチ
// オフセット無効時・base 非有限時は base をそのまま返す (呼び出し側を分岐させない)。
export function applyInspectPitch(basePitchDeg, elapsedMs) {
  try {
    const off = inspectPitchOffset(elapsedMs);
    if (off === null || !Number.isFinite(basePitchDeg)) return basePitchDeg;
    return Math.max(GAZE_PITCH_MIN, Math.min(GAZE_PITCH_MAX, basePitchDeg + off));
  } catch { return basePitchDeg; }
}

// isInspectActive(startedAtMs, nowMs): startedAtMs が有効な発火時刻で、
// nowMs がその DURATION 内にあるか。時計巻き戻し (now < start) は無効に倒す。
export function isInspectActive(startedAtMs, nowMs) {
  try {
    const s = finiteOrNull(startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    return inspectPitchOffset(n - s) !== null;
  } catch { return false; }
}

// inspectDue(lastFiredMs, nowMs): クールダウン判定。
// 初回 (lastFiredMs が非有限) は true。nowMs 非有限は false (発火させない側に倒す)。
export function inspectDue(lastFiredMs, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    const last = finiteOrNull(lastFiredMs);
    if (last === null) return true;
    return n - last >= INSPECT_COOLDOWN_MS;
  } catch { return false; }
}

// resolveInspectTargetId(mission, longtask) -> 目標アイテム id | null
// 取得側に新しい目標管理を持たせないための「参照だけ」の解決関数。
// - mission は missionSummary 形でも生形でも受ける: summary.target (= order.target)、
//   生形は order.target。現在ステップの target は採用しない (寄り道 side_collect の
//   対象まで「依頼品」に広げない。原典 §2.3 (a) は mission/longtask の目標が正)。
// - longtask は r.longtask の生形: target (= plan.target.item) を使う。
//   legs[legIdx].item は中間素材であり採用しない。
// - "group:" 形・空文字・非文字列は null (完全一致でしか判定しないため、
//   グループ対象は UNKNOWN として無反応に倒す。派生物へも広げない)。
export function resolveInspectTargetId(mission, longtask) {
  try {
    const m = mission && typeof mission === "object" ? mission : null;
    const cand = [
      m ? (typeof m.target === "string" ? m.target : null) : null,
      m && m.order && typeof m.order.target === "string" ? m.order.target : null,
      longtask && typeof longtask.target === "string" ? longtask.target : null,
    ];
    for (const c of cand) {
      if (typeof c === "string" && c.length > 0 && !c.startsWith("group:")) return c;
    }
    return null;
  } catch { return null; }
}

// shouldInspect(input) -> boolean: 発火条件 (a)(b)(c) の純粋判定。
// input: { pickedTypeId, mission, longtask, dangerCount, dangerKnown, lastFiredMs, nowMs }
// (a) pickedTypeId が目標 id と完全一致 (目標が解決できない文脈では発火しない)
// (b) 危険でない: dangerKnown === true かつ dangerCount === 0 のときだけ安全とみなす
//     (危険が UNKNOWN の間は出さない。原典の「ctx の danger が空」を、
//      ctx.x.obs.scan が "ok" でない間は danger 未確定として厳密化したもの)
// (c) inspectDue (15秒クールダウン) を満たす
// いずれも欠ければ false。例外を投げない。
export function shouldInspect(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (typeof input.pickedTypeId !== "string" || input.pickedTypeId.length === 0) return false;
    const target = resolveInspectTargetId(input.mission, input.longtask);
    if (target === null || input.pickedTypeId !== target) return false;
    if (input.dangerKnown !== true) return false;
    if (input.dangerCount !== 0) return false;
    return inspectDue(input.lastFiredMs, input.nowMs);
  } catch { return false; }
}
