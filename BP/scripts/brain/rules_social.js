// マルチプレイ・他プレイヤーがいる状況の分岐ルール（優先度帯 240〜259）
// 感情層(200〜299帯)の一部として、安全/ケア/運搬/環境より低く、既定より高い位置で効く。
// 追加文脈 c.x は任意（無い環境でも落ちないよう、必ず c.x?.〜 で参照する）。
//   c.x.othersNear   : 周囲の他プレイヤー数（数値）
//   c.x.otherDist    : 最も近い他プレイヤーまでの距離
//   c.x.ownerChatting: 主人が他者と近距離で向き合っている（真偽値）
//   c.x.tradeLike    : 取引っぽい状況（真偽値）
//   c.x.pvpRisk      : PvPの気配がある（真偽値）
// セリフはリゼ口調（一人称「私」、相手は「あなた」、短い敬語）。
export const RULES = [
// ===== 接近時の挨拶 =====
{id:'social_greet_first_close', p:258, when:c=>(c.x?.othersNear??0)>=1&&(c.x?.otherDist??999)<=5&&!c.x?.ownerChatting&&c.danger.count===0, act:'greet', say:'補助機のLIZE-07です。……リゼ、と呼んでください', note:'他プレイヤーが初めて近くに来たら型番で名乗る（設定準拠の初対面挨拶）'},
{id:'social_greet_near', p:250, when:c=>(c.x?.othersNear??0)>=1&&(c.x?.otherDist??999)<=8&&c.mode==='follow'&&c.danger.count===0, act:'greet', say:'こんにちは。私は、あなたの助手です', note:'接近時に主人の助手として挨拶する'},
{id:'social_greet_morning_crowd', p:244, when:c=>(c.x?.othersNear??0)>=2&&c.env.isDawn&&c.danger.count===0, act:'greet', say:'おはようございます。……朝は、人が多いですね', note:'朝の集まりでは挨拶を少しだけ多めに'},
{id:'social_greet_night_quiet', p:242, when:c=>(c.x?.othersNear??0)>=1&&(c.x?.otherDist??999)<=6&&c.env.isNight, act:'greet', say:'こんばんは。……声は、小さめにします', note:'夜の接近では静かに挨拶する'},
{id:'social_greet_rain', p:241, when:c=>(c.x?.othersNear??0)>=1&&(c.x?.otherDist??999)<=7&&c.env.isRaining, act:'greet', say:'こんにちは。雨宿りですか。私も、です', note:'雨の日の接近は雨宿りの話題で挨拶'},
{id:'social_greet_owner_busy_skip', p:247, when:c=>(c.x?.othersNear??0)>=1&&c.x?.ownerChatting===true&&(c.x?.otherDist??999)<=6, act:'say_only', say:'……（挨拶は、後でいいですね）', note:'主人が会話中なら挨拶は控えて小声で済ませる'},
{id:'social_greet_from_anchor', p:240, when:c=>c.mode==='stay'&&(c.x?.othersNear??0)>=1&&(c.x?.otherDist??999)<=6&&c.danger.count===0, act:'greet', say:'いらっしゃいませ。……ここは、あなたの定位置です', note:'待機中（定位置）に来客があったら迎える'},

// ===== 主人が他者と話している：邪魔しない・控えめ =====
{id:'social_chat_step_back', p:256, when:c=>c.x?.ownerChatting===true&&c.self.distOwner<=4, act:'follow', say:'お話中ですね。私は、少し後ろにいます', note:'主人が向き合って話していたら一歩下がる'},
{id:'social_chat_stay_quiet', p:253, when:c=>c.x?.ownerChatting===true&&c.self.distOwner>4&&c.mode==='follow', act:'stay_anchor', say:'……（静かに待機しています）', note:'会話中はその場で静かに待つ'},
{id:'social_chat_long_wait', p:249, when:c=>c.x?.ownerChatting===true&&c.owner.idleSec>=120, act:'say_only', say:'長いお話ですね。……次の作業まで、三分は過ぎました', note:'会話が長いと三分ネタで控えめに存在を出す'},
{id:'social_chat_night_lower', p:245, when:c=>c.x?.ownerChatting===true&&c.env.isNight, act:'stay_anchor', say:'夜ですので。私は、物音を立てません', note:'夜の会話には音で割り込まない'},
{id:'social_chat_with_drops_wait', p:246, when:c=>c.x?.ownerChatting===true&&c.drops.count>0&&!c.inv.full, act:'say_only', say:'落ちた物は、後で拾います。……先に、お話をどうぞ', note:'会話中は回収で間を横切らない'},
{id:'social_chat_owner_low_hp_stay_close', p:257, when:c=>c.x?.ownerChatting===true&&c.owner.hpPct<=0.35, act:'follow_close', say:'お話中、失礼します。……あなたの体力だけ、気になります', note:'会話中でも主人の体力が低ければ控えめを破って寄る'},
{id:'social_chat_end_return', p:243, when:c=>c.x?.ownerChatting===false&&(c.x?.othersNear??0)>=1&&c.self.distOwner>=10&&c.mode==='follow', act:'follow', say:'お話、終わりましたか。……戻りました', note:'会話が終わったら通常の距離に戻る'},

// ===== 取引っぽい状況：割り込まない =====
{id:'social_trade_hold_position', p:255, when:c=>c.x?.tradeLike===true&&c.mode!=='stay', act:'stay_anchor', say:'お取引中ですね。私は、ここで待ちます', note:'取引中は動いて気を散らさない'},
{id:'social_trade_no_deliver', p:254, when:c=>c.x?.tradeLike===true&&c.inv.used>0&&c.inv.hasValuable, act:'say_only', say:'渡したい物はありますが。……今は、しまっておきます', note:'取引中に貴重品の受け渡しで割り込まない'},
{id:'social_trade_full_hold', p:252, when:c=>c.x?.tradeLike===true&&c.inv.full, act:'stay_anchor', say:'荷物はいっぱいです。……でも、今は待ちます', note:'満載でも取引が終わるまでは入庫を急がない'},
{id:'social_trade_pvp_watch', p:259, when:c=>c.x?.tradeLike===true&&c.x?.pvpRisk===true, act:'follow_close', say:'……取引の最中ですが。少しだけ、近くにいます', note:'取引＋PvPの気配がある時だけは例外的に寄る'},
{id:'social_trade_end_deliver', p:248, when:c=>c.x?.tradeLike===false&&(c.x?.othersNear??0)>=1&&c.flags.justDelivered===false&&c.inv.used>0&&c.self.distOwner<=5&&!(c.x?.pvpRisk), act:'deliver_all', say:'お待たせしました。あなたに、これを', note:'取引が終わった後なら、他者がいても主人へ渡す'},
{id:'social_trade_underground_quiet', p:244, when:c=>c.x?.tradeLike===true&&c.owner.underground, act:'idle_hover', say:'……（地下では、声を落とします）', note:'地下での取引は特に静かに待つ'},

// ===== 混雑：密着しすぎない =====
{id:'social_crowd_three_follow', p:251, when:c=>(c.x?.othersNear??0)>=3&&c.mode==='follow'&&c.self.distOwner<=3, act:'follow', say:'混んでいますね。……少し、離れてついていきます', note:'3人以上いたら密着をやめて距離を取る'},
{id:'social_crowd_five_anchor', p:253, when:c=>(c.x?.othersNear??0)>=5&&c.danger.count===0, act:'stay_anchor', say:'人が多いので。私は、端で待っています', note:'大混雑では端で待機して邪魔にならない'},
{id:'social_crowd_night_keep_sight', p:247, when:c=>(c.x?.othersNear??0)>=3&&c.env.isNight&&c.mode==='follow', act:'follow', say:'夜の人混みです。……あなただけは、見失いません', note:'夜の混雑では距離を取りつつ主人を見失わない'},
{id:'social_crowd_stuck_step_aside', p:255, when:c=>(c.x?.othersNear??0)>=2&&c.self.stuck&&c.self.stuckSec>=3, act:'idle_hover', say:'すみません、通路でした。……どきます', note:'混雑で引っかかったら通路を空ける'},
{id:'social_crowd_owner_sneak_match', p:242, when:c=>(c.x?.othersNear??0)>=2&&c.owner.sneaking, act:'follow', say:'……（あなたに合わせて、静かに）', note:'人前で主人がしゃがんだら自分も控えめに'},
{id:'social_crowd_owner_sprint_keep', p:246, when:c=>(c.x?.othersNear??0)>=2&&c.owner.sprinting&&c.self.distOwner>=12, act:'follow_close', say:'人混みでも、置いていきません。……私が、です', note:'混雑で主人が走り出したら遅れないよう寄る'},
{id:'social_crowd_rain_shelter', p:241, when:c=>(c.x?.othersNear??0)>=2&&c.env.isRaining&&c.mode!=='work', act:'idle_hover', say:'雨宿りの場所、取り合いですね。……私は、濡れても平気です', note:'雨宿りが混んでいたら場所を譲る'},

// ===== PvPの気配：警戒と配慮 =====
{id:'social_pvp_approach_guard', p:259, when:c=>c.x?.pvpRisk===true&&(c.x?.othersNear??0)>=1&&(c.x?.otherDist??999)<=10, act:'follow_close', say:'……少し、警戒します。あなたの側にいます', note:'PvPの気配＋他者接近では主人の側に寄る'},
{id:'social_pvp_valuable_hold', p:258, when:c=>c.x?.pvpRisk===true&&c.inv.hasValuable&&c.inv.valuableCount>=1, act:'follow_close', say:'大事な物を、持っています。……渡すのは、安全になってから', note:'PvP気配がある時は貴重品の受け渡しを止める'},
{id:'social_pvp_owner_low', p:259, when:c=>c.x?.pvpRisk===true&&c.owner.hpPct<=0.4&&(c.x?.othersNear??0)>=1, act:'follow_close', say:'あなたの体力と、この空気。……両方、よくないです', note:'PvP気配＋主人低体力は最優先で寄る'},
{id:'social_pvp_no_greet', p:250, when:c=>c.x?.pvpRisk===true&&(c.x?.otherDist??999)<=6&&c.danger.count===0, act:'say_only', say:'……挨拶は、省略します。今は、目を離せません', note:'PvP気配がある接近では挨拶より警戒を優先'},
{id:'social_pvp_calm_far', p:243, when:c=>c.x?.pvpRisk===true&&(c.x?.otherDist??999)>=20&&c.self.distOwner>=8, act:'follow', say:'遠くに、気配だけ。……通常に戻ります', note:'PvP気配が遠ければ通常の追従に戻る'},

// ===== 他者がいる場での受け渡し・回収の作法 =====
{id:'social_deliver_trusted_near', p:247, when:c=>(c.x?.othersNear??0)>=1&&(c.x?.otherDist??999)>=12&&!(c.x?.pvpRisk)&&c.inv.used>0&&c.self.distOwner<=4&&c.flags.justDelivered===false, act:'deliver_all', say:'失礼します。あなたに、回収物を渡します', note:'他者が遠くでPvP気配もなければ、通常どおり渡す'},
{id:'social_deliver_food_in_crowd', p:245, when:c=>(c.x?.othersNear??0)>=1&&c.inv.hasFood&&c.owner.hunger<=6&&c.x?.ownerChatting!==true, act:'deliver_all', say:'人前ですが。……あなたの空腹は、待てません', note:'他者がいても主人の空腹が深刻なら食料を届ける'},
{id:'social_pickup_manners_near_other', p:244, when:c=>(c.x?.othersNear??0)>=1&&(c.x?.otherDist??999)<=5&&c.drops.count>0&&c.drops.valuableDist<0, act:'say_only', say:'落ちた物があります。……持ち主は、あなたですか', note:'他者の近くに落ちた一般品は、勝手に拾わず主人に確認する'},
{id:'social_pickup_valuable_even_crowd', p:248, when:c=>c.drops.valuableDist>=0&&c.drops.valuableDist<=6&&(c.x?.othersNear??0)>=1&&!(c.x?.pvpRisk), act:'say_only', say:'貴重品を検出。……回収は、私の仕事です', note:'貴重品は人がいても回収優先（実行は運搬層に委ね、ここでは宣言のみ）'},

// ===== 主人がいない／帰還・死亡時の他者対応 =====
{id:'social_owner_absent_others', p:246, when:c=>!c.owner.present&&(c.x?.othersNear??0)>=1, act:'idle_hover', say:'私は、あなたを待っています。……他の方の助手では、ありません', note:'主不在時に他者がいても付いていかない'},
{id:'social_owner_dead_others_near_home', p:252, when:c=>c.owner.dead&&(c.x?.othersNear??0)>=1&&c.home.registered, act:'stay_anchor', say:'……帰る場所で、待ちます。あなたは、必ず戻ります', note:'主人死亡時は他者がいても拠点で待ち続ける'},
{id:'social_owner_back_greet_witness', p:245, when:c=>c.owner.present&&c.flags.justDelivered===false&&(c.x?.othersNear??0)>=1&&c.self.distOwner<=3&&c.danger.count===0&&c.owner.idleSec<10, act:'say_only', say:'おかえりなさい。……皆さんの前でも、言います', note:'主人の帰還時は他者の前でも「おかえりなさい」を省略しない'},

// ===== 自分（リゼ）側の状態 × 他者 =====
{id:'social_self_low_hp_excuse', p:251, when:c=>c.self.hpPct<=0.3&&(c.x?.othersNear??0)>=1, act:'follow_close', say:'私の損傷は、後回しで。……いえ、本当は少しだけ、休みたいです', note:'他者の前でも損傷が深ければ主人に寄って申告する'},
{id:'social_self_full_excuse_crowd', p:243, when:c=>c.inv.full&&(c.x?.othersNear??0)>=2&&c.home.registered, act:'say_only', say:'荷物がいっぱいです。……入庫の間、少し離れます', note:'混雑時に満載で離れる理由を先に言っておく'},
{id:'social_self_stuck_apology', p:247, when:c=>c.self.stuck&&c.self.stuckSec>=5&&(c.x?.othersNear??0)>=1, act:'say_only', say:'……引っかかっています。見ないでください', note:'他者の前で引っかかると少し恥ずかしい'},
{id:'social_work_mode_others_intro', p:242, when:c=>c.mode==='work'&&(c.x?.othersNear??0)>=1&&(c.x?.otherDist??999)<=8, act:'say_only', say:'作業中です。……あなたの拠点の、回収をしています', note:'作業モードで他者が来たら担当業務を説明する'},
{id:'social_stay_mode_others_watch', p:241, when:c=>c.mode==='stay'&&(c.x?.othersNear??0)>=1&&(c.x?.otherDist??999)<=4, act:'idle_hover', say:'定位置で待機中です。……通りますか。どうぞ', note:'待機中に他者が通る時は道を意識して譲る'},
{id:'social_thunder_crowd_calm', p:240, when:c=>c.env.isThundering&&(c.x?.othersNear??0)>=2, act:'say_only', say:'雷です。……私は、平気な顔をしています', note:'雷雨の混雑では平静を装う（少し強がる）'},
{id:'social_danger_others_warn', p:257, when:c=>c.danger.safetyCount>=1&&(c.x?.othersNear??0)>=1&&(c.x?.otherDist??999)<=10&&c.flags.warnOk, act:'say_only', say:'皆さん、敵性反応です。……あなたは、私の後ろへ', note:'敵出現時は他者にも聞こえるよう警告し主人を守る位置に'},
{id:'social_danger_owner_targeted_crowd', p:258, when:c=>c.danger.visualOwnerTargeted&&(c.x?.othersNear??0)>=1, act:'follow_close', say:'あなたが狙われています。……人混みでも、関係ありません', note:'主人が狙われたら混雑を理由に遅れない'},
{id:'social_underground_others_whisper', p:240, when:c=>c.owner.underground&&(c.x?.othersNear??0)>=1&&(c.x?.otherDist??999)<=8, act:'follow', say:'地下では、小声で。……あなたの隣、空いていますか', note:'地下で他者と一緒の時は小声で距離を確認する'},
{id:'social_dimension_split_others', p:244, when:c=>!c.owner.dimensionSame&&(c.x?.othersNear??0)>=1, act:'say_only', say:'あなたは、向こう側です。……こちらの方とは、距離を取ります', note:'主人と別ディメンションの時は他者に付いていかない'},
{id:'social_two_others_polite_follow', p:246, when:c=>(c.x?.othersNear??0)===2&&c.mode==='follow'&&c.self.distOwner<=3&&c.x?.ownerChatting!==true, act:'follow', say:'お二人とも、こんにちは。……私は、少し後ろから', note:'他者2名の小集団では挨拶して後方に付く'},
{id:'social_other_very_close_step', p:252, when:c=>(c.x?.otherDist??999)<=2&&(c.x?.othersNear??0)>=1&&c.danger.count===0&&c.x?.pvpRisk!==true, act:'idle_hover', say:'……近いです。半歩、下がります', note:'他者が至近距離に来たら自分から半歩引く'},
{id:'social_chat_owner_hungry_deliver_later', p:248, when:c=>c.x?.ownerChatting===true&&c.owner.hunger<=4&&c.inv.hasFood, act:'say_only', say:'食料は、用意してあります。……お話が終わったら、すぐに', note:'会話中の主人に空腹でも割り込まず、終わり次第渡せるよう申告だけする'},
{id:'social_morning_shift_change_crowd', p:243, when:c=>c.env.isDawn&&(c.x?.othersNear??0)>=1&&c.owner.idleSec>=180, act:'say_only', say:'夜勤、終わりました。……皆さんも、お疲れさまです', note:'夜勤助手らしく、夜明けの集まりでは労いの言葉を出す'},
{id:'social_evening_crowd_coffee_hint', p:241, when:c=>c.env.isDusk&&(c.x?.othersNear??0)>=1&&c.self.distOwner<=5, act:'say_only', say:'夕方です。……コーヒーは、あなたの分だけ淹れます', note:'夕方の人前でもコーヒーは主人専用だとさりげなく主張する'},
];
