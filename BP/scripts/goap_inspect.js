// goap_inspect.js — Phase 6 UNKNOWN→INSPECT 段1 (cycle1850, a05設計が正)
// 計画が UNKNOWN な fact で塞がれているとき、その解消候補 (INSPECT 需要) を
// 導出して影記録するための純粋核。段1は記録のみ: 計画・実行・分岐には使わない。
// 仕様: brain_parts/solutions/cycle1850-a05/REPORT.md §2〜§3
// 純粋モジュール: @minecraft/server 非依存、Date.now を呼ばない、入力不変、例外を投げない。
const VIA = { chest: "inspect_container", source: "inspect_block_near", station: "inspect_perc" };
const SCOPE_ORDER = { source: 0, chest: 1, station: 2 };

function factItem(scope, fact) {
  try {
    if (typeof fact !== "string") return null;
    if (scope === "chest") { const m = fact.match(/^chest(?:@h\d+)?\.(.+)$/); return m ? m[1] : null; }
    if (scope === "source") { const m = fact.match(/^near\.(.+)_source$/); return m ? m[1] : null; }
    if (scope === "station") { const m = fact.match(/^station\.(.+)$/); return m ? m[1] : null; }
  } catch {}
  return null;
}
function scopeOfFact(fact) {
  if (typeof fact !== "string") return null;
  if (fact.startsWith("chest.") || /^chest@h\d+\./.test(fact)) return "chest";
  if (fact.startsWith("near.") && fact.endsWith("_source")) return "source";
  if (fact.startsWith("station.")) return "station";
  return null;
}

export function deriveInspectNeeds(input) {
  const empty = { needed: false, needs: [], skipped: [] };
  try {
    if (!input || typeof input !== "object") return { ...empty };
    const fs = input.factStatus;
    if (!fs || typeof fs !== "object") return { ...empty };
    const unknown = [];
    for (const [fact, st] of Object.entries(fs)) {
      if (st && typeof st === "object" && st.status === "unknown") unknown.push({ fact, reason: typeof st.reason === "string" ? st.reason : null });
    }
    // station は factStatus に載らない場合があるため stationStatus 側も材料にする
    const ss = input.stationStatus;
    if (ss && typeof ss === "object") {
      for (const [item, v] of Object.entries(ss)) {
        if (v === "unknown") { const fact = `station.${item}`; if (!unknown.some((u) => u.fact === fact)) unknown.push({ fact, reason: "station_unknown" }); }
      }
    }
    const planOk = input.planOk === true;
    const firstFacts = new Set();
    if (Array.isArray(input.firstPre)) for (const p of input.firstPre) { if (p && typeof p.fact === "string") firstFacts.add(p.fact); }
    const blocking = new Set();
    if (!planOk) { for (const u of unknown) blocking.add(u.fact); }
    else { for (const u of unknown) if (firstFacts.has(u.fact)) blocking.add(u.fact); }
    let chestObserved = input.chestObserved;
    if (typeof chestObserved !== "number" || !Number.isFinite(chestObserved) || chestObserved < 0) chestObserved = null;
    const needsByKey = new Map(); const skipped = [];
    const pushSkip = (fact, reason, why) => { if (skipped.length < 8) skipped.push({ fact, reason, why }); else if (!skipped.some((s) => s.why === "truncated")) skipped.push({ fact: null, reason: null, why: "truncated" }); };
    for (const u of unknown) {
      const scope = scopeOfFact(u.fact);
      if (!blocking.has(u.fact)) { pushSkip(u.fact, u.reason, "not_blocking"); continue; }
      if (!scope) { pushSkip(u.fact, u.reason, "out_of_scope"); continue; }
      if (scope === "chest" && !(chestObserved >= 1)) { pushSkip(u.fact, u.reason, "no_destination"); continue; }
      const item = factItem(scope, u.fact);
      const key = `${scope}:${item || u.fact}`;
      if (!needsByKey.has(key)) needsByKey.set(key, { scope, fact: scope === "chest" && item ? `chest.${item}` : u.fact, item, reason: u.reason, via: VIA[scope] });
    }
    const needs = [...needsByKey.values()].sort((a, b) => SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope]).slice(0, 3);
    return { needed: needs.length > 0, needs, skipped };
  } catch { return { ...empty }; }
}

export function runGoapInspectSelfTests() {
  let pass = 0, fail = 0; const failures = [];
  const ok = (n, c) => { if (c) pass++; else { fail++; failures.push(n); } };
  const U = (reason) => ({ status: "unknown", reason });
  const base = { planOk: false, planReason: "NO_PLAN", factStatus: { "chest.minecraft:iron_ingot": U("chest_count_unknown") }, stationStatus: null, firstPre: null, chestObserved: 2, target: "minecraft:iron_ingot" };
  const r1 = deriveInspectNeeds(base); ok("GI-03 chest", r1.needed && r1.needs.length === 1 && r1.needs[0].scope === "chest" && r1.needs[0].via === "inspect_container");
  const r2 = deriveInspectNeeds({ ...base, factStatus: { "near.minecraft:iron_ore_source": U("source_unknown") }, chestObserved: null }); ok("GI-06 source", r2.needed && r2.needs[0].scope === "source");
  const r3 = deriveInspectNeeds({ ...base, factStatus: { "inv.minecraft:iron_ingot": U("inv_unknown") }, chestObserved: null }); ok("GI-08 inv out_of_scope", !r3.needed && r3.skipped[0]?.why === "out_of_scope");
  const r4 = deriveInspectNeeds({ ...base, factStatus: {}, chestObserved: null }); ok("GI-09 true absence", !r4.needed && r4.needs.length === 0 && r4.skipped.length === 0);
  return { pass, fail, failures };
}
