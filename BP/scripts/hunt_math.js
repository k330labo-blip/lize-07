// hunt_math.js — HUNT 系是正の純粋核 (cyc2385 統合, v0.5.126)
// HUNT-ANIMAL-PROGRESS-01 (cyc2384 A14・BLOCKER): 討伐計上が敵対限定の門の内側にあり、
// 牛・羊・豚・鶏を倒しても missionKills が永遠に増えず no_progress 中断になった。
// 是正の単一の正: 計上可否は「現行 hunt ステップの対象指定」で決める。
//   - 種別指定 (target が実体ID): その種別の死亡なら敵対でなくても数える。
//   - 汎用指定 ("hostile" または未指定): 従来どおり敵対の死亡だけを数える
//     (HUNT-SUBST-01 の種別照合・汎用形の回帰ガードを維持する)。
// 純粋関数のみ。例外は投げない。

/**
 * 死亡実体を現行 hunt ステップの進捗として数えてよいか。
 * @param {string|null|undefined} stepTarget hunt_entity ステップの target
 * @param {string|null|undefined} deadTypeId 死亡実体の typeId
 * @param {boolean} deadHostile 死亡実体が敵対か (GVC集合/monster族)
 */
export function huntKillCounts(stepTarget, deadTypeId, deadHostile) {
  try {
    if (!deadTypeId || typeof deadTypeId !== "string") return false;
    if (stepTarget && stepTarget !== "hostile") return stepTarget === deadTypeId;
    return !!deadHostile;
  } catch { return false; }
}

/**
 * 走査候補 (hostiles/animals 等の実体配列) から typeId 一致の最寄りを返す。
 * HUNT-NEAREST-01 (cyc2384 A14 副次): 種別指定の選択が走査順 .find で最寄りでなかった是正。
 * entities: [{typeId, location}], selfPos: {x,y,z}。無ければ null。
 */
// HUNT-CREDIT-01 (0-N7, cyc2453): 討伐帰属。段1 damageSource の Bot 一致、段2 被弾台帳 (TTL 30秒・上限32件)。
export const HUNT_LEDGER_TTL_MS = 30000;
export const HUNT_LEDGER_MAX = 32;
export function huntCredit(input) {
  try {
    const i = input || {};
    if (!huntKillCounts(i.stepTarget, i.deadTypeId, i.deadHostile)) return { credit: false, via: null };
    if (i.attackerId && i.botId && i.attackerId === i.botId) return { credit: true, via: "damageSource" };
    const now = typeof i.now === "number" ? i.now : Date.now();
    if (typeof i.ledgerAt === "number" && now - i.ledgerAt >= 0 && now - i.ledgerAt <= HUNT_LEDGER_TTL_MS) return { credit: true, via: "ledger" };
    return { credit: false, via: null };
  } catch { return { credit: false, via: null }; }
}
export function noteHuntHit(ledger, entityId, now) {
  try {
    if (!(ledger instanceof Map) || !entityId) return ledger;
    const t = typeof now === "number" ? now : Date.now();
    for (const [k, v] of ledger) if (typeof v !== "number" || t - v > HUNT_LEDGER_TTL_MS) ledger.delete(k);
    ledger.delete(entityId); ledger.set(entityId, t); // 再打撃で挿入順も最新化する (上限切りで最新の関与が落ちないように)
    while (ledger.size > HUNT_LEDGER_MAX) { const oldest = ledger.keys().next().value; if (oldest === undefined) break; ledger.delete(oldest); }
    return ledger;
  } catch { return ledger; }
}
export function huntLedgerHitAt(ledger, entityId, now) {
  try {
    if (!(ledger instanceof Map) || !entityId) return null;
    const t = typeof now === "number" ? now : Date.now();
    const at = ledger.get(entityId);
    if (typeof at !== "number") return null;
    if (t - at > HUNT_LEDGER_TTL_MS || t - at < 0) { if (t - at > HUNT_LEDGER_TTL_MS) ledger.delete(entityId); return null; }
    return at;
  } catch { return null; }
}
export function nearestEntityOfType(entities, typeId, selfPos) {
  try {
    if (!Array.isArray(entities) || !typeId || !selfPos) return null;
    let best = null, bestD = Infinity;
    for (const e of entities) {
      if (!e || e.typeId !== typeId || !e.location) continue;
      const dx = e.location.x - selfPos.x, dy = e.location.y - selfPos.y, dz = e.location.z - selfPos.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  } catch { return null; }
}
