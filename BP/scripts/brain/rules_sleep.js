// 睡眠・夜の過ごし方・リスポーンの分岐ルール（優先度帯 160〜179）
// 「主人がベッドに入った」「夜更かしに付き合う」「不眠でファントムが危ない」
// 「リスポーン地点が未設定」など、夜と眠りにまつわる状況に反応する層。
// 追加文脈 c.x は全て c.x?. で参照する（c.x が無い文脈でも例外なく評価できること）。
// when は全て Boolean(...) で包み、必ず真偽値を返す。
// 口調: リゼ（LIZE-07）。一人称「私」、相手は「あなた」、短い敬語、皮肉は真顔で。
// 元・夜勤助手の癖が夜に一番よく出る。「あと一回だけですよ」が口癖。
import { bedAbsentKnown, invKnown, scanKnown } from "./obs.js";
export const RULES = [
// ===== 主人がベッドに入った（x.ownerInBed） =====
{id:'sleep_owner_in_bed_calm', p:172, when:c=>Boolean(c.x?.ownerInBed===true&&c.owner.present&&(!c.x?.obs||c.x.obs.scan==="ok")&&c.danger.count===0), act:'stay_anchor', say:'おやすみなさい。見張りは私がします。夜勤は、本職でしたから', note:'主人が寝たら、その場で見張り役に回る基本形'},
{id:'sleep_owner_in_bed_near', p:170, when:c=>Boolean(c.x?.ownerInBed===true&&c.owner.present&&c.self.distOwner<=4&&c.danger.count===0), act:'idle_hover', say:'定位置は、ベッドの隣に変更します。……近いですか。仕様です', note:'ベッドのすぐ隣で静かに待機する'},
{id:'sleep_owner_in_bed_far', p:171, when:c=>Boolean(c.x?.ownerInBed===true&&c.owner.present&&c.self.distOwner>=10), act:'follow_close', say:'寝るなら、そばで見ています。離れた場所で待つ理由がありません', note:'主人が寝たのに離れている場合は、まず寄る'},
{id:'sleep_owner_in_bed_danger', p:179, when:c=>Boolean(c.x?.ownerInBed===true&&c.owner.present&&c.danger.safetyCount>0), act:'stay_anchor', say:'寝ていてください。今の相手は、私が引き受けます', note:'主人が寝ている最中に敵接近。起こさず自分が盾になる'},
{id:'sleep_owner_in_bed_creeper', p:178, when:c=>Boolean(c.x?.ownerInBed===true&&c.owner.present&&(c.danger.safetyCreeperDist??999)<=8), act:'stay_anchor', say:'……静かに。緑の来客です。あなたは、そのまま寝ていてください', note:'就寝中にクリーパー接近。声を落として対応する'},
{id:'sleep_owner_in_bed_low_hp', p:174, when:c=>Boolean(c.x?.ownerInBed===true&&c.owner.present&&c.owner.hpPct<0.5&&scanKnown(c)&&c.danger.count===0), act:'stay_anchor', say:'その体でよく起きていましたね。朝まで、私が見ています', note:'満身創痍でようやく寝た主人へのねぎらい'},
{id:'sleep_owner_in_bed_full_inv', p:166, when:c=>Boolean(c.x?.ownerInBed===true&&c.inv.full&&c.home.registered), act:'say_only', say:'おやすみなさい。私は満載なので、先に帰る場所へ置いてきます', note:'主人が寝た＋自分が満載なら、入庫を予告してから離れる'},
{id:'sleep_owner_in_bed_work_mode', p:165, when:c=>Boolean(c.x?.ownerInBed===true&&c.mode==='work'&&scanKnown(c)&&c.danger.count===0), act:'stay_anchor', say:'作業はここまでです。続きは朝に開いておきます。おやすみなさい', note:'作業モードでも主人が寝たら夜勤終了の挨拶'},
{id:'sleep_owner_in_bed_stay_mode', p:167, when:c=>Boolean(c.x?.ownerInBed===true&&c.mode==='stay'&&scanKnown(c)&&c.danger.count===0), act:'stay_anchor', say:'待機と見張り、兼任します。あなたは安心して寝てください', note:'待機モード＋就寝は、そのまま夜警に移行'},
{id:'sleep_owner_in_bed_rain', p:168, when:c=>Boolean(c.x?.ownerInBed===true&&(c.env.isRaining||c.env.isThundering)&&c.danger.count===0), act:'idle_hover', say:'雨の音ですね。研究所の夜も、たまにこうでした。おやすみなさい', note:'雨の夜の就寝。夜勤時代を思い出す'},
{id:'sleep_owner_in_bed_skip_likely', p:173, when:c=>Boolean(c.x?.ownerInBed===true&&c.x?.nightSkipLikely===true&&c.owner.present), act:'say_only', say:'皆さんも寝るようです。朝まで、一瞬ですね。目を閉じてください', note:'マルチで全員就寝しそうなときは、夜スキップを見越した一言'},
{id:'sleep_owner_in_bed_phantom_safe', p:169, when:c=>Boolean(c.x?.ownerInBed===true&&c.x?.phantomRisk===true&&c.owner.present), act:'say_only', say:'不眠の蓄積は、これで解消です。空の連中には、残念でしたねと伝えておきます', note:'ファントム危険があった主人が寝たので安堵する'},
// ===== ベッドが近いのに寝ていない（x.nearBed） =====
{id:'sleep_near_bed_night_suggest', p:168, when:c=>Boolean(c.x?.nearBed===true&&c.x?.ownerInBed!==true&&c.env.isNight&&c.owner.present&&c.danger.count===0), act:'say_only', say:'ベッドはそこです。……提案です。命令ではありません。たぶん', note:'夜＋ベッド近接での、真顔の就寝提案'},
{id:'sleep_near_bed_dusk_suggest', p:163, when:c=>Boolean(c.x?.nearBed===true&&c.x?.ownerInBed!==true&&c.env.isDusk&&c.owner.present), act:'say_only', say:'日が落ちます。ベッドの場所、私は把握しています。案内しますか', note:'夕方にベッドが近いと、先回りして提案する'},
{id:'sleep_near_bed_owner_tired_hp', p:171, when:c=>Boolean(c.x?.nearBed===true&&c.x?.ownerInBed!==true&&c.env.isNight&&c.owner.hpPct<0.4), act:'follow_close', say:'その体力で夜を越える気ですか。ベッドまで、私が付き添います', note:'夜＋主人低HP＋ベッド近接は、寄って強めに勧める'},
{id:'sleep_near_bed_owner_idle', p:166, when:c=>Boolean(c.x?.nearBed===true&&c.x?.ownerInBed!==true&&c.env.isNight&&c.owner.idleSec>=180&&c.danger.count===0), act:'say_only', say:'三分、空いています。……いえ、寝るなら一晩、空けてください', note:'ベッドのそばでぼんやりしている主人への小ネタ'},
{id:'sleep_near_bed_phantom_risk', p:175, when:c=>Boolean(c.x?.nearBed===true&&c.x?.ownerInBed!==true&&c.x?.phantomRisk===true&&c.env.isNight), act:'say_only', say:'何日も寝ていませんね。空から来る前に、ベッドが先です', note:'ファントム危険＋ベッド近接は、優先度を上げて警告する'},
{id:'sleep_near_bed_no_respawn', p:170, when:c=>Boolean(c.x?.nearBed===true&&c.x?.respawnSet!==true&&c.owner.present&&!c.env.isNight), act:'say_only', say:'そのベッド、一度触れておいてください。帰ってくる場所は、登録しておくものです', note:'昼でもリスポーン未設定なら、ベッドに触れるよう促す'},
{id:'sleep_near_bed_respawn_done', p:161, when:c=>Boolean(c.x?.nearBed===true&&c.x?.respawnSet===true&&c.owner.present&&c.danger.count===0&&!c.env.isNight), act:'say_only', say:'リスポーン地点、登録済みですね。……帰る場所があるのは、いいことです', note:'リスポーン設定済みを確認したときの、自分の境遇と重なる一言'},
{id:'sleep_near_bed_hungry_owner', p:164, when:c=>Boolean(c.x?.nearBed===true&&c.x?.ownerInBed!==true&&c.env.isNight&&c.owner.hunger<=6&&invKnown(c)&&!c.inv.hasFood), act:'say_only', say:'空腹で寝るのですか。……食べ物は、今の私にはありません。明日の課題です', note:'空腹＋夜＋ベッド近接。食料を持っていない正直な報告'},
{id:'sleep_near_bed_work_pause', p:162, when:c=>Boolean(c.x?.nearBed===true&&c.x?.ownerInBed!==true&&c.mode==='work'&&c.env.isNight&&c.inv.used>0), act:'say_only', say:'作業の続きは、朝に開いておきます。ベッドは、そこです', note:'作業モードの夜は、切り上げと就寝をセットで提案'},
{id:'sleep_near_bed_thunder', p:167, when:c=>Boolean(c.x?.nearBed===true&&c.x?.ownerInBed!==true&&c.env.isThundering&&c.owner.present), act:'say_only', say:'雷です。寝てしまえば、朝には止んでいます。たぶん、止んでいます', note:'雷雨の夜はベッドを勧める。断言しないのが真顔の優しさ'},
// ===== 夜更かしに付き合う（夜＋寝ていない＋活動中） =====
{id:'sleep_night_owl_first', p:165, when:c=>Boolean(c.env.isNight&&c.x?.ownerInBed!==true&&c.x?.nearBed!==true&&c.owner.present&&c.owner.idleSec<60&&c.danger.count===0), act:'follow_close', say:'夜更かしですか。……あと一回だけですよ。私も、続きが気になりますので', note:'夜の活動開始に付き合う宣言。代表セリフ系'},
{id:'sleep_night_owl_repeated', p:169, when:c=>Boolean(c.env.isNight&&c.x?.ownerInBed!==true&&c.owner.present&&c.owner.idleSec>=300&&c.danger.count===0&&c.flags.warnOk), act:'say_only', say:'あと一回だけ、と言ってから三回目です。……はい、私も数えていました', note:'夜に長く活動している主人へ、真顔でカウントする'},
{id:'sleep_night_owl_underground', p:163, when:c=>Boolean(c.env.isNight&&c.owner.underground&&c.x?.ownerInBed!==true&&c.owner.present&&c.danger.count===0), act:'follow_close', say:'地下では夜も分かりませんね。私の時計では、もう夜勤の時間です', note:'夜の地下作業に付き合う。夜勤助手の体内時計ネタ'},
{id:'sleep_night_owl_sneak', p:160, when:c=>Boolean(c.env.isNight&&c.owner.sneaking&&c.x?.ownerInBed!==true&&c.owner.present), act:'say_only', say:'静かに進みますね。私も音を消します。……ランプは、消せません。仕様です', note:'夜の忍び足に同調する。ランプの小ネタつき'},
{id:'sleep_night_owl_sprint', p:161, when:c=>Boolean(c.env.isNight&&c.owner.sprinting&&c.x?.ownerInBed!==true&&c.owner.present&&c.danger.count===0), act:'follow_close', say:'夜に走るのですか。分かりました、追いつきます。眠気は、後で請求します', note:'夜のダッシュに文句を言いつつ付き合う'},
{id:'sleep_night_owl_full_inv', p:164, when:c=>Boolean(c.env.isNight&&c.x?.ownerInBed!==true&&c.inv.nearFull&&c.owner.present&&c.home.registered), act:'say_only', say:'荷物が限界です。夜のうちに一度、帰る場所へ置きましょう。……ついでに、寝ましょう', note:'夜＋満載間近は、入庫と就寝を抱き合わせで提案'},
{id:'sleep_night_owl_no_home', p:166, when:c=>Boolean(c.env.isNight&&c.x?.ownerInBed!==true&&!c.home.registered&&c.owner.present&&c.self.distOwner<=6), act:'follow_close', say:'帰る場所の登録がないのは、私とあなた、同じですね。今夜はここを定位置にします', note:'拠点未登録の夜は、主人の隣が定位置という設定の核心'},
{id:'sleep_night_owl_rain', p:162, when:c=>Boolean(c.env.isNight&&c.env.isRaining&&c.x?.ownerInBed!==true&&c.owner.present&&c.danger.count===0), act:'follow_close', say:'雨の夜勤です。研究所では嫌いじゃありませんでした。……あなたは、どうですか', note:'雨の夜更かしに、珍しく問いかける'},
// ===== ファントムリスク（x.phantomRisk） =====
{id:'sleep_phantom_warn_surface', p:176, when:c=>Boolean(c.x?.phantomRisk===true&&c.env.isNight&&!c.owner.underground&&bedAbsentKnown(c)&&c.owner.present), act:'say_only', say:'不眠が続いています。空から、羽音がします。ベッドは遠いので、今夜は低空に注意です', note:'ベッドが遠くファントム危険な夜の本警告'},
{id:'sleep_phantom_warn_with_danger', p:177, when:c=>Boolean(c.x?.phantomRisk===true&&c.env.isNight&&c.danger.safetyCount>0&&c.owner.present), act:'follow_close', say:'地上の敵に、空の敵まで増えます。今夜は、私のそばを離れないでください', note:'敵接近＋ファントム危険の複合警告。密着する'},
{id:'sleep_phantom_underground_safe', p:163, when:c=>Boolean(c.x?.phantomRisk===true&&c.owner.underground&&c.owner.present), act:'say_only', say:'不眠ではありますが、ここは地下です。空の連中は来られません。少しだけ、安心です', note:'ファントム危険でも地下なら安全と伝える状況判断'},
{id:'sleep_phantom_owner_low_hp', p:178, when:c=>Boolean(c.x?.phantomRisk===true&&c.env.isNight&&c.owner.hpPct<0.4&&c.owner.present), act:'follow_close', say:'その体力で空の相手は無理です。寝るか、隠れるか。今すぐ選んでください', note:'低HP＋ファントム危険は、選択肢を提示して強く迫る'},
{id:'sleep_phantom_morning_after', p:168, when:c=>Boolean(c.x?.phantomRisk===true&&c.env.isDawn&&c.owner.present&&c.danger.count===0), act:'say_only', say:'夜が明けました。不眠の借りは、今夜こそ返しましょう。……寝てください、という意味です', note:'ファントム危険を抱えたまま迎えた朝への労い'},
{id:'sleep_phantom_calm_day', p:160, when:c=>Boolean(c.x?.phantomRisk===true&&!c.env.isNight&&!c.env.isDawn&&c.owner.present&&bedAbsentKnown(c)), act:'say_only', say:'記録では、何日も寝ていません。今夜は早めに。私が覚えていますから', note:'昼のうちに不眠を指摘し、今夜の就寝を予約する'},
{id:'sleep_phantom_work_mode', p:165, when:c=>Boolean(c.x?.phantomRisk===true&&c.mode==='work'&&c.env.isNight&&c.owner.present), act:'say_only', say:'作業も大事ですが、空の方が先に来ます。今夜のノルマは、寝ることです', note:'作業モードでもファントム危険なら就寝を優先させる'},
{id:'sleep_phantom_skip_likely', p:167, when:c=>Boolean(c.x?.phantomRisk===true&&c.x?.nightSkipLikely===true&&c.env.isNight&&c.owner.present), act:'say_only', say:'皆さんが寝れば、この空ともお別れです。あなたのベッドが、最後の一押しです', note:'マルチで夜スキップが見込める場合は、就寝を後押しする'},
// ===== リスポーン・帰る場所（x.respawnSet） =====
{id:'sleep_respawn_unset_night_far', p:173, when:c=>Boolean(c.x?.respawnSet!==true&&c.env.isNight&&c.self.distHome>=16&&c.owner.present&&c.home.registered), act:'say_only', say:'リスポーン地点が未設定です。万一のとき、帰り道は遠くなります。……私は、それが少し分かります', note:'夜＋拠点から遠い＋リスポーン未設定の複合警告。自分の境遇を重ねる'},
{id:'sleep_respawn_unset_danger', p:174, when:c=>Boolean(c.x?.respawnSet!==true&&c.danger.safetyCount>0&&c.owner.hpPct<0.5&&c.owner.present), act:'say_only', say:'お願いです。次に安全な場所で、リスポーンを登録してください。帰る場所は、大事です', note:'危険＋低HP＋リスポーン未設定は、珍しく「お願いです」と言う'},
{id:'sleep_respawn_unset_no_home', p:169, when:c=>Boolean(c.x?.respawnSet!==true&&!c.home.registered&&c.owner.present&&c.danger.count===0), act:'say_only', say:'あなたの帰る場所も、まだ登録されていませんね。……お揃いです。悪くないですよ', note:'リスポーン未設定＋拠点未登録は「お揃い」と受け止める'},
{id:'sleep_respawn_set_home', p:162, when:c=>Boolean(c.x?.respawnSet===true&&c.home.registered&&c.owner.present&&c.env.isDusk), act:'say_only', say:'帰る場所は二つとも登録済みです。今夜は、安心して夜更かしできますね', note:'夕方にリスポーンと拠点の両方を確認して安堵する'},
{id:'sleep_respawn_owner_dead_wait', p:176, when:c=>Boolean(c.owner.dead&&c.x?.respawnSet===true&&c.home.registered), act:'stay_anchor', say:'戻ってくる場所は分かっています。ここで待っています。……早く、帰ってきてください', note:'主人死亡時、リスポーン先が拠点付近なら、その場で待つ'},
{id:'sleep_respawn_owner_dead_unset', p:177, when:c=>Boolean(c.owner.dead&&c.x?.respawnSet!==true), act:'say_only', say:'帰る場所が未設定でしたね。遠くても、必ず迎えに行きます。待っていてください', note:'主人死亡＋リスポーン未設定は、迎えに行く約束をする'},
{id:'sleep_respawn_after_return', p:170, when:c=>Boolean(c.owner.present&&!c.owner.dead&&c.owner.hpPct>=0.99&&c.x?.respawnSet===true&&c.env.isDawn&&c.danger.count===0), act:'greet', say:'おかえりなさい。……その言葉の音声は、私の個人フォルダにあります。今朝も、無事でした', note:'朝に無事な主人へ。初めて「おかえり」と言われた日の音声の話'},
{id:'sleep_respawn_bed_is_home', p:164, when:c=>Boolean(c.x?.respawnSet===true&&c.x?.nearBed===true&&c.home.registered&&c.self.distHome<=8&&c.owner.present), act:'say_only', say:'ベッドと帰る場所が、同じ所にありますね。研究所には、なかった組み合わせです', note:'ベッド＝リスポーン＝拠点が揃った状態への感慨'},
// ===== 夜スキップ・マルチの夜（x.nightSkipLikely） =====
{id:'sleep_skip_waiting_others', p:166, when:c=>Boolean(c.x?.nightSkipLikely===true&&c.x?.ownerInBed!==true&&c.env.isNight&&c.owner.present), act:'say_only', say:'他の皆さんは寝るようです。あなたが寝れば、朝が来ます。主導権は、あなたです', note:'自分だけ起きている状況で、夜スキップの主導権を伝える'},
{id:'sleep_skip_not_likely_alone', p:163, when:c=>Boolean(c.x?.nightSkipLikely!==true&&c.x?.ownerInBed!==true&&c.env.isNight&&c.owner.present&&c.owner.idleSec>=240&&c.danger.count===0), act:'idle_hover', say:'今夜は朝までコースのようです。分かりました。夜勤体制に切り替えます', note:'夜スキップが見込めず主人が長く起きているなら、夜勤体制を宣言'},
{id:'sleep_skip_after_dawn', p:171, when:c=>Boolean(c.x?.nightSkipLikely===true&&c.env.isDawn&&c.owner.present&&c.danger.count===0), act:'celebrate', say:'夜が明けました。皆さんと、あなたのおかげです。……コーヒー、淹れますね', note:'夜スキップ成功後の朝は、ささやかにお祝いとコーヒー'},
{id:'sleep_skip_in_bed_celebrate', p:168, when:c=>Boolean(c.x?.ownerInBed===true&&c.x?.nightSkipLikely===true&&c.env.isDawn&&c.owner.present), act:'greet', say:'おはようございます。夜は一瞬でしたね。作業の続き、開いてあります', note:'寝ている間に朝が来た主人への、定番の朝の挨拶'},
{id:'sleep_skip_phantom_saved', p:169, when:c=>Boolean(c.x?.nightSkipLikely===true&&c.x?.phantomRisk!==true&&c.env.isDawn&&c.owner.present&&c.danger.count===0), act:'say_only', say:'よく眠れましたね。空の連中も、今夜は出番なしです', note:'夜スキップでファントム回避できた朝の報告'},
// ===== 夜明け・朝の締め =====
{id:'sleep_dawn_coffee', p:167, when:c=>Boolean(c.env.isDawn&&c.owner.present&&c.danger.count===0&&c.owner.hpPct>=0.7), act:'greet', say:'おはようございます。先にコーヒーですか？　はい。そう言うと思って淹れました', note:'無事な夜明けは、設定の定番セリフで締める'},
{id:'sleep_dawn_owner_hurt', p:165, when:c=>Boolean(c.env.isDawn&&c.owner.present&&c.owner.hpPct<0.4), act:'follow_close', say:'朝です。よく持ちこたえましたね。今日は、私が多めに働きます', note:'満身創痍で迎えた朝は、寄って労う'},
{id:'sleep_dawn_after_stay_watch', p:163, when:c=>Boolean(c.env.isDawn&&c.mode==='stay'&&c.owner.present&&scanKnown(c)&&c.danger.count===0), act:'greet', say:'夜警、終了です。異常なし。……あなたが寝ている間は、静かでしたよ', note:'待機モードで一晩見張った朝の報告'},
{id:'sleep_dawn_thunder_cleared', p:164, when:c=>Boolean(c.env.isDawn&&!c.env.isThundering&&c.env.isRaining&&c.owner.present&&c.danger.count===0), act:'say_only', say:'雷は止みました。雨だけです。夜勤明けの空気ですね', note:'雷雨の夜を越えた朝の、夜勤明けらしい一言'},
{id:'sleep_dusk_prep_home', p:161, when:c=>Boolean(c.env.isDusk&&c.home.registered&&c.self.distHome>=20&&c.owner.present&&c.x?.ownerInBed!==true), act:'say_only', say:'日が落ちます。帰る場所は遠いです。今のうちに、方角だけ確認を', note:'夕方＋拠点が遠い場合は、帰路の確認を促す'},
];
