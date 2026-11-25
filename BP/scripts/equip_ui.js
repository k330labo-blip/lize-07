// 装備／インベントリ UI（リゼ／LIZE-07）— フォームで再現する「プレイヤー風インベントリ画面」のロジック層
// 純粋JS: @minecraft/* を import しない。フォーム実体（ActionFormData / ModalFormData）は注入し、
// 実アイテム操作は api（equipment.js が実装する契約、下記）へ委譲する。Node モックテスト: test_equip_ui.mjs。
// 口調: 一人称「私」、短い敬語。ボタン文言も短く、リゼの世界の言葉で。
//
// 統合版の Script API には、カスタムエンティティの minecraft:inventory
// コンテナをプレイヤーの画面にそのまま開く標準手段がない（バニラのチェスト式UIは開けない）。
// そのため @minecraft/server-ui のフォームで装備欄＋持ち物欄を再現する。詳細は equip_ui.md。
//
// ---- api 契約（equipment.js／実行部が実装する）----
// ItemInfo = { typeId: string, name: string} // name は表示名（nameOfItem 済み）
// SlotItem = { slot: number, typeId: string, name: string, amount: number} // slot はコンテナのインデックス
// api.getSnapshot() -> {
// equipment: { head: ItemInfo|null, chest: ItemInfo|null, legs: ItemInfo|null,
// feet: ItemInfo|null, mainhand: ItemInfo|null, offhand: ItemInfo|null},
// items: SlotItem[], // リゼの所持品（空きスロットを除いた一覧）
// healItem: ItemInfo|null, // 今すぐ使える回復アイテム（無ければ null）
// hpPct: number, // 0..1
// invUsed: number, invSize: number,
//}
// api.ownerCandidates(slotKey) -> SlotItem[] // 主人の持ち物のうち、そのスロットに装備できるもの
// api.ownerItems() -> SlotItem[] // 主人の持ち物一覧（受け取り候補）
// api.unequipToOwner(slotKey) -> { ok: boolean, name?: string}
// 装備を外して主人のインベントリへ返す。主人満杯なら ok:false。
// api.equipFromOwner(slotKey, ownerSlot) -> { ok: boolean, name?: string}
// 主人の持ち物から装備する。装備中だった物は主人のインベントリへ返す（equipment.js の責務）。
// api.giveToOwner(botSlot, amount) -> { ok: boolean, moved: number}
// api.receiveFromOwner(ownerSlot, amount) -> { ok: boolean, moved: number}
// api.useHeal() -> { ok: boolean, name?: string}
// api.say?(text) // 任意。main.js の say() に接続する

// ---------------------------------------------------------------- 装備スロット定義
export const EQUIP_SLOTS = [
{ key: "head", label: "頭", mc: "Head"},
{ key: "chest", label: "胸", mc: "Chest"},
{ key: "legs", label: "脚", mc: "Legs"},
{ key: "feet", label: "足", mc: "Feet"},
{ key: "mainhand", label: "右手", mc: "Mainhand"},
{ key: "offhand", label: "左手", mc: "Offhand"},
];
export const SLOT_KEYS = EQUIP_SLOTS.map((s) => s.key);
export function slotLabel(key) {
const s = EQUIP_SLOTS.find((v) => v.key === key);
return s? s.label: key;
}

// typeId → 装備可能スロット（候補の絞り込み用）。装備できない物は null。
// 弾薬・食料・素材は null（装備ではなく所持品として受け渡す）。
export function classifySlot(typeId) {
if (!typeId) return null;
const base = String(typeId).toLowerCase().split(":").pop();
if (/_helmet$/.test(base) || /_skull$/.test(base) || /_head$/.test(base) || base === "carved_pumpkin" || /_cap$/.test(base)) return "head";
if (/_chestplate$/.test(base) || base === "elytra") return "chest";
if (/_leggings$/.test(base)) return "legs";
if (/_boots$/.test(base)) return "feet";
if (base === "shield" || base === "totem_of_undying") return "offhand";
if (/sword|pickaxe|shovel|fishing_rod|trident|crossbow|bow|mace|gun|rifle|pistol|smg|shotgun|spear/.test(base) || /_axe$/.test(base) || /_hoe$/.test(base) || base === "shears") return "mainhand";
return null;
}

// ---------------------------------------------------------------- 台詞（短く、クールに）
export const EQUIP_LINES = {
unequipOk: (name) => `${name}、外しました。……はい、返します`,
equipOk: (name) => `${name}、装備しました。動き、問題ありません`,
giveOk: (name, n) => `${name}、${n}個渡しました。……落とさないでください`,
receiveOk: (name, n) => `${name}、${n}個受け取りました。預かります`,
healOk: (name) => `${name}、使いました。……まだ、動けます`,
fail: "……できませんでした",
noCandidates: "あなたの持ち物に、装備できるものはありません",
emptyInv: "荷物は空です。……軽いのは、いいことです",
};

// ---------------------------------------------------------------- 画面モデル（純粋データ）
// Screen = { kind: "action", id, title, body, buttons: [{ id, label}]}
// | { kind: "modal", id, title, fields: [{ type:"slider", label, min, max, step, def}], pending}

export function buildMainScreen(snap) {
const buttons = [];
for (const s of EQUIP_SLOTS) {
const it = snap.equipment?.[s.key];
buttons.push({ id: `slot:${s.key}`, label: `${s.label}\n${it? it.name: "（なし）"}`});
}
buttons.push({ id: "items", label: `荷物\n渡す・受け取る（${snap.invUsed}/${snap.invSize}）`});
if (snap.healItem) buttons.push({ id: "heal", label: `回復を使う\n${snap.healItem.name}`});
buttons.push({ id: "close", label: "閉じる"});
const hp = Math.max(0, Math.round((snap.hpPct?? 1) * 100));
return {
kind: "action", id: "main",
title: "リゼ (LIZE-07) — 装備と荷物",
body: `体力： ${hp}%\n私の装備と荷物です。……見るだけなら、無料です`,
buttons,
};
}

export function buildSlotScreen(slotKey, item) {
// 装備中のスロットを開いたときの操作画面
return {
kind: "action", id: `slotmenu:${slotKey}`,
title: `リゼ — ${slotLabel(slotKey)}`,
body: `装備中： ${item.name}`,
buttons: [
{ id: "unequip", label: "外して、あなたに渡す"},
{ id: "change", label: "別のものに替える"},
{ id: "back", label: "戻る"},
],
};
}

export function buildCandidateScreen(slotKey, candidates) {
if (!candidates || candidates.length === 0) {
return {
kind: "action", id: `notice:nocand:${slotKey}`,
title: `リゼ — ${slotLabel(slotKey)}`,
body: EQUIP_LINES.noCandidates,
buttons: [{ id: "back", label: "戻る"}],
};
}
return {
kind: "action", id: `cand:${slotKey}`,
title: `リゼ — ${slotLabel(slotKey)}に装備`,
body: "あなたの持ち物から選びます",
buttons: [
...candidates.map((c) => ({ id: `cand:${c.slot}`, label: c.amount > 1? `${c.name} ×${c.amount}`: c.name})),
{ id: "back", label: "戻る"},
],
};
}

export function buildItemsScreen(snap) {
const buttons = [];
if (!snap.items || snap.items.length === 0) {
buttons.push({ id: "receive", label: "あなたから受け取る"});
buttons.push({ id: "back", label: "戻る"});
return { kind: "action", id: "items", title: "リゼ — 荷物", body: EQUIP_LINES.emptyInv, buttons};
}
for (const it of snap.items) buttons.push({ id: `item:${it.slot}`, label: `${it.name} ×${it.amount}`});
buttons.push({ id: "receive", label: "あなたから受け取る"});
buttons.push({ id: "back", label: "戻る"});
return {
kind: "action", id: "items",
title: "リゼ — 荷物",
body: `所持 ${snap.invUsed}/${snap.invSize}。渡す物を選んでください`,
buttons,
};
}

export function buildReceiveScreen(ownerItems) {
if (!ownerItems || ownerItems.length === 0) {
return {
kind: "action", id: "notice:noowner",
title: "リゼ — 受け取る",
body: "あなたの持ち物は空です。……渡す前に、拾ってください",
buttons: [{ id: "back", label: "戻る"}],
};
}
return {
kind: "action", id: "receive",
title: "リゼ — 受け取る",
body: "あなたの持ち物から、私が預かる物を選びます",
buttons: [
...ownerItems.map((c) => ({ id: `oitem:${c.slot}`, label: c.amount > 1? `${c.name} ×${c.amount}`: c.name})),
{ id: "back", label: "戻る"},
],
};
}

export function buildAmountModal(pending) {
// pending: { action: "give"|"receive", slot, name, max}
const verb = pending.action === "give"? "渡す": "受け取る";
return {
kind: "modal", id: `amount:${pending.action}:${pending.slot}`,
title: `リゼ — ${pending.name}を${verb}`,
fields: [{ type: "slider", label: `個数（最大 ${pending.max}）`, min: 1, max: Math.max(1, pending.max), step: 1, def: Math.max(1, pending.max)}],
pending,
};
}

// ---------------------------------------------------------------- セッション（画面遷移の状態機械）
export function createEquipSession(api) {
let screen = null;

const sayLine = (text) => { try { api.say?.(text);} catch {}};
async function toMain() {
const snap = await api.getSnapshot();
screen = buildMainScreen(snap);
return screen;
}

return {
current: () => screen,
async start() { return toMain();},

// action 画面のボタンが押された。次の画面モデルを返す（null = 終了）。
async press(buttonId) {
if (!screen || screen.kind!== "action") return null;
const id = screen.id;

if (id === "main") {
if (buttonId === "close") { screen = null; return null;}
if (buttonId === "items") {
const snap = await api.getSnapshot();
screen = buildItemsScreen(snap);
return screen;
}
if (buttonId === "heal") {
const r = await api.useHeal();
sayLine(r?.ok? EQUIP_LINES.healOk(r.name || "回復アイテム"): EQUIP_LINES.fail);
return toMain();
}
if (buttonId.startsWith("slot:")) {
const key = buttonId.slice(5);
const snap = await api.getSnapshot();
const item = snap.equipment?.[key];
if (item) { screen = buildSlotScreen(key, item); return screen;}
const cands = await api.ownerCandidates(key);
screen = buildCandidateScreen(key, cands);
return screen;
}
return screen;
}

if (id.startsWith("slotmenu:")) {
const key = id.slice(9);
if (buttonId === "back") return toMain();
if (buttonId === "unequip") {
const r = await api.unequipToOwner(key);
sayLine(r?.ok? EQUIP_LINES.unequipOk(r.name || "装備"): EQUIP_LINES.fail);
return toMain();
}
if (buttonId === "change") {
const cands = await api.ownerCandidates(key);
screen = buildCandidateScreen(key, cands);
return screen;
}
return screen;
}

if (id.startsWith("cand:")) {
const key = id.slice(5);
if (buttonId === "back") return toMain();
if (buttonId.startsWith("cand:")) {
const ownerSlot = Number(buttonId.slice(5));
const r = await api.equipFromOwner(key, ownerSlot);
sayLine(r?.ok? EQUIP_LINES.equipOk(r.name || "装備"): EQUIP_LINES.fail);
return toMain();
}
return screen;
}

if (id.startsWith("notice:")) {
if (buttonId === "back") return toMain();
return screen;
}

if (id === "items") {
if (buttonId === "back") return toMain();
if (buttonId === "receive") {
const oi = await api.ownerItems();
screen = buildReceiveScreen(oi);
return screen;
}
if (buttonId.startsWith("item:")) {
const slot = Number(buttonId.slice(5));
const snap = await api.getSnapshot();
const it = (snap.items || []).find((v) => v.slot === slot);
if (!it) return toMain();
screen = buildAmountModal({ action: "give", slot, name: it.name, max: it.amount});
return screen;
}
return screen;
}

if (id === "receive") {
if (buttonId === "back") {
const snap = await api.getSnapshot();
screen = buildItemsScreen(snap);
return screen;
}
if (buttonId.startsWith("oitem:")) {
const slot = Number(buttonId.slice(6));
const oi = await api.ownerItems();
const it = (oi || []).find((v) => v.slot === slot);
if (!it) return toMain();
screen = buildAmountModal({ action: "receive", slot, name: it.name, max: it.amount});
return screen;
}
return screen;
}

return screen;
},

// modal 画面が送信された。formValues = [個数]。次の画面モデルを返す。
async submitModal(formValues) {
if (!screen || screen.kind!== "modal") return null;
const p = screen.pending;
const n = Math.max(1, Math.floor(Number(formValues?.[0]) || 1));
if (p.action === "give") {
const r = await api.giveToOwner(p.slot, n);
sayLine(r?.ok? EQUIP_LINES.giveOk(p.name, r.moved?? n): EQUIP_LINES.fail);
} else {
const r = await api.receiveFromOwner(p.slot, n);
sayLine(r?.ok? EQUIP_LINES.receiveOk(p.name, r.moved?? n): EQUIP_LINES.fail);
}
return toMain();
},

cancel() { screen = null;},
};
}

// ---------------------------------------------------------------- フォーム実体への描画＋ドライバ
// forms = { ActionFormData, ModalFormData}（実環境では @minecraft/server-ui から注入）
export function renderForm(forms, screen) {
if (screen.kind === "modal") {
const f = new forms.ModalFormData();
f.title(screen.title);
for (const fld of screen.fields) {
if (fld.type === "slider") f.slider(fld.label, fld.min, fld.max, { valueStep: fld.step, defaultValue: fld.def});
}
return f;
}
const f = new forms.ActionFormData();
f.title(screen.title);
if (screen.body) f.body(screen.body);
for (const b of screen.buttons) f.button(b.label);
return f;
}

// プレイヤーに対して UI を開き、閉じるまで画面遷移を駆動する。
// 戻り値: 表示した画面 id の履歴（テスト・ログ用）。
export async function openEquipUI(player, deps) {
const session = createEquipSession(deps.api);
const history = [];
let screen = await session.start();
while (screen) {
history.push(screen.id);
const form = renderForm(deps.forms, screen);
let res;
try { res = await form.show(player);} catch { session.cancel(); return history;}
if (!res || res.canceled) { session.cancel(); return history;}
if (screen.kind === "modal") {
screen = await session.submitModal(res.formValues);
} else {
const btn = screen.buttons[res.selection];
if (!btn) { session.cancel(); return history;}
screen = await session.press(btn.id);
}
}
return history;
}
