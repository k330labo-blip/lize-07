// ============================================================
// 軌道工廠 (Orbital Foundry) v0.8.311 互換データ
// 出典: ~/workspace/mc-debug-pc/of311/BP/ (v0.8.311 展開データ、
//       manifest header version [0, 8, 311] で確認済み)
// 名前空間 NS = "orbital_foundry" (scripts/config.js:10)
// ============================================================

// ------------------------------------------------------------
// 入庫先コンテナ (ブロックID) — 全4種
// 出典: scripts/bulk_storage.js の BULK_TIERS / BULK_TYPES。
//       ゲーム本体が「大容量コンテナ」として扱う登録はこの4種のみで、
//       Bot の入庫先判定はこの集合に一致させるのが正。
//       容量: Mk I = 4,096 / Mk II = 32,768 / Mk III = 262,144 / 特異点 = 無制限
//       ※ fluid_tank は液体専用 (scripts/fluids.js) のため含めない。
//       ※ 中身入り回収用アイテム (industrial_container_mk1_packed 等) は
//         ブロックIDではないため含めない。
// ------------------------------------------------------------
export const OF_CONTAINERS = [
  "orbital_foundry:industrial_container_mk1", // 工業コンテナ Mk I (容量 4,096)
  "orbital_foundry:industrial_container_mk2", // 工業コンテナ Mk II (容量 32,768)
  "orbital_foundry:orbital_container_mk3",    // 軌道コンテナ Mk III (容量 262,144)
  "orbital_foundry:singularity_container",    // 特異点コンテナ (容量 無制限)
];

// ------------------------------------------------------------
// 貴重品アイテムID — 全36種 (落としたら最優先で回収すべきもの)
// 出典は各行コメント参照。全IDとも items/*.json の実在を確認済み。
// ------------------------------------------------------------
export const OF_VALUABLES = [
  // --- 進行キー素材 (scripts/config.js STAGES の keyItem / ROCKET1 初回貨物) ---
  "orbital_foundry:meteor_iron",       // 隕鉄: T2キー・初回便貨物・起動核の材料(32個)
  "orbital_foundry:orbital_crystal",   // 軌道結晶: T3/T6キー・初回便貨物
  "orbital_foundry:phase_stone",       // 位相石: 起動核の材料(8個)
  "orbital_foundry:singularity_core",  // 特異炉心: T5キー (軌道工廠建設)
  "orbital_foundry:activation_core",   // 起動核: T4キー (最終ボス召喚、80000 SE・60秒クラフト)
  "orbital_foundry:steel_ingot",       // 鋼インゴット: T0キー
  "orbital_foundry:control_board",     // 制御基板: T1キー・上位部品の材料

  // --- ボス/終盤の核・チップ ---
  "orbital_foundry:end_star_core",         // 終焉星核: 星炉ウィザー産・軌道爆撃解禁 (scripts/star_wither.js, orbital-foundry.js)
  "orbital_foundry:military_control_core", // 軍用制御核: 起動核の材料(2個)
  "orbital_foundry:siege_control_core",    // 攻城制御核: recipes/reclaim_siege_core.json
  "orbital_foundry:enhancement_core",      // 強化コア: 装備強化用 (scripts/equipment_catalog.js)
  "orbital_foundry:starforge_chip",        // 星炉チップ: 星炉装備系 (scripts/starforge-spec.js)

  // --- 最上位素材 ---
  "orbital_foundry:iridium", // イリジウム: 工廠部品・最上位装備の材料 (foundry-spec.js, equipment_catalog.js)

  // --- 軌道工廠 建設部品 (scripts/foundry-spec.js FOUNDRY_COMPONENTS) ---
  "orbital_foundry:foundry_frame",     // 軌道フレーム (3200 SE級レシピ群)
  "orbital_foundry:foundry_relay",     // 軌道中継モジュール
  "orbital_foundry:foundry_stabilizer",// 位相安定器

  // --- 研究パック 全4種 (scripts/config.js SCIENCE_PACKS) ---
  "orbital_foundry:science_mechanical", // 機械サイエンスパック (赤)
  "orbital_foundry:science_automation", // 緑パック
  "orbital_foundry:science_chemical",   // 青パック
  "orbital_foundry:science_aerospace",  // 紫パック

  // --- 上位部品 ---
  "orbital_foundry:processing_unit",    // 高度制御ユニット: 精密生産で解禁 (research.js)
  "orbital_foundry:drive_component",    // 駆動部品: モーター+軸受+耐熱合金 (config.js PROCESS_RECIPES)
  "orbital_foundry:guidance_device",    // 誘導装置: ロケット必須 (ROCKET1 guidance)
  "orbital_foundry:rocket_body_section",// ロケット機体区画: 初号機に16個 (ROCKET1 bodySections)
  "orbital_foundry:parallel_module",    // 並列モジュール: 上位機械部品

  // --- 高エネルギー素材 (クラフトエネルギーが桁違いに高い) ---
  "orbital_foundry:uranium_ingot", // ウランインゴット (2000 SE/個)
  "orbital_foundry:uranium_fuel",  // ウラン燃料棒 (4000 SE、ウラン4+鋼板2+耐熱合金)
  "orbital_foundry:raw_uranium",   // ウラン原鉱: 上記の原料で希少鉱石産

  // --- バニラ貴重鉱石相当 (未加工のままドロップする) ---
  "orbital_foundry:unprocessed_diamond", // 未加工ダイヤモンド
  "orbital_foundry:unprocessed_emerald", // 未加工エメラルド

  // --- その他貴重品 ---
  "orbital_foundry:xp_capsule",              // 経験値カプセル: モブ工場産の消費型貴重品 (scripts/mob_works.js)
  "orbital_foundry:orbital_strike_designator", // 軌道爆撃指示器 (scripts/star_wither.js)

  // --- 最上位装備 (星炉装備一式) ---
  "orbital_foundry:starforge_helmet",
  "orbital_foundry:starforge_chest",
  "orbital_foundry:starforge_legs",
  "orbital_foundry:starforge_boots",
];

// ------------------------------------------------------------
// 食料アイテムID — 全9種 (軌道工廠のカスタム食料の全て)
// 出典: scripts/food_info.js の CUSTOM 表 + items/farming/*.json の
//       minecraft:food コンポーネント実在確認 (items/ 全走査でこの9件のみ)。
//       種・空き缶 (cabbage_seeds, empty_can 等) は食料ではないため含めない。
//       コメントは food_info.js の満腹度 (nutrition)。
//       ※ バニラ食料は Bot 本体側の汎用リストで判定する想定で、ここは OF 分のみ。
// ------------------------------------------------------------
export const OF_FOODS = [
  "orbital_foundry:canned_ration", // 缶詰レーション (満腹度 12・最高値)
  "orbital_foundry:sweet_potato",  // サツマイモ (満腹度 10)
  "orbital_foundry:corn",          // トウモロコシ (満腹度 8)
  "orbital_foundry:cabbage",       // キャベツ (満腹度 8)
  "orbital_foundry:paprika",       // パプリカ (満腹度 7)
  "orbital_foundry:onion",         // タマネギ (満腹度 7)
  "orbital_foundry:tomato",        // トマト (満腹度 6)
  "orbital_foundry:edamame",       // エダマメ (満腹度 6)
  "orbital_foundry:strawberry",    // イチゴ (満腹度 5)
];
