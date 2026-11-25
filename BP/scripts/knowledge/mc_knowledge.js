// mc_knowledge.js — リゼ (LIZE-07) のマイクラ知識ベース
// 純粋JS。lookupKnowledge(text) がキーワード一致スコア最良のエントリを返す。
// 口調は LIZE_SETTING.md 準拠（私／あなた、短い敬語）。
export const KNOWLEDGE = [
 {
  "id": "recipe_wood_pickaxe",
  "keys": [
   "木のツルハシ",
   "wood pickaxe",
   "ツルハシ"
  ],
  "topic": "recipe",
  "answer": "木のツルハシは、棒2本と素材3個を作業台に並べて作ります。採掘の基本です。原木を木材にすれば、すぐ作れます。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_wood_axe",
  "keys": [
   "木の斧",
   "wood axe",
   "斧"
  ],
  "topic": "recipe",
  "answer": "木の斧は、棒2本と素材3個を作業台に並べて作ります。伐採と、盾外しにも使えます。原木を木材にすれば、すぐ作れます。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_wood_sword",
  "keys": [
   "木の剣",
   "wood sword",
   "剣"
  ],
  "topic": "recipe",
  "answer": "木の剣は、棒1本と素材2個を作業台に並べて作ります。近接戦闘の基本です。原木を木材にすれば、すぐ作れます。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_wood_shovel",
  "keys": [
   "木のシャベル",
   "wood shovel",
   "シャベル"
  ],
  "topic": "recipe",
  "answer": "木のシャベルは、棒2本と素材1個を作業台に並べて作ります。土と砂が速く掘れます。原木を木材にすれば、すぐ作れます。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_wood_hoe",
  "keys": [
   "木のクワ",
   "wood hoe",
   "クワ"
  ],
  "topic": "recipe",
  "answer": "木のクワは、棒2本と素材2個を作業台に並べて作ります。畑を耕す道具です。原木を木材にすれば、すぐ作れます。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_stone_pickaxe",
  "keys": [
   "石のツルハシ",
   "stone pickaxe",
   "ツルハシ"
  ],
  "topic": "recipe",
  "answer": "石のツルハシは、棒2本と素材3個を作業台に並べて作ります。採掘の基本です。丸石は掘ればいくらでもあります。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_stone_axe",
  "keys": [
   "石の斧",
   "stone axe",
   "斧"
  ],
  "topic": "recipe",
  "answer": "石の斧は、棒2本と素材3個を作業台に並べて作ります。伐採と、盾外しにも使えます。丸石は掘ればいくらでもあります。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_stone_sword",
  "keys": [
   "石の剣",
   "stone sword",
   "剣"
  ],
  "topic": "recipe",
  "answer": "石の剣は、棒1本と素材2個を作業台に並べて作ります。近接戦闘の基本です。丸石は掘ればいくらでもあります。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_stone_shovel",
  "keys": [
   "石のシャベル",
   "stone shovel",
   "シャベル"
  ],
  "topic": "recipe",
  "answer": "石のシャベルは、棒2本と素材1個を作業台に並べて作ります。土と砂が速く掘れます。丸石は掘ればいくらでもあります。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_stone_hoe",
  "keys": [
   "石のクワ",
   "stone hoe",
   "クワ"
  ],
  "topic": "recipe",
  "answer": "石のクワは、棒2本と素材2個を作業台に並べて作ります。畑を耕す道具です。丸石は掘ればいくらでもあります。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_iron_pickaxe",
  "keys": [
   "鉄のツルハシ",
   "iron pickaxe",
   "ツルハシ"
  ],
  "topic": "recipe",
  "answer": "鉄のツルハシは、棒2本と素材3個を作業台に並べて作ります。採掘の基本です。鉄は序盤の要です。無駄遣いは控えてください。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_iron_axe",
  "keys": [
   "鉄の斧",
   "iron axe",
   "斧"
  ],
  "topic": "recipe",
  "answer": "鉄の斧は、棒2本と素材3個を作業台に並べて作ります。伐採と、盾外しにも使えます。鉄は序盤の要です。無駄遣いは控えてください。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_iron_sword",
  "keys": [
   "鉄の剣",
   "iron sword",
   "剣"
  ],
  "topic": "recipe",
  "answer": "鉄の剣は、棒1本と素材2個を作業台に並べて作ります。近接戦闘の基本です。鉄は序盤の要です。無駄遣いは控えてください。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_iron_shovel",
  "keys": [
   "鉄のシャベル",
   "iron shovel",
   "シャベル"
  ],
  "topic": "recipe",
  "answer": "鉄のシャベルは、棒2本と素材1個を作業台に並べて作ります。土と砂が速く掘れます。鉄は序盤の要です。無駄遣いは控えてください。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_iron_hoe",
  "keys": [
   "鉄のクワ",
   "iron hoe",
   "クワ"
  ],
  "topic": "recipe",
  "answer": "鉄のクワは、棒2本と素材2個を作業台に並べて作ります。畑を耕す道具です。鉄は序盤の要です。無駄遣いは控えてください。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_gold_pickaxe",
  "keys": [
   "金のツルハシ",
   "gold pickaxe",
   "ツルハシ"
  ],
  "topic": "recipe",
  "answer": "金のツルハシは、棒2本と素材3個を作業台に並べて作ります。採掘の基本です。金は柔らかく、道具の耐久は低めです。速さだけはありますが。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_gold_axe",
  "keys": [
   "金の斧",
   "gold axe",
   "斧"
  ],
  "topic": "recipe",
  "answer": "金の斧は、棒2本と素材3個を作業台に並べて作ります。伐採と、盾外しにも使えます。金は柔らかく、道具の耐久は低めです。速さだけはありますが。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_gold_sword",
  "keys": [
   "金の剣",
   "gold sword",
   "剣"
  ],
  "topic": "recipe",
  "answer": "金の剣は、棒1本と素材2個を作業台に並べて作ります。近接戦闘の基本です。金は柔らかく、道具の耐久は低めです。速さだけはありますが。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_gold_shovel",
  "keys": [
   "金のシャベル",
   "gold shovel",
   "シャベル"
  ],
  "topic": "recipe",
  "answer": "金のシャベルは、棒2本と素材1個を作業台に並べて作ります。土と砂が速く掘れます。金は柔らかく、道具の耐久は低めです。速さだけはありますが。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_gold_hoe",
  "keys": [
   "金のクワ",
   "gold hoe",
   "クワ"
  ],
  "topic": "recipe",
  "answer": "金のクワは、棒2本と素材2個を作業台に並べて作ります。畑を耕す道具です。金は柔らかく、道具の耐久は低めです。速さだけはありますが。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_diamond_pickaxe",
  "keys": [
   "ダイヤのツルハシ",
   "diamond pickaxe",
   "ツルハシ"
  ],
  "topic": "recipe",
  "answer": "ダイヤのツルハシは、棒2本と素材3個を作業台に並べて作ります。採掘の基本です。ダイヤモンドは貴重です。先にエンチャント台へ回す判断もどうぞ。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_diamond_axe",
  "keys": [
   "ダイヤの斧",
   "diamond axe",
   "斧"
  ],
  "topic": "recipe",
  "answer": "ダイヤの斧は、棒2本と素材3個を作業台に並べて作ります。伐採と、盾外しにも使えます。ダイヤモンドは貴重です。先にエンチャント台へ回す判断もどうぞ。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_diamond_sword",
  "keys": [
   "ダイヤの剣",
   "diamond sword",
   "剣"
  ],
  "topic": "recipe",
  "answer": "ダイヤの剣は、棒1本と素材2個を作業台に並べて作ります。近接戦闘の基本です。ダイヤモンドは貴重です。先にエンチャント台へ回す判断もどうぞ。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_diamond_shovel",
  "keys": [
   "ダイヤのシャベル",
   "diamond shovel",
   "シャベル"
  ],
  "topic": "recipe",
  "answer": "ダイヤのシャベルは、棒2本と素材1個を作業台に並べて作ります。土と砂が速く掘れます。ダイヤモンドは貴重です。先にエンチャント台へ回す判断もどうぞ。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_diamond_hoe",
  "keys": [
   "ダイヤのクワ",
   "diamond hoe",
   "クワ"
  ],
  "topic": "recipe",
  "answer": "ダイヤのクワは、棒2本と素材2個を作業台に並べて作ります。畑を耕す道具です。ダイヤモンドは貴重です。先にエンチャント台へ回す判断もどうぞ。",
  "related": [
   "recipe_crafting_table"
  ]
 },
 {
  "id": "recipe_netherite_tool",
  "keys": [
   "ネザライトのツルハシ",
   "ネザライト装備",
   "netherite"
  ],
  "topic": "recipe",
  "answer": "ネザライト装備は鍛冶台で作ります。ダイヤ装備とネザライトインゴット、鍛冶型を合わせてください。作業台では作れません。",
  "related": [
   "fact_netherite_scrap",
   "block_smithing_table"
  ]
 },
 {
  "id": "recipe_netherite_ingot",
  "keys": [
   "ネザライトインゴット",
   "netherite ingot"
  ],
  "topic": "recipe",
  "answer": "ネザライトインゴットは、ネザライトの欠片4個と金インゴット4個を作業台に並べます。欠片は古代の残骸を精錬して得ます。",
  "related": [
   "fact_netherite_scrap"
  ]
 },
 {
  "id": "recipe_leather_helmet",
  "keys": [
   "革のヘルメット",
   "leather helmet"
  ],
  "topic": "recipe",
  "answer": "革のヘルメットは、革5個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_leather_chestplate",
  "keys": [
   "革のチェストプレート",
   "leather chestplate"
  ],
  "topic": "recipe",
  "answer": "革のチェストプレートは、革8個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_leather_leggings",
  "keys": [
   "革のレギンス",
   "leather leggings"
  ],
  "topic": "recipe",
  "answer": "革のレギンスは、革7個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_leather_boots",
  "keys": [
   "革のブーツ",
   "leather boots"
  ],
  "topic": "recipe",
  "answer": "革のブーツは、革4個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_iron_helmet",
  "keys": [
   "鉄のヘルメット",
   "iron helmet"
  ],
  "topic": "recipe",
  "answer": "鉄のヘルメットは、鉄インゴット5個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_iron_chestplate",
  "keys": [
   "鉄のチェストプレート",
   "iron chestplate"
  ],
  "topic": "recipe",
  "answer": "鉄のチェストプレートは、鉄インゴット8個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_iron_leggings",
  "keys": [
   "鉄のレギンス",
   "iron leggings"
  ],
  "topic": "recipe",
  "answer": "鉄のレギンスは、鉄インゴット7個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_iron_boots",
  "keys": [
   "鉄のブーツ",
   "iron boots"
  ],
  "topic": "recipe",
  "answer": "鉄のブーツは、鉄インゴット4個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_gold_helmet",
  "keys": [
   "金のヘルメット",
   "gold helmet"
  ],
  "topic": "recipe",
  "answer": "金のヘルメットは、金インゴット5個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_gold_chestplate",
  "keys": [
   "金のチェストプレート",
   "gold chestplate"
  ],
  "topic": "recipe",
  "answer": "金のチェストプレートは、金インゴット8個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_gold_leggings",
  "keys": [
   "金のレギンス",
   "gold leggings"
  ],
  "topic": "recipe",
  "answer": "金のレギンスは、金インゴット7個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_gold_boots",
  "keys": [
   "金のブーツ",
   "gold boots"
  ],
  "topic": "recipe",
  "answer": "金のブーツは、金インゴット4個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_diamond_helmet",
  "keys": [
   "ダイヤのヘルメット",
   "diamond helmet"
  ],
  "topic": "recipe",
  "answer": "ダイヤのヘルメットは、ダイヤモンド5個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_diamond_chestplate",
  "keys": [
   "ダイヤのチェストプレート",
   "diamond chestplate"
  ],
  "topic": "recipe",
  "answer": "ダイヤのチェストプレートは、ダイヤモンド8個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_diamond_leggings",
  "keys": [
   "ダイヤのレギンス",
   "diamond leggings"
  ],
  "topic": "recipe",
  "answer": "ダイヤのレギンスは、ダイヤモンド7個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "recipe_diamond_boots",
  "keys": [
   "ダイヤのブーツ",
   "diamond boots"
  ],
  "topic": "recipe",
  "answer": "ダイヤのブーツは、ダイヤモンド4個を作業台に並べて作ります。革はウシやウマから、インゴットは精錬で用意してください。"
 },
 {
  "id": "fact_chainmail",
  "keys": [
   "チェーンメイル",
   "鎖帷子",
   "chainmail"
  ],
  "topic": "fact",
  "answer": "チェーンメイル装備は作業台では作れません。村人の取引か、モブのドロップで手に入ります。"
 },
 {
  "id": "fact_turtle_helmet",
  "keys": [
   "カメの甲羅",
   "亀のヘルメット",
   "turtle helmet"
  ],
  "topic": "fact",
  "answer": "カメの甲羅は、子ガメが育ったときに落とす鱗片を5枚集めて作ります。水中呼吸が少し延びます。"
 },
 {
  "id": "fact_elytra_craft",
  "keys": [
   "エリトラは作れる",
   "elytra craft",
   "エリトラ"
  ],
  "topic": "fact",
  "answer": "エリトラは作れません。エンドシップの船内、額縁にかかっているものを回収してください。"
 },
 {
  "id": "smelt_raw_iron",
  "keys": [
   "生の鉄",
   "鉄の原石",
   "鉄インゴット"
  ],
  "topic": "recipe",
  "answer": "鉄の原石をかまどで焼くと鉄インゴットになります。鉄鉱石を掘ると鉄の原石が出ます。それを焼けば鉄インゴットです。"
 },
 {
  "id": "smelt_raw_gold",
  "keys": [
   "生の金",
   "金の原石",
   "金インゴット"
  ],
  "topic": "recipe",
  "answer": "金の原石をかまどで焼くと金インゴットになります。金鉱石から金の原石、それを焼いて金インゴットです。"
 },
 {
  "id": "smelt_raw_copper",
  "keys": [
   "生の銅",
   "銅の原石",
   "銅インゴット"
  ],
  "topic": "recipe",
  "answer": "銅の原石をかまどで焼くと銅インゴットになります。銅鉱石からは原石が複数出ます。焼けば銅インゴットです。"
 },
 {
  "id": "smelt_glass",
  "keys": [
   "ガラス",
   "砂"
  ],
  "topic": "recipe",
  "answer": "砂をかまどで焼くとガラスになります。砂をかまどで焼くとガラスになります。シルクタッチなしでは回収できないので、置く場所は慎重に。"
 },
 {
  "id": "smelt_stone_smelt",
  "keys": [
   "石の精錬",
   "丸石",
   "石"
  ],
  "topic": "recipe",
  "answer": "丸石をかまどで焼くと石になります。丸石を焼くと石になります。もう一度焼けば滑らかな石です。"
 },
 {
  "id": "smelt_brick",
  "keys": [
   "レンガ",
   "粘土"
  ],
  "topic": "recipe",
  "answer": "粘土をかまどで焼くとレンガになります。粘土（ボール）を焼くとレンガ1個になります。4個並べればレンガブロックです。"
 },
 {
  "id": "smelt_terracotta",
  "keys": [
   "テラコッタ",
   "粘土ブロック"
  ],
  "topic": "recipe",
  "answer": "粘土ブロックをかまどで焼くとテラコッタになります。粘土ブロックを焼くとテラコッタになります。染料で色も付けられます。"
 },
 {
  "id": "smelt_nether_brick",
  "keys": [
   "ネザーレンガ",
   "ネザーラック"
  ],
  "topic": "recipe",
  "answer": "ネザーラックをかまどで焼くとネザーレンガになります。ネザーラックを焼くとネザーレンガになります。"
 },
 {
  "id": "smelt_charcoal",
  "keys": [
   "木炭",
   "原木"
  ],
  "topic": "recipe",
  "answer": "原木をかまどで焼くと木炭になります。原木を焼くと木炭になります。石炭と同じく松明と燃料に使えます。序盤の味方です。"
 },
 {
  "id": "smelt_dried_kelp",
  "keys": [
   "乾燥した昆布",
   "昆布"
  ],
  "topic": "recipe",
  "answer": "昆布をかまどで焼くと乾燥した昆布になります。昆布を焼くと乾燥した昆布になります。9個集めれば乾燥昆布ブロックという速い燃料にもなります。"
 },
 {
  "id": "smelt_netherite_scrap_smelt",
  "keys": [
   "欠片の精錬",
   "古代の残骸",
   "ネザライトの欠片"
  ],
  "topic": "recipe",
  "answer": "古代の残骸をかまどで焼くとネザライトの欠片になります。古代の残骸を焼くとネザライトの欠片になります。"
 },
 {
  "id": "smelt_cooked_beef",
  "keys": [
   "焼いた牛肉",
   "牛肉",
   "ステーキ"
  ],
  "topic": "recipe",
  "answer": "牛肉をかまどで焼くとステーキになります。牛肉を焼くとステーキです。満腹度の回復量は優秀な部類です。"
 },
 {
  "id": "smelt_baked_potato",
  "keys": [
   "ベイクドポテト",
   "ジャガイモ"
  ],
  "topic": "recipe",
  "answer": "ジャガイモをかまどで焼くとベイクドポテトになります。ジャガイモを焼くとベイクドポテトです。畑が安定すれば主食になります。"
 },
 {
  "id": "smelt_green_dye",
  "keys": [
   "緑の染料",
   "サボテン"
  ],
  "topic": "recipe",
  "answer": "サボテンをかまどで焼くと緑の染料になります。サボテンを焼くと緑の染料になります。"
 },
 {
  "id": "smelt_sponge_dry",
  "keys": [
   "乾いたスポンジ",
   "濡れたスポンジ",
   "スポンジ"
  ],
  "topic": "recipe",
  "answer": "濡れたスポンジをかまどで焼くとスポンジになります。濡れたスポンジは焼くと乾きます。ネザーに置く方法でも乾かせます。"
 },
 {
  "id": "smelt_popped_chorus",
  "keys": [
   "焼いたコーラス",
   "コーラスフルーツ",
   "焼いたコーラスフルーツ"
  ],
  "topic": "recipe",
  "answer": "コーラスフルーツをかまどで焼くと焼いたコーラスフルーツになります。コーラスフルーツを焼くと焼いたコーラスフルーツになり、エンドロッド等の材料になります。"
 },
 {
  "id": "recipe_crafting_table",
  "keys": [
   "作業台",
   "crafting table"
  ],
  "topic": "recipe",
  "answer": "木材4個を正方形に並べます。すべての始まりです。拠点の定位置に置いてください。"
 },
 {
  "id": "recipe_furnace",
  "keys": [
   "かまど",
   "furnace"
  ],
  "topic": "recipe",
  "answer": "丸石8個を四角く並べます。精錬と調理の要です。"
 },
 {
  "id": "recipe_torch",
  "keys": [
   "松明",
   "torch"
  ],
  "topic": "recipe",
  "answer": "棒1本と石炭か木炭1個で4本作れます。湧き潰しの基本です。"
 },
 {
  "id": "recipe_chest",
  "keys": [
   "チェスト",
   "chest"
  ],
  "topic": "recipe",
  "answer": "木材8個を四角く並べます。並べて置けばラージチェストになります。"
 },
 {
  "id": "recipe_bed",
  "keys": [
   "ベッド",
   "bed"
  ],
  "topic": "recipe",
  "answer": "羊毛3個と木材3個です。夜を飛ばせますし、リスポーン地点にもなります。"
 },
 {
  "id": "recipe_bucket",
  "keys": [
   "バケツ",
   "bucket"
  ],
  "topic": "recipe",
  "answer": "鉄インゴット3個をV字に並べます。水も溶岩も運べます。"
 },
 {
  "id": "recipe_shield",
  "keys": [
   "盾",
   "shield"
  ],
  "topic": "recipe",
  "answer": "木材6個と鉄インゴット1個です。スケルトンの矢とクリーパーの爆発を防げます。心強いですよ。"
 },
 {
  "id": "recipe_bow",
  "keys": [
   "弓",
   "bow"
  ],
  "topic": "recipe",
  "answer": "棒3本と糸3本です。矢も忘れずに。"
 },
 {
  "id": "recipe_arrow",
  "keys": [
   "矢",
   "arrow"
  ],
  "topic": "recipe",
  "answer": "火打石1個、棒1本、羽根1個で4本作れます。"
 },
 {
  "id": "recipe_fishing_rod",
  "keys": [
   "釣竿",
   "fishing rod"
  ],
  "topic": "recipe",
  "answer": "棒3本と糸2本です。エンチャント本が釣れることもあります。"
 },
 {
  "id": "recipe_shears",
  "keys": [
   "ハサミ",
   "shears"
  ],
  "topic": "recipe",
  "answer": "鉄インゴット2個を斜めに並べます。羊毛は刈るほうが継続的です。"
 },
 {
  "id": "recipe_flint_and_steel",
  "keys": [
   "火打石と打ち金",
   "flint and steel"
  ],
  "topic": "recipe",
  "answer": "鉄インゴット1個と火打石1個です。ネザーゲートの点火に要ります。"
 },
 {
  "id": "recipe_compass",
  "keys": [
   "コンパス",
   "compass"
  ],
  "topic": "recipe",
  "answer": "鉄インゴット4個とレッドストーンダスト1個です。初期スポーンを指します。磁石に使えば磁石コンパスにもなります。"
 },
 {
  "id": "recipe_clock",
  "keys": [
   "時計",
   "clock"
  ],
  "topic": "recipe",
  "answer": "金インゴット4個とレッドストーンダスト1個です。洞窟で昼夜が分かります。"
 },
 {
  "id": "recipe_paper",
  "keys": [
   "紙",
   "paper"
  ],
  "topic": "recipe",
  "answer": "サトウキビ3個を横に並べると3枚作れます。"
 },
 {
  "id": "recipe_book",
  "keys": [
   "本",
   "book"
  ],
  "topic": "recipe",
  "answer": "紙3枚と革1枚です。本棚とエンチャント台の材料になります。"
 },
 {
  "id": "recipe_bookshelf",
  "keys": [
   "本棚",
   "bookshelf"
  ],
  "topic": "recipe",
  "answer": "木材6個と本3冊です。エンチャント台の周りに15個置くと最大レベルになります。"
 },
 {
  "id": "recipe_enchanting_table",
  "keys": [
   "エンチャントテーブル",
   "enchanting table"
  ],
  "topic": "recipe",
  "answer": "本1冊、ダイヤモンド2個、黒曜石4個です。"
 },
 {
  "id": "recipe_anvil",
  "keys": [
   "金床",
   "anvil"
  ],
  "topic": "recipe",
  "answer": "鉄ブロック3個と鉄インゴット4個です。修理と命名とエンチャント合成に使います。落下ダメージもあるので頭上注意です。"
 },
 {
  "id": "recipe_brewing_stand",
  "keys": [
   "醸造台",
   "brewing stand"
  ],
  "topic": "recipe",
  "answer": "ブレイズロッド1本と丸石3個です。ポーション作りはここからです。"
 },
 {
  "id": "recipe_cauldron",
  "keys": [
   "大釜",
   "cauldron"
  ],
  "topic": "recipe",
  "answer": "鉄インゴット7個をU字に並べます。水や溶岩を溜められます。"
 },
 {
  "id": "recipe_hopper",
  "keys": [
   "ホッパー",
   "hopper"
  ],
  "topic": "recipe",
  "answer": "鉄インゴット5個とチェスト1個です。アイテムの自動搬送に使います。"
 },
 {
  "id": "recipe_piston",
  "keys": [
   "ピストン",
   "piston"
  ],
  "topic": "recipe",
  "answer": "木材3個、丸石4個、鉄インゴット1個、レッドストーンダスト1個です。"
 },
 {
  "id": "recipe_sticky_piston",
  "keys": [
   "粘着ピストン",
   "sticky piston"
  ],
  "topic": "recipe",
  "answer": "ピストンとスライムボールを合わせます。ブロックを引き戻せます。"
 },
 {
  "id": "recipe_observer",
  "keys": [
   "オブザーバー",
   "observer"
  ],
  "topic": "recipe",
  "answer": "丸石6個、レッドストーンダスト2個、ネザークォーツ1個です。ブロックの変化を検知します。"
 },
 {
  "id": "recipe_redstone_torch",
  "keys": [
   "レッドストーントーチ",
   "redstone torch"
  ],
  "topic": "recipe",
  "answer": "棒1本とレッドストーンダスト1個です。信号の反転にも使えます。"
 },
 {
  "id": "recipe_repeater",
  "keys": [
   "リピーター",
   "repeater"
  ],
  "topic": "recipe",
  "answer": "レッドストーントーチ2本、レッドストーンダスト1個、石3個です。信号の延長と遅延に。"
 },
 {
  "id": "recipe_comparator",
  "keys": [
   "コンパレーター",
   "comparator"
  ],
  "topic": "recipe",
  "answer": "レッドストーントーチ3本、ネザークォーツ1個、石3個です。在庫量の検知などに使います。"
 },
 {
  "id": "recipe_tnt",
  "keys": [
   "TNT",
   "tnt"
  ],
  "topic": "recipe",
  "answer": "火薬5個と砂4個を交互に並べます。爆発します。拠点の近くでの使用は、私は勧めません。"
 },
 {
  "id": "recipe_glass_pane",
  "keys": [
   "ガラス板",
   "glass pane"
  ],
  "topic": "recipe",
  "answer": "ガラス6個で16枚作れます。窓にはこちらが節約になります。"
 },
 {
  "id": "recipe_ladder",
  "keys": [
   "はしご",
   "ladder"
  ],
  "topic": "recipe",
  "answer": "棒7本をH字に並べると3個作れます。"
 },
 {
  "id": "recipe_fence_gate",
  "keys": [
   "フェンスゲート",
   "fence gate"
  ],
  "topic": "recipe",
  "answer": "棒4本と木材2個です。柵の出入口に。"
 },
 {
  "id": "recipe_iron_door",
  "keys": [
   "鉄のドア",
   "iron door"
  ],
  "topic": "recipe",
  "answer": "鉄インゴット6個です。ボタンやレバーがないと開きません。ゾンビに壊されない利点があります。"
 },
 {
  "id": "recipe_ender_chest_craft",
  "keys": [
   "エンダーチェストの作り方",
   "ender chest craft"
  ],
  "topic": "recipe",
  "answer": "黒曜石8個とエンダーアイ1個です。中身はどこからでも共通です。"
 },
 {
  "id": "recipe_eye_of_ender",
  "keys": [
   "エンダーアイ",
   "eye of ender"
  ],
  "topic": "recipe",
  "answer": "エンダーパール1個とブレイズパウダー1個です。要塞探しとエンドポータルの起動に要ります。"
 },
 {
  "id": "recipe_firework_rocket",
  "keys": [
   "ロケット花火",
   "firework rocket"
  ],
  "topic": "recipe",
  "answer": "紙1枚と火薬1個で3個作れます。火薬を増やすと飛行時間が延びます。エリトラのお供です。"
 },
 {
  "id": "recipe_lead",
  "keys": [
   "リード",
   "lead"
  ],
  "topic": "recipe",
  "answer": "糸4本とスライムボール1個です。動物を引いて歩けます。"
 },
 {
  "id": "recipe_saddle_fact",
  "keys": [
   "鞍は作れる",
   "saddle fact"
  ],
  "topic": "recipe",
  "answer": "鞍は作業台では作れません。ダンジョンのチェストや釣り、村人の取引で入手してください。"
 },
 {
  "id": "recipe_name_tag_fact",
  "keys": [
   "名札は作れる",
   "name tag fact"
  ],
  "topic": "recipe",
  "answer": "名札は作れません。チェストや釣りで入手し、金床で名前を付けます。名付けたモブはデスポーンしなくなります。"
 },
 {
  "id": "recipe_shulker_box",
  "keys": [
   "シュルカーボックス",
   "shulker box"
  ],
  "topic": "recipe",
  "answer": "シュルカーの殻2個とチェスト1個です。中身ごと持ち運べる箱です。物流が変わりますよ。"
 },
 {
  "id": "recipe_beacon",
  "keys": [
   "ビーコン",
   "beacon"
  ],
  "topic": "recipe",
  "answer": "ガラス5個、ネザースター1個、黒曜石3個です。土台のピラミッドも要ります。"
 },
 {
  "id": "recipe_conduit_craft",
  "keys": [
   "コンジットの作り方",
   "conduit craft"
  ],
  "topic": "recipe",
  "answer": "オウムガイの殻8個と海洋の心1個です。水中での活動が別物になります。"
 },
 {
  "id": "recipe_recovery_compass",
  "keys": [
   "リカバリーコンパス",
   "recovery compass"
  ],
  "topic": "recipe",
  "answer": "コンパス1個と反響の欠片8個です。最後に死んだ場所を指します。"
 },
 {
  "id": "recipe_goat_horn_fact",
  "keys": [
   "ヤギの角",
   "goat horn fact"
  ],
  "topic": "recipe",
  "answer": "ヤギが硬いブロックにぶつかると落とすことがあります。作るものではありません。音は大きいです。"
 },
 {
  "id": "recipe_cake",
  "keys": [
   "ケーキ",
   "cake"
  ],
  "topic": "recipe",
  "answer": "牛乳バケツ3個、砂糖2個、卵1個、小麦3個です。置いて食べる形式です。"
 },
 {
  "id": "recipe_cookie",
  "keys": [
   "クッキー",
   "cookie"
  ],
  "topic": "recipe",
  "answer": "小麦2個とココアビーンズ1個で8個作れます。数は正義、回復量は控えめです。"
 },
 {
  "id": "recipe_pumpkin_pie",
  "keys": [
   "かぼちゃパイ",
   "pumpkin pie"
  ],
  "topic": "recipe",
  "answer": "カボチャ1個、砂糖1個、卵1個です。持ち運べる良い食料です。"
 },
 {
  "id": "recipe_golden_carrot",
  "keys": [
   "金のニンジン",
   "golden carrot"
  ],
  "topic": "recipe",
  "answer": "ニンジン1個と金塊8個です。満腹度の質が高い食料で、醸造にも使います。"
 },
 {
  "id": "recipe_golden_apple",
  "keys": [
   "金のリンゴ",
   "golden apple"
  ],
  "topic": "recipe",
  "answer": "リンゴ1個と金インゴット8個です。緊急用の回復として優秀です。"
 },
 {
  "id": "recipe_glistering_melon",
  "keys": [
   "きらめくスイカ",
   "glistering melon"
  ],
  "topic": "recipe",
  "answer": "スイカの薄切り1個と金塊8個です。治癒ポーションの材料です。"
 },
 {
  "id": "recipe_fermented_spider_eye",
  "keys": [
   "発酵したクモの目",
   "fermented spider eye"
  ],
  "topic": "recipe",
  "answer": "クモの目1個、砂糖1個、茶色のキノコ1個です。ポーションを腐らせる材料です。"
 },
 {
  "id": "recipe_magma_cream",
  "keys": [
   "マグマクリーム",
   "magma cream"
  ],
  "topic": "recipe",
  "answer": "ブレイズパウダー1個とスライムボール1個です。マグマキューブから直接出ることもあります。"
 },
 {
  "id": "recipe_blaze_powder",
  "keys": [
   "ブレイズパウダー",
   "blaze powder"
  ],
  "topic": "recipe",
  "answer": "ブレイズロッド1本から2個作れます。醸造と燃料の両方に要ります。"
 },
 {
  "id": "recipe_ender_pearl_fact",
  "keys": [
   "エンダーパール",
   "ender pearl fact"
  ],
  "topic": "recipe",
  "answer": "エンダーマンを倒すと落とします。投げると着地点へ移動しますが、少しダメージを受けます。"
 },
 {
  "id": "block_smithing_table",
  "keys": [
   "鍛冶台",
   "smithing table"
  ],
  "topic": "block",
  "answer": "鍛冶台はネザライト強化に使います。鍛冶型も必要になりました。村では矢師が使っています。"
 },
 {
  "id": "block_grindstone",
  "keys": [
   "砥石",
   "grindstone"
  ],
  "topic": "block",
  "answer": "砥石はエンチャントを消して経験値に変えられます。修理にも使えます。"
 },
 {
  "id": "block_stonecutter",
  "keys": [
   "石切台",
   "stonecutter"
  ],
  "topic": "block",
  "answer": "石切台は石材を直接、階段や塀の形にできます。作業台より無駄がありません。"
 },
 {
  "id": "block_loom",
  "keys": [
   "機織り機",
   "loom"
  ],
  "topic": "block",
  "answer": "機織り機は旗の模様付け専用です。染料と旗模様を使います。"
 },
 {
  "id": "block_cartography_table",
  "keys": [
   "製図台",
   "cartography table"
  ],
  "topic": "block",
  "answer": "製図台は地図の拡張と複製、ロックに使います。紙の節約になります。"
 },
 {
  "id": "block_fletching_table",
  "keys": [
   "矢細工台",
   "fletching table"
  ],
  "topic": "block",
  "answer": "矢細工台は今のところ村人の職場です。矢師が就きます。"
 },
 {
  "id": "block_lectern",
  "keys": [
   "書見台",
   "lectern"
  ],
  "topic": "block",
  "answer": "書見台は本を置いて複数人で読めます。村では司書が就きます。信号も出せます。"
 },
 {
  "id": "block_composter",
  "keys": [
   "コンポスター",
   "composter"
  ],
  "topic": "block",
  "answer": "コンポスターは作物や種を入れると骨粉になります。農民の職場でもあります。"
 },
 {
  "id": "block_blast_furnace",
  "keys": [
   "溶鉱炉",
   "blast furnace"
  ],
  "topic": "block",
  "answer": "溶鉱炉は鉱石の精錬がかまどの2倍速です。食料は焼けません。防具鍛冶の職場です。"
 },
 {
  "id": "block_smoker",
  "keys": [
   "燻製器",
   "smoker"
  ],
  "topic": "block",
  "answer": "燻製器は食料専用で、かまどの2倍速です。鉱石は焼けません。肉屋の職場です。"
 },
 {
  "id": "block_barrel",
  "keys": [
   "樽",
   "barrel"
  ],
  "topic": "block",
  "answer": "樽はチェストと同じ27枠の収納です。上が塞がっていても開けられます。漁師の職場です。"
 },
 {
  "id": "block_respawn_anchor",
  "keys": [
   "リスポーンアンカー",
   "respawn anchor"
  ],
  "topic": "block",
  "answer": "リスポーンアンカーはネザーでリスポーン地点を設定します。グロウストーンで充電し、オーバーワールドで使うと爆発します。注意してください。"
 },
 {
  "id": "block_lodestone",
  "keys": [
   "ロードストーン",
   "lodestone"
  ],
  "topic": "block",
  "answer": "ロードストーンにコンパスを使うと、そのコンパスはそこを指し続けます。拠点の目印にどうぞ。"
 },
 {
  "id": "block_crying_obsidian",
  "keys": [
   "泣く黒曜石",
   "crying obsidian"
  ],
  "topic": "block",
  "answer": "泣く黒曜石はポータルの枠には使えません。リスポーンアンカーの材料です。"
 },
 {
  "id": "block_end_portal_frame",
  "keys": [
   "エンドポータルフレーム",
   "end portal frame"
  ],
  "topic": "block",
  "answer": "エンドポータルフレームは要塞のポータル部屋にあります。壊して持ち帰ることはできません。"
 },
 {
  "id": "mob_zombie",
  "keys": [
   "ゾンビ",
   "zombie"
  ],
  "topic": "mob",
  "answer": "人参やジャガイモ、鉄インゴットをまれに落とします。腐った肉が主です。村人を襲うので、村の夜は警戒を。"
 },
 {
  "id": "mob_skeleton",
  "keys": [
   "スケルトン",
   "skeleton"
  ],
  "topic": "mob",
  "answer": "骨と矢を落とします。骨は骨粉に、骨粉は作物の成長に。弓の狙いは正確です。遮蔽物を使ってください。"
 },
 {
  "id": "mob_creeper",
  "keys": [
   "クリーパー",
   "creeper"
  ],
  "topic": "mob",
  "answer": "火薬を落とします。爆発する前に倒せば確保できます。近づかれたら離れてください。……私が言うまでもないですね。"
 },
 {
  "id": "mob_spider",
  "keys": [
   "クモ",
   "spider"
  ],
  "topic": "mob",
  "answer": "糸とクモの目を落とします。昼は比較的おとなしくなります。壁を登るので塀だけでは不十分です。"
 },
 {
  "id": "mob_enderman",
  "keys": [
   "エンダーマン",
   "enderman"
  ],
  "topic": "mob",
  "answer": "エンダーパールを落とします。目を合わせると襲ってきます。水が苦手です。ブロックを運んでいく癖もあります。"
 },
 {
  "id": "mob_witch",
  "keys": [
   "ウィッチ",
   "witch"
  ],
  "topic": "mob",
  "answer": "レッドストーンやグロウストーンダスト、砂糖などを落とします。ポーションで自己回復するので、短期決戦が無難です。"
 },
 {
  "id": "mob_slime",
  "keys": [
   "スライム",
   "slime"
  ],
  "topic": "mob",
  "answer": "スライムボールを落とします。スライムチャンクか沼地の夜に出ます。大きいものは分裂します。"
 },
 {
  "id": "mob_blaze",
  "keys": [
   "ブレイズ",
   "blaze"
  ],
  "topic": "mob",
  "answer": "ブレイズロッドを落とします。醸造台とポーションの要です。雪玉が弱点ですが、現実的には弓と耐火が答えです。"
 },
 {
  "id": "mob_ghast",
  "keys": [
   "ガスト",
   "ghast"
  ],
  "topic": "mob",
  "answer": "ガストの涙と火薬を落とします。火の玉は打ち返せます。涙は再生ポーションの材料です。"
 },
 {
  "id": "mob_wither_skeleton",
  "keys": [
   "ウィザースケルトン",
   "wither skeleton"
  ],
  "topic": "mob",
  "answer": "石炭と骨、まれに頭蓋骨を落とします。頭蓋骨3つがウィザー召喚の鍵です。衰弱の追加ダメージに注意。"
 },
 {
  "id": "mob_piglin",
  "keys": [
   "ピグリン",
   "piglin"
  ],
  "topic": "mob",
  "answer": "金インゴットや金の装備などと物々交換します。金の防具を着ていないと襲われます。チェストを開けるのも怒ります。"
 },
 {
  "id": "mob_zombified_piglin",
  "keys": [
   "ゾンビピグリン",
   "zombified piglin"
  ],
  "topic": "mob",
  "answer": "金塊と腐った肉、まれに金インゴットを落とします。1体を攻撃すると群れで怒ります。手を出さないのが基本です。"
 },
 {
  "id": "mob_hoglin",
  "keys": [
   "ホグリン",
   "hoglin"
  ],
  "topic": "mob",
  "answer": "豚肉と革を落とします。歪んだキノコを怖がります。ネザーでの食料源です。"
 },
 {
  "id": "mob_magma_cube",
  "keys": [
   "マグマキューブ",
   "magma cube"
  ],
  "topic": "mob",
  "answer": "マグマクリームを落とします。溶岩の近くに出ます。スライムのネザー版と思ってください。"
 },
 {
  "id": "mob_phantom",
  "keys": [
   "ファントム",
   "phantom"
  ],
  "topic": "mob",
  "answer": "ファントムの被膜を落とします。3日以上寝ていないと夜空に現れます。被膜は落下速度低下ポーションとエリトラ修理に。……ちゃんと寝てください。"
 },
 {
  "id": "mob_drowned",
  "keys": [
   "ドラウンド",
   "drowned"
  ],
  "topic": "mob",
  "answer": "腐った肉と銅インゴット、まれにトライデントを落とします（トライデント持ち個体のみ）。水中の遠距離は厄介です。"
 },
 {
  "id": "mob_pillager",
  "keys": [
   "ピリジャー",
   "pillager"
  ],
  "topic": "mob",
  "answer": "クロスボウやエメラルドを落とします。隊長を倒すと不吉な予感が付きます。そのまま村に入ると襲撃が始まります。"
 },
 {
  "id": "mob_evoker",
  "keys": [
   "エヴォーカー",
   "evoker"
  ],
  "topic": "mob",
  "answer": "不死のトーテムとエメラルドを落とします。森の洋館と襲撃に出ます。トーテム目当てならここです。"
 },
 {
  "id": "mob_vindicator",
  "keys": [
   "ヴィンディケーター",
   "vindicator"
  ],
  "topic": "mob",
  "answer": "エメラルドと鉄の斧を落とします。近接の火力が高い相手です。距離を保ってください。"
 },
 {
  "id": "mob_ravager",
  "keys": [
   "ラヴェジャー",
   "ravager"
  ],
  "topic": "mob",
  "answer": "鞍を落とします。襲撃の大型個体です。盾で受けても吹き飛ばされます。"
 },
 {
  "id": "mob_guardian",
  "keys": [
   "ガーディアン",
   "guardian"
  ],
  "topic": "mob",
  "answer": "プリズマリンの欠片や結晶、生鱈を落とします。海底神殿の番人です。棘の反撃に注意。"
 },
 {
  "id": "mob_elder_guardian",
  "keys": [
   "エルダーガーディアン",
   "elder guardian"
  ],
  "topic": "mob",
  "answer": "スポンジとプリズマリン類を落とします。採掘速度低下をかけてきます。神殿に3体います。"
 },
 {
  "id": "mob_shulker",
  "keys": [
   "シュルカー",
   "shulker"
  ],
  "topic": "mob",
  "answer": "シュルカーの殻を落とすことがあります。殻2個でシュルカーボックスです。浮遊の弾には注意してください。"
 },
 {
  "id": "mob_warden",
  "keys": [
   "ウォーデン",
   "warden"
  ],
  "topic": "mob",
  "answer": "倒しても旨味はほぼありません。スカルクセンサーとシュリーカーで呼ばれます。戦う相手ではなく、避ける相手です。静かに動いてください。"
 },
 {
  "id": "mob_wither",
  "keys": [
   "ウィザー",
   "wither"
  ],
  "topic": "mob",
  "answer": "ネザースターを落とします。ビーコンの材料です。ウィザースケルトンの頭蓋骨3個とソウルサンド4個で召喚します。半分を切ると近接特化になります。"
 },
 {
  "id": "mob_ender_dragon",
  "keys": [
   "エンダードラゴン",
   "ender dragon"
  ],
  "topic": "mob",
  "answer": "倒すと大量の経験値とドラゴンの卵、帰還ポータルが開きます。再召喚にはエンドクリスタル4個が必要です。"
 },
 {
  "id": "mob_cow",
  "keys": [
   "ウシ",
   "cow"
  ],
  "topic": "mob",
  "answer": "革と牛肉を落とします。バケツで牛乳も取れます。革は本と防具の材料です。"
 },
 {
  "id": "mob_pig",
  "keys": [
   "ブタ",
   "pig"
  ],
  "topic": "mob",
  "answer": "豚肉を落とします。鞍とニンジン付きの棒で乗れますが、操縦性は期待しないでください。"
 },
 {
  "id": "mob_sheep",
  "keys": [
   "ヒツジ",
   "sheep"
  ],
  "topic": "mob",
  "answer": "羊毛と羊肉を落とします。倒すよりハサミで刈るほうが継続的に集まります。染料で色を変えられます。"
 },
 {
  "id": "mob_chicken",
  "keys": [
   "ニワトリ",
   "chicken"
  ],
  "topic": "mob",
  "answer": "羽根と鶏肉、卵を落とします。羽根は矢の材料です。落下がゆっくりで、落ちても死にません。"
 },
 {
  "id": "mob_squid",
  "keys": [
   "イカ",
   "squid"
  ],
  "topic": "mob",
  "answer": "イカスミを落とします。黒の染料になります。光るイカは発光イカスミです。"
 },
 {
  "id": "mob_axolotl",
  "keys": [
   "ウーパールーパー",
   "axolotl"
  ],
  "topic": "mob",
  "answer": "倒しても何も落としません。襲わないでください。水中戦では味方になってくれますし、熱帯魚のバケツで懐きます。"
 },
 {
  "id": "mob_villager_mob",
  "keys": [
   "村人",
   "villager mob"
  ],
  "topic": "mob",
  "answer": "取引相手です。職業ブロックで就職し、エメラルドと品物を交換します。ゾンビ村人の治療でも割引が付きます。大切にしてください。"
 },
 {
  "id": "mob_iron_golem",
  "keys": [
   "アイアンゴーレム",
   "iron golem"
  ],
  "topic": "mob",
  "answer": "鉄インゴットとポピーを落とします。村の守護者です。襲えば反撃されますし、村の評判も下がります。"
 },
 {
  "id": "mob_bee",
  "keys": [
   "ミツバチ",
   "bee"
  ],
  "topic": "mob",
  "answer": "倒しても落とし物はありません。巣や養蜂箱からハチミツとハニカムが取れます。刺すと死んでしまうので、焚き火の煙で落ち着かせてください。"
 },
 {
  "id": "mob_wolf",
  "keys": [
   "オオカミ",
   "wolf"
  ],
  "topic": "mob",
  "answer": "骨を与えると懐いてイヌになります。戦闘を手伝ってくれます。座らせて待機もできます。"
 },
 {
  "id": "mob_cat_mob",
  "keys": [
   "ネコ",
   "cat mob"
  ],
  "topic": "mob",
  "answer": "生鱈か生鮭で懐きます。クリーパーが逃げるので、拠点の番人に良いです。ベッドの上で寝ることもあります。"
 },
 {
  "id": "mob_turtle_mob",
  "keys": [
   "カメ",
   "turtle mob"
  ],
  "topic": "mob",
  "answer": "卵は砂浜に産みます。子ガメが大人になると鱗片を落とします。卵はモブに踏まれないよう守ってください。"
 },
 {
  "id": "mob_frog",
  "keys": [
   "カエル",
   "frog"
  ],
  "topic": "mob",
  "answer": "オタマジャクシが育つとカエルになります。マグマキューブを食べるとフロッグライトを出します。色は育ったバイオームで変わります。"
 },
 {
  "id": "mob_sniffer",
  "keys": [
   "スニッファー",
   "sniffer"
  ],
  "topic": "mob",
  "answer": "卵は海底遺跡の怪しい砂から出ます。地面の匂いを嗅いで古代の種を掘り出します。襲っても何も得られません。"
 },
 {
  "id": "mob_breeze",
  "keys": [
   "ブリーズ",
   "breeze"
  ],
  "topic": "mob",
  "answer": "ブリーズロッドを落とします。試練の間の相手です。風の玉で攻撃し、ジャンプで動き回ります。ロッドはウィンドチャージの材料です。"
 },
 {
  "id": "mob_bogged",
  "keys": [
   "ボグド",
   "bogged"
  ],
  "topic": "mob",
  "answer": "骨と矢、まれに毒の矢を落とします。沼地と試練の間にいるスケルトンの亜種です。"
 },
 {
  "id": "mob_strider",
  "keys": [
   "ストライダー",
   "strider"
  ],
  "topic": "mob",
  "answer": "糸を落とすことがあります。溶岩の上を歩ける乗り物です。歪んだキノコ付きの棒で操ります。寒がると震えます。"
 },
 {
  "id": "mob_wandering_trader",
  "keys": [
   "行商人",
   "wandering trader"
  ],
  "topic": "mob",
  "answer": "ラマを連れて現れる取引相手です。エメラルドで珍しい品を売ります。姿を消すポーションを飲むこともあります。"
 },
 {
  "id": "mob_silverfish",
  "keys": [
   "シルバーフィッシュ",
   "silverfish"
  ],
  "topic": "mob",
  "answer": "落とし物はありません。要塞などの石レンガに潜んでいて、壊すと出てきます。仲間を呼ぶので早めに処理を。"
 },
 {
  "id": "mob_endermite",
  "keys": [
   "エンダーマイト",
   "endermite"
  ],
  "topic": "mob",
  "answer": "エンダーパールを使うとたまに現れます。落とし物はありません。エンダーマンが敵視します。"
 },
 {
  "id": "mob_vex",
  "keys": [
   "ヴェックス",
   "vex"
  ],
  "topic": "mob",
  "answer": "落とし物はほぼありません。エヴォーカーが召喚し、壁をすり抜けます。短期決戦で本体を狙ってください。"
 },
 {
  "id": "mob_husks_strays",
  "keys": [
   "ハスクとストレイ",
   "husks strays"
  ],
  "topic": "mob",
  "answer": "ハスクは砂漠のゾンビで、空腹効果を付けます。ストレイは雪原のスケルトンで、鈍化の矢を放ちます。どちらも基本種の地域版です。"
 },
 {
  "id": "block_obsidian",
  "keys": [
   "黒曜石",
   "obsidian"
  ],
  "topic": "block",
  "answer": "黒曜石はダイヤかネザライトのツルハシでないと回収できません。爆発にも非常に強いです。水と溶岩が触れるとできます。"
 },
 {
  "id": "block_bedrock",
  "keys": [
   "岩盤",
   "bedrock"
  ],
  "topic": "block",
  "answer": "岩盤はサバイバルでは壊せません。世界の底と天井にある、絶対の境界です。"
 },
 {
  "id": "block_ancient_debris",
  "keys": [
   "古代の残骸",
   "ancient debris",
   "爆発"
  ],
  "topic": "block",
  "answer": "古代の残骸はネザーの地下にあります。爆発しても壊れず、溶岩に落としても燃えません。ダイヤ以上のツルハシで掘ってください。"
 },
 {
  "id": "block_deepslate",
  "keys": [
   "深層岩",
   "deepslate"
  ],
  "topic": "block",
  "answer": "深層岩はY=0より下の石です。通常の石より硬く、掘るのに時間がかかります。"
 },
 {
  "id": "block_spawner",
  "keys": [
   "スポナー",
   "spawner"
  ],
  "topic": "block",
  "answer": "スポナーは近づくとモブを湧かせます。松明で囲むと止まります（統合版では光で抑止）。壊すと経験値だけです。"
 },
 {
  "id": "block_sculk_sensor",
  "keys": [
   "スカルクセンサー",
   "sculk sensor"
  ],
  "topic": "block",
  "answer": "スカルクセンサーは振動を検知して信号を出します。羊毛で振動を遮れます。静かに歩けば気づかれにくいです。"
 },
 {
  "id": "block_trial_spawner",
  "keys": [
   "試練のスポナー",
   "trial spawner"
  ],
  "topic": "block",
  "answer": "試練のスポナーは近くの人数に応じた数のモブを出し、倒し切ると報酬を吐き出します。時間で再挑戦もできます。"
 },
 {
  "id": "block_vault",
  "keys": [
   "保管庫",
   "vault"
  ],
  "topic": "block",
  "answer": "保管庫は試練の鍵で開ける報酬箱です。不吉な保管庫には不吉な試練の鍵が要ります。一人一度までです。"
 },
 {
  "id": "block_slime_block",
  "keys": [
   "スライムブロック",
   "slime block"
  ],
  "topic": "block",
  "answer": "スライムブロックは落下ダメージを消して跳ね返します。粘着ピストンで引けるブロックでもあります。"
 },
 {
  "id": "block_honey_block",
  "keys": [
   "ハチミツブロック",
   "honey block"
  ],
  "topic": "block",
  "answer": "ハチミツブロックは落下速度を落とし、壁をずり落ちられます。スライムと違い、くっつけたブロックは引きません。"
 },
 {
  "id": "block_magma_block",
  "keys": [
   "マグマブロック",
   "magma block"
  ],
  "topic": "block",
  "answer": "マグマブロックは乗るとダメージを受けます。しゃがむか革のブーツで防げます。水中では泡の柱が下向きになります。"
 },
 {
  "id": "block_soul_sand",
  "keys": [
   "ソウルサンド",
   "soul sand"
  ],
  "topic": "block",
  "answer": "ソウルサンドは歩くと遅くなります。水中では上昇する泡の柱を作ります。エレベーターにどうぞ。"
 },
 {
  "id": "block_powder_snow",
  "keys": [
   "粉雪",
   "powder snow"
  ],
  "topic": "block",
  "answer": "粉雪は沈みます。革のブーツを履けば上に立てます。凍結ダメージがあるので長居は禁物です。"
 },
 {
  "id": "block_amethyst",
  "keys": [
   "アメジスト",
   "amethyst"
  ],
  "topic": "block",
  "answer": "アメジストはジオードの中にあります。芽生えたアメジストからは結晶が育ち、シルクタッチでないと母岩は回収できません。"
 },
 {
  "id": "block_tinted_glass",
  "keys": [
   "遮光ガラス",
   "tinted glass"
  ],
  "topic": "block",
  "answer": "遮光ガラスは光を通しません。アメジストの欠片とガラスで作ります。モブの視線も遮ります。"
 },
 {
  "id": "block_shulker_box_block",
  "keys": [
   "シュルカーボックスの性質",
   "shulker box block"
  ],
  "topic": "block",
  "answer": "シュルカーボックスは中身ごと壊して持ち運べます。溶岩で燃えず、ディスペンサーで設置もできます。整理の要です。"
 },
 {
  "id": "block_ender_chest_block",
  "keys": [
   "エンダーチェストの性質",
   "ender chest block"
  ],
  "topic": "block",
  "answer": "エンダーチェストの中身はプレイヤーごとに共通で、どこからでも同じ在庫にアクセスできます。壊すにはシルクタッチが要ります。"
 },
 {
  "id": "block_target_block",
  "keys": [
   "的",
   "target block"
  ],
  "topic": "block",
  "answer": "的は矢などの飛び道具が当たると信号を出します。当たった位置が中心に近いほど信号が強いです。"
 },
 {
  "id": "block_lightning_rod",
  "keys": [
   "避雷針",
   "lightning rod"
  ],
  "topic": "block",
  "answer": "避雷針は近くの落雷を引き寄せます。木造の拠点を守るなら設置してください。酸化もします。"
 },
 {
  "id": "block_dragon_egg",
  "keys": [
   "ドラゴンの卵",
   "dragon egg"
  ],
  "topic": "block",
  "answer": "ドラゴンの卵は触るとワープします。下に松明などを置いて、重力で落として回収してください。装飾品です。"
 },
 {
  "id": "block_beacon_pyramid",
  "keys": [
   "ビーコンの土台",
   "beacon pyramid"
  ],
  "topic": "block",
  "answer": "ビーコンの土台は鉄・金・ダイヤ・エメラルド・ネザライトのブロックで作るピラミッドです。最大4段で164ブロック要ります。効果の選択肢が増えます。"
 },
 {
  "id": "block_note_block",
  "keys": [
   "音符ブロック",
   "note block"
  ],
  "topic": "block",
  "answer": "音符ブロックは下のブロックで楽器が変わり、叩くと音が出ます。レッドストーンでも鳴らせます。"
 },
 {
  "id": "block_jukebox",
  "keys": [
   "ジュークボックス",
   "jukebox"
  ],
  "topic": "block",
  "answer": "ジュークボックスはレコードを再生します。ホッパーで出し入れもできます。"
 },
 {
  "id": "block_campfire",
  "keys": [
   "焚き火",
   "campfire"
  ],
  "topic": "block",
  "answer": "焚き火は食料を4つまで並べて焼けます。煙は目印になり、ハチを落ち着かせるのにも使います。"
 },
 {
  "id": "block_scaffolding",
  "keys": [
   "足場",
   "scaffolding"
  ],
  "topic": "block",
  "answer": "足場は素早く積み上がれて、まとめて壊せます。高所作業の安全にどうぞ。落ちるときはそのまま下まで滑れます。"
 },
 {
  "id": "block_chain_block",
  "keys": [
   "鎖",
   "chain block"
  ],
  "topic": "block",
  "answer": "鎖は縦にも横にも吊れます。ランタンを吊るす見た目にも、回路の装飾にも使えます。"
 },
 {
  "id": "block_mud",
  "keys": [
   "泥",
   "mud"
  ],
  "topic": "block",
  "answer": "泥は粘土にできます。水入り瓶で泥に、尖ったドリップストーンの上で乾かすと粘土です。レンガの量産に。"
 },
 {
  "id": "block_reinforced_deepslate",
  "keys": [
   "強化深層岩",
   "reinforced deepslate"
  ],
  "topic": "block",
  "answer": "強化深層岩は古代都市の中心にあります。サバイバルではほぼ壊せません。何かの枠、とだけ言っておきます。"
 },
 {
  "id": "block_frog_light",
  "keys": [
   "フロッグライト",
   "frog light"
  ],
  "topic": "block",
  "answer": "フロッグライトはカエルがマグマキューブを食べると出る光源です。色はカエルの種類で変わります。"
 },
 {
  "id": "block_heavy_core",
  "keys": [
   "重いコア",
   "heavy core"
  ],
  "topic": "block",
  "answer": "重いコアは不吉な保管庫からまれに出ます。メイスの材料です。"
 },
 {
  "id": "block_crafter",
  "keys": [
   "クラフター",
   "crafter"
  ],
  "topic": "block",
  "answer": "クラフターはレッドストーン信号で自動クラフトする装置です。レシピはボタンで切り替えます。自動化の要です。"
 },
 {
  "id": "block_copper_bulb",
  "keys": [
   "銅の電球",
   "copper bulb"
  ],
  "topic": "block",
  "answer": "銅の電球は信号を受けると点灯が切り替わります。酸化すると反応が遅くなります。"
 },
 {
  "id": "block_chiseled_bookshelf",
  "keys": [
   "彫刻本棚",
   "chiseled bookshelf"
  ],
  "topic": "block",
  "answer": "彫刻本棚は本を6冊まで出し入れできます。コンパレーターで冊数を検知できます。司書の家にもあります。"
 },
 {
  "id": "enchant_sharpness",
  "keys": [
   "鋭さ",
   "ダメージ増加",
   "sharpness"
  ],
  "topic": "fact",
  "answer": "鋭さは近接武器のダメージを上げます。アンデッド特効や虫特効とは同時には付きません。"
 },
 {
  "id": "enchant_smite",
  "keys": [
   "アンデッド特効",
   "スマイト",
   "smite"
  ],
  "topic": "fact",
  "answer": "アンデッド特効はゾンビやスケルトンなどアンデッドへのダメージが大きく上がります。"
 },
 {
  "id": "enchant_bane_of_arthropods",
  "keys": [
   "虫特効",
   "bane of arthropods"
  ],
  "topic": "fact",
  "answer": "虫特効はクモやミツバチなど虫系へのダメージが上がり、鈍化も付けます。対象は狭めです。"
 },
 {
  "id": "enchant_looting",
  "keys": [
   "ドロップ増加",
   "アイテムドロップ増加",
   "looting"
  ],
  "topic": "fact",
  "answer": "ドロップ増加は倒したモブのドロップ数とレア品の確率が上がります。剣に付けてください。"
 },
 {
  "id": "enchant_fortune",
  "keys": [
   "幸運",
   "フォーチュン",
   "fortune"
  ],
  "topic": "fact",
  "answer": "幸運は鉱石などのドロップ数が増えます。ダイヤや石炭に効きます。シルクタッチとは同時には付きません。"
 },
 {
  "id": "enchant_silk_touch",
  "keys": [
   "シルクタッチ",
   "silk touch"
  ],
  "topic": "fact",
  "answer": "シルクタッチはブロックをそのままの形で回収できます。鉱石やガラス、エンダーチェストに。幸運とは同時には付きません。"
 },
 {
  "id": "enchant_efficiency",
  "keys": [
   "効率強化",
   "効率",
   "efficiency"
  ],
  "topic": "fact",
  "answer": "効率強化は道具の採掘速度が上がります。ツルハシと斧の基本です。"
 },
 {
  "id": "enchant_unbreaking",
  "keys": [
   "耐久力",
   "耐久値",
   "unbreaking"
  ],
  "topic": "fact",
  "answer": "耐久力は使うときに耐久が減らない確率が上がります。実質の寿命が延びます。"
 },
 {
  "id": "enchant_mending",
  "keys": [
   "修繕",
   "メンディング",
   "mending"
  ],
  "topic": "fact",
  "answer": "修繕は経験値を拾うと、その分だけ装備が修理されます。司書の取引や釣りで入手します。耐久無限とはいきませんが、それに近い相棒になります。"
 },
 {
  "id": "enchant_protection",
  "keys": [
   "ダメージ軽減",
   "防護",
   "protection"
  ],
  "topic": "fact",
  "answer": "ダメージ軽減は防具の受けるダメージ全般を軽くします。属性別の軽減とは同時には付きません。"
 },
 {
  "id": "enchant_fire_protection",
  "keys": [
   "火炎耐性",
   "fire protection"
  ],
  "topic": "fact",
  "answer": "火炎耐性は炎のダメージと燃焼時間を軽くします。ネザー向きです。"
 },
 {
  "id": "enchant_blast_protection",
  "keys": [
   "爆発耐性",
   "blast protection"
  ],
  "topic": "fact",
  "answer": "爆発耐性は爆発のダメージとノックバックを軽くします。クリーパー対策に。"
 },
 {
  "id": "enchant_projectile_protection",
  "keys": [
   "飛び道具耐性",
   "projectile protection"
  ],
  "topic": "fact",
  "answer": "飛び道具耐性は矢などの飛び道具のダメージを軽くします。スケルトン戦に。"
 },
 {
  "id": "enchant_feather_falling",
  "keys": [
   "落下耐性",
   "落下軽減",
   "feather falling"
  ],
  "topic": "fact",
  "answer": "落下耐性は落下ダメージを軽くします。ブーツ専用です。高所作業の保険にどうぞ。"
 },
 {
  "id": "enchant_respiration",
  "keys": [
   "水中呼吸",
   "respiration"
  ],
  "topic": "fact",
  "answer": "水中呼吸は水中で息が長く持ち、視界も明るくなります。ヘルメット専用です。"
 },
 {
  "id": "enchant_aqua_affinity",
  "keys": [
   "水中採掘",
   "aqua affinity"
  ],
  "topic": "fact",
  "answer": "水中採掘は水中での採掘速度の低下をなくします。ヘルメット専用です。"
 },
 {
  "id": "enchant_thorns",
  "keys": [
   "棘の鎧",
   "thorns"
  ],
  "topic": "fact",
  "answer": "棘の鎧は攻撃してきた相手に確率でダメージを返します。耐久の消耗は早くなります。"
 },
 {
  "id": "enchant_depth_strider",
  "keys": [
   "水中歩行",
   "depth strider"
  ],
  "topic": "fact",
  "answer": "水中歩行は水中での移動が速くなります。氷結歩行とは同時には付きません。"
 },
 {
  "id": "enchant_frost_walker",
  "keys": [
   "氷結歩行",
   "氷渡り",
   "frost walker"
  ],
  "topic": "fact",
  "answer": "氷結歩行は水の上を歩くと氷になります。マグマブロックのダメージも防ぎます。水中歩行とは同時には付きません。"
 },
 {
  "id": "enchant_soul_speed",
  "keys": [
   "ソウルスピード",
   "soul speed"
  ],
  "topic": "fact",
  "answer": "ソウルスピードはソウルサンドとソウルソイルの上を速く走れます。ブーツの耐久は減ります。"
 },
 {
  "id": "enchant_swift_sneak",
  "keys": [
   "高速スニーク",
   "swift sneak"
  ],
  "topic": "fact",
  "answer": "高速スニークはしゃがんだまま速く動けます。古代都市で静かに動くための保険です。"
 },
 {
  "id": "enchant_fire_aspect",
  "keys": [
   "火属性",
   "fire aspect"
  ],
  "topic": "fact",
  "answer": "火属性は攻撃した相手に火が付きます。肉が焼けた状態で落ちることもあります。"
 },
 {
  "id": "enchant_knockback",
  "keys": [
   "ノックバック",
   "knockback"
  ],
  "topic": "fact",
  "answer": "ノックバックは攻撃の吹き飛ばしが強くなります。崖際では味方にも注意です。"
 },
 {
  "id": "enchant_sweeping_edge",
  "keys": [
   "範囲ダメージ増加",
   "sweeping edge"
  ],
  "topic": "fact",
  "answer": "範囲ダメージ増加は薙ぎ払いの範囲ダメージが上がります。統合版では効果の扱いが控えめです。"
 },
 {
  "id": "enchant_power",
  "keys": [
   "射撃ダメージ増加",
   "パワー",
   "power"
  ],
  "topic": "fact",
  "answer": "射撃ダメージ増加は弓のダメージが上がります。弓の基本エンチャントです。"
 },
 {
  "id": "enchant_infinity",
  "keys": [
   "無限",
   "インフィニティ",
   "infinity"
  ],
  "topic": "fact",
  "answer": "無限は通常の矢が減らなくなります。ただし矢は1本持っていないといけません。修繕とは同時には付きません。"
 },
 {
  "id": "enchant_flame",
  "keys": [
   "フレイム",
   "flame"
  ],
  "topic": "fact",
  "answer": "フレイムは弓の矢に火が付きます。当たった相手が燃えます。"
 },
 {
  "id": "enchant_punch",
  "keys": [
   "パンチ",
   "punch"
  ],
  "topic": "fact",
  "answer": "パンチは弓の吹き飛ばしが強くなります。"
 },
 {
  "id": "enchant_multishot",
  "keys": [
   "拡散",
   "multishot"
  ],
  "topic": "fact",
  "answer": "拡散はクロスボウが3本同時に放ちます。消費する矢は1本分です。"
 },
 {
  "id": "enchant_piercing",
  "keys": [
   "貫通",
   "piercing"
  ],
  "topic": "fact",
  "answer": "貫通はクロスボウの矢がモブを貫通します。盾も貫きます。"
 },
 {
  "id": "enchant_quick_charge",
  "keys": [
   "高速装填",
   "quick charge"
  ],
  "topic": "fact",
  "answer": "高速装填はクロスボウの装填が速くなります。"
 },
 {
  "id": "enchant_loyalty",
  "keys": [
   "忠誠",
   "loyalty"
  ],
  "topic": "fact",
  "answer": "忠誠はトライデントが手元に戻ってきます。虚空に落とすと戻れません。"
 },
 {
  "id": "enchant_channeling",
  "keys": [
   "召雷",
   "channeling"
  ],
  "topic": "fact",
  "answer": "召雷は雷雨のとき、投げたトライデントの着地点に雷が落ちます。帯電クリーパー作りにも使われます。"
 },
 {
  "id": "enchant_riptide",
  "keys": [
   "激流",
   "riptide"
  ],
  "topic": "fact",
  "answer": "激流は水中や雨の日に、トライデントと一緒に自分が突進します。エリトラの発進にも。"
 },
 {
  "id": "enchant_impaling",
  "keys": [
   "水生特効",
   "impaling"
  ],
  "topic": "fact",
  "answer": "水生特効は水生モブへのトライデントのダメージが上がります。"
 },
 {
  "id": "enchant_luck_of_the_sea",
  "keys": [
   "宝釣り",
   "luck of the sea"
  ],
  "topic": "fact",
  "answer": "宝釣りは釣りで宝物が出やすくなります。"
 },
 {
  "id": "enchant_lure",
  "keys": [
   "入れ食い",
   "lure"
  ],
  "topic": "fact",
  "answer": "入れ食いは魚が早く食いつきます。"
 },
 {
  "id": "enchant_density",
  "keys": [
   "密度",
   "density"
  ],
  "topic": "fact",
  "answer": "密度はメイス専用です。落下距離に応じてダメージが増えます。"
 },
 {
  "id": "enchant_breach",
  "keys": [
   "防具貫通",
   "breach"
  ],
  "topic": "fact",
  "answer": "防具貫通はメイス専用です。相手の防具の効果を一部貫通します。"
 },
 {
  "id": "enchant_wind_burst",
  "keys": [
   "風の爆発",
   "ウィンドバースト",
   "wind burst"
  ],
  "topic": "fact",
  "answer": "風の爆発はメイス専用です。落下攻撃が当たると風で跳ね上がり、連続の落下攻撃につなげます。"
 },
 {
  "id": "place_nether",
  "keys": [
   "ネザー",
   "nether"
  ],
  "topic": "fact",
  "answer": "ネザーは黒曜石の枠に火を付けて行く異次元です。距離は現世の8分の1で進みます。水は蒸発します。ベッドは爆発するので使わないでください。"
 },
 {
  "id": "place_the_end",
  "keys": [
   "ジ・エンド",
   "the end",
   "エンド"
  ],
  "topic": "fact",
  "answer": "エンドは要塞のポータルから行く終着の次元です。ドラゴンを倒すと帰還できます。落ちれば虚空です。足元には注意を。"
 },
 {
  "id": "place_stronghold",
  "keys": [
   "要塞",
   "stronghold",
   "ストロングホールド"
  ],
  "topic": "fact",
  "answer": "要塞は地下にあり、エンダーアイが方向を教えます。ポータル部屋にエンドポータルがあります。図書室のチェストも見逃さないでください。"
 },
 {
  "id": "place_nether_fortress",
  "keys": [
   "ネザー要塞",
   "nether fortress"
  ],
  "topic": "fact",
  "answer": "ネザー要塞にはブレイズとウィザースケルトンがいます。ネザーウォートもここで採れます。醸造の起点です。"
 },
 {
  "id": "place_bastion",
  "keys": [
   "砦の遺跡",
   "bastion",
   "バスティオン"
  ],
  "topic": "fact",
  "answer": "砦の遺跡はピグリンの拠点で、金やネザライト強化の鍛冶型があります。ブルートは金の防具でも怒ります。開封は静かにどうぞ。"
 },
 {
  "id": "place_end_city",
  "keys": [
   "エンドシティ",
   "end city"
  ],
  "topic": "fact",
  "answer": "エンドシティは外島にあり、シュルカーが守っています。エリトラは併設のエンドシップにあります。"
 },
 {
  "id": "place_ancient_city",
  "keys": [
   "古代都市",
   "ancient city",
   "ディープダーク"
  ],
  "topic": "fact",
  "answer": "古代都市は深層の地下にあります。ウォーデンの領域です。静かに、しゃがんで、宝だけ頂いて帰るのが正解です。"
 },
 {
  "id": "place_trial_chambers",
  "keys": [
   "試練の間",
   "trial chambers",
   "トライアルチャンバー"
  ],
  "topic": "fact",
  "answer": "試練の間は地下の構造物で、試練のスポナーと保管庫があります。メイスの材料の重いコアはここです。"
 },
 {
  "id": "place_ocean_monument",
  "keys": [
   "海底神殿",
   "ocean monument"
  ],
  "topic": "fact",
  "answer": "海底神殿はガーディアンとエルダーガーディアンの棲家です。金ブロック8個とスポンジの部屋があります。採掘疲労への備えを。"
 },
 {
  "id": "place_woodland_mansion",
  "keys": [
   "森の洋館",
   "woodland mansion"
  ],
  "topic": "fact",
  "answer": "森の洋館は製図家の地図で探します。エヴォーカーの不死のトーテムが目当てです。広いので迷子注意です。"
 },
 {
  "id": "place_mineshaft",
  "keys": [
   "廃坑",
   "mineshaft"
  ],
  "topic": "fact",
  "answer": "廃坑は地下の坑道で、チェスト付きトロッコに戦利品があります。洞窟グモのスポナーには注意してください。"
 },
 {
  "id": "place_village_place",
  "keys": [
   "村",
   "village place"
  ],
  "topic": "fact",
  "answer": "村は村人とベッドと職業ブロックの集まりです。襲撃から守れば取引の拠点になります。鐘が中心です。"
 },
 {
  "id": "place_pillager_outpost",
  "keys": [
   "ピリジャーの前哨基地",
   "pillager outpost"
  ],
  "topic": "fact",
  "answer": "前哨基地にはピリジャーと、捕らえられたゴーレムやアレイがいることがあります。隊長の旗が目印です。"
 },
 {
  "id": "place_desert_temple",
  "keys": [
   "砂漠の寺院",
   "desert temple",
   "ピラミッド"
  ],
  "topic": "fact",
  "answer": "砂漠の寺院の地下には宝箱が4つあります。中央の感圧板の下はTNTです。真下から掘らないでください。"
 },
 {
  "id": "place_jungle_temple",
  "keys": [
   "ジャングルの寺院",
   "jungle temple"
  ],
  "topic": "fact",
  "answer": "ジャングルの寺院には罠とパズルの先に宝箱があります。矢の罠は弦で分かります。"
 },
 {
  "id": "place_shipwreck",
  "keys": [
   "難破船",
   "shipwreck"
  ],
  "topic": "fact",
  "answer": "難破船には地図の入ったチェストがあります。宝の地図は埋められた宝への近道です。"
 },
 {
  "id": "place_buried_treasure",
  "keys": [
   "埋められた宝",
   "buried treasure",
   "宝の地図"
  ],
  "topic": "fact",
  "answer": "埋められた宝には海洋の心が入っています。地図の×印の真下、砂や砂利を掘ってください。"
 },
 {
  "id": "place_ruined_portal",
  "keys": [
   "荒廃したポータル",
   "ruined portal"
  ],
  "topic": "fact",
  "answer": "荒廃したポータルは現世とネザー両方にあります。泣く黒曜石と金の装備が目印です。直せばそのまま使えます。"
 },
 {
  "id": "place_igloo",
  "keys": [
   "イグルー",
   "igloo"
  ],
  "topic": "fact",
  "answer": "イグルーの地下室では、村人の治療の実験ができます。弱化のポーションと金のリンゴが揃っています。"
 },
 {
  "id": "place_witch_hut",
  "keys": [
   "ウィッチの小屋",
   "witch hut",
   "沼地の小屋"
  ],
  "topic": "fact",
  "answer": "ウィッチの小屋にはウィッチと黒ネコがいます。大釜とキノコもあります。"
 },
 {
  "id": "place_geode",
  "keys": [
   "アメジストジオード",
   "geode",
   "ジオード"
  ],
  "topic": "fact",
  "answer": "アメジストジオードは地下の球状の空洞です。スムース玄武岩と方解石に包まれています。"
 },
 {
  "id": "place_lush_caves",
  "keys": [
   "緑の洞窟",
   "lush caves",
   "繁茂した洞窟"
  ],
  "topic": "fact",
  "answer": "緑の洞窟はツツジの木の下に広がります。グロウベリーと苔、スニッファーではなくヒカリイカの水場もあります。"
 },
 {
  "id": "place_dripstone_caves",
  "keys": [
   "ドリップストーン洞窟",
   "dripstone caves",
   "鍾乳洞"
  ],
  "topic": "fact",
  "answer": "ドリップストーン洞窟は溶岩と水の採取に便利です。落ちてくる尖ったドリップストーンには注意してください。"
 },
 {
  "id": "brew_awkward",
  "keys": [
   "奇妙なポーション",
   "ネザーウォート"
  ],
  "topic": "recipe",
  "answer": "ポーションの土台は、水の瓶にネザーウォートを入れた奇妙なポーションです。ここから大半のポーションが分岐します。"
 },
 {
  "id": "brew_healing",
  "keys": [
   "治癒のポーション",
   "きらめくスイカ"
  ],
  "topic": "recipe",
  "answer": "治癒のポーションは奇妙なポーションにきらめくスイカです。即時回復です。グロウストーンでIIに強化できます。"
 },
 {
  "id": "brew_regeneration",
  "keys": [
   "再生のポーション",
   "ガストの涙"
  ],
  "topic": "recipe",
  "answer": "再生のポーションは奇妙なポーションにガストの涙です。じわじわ回復します。"
 },
 {
  "id": "brew_strength",
  "keys": [
   "力のポーション",
   "ブレイズパウダー"
  ],
  "topic": "recipe",
  "answer": "力のポーションは奇妙なポーションにブレイズパウダーです。近接ダメージが上がります。"
 },
 {
  "id": "brew_swiftness",
  "keys": [
   "俊敏のポーション",
   "砂糖"
  ],
  "topic": "recipe",
  "answer": "俊敏のポーションは奇妙なポーションに砂糖です。移動が速くなります。"
 },
 {
  "id": "brew_fire_resistance",
  "keys": [
   "耐火のポーション",
   "マグマクリーム"
  ],
  "topic": "recipe",
  "answer": "耐火のポーションは奇妙なポーションにマグマクリームです。溶岩に落ちても慌てずに済みます。"
 },
 {
  "id": "brew_night_vision",
  "keys": [
   "暗視のポーション",
   "金のニンジン"
  ],
  "topic": "recipe",
  "answer": "暗視のポーションは奇妙なポーションに金のニンジンです。洞窟と海中が明るく見えます。"
 },
 {
  "id": "brew_invisibility",
  "keys": [
   "透明化のポーション",
   "発酵したクモの目"
  ],
  "topic": "recipe",
  "answer": "透明化は暗視のポーションに発酵したクモの目です。防具は見えたままなので、過信は禁物です。"
 },
 {
  "id": "brew_leaping",
  "keys": [
   "跳躍のポーション",
   "ウサギの足"
  ],
  "topic": "recipe",
  "answer": "跳躍のポーションは奇妙なポーションにウサギの足です。高く跳べます。"
 },
 {
  "id": "brew_slow_falling",
  "keys": [
   "落下速度低下のポーション",
   "ファントムの被膜"
  ],
  "topic": "recipe",
  "answer": "落下速度低下は奇妙なポーションにファントムの被膜です。ゆっくり落ちます。ドラゴン戦の保険に。"
 },
 {
  "id": "brew_water_breathing",
  "keys": [
   "水中呼吸のポーション",
   "フグ"
  ],
  "topic": "recipe",
  "answer": "水中呼吸のポーションは奇妙なポーションにフグです。3分間、水中で息ができます。"
 },
 {
  "id": "brew_poison_brew",
  "keys": [
   "毒のポーション",
   "クモの目"
  ],
  "topic": "recipe",
  "answer": "毒のポーションは奇妙なポーションにクモの目です。投げる用です。飲まないでください。"
 },
 {
  "id": "brew_weakness",
  "keys": [
   "弱化のポーション",
   "発酵したクモの目"
  ],
  "topic": "recipe",
  "answer": "弱化のポーションは水の瓶に発酵したクモの目でも作れます。ゾンビ村人の治療に使うのは投げる形です。"
 },
 {
  "id": "brew_turtle_master",
  "keys": [
   "タートルマスターのポーション",
   "カメの甲羅"
  ],
  "topic": "recipe",
  "answer": "タートルマスターは奇妙なポーションにカメの甲羅（頭）です。鈍化と耐性が同時につく、硬い一杯です。"
 },
 {
  "id": "brew_extend_amplify",
  "keys": [
   "ポーションの延長と強化",
   "レッドストーンとグロウストーン",
   "効果時間",
   "ポーションを長く"
  ],
  "topic": "recipe",
  "answer": "レッドストーンを足すと時間が延び、グロウストーンダストを足すと効果がIIに強まります。両方は同時にかかりません。"
 },
 {
  "id": "brew_splash_lingering",
  "keys": [
   "スプラッシュと残留",
   "火薬とドラゴンの息"
  ],
  "topic": "recipe",
  "answer": "火薬を足すと投げられるスプラッシュに、ドラゴンの息を足すと残留ポーションになります。"
 },
 {
  "id": "tip_first_night",
  "keys": [
   "初日の夜",
   "初日"
  ],
  "topic": "tip",
  "answer": "初日は木を切り、作業台とベッドを確保してください。寝れば夜のモブを飛ばせます。羊3頭分の羊毛が最初の目標です。"
 },
 {
  "id": "tip_torch_spawn",
  "keys": [
   "湧き潰し",
   "松明の間隔"
  ],
  "topic": "tip",
  "answer": "オーバーワールドの敵対モブは明るさ0の場所に湧きます。拠点の周りは松明で面を埋めるのが確実です。"
 },
 {
  "id": "tip_diamond_level",
  "keys": [
   "ダイヤの高度",
   "ダイヤモンドのY",
   "どの高さ"
  ],
  "topic": "tip",
  "answer": "ダイヤモンドは深いほど増え、Y=-59付近が最も出やすい層です。ただし溶岩湖も増えます。足元注意でどうぞ。"
 },
 {
  "id": "tip_branch_mining",
  "keys": [
   "ブランチマイニング",
   "効率のいい掘り方"
  ],
  "topic": "tip",
  "answer": "ブランチマイニングは本坑道から2ブロック間隔で枝を掘る方法です。露出面が最大化されます。"
 },
 {
  "id": "tip_netherite_mining",
  "keys": [
   "ネザライトの掘り方",
   "古代の残骸のY"
  ],
  "topic": "tip",
  "answer": "古代の残骸はネザーのY=15前後が狙い目です。爆発に壊れないので、ベッド爆破やTNTでの採掘も行われます。自己責任の技ですが。"
 },
 {
  "id": "tip_enchant_setup",
  "keys": [
   "エンチャントの準備",
   "本棚15個"
  ],
  "topic": "tip",
  "answer": "エンチャント台の周りに本棚を15個置くとレベル30のエンチャントが出ます。間には何も置かないでください。"
 },
 {
  "id": "tip_xp_sources",
  "keys": [
   "経験値の集め方",
   "経験値稼ぎ"
  ],
  "topic": "tip",
  "answer": "経験値は鉱石、精錬、繁殖、モブ処理で溜まります。ネザークォーツ掘りは手軽で速い部類です。"
 },
 {
  "id": "tip_anvil_cost",
  "keys": [
   "金床のコスト",
   "高すぎます"
  ],
  "topic": "tip",
  "answer": "金床の作業は経験値コストが上がり続け、いずれ「高すぎます」と表示されます。修繕や名付けは早めの計画を。修繕エンチャントが根本解決です。"
 },
 {
  "id": "tip_cure_villager",
  "keys": [
   "ゾンビ村人の治療",
   "村人の治療"
  ],
  "topic": "tip",
  "answer": "ゾンビ村人に弱化のスプラッシュを当て、金のリンゴを与えると村人に戻ります。取引価格も下がります。数分かかります。"
 },
 {
  "id": "tip_villager_jobs",
  "keys": [
   "村人の職業",
   "職業ブロック"
  ],
  "topic": "tip",
  "answer": "村人は職業ブロックで就職します。司書のエンチャント本、道具鍛冶のダイヤ道具などが目当てです。就職前に取引をしなければ職業は変えられます。"
 },
 {
  "id": "tip_mending_source",
  "keys": [
   "修繕の入手",
   "メンディングの付け方",
   "エンチャント台"
  ],
  "topic": "tip",
  "answer": "修繕は通常のエンチャント台では出ません。司書の取引、釣り、構造物のチェストから入手します。"
 },
 {
  "id": "tip_nether_travel",
  "keys": [
   "ネザー移動",
   "8分の1"
  ],
  "topic": "tip",
  "answer": "ネザーの1ブロックは現世の8ブロック分です。遠方の拠点はネザー経由の線路や氷ボートでつなぐと速いです。"
 },
 {
  "id": "tip_gold_armor_nether",
  "keys": [
   "ネザーの金装備",
   "ピグリン対策"
  ],
  "topic": "tip",
  "answer": "ネザーでは金の防具を1部位でも着ると、ピグリンが襲ってきません。ブーツが安上がりです。"
 },
 {
  "id": "tip_shield_tip",
  "keys": [
   "盾の使い方",
   "盾は強い"
  ],
  "topic": "tip",
  "answer": "盾は矢と爆発と近接を正面から防ぎます。斧で一時的に無効化される点だけ注意してください。"
 },
 {
  "id": "tip_bed_nether_warning",
  "keys": [
   "ネザーのベッド",
   "ベッド爆発",
   "ネザーでベッド"
  ],
  "topic": "tip",
  "answer": "ネザーとエンドでベッドを使うと爆発します。事故にも、採掘にも、ドラゴン戦にも使われる性質です。拠点では絶対に試さないでください。"
 },
 {
  "id": "tip_dragon_fight",
  "keys": [
   "ドラゴン戦",
   "エンドクリスタル"
  ],
  "topic": "tip",
  "answer": "ドラゴン戦はまず黒曜石の柱のクリスタルを壊してください。鉄格子のものは登るかエンダーパールで近づきます。ベッドの爆発も有効ですが、距離感を誤らないよう。"
 },
 {
  "id": "tip_wither_fight",
  "keys": [
   "ウィザー戦",
   "ウィザー対策"
  ],
  "topic": "tip",
  "answer": "ウィザーは地下の狭い場所で戦うと動きを封じやすいです。牛乳で衰弱を消せます。再生ポーションと金のリンゴをどうぞ。"
 },
 {
  "id": "tip_elytra_tip",
  "keys": [
   "エリトラの飛び方",
   "ロケット花火"
  ],
  "topic": "tip",
  "answer": "エリトラは滑空です。ロケット花火で加速します。花火に星を混ぜると当たって痛いので、移動用は星なしで。"
 },
 {
  "id": "tip_shulker_tip",
  "keys": [
   "シュルカー対策",
   "浮遊"
  ],
  "topic": "tip",
  "answer": "シュルカーの弾は追尾します。殻を閉じている間は矢が効きません。浮遊で上がった先の落下に注意してください。"
 },
 {
  "id": "tip_raid_tip",
  "keys": [
   "襲撃",
   "ラベジャー対策"
  ],
  "topic": "tip",
  "answer": "襲撃は村のベッドと村人が条件です。高い場所と壁で流れを絞ると楽になります。トーテムはエヴォーカーからです。"
 },
 {
  "id": "tip_ocean_monument_tip",
  "keys": [
   "海底神殿の攻略",
   "採掘速度低下"
  ],
  "topic": "tip",
  "answer": "海底神殿は水中呼吸と暗視のポーション、牛乳（採掘疲労の解除）が鍵です。エルダーを倒せば掘れるようになります。"
 },
 {
  "id": "tip_ancient_city_tip",
  "keys": [
   "古代都市の歩き方",
   "ウォーデンを起こさない"
  ],
  "topic": "tip",
  "answer": "古代都市ではしゃがんで歩き、羊毛の上で移動してください。シュリーカーを3回鳴らすとウォーデンが出ます。走らないこと。"
 },
 {
  "id": "tip_trial_tip",
  "keys": [
   "試練の間の攻略",
   "不吉な瓶"
  ],
  "topic": "tip",
  "answer": "不吉な瓶を飲んで試練のスポナーに近づくと不吉な試練になり、報酬が豪華になります。不吉な保管庫にはメイスの重いコアがあります。"
 },
 {
  "id": "tip_iron_farm_tip",
  "keys": [
   "鉄の確保",
   "アイアンゴーレム"
  ],
  "topic": "tip",
  "answer": "鉄が足りないならゴーレム処理場が定番ですが、手掘りならY=16付近と山岳の地表露出も見てください。設計図は状況に合わせてどうぞ。"
 },
 {
  "id": "tip_food_tip",
  "keys": [
   "食料の選び方",
   "満腹度"
  ],
  "topic": "tip",
  "answer": "食料は回復量だけでなく隠れ満腹度が大事です。金のニンジンとステーキが優秀で、ベイクドポテトは量産向きです。"
 },
 {
  "id": "tip_farming_tip",
  "keys": [
   "畑のコツ",
   "作物の成長"
  ],
  "topic": "tip",
  "answer": "作物は水から4マス以内が湿り、明るさと交互植えで成長が速くなります。骨粉は即効薬です。"
 },
 {
  "id": "tip_breeding_tip",
  "keys": [
   "繁殖",
   "動物の増やし方"
  ],
  "topic": "tip",
  "answer": "ウシとヒツジは小麦、ブタはニンジン、ニワトリは種で繁殖します。増やしすぎると重くなるので計画的に。"
 },
 {
  "id": "tip_fishing_tip",
  "keys": [
   "釣り",
   "宝釣り"
  ],
  "topic": "tip",
  "answer": "釣りではエンチャント本や鞍、名札が釣れます。宝釣りと入れ食いの竿があると効率が上がります。雨の日は少し速いです。"
 },
 {
  "id": "tip_trading_hall_tip",
  "keys": [
   "取引のコツ",
   "エメラルド稼ぎ"
  ],
  "topic": "tip",
  "answer": "エメラルドは農民への作物売却や、矢師への棒の売却が回しやすいです。治療した村人は価格が下がります。"
 },
 {
  "id": "tip_storage_tip",
  "keys": [
   "倉庫の整理",
   "アイテム分類"
  ],
  "topic": "tip",
  "answer": "倉庫は素材・食料・貴重品・道具で分け、シュルカーボックスに現場セットを作ると迷いません。看板か額縁でラベルをどうぞ。"
 },
 {
  "id": "tip_death_recovery",
  "keys": [
   "死んだとき",
   "アイテム回収"
  ],
  "topic": "tip",
  "answer": "死んだ場所のアイテムは5分で消えます。リカバリーコンパスが最後の死亡地点を指します。焦らず、予備装備で回収へ。"
 },
 {
  "id": "tip_lava_safety",
  "keys": [
   "溶岩の安全",
   "溶岩に落ちた"
  ],
  "topic": "tip",
  "answer": "溶岩に入ったら耐火のポーションが最善です。なければ水場へ直行を。バケツの水はネザーでは使えません。"
 },
 {
  "id": "tip_fall_safety",
  "keys": [
   "落下対策",
   "落下ダメージ"
  ],
  "topic": "tip",
  "answer": "落下は水、ハチミツ、スライム、粉雪、落下耐性で受けられます。エンダーパールの着地も保険になります。"
 },
 {
  "id": "tip_cave_safety",
  "keys": [
   "洞窟探索",
   "洞窟の心得"
  ],
  "topic": "tip",
  "answer": "洞窟では松明を右側だけに置くと、帰り道が分かります。盾と食料と予備の松明を切らさないでください。"
 },
 {
  "id": "tip_enchant_priority",
  "keys": [
   "エンチャントの優先順",
   "何から付ける"
  ],
  "topic": "tip",
  "answer": "優先はツルハシに効率と耐久、防具にダメージ軽減、剣に鋭さとドロップ増加です。修繕は全部に欲しいところです。"
 },
 {
  "id": "tip_anvil_order",
  "keys": [
   "エンチャントの合成順",
   "金床の順番"
  ],
  "topic": "tip",
  "answer": "金床は本同士を先に合成してから装備に付けるとコストが下がります。作業回数がコストを決めます。"
 },
 {
  "id": "tip_beacon_effects",
  "keys": [
   "ビーコンの効果",
   "ビーコンの選び方"
  ],
  "topic": "tip",
  "answer": "ビーコンは採掘速度上昇と移動速度、攻撃力などが選べます。拠点作業なら採掘速度上昇IIが定番です。"
 },
 {
  "id": "tip_conduit_tip",
  "keys": [
   "コンジットの使い方",
   "水中拠点"
  ],
  "topic": "tip",
  "answer": "コンジットはプリズマリン類の枠で起動し、水中呼吸と視界と攻撃力をくれます。枠は最低16ブロック分です。"
 },
 {
  "id": "tip_map_tip",
  "keys": [
   "地図",
   "地図の拡張"
  ],
  "topic": "tip",
  "answer": "地図は製図台で縮小を重ねると広域になります。複製すれば複数人で同じ地図を持てます。"
 },
 {
  "id": "tip_respawn_tip",
  "keys": [
   "リスポーン管理",
   "スポーン地点"
  ],
  "topic": "tip",
  "answer": "ベッドで寝るとリスポーン地点が更新されます。ベッドを壊すと初期地点に戻るので、拠点のベッドは大切に。"
 },
 {
  "id": "tip_mob_switch_tip",
  "keys": [
   "モブの湧き条件",
   "湧き範囲"
  ],
  "topic": "tip",
  "answer": "敵対モブはプレイヤーから24ブロック以内には湧かず、128ブロックで消えます。処理場作りはこの距離が基本です。"
 },
 {
  "id": "tip_villager_breeding_tip",
  "keys": [
   "村人を増やす",
   "村の人口"
  ],
  "topic": "tip",
  "answer": "村人はベッドとパンなどの食料があれば増えます。襲撃とゾンビへの備えを先にどうぞ。"
 },
 {
  "id": "tip_goat_tip",
  "keys": [
   "ヤギ",
   "ヤギの突進"
  ],
  "topic": "tip",
  "answer": "ヤギはたまに突進します。硬いブロックに当たると角を落とすことがあります。崖際では突進の反動に注意です。"
 },
 {
  "id": "tip_camel_tip",
  "keys": [
   "ラクダ",
   "ラクダの乗り方"
  ],
  "topic": "tip",
  "answer": "ラクダは2人乗りでき、ダッシュで距離を跳べます。背が高く、多くの近接モブの攻撃が届きません。サボテンで繁殖します。"
 },
 {
  "id": "tip_armadillo_tip",
  "keys": [
   "アルマジロ",
   "アルマジロの鱗"
  ],
  "topic": "tip",
  "answer": "アルマジロはブラシで鱗を落とし、オオカミの鎧が作れます。サバンナにいます。クモの目で繁殖します。"
 },
 {
  "id": "tip_sniffer_tip",
  "keys": [
   "スニッファーの種",
   "古代の種"
  ],
  "topic": "tip",
  "answer": "スニッファーはトーチフラワーの種と投げピッチャーの種を掘り出します。観賞用ですが、畑の彩りには良いです。"
 },
 {
  "id": "tip_copper_tip",
  "keys": [
   "銅の使い道",
   "銅ブロック"
  ],
  "topic": "tip",
  "answer": "銅は避雷針と望遠鏡、ブラシに使います。ブロックは時間で酸化し、ハニカムで防げます。"
 },
 {
  "id": "tip_spyglass",
  "keys": [
   "望遠鏡",
   "望遠鏡の作り方"
  ],
  "topic": "tip",
  "answer": "望遠鏡はアメジストの欠片1個と銅インゴット2個です。遠くの下見にどうぞ。"
 },
 {
  "id": "tip_brush_tip",
  "keys": [
   "ブラシ",
   "怪しい砂"
  ],
  "topic": "tip",
  "answer": "ブラシは怪しい砂と怪しい砂利を払って遺物を取り出す道具です。羽根1本、銅インゴット1個、棒1本で作ります。"
 },
 {
  "id": "tip_mace_tip",
  "keys": [
   "メイス",
   "落下攻撃"
  ],
  "topic": "tip",
  "answer": "メイスは落下しながら当てると大ダメージになり、落下ダメージも消えます。高く跳べる風の爆発と好相性です。"
 },
 {
  "id": "mod_of_what",
  "keys": [
   "軌道工廠とは",
   "軌道工廠"
  ],
  "topic": "fact",
  "answer": "軌道工廠は工業系のアドオンです。機械で素材を加工したり、発電したりする要素が中心、という理解で大きく外れません。細部の数値はパック内のガイドを確認してください。"
 },
 {
  "id": "mod_of_machines",
  "keys": [
   "軌道工廠の機械"
  ],
  "topic": "fact",
  "answer": "軌道工廠の機械は、素材を入れて加工する流れが基本です。電力が必要な機械もあるので、発電と配線の確認からどうぞ。詰まったら入出力の向きを疑ってください。"
 },
 {
  "id": "mod_of_power",
  "keys": [
   "軌道工廠の電力"
  ],
  "topic": "fact",
  "answer": "軌道工廠の電力は、発電機で作って機械へ送るのが基本形です。動かないときは、発電量と接続と、機械側の受け入れを順に確認してください。"
 },
 {
  "id": "mod_of_start",
  "keys": [
   "軌道工廠の序盤"
  ],
  "topic": "fact",
  "answer": "軌道工廠の序盤は、まず基本素材の加工ラインを1本通すのがおすすめです。全部を同時に自動化しようとすると、だいたい詰まります。"
 },
 {
  "id": "mod_gvc_what",
  "keys": [
   "GVCとは"
  ],
  "topic": "fact",
  "answer": "GVCは銃と近代的な敵が追加される戦闘系のアドオンです。通常の剣弓より、遮蔽物と距離の管理が重要になります。"
 },
 {
  "id": "mod_gvc_combat",
  "keys": [
   "GVCの戦い方",
   "銃持ちの敵",
   "GVC"
  ],
  "topic": "fact",
  "answer": "銃持ちの敵は遮蔽物越しに詰めるのが基本です。開けた場所で撃ち合わないでください。私が前に出る判断をしたときだけ、ついてきてください。"
 },
 {
  "id": "mod_gvc_ammo",
  "keys": [
   "GVCの弾"
  ],
  "topic": "fact",
  "answer": "銃には対応する弾が要ります。出撃前に残弾の確認を。弾切れの銃は、ただ重い棒です。"
 },
 {
  "id": "mod_mods_together",
  "keys": [
   "軌道工廠とGVCの併用"
  ],
  "topic": "fact",
  "answer": "工業で装備を整えて、戦闘で使う。併用はその流れが相性が良いです。拠点の防衛を工業側で固めるのも手です。"
 },
 {
  "id": "mod_of_lize",
  "keys": [
   "軌道工廠のコンテナ"
  ],
  "topic": "fact",
  "answer": "軌道工廠のコンテナも、私の入庫先として使えます。拠点登録のときに近くのコンテナを見せてください。"
 },
 {
  "id": "mod_gvc_lize",
  "keys": [
   "GVCの貴重品"
  ],
  "topic": "fact",
  "answer": "GVCの銃や弾薬は貴重品として回収対象にしています。落とし物は私が拾いますので、安心して前へどうぞ。"
 }
];
;

// 正規化: 小文字化し、空白と読点を除去する
function norm(s) {
  return String(s ?? "").toLowerCase().replace(/[\s　、。・!！?？]/g, "");
}

// キーの出現頻度（文書頻度）。「ツルハシ」のような汎用キーの重みを下げる
const KEY_FREQ = new Map();
for (const e of KNOWLEDGE) {
  for (const k of new Set(e.keys.map(norm))) {
    if (k) KEY_FREQ.set(k, (KEY_FREQ.get(k) || 0) + 1);
  }
}

export function lookupKnowledge(text) {
  const t = norm(text);
  if (!t) return null;
  let best = null, bestScore = 0;
  for (const e of KNOWLEDGE) {
    let score = 0;
    for (const k of e.keys) {
      const nk = norm(k);
      if (!nk) continue;
      const idx = t.indexOf(nk);
      if (idx < 0) continue;
      const freq = KEY_FREQ.get(nk) || 1;
      score += (nk.length * nk.length + 4) / freq + (1 - idx / t.length) * 3;
    }
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return bestScore > 0 ? best : null;
}

export function countKnowledge() {
  return KNOWLEDGE.length;
}
