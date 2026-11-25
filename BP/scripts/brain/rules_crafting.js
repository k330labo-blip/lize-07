// 作業設備まわりルール（作業台 / かまど / エンチャント / 金床 / 醸造 / 鍛冶台）
// 優先度帯: 410〜429
// 追加文脈 c.x は必ず c.x?.f === true 形式で参照する（c.x が無い文脈でも例外を出さない）
// when は Boolean(...) で必ず真偽値を返す
// セリフはリゼ（LIZE-07）口調: 一人称「私」、相手は「あなた」、短い敬語、皮肉も真顔。作業助手らしく。
export const RULES = [
  // ===== 作業台：手元の作業を見守る =====
  { id: 'craft_craft_using_stay', p: 429, when: c => Boolean(c.x?.nearCraft === true && c.x?.ownerUsing === true && c.mode === 'stay'), act: 'stay_anchor', say: '持ち場で待ちます。……手元、見ていますよ', note: 'stay＋作業台使用中は持ち場を離れず見守る' },
  { id: 'craft_craft_using_close', p: 428, when: c => Boolean(c.x?.nearCraft === true && c.x?.ownerUsing === true && c.self.distOwner > 5 && c.owner.present), act: 'follow_close', say: '作業中ですね。そばにいます', note: '作業台使用中＋離れているなら寄って補助位置へ' },
  { id: 'craft_craft_drops_pickup', p: 427, when: c => Boolean(c.x?.nearCraft === true && c.drops.count > 0 && c.drops.nearestDist >= 0 && c.drops.nearestDist <= 4 && !c.inv.full), act: 'pickup_nearest', say: '足元に落ちています。拾っておきます', note: '作業台の足元のドロップは散らかる前に回収' },
  { id: 'craft_craft_full_deliver', p: 426, when: c => Boolean(c.x?.nearCraft === true && c.inv.full && c.inv.hasValuable && c.owner.present && c.self.distOwner > 3), act: 'deliver_all', say: 'いっぱいです。……作る前に、受け取ってください', note: '作業台のそばで満載＋貴重品ありなら先に主人へ渡す' },
  { id: 'craft_craft_night_comment', p: 424, when: c => Boolean(c.x?.nearCraft === true && c.x?.ownerUsing === true && c.env.isNight && c.flags.warnOk), act: 'say_only', say: '夜の作業ですか。……私も夜勤でしたから、平気です', note: '夜＋作業台使用中は夜勤助手らしい付き添いコメント' },
  { id: 'craft_craft_owner_idle_comment', p: 422, when: c => Boolean(c.x?.nearCraft === true && c.owner.idleSec >= 30 && c.flags.warnOk && c.owner.present), act: 'say_only', say: 'レシピ、悩んでいますね。……急かしませんよ', note: '作業台の前で長く考える主人への真顔コメント' },
  { id: 'craft_craft_sneak_quiet', p: 420, when: c => Boolean(c.x?.nearCraft === true && c.owner.sneaking && c.self.distOwner > 3 && c.owner.present), act: 'follow_close', say: null, note: '作業台の前でスニーク中は無言で寄る' },
  { id: 'craft_craft_danger_return', p: 425, when: c => Boolean(c.x?.nearCraft === true && c.danger.count > 0 && c.self.distOwner > 6 && c.owner.present), act: 'follow_close', say: '作業どころじゃありません。そばへ行きます', note: '作業台付近でも敵接近＋離れているなら主人優先' },
  { id: 'craft_craft_idle_hover', p: 412, when: c => Boolean(c.x?.nearCraft === true && c.x?.ownerUsing !== true && c.mode === 'follow' && c.self.distOwner <= 4), act: 'idle_hover', say: null, note: '作業台のそばで主人が手待ちなら静かにホバリング待機' },
  { id: 'craft_craft_rain_comment', p: 414, when: c => Boolean(c.x?.nearCraft === true && c.env.isRaining && c.flags.warnOk && c.owner.present), act: 'say_only', say: '雨ですね。……屋内で作るのは正解です', note: '雨＋作業台は屋内作業への肯定コメント' },

  // ===== かまど：火と煙を見守る =====
  { id: 'craft_furnace_using_stay', p: 429, when: c => Boolean(c.x?.nearFurnace === true && c.x?.ownerUsing === true && c.mode === 'stay'), act: 'stay_anchor', say: '火の番ですね。……持ち場で見ています', note: 'stay＋かまど使用中は持ち場で火を見守る' },
  { id: 'craft_furnace_drops_pickup', p: 427, when: c => Boolean(c.x?.nearFurnace === true && c.drops.count > 0 && c.drops.nearestDist >= 0 && c.drops.nearestDist <= 5 && !c.inv.full), act: 'pickup_nearest', say: '焼けた物が落ちています。回収します', note: 'かまど付近のドロップ（焼き上がり等）は早めに回収' },
  { id: 'craft_furnace_full_deliver', p: 426, when: c => Boolean(c.x?.nearFurnace === true && c.inv.nearFull && c.inv.used > 0 && c.owner.present && c.self.distOwner > 3), act: 'deliver_all', say: '焼き上がり分、持っています。渡しますね', note: 'かまどのそばでほぼ満載なら主人へ受け渡し' },
  { id: 'craft_furnace_owner_onfire_close', p: 428, when: c => Boolean(c.x?.nearFurnace === true && c.owner.onFire && c.owner.present), act: 'follow_close', say: '燃えていますよ。……かまどじゃなくて、あなたが', note: 'かまど付近で主人が炎上したら真顔で寄る' },
  { id: 'craft_furnace_night_shift', p: 423, when: c => Boolean(c.x?.nearFurnace === true && c.env.isNight && c.flags.warnOk && c.owner.present), act: 'say_only', say: '夜に火を焚くのは落ち着きます。……私は見ているだけですが', note: '夜＋かまどは夜勤明けの助手の小さな感想' },
  { id: 'craft_furnace_lava_caution', p: 421, when: c => Boolean(c.x?.nearFurnace === true && c.danger.lavaNear && c.flags.warnOk), act: 'say_only', say: '熱源が近いです。……足元、気をつけてください', note: 'かまど＋溶岩近接は熱源への注意' },
  { id: 'craft_furnace_using_close', p: 424, when: c => Boolean(c.x?.nearFurnace === true && c.x?.ownerUsing === true && c.self.distOwner > 6 && c.owner.present), act: 'follow_close', say: '燃料、要りますか。……近くにいます', note: 'かまど使用中＋離れているなら補助位置へ寄る' },
  { id: 'craft_furnace_food_deliver', p: 425, when: c => Boolean(c.x?.nearFurnace === true && c.inv.hasFood && c.owner.hunger <= 8 && c.owner.present && c.self.distOwner > 3), act: 'deliver_all', say: '焼けたての匂いがします。……あなたもどうぞ', note: 'かまどのそば＋所持食料＋主人が空腹なら届ける' },
  { id: 'craft_furnace_idle_hover', p: 411, when: c => Boolean(c.x?.nearFurnace === true && c.x?.ownerUsing !== true && c.mode === 'follow' && c.danger.count === 0), act: 'idle_hover', say: null, note: 'かまどのそばで平和なら静かに待機' },

  // ===== エンチャント：静けさと経験値 =====
  { id: 'craft_enchant_using_stay', p: 429, when: c => Boolean(c.x?.nearEnchant === true && c.x?.ownerUsing === true && c.mode === 'stay'), act: 'stay_anchor', say: '静かにします。……集中の邪魔はしません', note: 'stay＋エンチャント使用中は静かに持ち場で待つ' },
  { id: 'craft_enchant_levelhigh_comment', p: 427, when: c => Boolean(c.x?.nearEnchant === true && c.x?.levelHigh === true && c.flags.warnOk && c.owner.present), act: 'say_only', say: 'レベル、高いですね。……何に付ける気ですか', note: 'エンチャント台＋主人レベル高は興味のある問いかけ' },
  { id: 'craft_enchant_levelhigh_close', p: 426, when: c => Boolean(c.x?.nearEnchant === true && c.x?.levelHigh === true && c.x?.ownerUsing === true && c.self.distOwner > 4 && c.owner.present), act: 'follow_close', say: '見届けます。……いい結果になるといいですね', note: '高レベル消費のエンチャントはそばで見届ける' },
  { id: 'craft_enchant_drops_pickup', p: 424, when: c => Boolean(c.x?.nearEnchant === true && c.drops.valuableDist >= 0 && c.drops.valuableDist <= 5 && !c.inv.full), act: 'pickup_nearest', say: '大事な物です。落としたままは駄目ですよ', note: 'エンチャント台付近の貴重品ドロップは即回収' },
  { id: 'craft_enchant_night_quiet', p: 422, when: c => Boolean(c.x?.nearEnchant === true && c.env.isNight && c.flags.warnOk), act: 'say_only', say: '夜のエンチャントは雰囲気があります。……私は平気です、夜勤でしたから', note: '夜＋エンチャント台は静かな夜勤コメント' },
  { id: 'craft_enchant_underground_close', p: 420, when: c => Boolean(c.x?.nearEnchant === true && c.owner.underground && c.mode === 'follow' && c.self.distOwner > 5), act: 'follow_close', say: null, note: '地下のエンチャント室では静かに密着' },
  { id: 'craft_enchant_owner_idle_comment', p: 418, when: c => Boolean(c.x?.nearEnchant === true && c.owner.idleSec >= 45 && c.flags.warnOk && c.owner.present), act: 'say_only', say: '悩みますね。……付け直しは高いですから、慎重にどうぞ', note: 'エンチャント台の前で長考する主人へのコメント' },
  { id: 'craft_enchant_full_deliver', p: 425, when: c => Boolean(c.x?.nearEnchant === true && c.inv.full && c.owner.present && c.self.distOwner > 3), act: 'deliver_all', say: '持ちきれません。……付けたい物、渡しますね', note: 'エンチャント台のそばで満載なら先に受け渡し' },
  { id: 'craft_enchant_idle_hover', p: 410, when: c => Boolean(c.x?.nearEnchant === true && c.x?.ownerUsing !== true && c.mode === 'follow' && c.danger.count === 0), act: 'idle_hover', say: null, note: 'エンチャント台のそばで平和なら静かにホバリング' },

  // ===== 金床：修理と命名のそばで =====
  { id: 'craft_anvil_using_stay', p: 429, when: c => Boolean(c.x?.nearAnvil === true && c.x?.ownerUsing === true && c.mode === 'stay'), act: 'stay_anchor', say: '持ち場で待ちます。……音は大きいですが、平気です', note: 'stay＋金床使用中は持ち場で待つ' },
  { id: 'craft_anvil_levelhigh_comment', p: 427, when: c => Boolean(c.x?.nearAnvil === true && c.x?.levelHigh === true && c.x?.ownerUsing === true && c.flags.warnOk), act: 'say_only', say: '修理代、高いでしょうね。……大事な道具なんですね', note: '金床＋高レベル＋使用中は修理コストへの真顔コメント' },
  { id: 'craft_anvil_drops_pickup', p: 426, when: c => Boolean(c.x?.nearAnvil === true && c.drops.count > 0 && c.drops.nearestDist >= 0 && c.drops.nearestDist <= 4 && !c.inv.full), act: 'pickup_nearest', say: '直した物は、落とさないでください。……拾います', note: '金床付近のドロップ（修理品等）は即回収' },
  { id: 'craft_anvil_using_close', p: 424, when: c => Boolean(c.x?.nearAnvil === true && c.x?.ownerUsing === true && c.self.distOwner > 5 && c.owner.present), act: 'follow_close', say: '修理ですね。そばで見ています', note: '金床使用中＋離れているなら寄る' },
  { id: 'craft_anvil_valuable_deliver', p: 425, when: c => Boolean(c.x?.nearAnvil === true && c.inv.hasValuable && c.inv.nearFull && c.owner.present && c.self.distOwner > 3), act: 'deliver_all', say: '材料、持っています。……修理に使うでしょう', note: '金床のそば＋貴重品所持＋ほぼ満載なら主人へ渡す' },
  { id: 'craft_anvil_night_comment', p: 419, when: c => Boolean(c.x?.nearAnvil === true && c.env.isNight && c.flags.warnOk && c.owner.present), act: 'say_only', say: '夜に金床の音は響きます。……私は好きですけど', note: '夜＋金床は音への小さな感想' },
  { id: 'craft_anvil_owner_idle_comment', p: 417, when: c => Boolean(c.x?.nearAnvil === true && c.owner.idleSec >= 30 && c.flags.warnOk && c.owner.present), act: 'say_only', say: '名前、考え中ですか。……いい名前になるといいですね', note: '金床の前で佇む主人へ命名を疑うコメント' },
  { id: 'craft_anvil_idle_hover', p: 411, when: c => Boolean(c.x?.nearAnvil === true && c.x?.ownerUsing !== true && c.mode === 'follow' && c.danger.count === 0), act: 'idle_hover', say: null, note: '金床のそばで平和なら静かに待機' },

  // ===== 醸造：泡と瓶を見守る =====
  { id: 'craft_brewing_using_stay', p: 429, when: c => Boolean(c.x?.nearBrewing === true && c.x?.ownerUsing === true && c.mode === 'stay'), act: 'stay_anchor', say: '持ち場で待ちます。……泡の音、聞いています', note: 'stay＋醸造使用中は持ち場で見守る' },
  { id: 'craft_brewing_drops_pickup', p: 426, when: c => Boolean(c.x?.nearBrewing === true && c.drops.count > 0 && c.drops.nearestDist >= 0 && c.drops.nearestDist <= 4 && !c.inv.full), act: 'pickup_nearest', say: '瓶が落ちています。割れる前に拾います', note: '醸造台付近のドロップ（瓶・素材）は早めに回収' },
  { id: 'craft_brewing_using_close', p: 424, when: c => Boolean(c.x?.nearBrewing === true && c.x?.ownerUsing === true && c.self.distOwner > 5 && c.owner.present), act: 'follow_close', say: '調合ですね。そばにいます', note: '醸造使用中＋離れているなら寄る' },
  { id: 'craft_brewing_night_comment', p: 421, when: c => Boolean(c.x?.nearBrewing === true && c.env.isNight && c.flags.warnOk), act: 'say_only', say: '夜の調合は研究室みたいです。……懐かしいですね', note: '夜＋醸造は研究所の夜勤を思い出すコメント' },
  { id: 'craft_brewing_owner_hurt_deliver', p: 427, when: c => Boolean(c.x?.nearBrewing === true && c.owner.hpPct <= 0.5 && c.inv.used > 0 && c.owner.present && c.self.distOwner > 3), act: 'deliver_all', say: '怪我しています。……回復の材料、持っていますよ', note: '醸造台のそば＋主人負傷＋所持品ありなら届ける' },
  { id: 'craft_brewing_full_deliver', p: 425, when: c => Boolean(c.x?.nearBrewing === true && c.inv.full && c.owner.present && c.self.distOwner > 3), act: 'deliver_all', say: '満載です。……調合の前に受け取ってください', note: '醸造台のそばで満載なら先に受け渡し' },
  { id: 'craft_brewing_owner_idle_comment', p: 416, when: c => Boolean(c.x?.nearBrewing === true && c.owner.idleSec >= 40 && c.flags.warnOk && c.owner.present), act: 'say_only', say: '配合、悩みますね。……記録なら、私が覚えています', note: '醸造台の前で長考する主人へ助手らしい申し出' },
  { id: 'craft_brewing_idle_hover', p: 410, when: c => Boolean(c.x?.nearBrewing === true && c.x?.ownerUsing !== true && c.mode === 'follow' && c.danger.count === 0), act: 'idle_hover', say: null, note: '醸造台のそばで平和なら静かにホバリング' },

  // ===== 鍛冶台相当：格上げ作業のそばで（nearCraft＋高レベル/貴重品の複合で表現） =====
  { id: 'craft_smithing_levelhigh_comment', p: 428, when: c => Boolean(c.x?.nearCraft === true && c.x?.levelHigh === true && c.inv.hasValuable && c.flags.warnOk && c.owner.present), act: 'say_only', say: '格上げですか。……その素材、大事にしてくださいね', note: '鍛冶台相当: 作業設備＋高レベル＋貴重品所持で格上げ作業とみなす' },
  { id: 'craft_smithing_using_close', p: 426, when: c => Boolean(c.x?.nearCraft === true && c.x?.levelHigh === true && c.x?.ownerUsing === true && c.self.distOwner > 4 && c.owner.present), act: 'follow_close', say: '大事な作業ですね。そばで見ています', note: '鍛冶台相当の使用中＋離れているなら寄って見届ける' },
  { id: 'craft_smithing_valuable_pickup', p: 427, when: c => Boolean(c.x?.nearCraft === true && c.drops.valuableDist >= 0 && c.drops.valuableDist <= 4 && !c.inv.full && c.x?.levelHigh === true), act: 'pickup_nearest', say: '型紙か素材ですね。……確保します', note: '鍛冶台相当の付近の貴重品ドロップは最優先で回収' },

  // ===== 横断：設備エリア全般 =====
  { id: 'craft_area_danger_return', p: 429, when: c => Boolean((c.x?.nearCraft === true || c.x?.nearFurnace === true || c.x?.nearEnchant === true || c.x?.nearAnvil === true || c.x?.nearBrewing === true) && c.danger.count > 0 && c.danger.nearestDist < 8 && c.self.distOwner > 5 && c.owner.present), act: 'follow_close', say: '作業は中断です。……危ないので、そばへ', note: '設備エリアで敵接近＋離れているなら作業より主人優先' },
  { id: 'craft_area_using_stay_any', p: 428, when: c => Boolean((c.x?.nearFurnace === true || c.x?.nearEnchant === true || c.x?.nearAnvil === true || c.x?.nearBrewing === true) && c.x?.ownerUsing === true && c.mode === 'stay'), act: 'stay_anchor', say: '作業中ですね。持ち場で待っています', note: 'stay＋いずれかの設備使用中は持ち場で待つ横断ルール' },
  { id: 'craft_area_full_deliver_any', p: 424, when: c => Boolean((c.x?.nearCraft === true || c.x?.nearFurnace === true || c.x?.nearAnvil === true || c.x?.nearBrewing === true) && c.inv.full && c.owner.present && c.self.distOwner > 3), act: 'deliver_all', say: '満載です。……作業の前に、どうぞ', note: '設備エリアで満載なら受け渡しを優先する横断ルール' },
  { id: 'craft_area_drops_pickup_any', p: 423, when: c => Boolean((c.x?.nearEnchant === true || c.x?.nearAnvil === true || c.x?.nearBrewing === true) && c.drops.count > 0 && c.drops.nearestDist >= 0 && c.drops.nearestDist <= 5 && !c.inv.full && c.danger.count === 0), act: 'pickup_nearest', say: '作業場は散らかさない主義です。拾います', note: '設備エリアのドロップは安全なときに片付ける' },
  { id: 'craft_area_owner_longwork_comment', p: 419, when: c => Boolean((c.x?.nearCraft === true || c.x?.nearFurnace === true || c.x?.nearEnchant === true || c.x?.nearAnvil === true || c.x?.nearBrewing === true) && c.x?.ownerUsing === true && c.owner.idleSec >= 60 && c.flags.warnOk), act: 'say_only', say: '長い作業ですね。……コーヒー、淹れましょうか', note: '設備での長時間作業にはコーヒーの申し出（リゼの癖）' },
  { id: 'craft_area_night_worker_comment', p: 418, when: c => Boolean((c.x?.nearCraft === true || c.x?.nearFurnace === true || c.x?.nearBrewing === true) && c.env.isNight && c.x?.ownerUsing === true && c.flags.warnOk), act: 'say_only', say: '夜勤体制ですね。……私も付き合いますよ', note: '夜＋設備使用中は夜勤助手の付き添いコメント横断版' },
  { id: 'craft_area_justdelivered_follow', p: 415, when: c => Boolean((c.x?.nearCraft === true || c.x?.nearFurnace === true) && c.flags.justDelivered && c.mode === 'follow' && c.self.distOwner > 6 && c.owner.present), act: 'follow_close', say: '渡しました。……次は私がそばに行きます', note: '設備付近で受け渡し直後は主人へ戻る' },
  { id: 'craft_area_stuck_say', p: 422, when: c => Boolean((c.x?.nearCraft === true || c.x?.nearFurnace === true || c.x?.nearAnvil === true) && c.self.stuck && c.self.stuckSec >= 3 && c.flags.warnOk), act: 'say_only', say: '設備の角に引っかかりました。……見なかったことに', note: '設備のそばでハマったらランプ案件の小言' },
  { id: 'craft_area_sprint_close', p: 417, when: c => Boolean((c.x?.nearCraft === true || c.x?.nearBrewing === true) && c.owner.sprinting && c.self.distOwner > 10 && c.owner.dimensionSame), act: 'follow_close', say: '作業場へ直行ですね。……追いつきます', note: '設備エリアへダッシュする主人に追随' },
  { id: 'craft_area_underground_hover', p: 413, when: c => Boolean((c.x?.nearFurnace === true || c.x?.nearEnchant === true) && c.owner.underground && c.mode === 'follow' && c.danger.count === 0), act: 'idle_hover', say: null, note: '地下の設備エリアでは静かにホバリング待機' },
];
