// 次元・ボス・大型イベント ルール (優先度帯 860-879)
// 基本文脈 c は共通仕様（rules_*.js と同一、全フィールド常時存在）。
// 追加文脈 c.x は任意のため、必ず c.x?. で参照する（c.x 無しでも例外なし）。
//   c.x.dimension: 'overworld'|'nether'|'end'
//   c.x.bossNear, c.x.bossHpPct, c.x.dragonFight, c.x.witherFight, c.x.gvcBoss
//   c.x.portalNear, c.x.fortress, c.x.stronghold
//   c.x.bossKind: 'warden'|'wither'|'dragon'|'elder_guardian'|'large' (main.js がボス種別を供給)
//   c.x.shriekerNear: bool (知覚ライト走査で sculk_shrieker を検知したら main.js が供給)
//   c.x.ownerLevitating: bool / c.x.ownerLevitationSec: number (主人の浮遊効果と残り秒、main.js が供給)
// セリフはリゼ（LIZE-07）口調: 一人称「私」、短い敬語、真顔。
export const RULES = [
// === ウォーデン専用 (ENV-04): 戦う相手ではない。安全帯の汎用護衛 (guard p939〜998) より上位で戦闘を全面抑止し静かに離れる ===
{id:'dim_warden_owner_noisy_flee',p:998.5,when:c=>c.x?.bossKind==='warden'&&c.x?.bossNear&&(c.owner.sprinting||c.x?.ownerBreaking),act:'flee',say:'静かに。音で寄ってきます。掘るのも走るのも止めて、一緒に離れます',note:'ウォーデン出現中に主人が騒音行動。戦闘ではなく静粛＋離脱が最優先 (ENV-04)'},
{id:'dim_warden_flee',p:998.3,when:c=>c.x?.bossKind==='warden'&&c.x?.bossNear,act:'flee',say:'ウォーデンです。戦う相手ではありません。静かに離れます',note:'ウォーデン検知時は guard/zap 等の汎用ボス戦ルールを抑止し離脱する (ENV-04)'},
{id:'dim_warden_shrieker_noisy_warn',p:926,when:c=>c.x?.shriekerNear&&(c.x?.ownerBreaking||c.owner.sprinting)&&c.flags.warnOk,act:'warn_hostile',say:'止めてください。シュリーカーの近くです。鳴らすと、ウォーデンが出ます',note:'シュリーカー付近で騒音行動を見たら出現前に止める (ENV-04、発話レイヤー)'},
{id:'dim_warden_shrieker_warn',p:924,when:c=>c.x?.shriekerNear&&c.flags.warnOk,act:'warn_hostile',say:'シュリーカーが近いです。音を立てないでください',note:'シュリーカー接近の事前警告 (ENV-04、発話レイヤー)'},
// === シュルカー浮遊 (ENV-05): 落下が始まってからでは遅い。浮遊検知で予告し、終了間際は真下へ先回りする ===
{id:'dim_lev_imminent_go',p:932,when:c=>Boolean(c.x?.ownerLevitating&&(c.x?.ownerLevitationSec??99)<=3&&c.owner.present&&c.owner.dimensionSame),act:'go_owner',say:'浮遊が切れます。真下で受けます',note:'浮遊終了間際は警告より着地点への先回り (ENV-05)'},
{id:'dim_lev_warn',p:930,when:c=>Boolean(c.x?.ownerLevitating&&(c.x?.ownerLevitationSec??99)<=10&&c.flags.warnOk),act:'warn_hostile',say:'浮遊中です。切れたら、そのまま落ちます。足元を確認してください',note:'主人の浮遊を検知した時点で落下を予告する (ENV-05)'},
// === ボスドロップ回収: 最優先級 ===
{id:'dim_boss_drop_dragon',p:879,when:c=>c.x?.dragonFight&&!c.x?.bossNear&&c.drops.valuableDist>=0&&c.drops.valuableDist<=24,act:'pickup_valuable',say:'ドラゴンの落とし物です。最優先で回収します',note:'ドラゴン撃破直後、ボスドロップを最優先回収'},
{id:'dim_boss_drop_wither',p:879,when:c=>c.x?.witherFight&&!c.x?.bossNear&&c.drops.valuableDist>=0&&c.drops.valuableDist<=20,act:'pickup_valuable',say:'ネザースター級の反応です。回収します',note:'ウィザー撃破直後、ボスドロップを最優先回収'},
{id:'dim_boss_drop_gvc',p:878,when:c=>c.x?.gvcBoss&&!c.x?.bossNear&&c.drops.valuableDist>=0&&c.drops.valuableDist<=20&&!c.inv.full,act:'pickup_valuable',say:'大型目標の残骸から、貴重品を回収します',note:'GVCボス撃破直後の貴重品回収'},
{id:'dim_boss_drop_hp_zero',p:878,when:c=>c.x?.bossHpPct===0&&c.drops.valuableDist>=0&&c.drops.valuableDist<=16&&c.danger.count===0,act:'pickup_valuable',say:'目標、沈黙しました。落とし物を回収します',note:'ボスHP0確定後のドロップ回収'},
{id:'dim_boss_drop_full_inv',p:877,when:c=>c.x?.bossHpPct===0&&c.drops.valuableDist>=0&&c.inv.full,act:'say_only',say:'回収したいのですが、私の荷物が満杯です',note:'ボスドロップがあるのに満杯。回収できない旨を伝える'},
// === ボス戦: 自分の生存 ===
{id:'dim_boss_self_critical',p:879,when:c=>c.x?.bossNear&&c.self.hpPct<=0.2&&c.danger.count>0,act:'flee',say:'私が先に壊れます。距離を取ります',note:'ボス戦で自分が瀕死なら離脱'},
{id:'dim_boss_self_low_dragon',p:876,when:c=>c.x?.dragonFight&&c.self.hpPct<=0.35,act:'flee',say:'ドラゴンの相手は、体力が戻ってからです',note:'ドラゴン戦で低HPなら離脱'},
{id:'dim_boss_self_low_wither',p:876,when:c=>c.x?.witherFight&&c.self.hpPct<=0.35,act:'flee',say:'ウィザーの毒が回っています。引きます',note:'ウィザー戦で低HPなら離脱'},
{id:'dim_boss_self_mid_ranged',p:870,when:c=>c.x?.bossNear&&c.self.hpPct<=0.5&&c.danger.rangedDist<16,act:'flee',say:'ボスの射程内です。私から離れます',note:'ボス接近＋遠距離攻撃圏内＋HP半分以下で離脱'},
{id:'dim_boss_stuck',p:874,when:c=>c.x?.bossNear&&c.self.stuck&&c.self.stuckSec>=3,act:'flee',say:'足場に引っかかっています。脱出します',note:'ボス戦でハマったら即脱出方向へ'},
// === ボス戦: 主人の護衛・警告 ===
{id:'dim_boss_owner_critical',p:877,when:c=>c.x?.bossNear&&c.owner.present&&c.owner.hpPct<=0.25,act:'guard',say:'あなたが倒れたら終わりです。私が前に出ます',note:'ボス戦で主人瀕死なら護衛'},
{id:'dim_boss_owner_targeted',p:875,when:c=>c.x?.bossNear&&c.danger.ownerTargeted&&c.self.hpPct>0.5,act:'guard',say:'ボスがあなたを見ています。間に入ります',note:'ボスが主人を狙っているなら護衛'},
{id:'dim_boss_owner_idle',p:873,when:c=>c.x?.bossNear&&c.owner.idleSec>10&&c.flags.warnOk,act:'warn_hostile',say:'ボスの前で止まらないでください',note:'ボス前で放置中の主人に警告'},
{id:'dim_boss_owner_low_phase_late',p:872,when:c=>c.x?.bossNear&&c.owner.hpPct<=0.4&&(c.x?.bossHpPct??1)<=0.3,act:'guard',say:'あと少しです。ここで倒れさせません',note:'ボス終盤＋主人低HPで護衛'},
{id:'dim_boss_first_sight',p:871,when:c=>c.x?.bossNear&&(c.x?.bossHpPct??0)>=0.95&&c.flags.warnOk,act:'warn_hostile',say:'大型反応を検知。ボス級です。構えてください',note:'ボス初遭遇（HPほぼ全快）で警告'},
{id:'dim_boss_owner_hungry',p:868,when:c=>c.x?.bossNear&&c.owner.hunger<=6&&c.owner.hpPct<=0.6,act:'warn_hostile',say:'空腹でボス戦は無謀です。まず食べてください',note:'ボス戦中の主人空腹＋HP低下を警告'},
// === ボス戦: 攻撃・距離 ===
{id:'dim_boss_zap_close_healthy',p:869,when:c=>c.x?.bossNear&&c.danger.nearestDist<6&&c.self.hpPct>0.7&&c.inv.hasWeapon,act:'zap',say:'援護射撃……ではなく、援護します',note:'ボス至近＋自HP余裕＋武器ありで反撃'},
{id:'dim_boss_zap_gvc',p:867,when:c=>c.x?.gvcBoss&&c.danger.nearestDist<8&&c.self.hpPct>0.6,act:'zap',say:'大型目標に牽制します。当たれば儲けものです',note:'GVCボス接近時に牽制'},
{id:'dim_boss_follow_high_ranged',p:866,when:c=>c.x?.bossNear&&c.danger.rangedDist<20&&c.mode==='follow',act:'follow_high',say:'上空から見ます。射線には入りません',note:'ボスの遠距離攻撃圏内では高め追従'},
{id:'dim_boss_follow_close_owner_low',p:865,when:c=>c.x?.bossNear&&c.owner.hpPct<=0.5&&c.self.distOwner>8,act:'follow_close',say:'ボス戦です。そばを離れません',note:'ボス戦＋主人HP低下で密着'},
{id:'dim_boss_go_owner_far',p:864,when:c=>c.x?.bossNear&&c.self.distOwner>24,act:'go_owner',say:'戦場で離れすぎです。合流します',note:'ボス戦で主人と離れすぎたら合流'},
// === ドラゴン戦専用 ===
{id:'dim_dragon_phase_late_owner_low',p:874,when:c=>c.x?.dragonFight&&(c.x?.bossHpPct??1)<=0.25&&c.owner.hpPct<=0.4,act:'guard',say:'ドラゴンは残りわずか。あなたは死なせません',note:'ドラゴン終盤＋主人低HPで護衛'},
{id:'dim_dragon_phase_start',p:863,when:c=>c.x?.dragonFight&&(c.x?.bossHpPct??0)>=0.9&&c.flags.warnOk,act:'warn_hostile',say:'エンダードラゴン戦、開始です。柱に注意',note:'ドラゴン戦開始直後の警告'},
{id:'dim_dragon_high_follow',p:862,when:c=>c.x?.dragonFight&&c.mode!=='stay',act:'follow_high',say:'ドラゴンは空から来ます。私も上を見ています',note:'ドラゴン戦中は基本高め追従'},
{id:'dim_dragon_owner_targeted',p:871,when:c=>c.x?.dragonFight&&c.danger.ownerTargeted&&c.owner.hpPct<=0.6,act:'guard',say:'ドラゴンがあなたを狙っています',note:'ドラゴンが主人を狙ったら護衛'},
{id:'dim_dragon_valuable_midfight',p:860,when:c=>c.x?.dragonFight&&c.x?.bossNear&&c.drops.valuableDist>=0&&c.drops.valuableDist<=6&&c.self.hpPct>0.8,act:'pickup_valuable',say:'戦闘中ですが、これは回収します。近いので',note:'ドラゴン戦中でも至近の貴重品だけ回収'},
// === ウィザー戦専用 ===
{id:'dim_wither_owner_on_fire',p:873,when:c=>c.x?.witherFight&&c.owner.onFire,act:'guard',say:'燃えています。ウィザーより先に火です',note:'ウィザー戦で主人炎上なら護衛寄り'},
{id:'dim_wither_follow_high',p:861,when:c=>c.x?.witherFight&&c.mode==='follow'&&c.danger.count>0,act:'follow_high',say:'ウィザーの頭蓋骨は上から避けます',note:'ウィザー戦中は高め追従'},
{id:'dim_wither_phase_late',p:869,when:c=>c.x?.witherFight&&(c.x?.bossHpPct??1)<=0.5&&c.owner.hpPct>0.5&&c.inv.hasWeapon,act:'zap',say:'ウィザーが弱ってきました。畳みかけます',note:'ウィザー後半＋主人余裕＋武器ありで攻撃参加'},
{id:'dim_wither_start_warn',p:863,when:c=>c.x?.witherFight&&(c.x?.bossHpPct??0)>=0.9&&c.flags.warnOk,act:'warn_hostile',say:'ウィザー戦です。爆発に巻き込まれないでください',note:'ウィザー戦開始直後の警告'},
// === GVCボス専用 ===
{id:'dim_gvc_boss_warn',p:872,when:c=>c.x?.gvcBoss&&c.x?.bossNear&&c.flags.warnOk,act:'warn_hostile',say:'GVCの大型機体です。通常の敵ではありません',note:'GVCボス接近の警告'},
{id:'dim_gvc_boss_owner_far',p:865,when:c=>c.x?.gvcBoss&&c.self.distOwner>16,act:'go_owner',say:'大型戦では単独行動禁止です。合流します',note:'GVCボス戦で離れていたら合流'},
{id:'dim_gvc_boss_follow_high',p:861,when:c=>c.x?.gvcBoss&&c.danger.rangedDist<24&&c.mode==='follow',act:'follow_high',say:'対空圏内です。高めに付きます',note:'GVCボスの射程内では高め追従'},
// === 次元移動・合流 ===
{id:'dim_catchup_dimension_diff',p:876,when:c=>c.owner.present&&!c.owner.dimensionSame&&(c.x?.dimension==='nether'||c.x?.dimension==='end'),act:'catchup',say:'次元がずれています。そちらへ向かいます',note:'主人と別次元（自分がネザー/エンド側）なら合流優先'},
{id:'dim_catchup_after_portal',p:874,when:c=>c.x?.portalNear&&c.owner.present&&!c.owner.dimensionSame,act:'catchup',say:'ポータルの向こうですね。追いつきます',note:'ポータル付近で次元がずれたら合流'},
{id:'dim_catchup_far_nether',p:868,when:c=>c.x?.dimension==='nether'&&c.owner.present&&c.self.distOwner>32,act:'catchup',say:'ネザーで離れすぎです。合流します',note:'ネザーで主人と遠距離なら合流'},
{id:'dim_catchup_far_end',p:868,when:c=>c.x?.dimension==='end'&&c.owner.present&&c.self.distOwner>32,act:'catchup',say:'エンドで離れると戻れません。合流します',note:'エンドで主人と遠距離なら合流'},
{id:'dim_catchup_boss_fight_owner',p:870,when:c=>(c.x?.dragonFight||c.x?.witherFight||c.x?.gvcBoss)&&c.owner.present&&c.self.distOwner>20,act:'catchup',say:'ボス戦の最中です。すぐ戻ります',note:'ボス戦中に離れたら合流を優先'},
// === ネザー一般 ===
{id:'dim_nether_lava_close',p:875,when:c=>c.x?.dimension==='nether'&&c.danger.lavaNear&&c.flags.warnOk,act:'warn_hostile',say:'足元、溶岩です。ネザーの挨拶は熱いですね',note:'ネザーで溶岩接近を警告（act制限のため warn_hostile を使用）'},
{id:'dim_nether_lava_owner_low',p:877,when:c=>c.x?.dimension==='nether'&&c.danger.lavaNear&&c.owner.hpPct<=0.4,act:'follow_close',say:'溶岩のそばでその体力は危険です。付きます',note:'ネザー溶岩付近＋主人低HPで密着'},
{id:'dim_nether_on_fire',p:872,when:c=>c.x?.dimension==='nether'&&c.owner.onFire&&c.danger.count>0,act:'guard',say:'燃えながら戦う場所ではありません。守ります',note:'ネザーで主人炎上＋敵ありで護衛'},
{id:'dim_nether_ranged_swarm',p:867,when:c=>c.x?.dimension==='nether'&&c.danger.rangedDist<14&&c.danger.count>=2,act:'follow_high',say:'ガスト圏内です。高めに避難します',note:'ネザーで遠距離敵＋複数敵なら高め追従'},
{id:'dim_nether_follow_default',p:860,when:c=>c.x?.dimension==='nether'&&c.mode==='follow'&&c.danger.count===0,act:'follow_close',say:'ネザーでは密着が基本です',note:'ネザーの平時は密着追従'},
{id:'dim_nether_valuable',p:864,when:c=>c.x?.dimension==='nether'&&c.drops.valuableDist>=0&&c.drops.valuableDist<=10&&!c.inv.full&&c.danger.count===0,act:'pickup_valuable',say:'ネザーの貴重品です。回収します',note:'ネザー平時の貴重品回収'},
{id:'dim_nether_owner_sprinting',p:862,when:c=>c.x?.dimension==='nether'&&c.owner.sprinting&&c.self.distOwner>10,act:'follow_close',say:'ネザーで走ると危ないですよ。……付いて行きますが',note:'ネザーで主人がダッシュしたら密着'},
{id:'dim_nether_night_shift',p:860,when:c=>c.x?.dimension==='nether'&&c.owner.idleSec>30&&c.danger.count===0,act:'say_only',say:'ネザーに夜はありません。私の夜勤は永続ですね',note:'ネザーで主人アイドル時の小言'},
// === ネザー要塞 ===
{id:'dim_fortress_warn',p:871,when:c=>c.x?.fortress&&c.danger.count>=2&&c.flags.warnOk,act:'warn_hostile',say:'要塞内、敵性反応が複数です',note:'要塞で敵複数を警告'},
{id:'dim_fortress_ranged',p:866,when:c=>c.x?.fortress&&c.danger.rangedDist<14,act:'guard',say:'ブレイズの射程です。前に出ます',note:'要塞で遠距離敵接近なら護衛'},
{id:'dim_fortress_valuable',p:865,when:c=>c.x?.fortress&&c.drops.valuableDist>=0&&c.drops.valuableDist<=12&&c.danger.count===0&&!c.inv.full,act:'pickup_valuable',say:'要塞の戦利品です。回収します',note:'要塞平時の貴重品回収'},
{id:'dim_fortress_owner_low',p:870,when:c=>c.x?.fortress&&c.owner.hpPct<=0.35,act:'follow_close',say:'要塞でその体力は見過ごせません。付きます',note:'要塞で主人低HPなら密着'},
{id:'dim_fortress_lava',p:873,when:c=>c.x?.fortress&&c.danger.lavaNear&&c.flags.warnOk,act:'warn_hostile',say:'要塞の床は抜けます。溶岩に注意',note:'要塞＋溶岩接近を警告'},
// === エンド一般 ===
{id:'dim_end_follow_default',p:860,when:c=>c.x?.dimension==='end'&&c.mode==='follow'&&!c.x?.dragonFight,act:'follow_close',say:'エンドでは、落ちたら終わりです。付きます',note:'エンド平時（ドラゴン戦以外）は密着'},
{id:'dim_end_owner_low',p:869,when:c=>c.x?.dimension==='end'&&c.owner.hpPct<=0.3,act:'guard',say:'エンドでその体力は危険です。守ります',note:'エンドで主人瀕死寄りなら護衛'},
{id:'dim_end_valuable_far',p:863,when:c=>c.x?.dimension==='end'&&c.drops.valuableDist>=0&&c.drops.valuableDist<=18&&!c.x?.dragonFight&&!c.inv.full,act:'pickup_valuable',say:'エンドの貴重品です。遠くても回収します',note:'エンド平時の貴重品回収（範囲広め）'},
{id:'dim_end_stay_portal',p:862,when:c=>c.x?.dimension==='end'&&c.x?.portalNear&&c.mode==='stay',act:'say_only',say:'帰還ポータルのそばで待機しています',note:'エンドの帰還ポータル付近で待機モード'},
// === ポータル付近 ===
{id:'dim_portal_stay_wait',p:861,when:c=>c.x?.portalNear&&c.mode==='stay',act:'say_only',say:'ポータルのそばで待っています。置いて行かないでください',note:'ポータル付近で待機モードなら待つ'},
{id:'dim_portal_danger',p:870,when:c=>c.x?.portalNear&&c.danger.count>0&&c.flags.warnOk,act:'warn_hostile',say:'ポータル前で敵です。先に片付けてください',note:'ポータル付近に敵がいたら警告'},
{id:'dim_portal_owner_far',p:864,when:c=>c.x?.portalNear&&c.owner.present&&c.self.distOwner>14,act:'go_owner',say:'ポータルをくぐる前に、合流させてください',note:'ポータル付近で主人が遠いなら寄る'},
{id:'dim_portal_full_inv',p:863,when:c=>c.x?.portalNear&&c.inv.full,act:'say_only',say:'荷物が満杯です。次元を越える前に整理を',note:'ポータル前で満杯なら整理を促す'},
{id:'dim_portal_nether_side',p:861,when:c=>c.x?.portalNear&&c.x?.dimension==='nether'&&c.danger.count===0,act:'follow_close',say:'ポータル際が一番安全です。付きます',note:'ネザー側ポータル付近の平時は密着'},
// === 古代都市・要塞遺跡（stronghold） ===
{id:'dim_stronghold_warn',p:868,when:c=>c.x?.stronghold&&c.danger.count>0&&c.flags.warnOk,act:'warn_hostile',say:'要塞遺跡です。静かに、しかし確実に敵がいます',note:'ストロングホールドで敵を警告'},
{id:'dim_stronghold_portal_near',p:866,when:c=>c.x?.stronghold&&c.x?.portalNear,act:'follow_close',say:'エンドポータルが近いです。はぐれません',note:'ストロングホールドでポータル接近なら密着'},
{id:'dim_stronghold_valuable',p:864,when:c=>c.x?.stronghold&&c.drops.valuableDist>=0&&c.drops.valuableDist<=10&&c.danger.count===0&&!c.inv.full,act:'pickup_valuable',say:'遺跡の貴重品です。回収します',note:'ストロングホールド平時の貴重品回収'},
{id:'dim_stronghold_owner_sneaking',p:862,when:c=>c.x?.stronghold&&c.owner.sneaking,act:'follow_close',say:'静かに付いて行きます。音は立てません',note:'ストロングホールドで主人スニーク中は密着'},
];
