// session_forbids.js — Phase5 セッション禁止 (sessionForbids) の保存形の純粋核 (cycle1923)
// 仕様の正: brain_parts/solutions/cycle1923-a01-sessionforbids/REPORT.md / cycle1923-a18 validate 案
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// 保存先は entity DP の cb_forbids (main.js 側)。本核は JSON 文字列⇔レコード列の
// 変換とサニタイズだけを担う。レコード形は現行メモリ内形 {target, verb, at} を正とする。
export const FORBIDS_CAP = 32;

export function sanitizeForbids(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const f of list) {
    if (!f || typeof f.target !== "string" || !f.target) continue;
    const verb = typeof f.verb === "string" ? f.verb : null;
    if (out.some((g) => g.target === f.target && g.verb === verb)) continue;
    out.push({ target: f.target, verb, at: Number.isFinite(f.at) ? f.at : 0 });
  }
  return out.slice(-FORBIDS_CAP);
}

// DP の JSON 文字列から復元する。壊れたデータは空配列へ倒す (fail-closed で捏造しない)。
export function restoreForbids(json) {
  if (!json || typeof json !== "string") return [];
  try { return sanitizeForbids(JSON.parse(json)); } catch { return []; }
}

export function serializeForbids(list) {
  return JSON.stringify(sanitizeForbids(list));
}

// Phase5 読み手 R1 (cycle2006): セッション禁止を注文へマージする純粋核。
// verb の一致規則は main の forbid ヒット判定と同一 (null=全動詞 / deliver は gather と同義)。
export function forbidVerbMatches(fVerb, kind) {
  return fVerb == null || fVerb === kind || (fVerb === "deliver" && kind === "gather");
}
export function mergeSessionForbids(forbids, mo) {
  try {
    if (!mo || typeof mo !== "object") return { blocked: false, mo };
    const list = sanitizeForbids(forbids);
    if (!list.length) return { blocked: false, mo };
    const kind = mo.kind || "gather";
    const norm = (id) => (typeof id === "string" && id && !id.includes(":") ? "minecraft:" + id : id);
    const blocked = typeof mo.target === "string" && list.some((f) => norm(f.target) === norm(mo.target) && forbidVerbMatches(f.verb, kind));
    const extra = list.filter((f) => forbidVerbMatches(f.verb, kind)).map((f) => f.target);
    const cur = Array.isArray(mo.constraints?.forbiddenTargets) ? mo.constraints.forbiddenTargets : [];
    const merged = [...new Set([...cur, ...extra])].filter((id) => norm(id) !== norm(mo.target));
    return { blocked, mo: { ...mo, constraints: { ...(mo.constraints || {}), forbiddenTargets: merged } } };
  } catch { return { blocked: false, mo }; }
}
