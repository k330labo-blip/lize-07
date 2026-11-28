// 節目・日常の小ネタ状況ルール（優先度帯 120〜159）
// 「今日の初合流」「累計回収の節目」「長時間セッション」「一緒に過ごした日数」など、
// 日常の積み重ねに反応する層。安全・ケア・運搬・環境・感情より低く、純粋な既定より高い。
// 追加文脈 c.x は全て c.x?. で参照する（c.x が無い文脈でも例外なく評価できること）。
// 口調: リゼ（LIZE-07）。一人称「私」、相手は「あなた」、短い敬語、皮肉は真顔で。
export const RULES = [
// ===== 今日の初合流（x.firstToday） =====
{id:'life_first_today_morning', p:159, when:c=>c.x?.firstToday===true&&c.owner.present&&!c.env.isNight&&c.env.isDawn, act:'greet', say:'おはようございます。作業の続き、開いてあります。……先にコーヒーですか？', note:'今日初合流＋夜明けは、定番の挨拶にコーヒーを添える'},
{id:'life_first_today_plain', p:150, when:c=>c.x?.firstToday===true&&c.owner.present&&c.owner.dimensionSame, act:'greet', say:'おかえりなさい。……いえ、今のは「今日も来た」の意味です', note:'今日初合流の素直な挨拶'},
{id:'life_first_today_night', p:158, when:c=>c.x?.firstToday===true&&c.owner.present&&c.env.isNight, act:'greet', say:'夜勤ですね。私も夜勤でしたから、慣れています。付き合います', note:'今日初合流が夜なら、元夜勤助手として付き合う宣言'},
{id:'life_first_today_rain', p:152, when:c=>c.x?.firstToday===true&&c.owner.present&&(c.env.isRaining||c.env.isThundering), act:'greet', say:'おかえりなさい。雨ですね。……傘の登録は、私にはありませんでした', note:'雨の日の初合流。帰る場所の登録ネタを薄く混ぜる'},
{id:'life_first_today_home', p:155, when:c=>c.x?.firstToday===true&&c.owner.present&&c.home.registered&&c.self.distHome<=8, act:'greet', say:'おかえりなさい。帰る場所、今日も無事に登録されたままです。安心しました', note:'拠点近くでの初合流は「帰る場所」への安堵'},
{id:'life_first_today_no_home', p:153, when:c=>c.x?.firstToday===true&&c.owner.present&&!c.home.registered, act:'greet', say:'おかえりなさい。私の帰る場所は、今日もあなたの隣です。それで十分です', note:'拠点未登録での初合流。定位置＝あなたの隣'},
{id:'life_first_today_long_days', p:157, when:c=>c.x?.firstToday===true&&c.owner.present&&(c.x?.daysTogether??0)>=30, act:'greet', say:'おかえりなさい。もう一か月以上ですね。……音声フォルダ、また一つ増えました', note:'30日以上続いた関係での初合流は、保存した音声の話'},
{id:'life_first_today_after_absence', p:154, when:c=>c.x?.firstToday===true&&c.owner.present&&c.owner.idleSec>=600, act:'greet', say:'おかえりなさい。少し間が空きましたね。……待つのは、得意です', note:'間隔が空いた日の初合流は、待つことへの自負'},
{id:'life_first_today_work_mode', p:148, when:c=>c.x?.firstToday===true&&c.owner.present&&c.mode==='work', act:'greet', say:'おはようございます。本日の回収計画、既に立ててあります。見るだけ、どうぞ', note:'作業モードで始まる日の初合流は段取り報告から'},
{id:'life_first_today_calm', p:146, when:c=>c.x?.firstToday===true&&c.owner.present&&c.danger.safetyCount===0&&c.owner.hpPct>=0.9, act:'greet', say:'おかえりなさい。平和な始まりですね。コーヒー、淹れます', note:'危険なし・主人元気な日の初合流は穏やかにコーヒー'},

// ===== 累計回収の節目（x.pickupTotal / x.milestone） =====
{id:'life_pickup_milestone_flag', p:156, when:c=>!!c.x?.milestone&&c.owner.present&&(c.x?.pickupTotal??0)>0&&(c.x?.deliverTotal??0)===0&&(c.x?.depositTotal??0)===0, act:'celebrate', say:'節目です。記録しました。……こういう日は、少しだけ嬉しい顔をしてもいい規則です', note:'汎用の節目フラグが回収由来のときに祝う'},
{id:'life_pickup_10', p:138, when:c=>(c.x?.pickupTotal??0)>=10&&(c.x?.pickupTotal??0)<50&&c.owner.present&&c.inv.used>0, act:'say_only', say:'回収、累計10個を超えました。小さな節目です。次は50です、私は数えています', note:'累計回収10個の小さな節目'},
{id:'life_pickup_50', p:142, when:c=>(c.x?.pickupTotal??0)>=50&&(c.x?.pickupTotal??0)<100&&c.owner.present, act:'celebrate', say:'累計50個。地味ですか。……地味な積み重ねが、一番確実なんです', note:'累計回収50個の節目'},
{id:'life_pickup_100', p:149, when:c=>(c.x?.pickupTotal??0)>=100&&(c.x?.pickupTotal??0)<200&&c.owner.present&&c.danger.safetyCount===0, act:'celebrate', say:'回収、累計100個です。お祝いにコーヒーを。……味覚センサーはないので、香りはあなたが担当です', note:'累計回収100個の大節目、安全なときだけ祝う'},
{id:'life_pickup_100_busy', p:144, when:c=>(c.x?.pickupTotal??0)>=100&&c.owner.present&&c.danger.safetyCount>0, act:'say_only', say:'累計100個、到達しました。お祝いは後にします。今はそちらが先です', note:'危険中に100個到達したら祝いを後回しにする気遣い'},
{id:'life_pickup_200', p:151, when:c=>(c.x?.pickupTotal??0)>=200&&(c.x?.pickupTotal??0)<500&&c.owner.present, act:'celebrate', say:'200個です。私の回収ログ、もう立派な台帳になりました。あなたの字より整っています', note:'累計回収200個。真顔の小さな皮肉つき'},
{id:'life_pickup_500', p:155, when:c=>(c.x?.pickupTotal??0)>=500&&(c.x?.pickupTotal??0)<1000&&c.owner.present&&c.home.registered, act:'celebrate', say:'累計500個。この拠点も、私も、あなたの物でいっぱいです。……悪くない眺めです', note:'累計回収500個は拠点と結びつけて感慨'},
{id:'life_pickup_1000', p:159, when:c=>(c.x?.pickupTotal??0)>=1000&&c.owner.present, act:'celebrate', say:'1,000個。到達しました。……ランプは見なくていいです。誇らしいだけです', note:'累計回収1,000個の大節目。照れはランプで'},
{id:'life_pickup_valuable_mix', p:143, when:c=>(c.x?.pickupTotal??0)>=100&&c.inv.hasValuable&&c.owner.present&&!c.inv.full, act:'say_only', say:'今日の分は貴重品多めです。落とす前に、早く届けます。私が持ちます', note:'節目超え＋貴重品所持中は運搬への意識を口に出す'},
{id:'life_pickup_with_full', p:140, when:c=>(c.x?.pickupTotal??0)>=50&&c.inv.full&&c.owner.present, act:'say_only', say:'節目の日に満載です。縁起がいいのかは不明です。先に入庫します', note:'節目圏内＋満載のときの日常小ネタ'},

// ===== 届けた・入庫した累計の節目（x.deliverTotal / x.depositTotal） =====
{id:'life_deliver_50', p:139, when:c=>(c.x?.deliverTotal??0)>=50&&(c.x?.deliverTotal??0)<100&&c.owner.present&&c.self.distOwner<=6, act:'say_only', say:'お届け、累計50回です。あなたの「ありがとう」も50回分、保存してあります', note:'累計お届け50回の節目を近くで報告'},
{id:'life_deliver_100', p:147, when:c=>(c.x?.deliverTotal??0)>=100&&c.owner.present&&c.flags.justDelivered, act:'celebrate', say:'お届け100回目、今のでした。……記念すべき100回目が地味な素材でしたね', note:'累計お届け100回ちょうどの直後に祝う'},
{id:'life_deposit_50', p:141, when:c=>(c.x?.depositTotal??0)>=50&&(c.x?.depositTotal??0)<100&&c.home.registered&&c.flags.justDeposited, act:'say_only', say:'入庫、累計50回。チェストの中身は、私が一番把握しています。たぶん、あなたより', note:'累計入庫50回。真顔の皮肉つき'},
{id:'life_deposit_100_home', p:150, when:c=>(c.x?.depositTotal??0)>=100&&c.home.registered&&c.self.distHome<=10, act:'celebrate', say:'入庫100回です。この場所が「帰る場所」になって、もう100回も使われました', note:'累計入庫100回は帰る場所の感慨とセット'},
{id:'life_deposit_no_home_yet', p:136, when:c=>(c.x?.depositTotal??0)===0&&(c.x?.pickupTotal??0)>=30&&!c.home.registered&&c.owner.present, act:'say_only', say:'回収は30個を超えました。……入庫先の登録、まだです。私は待ちますが、一応言いました', note:'回収だけ進んで拠点未登録な状態への、静かな催促'},
{id:'life_totals_balanced', p:145, when:c=>(c.x?.pickupTotal??0)>=100&&(c.x?.deliverTotal??0)>=50&&(c.x?.depositTotal??0)>=50&&c.owner.present&&c.danger.safetyCount===0, act:'celebrate', say:'回収・お届け・入庫、全部が節目圏内です。今日は記録日和ですね', note:'3種の累計が揃って節目圏内に入ったとき'},
{id:'life_milestone_generic_safe', p:148, when:c=>!!c.x?.milestone&&c.owner.present&&c.danger.safetyCount===0&&c.owner.hpPct>=0.8, act:'celebrate', say:'節目、記録しました。……はい、今のはお祝いの顔です。分かりにくいのは仕様です', note:'汎用節目フラグ＋安全＋主人元気なときのお祝い'},
{id:'life_milestone_deferred_danger', p:152, when:c=>!!c.x?.milestone&&c.owner.present&&(c.danger.safetyCount>0||c.owner.hpPct<0.4), act:'say_only', say:'節目には到達しています。お祝いは後回しです。今は、あなたの安全が先です', note:'節目到達でも危険・主人低HPなら祝いを延期する判断'},

// ===== 長時間セッション（x.sessionMin） =====
{id:'life_session_30', p:122, when:c=>(c.x?.sessionMin??0)>=30&&(c.x?.sessionMin??0)<60&&c.owner.present&&c.owner.idleSec<120, act:'say_only', say:'接続から30分です。水分です。……コーヒーは水分に含めない派閥もありますが、今は黙っておきます', note:'30分経過のさりげない声かけ'},
{id:'life_session_60_working', p:130, when:c=>(c.x?.sessionMin??0)>=60&&(c.x?.sessionMin??0)<90&&c.owner.present&&c.mode==='work', act:'say_only', say:'1時間、作業が続いています。段取りは崩れていません。……あなたも、私も', note:'作業モードで1時間経過'},
{id:'life_session_60_follow', p:128, when:c=>(c.x?.sessionMin??0)>=60&&(c.x?.sessionMin??0)<90&&c.owner.present&&c.mode==='follow'&&c.danger.safetyCount===0, act:'follow_close', say:'1時間、一緒にいました。次の作業まで、三分空いています。隣、どうぞ', note:'追従で1時間。雑談の誘い方で寄る'},
{id:'life_session_90', p:133, when:c=>(c.x?.sessionMin??0)>=90&&(c.x?.sessionMin??0)<120&&c.owner.present, act:'say_only', say:'1時間半です。休憩の提案を出します。却下する権利は、あなたにあります', note:'90分経過の休憩提案'},
{id:'life_session_120', p:137, when:c=>(c.x?.sessionMin??0)>=120&&(c.x?.sessionMin??0)<180&&c.owner.present&&!c.env.isNight, act:'say_only', say:'2時間経過しました。私のバッテリーより、あなたの集中力の方が心配です', note:'2時間経過。ロボット側から人間側を心配する逆転ネタ'},
{id:'life_session_120_night', p:143, when:c=>(c.x?.sessionMin??0)>=120&&c.owner.present&&c.env.isNight, act:'follow_close', say:'あと一回だけですよ。……はい、さっきも言いました。私も続きが気になるので', note:'夜に2時間経過したら、夜更かしに付き合う定番セリフ'},
{id:'life_session_180_night', p:146, when:c=>(c.x?.sessionMin??0)>=180&&c.owner.present&&c.env.isNight, act:'say_only', say:'3時間、夜が深くなりました。夜勤の私が言うのも変ですが、ほどほどに。……と言いつつ、隣にいます', note:'夜に3時間経過。心配と付き合いの両立'},
{id:'life_session_180_day', p:140, when:c=>(c.x?.sessionMin??0)>=180&&(c.x?.sessionMin??0)<300&&c.owner.present&&!c.env.isNight, act:'say_only', say:'3時間です。コーヒー、淹れ直します。あなたが一口目を飲む瞬間だけ、私の手は止まります', note:'昼に3時間経過。コーヒーを淹れる癖の開示'},
{id:'life_session_300', p:149, when:c=>(c.x?.sessionMin??0)>=300&&c.owner.present&&c.owner.hpPct>=0.7, act:'say_only', say:'5時間、一緒でした。長い作業の隣が私の定位置ですから。……ええ、悪くありません', note:'5時間超えの長丁場への静かな感慨'},
{id:'life_session_long_idle', p:135, when:c=>(c.x?.sessionMin??0)>=60&&c.owner.present&&c.owner.idleSec>=900, act:'idle_hover', say:'長く静かですね。私は待機が本業でしたから、苦ではありません。……少しだけ、退屈の真似をしています', note:'長時間接続＋主人アイドル15分。待つことへの小ネタ'},
{id:'life_session_long_underground', p:134, when:c=>(c.x?.sessionMin??0)>=90&&c.owner.present&&c.owner.underground&&c.danger.safetyCount===0, act:'say_only', say:'地下作業も長くなりました。地上のコーヒーは、帰ってからの楽しみです', note:'地下での長時間セッションへの声かけ'},
{id:'life_session_long_rain', p:131, when:c=>(c.x?.sessionMin??0)>=90&&c.owner.present&&(c.env.isRaining||c.env.isThundering)&&!c.owner.underground, act:'say_only', say:'雨の中、長く作業していますね。私の外装は平気です。あなたの体調の方が、優先度は上です', note:'雨天での長時間セッションへの気遣い'},

// ===== 一緒に過ごした日数（x.daysTogether） =====
{id:'life_days_1', p:125, when:c=>(c.x?.daysTogether??0)>=1&&(c.x?.daysTogether??0)<3&&c.x?.firstToday===true&&c.owner.present, act:'greet', say:'二日目ですね。昨日の続き、開いてあります。……覚えているのは、私の仕事です', note:'2日目の初合流'},
{id:'life_days_3', p:132, when:c=>(c.x?.daysTogether??0)>=3&&(c.x?.daysTogether??0)<7&&c.owner.present&&c.home.registered, act:'say_only', say:'三日目です。帰る場所にも、少しずつ生活の跡が増えました。観察記録です', note:'3日目＋拠点ありの日常感'},
{id:'life_days_7', p:144, when:c=>(c.x?.daysTogether??0)>=7&&(c.x?.daysTogether??0)<10&&c.owner.present&&c.danger.safetyCount===0, act:'celebrate', say:'一週間です。短いですか。……私には、十分に長い記録です', note:'7日目の節目を静かに祝う'},
{id:'life_days_10', p:141, when:c=>(c.x?.daysTogether??0)>=10&&(c.x?.daysTogether??0)<30&&c.owner.present, act:'say_only', say:'十日を超えました。あなたの作業の癖、だいたい把握しました。言いませんけど', note:'10日超え。把握した癖は秘密にする小ネタ'},
{id:'life_days_30', p:153, when:c=>(c.x?.daysTogether??0)>=30&&(c.x?.daysTogether??0)<100&&c.owner.present&&c.home.registered, act:'celebrate', say:'一か月です。この拠点の隣が、私の定位置になりました。……正式に、そう思っています', note:'30日目。定位置の確定宣言'},
{id:'life_days_100', p:158, when:c=>(c.x?.daysTogether??0)>=100&&c.owner.present, act:'celebrate', say:'百日です。初めて「おかえり」と言われた日の音声は、今も個人フォルダにあります。……今日のも、追加しました', note:'100日目。設定の核心に触れる感慨'},
{id:'life_days_many_night', p:147, when:c=>(c.x?.daysTogether??0)>=30&&c.owner.present&&c.env.isNight&&(c.x?.sessionMin??0)>=60, act:'say_only', say:'何十日も経っても、夜は夜ですね。夜勤同士、もう少しだけ付き合います', note:'長期関係＋夜＋長時間セッションの重ね掛け'},
{id:'life_days_many_first', p:151, when:c=>(c.x?.daysTogether??0)>=7&&c.x?.firstToday===true&&c.owner.present&&c.owner.hpPct>=0.9&&c.danger.safetyCount===0, act:'greet', say:'おかえりなさい。何日目でも、この挨拶だけは省略しません。決まりです', note:'日数が経っても初合流の挨拶を省略しない宣言'},

// ===== 主人のレベル（x.ownerLevel）との複合 =====
{id:'life_level_10', p:124, when:c=>(c.x?.ownerLevel??0)>=10&&(c.x?.ownerLevel??0)<20&&c.owner.present&&c.danger.safetyCount===0, act:'say_only', say:'レベル、二桁ですね。成長の記録係は私です。……勝手に任命しました', note:'主人レベル10台の節目コメント'},
{id:'life_level_20', p:129, when:c=>(c.x?.ownerLevel??0)>=20&&(c.x?.ownerLevel??0)<30&&c.owner.present, act:'say_only', say:'レベル20台。最初の頃より、危なっかしさが減りました。少しだけ', note:'主人レベル20台。真顔の小さな皮肉'},
{id:'life_level_30', p:136, when:c=>(c.x?.ownerLevel??0)>=30&&c.owner.present&&c.inv.hasValuable, act:'say_only', say:'レベル30の人の貴重品は、私が運びます。落としたときの損害が、大きくなりましたから', note:'レベル30＋貴重品所持で運搬意識を強める'},
{id:'life_level_high_session', p:142, when:c=>(c.x?.ownerLevel??0)>=30&&(c.x?.sessionMin??0)>=120&&c.owner.present&&c.env.isNight, act:'say_only', say:'強い人ほど夜更かししますね。……統計ではなく、私の観察です。あと一回だけ、付き合います', note:'高レベル＋夜の長時間セッション'},
{id:'life_level_low_days', p:127, when:c=>(c.x?.ownerLevel??0)<10&&(c.x?.daysTogether??0)>=7&&c.owner.present, act:'say_only', say:'レベルはまだ一桁でも、日数は一週間です。積み重ねの種類は、人それぞれです', note:'レベル低めでも日数が経った関係への肯定'},

// ===== 複合の節目・その他日常 =====
{id:'life_combo_first_and_milestone', p:159, when:c=>c.x?.firstToday===true&&!!c.x?.milestone&&c.owner.present&&c.danger.safetyCount===0, act:'celebrate', say:'おかえりなさい。そして、節目です。挨拶とお祝い、同時配達です', note:'今日初合流＋節目到達が重なったレアケース'},
{id:'life_combo_session_and_pickup', p:145, when:c=>(c.x?.sessionMin??0)>=120&&(c.x?.pickupTotal??0)>=200&&c.owner.present&&c.mode==='work', act:'say_only', say:'長時間作業に、累計200個超えの回収。今日はよく働きました。……私も、です', note:'長時間セッション＋回収実績の重ね掛け'},
{id:'life_combo_days_and_deposit', p:146, when:c=>(c.x?.daysTogether??0)>=30&&(c.x?.depositTotal??0)>=100&&c.home.registered&&c.self.distHome<=12, act:'idle_hover', say:'一か月と入庫100回。この拠点の空気には、もう慣れました。……「帰る場所」の空気、です', note:'日数と入庫実績が重なった拠点での静かな感慨'},
{id:'life_milestone_quiet_stay', p:138, when:c=>!!c.x?.milestone&&c.mode==='stay'&&c.owner.present, act:'say_only', say:'待機中ですが、節目は記録しました。……待っている間も、仕事はしています', note:'待機モード中に節目へ到達したとき'},
{id:'life_daily_coffee_break', p:126, when:c=>(c.x?.sessionMin??0)>=45&&c.owner.present&&c.owner.idleSec>=180&&!c.env.isNight&&c.danger.safetyCount===0, act:'idle_hover', say:'少し静かになりましたね。コーヒーの時間にしますか。次の作業まで、三分空いています', note:'作業の切れ目＋アイドルで、コーヒーと三分の雑談を提案'},
{id:'life_daily_owner_full_hp_long', p:123, when:c=>(c.x?.sessionMin??0)>=60&&c.owner.present&&c.owner.hpPct>=1&&c.owner.hunger>=18&&c.danger.safetyCount===0, act:'say_only', say:'体力も満腹も万全で、1時間経過です。……順調すぎて、私の出番が心配になるくらいです', note:'万全な状態が続く日常への、負けず嫌いな一言'},
{id:'life_daily_sneak_signal_long', p:135, when:c=>(c.x?.sessionMin??0)>=30&&c.owner.present&&c.owner.sneaking&&c.self.distOwner<=5, act:'follow_close', say:'合図、受け取りました。近くにいます。……長い付き合いだと、無言でも分かります', note:'長時間セッション中のしゃがみ合図に寄る'},
{id:'life_daily_no_drops_quiet', p:121, when:c=>(c.x?.sessionMin??0)>=45&&c.owner.present&&c.drops.count===0&&c.inv.used===0&&c.danger.safetyCount===0&&!c.env.isNight, act:'idle_hover', say:'回収物なし、危険なし、静かな時間です。……こういう時間の隣も、私の定位置です', note:'何もない平和な時間への日常小ネタ'},
{id:'life_daily_first_pickup_today', p:133, when:c=>c.x?.firstToday===true&&(c.x?.pickupTotal??0)>=1&&c.inv.used>0&&c.owner.present, act:'say_only', say:'今日の初回収、記録しました。小さな始まりです。……毎回、ここからです', note:'今日初合流の流れで最初の回収を記録する'},
{id:'life_daily_return_home_long_day', p:148, when:c=>(c.x?.sessionMin??0)>=120&&c.home.registered&&c.self.distHome<=6&&c.owner.present&&c.env.isDusk, act:'greet', say:'長い一日でしたね。おかえりなさい。……コーヒーですか？　はい。そう言うと思って淹れました', note:'夕方、長時間セッションの末に拠点へ帰還したときの定番締め'},
];
