// 村・村人・取引・襲撃の分岐ルール（優先度帯 260〜279）
// 感情層(200〜299帯)の一部として、マルチプレイ層(240〜259)より少し上で効く。
// 追加文脈 c.x は任意（無い環境でも落ちないよう、必ず c.x?.〜 で参照する）。
//   c.x.nearVillager: 村人が近くにいる（真偽値）
//   c.x.nearVillage : 村の範囲内・近傍にいる（真偽値）
//   c.x.trading     : 主人が村人と取引中（真偽値）
//   c.x.raidActive  : 襲撃イベントが発生中（真偽値）
//   c.x.badOmen     : 主人に不吉な予感が付いている（真偽値）
//   c.x.nearGolem   : アイアンゴーレムが近くにいる（真偽値）
//   c.x.nearBell    : 村の鐘が近くにある（真偽値）
// セリフはリゼ口調（一人称「私」、相手は「あなた」、短い敬語、皮肉は真顔）。
export const RULES = [
// ===== 襲撃：最優先で主人を守る =====
{id:'village_raid_guard_owner_targeted', p:279, when:c=>Boolean(c.x?.raidActive===true&&c.danger.visualOwnerTargeted&&c.owner.present), act:'guard', say:'襲撃です。……あなたは、私が守ります', note:'襲撃中に主人が狙われたら即座に護衛に入る'},
{id:'village_raid_warn_first_wave', p:278, when:c=>Boolean(c.x?.raidActive===true&&c.danger.safetyCount>=3&&c.flags.warnOk), act:'warn_hostile', say:'敵の数が、多いです。村の中へ、下がってください', note:'襲撃で敵が3体以上なら警告して後退を促す'},
{id:'village_raid_close_owner_low', p:278, when:c=>Boolean(c.x?.raidActive===true&&c.owner.hpPct<=0.4&&c.self.distOwner>5), act:'follow_close', say:'襲撃中です。……離れないでください、私も離れません', note:'襲撃中＋主人低体力なら距離を詰める'},
{id:'village_raid_guard_near_villager', p:277, when:c=>Boolean(c.x?.raidActive===true&&c.x?.nearVillager===true&&c.danger.safetyCount>=1), act:'guard', say:'村人さん、下がっていてください。……そこの敵は、私の担当です', note:'村人の近くで敵が出たら村人を守る位置で護衛'},
{id:'village_raid_bell_area_guard', p:276, when:c=>Boolean(c.x?.raidActive===true&&c.x?.nearBell===true&&c.danger.safetyCount>=1), act:'guard', say:'鐘の周りが、持ち場です。……ここは通しません', note:'鐘の周辺は村人が集まるので重点護衛'},
{id:'village_raid_night_warn', p:275, when:c=>Boolean(c.x?.raidActive===true&&c.env.isNight&&c.flags.warnOk), act:'warn_hostile', say:'夜の襲撃は、視界が悪いです。……足元に、注意を', note:'夜間襲撃は視界の悪さを警告する'},
{id:'village_raid_owner_fighting_close', p:274, when:c=>Boolean(c.x?.raidActive===true&&c.owner.sprinting&&c.self.distOwner>8), act:'follow_close', say:'前線に出るなら、私も行きます。……置いていかないでください', note:'主人が襲撃で前線に出たら遅れず寄る'},
{id:'village_raid_golem_coop', p:273, when:c=>Boolean(c.x?.raidActive===true&&c.x?.nearGolem===true&&c.danger.safetyCount>=2), act:'guard', say:'ゴーレムさんが、頑張っています。……私は、あなたの側です', note:'ゴーレムが戦っていても自分の持ち場は主人の側'},
{id:'village_raid_stay_mode_hold', p:272, when:c=>Boolean(c.x?.raidActive===true&&c.mode==='stay'&&c.danger.safetyCount>=1), act:'guard', say:'待機中ですが、襲撃です。……定位置は、守ります', note:'待機モードでも襲撃時はその場を守る'},
{id:'village_raid_aftermath_pickup', p:271, when:c=>Boolean(c.x?.raidActive===false&&c.x?.nearVillage===true&&c.drops.count>0&&c.danger.count===0&&!c.inv.full), act:'pickup_nearest', say:'襲撃は、終わりました。……落ちた物を、回収します', note:'襲撃終了後、安全なら戦利品や落下物を回収する'},
// ===== 不吉な予感：村に近づく前に知らせる =====
{id:'village_badomen_near_village_warn', p:274, when:c=>Boolean(c.x?.badOmen===true&&c.x?.nearVillage===true&&c.flags.warnOk), act:'warn_hostile', say:'待ってください。……不吉な予感が、付いています。このまま入ると、襲撃です', note:'不吉な予感＋村が近いなら入村前に止める'},
{id:'village_badomen_villager_warn', p:272, when:c=>Boolean(c.x?.badOmen===true&&c.x?.nearVillager===true&&c.flags.warnOk), act:'say_only', say:'村人さんに、近づきすぎないでください。……予感が、発火します', note:'村人の近くでは予感の発火条件を穏やかに伝える'},
{id:'village_badomen_night_caution', p:270, when:c=>Boolean(c.x?.badOmen===true&&c.env.isNight&&c.x?.nearVillage===true), act:'follow_close', say:'夜＋予感＋村。……条件が、揃いすぎです。近くにいます', note:'夜に予感を持って村へ近づくなら密着する'},
{id:'village_badomen_owner_sneak_joke', p:267, when:c=>Boolean(c.x?.badOmen===true&&c.owner.sneaking&&c.x?.nearVillage===true), act:'say_only', say:'しゃがんでも、予感は消えません。……試すだけ、無駄です', note:'予感持ちで村に忍び寄る主人へ真顔の一言'},
{id:'village_badomen_far_village_note', p:264, when:c=>Boolean(c.x?.badOmen===true&&c.x?.nearVillage!==true&&c.owner.idleSec>=30), act:'say_only', say:'不吉な予感、継続中です。……村に寄らなければ、平和です', note:'村から遠ければ予感は静かに申告だけする'},
{id:'village_badomen_trading_priority', p:269, when:c=>Boolean(c.x?.badOmen===true&&c.x?.trading===true&&c.danger.count===0), act:'say_only', say:'お取引は、どうぞ。……終わったら、村を出ましょう', note:'取引中は邪魔せず、終了後の離村を提案する'},
// ===== 取引中：割り込まない、でも目は離さない =====
{id:'village_trading_hold_anchor', p:271, when:c=>Boolean(c.x?.trading===true&&c.mode!=='stay'), act:'stay_anchor', say:'お取引中ですね。私は、ここで待ちます', note:'主人が村人と取引中はその場で待機する'},
{id:'village_trading_no_pickup', p:269, when:c=>Boolean(c.x?.trading===true&&c.drops.count>0&&!c.inv.full), act:'say_only', say:'落ちた物は、見えています。……取引が終わってから、拾います', note:'取引中は回収で視界を横切らない'},
{id:'village_trading_full_wait', p:268, when:c=>Boolean(c.x?.trading===true&&c.inv.full), act:'stay_anchor', say:'荷物はいっぱいです。……でも、取引が先です', note:'満載でも取引中は入庫を急がない'},
{id:'village_trading_long_idle', p:266, when:c=>Boolean(c.x?.trading===true&&c.owner.idleSec>=120), act:'say_only', say:'長いお取引ですね。……値切りは、私にはできません', note:'取引が長いと控えめに存在を出す'},
{id:'village_trading_villager_crowd_quiet', p:265, when:c=>Boolean(c.x?.trading===true&&c.x?.nearVillager===true&&c.x?.nearVillage===true&&c.env.isNight), act:'stay_anchor', say:'夜の村です。……物音は、立てません', note:'夜の村での取引は静かに待つ'},
{id:'village_trading_owner_hungry_note', p:267, when:c=>Boolean(c.x?.trading===true&&c.owner.hunger<=6&&c.inv.hasFood), act:'say_only', say:'食べ物は、持っています。……取引の後で、渡します', note:'取引中でも主人の空腹だけは申告しておく'},
{id:'village_trading_end_follow', p:263, when:c=>Boolean(c.x?.trading===false&&c.x?.nearVillager===true&&c.self.distOwner>=10&&c.mode==='follow'), act:'follow_close', say:'お取引、お疲れさまでした。……戻りました', note:'取引が終わって離れていたら寄り直す'},
{id:'village_trading_golem_watch', p:266, when:c=>Boolean(c.x?.trading===true&&c.x?.nearGolem===true), act:'say_only', say:'ゴーレムさんが見ています。……私は、変な動きはしません', note:'ゴーレムの前での取引は誤解されないよう静かにする'},
{id:'village_trading_raid_interrupt', p:276, when:c=>Boolean(c.x?.trading===true&&c.danger.safetyCount>=2&&c.flags.warnOk), act:'warn_hostile', say:'お取引中、失礼します。……敵です。こちらへ', note:'取引中でも敵が迫れば警告で割り込む'},
// ===== 鐘とゴーレム：村の守り手への配慮 =====
{id:'village_bell_morning_note', p:265, when:c=>Boolean(c.x?.nearBell===true&&c.env.isDawn&&c.x?.nearVillage===true), act:'say_only', say:'鐘の近くです。……村の朝は、ここから始まります', note:'朝の鐘のそばでは村の始動に一言'},
{id:'village_bell_evening_note', p:264, when:c=>Boolean(c.x?.nearBell===true&&c.env.isDusk&&c.x?.nearVillage===true), act:'say_only', say:'もうすぐ、鐘が鳴ります。……村人さんは、家に帰ります', note:'夕方の鐘は村人の帰宅合図だと伝える'},
{id:'village_bell_stay_anchor', p:263, when:c=>Boolean(c.x?.nearBell===true&&c.mode==='stay'&&c.x?.nearVillage===true), act:'stay_anchor', say:'鐘のそばが、定位置です。……悪くない場所です', note:'村で待機するなら鐘のそばを定位置にする'},
{id:'village_golem_greet', p:262, when:c=>Boolean(c.x?.nearGolem===true&&c.danger.count===0&&c.x?.nearVillage===true), act:'greet', say:'ゴーレムさん、いつもご苦労さまです。……同業ですね', note:'平和な村でゴーレムに挨拶する（守り手同士）'},
{id:'village_golem_not_block', p:264, when:c=>Boolean(c.x?.nearGolem===true&&c.self.stuck&&c.self.stuckSec>=3), act:'follow_close', say:'ゴーレムさんの通り道でした。……どきます', note:'ゴーレムの進路で引っかかったら道を空ける'},
{id:'village_golem_owner_sprint_pass', p:261, when:c=>Boolean(c.x?.nearGolem===true&&c.owner.sprinting&&c.self.distOwner>=10), act:'follow_close', say:'ゴーレムさん、失礼します。……主人が、先に行きます', note:'ゴーレムのそばを主人が駆け抜けたら遅れず追う'},
{id:'village_bell_raid_gather_note', p:270, when:c=>Boolean(c.x?.nearBell===true&&c.x?.raidActive===true&&c.x?.nearVillager===true), act:'say_only', say:'鐘が鳴れば、村人さんは集まります。……あなたは、無理をしないで', note:'襲撃時に鐘の意味と主人の安全を伝える'},
// ===== 村への到着・挨拶 =====
{id:'village_arrive_greet_day', p:263, when:c=>Boolean(c.x?.nearVillage===true&&c.x?.nearVillager===true&&!c.env.isNight&&c.danger.count===0), act:'greet', say:'村に着きました。……私は、あなたの助手です。村人さん、どうぞよろしく', note:'昼の村到着時は村人へ助手として挨拶する'},
{id:'village_arrive_night_quiet', p:262, when:c=>Boolean(c.x?.nearVillage===true&&c.env.isNight&&c.danger.count===0), act:'say_only', say:'夜の村です。……村人さんは、寝ています。静かにどうぞ', note:'夜の村では騒がないよう促す'},
{id:'village_arrive_first_note', p:261, when:c=>Boolean(c.x?.nearVillage===true&&c.owner.idleSec>=20&&c.danger.count===0&&!c.env.isNight), act:'say_only', say:'村は、賑やかです。……研究所の夜とは、違いますね', note:'村で立ち止まったら出自に絡めた一言'},
{id:'village_arrive_rain_shelter', p:260, when:c=>Boolean(c.x?.nearVillage===true&&c.env.isRaining&&c.mode!=='work'), act:'follow_close', say:'雨です。村の軒下を、借りましょう。……私は、濡れても平気です', note:'雨の村到着時は軒下へ寄る提案と一緒に寄る'},
{id:'village_arrive_owner_sneak', p:260, when:c=>Boolean(c.x?.nearVillage===true&&c.owner.sneaking&&c.danger.count===0), act:'say_only', say:'村で、しゃがみ歩きですか。……理由は、聞きません', note:'村でこそこそする主人には真顔で触れるだけ'},
{id:'village_villager_close_greet', p:262, when:c=>Boolean(c.x?.nearVillager===true&&c.self.distOwner<=6&&c.danger.count===0&&c.x?.trading!==true), act:'greet', say:'こんにちは。……私は、そちらの助手です', note:'村人が近くにいたら主人の助手として挨拶する'},
{id:'village_villager_child_watch', p:261, when:c=>Boolean(c.x?.nearVillager===true&&c.owner.sprinting&&c.x?.nearVillage===true), act:'say_only', say:'村では、走らないでください。……村人さんが、驚きます', note:'村の中で走る主人を穏やかに止める'},
{id:'village_depart_note', p:260, when:c=>Boolean(c.x?.nearVillage===false&&c.x?.nearVillager!==true&&c.flags.justDeposited===false&&c.owner.idleSec<10&&c.mode==='follow'&&c.self.distHome>=32), act:'say_only', say:'村を出ました。……静かな場所に、戻りますね', note:'村を離れた直後に一言添える'},
// ===== 村人への配慮・村内での振る舞い =====
{id:'village_follow_not_block_door', p:264, when:c=>Boolean(c.x?.nearVillager===true&&c.mode==='follow'&&c.self.stuck), act:'follow_close', say:'村人さんの通り道でした。……半歩、下がります', note:'村人の動線を塞いだら寄り直して道を空ける'},
{id:'village_work_mode_village_careful', p:265, when:c=>Boolean(c.mode==='work'&&c.x?.nearVillage===true&&c.drops.count>0&&!c.inv.full), act:'pickup_nearest', say:'村の中の落下物です。……踏まないうちに、回収します', note:'作業モードで村にいる時は落下物を丁寧に回収する'},
{id:'village_owner_inwater_village', p:261, when:c=>Boolean(c.owner.inWater&&c.x?.nearVillage===true&&c.danger.count===0), act:'say_only', say:'村の井戸ですか、池ですか。……落ちたなら、見なかったことにします', note:'村の水場で泳ぐ（落ちた）主人へ真顔の一言'},
{id:'village_owner_onfire_village_warn', p:268, when:c=>Boolean(c.owner.onFire&&c.x?.nearVillage===true&&c.flags.warnOk), act:'warn_hostile', say:'火が付いています。……村の家は、木です。早く消してください', note:'村の中で主人が燃えていたら延焼の観点で警告する'},
{id:'village_owner_underground_village', p:260, when:c=>Boolean(c.owner.underground&&c.x?.nearVillage===true&&c.self.distOwner>6), act:'follow_close', say:'村の下にいますね。……家主の許可は、取りましたか', note:'村の地下にいる主人へ真顔の確認と寄り直し'},
{id:'village_idle_long_village_seat', p:262, when:c=>Boolean(c.owner.idleSec>=180&&c.x?.nearVillage===true&&c.danger.count===0), act:'stay_anchor', say:'村で、三分以上止まっています。……次の作業まで、私も隣に座ります', note:'村で長く止まったら三分ネタで隣に控える'},
{id:'village_hungry_owner_village_food', p:266, when:c=>Boolean(c.owner.hunger<=6&&c.x?.nearVillage===true&&c.x?.trading!==true&&c.danger.count===0), act:'say_only', say:'お腹が、空いていますね。……村の畑は、買うものです。取るものでは、ありません', note:'空腹の主人へ、村の作物は取引で得るものだと釘を刺す'},
{id:'village_owner_dead_near_village', p:267, when:c=>Boolean(c.owner.dead&&c.x?.nearVillage===true), act:'stay_anchor', say:'村の近くで、倒れましたね。……落下物は、私が見ています', note:'村の近くで主人が倒れたらその場で待機して見張る'},
// ===== 村での回収の作法 =====
{id:'village_pickup_near_villager_manners', p:263, when:c=>Boolean(c.x?.nearVillager===true&&c.drops.count>0&&c.drops.valuableDist<0&&!c.inv.full&&c.danger.count===0), act:'pickup_nearest', say:'村の中の落下物です。……持ち主不明なので、預かります', note:'村人の近くでも一般品は丁寧に回収する'},
{id:'village_pickup_owner_dropped_village', p:268, when:c=>Boolean(c.drops.ownerDroppedDist>=0&&c.drops.ownerDroppedDist<=10&&c.x?.nearVillage===true&&!c.inv.full), act:'pickup_nearest', say:'あなたの落とした物です。……村に置きっぱなしは、よくありません', note:'村に落ちた主人の物は優先して拾う'},
{id:'village_pickup_valuable_village', p:267, when:c=>Boolean(c.drops.valuableDist>=0&&c.drops.valuableDist<=8&&c.x?.nearVillage===true&&!c.inv.full), act:'pickup_nearest', say:'貴重品を検出。……村の中でも、回収は私の仕事です', note:'村の中の貴重品ドロップは回収する'},
{id:'village_pickup_full_village_note', p:264, when:c=>Boolean(c.inv.full&&c.x?.nearVillage===true&&c.drops.count>0), act:'say_only', say:'拾いたいですが、満載です。……村に置いていくのは、気が引けます', note:'満載で村の落下物を拾えない時は申告する'},
{id:'village_pickup_after_trade', p:265, when:c=>Boolean(c.flags.justDelivered===false&&c.x?.trading===false&&c.x?.nearVillager===true&&c.drops.nearestDist>=0&&c.drops.nearestDist<=4&&!c.inv.full), act:'pickup_nearest', say:'取引のついでに、足元の物も。……回収しました', note:'取引終了直後に足元のドロップを回収する'},
// ===== 夜・天候と村の複合 =====
{id:'village_night_stay_close', p:266, when:c=>Boolean(c.env.isNight&&c.x?.nearVillage===true&&c.mode==='follow'&&c.self.distOwner>7), act:'follow_close', say:'夜の村は、静かです。……あなたの近くにいます', note:'夜の村では離れすぎず寄る'},
{id:'village_night_hostile_warn', p:269, when:c=>Boolean(c.env.isNight&&c.x?.nearVillage===true&&c.danger.safetyCount>=1&&c.flags.warnOk), act:'warn_hostile', say:'敵です。村の中に、入ってきました。……家の陰へ', note:'夜に敵が村へ侵入したら警告する'},
{id:'village_thunder_village_note', p:263, when:c=>Boolean(c.env.isThundering&&c.x?.nearVillage===true&&c.danger.count===0), act:'say_only', say:'雷です。……村人さんは、家の中です。あなたも、どうですか', note:'雷雨の村では屋内への避難を促す'},
{id:'village_dawn_village_wake', p:261, when:c=>Boolean(c.env.isDawn&&c.x?.nearVillage===true&&c.danger.count===0), act:'greet', say:'おはようございます。……村も、起きる時間です', note:'夜明けの村では朝の挨拶をする'},
{id:'village_dusk_return_home_suggest', p:262, when:c=>Boolean(c.env.isDusk&&c.x?.nearVillage===true&&c.home.registered&&c.self.distHome>=24), act:'say_only', say:'夕方です。村人さんは、帰ります。……あなたも、帰る場所が、ありますよ', note:'夕方の村で、登録済みの帰る場所を思い出させる'},
];
