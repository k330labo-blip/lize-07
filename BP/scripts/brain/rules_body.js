// 身体表現・視線ルール（視線レイヤー専用。移動・発話とは並行発火する第三のレイヤー）
// 形式と語彙の定義は autonomy/body_language.md が正。
//   gaze: 視線ターゲット（意味で持つ。座標解決は実行部）
//   pose: step_close / step_back / lean_in / still / null（小移動の演出。既存 act は増やさない）
//   lamp: on / blink / off / null（こめかみランプ。§6）
//   hold: その視線の最低保持秒数
// 優先度は視線レイヤー内の帯（1〜190）で、移動・発話の帯とは独立。
// 文脈の新規フィールド（c.gaze.* / c.x.ownerGazeAtBot 等）は body_language.md §9 の供給が前提。
// optional chaining で参照し、未供給でも例外で落ちないようにしてある（decide 側でも try/catch 済み）。
export const RULES_BODY = [
// ===== 危険のチラ見（165〜190：即座に視線を奪う） =====
{id:'body_danger_creeper_glance', p:188, when:c=>c.danger.creeperDist<8, gaze:'danger_then_owner', hold:0.8, note:'至近のクリーパーは一瞬見て、すぐ主人を見て知らせる（警告発話と同期する想定）'},
{id:'body_danger_boss_glance', p:186, when:c=>c.x?.bossNear===true, gaze:'danger_then_owner', hold:0.9, note:'ボス級は姿を確認してから主人を見る。見続けないのが「知らせる」動き'},
{id:'body_danger_hostile_glance', p:184, when:c=>c.danger.count>0&&c.danger.nearestDist<6, gaze:'danger_then_owner', hold:0.8, note:'近い敵全般のチラ見→主人の二相視線'},
{id:'body_danger_owner_targeted', p:180, when:c=>c.danger.ownerTargeted&&c.danger.nearestDist<14, gaze:'danger_then_owner', hold:0.8, note:'主人が狙われている時は敵と主人の両方を確認する視線になる'},
{id:'body_danger_ranged_watch', p:170, when:c=>c.danger.rangedDist<16&&c.danger.nearestDist>=6, gaze:'danger', hold:1.5, note:'遠距離の射手はチラ見でなく見続けて警戒する'},
{id:'body_danger_lava_stepback', p:166, when:c=>c.danger.lavaNear, gaze:'downcast', pose:'step_back', hold:1.2, note:'足元が溶岩なら下を見て半歩下がる。視線と姿勢の同時表現'},
{id:'body_thunder_startle_sky', p:172, when:c=>c.env.isThundering, gaze:'sky', hold:0.6, note:'雷鳴に一瞬だけ空を見る（驚きの反射）。hold短めで仕事の視線を奪いすぎない'},
// ===== 会話・応答（145〜164） =====
{id:'body_chat_face_owner', p:160, when:c=>(c.gaze?.sinceChatSec??99999)<2.5&&c.owner.present&&c.self.distOwner<=8, gaze:'owner_face', pose:'lean_in', hold:1.6, note:'話しかけられたら主人の顔を見て、少し前のめりで聞く'},
{id:'body_chat_face_owner_far', p:146, when:c=>(c.gaze?.sinceChatSec??99999)<2.5&&c.owner.present&&c.self.distOwner>8, gaze:'owner_face', hold:1.6, note:'遠くから話しかけられても顔だけは主人へ向ける（体は移動レイヤーに任せる）'},
{id:'body_join_face_owner', p:156, when:c=>(c.x?.sessionMin??99)<0.5&&c.owner.present, gaze:'owner_face', hold:2.0, note:'合流直後の数十秒は主人を見て位置関係を掴む'},
{id:'body_greet_face_owner', p:148, when:c=>c.x?.firstToday===true&&c.owner.present&&c.self.distOwner<=10, gaze:'owner_face', hold:1.5, note:'その日最初の挨拶では顔を見る'},
{id:'body_after_danger_check_owner', p:150, when:c=>(c.gaze?.sinceDangerSec??99999)<3&&c.danger.count===0&&c.owner.present, gaze:'owner_face', hold:1.5, note:'危険が去った直後は主人の無事を確認する視線'},
{id:'body_owner_hurt_approach_look', p:152, when:c=>c.owner.present&&c.owner.hpPct<0.4&&c.danger.count===0&&c.self.distOwner>2.5, gaze:'owner_face', pose:'step_close', hold:1.5, note:'瀕死の主人には寄りながら顔を見る（心配の表現は距離と視線で）'},
{id:'body_too_close_step_back', p:144, when:c=>c.owner.present&&!c.owner.dead&&c.self.distOwner<1.2, gaze:'owner_face', pose:'step_back', hold:1.0, note:'近すぎたら半歩下がる。人間同士の距離感の再現'},
// ===== 褒め・照れ・ランプ（145〜168） =====
{id:'body_praise_lamp_high_bond', p:168, when:c=>(c.gaze?.sincePraiseSec??99999)<3&&(c.flags?.bond??0)>=70, gaze:'downcast', lamp:'on', hold:2.0, say:'……ランプは、見なくていいです', note:'仲の良い主人に褒められると、目をそらすより先にランプが光る（設定の代表挙動）'},
{id:'body_praise_lamp_blink', p:162, when:c=>(c.gaze?.sincePraiseSec??99999)<3, gaze:'avert', lamp:'blink', hold:1.5, note:'褒められた直後は視線を横へそらし、ランプが点滅する'},
{id:'body_praise_recover_face', p:121, when:c=>(c.gaze?.sincePraiseSec??99999)>=3&&(c.gaze?.sincePraiseSec??99999)<8&&c.owner.present, gaze:'owner_face', hold:1.2, note:'照れが収まったら向き直る。ずっとそらしっぱなしにしない'},
{id:'body_owner_gaze_shy_avert', p:158, when:c=>c.x?.ownerGazeAtBot===true&&(c.x?.ownerGazeSec??0)>=4&&(c.flags?.bond??0)>=70, gaze:'avert', lamp:'blink', hold:1.2, note:'じっと見られ続けると、仲が良くても少しだけ目をそらす'},
{id:'body_milestone_lamp_face', p:138, when:c=>c.x?.milestone===true&&c.owner.present, gaze:'owner_face', lamp:'blink', hold:1.5, note:'節目の達成時は主人を見てランプで小さく祝う'},
// ===== 主人の手元・作業対象（120〜144） =====
{id:'body_work_owner_breaking_hands', p:136, when:c=>c.x?.ownerBreaking===true&&c.owner.present&&c.self.distOwner<=8, gaze:'owner_hands', hold:1.4, note:'主人がブロックを壊していたら手元を見る（何をしているか分かっている感じ）'},
{id:'body_work_owner_placing_hands', p:134, when:c=>c.x?.ownerPlacing===true&&c.owner.present&&c.self.distOwner<=8, gaze:'owner_hands', hold:1.4, note:'主人が設置していたら手元を見る'},
{id:'body_work_owner_breaking_far_face', p:110, when:c=>c.x?.ownerBreaking===true&&c.owner.present&&c.self.distOwner>8, gaze:'owner_face', hold:1.2, note:'遠いと手元は見えないので、せめて主人の方を見る'},
{id:'body_work_look_target', p:124, when:c=>c.x?.working===true&&c.x?.workTargetKind!=null&&(c.x?.workTargetDist??999)<999, gaze:'work_target', hold:1.3, note:'自分の作業中は対象ブロックを見る。主人ばかり見て作業しない'},
{id:'body_work_look_target_tree', p:126, when:c=>c.x?.working===true&&c.x?.workTargetKind==='tree', gaze:'work_target', hold:1.3, note:'伐採中は木を見る（上の方になりがちな対象に視線が追う）'},
{id:'body_work_full_face_owner', p:107, when:c=>c.mode==='work'&&c.inv.full&&c.owner.present, gaze:'owner_face', hold:1.4, note:'満載になったら主人を見て「いっぱいです」を視線でも伝える'},
{id:'body_pickup_look_item', p:116, when:c=>c.drops.nearestDist>=0&&c.drops.nearestDist<5&&c.mode!=='stay', gaze:'nearest_item', hold:1.0, note:'拾う前に品物を一瞥する。いきなり吸い込まない'},
{id:'body_owner_gaze_meet_high_bond', p:132, when:c=>c.x?.ownerGazeAtBot===true&&(c.flags?.bond??0)>=50, gaze:'owner_face', hold:1.5, note:'主人がこちらを見たら、仲が良ければ視線を合わせ返す'},
{id:'body_owner_gaze_meet_low_bond', p:118, when:c=>c.x?.ownerGazeAtBot===true&&(c.flags?.bond??0)<50, gaze:'owner_face', hold:0.8, note:'まだ打ち解けていないうちは、視線を合わせてもすぐ仕事に戻る（hold短め）'},
// ===== 見守り・状況（95〜119） =====
{id:'body_deliver_face_owner', p:113, when:c=>c.flags?.justDelivered===true&&c.owner.present, gaze:'owner_face', hold:1.5, note:'お届け直後は主人の反応を見る'},
{id:'body_deposit_look_home', p:111, when:c=>c.flags?.justDeposited===true&&c.home.registered, gaze:'home', hold:1.3, note:'入庫直後はしまった先（拠点/チェスト）を一瞥する'},
{id:'body_chest_missing_look_home', p:105, when:c=>c.home.chestMissing&&c.home.registered, gaze:'home', hold:1.3, note:'チェストが無い時はあった場所を見る（困惑の視線）'},
{id:'body_owner_dead_look_home', p:101, when:c=>c.owner.dead&&c.home.registered, gaze:'home', hold:2.0, note:'主人が死んだら帰る場所を見る。待つ場所の確認'},
{id:'body_owner_in_bed_face', p:103, when:c=>c.x?.ownerInBed===true&&c.owner.present, gaze:'owner_face', pose:'still', hold:2.0, note:'主人が寝たら静かに顔を見て、漂いを止める'},
{id:'body_owner_swim_watch', p:99, when:c=>c.owner.present&&c.owner.inWater, gaze:'owner_face', hold:1.2, note:'泳ぐ主人は見守る'},
{id:'body_owner_below_look', p:128, when:c=>c.owner.present&&(c.x?.selfPos?.y??0)-(c.x?.ownerY??0)>4, gaze:'owner_face', hold:1.2, note:'主人が下にいる時は下を向いて見る（ピッチは実行部が注視点から算出）'},
{id:'body_owner_above_look', p:127, when:c=>c.owner.present&&(c.x?.ownerY??0)-(c.x?.selfPos?.y??0)>4, gaze:'owner_face', hold:1.2, note:'主人が上にいる時は見上げる'},
{id:'body_owner_sneak_feet', p:109, when:c=>c.owner.present&&c.owner.sneaking&&c.self.distOwner<=6, gaze:'owner_feet', hold:1.2, note:'しゃがむ主人の足元を見る（忍び足への同調。声を落とす発話層と対）'},
{id:'body_dimension_keep', p:97, when:c=>c.owner.present&&!c.owner.dimensionSame, gaze:'keep', hold:2.0, note:'別ディメンションの主人は物理的に見えない。視線を動かさず保持する'},
{id:'body_follow_watch_back', p:96, when:c=>c.mode==='follow'&&c.owner.present&&c.owner.idleSec<5&&c.danger.count===0&&c.self.distOwner>=3&&c.self.distOwner<=9, gaze:'owner_face', hold:1.2, note:'追従中、適正距離では主人の背中（顔の向き）を見てついていく'},
{id:'body_follow_sprint_forward', p:95, when:c=>c.mode==='follow'&&c.owner.present&&c.owner.sprinting, gaze:'forward', hold:0.8, note:'主人が走っている時は進行方向を見て遅れない'},
// ===== アイドルの漂い（25〜94） =====
{id:'body_stay_guard_drift', p:60, when:c=>c.mode==='stay'&&c.danger.count===0, gaze:'drift', hold:2.5, note:'待機中はゆっくり見回す（見張りの漂い）'},
{id:'body_idle_drift_night_sky', p:48, when:c=>c.env.isNight&&c.owner.idleSec>=20&&c.danger.count===0&&!c.owner.underground, gaze:'sky', hold:2.5, note:'夜の放置時は月のある空を見る'},
{id:'body_idle_drift_home', p:44, when:c=>c.home.registered&&c.home.dist<=6&&c.owner.idleSec>=20&&c.danger.count===0, gaze:'home', hold:2.0, note:'拠点の近くで暇なら、帰る場所をぼんやり見る'},
{id:'body_idle_drift_day', p:40, when:c=>c.owner.present&&c.owner.idleSec>=20&&c.danger.count===0, gaze:'drift', hold:2.5, note:'昼の放置時は視線がゆっくり漂う'},
{id:'body_idle_drift_rain_sky', p:37, when:c=>c.env.isRaining&&c.danger.count===0&&!c.owner.underground, gaze:'sky', hold:1.0, note:'雨の日は時々空を見る（雨粒を目で追う感じ）'},
{id:'body_idle_absent_drift', p:38, when:c=>!c.owner.present&&c.mode!=='stay', gaze:'drift', hold:2.5, note:'主人がいない時は落ち着かなく視線が漂う（きょろきょろの弱い版）'},
{id:'body_idle_drift_underground', p:34, when:c=>c.owner.underground&&c.owner.idleSec>=20&&c.danger.count===0, gaze:'drift', hold:2.5, note:'地下では壁や天井を漂う（空がないので水平の漂い）'},
{id:'body_idle_long_downcast', p:30, when:c=>c.owner.present&&c.owner.idleSec>=300&&c.danger.count===0, gaze:'downcast', hold:2.5, note:'長く放置されるとうつむきがちになる（眠気・拗ねの手前）'},
{id:'body_night_watch_drift', p:28, when:c=>c.env.isNight&&c.mode==='stay'&&c.danger.count===0, gaze:'drift', lamp:'off', hold:2.5, note:'夜の見張りはランプを光らせない（光で目立たない配慮を演出として明示）'},
// ===== フォールバック（必ず拾う） =====
{id:'body_default_forward', p:1, when:c=>true, gaze:'forward', hold:0.8, note:'最終フォールバック：進行方向を見る。視線が未定義の周期を作らない'},
];
