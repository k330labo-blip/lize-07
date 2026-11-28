// danger_xray_math.js — danger の視覚／非視覚分離の純粋核 (0-O2 DANGER-XRAY-01)。
// buildContext の danger は LOS なし距離だけで計算され、壁越しに安全反応が発火していた。
// visual=視覚で確認した危険、cue=被弾など視覚以外の手がかり、safety=visual∪有効期間内の cue。
// 既存 c.danger.* (raw) の意味は変えない (ctx 規約: 追加のみ可)。
// visual の 999 は「視認した敵がいない」= unknown であり「敵がいない」ではない。
// cue は被弾イベント由来でのみ立つ。走査からは供給しない (透視の復活防止)。
// cueLoc は被弾時点のスナップショット。以後の生座標で更新しない。
// loc の意味は source で異なる: self_hurt=攻撃者の座標、owner_hurt=被弾した主人の座標。
export const DANGER_CUE_TTL_MS = 4000;
export const DANGER_CUE_UNKNOWN_DIST = 6;
export function emptyVisualDanger() {
  return { visualCount: 0, visualNearestDist: 999, visualCreeperDist: 999, visualRangedDist: 999, visualOwnerTargeted: false };
}
export function noteVisualHostile(acc, o) {
  if (!acc || !o || o.vis !== true || !Number.isFinite(o.dist)) return acc;
  acc.visualCount++;
  if (o.dist < acc.visualNearestDist) acc.visualNearestDist = o.dist;
  if (o.typeId === "minecraft:creeper") acc.visualCreeperDist = Math.min(acc.visualCreeperDist, o.dist);
  if (o.isRanged === true) acc.visualRangedDist = Math.min(acc.visualRangedDist, o.dist);
  return acc;
}
export function noteDangerCue(ledger, input) {
  const at = Number.isFinite(input?.at) ? input.at : null;
  if (at === null) return ledger && typeof ledger === "object" ? ledger : { at: null };
  const loc = input.loc && Number.isFinite(input.loc.x) && Number.isFinite(input.loc.y) && Number.isFinite(input.loc.z)
    ? { x: input.loc.x, y: input.loc.y, z: input.loc.z } : null;
  return {
    at,
    source: input.source === "owner_hurt" ? "owner_hurt" : "self_hurt",
    typeId: typeof input.typeId === "string" ? input.typeId : null,
    loc,
    dist: Number.isFinite(input.dist) ? input.dist : null,
  };
}
export function dangerCueSnapshot(ledger, nowMs) {
  const none = { cueActive: false, cueCount: 0, cueNearestDist: 999, cueDistKnown: false, cueSource: null, cueAt: null, cueLoc: null };
  if (!ledger || !Number.isFinite(ledger.at) || !Number.isFinite(nowMs)) return none;
  if (nowMs - ledger.at < 0 || nowMs - ledger.at > DANGER_CUE_TTL_MS) return none;
  const known = Number.isFinite(ledger.dist);
  return {
    cueActive: true, cueCount: 1,
    cueNearestDist: known ? ledger.dist : DANGER_CUE_UNKNOWN_DIST,
    cueDistKnown: known,
    cueSource: ledger.source, cueAt: ledger.at, cueLoc: ledger.loc || null,
  };
}
export function deriveSafetyDanger(visual, cue) {
  const v = visual || emptyVisualDanger();
  const active = !!(cue && cue.cueActive);
  return {
    safetyCount: (v.visualCount || 0) + (active ? 1 : 0),
    safetyNearestDist: Math.min(v.visualNearestDist ?? 999, active ? (cue.cueNearestDist ?? 999) : 999),
    safetyCreeperDist: v.visualCreeperDist ?? 999,
    safetyRangedDist: v.visualRangedDist ?? 999,
  };
}
