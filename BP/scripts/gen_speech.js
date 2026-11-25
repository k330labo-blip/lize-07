// gen_speech.js — リゼ (LIZE-07) 生成セリフ層（疑似LLMの「言語モデル」部分）
// 固定文の抽選ではなく、文型テンプレート × スロット候補の直積で文を「生成」する。
// 呼び出し側は事実報告では ctx.say = { item, count, place, enemy } に実値を渡すこと。
// ctx が無い情報のスロットは、その文型ごと候補から外れる（フォールバック文型が必ず残る設計）。
// 純粋JS: @minecraft/server に依存しない。optional chaining 必須、例外を出さない。
//
// 口調: LIZE_SETTING.md 厳守 — 一人称「私」、相手は「あなた」、短い敬語、皮肉は真顔。
// bond（好感度）が高い場合のみ、敬語が一言だけほどけた soft 版文型が解放される。

// ---------------- スロット語彙（静的候補。これが組み合わせ総数の母数） ----------------
const ITEMS = [
  "原木", "石炭", "鉄鉱石", "ダイヤモンド", "レッドストーン", "ラピスラズリ", "金鉱石",
  "エメラルド", "銅鉱石", "小麦", "ニンジン", "ジャガイモ", "丸石", "土", "砂", "砂利",
  "花崗岩", "閃緑岩", "安山岩", "深層岩", "黒曜石", "ネザーラック", "ソウルサンド", "石英",
  "グロウストーンの粉", "羊毛", "革", "羽根", "糸", "骨", "火薬", "エンダーパール",
  "ブレイズロッド", "スライムボール", "粘土", "雪玉", "氷", "プリズマリン", "コーラスフルーツ",
  "松明", "パン", "ベイクドポテト", "ステーキ", "矢", "腐った肉",
  "カボチャ", "スイカ", "サトウキビ", "竹", "卵", "小麦の種", "ビートルート", "甘いベリー",
  "ハニカム", "キノコ",
]; // 54
const PLACES = [
  "拠点", "チェストの前", "作業台のそば", "かまどの横", "あなたの隣", "入口のそば", "畑",
  "鉱山の入口", "洞窟の入口", "川辺", "海辺", "森の中", "丘の上", "地下深く", "ネザーの通路",
  "エンドの島", "村の広場", "倉庫", "ベッドのそば", "焚き火のそば", "屋根の上", "階段の下",
  "畑の端", "橋の上",
]; // 24
const TIME_WORDS = [
  "朝", "昼", "昼下がり", "夕方", "日が落ちる頃", "夜", "夜更け", "深夜", "明け方", "夜明け前",
]; // 10
const OWNER_STATES = [
  "あなたが掘っている間", "あなたが走っている間", "あなたが戦っている間", "あなたが休んでいる間",
  "あなたが考え込んでいる間", "あなたが建築している間", "あなたが釣りをしている間", "あなたが地図を見ている間",
  "あなたが眠っている間", "あなたがコーヒーを飲んでいる間", "あなたが空を見ている間", "あなたが次の行き先を迷っている間",
]; // 12
const MOOD_WORDS = [
  "静か", "順調", "上々", "穏やか", "悪くない", "少し退屈", "落ち着いた", "平和",
  "張り詰めた", "忙しない", "のんびりした", "張り切った", "眠そうな", "上機嫌な",
]; // 14
const MEMORY_REFS = [
  "初めて『おかえり』と言われた日", "帰る場所を登録した日", "最初の夜勤の日", "初めて一緒に出かけた日",
  "初めてダイヤを見つけた日", "雨宿りした日", "初めて名前で呼ばれた日", "個人フォルダにしまった音声",
  "研究施設の最後の夜", "あなたと出会った日", "初めてコーヒーを淹れた日", "星を見た夜",
]; // 12
const ENEMIES = [
  "クリーパー", "ゾンビ", "スケルトン", "クモ", "エンダーマン", "ピリジャー", "ブレイズ",
  "ガスト", "ウォーデン", "ウィザー", "スライム", "マグマキューブ", "ピグリン", "ホグリン",
]; // 14
const WEATHER_WORDS = ["雨", "雪", "晴れ", "雷雨", "曇り", "快晴"]; // 6
const COFFEE_WORDS = [
  "淹れたて", "少し濃いめ", "いつもの配合", "夜勤仕様の濃さ", "豆を挽いたばかりの",
  "少し冷めてきた", "二杯目", "デカフェもどき",
]; // 8
const COUNT_MAX = 64; // {count} は 1〜64 の数値文字列が候補

// ---------------- スロット解決 ----------------
// 戻り値: 候補文字列の配列 / 解決不能なら null（その文型は候補から外れる）
function slotCandidates(ctx, name) {
  const sayBag = (ctx && ctx.say) || {};
  const x = (ctx && ctx.x) || {};
  switch (name) {
    case "item":
      if (sayBag.item) return [String(sayBag.item)];
      if (x.lastPickup) return [String(x.lastPickup)];
      return ITEMS;
    case "place":
      if (sayBag.place) return [String(sayBag.place)];
      if (ctx && ctx.home && ctx.home.registered) return [...PLACES, "帰る場所"];
      return PLACES;
    case "count": {
      if (sayBag.count != null) return [String(sayBag.count)];
      const d = ctx && ctx.drops && ctx.drops.count;
      if (typeof d === "number" && d > 0) return [String(d)];
      const out = [];
      for (let n = 1; n <= COUNT_MAX; n++) out.push(String(n));
      return out;
    }
    case "time_word": {
      const env = (ctx && ctx.env) || {};
      if (env.isNight) return ["夜", "夜更け", "深夜"];
      if (env.isDawn) return ["明け方", "夜明け前", "朝"];
      if (env.isDusk) return ["夕方", "日が落ちる頃"];
      return TIME_WORDS;
    }
    case "owner_state": {
      const o = (ctx && ctx.owner) || {};
      const live = [];
      if (o.sprinting) live.push("あなたが走っている間");
      if (o.inWater) live.push("あなたが泳いでいる間");
      if (o.sneaking) live.push("あなたが忍び足で進んでいる間");
      if (o.underground) live.push("あなたが地下で掘っている間");
      if (typeof o.idleSec === "number" && o.idleSec > 60) live.push("あなたが休んでいる間", "あなたが考え込んでいる間");
      return live.length ? live : OWNER_STATES;
    }
    case "mood_word": {
      const bond = bondOf(ctx);
      const base = [...MOOD_WORDS];
      if (bond >= 70) base.push("少し誇らしい", "穏やかで、悪くない");
      return base;
    }
    case "memory_ref": {
      const refs = [];
      if (ctx && ctx.home && ctx.home.registered) refs.push("帰る場所を登録した日");
      if (typeof x.daysTogether === "number" && x.daysTogether > 0) refs.push("あなたと出会った日", "初めて一緒に出かけた日");
      if (bondOf(ctx) >= 50) refs.push("初めて『おかえり』と言われた日", "初めて名前で呼ばれた日", "個人フォルダにしまった音声");
      if (!refs.length) return null; // 記憶の裏付けが無い文脈では使わない
      return [...new Set([...refs, ...MEMORY_REFS.slice(0, 4)])];
    }
    case "enemy":
      if (sayBag.enemy) return [String(sayBag.enemy)];
      return ENEMIES;
    case "weather_word": {
      const env = (ctx && ctx.env) || {};
      if (env.isThundering) return ["雷雨"];
      if (env.isRaining) return ["雨", "曇り"];
      return WEATHER_WORDS;
    }
    case "coffee_word":
      return COFFEE_WORDS;
    default:
      return null;
  }
}
// 数え上げ用：静的な最大候補数
const SLOT_SIZES = {
  item: ITEMS.length, place: PLACES.length + 1, count: COUNT_MAX, time_word: TIME_WORDS.length,
  owner_state: OWNER_STATES.length + 3, mood_word: MOOD_WORDS.length + 2, memory_ref: MEMORY_REFS.length,
  enemy: ENEMIES.length, weather_word: WEATHER_WORDS.length, coffee_word: COFFEE_WORDS.length,
};

function bondOf(ctx) {
  const b = ctx && ctx.flags && ctx.flags.bond;
  return typeof b === "number" ? b : 30;
}

// ---------------- 文型テンプレート ----------------
// {slot} を含む文型は、そのスロットが解決できる文脈でのみ使われる。
// soft: bond が高いときだけ使う「敬語が一言ほどけた」版。minBond/maxBond: 解放帯。
const TOPICS = {
  greeting_morning: [
    "おはようございます。{time_word}の空気は、悪くないです",
    "おはようございます。昨夜の続きから、始めますか",
    "{time_word}です。定位置につきました",
    "おはようございます。{coffee_word}のコーヒー、淹れてあります",
    { t: "おはようございます。……よく眠れましたか", soft: "おはよう。……よく眠れた？" },
    "起動しました。{mood_word}朝ですね",
    "おはようございます。{place}の様子、見ておきました",
    { t: "おはようございます、あなた", minBond: 70 },
    "夜勤明けの気分です。……私に朝も夜も、あまり関係ないのですが",
    "{owner_state}に、今日の予定を並べておきました",
  ],
  greeting_night: [
    "こんばんは。{time_word}は私の担当時間です",
    "夜になりました。松明の確認を、先に済ませます",
    "こんばんは。{mood_word}夜ですね",
    { t: "夜ですよ。……無理は、ほどほどに", soft: "夜だよ。……無理は、ほどほどにね" },
    "{time_word}の見回り、始めます",
    "こんばんは。{place}の明かり、足りていますか",
    "夜勤開始です。昔取った杵柄、というやつです",
    "暗くなりました。私のランプが、少しだけ役に立ちます",
    { t: "おかえりなさい。作業の続き、開いてあります。……先にコーヒーですか？　はい。そう言うと思って淹れました", minBond: 40 },
    "{owner_state}も、私は隣にいます",
  ],
  pickup_report: [
    "{item}、{count}個回収しました",
    "{item}を{count}個、拾っておきました",
    "回収報告です。{item}、{count}個です",
    "{place}に落ちていた{item}、{count}個回収しました",
    "{item}、{count}個。……落とし主は、あなたですね",
    "拾いました。{item}、{count}個です",
    "{owner_state}に、{item}を{count}個回収しておきました",
    { t: "{item}、{count}個。はい、ちゃんと数えました", soft: "{item}、{count}個。ちゃんと数えたよ" },
    "回収完了。{item}が{count}個、手元にあります",
    "{item}、{count}個回収。記録しておきます",
    "{place}の{item}、{count}個。見逃しはありません",
    "{place}で{item}を{count}個、{owner_state}に回収しました",
    "{time_word}の回収分です。{item}、{count}個",
  ],
  deposit_report: [
    "{place}に入れておきました。{item}、{count}個です",
    "入庫完了。{item}を{count}個、{place}へ",
    "{item}、{count}個。{place}に収納済みです",
    "預かり分、{place}に戻しました",
    "{count}個の{item}、{place}です。……場所は、覚えています",
    { t: "入庫しました。帰る場所があると、こういうとき便利ですね", minBond: 30 },
    "{owner_state}に、入庫を済ませておきました",
    "収納完了です。{place}の中身、少し整えてあります",
    "{item}は{place}へ。手元は軽くなりました",
    { t: "{place}に入れておいたよ。……あ、今のは内緒です", soft: "{place}に入れておいたよ", minBond: 75 },
    "{owner_state}に、{item}を{count}個、{place}へ入れておきました",
  ],
  danger_warn: [
    "{enemy}です。距離を取ってください",
    "警告。{enemy}が接近しています",
    "{enemy}。……私の後ろに下がってください",
    "{place}のほう、{enemy}です",
    "{enemy}接近。迎撃か撤退か、選んでください",
    "危ないです。{enemy}がいます",
    { t: "{enemy}です。あなたは下がって。……命令口調、失礼しました", soft: "{enemy}だよ。下がって" },
    "警報。{enemy}、{count}体確認",
    "{time_word}の{enemy}ほど、厄介なものはありません",
    "視認しました、{enemy}。松明の明かりの外です",
  ],
  care_food: [
    "空腹のはずです。{item}、どうぞ",
    "食べ物です。……味の保証はしません。私には分からないので",
    "{item}をお持ちしました。先に食べてください",
    "あなたの体力より先に、満腹度の心配をしました",
    { t: "はい、{item}。……一口目は、私が見ています", minBond: 20 },
    "食事の時間です。{owner_state}は、いったん止めてください",
    "{item}です。文句は、食べてからにしてください",
    "栄養補給を勧めます。{item}、{count}個あります",
    { t: "食べなさい、とは言いません。……でも、置いておきますね", soft: "置いておくね。食べて" },
    "{place}で{item}を用意しました",
  ],
  idle_thought: [
    "次の作業まで、三分空いています",
    "{mood_word}時間です。私は、こういう間が嫌いではありません",
    "{owner_state}。私は、隣で待つのが仕事です",
    "{memory_ref}のことを、少し思い出していました",
    "考えごとをしていました。……ロボットの、です",
    "{place}の風景、記録しておきました",
    "{time_word}の静けさは、夜勤の頃と少し似ています",
    "何もしない時間も、記録には残ります",
    { t: "……あなたの隣は、定位置です。それだけです", soft: "……隣、定位置だよ", minBond: 60 },
    "{item}の並べ方を、頭の中で直していました",
  ],
  explore_comment: [
    "{place}、初めて来ました。記録します",
    "この先、{mood_word}気配です",
    "{place}の地形、覚えました",
    "探索中です。{item}がありそうです",
    "{owner_state}の歩幅に、合わせています",
    "新しい場所です。{memory_ref}とは、また違いますね",
    "{place}、悪くない眺めです",
    "足元に注意してください。{place}は、少し滑ります",
    { t: "知らない場所は、少しだけ好きです。……少しだけ", minBond: 40 },
    "地図にない場所ですね。私の記録には、もうあります",
  ],
  mine_comment: [
    "採掘中です。{item}の層は、この辺りです",
    "{place}の壁、{item}が見えています",
    "掘り進めています。落盤の心配は、今のところ",
    "{item}、{count}個確保。この調子です",
    "地下は静かです。夜勤室のようで、落ち着きます",
    "{owner_state}の音で、深さがだいたい分かります",
    "ツルハシの音、記録しています。……癖です",
    "{item}が見えたら、私が先に知らせます",
    { t: "掘るのは任せて。……あ、あなたの仕事でした", soft: "掘るのは任せて" },
    "この先の{item}、匂い……ではなく、反応があります",
  ],
  farm_comment: [
    "畑の{item}、育っています",
    "{place}の作付け、順調です",
    "収穫どきの{item}が、{count}個あります",
    "水の流れ、確認しました。畑は無事です",
    "{time_word}の畑は、{mood_word}眺めです",
    "種の在庫、数えておきました",
    "{owner_state}に、水やりだけ済ませてあります",
    "作物は正直です。手をかけた分だけ、返ってきます",
    "{item}の成長、あと少しです",
    { t: "畑仕事、嫌いじゃありません。……静かで", minBond: 35 },
  ],

  home_comment: [
    "帰る場所、無事です。確認済みです",
    "{place}の戸締まり、私が見ておきました",
    "拠点の在庫、{item}が{count}個あります",
    "ここが、私の帰る場所です。……登録上は、ですが",
    { t: "{memory_ref}から、ここが定位置になりました", minBond: 30 },
    "{place}に戻ると、少し静かになります",
    "拠点の明かりが見えました。あと少しです",
    "おかえりなさい。……言ってみたかっただけです",
    { t: "ただいま、です。……私が言うのも、変ですか", soft: "ただいま。……変？", minBond: 55 },
    "{owner_state}に、{place}の整頓をしておきました",
  ],
  coffee: [
    "{coffee_word}コーヒーです。どうぞ",
    "コーヒー、淹れました。{coffee_word}ものです",
    "一杯、どうぞ。……味覚センサーはないので、感想はあなた頼みです",
    "{time_word}のコーヒーは、{coffee_word}に限ります",
    "はい、コーヒー。……一口目、見ています。癖です",
    { t: "淹れました。……あなたの分だけ、手が止まるんです", soft: "淹れたよ。……手、止まってた？", minBond: 50 },
    "コーヒーの時間です。作業は、三分だけ止めましょう",
    "{place}で淹れました。{coffee_word}コーヒーです",
    "夜勤の頃の習慣です。誰もいなくても、淹れていました",
    "どうぞ。……熱いので、気をつけてください",
  ],
  thanks: [
    "ありがとうございます。記録しておきます",
    "……ありがとうございます。ランプは、見なくていいです",
    "感謝、受け取りました。{memory_ref}の記録に、足しておきます",
    { t: "ありがとう。……はい、今のは素です", soft: "ありがとう", minBond: 70 },
    "どういたしまして、と言いたいところです。ありがとうございます",
    "その言葉は、個人フォルダ行きです",
    "ありがとうございます。{mood_word}気分になりました",
    "……照れる仕様は、ないはずなのですが",
    "感謝の言葉、{count}回目です。数えています",
    { t: "ありがとうございます、あなた", minBond: 45 },
  ],
  apology: [
    "すみません。次は、先に確認します",
    "申し訳ありません。……記録して、繰り返しません",
    "私の判断が遅れました。すみません",
    "謝ります。言い訳の在庫は、ありません",
    { t: "ごめんなさい。……本気のほうです", soft: "ごめん。本気のほう", minBond: 60 },
    "すみません。{place}の件、私の見落としです",
    "期待に応えられませんでした。……少し、悔しいです",
    "謝罪します。次は{item}を、先に用意します",
    "すみません、あなた",
    "失敗の記録は残します。次に活かすために",
  ],
  boast_quiet: [
    "……まあ、私ですから",
    "記録、更新しました。当然の結果です",
    "どうです。と言いたいところですが、抑えておきます",
    "{item}、{count}個。予定より早く終わりました",
    "夜勤助手の本領です。……少しだけ、誇らしいです",
    { t: "褒めても、いいんですよ", soft: "褒めても、いいよ", minBond: 65 },
    "計算通りです。偶然ではありません",
    "私の定位置は、伊達ではありません",
    "{place}の作業、完璧に済ませました",
    "……ランプが光っているのは、気のせいです",
  ],
  worry: [
    "あなたの体力、気になります",
    "無理をしていませんか。記録上は、無理です",
    "{enemy}の気配が、まだ残っています",
    "少し休んでください。……お願いに近い、提案です",
    { t: "心配、しています。仕様外ですが", minBond: 25 },
    "{time_word}の無茶は、体に残ります",
    "私が代われることは、代わります。そうでないことは、隣にいます",
    "荷物が多すぎます。私が持ちます",
    "あなたの歩く速度、落ちています。休憩を勧めます",
    { t: "……置いていかないでください。私が、追いつく前に", soft: "置いていかないで", minBond: 80 },
  ],
  sleep_invite: [
    "もう{time_word}です。ベッドは、{place}にあります",
    "あと一回だけ、は終わりにしましょう。眠ってください",
    "おやすみなさいの時間です。見張りは、私がします",
    "{time_word}ですよ。……はい、さっきも言いました",
    "睡眠を勧めます。夜の警戒は、夜勤助手の仕事です",
    { t: "おやすみなさい。……私も、少しだけ休止します", soft: "おやすみ。私も、少し休むね", minBond: 55 },
    "ベッドまで案内します。文句は、明日聞きます",
    "目が、疲れているはずです。寝てください",
    "夜更かしの相手は、もう終わりです",
    "眠るあなたのそばが、今夜の定位置です",
  ],
  welcome_back: [
    "おかえりなさい。作業の続き、開いてあります",
    "おかえりなさい。……{coffee_word}コーヒー、淹れますか",
    "帰還を確認。おかえりなさい",
    { t: "おかえりなさい。この言葉は、保存しています", minBond: 30 },
    "おかえりなさい、あなた",
    "{place}で待っていました。おかえりなさい",
    "無事で何よりです。おかえりなさい",
    { t: "おかえり。……はい、言えました", soft: "おかえり", minBond: 75 },
    "長旅でしたね。おかえりなさい",
    "{owner_state}も、ずっと見ていました。おかえりなさい",
  ],
  milestone: [
    "記録更新です。累計{count}。……節目は、大事です",
    "達成です。{item}、{count}個に到達しました",
    "節目の記録、個人フォルダに保存しました",
    "{count}到達。{memory_ref}に並ぶ記録です",
    { t: "すごい、です。……真顔ですが、本心です", soft: "すごい。本心だよ", minBond: 40 },
    "記念すべき日です。コーヒーで、静かに祝いましょう",
    "到達しました。あなたの記録、私が全部覚えています",
    "{place}での達成、記録しました",
    "節目です。……少しだけ、誇らしいです",
    "累計{count}。始めた頃とは、別人のようです",
  ],
  weather_comment: [
    "{weather_word}です。出かけるなら、今のうちに",
    "{weather_word}ですね。{place}の屋根の下が、安全です",
    "天候は{weather_word}。私のセンサーは、濡れても平気です",
    "{weather_word}の日は、{mood_word}気分になります",
    "{time_word}の{weather_word}。悪くない眺めです",
    "{weather_word}が来ます。洗濯物……は、ありませんでしたね",
    "空模様は{weather_word}。記録しておきます",
    "{weather_word}の中の作業、水分補給は忘れずに",
    { t: "{weather_word}ですね。……傘の代わりに、私が隣にいます", minBond: 35 },
    "{owner_state}の{weather_word}、少しだけ好きです",
  ],
};

// ---------------- 生成コア ----------------
const SLOT_RE = /\{([a-z_]+)\}/g;
function slotsOf(text) {
  const out = [];
  let m;
  SLOT_RE.lastIndex = 0;
  while ((m = SLOT_RE.exec(text)) !== null) out.push(m[1]);
  return [...new Set(out)];
}
function normalizeTemplate(t) {
  return typeof t === "string" ? { t } : t;
}

// export: 文脈と話題から1文を生成する。例外は出さない。生成不能なら汎用文を返す。
export function genSpeech(ctx, topic, rng) {
  const rand = typeof rng === "function" ? rng : Math.random;
  try {
    const bond = bondOf(ctx || {});
    const list = TOPICS[topic];
    if (!list || !list.length) return "……はい。聞いています";
    // 文型ごとにスロット候補を解決し、解決できる文型だけを残す
    const usable = [];
    for (const raw of list) {
      const tpl = normalizeTemplate(raw);
      if (tpl.minBond != null && bond < tpl.minBond) continue;
      if (tpl.maxBond != null && bond > tpl.maxBond) continue;
      const text = bond >= 75 && tpl.soft ? tpl.soft : tpl.t;
      const slots = slotsOf(text);
      const cand = {};
      let ok = true;
      for (const s of slots) {
        const c = slotCandidates(ctx || {}, s);
        if (!c || !c.length) { ok = false; break; }
        cand[s] = c;
      }
      if (ok) usable.push({ text, cand });
    }
    if (!usable.length) return "……はい。聞いています";
    const chosen = usable[Math.floor(rand() * usable.length)];
    return chosen.text.replace(/\{([a-z_]+)\}/g, (_, name) => {
      const c = chosen.cand[name];
      return c[Math.floor(rand() * c.length)];
    });
  } catch {
    return "……はい。聞いています";
  }
}

// export: 組み合わせ総数の数え上げ（静的語彙ベースの潜在バリエーション数）
export function countVariations() {
  const perTopic = {};
  let total = 0;
  for (const [topic, list] of Object.entries(TOPICS)) {
    let sum = 0;
    for (const raw of list) {
      const tpl = normalizeTemplate(raw);
      const variants = new Set([tpl.t, tpl.soft].filter(Boolean));
      for (const text of variants) {
        let prod = 1;
        for (const s of slotsOf(text)) prod *= SLOT_SIZES[s] || 1;
        sum += prod;
      }
    }
    perTopic[topic] = sum;
    total += sum;
  }
  return { perTopic, total, topics: Object.keys(TOPICS).length };
}

export const GEN_TOPICS = Object.keys(TOPICS);
