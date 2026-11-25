// compat_gvc.js — GVCゲリラアドオン互換データ（companion_bot 用）
// 出典は全て ~/workspace/gvc-analysis/ 配下のテキスト閲覧のみで確認（コード実行なし）。
// 主出典: repo/behavior_packs/GVCBedrock/（extracted/GVCBedrockWTeam, v5/GVCBedrockWii でも同一IDを確認）
// 確信の持てないIDは含めていない（compat_gvc.md の「要確認リスト」参照）。

// 敵対エンティティ: プレイヤーを攻撃するゲリラ・兵士系＋ボス＋敵性モブ
// 根拠: entities/mob/ の enemy 系フォルダ配置、および type_family の guerrilla 系/monster と攻撃系コンポーネント
export const GVC_HOSTILES = [
  // --- ゲリラ歩兵（enemy / enemy v2 / enemy v3） ---
  "gvcv5:ga",        // entities/mob/enemy/ga.json（family: guerrillaii, monster）
  "gvcv5:gb1",       // entities/mob/enemy v2/gb1.json（family: guerrilla, monster）
  "gvcv5:gb2",       // entities/mob/enemy v2/gb2.json（family: guerrilla, monster）
  "gvcv5:gb3",       // entities/mob/enemy v2/gb3.json（family: guerrilla, monster）
  "gvcv5:gb4",       // entities/mob/enemy v2/gb4.json（family: guerrilla, monster）
  "gvcv5:gb5",       // entities/mob/enemy v2/gb5.json（family: guerrilla, monster）
  "gvcv5:gb6",       // entities/mob/enemy v2/gb6.json（family: guerrilla, monster）
  "gvcv5:gb6_drone", // entities/mob/enemy v2/gb6_drone.json（family: guerrilla, monster／敵ドローン）
  "gvcv5:gc1",       // entities/mob/enemy v3/ga1.json（family: guerrilla, monster）
  "gvcv5:gc2",       // entities/mob/enemy v3/gc2.json（family: guerrilla, monster）
  "gvcv5:gc3",       // entities/mob/enemy v3/gc3.json（family: germany, monster）
  "gvcv5:gc4",       // entities/mob/enemy v3/gc4.json（family: guerrilla, monster）
  "gvcv5:gc5",       // entities/mob/enemy v3/gc5.json（family: guerrilla, monster）
  // --- 敵ボス（enemy boss） ---
  "gvcv5:char2c",    // entities/mob/enemy boss/char2c.json（family: guerrilla, monster）
  "gvcv5:hauneb",    // entities/mob/enemy boss/hauneb.json（family: guerrilla, monster）
  "gvcv5:st1",       // entities/mob/enemy boss/st1.json（family: guerrilla, monster）
  "gvcv5:unks",      // entities/mob/enemy boss/cv/unks.json（family: unks, monster）
  "gvcv5:mer03k",    // entities/mob/enemy boss/mer03k.json（family: monster／behavior.ranged_attack の砲撃を確認）
  "gvcv5:mer08b",    // entities/mob/enemy boss/mer08b.json（family: monster／mer系ボス）
  "gvcv5:mer08r",    // entities/mob/enemy boss/mer08r.json（family: monster／mer系ボス）
  "gvcv5:merg08",    // entities/mob/enemy boss/merg08.json（family: monster／mer系ボス）
  "gvcv5:merg08b",   // entities/mob/enemy boss/merg08b.json（family: monster／mer系ボス）
  // --- 敵性モブ（mob 直下、monster family＋攻撃コンポーネント） ---
  "zex:iceghast",    // entities/mob/ghast.json（family: ghast, monster）
  "zex:iceblaze",    // entities/mob/iceblaze.json（family: blaze, monster）
  "zex:icezombie",   // entities/mob/zombie.json（family: zombie, undead, monster）
  "zex:gskeleton",   // entities/mob/wither_skeleton.json（family: wither, skeleton, monster）
  "zex:ice_block",   // entities/mob/iceblock.json（family: monster／attack 10・charge_attack、runtime は vex）
];

// 敵判定に使える type_family（味方系 allied_soldier / pmc / playerp は含めない）
export const GVC_HOSTILE_FAMILIES = [
  "guerrilla",   // enemy v2 / enemy v3 / enemy boss の歩兵・ボス（entities/mob/ 配下で確認）
  "guerrillaii", // gvcv5:ga の family（entities/mob/enemy/ga.json）
  "germany",     // gvcv5:gc3 の family（entities/mob/enemy v3/gc3.json）
];

// 貴重品アイテム: 落としたら回収優先すべき銃器・弾薬・爆発物
export const GVC_VALUABLES = [
  // --- 銃器（items/gun/ の全59件、namespace は gun:） ---
  "gun:aa12",      // items/gun/aa12.json
  "gun:ak102",     // items/gun/ak102.json
  "gun:ak12",      // items/gun/ak12.json
  "gun:ak47",      // items/gun/ak47.json
  "gun:an94",      // items/gun/an94.json
  "gun:awm",       // items/gun/awm.json
  "gun:compoundbow", // items/gun/compoundbow.json
  "gun:dp28",      // items/gun/dp28.json
  "gun:famas",     // items/gun/famas.json
  "gun:fgm148",    // items/gun/fgm148.json（対戦車ミサイル）
  "gun:fim92",     // items/gun/fim92.json（対空ミサイル）
  "gun:fire",      // items/gun/fire.json
  "gun:g36",       // items/gun/g36.json
  "gun:g3a3",      // items/gun/g3a3.json
  "gun:glock17",   // items/gun/glock17.json
  "gun:glock18",   // items/gun/glock18.json
  "gun:hauneb",    // items/gun/hauneb.json
  "gun:hk416",     // items/gun/hk416.json
  "gun:lazer",     // items/gun/lazer.json
  "gun:lewis",     // items/gun/lewis.json
  "gun:m10",       // items/gun/m10.json
  "gun:m1014",     // items/gun/m1014.json
  "gun:m110",      // items/gun/m110.json
  "gun:m14",       // items/gun/m14.json
  "gun:m16a1",     // items/gun/m16a1.json
  "gun:m16a4",     // items/gun/m16a4.json
  "gun:m1911",     // items/gun/m1911.json
  "gun:m202",      // items/gun/m202.json（ロケットランチャー）
  "gun:m249",      // items/gun/m249.json
  "gun:m4",        // items/gun/m4.json
  "gun:m4a1",      // items/gun/m4a1.json
  "gun:m590",      // items/gun/m590.json
  "gun:m60",       // items/gun/m60.json
  "gun:m72",       // items/gun/m72.json（LAW）
  "gun:m79",       // items/gun/m79.json（グレネードランチャー）
  "gun:m82",       // items/gun/m82.json
  "gun:m870",      // items/gun/m870.json
  "gun:m9",        // items/gun/m9.json
  "gun:mg36",      // items/gun/mg36.json
  "gun:mg42",      // items/gun/mg42.json
  "gun:mosin",     // items/gun/mosin.json
  "gun:mp40",      // items/gun/mp40.json
  "gun:mp5",       // items/gun/mp5.json
  "gun:mp7",       // items/gun/mp7.json
  "gun:p90",       // items/gun/p90.json
  "gun:pkm",       // items/gun/pkm.json
  "gun:ppsh",      // items/gun/ppsh.json
  "gun:ptrd",      // items/gun/ptrd.json（対戦車ライフル）
  "gun:qbz95",     // items/gun/qbz95.json
  "gun:rpg",       // items/gun/rpg.json
  "gun:rpk",       // items/gun/rpk.json
  "gun:saiga12",   // items/gun/saiga12.json
  "gun:scar",      // items/gun/scar.json
  "gun:stg44",     // items/gun/stg44.json
  "gun:svd",       // items/gun/svd.json
  "gun:tt33",      // items/gun/tt33.json
  "gun:uzi",       // items/gun/uzi.json
  "gun:vz61",      // items/gun/vz61.json
  "gun:xm8",       // items/gun/xm8.json
  // --- 弾薬（items/item/bullet/ の全8件。gvc_handheld_v61.csv の bullet 列とも一致） ---
  "zex:556m",      // items/item/bullet/（5.56mm）
  "zex:762m",      // items/item/bullet/（7.62mm）
  "zex:12m",       // items/item/bullet/（12ゲージ）
  "zex:1270m",     // items/item/bullet/（12.7mm）
  "zex:40m",       // items/item/bullet/（40mm）
  "zex:mm9",       // items/item/bullet/（9mm）
  "zex:missilem",  // items/item/bullet/（ミサイル弾）
  "zex:rocketm",   // items/item/bullet/（ロケット弾）
  // --- 特殊弾・アロー（items/item/attachment/ 内の bullet_* 系） ---
  "zex:bullet_ap",   // items/item/attachment/
  "zex:bullet_at",   // items/item/attachment/
  "zex:bullet_db",   // items/item/attachment/
  "zex:bullet_emp",  // items/item/attachment/
  "zex:bullet_frag", // items/item/attachment/
  "zex:bullet_gas",  // items/item/attachment/
  "zex:bullet_hp",   // items/item/attachment/
  "zex:bullet_srag", // items/item/attachment/
  "zex:exarrow",     // items/item/attachment/（爆発アロー）
  "zex:psarrow",     // items/item/attachment/（特殊アロー）
  // --- 弾薬パック・弾薬箱（items/item/block/） ---
  "gvcv5:12gpack_gc_item",     // items/item/block/
  "gvcv5:223pack_gc_item",     // items/item/block/
  "gvcv5:308pack_gc_item",     // items/item/block/
  "gvcv5:9mmpack_gc_item",     // items/item/block/
  "gvcv5:40mmgr_ammo_gc_item", // items/item/block/
  "gvcv5:ammobox1_item",       // items/item/block/
  "gvcv5:rpg_ammobox1_item",   // items/item/block/
  "gvcv5:rpg_ammobox2_item",   // items/item/block/
  "gvcv5:rpg_box_item",        // items/item/block/
  "gvcv5:m72_box_item",        // items/item/block/
  // --- 擲弾・爆発物（items/item/grenade/） ---
  "gvcv5:fragment",    // items/item/grenade/（破片手榴弾）
  "gvcv5:impact",      // items/item/grenade/（着発手榴弾）
  "gvcv5:flame",       // items/item/grenade/（焼夷）
  "gvcv5:smoke",       // items/item/grenade/（煙幕）
  "gvcv5:frostcharge", // items/item/grenade/（フロストチャージ）
  "gvcv5:missile1",    // items/item/grenade/
  "gvcv5:missile2",    // items/item/grenade/
  "gvcv5:missile3",    // items/item/grenade/
  // --- 地雷（items/item/block/） ---
  "gvcv5:mine_item",  // items/item/block/（地雷・設置アイテム）
  "gvcv5:minet_item", // items/item/block/（対戦車地雷・設置アイテム）
];
