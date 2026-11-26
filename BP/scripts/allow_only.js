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
export function allowOnlyBlocks(allowOnly, targetId, verb = null) {
  try { return !isAllowedByAllowOnly(allowOnly, targetId, verb); } catch { return false; }
}
