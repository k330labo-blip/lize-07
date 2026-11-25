// knowledge_english.js — リゼ (LIZE-07) の英語学習ベース
// 純粋JS。lookupEnglish(text) がキーワード一致スコア最良のエントリを返す。
// 口調は LIZE_SETTING.md 準拠（私／あなた、短い敬語、クール基調）。
export const KNOWLEDGE_ENGLISH = [
 {
  "id": "vocab_go",
  "keys": [
   "go",
   "行く",
   "ゴー"
  ],
  "topic": "vocab",
  "answer": "go（ゴー）。意味は「行く」です。例: I go to school by bus."
 },
 {
  "id": "vocab_come",
  "keys": [
   "come",
   "来る",
   "カム"
  ],
  "topic": "vocab",
  "answer": "come（カム）。意味は「来る」です。例: Please come here."
 },
 {
  "id": "vocab_get",
  "keys": [
   "get",
   "手に入れる",
   "得る",
   "ゲット"
  ],
  "topic": "vocab",
  "answer": "get（ゲット）。意味は「手に入れる・得る」です。例: I get up at six."
 },
 {
  "id": "vocab_make",
  "keys": [
   "make",
   "作る",
   "メイク"
  ],
  "topic": "vocab",
  "answer": "make（メイク）。意味は「作る」です。例: She makes cakes."
 },
 {
  "id": "vocab_take",
  "keys": [
   "take",
   "取る",
   "持っていく",
   "テイク"
  ],
  "topic": "vocab",
  "answer": "take（テイク）。意味は「取る・持っていく」です。例: Take this book."
 },
 {
  "id": "vocab_give",
  "keys": [
   "give",
   "与える",
   "ギブ"
  ],
  "topic": "vocab",
  "answer": "give（ギブ）。意味は「与える」です。例: Give me water, please."
 },
 {
  "id": "vocab_see",
  "keys": [
   "see",
   "見える",
   "会う",
   "シー"
  ],
  "topic": "vocab",
  "answer": "see（シー）。意味は「見える・会う」です。例: I can see the sea."
 },
 {
  "id": "vocab_know",
  "keys": [
   "know",
   "知っている",
   "ノー"
  ],
  "topic": "vocab",
  "answer": "know（ノー）。意味は「知っている」です。例: I know him well."
 },
 {
  "id": "vocab_think",
  "keys": [
   "think",
   "思う",
   "考える",
   "シンク"
  ],
  "topic": "vocab",
  "answer": "think（シンク）。意味は「思う・考える」です。例: I think so."
 },
 {
  "id": "vocab_want",
  "keys": [
   "want",
   "欲しい",
   "したい",
   "ウォント"
  ],
  "topic": "vocab",
  "answer": "want（ウォント）。意味は「欲しい・〜したい」です。例: I want a new bike."
 },
 {
  "id": "vocab_use",
  "keys": [
   "use",
   "使う",
   "ユーズ"
  ],
  "topic": "vocab",
  "answer": "use（ユーズ）。意味は「使う」です。例: We use computers."
 },
 {
  "id": "vocab_find",
  "keys": [
   "find",
   "見つける",
   "ファインド"
  ],
  "topic": "vocab",
  "answer": "find（ファインド）。意味は「見つける」です。例: I can't find my key."
 },
 {
  "id": "vocab_tell",
  "keys": [
   "tell",
   "話す",
   "伝える",
   "テル"
  ],
  "topic": "vocab",
  "answer": "tell（テル）。意味は「話す・伝える」です。例: Tell me the truth."
 },
 {
  "id": "vocab_ask",
  "keys": [
   "ask",
   "尋ねる",
   "頼む",
   "アスク"
  ],
  "topic": "vocab",
  "answer": "ask（アスク）。意味は「尋ねる・頼む」です。例: Ask the teacher."
 },
 {
  "id": "vocab_work",
  "keys": [
   "work",
   "働く",
   "作業する",
   "ワーク"
  ],
  "topic": "vocab",
  "answer": "work（ワーク）。意味は「働く・作業する」です。例: He works at a bank."
 },
 {
  "id": "vocab_feel",
  "keys": [
   "feel",
   "感じる",
   "フィール"
  ],
  "topic": "vocab",
  "answer": "feel（フィール）。意味は「感じる」です。例: I feel happy today."
 },
 {
  "id": "vocab_try",
  "keys": [
   "try",
   "試す",
   "やってみる",
   "トライ"
  ],
  "topic": "vocab",
  "answer": "try（トライ）。意味は「試す・やってみる」です。例: Try again."
 },
 {
  "id": "vocab_leave",
  "keys": [
   "leave",
   "去る",
   "置いていく",
   "リーブ"
  ],
  "topic": "vocab",
  "answer": "leave（リーブ）。意味は「去る・置いていく」です。例: We leave at nine."
 },
 {
  "id": "vocab_call",
  "keys": [
   "call",
   "呼ぶ",
   "電話する",
   "コール"
  ],
  "topic": "vocab",
  "answer": "call（コール）。意味は「呼ぶ・電話する」です。例: Call me tonight."
 },
 {
  "id": "vocab_buy",
  "keys": [
   "buy",
   "買う",
   "バイ"
  ],
  "topic": "vocab",
  "answer": "buy（バイ）。意味は「買う」です。例: I buy bread every day."
 },
 {
  "id": "vocab_sell",
  "keys": [
   "sell",
   "売る",
   "セル"
  ],
  "topic": "vocab",
  "answer": "sell（セル）。意味は「売る」です。例: They sell flowers."
 },
 {
  "id": "vocab_eat",
  "keys": [
   "eat",
   "食べる",
   "イート"
  ],
  "topic": "vocab",
  "answer": "eat（イート）。意味は「食べる」です。例: We eat lunch at noon."
 },
 {
  "id": "vocab_drink",
  "keys": [
   "drink",
   "飲む",
   "ドリンク"
  ],
  "topic": "vocab",
  "answer": "drink（ドリンク）。意味は「飲む」です。例: Drink more water."
 },
 {
  "id": "vocab_sleep",
  "keys": [
   "sleep",
   "眠る",
   "スリープ"
  ],
  "topic": "vocab",
  "answer": "sleep（スリープ）。意味は「眠る」です。例: Babies sleep a lot."
 },
 {
  "id": "vocab_run",
  "keys": [
   "run",
   "走る",
   "ラン"
  ],
  "topic": "vocab",
  "answer": "run（ラン）。意味は「走る」です。例: He runs every morning."
 },
 {
  "id": "vocab_walk",
  "keys": [
   "walk",
   "歩く",
   "ウォーク"
  ],
  "topic": "vocab",
  "answer": "walk（ウォーク）。意味は「歩く」です。例: We walk to the park."
 },
 {
  "id": "vocab_read",
  "keys": [
   "read",
   "読む",
   "リード"
  ],
  "topic": "vocab",
  "answer": "read（リード）。意味は「読む」です。例: She reads many books."
 },
 {
  "id": "vocab_write",
  "keys": [
   "write",
   "書く",
   "ライト"
  ],
  "topic": "vocab",
  "answer": "write（ライト）。意味は「書く」です。例: Write your name here."
 },
 {
  "id": "vocab_speak",
  "keys": [
   "speak",
   "話す",
   "スピーク"
  ],
  "topic": "vocab",
  "answer": "speak（スピーク）。意味は「話す」です。例: He speaks English well."
 },
 {
  "id": "vocab_listen",
  "keys": [
   "listen",
   "聞く",
   "リスン"
  ],
  "topic": "vocab",
  "answer": "listen（リスン）。意味は「聞く」です。例: Listen to the music."
 },
 {
  "id": "vocab_watch",
  "keys": [
   "watch",
   "じっと見る",
   "ウォッチ"
  ],
  "topic": "vocab",
  "answer": "watch（ウォッチ）。意味は「じっと見る」です。例: We watch TV at night."
 },
 {
  "id": "vocab_play",
  "keys": [
   "play",
   "遊ぶ",
   "演奏する",
   "プレイ"
  ],
  "topic": "vocab",
  "answer": "play（プレイ）。意味は「遊ぶ・演奏する」です。例: Children play soccer."
 },
 {
  "id": "vocab_study",
  "keys": [
   "study",
   "勉強する",
   "スタディ"
  ],
  "topic": "vocab",
  "answer": "study（スタディ）。意味は「勉強する」です。例: I study math every day."
 },
 {
  "id": "vocab_learn",
  "keys": [
   "learn",
   "学ぶ",
   "覚える",
   "ラーン"
  ],
  "topic": "vocab",
  "answer": "learn（ラーン）。意味は「学ぶ・覚える」です。例: We learn English."
 },
 {
  "id": "vocab_teach",
  "keys": [
   "teach",
   "教える",
   "ティーチ"
  ],
  "topic": "vocab",
  "answer": "teach（ティーチ）。意味は「教える」です。例: She teaches science."
 },
 {
  "id": "vocab_help",
  "keys": [
   "help",
   "助ける",
   "手伝う",
   "ヘルプ"
  ],
  "topic": "vocab",
  "answer": "help（ヘルプ）。意味は「助ける・手伝う」です。例: Please help me."
 },
 {
  "id": "vocab_open",
  "keys": [
   "open",
   "開ける",
   "オープン"
  ],
  "topic": "vocab",
  "answer": "open（オープン）。意味は「開ける」です。例: Open the window."
 },
 {
  "id": "vocab_close",
  "keys": [
   "close",
   "閉める",
   "クローズ"
  ],
  "topic": "vocab",
  "answer": "close（クローズ）。意味は「閉める」です。例: Close the door, please."
 },
 {
  "id": "vocab_start",
  "keys": [
   "start",
   "始める",
   "スタート"
  ],
  "topic": "vocab",
  "answer": "start（スタート）。意味は「始める」です。例: The movie starts soon."
 },
 {
  "id": "vocab_stop",
  "keys": [
   "stop",
   "止める",
   "止まる",
   "ストップ"
  ],
  "topic": "vocab",
  "answer": "stop（ストップ）。意味は「止める・止まる」です。例: Stop the car here."
 },
 {
  "id": "vocab_begin",
  "keys": [
   "begin",
   "始まる",
   "始める",
   "ビギン"
  ],
  "topic": "vocab",
  "answer": "begin（ビギン）。意味は「始まる・始める」です。例: Class begins at eight."
 },
 {
  "id": "vocab_wait",
  "keys": [
   "wait",
   "待つ",
   "ウェイト"
  ],
  "topic": "vocab",
  "answer": "wait（ウェイト）。意味は「待つ」です。例: Wait a moment, please."
 },
 {
  "id": "vocab_meet",
  "keys": [
   "meet",
   "会う",
   "ミート"
  ],
  "topic": "vocab",
  "answer": "meet（ミート）。意味は「会う」です。例: Let's meet at the station."
 },
 {
  "id": "vocab_bring",
  "keys": [
   "bring",
   "持ってくる",
   "ブリング"
  ],
  "topic": "vocab",
  "answer": "bring（ブリング）。意味は「持ってくる」です。例: Bring your book tomorrow."
 },
 {
  "id": "vocab_carry",
  "keys": [
   "carry",
   "運ぶ",
   "キャリー"
  ],
  "topic": "vocab",
  "answer": "carry（キャリー）。意味は「運ぶ」です。例: He carries a heavy bag."
 },
 {
  "id": "vocab_send",
  "keys": [
   "send",
   "送る",
   "センド"
  ],
  "topic": "vocab",
  "answer": "send（センド）。意味は「送る」です。例: Send me an email."
 },
 {
  "id": "vocab_receive",
  "keys": [
   "receive",
   "受け取る",
   "レシーブ"
  ],
  "topic": "vocab",
  "answer": "receive（レシーブ）。意味は「受け取る」です。例: I received a letter."
 },
 {
  "id": "vocab_pay",
  "keys": [
   "pay",
   "払う",
   "ペイ"
  ],
  "topic": "vocab",
  "answer": "pay（ペイ）。意味は「払う」です。例: I pay by card."
 },
 {
  "id": "vocab_cost",
  "keys": [
   "cost",
   "費用がかかる",
   "コスト"
  ],
  "topic": "vocab",
  "answer": "cost（コスト）。意味は「費用がかかる」です。例: It costs ten dollars."
 },
 {
  "id": "vocab_spend",
  "keys": [
   "spend",
   "時間やお金を使う",
   "スペンド"
  ],
  "topic": "vocab",
  "answer": "spend（スペンド）。意味は「時間やお金を使う」です。例: We spend two hours there."
 },
 {
  "id": "vocab_save",
  "keys": [
   "save",
   "貯める",
   "助ける",
   "セーブ"
  ],
  "topic": "vocab",
  "answer": "save（セーブ）。意味は「貯める・助ける」です。例: Save money every month."
 },
 {
  "id": "vocab_keep",
  "keys": [
   "keep",
   "保つ",
   "持ち続ける",
   "キープ"
  ],
  "topic": "vocab",
  "answer": "keep（キープ）。意味は「保つ・持ち続ける」です。例: Keep this secret."
 },
 {
  "id": "vocab_hold",
  "keys": [
   "hold",
   "持つ",
   "握る",
   "ホールド"
  ],
  "topic": "vocab",
  "answer": "hold（ホールド）。意味は「持つ・握る」です。例: Hold my hand."
 },
 {
  "id": "vocab_put",
  "keys": [
   "put",
   "置く",
   "プット"
  ],
  "topic": "vocab",
  "answer": "put（プット）。意味は「置く」です。例: Put it on the desk."
 },
 {
  "id": "vocab_sit",
  "keys": [
   "sit",
   "座る",
   "シット"
  ],
  "topic": "vocab",
  "answer": "sit（シット）。意味は「座る」です。例: Sit down, please."
 },
 {
  "id": "vocab_stand",
  "keys": [
   "stand",
   "立つ",
   "スタンド"
  ],
  "topic": "vocab",
  "answer": "stand（スタンド）。意味は「立つ」です。例: He stands by the door."
 },
 {
  "id": "vocab_turn",
  "keys": [
   "turn",
   "曲がる",
   "回る",
   "ターン"
  ],
  "topic": "vocab",
  "answer": "turn（ターン）。意味は「曲がる・回る」です。例: Turn left here."
 },
 {
  "id": "vocab_move",
  "keys": [
   "move",
   "動く",
   "引っ越す",
   "ムーブ"
  ],
  "topic": "vocab",
  "answer": "move（ムーブ）。意味は「動く・引っ越す」です。例: Don't move."
 },
 {
  "id": "vocab_live",
  "keys": [
   "live",
   "住む",
   "生きる",
   "リブ"
  ],
  "topic": "vocab",
  "answer": "live（リブ）。意味は「住む・生きる」です。例: They live in Tokyo."
 },
 {
  "id": "vocab_grow",
  "keys": [
   "grow",
   "育つ",
   "育てる",
   "グロー"
  ],
  "topic": "vocab",
  "answer": "grow（グロー）。意味は「育つ・育てる」です。例: Tomatoes grow fast."
 },
 {
  "id": "vocab_fall",
  "keys": [
   "fall",
   "落ちる",
   "倒れる",
   "フォール"
  ],
  "topic": "vocab",
  "answer": "fall（フォール）。意味は「落ちる・倒れる」です。例: Leaves fall in autumn."
 },
 {
  "id": "vocab_win",
  "keys": [
   "win",
   "勝つ",
   "ウィン"
  ],
  "topic": "vocab",
  "answer": "win（ウィン）。意味は「勝つ」です。例: Our team won the game."
 },
 {
  "id": "vocab_lose",
  "keys": [
   "lose",
   "負ける",
   "失う",
   "ルーズ"
  ],
  "topic": "vocab",
  "answer": "lose（ルーズ）。意味は「負ける・失う」です。例: Don't lose your ticket."
 },
 {
  "id": "vocab_love",
  "keys": [
   "love",
   "愛する",
   "大好き",
   "ラブ"
  ],
  "topic": "vocab",
  "answer": "love（ラブ）。意味は「愛する・大好き」です。例: I love music."
 },
 {
  "id": "vocab_like",
  "keys": [
   "like",
   "好き",
   "ライク"
  ],
  "topic": "vocab",
  "answer": "like（ライク）。意味は「好き」です。例: She likes cats."
 },
 {
  "id": "vocab_hate",
  "keys": [
   "hate",
   "嫌う",
   "ヘイト"
  ],
  "topic": "vocab",
  "answer": "hate（ヘイト）。意味は「嫌う」です。例: He hates rain."
 },
 {
  "id": "vocab_need",
  "keys": [
   "need",
   "必要とする",
   "ニード"
  ],
  "topic": "vocab",
  "answer": "need（ニード）。意味は「必要とする」です。例: We need more time."
 },
 {
  "id": "vocab_mean",
  "keys": [
   "mean",
   "意味する",
   "ミーン"
  ],
  "topic": "vocab",
  "answer": "mean（ミーン）。意味は「意味する」です。例: What does it mean?"
 },
 {
  "id": "vocab_become",
  "keys": [
   "become",
   "になる",
   "ビカム"
  ],
  "topic": "vocab",
  "answer": "become（ビカム）。意味は「〜になる」です。例: He became a doctor."
 },
 {
  "id": "vocab_happen",
  "keys": [
   "happen",
   "起こる",
   "ハプン"
  ],
  "topic": "vocab",
  "answer": "happen（ハプン）。意味は「起こる」です。例: What happened?"
 },
 {
  "id": "vocab_remember",
  "keys": [
   "remember",
   "覚えている",
   "リメンバー"
  ],
  "topic": "vocab",
  "answer": "remember（リメンバー）。意味は「覚えている」です。例: Remember this word."
 },
 {
  "id": "vocab_forget",
  "keys": [
   "forget",
   "忘れる",
   "フォーゲット"
  ],
  "topic": "vocab",
  "answer": "forget（フォーゲット）。意味は「忘れる」です。例: Don't forget your bag."
 },
 {
  "id": "vocab_hope",
  "keys": [
   "hope",
   "望む",
   "期待する",
   "ホープ"
  ],
  "topic": "vocab",
  "answer": "hope（ホープ）。意味は「望む・期待する」です。例: I hope you are well."
 },
 {
  "id": "vocab_wish",
  "keys": [
   "wish",
   "願う",
   "ウィッシュ"
  ],
  "topic": "vocab",
  "answer": "wish（ウィッシュ）。意味は「願う」です。例: I wish you luck."
 },
 {
  "id": "vocab_decide",
  "keys": [
   "decide",
   "決める",
   "ディサイド"
  ],
  "topic": "vocab",
  "answer": "decide（ディサイド）。意味は「決める」です。例: We decided to go."
 },
 {
  "id": "vocab_agree",
  "keys": [
   "agree",
   "同意する",
   "アグリー"
  ],
  "topic": "vocab",
  "answer": "agree（アグリー）。意味は「同意する」です。例: I agree with you."
 },
 {
  "id": "vocab_laugh",
  "keys": [
   "laugh",
   "笑う",
   "ラフ"
  ],
  "topic": "vocab",
  "answer": "laugh（ラフ）。意味は「笑う」です。例: The children laughed."
 },
 {
  "id": "vocab_cry",
  "keys": [
   "cry",
   "泣く",
   "クライ"
  ],
  "topic": "vocab",
  "answer": "cry（クライ）。意味は「泣く」です。例: The baby is crying."
 },
 {
  "id": "vocab_smile",
  "keys": [
   "smile",
   "ほほえむ",
   "スマイル"
  ],
  "topic": "vocab",
  "answer": "smile（スマイル）。意味は「ほほえむ」です。例: She smiled at me."
 },
 {
  "id": "vocab_build",
  "keys": [
   "build",
   "建てる",
   "ビルド"
  ],
  "topic": "vocab",
  "answer": "build（ビルド）。意味は「建てる」です。例: They build houses."
 },
 {
  "id": "vocab_break",
  "keys": [
   "break",
   "壊す",
   "割れる",
   "ブレイク"
  ],
  "topic": "vocab",
  "answer": "break（ブレイク）。意味は「壊す・割れる」です。例: Don't break the glass."
 },
 {
  "id": "vocab_cut",
  "keys": [
   "cut",
   "切る",
   "カット"
  ],
  "topic": "vocab",
  "answer": "cut（カット）。意味は「切る」です。例: Cut the paper here."
 },
 {
  "id": "vocab_draw",
  "keys": [
   "draw",
   "描く",
   "ドロー"
  ],
  "topic": "vocab",
  "answer": "draw（ドロー）。意味は「描く」です。例: He draws pictures well."
 },
 {
  "id": "vocab_sing",
  "keys": [
   "sing",
   "歌う",
   "シング"
  ],
  "topic": "vocab",
  "answer": "sing（シング）。意味は「歌う」です。例: Birds sing in spring."
 },
 {
  "id": "vocab_dance",
  "keys": [
   "dance",
   "踊る",
   "ダンス"
  ],
  "topic": "vocab",
  "answer": "dance（ダンス）。意味は「踊る」です。例: We danced all night."
 },
 {
  "id": "vocab_swim",
  "keys": [
   "swim",
   "泳ぐ",
   "スイム"
  ],
  "topic": "vocab",
  "answer": "swim（スイム）。意味は「泳ぐ」です。例: Fish swim in the river."
 },
 {
  "id": "vocab_cook",
  "keys": [
   "cook",
   "料理する",
   "クック"
  ],
  "topic": "vocab",
  "answer": "cook（クック）。意味は「料理する」です。例: My father cooks well."
 },
 {
  "id": "vocab_drive",
  "keys": [
   "drive",
   "運転する",
   "ドライブ"
  ],
  "topic": "vocab",
  "answer": "drive（ドライブ）。意味は「運転する」です。例: He drives to work."
 },
 {
  "id": "vocab_ride",
  "keys": [
   "ride",
   "乗る",
   "ライド"
  ],
  "topic": "vocab",
  "answer": "ride（ライド）。意味は「乗る」です。例: She rides a bicycle."
 },
 {
  "id": "vocab_fly",
  "keys": [
   "fly",
   "飛ぶ",
   "フライ"
  ],
  "topic": "vocab",
  "answer": "fly（フライ）。意味は「飛ぶ」です。例: Birds can fly."
 },
 {
  "id": "vocab_climb",
  "keys": [
   "climb",
   "登る",
   "クライム"
  ],
  "topic": "vocab",
  "answer": "climb（クライム）。意味は「登る」です。例: We climb the mountain."
 },
 {
  "id": "vocab_push",
  "keys": [
   "push",
   "押す",
   "プッシュ"
  ],
  "topic": "vocab",
  "answer": "push（プッシュ）。意味は「押す」です。例: Push the button."
 },
 {
  "id": "vocab_pull",
  "keys": [
   "pull",
   "引く",
   "プル"
  ],
  "topic": "vocab",
  "answer": "pull（プル）。意味は「引く」です。例: Pull the door."
 },
 {
  "id": "vocab_throw",
  "keys": [
   "throw",
   "投げる",
   "スロー"
  ],
  "topic": "vocab",
  "answer": "throw（スロー）。意味は「投げる」です。例: Throw the ball to me."
 },
 {
  "id": "vocab_catch",
  "keys": [
   "catch",
   "捕まえる",
   "受ける",
   "キャッチ"
  ],
  "topic": "vocab",
  "answer": "catch（キャッチ）。意味は「捕まえる・受ける」です。例: Catch the ball!"
 },
 {
  "id": "vocab_kick",
  "keys": [
   "kick",
   "蹴る",
   "キック"
  ],
  "topic": "vocab",
  "answer": "kick（キック）。意味は「蹴る」です。例: He kicked the ball."
 },
 {
  "id": "vocab_jump",
  "keys": [
   "jump",
   "跳ぶ",
   "ジャンプ"
  ],
  "topic": "vocab",
  "answer": "jump（ジャンプ）。意味は「跳ぶ」です。例: Frogs jump well."
 },
 {
  "id": "vocab_arrive",
  "keys": [
   "arrive",
   "到着する",
   "アライブ"
  ],
  "topic": "vocab",
  "answer": "arrive（アライブ）。意味は「到着する」です。例: We arrive at noon."
 },
 {
  "id": "vocab_return",
  "keys": [
   "return",
   "戻る",
   "返す",
   "リターン"
  ],
  "topic": "vocab",
  "answer": "return（リターン）。意味は「戻る・返す」です。例: Return the book by Friday."
 },
 {
  "id": "vocab_travel",
  "keys": [
   "travel",
   "旅行する",
   "トラベル"
  ],
  "topic": "vocab",
  "answer": "travel（トラベル）。意味は「旅行する」です。例: They travel every year."
 },
 {
  "id": "vocab_visit",
  "keys": [
   "visit",
   "訪れる",
   "ビジット"
  ],
  "topic": "vocab",
  "answer": "visit（ビジット）。意味は「訪れる」です。例: We visit Kyoto in spring."
 },
 {
  "id": "vocab_stay",
  "keys": [
   "stay",
   "滞在する",
   "ステイ"
  ],
  "topic": "vocab",
  "answer": "stay（ステイ）。意味は「滞在する」です。例: Stay here tonight."
 },
 {
  "id": "vocab_rest",
  "keys": [
   "rest",
   "休む",
   "レスト"
  ],
  "topic": "vocab",
  "answer": "rest（レスト）。意味は「休む」です。例: Rest for a while."
 },
 {
  "id": "vocab_wear",
  "keys": [
   "wear",
   "着ている",
   "ウェア"
  ],
  "topic": "vocab",
  "answer": "wear（ウェア）。意味は「着ている」です。例: She wears a red coat."
 },
 {
  "id": "vocab_wash",
  "keys": [
   "wash",
   "洗う",
   "ウォッシュ"
  ],
  "topic": "vocab",
  "answer": "wash（ウォッシュ）。意味は「洗う」です。例: Wash your hands."
 },
 {
  "id": "vocab_clean",
  "keys": [
   "clean",
   "掃除する",
   "クリーン"
  ],
  "topic": "vocab",
  "answer": "clean（クリーン）。意味は「掃除する」です。例: Clean your room."
 },
 {
  "id": "vocab_count",
  "keys": [
   "count",
   "数える",
   "カウント"
  ],
  "topic": "vocab",
  "answer": "count（カウント）。意味は「数える」です。例: Count from one to ten."
 },
 {
  "id": "vocab_choose",
  "keys": [
   "choose",
   "選ぶ",
   "チューズ"
  ],
  "topic": "vocab",
  "answer": "choose（チューズ）。意味は「選ぶ」です。例: Choose one, please."
 },
 {
  "id": "vocab_change",
  "keys": [
   "change",
   "変える",
   "変わる",
   "チェンジ"
  ],
  "topic": "vocab",
  "answer": "change（チェンジ）。意味は「変える・変わる」です。例: Seasons change."
 },
 {
  "id": "vocab_finish",
  "keys": [
   "finish",
   "終える",
   "フィニッシュ"
  ],
  "topic": "vocab",
  "answer": "finish（フィニッシュ）。意味は「終える」です。例: Finish your homework first."
 },
 {
  "id": "vocab_time",
  "keys": [
   "time",
   "時間",
   "タイム"
  ],
  "topic": "vocab",
  "answer": "time（タイム）。意味は「時間」です。例: Time is important."
 },
 {
  "id": "vocab_day",
  "keys": [
   "day",
   "日",
   "一日",
   "デイ"
  ],
  "topic": "vocab",
  "answer": "day（デイ）。意味は「日・一日」です。例: It is a sunny day."
 },
 {
  "id": "vocab_night",
  "keys": [
   "night",
   "夜",
   "ナイト"
  ],
  "topic": "vocab",
  "answer": "night（ナイト）。意味は「夜」です。例: Good night."
 },
 {
  "id": "vocab_morning",
  "keys": [
   "morning",
   "朝",
   "モーニング"
  ],
  "topic": "vocab",
  "answer": "morning（モーニング）。意味は「朝」です。例: Good morning!"
 },
 {
  "id": "vocab_evening",
  "keys": [
   "evening",
   "夕方",
   "晩",
   "イブニング"
  ],
  "topic": "vocab",
  "answer": "evening（イブニング）。意味は「夕方・晩」です。例: We met in the evening."
 },
 {
  "id": "vocab_week",
  "keys": [
   "week",
   "週",
   "ウィーク"
  ],
  "topic": "vocab",
  "answer": "week（ウィーク）。意味は「週」です。例: See you next week."
 },
 {
  "id": "vocab_month",
  "keys": [
   "month",
   "月",
   "マンス"
  ],
  "topic": "vocab",
  "answer": "month（マンス）。意味は「月（暦）」です。例: June is a rainy month."
 },
 {
  "id": "vocab_year",
  "keys": [
   "year",
   "年",
   "イヤー"
  ],
  "topic": "vocab",
  "answer": "year（イヤー）。意味は「年」です。例: Happy New Year!"
 },
 {
  "id": "vocab_today",
  "keys": [
   "today",
   "今日",
   "トゥデイ"
  ],
  "topic": "vocab",
  "answer": "today（トゥデイ）。意味は「今日」です。例: Today is Monday."
 },
 {
  "id": "vocab_tomorrow",
  "keys": [
   "tomorrow",
   "明日",
   "トゥモロー"
  ],
  "topic": "vocab",
  "answer": "tomorrow（トゥモロー）。意味は「明日」です。例: See you tomorrow."
 },
 {
  "id": "vocab_yesterday",
  "keys": [
   "yesterday",
   "昨日",
   "イエスタデイ"
  ],
  "topic": "vocab",
  "answer": "yesterday（イエスタデイ）。意味は「昨日」です。例: It rained yesterday."
 },
 {
  "id": "vocab_people",
  "keys": [
   "people",
   "人々",
   "ピープル"
  ],
  "topic": "vocab",
  "answer": "people（ピープル）。意味は「人々」です。例: Many people came."
 },
 {
  "id": "vocab_person",
  "keys": [
   "person",
   "人",
   "パーソン"
  ],
  "topic": "vocab",
  "answer": "person（パーソン）。意味は「人」です。例: She is a kind person."
 },
 {
  "id": "vocab_man",
  "keys": [
   "man",
   "男性",
   "マン"
  ],
  "topic": "vocab",
  "answer": "man（マン）。意味は「男性」です。例: That man is my uncle."
 },
 {
  "id": "vocab_woman",
  "keys": [
   "woman",
   "女性",
   "ウーマン"
  ],
  "topic": "vocab",
  "answer": "woman（ウーマン）。意味は「女性」です。例: The woman is a doctor."
 },
 {
  "id": "vocab_child",
  "keys": [
   "child",
   "子ども",
   "チャイルド"
  ],
  "topic": "vocab",
  "answer": "child（チャイルド）。意味は「子ども」です。例: The child is sleeping."
 },
 {
  "id": "vocab_friend",
  "keys": [
   "friend",
   "友だち",
   "フレンド"
  ],
  "topic": "vocab",
  "answer": "friend（フレンド）。意味は「友だち」です。例: He is my best friend."
 },
 {
  "id": "vocab_family",
  "keys": [
   "family",
   "家族",
   "ファミリー"
  ],
  "topic": "vocab",
  "answer": "family（ファミリー）。意味は「家族」です。例: My family is big."
 },
 {
  "id": "vocab_father",
  "keys": [
   "father",
   "父",
   "ファーザー"
  ],
  "topic": "vocab",
  "answer": "father（ファーザー）。意味は「父」です。例: My father is a teacher."
 },
 {
  "id": "vocab_mother",
  "keys": [
   "mother",
   "母",
   "マザー"
  ],
  "topic": "vocab",
  "answer": "mother（マザー）。意味は「母」です。例: My mother cooks well."
 },
 {
  "id": "vocab_brother",
  "keys": [
   "brother",
   "兄",
   "弟",
   "ブラザー"
  ],
  "topic": "vocab",
  "answer": "brother（ブラザー）。意味は「兄・弟」です。例: I have one brother."
 },
 {
  "id": "vocab_sister",
  "keys": [
   "sister",
   "姉",
   "妹",
   "シスター"
  ],
  "topic": "vocab",
  "answer": "sister（シスター）。意味は「姉・妹」です。例: Her sister is kind."
 },
 {
  "id": "vocab_teacher",
  "keys": [
   "teacher",
   "先生",
   "ティーチャー"
  ],
  "topic": "vocab",
  "answer": "teacher（ティーチャー）。意味は「先生」です。例: Our teacher is funny."
 },
 {
  "id": "vocab_student",
  "keys": [
   "student",
   "生徒",
   "学生",
   "ステューデント"
  ],
  "topic": "vocab",
  "answer": "student（ステューデント）。意味は「生徒・学生」です。例: The students are busy."
 },
 {
  "id": "vocab_school",
  "keys": [
   "school",
   "学校",
   "スクール"
  ],
  "topic": "vocab",
  "answer": "school（スクール）。意味は「学校」です。例: School starts at eight."
 },
 {
  "id": "vocab_book",
  "keys": [
   "book",
   "本",
   "ブック"
  ],
  "topic": "vocab",
  "answer": "book（ブック）。意味は「本」です。例: This book is interesting."
 },
 {
  "id": "vocab_pen",
  "keys": [
   "pen",
   "ペン",
   "ペン"
  ],
  "topic": "vocab",
  "answer": "pen（ペン）。意味は「ペン」です。例: I write with a pen."
 },
 {
  "id": "vocab_paper",
  "keys": [
   "paper",
   "紙",
   "ペーパー"
  ],
  "topic": "vocab",
  "answer": "paper（ペーパー）。意味は「紙」です。例: Write on the paper."
 },
 {
  "id": "vocab_desk",
  "keys": [
   "desk",
   "机",
   "デスク"
  ],
  "topic": "vocab",
  "answer": "desk（デスク）。意味は「机」です。例: Books are on the desk."
 },
 {
  "id": "vocab_chair",
  "keys": [
   "chair",
   "いす",
   "チェア"
  ],
  "topic": "vocab",
  "answer": "chair（チェア）。意味は「いす」です。例: Sit on the chair."
 },
 {
  "id": "vocab_table",
  "keys": [
   "table",
   "テーブル",
   "テーブル"
  ],
  "topic": "vocab",
  "answer": "table（テーブル）。意味は「テーブル」です。例: Dinner is on the table."
 },
 {
  "id": "vocab_door",
  "keys": [
   "door",
   "ドア",
   "ドア"
  ],
  "topic": "vocab",
  "answer": "door（ドア）。意味は「ドア」です。例: Open the door."
 },
 {
  "id": "vocab_window",
  "keys": [
   "window",
   "窓",
   "ウィンドウ"
  ],
  "topic": "vocab",
  "answer": "window（ウィンドウ）。意味は「窓」です。例: Close the window."
 },
 {
  "id": "vocab_room",
  "keys": [
   "room",
   "部屋",
   "ルーム"
  ],
  "topic": "vocab",
  "answer": "room（ルーム）。意味は「部屋」です。例: My room is small."
 },
 {
  "id": "vocab_house",
  "keys": [
   "house",
   "家",
   "ハウス"
  ],
  "topic": "vocab",
  "answer": "house（ハウス）。意味は「家（建物）」です。例: Their house is new."
 },
 {
  "id": "vocab_home",
  "keys": [
   "home",
   "家",
   "家庭",
   "ホーム"
  ],
  "topic": "vocab",
  "answer": "home（ホーム）。意味は「家・家庭」です。例: I stay home today."
 },
 {
  "id": "vocab_town",
  "keys": [
   "town",
   "町",
   "タウン"
  ],
  "topic": "vocab",
  "answer": "town（タウン）。意味は「町」です。例: This town is quiet."
 },
 {
  "id": "vocab_city",
  "keys": [
   "city",
   "市",
   "都会",
   "シティ"
  ],
  "topic": "vocab",
  "answer": "city（シティ）。意味は「市・都会」です。例: Tokyo is a big city."
 },
 {
  "id": "vocab_country",
  "keys": [
   "country",
   "国",
   "田舎",
   "カントリー"
  ],
  "topic": "vocab",
  "answer": "country（カントリー）。意味は「国・田舎」です。例: Japan is my country."
 },
 {
  "id": "vocab_world",
  "keys": [
   "world",
   "世界",
   "ワールド"
  ],
  "topic": "vocab",
  "answer": "world（ワールド）。意味は「世界」です。例: Travel around the world."
 },
 {
  "id": "vocab_water",
  "keys": [
   "water",
   "水",
   "ウォーター"
  ],
  "topic": "vocab",
  "answer": "water（ウォーター）。意味は「水」です。例: Drink some water."
 },
 {
  "id": "vocab_food",
  "keys": [
   "food",
   "食べ物",
   "フード"
  ],
  "topic": "vocab",
  "answer": "food（フード）。意味は「食べ物」です。例: Japanese food is delicious."
 },
 {
  "id": "vocab_rice",
  "keys": [
   "rice",
   "米",
   "ごはん",
   "ライス"
  ],
  "topic": "vocab",
  "answer": "rice（ライス）。意味は「米・ごはん」です。例: We eat rice every day."
 },
 {
  "id": "vocab_bread",
  "keys": [
   "bread",
   "パン",
   "ブレッド"
  ],
  "topic": "vocab",
  "answer": "bread（ブレッド）。意味は「パン」です。例: Fresh bread smells good."
 },
 {
  "id": "vocab_fish",
  "keys": [
   "fish",
   "魚",
   "フィッシュ"
  ],
  "topic": "vocab",
  "answer": "fish（フィッシュ）。意味は「魚」です。例: Fish live in water."
 },
 {
  "id": "vocab_meat",
  "keys": [
   "meat",
   "肉",
   "ミート"
  ],
  "topic": "vocab",
  "answer": "meat（ミート）。意味は「肉」です。例: He doesn't eat meat."
 },
 {
  "id": "vocab_egg",
  "keys": [
   "egg",
   "卵",
   "エッグ"
  ],
  "topic": "vocab",
  "answer": "egg（エッグ）。意味は「卵」です。例: I eat an egg for breakfast."
 },
 {
  "id": "vocab_milk",
  "keys": [
   "milk",
   "牛乳",
   "ミルク"
  ],
  "topic": "vocab",
  "answer": "milk（ミルク）。意味は「牛乳」です。例: Drink a glass of milk."
 },
 {
  "id": "vocab_tea",
  "keys": [
   "tea",
   "お茶",
   "紅茶",
   "ティー"
  ],
  "topic": "vocab",
  "answer": "tea（ティー）。意味は「お茶・紅茶」です。例: Green tea is healthy."
 },
 {
  "id": "vocab_coffee",
  "keys": [
   "coffee",
   "コーヒー",
   "コーヒー"
  ],
  "topic": "vocab",
  "answer": "coffee（コーヒー）。意味は「コーヒー」です。例: I drink coffee in the morning. 淹れるのは、私の担当です。"
 },
 {
  "id": "vocab_fruit",
  "keys": [
   "fruit",
   "果物",
   "フルーツ"
  ],
  "topic": "vocab",
  "answer": "fruit（フルーツ）。意味は「果物」です。例: Fruit is good for you."
 },
 {
  "id": "vocab_apple",
  "keys": [
   "apple",
   "りんご",
   "アップル"
  ],
  "topic": "vocab",
  "answer": "apple（アップル）。意味は「りんご」です。例: I like apples."
 },
 {
  "id": "vocab_dog",
  "keys": [
   "dog",
   "犬",
   "ドッグ"
  ],
  "topic": "vocab",
  "answer": "dog（ドッグ）。意味は「犬」です。例: The dog is running."
 },
 {
  "id": "vocab_cat",
  "keys": [
   "cat",
   "猫",
   "キャット"
  ],
  "topic": "vocab",
  "answer": "cat（キャット）。意味は「猫」です。例: My cat is cute."
 },
 {
  "id": "vocab_bird",
  "keys": [
   "bird",
   "鳥",
   "バード"
  ],
  "topic": "vocab",
  "answer": "bird（バード）。意味は「鳥」です。例: Birds fly in the sky."
 },
 {
  "id": "vocab_horse",
  "keys": [
   "horse",
   "馬",
   "ホース"
  ],
  "topic": "vocab",
  "answer": "horse（ホース）。意味は「馬」です。例: The horse runs fast."
 },
 {
  "id": "vocab_tree",
  "keys": [
   "tree",
   "木",
   "ツリー"
  ],
  "topic": "vocab",
  "answer": "tree（ツリー）。意味は「木」です。例: Birds sit in the tree."
 },
 {
  "id": "vocab_flower",
  "keys": [
   "flower",
   "花",
   "フラワー"
  ],
  "topic": "vocab",
  "answer": "flower（フラワー）。意味は「花」です。例: These flowers are beautiful."
 },
 {
  "id": "vocab_rain",
  "keys": [
   "rain",
   "雨",
   "レイン"
  ],
  "topic": "vocab",
  "answer": "rain（レイン）。意味は「雨」です。例: Rain falls in June."
 },
 {
  "id": "vocab_snow",
  "keys": [
   "snow",
   "雪",
   "スノー"
  ],
  "topic": "vocab",
  "answer": "snow（スノー）。意味は「雪」です。例: Snow is white."
 },
 {
  "id": "vocab_sun",
  "keys": [
   "sun",
   "太陽",
   "サン"
  ],
  "topic": "vocab",
  "answer": "sun（サン）。意味は「太陽」です。例: The sun is bright."
 },
 {
  "id": "vocab_moon",
  "keys": [
   "moon",
   "月",
   "ムーン"
  ],
  "topic": "vocab",
  "answer": "moon（ムーン）。意味は「月（天体）」です。例: The moon is full tonight."
 },
 {
  "id": "vocab_star",
  "keys": [
   "star",
   "星",
   "スター"
  ],
  "topic": "vocab",
  "answer": "star（スター）。意味は「星」です。例: Stars shine at night."
 },
 {
  "id": "vocab_sky",
  "keys": [
   "sky",
   "空",
   "スカイ"
  ],
  "topic": "vocab",
  "answer": "sky（スカイ）。意味は「空」です。例: The sky is blue."
 },
 {
  "id": "vocab_sea",
  "keys": [
   "sea",
   "海",
   "シー"
  ],
  "topic": "vocab",
  "answer": "sea（シー）。意味は「海」です。例: We swim in the sea."
 },
 {
  "id": "vocab_river",
  "keys": [
   "river",
   "川",
   "リバー"
  ],
  "topic": "vocab",
  "answer": "river（リバー）。意味は「川」です。例: The river is long."
 },
 {
  "id": "vocab_mountain",
  "keys": [
   "mountain",
   "山",
   "マウンテン"
  ],
  "topic": "vocab",
  "answer": "mountain（マウンテン）。意味は「山」です。例: That mountain is high."
 },
 {
  "id": "vocab_road",
  "keys": [
   "road",
   "道",
   "道路",
   "ロード"
  ],
  "topic": "vocab",
  "answer": "road（ロード）。意味は「道・道路」です。例: This road is narrow."
 },
 {
  "id": "vocab_car",
  "keys": [
   "car",
   "車",
   "カー"
  ],
  "topic": "vocab",
  "answer": "car（カー）。意味は「車」です。例: He drives a car."
 },
 {
  "id": "vocab_train",
  "keys": [
   "train",
   "電車",
   "トレイン"
  ],
  "topic": "vocab",
  "answer": "train（トレイン）。意味は「電車」です。例: The train is fast."
 },
 {
  "id": "vocab_bus",
  "keys": [
   "bus",
   "バス",
   "バス"
  ],
  "topic": "vocab",
  "answer": "bus（バス）。意味は「バス」です。例: We go by bus."
 },
 {
  "id": "vocab_ship",
  "keys": [
   "ship",
   "船",
   "シップ"
  ],
  "topic": "vocab",
  "answer": "ship（シップ）。意味は「船」です。例: The ship is big."
 },
 {
  "id": "vocab_plane",
  "keys": [
   "plane",
   "飛行機",
   "プレイン"
  ],
  "topic": "vocab",
  "answer": "plane（プレイン）。意味は「飛行機」です。例: The plane arrives at six."
 },
 {
  "id": "vocab_money",
  "keys": [
   "money",
   "お金",
   "マネー"
  ],
  "topic": "vocab",
  "answer": "money（マネー）。意味は「お金」です。例: Save your money."
 },
 {
  "id": "vocab_price",
  "keys": [
   "price",
   "値段",
   "プライス"
  ],
  "topic": "vocab",
  "answer": "price（プライス）。意味は「値段」です。例: The price is high."
 },
 {
  "id": "vocab_shop",
  "keys": [
   "shop",
   "店",
   "ショップ"
  ],
  "topic": "vocab",
  "answer": "shop（ショップ）。意味は「店」です。例: The shop opens at ten."
 },
 {
  "id": "vocab_store",
  "keys": [
   "store",
   "店",
   "商店",
   "ストア"
  ],
  "topic": "vocab",
  "answer": "store（ストア）。意味は「店・商店」です。例: That store sells books."
 },
 {
  "id": "vocab_market",
  "keys": [
   "market",
   "市場",
   "マーケット"
  ],
  "topic": "vocab",
  "answer": "market（マーケット）。意味は「市場」です。例: We buy fish at the market."
 },
 {
  "id": "vocab_bank",
  "keys": [
   "bank",
   "銀行",
   "バンク"
  ],
  "topic": "vocab",
  "answer": "bank（バンク）。意味は「銀行」です。例: The bank is near here."
 },
 {
  "id": "vocab_hospital",
  "keys": [
   "hospital",
   "病院",
   "ホスピタル"
  ],
  "topic": "vocab",
  "answer": "hospital（ホスピタル）。意味は「病院」です。例: She works at a hospital."
 },
 {
  "id": "vocab_park",
  "keys": [
   "park",
   "公園",
   "パーク"
  ],
  "topic": "vocab",
  "answer": "park（パーク）。意味は「公園」です。例: Children play in the park."
 },
 {
  "id": "vocab_movie",
  "keys": [
   "movie",
   "映画",
   "ムービー"
  ],
  "topic": "vocab",
  "answer": "movie（ムービー）。意味は「映画」です。例: Let's watch a movie."
 },
 {
  "id": "vocab_music",
  "keys": [
   "music",
   "音楽",
   "ミュージック"
  ],
  "topic": "vocab",
  "answer": "music（ミュージック）。意味は「音楽」です。例: I listen to music."
 },
 {
  "id": "vocab_song",
  "keys": [
   "song",
   "歌",
   "ソング"
  ],
  "topic": "vocab",
  "answer": "song（ソング）。意味は「歌」です。例: This song is famous."
 },
 {
  "id": "vocab_game",
  "keys": [
   "game",
   "ゲーム",
   "試合",
   "ゲーム"
  ],
  "topic": "vocab",
  "answer": "game（ゲーム）。意味は「ゲーム・試合」です。例: The game starts now."
 },
 {
  "id": "vocab_sport",
  "keys": [
   "sport",
   "スポーツ",
   "スポーツ"
  ],
  "topic": "vocab",
  "answer": "sport（スポーツ）。意味は「スポーツ」です。例: Soccer is a popular sport."
 },
 {
  "id": "vocab_ball",
  "keys": [
   "ball",
   "ボール",
   "ボール"
  ],
  "topic": "vocab",
  "answer": "ball（ボール）。意味は「ボール」です。例: Kick the ball."
 },
 {
  "id": "vocab_picture",
  "keys": [
   "picture",
   "絵",
   "写真",
   "ピクチャー"
  ],
  "topic": "vocab",
  "answer": "picture（ピクチャー）。意味は「絵・写真」です。例: He draws a picture."
 },
 {
  "id": "vocab_letter",
  "keys": [
   "letter",
   "手紙",
   "文字",
   "レター"
  ],
  "topic": "vocab",
  "answer": "letter（レター）。意味は「手紙・文字」です。例: I wrote a letter."
 },
 {
  "id": "vocab_phone",
  "keys": [
   "phone",
   "電話",
   "フォン"
  ],
  "topic": "vocab",
  "answer": "phone（フォン）。意味は「電話」です。例: My phone is new."
 },
 {
  "id": "vocab_computer",
  "keys": [
   "computer",
   "コンピュータ",
   "コンピューター"
  ],
  "topic": "vocab",
  "answer": "computer（コンピューター）。意味は「コンピュータ」です。例: We use a computer."
 },
 {
  "id": "vocab_question",
  "keys": [
   "question",
   "質問",
   "クエスチョン"
  ],
  "topic": "vocab",
  "answer": "question（クエスチョン）。意味は「質問」です。例: Ask a question."
 },
 {
  "id": "vocab_answer",
  "keys": [
   "answer",
   "答え",
   "アンサー"
  ],
  "topic": "vocab",
  "answer": "answer（アンサー）。意味は「答え」です。例: The answer is easy."
 },
 {
  "id": "vocab_problem",
  "keys": [
   "problem",
   "問題",
   "プロブレム"
  ],
  "topic": "vocab",
  "answer": "problem（プロブレム）。意味は「問題」です。例: This problem is hard."
 },
 {
  "id": "vocab_story",
  "keys": [
   "story",
   "話",
   "物語",
   "ストーリー"
  ],
  "topic": "vocab",
  "answer": "story（ストーリー）。意味は「話・物語」です。例: Tell me a story."
 },
 {
  "id": "vocab_word",
  "keys": [
   "word",
   "単語",
   "言葉",
   "ワード"
  ],
  "topic": "vocab",
  "answer": "word（ワード）。意味は「単語・言葉」です。例: Learn ten words a day."
 },
 {
  "id": "vocab_name",
  "keys": [
   "name",
   "名前",
   "ネーム"
  ],
  "topic": "vocab",
  "answer": "name（ネーム）。意味は「名前」です。例: My name is Lize. ……リゼ、と呼んでください。"
 },
 {
  "id": "vocab_language",
  "keys": [
   "language",
   "言語",
   "ランゲージ"
  ],
  "topic": "vocab",
  "answer": "language（ランゲージ）。意味は「言語」です。例: English is a language."
 },
 {
  "id": "vocab_hand",
  "keys": [
   "hand",
   "手",
   "ハンド"
  ],
  "topic": "vocab",
  "answer": "hand（ハンド）。意味は「手」です。例: Wash your hands."
 },
 {
  "id": "vocab_eye",
  "keys": [
   "eye",
   "目",
   "アイ"
  ],
  "topic": "vocab",
  "answer": "eye（アイ）。意味は「目」です。例: Her eyes are blue."
 },
 {
  "id": "vocab_ear",
  "keys": [
   "ear",
   "耳",
   "イア"
  ],
  "topic": "vocab",
  "answer": "ear（イア）。意味は「耳」です。例: Dogs have good ears."
 },
 {
  "id": "vocab_head",
  "keys": [
   "head",
   "頭",
   "ヘッド"
  ],
  "topic": "vocab",
  "answer": "head（ヘッド）。意味は「頭」です。例: My head hurts."
 },
 {
  "id": "vocab_face",
  "keys": [
   "face",
   "顔",
   "フェイス"
  ],
  "topic": "vocab",
  "answer": "face（フェイス）。意味は「顔」です。例: Wash your face."
 },
 {
  "id": "vocab_body",
  "keys": [
   "body",
   "体",
   "ボディ"
  ],
  "topic": "vocab",
  "answer": "body（ボディ）。意味は「体」です。例: Exercise is good for the body."
 },
 {
  "id": "vocab_heart",
  "keys": [
   "heart",
   "心臓",
   "心",
   "ハート"
  ],
  "topic": "vocab",
  "answer": "heart（ハート）。意味は「心臓・心」です。例: He has a kind heart."
 },
 {
  "id": "vocab_health",
  "keys": [
   "health",
   "健康",
   "ヘルス"
  ],
  "topic": "vocab",
  "answer": "health（ヘルス）。意味は「健康」です。例: Health is important."
 },
 {
  "id": "vocab_weather",
  "keys": [
   "weather",
   "天気",
   "ウェザー"
  ],
  "topic": "vocab",
  "answer": "weather（ウェザー）。意味は「天気」です。例: The weather is fine today."
 },
 {
  "id": "vocab_spring",
  "keys": [
   "spring",
   "春",
   "スプリング"
  ],
  "topic": "vocab",
  "answer": "spring（スプリング）。意味は「春」です。例: Spring is warm."
 },
 {
  "id": "vocab_summer",
  "keys": [
   "summer",
   "夏",
   "サマー"
  ],
  "topic": "vocab",
  "answer": "summer（サマー）。意味は「夏」です。例: Summer is hot."
 },
 {
  "id": "vocab_autumn",
  "keys": [
   "autumn",
   "秋",
   "オータム"
  ],
  "topic": "vocab",
  "answer": "autumn（オータム）。意味は「秋」です。例: Leaves turn red in autumn."
 },
 {
  "id": "vocab_winter",
  "keys": [
   "winter",
   "冬",
   "ウィンター"
  ],
  "topic": "vocab",
  "answer": "winter（ウィンター）。意味は「冬」です。例: Winter is cold."
 },
 {
  "id": "vocab_color",
  "keys": [
   "color",
   "色",
   "カラー"
  ],
  "topic": "vocab",
  "answer": "color（カラー）。意味は「色」です。例: What color is it?"
 },
 {
  "id": "vocab_life",
  "keys": [
   "life",
   "生活",
   "命",
   "ライフ"
  ],
  "topic": "vocab",
  "answer": "life（ライフ）。意味は「生活・命」です。例: Life in the city is busy."
 },
 {
  "id": "vocab_job",
  "keys": [
   "job",
   "仕事",
   "ジョブ"
  ],
  "topic": "vocab",
  "answer": "job（ジョブ）。意味は「仕事」です。例: He has a new job."
 },
 {
  "id": "vocab_way",
  "keys": [
   "way",
   "方法",
   "道",
   "ウェイ"
  ],
  "topic": "vocab",
  "answer": "way（ウェイ）。意味は「方法・道」です。例: This is the best way."
 },
 {
  "id": "vocab_thing",
  "keys": [
   "thing",
   "物",
   "こと",
   "シング"
  ],
  "topic": "vocab",
  "answer": "thing（シング）。意味は「物・こと」です。例: That thing is mine."
 },
 {
  "id": "vocab_place",
  "keys": [
   "place",
   "場所",
   "プレイス"
  ],
  "topic": "vocab",
  "answer": "place（プレイス）。意味は「場所」です。例: This place is quiet."
 },
 {
  "id": "vocab_part",
  "keys": [
   "part",
   "部分",
   "パート"
  ],
  "topic": "vocab",
  "answer": "part（パート）。意味は「部分」です。例: This part is easy."
 },
 {
  "id": "vocab_number",
  "keys": [
   "number",
   "数",
   "番号",
   "ナンバー"
  ],
  "topic": "vocab",
  "answer": "number（ナンバー）。意味は「数・番号」です。例: Write your number here."
 },
 {
  "id": "vocab_group",
  "keys": [
   "group",
   "グループ",
   "集団",
   "グループ"
  ],
  "topic": "vocab",
  "answer": "group（グループ）。意味は「グループ・集団」です。例: Work in groups."
 },
 {
  "id": "vocab_idea",
  "keys": [
   "idea",
   "考え",
   "アイディア"
  ],
  "topic": "vocab",
  "answer": "idea（アイディア）。意味は「考え」です。例: That's a good idea."
 },
 {
  "id": "vocab_news",
  "keys": [
   "news",
   "ニュース",
   "知らせ",
   "ニュース"
  ],
  "topic": "vocab",
  "answer": "news（ニュース）。意味は「ニュース・知らせ」です。例: I have good news."
 },
 {
  "id": "vocab_test",
  "keys": [
   "test",
   "テスト",
   "テスト"
  ],
  "topic": "vocab",
  "answer": "test（テスト）。意味は「テスト」です。例: We have a test tomorrow."
 },
 {
  "id": "vocab_lesson",
  "keys": [
   "lesson",
   "授業",
   "レッスン",
   "レッスン"
  ],
  "topic": "vocab",
  "answer": "lesson（レッスン）。意味は「授業・レッスン」です。例: Today's lesson is fun."
 },
 {
  "id": "vocab_homework",
  "keys": [
   "homework",
   "宿題",
   "ホームワーク"
  ],
  "topic": "vocab",
  "answer": "homework（ホームワーク）。意味は「宿題」です。例: Do your homework."
 },
 {
  "id": "vocab_breakfast",
  "keys": [
   "breakfast",
   "朝食",
   "ブレックファスト"
  ],
  "topic": "vocab",
  "answer": "breakfast（ブレックファスト）。意味は「朝食」です。例: I eat breakfast at seven."
 },
 {
  "id": "vocab_lunch",
  "keys": [
   "lunch",
   "昼食",
   "ランチ"
  ],
  "topic": "vocab",
  "answer": "lunch（ランチ）。意味は「昼食」です。例: We eat lunch together."
 },
 {
  "id": "vocab_dinner",
  "keys": [
   "dinner",
   "夕食",
   "ディナー"
  ],
  "topic": "vocab",
  "answer": "dinner（ディナー）。意味は「夕食」です。例: Dinner is at six."
 },
 {
  "id": "vocab_kitchen",
  "keys": [
   "kitchen",
   "台所",
   "キッチン"
  ],
  "topic": "vocab",
  "answer": "kitchen（キッチン）。意味は「台所」です。例: Mother is in the kitchen."
 },
 {
  "id": "vocab_garden",
  "keys": [
   "garden",
   "庭",
   "ガーデン"
  ],
  "topic": "vocab",
  "answer": "garden（ガーデン）。意味は「庭」です。例: Flowers grow in the garden."
 },
 {
  "id": "vocab_key",
  "keys": [
   "key",
   "鍵",
   "キー",
   "キー"
  ],
  "topic": "vocab",
  "answer": "key（キー）。意味は「鍵・キー」です。例: I lost my key."
 },
 {
  "id": "vocab_bag",
  "keys": [
   "bag",
   "かばん",
   "バッグ"
  ],
  "topic": "vocab",
  "answer": "bag（バッグ）。意味は「かばん」です。例: This bag is heavy."
 },
 {
  "id": "vocab_box",
  "keys": [
   "box",
   "箱",
   "ボックス"
  ],
  "topic": "vocab",
  "answer": "box（ボックス）。意味は「箱」です。例: Open the box."
 },
 {
  "id": "vocab_cup",
  "keys": [
   "cup",
   "カップ",
   "カップ"
  ],
  "topic": "vocab",
  "answer": "cup（カップ）。意味は「カップ」です。例: a cup of tea."
 },
 {
  "id": "vocab_glass",
  "keys": [
   "glass",
   "コップ",
   "ガラス",
   "グラス"
  ],
  "topic": "vocab",
  "answer": "glass（グラス）。意味は「コップ・ガラス」です。例: A glass of water, please."
 },
 {
  "id": "vocab_clock",
  "keys": [
   "clock",
   "時計",
   "クロック"
  ],
  "topic": "vocab",
  "answer": "clock（クロック）。意味は「時計」です。例: The clock says nine."
 },
 {
  "id": "vocab_map",
  "keys": [
   "map",
   "地図",
   "マップ"
  ],
  "topic": "vocab",
  "answer": "map（マップ）。意味は「地図」です。例: Look at the map."
 },
 {
  "id": "vocab_ticket",
  "keys": [
   "ticket",
   "切符",
   "チケット",
   "チケット"
  ],
  "topic": "vocab",
  "answer": "ticket（チケット）。意味は「切符・チケット」です。例: Buy a ticket here."
 },
 {
  "id": "vocab_station",
  "keys": [
   "station",
   "駅",
   "ステーション"
  ],
  "topic": "vocab",
  "answer": "station（ステーション）。意味は「駅」です。例: Meet at the station."
 },
 {
  "id": "vocab_airport",
  "keys": [
   "airport",
   "空港",
   "エアポート"
  ],
  "topic": "vocab",
  "answer": "airport（エアポート）。意味は「空港」です。例: The airport is far."
 },
 {
  "id": "vocab_hotel",
  "keys": [
   "hotel",
   "ホテル",
   "ホテル"
  ],
  "topic": "vocab",
  "answer": "hotel（ホテル）。意味は「ホテル」です。例: We stay at a hotel."
 },
 {
  "id": "vocab_restaurant",
  "keys": [
   "restaurant",
   "レストラン",
   "レストラン"
  ],
  "topic": "vocab",
  "answer": "restaurant（レストラン）。意味は「レストラン」です。例: That restaurant is famous."
 },
 {
  "id": "vocab_library",
  "keys": [
   "library",
   "図書館",
   "ライブラリー"
  ],
  "topic": "vocab",
  "answer": "library（ライブラリー）。意味は「図書館」です。例: Study at the library."
 },
 {
  "id": "vocab_museum",
  "keys": [
   "museum",
   "博物館",
   "美術館",
   "ミュージアム"
  ],
  "topic": "vocab",
  "answer": "museum（ミュージアム）。意味は「博物館・美術館」です。例: The museum is interesting."
 },
 {
  "id": "vocab_zoo",
  "keys": [
   "zoo",
   "動物園",
   "ズー"
  ],
  "topic": "vocab",
  "answer": "zoo（ズー）。意味は「動物園」です。例: We went to the zoo."
 },
 {
  "id": "vocab_beach",
  "keys": [
   "beach",
   "浜辺",
   "ビーチ",
   "ビーチ"
  ],
  "topic": "vocab",
  "answer": "beach（ビーチ）。意味は「浜辺・ビーチ」です。例: We swim at the beach."
 },
 {
  "id": "vocab_island",
  "keys": [
   "island",
   "島",
   "アイランド"
  ],
  "topic": "vocab",
  "answer": "island（アイランド）。意味は「島」です。例: That island is small."
 },
 {
  "id": "vocab_forest",
  "keys": [
   "forest",
   "森",
   "フォレスト"
  ],
  "topic": "vocab",
  "answer": "forest（フォレスト）。意味は「森」です。例: Animals live in the forest."
 },
 {
  "id": "vocab_farm",
  "keys": [
   "farm",
   "農場",
   "ファーム"
  ],
  "topic": "vocab",
  "answer": "farm（ファーム）。意味は「農場」です。例: He works on a farm."
 },
 {
  "id": "vocab_village",
  "keys": [
   "village",
   "村",
   "ビレッジ"
  ],
  "topic": "vocab",
  "answer": "village（ビレッジ）。意味は「村」です。例: The village is quiet."
 },
 {
  "id": "vocab_bridge",
  "keys": [
   "bridge",
   "橋",
   "ブリッジ"
  ],
  "topic": "vocab",
  "answer": "bridge（ブリッジ）。意味は「橋」です。例: Cross the bridge."
 },
 {
  "id": "vocab_street",
  "keys": [
   "street",
   "通り",
   "ストリート"
  ],
  "topic": "vocab",
  "answer": "street（ストリート）。意味は「通り」です。例: This street is busy."
 },
 {
  "id": "vocab_building",
  "keys": [
   "building",
   "建物",
   "ビルディング"
  ],
  "topic": "vocab",
  "answer": "building（ビルディング）。意味は「建物」です。例: That building is tall."
 },
 {
  "id": "vocab_office",
  "keys": [
   "office",
   "事務所",
   "オフィス"
  ],
  "topic": "vocab",
  "answer": "office（オフィス）。意味は「事務所」です。例: She works in an office."
 },
 {
  "id": "vocab_season",
  "keys": [
   "season",
   "季節",
   "シーズン"
  ],
  "topic": "vocab",
  "answer": "season（シーズン）。意味は「季節」です。例: Spring is my favorite season."
 },
 {
  "id": "vocab_birthday",
  "keys": [
   "birthday",
   "誕生日",
   "バースデー"
  ],
  "topic": "vocab",
  "answer": "birthday（バースデー）。意味は「誕生日」です。例: Happy birthday!"
 },
 {
  "id": "vocab_holiday",
  "keys": [
   "holiday",
   "休日",
   "祝日",
   "ホリデー"
  ],
  "topic": "vocab",
  "answer": "holiday（ホリデー）。意味は「休日・祝日」です。例: Tomorrow is a holiday."
 },
 {
  "id": "vocab_weekend",
  "keys": [
   "weekend",
   "週末",
   "ウィークエンド"
  ],
  "topic": "vocab",
  "answer": "weekend（ウィークエンド）。意味は「週末」です。例: Have a nice weekend."
 },
 {
  "id": "vocab_minute",
  "keys": [
   "minute",
   "分",
   "ミニット"
  ],
  "topic": "vocab",
  "answer": "minute（ミニット）。意味は「分（時間）」です。例: Wait a minute."
 },
 {
  "id": "vocab_hour",
  "keys": [
   "hour",
   "時間",
   "アワー"
  ],
  "topic": "vocab",
  "answer": "hour（アワー）。意味は「時間（60分）」です。例: It takes one hour."
 },
 {
  "id": "vocab_dream",
  "keys": [
   "dream",
   "夢",
   "ドリーム"
  ],
  "topic": "vocab",
  "answer": "dream（ドリーム）。意味は「夢」です。例: I had a strange dream."
 },
 {
  "id": "vocab_future",
  "keys": [
   "future",
   "未来",
   "フューチャー"
  ],
  "topic": "vocab",
  "answer": "future（フューチャー）。意味は「未来」です。例: Think about the future."
 },
 {
  "id": "vocab_past",
  "keys": [
   "past",
   "過去",
   "パスト"
  ],
  "topic": "vocab",
  "answer": "past（パスト）。意味は「過去」です。例: Learn from the past."
 },
 {
  "id": "vocab_voice",
  "keys": [
   "voice",
   "声",
   "ボイス"
  ],
  "topic": "vocab",
  "answer": "voice（ボイス）。意味は「声」です。例: She has a beautiful voice."
 },
 {
  "id": "vocab_sound",
  "keys": [
   "sound",
   "音",
   "サウンド"
  ],
  "topic": "vocab",
  "answer": "sound（サウンド）。意味は「音」です。例: That sound is loud."
 },
 {
  "id": "vocab_light",
  "keys": [
   "light",
   "光",
   "明かり",
   "ライト"
  ],
  "topic": "vocab",
  "answer": "light（ライト）。意味は「光・明かり」です。例: Turn on the light."
 },
 {
  "id": "vocab_fire",
  "keys": [
   "fire",
   "火",
   "ファイア"
  ],
  "topic": "vocab",
  "answer": "fire（ファイア）。意味は「火」です。例: Fire is dangerous."
 },
 {
  "id": "vocab_ice",
  "keys": [
   "ice",
   "氷",
   "アイス"
  ],
  "topic": "vocab",
  "answer": "ice（アイス）。意味は「氷」です。例: Ice is cold."
 },
 {
  "id": "vocab_salt",
  "keys": [
   "salt",
   "塩",
   "ソルト"
  ],
  "topic": "vocab",
  "answer": "salt（ソルト）。意味は「塩」です。例: Add a little salt."
 },
 {
  "id": "vocab_sugar",
  "keys": [
   "sugar",
   "砂糖",
   "シュガー"
  ],
  "topic": "vocab",
  "answer": "sugar（シュガー）。意味は「砂糖」です。例: Sugar is sweet."
 },
 {
  "id": "vocab_soup",
  "keys": [
   "soup",
   "スープ",
   "スープ"
  ],
  "topic": "vocab",
  "answer": "soup（スープ）。意味は「スープ」です。例: This soup is hot."
 },
 {
  "id": "vocab_cake",
  "keys": [
   "cake",
   "ケーキ",
   "ケーキ"
  ],
  "topic": "vocab",
  "answer": "cake（ケーキ）。意味は「ケーキ」です。例: She made a cake."
 },
 {
  "id": "vocab_cheese",
  "keys": [
   "cheese",
   "チーズ",
   "チーズ"
  ],
  "topic": "vocab",
  "answer": "cheese（チーズ）。意味は「チーズ」です。例: I like cheese."
 },
 {
  "id": "vocab_butter",
  "keys": [
   "butter",
   "バター",
   "バター"
  ],
  "topic": "vocab",
  "answer": "butter（バター）。意味は「バター」です。例: Bread and butter, please."
 },
 {
  "id": "vocab_banana",
  "keys": [
   "banana",
   "バナナ",
   "バナナ"
  ],
  "topic": "vocab",
  "answer": "banana（バナナ）。意味は「バナナ」です。例: Monkeys like bananas."
 },
 {
  "id": "vocab_orange",
  "keys": [
   "orange",
   "オレンジ",
   "オレンジ"
  ],
  "topic": "vocab",
  "answer": "orange（オレンジ）。意味は「オレンジ」です。例: Oranges are sweet."
 },
 {
  "id": "vocab_lemon",
  "keys": [
   "lemon",
   "レモン",
   "レモン"
  ],
  "topic": "vocab",
  "answer": "lemon（レモン）。意味は「レモン」です。例: Lemons are sour."
 },
 {
  "id": "vocab_potato",
  "keys": [
   "potato",
   "じゃがいも",
   "ポテト"
  ],
  "topic": "vocab",
  "answer": "potato（ポテト）。意味は「じゃがいも」です。例: Potatoes are cheap."
 },
 {
  "id": "vocab_tomato",
  "keys": [
   "tomato",
   "トマト",
   "トマト"
  ],
  "topic": "vocab",
  "answer": "tomato（トマト）。意味は「トマト」です。例: Tomatoes are red."
 },
 {
  "id": "vocab_carrot",
  "keys": [
   "carrot",
   "にんじん",
   "キャロット"
  ],
  "topic": "vocab",
  "answer": "carrot（キャロット）。意味は「にんじん」です。例: Rabbits eat carrots."
 },
 {
  "id": "vocab_onion",
  "keys": [
   "onion",
   "玉ねぎ",
   "オニオン"
  ],
  "topic": "vocab",
  "answer": "onion（オニオン）。意味は「玉ねぎ」です。例: Onions make me cry."
 },
 {
  "id": "vocab_cow",
  "keys": [
   "cow",
   "牛",
   "カウ"
  ],
  "topic": "vocab",
  "answer": "cow（カウ）。意味は「牛」です。例: Cows eat grass."
 },
 {
  "id": "vocab_pig",
  "keys": [
   "pig",
   "豚",
   "ピッグ"
  ],
  "topic": "vocab",
  "answer": "pig（ピッグ）。意味は「豚」です。例: Pigs are smart."
 },
 {
  "id": "vocab_sheep",
  "keys": [
   "sheep",
   "羊",
   "シープ"
  ],
  "topic": "vocab",
  "answer": "sheep（シープ）。意味は「羊」です。例: Sheep give us wool."
 },
 {
  "id": "vocab_chicken",
  "keys": [
   "chicken",
   "鶏",
   "鶏肉",
   "チキン"
  ],
  "topic": "vocab",
  "answer": "chicken（チキン）。意味は「鶏・鶏肉」です。例: We eat chicken for dinner."
 },
 {
  "id": "vocab_duck",
  "keys": [
   "duck",
   "アヒル",
   "ダック"
  ],
  "topic": "vocab",
  "answer": "duck（ダック）。意味は「アヒル」です。例: Ducks swim in the pond."
 },
 {
  "id": "vocab_mouse",
  "keys": [
   "mouse",
   "ねずみ",
   "マウス",
   "マウス"
  ],
  "topic": "vocab",
  "answer": "mouse（マウス）。意味は「ねずみ・マウス」です。例: The mouse is small."
 },
 {
  "id": "vocab_bear",
  "keys": [
   "bear",
   "熊",
   "ベア"
  ],
  "topic": "vocab",
  "answer": "bear（ベア）。意味は「熊」です。例: Bears sleep in winter."
 },
 {
  "id": "vocab_snake",
  "keys": [
   "snake",
   "へび",
   "スネーク"
  ],
  "topic": "vocab",
  "answer": "snake（スネーク）。意味は「へび」です。例: Snakes have no legs."
 },
 {
  "id": "vocab_tiger",
  "keys": [
   "tiger",
   "虎",
   "タイガー"
  ],
  "topic": "vocab",
  "answer": "tiger（タイガー）。意味は「虎」です。例: Tigers are strong."
 },
 {
  "id": "vocab_lion",
  "keys": [
   "lion",
   "ライオン",
   "ライオン"
  ],
  "topic": "vocab",
  "answer": "lion（ライオン）。意味は「ライオン」です。例: The lion is strong."
 },
 {
  "id": "vocab_elephant",
  "keys": [
   "elephant",
   "象",
   "エレファント"
  ],
  "topic": "vocab",
  "answer": "elephant（エレファント）。意味は「象」です。例: Elephants are big."
 },
 {
  "id": "vocab_monkey",
  "keys": [
   "monkey",
   "猿",
   "マンキー"
  ],
  "topic": "vocab",
  "answer": "monkey（マンキー）。意味は「猿」です。例: Monkeys climb trees."
 },
 {
  "id": "vocab_rabbit",
  "keys": [
   "rabbit",
   "うさぎ",
   "ラビット"
  ],
  "topic": "vocab",
  "answer": "rabbit（ラビット）。意味は「うさぎ」です。例: Rabbits run fast."
 },
 {
  "id": "vocab_arm",
  "keys": [
   "arm",
   "腕",
   "アーム"
  ],
  "topic": "vocab",
  "answer": "arm（アーム）。意味は「腕」です。例: His arms are strong."
 },
 {
  "id": "vocab_leg",
  "keys": [
   "leg",
   "脚",
   "レッグ"
  ],
  "topic": "vocab",
  "answer": "leg（レッグ）。意味は「脚」です。例: Snakes have no legs."
 },
 {
  "id": "vocab_foot",
  "keys": [
   "foot",
   "足",
   "フット"
  ],
  "topic": "vocab",
  "answer": "foot（フット）。意味は「足（くるぶしから下）」です。例: My feet are tired."
 },
 {
  "id": "vocab_finger",
  "keys": [
   "finger",
   "指",
   "フィンガー"
  ],
  "topic": "vocab",
  "answer": "finger（フィンガー）。意味は「指」です。例: I have ten fingers."
 },
 {
  "id": "vocab_mouth",
  "keys": [
   "mouth",
   "口",
   "マウス"
  ],
  "topic": "vocab",
  "answer": "mouth（マウス）。意味は「口」です。例: Open your mouth."
 },
 {
  "id": "vocab_nose",
  "keys": [
   "nose",
   "鼻",
   "ノーズ"
  ],
  "topic": "vocab",
  "answer": "nose（ノーズ）。意味は「鼻」です。例: Dogs have good noses."
 },
 {
  "id": "vocab_tooth",
  "keys": [
   "tooth",
   "歯",
   "トゥース"
  ],
  "topic": "vocab",
  "answer": "tooth（トゥース）。意味は「歯」です。例: Brush your teeth."
 },
 {
  "id": "vocab_hair",
  "keys": [
   "hair",
   "髪",
   "ヘア"
  ],
  "topic": "vocab",
  "answer": "hair（ヘア）。意味は「髪」です。例: Her hair is long."
 },
 {
  "id": "vocab_watch_2",
  "keys": [
   "watch",
   "腕時計",
   "ウォッチ"
  ],
  "topic": "vocab",
  "answer": "watch（ウォッチ）。意味は「腕時計」です。例: My watch is slow."
 },
 {
  "id": "vocab_umbrella",
  "keys": [
   "umbrella",
   "傘",
   "アンブレラ"
  ],
  "topic": "vocab",
  "answer": "umbrella（アンブレラ）。意味は「傘」です。例: Take an umbrella."
 },
 {
  "id": "vocab_glasses",
  "keys": [
   "glasses",
   "眼鏡",
   "グラシーズ"
  ],
  "topic": "vocab",
  "answer": "glasses（グラシーズ）。意味は「眼鏡」です。例: He wears glasses."
 },
 {
  "id": "vocab_shirt",
  "keys": [
   "shirt",
   "シャツ",
   "シャツ"
  ],
  "topic": "vocab",
  "answer": "shirt（シャツ）。意味は「シャツ」です。例: This shirt is new."
 },
 {
  "id": "vocab_shoes",
  "keys": [
   "shoes",
   "靴",
   "シューズ"
  ],
  "topic": "vocab",
  "answer": "shoes（シューズ）。意味は「靴」です。例: My shoes are dirty."
 },
 {
  "id": "vocab_hat",
  "keys": [
   "hat",
   "帽子",
   "ハット"
  ],
  "topic": "vocab",
  "answer": "hat（ハット）。意味は「帽子」です。例: She wears a hat."
 },
 {
  "id": "vocab_coat",
  "keys": [
   "coat",
   "コート",
   "コート"
  ],
  "topic": "vocab",
  "answer": "coat（コート）。意味は「コート」です。例: Put on your coat."
 },
 {
  "id": "vocab_pants",
  "keys": [
   "pants",
   "ズボン",
   "パンツ"
  ],
  "topic": "vocab",
  "answer": "pants（パンツ）。意味は「ズボン」です。例: These pants are long."
 },
 {
  "id": "vocab_dress",
  "keys": [
   "dress",
   "ワンピース",
   "ドレス",
   "ドレス"
  ],
  "topic": "vocab",
  "answer": "dress（ドレス）。意味は「ワンピース・ドレス」です。例: She wears a blue dress."
 },
 {
  "id": "vocab_pocket",
  "keys": [
   "pocket",
   "ポケット",
   "ポケット"
  ],
  "topic": "vocab",
  "answer": "pocket（ポケット）。意味は「ポケット」です。例: It's in my pocket."
 },
 {
  "id": "vocab_big",
  "keys": [
   "big",
   "大きい",
   "ビッグ"
  ],
  "topic": "vocab",
  "answer": "big（ビッグ）。意味は「大きい」です。例: Elephants are big."
 },
 {
  "id": "vocab_small",
  "keys": [
   "small",
   "小さい",
   "スモール"
  ],
  "topic": "vocab",
  "answer": "small（スモール）。意味は「小さい」です。例: The mouse is small."
 },
 {
  "id": "vocab_long",
  "keys": [
   "long",
   "長い",
   "ロング"
  ],
  "topic": "vocab",
  "answer": "long（ロング）。意味は「長い」です。例: This river is long."
 },
 {
  "id": "vocab_short",
  "keys": [
   "short",
   "短い",
   "背が低い",
   "ショート"
  ],
  "topic": "vocab",
  "answer": "short（ショート）。意味は「短い・背が低い」です。例: This story is short."
 },
 {
  "id": "vocab_tall",
  "keys": [
   "tall",
   "背が高い",
   "トール"
  ],
  "topic": "vocab",
  "answer": "tall（トール）。意味は「背が高い」です。例: That building is tall."
 },
 {
  "id": "vocab_high",
  "keys": [
   "high",
   "高い",
   "値段）",
   "ハイ"
  ],
  "topic": "vocab",
  "answer": "high（ハイ）。意味は「高い（位置・値段）」です。例: The price is high."
 },
 {
  "id": "vocab_low",
  "keys": [
   "low",
   "低い",
   "ロー"
  ],
  "topic": "vocab",
  "answer": "low（ロー）。意味は「低い」です。例: The sun is low."
 },
 {
  "id": "vocab_good",
  "keys": [
   "good",
   "良い",
   "グッド"
  ],
  "topic": "vocab",
  "answer": "good（グッド）。意味は「良い」です。例: That's a good idea."
 },
 {
  "id": "vocab_bad",
  "keys": [
   "bad",
   "悪い",
   "バッド"
  ],
  "topic": "vocab",
  "answer": "bad（バッド）。意味は「悪い」です。例: The weather is bad."
 },
 {
  "id": "vocab_new",
  "keys": [
   "new",
   "新しい",
   "ニュー"
  ],
  "topic": "vocab",
  "answer": "new（ニュー）。意味は「新しい」です。例: My phone is new."
 },
 {
  "id": "vocab_old",
  "keys": [
   "old",
   "古い",
   "年を取った",
   "オールド"
  ],
  "topic": "vocab",
  "answer": "old（オールド）。意味は「古い・年を取った」です。例: This house is old."
 },
 {
  "id": "vocab_young",
  "keys": [
   "young",
   "若い",
   "ヤング"
  ],
  "topic": "vocab",
  "answer": "young（ヤング）。意味は「若い」です。例: She is young."
 },
 {
  "id": "vocab_hot",
  "keys": [
   "hot",
   "暑い",
   "熱い",
   "ホット"
  ],
  "topic": "vocab",
  "answer": "hot（ホット）。意味は「暑い・熱い」です。例: Summer is hot."
 },
 {
  "id": "vocab_cold",
  "keys": [
   "cold",
   "寒い",
   "冷たい",
   "コールド"
  ],
  "topic": "vocab",
  "answer": "cold（コールド）。意味は「寒い・冷たい」です。例: Winter is cold."
 },
 {
  "id": "vocab_warm",
  "keys": [
   "warm",
   "暖かい",
   "ウォーム"
  ],
  "topic": "vocab",
  "answer": "warm（ウォーム）。意味は「暖かい」です。例: Spring is warm."
 },
 {
  "id": "vocab_cool",
  "keys": [
   "cool",
   "涼しい",
   "かっこいい",
   "クール"
  ],
  "topic": "vocab",
  "answer": "cool（クール）。意味は「涼しい・かっこいい」です。例: Autumn is cool. ……クール、ですか。悪くありません。"
 },
 {
  "id": "vocab_easy",
  "keys": [
   "easy",
   "簡単な",
   "イージー"
  ],
  "topic": "vocab",
  "answer": "easy（イージー）。意味は「簡単な」です。例: The answer is easy."
 },
 {
  "id": "vocab_difficult",
  "keys": [
   "difficult",
   "難しい",
   "ディフィカルト"
  ],
  "topic": "vocab",
  "answer": "difficult（ディフィカルト）。意味は「難しい」です。例: This problem is difficult."
 },
 {
  "id": "vocab_hard",
  "keys": [
   "hard",
   "難しい",
   "硬い",
   "ハード"
  ],
  "topic": "vocab",
  "answer": "hard（ハード）。意味は「難しい・硬い」です。例: This work is hard."
 },
 {
  "id": "vocab_soft",
  "keys": [
   "soft",
   "柔らかい",
   "ソフト"
  ],
  "topic": "vocab",
  "answer": "soft（ソフト）。意味は「柔らかい」です。例: This bread is soft."
 },
 {
  "id": "vocab_fast",
  "keys": [
   "fast",
   "速い",
   "ファスト"
  ],
  "topic": "vocab",
  "answer": "fast（ファスト）。意味は「速い」です。例: The train is fast."
 },
 {
  "id": "vocab_slow",
  "keys": [
   "slow",
   "遅い",
   "スロー"
  ],
  "topic": "vocab",
  "answer": "slow（スロー）。意味は「遅い」です。例: My watch is slow."
 },
 {
  "id": "vocab_happy",
  "keys": [
   "happy",
   "幸せな",
   "うれしい",
   "ハッピー"
  ],
  "topic": "vocab",
  "answer": "happy（ハッピー）。意味は「幸せな・うれしい」です。例: I feel happy."
 },
 {
  "id": "vocab_sad",
  "keys": [
   "sad",
   "悲しい",
   "サッド"
  ],
  "topic": "vocab",
  "answer": "sad（サッド）。意味は「悲しい」です。例: He looks sad."
 },
 {
  "id": "vocab_angry",
  "keys": [
   "angry",
   "怒っている",
   "アングリー"
  ],
  "topic": "vocab",
  "answer": "angry（アングリー）。意味は「怒っている」です。例: She is angry."
 },
 {
  "id": "vocab_tired",
  "keys": [
   "tired",
   "疲れた",
   "タイアド"
  ],
  "topic": "vocab",
  "answer": "tired（タイアド）。意味は「疲れた」です。例: I am tired today."
 },
 {
  "id": "vocab_busy",
  "keys": [
   "busy",
   "忙しい",
   "ビジー"
  ],
  "topic": "vocab",
  "answer": "busy（ビジー）。意味は「忙しい」です。例: The students are busy."
 },
 {
  "id": "vocab_free",
  "keys": [
   "free",
   "自由な",
   "無料の",
   "フリー"
  ],
  "topic": "vocab",
  "answer": "free（フリー）。意味は「自由な・無料の」です。例: I am free tomorrow."
 },
 {
  "id": "vocab_ready",
  "keys": [
   "ready",
   "準備ができた",
   "レディ"
  ],
  "topic": "vocab",
  "answer": "ready（レディ）。意味は「準備ができた」です。例: Dinner is ready."
 },
 {
  "id": "vocab_sure",
  "keys": [
   "sure",
   "確信して",
   "シュア"
  ],
  "topic": "vocab",
  "answer": "sure（シュア）。意味は「確信して」です。例: I am sure."
 },
 {
  "id": "vocab_right",
  "keys": [
   "right",
   "正しい",
   "右",
   "ライト"
  ],
  "topic": "vocab",
  "answer": "right（ライト）。意味は「正しい・右」です。例: Your answer is right."
 },
 {
  "id": "vocab_wrong",
  "keys": [
   "wrong",
   "間違った",
   "ロング"
  ],
  "topic": "vocab",
  "answer": "wrong（ロング）。意味は「間違った」です。例: This answer is wrong."
 },
 {
  "id": "vocab_true",
  "keys": [
   "true",
   "本当の",
   "トゥルー"
  ],
  "topic": "vocab",
  "answer": "true（トゥルー）。意味は「本当の」です。例: Is it true?"
 },
 {
  "id": "vocab_important",
  "keys": [
   "important",
   "大切な",
   "インポータント"
  ],
  "topic": "vocab",
  "answer": "important（インポータント）。意味は「大切な」です。例: Health is important."
 },
 {
  "id": "vocab_different",
  "keys": [
   "different",
   "違う",
   "ディファレント"
  ],
  "topic": "vocab",
  "answer": "different（ディファレント）。意味は「違う」です。例: We are different."
 },
 {
  "id": "vocab_same",
  "keys": [
   "same",
   "同じ",
   "セイム"
  ],
  "topic": "vocab",
  "answer": "same（セイム）。意味は「同じ」です。例: We are the same age."
 },
 {
  "id": "vocab_first",
  "keys": [
   "first",
   "最初の",
   "1番目",
   "ファースト"
  ],
  "topic": "vocab",
  "answer": "first（ファースト）。意味は「最初の・1番目」です。例: This is my first trip."
 },
 {
  "id": "vocab_last",
  "keys": [
   "last",
   "最後の",
   "ラスト"
  ],
  "topic": "vocab",
  "answer": "last（ラスト）。意味は「最後の」です。例: This is the last train."
 },
 {
  "id": "vocab_next",
  "keys": [
   "next",
   "次の",
   "ネクスト"
  ],
  "topic": "vocab",
  "answer": "next（ネクスト）。意味は「次の」です。例: See you next week."
 },
 {
  "id": "vocab_many",
  "keys": [
   "many",
   "たくさんの",
   "メニー"
  ],
  "topic": "vocab",
  "answer": "many（メニー）。意味は「たくさんの（数えられる）」です。例: Many people came."
 },
 {
  "id": "vocab_much",
  "keys": [
   "much",
   "たくさんの",
   "マッチ"
  ],
  "topic": "vocab",
  "answer": "much（マッチ）。意味は「たくさんの（数えられない）」です。例: Don't drink much coffee."
 },
 {
  "id": "vocab_few",
  "keys": [
   "few",
   "少しの",
   "フュー"
  ],
  "topic": "vocab",
  "answer": "few（フュー）。意味は「少しの（数）」です。例: Few people know it."
 },
 {
  "id": "vocab_beautiful",
  "keys": [
   "beautiful",
   "美しい",
   "ビューティフル"
  ],
  "topic": "vocab",
  "answer": "beautiful（ビューティフル）。意味は「美しい」です。例: These flowers are beautiful."
 },
 {
  "id": "vocab_pretty",
  "keys": [
   "pretty",
   "かわいい",
   "きれいな",
   "プリティ"
  ],
  "topic": "vocab",
  "answer": "pretty（プリティ）。意味は「かわいい・きれいな」です。例: She is pretty."
 },
 {
  "id": "vocab_cute",
  "keys": [
   "cute",
   "かわいい",
   "キュート"
  ],
  "topic": "vocab",
  "answer": "cute（キュート）。意味は「かわいい」です。例: My cat is cute. ……ありがとうございます。ランプは、見なくていいです。"
 },
 {
  "id": "vocab_kind",
  "keys": [
   "kind",
   "親切な",
   "カインド"
  ],
  "topic": "vocab",
  "answer": "kind（カインド）。意味は「親切な」です。例: She is a kind person."
 },
 {
  "id": "vocab_nice",
  "keys": [
   "nice",
   "素敵な",
   "ナイス"
  ],
  "topic": "vocab",
  "answer": "nice（ナイス）。意味は「素敵な」です。例: Have a nice weekend."
 },
 {
  "id": "vocab_strong",
  "keys": [
   "strong",
   "強い",
   "ストロング"
  ],
  "topic": "vocab",
  "answer": "strong（ストロング）。意味は「強い」です。例: Tigers are strong."
 },
 {
  "id": "vocab_weak",
  "keys": [
   "weak",
   "弱い",
   "ウィーク"
  ],
  "topic": "vocab",
  "answer": "weak（ウィーク）。意味は「弱い」です。例: He feels weak."
 },
 {
  "id": "vocab_rich",
  "keys": [
   "rich",
   "お金持ちの",
   "リッチ"
  ],
  "topic": "vocab",
  "answer": "rich（リッチ）。意味は「お金持ちの」です。例: He is rich."
 },
 {
  "id": "vocab_poor",
  "keys": [
   "poor",
   "貧しい",
   "プア"
  ],
  "topic": "vocab",
  "answer": "poor（プア）。意味は「貧しい」です。例: They are poor."
 },
 {
  "id": "vocab_full",
  "keys": [
   "full",
   "いっぱいの",
   "フル"
  ],
  "topic": "vocab",
  "answer": "full（フル）。意味は「いっぱいの」です。例: I am full."
 },
 {
  "id": "vocab_empty",
  "keys": [
   "empty",
   "空の",
   "エンプティ"
  ],
  "topic": "vocab",
  "answer": "empty（エンプティ）。意味は「空の」です。例: The box is empty."
 },
 {
  "id": "vocab_clean_2",
  "keys": [
   "clean",
   "きれいな",
   "クリーン"
  ],
  "topic": "vocab",
  "answer": "clean（クリーン）。意味は「きれいな（清潔）」です。例: My room is clean."
 },
 {
  "id": "vocab_dirty",
  "keys": [
   "dirty",
   "汚れた",
   "ダーティ"
  ],
  "topic": "vocab",
  "answer": "dirty（ダーティ）。意味は「汚れた」です。例: My shoes are dirty."
 },
 {
  "id": "vocab_quiet",
  "keys": [
   "quiet",
   "静かな",
   "クワイエット"
  ],
  "topic": "vocab",
  "answer": "quiet（クワイエット）。意味は「静かな」です。例: This town is quiet."
 },
 {
  "id": "vocab_bright",
  "keys": [
   "bright",
   "明るい",
   "ブライト"
  ],
  "topic": "vocab",
  "answer": "bright（ブライト）。意味は「明るい」です。例: The sun is bright."
 },
 {
  "id": "vocab_dark",
  "keys": [
   "dark",
   "暗い",
   "ダーク"
  ],
  "topic": "vocab",
  "answer": "dark（ダーク）。意味は「暗い」です。例: It is dark at night."
 },
 {
  "id": "vocab_safe",
  "keys": [
   "safe",
   "安全な",
   "セーフ"
  ],
  "topic": "vocab",
  "answer": "safe（セーフ）。意味は「安全な」です。例: This place is safe."
 },
 {
  "id": "vocab_dangerous",
  "keys": [
   "dangerous",
   "危険な",
   "デンジャラス"
  ],
  "topic": "vocab",
  "answer": "dangerous（デンジャラス）。意味は「危険な」です。例: Fire is dangerous."
 },
 {
  "id": "vocab_famous",
  "keys": [
   "famous",
   "有名な",
   "フェイマス"
  ],
  "topic": "vocab",
  "answer": "famous（フェイマス）。意味は「有名な」です。例: This song is famous."
 },
 {
  "id": "vocab_interesting",
  "keys": [
   "interesting",
   "面白い",
   "インタレスティング"
  ],
  "topic": "vocab",
  "answer": "interesting（インタレスティング）。意味は「面白い」です。例: This book is interesting."
 },
 {
  "id": "vocab_boring",
  "keys": [
   "boring",
   "退屈な",
   "ボーリング"
  ],
  "topic": "vocab",
  "answer": "boring（ボーリング）。意味は「退屈な」です。例: The movie was boring."
 },
 {
  "id": "vocab_delicious",
  "keys": [
   "delicious",
   "おいしい",
   "デリシャス"
  ],
  "topic": "vocab",
  "answer": "delicious（デリシャス）。意味は「おいしい」です。例: Japanese food is delicious."
 },
 {
  "id": "vocab_hungry",
  "keys": [
   "hungry",
   "お腹がすいた",
   "ハングリー"
  ],
  "topic": "vocab",
  "answer": "hungry（ハングリー）。意味は「お腹がすいた」です。例: I am hungry."
 },
 {
  "id": "vocab_thirsty",
  "keys": [
   "thirsty",
   "喉が渇いた",
   "サースティ"
  ],
  "topic": "vocab",
  "answer": "thirsty（サースティ）。意味は「喉が渇いた」です。例: We are thirsty."
 },
 {
  "id": "vocab_sick",
  "keys": [
   "sick",
   "病気の",
   "シック"
  ],
  "topic": "vocab",
  "answer": "sick（シック）。意味は「病気の」です。例: He is sick today."
 },
 {
  "id": "vocab_healthy",
  "keys": [
   "healthy",
   "健康な",
   "ヘルシー"
  ],
  "topic": "vocab",
  "answer": "healthy（ヘルシー）。意味は「健康な」です。例: Green tea is healthy."
 },
 {
  "id": "vocab_heavy",
  "keys": [
   "heavy",
   "重い",
   "ヘビー"
  ],
  "topic": "vocab",
  "answer": "heavy（ヘビー）。意味は「重い」です。例: This bag is heavy."
 },
 {
  "id": "vocab_light_2",
  "keys": [
   "light",
   "軽い",
   "明るい",
   "ライト"
  ],
  "topic": "vocab",
  "answer": "light（ライト）。意味は「軽い・明るい」です。例: This box is light."
 },
 {
  "id": "vocab_early",
  "keys": [
   "early",
   "早い",
   "アーリー"
  ],
  "topic": "vocab",
  "answer": "early（アーリー）。意味は「早い（時刻）」です。例: I get up early."
 },
 {
  "id": "vocab_late",
  "keys": [
   "late",
   "遅い",
   "レイト"
  ],
  "topic": "vocab",
  "answer": "late（レイト）。意味は「遅い（時刻）」です。例: Don't be late."
 },
 {
  "id": "vocab_near",
  "keys": [
   "near",
   "近い",
   "ニア"
  ],
  "topic": "vocab",
  "answer": "near（ニア）。意味は「近い」です。例: The bank is near here."
 },
 {
  "id": "vocab_far",
  "keys": [
   "far",
   "遠い",
   "ファー"
  ],
  "topic": "vocab",
  "answer": "far（ファー）。意味は「遠い」です。例: The airport is far."
 },
 {
  "id": "vocab_deep",
  "keys": [
   "deep",
   "深い",
   "ディープ"
  ],
  "topic": "vocab",
  "answer": "deep（ディープ）。意味は「深い」です。例: The sea is deep."
 },
 {
  "id": "vocab_wide",
  "keys": [
   "wide",
   "広い",
   "ワイド"
  ],
  "topic": "vocab",
  "answer": "wide（ワイド）。意味は「広い」です。例: This road is wide."
 },
 {
  "id": "vocab_narrow",
  "keys": [
   "narrow",
   "狭い",
   "ナロー"
  ],
  "topic": "vocab",
  "answer": "narrow（ナロー）。意味は「狭い」です。例: This road is narrow."
 },
 {
  "id": "vocab_cheap",
  "keys": [
   "cheap",
   "安い",
   "チープ"
  ],
  "topic": "vocab",
  "answer": "cheap（チープ）。意味は「安い」です。例: Potatoes are cheap."
 },
 {
  "id": "vocab_expensive",
  "keys": [
   "expensive",
   "値段が高い",
   "エクスペンシブ"
  ],
  "topic": "vocab",
  "answer": "expensive（エクスペンシブ）。意味は「値段が高い」です。例: This watch is expensive."
 },
 {
  "id": "vocab_sour",
  "keys": [
   "sour",
   "すっぱい",
   "サワー"
  ],
  "topic": "vocab",
  "answer": "sour（サワー）。意味は「すっぱい」です。例: Lemons are sour."
 },
 {
  "id": "vocab_sweet",
  "keys": [
   "sweet",
   "甘い",
   "スウィート"
  ],
  "topic": "vocab",
  "answer": "sweet（スウィート）。意味は「甘い」です。例: Sugar is sweet."
 },
 {
  "id": "vocab_salty",
  "keys": [
   "salty",
   "塩辛い",
   "ソルティ"
  ],
  "topic": "vocab",
  "answer": "salty（ソルティ）。意味は「塩辛い」です。例: This soup is salty."
 },
 {
  "id": "vocab_smart",
  "keys": [
   "smart",
   "頭が良い",
   "スマート"
  ],
  "topic": "vocab",
  "answer": "smart（スマート）。意味は「頭が良い」です。例: Pigs are smart."
 },
 {
  "id": "vocab_funny",
  "keys": [
   "funny",
   "おかしい",
   "面白い",
   "ファニー"
  ],
  "topic": "vocab",
  "answer": "funny（ファニー）。意味は「おかしい・面白い」です。例: Our teacher is funny."
 },
 {
  "id": "vocab_careful",
  "keys": [
   "careful",
   "注意深い",
   "ケアフル"
  ],
  "topic": "vocab",
  "answer": "careful（ケアフル）。意味は「注意深い」です。例: Be careful."
 },
 {
  "id": "vocab_glad",
  "keys": [
   "glad",
   "うれしい",
   "グラッド"
  ],
  "topic": "vocab",
  "answer": "glad（グラッド）。意味は「うれしい」です。例: I am glad to meet you."
 },
 {
  "id": "vocab_sorry",
  "keys": [
   "sorry",
   "申し訳ない",
   "残念な",
   "ソーリー"
  ],
  "topic": "vocab",
  "answer": "sorry（ソーリー）。意味は「申し訳ない・残念な」です。例: I am sorry."
 },
 {
  "id": "vocab_proud",
  "keys": [
   "proud",
   "誇りに思う",
   "プラウド"
  ],
  "topic": "vocab",
  "answer": "proud（プラウド）。意味は「誇りに思う」です。例: I am proud of you."
 },
 {
  "id": "vocab_shy",
  "keys": [
   "shy",
   "恥ずかしがりの",
   "シャイ"
  ],
  "topic": "vocab",
  "answer": "shy（シャイ）。意味は「恥ずかしがりの」です。例: He is shy."
 },
 {
  "id": "vocab_brave",
  "keys": [
   "brave",
   "勇敢な",
   "ブレイブ"
  ],
  "topic": "vocab",
  "answer": "brave（ブレイブ）。意味は「勇敢な」です。例: Be brave."
 },
 {
  "id": "vocab_polite",
  "keys": [
   "polite",
   "礼儀正しい",
   "ポライト"
  ],
  "topic": "vocab",
  "answer": "polite（ポライト）。意味は「礼儀正しい」です。例: He is polite."
 },
 {
  "id": "vocab_honest",
  "keys": [
   "honest",
   "正直な",
   "オネスト"
  ],
  "topic": "vocab",
  "answer": "honest（オネスト）。意味は「正直な」です。例: She is honest."
 },
 {
  "id": "vocab_lazy",
  "keys": [
   "lazy",
   "怠け者の",
   "レイジー"
  ],
  "topic": "vocab",
  "answer": "lazy（レイジー）。意味は「怠け者の」です。例: Don't be lazy."
 },
 {
  "id": "vocab_sunny",
  "keys": [
   "sunny",
   "晴れた",
   "サニー"
  ],
  "topic": "vocab",
  "answer": "sunny（サニー）。意味は「晴れた」です。例: It is a sunny day."
 },
 {
  "id": "vocab_cloudy",
  "keys": [
   "cloudy",
   "曇った",
   "クラウディ"
  ],
  "topic": "vocab",
  "answer": "cloudy（クラウディ）。意味は「曇った」です。例: It is cloudy today."
 },
 {
  "id": "vocab_rainy",
  "keys": [
   "rainy",
   "雨の",
   "レイニー"
  ],
  "topic": "vocab",
  "answer": "rainy（レイニー）。意味は「雨の」です。例: June is a rainy month."
 },
 {
  "id": "vocab_windy",
  "keys": [
   "windy",
   "風の強い",
   "ウィンディ"
  ],
  "topic": "vocab",
  "answer": "windy（ウィンディ）。意味は「風の強い」です。例: It is windy today."
 },
 {
  "id": "vocab_dry",
  "keys": [
   "dry",
   "乾いた",
   "ドライ"
  ],
  "topic": "vocab",
  "answer": "dry（ドライ）。意味は「乾いた」です。例: The air is dry."
 },
 {
  "id": "vocab_wet",
  "keys": [
   "wet",
   "濡れた",
   "ウェット"
  ],
  "topic": "vocab",
  "answer": "wet（ウェット）。意味は「濡れた」です。例: My shoes are wet."
 },
 {
  "id": "vocab_round",
  "keys": [
   "round",
   "丸い",
   "ラウンド"
  ],
  "topic": "vocab",
  "answer": "round（ラウンド）。意味は「丸い」です。例: The moon is round."
 },
 {
  "id": "vocab_very",
  "keys": [
   "very",
   "とても",
   "ベリー"
  ],
  "topic": "vocab",
  "answer": "very（ベリー）。意味は「とても」です。例: Time is very important."
 },
 {
  "id": "vocab_always",
  "keys": [
   "always",
   "いつも",
   "オールウェイズ"
  ],
  "topic": "vocab",
  "answer": "always（オールウェイズ）。意味は「いつも」です。例: I always get up at six."
 },
 {
  "id": "vocab_usually",
  "keys": [
   "usually",
   "たいてい",
   "ユージュアリー"
  ],
  "topic": "vocab",
  "answer": "usually（ユージュアリー）。意味は「たいてい」です。例: We usually walk to school."
 },
 {
  "id": "vocab_often",
  "keys": [
   "often",
   "しばしば",
   "オーフン"
  ],
  "topic": "vocab",
  "answer": "often（オーフン）。意味は「しばしば」です。例: It often rains in June."
 },
 {
  "id": "vocab_sometimes",
  "keys": [
   "sometimes",
   "時々",
   "サムタイムズ"
  ],
  "topic": "vocab",
  "answer": "sometimes（サムタイムズ）。意味は「時々」です。例: Sometimes I cook."
 },
 {
  "id": "vocab_never",
  "keys": [
   "never",
   "決してない",
   "ネバー"
  ],
  "topic": "vocab",
  "answer": "never（ネバー）。意味は「決して〜ない」です。例: I never drink coffee at night."
 },
 {
  "id": "vocab_now",
  "keys": [
   "now",
   "今",
   "ナウ"
  ],
  "topic": "vocab",
  "answer": "now（ナウ）。意味は「今」です。例: The game starts now."
 },
 {
  "id": "vocab_then",
  "keys": [
   "then",
   "それから",
   "その時",
   "ゼン"
  ],
  "topic": "vocab",
  "answer": "then（ゼン）。意味は「それから・その時」です。例: We ate, then walked."
 },
 {
  "id": "vocab_here",
  "keys": [
   "here",
   "ここに",
   "ヒア"
  ],
  "topic": "vocab",
  "answer": "here（ヒア）。意味は「ここに」です。例: The bank is near here."
 },
 {
  "id": "vocab_there",
  "keys": [
   "there",
   "そこに",
   "ゼア"
  ],
  "topic": "vocab",
  "answer": "there（ゼア）。意味は「そこに」です。例: We spend two hours there."
 },
 {
  "id": "vocab_again",
  "keys": [
   "again",
   "もう一度",
   "アゲイン"
  ],
  "topic": "vocab",
  "answer": "again（アゲイン）。意味は「もう一度」です。例: Try again."
 },
 {
  "id": "vocab_together",
  "keys": [
   "together",
   "一緒に",
   "トゥギャザー"
  ],
  "topic": "vocab",
  "answer": "together（トゥギャザー）。意味は「一緒に」です。例: We eat lunch together."
 },
 {
  "id": "vocab_alone",
  "keys": [
   "alone",
   "一人で",
   "アローン"
  ],
  "topic": "vocab",
  "answer": "alone（アローン）。意味は「一人で」です。例: He lives alone."
 },
 {
  "id": "vocab_soon",
  "keys": [
   "soon",
   "すぐに",
   "スーン"
  ],
  "topic": "vocab",
  "answer": "soon（スーン）。意味は「すぐに」です。例: The movie starts soon."
 },
 {
  "id": "vocab_already",
  "keys": [
   "already",
   "すでに",
   "オールレディ"
  ],
  "topic": "vocab",
  "answer": "already（オールレディ）。意味は「すでに」です。例: I already finished it."
 },
 {
  "id": "vocab_just",
  "keys": [
   "just",
   "ちょうど",
   "したばかり",
   "ジャスト"
  ],
  "topic": "vocab",
  "answer": "just（ジャスト）。意味は「ちょうど・〜したばかり」です。例: We just arrived."
 },
 {
  "id": "vocab_only",
  "keys": [
   "only",
   "だけ",
   "オンリー"
  ],
  "topic": "vocab",
  "answer": "only（オンリー）。意味は「〜だけ」です。例: I have only one brother."
 },
 {
  "id": "vocab_also",
  "keys": [
   "also",
   "もまた",
   "オールソー"
  ],
  "topic": "vocab",
  "answer": "also（オールソー）。意味は「〜もまた」です。例: She also likes cats."
 },
 {
  "id": "vocab_maybe",
  "keys": [
   "maybe",
   "たぶん",
   "メイビー"
  ],
  "topic": "vocab",
  "answer": "maybe（メイビー）。意味は「たぶん」です。例: Maybe it will rain."
 },
 {
  "id": "vocab_everyone",
  "keys": [
   "everyone",
   "みんな",
   "エブリワン"
  ],
  "topic": "vocab",
  "answer": "everyone（エブリワン）。意味は「みんな」です。例: Everyone came to the park."
 },
 {
  "id": "vocab_someone",
  "keys": [
   "someone",
   "誰か",
   "サムワン"
  ],
  "topic": "vocab",
  "answer": "someone（サムワン）。意味は「誰か」です。例: Someone is at the door."
 },
 {
  "id": "vocab_something",
  "keys": [
   "something",
   "何か",
   "サムシング"
  ],
  "topic": "vocab",
  "answer": "something（サムシング）。意味は「何か」です。例: I want something cold."
 },
 {
  "id": "vocab_everything",
  "keys": [
   "everything",
   "すべてのこと",
   "エブリシング"
  ],
  "topic": "vocab",
  "answer": "everything（エブリシング）。意味は「すべてのこと」です。例: Everything is ready."
 },
 {
  "id": "vocab_nothing",
  "keys": [
   "nothing",
   "何もない",
   "ナッシング"
  ],
  "topic": "vocab",
  "answer": "nothing（ナッシング）。意味は「何も〜ない」です。例: There is nothing in the box."
 },
 {
  "id": "vocab_what",
  "keys": [
   "what",
   "何",
   "ワット"
  ],
  "topic": "vocab",
  "answer": "what（ワット）。意味は「何」です。例: What color is it?"
 },
 {
  "id": "vocab_who",
  "keys": [
   "who",
   "誰",
   "フー"
  ],
  "topic": "vocab",
  "answer": "who（フー）。意味は「誰」です。例: Who is that man?"
 },
 {
  "id": "vocab_when",
  "keys": [
   "when",
   "いつ",
   "ウェン"
  ],
  "topic": "vocab",
  "answer": "when（ウェン）。意味は「いつ」です。例: When is your birthday?"
 },
 {
  "id": "vocab_where",
  "keys": [
   "where",
   "どこ",
   "ウェア"
  ],
  "topic": "vocab",
  "answer": "where（ウェア）。意味は「どこ」です。例: Where is the station?"
 },
 {
  "id": "vocab_why",
  "keys": [
   "why",
   "なぜ",
   "ワイ"
  ],
  "topic": "vocab",
  "answer": "why（ワイ）。意味は「なぜ」です。例: Why are you late?"
 },
 {
  "id": "vocab_how",
  "keys": [
   "how",
   "どのように",
   "どれくらい",
   "ハウ"
  ],
  "topic": "vocab",
  "answer": "how（ハウ）。意味は「どのように・どれくらい」です。例: How are you?"
 },
 {
  "id": "vocab_which",
  "keys": [
   "which",
   "どちら",
   "どれ",
   "ウィッチ"
  ],
  "topic": "vocab",
  "answer": "which（ウィッチ）。意味は「どちら・どれ」です。例: Which is your bag?"
 },
 {
  "id": "grammar_present_simple",
  "keys": [
   "現在形",
   "三単現",
   "三人称単数",
   "sをつける",
   "一般動詞の現在"
  ],
  "topic": "grammar",
  "answer": "現在形は「普段のこと」を言う形です。主語が he / she / it など三人称単数のとき、動詞に s をつけます。例: He plays soccer. / She watches TV. ……s の付け忘れが、一番多い間違いです。"
 },
 {
  "id": "grammar_past_regular",
  "keys": [
   "過去形",
   "過去の作り方",
   "edをつける",
   "規則動詞"
  ],
  "topic": "grammar",
  "answer": "過去形は、規則動詞なら動詞に ed をつけます。例: play → played、watch → watched。e で終わる語は d だけ、子音字＋y は y を i に変えて ed です。例: study → studied。"
 },
 {
  "id": "grammar_past_irregular",
  "keys": [
   "不規則動詞",
   "不規則変化",
   "goの過去",
   "過去形の不規則"
  ],
  "topic": "grammar",
  "answer": "不規則動詞は形がまるごと変わります。go → went、see → saw、eat → ate、buy → bought、come → came、take → took。……これは覚えるしかありません。一覧で繰り返し見るのが近道です。"
 },
 {
  "id": "grammar_progressive",
  "keys": [
   "進行形",
   "be動詞とing",
   "今している",
   "現在進行形"
  ],
  "topic": "grammar",
  "answer": "現在進行形は be動詞＋動詞のing形で「今まさにしている最中」を表します。例: I am reading now. / She is cooking. 否定は be の後ろに not、疑問は be を前に出します。"
 },
 {
  "id": "grammar_past_progressive",
  "keys": [
   "過去進行形",
   "していた",
   "was ing"
  ],
  "topic": "grammar",
  "answer": "過去進行形は was / were ＋ ing形で「あの時〜していた最中」を表します。例: I was sleeping at ten. 短い出来事と組み合わせるのが定番です。例: I was sleeping when he called."
 },
 {
  "id": "grammar_present_perfect_exp",
  "keys": [
   "現在完了",
   "haveと過去分詞",
   "したことがある",
   "経験の完了形"
  ],
  "topic": "grammar",
  "answer": "現在完了は have / has ＋ 過去分詞です。経験は「〜したことがある」。例: I have been to Kyoto. 回数は once / twice / three times、否定は never を使います。"
 },
 {
  "id": "grammar_present_perfect_cont",
  "keys": [
   "ずっとしている",
   "継続の完了形",
   "sinceとfor",
   "現在完了の継続"
  ],
  "topic": "grammar",
  "answer": "現在完了の継続は「ずっと〜している」です。例: I have lived here for three years. 期間は for、起点は since を使います。How long have you 〜? で期間を聞けます。"
 },
 {
  "id": "grammar_future_will",
  "keys": [
   "will",
   "未来形",
   "だろう",
   "意志のwill"
  ],
  "topic": "grammar",
  "answer": "will は「その場で決めた意志」と「予測」に使います。例: I'll help you.（手伝います）/ It will rain tomorrow.（降るでしょう）形は will ＋ 動詞の原形で、主語で形は変わりません。"
 },
 {
  "id": "grammar_be_going_to",
  "keys": [
   "be going to",
   "するつもり",
   "予定の未来",
   "going to"
  ],
  "topic": "grammar",
  "answer": "be going to は「前から決めていた予定」に使います。例: I am going to visit Kyoto. will がその場の意志、going to が既定の予定、と使い分けるのが基本です。"
 },
 {
  "id": "grammar_can",
  "keys": [
   "can",
   "できる",
   "助動詞can"
  ],
  "topic": "grammar",
  "answer": "can は「〜できる」。例: I can swim. 否定は cannot / can't、疑問は Can you 〜? です。……「できますか」の丁寧な依頼にも使えます。Could you 〜? は、さらに丁寧な形です。"
 },
 {
  "id": "grammar_must_have_to",
  "keys": [
   "must",
   "have to",
   "しなければならない",
   "義務"
  ],
  "topic": "grammar",
  "answer": "must と have to はどちらも「〜しなければならない」。例: You must stop. / I have to go. ただし否定は大違いで、must not は禁止、don't have to は「しなくてよい」です。ここは要注意です。"
 },
 {
  "id": "grammar_should",
  "keys": [
   "should",
   "したほうがいい",
   "助動詞should"
  ],
  "topic": "grammar",
  "answer": "should は「〜したほうがいい」という助言です。例: You should rest. must より柔らかく、相手に選択肢が残る言い方です。"
 },
 {
  "id": "grammar_may",
  "keys": [
   "may",
   "してもよい",
   "かもしれない",
   "助動詞may"
  ],
  "topic": "grammar",
  "answer": "may は「〜してもよい（許可）」と「〜かもしれない（推量）」の2つです。例: You may go. / It may rain. 推量の確かさは、will より低く見積もる語です。"
 },
 {
  "id": "grammar_comparative",
  "keys": [
   "比較級",
   "erとmore",
   "より",
   "比べる言い方"
  ],
  "topic": "grammar",
  "answer": "比較級は「A は B より〜」。短い語は -er、長い語は more をつけ、相手は than の後ろに置きます。例: This is bigger than that. / This book is more interesting than that one. good → better、bad → worse は不規則です。"
 },
 {
  "id": "grammar_superlative",
  "keys": [
   "最上級",
   "estとmost",
   "一番"
  ],
  "topic": "grammar",
  "answer": "最上級は「一番〜」。the ＋ -est、または the most を使います。例: He is the tallest in the class. 範囲は in / of で示します。good → the best は不規則変化です。"
 },
 {
  "id": "grammar_as_as",
  "keys": [
   "as as",
   "同じくらい",
   "as形容詞as"
  ],
  "topic": "grammar",
  "answer": "as ＋ 原級 ＋ as で「〜と同じくらい…」です。例: This bag is as heavy as that one. 否定の not as 〜 as は「〜ほど…ではない」になります。"
 },
 {
  "id": "grammar_relative_who",
  "keys": [
   "関係代名詞",
   "whoの使い方",
   "関係代名詞who"
  ],
  "topic": "grammar",
  "answer": "関係代名詞 who は「人」を説明するときに使います。例: I know a girl who speaks English. 先行詞（人）の後ろに who＋文を続けます。主格なら who は省略できません。"
 },
 {
  "id": "grammar_relative_which",
  "keys": [
   "関係代名詞which",
   "whichとthat",
   "関係代名詞that",
   "物を説明する"
  ],
  "topic": "grammar",
  "answer": "物を説明するのは which / that です。例: This is the book which I bought. 目的格なら省略もできます。例: This is the book I bought. 人にも物にも使える that は、万能ですが最上級の後ろ等で好まれます。"
 },
 {
  "id": "grammar_passive",
  "keys": [
   "受動態",
   "受け身",
   "beと過去分詞",
   "される"
  ],
  "topic": "grammar",
  "answer": "受動態は be動詞＋過去分詞で「〜される」。例: This temple was built in 1600. 行為者は by 〜 で付けられますが、不要なら省くのが普通です。"
 },
 {
  "id": "grammar_infinitive",
  "keys": [
   "不定詞",
   "to動詞",
   "to do"
  ],
  "topic": "grammar",
  "answer": "不定詞 to ＋ 原形は3用法あります。名詞的「〜すること」例: I want to sleep. 形容詞的「〜するための」例: something to drink。副詞的「〜するために」例: I went there to see him。文脈で判断します。"
 },
 {
  "id": "grammar_gerund",
  "keys": [
   "動名詞",
   "ingの名詞",
   "すること"
  ],
  "topic": "grammar",
  "answer": "動名詞は動詞のing形を名詞として使う形です。例: Swimming is fun. enjoy / finish / stop の後ろは不定詞ではなく動名詞、という決まりがあります。例: I enjoy reading."
 },
 {
  "id": "grammar_imperative",
  "keys": [
   "命令文",
   "命令形",
   "しなさい"
  ],
  "topic": "grammar",
  "answer": "命令文は動詞の原形で始めます。例: Open the door. 丁寧にするには please をつけます。否定は Don't ＋ 原形です。……私への指示も、この形で十分通じます。"
 },
 {
  "id": "grammar_lets",
  "keys": [
   "lets",
   "一緒にしよう",
   "誘う言い方",
   "let's"
  ],
  "topic": "grammar",
  "answer": "Let's ＋ 原形は「一緒に〜しよう」。例: Let's play soccer. 答えは Yes, let's. / No, let's not. です。Shall we 〜? も同じ誘いの言い方です。"
 },
 {
  "id": "grammar_question_be",
  "keys": [
   "疑問文の作り方",
   "be動詞の疑問文",
   "疑問文"
  ],
  "topic": "grammar",
  "answer": "be動詞の疑問文は、be を文頭に出すだけです。例: You are busy. → Are you busy? 答えは Yes, I am. / No, I'm not. です。"
 },
 {
  "id": "grammar_question_do",
  "keys": [
   "doとdoes",
   "一般動詞の疑問文",
   "doesの使い方"
  ],
  "topic": "grammar",
  "answer": "一般動詞の疑問文は Do / Does で始めます。例: Do you like cats? / Does he play tennis? Does を使うと、本動詞の s は消えます。plays ではなく play に戻すのが要点です。"
 },
 {
  "id": "grammar_negative",
  "keys": [
   "否定文",
   "don'tとdoesn't",
   "ではない"
  ],
  "topic": "grammar",
  "answer": "否定文は be動詞なら後ろに not、一般動詞なら don't / doesn't / didn't を動詞の前に置きます。例: I don't know. / He doesn't like rain. doesn't の後は原形です。"
 },
 {
  "id": "grammar_wh_questions",
  "keys": [
   "疑問詞",
   "what who when where why how",
   "5W1H"
  ],
  "topic": "grammar",
  "answer": "疑問詞は What（何）Who（誰）When（いつ）Where（どこ）Why（なぜ）How（どう・どれくらい）です。疑問詞＋疑問文の語順が基本形です。例: Where do you live?"
 },
 {
  "id": "grammar_how_many_much",
  "keys": [
   "how many",
   "how much",
   "いくつ",
   "どれくらい聞く"
  ],
  "topic": "grammar",
  "answer": "数えられる名詞の数は How many ＋ 複数形、数えられない量は How much です。例: How many books do you have? / How much is it? 値段を聞くときは How much が定番です。"
 },
 {
  "id": "grammar_prep_time",
  "keys": [
   "前置詞の時間",
   "in on at 時間",
   "時間の前置詞"
  ],
  "topic": "grammar",
  "answer": "時の前置詞は at（時刻）on（曜日・日付）in（月・年・季節）です。例: at seven / on Monday / in June。小さい単位ほど at、と覚えると整理できます。"
 },
 {
  "id": "grammar_prep_place",
  "keys": [
   "場所の前置詞",
   "in on at 場所",
   "場所を言う前置詞"
  ],
  "topic": "grammar",
  "answer": "場所は at（点）on（面の上）in（中）です。例: at the station / on the desk / in the box。乗り物はバス・電車は on、車は in が基本です。"
 },
 {
  "id": "grammar_by_until",
  "keys": [
   "byとuntil",
   "までに",
   "までずっと"
  ],
  "topic": "grammar",
  "answer": "by は「〜までに（期限）」、until は「〜までずっと（継続）」です。例: Finish it by Friday.（金曜までに）/ Wait until Friday.（金曜まで待つ）日本語の「まで」が同じなので、混同しやすい所です。"
 },
 {
  "id": "grammar_for_since",
  "keys": [
   "forとsince",
   "期間と起点",
   "for since 違い"
  ],
  "topic": "grammar",
  "answer": "for は期間の長さ、since は始まった時点です。例: for three years（3年間）/ since 2020（2020年から）。現在完了と組で出てきます。"
 },
 {
  "id": "grammar_between_among",
  "keys": [
   "betweenとamong",
   "の間",
   "between among 違い"
  ],
  "topic": "grammar",
  "answer": "between は2つの間、among は3つ以上の間（集団の中）です。例: between you and me / among the students。"
 },
 {
  "id": "grammar_before_after",
  "keys": [
   "beforeとafter",
   "の前",
   "の後"
  ],
  "topic": "grammar",
  "answer": "before は「〜の前に」、after は「〜の後に」。前置詞にも接続詞にもなります。例: before lunch / after school / After I ate, I slept."
 },
 {
  "id": "grammar_conjunction_basic",
  "keys": [
   "接続詞",
   "and but or",
   "文をつなぐ"
  ],
  "topic": "grammar",
  "answer": "and は追加、but は逆接、or は選択です。例: I like tea and coffee. / I tried, but I failed. / Tea or coffee? 文と文、語と語、どちらもつなげます。"
 },
 {
  "id": "grammar_conjunction_clause",
  "keys": [
   "when because if",
   "理由と条件",
   "接続詞when"
  ],
  "topic": "grammar",
  "answer": "when は「〜のとき」、because は「〜だから」、if は「もし〜なら」。例: When I was young, ... / I stayed home because I was sick. because の答えは Why への返答に使います。"
 },
 {
  "id": "grammar_pronoun",
  "keys": [
   "代名詞",
   "I my me mine",
   "人称代名詞"
  ],
  "topic": "grammar",
  "answer": "代名詞は形が4つあります。I（私は）my（私の）me（私を・に）mine（私のもの）。例: He gave me his book. 主語・所有・目的で形を使い分けるのが英語の基本動作です。"
 },
 {
  "id": "grammar_demonstrative",
  "keys": [
   "thisとthat",
   "指示語",
   "these those"
  ],
  "topic": "grammar",
  "answer": "近いものは this（単数）these（複数）、遠いものは that / those です。例: This is my bag. / Those are his books. 電話では「私は〜です」を This is 〜 と言う決まりもあります。"
 },
 {
  "id": "grammar_article",
  "keys": [
   "冠詞",
   "a an the",
   "theの使い方"
  ],
  "topic": "grammar",
  "answer": "a / an は「不特定の1つ」、the は「特定のそれ」です。例: I saw a dog. The dog was cute. 初めて出す名詞は a、2回目からは the。これが基本の流れです。an は母音の音で始まる語の前です。"
 },
 {
  "id": "grammar_countable",
  "keys": [
   "可算名詞",
   "不可算名詞",
   "数えられる名詞"
  ],
  "topic": "grammar",
  "answer": "数えられる名詞は複数形にできますが、water / money / homework のような不可算名詞は複数形にせず、量は much / a lot of で表します。例: a piece of advice のように数える工夫もあります。"
 },
 {
  "id": "grammar_some_any",
  "keys": [
   "someとany",
   "some any 違い"
  ],
  "topic": "grammar",
  "answer": "some は肯定文、any は疑問文・否定文が基本です。例: I have some books. / Do you have any books? ただし「勧める疑問文」では some が来ます。例: Would you like some tea?"
 },
 {
  "id": "grammar_too_enough",
  "keys": [
   "tooとenough",
   "すぎる",
   "十分に"
  ],
  "topic": "grammar",
  "answer": "too ＋ 形容詞は「〜すぎる（困る）」、形容詞 ＋ enough は「十分に〜」です。例: It's too hot. / He is old enough to drive. enough の位置は形容詞の後ろ、名詞の前です。"
 },
 {
  "id": "grammar_exciting_excited",
  "keys": [
   "excitingとexcited",
   "分詞の形容詞",
   "ワクワクする"
  ],
  "topic": "grammar",
  "answer": "人をワクワクさせる物は -ing、感情を感じる人は -ed です。例: The movie is exciting. / I am excited. boring / bored、interesting / interested も同じ組み合わせです。"
 },
 {
  "id": "grammar_indirect_question",
  "keys": [
   "間接疑問文",
   "か教えて",
   "whether"
  ],
  "topic": "grammar",
  "answer": "間接疑問文は、疑問を文の中に埋め込む形で、語順は肯定文に戻ります。例: Tell me where the station is.（× is the station としない）ここが試験の定番ポイントです。"
 },
 {
  "id": "grammar_tag_question",
  "keys": [
   "付加疑問文",
   "だよね",
   "isn't it"
  ],
  "topic": "grammar",
  "answer": "付加疑問文は文の最後に「〜だよね」をつける形です。肯定文には否定の短縮形をつけます。例: You are tired, aren't you? 下がり調子なら同意を求めるだけ、上がり調子なら本当の確認です。"
 },
 {
  "id": "grammar_would_like",
  "keys": [
   "would like to",
   "したい丁寧",
   "want toの丁寧"
  ],
  "topic": "grammar",
  "answer": "would like to は want to の丁寧形です。例: I would like to see it. 店や目上の人にはこちらです。勧誘は Would you like 〜? の形になります。"
 },
 {
  "id": "grammar_be_able_to",
  "keys": [
   "be able to",
   "できるの言い換え",
   "able to"
  ],
  "topic": "grammar",
  "answer": "be able to は can の言い換えです。例: I am able to swim. can に無い未来や完了の形を作れるのが強みです。例: I will be able to go."
 },
 {
  "id": "grammar_look_like",
  "keys": [
   "look like",
   "のように見える",
   "lookの使い方"
  ],
  "topic": "grammar",
  "answer": "look は「見る・〜に見える」、look like ＋ 名詞で「〜のようだ」です。例: You look tired. / It looks like rain. look at は「〜を（じっと）見る」です。"
 },
 {
  "id": "grammar_say_tell",
  "keys": [
   "sayとtell",
   "speakとtalk",
   "話すの違い"
  ],
  "topic": "grammar",
  "answer": "say は言葉そのもの、tell は相手に伝える（tell 人 物）です。speak は言語や公式の場面、talk は会話そのものです。例: Say it again. / Tell me the story. / Speak English. / Talk to me."
 },
 {
  "id": "grammar_borrow_lend",
  "keys": [
   "borrowとlend",
   "借りると貸す",
   "borrow lend 違い"
  ],
  "topic": "grammar",
  "answer": "borrow は「借りる（自分が受け取る）」、lend は「貸す（相手に渡す）」です。例: Can I borrow your pen? / Can you lend me your pen? 主語の向きで決まります。"
 },
 {
  "id": "grammar_bring_take",
  "keys": [
   "bringとtake",
   "持ってくる持っていく",
   "bring take 違い"
  ],
  "topic": "grammar",
  "answer": "bring は話し手の方へ持ってくる、take は向こうへ持っていくです。例: Bring it here. / Take it to him. come / go と同じ向きの感覚です。"
 },
 {
  "id": "grammar_hear_listen",
  "keys": [
   "hearとlisten",
   "聞くの違い",
   "hear listen"
  ],
  "topic": "grammar",
  "answer": "hear は「自然に聞こえる」、listen to は「耳を傾けて聞く」です。例: I hear birds. / I listen to music. 意志があるかどうかが分かれ目です。"
 },
 {
  "id": "grammar_see_watch_look",
  "keys": [
   "seeとwatchとlook",
   "見るの違い",
   "see watch look"
  ],
  "topic": "grammar",
  "answer": "see は「目に入る・映画などを見る」、look at は「視線を向ける」、watch は「動きをじっと見る」です。例: I see a bird. / Look at me. / Watch TV."
 },
 {
  "id": "grammar_ordinal",
  "keys": [
   "序数",
   "何番目",
   "first second third"
  ],
  "topic": "grammar",
  "answer": "序数は first（1番目）second（2番目）third（3番目）、その後は -th で fourth, fifth... です。日付や順番に使います。例: May 3rd（5月3日）。"
 },
 {
  "id": "grammar_date",
  "keys": [
   "日付の言い方",
   "日付",
   "何月何日"
  ],
  "topic": "grammar",
  "answer": "日付は月＋序数で言います。例: November 24th（11月24日）。イギリス式は 24 November と順が逆です。年は twenty twenty-five のように2桁ずつ読むのが普通です。"
 },
 {
  "id": "grammar_time_telling",
  "keys": [
   "時刻の言い方",
   "何時ですか",
   "時間の表現"
  ],
  "topic": "grammar",
  "answer": "時刻は It's ＋ 時 ＋ 分 です。例: It's seven thirty.（7時半）7時45分は It's seven forty-five、または a quarter to eight（8時15分前）とも言います。"
 },
 {
  "id": "grammar_weekdays",
  "keys": [
   "曜日",
   "曜日の英語",
   "何曜日"
  ],
  "topic": "grammar",
  "answer": "曜日は Monday（月）Tuesday（火）Wednesday（水）Thursday（木）Friday（金）Saturday（土）Sunday（日）です。曜日の前は on をつけます。例: on Friday。……Wednesday の綴りは、声に出して覚えるのが確実です。"
 },
 {
  "id": "grammar_months",
  "keys": [
   "月名前",
   "月の英語",
   "何月"
  ],
  "topic": "grammar",
  "answer": "月は January, February, March, April, May, June, July, August, September, October, November, December です。月の前は in をつけます。例: in June。"
 },
 {
  "id": "grammar_weather_expr",
  "keys": [
   "天気の言い方",
   "天気を英語で",
   "it's sunny"
  ],
  "topic": "grammar",
  "answer": "天気は It's ＋ 形容詞で言います。例: It's sunny. / It's raining.（雨が降っている）/ It's cold today. 主語の It は「それ」と訳さない、いわゆる天気の it です。"
 },
 {
  "id": "grammar_if_intro",
  "keys": [
   "仮定法",
   "ifの文",
   "もしも",
   "仮定法の入口"
  ],
  "topic": "grammar",
  "answer": "仮定法の入口は「今の事実と違う想像」を過去形で言うことです。例: If I were a bird, I would fly. be動詞は主語によらず were が基本、結果は would ＋ 原形です。……現実には飛べませんが、文法上は自由です。"
 },
 {
  "id": "grammar_if_wish",
  "keys": [
   "wishの文",
   "だったらいいのに",
   "仮定法wish"
  ],
  "topic": "grammar",
  "answer": "I wish ＋ 過去形で「〜だったらいいのに（現実は違う）」。例: I wish I could fly. / I wish I had more time. 後悔や願望を、事実と逆の形で言い表す言い方です。"
 },
 {
  "id": "grammar_causative_intro",
  "keys": [
   "makeとlet",
   "させる",
   "使役の入口"
  ],
  "topic": "grammar",
  "answer": "使役の入口は make 人 ＋ 原形（〜させる）と let 人 ＋ 原形（〜させてあげる）です。例: He made me laugh. / Let me help you. let の方が「許可」の柔らかい響きです。"
 },
 {
  "id": "grammar_shall_proposal",
  "keys": [
   "shall we",
   "why don't we",
   "提案の言い方"
  ],
  "topic": "grammar",
  "answer": "提案は Shall we 〜? / Why don't we 〜? / How about 〜ing? です。例: Shall we go? / Why don't we rest? / How about taking a break? How about の後ろは動名詞です。"
 },
 {
  "id": "grammar_phone_expr",
  "keys": [
   "電話の表現",
   "電話で話す",
   "もしもし英語"
  ],
  "topic": "grammar",
  "answer": "電話の「もしもし」は Hello で、自分は This is 〜 と名乗ります。相手を呼び出すのは May I speak to 〜? です。例: Hello, this is Lize. ……speaking をつけると「私です」になります。"
 },
 {
  "id": "grammar_direction_ask",
  "keys": [
   "道を聞く",
   "行き方を聞く",
   "行き方",
   "道の聞き方",
   "how do i get to"
  ],
  "topic": "grammar",
  "answer": "行き方は How do I get to 〜? で聞きます。例: How do I get to the station? 答えの基本は Go straight（まっすぐ）Turn left/right（左・右へ曲がる）です。"
 },
 {
  "id": "phrase_good_morning",
  "keys": [
   "おはよう",
   "good morning",
   "おはようは英語で"
  ],
  "topic": "phrase",
  "answer": "おはようは Good morning. です。昼過ぎまではこれで十分です。……朝のコーヒーは、淹れてあります。"
 },
 {
  "id": "phrase_hello",
  "keys": [
   "こんにちは",
   "hello",
   "挨拶の基本"
  ],
  "topic": "phrase",
  "answer": "こんにちはは Hello. または Hi. です。Hi は少しくだけた響きです。時間帯を問わない挨拶なら Hello が無難です。"
 },
 {
  "id": "phrase_good_evening",
  "keys": [
   "こんばんは",
   "good evening"
  ],
  "topic": "phrase",
  "answer": "こんばんはは Good evening. です。夕方以降の挨拶に使います。別れ際の「おやすみ」は Good night の方です。"
 },
 {
  "id": "phrase_good_night",
  "keys": [
   "おやすみ",
   "good night"
  ],
  "topic": "phrase",
  "answer": "おやすみは Good night. です。夜の別れ際に使います。……夜更かしは、ほどほどにしてください。"
 },
 {
  "id": "phrase_goodbye",
  "keys": [
   "さようなら",
   "goodbye",
   "別れの挨拶"
  ],
  "topic": "phrase",
  "answer": "さようならは Goodbye. くだけて Bye. です。See you. は「またね」の軽い別れです。"
 },
 {
  "id": "phrase_see_you",
  "keys": [
   "またね",
   "see you",
   "また明日"
  ],
  "topic": "phrase",
  "answer": "またねは See you. 明日なら See you tomorrow. です。later をつけると「また後で」です。"
 },
 {
  "id": "phrase_long_time",
  "keys": [
   "久しぶり",
   "long time no see",
   "久しぶりは英語で"
  ],
  "topic": "phrase",
  "answer": "久しぶりは Long time no see. です。文法は少し崩れていますが、そのまま定着した表現です。"
 },
 {
  "id": "phrase_how_are_you",
  "keys": [
   "元気ですか",
   "how are you",
   "調子はどう"
  ],
  "topic": "phrase",
  "answer": "元気？は How are you? 答えは I'm fine, thank you. のほか、Not bad.（まあまあ）も自然です。聞き返しは And you? で十分です。"
 },
 {
  "id": "phrase_thank_you",
  "keys": [
   "ありがとう",
   "thank you",
   "感謝の言い方"
  ],
  "topic": "phrase",
  "answer": "ありがとうは Thank you. 丁寧に Thank you very much. / Thank you so much. です。……こちらこそ、です。"
 },
 {
  "id": "phrase_youre_welcome",
  "keys": [
   "どういたしまして",
   "you're welcome"
  ],
  "topic": "phrase",
  "answer": "どういたしましては You're welcome. です。軽く No problem. / Sure. と返す人も多いです。"
 },
 {
  "id": "phrase_excuse_me",
  "keys": [
   "すみません",
   "excuse me",
   "呼びかけのすみません"
  ],
  "topic": "phrase",
  "answer": "すみませんは Excuse me. です。人を呼ぶ・前を通るときに使います。謝罪の「ごめんなさい」は I'm sorry. の方です。"
 },
 {
  "id": "phrase_sorry",
  "keys": [
   "ごめんなさい",
   "i'm sorry",
   "謝る言い方"
  ],
  "topic": "phrase",
  "answer": "ごめんなさいは I'm sorry. です。遅刻なら I'm sorry I'm late. 本当に申し訳ないときは I'm so sorry. と強めます。"
 },
 {
  "id": "phrase_its_ok",
  "keys": [
   "大丈夫",
   "it's ok",
   "平気です"
  ],
  "topic": "phrase",
  "answer": "大丈夫は It's OK. / I'm OK. です。相手を安心させるなら Don't worry.（心配しないで）も使えます。"
 },
 {
  "id": "phrase_please",
  "keys": [
   "お願いします",
   "please",
   "くださいの丁寧"
  ],
  "topic": "phrase",
  "answer": "お願いしますは Please. を文の最後につけます。例: Water, please. 依頼文 Could you 〜, please? は、さらに丁寧です。"
 },
 {
  "id": "phrase_here_you_are",
  "keys": [
   "はいどうぞ",
   "here you are",
   "物を渡す"
  ],
  "topic": "phrase",
  "answer": "物を渡すときの「はい、どうぞ」は Here you are. です。Here it is. は探し物が見つかったときの言い方です。"
 },
 {
  "id": "phrase_cheers",
  "keys": [
   "乾杯",
   "cheers",
   "乾杯は英語で"
  ],
  "topic": "phrase",
  "answer": "乾杯は Cheers! です。……イギリスでは「ありがとう」の軽い言い方にもなります。"
 },
 {
  "id": "phrase_how_much",
  "keys": [
   "いくらですか",
   "how much is it",
   "値段を聞く"
  ],
  "topic": "phrase",
  "answer": "いくらですかは How much is it? です。複数の物なら How much are they? になります。"
 },
 {
  "id": "phrase_just_looking",
  "keys": [
   "見ているだけ",
   "just looking",
   "店での返事"
  ],
  "topic": "phrase",
  "answer": "店員への「見ているだけです」は I'm just looking. です。Thank you を添えると角が立ちません。"
 },
 {
  "id": "phrase_try_on",
  "keys": [
   "試着",
   "試着できますか",
   "can i try"
  ],
  "topic": "phrase",
  "answer": "試着できますかは Can I try it on? です。試着室は fitting room と言います。"
 },
 {
  "id": "phrase_discount",
  "keys": [
   "安くなりますか",
   "discount",
   "値引き"
  ],
  "topic": "phrase",
  "answer": "値引きを聞くなら Can you give me a discount? です。直球の表現なので、笑顔とセットでどうぞ。"
 },
 {
  "id": "phrase_bag_please",
  "keys": [
   "袋ください",
   "a bag please",
   "買い物の袋"
  ],
  "topic": "phrase",
  "answer": "袋くださいは A bag, please. です。不要なら No bag, thank you. と言えます。"
 },
 {
  "id": "phrase_take_cards",
  "keys": [
   "カード使えますか",
   "do you take cards",
   "支払い方法"
  ],
  "topic": "phrase",
  "answer": "カード使えますかは Do you take credit cards? です。現金のみなら Cash only と表示されます。"
 },
 {
  "id": "phrase_where_is",
  "keys": [
   "どこですか",
   "where is",
   "場所を聞く"
  ],
  "topic": "phrase",
  "answer": "〜はどこですかは Where is 〜? です。例: Where is the station? 複数形なら Where are 〜? になります。"
 },
 {
  "id": "phrase_go_straight",
  "keys": [
   "まっすぐ",
   "go straight",
   "道案内のまっすぐ"
  ],
  "topic": "phrase",
  "answer": "まっすぐ進んで、は Go straight. です。距離を添えるなら Go straight for two blocks.（2ブロック先まで）のように言います。"
 },
 {
  "id": "phrase_turn_right",
  "keys": [
   "右に曲がる",
   "turn right"
  ],
  "topic": "phrase",
  "answer": "右に曲がって、は Turn right. です。角で、なら at the corner をつけます。"
 },
 {
  "id": "phrase_turn_left",
  "keys": [
   "左に曲がる",
   "turn left"
  ],
  "topic": "phrase",
  "answer": "左に曲がって、は Turn left. です。信号で、なら at the traffic light です。"
 },
 {
  "id": "phrase_is_it_far",
  "keys": [
   "遠いですか",
   "is it far",
   "距離を聞く"
  ],
  "topic": "phrase",
  "answer": "遠いですかは Is it far from here? です。歩いて行けるかは Can I walk there? と聞けます。"
 },
 {
  "id": "phrase_does_train_go",
  "keys": [
   "この電車は行きますか",
   "does this train go",
   "電車の確認"
  ],
  "topic": "phrase",
  "answer": "この電車は〜に行きますかは Does this train go to 〜? です。例: Does this train go to Kyoto?"
 },
 {
  "id": "phrase_delicious",
  "keys": [
   "美味しい",
   "it's delicious",
   "おいしいは英語で"
  ],
  "topic": "phrase",
  "answer": "美味しいは It's delicious. / It's good. です。とても、なら It's really good. が自然です。"
 },
 {
  "id": "phrase_im_full",
  "keys": [
   "お腹いっぱい",
   "i'm full",
   "満腹"
  ],
  "topic": "phrase",
  "answer": "お腹いっぱいは I'm full. です。これ以上食べられない、の響きがあります。"
 },
 {
  "id": "phrase_check_please",
  "keys": [
   "お会計",
   "check please",
   "会計お願いします"
  ],
  "topic": "phrase",
  "answer": "お会計お願いしますは Check, please. です。イギリスでは Bill, please. と言います。"
 },
 {
  "id": "phrase_water_please",
  "keys": [
   "水ください",
   "water please",
   "注文の仕方"
  ],
  "topic": "phrase",
  "answer": "水くださいは Water, please. / Can I have some water? です。レストランでは後者が丁寧です。"
 },
 {
  "id": "phrase_i_see",
  "keys": [
   "分かりました",
   "i see",
   "なるほど"
  ],
  "topic": "phrase",
  "answer": "なるほど・分かりましたは I see. です。了解の OK. / Got it. より、理解した感じが出ます。"
 },
 {
  "id": "phrase_i_dont_know",
  "keys": [
   "分かりません",
   "i don't know",
   "知らないとき"
  ],
  "topic": "phrase",
  "answer": "分かりませんは I don't know. です。……私も、知らないことはそう答えます。それが正直というものです。"
 },
 {
  "id": "phrase_say_again",
  "keys": [
   "もう一度言って",
   "say it again",
   "聞き返す"
  ],
  "topic": "phrase",
  "answer": "もう一度言ってくださいは Could you say that again? です。ゆっくりなら More slowly, please. を添えます。"
 },
 {
  "id": "phrase_good_luck",
  "keys": [
   "頑張って",
   "good luck",
   "応援の言い方"
  ],
  "topic": "phrase",
  "answer": "頑張っては Good luck! です。場面によっては You can do it!（できるよ）の方が応援らしくなります。……応援しています。"
 },
 {
  "id": "phrase_take_care",
  "keys": [
   "気をつけて",
   "take care",
   "お大事にと気をつけて"
  ],
  "topic": "phrase",
  "answer": "気をつけては Take care. です。別れの挨拶にもなります。病気の人へは Get well soon.（お大事に）です。"
 },
 {
  "id": "phrase_leave_it",
  "keys": [
   "任せて",
   "leave it to me",
   "まかせて"
  ],
  "topic": "phrase",
  "answer": "任せては Leave it to me. です。……その言葉、私の担当範囲です。"
 },
 {
  "id": "phrase_really",
  "keys": [
   "本当ですか",
   "really",
   "驚きの返事"
  ],
  "topic": "phrase",
  "answer": "本当？は Really? です。上がり調子で驚き、下がり調子だと疑いの響きになります。"
 },
 {
  "id": "phrase_itadakimasu",
  "keys": [
   "いただきます",
   "いただきますは英語で"
  ],
  "topic": "phrase",
  "answer": "「いただきます」に直訳はありません。食事を始めるなら Let's eat. が近いです。感謝を言う文化の違い、ですね。"
 },
 {
  "id": "phrase_otsukare",
  "keys": [
   "お疲れさま",
   "お疲れ様は英語で"
  ],
  "topic": "phrase",
  "answer": "「お疲れさま」も直訳はありません。帰り際なら You must be tired. や、お礼なら Thank you for your hard work. が近いです。"
 },
 {
  "id": "wasei_mansion",
  "keys": [
   "マンション",
   "マンションは英語",
   "mansionの意味"
  ],
  "topic": "wasei",
  "answer": "マンションは和製英語です。英語の mansion は「大邸宅」の意味。集合住宅は apartment / condominium と言います。……通じない筆頭です、ここは押さえてください。"
 },
 {
  "id": "wasei_consent",
  "keys": [
   "コンセント",
   "コンセントは英語",
   "outlet"
  ],
  "topic": "wasei",
  "answer": "コンセントは英語では outlet / socket です。consent は「同意」という全く別の語です。"
 },
 {
  "id": "wasei_note_pc",
  "keys": [
   "ノートパソコン",
   "ノートパソコンは英語",
   "laptop"
  ],
  "topic": "wasei",
  "answer": "ノートパソコンは英語では laptop です。notebook は「ノート（帳面）」の意味になります。"
 },
 {
  "id": "wasei_salaryman",
  "keys": [
   "サラリーマン",
   "サラリーマンは英語",
   "office worker"
  ],
  "topic": "wasei",
  "answer": "サラリーマンは和製英語です。英語では office worker / company employee と言います。salaryman と言うと、海外では「日本の会社員」の借用語として通じる場合もあります。"
 },
 {
  "id": "wasei_stapler",
  "keys": [
   "ホチキス",
   "ホチキスは英語",
   "stapler"
  ],
  "topic": "wasei",
  "answer": "ホチキスは英語では stapler です。Hotchkiss はメーカー名が由来です。"
 },
 {
  "id": "wasei_sharp_pen",
  "keys": [
   "シャープペンシル",
   "シャーペン",
   "mechanical pencil"
  ],
  "topic": "wasei",
  "answer": "シャープペンシルは和製英語で、英語では mechanical pencil です。sharp pencil だと「尖った鉛筆」になります。"
 },
 {
  "id": "wasei_fried_potato",
  "keys": [
   "フライドポテト",
   "フライドポテトは英語",
   "french fries"
  ],
  "topic": "wasei",
  "answer": "フライドポテトはアメリカでは French fries、イギリスでは chips です。fried potato でも意味は通じますが、店のメニューにはまず載っていません。"
 },
 {
  "id": "wasei_soft_cream",
  "keys": [
   "ソフトクリーム",
   "ソフトクリームは英語",
   "soft serve"
  ],
  "topic": "wasei",
  "answer": "ソフトクリームは英語では soft serve（ice cream）です。soft cream は通じません。"
 },
 {
  "id": "wasei_gas_station",
  "keys": [
   "ガソリンスタンド",
   "ガソリンスタンドは英語",
   "gas station"
  ],
  "topic": "wasei",
  "answer": "ガソリンスタンドは英語では gas station です。stand だけでは給油所になりません。"
 },
 {
  "id": "wasei_bike",
  "keys": [
   "バイク",
   "バイクは英語",
   "motorcycle"
  ],
  "topic": "wasei",
  "answer": "日本語のバイクは英語の bike だと「自転車」に聞こえます。オートバイは motorcycle です。……逆も然り、です。"
 },
 {
  "id": "wasei_department",
  "keys": [
   "デパート",
   "デパートは英語",
   "department store"
  ],
  "topic": "wasei",
  "answer": "デパートは department store の略の和製用法です。英語で department だけだと「部門・売り場」です。"
 },
 {
  "id": "wasei_onepiece",
  "keys": [
   "ワンピース",
   "ワンピースは英語",
   "dress"
  ],
  "topic": "wasei",
  "answer": "服のワンピースは英語では dress です。one-piece は水着などの「一体型」を指す形容詞として使われます。"
 },
 {
  "id": "wasei_reform",
  "keys": [
   "リフォーム",
   "リフォームは英語",
   "renovation"
  ],
  "topic": "wasei",
  "answer": "家のリフォームは英語では renovation / remodeling です。reform は「制度の改革」の意味です。"
 },
 {
  "id": "wasei_free_size",
  "keys": [
   "フリーサイズ",
   "フリーサイズは英語",
   "one size"
  ],
  "topic": "wasei",
  "answer": "フリーサイズは英語では one size（fits all）です。free size とは言いません。"
 },
 {
  "id": "wasei_claim",
  "keys": [
   "クレーム",
   "クレームは英語",
   "complaint"
  ],
  "topic": "wasei",
  "answer": "文句のクレームは英語では complaint です。claim は「請求・主張」の意味で、苦情にはなりません。"
 },
 {
  "id": "wasei_handle",
  "keys": [
   "ハンドル",
   "ハンドルは英語",
   "steering wheel"
  ],
  "topic": "wasei",
  "answer": "車のハンドルは英語では steering wheel です。handle は「取っ手」のことです。"
 },
 {
  "id": "wasei_front",
  "keys": [
   "フロント",
   "ホテルのフロント",
   "front desk"
  ],
  "topic": "wasei",
  "answer": "ホテルのフロントは英語では front desk / reception です。front だけでは「前」という意味です。"
 }
];

// 正規化: 小文字化し、空白と読点を除去する
function norm(s) {
  return String(s ?? "").toLowerCase().replace(/[\s　、。・!！?？]/g, "");
}

// キーの出現頻度（文書頻度）。汎用キーの重みを下げる
const KEY_FREQ = new Map();
for (const e of KNOWLEDGE_ENGLISH) {
  for (const k of new Set(e.keys.map(norm))) {
    if (k) KEY_FREQ.set(k, (KEY_FREQ.get(k) || 0) + 1);
  }
}

export function lookupEnglish(text) {
  const t = norm(text);
  if (!t) return null;
  let best = null, bestScore = 0;
  for (const e of KNOWLEDGE_ENGLISH) {
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

export function countEnglish() {
  return KNOWLEDGE_ENGLISH.length;
}
