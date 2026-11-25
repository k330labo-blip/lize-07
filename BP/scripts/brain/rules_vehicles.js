// 乗り物・高速移動ルール（エリトラ飛行 / ボート / 馬 / 汎用乗り物 / 高速移動への追随と合流）
// 優先度帯: 460〜479
// 追加文脈 c.x は任意のため、必ず c.x?. で参照する（c.x 無しでも例外なし）。
//   c.x.ownerRiding: 乗り物に乗っている
//   c.x.ownerFlying: エリトラで飛行中
//   c.x.ownerInBoat: ボートに乗っている
//   c.x.ownerOnHorse: 馬に乗っている
//   c.x.fastMove: 高速移動中（乗り物・エリトラ・ダッシュ等で通常歩行より速い）
//   c.x.vehicleDist: 主人の乗り物までの距離（未検出時は undefined）
// セリフはリゼ口調: 一人称「私」、相手は「あなた」、短い敬語。皮肉も真顔で言う。
export const RULES = [
  // ===== エリトラ飛行：最優先で追いつく =====
  { id: 'ride_fly_catchup_very_far', p: 479, when: c => Boolean(c.x?.ownerFlying && c.owner.present && c.owner.dimensionSame && c.self.distOwner > 48), act: 'catchup', say: '速すぎます。……置いていかれる前に、合流します', note: 'エリトラ飛行で48超離れたら即合流' },
  { id: 'ride_fly_catchup_night_far', p: 478, when: c => Boolean(c.x?.ownerFlying && c.env.isNight && c.self.distOwner > 32 && c.owner.dimensionSame), act: 'catchup', say: '夜の空は見失いやすいので。合流します', note: '夜間エリトラは見失う前に早め合流' },
  { id: 'ride_fly_high_far', p: 477, when: c => Boolean(c.x?.ownerFlying && c.self.distOwner > 24 && c.owner.dimensionSame && !c.owner.dead), act: 'follow_high', say: '上空にいますね。私も高度を合わせます', note: 'エリトラ飛行中は高めホバリングで追随' },
  { id: 'ride_fly_high_rain', p: 476, when: c => Boolean(c.x?.ownerFlying && c.env.isRaining && c.self.distOwner > 12), act: 'follow_high', say: '雨の中を飛ぶのですね。……視界の端にいます', note: '雨＋エリトラは視界不良のため早めに詰める' },
  { id: 'ride_fly_high_thunder', p: 476, when: c => Boolean(c.x?.ownerFlying && c.env.isThundering && c.owner.present), act: 'follow_high', say: '雷雨の中の飛行ですか。……無事を祈る係も兼任します', note: '雷雨＋エリトラは高め追随で見守る' },
  { id: 'ride_fly_close_low_hp', p: 475, when: c => Boolean(c.x?.ownerFlying && c.owner.hpPct < 0.4 && c.self.distOwner > 10), act: 'follow_close', say: 'その体力で飛ぶのですか。近くにいます、落ちたらすぐ行きます', note: '低HPでエリトラ飛行なら落下に備えて密着' },
  { id: 'ride_fly_close_hungry', p: 470, when: c => Boolean(c.x?.ownerFlying && c.owner.hunger <= 6 && c.self.distOwner > 10), act: 'follow_close', say: null, note: '空腹で飛行中は着地直後のケアに備えて密着' },
  { id: 'ride_fly_follow_mid', p: 472, when: c => Boolean(c.x?.ownerFlying && c.self.distOwner > 14 && c.self.distOwner <= 24 && c.owner.dimensionSame), act: 'follow', say: null, note: 'エリトラ中距離は通常追従で速度を合わせる' },
  { id: 'ride_fly_say_start', p: 468, when: c => Boolean(c.x?.ownerFlying && c.self.distOwner <= 10 && c.flags.warnOk && c.owner.present), act: 'say_only', say: '離陸、確認しました。後ろは私が見ています', note: 'エリトラ離陸直後の一言' },
  { id: 'ride_fly_underground_say', p: 467, when: c => Boolean(c.x?.ownerFlying && c.owner.underground && c.flags.warnOk), act: 'say_only', say: '地下で飛ぶのですか。……天井のことは、私からは言いません', note: '地下エリトラへの真顔の皮肉' },
  { id: 'ride_fly_stuck_rise', p: 474, when: c => Boolean(c.x?.ownerFlying && c.self.stuck && c.self.stuckSec >= 3), act: 'follow_high', say: '引っかかりました。上に抜けてから追います', note: '飛行追随中に自分がハマったら高めに抜けて再追随' },
  { id: 'ride_fly_danger_near', p: 473, when: c => Boolean(c.x?.ownerFlying && c.danger.count >= 2 && c.self.distOwner > 8), act: 'follow_close', say: '敵影が複数です。着地点の近くにいます', note: '飛行中＋敵多数なら着地援護に備えて密着' },

  // ===== ボート：水上を並走する =====
  { id: 'ride_boat_catchup_far', p: 478, when: c => Boolean(c.x?.ownerInBoat && c.self.distOwner > 40 && c.owner.dimensionSame), act: 'catchup', say: '船足が速いですね。合流します', note: 'ボートで40超離れたら合流' },
  { id: 'ride_boat_high_far', p: 474, when: c => Boolean(c.x?.ownerInBoat && c.self.distOwner > 20 && c.owner.dimensionSame), act: 'follow_high', say: '水面の上からついていきます', note: 'ボート中距離は水面上空から追随' },
  { id: 'ride_boat_close_night', p: 471, when: c => Boolean(c.x?.ownerInBoat && c.env.isNight && c.self.distOwner > 8), act: 'follow_close', say: '夜の水上です。灯りの代わりに、近くにいます', note: '夜のボートは密着して見失わない' },
  { id: 'ride_boat_follow_rain', p: 469, when: c => Boolean(c.x?.ownerInBoat && c.env.isRaining && !c.env.isThundering && c.self.distOwner > 12), act: 'follow', say: null, note: '雨のボート移動は通常追従で並走' },
  { id: 'ride_boat_follow_thunder', p: 472, when: c => Boolean(c.x?.ownerInBoat && c.env.isThundering && c.self.distOwner > 10), act: 'follow_close', say: '雷と水上。……あまり良い組み合わせではありませんね', note: '雷雨のボートは密着見守り' },
  { id: 'ride_boat_say_start', p: 466, when: c => Boolean(c.x?.ownerInBoat && c.self.distOwner <= 8 && c.flags.warnOk && c.owner.present), act: 'say_only', say: '出航ですね。私は泳がなくて済むので助かります', note: 'ボート乗船直後の一言' },
  { id: 'ride_boat_owner_in_water_after', p: 470, when: c => Boolean(!c.x?.ownerInBoat && c.x?.ownerRiding === false && c.owner.inWater && c.self.distOwner > 8 && c.owner.present), act: 'follow_close', say: '降りたのですね。水の中でも、近くにいます', note: '乗り物を降りて水中にいる主人へ密着' },
  { id: 'ride_boat_drops_ignore_far', p: 464, when: c => Boolean(c.x?.ownerInBoat && c.drops.count > 0 && c.drops.nearestDist > 10 && c.mode === 'follow'), act: 'follow', say: null, note: 'ボート移動中は遠くのドロップに釣られず追従優先' },

  // ===== 馬：陸路を並走する =====
  { id: 'ride_horse_catchup_far', p: 478, when: c => Boolean(c.x?.ownerOnHorse && c.self.distOwner > 40 && c.owner.dimensionSame), act: 'catchup', say: '馬が速いのです。……私も本気を出します', note: '騎乗で40超離れたら合流' },
  { id: 'ride_horse_follow_far', p: 473, when: c => Boolean(c.x?.ownerOnHorse && c.self.distOwner > 18 && c.owner.dimensionSame && !c.env.isNight), act: 'follow', say: null, note: '騎乗中距離は通常追従で並走' },
  { id: 'ride_horse_close_night', p: 472, when: c => Boolean(c.x?.ownerOnHorse && c.env.isNight && c.self.distOwner > 8), act: 'follow_close', say: '夜道です。馬の少し後ろを、私が照らす気持ちでついていきます', note: '夜の騎乗は密着並走' },
  { id: 'ride_horse_close_danger', p: 474, when: c => Boolean(c.x?.ownerOnHorse && c.danger.count >= 1 && c.self.distOwner > 6), act: 'follow_close', say: '敵影です。馬を驚かせないよう、静かに寄ります', note: '騎乗中＋敵接近は密着警戒' },
  { id: 'ride_horse_say_start', p: 466, when: c => Boolean(c.x?.ownerOnHorse && c.self.distOwner <= 8 && c.flags.warnOk && c.owner.present), act: 'say_only', say: '騎乗、確認しました。並走します。……私には鞍がありませんので、空からです', note: '騎乗直後の一言' },
  { id: 'ride_horse_underground_say', p: 465, when: c => Boolean(c.x?.ownerOnHorse && c.owner.underground && c.flags.warnOk), act: 'say_only', say: '地下に馬ですか。……その判断、私は記録だけしておきます', note: '地下騎乗への真顔の皮肉' },
  { id: 'ride_horse_follow_rain', p: 468, when: c => Boolean(c.x?.ownerOnHorse && c.env.isRaining && c.self.distOwner > 12), act: 'follow', say: null, note: '雨の騎乗移動は通常追従' },

  // ===== 汎用乗り物：種類を問わない追随 =====
  { id: 'ride_any_catchup_extreme', p: 479, when: c => Boolean(c.x?.ownerRiding && c.self.distOwner > 56 && c.owner.dimensionSame && c.owner.present), act: 'catchup', say: '距離が開きすぎました。合流します', note: '乗り物全般で56超は即合流' },
  { id: 'ride_any_vehicle_dist_far', p: 477, when: c => Boolean(c.x?.ownerRiding && c.x?.vehicleDist !== undefined && c.x.vehicleDist > 32 && c.owner.dimensionSame), act: 'catchup', say: '乗り物との距離が開いています。追いつきます', note: '乗り物までの距離32超で合流' },
  { id: 'ride_any_vehicle_dist_mid', p: 471, when: c => Boolean(c.x?.ownerRiding && c.x?.vehicleDist !== undefined && c.x.vehicleDist > 16 && c.x.vehicleDist <= 32), act: 'follow_high', say: null, note: '乗り物まで中距離なら高め追随で見失わない' },
  { id: 'ride_any_vehicle_dist_close', p: 463, when: c => Boolean(c.x?.ownerRiding && c.x?.vehicleDist !== undefined && c.x.vehicleDist <= 6 && c.self.distOwner > 8), act: 'follow_close', say: null, note: '乗り物は近いが主人と離れている場合は主人側へ寄る' },
  { id: 'ride_any_follow_mode_far', p: 470, when: c => Boolean(c.x?.ownerRiding && c.mode === 'follow' && c.self.distOwner > 14 && c.owner.dimensionSame), act: 'follow', say: null, note: 'followモードの乗車中は通常追従' },
  { id: 'ride_any_free_mode_close', p: 468, when: c => Boolean(c.x?.ownerRiding && c.mode === 'free' && c.self.distOwner > 16), act: 'follow_close', say: '移動中ですね。自由行動は中断して、ついていきます', note: 'freeモードでも主人が乗り物移動したら密着に切替' },
  { id: 'ride_any_stay_mode_say', p: 464, when: c => Boolean(c.x?.ownerRiding && c.mode === 'stay' && c.self.distOwner > 20 && c.flags.warnOk), act: 'say_only', say: '私はここで待機しています。……速いですね、もうそんな距離ですか', note: 'stayモードで主人が乗り物で去る場合は待機を宣言するだけ' },
  { id: 'ride_any_work_mode_follow', p: 467, when: c => Boolean(c.x?.ownerRiding && c.mode === 'work' && c.self.distOwner > 24 && c.owner.dimensionSame), act: 'follow', say: null, note: 'workモードでも主人が遠くへ移動したら追従に切替' },
  { id: 'ride_any_greet_start', p: 465, when: c => Boolean(c.x?.ownerRiding && !c.x?.ownerFlying && !c.x?.ownerInBoat && !c.x?.ownerOnHorse && c.self.distOwner <= 8 && c.flags.warnOk && c.owner.present), act: 'greet', say: '作業補助機、LIZE-07です。……その乗り物、私は乗せてもらえないのですね', note: '汎用乗り物への乗車直後の挨拶と小さな皮肉' },
  { id: 'ride_any_inv_full_say', p: 462, when: c => Boolean(c.x?.ownerRiding && c.inv.full && c.flags.warnOk && c.owner.present), act: 'say_only', say: '私の荷物は満杯です。移動の前に、置き場所をご相談したいのですが', note: '乗車移動中＋満杯なら移動前に一言' },
  { id: 'ride_any_owner_on_fire_close', p: 475, when: c => Boolean(c.x?.ownerRiding && c.owner.onFire && c.self.distOwner > 6), act: 'follow_close', say: '燃えながら移動中ですね。……近くにいます、水場まで我慢してください', note: '炎上しながら乗り物移動する主人へ密着' },
  { id: 'ride_any_owner_dead_stop', p: 461, when: c => Boolean(c.x?.ownerRiding && c.owner.dead), act: 'say_only', say: '……信号が途絶えました。あなたの帰りを、ここで待ちます', note: '乗車中に主人が死亡したら一言だけ残す' },

  // ===== 高速移動全般：置いていかれない =====
  { id: 'ride_fast_catchup_far', p: 478, when: c => Boolean(c.x?.fastMove && c.self.distOwner > 44 && c.owner.dimensionSame && c.owner.present), act: 'catchup', say: '高速移動、追随が限界です。合流します', note: '高速移動で44超離れたら合流' },
  { id: 'ride_fast_high_mid', p: 474, when: c => Boolean(c.x?.fastMove && c.self.distOwner > 22 && c.self.distOwner <= 44 && c.owner.dimensionSame), act: 'follow_high', say: null, note: '高速移動中距離は高め追随で先回り気味に追う' },
  { id: 'ride_fast_follow_sprinting_plus', p: 469, when: c => Boolean(c.x?.fastMove && c.owner.sprinting && c.self.distOwner > 12), act: 'follow', say: '速度、合わせます。……これ以上は、私も保証できません', note: '高速移動＋ダッシュの複合は通常追従で追う' },
  { id: 'ride_fast_close_night', p: 472, when: c => Boolean(c.x?.fastMove && c.env.isNight && c.self.distOwner > 10), act: 'follow_close', say: '夜の高速移動です。見失う前に、近くにいます', note: '夜＋高速移動は密着' },
  { id: 'ride_fast_close_danger', p: 473, when: c => Boolean(c.x?.fastMove && c.danger.count >= 3 && c.self.distOwner > 8), act: 'follow_close', say: '敵が多い区間です。速いですが、寄ります', note: '高速移動＋敵多数は密着警戒' },
  { id: 'ride_fast_say_comment', p: 463, when: c => Boolean(c.x?.fastMove && !c.x?.ownerRiding && c.self.distOwner <= 10 && c.flags.warnOk && c.owner.present), act: 'say_only', say: '歩行とは思えない速度ですね。……記録しておきます', note: '乗り物なし高速移動への真顔コメント' },
  { id: 'ride_fast_stuck_catchup', p: 476, when: c => Boolean(c.x?.fastMove && c.self.stuck && c.self.stuckSec >= 5 && c.self.distOwner > 20 && c.owner.dimensionSame), act: 'catchup', say: '引っかかっている間に開きましたね。合流します', note: '自分がハマって高速移動に置いていかれたら合流' },
  { id: 'ride_fast_dimension_diff_say', p: 462, when: c => Boolean(c.x?.fastMove && !c.owner.dimensionSame && c.owner.present && c.flags.warnOk), act: 'say_only', say: '次元の向こうで速いのですね。……こちらでは、待つしかありません', note: '別次元で高速移動中の主人への一言' },
  { id: 'ride_fast_idle_owner_contradiction', p: 460, when: c => Boolean(c.x?.fastMove && c.owner.idleSec >= 30 && c.self.distOwner <= 6 && c.flags.warnOk), act: 'greet', say: '止まっているのに高速移動の記録です。……面白いですね、あなたの乗り物', note: '高速移動フラグのまま停止している主人への挨拶がてらの指摘' },
  { id: 'ride_fast_home_far_follow', p: 466, when: c => Boolean(c.x?.fastMove && c.home.registered && c.self.distHome > 40 && c.mode === 'follow' && c.self.distOwner > 12), act: 'follow', say: null, note: '拠点から遠く離れた高速移動は追従を維持' },

  // ===== 降車・停止・速度変化への反応 =====
  { id: 'ride_off_greet_arrival', p: 464, when: c => Boolean(!c.x?.ownerRiding && !c.x?.fastMove && c.owner.present && c.self.distOwner <= 5 && c.flags.justDelivered && c.flags.warnOk), act: 'greet', say: 'おかえりなさい。……移動、お疲れさまでした。コーヒーですか', note: '降車直後＋受け渡し直後の主人へ帰還の挨拶' },
  { id: 'ride_off_close_low_hp', p: 474, when: c => Boolean(!c.x?.ownerRiding && c.owner.hpPct < 0.35 && c.self.distOwner > 6 && c.owner.present && !c.owner.dead), act: 'follow_close', say: '降りましたね。その体力です、近くにいます', note: '降車後に低HPの主人へ密着' },
  { id: 'ride_off_drops_pickup_window', p: 463, when: c => Boolean(!c.x?.ownerRiding && !c.x?.fastMove && c.drops.count >= 2 && c.drops.nearestDist <= 6 && c.mode === 'follow'), act: 'follow_close', say: null, note: '停止中は近くのドロップ回収に備えて密着維持' },
  { id: 'ride_slow_sneak_ride_say', p: 461, when: c => Boolean(c.x?.ownerRiding && c.owner.sneaking && c.flags.warnOk && c.owner.present), act: 'say_only', say: '乗り物の上で、静かにしているのですね。……私も声を落とします', note: '乗車中スニークへの配慮の一言' },
  { id: 'ride_any_hunger_say', p: 462, when: c => Boolean(c.x?.ownerRiding && c.owner.hunger <= 4 && c.inv.hasFood && c.flags.warnOk), act: 'say_only', say: '空腹の記録です。降りたらすぐ渡します。……移動中は、手が出せませんので', note: '乗車中＋主人空腹＋食料所持なら降車後の受け渡しを予告' },
];
