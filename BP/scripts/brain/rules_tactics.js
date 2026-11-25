// 戦闘戦術ルール（リゼ / LIZE-07）（優先度帯 700〜759）
// rules_safety.js（危機回避・警告）と rules_emergency2.js（特殊緊急）が扱うのは「危ないかどうか」。
// 本ファイルはその一段下で「どう戦うか」だけを扱う：位置取り・間合い・段階的後退・ボスのフェーズ・銃持ち敵への接近。
// 安全帯（900〜）が常に上書きする前提なので、ここでは瀕死・至近爆発などの危機条件は再掲しない。
// 追加文脈 c.x は全て c.x?.〜 で参照し、x が無い文脈では沈黙する。when は全件 Boolean(...) 包み。
// 本ファイルが新規に要求する c.x: coverNear（射線を切れる遮蔽物が近い）/ wallBehind（背後に壁がある）/
//   gunEnemy（GVC等の銃持ち敵がいる）/ gunDist（最寄り銃持ち敵までの距離）/ meleeDist（最寄り近接敵までの距離）/
//   edgeNear（足元近くに段差・落下縁がある）/ highGround（自分が敵より高所にいる）
export const RULES = [
// === 位置取り: 射手には遮蔽物側へ ===
{id:'tac_cover_vs_ranged_weapon',p:759,when:c=>Boolean(c.x?.coverNear&&c.danger.rangedDist<14&&c.inv.hasWeapon&&c.self.hpPct>0.5),act:'zap',say:'遮蔽物の陰から叩きます。矢の線は切ってあります',note:'射手相手は遮蔽物側に回ってから反撃（safetyの無条件zapと差別化：遮蔽＋武器＋HP余裕）'},
{id:'tac_cover_vs_ranged_no_weapon',p:758,when:c=>Boolean(c.x?.coverNear&&c.danger.rangedDist<12&&!c.inv.hasWeapon&&c.owner.present),act:'follow_close',say:'物陰に寄ってください。私はあなたの外側に立ちます',note:'武器なしで射手と対峙する時は遮蔽側で主人に密着'},
{id:'tac_cover_owner_targeted_ranged',p:757,when:c=>Boolean(c.x?.coverNear&&c.danger.rangedDist<16&&c.danger.ownerTargeted&&c.owner.hpPct>0.4),act:'guard',say:'射線の間に立っています。陰に回ってください',note:'主人が射手に狙われている時は遮蔽物と主人の間で護衛'},
{id:'tac_no_cover_open_field_ranged',p:756,when:c=>Boolean(c.x?.coverNear===false&&c.danger.rangedDist>=10&&c.danger.rangedDist<18&&c.inv.hasWeapon&&c.self.hpPct>0.6),act:'zap',say:'開けた場所です。撃たれる前に詰めます',note:'遮蔽が無い平地では距離を置かず一気に接近して射手を叩く'},
{id:'tac_ranged_high_ground_owner',p:755,when:c=>Boolean(c.x?.highGround&&c.danger.rangedDist<15&&c.owner.present&&c.danger.count>=1),act:'follow_close',say:'高所は確保できています。下りずにここで見ます',note:'高所確保時は射手がいても無理に下りず主人の側で待機戦闘'},
{id:'tac_ranged_two_plus_cover',p:754,when:c=>Boolean(c.x?.coverNear&&c.danger.rangedDist<14&&c.danger.count>=3&&c.self.hpPct>0.45),act:'guard',say:'射手が複数です。陰から一体ずつ崩します',note:'射手含む3体以上は遮蔽を使って各個撃破の構え'},
{id:'tac_ranged_night_no_cover',p:753,when:c=>Boolean(c.x?.coverNear===false&&c.danger.rangedDist<14&&c.env.isNight&&c.owner.hpPct<=0.6),act:'warn_hostile',say:'夜で矢が見えません。開けた場所は避けてください',note:'夜間・遮蔽なし・射手接近は戦わず警告して位置を変えさせる'},
{id:'tac_ranged_owner_shooting_back',p:752,when:c=>Boolean(c.danger.rangedDist<16&&c.x?.ownerUsing&&c.owner.present&&c.danger.count>=2),act:'guard',say:'撃ち合いは任せます。近接側は私が見ます',note:'主人が弓等で応射中は自分は近接側の護衛に回る役割分担'},
// === 位置取り: クリーパーには距離を保って戦う ===
{id:'tac_creeper_keep_range_weapon',p:751,when:c=>Boolean(c.danger.creeperDist>=6&&c.danger.creeperDist<9&&c.inv.hasWeapon&&c.self.hpPct>0.6),act:'zap',say:'間合い外から削ります。近づかせません',note:'クリーパーは爆発圏外（6〜9）から叩く間合い管理（警告帯より下の戦い方）'},
{id:'tac_creeper_second_hostile',p:750,when:c=>Boolean(c.danger.creeperDist>=5&&c.danger.creeperDist<10&&c.danger.count>=2&&c.danger.nearestDist<6),act:'guard',say:'爆発役と通常個体が混ざっています。通常側を先に落とします',note:'クリーパー＋他敵の混成では爆発役を近づけず通常敵を先に処理'},
{id:'tac_creeper_owner_melee_range',p:749,when:c=>Boolean(c.danger.creeperDist>=4&&c.danger.creeperDist<7&&c.self.distOwner<3&&c.owner.hpPct>0.5),act:'follow_close',say:'あなたが殴ると誘爆します。距離を取る側に回ります',note:'主人がクリーパーに接近戦を仕掛けている時は密着して引き戻し側に立つ'},
{id:'tac_creeper_at_cliff_edge',p:748,when:c=>Boolean(c.danger.creeperDist<9&&c.x?.edgeNear&&c.owner.present&&c.flags.warnOk),act:'warn_creeper',say:'足元が崖です。爆発より落下が先に来ます',note:'崖際でのクリーパーは爆風＋落下の複合として警告（emergency2の落下系とは別軸）'},
{id:'tac_creeper_in_water_slow',p:747,when:c=>Boolean(c.danger.creeperDist<8&&c.owner.inWater&&c.inv.hasWeapon&&c.self.hpPct>0.5),act:'zap',say:'水中の爆発は届きにくいです。今のうちに処理します',note:'水中では爆発被害が減るため、逃げずに処理する判断'},
{id:'tac_creeper_pack_spread',p:746,when:c=>Boolean(c.danger.creeperDist<10&&c.danger.count>=3&&c.self.distOwner>=4&&c.owner.present),act:'go_owner',say:'爆発役が散らばっています。あなたの側に戻ります',note:'クリーパー含む群れが分散している時は単独戦闘をやめ主人へ合流'},
// === 位置取り: 群れには壁を背負う ===
{id:'tac_wall_behind_swarm',p:745,when:c=>Boolean(c.x?.wallBehind&&c.danger.count>=3&&c.inv.hasWeapon&&c.self.hpPct>0.55),act:'zap',say:'背後は壁です。正面だけ見ればいい構図にしました',note:'群れ戦は壁を背負って背面を消し、正面の敵を叩く'},
{id:'tac_no_wall_swarm_circle',p:744,when:c=>Boolean(c.x?.wallBehind===false&&c.danger.count>=4&&c.self.hpPct>0.5),act:'guard',say:'囲まれています。背中合わせでいきます',note:'壁が無い包囲では主人と背中合わせの護衛位置を取る'},
{id:'tac_swarm_owner_center',p:743,when:c=>Boolean(c.danger.count>=3&&c.danger.ownerTargeted&&c.self.distOwner<4&&c.self.hpPct>0.5),act:'guard',say:'敵の中心はあなたです。私は外周を崩します',note:'主人が群れの中心にいる時は外周から削る護衛'},
{id:'tac_swarm_chokepoint_underground',p:742,when:c=>Boolean(c.danger.count>=3&&c.owner.underground&&c.inv.hasWeapon&&c.self.hpPct>0.6),act:'zap',say:'通路は狭いです。一列に並ばせて一体ずつ落とします',note:'地下の狭所では群れを一列化して各個撃破'},
{id:'tac_swarm_retreat_corridor_owner_low',p:741,when:c=>Boolean(c.danger.count>=3&&c.owner.hpPct<=0.5&&c.owner.hpPct>0.3&&c.self.hpPct>0.6),act:'follow_close',say:'後ろは私が持ちます。下がりながらで大丈夫です',note:'主人HP中程度低下＋群れでは殿（しんがり）を務めながら後退に密着'},
{id:'tac_swarm_with_ranged_mix',p:740,when:c=>Boolean(c.danger.count>=3&&c.danger.rangedDist<14&&c.danger.creeperDist>=10&&c.inv.hasWeapon&&c.self.hpPct>0.55),act:'zap',say:'近接を落としてから射手へ。順番を間違えません',note:'近接＋射手の混成群れでは近接を先に処理する順序付け'},
// === 主人と敵の間に入る ===
{id:'tac_interpose_melee_owner',p:739,when:c=>Boolean((c.x?.meleeDist??99)<7&&c.danger.ownerTargeted&&c.self.distOwner>=3&&c.self.distOwner<8&&c.self.hpPct>0.65),act:'guard',say:'間に立っています。あなたは距離を取ってください',note:'近接敵が主人を狙う時、自分のHPに余裕があれば間に割って入る'},
{id:'tac_interpose_ranged_line',p:738,when:c=>Boolean(c.danger.rangedDist<13&&c.danger.ownerTargeted&&c.self.distOwner>=2&&c.self.hpPct>0.7&&!c.x?.coverNear),act:'guard',say:'射線は私が受けます。陰に移ってください',note:'遮蔽が無い時は自分の体で射線を塞ぐ'},
{id:'tac_interpose_owner_hungry_low',p:737,when:c=>Boolean(c.danger.nearestDist<7&&c.danger.ownerTargeted&&c.owner.hpPct>0.4&&c.owner.hunger<=4&&c.self.hpPct>0.6),act:'guard',say:'空腹で足が止まっていますね。前に出ます',note:'主人が空腹で動きが鈍い時は前衛を代わる'},
{id:'tac_interpose_owner_using_station',p:736,when:c=>Boolean(c.danger.nearestDist<8&&c.x?.ownerUsing&&c.self.hpPct>0.55&&c.owner.present),act:'guard',say:'作業中ですね。背中は見ておきます',note:'主人が作業台・エンチャント等で手を離せない間の背後警戒'},
{id:'tac_interpose_night_ambush',p:735,when:c=>Boolean(c.env.isNight&&c.danger.nearestDist<6&&c.owner.idleSec>5&&c.self.hpPct>0.6),act:'guard',say:'夜襲です。最初の一撃は私が受けます',note:'夜間・主人が反応遅れ気味の奇襲では先に間に入る'},
{id:'tac_interpose_owner_carrying_valuable',p:734,when:c=>Boolean(c.danger.nearestDist<8&&c.danger.ownerTargeted&&c.owner.present&&c.x?.ownerInvFull&&c.self.hpPct>0.6),act:'guard',say:'荷物持ちのあなたは的です。私が盾になります',note:'主人インベントリ満杯＝戦闘力低下とみなし前衛化'},
{id:'tac_interpose_then_handoff',p:733,when:c=>Boolean(c.danger.nearestDist<6&&c.danger.ownerTargeted&&c.self.hpPct<=0.65&&c.self.hpPct>0.45&&c.inv.hasWeapon),act:'zap',say:'間に立って、そのまま叩きます',note:'HP中程度なら盾で終わらず間から反撃まで繋げる'},
// === 段階的後退と回復待ち ===
{id:'tac_fighting_retreat_stage1',p:732,when:c=>Boolean(c.self.hpPct<=0.65&&c.self.hpPct>0.5&&c.danger.count>=2&&c.inv.hasWeapon&&c.owner.hpPct>0.5),act:'guard',say:'まだ戦えます。ただし下がりながらです',note:'HP65%以下・敵複数で「戦いながらの後退」第1段階（safetyの逃走帯より手前）'},
{id:'tac_fighting_retreat_stage2',p:731,when:c=>Boolean(c.self.hpPct<=0.5&&c.self.hpPct>0.4&&c.danger.count>=2&&c.danger.ownerTargeted),act:'follow_close',say:'私の残量が半分です。あなたの後ろに回ります',note:'HP50%以下で前衛を降り、主人の後方へ段階後退する第2段階'},
{id:'tac_fighting_retreat_stage3_home',p:730,when:c=>Boolean(c.self.hpPct<=0.45&&c.self.hpPct>0.35&&c.home.registered&&c.self.distHome<24&&c.danger.count>0),act:'return_home',say:'拠点まで引いて立て直します。回復を待ちます',note:'HP45%以下・拠点が近い時は帰還して回復待ちに入る第3段階'},
{id:'tac_heal_wait_owner_still_fighting',p:729,when:c=>Boolean(c.self.hpPct<=0.45&&c.self.hpPct>0.3&&c.owner.hpPct>0.7&&c.danger.count>0&&c.self.distOwner>=6),act:'follow_close',say:'あなたは元気ですね。私は回復まで後方で待機します',note:'自分だけ消耗し主人が無事な時は、無理に前へ出ず後方で回復を待つ'},
{id:'tac_heal_wait_with_food',p:728,when:c=>Boolean(c.self.hpPct<=0.55&&c.self.hpPct>0.4&&c.inv.hasFood&&c.danger.nearestDist>=8),act:'stay_anchor',say:'少し下がって回復します。十秒ください',note:'敵が離れている隙に食料で回復する小休止'},
{id:'tac_retreat_ranged_pinning',p:727,when:c=>Boolean(c.self.hpPct<=0.55&&c.self.hpPct>0.4&&c.danger.rangedDist<12&&c.x?.coverNear),act:'follow_close',say:'矢で釘付けです。陰を伝って下がります',note:'射手に狙われながらの後退は遮蔽物を経由する'},
{id:'tac_retreat_owner_covers',p:726,when:c=>Boolean(c.self.hpPct<=0.5&&c.self.hpPct>0.35&&c.owner.hpPct>0.8&&c.danger.nearestDist<8&&c.owner.dimensionSame),act:'go_owner',say:'下がります。……援護、頼みます',note:'主人が万全な時は主人の火力圏まで下がって立て直す（敬語が少しほどける距離感）'},
{id:'tac_reengage_after_recover',p:725,when:c=>Boolean(c.self.hpPct>0.8&&c.danger.count>=1&&c.danger.nearestDist<10&&c.inv.hasWeapon&&c.x?.fastMove===false),act:'zap',say:'回復しました。再突入します',note:'回復後の再突入判断（後退ルール群の受け皿）'},
// === ボス戦: フェーズ別行動 ===
{id:'tac_boss_opening_full_hp',p:724,when:c=>Boolean(c.x?.bossNear&&(c.x?.bossHpPct??1)>0.8&&c.self.hpPct>0.7&&c.owner.present),act:'guard',say:'開幕です。様子見は短く、距離感だけ測ります',note:'ボス戦序盤（残HP80%超）は護衛位置で様子見'},
{id:'tac_boss_mid_phase',p:723,when:c=>Boolean(c.x?.bossNear&&(c.x?.bossHpPct??1)<=0.8&&(c.x?.bossHpPct??1)>0.4&&c.inv.hasWeapon&&c.self.hpPct>0.5),act:'zap',say:'中盤です。ここから私も削りに行きます',note:'ボス残HP40〜80%は自分も攻撃参加に切り替え'},
{id:'tac_boss_final_phase_owner_low',p:722,when:c=>Boolean(c.x?.bossNear&&(c.x?.bossHpPct??1)<=0.4&&c.owner.hpPct<=0.5&&c.self.hpPct>0.4),act:'guard',say:'終盤です。あと少しを、あなたが生きて越えるのが先です',note:'ボス残HP40%以下＋主人消耗時は削りより護衛優先'},
{id:'tac_boss_final_phase_burst',p:721,when:c=>Boolean(c.x?.bossNear&&(c.x?.bossHpPct??1)<=0.25&&c.owner.hpPct>0.6&&c.self.hpPct>0.6),act:'zap',say:'残り僅かです。一気に畳みます',note:'ボス残HP25%以下で双方元気なら総攻撃'},
{id:'tac_boss_self_worn_mid',p:720,when:c=>Boolean(c.x?.bossNear&&(c.x?.bossHpPct??1)<=0.7&&(c.x?.bossHpPct??1)>0.3&&c.self.hpPct<=0.5&&c.self.hpPct>0.35),act:'follow_close',say:'ボス戦の消耗戦です。私は後方に下がります',note:'ボス中盤で自分が消耗したら前衛を降りて長期戦に備える'},
{id:'tac_dragon_perched',p:719,when:c=>Boolean(c.x?.dragonFight&&(c.x?.bossHpPct??1)<=0.9&&(c.x?.bossHpPct??1)>0.2&&c.inv.hasWeapon&&c.self.hpPct>0.5),act:'zap',say:'止まりました。今が削る時間です',note:'ドラゴンがポータルに止まるフェーズは接近して削る'},
{id:'tac_dragon_flying_phase',p:718,when:c=>Boolean(c.x?.dragonFight&&(c.x?.bossHpPct??1)>0.9&&c.owner.present&&c.danger.count>=0),act:'follow_close',say:'飛んでいる間は手が出ません。あなたの側で待機します',note:'ドラゴン飛行フェーズは無理をせず主人に密着'},
{id:'tac_wither_skull_phase',p:717,when:c=>Boolean(c.x?.witherFight&&c.danger.rangedDist<18&&c.self.hpPct>0.5&&c.x?.coverNear),act:'guard',say:'頭蓋が飛んできます。陰と私で二重に防ぎます',note:'ウィザー戦は飛び道具フェーズとして遮蔽＋護衛'},
{id:'tac_gvc_boss_opening',p:716,when:c=>Boolean(c.x?.gvcBoss&&(c.x?.bossHpPct??1)>0.6&&c.self.hpPct>0.6&&c.owner.present),act:'guard',say:'大型個体です。火力の癖が分かるまで前には出ません',note:'GVCボス序盤は護衛で様子見（dimension帯のボス検知とは別軸の戦い方）'},
{id:'tac_gvc_boss_final',p:715,when:c=>Boolean(c.x?.gvcBoss&&(c.x?.bossHpPct??1)<=0.3&&c.self.hpPct>0.45&&c.inv.hasWeapon),act:'zap',say:'大型個体、残り僅かです。仕留めに行きます',note:'GVCボス終盤は攻撃参加'},
// === GVC: 銃持ち敵への接近パターン ===
{id:'tac_gun_far_approach',p:714,when:c=>Boolean(c.x?.gunEnemy&&(c.x?.gunDist??99)>=18&&(c.x?.gunDist??99)<30&&c.inv.hasWeapon&&c.self.hpPct>0.6),act:'zap',say:'銃持ちは遠距離が本領です。直線では近づきません、斜めから詰めます',note:'銃持ち敵へは遠距離から斜行接近する前提で攻撃行動（実行部は蛇行接近を想定）'},
{id:'tac_gun_mid_zigzag_window',p:713,when:c=>Boolean(c.x?.gunEnemy&&(c.x?.gunDist??99)>=10&&(c.x?.gunDist??99)<18&&c.self.hpPct>0.55&&c.owner.hpPct>0.4),act:'guard',say:'中距離が一番危険な帯です。リロードの隙に詰めます',note:'銃持ちの中距離帯は護衛位置で隙を待ってから詰める'},
{id:'tac_gun_close_finish',p:712,when:c=>Boolean(c.x?.gunEnemy&&(c.x?.gunDist??99)<8&&c.inv.hasWeapon&&c.self.hpPct>0.4),act:'zap',say:'懐に入りました。銃は近距離では振り回せません',note:'銃持ちは懐に入れば弱い、近距離では即仕留める'},
{id:'tac_gun_no_weapon_owner',p:711,when:c=>Boolean(c.x?.gunEnemy&&(c.x?.gunDist??99)<16&&!c.inv.hasWeapon&&c.owner.present&&c.flags.warnOk),act:'warn_hostile',say:'銃声の方向です。素手では相手になりません、陰に',note:'武器なしで銃持ちと遭遇したら戦わず警告'},
{id:'tac_gun_owner_targeted_cover',p:710,when:c=>Boolean(c.x?.gunEnemy&&(c.x?.gunDist??99)<20&&c.danger.ownerTargeted&&c.x?.coverNear&&c.self.hpPct>0.5),act:'guard',say:'狙われています。遮蔽まで私が付きます',note:'主人が銃持ちに狙われたら遮蔽までの護衛'},
{id:'tac_gun_owner_targeted_open',p:709,when:c=>Boolean(c.x?.gunEnemy&&(c.x?.gunDist??99)<20&&c.danger.ownerTargeted&&c.x?.coverNear===false&&c.self.hpPct>0.65),act:'guard',say:'陰がありません。私が先に視界に入ります',note:'遮蔽なしで主人が狙われたら自分が囮側に立つ'},
{id:'tac_gun_multiple_crossfire',p:708,when:c=>Boolean(c.x?.gunEnemy&&(c.x?.gunDist??99)<22&&c.danger.count>=3&&c.self.hpPct>0.5&&c.owner.present),act:'follow_close',say:'十字砲火の形です。片側に寄せます、付いてください',note:'銃持ち含む複数では挟まれない側へ主人と一緒に寄る'},
{id:'tac_gun_night_muzzle',p:707,when:c=>Boolean(c.x?.gunEnemy&&(c.x?.gunDist??99)<24&&c.env.isNight&&c.owner.present&&c.flags.warnOk),act:'warn_hostile',say:'夜は銃口の火で位置が分かります。火が見えたら伏せてください',note:'夜間の銃持ちは発砲の閃光で位置を伝える警告'},
// === 水際・高所・地形での戦闘回避と活用 ===
{id:'tac_water_combat_owner_out',p:706,when:c=>Boolean(c.owner.inWater&&c.danger.nearestDist<8&&c.self.hpPct>0.55&&c.inv.hasWeapon),act:'zap',say:'水中戦は不利です。岸側の敵から落とします',note:'主人が水中にいる時は岸に近い敵から処理して退路を作る'},
{id:'tac_water_edge_ranged',p:705,when:c=>Boolean(c.x?.nearWater&&c.danger.rangedDist<14&&c.owner.present&&!c.owner.inWater),act:'follow_close',say:'水際は足を取られます。射手の的になる前に離れます',note:'水際＋射手では泳ぎを強いられる前に陸側へ寄る'},
{id:'tac_high_ground_defend',p:704,when:c=>Boolean(c.x?.highGround&&c.danger.nearestDist<7&&c.danger.count>=2&&c.self.hpPct>0.5),act:'guard',say:'高所は渡しません。登ってくる所を落とします',note:'高所確保時は登坂地点で迎撃する防衛戦術'},
{id:'tac_cliff_edge_no_fight',p:703,when:c=>Boolean(c.x?.edgeNear&&c.danger.nearestDist<6&&c.x?.voidRisk!==true&&c.owner.present&&c.flags.warnOk),act:'warn_hostile',say:'ここは崖際です。戦う場所を変えてください',note:'落下縁の近くではノックバック落下を避けるため戦闘自体を避ける'},
{id:'tac_void_edge_flee_line',p:702,when:c=>Boolean(c.x?.edgeNear&&c.x?.voidRisk&&c.danger.nearestDist<8&&c.self.hpPct>0.35),act:'flee',say:'奈落の縁です。戦い方以前の問題です、下がります',note:'奈落縁での戦闘は回避し内側へ下がる（emergency2の奈落検知とは別の戦術判断）'},
{id:'tac_lava_side_combat',p:701,when:c=>Boolean(c.danger.lavaNear&&c.danger.nearestDist<8&&c.self.hpPct>0.5&&c.owner.present),act:'guard',say:'溶岩際です。押し込まれない位置に立ちます',note:'溶岩際では敵と溶岩の反対側に立つ位置取り（warn_lavaの警告とは別）'},
{id:'tac_web_stuck_no_melee',p:700,when:c=>Boolean(c.x?.webStuck&&c.danger.nearestDist<7&&c.owner.present&&c.flags.warnOk),act:'warn_hostile',say:'巣に絡まっています。その場で殴り合わないでください',note:'クモの巣拘束中は近接戦を避けるよう警告（emergency2の窒息複合とは別軸）'},
{id:'tac_soulsand_slow_kite',p:699,when:c=>Boolean(c.x?.soulSandSlow&&c.danger.nearestDist<7&&c.self.hpPct>0.5&&c.inv.hasWeapon),act:'zap',say:'足場が遅いのは相手も同じです。間合いだけ守って叩きます',note:'ソウルサンド上では逃げず間合い管理で戦う'},
// === 連携・役割分担 ===
{id:'tac_coord_owner_melee_self_ranged_target',p:698,when:c=>Boolean(c.danger.rangedDist<15&&(c.x?.meleeDist??99)<5&&c.inv.hasWeapon&&c.self.hpPct>0.6),act:'zap',say:'近接はあなたへ任せます。私は射手を落とします',note:'主人が近接敵と交戦中は自分は射手を担当する分担'},
{id:'tac_coord_raid_wall_line',p:697,when:c=>Boolean(c.x?.raidActive&&c.danger.count>=3&&c.self.hpPct>0.55&&c.owner.present),act:'guard',say:'襲撃です。村の内側に線を引きます、そこから先は通しません',note:'襲撃時は村側を背にした防衛線で護衛'},
{id:'tac_coord_golem_let_front',p:696,when:c=>Boolean(c.x?.nearGolem&&c.danger.count>=2&&c.self.hpPct>0.5&&c.owner.present),act:'follow_close',say:'ゴーレムが前です。私たちは側面の漏れを見ます',note:'ゴーレムがいる戦闘では正面を任せ側面警戒に回る'},
{id:'tac_coord_multiplayer_others',p:695,when:c=>Boolean((c.x?.othersNear??0)>=1&&c.danger.count>=2&&c.danger.ownerTargeted&&c.self.hpPct>0.55),act:'guard',say:'他の方もいます。担当は被らせません、私はあなたを見ます',note:'マルチで他プレイヤーがいる時は自分の主人専任の護衛に徹する'},
{id:'tac_coord_darkness_ambush_ready',p:694,when:c=>Boolean((c.x?.darkness??0)>=10&&c.danger.nearestDist>=8&&c.danger.nearestDist<14&&c.inv.hasWeapon&&c.self.hpPct>0.6),act:'stay_anchor',say:'暗所です。湧き直後の奇襲に備えてここで待ちます',note:'暗い場所では進まず、湧いた敵を迎え撃つ待ちの戦術'},
];
