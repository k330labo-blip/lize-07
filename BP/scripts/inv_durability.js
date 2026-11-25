// inv_durability.js — cycle2311: インベントリ内アイテムの残耐久割合の集計 (純粋核)
// planBootstrap の invDurability 入力 ({ itemId: 最も傷んだ個体の残耐久割合 0..1 }) の供給者。
// 従来はこの入力を組み立てるコードが本番に無く、耐久予備ポリシーが楽観条件でも発動しなかった
// (cycle2248-a08 / cycle2311-a05 で実測確定)。コンテナは duck-type で受け、@minecraft/server を
// import しない。全経路例外安全で、読めない個体は「不明」として数えない (1.0 と偽らない)。
export function durabilityFracOfItem(it) {
  try {
    if (!it || typeof it.getComponent !== "function") return null;
    const d = it.getComponent("minecraft:durability");
    if (!d || !(d.maxDamage > 0)) return null;
    const f = (d.maxDamage - d.damage) / d.maxDamage;
    if (!Number.isFinite(f)) return null;
    return Math.min(1, Math.max(0, f));
  } catch { return null; }
}

// container: { size, getItem(i) } 形。同一 typeId は最小値 (最も傷んだ個体) を残す。
export function collectInvDurability(container) {
  const out = {};
  try {
    if (!container || typeof container.size !== "number" || typeof container.getItem !== "function") return out;
    for (let i = 0; i < container.size; i++) {
      let it = null; try { it = container.getItem(i); } catch { continue; }
      if (!it || !it.typeId) continue;
      const f = durabilityFracOfItem(it);
      if (f === null) continue;
      if (out[it.typeId] === undefined || f < out[it.typeId]) out[it.typeId] = f;
    }
  } catch {}
  return out;
}
