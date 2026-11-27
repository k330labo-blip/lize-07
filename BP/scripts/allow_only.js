// allow_only.js — 0-C2 reader (cycle1455): "X igai wa ~shinaide" allowOnly enforcement.
// r.allowOnly was stored in main but never read, so a later order for another target
// still started. This pure core decides whether a work target is allowed.
// Pure: no @minecraft/server import, never throws. No allowOnly => allow all.
export function normAllowId(v) {
  try {
    let s = null;
    if (typeof v === "string") s = v;
    else if (v && typeof v === "object") s = v.item || v.block || v.entity || v.target || v.id || null;
    if (typeof s !== "string" || !s) return null;
    s = s.trim().toLowerCase();
    if (!s) return null;
    return s.includes(":") ? s : `minecraft:${s}`;
  } catch { return null; }
}
export function normalizeAllowOnly(a) {
  try {
    if (!a || typeof a !== "object") return null;
    const target = normAllowId(a.target);
    if (!target) return null;
    return { target, verb: typeof a.verb === "string" ? a.verb : null, at: typeof a.at === "number" ? a.at : null };
  } catch { return null; }
}
// Returns true when targetId is allowed. Verb mismatch (allowOnly verb set and
// different from the requested verb) does not restrict other verbs.
export function isAllowedByAllowOnly(allowOnly, targetId, verb = null) {
  try {
    const a = normalizeAllowOnly(allowOnly);
    if (!a) return true;
    if (a.verb != null && verb != null && a.verb !== verb) return true;
    const t = normAllowId(targetId);
    if (!t) return true; // unknown target shape: do not block (fail-open for non-work paths)
    // Exact match only after normalization (short ids gain the minecraft: prefix
    // in normAllowId). No base-name matching: another namespace must not slip through.
    return t === a.target;
  } catch { return true; }
}
// ALLOWONLY-MIDMISSION-SCOPE-01 (cyc2425): prune side_collect steps that a
// mid-mission allowOnly disallows. Pruned steps are marked "done" so every
// reader that skips done steps (sideDirective etc.) stops selecting them, and
// order.sideTasks is filtered too so a rebuild/restore cannot resurrect them.
// Allowed side steps and done steps are untouched. Returns the pruned count.
export function pruneDisallowedSideSteps(mission, allowOnly) {
  try {
    if (!mission || !Array.isArray(mission.steps)) return 0;
    let pruned = 0;
    for (const s of mission.steps) {
      if (!s || s.type !== "side_collect" || s.status === "done") continue;
      if (!s.target) continue;
      if (!isAllowedByAllowOnly(allowOnly, s.target, s.kind || "gather")) { s.status = "done"; pruned++; }
    }
    if (Array.isArray(mission.order?.sideTasks)) {
      mission.order.sideTasks = mission.order.sideTasks.filter((st) => {
        const sid = typeof st?.target === "string" ? st.target : (st?.target?.item || st?.target?.block || st?.target?.entity || null);
        return !sid || isAllowedByAllowOnly(allowOnly, sid, st?.kind || "gather");
      });
    }
    return pruned;
  } catch { return 0; }
}
export function allowOnlyBlocks(allowOnly, targetId, verb = null) {
  try { return !isAllowedByAllowOnly(allowOnly, targetId, verb); } catch { return false; }
}
// U5-0 ruling (coordinator, cyc2387): the build entry is restricted ONLY by an
// allowOnly whose verb is exactly "build". verb:null (e.g. "zombie igai wa
// kougeki shinaide" -> clarify allowOnly) and gather/hunt allowOnly must NOT
// block building; reading them with the generic verb rule would over-block.
// legsOnly exemption in startMission is unchanged; cap is out of scope here.
export function isBuildAllowedByAllowOnly(allowOnly, targetId) {
  try {
    const a = normalizeAllowOnly(allowOnly);
    if (!a) return true;
    if (a.verb !== "build") return true;
    const t = normAllowId(targetId);
    if (!t) return true;
    return t === a.target;
  } catch { return true; }
}
// --- cycle1604: persistence + release (0-C2). Persistence and release ship together:
// a restriction that survives respawn must always be removable by the owner. ---
// Serialize via normalizeAllowOnly as the single source of truth; verb:null is
// preserved verbatim (null means "all verbs" on the reader side).
export function serializeAllowOnly(a) {
  try { const n = normalizeAllowOnly(a); return n ? JSON.stringify(n) : ""; } catch { return ""; }
}
export function restoreAllowOnly(json) {
  try {
    if (!json || typeof json !== "string") return null;
    return normalizeAllowOnly(JSON.parse(json)); // broken/shape-mismatched => null (no restriction)
  } catch { return null; }
}
// Release: no targetId => clear all. With a target, clear only on a normalized
// match and no verb conflict (same verb rule as isAllowedByAllowOnly).
export function clearAllowOnly(a, targetId = null, verb = null) {
  try {
    const n = normalizeAllowOnly(a);
    if (!n) return null;
    if (targetId == null) return null;
    const t = normAllowId(targetId);
    if (!t || t !== n.target) return n;
    if (n.verb != null && verb != null && n.verb !== verb) return n;
    return null;
  } catch { return null; }
}
