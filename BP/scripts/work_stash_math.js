// work_stash_math.js — A06-03 純粋核 (cycle0153-a02 ドラフトを cycle0224 で正式統合)
// r.work 単一スロットの差替で失われる掘削進捗 (left) を、直近1件だけ TTL つきで退避/復元する純粋核。
// 依存なし・例外安全・入力 (r 以外) 不変。r への書き込みは r.workStash のみ (追加フィールドであり
// 既存 ctx フィールドの削除・意味変更はしない)。
// 汎用規則: 作業種別・対象種別ごとの特例は持たない。キーは「実際に掘るセル (typeId@x,y,z)」で統一する
// (キュー0-A バグ2是正と同じ「見切り/進捗の単位は実際に掘る対象にそろえる」原則)。

export const WORK_STASH_TTL_MS = 90000; // side cooldown 20s (side_tasks.js) と本流45秒見切りより長く、無期限にはしない

export function workCellKey(loc, typeId) {
  try {
    if (!loc || typeof typeId !== "string" || !typeId) return null;
    const { x, y, z } = loc;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return `${typeId}@${x},${y},${z}`;
  } catch { return null; }
}

// 差替直前に呼ぶ: 進行中 (0 < left < hard) の work だけを1件退避する。
// 進捗のない work (left===hard) は退避しない (復元しても初期値と同値で無意味)。
// 戻り値: 退避したらそのキー、しなければ null。
export function stashWorkProgress(r, hardOf, nowMs) {
  try {
    if (!r || typeof hardOf !== "function") return null;
    const w = r.work;
    if (!w || !w.loc) return null;
    const key = workCellKey(w.loc, w.typeId);
    if (!key) return null;
    const hard = hardOf(w.typeId);
    if (!Number.isFinite(hard) || hard <= 0) return null;
    if (!Number.isFinite(w.left) || w.left <= 0 || w.left >= hard) return null;
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    r.workStash = { key, left: w.left, at: now };
    return key;
  } catch { return null; }
}

// 新規 work 作成時に呼ぶ: キーが一致し TTL 内なら left を返し、退避は消費する (使い回さない)。
// 期限切れの退避は掃除して null。hard より大きい値は hard へクランプ (硬度定義が変わった場合の防御)。
export function takeStashedLeft(r, loc, typeId, hard, nowMs) {
  try {
    if (!r || !r.workStash) return null;
    const s = r.workStash;
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    if (!Number.isFinite(s.at) || now - s.at > WORK_STASH_TTL_MS || now < s.at) { r.workStash = null; return null; }
    const key = workCellKey(loc, typeId);
    if (!key || s.key !== key) return null; // 不一致では消費しない (本来の対象が戻る余地を残す)
    r.workStash = null;
    if (!Number.isFinite(s.left) || s.left <= 0) return null;
    if (Number.isFinite(hard) && hard > 0) return Math.min(s.left, hard);
    return s.left;
  } catch { return null; }
}

// 破壊完了したセルの退避は消す (同じセルに新しいブロックが現れても旧進捗を被せない)。
export function clearStashFor(r, loc, typeId) {
  try {
    if (!r || !r.workStash) return false;
    const key = workCellKey(loc, typeId);
    if (key && r.workStash.key === key) { r.workStash = null; return true; }
  } catch {}
  return false;
}
