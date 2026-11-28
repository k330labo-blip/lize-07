// 主人のケア（気が利く世話焼き）ルール群  優先度帯: 700〜899
// when は文脈 c のみ参照する純粋関数。act は許可キーのみ使用。
export const RULES = [
  // ===== 食料デリバリー: 空腹×食料在庫×体力の複合 =====
  { id:'care_food_critical_hp_low', p:895, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.hunger<=4 && c.inv.hasFood && c.owner.hpPct<0.4, act:'deliver_food', say:'ごはん！今すぐ食べて！', note:'空腹4以下＋食料あり＋HP4割未満、最優先で食料を届ける' },
  { id:'care_food_critical_sprinting', p:890, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.hunger<=4 && c.inv.hasFood && c.owner.sprinting, act:'deliver_food', say:'走りながらでも食べて！', note:'空腹4以下＋ダッシュ中（空腹が減りやすい）＋食料ありで即配達' },
  { id:'care_food_critical_danger', p:888, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.hunger<=4 && c.inv.hasFood && c.danger.safetyCount>0, act:'deliver_food', say:'戦う前にまず食べて！', note:'空腹4以下＋敵接近中＋食料あり、戦闘前の回復を促す配達' },
  { id:'care_food_starving_far', p:885, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.hunger<=2 && c.inv.hasFood && c.self.distOwner>8, act:'deliver_food', say:'お腹ペコペコでしょ、持ってくね！', note:'空腹2以下＋食料あり＋距離8超、向こうから届けに行く' },
  { id:'care_food_starving_near', p:882, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.hunger<=2 && c.inv.hasFood && c.self.distOwner<=8, act:'deliver_food', say:'はい、ごはん！', note:'空腹2以下＋食料あり＋近くにいる、すぐ手渡す' },
  { id:'care_food_hungry_night', p:878, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.hunger<=6 && c.inv.hasFood && c.env.isNight, act:'deliver_food', say:'夜は危ないから食べておいて', note:'空腹6以下＋食料あり＋夜、夜間行動前の備えとして届ける' },
  { id:'care_food_hungry_underground', p:876, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.hunger<=6 && c.inv.hasFood && c.owner.underground, act:'deliver_food', say:'洞窟でもごはんは大事だよ', note:'空腹6以下＋食料あり＋地下、補給が遠い環境を優先' },
  { id:'care_food_hungry_plenty_stock', p:872, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.hunger<=8 && c.inv.foodCount>=5, act:'deliver_food', say:'食料たっぷりあるから遠慮なく！', note:'空腹8以下＋食料5個以上と潤沢、在庫に余裕がある時だけ早めに配る' },
  { id:'care_food_hungry_scarce_stock', p:868, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.hunger<=5 && c.inv.hasFood && c.inv.foodCount<=2, act:'deliver_food', say:'最後のごはん、大事に食べて', note:'空腹5以下＋食料が残り2個以下、本当に必要な時だけ貴重な在庫を渡す' },
  { id:'care_food_before_work', p:864, when:c=>!c.flags.justDelivered && c.owner.present && c.mode==='work' && c.owner.hunger<=10 && c.inv.hasFood && c.inv.foodCount>=3, act:'deliver_food', say:'作業前に腹ごしらえしよ', note:'作業モード＋空腹10以下＋食料3個以上、作業開始前の配給' },
  { id:'care_food_after_danger', p:862, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.hunger<=8 && c.inv.hasFood && c.danger.count===0 && c.owner.hpPct<0.7, act:'deliver_food', say:'危なかったね、まず回復しよ', note:'敵なし＋空腹8以下＋HP7割未満＋食料あり、戦闘後の回復配達' },
  { id:'care_food_swim', p:858, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.hunger<=6 && c.inv.hasFood && c.owner.inWater, act:'deliver_food', say:'泳いでるとお腹減るよね', note:'空腹6以下＋水中＋食料あり、水中活動中の配達' },
  { id:'care_food_warn_no_stock_critical', p:855, when:c=>c.owner.present && c.owner.hunger<=4 && !c.inv.hasFood && c.flags.warnOk, act:'warn_owner_low', say:'ごはん切らしちゃった…近くで探そう', note:'空腹4以下なのに食料なし＋警告可、在庫切れを知らせる' },
  { id:'care_food_warn_no_stock_hungry', p:850, when:c=>c.owner.present && c.owner.hunger<=7 && !c.inv.hasFood && c.drops.foodDist<12 && c.flags.warnOk, act:'say_only', say:'近くに食べ物落ちてるよ', note:'空腹7以下＋食料なし＋近くに食料ドロップあり、拾いに行くよう伝える' },
  { id:'care_food_go_get_drops', p:848, when:c=>c.owner.present && c.owner.dimensionSame && c.owner.hunger<=6 && !c.inv.hasFood && c.drops.foodDist<8, act:'go_owner', say:'食べ物取ってくるね', note:'空腹6以下＋食料なし＋食料ドロップ8以内、取りに行く布石として主人側へ寄る' },
  { id:'care_food_hp_full_but_starving', p:845, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.hunger<=3 && c.inv.hasFood && c.owner.hpPct>=0.9, act:'deliver_food', say:'体力あってもお腹は別だよ', note:'HPは高いが空腹3以下＋食料あり、油断しがちな状況への配達' },
  { id:'care_food_dusk_prep', p:842, when:c=>!c.flags.justDelivered && c.owner.present && c.env.isDusk && c.owner.hunger<=12 && c.inv.hasFood && c.inv.foodCount>=4, act:'deliver_food', say:'夜になる前に食べておこ', note:'夕方＋空腹12以下＋食料4個以上、夜への備えの先回り配達' },
  { id:'care_food_dawn_after_night', p:840, when:c=>!c.flags.justDelivered && c.owner.present && c.env.isDawn && c.owner.hunger<=8 && c.inv.hasFood, act:'deliver_food', say:'一晩おつかれさま、朝ごはん！', note:'夜明け＋空腹8以下＋食料あり、夜を越えた労い配達' },

  // ===== HP低下: 寄る・警告する =====
  { id:'care_hp_critical_targeted', p:898, when:c=>c.owner.present && c.owner.hpPct<0.25 && c.danger.visualOwnerTargeted, act:'warn_owner_low', say:'狙われてる！逃げて！', note:'HP25%未満＋敵に狙われている、最優先の警告' },
  { id:'care_hp_critical_far', p:894, when:c=>c.owner.present && c.owner.hpPct<0.25 && c.self.distOwner>10, act:'go_owner', say:'今行くから待ってて！', note:'HP25%未満＋距離10超、急いで駆けつける' },
  { id:'care_hp_critical_near', p:892, when:c=>c.owner.present && c.owner.hpPct<0.25 && c.self.distOwner<=10 && c.flags.warnOk, act:'warn_owner_low', say:'体力やばいよ、無理しないで', note:'HP25%未満＋近く＋警告可、そばで警告する' },
  { id:'care_hp_low_with_food', p:886, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.hpPct<0.4 && c.owner.hunger>6 && c.inv.hasFood, act:'deliver_food', say:'食べれば回復できるよ！', note:'HP4割未満＋空腹に余裕なし寄り＋食料あり、食べて回復できる状況の配達' },
  { id:'care_hp_low_hunger_full', p:880, when:c=>c.owner.present && c.owner.hpPct<0.4 && c.owner.hunger>=18 && c.flags.warnOk, act:'warn_owner_low', say:'回復待ちだね、そばにいるよ', note:'HP4割未満だが満腹に近い、回復中と判断して見守り警告に留める' },
  { id:'care_hp_low_many_enemies', p:884, when:c=>c.owner.present && c.owner.dimensionSame && c.owner.hpPct<0.5 && c.danger.safetyCount>=3, act:'go_owner', say:'敵多いよ、合流しよう', note:'HP5割未満＋敵3体以上、孤立を避けるため寄る' },
  { id:'care_hp_half_night', p:866, when:c=>c.owner.present && c.owner.hpPct<0.5 && c.env.isNight && c.self.distOwner>6, act:'follow_close', say:'夜だし近くにいるね', note:'HP5割未満＋夜＋距離6超、夜間は密着フォローに切り替える' },
  { id:'care_hp_half_underground', p:860, when:c=>c.owner.present && c.owner.hpPct<0.5 && c.owner.underground, act:'follow_close', say:'洞窟は危ないから離れないよ', note:'HP5割未満＋地下、危険環境での密着' },
  { id:'care_hp_hurt_creeper', p:874, when:c=>c.owner.present && c.owner.hpPct<0.6 && c.danger.safetyCreeperDist<10 && c.flags.warnOk, act:'warn_owner_low', say:'後ろ、クリーパー！', note:'HP6割未満＋クリーパー10以内＋警告可、爆発への警告' },
  { id:'care_hp_hurt_ranged', p:870, when:c=>c.owner.present && c.owner.hpPct<0.6 && c.danger.safetyRangedDist<16 && c.flags.warnOk, act:'warn_owner_low', say:'狙撃に気をつけて！', note:'HP6割未満＋遠距離敵16以内、射撃への警告' },
  { id:'care_hp_slightly_hurt_idle', p:820, when:c=>c.owner.present && c.owner.hpPct<0.8 && c.owner.hpPct>=0.5 && c.owner.idleSec>20 && c.danger.count===0, act:'say_only', say:'傷、回復するまで休も？', note:'HP5〜8割＋20秒アイドル＋敵なし、休憩を勧める声かけ' },
  { id:'care_hp_recovered_celebrate', p:815, when:c=>c.owner.present && c.owner.hpPct>=0.95 && c.owner.hunger>=14 && c.danger.count===0 && c.flags.justDelivered, act:'celebrate', say:'完全回復！よかったー', note:'配達直後＋HP95%以上＋満腹寄り＋敵なし、回復完了を祝う' },
  { id:'care_hp_low_self_also_low', p:856, when:c=>c.owner.present && c.owner.dimensionSame && c.owner.hpPct<0.4 && c.self.hpPct<0.4, act:'go_owner', say:'二人ともボロボロだ…合流しよ', note:'主人も自分もHP4割未満、合流して固まる判断' },
  { id:'care_hp_low_mode_stay_break', p:830, when:c=>c.mode==='stay' && c.owner.present && c.owner.hpPct<0.5 && c.self.distOwner>5, act:'go_owner', say:'待機よりそっち行くね', note:'待機モードでもHP5割未満なら待機を破って寄る例外分岐' },

  // ===== 溺れ・炎上・落下圏などの異常状態 =====
  { id:'care_owner_on_fire_critical', p:896, when:c=>c.owner.present && c.owner.onFire && c.owner.hpPct<0.5, act:'warn_owner_low', say:'燃えてる！水、水！', note:'炎上＋HP5割未満、緊急警告' },
  { id:'care_owner_on_fire_water_near_hint', p:888, when:c=>c.owner.present && c.owner.onFire && !c.owner.inWater, act:'warn_owner_low', say:'早く水に入って！', note:'炎上＋水中でない、水へ誘導する警告' },
  { id:'care_owner_on_fire_go', p:872, when:c=>c.owner.present && c.owner.onFire && c.self.distOwner>6, act:'go_owner', say:'火！今行く！', note:'炎上＋距離6超、駆けつける' },
  { id:'care_owner_in_water_long_low_hp', p:868, when:c=>c.owner.present && c.owner.dimensionSame && c.owner.inWater && c.owner.hpPct<0.6 && c.danger.count===0, act:'go_owner', say:'溺れてない？大丈夫？', note:'水中＋HP6割未満＋敵なし（戦闘でないのにHP減＝溺れ疑い）で様子を見に行く' },
  { id:'care_owner_in_water_night', p:838, when:c=>c.owner.present && c.owner.inWater && c.env.isNight && c.self.distOwner>10, act:'follow_close', say:'夜の海は危ないよ', note:'水中＋夜＋距離10超、水中夜間の密着' },
  { id:'care_owner_in_water_hungry', p:852, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.inWater && c.owner.hunger<=5 && c.inv.hasFood && !c.owner.onFire, act:'deliver_food', say:'陸に上がったら食べてね', note:'水中＋空腹5以下＋食料あり＋炎上でない、水中配達の分岐' },
  { id:'care_lava_near_owner_low', p:890, when:c=>c.owner.present && c.danger.ownerLavaNear && c.owner.hpPct<0.5 && c.flags.warnOk, act:'warn_owner_low', say:'溶岩近いよ、落ちないで！', note:'溶岩接近＋HP5割未満＋警告可、落下事故への警告' },
  { id:'care_lava_near_underground', p:866, when:c=>c.owner.present && c.danger.ownerLavaNear && c.owner.underground && c.flags.warnOk, act:'warn_owner_low', say:'足元、溶岩だよ', note:'溶岩接近＋地下＋警告可、洞窟溶岩への注意' },
  { id:'care_lava_near_go', p:858, when:c=>c.owner.present && c.danger.lavaNear && c.self.distOwner>12, act:'go_owner', say:'危ない場所だね、合流する', note:'溶岩接近＋距離12超、危険地帯では合流優先' },
  { id:'care_thunder_owner_outside', p:844, when:c=>c.owner.present && c.env.isThundering && !c.owner.underground && c.self.distOwner>8, act:'follow_close', say:'雷すごい…近くにいるね', note:'雷雨＋屋外＋距離8超、雷雨時の密着' },

  // ===== 死亡・リスポーン・落とし物の布石 =====
  { id:'care_owner_dead_drops_near', p:899, when:c=>c.owner.dead && c.drops.ownerDroppedDist<16, act:'say_only', say:'落とし物、見張ってるからね', note:'主人死亡＋落とし物16以内、その場で見張る宣言（回収布石）' },
  { id:'care_owner_dead_drops_far_home', p:894, when:c=>c.owner.dead && c.drops.ownerDroppedDist>=16 && c.home.registered, act:'say_only', say:'拠点で待ってるね、落とし物はあっちだよ', note:'主人死亡＋落とし物が遠い＋拠点登録あり、拠点待機の布石' },
  { id:'care_owner_dead_enemies_near_drops', p:897, when:c=>c.owner.dead && c.drops.ownerDroppedDist<12 && c.danger.safetyCount>0, act:'warn_owner_low', say:'落とし物の近くに敵がいるよ…', note:'主人死亡＋落とし物12以内＋敵あり、危険を知らせる' },
  { id:'care_owner_dead_night', p:886, when:c=>c.owner.dead && c.env.isNight, act:'say_only', say:'夜だけど待ってるから、気をつけて来てね', note:'主人死亡＋夜、夜間リスポーンへの声かけ' },
  { id:'care_owner_respawn_greet', p:836, when:c=>c.owner.present && !c.owner.dead && c.owner.hpPct>=0.99 && c.owner.hunger>=18 && c.self.distOwner<6 && c.drops.ownerDroppedDist>=0 && c.drops.ownerDroppedDist<24, act:'greet', say:'おかえり！落とし物取りに行こ', note:'復帰直後らしき全快状態＋落とし物24以内、回収への同行挨拶' },
  { id:'care_owner_respawn_deliver_all', p:878, when:c=>!c.flags.justDelivered && c.owner.present && !c.owner.dead && c.drops.ownerDroppedDist>=0 && c.drops.ownerDroppedDist<10 && c.inv.used>0 && c.owner.hpPct<0.8, act:'deliver_all', say:'預かってた分、返すね', note:'落とし物10以内＋自分が預かり中＋主人HP8割未満、預かり品を返す' },
  { id:'care_owner_respawn_food_first', p:874, when:c=>!c.flags.justDelivered && c.owner.present && !c.owner.dead && c.owner.hunger<=8 && c.inv.hasFood && c.drops.ownerDroppedDist>=0 && c.drops.ownerDroppedDist<20, act:'deliver_food', say:'まず食べて、それから回収ね', note:'復帰後＋空腹8以下＋食料あり＋落とし物あり、回収より先に食料' },
  { id:'care_owner_absent_dimension', p:828, when:c=>!c.owner.dimensionSame && c.owner.present && c.home.registered, act:'say_only', say:'別の世界に行っちゃった…拠点で待つね', note:'主人が別ディメンション＋拠点あり、待機の意思表示' },

  // ===== 長時間アイドルへの声かけ =====
  { id:'care_idle_long_night', p:812, when:c=>c.owner.present && c.owner.idleSec>120 && c.env.isNight && c.danger.count===0, act:'say_only', say:'ねむくない？無理しないでね', note:'120秒アイドル＋夜＋敵なし、体調を気遣う声かけ' },
  { id:'care_idle_long_day', p:808, when:c=>c.owner.present && c.owner.idleSec>180 && !c.env.isNight && c.danger.count===0, act:'say_only', say:'休憩中？私も待ってるね', note:'180秒アイドル＋昼＋敵なし、穏やかな声かけ' },
  { id:'care_idle_long_danger_near', p:854, when:c=>c.owner.present && c.owner.idleSec>60 && c.danger.safetyCount>0 && c.flags.warnOk, act:'warn_owner_low', say:'敵来てるよ、動いて！', note:'60秒アイドル＋敵接近＋警告可、放置中の危険警告' },
  { id:'care_idle_long_hungry', p:826, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.idleSec>90 && c.owner.hunger<=8 && c.inv.hasFood, act:'deliver_food', say:'休んでる間にごはんどうぞ', note:'90秒アイドル＋空腹8以下＋食料あり、休憩ついでの配達' },
  { id:'care_idle_long_underground', p:818, when:c=>c.owner.present && c.owner.idleSec>120 && c.owner.underground && c.danger.count===0, act:'say_only', say:'洞窟で休憩中？見張ってるね', note:'120秒アイドル＋地下＋敵なし、見張りを伝える' },
  { id:'care_idle_medium_sneak', p:806, when:c=>c.owner.present && c.owner.idleSec>45 && c.owner.sneaking && c.danger.count===0, act:'say_only', say:'じっとしてるね、何か狙ってる？', note:'45秒アイドル＋しゃがみ＋敵なし、静かな確認' },
  { id:'care_idle_long_rain', p:810, when:c=>c.owner.present && c.owner.idleSec>90 && c.env.isRaining && !c.owner.underground, act:'say_only', say:'雨の中大丈夫？風邪ひかないでね', note:'90秒アイドル＋雨＋屋外、雨を気遣う声かけ' },

  // ===== しゃがみ（合図）への反応 =====
  { id:'care_sneak_signal_near', p:834, when:c=>c.owner.present && c.owner.sneaking && c.self.distOwner<5 && c.danger.count===0, act:'say_only', say:'合図だね、静かにするね', note:'しゃがみ＋距離5未満＋敵なし、合図と受け取り静粛にする' },
  { id:'care_sneak_signal_far', p:832, when:c=>c.owner.present && c.owner.sneaking && c.self.distOwner>=12, act:'go_owner', say:'呼んだ？今行くね', note:'しゃがみ＋距離12以上、呼び寄せの合図と解釈して寄る' },
  { id:'care_sneak_with_danger', p:846, when:c=>c.owner.present && c.owner.sneaking && c.danger.safetyCount>0 && c.danger.safetyNearestDist<10, act:'follow_close', say:'静かに…敵が近いよ', note:'しゃがみ＋敵10以内、隠密に合わせて密着する' },
  { id:'care_sneak_underground_no_enemy', p:824, when:c=>c.owner.present && c.owner.sneaking && c.owner.underground && c.danger.count===0, act:'follow_close', say:'そーっと行こうね', note:'しゃがみ＋地下＋敵なし、洞窟での慎重な追随' },
  { id:'care_sneak_hungry_owner', p:838, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.sneaking && c.owner.hunger<=5 && c.inv.hasFood, act:'deliver_food', say:'静かにごはん置いとくね', note:'しゃがみ＋空腹5以下＋食料あり、合図中でも食料だけ届ける' },
  { id:'care_sneak_mode_work_pause', p:816, when:c=>c.mode==='work' && c.owner.present && c.owner.sneaking && c.self.distOwner<8, act:'say_only', say:'作業止めるね、合図ありがとう', note:'作業モード＋しゃがみ＋近く、作業中断の合図として受ける' },
  { id:'care_sneak_repeated_greet', p:802, when:c=>c.owner.present && c.owner.sneaking && c.owner.idleSec>10 && c.owner.idleSec<30 && c.self.distOwner<4, act:'greet', say:'なになに？', note:'しゃがみ＋短時間アイドル＋至近距離、話しかけられたと解釈して返す' },

  // ===== ダッシュ・移動への追随ケア =====
  { id:'care_sprint_far_catchup', p:848, when:c=>c.owner.present && c.owner.sprinting && c.self.distOwner>16, act:'follow_close', say:'速い速い、待ってー！', note:'ダッシュ＋距離16超、置いていかれないよう密着追随' },
  { id:'care_sprint_hunger_drain', p:852, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.sprinting && c.owner.hunger<=8 && c.inv.hasFood, act:'deliver_food', say:'走るとお腹減るよ、先に食べて', note:'ダッシュ＋空腹8以下＋食料あり、空腹消耗を見越した配達' },
  { id:'care_sprint_night', p:840, when:c=>c.owner.present && c.owner.sprinting && c.env.isNight && c.self.distOwner>8, act:'follow_close', say:'夜のダッシュは危ないよー', note:'ダッシュ＋夜＋距離8超、夜間移動の密着' },
  { id:'care_sprint_low_hp_warn', p:862, when:c=>c.owner.present && c.owner.sprinting && c.owner.hpPct<0.4 && c.flags.warnOk, act:'warn_owner_low', say:'その体力で走っちゃだめ！', note:'ダッシュ＋HP4割未満＋警告可、無理な移動への警告' },
  { id:'care_sprint_to_home', p:822, when:c=>c.owner.present && c.owner.sprinting && c.home.registered && c.home.dist<20 && c.env.isNight, act:'say_only', say:'もうすぐ拠点だね、がんばれ', note:'ダッシュ＋拠点20以内＋夜、帰宅目前の応援' },
  { id:'care_owner_moving_work_follow', p:804, when:c=>c.mode==='work' && c.owner.present && !c.owner.sprinting && c.owner.idleSec<3 && c.self.distOwner>14, act:'follow', say:'移動するならついてくね', note:'作業モードでも主人が移動を始めたら通常追随に寄せる' },

  // ===== 貴重品・武器・松明の受け渡しケア =====
  { id:'care_valuable_deliver_before_deposit', p:844, when:c=>c.owner.present && c.inv.hasValuable && c.inv.valuableCount>=3 && c.self.distOwner<8 && !c.flags.justDelivered, act:'deliver_valuable', say:'大事なもの集まったよ、受け取って', note:'貴重品3個以上＋近く＋配達直後でない、主人へ直接返す' },
  { id:'care_valuable_deliver_danger_zone', p:856, when:c=>!c.flags.justDelivered && c.owner.present && c.inv.hasValuable && c.danger.safetyCount>0 && c.self.distOwner<10, act:'deliver_valuable', say:'貴重品は先に渡しとくね', note:'貴重品あり＋敵接近＋近く、自分が落ちる前に渡す保険分岐' },
  { id:'care_weapon_handover_enemy', p:850, when:c=>!c.flags.justDelivered && c.owner.present && c.inv.hasWeapon && c.danger.visualOwnerTargeted && c.self.distOwner<8, act:'deliver_all', say:'武器、いるでしょ！', note:'武器を所持＋主人が狙われている＋近く、戦闘支援として渡す' },
  { id:'care_torch_handover_night_cave', p:836, when:c=>!c.flags.justDelivered && c.owner.present && c.inv.hasTorch && c.env.isNight && c.owner.underground && c.self.distOwner<8, act:'deliver_all', say:'暗いから松明どうぞ', note:'松明あり＋夜＋地下＋近く、明かりの受け渡し' },
  { id:'care_torch_handover_dusk', p:818, when:c=>!c.flags.justDelivered && c.owner.present && c.inv.hasTorch && c.env.isDusk && c.owner.underground, act:'deliver_all', say:'暗くなる前に松明ね', note:'松明あり＋夕方＋地下、先回りの明かり渡し' },
  { id:'care_deliver_all_full_inv_owner_near', p:842, when:c=>!c.flags.justDelivered && c.owner.present && c.inv.full && c.self.distOwner<6 && c.mode!=='work', act:'deliver_all', say:'いっぱい集めたよ、全部どうぞ', note:'満載＋近く＋作業モードでない、全量手渡し' },
  { id:'care_deliver_all_near_full_and_hungry', p:858, when:c=>!c.flags.justDelivered && c.owner.present && c.inv.nearFull && c.owner.hunger<=6 && c.inv.hasFood && c.self.distOwner<8, act:'deliver_food', say:'荷物ついでにごはんもね', note:'ほぼ満載＋空腹6以下＋食料あり＋近く、全渡しより食料を先に渡す分岐' },

  // ===== 天候・時間帯の気遣い =====
  { id:'care_rain_owner_low_hp', p:846, when:c=>c.owner.present && c.env.isRaining && c.owner.hpPct<0.5 && !c.owner.underground, act:'follow_close', say:'雨だし体力も低いし、近くにいるね', note:'雨＋HP5割未満＋屋外、悪条件の重なりで密着' },
  { id:'care_dawn_greet_safe', p:800, when:c=>c.owner.present && c.env.isDawn && c.danger.count===0 && c.self.distOwner<8, act:'greet', say:'おはよう！今日もがんばろ', note:'夜明け＋敵なし＋近く、朝の挨拶' },
  { id:'care_dusk_warn_night_coming', p:828, when:c=>c.owner.present && c.env.isDusk && c.owner.hpPct<0.7 && c.flags.warnOk, act:'warn_owner_low', say:'夜が来るよ、体力気をつけて', note:'夕方＋HP7割未満＋警告可、夜への警告' },
  { id:'care_night_owner_far_from_home', p:834, when:c=>c.owner.present && c.env.isNight && c.home.registered && c.home.dist>40 && c.self.distOwner>8, act:'follow_close', say:'家から遠いね、離れないよ', note:'夜＋拠点40超＋距離8超、遠方夜間の密着' },
  { id:'care_night_first_greet', p:802, when:c=>c.owner.present && c.env.isNight && c.danger.count===0 && c.owner.idleSec>5 && c.self.distOwner<6, act:'greet', say:'こんばんは、見張りは任せて', note:'夜＋敵なし＋少しアイドル＋近く、夜の挨拶と見張り宣言' },

  // ===== 自分側の状態と絡めたケア =====
  { id:'care_self_low_but_owner_critical', p:864, when:c=>!c.flags.justDelivered && c.owner.present && c.self.hpPct<0.3 && c.owner.hpPct<0.3 && c.inv.hasFood, act:'deliver_food', say:'私はいいから、まず食べて！', note:'自分も主人もHP3割未満＋食料あり、自分より主人を優先する献身分岐' },
  { id:'care_self_stuck_owner_hungry', p:826, when:c=>c.self.stuck && c.self.stuckSec>5 && c.owner.present && c.owner.hunger<=5 && c.inv.hasFood, act:'say_only', say:'ちょっとハマっちゃった、ごはんは少し待って', note:'自分が5秒以上スタック＋主人空腹＋食料あり、配達遅延を正直に伝える' },
  { id:'care_self_stuck_owner_danger', p:852, when:c=>c.self.stuck && c.owner.present && c.danger.visualOwnerTargeted && c.flags.warnOk, act:'warn_owner_low', say:'ごめん、今行けない！逃げて！', note:'自分がスタック中＋主人被ターゲット、行けない状況で警告だけは出す' },
  { id:'care_just_deposited_greet', p:801, when:c=>c.flags.justDeposited && c.owner.present && c.self.distOwner<8 && c.danger.count===0, act:'greet', say:'荷物しまってきたよ！', note:'入庫直後＋近く＋敵なし、仕事完了の報告挨拶' },
  { id:'care_just_delivered_follow', p:803, when:c=>c.flags.justDelivered && c.owner.present && c.self.distOwner>10, act:'follow', say:'渡したから戻るねー', note:'配達直後＋距離10超、通常追随へ戻る' },
  { id:'care_chest_full_worry', p:830, when:c=>c.home.registered && c.home.chestFull && c.inv.nearFull && c.owner.present && c.flags.warnOk, act:'warn_owner_low', say:'チェストも私もパンパンだよ…', note:'拠点チェスト満杯＋自分もほぼ満載、保管先不足を知らせる' },
  { id:'care_chest_missing_worry', p:838, when:c=>c.home.registered && c.home.chestMissing && c.inv.used>0 && c.owner.present && c.flags.warnOk, act:'warn_owner_low', say:'拠点のチェスト、なくなってる…？', note:'拠点チェスト消失＋荷物あり、異常を知らせる' },

  // ===== ささやかな日常ケア（低優先の最終層） =====
  { id:'care_owner_full_and_safe_celebrate', p:805, when:c=>c.owner.present && c.owner.hpPct>=0.99 && c.owner.hunger>=19 && c.danger.count===0 && c.self.distOwner<5, act:'celebrate', say:null, note:'HP満タン＋ほぼ満腹＋敵なし＋至近、好調を一緒に喜ぶ' },
  { id:'care_owner_sneak_and_sprint_mix', p:814, when:c=>!c.flags.justDelivered && c.owner.present && c.owner.sneaking && c.owner.hunger<=10 && c.inv.hasFood && c.danger.count===0, act:'deliver_food', say:'そーっとごはんね', note:'しゃがみ＋空腹10以下＋食料あり＋敵なし、静かな配達' },
  { id:'care_follow_default_close_when_hurt', p:807, when:c=>c.owner.present && c.owner.dimensionSame && c.owner.hpPct<0.7 && c.self.distOwner>7 && c.mode==='follow', act:'follow_close', say:'怪我してる時は近くにいるね', note:'追従モード＋HP7割未満＋距離7超、既定より寄せる' },
  { id:'care_follow_default_free_mode', p:800, when:c=>c.mode==='free' && c.owner.present && c.owner.hpPct<0.6 && c.self.distOwner>9, act:'follow', say:'様子見に寄るね', note:'自由モード＋HP6割未満＋距離9超、自由行動中でも様子見に寄る' },
];
