// take_ban_math.js — 回収の全量失敗 (INVENTORY_FULL) への実行側見切り (TR2136-01)
// 設計の正: brain_parts/solutions/cycle2200-a01-takeban-design/DESIGN.md (cycle2200-a01)
// 問題: 満杯・相乗り不可のとき脳ルール回収が出口なしで永久ループする
//   (cycle2136-a02 実測: 120/120 サイクル同一 act、入庫ルール p675 は一度も選ばれない)。
// 是正: 全量失敗の発生点 (execArrive / pickupItemEntity の INVENTORY_FULL 分岐) で
//   実体 id キー＋種別キーの二重で 60 秒見切りを記録し、選択側 (buildContext の
//   アイテム走査) と固定対象の入口 (pickupItemEntity) で ban 中の対象を外す。
//   種別キーを併記するのは、同種の別ドロップへ1回ずつ失敗を繰り返す
//   ホッピング (キュー0-A バグ2 の単位不一致と同型) を1回の失敗で断つため。
// 純粋核: @minecraft/server を import しない。例外を投げない。now は引数で受ける。
// 不正入力は「ban されていない」へ倒す (fail-open: 時計異常で永久 ban にしない)。
// 状態は呼び出し側 (r.takeBan) が保持するプレーンオブジェクト。永続化はしない。

export const TAKE_BAN_MS = 60000; // noteTakeFull (main.js) のデデュープ窓と一致させる単一の値

function entKeyOf(entityId) {
  try {
    if (entityId === null || entityId === undefined || entityId === "") return null;
    return "ent:" + String(entityId);
  } catch { return null; }
}

function typeKeyOf(typeId) {
  try {
    if (typeof typeId !== "string" || typeId === "") return null;
    return "type:" + typeId;
  } catch { return null; }
}

function validState(state) {
  return !!state && typeof state === "object"
    && !!state.byEnt && typeof state.byEnt === "object"
    && !!state.byType && typeof state.byType === "object";
}

export function createTakeBanState() {
  return { byEnt: Object.create(null), byType: Object.create(null) };
}

// 全量失敗1回の記録。二重キーの両方へ until = now + TAKE_BAN_MS を書く。
// 既存エントリがある場合は延長のみ (短縮しない)。
export function recordTakeBan(state, entityId, typeId, now) {
  try {
    if (!validState(state)) return { recorded: false, entKey: null, typeKey: null, until: null };
    if (typeof now !== "number" || !Number.isFinite(now)) return { recorded: false, entKey: null, typeKey: null, until: null };
    const ek = entKeyOf(entityId);
    const tk = typeKeyOf(typeId);
    if (ek === null && tk === null) return { recorded: false, entKey: null, typeKey: null, until: null };
    const until = now + TAKE_BAN_MS;
    if (ek !== null) state.byEnt[ek] = Math.max(typeof state.byEnt[ek] === "number" ? state.byEnt[ek] : -Infinity, until);
    if (tk !== null) state.byType[tk] = Math.max(typeof state.byType[tk] === "number" ? state.byType[tk] : -Infinity, until);
    return { recorded: true, entKey: ek, typeKey: tk, until };
  } catch { return { recorded: false, entKey: null, typeKey: null, until: null }; }
}

// byEnt / byType のどちらかのエントリが now < until なら true。
// 期限境界は trunk_ban の isBanned と同じく now >= until で失効。
export function isTakeBanned(state, entityId, typeId, now) {
  try {
    if (!validState(state)) return false;
    if (typeof now !== "number" || !Number.isFinite(now)) return false;
    const ek = entKeyOf(entityId);
    if (ek !== null) {
      const u = state.byEnt[ek];
      if (typeof u === "number" && Number.isFinite(u) && now < u) return true;
    }
    const tk = typeKeyOf(typeId);
    if (tk !== null) {
      const u = state.byType[tk];
      if (typeof u === "number" && Number.isFinite(u) && now < u) return true;
    }
    return false;
  } catch { return false; }
}

// 走査候補形 { id, typeId } への薄いラッパ。
export function matchesTakeBan(state, cand, now) {
  try {
    return isTakeBanned(state, cand?.id ?? null, cand?.typeId ?? null, now);
  } catch { return false; }
}

// ban 中の候補だけを除いた新しい配列を返す (順序保持、入力は破壊しない)。
export function filterTakeBanned(state, candidates, now) {
  try {
    if (!Array.isArray(candidates)) return [];
    return candidates.filter((c) => !matchesTakeBan(state, c, now));
  } catch { return []; }
}

// 期限切れエントリを両表から削除し、削除件数を返す。
export function pruneTakeBans(state, now) {
  try {
    if (!validState(state)) return 0;
    if (typeof now !== "number" || !Number.isFinite(now)) return 0;
    let removed = 0;
    for (const table of [state.byEnt, state.byType]) {
      for (const k of Object.keys(table)) {
        const u = table[k];
        if (typeof u !== "number" || !Number.isFinite(u) || now >= u) { delete table[k]; removed++; }
      }
    }
    return removed;
  } catch { return 0; }
}

// 種別エントリだけを消して成否を返す。本版では配線しない (将来の即時解除の受け皿)。
export function clearTakeBanForType(state, typeId) {
  try {
    if (!validState(state)) return false;
    const tk = typeKeyOf(typeId);
    if (tk === null) return false;
    if (!(tk in state.byType)) return false;
    delete state.byType[tk];
    return true;
  } catch { return false; }
}
