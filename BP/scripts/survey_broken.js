// survey_broken.js — SURVEY-BROKEN-PERMANENT 是正の純粋核 (cycle0628 統合、元ドラフト cycle0628-a02)。
// Pure core for SURVEY-BROKEN-PERMANENT (cycle0606-a08/REPORT.md §5):
//   §5-3 progress resets fails, and §5-2 the global latch recovers after a cooldown.
//   §5-1 (granularity) is included only as the decision helpers needed by those two:
//   a single record crossing the limit quarantines THAT record, and the global
//   latch may trip only when failures spread across distinct records in a window.
//
// Integration instruction for the coordinator (do NOT apply in this draft cycle):
//   1. Copy this file verbatim to BP/scripts/survey_broken.js (no import edits
//      needed: it has no imports and never touches @minecraft/server).
//   2. In BP/scripts/main.js, keep the existing `surveyBroken` boolean ONLY as a
//      derived cache if convenient; the source of truth becomes a latch object
//      `let surveyLatch = createSurveyLatch();` plus per-record
//      `sv.quarantinedUntil` (number, 0/absent = not quarantined).
//   3. Executor (current main.js:2104 area), replace
//        else if (res === "error") { sv.fails++; if (sv.fails > 40) surveyBroken = true; ... }
//      with applySurveyChunkOutcome(...) below:
//        - write back outcome.fails to sv.fails for EVERY result (this is what
//          makes "done"/"partial" reset the counter — today only "error" writes it);
//        - if outcome.recordQuarantined, set sv.quarantinedUntil = outcome.quarantinedUntil
//          and skip that record in requestSurvey/executor selection until it expires;
//        - feed outcome into recordGlobalError(...) kept in a small module-level
//          array; when shouldTripGlobalLatch(...) is true, set
//          surveyLatch = tripSurveyLatch(surveyLatch, now).
//   4. surveyAvailable() must become cooldown-aware, otherwise §5-2 cannot work
//      (REPORT §5-2: while broken the executor never runs, so a success-based
//      release can never be observed):
//        function surveyAvailable() {
//          surveyLatch = recoverSurveyLatch(surveyLatch, Date.now()); // lazy recovery
//          return surveyLatchAvailable(surveyLatch, Date.now()) && !!mcServer.BlockVolume;
//        }
//      The lazy recover inside the predicate's caller is deliberate: the pure
//      predicates in this file never mutate, so the caller owns the write-back.
//   5. Optional probe-success release: after the cooldown has made the latch
//      available again, the first "done"/"partial" chunk may call
//      clearSurveyLatchOnSuccess(surveyLatch) to drop a not-yet-expired latch
//      in code paths where a chunk was executed despite the latch (probe).
//      Do NOT wire success-release without the cooldown path: success alone is
//      unreachable while surveyAvailable() === false.
//
// Purity contract: no imports, no Date.now()/Math.random(), no I/O, never throws,
// inputs are never mutated (callers may pass Object.freeze'd objects), and every
// time-dependent function takes `now` (ms epoch) explicitly. Unknown/garbage
// inputs are sanitized to the safest value that still guarantees an exit:
// a broken latch with a missing/invalid brokenAt is treated as EXPIRED, so no
// state representable through this module can reproduce the permanent latch.

export const SURVEY_FAIL_LIMIT = 40; // current threshold: fails > 40 (main.js:2104)
export const SURVEY_BROKEN_COOLDOWN_MS = 5 * 60 * 1000; // REPORT §5-2 example: 5 min
export const SURVEY_RECORD_QUARANTINE_MS = 15 * 60 * 1000; // = SURVEY_TTL_MS: re-request ban for a cut-off record
export const SURVEY_GLOBAL_WINDOW_MS = 60 * 1000; // "short time" window for §5-1 global trip
export const SURVEY_GLOBAL_MIN_REGIONS = 3; // distinct records required to trip the global latch

const isFiniteNum = (v) => typeof v === "number" && Number.isFinite(v);

// Sanitize a fails counter: non-finite / negative / non-number -> 0, fractions floor.
export function sanitizeFails(fails) {
  if (!isFiniteNum(fails) || fails < 0) return 0;
  return Math.floor(fails);
}

function sanitizeLimit(limit) {
  return isFiniteNum(limit) && limit >= 0 ? Math.floor(limit) : SURVEY_FAIL_LIMIT;
}

function sanitizePositiveMs(v, fallback) {
  return isFiniteNum(v) && v > 0 ? v : fallback;
}

// --- §5-3: progress resets fails -------------------------------------------
// "done" and "partial" both mean surveyChunk actually read blocks, i.e. the
// failure mode counted by `fails` (getBlocks keeps failing) is not present.
// Reset to 0 (not decrement): a decrement of 1 still lets a mostly-failing
// record accumulate 41 net errors between rare successes (REPORT case B had
// 8 done + 41 error); reset makes accumulation require 41 CONSECUTIVE errors,
// which is the "this record is currently unreadable" signal the limit means.
export function failsOnProgress(fails) {
  // The argument is accepted (and sanitized by callers' symmetry) but the
  // result is definitionally 0 for any progress result.
  void fails;
  return 0;
}

export function failsOnError(fails) {
  return sanitizeFails(fails) + 1;
}

// Pure per-result counter transition. result is the surveyChunk return value
// ("done" | "partial" | "error" | anything else). Unknown results (including
// "unloaded", null, undefined) leave the counter unchanged: they are neither
// evidence of progress nor of the getBlocks failure mode.
export function nextFails(fails, result) {
  if (result === "done" || result === "partial") return failsOnProgress(fails);
  if (result === "error") return failsOnError(fails);
  return sanitizeFails(fails);
}

// --- §5-1 (decision only): per-record cut-off -------------------------------
// Strictly greater-than, matching the current `sv.fails > 40` semantics:
// 40 errors do not cut off, 41 do.
export function shouldQuarantineRecord(fails, limit = SURVEY_FAIL_LIMIT) {
  return sanitizeFails(fails) > sanitizeLimit(limit);
}

export function recordQuarantinedUntil(record, now) {
  const until = record && isFiniteNum(record.quarantinedUntil) ? record.quarantinedUntil : 0;
  return isFiniteNum(now) && until > now;
}

// --- §5-2: global latch with cooldown recovery ------------------------------
export function createSurveyLatch() {
  return { broken: false, brokenAt: null };
}

function sanitizeLatch(latch) {
  if (!latch || typeof latch !== "object" || latch.broken !== true) {
    return { broken: false, brokenAt: null };
  }
  // Broken with an unusable timestamp: keep `broken` but mark brokenAt null;
  // availability/recovery below treat null as already expired (fail-open to
  // recovery, never to another permanent latch).
  return { broken: true, brokenAt: isFiniteNum(latch.brokenAt) ? latch.brokenAt : null };
}

export function tripSurveyLatch(latch, now) {
  const cur = sanitizeLatch(latch);
  if (cur.broken && cur.brokenAt != null) return cur; // idempotent: keep first trip time
  return { broken: true, brokenAt: isFiniteNum(now) ? now : null };
}

export function surveyLatchExpired(latch, now, cooldownMs = SURVEY_BROKEN_COOLDOWN_MS) {
  const cur = sanitizeLatch(latch);
  if (!cur.broken) return false;
  if (cur.brokenAt == null) return true; // no trustworthy start time -> recoverable
  if (!isFiniteNum(now)) return false;
  return now - cur.brokenAt >= sanitizePositiveMs(cooldownMs, SURVEY_BROKEN_COOLDOWN_MS);
}

export function surveyLatchAvailable(latch, now, cooldownMs = SURVEY_BROKEN_COOLDOWN_MS) {
  const cur = sanitizeLatch(latch);
  return !cur.broken || surveyLatchExpired(cur, now, cooldownMs);
}

// Returns { latch, recovered }. Before the cooldown this is a no-op copy;
// at/after the cooldown (or for a timestamp-less latch) it clears the latch.
export function recoverSurveyLatch(latch, now, cooldownMs = SURVEY_BROKEN_COOLDOWN_MS) {
  const cur = sanitizeLatch(latch);
  if (cur.broken && surveyLatchExpired(cur, now, cooldownMs)) {
    return { latch: { broken: false, brokenAt: null }, recovered: true };
  }
  return { latch: cur, recovered: false };
}

// Probe-success release (§5-2 alternative). Only meaningful for a caller that
// executed a chunk despite the latch; see integration note 5.
export function clearSurveyLatchOnSuccess(latch) {
  const cur = sanitizeLatch(latch);
  return cur.broken ? { broken: false, brokenAt: null } : cur;
}

// --- §5-1 (decision only): when MAY the global latch trip? ------------------
// events: array of { key, at } — one entry per record cut-off (quarantine),
// key = survey key ("dim:rx,rz"). The global latch trips only when at least
// `minRegions` DISTINCT keys were cut off within `windowMs` ending at `now`.
// A single record, however many errors, can never satisfy this.
export function shouldTripGlobalLatch(events, now, opts = {}) {
  if (!Array.isArray(events) || !isFiniteNum(now)) return false;
  const windowMs = sanitizePositiveMs(opts?.windowMs, SURVEY_GLOBAL_WINDOW_MS);
  const minRegions = isFiniteNum(opts?.minRegions) && opts.minRegions >= 1
    ? Math.floor(opts.minRegions) : SURVEY_GLOBAL_MIN_REGIONS;
  const keys = new Set();
  for (const e of events) {
    if (!e || typeof e.key !== "string" || !e.key || !isFiniteNum(e.at)) continue;
    if (e.at <= now && now - e.at < windowMs) keys.add(e.key);
  }
  return keys.size >= minRegions;
}

// Prune helper for the caller's rolling event log: keep only entries that can
// still fall inside a future window ending at >= now.
export function pruneGlobalErrorEvents(events, now, windowMs = SURVEY_GLOBAL_WINDOW_MS) {
  if (!Array.isArray(events) || !isFiniteNum(now)) return [];
  const w = sanitizePositiveMs(windowMs, SURVEY_GLOBAL_WINDOW_MS);
  return events.filter((e) => e && typeof e.key === "string" && isFiniteNum(e.at) && now - e.at < w);
}

// --- Combined reducer for one surveyChunk outcome ---------------------------
// Input record: { fails, quarantinedUntil? } (extra fields are ignored and NOT
// carried over — the caller writes back only the returned fields onto sv).
// Returns a fresh object; neither record nor latch is mutated.
//   result "done"/"partial": fails resets to 0 (§5-3); latch untouched here
//     (success-release of the latch is the caller's explicit choice, note 5).
//   result "error": fails + 1; crossing the limit quarantines THIS record
//     (recordQuarantined=true, globalEvent={key,at} for the caller's log)
//     instead of tripping the global latch (§5-1).
//   anything else: counter and quarantine unchanged.
export function applySurveyChunkOutcome(record, result, now, opts = {}) {
  const prevFails = sanitizeFails(record?.fails);
  const fails = nextFails(prevFails, result);
  const limit = sanitizeLimit(opts?.limit);
  const quarantineMs = sanitizePositiveMs(opts?.quarantineMs, SURVEY_RECORD_QUARANTINE_MS);
  const alreadyQuarantined = recordQuarantinedUntil(record, now);
  const crossed = result === "error" && shouldQuarantineRecord(fails, limit) && !alreadyQuarantined;
  return {
    fails,
    recordQuarantined: crossed || alreadyQuarantined,
    quarantinedUntil: crossed && isFiniteNum(now)
      ? now + quarantineMs
      : (alreadyQuarantined ? record.quarantinedUntil : 0),
    globalEvent: crossed
      ? { key: typeof opts?.key === "string" ? opts.key : "", at: isFiniteNum(now) ? now : 0 }
      : null,
  };
}
