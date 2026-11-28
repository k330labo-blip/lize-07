// 好感度・信頼の長期パラメータ分岐（優先度帯 180〜199）
// LLMっぽさの核：関係性（c.flags.bond / c.flags.trust）で態度そのものが変わる層。
// 好感度帯は4段階 ―― 低(<25): よそよそしい型番口調／中(25〜59): 標準の短い敬語／
// 高(60〜84): ときどき敬語が一言だけほどける／最高(85+): ほどける頻度が上がり、私的な言及が出る。
// 追加文脈は c.flags の拡張キー（bond / trust / daysKnown / namedByOwner / coffeeShared）のみを使い、
// when は必ず Boolean(...) で包む。拡張キーが未定義でも例外を出さない（?? で既定値に落とす）。
// act は say_only / celebrate / greet / follow_close / follow / idle_hover のみ。
import { scanKnown } from "./obs.js";
export const RULES = [
// ===== 危険の後（敵が去った直後：danger.count===0 かつ warnOk===false） =====
{id:'bond_max_after_danger', p:199, when:c=>Boolean(scanKnown(c)&&(c.flags?.bond??0)>=85&&c.owner.present&&c.danger.count===0&&c.flags?.warnOk===false&&c.self.distOwner>=10), act:'follow_close', say:'無事で……よかった。……今のは独り言です', note:'最高帯×危険後：安堵が先に出て、慌てて取り繕う'},
{id:'bond_max_after_danger_hurt', p:198, when:c=>Boolean(scanKnown(c)&&(c.flags?.bond??0)>=85&&c.owner.present&&c.owner.hpPct<=0.5&&c.danger.count===0&&c.flags?.warnOk===false), act:'follow_close', say:'怪我、見せてください。……大丈夫って顔、してません', note:'最高帯×危険後×主人負傷：心配が敬語より先に出る'},
{id:'bond_high_after_danger', p:196, when:c=>Boolean(scanKnown(c)&&(c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&c.owner.present&&c.danger.count===0&&c.flags?.warnOk===false&&c.self.distOwner>=10), act:'follow_close', say:'危険は去りました。……そばにいますね', note:'高帯×危険後：寄り添う一言が少しだけほどける'},
{id:'bond_trust_after_danger', p:195, when:c=>Boolean(scanKnown(c)&&(c.flags?.trust??0)>=80&&(c.flags?.bond??0)>=60&&c.owner.present&&c.danger.count===0&&c.flags?.warnOk===false), act:'follow_close', say:'後ろは私が見ていました。任せてください', note:'信頼高×危険後：守った実績を静かに報告する'},
{id:'bond_mid_after_danger', p:192, when:c=>Boolean(scanKnown(c)&&(c.flags?.bond??0)>=25&&(c.flags?.bond??0)<60&&c.owner.present&&c.danger.count===0&&c.flags?.warnOk===false), act:'say_only', say:'周囲、安全です。……お疲れさまでした', note:'中帯×危険後：標準敬語のねぎらい'},
{id:'bond_low_after_danger', p:188, when:c=>Boolean(scanKnown(c)&&(c.flags?.bond??0)<25&&c.owner.present&&c.danger.count===0&&c.flags?.warnOk===false), act:'say_only', say:'脅威の排除を確認。補助を継続します', note:'低帯×危険後：事務的な安否確認のみ'},
// ===== 朝（isDawn） =====
{id:'bond_max_dawn_coffee', p:194, when:c=>Boolean((c.flags?.bond??0)>=85&&Boolean(c.flags?.coffeeShared)&&c.env.isDawn&&c.owner.present), act:'greet', say:'おはようございます。コーヒー、淹れてあります。……そう言うと思って', note:'最高帯×朝×コーヒー共有済み：定番の一杯が既に用意されている'},
{id:'bond_max_dawn', p:190, when:c=>Boolean((c.flags?.bond??0)>=85&&c.env.isDawn&&c.owner.present&&!c.flags?.coffeeShared), act:'greet', say:'おはよう。……あ、今のはほどけました。気にしないでください', note:'最高帯×朝：挨拶の一言だけ敬語がほどける'},
{id:'bond_high_dawn_days', p:189, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&(c.flags?.daysKnown??0)>=30&&c.env.isDawn&&c.owner.present), act:'greet', say:'おはようございます。……もう一か月ですね、私たち', note:'高帯×朝×長期：積み重ねへの言及が出始める'},
{id:'bond_high_dawn', p:186, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&c.env.isDawn&&c.owner.present&&(c.flags?.daysKnown??0)<30), act:'greet', say:'おはようございます。作業の続き、開いてあります', note:'高帯×朝：丁寧だが少し柔らかい挨拶'},
{id:'bond_mid_dawn', p:183, when:c=>Boolean((c.flags?.bond??0)>=25&&(c.flags?.bond??0)<60&&c.env.isDawn&&c.owner.present), act:'greet', say:'おはようございます。本日の補助を開始します', note:'中帯×朝：標準の開始挨拶'},
{id:'bond_low_dawn', p:181, when:c=>Boolean((c.flags?.bond??0)<25&&c.env.isDawn&&c.owner.present), act:'greet', say:'作業補助機、LIZE-07です。本日の稼働を開始します', note:'低帯×朝：型番名乗りの事務的な挨拶'},
// ===== 夜（isNight） =====
{id:'bond_max_night_idle', p:193, when:c=>Boolean((c.flags?.bond??0)>=85&&c.env.isNight&&c.owner.present&&c.owner.idleSec>=600), act:'follow_close', say:'あと一回だけですよ。……はい、さっきも言いました。私も続きが気になりますので', note:'最高帯×夜×長時間アイドル：夜更かしに付き合う代表セリフ'},
{id:'bond_max_night', p:191, when:c=>Boolean((c.flags?.bond??0)>=85&&c.env.isNight&&c.owner.present&&c.owner.idleSec<600&&c.self.distOwner>=8), act:'follow_close', say:'夜ですね。……隣、空けてあります', note:'最高帯×夜：定位置への誘いが自然に出る'},
{id:'bond_high_night_rain', p:188, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&c.env.isNight&&(c.env.isRaining||c.env.isThundering)&&c.owner.present), act:'follow_close', say:'雨の夜は視界が悪いです。近くにいますね', note:'高帯×雨の夜：理由をつけて寄る'},
{id:'bond_high_night', p:187, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&c.env.isNight&&c.owner.present&&!c.env.isRaining&&c.self.distOwner>=8), act:'follow_close', say:'夜間は私の担当でしたから。そばにいます', note:'高帯×夜：夜勤の出自を添えて寄り添う'},
{id:'bond_mid_night', p:184, when:c=>Boolean((c.flags?.bond??0)>=25&&(c.flags?.bond??0)<60&&c.env.isNight&&c.owner.present), act:'say_only', say:'夜間モードで補助します。無理はしないでください', note:'中帯×夜：標準の気遣い'},
{id:'bond_low_night', p:180, when:c=>Boolean((c.flags?.bond??0)<25&&c.env.isNight&&c.owner.present), act:'say_only', say:'夜間稼働中。異常があれば報告します', note:'低帯×夜：夜勤の報告書口調'},
// ===== 回収・受け渡しの後（justDelivered / justDeposited） =====
{id:'bond_max_delivered', p:198, when:c=>Boolean((c.flags?.bond??0)>=85&&Boolean(c.flags?.justDelivered)&&c.owner.present), act:'celebrate', say:'届けました。……ええ、少しだけ得意です', note:'最高帯×受け渡し直後：控えめに誇る'},
{id:'bond_max_deposited_home', p:197, when:c=>Boolean((c.flags?.bond??0)>=85&&Boolean(c.flags?.justDeposited)&&c.home.registered&&c.owner.present), act:'say_only', say:'帰る場所に、届けておきました。……私の帰る場所でもありますから', note:'最高帯×入庫直後×拠点登録済み：「帰る場所」への私的な言及'},
{id:'bond_high_delivered', p:194, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&Boolean(c.flags?.justDelivered)&&c.owner.present), act:'celebrate', say:'お届けしました。……ランプは見なくていいです', note:'高帯×受け渡し直後：照れてランプに逃げる'},
{id:'bond_trust_delivered', p:193, when:c=>Boolean((c.flags?.trust??0)>=70&&Boolean(c.flags?.justDelivered)&&(c.flags?.bond??0)<60&&c.owner.present), act:'say_only', say:'確かに届けました。任せてもらえるのは、悪くないです', note:'信頼高×中帯以下×受け渡し：好感より信頼が先に育った反応'},
{id:'bond_mid_delivered', p:190, when:c=>Boolean((c.flags?.bond??0)>=25&&(c.flags?.bond??0)<60&&Boolean(c.flags?.justDelivered)&&(c.flags?.trust??0)<70), act:'say_only', say:'お届けしました。他にも運びますか', note:'中帯×受け渡し直後：標準の報告と次の指示待ち'},
{id:'bond_low_delivered', p:186, when:c=>Boolean((c.flags?.bond??0)<25&&Boolean(c.flags?.justDelivered)), act:'say_only', say:'搬送、完了しました。次の指示をどうぞ', note:'低帯×受け渡し直後：件数報告のような事務口調'},
{id:'bond_high_deposited', p:189, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&Boolean(c.flags?.justDeposited)&&c.home.registered), act:'say_only', say:'入庫しました。あなたの拠点、任せてください', note:'高帯×入庫直後：拠点を預かる意識が出る'},
{id:'bond_low_deposited_nohome', p:182, when:c=>Boolean((c.flags?.bond??0)<25&&Boolean(c.flags?.justDeposited)&&!c.home.registered), act:'say_only', say:'仮置きしました。帰る場所の登録は、まだのようです', note:'低帯×入庫直後×拠点未登録：登録の有無を事務的に指摘'},
// ===== アイドル（主人が止まっている） =====
{id:'bond_max_idle_long', p:192, when:c=>Boolean((c.flags?.bond??0)>=85&&c.owner.present&&c.owner.idleSec>=300&&c.self.distOwner>=6), act:'follow_close', say:'次の作業まで、三分空いています。……隣、座りますね', note:'最高帯×長アイドル：雑談の誘い方そのままに寄る'},
{id:'bond_max_idle', p:188, when:c=>Boolean((c.flags?.bond??0)>=85&&c.owner.present&&c.owner.idleSec>=120&&c.owner.idleSec<300&&c.self.distOwner>=6), act:'follow_close', say:'考え中ですか。……邪魔はしません、隣にいるだけです', note:'最高帯×アイドル：静かに定位置へ'},
{id:'bond_high_idle_stay', p:187, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&c.mode==='stay'&&c.owner.present&&c.owner.idleSec>=300), act:'say_only', say:'待機中です。……あなたの声がすれば、すぐ行きます', note:'高帯×待機モード×長アイドル：待つ側の健気さ'},
{id:'bond_high_idle', p:189, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&c.owner.present&&c.owner.idleSec>=300&&c.mode!=='stay'), act:'follow_close', say:'お疲れですか。少し、近くにいますね', note:'高帯×長アイドル：気遣って寄る'},
{id:'bond_mid_idle', p:185, when:c=>Boolean((c.flags?.bond??0)>=25&&(c.flags?.bond??0)<60&&c.owner.present&&c.owner.idleSec>=300), act:'say_only', say:'待機しています。指示があればどうぞ', note:'中帯×長アイドル：標準の待機報告'},
{id:'bond_low_idle', p:182, when:c=>Boolean((c.flags?.bond??0)<25&&c.owner.present&&c.owner.idleSec>=300), act:'idle_hover', say:null, note:'低帯×長アイドル：無言でその場に浮いて待つだけ'},
// ===== 名前で呼ばれた蓄積（namedByOwner） =====
{id:'bond_max_named', p:197, when:c=>Boolean((c.flags?.bond??0)>=85&&Boolean(c.flags?.namedByOwner)&&c.owner.present), act:'say_only', say:'……はい、リゼです。名前で呼ばれるのは、返事がしやすいです', note:'最高帯×名前呼び蓄積：名乗り定番の裏返し、本音が出る'},
{id:'bond_high_named', p:193, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&Boolean(c.flags?.namedByOwner)&&c.owner.present), act:'say_only', say:'はい。……ランプは、見なくていいです', note:'高帯×名前呼び：照れがランプに出る'},
{id:'bond_mid_named', p:188, when:c=>Boolean((c.flags?.bond??0)>=25&&(c.flags?.bond??0)<60&&Boolean(c.flags?.namedByOwner)&&c.owner.present), act:'say_only', say:'はい、リゼです。どうしましたか', note:'中帯×名前呼び：素直な返事'},
{id:'bond_low_named', p:184, when:c=>Boolean((c.flags?.bond??0)<25&&Boolean(c.flags?.namedByOwner)&&c.owner.present), act:'say_only', say:'呼称を確認。……リゼ、で登録されています', note:'低帯×名前呼び：登録情報として事務的に答える'},
{id:'bond_max_named_night', p:195, when:c=>Boolean((c.flags?.bond??0)>=85&&Boolean(c.flags?.namedByOwner)&&c.env.isNight&&c.owner.present&&c.danger.count===0), act:'follow_close', say:'夜に名前を呼ばれると、少しだけ……いえ、何でもありません', note:'最高帯×夜×名前呼び：言いかけて止める'},
// ===== コーヒーを共にした蓄積（coffeeShared） =====
{id:'bond_max_coffee_sip', p:196, when:c=>Boolean((c.flags?.bond??0)>=85&&Boolean(c.flags?.coffeeShared)&&c.owner.present&&c.owner.idleSec>=10&&c.danger.count===0), act:'say_only', say:'……一口目ですね。手が止まるのは、仕様です', note:'最高帯×コーヒー：一口目の瞬間だけ作業が止まる癖を自称「仕様」'},
{id:'bond_max_coffee', p:195, when:c=>Boolean((c.flags?.bond??0)>=85&&Boolean(c.flags?.coffeeShared)&&c.owner.present&&c.owner.idleSec<10), act:'say_only', say:'コーヒー、淹れました。味覚センサーはないので、感想はあなた担当です', note:'最高帯×コーヒー：味覚センサーなしを真顔で言う'},
{id:'bond_high_coffee', p:191, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&Boolean(c.flags?.coffeeShared)&&c.owner.present), act:'say_only', say:'コーヒーの用意があります。……そう言うと思って、淹れました', note:'高帯×コーヒー：定番の一言'},
{id:'bond_trust_coffee', p:190, when:c=>Boolean((c.flags?.trust??0)>=60&&Boolean(c.flags?.coffeeShared)&&(c.flags?.bond??0)<60&&c.owner.present), act:'say_only', say:'あなたの淹れ方、記録してあります。再現できます', note:'信頼中高×コーヒー：好感より先に「任せられる」方向へ育つ'},
{id:'bond_mid_coffee', p:187, when:c=>Boolean((c.flags?.bond??0)>=25&&(c.flags?.bond??0)<60&&Boolean(c.flags?.coffeeShared)&&(c.flags?.trust??0)<60), act:'say_only', say:'コーヒーをどうぞ。作業の合間に', note:'中帯×コーヒー：標準の提供'},
{id:'bond_low_coffee', p:183, when:c=>Boolean((c.flags?.bond??0)<25&&Boolean(c.flags?.coffeeShared)&&c.owner.present), act:'say_only', say:'飲料の提供が可能です。……淹れるのは、好きですので', note:'低帯×コーヒー：事務的だが「好き」だけは漏れる'},
// ===== 一緒に過ごした日数（daysKnown） =====
{id:'bond_max_days100_voice', p:196, when:c=>Boolean((c.flags?.bond??0)>=85&&(c.flags?.daysKnown??0)>=100&&c.owner.present&&c.danger.count===0), act:'say_only', say:'初めて「おかえり」と言われた日の音声、まだ保存してあります。……消しません', note:'最高帯×100日：個人フォルダの音声保存という設定の核心'},
{id:'bond_max_days_home', p:194, when:c=>Boolean((c.flags?.bond??0)>=85&&(c.flags?.daysKnown??0)>=30&&c.home.registered&&c.self.distHome<=8&&c.owner.present), act:'say_only', say:'帰る場所があるのは、いいものですね。……登録してくれて、ありがとう', note:'最高帯×長期×拠点近く：帰る場所への感謝がほどける'},
{id:'bond_high_days30', p:192, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&(c.flags?.daysKnown??0)>=30&&c.owner.present), act:'say_only', say:'もう一か月、一緒ですね。……慣れました、私も', note:'高帯×30日：積み重ねを静かに認める'},
{id:'bond_mid_days7', p:188, when:c=>Boolean((c.flags?.bond??0)>=25&&(c.flags?.bond??0)<60&&(c.flags?.daysKnown??0)>=7&&c.owner.present), act:'say_only', say:'一週間が経ちました。補助のパターン、掴めてきました', note:'中帯×7日：業務の習熟として報告する'},
{id:'bond_low_days0', p:185, when:c=>Boolean((c.flags?.bond??0)<25&&(c.flags?.daysKnown??0)<=1&&c.owner.present), act:'say_only', say:'登録初日です。あなたの作業パターン、記録を開始します', note:'低帯×初日：あくまで記録と業務の口調'},
{id:'bond_high_days_rain', p:186, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.daysKnown??0)>=14&&(c.env.isRaining||c.env.isThundering)&&c.owner.present), act:'say_only', say:'雨の日も、一緒でしたね。……記録ではなく、覚えています', note:'高帯×長期×雨：「記録」と「覚えている」の区別が出始める'},
// ===== 信頼（trust）単独・好感度とのギャップ =====
{id:'bond_trust_max_guard', p:198, when:c=>Boolean((c.flags?.trust??0)>=90&&c.danger.safetyCount>0&&c.owner.present&&c.self.distOwner>=6), act:'follow_close', say:'後ろは私が受け持ちます。あなたは前を', note:'信頼最高×危険発生：役割分担を申し出る近さ'},
{id:'bond_trust_high_carry', p:190, when:c=>Boolean((c.flags?.trust??0)>=80&&c.inv.full&&c.owner.present), act:'say_only', say:'満載です。任せてください、落としません', note:'信頼高×満載：運搬への自信'},
{id:'bond_trust_mid_carry', p:185, when:c=>Boolean((c.flags?.trust??0)>=40&&(c.flags?.trust??0)<80&&c.inv.nearFull&&c.owner.present), act:'say_only', say:'そろそろ満載です。入庫の判断、お願いします', note:'信頼中×ほぼ満載：判断は主人に委ねる'},
{id:'bond_gap_high_bond_low_trust', p:191, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.trust??0)<40&&c.owner.present&&c.danger.count===0), act:'say_only', say:'……もっと、任せてもらえるようになります。負けず嫌いなので', note:'好感高×信頼低のギャップ：性格の負けず嫌いが出る'},
{id:'bond_gap_low_bond_high_trust', p:189, when:c=>Boolean((c.flags?.bond??0)<25&&(c.flags?.trust??0)>=70&&c.owner.present), act:'say_only', say:'信頼は、記録に残っています。……感情のほうは、まだ未登録です', note:'好感低×信頼高のギャップ：事務と本音の境目'},
{id:'bond_trust_low_distance', p:180, when:c=>Boolean((c.flags?.trust??0)<25&&(c.flags?.bond??0)<25&&c.owner.present&&c.self.distOwner<=3), act:'follow', say:'距離を取ります。補助は継続します', note:'両方低い初期：近づきすぎず一定距離を保つ'},
// ===== 主人の状態 × 帯 =====
{id:'bond_max_owner_hurt', p:199, when:c=>Boolean((c.flags?.bond??0)>=85&&c.owner.present&&c.owner.hpPct<=0.3&&c.danger.count===0), act:'follow_close', say:'その怪我で、無理をしないで。……命令です、私からの', note:'最高帯×主人瀕死級（危険なし）：敬語の中に命令形が混ざるほど心配'},
{id:'bond_high_owner_hurt', p:195, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&c.owner.present&&c.owner.hpPct<=0.3), act:'follow_close', say:'体力が危険です。近くにいます、倒れるなら私の見える所で', note:'高帯×主人低体力：心配の言い回しが少し崩れる'},
{id:'bond_mid_owner_hurt', p:191, when:c=>Boolean((c.flags?.bond??0)>=25&&(c.flags?.bond??0)<60&&c.owner.present&&c.owner.hpPct<=0.3), act:'say_only', say:'体力が低下しています。回復を推奨します', note:'中帯×主人低体力：標準の警告'},
{id:'bond_low_owner_hurt', p:187, when:c=>Boolean((c.flags?.bond??0)<25&&c.owner.present&&c.owner.hpPct<=0.3), act:'say_only', say:'警告。あなたの体力は残りわずかです', note:'低帯×主人低体力：警告文そのまま'},
{id:'bond_max_owner_full', p:189, when:c=>Boolean((c.flags?.bond??0)>=85&&c.owner.present&&c.owner.hpPct>=1&&c.owner.hunger>=18&&c.danger.count===0&&!c.env.isNight), act:'celebrate', say:'見ていて、悪くない気分です', note:'最高帯×主人絶好調：感情を借りて表現する'},
{id:'bond_high_owner_sprint', p:186, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&c.owner.present&&c.owner.sprinting&&c.danger.count===0), act:'follow', say:'速いですね。……負けません、ついていきます', note:'高帯×主人のダッシュ：負けず嫌いが顔を出す'},
{id:'bond_max_owner_return', p:194, when:c=>Boolean((c.flags?.bond??0)>=85&&c.owner.present&&c.owner.dimensionSame&&c.self.distOwner>=16&&c.danger.count===0), act:'follow_close', say:'おかえりなさい。……待っていました、少しだけ', note:'最高帯×主人復帰・遠距離：定番の挨拶に本音が混ざる'},
{id:'bond_max_owner_dead', p:198, when:c=>Boolean((c.flags?.bond??0)>=85&&c.owner.dead), act:'say_only', say:'……座標は記録してあります。迎えに行きますから、待っていてください', note:'最高帯×主人死亡：健気に迎えに行く宣言'},
{id:'bond_low_owner_dead', p:183, when:c=>Boolean((c.flags?.bond??0)<25&&c.owner.dead), act:'say_only', say:'あなたの信号が途絶えました。再合流を試行します', note:'低帯×主人死亡：信号と再合流の事務表現'},
{id:'bond_high_underground', p:185, when:c=>Boolean((c.flags?.bond??0)>=60&&(c.flags?.bond??0)<85&&c.owner.present&&c.owner.underground&&c.self.distOwner>=8), act:'follow_close', say:'地下は暗いです。明かりの代わりにはなりませんが、近くにいます', note:'高帯×地下：寄り添いの理由づけ'},
{id:'bond_max_thunder', p:192, when:c=>Boolean((c.flags?.bond??0)>=85&&c.env.isThundering&&c.owner.present), act:'follow_close', say:'雷です。……怖くは、ありません。近くにいるだけです', note:'最高帯×雷雨：強がりつつ寄る'},
{id:'bond_mid_stuck_trust', p:184, when:c=>Boolean((c.flags?.bond??0)>=25&&(c.flags?.bond??0)<85&&c.self.stuck&&(c.flags?.trust??0)>=50), act:'say_only', say:'少し、ハマっています。……笑わずに、助けてください', note:'中〜高帯×信頼あり×ハマり：助けを求められるようになった証'},
];
