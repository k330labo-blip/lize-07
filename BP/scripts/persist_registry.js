// persist_registry.js — 永続化 (Dynamic Property) キーの登録簿 (PERSIST-REGISTRY-01 第1段, cyc2496)
//
// 目的: BP/scripts 内で使う全 cb_* キーを単一の正として宣言し、版なしキーの
// 無言の増加を構造的に止める (横断基盤の先行ルール, 2026-11-28 記号指示)。
// 第1段は「登録簿＋検出」のみ: 保存／復元は従来どおり dp/dps・wdp/wdps 経由で、
// 保存値・保存形式・復元順は一切変えない。版つき6系統は各所有モジュールの
// 版定数を正とし、本表はその値の写しを宣言として持つ (値の変更は所有側で行う)。
// 版なしキー (version: null) は「現行形を版1として登録」した状態であり、
// 版フィールドの導入と移行判定は第2段で行う (第2段まで新規 DP キーの追加は凍結)。
//
// フィールド:
//   key:      基本キー名 (接尾辞つきキーは base として登録)
//   scope:    "bot" = 個体 DP (dp/dps) / "world" = ワールド DP (wdp/wdps)
//   scoped:   null = 基本キーのみ / "player" | "owner" = `key:<id>` 形で使う
//   kind:     "single" = 1キー1値 / "shards" = メタキー＋世代つきシャード群
//   format:   保存値の形式 ("json" | "string" | "sharded-json")
//   version:  保存形式の版 (数値または文字列)。null は版なし (第2段の移行対象)
//   versionConst: 版定数の所在 (所有モジュール側が正)。inline はシャード JSON 内の v
//   owner:    保存形式を所有するモジュール
//   dependsOn: 復元時に直接読み直すキー (rt() の暗黙依存の宣言。cyc2496 A18 で全数確認)
//   note:     補足
//
// 本ファイルは @minecraft/server に依存しない純粋モジュール。検出は
// tools/validate.py が本表と BP/scripts の使用キーを突き合わせて行う
// (未登録キーの使用は validate 不合格)。

export const PERSIST_REGISTRY_VERSION = 1;

const B = "bot", W = "world";
export const PERSIST_KEYS = Object.freeze([
  // --- 個体 DP・版なし (第2段で版導入と移行判定を行う) ---
  { key: "cb_allowonly", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "inline v (cyc2498 2b)", owner: "allow_only.js", dependsOn: [], note: "限定 (allowOnly) の永続化" },
  { key: "cb_anchor", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "inline v (cyc2497 2a)", owner: "main.js", dependsOn: [], note: "帰還アンカー (2a で帯域内 v:1 導入。旧形 v0 は形検証を通れば受理し遅延移行)" },
  { key: "cb_bond", scope: B, scoped: null, kind: "single", format: "number", version: "n/a-scalar", versionConst: null, owner: "main.js", dependsOn: [], note: "絆 (素の数値。2a 裁定で版を導入せず値域検証で代用)" },
  { key: "cb_caps", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "envelope v (cyc2498 2b)", owner: "cap_guard_math.js", dependsOn: [], note: "上限 (caps)" },
  { key: "cb_endgoal", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "inline v (cyc2497 2a)", owner: "main.js", dependsOn: [], note: "ENDGOAL 状態 (2a で帯域内 v:1 導入。未来版は復元せず上書きもしない)" },
  { key: "cb_firstday", scope: B, scoped: null, kind: "single", format: "number", version: "n/a-scalar", versionConst: null, owner: "main.js", dependsOn: [], note: "初日 (素の数値=world.getDay()。2a 裁定で版なし確定)" },
  { key: "cb_forbids", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "envelope v (cyc2498 2b)", owner: "session_forbids.js", dependsOn: [], note: "禁止対象 (sessionForbids の永続化)" },
  { key: "cb_home", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "inline v (cyc2497 2a)", owner: "main.js", dependsOn: [], note: "拠点 (2a で帯域内 v:1 導入。未来版は未登録へ倒すが登録操作まで上書きしない)" },
  { key: "cb_longtask", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "inline v (cyc2498 2b)", dependsOn: [], note: "長期タスク。pending_gear/pending_tool の復元が直接読む (dependsOn の被参照側)" },
  { key: "cb_mission", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "inline v (cyc2498 2b)", dependsOn: [], note: "ミッション (persistMission、素 JSON 往復)" },
  { key: "cb_mode", scope: B, scoped: null, kind: "single", format: "string", version: "n/a-scalar", versionConst: null, owner: "main.js", dependsOn: [], note: "モード (素の文字列 follow/stay/work/free。2a 裁定で版なし確定)" },
  { key: "cb_order", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "inline v (cyc2497 2a)", owner: "main.js", dependsOn: [], note: "注文 (書き込み専用記録。2a で帯域内 v:1 導入)" },
  { key: "cb_owner", scope: B, scoped: null, kind: "single", format: "string", version: "n/a-scalar", versionConst: null, owner: "main.js", dependsOn: [], note: "所有者 (素の文字列=プレイヤーID。2a 裁定で版なし確定)" },
  { key: "cb_pending_condition", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "inline v (cyc2498 2b)", owner: "pending_condition_math.js", dependsOn: [], note: "条件保留" },
  { key: "cb_pending_gear", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "envelope v (cyc2498 2b)", dependsOn: ["cb_longtask"], note: "GEARSET-CHAIN-LTDEAD-01: 復元時に cb_longtask を直接読み直す" },
  { key: "cb_pending_tool", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "inline v (cyc2498 2b)", dependsOn: ["cb_longtask"], note: "TOOLCHAIN-RESTORE-LTGATE-01: 復元時に cb_longtask を直接読み直す" },
  { key: "cb_sustain", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "SUSTAIN_VERSION (sustain_math.js)", owner: "sustain_math.js", dependsOn: [], note: "持続採掘の共通枠 (SUSTAIN-FRAME-01 単位1, cyc2521)。単一キー＋kind フィールド形、新規保存状態は dim 必須" },
  { key: "cb_stats", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "inline v (cyc2497 2a)", owner: "main.js", dependsOn: [], note: "統計 (2a で帯域内 v:1 導入。未来版・非オブジェクトは {} へ倒す)" },
  { key: "cb_trust", scope: B, scoped: null, kind: "single", format: "number", version: "n/a-scalar", versionConst: null, owner: "main.js", dependsOn: [], note: "信頼 (素の数値。2a 裁定で版なし確定)" },
  // --- 個体 DP・版つき (所有モジュールの版定数が正、移設のみ) ---
  { key: "cb_equip", scope: B, scoped: null, kind: "single", format: "string", version: 1, versionConst: "EQUIP_VERSION (equipment.js)", owner: "equipment.js", dependsOn: [], note: "装備 serialize 文字列。DP_KEY 定数経由でも使う" },
  { key: "cb_warehouse", scope: B, scoped: null, kind: "single", format: "json", version: "warehouse_registry_v1", versionConst: "WAREHOUSE_REGISTRY_VERSION (warehouse_registry.js)", owner: "warehouse_registry.js", dependsOn: [], note: "倉庫登録簿" },
  { key: "cb_trace", scope: B, scoped: null, kind: "single", format: "json", version: 1, versionConst: "TRACE_VERSION (trace.js)", owner: "trace.js", dependsOn: [], note: "判断トレース。TRACE_MAX_BYTES=16384" },
  { key: "cb_exp", scope: B, scoped: null, kind: "shards", format: "sharded-json", version: 1, versionConst: "inline v (exp_recorder.js)", owner: "exp_recorder.js", dependsOn: [], note: "経験ストア。メタ cb_exp＋シャード cb_exp:<i>、世代 gen つき、シャード上限 8192B／全体 65536B" },
  { key: "cb_failagg", scope: B, scoped: null, kind: "shards", format: "sharded-json", version: 1, versionConst: "FAILAGG_VERSION (fail_vocab.js)", owner: "fail_vocab.js", dependsOn: [], note: "失敗集計。メタ cb_failagg＋シャード cb_failagg:r:<i>／cb_failagg:w:<i>、世代 gen つき、8192B" },
  // --- ワールド DP・所有者／プレイヤー別 (接尾辞つき) ---
  { key: "cb_wmem", scope: W, scoped: "owner", kind: "single", format: "json", version: 2, versionConst: "WMEM_VERSION (world_memory.js)", owner: "world_memory.js", dependsOn: [], note: "世界記憶。cb_wmem:<ownerId> 形で使う (0-P で観測状態 os/oa を持つ v2)" },
  { key: "cb_death", scope: W, scoped: "player", kind: "single", format: "json", version: null, versionConst: null, owner: "main.js", dependsOn: [], note: "死亡位置。cb_death:<playerId> 形 (5分で自己失効するため 2a 裁定で移行対象外・版なし確定)" },
  { key: "cb_savedinv", scope: W, scoped: "player", kind: "single", format: "json", version: null, versionConst: null, owner: "main.js", dependsOn: ["cb_equip"], note: "回収時の所持品。cb_savedinv:<playerId> 形。中身の個別情報は INV_DATA_VERSION=2 (inv_item_data.js) が正。復元時に cb_equip を読む (cyc2496 A18)。外側コンテナの版は中身の所有者へ委譲 (2a 裁定)" },
  { key: "cb_saved_equip", scope: W, scoped: "player", kind: "single", format: "string", version: null, versionConst: null, owner: "main.js", dependsOn: [], note: "回収時の装備。cb_saved_equip:<playerId> 形。中身は EQUIP_VERSION=1 の serialize 文字列 (版は中身の所有者へ委譲・2a 裁定)" },
]);

// 接頭辞として他用途に流用される登録済みパターン (A01 申し送り: キーそのものではない)
// - "cb_trace:" / "cb_failagg:" / "cb_exp:" は exp_recorder の自器キー判定の接頭辞として現れる。
//   実キーとしては各 base の scoped/shards 形に内包されるため、追加登録はしない。

// --- 第2段 2a (cyc2497): 帯域内版判定の純粋核 ---
// 旧形 (v 欠落) は v0 として形検証を通れば受理し、次回保存で v:1 が付く (遅延移行)。
// 未来版 (v > current) や数値でない v は "future" として、読み手が復元しない判断に使う。
export function persistVersionOf(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (!("v" in parsed)) return 0;
  return (typeof parsed.v === "number" && Number.isFinite(parsed.v)) ? parsed.v : -1;
}
export function acceptPersistObject(parsed, current = 1) {
  const ver = persistVersionOf(parsed);
  if (ver === null) return { status: "invalid", value: null };
  if (ver === -1 || ver > current) return { status: "future", value: null };
  return { status: ver === current ? "current" : "legacy", value: parsed };
}
export function stampPersistVersion(obj, current = 1) { return { ...obj, v: current }; } // v は stamp 側が必ず勝つ (cyc2497 A05 裁定: obj 側の v 混入で未来版化する経路を塞ぐ)
export function persistKeyDef(key) {
  if (typeof key !== "string" || !key) return null;
  for (const d of PERSIST_KEYS) if (d.key === key) return d;
  const i = key.indexOf(":");
  if (i > 0) {
    const base = key.slice(0, i);
    for (const d of PERSIST_KEYS) if (d.key === base && (d.scoped || d.kind === "shards")) return d;
  }
  return null;
}
export function isRegisteredPersistKey(key) { return persistKeyDef(key) !== null; }
export function persistBaseKeys() { return PERSIST_KEYS.map(d => d.key); }
export function unversionedPersistKeys() { return PERSIST_KEYS.filter(d => d.version === null).map(d => d.key); }
