// obs.js — Phase1 読み手向け三状態ヘルパ（純粋関数・例外安全）
// 契約: tests/test_obs_contract_cases.md / tests/test_obs_contract.mjs
// obs が無い文脈は従来解釈（true）にフォールバック。obs が在れば obs が正（旧 scanOk/invOk は見ない）。
export function scanKnown(ctx) { return ctx?.x?.obs ? ctx.x.obs.scan === "ok" : true; }
export function invKnown(ctx) { return ctx?.x?.obs ? ctx.x.obs.inv === "ok" : true; }
export function percKnown(ctx) { const p = ctx?.x?.obs?.perc; if (!p) return true; if (typeof p === "string") return p !== "unavailable" && p !== "unknown"; return p.state !== "unavailable"; }
// nearBed の否定（「近くにベッドは無い」）が信用できるか — sleep 系読み手用（cycle1315, Phase1残件）
// 契約: tests/cycle1217_sleep_cases.md §1。percKnown と違い failedCells 過半数も不可とする
// （planner.js のローカル percKnown と同じ完全性判定に寄せる）。
// 戻り値が true のときだけ「nearBed!==true」を不在の根拠に使ってよい:
//   obs が無い文脈は従来解釈 (true)。perc チャネル自体が無い obs も従来解釈 (true)。
export function bedAbsentKnown(ctx) {
  const obs = ctx?.x?.obs;
  if (!obs) return true;
  const p = obs.perc;
  if (!p) return true;
  if (typeof p === "string") return p !== "unavailable" && p !== "unknown";
  if (p.state !== "fresh" && p.state !== "cached") return false;
  const f = p.failedCells, t = p.totalCells;
  if (typeof f === "number" && typeof t === "number" && t > 0 && f * 2 > t) return false;
  return ctx?.x?.nearBed !== true;
}
// 距離系キーの三状態読み: perc が unavailable または失敗セル過半数なら undefined（「測れていない」を「無い」と読まない）
const DIST_KEYS = new Set(["nearestTreeDist", "nearestOreDist", "nearestStoneDist", "cropReadyDist"]);
export function perObs(ctx, key) {
  const v = ctx?.x?.[key] ?? ctx?.perception?.[key] ?? ctx?.[key];
  if (!DIST_KEYS.has(key)) return v;
  const p = ctx?.x?.obs?.perc;
  if (p && typeof p === "object") {
    if (p.state === "unavailable") return undefined;
    const f = p.failedCells, t = p.totalCells;
    if (typeof f === "number" && typeof t === "number" && t > 0 && f * 2 > t) return undefined;
  }
  return v;
}
