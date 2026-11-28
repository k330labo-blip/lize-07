// 装備ルール（リゼ / LIZE-07）（優先度帯 500.6〜549.9）
// リゼにプレイヤー同様の装備スロット（頭/胸/脚/足/右手/左手）と所持品が付いた前提の層。
// 帯域の根拠: 既存帯は safety 900〜 / emergency2 905〜919 / care 800〜899 / orders 799帯 /
//   mining 760〜799 / tactics 694〜759 / haul 558〜695 / farming 〜495 / vehicles 460〜479。
//   空いていた 500〜557 を装備帯とする。日常作業（農業・乗り物・工廠生活）より優先し、
//   運搬・戦術・ケア・安全には必ず譲る。瀕死の逃走や主人の危機は上位帯が先に処理する前提で、
//   ここでは「装備があるからこそ変わる判断」だけを書く。
// 追加文脈 c.x は全て c.x?.〜 で参照し、x が無い文脈では沈黙する。when は全件 Boolean(...) 包み。
//
// ===== 実行部への申し送り: 本ファイルが要求する c.x フィールド一覧 =====
//   hasWeapon      : bool   右手に近接武器を装備しているか（weaponTier!=='none' と一致させる）
//   weaponTier     : 'none'|'wood'|'stone'|'iron'|'gold'|'diamond'|'netherite'  装備中の近接武器の素材ティア
//   hasGun         : bool   右手に銃（GVC等）を装備しているか
//   ammoCount      : number 銃に対応する弾薬の所持数（銃が無い場合は 0 でよい）
//   ammoLow        : bool   弾薬が残りわずか（目安: 1〜5発。0発は ammoCount===0 で判定し、ammoLow には含めない）
//   armorPoints    : number 防具4部位の合計防御ポイント（0〜20）
//   hasShield      : bool   左手に盾を装備しているか
//   hasHealItem    : bool   回復アイテム（ポーション/金のリンゴ/トーテム等）を所持しているか
//   healItemCount  : number 回復アイテムの所持数
//   equipChanged   : null|'weapon'|'gun'|'ammo'|'armor'|'heal'|'unequip'
//                    直近（目安: 数秒以内）の装備変更の種別。変更が無ければ null。
//                    'unequip' は武器・防具を外した/失った変更を指す
//   equipFromOwner : bool   直近の装備変更が「主人から渡された」ものか（拾った/自作と区別する）
//   weaponDurabilityPct : number|undefined  武器の残耐久割合（0〜1）。取得できない環境では undefined
//   armorDurabilityPct  : number|undefined  防具の残耐久割合（最弱部位の値、0〜1）。同上
//   weaponBroke    : bool   直近で武器が壊れた（この評価サイクルで検知したイベント）
//   armorBroke     : bool   直近で防具が壊れた（同上）
//   justHealed     : bool   直近で回復アイテムを使用した（同上）
//   bossNear       : bool   （rules_tactics と共通の既存フィールド）ボス級の敵が近い
// ===== 新規 act の申し送り =====
//   use_heal_item : 所持している回復アイテムを自分に使用する。既存 act 語彙に自己回復が無いため新設。
//                   実行部が未対応の間は「その場に留まって発話のみ」でも安全側に倒れる。
//                   それ以外の act は全て既存語彙（guard/follow_close/zap/go_owner/warn_owner_low/
//                   return_home/say_only/celebrate）から選んでいる。
import { scanKnown } from "./obs.js";
export const RULES = [
// === 回復アイテム: 自分が使う判断 ===
{id:'eq_heal_critical_combat',p:549.9,when:c=>Boolean(c.self.hpPct<=0.25&&(c.x?.healItemCount??0)>0&&c.x?.hasHealItem&&c.danger.safetyCount>0),act:'use_heal_item',say:'残量が限界です。回復を使います。文句は後で聞きます',note:'瀕死×回復あり×戦闘中は即使用（逃走は safety 帯が先に決める）'},
{id:'eq_heal_low_combat',p:548.8,when:c=>Boolean(c.self.hpPct<=0.4&&c.self.hpPct>0.25&&c.x?.hasHealItem&&c.danger.safetyCount>0&&(c.danger.safetyNearestDist??999)<10),act:'use_heal_item',say:'下がりながら回復します。隙は作りません',note:'HP40%以下×敵接近でも回復を先行させる'},
{id:'eq_heal_calm',p:547.7,when:c=>Boolean(scanKnown(c)&&c.self.hpPct<=0.55&&c.self.hpPct>0.4&&c.x?.hasHealItem&&c.danger.count===0),act:'use_heal_item',say:'今のうちに回復しておきます。静かな時間は、こう使うものです',note:'安全なうちに回復して立て直す（戦闘中の使用より優先度を下げてある）'},
{id:'eq_heal_owner_critical_share',p:546.6,when:c=>Boolean(c.owner.present&&c.owner.hpPct<=0.25&&c.self.hpPct>0.6&&c.x?.hasHealItem&&c.self.distOwner>=3&&c.danger.count>=0),act:'go_owner',say:'私の回復は後です。まず、あなたに渡します',note:'主人が瀕死で自分が元気なら、回復アイテムを持って合流する'},
{id:'eq_no_heal_critical_owner_near',p:545.5,when:c=>Boolean(c.self.hpPct<=0.3&&!c.x?.hasHealItem&&c.owner.present&&c.self.distOwner<16),act:'warn_owner_low',say:'私の残量が三割を切りました。回復は、ありません。……報告まで',note:'回復なし瀕死は主人に知らせて判断を仰ぐ'},
{id:'eq_no_heal_critical_alone',p:544.4,when:c=>Boolean(c.self.hpPct<=0.3&&!c.x?.hasHealItem&&!c.owner.present&&c.home.registered),act:'return_home',say:'回復手段がありません。拠点に戻って立て直します',note:'主人がいない×回復なし×瀕死は拠点へ帰る'},
{id:'eq_no_heal_low_shared',p:543.3,when:c=>Boolean(c.self.hpPct<=0.45&&c.self.hpPct>0.3&&!c.x?.hasHealItem&&c.owner.present&&c.danger.safetyCount>0),act:'say_only',say:'回復の在庫がありません。この先は、無理の利かない体です',note:'戦闘中に回復在庫ゼロを早めに共有しておく'},
{id:'eq_equip_heal_received',p:542.2,when:c=>Boolean(c.x?.equipChanged==='heal'&&c.x?.hasHealItem&&c.danger.count===0),act:'say_only',say:'回復、受け取りました。使う時は、自分で判断します。……ありがとうございます',note:'回復アイテムを預かった時の受領反応（戦闘中は発話しない）'},
{id:'eq_just_healed_still_low',p:541.1,when:c=>Boolean(c.x?.justHealed&&c.self.hpPct<=0.4&&c.x?.hasHealItem&&(c.x?.healItemCount??0)>=1),act:'use_heal_item',say:'一つでは足りませんでした。続けます',note:'回復直後も低HPなら連続使用する'},
{id:'eq_just_healed_reengage',p:540.0,when:c=>Boolean(c.x?.justHealed&&c.self.hpPct>0.7&&c.danger.safetyCount>0&&(c.x?.hasWeapon||c.x?.hasGun)),act:'guard',say:'回復しました。持ち場に戻ります',note:'回復で立て直したら護衛位置へ復帰'},
// === 弾薬: 残量管理と「銃だけ立派」な状況 ===
{id:'eq_ammo_empty_combat',p:538.9,when:c=>Boolean(c.x?.hasGun&&(c.x?.ammoCount??0)===0&&c.danger.safetyCount>0),act:'follow_close',say:'弾がありません。この銃は、今はただの重い棒です。あなたの側に下がります',note:'弾切れ×戦闘中は撃てないので主人側へ距離を詰め直す'},
{id:'eq_ammo_empty_calm_owner',p:537.8,when:c=>Boolean(c.x?.hasGun&&(c.x?.ammoCount??0)===0&&c.danger.count===0&&c.owner.present&&!c.env.isRaining&&!c.owner.inWater),act:'say_only',say:'報告です。銃は立派ですが、弾が一発もありません。……撃てない武器の感想は、それだけです',note:'銃あり弾なしの間抜けな状況への真顔コメント（平時・屋外天候条件つきで誤発火防止）'},
{id:'eq_ammo_low_combat',p:536.7,when:c=>Boolean(c.x?.hasGun&&c.x?.ammoLow&&(c.x?.ammoCount??0)>0&&c.danger.safetyCount>0),act:'say_only',say:'弾が残りわずかです。一発ずつ、大事に撃ちます',note:'残弾わずか×戦闘中は節約宣言'},
{id:'eq_ammo_low_owner_near',p:535.6,when:c=>Boolean(c.x?.hasGun&&c.x?.ammoLow&&c.owner.present&&c.self.distOwner<8&&c.danger.count===0),act:'say_only',say:'弾の補給をお願いします。残りは指で数えられます',note:'主人が近い平時に補給を依頼する'},
{id:'eq_ammo_received',p:534.5,when:c=>Boolean(c.x?.equipChanged==='ammo'&&(c.x?.ammoCount??0)>0&&c.x?.hasGun),act:'say_only',say:'弾薬、受け取りました。これで撃てます。当たり前が、一番助かります',note:'弾を預かった時の受領反応'},
{id:'eq_gun_empty_melee_fallback',p:533.4,when:c=>Boolean(c.x?.hasGun&&(c.x?.ammoCount??0)===0&&c.inv.hasWeapon&&c.danger.safetyCount>0&&(c.danger.safetyNearestDist??999)<6),act:'zap',say:'弾切れです。手持ちの武器に持ち替えて対応します',note:'弾切れでも近接武器があれば戦闘継続する'},
// === 銃装備時の戦術: 距離を取る（act は既存語彙） ===
{id:'eq_gun_keep_distance',p:532.3,when:c=>Boolean(c.x?.hasGun&&(c.x?.ammoCount??0)>0&&c.danger.safetyCount>0&&(c.danger.safetyNearestDist??999)<7&&c.self.hpPct>0.4),act:'follow_close',say:'近すぎます。射手は距離が仕事です。下がりながら撃ちます',note:'銃装備時は敵に詰められたら主人側へ下がって間合いを取り直す'},
{id:'eq_gun_firing_position',p:531.2,when:c=>Boolean(c.x?.hasGun&&(c.x?.ammoCount??0)>0&&c.danger.safetyRangedDist<20&&(c.danger.safetyNearestDist??999)>=8&&c.self.hpPct>0.5),act:'guard',say:'射撃位置につきました。遠い側は私が落とします',note:'間合いが取れている時はその場で射撃役として留まる'},
{id:'eq_gun_cover_owner_melee',p:530.1,when:c=>Boolean(c.x?.hasGun&&(c.x?.ammoCount??0)>0&&c.danger.visualOwnerTargeted&&(c.danger.safetyNearestDist??999)<8&&c.owner.present),act:'guard',say:'あなたは近接、私は射撃。役割は分けました',note:'主人が狙われている時は射撃で援護する役割分担'},
{id:'eq_gun_night_ambush',p:529.0,when:c=>Boolean(c.x?.hasGun&&(c.x?.ammoCount??0)>0&&c.env.isNight&&c.danger.safetyCount>0&&(c.danger.safetyNearestDist??999)<10),act:'guard',say:'夜襲です。音のする方へ撃ちます。近づかせません',note:'夜間×銃装備は接近させない迎撃'},
{id:'eq_gun_vs_creeper_range',p:527.9,when:c=>Boolean(c.x?.hasGun&&(c.x?.ammoCount??0)>0&&c.danger.safetyCreeperDist>=5&&c.danger.safetyCreeperDist<12&&c.self.hpPct>0.5),act:'guard',say:'爆発の届かない距離です。ここから処理します',note:'クリーパーは爆発圏外から射撃で処理する'},
// === 装備を受け取った反応（好感度で変化） ===
{id:'eq_weapon_received_top_bond',p:526.8,when:c=>Boolean(c.x?.equipChanged==='weapon'&&(c.x?.weaponTier==='diamond'||c.x?.weaponTier==='netherite')&&(c.flags?.bond??0)>=60&&c.danger.count===0),act:'celebrate',say:'……いいものを、いただきました。大事に使います。ランプは、見なくていいです',note:'強い武器×好感度高：嬉しさが少し漏れる（レアな可愛い寄り）'},
{id:'eq_weapon_received_top',p:525.7,when:c=>Boolean(c.x?.equipChanged==='weapon'&&(c.x?.weaponTier==='diamond'||c.x?.weaponTier==='netherite')&&(c.flags?.bond??0)<60&&c.danger.count===0),act:'say_only',say:'高性能な武器ですね。扱いは任せてください。期待には、結果で応えます',note:'強い武器×好感度通常：実務的な受領'},
{id:'eq_weapon_received_iron',p:524.6,when:c=>Boolean(c.x?.equipChanged==='weapon'&&c.x?.weaponTier==='iron'&&c.danger.count===0),act:'say_only',say:'鉄の武器、受け取りました。十分に仕事ができる重さです',note:'鉄武器の受領は白夜研助手らしい実務評価'},
{id:'eq_weapon_received_weak',p:523.5,when:c=>Boolean(c.x?.equipChanged==='weapon'&&(c.x?.weaponTier==='wood'||c.x?.weaponTier==='stone')&&c.danger.count===0&&!c.env.isRaining),act:'say_only',say:'……受け取りました。ないよりは、ずっと良いです。顔には出ていません',note:'弱い武器への真顔コメント（否定はしない）'},
{id:'eq_weapon_received_in_combat',p:522.4,when:c=>Boolean(c.x?.equipChanged==='weapon'&&c.danger.safetyCount>0&&(c.danger.safetyNearestDist??999)<10),act:'guard',say:'感想は後にします。まず、これで戦います',note:'戦闘中の受け取りは感想より先に戦闘へ'},
{id:'eq_unequip_reaction',p:521.3,when:c=>Boolean(c.x?.equipChanged==='unequip'&&!c.x?.hasWeapon&&!c.x?.hasGun&&c.danger.count===0&&c.owner.present),act:'say_only',say:'装備を外しました。素手の私も、案外やります。……過信はしませんが',note:'装備を外した/返した時の反応'},
{id:'eq_armor_received_full',p:520.2,when:c=>Boolean(c.x?.equipChanged==='armor'&&(c.x?.armorPoints??0)>=15&&c.danger.count===0),act:'say_only',say:'全身分ですね。……前に出る役、引き受けられます',note:'防具一式を受け取った時は前衛宣言'},
{id:'eq_armor_received_partial',p:519.1,when:c=>Boolean(c.x?.equipChanged==='armor'&&(c.x?.armorPoints??0)>0&&(c.x?.armorPoints??0)<15&&c.danger.count===0),act:'say_only',say:'防具、受け取りました。守れる場所が増えました',note:'部分防具の受領'},
{id:'eq_gun_received_ready',p:518.0,when:c=>Boolean(c.x?.equipChanged==='gun'&&c.x?.hasGun&&(c.x?.ammoCount??0)>0),act:'say_only',say:'銃と弾、確認しました。撃ち方と、撃たない場面。両方わかっています',note:'銃＋弾セットの受領'},
{id:'eq_gun_received_no_ammo',p:516.9,when:c=>Boolean(c.x?.equipChanged==='gun'&&c.x?.hasGun&&(c.x?.ammoCount??0)===0&&c.danger.count===0),act:'say_only',say:'銃、受け取りました。……弾は、別便ですか。撃てるようになったら報告します',note:'銃だけ渡されて弾がない時の真顔コメント'},
// === 自制と自信: 装備の強さで前に出るかを変える ===
{id:'eq_barehand_swarm_restraint',p:515.8,when:c=>Boolean((c.x?.weaponTier??'none')==='none'&&!c.x?.hasGun&&c.danger.safetyCount>=3&&c.self.hpPct>0.4&&c.owner.present),act:'follow_close',say:'素手で群れには入りません。あなたの側で、できることをします',note:'素手×敵3体以上は突っ込まず主人に寄る自制'},
{id:'eq_barehand_boss_restraint',p:514.7,when:c=>Boolean((c.x?.weaponTier??'none')==='none'&&!c.x?.hasGun&&c.x?.bossNear&&c.owner.present),act:'follow_close',say:'相手が大きすぎます。素手の私は、足手まといの側です。下がります',note:'素手×ボス級は自制して下がる'},
{id:'eq_weak_weapon_creeper_restraint',p:513.6,when:c=>Boolean(((c.x?.weaponTier)==='wood'||(c.x?.weaponTier)==='stone')&&c.danger.safetyCreeperDist>=3&&c.danger.safetyCreeperDist<8&&c.self.hpPct>0.5),act:'guard',say:'この武器では一撃で落とせません。近づかせない位置を取ります',note:'弱い武器ではクリーパーを倒し切れないので間合い管理に徹する'},
{id:'eq_strong_weapon_confidence',p:512.5,when:c=>Boolean(((c.x?.weaponTier)==='diamond'||(c.x?.weaponTier)==='netherite')&&c.danger.safetyCount>=1&&(c.danger.safetyNearestDist??999)<10&&c.self.hpPct>0.6),act:'zap',say:'この武器なら任せてください。前は私が取ります',note:'強い武器×HP余裕では積極的に前へ出る'},
{id:'eq_no_armor_swarm_restraint',p:511.4,when:c=>Boolean((c.x?.armorPoints??0)===0&&c.danger.safetyCount>=2&&(c.danger.safetyNearestDist??999)<8&&c.self.hpPct>0.4),act:'follow_close',say:'防具なしで複数は無理です。被弾を避ける動きに変えます',note:'無防備×敵複数の自制'},
{id:'eq_armor_frontline_owner_targeted',p:510.3,when:c=>Boolean((c.x?.armorPoints??0)>=15&&c.danger.visualOwnerTargeted&&c.self.hpPct>0.6&&c.owner.present),act:'guard',say:'この防具は飾りではありません。あなたの前に立ちます',note:'重装×主人が狙われている時は盾役を買って出る'},
{id:'eq_shield_vs_ranged',p:509.2,when:c=>Boolean(c.x?.hasShield&&c.danger.safetyRangedDist<14&&c.self.hpPct>0.5),act:'guard',say:'盾があります。矢の線は、私で止めます',note:'盾×射手は盾役として前に出る'},
// === 耐久: 壊れそう/壊れた（耐久情報が取れる前提の条件付き） ===
{id:'eq_weapon_durability_critical_combat',p:508.1,when:c=>Boolean((c.x?.weaponDurabilityPct??1)<=0.08&&c.x?.hasWeapon&&c.danger.safetyCount>0),act:'follow_close',say:'武器が限界です。壊れる前に距離を取ります',note:'武器耐久8%以下×戦闘中は無理をやめる'},
{id:'eq_weapon_durability_warn_calm',p:507.0,when:c=>Boolean((c.x?.weaponDurabilityPct??1)<=0.15&&(c.x?.weaponDurabilityPct??0)>0&&c.x?.hasWeapon&&c.danger.count===0&&c.owner.present),act:'say_only',say:'武器の耐久が残りわずかです。予備か、修理の相談を',note:'平時に耐久低下を報告して備えさせる'},
{id:'eq_weapon_broke_combat',p:505.9,when:c=>Boolean(c.x?.weaponBroke&&c.danger.safetyCount>0),act:'follow_close',say:'武器が壊れました。素手では持ちません。下がります',note:'戦闘中に武器が壊れたら即座に距離を取る'},
{id:'eq_weapon_broke_calm',p:504.8,when:c=>Boolean(c.x?.weaponBroke&&c.danger.count===0&&c.owner.present),act:'say_only',say:'武器が壊れました。……使い切った、ということにしてください',note:'平時の破損報告（少しだけ言い訳が漏れる）'},
{id:'eq_armor_durability_warn',p:503.7,when:c=>Boolean((c.x?.armorDurabilityPct??1)<=0.15&&(c.x?.armorDurabilityPct??0)>0&&(c.x?.armorPoints??0)>0&&c.danger.count===0&&c.owner.present),act:'say_only',say:'防具の一部が限界に近いです。壊れる前に、報告しておきます',note:'防具耐久の低下を平時に報告'},
{id:'eq_armor_broke',p:502.6,when:c=>Boolean(c.x?.armorBroke&&c.owner.present),act:'say_only',say:'防具が一つ壊れました。守りが薄くなっています',note:'防具破損は戦闘中でも発話だけで知らせる（移動は上位帯に譲る）'},
// === 装備の感想: 平時だけ（天候・水場では発火しない） ===
{id:'eq_armor_impression_calm',p:501.5,when:c=>Boolean((c.x?.armorPoints??0)>=10&&c.danger.count===0&&!c.env.isRaining&&!c.env.isThundering&&!c.owner.inWater&&c.owner.present&&c.owner.idleSec>=10&&c.mode==='follow'),act:'say_only',say:'この防具、重さの割に動きやすいです。整備が行き届いていますね',note:'平時×天候良好×水場でない×主人が落ち着いている時だけの防具感想'},
{id:'eq_gun_maintenance_calm',p:500.6,when:c=>Boolean(c.x?.hasGun&&(c.x?.ammoCount??0)>0&&c.danger.count===0&&!c.env.isRaining&&!c.owner.inWater&&c.mode==='stay'&&c.owner.present),act:'say_only',say:'待機の間に、銃の点検をしておきました。撃つ前の仕事も、仕事です',note:'待機中×天候良好の時だけの銃メンテ感想（雨天は発火しない）'},
];
