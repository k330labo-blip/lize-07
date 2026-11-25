// equip_api.js — 装備中核（equipment.js）と実API・UI（equip_ui.js）の接続層（v0.3.0）
// equipment.js は純粋JS（adapter 方式）、equip_ui.js は api 契約方式。ここが両者を
// @minecraft/server の実コンポーネント（equippable / inventory / health）へ束ねる。
import { ItemStack, EquipmentSlot } from "@minecraft/server";
import { createEquipmentSystem, HEAL_ITEMS } from "./equipment.js";
import { classifySlot, EQUIP_SLOTS } from "./equip_ui.js";

// 装備中核を Bot エンティティへ接続する。helpers は main.js の基盤関数群。
// helpers: { invOf, hpOf, dp, dps, onEquipEvent(kind, fromOwner), onHeal() }
export function createEquipCore(bot, helpers) {
  const { invOf, hpOf, dp, dps } = helpers;
  const eqComp = () => { try { return bot.getComponent("minecraft:equippable"); } catch { return null; } };
  return createEquipmentSystem({
    armorMode: "script",
    equipGet: (slot) => { const c = eqComp(); if (!c) return null; try { const it = c.getEquipment(EquipmentSlot[slot]); return it ? { typeId: it.typeId, amount: it.amount } : null; } catch { return null; } },
    equipSet: (slot, item) => { const c = eqComp(); if (!c) return false; try { c.setEquipment(EquipmentSlot[slot], item ? new ItemStack(item.typeId, item.amount || 1) : undefined); return true; } catch { return false; } },
    invCount: (typeId) => { const cont = invOf(bot); let n = 0; if (cont) for (let i = 0; i < cont.size; i++) { const it = cont.getItem(i); if (it && it.typeId === typeId) n += it.amount; } return n; },
    invRemove: (typeId, n) => { const cont = invOf(bot); if (!cont) return 0; let removed = 0; for (let i = 0; i < cont.size && removed < n; i++) { const it = cont.getItem(i); if (!it || it.typeId !== typeId) continue; const take = Math.min(it.amount, n - removed); cont.setItem(i, it.amount === take ? undefined : new ItemStack(typeId, it.amount - take)); removed += take; } return removed; },
    invList: () => { const cont = invOf(bot); const out = []; if (cont) for (let i = 0; i < cont.size; i++) { const it = cont.getItem(i); if (it) out.push({ typeId: it.typeId, amount: it.amount }); } return out; },
    getHealth: () => hpOf(bot),
    addHealth: (delta) => { try { const h = bot.getComponent("minecraft:health"); if (h) { h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + delta)); return h.currentValue; } } catch {} return hpOf(bot).cur; },
    load: () => dp(bot, "cb_equip", null),
    save: (s) => dps(bot, "cb_equip", s),
    onHeal: () => { try { helpers.onHeal?.(); } catch {} },
    onEquipChange: (slot, item) => { try { helpers.onEquipEvent?.(slot === "Mainhand" ? (item && String(item.typeId).startsWith("gun:") ? "gun" : "weapon") : "armor", false); } catch {} },
  });
}

// 装備品（amount は基本1）が相手コンテナへ丸ごと入るかの事前確認（部分返却を避ける）
function canFit(cont, typeId, amount) {
  if (!cont) return false;
  for (let i = 0; i < cont.size; i++) {
    const it = cont.getItem(i);
    if (!it) return true;
    if (it.typeId === typeId && it.amount + amount <= (it.maxAmount || 64)) return true;
  }
  return false;
}
function moveStack(src, dst, slot, n) {
  if (!src || !dst) return { ok: false, moved: 0 };
  const stack = src.getItem(slot); if (!stack) return { ok: false, moved: 0 };
  const want = Math.min(n, stack.amount);
  const rest = dst.addItem(new ItemStack(stack.typeId, want));
  const moved = want - (rest ? rest.amount : 0);
  if (moved <= 0) return { ok: false, moved: 0 };
  const left = stack.amount - moved;
  src.setItem(slot, left > 0 ? new ItemStack(stack.typeId, left) : undefined);
  return { ok: true, moved };
}

// equip_ui.js の api 契約の実装。helpers: { invOf, hpOf, say, nameOfItem, onEquipEvent }
export function createEquipmentApi(owner, bot, core, helpers) {
  const { invOf, hpOf, say, nameOfItem } = helpers;
  const eqComp = () => { try { return bot.getComponent("minecraft:equippable"); } catch { return null; } };
  const slotDef = (key) => EQUIP_SLOTS.find((s) => s.key === key);
  const listItems = (e) => { const cont = invOf(e); const out = []; if (cont) for (let i = 0; i < cont.size; i++) { const it = cont.getItem(i); if (it) out.push({ slot: i, typeId: it.typeId, name: nameOfItem(it.typeId), amount: it.amount }); } return out; };
  const syncCore = () => { try { core.refresh(); core.persist(); } catch {} };
  return {
    say: (text) => say(owner, bot, text, true),
    getSnapshot: () => {
      const equipment = {};
      for (const s of EQUIP_SLOTS) {
        let info = null;
        try { const it = eqComp()?.getEquipment(EquipmentSlot[s.mc]); if (it) info = { typeId: it.typeId, name: nameOfItem(it.typeId) }; } catch {}
        equipment[s.key] = info;
      }
      const items = listItems(bot);
      const cont = invOf(bot);
      const heal = core.healStock()[0];
      const hp = hpOf(bot);
      return { equipment, items, healItem: heal ? { typeId: heal.typeId, name: nameOfItem(heal.typeId) } : null, hpPct: hp.max ? hp.cur / hp.max : 1, invUsed: items.length, invSize: cont ? cont.size : 27 };
    },
    ownerCandidates: (slotKey) => listItems(owner).filter((it) => classifySlot(it.typeId) === slotKey),
    ownerItems: () => listItems(owner),
    unequipToOwner: (key) => {
      const s = slotDef(key); const c = eqComp(); if (!c || !s) return { ok: false };
      let it = null; try { it = c.getEquipment(EquipmentSlot[s.mc]); } catch {}
      if (!it) return { ok: false };
      const oc = invOf(owner); if (!oc || !canFit(oc, it.typeId, it.amount)) return { ok: false };
      const rest = oc.addItem(it); if (rest) return { ok: false };
      try { c.setEquipment(EquipmentSlot[s.mc], undefined); } catch { return { ok: false }; }
      syncCore();
      try { helpers.onEquipEvent?.("unequip", true); } catch {}
      return { ok: true, name: nameOfItem(it.typeId) };
    },
    equipFromOwner: (key, ownerSlot) => {
      const s = slotDef(key); const c = eqComp(); const oc = invOf(owner); if (!c || !s || !oc) return { ok: false };
      const stack = oc.getItem(ownerSlot); if (!stack) return { ok: false };
      if (classifySlot(stack.typeId) !== key) return { ok: false };
      let prev = null; try { prev = c.getEquipment(EquipmentSlot[s.mc]); } catch {}
      if (prev && !canFit(oc, prev.typeId, prev.amount)) return { ok: false }; // 旧装備を返せなければ付け替え自体を中止
      if (stack.amount > 1) oc.setItem(ownerSlot, new ItemStack(stack.typeId, stack.amount - 1)); else oc.setItem(ownerSlot, undefined);
      try { c.setEquipment(EquipmentSlot[s.mc], new ItemStack(stack.typeId, 1)); } catch { try { oc.addItem(new ItemStack(stack.typeId, 1)); } catch {} return { ok: false }; }
      if (prev) { try { oc.addItem(prev); } catch {} }
      syncCore();
      const kind = key === "mainhand" ? (String(stack.typeId).startsWith("gun:") || /gun|rifle|pistol|smg|shotgun/.test(stack.typeId) ? "gun" : "weapon") : key === "offhand" ? "armor" : "armor";
      try { helpers.onEquipEvent?.(kind, true); } catch {}
      return { ok: true, name: nameOfItem(stack.typeId) };
    },
    giveToOwner: (botSlot, n) => moveStack(invOf(bot), invOf(owner), botSlot, n),
    receiveFromOwner: (ownerSlot, n) => {
      const oc = invOf(owner); const stack = oc ? oc.getItem(ownerSlot) : null;
      const res = moveStack(oc, invOf(bot), ownerSlot, n);
      if (res.ok && stack) {
        if (HEAL_ITEMS[stack.typeId]) { try { helpers.onEquipEvent?.("heal", true); } catch {} }
        else if (core.classifyItem(stack.typeId).kind === "ammo") { try { helpers.onEquipEvent?.("ammo", true); } catch {} }
      }
      return res;
    },
    useHeal: () => { const res = core.useHealItem(); return res.ok ? { ok: true, name: nameOfItem(res.item) } : { ok: false }; },
  };
}

// 装備品の残耐久割合（取れない環境ではキー自体を返さない）
export function durabilityPcts(bot) {
  const out = {};
  try {
    const c = bot.getComponent("minecraft:equippable"); if (!c) return out;
    const mh = c.getEquipment(EquipmentSlot.Mainhand);
    if (mh) { const d = mh.getComponent("minecraft:durability"); if (d && d.maxDamage > 0) out.weapon = (d.maxDamage - d.damage) / d.maxDamage; }
    let min = null;
    for (const s of ["Head", "Chest", "Legs", "Feet"]) {
      const it = c.getEquipment(EquipmentSlot[s]); if (!it) continue;
      const d = it.getComponent("minecraft:durability");
      if (d && d.maxDamage > 0) { const p = (d.maxDamage - d.damage) / d.maxDamage; min = min === null ? p : Math.min(min, p); }
    }
    if (min !== null) out.armor = min;
  } catch {}
  return out;
}
