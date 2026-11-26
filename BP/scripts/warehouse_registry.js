// warehouse_registry.js — 倉庫トラック W1 (cycle1337): 倉庫登録の台帳の純粋核。
// 要件の正は brain_parts/solutions/warehouse/REQUIREMENTS.md (ステージ W1)。
// データは JSON 保存できる形だけを持ち、DP への読み書きと UI は接続側 (main) の責務。
// 規則: 除外は他の全設定より優先する。ラージチェストは pairKey で結ばれた2半分を
// 1つの収納先として扱い、どちらの半分からでも同じ正規キーへ解決する。
// 登録箱が壊れた・組み合わせが変わったら needsRecheck を立て、再確認まで書き込み先に使わない。
// 純粋: @minecraft/server を import しない。例外を投げない。

export const WAREHOUSE_REGISTRY_VERSION = "warehouse_registry_v1";
export const WAREHOUSE_ROLES = ["intake", "dest", "source", "excluded", "unclassified"];

export function warehouseKeyOf(dim, x, y, z) {
  try {
    if (typeof dim !== "string" || !dim) return null;
    const n = [x, y, z].map((v) => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : null));
    if (n.some((v) => v === null)) return null;
    return `${dim}|${n[0]},${n[1]},${n[2]}`;
  } catch { return null; }
}

export function createWarehouseRegistry() {
  return { version: WAREHOUSE_REGISTRY_VERSION, boxes: [], candidates: [], itemRules: [] };
}

function normRegistry(reg) {
  const r = reg && typeof reg === "object" ? reg : {};
  return {
    version: WAREHOUSE_REGISTRY_VERSION,
    boxes: Array.isArray(r.boxes) ? r.boxes : [],
    candidates: Array.isArray(r.candidates) ? r.candidates : [],
    itemRules: Array.isArray(r.itemRules) ? r.itemRules : [],
  };
}

function boxByKey(reg, key) { return reg.boxes.find((b) => b && b.key === key) || null; }

// 正規キー: pairKey で結ばれた組は小さい方のキーを代表にする (どちらの半分でも同じ先へ解決する)
export function canonicalKeyOf(reg, key) {
  try {
    const r = normRegistry(reg);
    const b = boxByKey(r, key);
    if (!b) return key || null;
    if (!b.pairKey) return b.key;
    const mate = boxByKey(r, b.pairKey);
    if (!mate) return b.key;
    return b.key < mate.key ? b.key : mate.key;
  } catch { return key || null; }
}

function pairGroup(reg, key) {
  const canon = canonicalKeyOf(reg, key);
  if (!canon) return [];
  return normRegistry(reg).boxes.filter((b) => b && canonicalKeyOf(reg, b.key) === canon);
}

// 役割の解決: 除外が最優先。needsRecheck の箱は "stale" として返し、書き込み先に使わせない。
export function resolveRole(reg, key) {
  try {
    const r = normRegistry(reg);
    const group = pairGroup(r, key);
    if (!group.length) return null;
    if (group.some((b) => b.role === "excluded")) return "excluded";
    if (group.some((b) => b.needsRecheck)) return "stale";
    const canon = canonicalKeyOf(r, key);
    const rep = group.find((b) => b.key === canon) || group[0];
    return rep.role || null;
  } catch { return null; }
}

// 登録。除外済みのキーへ別役割を上書きしない (除外優先)。pairKey は相手キー (文字列) をそのまま保持する。
export function registerBox(reg, box) {
  try {
    const r = normRegistry(reg);
    if (!box || typeof box !== "object") return { reg: r, ok: false, reason: "invalid_box" };
    const key = typeof box.key === "string" && box.key ? box.key : warehouseKeyOf(box.dim, box.x, box.y, box.z);
    if (!key) return { reg: r, ok: false, reason: "invalid_key" };
    if (!WAREHOUSE_ROLES.includes(box.role)) return { reg: r, ok: false, reason: "invalid_role" };
    const existing = boxByKey(r, key);
    if (existing && existing.role === "excluded" && box.role !== "excluded") return { reg: r, ok: false, reason: "excluded_priority" };
    const entry = {
      key,
      dim: typeof box.dim === "string" ? box.dim : key.split("|")[0],
      role: box.role,
      category: typeof box.category === "string" ? box.category : null,
      pairKey: typeof box.pairKey === "string" && box.pairKey ? box.pairKey : (existing?.pairKey ?? null),
      verifiedAt: typeof box.verifiedAt === "number" && Number.isFinite(box.verifiedAt) ? box.verifiedAt : Date.now(),
      needsRecheck: box.role === "excluded" ? false : !!box.needsRecheck,
    };
    const boxes = existing ? r.boxes.map((b) => (b.key === key ? entry : b)) : [...r.boxes, entry];
    // 候補一覧からは消す (登録済みは候補ではない)
    const candidates = r.candidates.filter((c) => c && c.key !== key);
    return { reg: { ...r, boxes, candidates }, ok: true, reason: null };
  } catch { return { reg: normRegistry(reg), ok: false, reason: "error" }; }
}

// 範囲スキャンの候補をまとめて保持する (登録済み・重複は除く)。登録前に候補から外す操作は removeCandidate で行う。
export function addCandidates(reg, list) {
  try {
    const r = normRegistry(reg);
    const seen = new Set([...r.boxes.map((b) => b?.key), ...r.candidates.map((c) => c?.key)]);
    const added = [];
    for (const c of Array.isArray(list) ? list : []) {
      const key = c && typeof c.key === "string" && c.key ? c.key : warehouseKeyOf(c?.dim, c?.x, c?.y, c?.z);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      added.push({ key, dim: typeof c?.dim === "string" ? c.dim : key.split("|")[0] });
    }
    return { reg: { ...r, candidates: [...r.candidates, ...added] }, added: added.length };
  } catch { return { reg: normRegistry(reg), added: 0 }; }
}

export function removeCandidate(reg, key) {
  try {
    const r = normRegistry(reg);
    return { ...r, candidates: r.candidates.filter((c) => c && c.key !== key) };
  } catch { return normRegistry(reg); }
}

// 破損・再編成の検知時: 組全体へ再確認印を立てる (古い登録のまま隣箱へ書かないため)
export function markNeedsRecheck(reg, key) {
  try {
    const r = normRegistry(reg);
    const canon = canonicalKeyOf(r, key);
    const boxes = r.boxes.map((b) => (b && canonicalKeyOf(r, b.key) === canon && b.role !== "excluded" ? { ...b, needsRecheck: true } : b));
    return { ...r, boxes };
  } catch { return normRegistry(reg); }
}

export function confirmBox(reg, key, verifiedAt) {
  try {
    const r = normRegistry(reg);
    const canon = canonicalKeyOf(r, key);
    const boxes = r.boxes.map((b) => (b && canonicalKeyOf(r, b.key) === canon ? { ...b, needsRecheck: false, verifiedAt: typeof verifiedAt === "number" && Number.isFinite(verifiedAt) ? verifiedAt : Date.now() } : b));
    return { ...r, boxes };
  } catch { return normRegistry(reg); }
}

// アイテム別行き先の学習 (W3 の判定順1)。行き先は正規キーで保持する。
export function teachItemDest(reg, itemId, boxKey) {
  try {
    const r = normRegistry(reg);
    if (typeof itemId !== "string" || !itemId || !boxByKey(r, boxKey)) return { reg: r, ok: false, reason: "invalid" };
    if (resolveRole(r, boxKey) === "excluded") return { reg: r, ok: false, reason: "excluded_priority" };
    const canon = canonicalKeyOf(r, boxKey);
    const itemRules = [...r.itemRules.filter((x) => x && x.item !== itemId), { item: itemId, boxKey: canon }];
    return { reg: { ...r, itemRules }, ok: true, reason: null };
  } catch { return { reg: normRegistry(reg), ok: false, reason: "error" }; }
}

export function destForItem(reg, itemId) {
  try {
    const rule = normRegistry(reg).itemRules.find((x) => x && x.item === itemId);
    return rule ? rule.boxKey : null;
  } catch { return null; }
}

// 永続化: JSON 往復。壊れた要素は落とし、形が違う版は空台帳として返す (fail-closed)。
export function serializeWarehouseRegistry(reg) {
  try { return JSON.stringify(normRegistry(reg)); } catch { return JSON.stringify(createWarehouseRegistry()); }
}

export function deserializeWarehouseRegistry(json) {
  try {
    if (typeof json !== "string" || !json) return createWarehouseRegistry();
    const parsed = JSON.parse(json);
    if (!parsed || parsed.version !== WAREHOUSE_REGISTRY_VERSION) return createWarehouseRegistry();
    const out = createWarehouseRegistry();
    for (const b of Array.isArray(parsed.boxes) ? parsed.boxes : []) {
      if (!b || typeof b.key !== "string" || !WAREHOUSE_ROLES.includes(b.role)) continue;
      out.boxes.push({ key: b.key, dim: typeof b.dim === "string" ? b.dim : b.key.split("|")[0], role: b.role, category: typeof b.category === "string" ? b.category : null, pairKey: typeof b.pairKey === "string" && b.pairKey ? b.pairKey : null, verifiedAt: typeof b.verifiedAt === "number" && Number.isFinite(b.verifiedAt) ? b.verifiedAt : 0, needsRecheck: !!b.needsRecheck });
    }
    for (const c of Array.isArray(parsed.candidates) ? parsed.candidates : []) {
      if (c && typeof c.key === "string" && c.key && !out.boxes.some((b) => b.key === c.key)) out.candidates.push({ key: c.key, dim: typeof c.dim === "string" ? c.dim : c.key.split("|")[0] });
    }
    for (const x of Array.isArray(parsed.itemRules) ? parsed.itemRules : []) {
      if (x && typeof x.item === "string" && x.item && typeof x.boxKey === "string" && x.boxKey) out.itemRules.push({ item: x.item, boxKey: x.boxKey });
    }
    return out;
  } catch { return createWarehouseRegistry(); }
}
