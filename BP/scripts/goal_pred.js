// goal_pred.js — Goal述語の正式表現 (Phase3 NQ-02, v0.4.17)
// 純粋モジュール: import なし・副作用なし・例外安全。Goal を goap.js 互換の
// 述語列 {fact, op, value} で表し、三状態 (TRUE/FALSE/UNKNOWN) で評価する。
// UNKNOWN を FALSE へ潰さないことが存在意義 (Phase1 三状態の Goal 側)。
// 出典: brain_parts/solutions/cycle1135/a02 (設計 a01/a14)。
// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

const isObj = (v) => {
  try { return v !== null && typeof v === "object"; } catch { return false; }
};

// A valid item id is a non-empty string without whitespace. Namespace is
// NOT forced: callers may use "minecraft:oak_log" or a bare id; the fact
// key is built verbatim so ids are copied exactly, never rewritten.
const validItem = (item) => {
  try {
    return typeof item === "string" && item.length > 0 && !/\s/.test(item);
  } catch { return false; }
};

// Counts are positive integers. Fractions are floored (a request for 2.9
// items can only mean 2 whole items); NaN / Infinity / <= 0 are invalid.
const normCount = (count) => {
  try {
    if (typeof count !== "number" || !Number.isFinite(count)) return null;
    const n = Math.floor(count);
    return n >= 1 ? n : null;
  } catch { return null; }
};

const invFact = (item) => `inv.${item}`;

// Knowledge gate for the inventory as a whole.
// Returns true (closed world: absence means 0), false (explicitly
// unknown), or null (no marker supplied by the caller).
// Accepted markers, in priority order (first decisive marker wins):
//   world.obs.inv === "ok"        -> known      (Phase 1 c.x.obs shape)
//   world.obs.inv === "unknown"   -> unknown
//   world.invKnown === true/false -> known / unknown (legacy goap_state)
//   world.invOk    === true/false -> known / unknown (legacy alias)
// Any other / missing marker -> null (per-fact presence decides, below).
function invKnowledge(world) {
  try {
    const obsInv = world?.obs?.inv;
    if (obsInv === "ok") return true;
    if (typeof obsInv === "string") return false; // "unknown"/other: not ok
    if (world?.invKnown === true) return true;
    if (world?.invKnown === false) return false;
    if (world?.invOk === true) return true;
    if (world?.invOk === false) return false;
    return null;
  } catch { return false; }
}

// Read one inventory count from a world view. Returns a finite number, or
// undefined when the count is not actually observed. Supported shapes:
//   flat GOAP state : { "inv.<item>": 5, ... }
//   item map        : { items: { "<item>": 5, ... }, ...markers }
//   inv map         : { inv:   { "<item>": 5, ... }, ...markers }
//   single reading  : { item: "<item>", count: 5 }   (convenience shape)
// `banked` (already delivered, mission.measure/banked semantics) is added
// only when it is a plain item map on the same world view:
//   { items: {...}, banked: { "<item>": 2 }, ... }
// Non-numeric / negative / non-finite readings are treated as unobserved
// (undefined), never coerced and never clamped into a false "0".
function readInvCount(world, item) {
  try {
    if (!isObj(world)) return undefined;
    const pick = (map) => {
      try {
        if (!isObj(map)) return undefined;
        const v = map[item];
        return (typeof v === "number" && Number.isFinite(v) && v >= 0) ? v : undefined;
      } catch { return undefined; }
    };
    let base;
    const flat = world[invFact(item)];
    if (typeof flat === "number" && Number.isFinite(flat) && flat >= 0) base = flat;
    if (base === undefined) base = pick(world.items);
    if (base === undefined) base = pick(world.inv);
    if (base === undefined && world.item === item) {
      const c = world.count;
      if (typeof c === "number" && Number.isFinite(c) && c >= 0) base = c;
    }
    if (base === undefined) return undefined;
    const banked = pick(world.banked);
    return banked === undefined ? base : base + banked;
  } catch { return undefined; }
}

// Validate + normalise a predicate list. Returns a fresh array of
// { fact, op, value } or null when any predicate is malformed.
// Only the ops already used by goap.js satisfies() are accepted.
const OPS = new Set([">=", ">", "<=", "<", "==", "!="]);
function normPredicates(goal) {
  try {
    const list = goal?.predicates;
    if (!Array.isArray(list) || list.length === 0) return null;
    const out = [];
    for (const p of list) {
      if (!isObj(p)) return null;
      if (typeof p.fact !== "string" || p.fact.length === 0) return null;
      if (!OPS.has(p.op)) return null;
      const v = p.value;
      if (!(typeof v === "number" && Number.isFinite(v)) && typeof v !== "boolean" && typeof v !== "string") return null;
      out.push({ fact: p.fact, op: p.op, value: v });
    }
    return out;
  } catch { return null; }
}

// Compare one observed value against one predicate. Caller guarantees the
// value was observed; this helper only does the (exception-safe) compare.
function compare(value, op, target) {
  try {
    switch (op) {
      case ">=": return typeof value === "number" && typeof target === "number" && value >= target;
      case ">":  return typeof value === "number" && typeof target === "number" && value > target;
      case "<=": return typeof value === "number" && typeof target === "number" && value <= target;
      case "<":  return typeof value === "number" && typeof target === "number" && value < target;
      case "==": return value === target;
      case "!=": return value !== target;
      default: return false;
    }
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * makeInvGoal(item, count, opts?) -> Goal | null
 * Build the goal "inventory[item] >= count".
 * opts (all optional, invalid values fall back to defaults, never throw):
 *   priority : finite number, default 0. Separate from decide's `p`.
 *   source   : non-empty string, default "order" (provenance only).
 *   id       : non-empty string. When omitted a deterministic id derived
 *              from goalKey() is used ("goal:inv:<item>>=<count>"), so
 *              identical requests share an id/key and different requests
 *              never collide — no counter, no randomness, no duplicates
 *              for equal goals. Callers needing per-instance uniqueness
 *              pass their own id explicitly.
 * Returns null for an invalid item or count (goal cannot be stated).
 * Returned goal (plain, JSON-serializable):
 *   { type:"inventory_at_least", item, count, priority, source, id,
 *     predicates:[{ fact:"inv.<item>", op:">=", value:count }] }
 */
export function makeInvGoal(item, count, opts = {}) {
  try {
    if (!validItem(item)) return null;
    const n = normCount(count);
    if (n === null) return null;
    const o = isObj(opts) ? opts : {};
    const priority = (typeof o.priority === "number" && Number.isFinite(o.priority)) ? o.priority : 0;
    const source = (typeof o.source === "string" && o.source.length > 0) ? o.source : "order";
    const predicates = [{ fact: invFact(item), op: ">=", value: n }];
    const key = `inv:${item}>=${n}`;
    const id = (typeof o.id === "string" && o.id.length > 0) ? o.id : `goal:${key}`;
    return { type: "inventory_at_least", item, count: n, priority, source, id, predicates };
  } catch { return null; }
}

/**
 * evalGoal(goal, world) -> "TRUE" | "FALSE" | "UNKNOWN"
 * Three-valued AND evaluation of goal.predicates against a world view
 * (see readInvCount / invKnowledge for the accepted world shapes).
 * Rules:
 *   - Malformed goal (no valid predicates)            -> "UNKNOWN"
 *     (an empty/invalid goal is never vacuously "TRUE").
 *   - Any predicate provably violated                  -> "FALSE",
 *     even if another predicate is UNKNOWN (work to do is certain).
 *   - All predicates satisfied                         -> "TRUE".
 *   - Otherwise (nothing violated, >= 1 unobserved)    -> "UNKNOWN".
 * Per predicate, a fact is observed when readInvCount() returns a number.
 * When the count is absent: a known (closed-world) inventory proves 0,
 * so the predicate is evaluated against 0; an unknown/unmarked inventory
 * leaves the predicate UNKNOWN. Facts other than `inv.<item>` are read
 * as flat keys on the world view (world[fact]); a missing non-inv fact is
 * UNKNOWN (this draft has no closed-world marker for other fact kinds).
 * Pure and exception-safe: never throws, never mutates either argument.
 */
export function evalGoal(goal, world) {
  try {
    const preds = normPredicates(goal);
    if (!preds) return "UNKNOWN";
    if (!isObj(world)) return "UNKNOWN";
    const known = invKnowledge(world);
    let sawUnknown = false;
    for (const p of preds) {
      let value;
      if (p.fact.startsWith("inv.")) {
        const item = p.fact.slice(4);
        if (!validItem(item)) return "UNKNOWN";
        if (known === false) { sawUnknown = true; continue; } // readings untrusted
        value = readInvCount(world, item);
        if (value === undefined) {
          if (known === true) value = 0;        // closed world: absent = 0
          else { sawUnknown = true; continue; } // unobserved: do not decide
        }
      } else {
        value = world[p.fact];
        if (value === undefined || value === null) { sawUnknown = true; continue; }
      }
      if (!compare(value, p.op, p.value)) return "FALSE";
    }
    return sawUnknown ? "UNKNOWN" : "TRUE";
  } catch { return "UNKNOWN"; }
}

/**
 * goalKey(goal) -> string
 * Deterministic, stable identity key for dedup / plan-cache use.
 *   inventory goal : "goal:inv:<item>>=<count>"
 *   any valid goal : "goal:" + predicates sorted by (fact, op, value),
 *                    each rendered "<fact><op><JSON value>", joined "&"
 *   malformed goal : "goal:invalid"
 * Sorting makes the key order-insensitive over the AND list, matching
 * evalGoal semantics. No randomness / timestamps: equal goals (by
 * predicates) always share a key, different predicates never share one
 * within this rendering. Exception-safe: never throws.
 */
export function goalKey(goal) {
  try {
    const preds = normPredicates(goal);
    if (!preds) return "goal:invalid";
    if (preds.length === 1 && goal?.type === "inventory_at_least") {
      const p = preds[0];
      if (validItem(goal.item) && p.fact === invFact(goal.item) && p.op === ">=" && p.value === goal.count) {
        return `goal:inv:${goal.item}>=${goal.count}`;
      }
    }
    const parts = preds
      .map((p) => `${p.fact}${p.op}${JSON.stringify(p.value)}`)
      .sort();
    return `goal:${parts.join("&")}`;
  } catch { return "goal:invalid"; }
}

// ---------------------------------------------------------------------------
// Self-test comments (NOT executed on import; coordinator copies these
// into a tests/ case file and runs them with node --test / assert, or
// pastes them into a scratch .mjs that imports this module).
// Expected results were derived from the contracts above, not from a run.
//
// import { makeInvGoal, evalGoal, goalKey } from "./a02_goal_pred.js";
// const LOG = "minecraft:oak_log";
//
// // S01 make: canonical shape + goap-compatible predicate
// //   makeInvGoal(LOG, 4)
// //     -> { type:"inventory_at_least", item:LOG, count:4, priority:0,
// //          source:"order", id:"goal:inv:minecraft:oak_log>=4",
// //          predicates:[{fact:"inv.minecraft:oak_log", op:">=", value:4}] }
// // S02 make: fractional count floors; opts are honoured
// //   makeInvGoal(LOG, 2.9, {priority:10, source:"language"}).count === 2
// // S03 make: invalid inputs -> null, never throw
// //   makeInvGoal("", 4) === null;  makeInvGoal(LOG, 0) === null
// //   makeInvGoal(LOG, -3) === null; makeInvGoal(LOG, NaN) === null
// //   makeInvGoal(null, 4) === null; makeInvGoal("a b", 4) === null
// //   makeInvGoal(LOG, Infinity) === null; makeInvGoal() === null
// // S04 eval TRUE: observed count meets / exceeds the goal
// //   evalGoal(makeInvGoal(LOG,4), {items:{[LOG]:4}, invKnown:true}) === "TRUE"
// //   evalGoal(makeInvGoal(LOG,4), {"inv.minecraft:oak_log":9})     === "TRUE"
// //   evalGoal(makeInvGoal(LOG,4), {obs:{inv:"ok"}, items:{[LOG]:5},
// //                                 banked:{[LOG]:0}})              === "TRUE"
// // S05 eval FALSE: known inventory, count short (incl. proven absence)
// //   evalGoal(makeInvGoal(LOG,4), {items:{[LOG]:2}, invKnown:true}) === "FALSE"
// //   evalGoal(makeInvGoal(LOG,4), {items:{}, invKnown:true})        === "FALSE"
// //   evalGoal(makeInvGoal(LOG,4), {obs:{inv:"ok"}, items:{}})       === "FALSE"
// // S06 eval UNKNOWN: inventory not observed — never collapsed to FALSE
// //   evalGoal(makeInvGoal(LOG,4), {items:{[LOG]:99}, obs:{inv:"unknown"}}) === "UNKNOWN"
// //   evalGoal(makeInvGoal(LOG,4), {items:{[LOG]:99}, invKnown:false})      === "UNKNOWN"
// //   evalGoal(makeInvGoal(LOG,4), {items:{}}) === "UNKNOWN" // no marker, absent fact
// //   evalGoal(makeInvGoal(LOG,4), null) === "UNKNOWN"; evalGoal(null, {}) === "UNKNOWN"
// //   evalGoal({predicates:[]}, {invKnown:true, items:{}}) === "UNKNOWN" // no vacuous TRUE
// // S07 eval AND semantics: one FALSE beats another predicate's UNKNOWN
// //   const g = { predicates:[{fact:"inv.minecraft:oak_log",op:">=",value:4},
// //                           {fact:"inv.minecraft:stick",op:">=",value:2}] };
// //   evalGoal(g, {items:{[LOG]:1}, invKnown:false}) === "UNKNOWN"
// //     // inventory explicitly unknown: readings are untrusted => UNKNOWN
// //   evalGoal(g, {items:{[LOG]:1}, invKnown:true})  === "FALSE"   // log short, proven
// // S08 banked: delivered stock counts toward the goal (measure/banked)
// //   evalGoal(makeInvGoal(LOG,4),
// //     {items:{[LOG]:3}, banked:{[LOG]:1}, invKnown:true}) === "TRUE"
// // S09 bad readings are unobserved, not zero:
// //   evalGoal(makeInvGoal(LOG,4), {items:{[LOG]:"4"}, invKnown:false}) === "UNKNOWN"
// //   evalGoal(makeInvGoal(LOG,4), {items:{[LOG]:-1}})                   === "UNKNOWN"
// // S10 key: deterministic, dedup-friendly, order-insensitive for AND
// //   goalKey(makeInvGoal(LOG,4)) === "goal:inv:minecraft:oak_log>=4"
// //   goalKey(makeInvGoal(LOG,4)) === goalKey(makeInvGoal(LOG,4, {priority:9}))
// //     // priority/source/id do not change identity of the condition
// //   goalKey(makeInvGoal(LOG,4)) !== goalKey(makeInvGoal(LOG,5))
// //   goalKey(null) === "goal:invalid"; goalKey({}) === "goal:invalid"
// // S11 purity: frozen inputs are not mutated and do not throw
// //   const w = Object.freeze({items:Object.freeze({[LOG]:4}), invKnown:true});
// //   const g = Object.freeze(makeInvGoal(LOG,4));
// //   evalGoal(g, w) === "TRUE"; goalKey(g) === "goal:inv:minecraft:oak_log>=4"
// // S12 determinism: repeated calls give identical results (no Date/random)
// //   for (let i=0;i<100;i++) evalGoal(makeInvGoal(LOG,4), w) === "TRUE"
// ---------------------------------------------------------------------------

// ---------- 自己テスト (import時は実行しない) ----------
export function runSelfTests(log = (...a) => { try { console.log(...a); } catch {} }) {
  let pass = 0, fail = 0; const t = (name, cond) => { if (cond) { pass++; log(`PASS ${name}`); } else { fail++; log(`FAIL ${name}`); } };
  const LOG = "minecraft:oak_log";
  try {
    const g = makeInvGoal(LOG, 4);
    t("S01 shape", !!g && g.predicates?.[0]?.fact === `inv.${LOG}` && g.count === 4);
    t("S02 floor", makeInvGoal(LOG, 2.9)?.count === 2);
    t("S03 invalid", makeInvGoal("", 4) === null && makeInvGoal(LOG, 0) === null && makeInvGoal(LOG, NaN) === null);
    t("S04 TRUE", evalGoal(g, { items: { [LOG]: 4 }, invKnown: true }) === "TRUE");
    t("S05 FALSE known-short", evalGoal(g, { items: { [LOG]: 2 }, invKnown: true }) === "FALSE" && evalGoal(g, { items: {}, invKnown: true }) === "FALSE");
    t("S06 UNKNOWN not FALSE", evalGoal(g, { items: { [LOG]: 99 }, obs: { inv: "unknown" } }) === "UNKNOWN" && evalGoal(g, null) === "UNKNOWN" && evalGoal(null, {}) === "UNKNOWN");
    t("S08 banked", evalGoal(g, { items: { [LOG]: 3 }, banked: { [LOG]: 1 }, invKnown: true }) === "TRUE");
    t("S10 key", goalKey(g) === `goal:inv:${LOG}>=4` && goalKey(null) === "goal:invalid");
    const w = Object.freeze({ items: Object.freeze({ [LOG]: 4 }), invKnown: true });
    t("S11 frozen", evalGoal(Object.freeze(g), w) === "TRUE");
  } catch (e) { fail++; log(`FAIL exception ${e?.message ?? e}`); }
  log(`RESULT ${pass}/${pass + fail} passed, ${fail} failed`);
  return { pass, fail, total: pass + fail };
}
