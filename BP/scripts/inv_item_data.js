// inv_item_data.js — 0-C3: 所持品の個別情報 (名前/説明/エンチャント/消耗) の保存・復元
// 純粋JS (@minecraft/server 非依存)。実 ItemStack も、同じ形のモックも扱える。
// 全アクセスは try/catch + optional chaining で例外安全。取れない項目は黙って省略し、
// 種類と個数だけの旧形式 {t,a} へ自然に劣化する (後方互換)。
// 保存形式 v2: { t, a, n?: nameTag, l?: lore[], e?: [{id,lv}], d?: durabilityDamage, k?: keepOnDeath }

export const INV_DATA_VERSION = 2;

function enchList(it) {
  try {
    const comp = it?.getComponent?.("minecraft:enchantable");
    if (!comp) return null;
    let list = null;
    try { list = comp.getEnchantments?.(); } catch { list = null; }
    if (!list) { try { list = comp.enchantments; } catch { list = null; } }
    if (!Array.isArray(list) || !list.length) return null;
    const out = [];
    for (const e of list) {
      try {
        const id = e?.type?.id ?? e?.typeId ?? e?.id;
        const lv = e?.level;
        if (typeof id === "string" && id && Number.isFinite(lv)) out.push({ id, lv: Math.floor(lv) });
      } catch {}
    }
    return out.length ? out : null;
  } catch { return null; }
}

export function extractItemData(it) {
  if (!it || typeof it.typeId !== "string") return null;
  const rec = { t: it.typeId, a: Math.max(1, Math.floor(it.amount ?? 1)) };
  try { if (typeof it.nameTag === "string" && it.nameTag) rec.n = it.nameTag; } catch {}
  try {
    const lore = typeof it.getLore === "function" ? it.getLore() : it.lore;
    if (Array.isArray(lore) && lore.length) rec.l = lore.filter((s) => typeof s === "string");
    if (rec.l && !rec.l.length) delete rec.l;
  } catch {}
  const e = enchList(it); if (e) rec.e = e;
  try {
    const d = it?.getComponent?.("minecraft:durability");
    if (d && Number.isFinite(d.damage) && d.damage > 0) rec.d = Math.floor(d.damage);
  } catch {}
  try { if (it.keepOnDeath === true) rec.k = 1; } catch {}
  return rec;
}

// stack は実 ItemStack (可変) を想定。適用できた項目名の配列を返す。
export function applyItemData(stack, rec) {
  const applied = [];
  if (!stack || !rec) return applied;
  try { if (typeof rec.n === "string" && rec.n) { stack.nameTag = rec.n; applied.push("name"); } } catch {}
  try { if (Array.isArray(rec.l) && rec.l.length && typeof stack.setLore === "function") { stack.setLore(rec.l.slice(0, 20)); applied.push("lore"); } } catch {}
  try {
    if (Array.isArray(rec.e) && rec.e.length) {
      const comp = stack?.getComponent?.("minecraft:enchantable");
      if (comp) {
        let done = false;
        if (typeof comp.addEnchantments === "function") {
          try { comp.addEnchantments(rec.e.map((e) => ({ type: e.id, level: e.lv }))); done = true; } catch {}
        }
        if (!done && typeof comp.addEnchantment === "function") {
          for (const e of rec.e) { try { comp.addEnchantment({ type: e.id, level: e.lv }); done = true; } catch {} }
        }
        if (done) applied.push("enchant");
      }
    }
  } catch {}
  try {
    if (Number.isFinite(rec.d) && rec.d > 0) {
      const d = stack?.getComponent?.("minecraft:durability");
      if (d) { d.damage = Math.min(Math.floor(rec.d), Number.isFinite(d.maxDamage) ? d.maxDamage : Math.floor(rec.d)); applied.push("durability"); }
    }
  } catch {}
  try { if (rec.k) { stack.keepOnDeath = true; applied.push("keepOnDeath"); } } catch {}
  return applied;
}

// 旧形式 {t,a} と新形式の混在配列を正規化する (不正要素は捨てる)
export function normalizeSavedInv(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const s of arr) {
    if (!s || typeof s.t !== "string" || !s.t) continue;
    const a = Math.floor(s.a ?? 1);
    if (!Number.isFinite(a) || a <= 0) continue;
    const rec = { t: s.t, a };
    if (typeof s.n === "string" && s.n) rec.n = s.n;
    if (Array.isArray(s.l)) { const l = s.l.filter((x) => typeof x === "string"); if (l.length) rec.l = l; }
    if (Array.isArray(s.e)) { const e = s.e.filter((x) => x && typeof x.id === "string" && Number.isFinite(x.lv)).map((x) => ({ id: x.id, lv: Math.floor(x.lv) })); if (e.length) rec.e = e; }
    if (Number.isFinite(s.d) && s.d > 0) rec.d = Math.floor(s.d);
    if (s.k) rec.k = 1;
    out.push(rec);
  }
  return out;
}

// 同一性キー: 倉庫仕分け (W2) が「同一IDでも個別情報が違えば混ぜない」判定に使う
export function itemIdentityKey(rec) {
  if (!rec) return "";
  const base = rec.t ?? rec.typeId ?? "";
  const parts = [base];
  if (rec.n) parts.push("n:" + rec.n);
  if (rec.e?.length) parts.push("e:" + rec.e.map((e) => e.id + ":" + e.lv).sort().join(","));
  if (rec.d) parts.push("d:" + rec.d);
  if (rec.l?.length) parts.push("l:" + rec.l.join("\u0001"));
  return parts.join("|");
}
