// 特殊な緊急事態セカンドオピニオン (優先度帯 905-919)
// rules_safety.js が扱う通常の危険（HP・通常クリーパー・射手・群れ・溶岩・スタック）と被らない、
// 特殊状況だけを扱う追加レイヤー。追加文脈 c.x は全て c.x?.〜 で参照し、x が無い文脈では沈黙する。
// when は必ず Boolean(...) で包み、真偽値を返すことを保証する。
export const RULES = [
// === 帯電クリーパー (chargedCreeper) ===
{id:'emg2_charged_point_blank_owner',p:919,when:c=>Boolean(c.x?.chargedCreeper&&c.danger.creeperDist<6&&c.owner.present&&c.flags.warnOk),act:'warn_creeper',say:'帯電個体です。通常の爆発とは威力が違います',note:'帯電クリーパー至近を最優先で警告（範囲・威力が通常より大きい）'},
{id:'emg2_charged_owner_low',p:918,when:c=>Boolean(c.x?.chargedCreeper&&c.danger.creeperDist<10&&c.owner.hpPct<=0.4&&c.flags.warnOk),act:'warn_creeper',say:'その体力では帯電爆発に耐えられません。逃げてください',note:'主人低HP時の帯電クリーパーを強警告'},
{id:'emg2_charged_self_close',p:918,when:c=>Boolean(c.x?.chargedCreeper&&c.danger.creeperDist<5&&c.self.hpPct<=0.6),act:'flee',say:'帯電個体に近づけません。離脱します',note:'帯電クリーパー至近かつ自HP余裕なしで逃走'},
{id:'emg2_charged_carrying_valuable',p:916,when:c=>Boolean(c.x?.chargedCreeper&&c.danger.creeperDist<9&&c.inv.hasValuable),act:'flee',say:'荷物ごと吹き飛ぶ距離です。下がります',note:'貴重品運搬中の帯電クリーパーで逃走'},
{id:'emg2_charged_at_home',p:916,when:c=>Boolean(c.x?.chargedCreeper&&c.danger.creeperDist<10&&c.home.registered&&c.self.distHome<14&&c.flags.warnOk),act:'warn_creeper',say:'拠点ごと壊れます。あれを近づけないでください',note:'拠点付近の帯電クリーパーを警告'},
{id:'emg2_charged_thunder_swarm',p:915,when:c=>Boolean(c.x?.chargedCreeper&&c.env.isThundering&&c.danger.count>=3),act:'flee',say:'帯電個体に群れまで。ここは退きます',note:'雷雨・帯電・群れの複合で逃走'},
{id:'emg2_charged_owner_sneaking',p:914,when:c=>Boolean(c.x?.chargedCreeper&&c.danger.creeperDist<9&&c.owner.sneaking&&c.flags.warnOk),act:'warn_creeper',say:'静かに。……帯電したのが後ろにいます',note:'主人スニーク中の帯電クリーパーを小声で警告'},
{id:'emg2_charged_night_idle_owner',p:913,when:c=>Boolean(c.x?.chargedCreeper&&c.env.isNight&&c.owner.idleSec>10&&c.flags.warnOk),act:'warn_creeper',say:'青く光るのが見えます。帯電個体です、動いてください',note:'夜間・主人放置中の帯電クリーパーを警告'},
// === 落下 (falling / ownerFallDist) ===
{id:'emg2_owner_fall_fatal',p:919,when:c=>Boolean(c.x?.falling&&(c.x?.ownerFallDist??0)>=30&&c.owner.present&&c.owner.dimensionSame),act:'go_owner',say:'落下中ですね。着地点で待機します',note:'主人致死圏の落下（30以上）で着地点へ先行'},
{id:'emg2_owner_fall_big',p:917,when:c=>Boolean(c.x?.falling&&(c.x?.ownerFallDist??0)>=18&&(c.x?.ownerFallDist??0)<30&&c.owner.hpPct<=0.5&&c.owner.dimensionSame),act:'go_owner',say:'大きな落下です。着地後の援護に行きます',note:'主人の中〜大落下かつHP余裕なしで合流'},
{id:'emg2_owner_fall_hostile_below',p:916,when:c=>Boolean(c.x?.falling&&(c.x?.ownerFallDist??0)>=12&&c.danger.count>0&&c.owner.dimensionSame),act:'go_owner',say:'落下先に敵がいます。先回りします',note:'落下先に敵がいる場合に先回り'},
{id:'emg2_owner_fall_night',p:912,when:c=>Boolean(c.x?.falling&&(c.x?.ownerFallDist??0)>=15&&c.env.isNight),act:'follow_close',say:'暗い中での落下は危険です。近くにいます',note:'夜間の大落下で密着追随'},
{id:'emg2_owner_fall_near_void_combo',p:918,when:c=>Boolean(c.x?.falling&&c.x?.voidRisk&&(c.x?.ownerFallDist??0)>=10&&c.owner.dimensionSame),act:'go_owner',say:'その下、奈落です。着地位置を外さないでください',note:'落下＋奈落リスクの複合で合流警告'},
{id:'emg2_self_falling_hostile',p:914,when:c=>Boolean(c.x?.selfFalling&&c.self.hpPct<=0.5&&c.danger.nearestDist<8),act:'rise_avoid',say:'落下中に撃たれています。上へ逃げます',note:'自分の落下中・低HP・敵接近で上昇回避'},
{id:'emg2_self_falling_lava_below',p:917,when:c=>Boolean(c.x?.selfFalling&&c.danger.lavaNear),act:'rise_avoid',say:'落下先が溶岩です。浮き直します',note:'落下先が溶岩なら上昇回避'},
{id:'emg2_owner_fall_underground',p:911,when:c=>Boolean(c.x?.falling&&(c.x?.ownerFallDist??0)>=14&&c.owner.underground&&c.owner.dimensionSame),act:'go_owner',say:'縦穴の落下ですね。下で待っています',note:'地下縦穴での大落下に先行合流'},
// === 窒息 (suffocating) ===
{id:'emg2_owner_suffocating_low',p:919,when:c=>Boolean(c.x?.suffocating&&c.owner.hpPct<=0.4&&c.owner.present&&c.owner.dimensionSame),act:'go_owner',say:'窒息しています。埋まったブロックを崩してください',note:'主人窒息かつ低HPで至急合流'},
{id:'emg2_owner_suffocating_alone',p:915,when:c=>Boolean(c.x?.suffocating&&c.owner.present&&c.self.distOwner>10),act:'go_owner',say:'窒息を検知。急いで向かいます',note:'離れた場所での主人窒息に合流'},
{id:'emg2_owner_suffocating_hostile',p:916,when:c=>Boolean(c.x?.suffocating&&c.danger.count>0&&c.owner.present&&c.owner.dimensionSame),act:'go_owner',say:'窒息中に敵まで。先に敵を引きます',note:'窒息＋敵ありで合流介入'},
{id:'emg2_self_suffocating',p:913,when:c=>Boolean(c.x?.suffocating&&c.self.hpPct<=0.6&&c.self.distOwner>=10),act:'rise_avoid',say:'私も埋まりかけています。浮上します',note:'自分側の窒息兆候（主人不在側の文脈）で上昇回避'},
{id:'emg2_suffocating_night_owner',p:910,when:c=>Boolean(c.x?.suffocating&&c.env.isNight&&c.owner.present&&c.flags.warnOk),act:'warn_hostile',say:'夜に埋もれると発見が遅れます。今、出てください',note:'夜間の窒息を警告（warn系の汎用警告として）'},
{id:'emg2_suffocating_carrying',p:912,when:c=>Boolean(c.x?.suffocating&&c.inv.hasValuable&&c.owner.present&&c.owner.dimensionSame),act:'go_owner',say:'荷物より先に、あなたを掘り出す話です',note:'貴重品運搬中でも窒息対応を優先し合流'},
{id:'emg2_suffocating_web_combo',p:914,when:c=>Boolean(c.x?.suffocating&&c.x?.webStuck&&c.owner.present&&c.owner.dimensionSame),act:'go_owner',say:'巣と窒息の併発です。急ぎます',note:'クモの巣拘束＋窒息の複合で合流'},
// === 凍結 (freezing: 粉雪) ===
{id:'emg2_owner_freezing_low',p:918,when:c=>Boolean(c.x?.freezing&&c.owner.hpPct<=0.4&&c.owner.present&&c.owner.dimensionSame),act:'go_owner',say:'凍結が進んでいます。粉雪から出てください',note:'主人凍結かつ低HPで合流'},
{id:'emg2_owner_freezing_far',p:913,when:c=>Boolean(c.x?.freezing&&c.self.distOwner>12&&c.owner.present),act:'go_owner',say:'体温低下を検知。迎えに行きます',note:'遠方での主人凍結に合流'},
{id:'emg2_freezing_night',p:912,when:c=>Boolean(c.x?.freezing&&c.env.isNight&&c.owner.present&&c.flags.warnOk),act:'warn_hostile',say:'夜の粉雪は静かに削ってきます。離れてください',note:'夜間の凍結を警告'},
{id:'emg2_freezing_hostile',p:915,when:c=>Boolean(c.x?.freezing&&c.danger.count>0&&c.owner.hpPct<=0.6),act:'follow_close',say:'凍えて動きが鈍いですね。近くで守ります',note:'凍結＋敵ありで密着'},
{id:'emg2_freezing_soulsand_combo',p:911,when:c=>Boolean(c.x?.freezing&&c.x?.soulSandSlow&&c.owner.present),act:'follow_close',say:'鈍足と凍結の重なりです。置いていきません',note:'ソウルサンド鈍足＋凍結で密着'},
{id:'emg2_self_freezing_low',p:910,when:c=>Boolean(c.x?.freezing&&c.self.hpPct<=0.35&&!c.owner.present),act:'rise_avoid',say:'私の関節も凍り始めています。上へ退きます',note:'主人不在・自分の凍結＋低HPで上昇回避'},
{id:'emg2_freezing_owner_idle',p:909,when:c=>Boolean(c.x?.freezing&&c.owner.idleSec>15&&c.owner.present&&c.flags.warnOk),act:'warn_hostile',say:'止まったまま凍えています。……聞こえていますか',note:'放置中の凍結を警告'},
// === 奈落 (voidRisk) ===
{id:'emg2_void_owner_low',p:919,when:c=>Boolean(c.x?.voidRisk&&c.owner.hpPct<=0.3&&c.owner.present),act:'follow_close',say:'奈落の縁です。その体力で落ちたら終わりですよ',note:'奈落近接かつ主人瀕死で密着'},
{id:'emg2_void_owner_sprinting',p:917,when:c=>Boolean(c.x?.voidRisk&&c.owner.sprinting&&c.owner.present&&c.flags.warnOk),act:'warn_hostile',say:'走る場所ではありません。奈落です',note:'奈落縁でのダッシュを警告'},
{id:'emg2_void_hostile_knockback',p:918,when:c=>Boolean(c.x?.voidRisk&&c.danger.count>0&&c.danger.nearestDist<8),act:'flee',say:'ノックバックで落ちます。縁から離れます',note:'奈落＋敵接近（吹き飛ばし落下）で離脱'},
{id:'emg2_void_carrying_valuable',p:916,when:c=>Boolean(c.x?.voidRisk&&c.inv.hasValuable&&c.inv.valuableCount>=2),act:'flee',say:'この荷物を奈落に落とすわけにはいきません',note:'貴重品多数運搬中の奈落リスクで離脱'},
{id:'emg2_void_night',p:913,when:c=>Boolean(c.x?.voidRisk&&c.env.isNight&&c.owner.present&&c.flags.warnOk),act:'warn_hostile',say:'暗くて縁が見えません。足元、奈落です',note:'夜間の奈落を警告'},
{id:'emg2_void_owner_sneaking_safe',p:905,when:c=>Boolean(c.x?.voidRisk&&c.owner.sneaking&&c.danger.count===0&&c.owner.present),act:'say_only',say:'スニーク移動、確認。静かに見ています',note:'奈落縁をスニーク移動中は安全側として見守る'},
{id:'emg2_void_self_stuck',p:914,when:c=>Boolean(c.x?.voidRisk&&c.self.stuck&&c.self.stuckSec>3),act:'rise_avoid',say:'縁で引っかかっています。浮いて外します',note:'奈落付近で自分のスタックを上昇回避'},
{id:'emg2_void_ranged',p:915,when:c=>Boolean(c.x?.voidRisk&&c.danger.rangedDist<14&&c.owner.present),act:'flee',say:'矢の一発で落ちます。射線から外れます',note:'奈落＋射手の複合で離脱'},
// === クモの巣 (webStuck) ===
{id:'emg2_web_owner_hostile',p:917,when:c=>Boolean(c.x?.webStuck&&c.danger.nearestDist<8&&c.owner.present&&c.owner.dimensionSame),act:'go_owner',say:'巣に絡まっていますね。敵を引きます',note:'クモの巣拘束＋敵接近で合流介入'},
{id:'emg2_web_owner_low',p:916,when:c=>Boolean(c.x?.webStuck&&c.owner.hpPct<=0.35&&c.owner.present&&c.owner.dimensionSame),act:'go_owner',say:'その体力で拘束は危険です。急ぎます',note:'拘束＋主人低HPで合流'},
{id:'emg2_web_ranged_targeted',p:915,when:c=>Boolean(c.x?.webStuck&&c.danger.rangedDist<14&&c.danger.ownerTargeted&&c.owner.dimensionSame),act:'go_owner',say:'動けないところを狙われています',note:'拘束中に射手に狙われたら合流'},
{id:'emg2_web_night',p:908,when:c=>Boolean(c.x?.webStuck&&c.env.isNight&&c.owner.present&&c.flags.warnOk),act:'warn_hostile',say:'夜の巣は本命が寄ってきます。早く抜けてください',note:'夜間の拘束を警告'},
{id:'emg2_web_self_low',p:909,when:c=>Boolean(c.x?.webStuck&&c.self.hpPct<=0.4&&c.danger.count>0),act:'flee',say:'私も絡まりました。……これは退きます',note:'自分の拘束＋低HP＋敵ありで離脱'},
{id:'emg2_web_owner_idle',p:907,when:c=>Boolean(c.x?.webStuck&&c.owner.idleSec>10&&c.owner.present&&c.flags.warnOk),act:'warn_hostile',say:'巣の中で止まっています。気づいていますか',note:'拘束中の主人放置を警告'},
// === ソウルサンド鈍足 (soulSandSlow) ===
{id:'emg2_soulsand_chased',p:916,when:c=>Boolean(c.x?.soulSandSlow&&c.danger.ownerTargeted&&c.danger.nearestDist<10),act:'follow_close',say:'足場が悪いですね。後ろは私が持ちます',note:'鈍足中に追跡されたら密着護衛'},
{id:'emg2_soulsand_owner_low',p:915,when:c=>Boolean(c.x?.soulSandSlow&&c.owner.hpPct<=0.35&&c.danger.count>0),act:'follow_close',say:'逃げ足が削られています。近くにいます',note:'鈍足＋低HP＋敵ありで密着'},
{id:'emg2_soulsand_lava_combo',p:917,when:c=>Boolean(c.x?.soulSandSlow&&c.danger.lavaNear&&c.owner.present&&c.owner.dimensionSame),act:'go_owner',say:'鈍足の先に溶岩です。進路を変えてください',note:'鈍足＋溶岩近接で合流警告'},
{id:'emg2_soulsand_ranged',p:912,when:c=>Boolean(c.x?.soulSandSlow&&c.danger.rangedDist<14&&c.owner.present&&c.flags.warnOk),act:'warn_hostile',say:'その足では矢を避けきれません。物陰へ',note:'鈍足中の射手を警告'},
{id:'emg2_soulsand_night_swarm',p:913,when:c=>Boolean(c.x?.soulSandSlow&&c.env.isNight&&c.danger.count>=3),act:'flee',say:'鈍足で群れは無理です。一緒に退きます',note:'鈍足＋夜＋群れで離脱'},
{id:'emg2_soulsand_carrying_full',p:908,when:c=>Boolean(c.x?.soulSandSlow&&c.inv.full&&c.danger.count>0),act:'flee',say:'満載と鈍足の併発です。欲張らないでください',note:'満載＋鈍足＋敵ありで離脱'},
// === 複合・その他 ===
{id:'emg2_charged_void_combo',p:919,when:c=>Boolean(c.x?.chargedCreeper&&c.x?.voidRisk&&c.danger.creeperDist<10),act:'flee',say:'帯電爆発で奈落行きです。最大限離れます',note:'帯電＋奈落（爆風落下）の最悪複合で逃走'},
{id:'emg2_falling_web_combo',p:910,when:c=>Boolean(c.x?.falling&&c.x?.webStuck&&(c.x?.ownerFallDist??0)>=8&&c.owner.dimensionSame),act:'go_owner',say:'落下の受け先が巣ですね。着地地点へ行きます',note:'落下＋クモの巣着地の複合で先行合流'},
{id:'emg2_freezing_falling_combo',p:911,when:c=>Boolean(c.x?.freezing&&c.x?.falling&&(c.x?.ownerFallDist??0)>=12&&c.owner.dimensionSame),act:'go_owner',say:'凍えたままの落下です。受けに行きます',note:'凍結＋大落下の複合で合流'},
{id:'emg2_all_slow_owner',p:906,when:c=>Boolean(c.x?.webStuck&&c.x?.soulSandSlow&&c.x?.freezing&&c.owner.present),act:'say_only',say:'拘束、鈍足、凍結。……全部盛りですね、あなたは',note:'鈍足系デバフ全重なりの観察コメント'},
{id:'emg2_void_edge_warn',p:912,when:c=>Boolean(c.x?.voidRisk&&c.owner.present&&!c.owner.sneaking&&c.flags.warnOk),act:'warn_hostile',say:'足元、奈落です。縁に近づかないでください',note:'ENV-01: 奈落縁の汎用警告（個別条件に当てはまらない通常時）'},
{id:'emg2_void_dusk_owner',p:907,when:c=>Boolean(c.x?.voidRisk&&c.env.isDusk&&c.owner.present&&c.flags.warnOk),act:'warn_hostile',say:'夕方は縁の境目が見えません。奈落に注意を',note:'夕方の奈落を早めに警告'},
{id:'emg2_charged_dawn_after_thunder',p:905,when:c=>Boolean(c.x?.chargedCreeper&&c.env.isDawn&&c.danger.creeperDist<12&&c.flags.warnOk),act:'warn_creeper',say:'雷の置き土産が残っています。帯電個体です',note:'雷雨明け朝の帯電クリーパー残留を警告'},
// === 自己ハザード (selfInLava / selfInWater / selfOnFire / selfFreezing / selfSuffocating / selfPoisoned / selfWithered) ===
// 行動ベンチ hazard 群の設計前提。自分の身体の危機は回収・入庫・待機より先に処理する。
// 生命危機帯 (p>=900) に置くことで、ミッション中の割り込み対象 (flee) にもなる。
// ENV-02 D1 (cycle0340): hasFireResPotion は正式版 API で種別判別できず false 固定のため、このルールと drink_fire_res 実行部は dormant (安全側)。足場脱出は飲用連鎖を前提にしない
{id:'emg2_self_lava_drink_fireres',p:919,when:c=>Boolean(c.x?.selfInLava&&c.x?.hasFireResPotion&&!c.x?.fireResActive),act:'drink_fire_res',say:'溶岩です。まず耐火を飲みます',note:'溶岩浸漬かつ耐火ポーション所持なら、脱出前に飲んで時間を稼ぐ'},
{id:'emg2_self_lava_fireres_escape',p:918,when:c=>Boolean(c.x?.selfInLava&&c.x?.fireResActive),act:'escape_hazard',say:'耐火が効いています。落ち着いて出ます',note:'耐火有効中の溶岩浸漬は慌てて逃げず (flee でなく) 脱出移動'},
{id:'emg2_self_lava_critical',p:917,when:c=>Boolean(c.x?.selfInLava&&c.self.hpPct<=0.75),act:'flee',say:'溶岩です。すぐに出ます',note:'溶岩浸漬かつHP余裕なしは生命危機として flee (ミッション割り込み対象)'},
{id:'emg2_self_lava_escape',p:916,when:c=>Boolean(c.x?.selfInLava),act:'escape_hazard',say:'溶岩です。すぐに出ます',note:'溶岩浸漬は次元・モード・所持品によらず脱出が最優先'},
{id:'emg2_self_drowning_surface',p:915,when:c=>Boolean(c.x?.selfInWater&&(c.x?.selfAirPct??1)<=0.5),act:'surface',say:'空気が持ちません。浮上します',note:'水中で空気が半分以下なら作業・追従より浮上'},
{id:'emg2_self_onfire_seek_water',p:914,when:c=>Boolean(c.x?.selfOnFire&&!c.env.isRaining),act:'seek_water',say:'燃えています。水を探します',note:'炎上したら入庫・配達より消火。雨天は雨で消えるため過剰反応しない'},
{id:'emg2_self_freezing_escape',p:913,when:c=>Boolean(c.x?.selfFreezing),act:'escape_hazard',say:'粉雪に沈んでいます。出ます',note:'自分の凍結 (粉雪) は回収より脱出が先'},
{id:'emg2_self_suffocating_escape',p:913,when:c=>Boolean(c.x?.selfSuffocating),act:'escape_hazard',say:'埋まっています。脱出します',note:'自分の窒息は主人との距離によらず脱出移動 (既存 emg2_self_suffocating の至近・自己名義版)'},
{id:'emg2_self_poison_milk',p:912,when:c=>Boolean((c.x?.selfPoisoned||c.x?.selfWithered)&&c.x?.hasMilk),act:'drink_milk',say:'状態異常です。牛乳で消します',note:'毒・衰弱かつ牛乳所持なら飲んで解除'},
{id:'emg2_self_poison_retreat',p:911,when:c=>Boolean(c.x?.selfPoisoned&&!c.x?.hasMilk&&c.self.hpPct<=0.4),act:'flee',say:'毒で削られています。退きます',note:'毒・牛乳なし・低HPは戦わず待避'},
{id:'emg2_self_wither_retreat',p:911,when:c=>Boolean(c.x?.selfWithered&&!c.x?.hasMilk),act:'flee',say:'衰弱です。放置すると死にます。退きます',note:'衰弱・牛乳なしは待避 (衰弱は回復を上回って削り続けるため)'},
];
