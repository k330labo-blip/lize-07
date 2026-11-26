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
