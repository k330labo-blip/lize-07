// session_forbids.js — Phase5 セッション禁止 (sessionForbids) の保存形の純粋核 (cycle1923)
// 仕様の正: brain_parts/solutions/cycle1923-a01-sessionforbids/REPORT.md / cycle1923-a18 validate 案
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// 保存先は entity DP の cb_forbids (main.js 側)。本核は JSON 文字列⇔レコード列の
// 変換とサニタイズだけを担う。レコード形は現行メモリ内形 {target, verb, at} を正とする。
export const FORBIDS_CAP = 32;

// forbids G4 (cycle0505): 正規化の単一の正。コロンが無ければ minecraft: を補う (既存規則不変)。
export const normForbiddenId = (id) => (typeof id === "string" && id && !id.includes(":") ? "minecraft:" + id : id);

export function sanitizeForbids(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const f of list) {
    if (!f || typeof f.target !== "string" || !f.target) continue;
    const verb = typeof f.verb === "string" ? f.verb : null;
    const target = normForbiddenId(f.target); // G4-3: norm 後に dedupe し、正規化形で保存する
    if (out.some((g) => g.target === target && g.verb === verb)) continue;
    out.push({ target, verb, at: Number.isFinite(f.at) ? f.at : 0 });
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
    const norm = normForbiddenId;
    const blocked = typeof mo.target === "string" && list.some((f) => norm(f.target) === norm(mo.target) && forbidVerbMatches(f.verb, kind));
    const extra = list.filter((f) => forbidVerbMatches(f.verb, kind)).map((f) => norm(f.target)); // G4-2: 伝播も norm 済みで返す
    const cur = Array.isArray(mo.constraints?.forbiddenTargets) ? mo.constraints.forbiddenTargets : [];
    const merged = [...new Set([...cur.map((id) => norm(id)), ...extra])].filter((id) => norm(id) !== norm(mo.target));
    return { blocked, mo: { ...mo, constraints: { ...(mo.constraints || {}), forbiddenTargets: merged } } };
  } catch { return { blocked: false, mo }; }
}

// Phase5 読み手 G6-b/G2 (cycle0117): 禁止対象 id の純粋核。verb 規則は forbidVerbMatches を再利用する (二重実装しない)。
// normForbiddenId は cycle0505 でファイル上部へ繰り上げて export 化した (定義は1つだけ)。
export function forbiddenTargetIds(forbids, kind = "gather") {
  try {
    const list = sanitizeForbids(forbids);
    return [...new Set(list.filter((f) => forbidVerbMatches(f.verb, kind)).map((f) => normForbiddenId(f.target)).filter((x) => typeof x === "string" && x))];
  } catch { return []; }
}
export function unionForbiddenIds(ltIds, forbids, kind = "gather") {
  try {
    const base = Array.isArray(ltIds) ? ltIds.map(normForbiddenId).filter((x) => typeof x === "string" && x) : [];
    return [...new Set([...base, ...forbiddenTargetIds(forbids, kind)])];
  } catch { return []; }
}

// --- cycle1604: release (0-C2). Remove only records matching target (+verb when
// given; verb omitted removes every verb for that target). Input is not mutated;
// `removed` lets the caller report exactly what was lifted. ---
export function removeSessionForbids(list, targetId, verb = undefined) {
  try {
    const cur = sanitizeForbids(list);
    const t = normForbiddenId(targetId);
    if (typeof t !== "string" || !t) return { list: cur, removed: [] };
    const removed = [], kept = [];
    for (const f of cur) {
      const hit = f.target === t && (verb === undefined || f.verb === verb);
      (hit ? removed : kept).push(f);
    }
    return { list: kept, removed };
  } catch { return { list: [], removed: [] }; }
}

// --- forbids G6-c (cycle0628): 自律作業対象の禁止照合 (B案・純粋核) ---
function dropCandidatesG6c(dropOf, typeId) {
  if (typeof dropOf !== "function") return [];
  let d;
  try { d = dropOf(typeId); } catch { return []; }
  if (typeof d === "string" && d) return [d];
  if (Array.isArray(d)) return d.filter((x) => typeof x === "string" && x);
  return [];
}
export function isForbiddenWorkTarget(forbids, typeId, dropOf) {
  try {
    if (typeof typeId !== "string" || !typeId) return false;
    const ids = forbiddenTargetIds(forbids, "gather");
    if (!ids.length) return false;
    const set = new Set(ids);
    if (set.has(normForbiddenId(typeId))) return true;
    for (const cand of dropCandidatesG6c(dropOf, typeId)) {
      if (set.has(normForbiddenId(cand))) return true;
    }
    return false;
  } catch { return false; }
}

// --- cycle-next v0.5.79: recompute (0-C2 release reflection). The old refresh was
// union-only (monotonic): once a session forbid entered a running task's snapshot
// it never left, even after the owner released it (cycle1604 added the release
// path). recompute = base (order-origin ids, fixed at task start) + the CURRENT
// session forbids, so a released forbid drops out on the next refresh while a
// newly recorded one still arrives. deriveBase recovers base from a legacy
// snapshot by subtracting the ids the current session accounts for.
export function recomputeForbiddenIds(baseIds, forbids, kind = "gather") {
  try {
    const base = Array.isArray(baseIds) ? baseIds.map(normForbiddenId).filter((x) => typeof x === "string" && x) : [];
    return [...new Set([...base, ...forbiddenTargetIds(forbids, kind)])];
  } catch { return []; }
}
export function deriveBaseForbiddenIds(snapshotIds, forbids, kind = "gather") {
  try {
    const snap = Array.isArray(snapshotIds) ? snapshotIds.map(normForbiddenId).filter((x) => typeof x === "string" && x) : [];
    const sess = new Set(forbiddenTargetIds(forbids, kind));
    return [...new Set(snap.filter((id) => !sess.has(id)))];
  } catch { return []; }
}
