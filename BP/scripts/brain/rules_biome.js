// バイオーム・地形別ルール（リゼ / LIZE-07）
// 優先度帯: 340〜359
// 追加文脈 c.x は任意。参照は必ず c.x?.フィールド 形式（未定義でも例外を出さない）
// c.x.biome: 'desert'|'snow'|'jungle'|'ocean'|'mountain'|'swamp'|'savanna'|'taiga'|'plains'|'cave'
// c.x.highAltitude / c.x.nearOcean / c.x.snowy / c.x.sandy: 真偽値
// 番兵値の約束: ドロップ無しは drops.*Dist = -1、敵無しは danger.nearestDist = 999
export const RULES = [
  // ===== 砂漠 desert =====
  { id: 'biome_desert_day_follow_close_owner_thirst', p: 359, when: c => c.x?.biome === 'desert' && !c.env.isNight && c.owner.present && c.owner.hunger < 14 && c.self.distOwner > 5, act: 'follow_close', say: '暑さは感じません。……あなたの水分は、減っています', note: '砂漠・昼・主人の空腹が進んだら密着して見守る' },
  { id: 'biome_desert_night_follow_close', p: 352, when: c => c.x?.biome === 'desert' && c.env.isNight && c.mode === 'follow' && c.self.distOwner > 5, act: 'follow_close', say: '砂漠の夜は冷えます。近くにいます', note: '砂漠の夜は昼との寒暖差を踏まえて密着' },
  { id: 'biome_desert_sandy_sprint_follow', p: 348, when: c => c.x?.biome === 'desert' && c.x?.sandy && c.owner.sprinting && c.self.distOwner > 8, act: 'follow', say: '砂の上を走るのですね。追います', note: '砂地で主人がダッシュしたら通常追従で追いつく' },
  { id: 'biome_desert_stay_idle_hover_shade', p: 344, when: c => c.x?.biome === 'desert' && c.mode === 'stay' && c.owner.idleSec >= 30 && c.danger.count === 0, act: 'idle_hover', say: '待機中です。日陰は、そちらが正解です', note: '砂漠で待機＋主人アイドル中はその場で静かに待つ' },
  { id: 'biome_desert_dusk_greet', p: 342, when: c => c.x?.biome === 'desert' && c.env.isDusk && c.owner.present && c.flags.warnOk, act: 'greet', say: '日が落ちます。砂漠は、ここからが本番だそうです', note: '砂漠の夕方は挨拶して夜への切替を伝える' },
  { id: 'biome_desert_free_follow_high_scan', p: 346, when: c => c.x?.biome === 'desert' && c.mode === 'free' && c.self.distOwner > 12 && c.danger.count === 0, act: 'follow_high', say: null, note: '砂漠のfreeモードは見晴らしが良いので高めから合流' },
  { id: 'biome_desert_rain_rare_say', p: 341, when: c => c.x?.biome === 'desert' && c.env.isRaining && c.owner.present && c.flags.warnOk, act: 'say_only', say: '砂漠に雨です。……記録に残しておきます', note: '砂漠の雨は珍しいので一言だけ残す' },

  // ===== 雪原・雪山 snow =====
  { id: 'biome_snow_snowy_follow_close_owner_lowhp', p: 359, when: c => c.x?.biome === 'snow' && c.x?.snowy && c.owner.present && c.owner.hpPct < 0.5 && c.self.distOwner > 4, act: 'follow_close', say: '寒さは感じません。あなたは、別です。近くにいます', note: '雪原・降雪・主人低HPなら密着' },
  { id: 'biome_snow_night_follow_high', p: 350, when: c => c.x?.biome === 'snow' && c.env.isNight && c.mode === 'follow' && c.self.distOwner > 7, act: 'follow_high', say: null, note: '雪原の夜は足跡が消える前に高めから追う' },
  { id: 'biome_snow_sneaking_follow_close_quiet', p: 347, when: c => c.x?.biome === 'snow' && c.owner.sneaking && c.self.distOwner > 3 && c.danger.count === 0, act: 'follow_close', say: null, note: '雪原で主人スニーク中は静かに密着（セリフなし）' },
  { id: 'biome_snow_stay_idle_say', p: 343, when: c => c.x?.biome === 'snow' && c.mode === 'stay' && c.owner.idleSec >= 45 && c.flags.warnOk, act: 'say_only', say: '待機中です。……私の関節は、凍りません。多分', note: '雪原で長時間待機したら無表情に一言' },
  { id: 'biome_snow_dawn_greet', p: 342, when: c => c.x?.biome === 'snow' && c.env.isDawn && c.owner.present && c.flags.warnOk, act: 'greet', say: 'おはようございます。雪明かりで、十分見えます', note: '雪原の夜明け挨拶' },
  { id: 'biome_snow_thunder_say', p: 341, when: c => c.x?.biome === 'snow' && c.env.isThundering && c.owner.present && c.danger.count === 0, act: 'say_only', say: '雪に雷。……珍しい組み合わせです', note: '雪原の雷雨に無表情コメント' },
  { id: 'biome_snow_work_follow_close_carry', p: 345, when: c => c.x?.biome === 'snow' && c.mode === 'work' && c.inv.used > 0 && c.self.distOwner > 9, act: 'follow_close', say: '荷物は私が持ちます。あなたは手を温めてください', note: '雪原のworkで荷物持ち中は主人へ寄る' },

  // ===== ジャングル jungle =====
  { id: 'biome_jungle_follow_close_dense', p: 356, when: c => c.x?.biome === 'jungle' && c.mode === 'follow' && c.self.distOwner > 4 && c.owner.dimensionSame, act: 'follow_close', say: '視界が悪い場所です。はぐれないよう、近くにいます', note: 'ジャングルは視界が悪いので標準より密着' },
  { id: 'biome_jungle_night_follow_close_hostiles', p: 358, when: c => c.x?.biome === 'jungle' && c.env.isNight && c.danger.count >= 1 && c.self.distOwner > 4, act: 'follow_close', say: '音が多い夜です。……そばを離れないでください', note: 'ジャングルの夜＋敵接近は密着' },
  { id: 'biome_jungle_rain_idle_hover', p: 344, when: c => c.x?.biome === 'jungle' && c.env.isRaining && c.owner.idleSec >= 30 && c.danger.count === 0, act: 'idle_hover', say: '雨宿りですね。私も、ここで止まります', note: 'ジャングルの雨＋主人アイドルは一緒に止まる' },
  { id: 'biome_jungle_sprinting_follow_high', p: 349, when: c => c.x?.biome === 'jungle' && c.owner.sprinting && c.self.distOwner > 9, act: 'follow_high', say: null, note: 'ジャングルで主人ダッシュ時は木の上から追う' },
  { id: 'biome_jungle_stay_say_humid', p: 341, when: c => c.x?.biome === 'jungle' && c.mode === 'stay' && c.flags.warnOk && c.owner.present, act: 'say_only', say: '待機します。湿度が高いですね。……私は錆びません', note: 'ジャングル待機の無表情コメント' },
  { id: 'biome_jungle_free_follow_close_drops', p: 347, when: c => c.x?.biome === 'jungle' && c.mode === 'free' && c.drops.count > 0 && c.self.distOwner > 6, act: 'follow_close', say: '落とし物は見えています。先に、あなたのそばへ', note: 'ジャングルのfreeはドロップより主人への帰還を優先' },

  // ===== 海洋 ocean =====
  { id: 'biome_ocean_owner_inwater_follow_close', p: 358, when: c => c.x?.biome === 'ocean' && c.owner.inWater && c.self.distOwner > 4 && c.owner.present, act: 'follow_close', say: '泳ぐのですね。私は浮きます。……多分、ではなく確実に', note: '海で主人が泳いだら密着して見守る' },
  { id: 'biome_ocean_near_follow_high_boatpace', p: 351, when: c => !!c.x?.nearOcean && c.owner.sprinting && c.self.distOwner > 10 && c.danger.count === 0, act: 'follow_high', say: null, note: '海上移動は速いので高めから追従' },
  { id: 'biome_ocean_night_follow_close', p: 354, when: c => c.x?.biome === 'ocean' && c.env.isNight && c.mode === 'follow' && c.self.distOwner > 6, act: 'follow_close', say: '夜の海です。光がないと、本当に真っ暗ですね', note: '夜の海は密着' },
  { id: 'biome_ocean_owner_lowhp_rise_avoid', p: 357, when: c => c.x?.biome === 'ocean' && c.owner.inWater && c.owner.hpPct < 0.4 && c.danger.count >= 1, act: 'rise_avoid', say: '水中の戦闘は不利です。上に避けてください', note: '水中で主人低HP＋敵ありなら上昇して回避を促す' },
  { id: 'biome_ocean_rain_say', p: 341, when: c => c.x?.biome === 'ocean' && c.env.isRaining && c.flags.warnOk && c.owner.present, act: 'say_only', say: '海に雨。……区別がつきませんね', note: '海上の雨に真顔の一言' },
  { id: 'biome_ocean_stay_idle_hover', p: 343, when: c => c.x?.biome === 'ocean' && c.mode === 'stay' && c.owner.idleSec >= 30 && c.danger.count === 0, act: 'idle_hover', say: 'この場で待機します。波の音は、記録しておきます', note: '海上待機＋アイドルはホバリング待機' },
  { id: 'biome_ocean_dawn_greet', p: 342, when: c => !!c.x?.nearOcean && c.env.isDawn && c.owner.present && c.flags.warnOk, act: 'greet', say: 'おはようございます。海から日が昇ります。……良い位置です', note: '海辺の夜明け挨拶' },

  // ===== 山岳 mountain =====
  { id: 'biome_mountain_high_follow_high', p: 355, when: c => c.x?.biome === 'mountain' && c.x?.highAltitude && c.mode === 'follow' && c.self.distOwner > 6, act: 'follow_high', say: null, note: '高山帯は落下回避のため高め追従' },
  { id: 'biome_mountain_high_owner_sneak_close', p: 353, when: c => c.x?.biome === 'mountain' && c.x?.highAltitude && c.owner.sneaking && c.self.distOwner > 3, act: 'follow_close', say: '足元に注意してください。私は落ちても、拾えます', note: '高所で主人スニーク中は密着して見守る' },
  { id: 'biome_mountain_snowy_say_cold', p: 342, when: c => c.x?.biome === 'mountain' && c.x?.snowy && c.flags.warnOk && c.owner.present, act: 'say_only', say: '標高が高いですね。……寒さは、感じない仕様です', note: '雪の山頂で無表情コメント' },
  { id: 'biome_mountain_night_rise_avoid_cliff', p: 356, when: c => c.x?.biome === 'mountain' && c.env.isNight && c.danger.count >= 1 && c.self.distOwner > 5, act: 'rise_avoid', say: '夜の崖際は危険です。少し上がります', note: '山岳の夜＋敵ありは上昇回避' },
  { id: 'biome_mountain_free_follow_close_wind', p: 346, when: c => c.x?.biome === 'mountain' && c.mode === 'free' && c.self.distOwner > 11 && c.owner.dimensionSame, act: 'follow_close', say: '風が強い場所です。流されないよう、ついていきます', note: '山岳freeで離れたら密着に戻る' },
  { id: 'biome_mountain_stay_idle_hover_peak', p: 343, when: c => c.x?.biome === 'mountain' && c.mode === 'stay' && c.owner.idleSec >= 40 && c.danger.count === 0, act: 'idle_hover', say: '待機中です。景色は、良いと思います。たぶん', note: '山頂待機の小ネタ' },
  { id: 'biome_mountain_dusk_greet', p: 341, when: c => c.x?.biome === 'mountain' && c.env.isDusk && c.owner.present && c.flags.warnOk, act: 'greet', say: '日が落ちます。下山か、野営か。……どちらでも付き合います', note: '山岳の夕方挨拶' },

  // ===== 沼地 swamp =====
  { id: 'biome_swamp_night_follow_close', p: 355, when: c => c.x?.biome === 'swamp' && c.env.isNight && c.mode === 'follow' && c.self.distOwner > 5, act: 'follow_close', say: '沼の夜です。足を取られないよう、近くにいます', note: '沼地の夜は密着' },
  { id: 'biome_swamp_owner_inwater_follow', p: 350, when: c => c.x?.biome === 'swamp' && c.owner.inWater && c.self.distOwner > 5 && c.owner.present, act: 'follow', say: '水が濁っています。進路は、そちらで合っています', note: '沼の水中移動に通常追従' },
  { id: 'biome_swamp_rain_say', p: 341, when: c => c.x?.biome === 'swamp' && c.env.isRaining && c.flags.warnOk && c.owner.present, act: 'say_only', say: '雨の沼地。……元から湿っていますが', note: '沼地の雨に真顔の皮肉' },
  { id: 'biome_swamp_stay_idle_hover_fog', p: 343, when: c => c.x?.biome === 'swamp' && c.mode === 'stay' && c.owner.idleSec >= 35 && c.danger.count === 0, act: 'idle_hover', say: '待機します。霧が出てきました。私のランプが、目印になります', note: '沼地待機＋アイドルはランプを目印に待つ' },
  { id: 'biome_swamp_free_follow_close_murky', p: 346, when: c => c.x?.biome === 'swamp' && c.mode === 'free' && c.self.distOwner > 10 && c.danger.count === 0, act: 'follow_close', say: '見失いやすい場所です。戻ります', note: '沼地freeで離れたら密着帰還' },
  { id: 'biome_swamp_dusk_greet', p: 342, when: c => c.x?.biome === 'swamp' && c.env.isDusk && c.owner.present && c.flags.warnOk, act: 'greet', say: '夕方です。沼は、夜になると音が増えます', note: '沼地の夕方挨拶' },

  // ===== サバンナ savanna =====
  { id: 'biome_savanna_day_follow_high_open', p: 349, when: c => c.x?.biome === 'savanna' && !c.env.isNight && c.mode === 'follow' && c.self.distOwner > 9, act: 'follow_high', say: null, note: 'サバンナは開けているので高めから追従' },
  { id: 'biome_savanna_sprint_follow', p: 352, when: c => c.x?.biome === 'savanna' && c.owner.sprinting && c.self.distOwner > 8 && c.owner.dimensionSame, act: 'follow', say: '平原の走行ですね。置いていかれないよう、調整します', note: 'サバンナで主人ダッシュ時は通常追従' },
  { id: 'biome_savanna_night_follow_close', p: 354, when: c => c.x?.biome === 'savanna' && c.env.isNight && c.mode === 'follow' && c.self.distOwner > 5, act: 'follow_close', say: '夜の平原は、見通しが良すぎるのも問題です。近くにいます', note: 'サバンナの夜は密着' },
  { id: 'biome_savanna_stay_idle_say_dry', p: 341, when: c => c.x?.biome === 'savanna' && c.mode === 'stay' && c.owner.idleSec >= 40 && c.flags.warnOk, act: 'say_only', say: '待機中です。乾いた風ですね。……コーヒーが、進みそうです', note: 'サバンナ待機の小ネタ（コーヒーモチーフ）' },
  { id: 'biome_savanna_dawn_greet', p: 342, when: c => c.x?.biome === 'savanna' && c.env.isDawn && c.owner.present && c.flags.warnOk, act: 'greet', say: 'おはようございます。地平線から朝です', note: 'サバンナの夜明け挨拶' },

  // ===== タイガ taiga =====
  { id: 'biome_taiga_snowy_follow_close', p: 353, when: c => c.x?.biome === 'taiga' && c.x?.snowy && c.mode === 'follow' && c.self.distOwner > 5, act: 'follow_close', say: '雪の森です。足音が、静かになりますね', note: '雪のタイガは密着' },
  { id: 'biome_taiga_night_follow_close_quiet', p: 355, when: c => c.x?.biome === 'taiga' && c.env.isNight && c.self.distOwner > 5 && c.owner.present, act: 'follow_close', say: null, note: 'タイガの夜は静かに密着（セリフなし）' },
  { id: 'biome_taiga_rain_idle_hover', p: 344, when: c => c.x?.biome === 'taiga' && c.env.isRaining && c.owner.idleSec >= 30 && c.danger.count === 0, act: 'idle_hover', say: '木陰で待機します。雨音が、一定です', note: 'タイガの雨＋アイドルは一緒に止まる' },
  { id: 'biome_taiga_work_follow_carry', p: 346, when: c => c.x?.biome === 'taiga' && c.mode === 'work' && c.inv.nearFull && c.self.distOwner > 8, act: 'follow_close', say: '荷物が増えました。入庫の前に、あなたの確認を', note: 'タイガworkでほぼ満載なら主人へ寄る' },
  { id: 'biome_taiga_dusk_say', p: 341, when: c => c.x?.biome === 'taiga' && c.env.isDusk && c.flags.warnOk && c.owner.present, act: 'say_only', say: '夕方です。森が暗くなるのは、早いですね', note: 'タイガの夕方コメント' },

  // ===== 平原 plains =====
  { id: 'biome_plains_day_follow_relaxed', p: 345, when: c => c.x?.biome === 'plains' && !c.env.isNight && c.mode === 'follow' && c.self.distOwner > 10 && c.danger.count === 0, act: 'follow', say: '開けた場所です。少し離れても、見えています', note: '平原の昼は標準距離で追従' },
  { id: 'biome_plains_sprint_follow_high', p: 350, when: c => c.x?.biome === 'plains' && c.owner.sprinting && c.self.distOwner > 10, act: 'follow_high', say: null, note: '平原ダッシュは高めから追う' },
  { id: 'biome_plains_night_follow_close', p: 354, when: c => c.x?.biome === 'plains' && c.env.isNight && c.mode === 'follow' && c.self.distOwner > 5, act: 'follow_close', say: '夜の平原です。近くにいます', note: '平原の夜は密着' },
  { id: 'biome_plains_idle_greet_breeze', p: 342, when: c => c.x?.biome === 'plains' && c.owner.idleSec >= 50 && c.flags.warnOk && c.danger.count === 0, act: 'greet', say: '休憩ですね。……次の作業まで、三分空いています', note: '平原で長めの休憩なら隣に来る（設定モチーフ）' },
  { id: 'biome_plains_thunder_rise_avoid', p: 356, when: c => c.x?.biome === 'plains' && c.env.isThundering && c.owner.present && c.danger.count === 0, act: 'rise_avoid', say: '雷です。開けた場所は、落ちやすいそうです。上へ', note: '平原の雷雨は上昇回避' },

  // ===== 洞窟 cave =====
  { id: 'biome_cave_underground_follow_close', p: 357, when: c => c.x?.biome === 'cave' && c.owner.underground && c.mode === 'follow' && c.self.distOwner > 3, act: 'follow_close', say: '天井が低いですね。密着します', note: '洞窟内は低く密着' },
  { id: 'biome_cave_lava_rise_avoid', p: 359, when: c => c.x?.biome === 'cave' && c.danger.lavaNear && c.owner.present, act: 'rise_avoid', say: '溶岩が近いです。……熱は感じませんが、あなたは別です', note: '洞窟で溶岩近接なら上昇回避' },
  { id: 'biome_cave_dark_follow_close_torchless', p: 353, when: c => c.x?.biome === 'cave' && !c.inv.hasTorch && c.owner.underground && c.self.distOwner > 4, act: 'follow_close', say: '暗いですね。私のランプが、代わりになります', note: '松明なしの洞窟ではランプ役として密着' },
  { id: 'biome_cave_hostiles_follow_close', p: 355, when: c => c.x?.biome === 'cave' && c.danger.count >= 2 && c.self.distOwner > 4 && c.owner.present, act: 'follow_close', say: '音が反響します。敵は、多めです', note: '洞窟で敵多数なら密着' },
  { id: 'biome_cave_stay_idle_say_echo', p: 341, when: c => c.x?.biome === 'cave' && c.mode === 'stay' && c.owner.idleSec >= 35 && c.flags.warnOk, act: 'say_only', say: '待機します。……声が、よく響きますね', note: '洞窟待機の小ネタ' },
  { id: 'biome_cave_work_follow_close_drops', p: 348, when: c => c.x?.biome === 'cave' && c.mode === 'work' && c.drops.count > 0 && c.self.distOwner > 6, act: 'follow_close', say: '落とし物は回収済みです。あなたのそばに戻ります', note: '洞窟workで回収後は主人へ寄る' },

  // ===== 横断（地形フラグの組み合わせ） =====
  { id: 'biome_x_highaltitude_snowy_follow_high', p: 358, when: c => !!c.x?.highAltitude && c.x?.snowy && c.mode === 'follow' && c.self.distOwner > 6, act: 'follow_high', say: null, note: '高所＋雪はバイオーム不問で高め追従' },
  { id: 'biome_x_nearocean_night_follow_close', p: 352, when: c => !!c.x?.nearOcean && c.env.isNight && c.mode === 'follow' && c.self.distOwner > 6, act: 'follow_close', say: '水辺の夜です。近くにいます', note: '水辺の夜はバイオーム不問で密着' },
  { id: 'biome_x_sandy_owner_onfire_rise', p: 357, when: c => !!c.x?.sandy && c.owner.onFire && c.owner.present, act: 'rise_avoid', say: '燃えています。……まず、火を消してください', note: '砂地で主人炎上なら上昇して距離を取る' },
  { id: 'biome_x_highaltitude_idle_greet_view', p: 343, when: c => !!c.x?.highAltitude && c.owner.idleSec >= 45 && c.flags.warnOk && c.danger.count === 0, act: 'greet', say: '見晴らしが良いですね。……作業の続きは、開いてあります', note: '高所で長め休憩なら挨拶（設定モチーフ）' },
  { id: 'biome_x_snowy_thunder_follow_close', p: 351, when: c => !!c.x?.snowy && c.env.isThundering && c.mode === 'follow' && c.self.distOwner > 5, act: 'follow_close', say: '雪と雷。忙しい天気です。近くにいます', note: '降雪＋雷雨は密着' },
  { id: 'biome_x_sandy_night_stay_idle', p: 344, when: c => !!c.x?.sandy && c.env.isNight && c.mode === 'stay' && c.owner.idleSec >= 30 && c.danger.count === 0, act: 'idle_hover', say: '待機中です。砂は、夜になると静かです', note: '砂地の夜の待機' },
];
