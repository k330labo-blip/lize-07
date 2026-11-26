// trunk_ban.mjs — キュー0-A バグ2 キュー0-A バグ2 (cycle1728, v0.5.19 統合)
//
// 問題 (現行 main.js, 実測で確認した読み):
//   - tickMission の45秒見切り: r.mBanKey = r.mTargetKey
//     r.mTargetKey は「見つけた原木」のセルキー `${x},${y},${z}` (例: y=68)。
//   - しかし startWork は原木/幹について同じ幹の最下段へ寄せる
//     (typeId が同一のまま y を下げ続ける, 例: y=64)。実際に掘るのは最下段。
//   - 次回選択の ban 照合もセルキー完全一致のみ:
//       r.mBanKey === `${ft.loc.x},${ft.loc.y},${ft.loc.z}`
//     lookupSurvey(bot, ids, banKey) も `${loc.x},${loc.y},${loc.z}` 完全一致のみ。
//   → 同じ幹の別 y (例: y=67) が再選択されると ban をすり抜け、startWork が
//     再び同じ最下段 y=64 へ寄せ、45秒→別 y を ban→… の永久ループになる。
//     ban した y 自体しか避けられないため「保留」にもならない。
//
// 是正 (本ドラフト): 見切りの単位を「セル」から「幹」へそろえる。
//   - 原木/幹 (startWork の寄せ条件と同一: typeId に "_log" / "_stem" を含む)
//     → ban キーは (x, z, typeId) の幹キー。y は含めない。
//   - それ以外 → 従来どおりセルキー `${x},${y},${z}`。
//   キーは文字列のままなので、現行 r.mBanKey / lookupSurvey の banKey 引数に
//   そのまま流せる (統合時は生成側・照合側の両方を本モジュール経由にする)。
//
// 設計上の注意:
//   - 幹の同一視は (x,z,typeId) のみ。同じ x,z に隙間を空けて別個体が
//     重なる稀なケースでは過剰 ban になるが、ban は60秒期限付きであり
//     実害は「その柱を60秒避ける」に留まる。y 区間まで厳密化すると
//     「見つけた原木」と「掘る最下段」のズレが再発するため採らない。
//   - "_wood" (樹皮ブロック) は startWork の寄せ対象外 (_log/_stem のみ)
//     なので幹扱いしない。寄せ条件と ban 条件を常に一致させるのが原則。
//   - 純粋関数のみ。Date.now は引数で受ける。例外は投げない (不正入力は
//     セルキー fallback / false を返す)。
//
// 統合手順 (コーディネータ向け, 本ドラフトでは未実施):
//   1. 見切り時: r.mBanKey = banKeyFor(r.mTargetLoc, r.mTargetType)
//      (mTargetLoc が無い場合は従来どおり何もしない)
//   2. 再選択時: isBanned(ft.loc, ft.typeId, r.mBanKey, r.mBanUntil, Date.now())
//      で判定し、セルキー完全一致の手書き比較を置き換える。
//   3. lookupSurvey の除外判定も isBanned(loc, typeId, banKey) へ。
//      ※ survey レコードは typeId を持たない場合がある。その場合は
//        isBanned がセルキー fallback で従来動作 (完全一致) に戻る。

/** セルキー (従来形式と完全互換: "x,y,z") */
export function cellKey(loc) {
  if (!loc || !Number.isFinite(loc.x) || !Number.isFinite(loc.y) || !Number.isFinite(loc.z)) return null;
  return `${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`;
}

/** startWork の最下段寄せ対象と同一条件か (原木/幹)。0-C6(a) cycle1155: _stem の部分一致が melon_stem/pumpkin_stem を幹と誤認するため、正規の幹 (crimson/warped 系) のみに限定 */
export function isTrunkType(typeId) {
  return typeof typeId === "string" && (typeId.includes("_log") || (typeId.endsWith("_stem") && /(crimson|warped)/.test(typeId)));
}

/** 幹キー: y を含めない "trunk:<typeId>@<x>,<z>" */
export function trunkKey(loc, typeId) {
  if (!loc || !Number.isFinite(loc.x) || !Number.isFinite(loc.z) || !isTrunkType(typeId)) return null;
  return `trunk:${typeId}@${Math.floor(loc.x)},${Math.floor(loc.z)}`;
}

// FALL-COLUMN-BAN-01 (cyc2364 A06 確定, cyc2365 統合): 落下ブロックの柱では
// hold の原因が柱全体なのに ban がセル単位で、窓内に別セルが再選され hold 周期を
// 繰り返した。是正: 落下ブロックも柱単位キーにする。分類は main.js の
// FALLING_BLOCK_IDS と同一集合 (砂/赤砂/怪しい砂/砂利/怪しい砂利/全色コンクリートパウダー)。
const FALLING_BLOCK_IDS = new Set(["minecraft:sand","minecraft:red_sand","minecraft:suspicious_sand","minecraft:gravel","minecraft:suspicious_gravel","minecraft:white_concrete_powder","minecraft:orange_concrete_powder","minecraft:magenta_concrete_powder","minecraft:light_blue_concrete_powder","minecraft:yellow_concrete_powder","minecraft:lime_concrete_powder","minecraft:pink_concrete_powder","minecraft:gray_concrete_powder","minecraft:light_gray_concrete_powder","minecraft:cyan_concrete_powder","minecraft:purple_concrete_powder","minecraft:blue_concrete_powder","minecraft:brown_concrete_powder","minecraft:green_concrete_powder","minecraft:red_concrete_powder","minecraft:black_concrete_powder"]);

export function isFallingType(typeId) {
  return typeof typeId === "string" && FALLING_BLOCK_IDS.has(typeId);
}

/** 落下ブロック柱キー: y を含めない "fall:<typeId>@<x>,<z>" */
export function fallKey(loc, typeId) {
  if (!loc || !Number.isFinite(loc.x) || !Number.isFinite(loc.z) || !isFallingType(typeId)) return null;
  return `fall:${typeId}@${Math.floor(loc.x)},${Math.floor(loc.z)}`;
}

/**
 * 見切り ban のキーを作る単一の正。
 * 原木/幹 → 幹キー、それ以外・typeId不明 → セルキー (従来どおり)。
 */
export function banKeyFor(loc, typeId) {
  return trunkKey(loc, typeId) ?? fallKey(loc, typeId) ?? cellKey(loc);
}

/**
 * 候補 (loc, typeId) が ban キーに一致するか。
 * - banKey が幹キー: 候補を幹キー化して比較する。
 *   候補の typeId が不明な場合は幹キーと照合できないため false
 *   (不明を ban 扱いにすると無関係な対象まで止めるため)。
 * - banKey がセルキー (従来形式・非原木): セルキー完全一致のみ (従来どおり)。
 *   ただし移行期の互換として、セルキーが原木セルを指していた場合に備え、
 *   候補が同じ (x,z) の原木で banKey の x,z と一致し… とはしない。
 *   旧形式の ban は最大60秒で失効するので互換レイヤーは入れない (単純さ優先)。
 */
export function matchesBan(loc, typeId, banKey) {
  if (!banKey || typeof banKey !== "string") return false;
  if (banKey.startsWith("trunk:")) {
    const k = trunkKey(loc, typeId);
    return k !== null && k === banKey;
  }
  if (banKey.startsWith("fall:")) {
    const k = fallKey(loc, typeId);
    return k !== null && k === banKey;
  }
  const c = cellKey(loc);
  return c !== null && c === banKey;
}

/** 期限つき ban 判定。until が過去/不正なら ban されていない扱い。 */
export function isBanned(loc, typeId, banKey, banUntil, now) {
  if (!Number.isFinite(banUntil) || !Number.isFinite(now) || now >= banUntil) return false;
  return matchesBan(loc, typeId, banKey);
}

/**
 * 候補リストから ban 中のものを除く (lookupSurvey / findMissionTarget の
 * 次点選択用)。入力は [{loc:{x,y,z}, typeId?}, ...]、順序は保持する。
 */
export function filterBanned(candidates, banKey, banUntil, now) {
  if (!Array.isArray(candidates)) return [];
  return candidates.filter((c) => c && !isBanned(c.loc, c.typeId ?? null, banKey, banUntil, now));
}
