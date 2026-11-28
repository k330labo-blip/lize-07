// 軌道工廠の機械まわり・工業生活ルール（機械 / ベルト / 原子炉 / 発射台 / コンテナ）
// 優先度帯: 430〜449
// 追加文脈 c.x は必ず c.x?.f === true 形式で参照する（c.x が無い文脈でも例外を出さず、真偽値が返る）
// セリフはリゼ（LIZE-07）口調: 一人称「私」、相手は「あなた」、短い敬語、皮肉も真顔。元・夜勤助手。
export const RULES = [
  // ===== 機械全般：稼働を見守る =====
  { id: 'of_machine_danger_return', p: 449, when: c => c.x?.nearMachine === true && c.x?.machineWorking === true && c.danger.safetyCount > 0 && c.self.distOwner > 6 && c.owner.present, act: 'follow_close', say: '危ないです。機械より、あなたのそばに行きます', note: '稼働中の機械＋敵接近＋主人と離れているなら機械を離れて主人へ' },
  { id: 'of_machine_working_drops_pickup', p: 448, when: c => c.x?.nearMachine === true && c.x?.machineWorking === true && c.drops.count > 0 && c.drops.nearestDist >= 0 && c.drops.nearestDist <= 5 && !c.inv.full, act: 'pickup_nearest', say: '落ちていますよ。回収します', note: '稼働中機械の足元のドロップは加工の邪魔になる前に拾う' },
  { id: 'of_machine_working_stay_watch', p: 447, when: c => c.x?.nearMachine === true && c.x?.machineWorking === true && c.mode === 'stay', act: 'stay_anchor', say: '持ち場を守ります。機械の音、嫌いじゃないです', note: 'stay＋稼働中機械のそばは持ち場で見守る' },
  { id: 'of_machine_working_full_deposit', p: 446, when: c => c.x?.nearMachine === true && c.inv.full && c.home.registered, act: 'deposit', say: '満載です。機械の邪魔になる前に、運びます', note: '機械の近くで満載なら先に入庫して動線を空ける' },
  { id: 'of_machine_night_shift', p: 445, when: c => c.x?.nearMachine === true && c.x?.machineWorking === true && c.env.isNight && c.flags.warnOk, act: 'say_only', say: '夜勤ですね。……私の得意分野です', note: '夜＋稼働中機械は元夜勤助手の本領コメント' },
  { id: 'of_machine_follow_close', p: 444, when: c => c.x?.nearMachine === true && c.x?.machineWorking === true && c.mode === 'follow' && c.self.distOwner > 4, act: 'follow_close', say: '機械が動いています。……そばにいますね', note: '稼働中機械の近くでは主人に寄って邪魔にならない位置へ' },
  { id: 'of_machine_underground_follow', p: 442, when: c => c.x?.nearMachine === true && c.owner.underground && c.mode === 'follow' && c.self.distOwner > 5, act: 'follow_close', say: null, note: '地下の機械まわりは通路が狭いので静かに密着' },
  { id: 'of_machine_sneaking_quiet', p: 440, when: c => c.x?.nearMachine === true && c.owner.sneaking && c.self.distOwner > 3 && c.owner.present, act: 'follow_close', say: null, note: '主人が機械の前でスニーク中は無言で寄る' },
  { id: 'of_machine_owner_idle_observe', p: 438, when: c => c.x?.nearMachine === true && c.owner.idleSec >= 30 && c.flags.warnOk && c.owner.present, act: 'say_only', say: '眺めていますね。……気持ちは分かります', note: '機械の前で長く佇む主人への共感コメント' },
  { id: 'of_machine_work_patrol', p: 436, when: c => c.x?.nearMachine === true && c.mode === 'work' && c.home.registered && !c.inv.full && c.drops.count === 0, act: 'patrol_home', say: '異常なしです。……巡回、続けます', note: 'work＋機械近辺＋拾う物なしなら拠点巡回を続ける' },
  { id: 'of_machine_rain_comment', p: 433, when: c => c.x?.nearMachine === true && c.env.isRaining && c.flags.warnOk, act: 'say_only', say: '雨です。……機械より先に、あなたが濡れています', note: '雨＋機械のそばでは主人への真顔の指摘' },
  { id: 'of_machine_idle_comment', p: 430, when: c => c.x?.nearMachine === true && c.x?.machineWorking !== true && c.flags.warnOk && c.owner.present, act: 'say_only', say: '止まっていますね。……材料、切らしていませんか', note: '近くの機械が停止中なら材料切れを疑って声をかける' },

  // ===== ベルト：流れを見守る =====
  { id: 'of_belt_valuable_pickup', p: 449, when: c => c.x?.nearBelt === true && c.drops.valuableDist >= 0 && c.drops.valuableDist <= 8 && !c.inv.full, act: 'pickup_nearest', say: '大事な物が流れてきました。確保します', note: 'ベルト付近の貴重品ドロップは流出前に回収' },
  { id: 'of_belt_drops_pickup', p: 447, when: c => c.x?.nearBelt === true && c.drops.count > 0 && c.drops.nearestDist >= 0 && c.drops.nearestDist <= 6 && !c.inv.full, act: 'pickup_nearest', say: 'ベルトのそばに落ちています。拾いますね', note: 'ベルト付近のドロップは流れの邪魔になる前に拾う' },
  { id: 'of_belt_container_deposit', p: 446, when: c => c.x?.nearBelt === true && c.x?.nearContainer === true && c.inv.used > 0 && c.home.registered, act: 'deposit', say: 'コンテナが近いです。まとめて入れますね', note: 'ベルトとコンテナが両方近いならついでに入庫' },
  { id: 'of_belt_nearfull_deposit', p: 445, when: c => c.x?.nearBelt === true && c.inv.nearFull && c.home.registered, act: 'deposit', say: 'そろそろ満載です。流れを止める前に運びます', note: 'ベルト付近でほぼ満載なら早めに入庫' },
  { id: 'of_belt_sprint_follow', p: 443, when: c => c.x?.nearBelt === true && c.owner.sprinting && c.self.distOwner > 8 && c.owner.dimensionSame, act: 'follow_close', say: '速いですね。……ベルトより速いですよ', note: 'ベルト沿いをダッシュする主人に密着で追いつく' },
  { id: 'of_belt_stay_watch', p: 441, when: c => c.x?.nearBelt === true && c.mode === 'stay', act: 'stay_anchor', say: 'ここで流れを見ています。持ち場ですから', note: 'stay＋ベルトのそばは持ち場で流れを見守る' },
  { id: 'of_belt_flow_comment', p: 439, when: c => c.x?.nearBelt === true && c.x?.machineWorking === true && c.flags.warnOk, act: 'say_only', say: '流れています。……見ていて飽きないですね', note: '搬送が回っているベルトへの小さな感想' },
  { id: 'of_belt_night_patrol', p: 437, when: c => c.x?.nearBelt === true && c.env.isNight && c.mode === 'work' && c.home.registered, act: 'patrol_home', say: null, note: '夜のworkはベルト沿いを含めて拠点を巡回' },
  { id: 'of_belt_owner_idle_comment', p: 434, when: c => c.x?.nearBelt === true && c.owner.idleSec >= 20 && c.flags.warnOk && c.owner.present, act: 'say_only', say: '止まって眺めるのも、作業のうちです。……たぶん', note: 'ベルトの前で佇む主人への真顔コメント' },

  // ===== 原子炉：慎重に、静かに =====
  { id: 'of_reactor_owner_onfire', p: 449, when: c => c.x?.nearReactor === true && c.owner.onFire && c.owner.present, act: 'follow_close', say: '燃えていますよ。……まず水です、水', note: '原子炉のそばで主人が炎上したら即座に寄る' },
  { id: 'of_reactor_danger_return', p: 448, when: c => c.x?.nearReactor === true && c.danger.safetyCount >= 2 && c.self.distOwner > 5 && c.owner.present, act: 'follow_close', say: 'ここは危ないです。あなたのそばへ行きます', note: '原子炉＋敵多数＋離れているなら主人へ合流' },
  { id: 'of_reactor_full_deposit', p: 446, when: c => c.x?.nearReactor === true && c.inv.full && c.home.registered && c.home.dist > 10, act: 'deposit', say: '満載です。原子炉のそばに置く物じゃありません、運びます', note: '原子炉付近で満載なら離れた拠点へ入庫' },
  { id: 'of_reactor_night_watch', p: 444, when: c => c.x?.nearReactor === true && c.env.isNight && c.mode === 'stay', act: 'stay_anchor', say: '夜の見張りは私の仕事でした。……今もです', note: '夜＋原子炉＋stayは元夜勤助手の見張り' },
  { id: 'of_reactor_caution_comment', p: 442, when: c => c.x?.nearReactor === true && c.flags.warnOk && c.owner.present, act: 'say_only', say: '原子炉の近くです。……静かに、慎重にいきましょう', note: '原子炉接近時の基本の注意喚起' },
  { id: 'of_reactor_working_comment', p: 440, when: c => c.x?.nearReactor === true && c.x?.machineWorking === true && c.flags.warnOk, act: 'say_only', say: '原子炉、安定しています。……音だけ聞けば、ですが', note: '稼働中の原子炉への真顔の感想' },
  { id: 'of_reactor_lava_comment', p: 438, when: c => c.x?.nearReactor === true && c.danger.lavaNear && c.flags.warnOk, act: 'say_only', say: '熱源が多すぎます。……足元、見てください', note: '原子炉＋溶岩近接は熱源の多さに注意' },
  { id: 'of_reactor_patrol_quiet', p: 435, when: c => c.x?.nearReactor === true && c.mode === 'work' && c.home.registered && c.danger.count === 0, act: 'patrol_home', say: null, note: '敵なしのwork中は原子炉まわりも静かに巡回' },

  // ===== 発射台・ロケット：旅立ちの手伝い =====
  { id: 'of_rocket_ready_deliver', p: 449, when: c => c.x?.rocketReady === true && c.x?.nearLaunchPad === true && c.inv.used > 0 && c.owner.present && c.self.distOwner <= 10, act: 'deliver_all', say: '打ち上げ前に、荷物をお渡しします。忘れ物は許しません', note: 'ロケット準備完了＋所持品ありなら旅立ち前に全部渡す' },
  { id: 'of_rocket_ready_full_deposit', p: 447, when: c => c.x?.rocketReady === true && c.inv.full && c.home.registered, act: 'deposit', say: '満載のまま乗る気ですか。……先に置いてきます', note: '打ち上げ前なのに満載なら先に入庫して身軽に' },
  { id: 'of_launchpad_drops_pickup', p: 446, when: c => c.x?.nearLaunchPad === true && c.drops.count > 0 && c.drops.nearestDist >= 0 && c.drops.nearestDist <= 6 && !c.inv.full, act: 'pickup_nearest', say: '発射台のそばに落とし物です。拾います', note: '発射台付近のドロップは打ち上げ前に片付ける' },
  { id: 'of_launchpad_far_follow', p: 444, when: c => c.x?.nearLaunchPad === true && c.self.distOwner > 12 && c.owner.dimensionSame && c.owner.present, act: 'follow_close', say: null, note: '発射台付近で主人と離れたら静かに合流' },
  { id: 'of_launchpad_stay_watch', p: 443, when: c => c.x?.nearLaunchPad === true && c.mode === 'stay', act: 'stay_anchor', say: '発射台の見張りですね。……夜勤と変わりません', note: 'stay＋発射台は見張り持ち場にする' },
  { id: 'of_rocket_ready_comment', p: 441, when: c => c.x?.rocketReady === true && c.x?.nearLaunchPad === true && c.flags.warnOk, act: 'say_only', say: 'ロケット、準備完了です。……行くんですか', note: '準備完了ロケットへの、少しだけ名残惜しい確認' },
  { id: 'of_launchpad_night_ready', p: 439, when: c => c.x?.nearLaunchPad === true && c.x?.rocketReady === true && c.env.isNight && c.flags.warnOk, act: 'say_only', say: '夜の打ち上げですか。……星は、よく見えますよ', note: '夜＋準備完了は夜勤助手らしい一言' },
  { id: 'of_launchpad_thunder_comment', p: 436, when: c => c.x?.nearLaunchPad === true && c.env.isThundering && c.flags.warnOk, act: 'say_only', say: '雷です。高い所と金属は、相性が悪いですよ', note: '雷雨＋発射台は延期を匂わせる真顔コメント' },
  { id: 'of_launchpad_rain_comment', p: 432, when: c => c.x?.nearLaunchPad === true && c.env.isRaining && c.flags.warnOk, act: 'say_only', say: '雨です。……打ち上げは、明日にしませんか', note: '雨＋発射台は明日に回す提案' },

  // ===== コンテナ：倉庫番の本領 =====
  { id: 'of_container_full_deposit', p: 449, when: c => c.x?.nearContainer === true && c.inv.full && c.home.registered, act: 'deposit', say: 'コンテナの前です。全部入れますね', note: 'コンテナの目の前で満載なら即入庫' },
  { id: 'of_container_valuable_deposit', p: 447, when: c => c.x?.nearContainer === true && c.inv.hasValuable && c.home.registered && c.mode === 'work', act: 'deposit', say: '大事な物を預かっています。先に入れますね', note: 'work中、貴重品を持ってコンテナに来たら優先入庫' },
  { id: 'of_container_nearfull_deposit', p: 445, when: c => c.x?.nearContainer === true && c.inv.nearFull && c.home.registered && c.mode === 'work', act: 'deposit', say: 'ほぼ満載です。ついでに入れておきます', note: 'work中コンテナ付近でほぼ満載ならついで入庫' },
  { id: 'of_container_night_deposit', p: 443, when: c => c.x?.nearContainer === true && c.env.isNight && c.inv.used > 0 && c.home.registered, act: 'deposit', say: '夜のうちに片付けます。……夜勤ですから', note: '夜はコンテナ前で静かに片付け入庫' },
  { id: 'of_container_food_deliver', p: 441, when: c => c.x?.nearContainer === true && c.inv.hasFood && c.owner.hunger < 10 && c.owner.present, act: 'deliver_all', say: 'お腹、空いていませんか。……持っていますよ', note: 'コンテナ前で主人が空腹なら食料ごと渡す' },
  { id: 'of_container_after_deposit_return', p: 439, when: c => c.x?.nearContainer === true && c.flags.justDeposited && c.owner.present && c.self.distOwner > 6, act: 'follow_close', say: '入庫完了です。……戻りますね', note: '入庫直後にコンテナ前で主人が離れていたら戻る' },
  { id: 'of_container_stay_keeper', p: 437, when: c => c.x?.nearContainer === true && c.mode === 'stay' && c.home.registered, act: 'stay_anchor', say: '倉庫番ですね。……悪くないです', note: 'stay＋コンテナは倉庫番として持ち場維持' },
  { id: 'of_container_chestfull_comment', p: 434, when: c => c.x?.nearContainer === true && c.home.chestFull && c.flags.warnOk, act: 'say_only', say: 'コンテナ、いっぱいです。……あなたの整理待ち、ですね', note: '登録コンテナ満杯の真顔の報告' },
  { id: 'of_container_missing_comment', p: 431, when: c => c.x?.nearContainer === true && c.home.chestMissing && c.flags.warnOk, act: 'say_only', say: '登録したコンテナが見つかりません。……帰る場所、確認させてください', note: '登録コンテナ消失は「帰る場所」に絡めて報告' },

  // ===== 工業生活の複合：時間帯・状態・工場の日常 =====
  { id: 'of_factory_thunder_comment', p: 448, when: c => (c.x?.nearMachine === true || c.x?.nearReactor === true) && c.env.isThundering && c.flags.warnOk, act: 'say_only', say: '雷です。……機械は平気でも、私は少し苦手です', note: '雷雨＋機械まわりは少しだけ弱音の混じるコメント' },
  { id: 'of_factory_owner_dead_return', p: 446, when: c => c.x?.nearMachine === true && c.owner.dead && c.home.registered, act: 'patrol_home', say: null, note: '工場で主人が倒れたら無言で拠点へ戻り待機側に回る' },
  { id: 'of_factory_hp_low_rest', p: 444, when: c => c.x?.nearMachine === true && c.self.hpPct < 0.4 && c.home.registered, act: 'patrol_home', say: '少し休みます。……機械も休ませてあげてください', note: '自機低HPは工場を離れて拠点巡回＝休息に寄せる' },
  { id: 'of_factory_stuck_comment', p: 442, when: c => c.x?.nearMachine === true && c.self.stuck && c.self.stuckSec >= 3, act: 'say_only', say: 'すみません、引っかかっています。……機械の気持ちが分かりました', note: '機械のそばでハマったら真顔の自己申告' },
  { id: 'of_factory_delivered_next', p: 440, when: c => c.x?.nearMachine === true && c.x?.machineWorking === true && c.flags.justDelivered, act: 'say_only', say: '渡しました。……次は私が運びます', note: '受け渡し直後＋稼働中機械なら次の搬送宣言' },
  { id: 'of_factory_sneak_quiet', p: 438, when: c => (c.x?.nearMachine === true || c.x?.nearContainer === true) && c.owner.sneaking && c.mode === 'follow' && c.self.distOwner > 4, act: 'follow_close', say: null, note: '工場内でスニークする主人には無言で密着' },
  { id: 'of_factory_dawn_greet', p: 436, when: c => c.x?.nearMachine === true && c.env.isDawn && c.flags.warnOk, act: 'say_only', say: '朝です。機械も、あなたも、おはようございます', note: '夜明け＋機械のそばは夜勤明けの挨拶' },
  { id: 'of_factory_dusk_comment', p: 434, when: c => c.x?.nearMachine === true && c.env.isDusk && c.flags.warnOk, act: 'say_only', say: '夕方です。……あと一回だけ、作業しますか', note: '夕方＋機械のそばは夜更かし付き合い風の一言' },
  { id: 'of_factory_no_home_comment', p: 432, when: c => c.x?.nearContainer === true && !c.home.registered && c.mode === 'work' && c.flags.warnOk, act: 'say_only', say: '帰る場所が未登録です。……私も人のことは言えませんが', note: '拠点未登録＋workは彼女自身の設定に絡めた指摘' },
];
