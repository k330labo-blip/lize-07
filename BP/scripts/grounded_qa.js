// grounded_qa.js — リゼ (LIZE-07) 実況QA層（グラウンデッド質問応答）
// ゲームの実状態に基づく質問に、ctx（buildContext の形）の実値だけで答える。
// 推測で答えない: 必要な数値が ctx に無ければ「分かりません」系で正直に返す。
// 質問と判定できない文には null を返し、既存のチャット反応層に譲る。
// 純粋JS: @minecraft/server に依存しない。optional chaining 必須、例外を出さない。
//
// 口調: LIZE_SETTING.md 準拠 — 一人称「私」、相手は「あなた」、短い敬語、皮肉は真顔。
//
// 統合側への申し送り（あると答えが精密になる任意フィールド）:
//   ctx.x.timeOfDay : ゲーム内時刻 tick (0-24000)。無い場合は env の朝/昼/夕/夜で定性的に答える
//   ctx.x.items     : 品目別所持数。{typeId: 個数} の Map か [{typeId, amount}] 配列
//   ctx.x.homePos   : 拠点の座標 {x,y,z}。無い場合は距離だけで答える
//   ctx.x.worldDay  : ワールド通算の日数。無い場合は「一緒になって◯日目」で答える

// ---------------- 小物 ----------------
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const UNKNOWN_LINES = [
  "分かりません。今の私のセンサーでは、そこまでは届きません",
  "分かりません。記録にありません",
  "すみません、それは分かりません。推測で答えるのは、私の仕事ではありません",
];
function unknown(text) {
  return UNKNOWN_LINES[Math.abs((text || "").length) % UNKNOWN_LINES.length];
}
const blocks = (d) => `約${Math.max(0, Math.round(d))}ブロック`;

const BIOME_JP = { plains: "平原", desert: "砂漠", snow: "雪原", jungle: "ジャングル", ocean: "海洋", cave: "洞窟", mountain: "山岳", swamp: "沼地", savanna: "サバンナ", taiga: "タイガ", forest: "森林", mushroom: "キノコ島" };
const DIM_JP = { overworld: "オーバーワールド", nether: "ネザー", end: "ジ・エンド" };
const MODE_JP = { follow: "追従モード", stay: "待機モード", work: "作業モード", free: "おまかせモード" };

// ---------------- 時刻換算 ----------------
// 24000 tick = 1日 = 現実20分。1 tick = 0.05秒。tick 0 = 朝6:00。
function gameClock(tod) {
  const t = ((tod % 24000) + 24000) % 24000;
  const dayMin = (t + 6000) % 24000; // 0 = 0:00
  const hour = Math.floor(dayMin / 1000);
  const min = Math.floor((dayMin % 1000) / 1000 * 60);
  const phase = t < 1000 ? "朝" : t < 6000 ? "午前" : t < 11000 ? "午後" : t < 13000 ? "夕方" : t < 18000 ? "夜" : t < 23000 ? "深夜" : "夜明け前";
  return { t, hour, min, phase };
}
function realSpan(ticks) {
  const sec = Math.max(0, Math.round(ticks * 0.05));
  if (sec < 60) return `約${sec}秒`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s >= 15 ? `約${m}分${Math.round(s / 10) * 10}秒` : `約${m}分`;
}
function phaseFromEnv(env) {
  if (!env) return null;
  if (typeof env.isDawn !== "boolean" && typeof env.isDusk !== "boolean" && typeof env.isNight !== "boolean") return null; // PENDING-ENV-UNKNOWN-RAINEND-01: 時刻が全て未観測なら「昼」と断定しない
  if (env.isDawn) return "明け方";
  if (env.isDusk) return "夕方";
  if (env.isNight) return "夜";
  return "昼";
}

// ---------------- 鉱石帯 ----------------
function oreBand(y, dimName) {
  if (dimName === "end") return "ここはエンドです。鉱石というものは、ありません";
  if (dimName === "nether") return "ネザーでは、石英と金が採れます。古代の残骸は、Y15前後が狙い目です";
  if (y >= 100) return "山岳の高い層です。エメラルドが出ることがあります";
  if (y >= 64) return "地表に近い層です。掘るより、歩いたほうが早い高さです";
  if (y >= 32) return "石炭と鉄の層です";
  if (y >= 0) return "鉄・金・ラピスの層です";
  if (y >= -32) return "鉄とレッドストーンの層です。ダイヤも出始めます";
  if (y >= -53) return "ダイヤの層です";
  return "ダイヤが最も出やすい層です。岩盤も近いので、足元に注意してください";
}

// ---------------- 品目解決 ----------------
// 集計フィールドから数えられる品目（ctx.x.items があればそちらが正）
const AGGREGATE_ITEMS = [
  { names: ["食料", "食べ物", "ごはん", "ご飯", "飯", "パン"], label: "食料", get: (c) => (isNum(c.inv?.foodCount) ? c.inv.foodCount : null) },
  { names: ["松明", "たいまつ", "トーチ"], label: "松明", get: (c) => (isNum(c.x?.torchCount) ? c.x.torchCount : null) },
  { names: ["原木", "木材", "木"], label: "原木", get: (c) => (isNum(c.x?.woodCount) ? c.x.woodCount : null) },
  { names: ["丸石", "石", "石材"], label: "丸石・石", get: (c) => (isNum(c.x?.stoneCount) ? c.x.stoneCount : null) },
  { names: ["貴重品", "お宝", "宝物"], label: "貴重品", get: (c) => (isNum(c.inv?.valuableCount) ? c.inv.valuableCount : null) },
];
const TYPE_ITEMS = {
  "ダイヤ": "minecraft:diamond", "ダイヤモンド": "minecraft:diamond",
  "エメラルド": "minecraft:emerald", "鉄インゴット": "minecraft:iron_ingot",
  "金インゴット": "minecraft:gold_ingot", "石炭": "minecraft:coal",
  "レッドストーン": "minecraft:redstone", "ラピスラズリ": "minecraft:lapis_lazuli",
  "ネザライト": "minecraft:netherite_ingot", "ネザライトインゴット": "minecraft:netherite_ingot",
  "トーテム": "minecraft:totem_of_undying", "不死のトーテム": "minecraft:totem_of_undying",
  "エリトラ": "minecraft:elytra",
};
function itemsCount(items, typeId) {
  if (!items) return null;
  if (Array.isArray(items)) {
    let n = 0, found = false;
    for (const it of items) if (it && it.typeId === typeId && isNum(it.amount)) { n += it.amount; found = true; }
    return found ? n : 0;
  }
  if (typeof items === "object") {
    if (items instanceof Map) return isNum(items.get(typeId)) ? items.get(typeId) : 0;
    return isNum(items[typeId]) ? items[typeId] : 0;
  }
  return null;
}

// ---------------- ハンドラ ----------------
// match(text) が真を返したものだけが claim する。answer は実値のみで組み立てる。
const H = [];
function def(id, match, answer) { H.push({ id, match, answer }); }
const has = (re) => (t) => re.test(t);
// 横取り防止用の汎用除外（他層＝計算ツール／知識tip／雑談が正しい質問の形）
// 確率・期待値・出現率の計算質問（分数表記・パーセント表記を含む）
const RE_CALC_QUESTION = /(確率|期待値|出現率|ドロップ率|排出率)|\d+\/\d+|\d+(?:%|％)/;
// 作成方法の質問（作り方／何で作る／レシピ／材料など）
const RE_CRAFT_QUESTION = /(作り方|何で作る|どうやって作|作るには|作る方法|作る|作れ|レシピ|材料|クラフト)/;
// 使用時の効果・違いを問う知識質問
const RE_USE_OR_DIFF_QUESTION = /(使うと|使ったら|使用すると|使えば|どうなる|何が違う|違い|違うの|違うか|違う\?|比べ|比較)/;
// おすすめ・最適を問う知識質問
const RE_RECOMMEND_QUESTION = /(おすすめ|推奨|最適|ベスト|狙い目|どの[^。]{0,8}がいい|何がいい|がいい|いいの(？|\?|$)|良いの(？|\?|$))/;
// 方法・やり方を問う知識質問（集め方／治療／どうやる等）
const RE_METHOD_QUESTION = /(集め方|集める方法|稼ぎ方|増やし方|上げ方|入手方法|手に入れ方|方を教えて|方法|やり方|どうや(る|って)|治療|治し方)/;

// --- 季節（マイクラに無いものは、正直に無いと言う） ---
def("season",
  has(/季節|今は(春|夏|秋|冬)|春ですか|夏ですか|秋ですか|冬ですか/),
  (c) => {
    const b = c.x?.biome;
    const extra = b === "snow" ? "雪原にいるので冬めいて見えますが、あれは場所の性質です。" : "";
    return `この世界に、季節はありません。あるのは昼と夜と、天候だけです。${extra}`;
  });

// --- あとどれくらいで朝/夜 ---
def("time_until",
  (t) => /あと/.test(t) && /(朝|夜|夜明け|日が暮|暗く)/.test(t) || /朝まで|夜まで|夜明けまで/.test(t),
  (c, t) => {
    const tod = c.x?.timeOfDay;
    const toNight = /夜|暗く|日が暮/.test(t) && !/夜明け/.test(t);
    if (!isNum(tod)) {
      const ph = phaseFromEnv(c.env);
      if (!ph) return unknown(t);
      if (toNight) return ph === "夜" || ph === "深夜" ? "もう夜です" : `${ph}です。正確にあと何分で夜かは、今の私では分かりません`;
      return ph === "朝" || ph === "昼" ? "もう朝です" : `${ph}です。正確にあと何分で朝かは、今の私では分かりません`;
    }
    const { t: tt } = gameClock(tod);
    const target = toNight ? 13000 : 24000;
    const delta = (target - tt + 24000) % 24000;
    if (delta === 0 || (toNight && tt >= 13000 && tt < 23000)) return toNight ? "もう夜です" : "もう朝です";
    return `${toNight ? "夜" : "朝"}まで、あと${realSpan(delta)}です`;
  });

// --- 今何時 ---
def("time_now",
  has(/何時(?!間)|今の時間|時刻|時間は(？|\?|$)|何時ごろ/),
  (c, t) => {
    const tod = c.x?.timeOfDay;
    if (isNum(tod)) {
      const g = gameClock(tod);
      let tail = "";
      if (g.t >= 13000) tail = `朝まで、あと${realSpan((24000 - g.t) % 24000)}です。`;
      else if (g.t >= 11000) tail = "日が沈みかけています。";
      else tail = `夜まで、あと${realSpan(13000 - g.t)}です。`;
      return `ゲーム内では${g.hour}時${String(g.min).padStart(2, "0")}分ごろ、${g.phase}です。${tail}`;
    }
    const ph = phaseFromEnv(c.env);
    if (!ph) return unknown(t);
    return `今は${ph}です。正確な時刻は分かりませんが、${ph === "夜" ? "モンスターの出る時間帯です" : ph === "夕方" ? "そろそろ夜になります" : "活動には問題ない時間帯です"}`;
  });

// --- セッション時間 ---
def("session_time",
  has(/何時間.*(プレイ|やっ|経)|プレイ時間|今回.*どれくらい(やっ|経)/),
  (c, t) => {
    const m = c.x?.sessionMin;
    if (!isNum(m)) return unknown(t);
    if (m < 60) return `今回のセッションは、約${Math.round(m)}分です`;
    return `今回のセッションは、約${Math.floor(m / 60)}時間${Math.round(m % 60)}分です`;
  });

// --- 天気 ---
def("weather",
  has(/天気|雨.*(降|ふ)|晴れ|雷.*(鳴|落|雨)/),
  (c, t) => {
    const dimName = c.x?.dimension;
    if (dimName === "nether") return "ネザーに天気はありません。降るのは、灰と火の粉です";
    if (dimName === "end") return "エンドに天気はありません。ずっと、静かな闇です";
    if (!c.env) return unknown(t);
    if (c.env.isThundering) return "雷雨です。雷が落ちます。高い場所は避けてください";
    if (c.env.isRaining) return c.x?.biome === "snow" ? "雪が降っています" : "雨が降っています";
    if (typeof c.env.isRaining !== "boolean" || typeof c.env.isThundering !== "boolean") return unknown(t); // PENDING-ENV-UNKNOWN-RAINEND-01: 天気が測れていない時に晴れと断定しない
    return "晴れています";
  });

// --- 拠点までの距離 ---
def("home_distance",
  // 「何ブロック」は座標計算ツール側の領分なので claim しない（遠い？／どれくらい？は維持）
  (t) => !/何ブロック/.test(t) && /拠点.*遠|家まで.*(遠|どれくらい)|拠点まで(遠|どれくらい)/.test(t),
  (c, t) => {
    if (!c.home?.registered) return "拠点は、まだ登録がありません。……帰る場所は、未登録のままです";
    if (!isNum(c.home.dist) || c.home.dist >= 900) return unknown(t);
    return `拠点までは、${blocks(c.home.dist)}です`;
  });

// --- 拠点はどこ ---
def("home_where",
  has(/拠点はどこ|拠点の場所|拠点の座標|家の座標|家はどこ|帰る場所はどこ|ベースはどこ|拠点.*教えて/),
  (c, t) => {
    if (!c.home?.registered) return "拠点は、まだ登録がありません。私の帰る場所は、未登録です。……定位置は、あなたの隣で代用しています";
    const hp = c.x?.homePos;
    const distPart = isNum(c.home.dist) && c.home.dist < 900 ? `ここから${blocks(c.home.dist)}のところです` : "";
    if (hp && isNum(hp.x)) return `拠点は、X${Math.floor(hp.x)} Y${Math.floor(hp.y)} Z${Math.floor(hp.z)} です。${distPart}`;
    return `拠点は登録してあります。${distPart || "距離は今は分かりません"}。正確な座標は、今の私の記録にはありません`;
  });

// --- 拠点の登録状態 ---
def("home_registered",
  has(/拠点.*(登録|ある？|あるか)|帰る場所.*(ある|登録)/),
  (c, t) => {
    if (!c.home?.registered) return "登録はありません。チェストのそばで登録してもらえると、私にも帰る場所ができます";
    let s = "拠点は登録してあります";
    if (c.home.chestMissing) s += "。ただし、入庫先のチェストが見つかりません。壊れたか、移されたかです";
    else if (c.home.chestFull) s += "。チェストは満杯です。これ以上は預かれません";
    return s;
  });

// --- ボス ---
def("enemy_boss",
  has(/ボス.*(いる|近い|来)|強い敵.*(いる|近い)/),
  (c, t) => {
    if (c.x?.bossNear) {
      const hp = isNum(c.x.bossHpPct) ? `体力は残り約${Math.round(c.x.bossHpPct * 100)}%です` : "";
      return `います。ボス級の反応が、近くにあります。${hp}`;
    }
    if (!c.danger) return unknown(t);
    return "ボス級の反応は、今のところ確認できません";
  });

// --- 近くに敵 ---
def("enemy_near",
  has(/敵.*(いる|近い|来て)|モンスター.*(いる|近い)|近く.*敵|敵.*何体/),
  (c, t) => {
    const d = c.danger;
    if (!d || !isNum(d.count)) return unknown(t);
    if (d.count === 0) return "いません。今の走査では、敵は確認できません";
    let s = `${d.count}体います`;
    if (isNum(d.nearestDist) && d.nearestDist < 900) s += `。最寄りは${blocks(d.nearestDist)}先です`;
    if (isNum(d.creeperDist) && d.creeperDist < 900) s += `。クリーパーは${blocks(d.creeperDist)}先です`;
    if (isNum(d.rangedDist) && d.rangedDist < 900) s += `。射手の類は${blocks(d.rangedDist)}先です`;
    return s;
  });

// --- 危険度 ---
def("danger_level",
  has(/危険度|危険？|危険か|安全(？|\?|か|ですか)|危な(い|くない)/),
  (c, t) => {
    const d = c.danger;
    if (!d || !isNum(d.count)) return unknown(t);
    let s;
    if (c.x?.bossNear) s = "危険度は最大です。ボス級が近くにいます";
    else if (d.count === 0) s = "周囲に敵は確認できません。今のところ、安全です";
    else if (isNum(d.nearestDist) && d.nearestDist < 5) s = `危険です。敵が${d.count}体、目と鼻の先まで来ています`;
    else if (isNum(d.nearestDist) && d.nearestDist < 10) s = `注意してください。敵が${d.count}体、最寄り${blocks(d.nearestDist)}まで来ています`;
    else s = `敵は${d.count}体いますが、まだ距離があります。今のところ大丈夫です`;
    if (d.lavaNear) s += "。足元に溶岩があります。そちらも注意してください";
    if (c.x?.knownDanger) s += "。ここは以前、危険があった場所です";
    return s;
  });

// --- 溶岩 ---
def("lava_near",
  has(/溶岩|マグマ.*(近く|ある|危な)/),
  (c, t) => {
    if (!c.danger || typeof c.danger.lavaNear !== "boolean") return unknown(t);
    return c.danger.lavaNear ? "あります。足元のすぐ下に溶岩があります。掘るなら、真下はやめてください" : "近くに溶岩は確認できません";
  });

// --- ここで何が掘れる（鉱石帯） ---
def("depth_ore",
  has(/ここ.*(掘れる|掘る|鉱石)|何が掘れる|鉱石.*(ある|出る|採れる)/),
  (c, t) => {
    const y = isNum(c.x?.ownerY) ? c.x.ownerY : isNum(c.x?.selfPos?.y) ? c.x.selfPos.y : null;
    if (y === null && c.x?.dimension === "overworld") return unknown(t);
    return oreBand(y ?? 64, c.x?.dimension || "overworld");
  });

// --- 深さ ---
def("depth",
  // おすすめ／最適の高さを問う知識質問は claim しない（今の深さ・高さの実況は維持）
  (t) => !RE_RECOMMEND_QUESTION.test(t) && /深さ|どのくらい深|今の高さ|高度|Y座標|ワイ座標/.test(t),
  (c, t) => {
    const y = isNum(c.x?.ownerY) ? c.x.ownerY : isNum(c.x?.selfPos?.y) ? c.x.selfPos.y : null;
    if (y === null) return unknown(t);
    const who = isNum(c.x?.ownerY) ? "あなた" : "私";
    return `${who}の今の高さは、Y${Math.floor(y)}です。${oreBand(y, c.x?.dimension || "overworld")}`;
  });

// --- 明るさ ---
def("brightness",
  has(/明るさ|明るい|暗い|暗さ|光量/),
  (c, t) => {
    const lv = c.x?.lightLevel;
    if (!isNum(lv)) return unknown(t);
    const judge = lv <= 4 ? "真っ暗です。敵が湧く明るさです" : lv <= 7 ? "暗いです。敵が湧いてもおかしくありません" : lv <= 11 ? "薄暗いですが、湧きは抑えられています" : "明るいです。湧きの心配はありません";
    return `明るさは、目安で${Math.round(lv)}です。${judge}`;
  });

// --- バイオーム ---
def("biome",
  has(/バイオーム/),
  (c, t) => {
    const b = c.x?.biome;
    if (!b) return unknown(t);
    return `今いるのは、${BIOME_JP[b] || b}です`;
  });

// --- 次元 ---
def("dimension",
  has(/次元|ディメンション|何の世界/),
  (c, t) => {
    const d = c.x?.dimension;
    if (!d) return unknown(t);
    return `ここは${DIM_JP[d] || d}です`;
  });

// --- ここはどこ ---
def("location",
  has(/ここはどこ|現在地|今どこ|どこにいる|リゼはどこ|場所は(？|\?|どこ)/),
  (c, t) => {
    const p = c.x?.selfPos;
    const parts = [];
    if (c.x?.dimension) parts.push(DIM_JP[c.x.dimension] || c.x.dimension);
    if (c.x?.biome) parts.push(BIOME_JP[c.x.biome] || c.x.biome);
    if (p && isNum(p.x)) parts.push(`座標は X${Math.floor(p.x)} Y${Math.floor(p.y)} Z${Math.floor(p.z)}`);
    if (!parts.length) return unknown(t);
    if (c.owner?.underground) parts.push("地下にいます");
    if (c.x?.nearVillage) parts.push("村が近くにあります");
    return `${parts.join("、")}です`;
  });

// --- 座標 ---
def("coordinates",
  // おすすめの高さ等を問う知識質問（例: 鉱石のY座標はどの高さがいいか）は claim しない
  (t) => !RE_RECOMMEND_QUESTION.test(t) && /座標/.test(t),
  (c, t) => {
    const p = c.x?.selfPos;
    if (!p || !isNum(p.x)) return unknown(t);
    return `私の座標は、X${Math.floor(p.x)} Y${Math.floor(p.y)} Z${Math.floor(p.z)} です。あなたの隣が定位置なので、ほぼあなたの座標でもあります`;
  });

// --- 主人のHP ---
def("owner_hp",
  (t) => /(私|俺|自分|こっち)の?(体力|HP|ヒットポイント)/.test(t) || /^(体力|HP|ＨＰ)(は|どう|大丈夫)/.test(t) || (/(体力|HP)(は|どう)(？|\?|$)/.test(t) && !/(リゼ|君|お前|そっち)の?(体力|HP)/.test(t)),
  (c, t) => {
    if (!c.owner?.present) return "分かりません。あなたが近くにいないので、測れません";
    const pct = c.owner.hpPct;
    if (!isNum(pct)) return unknown(t);
    const hp = Math.round(pct * 20);
    const judge = pct >= 0.8 ? "十分にあります" : pct >= 0.5 ? "半分ほど残っています" : pct >= 0.25 ? "少なくなっています" : "危険な少なさです。回復してください";
    return `あなたの体力は、20のうち${hp}です。${judge}`;
  });

// --- 主人の空腹 ---
def("owner_hunger",
  has(/お腹|空腹|満腹|腹.*(減っ|へっ)/),
  (c, t) => {
    if (!c.owner?.present) return "分かりません。あなたが近くにいないので、測れません";
    const h = c.owner.hunger;
    if (!isNum(h)) return unknown(t);
    const judge = h >= 18 ? "十分にあります。走れます" : h >= 12 ? "まだ余裕があります" : h >= 7 ? "減ってきています" : "かなり減っています。走れなくなる前に、何か食べてください";
    return `あなたの満腹度は、20のうち${Math.round(h)}です。${judge}`;
  });

// --- 主人のレベル ---
def("owner_level",
  // 集め方・稼ぎ方などの方法を問う知識質問は claim しない（今のレベル実況は維持）
  (t) => !RE_METHOD_QUESTION.test(t) && /レベル|経験値/.test(t),
  (c, t) => {
    const lv = c.x?.ownerLevel;
    if (!isNum(lv)) return unknown(t);
    return `あなたのレベルは、${Math.floor(lv)}です`;
  });

// --- リゼのHP ---
def("self_hp",
  has(/(リゼ|君|お前|そっち|あなた自身)の?(体力|HP|ヒットポイント)|リゼ.*(元気|大丈夫|無事)/),
  (c, t) => {
    const pct = c.self?.hpPct;
    if (!isNum(pct)) return unknown(t);
    const abs = Math.round(pct * 60);
    const judge = pct >= 0.8 ? "良好です" : pct >= 0.5 ? "まだ持ちます" : pct >= 0.25 ? "少なくなっています" : "危険です。回復か、退避が要ります";
    return `私の耐久は、60のうち${abs}、約${Math.round(pct * 100)}%です。${judge}`;
  });

// --- リゼの状態（モード総合） ---
def("self_mode",
  has(/何してる|何をしている|モード|今の状態|状態は(？|\?|$)|調子は/),
  (c, t) => {
    const parts = [];
    if (c.mode) parts.push(`今は${MODE_JP[c.mode] || c.mode}です`);
    if (isNum(c.self?.hpPct)) parts.push(`耐久は約${Math.round(c.self.hpPct * 100)}%`);
    if (isNum(c.inv?.used) && isNum(c.inv?.size)) parts.push(`荷物は${c.inv.size}枠のうち${c.inv.used}枠`);
    if (c.self?.stuck) parts.push("正直に言うと、今ハマっています。脱出を試みます");
    if (!parts.length) return unknown(t);
    return parts.join("。") + "です";
  });

// --- 好感度・信頼度 ---
def("self_bond",
  // 「私のこと好き？」のような雑談は claim しない。好感度／信頼度／絆の明示質問のみ。
  // 「私のことどう思う」は指標への言及として維持するが、好意そのものを問う形は譲る。
  has(/好感度|仲良し|信頼度|絆|私のこと.*どう思/),
  (c, t) => {
    const b = c.flags?.bond;
    if (!isNum(b)) return unknown(t);
    const tier = b >= 80 ? "かなり高いです。……ランプは、見なくていいです" : b >= 60 ? "高めです" : b >= 40 ? "標準的です" : b >= 20 ? "まだ低めです。これからです" : "低いです。……一緒にいる時間が、足りていません";
    let s = `好感度は、100のうち${Math.round(b)}です。${tier}`;
    if (isNum(c.flags?.trust)) s += `。信頼度は${Math.round(c.flags.trust)}です`;
    return s;
  });

// --- 品目質問（◯◯持ってる？） ---
def("item_have",
  (t) => {
    const clean = (s) => (s || "").replace(/^(ねえ|あの|そういえば)/, "").trim();
    const valid = (name) => !!name && name.length <= 10 && !/^(何|なに|なん|誰|どこ|いつ)/.test(name);
    // 「◯◯持ってる？」形式は一般に claim する（答えられない品目は正直にそう返す）
    const m1 = t.match(/(.+?)(?:を|は)?持って(?:る|ます|いる|た|ない)/);
    if (m1 && valid(clean(m1[1]))) return { name: clean(m1[1]) };
    // 「◯◯ある？」形式は誤爆しやすいので、解決可能な品目名のときだけ claim する
    const m2 = t.match(/(.+?)(?:ある|あります)(?:？|\?|か)?$/);
    if (m2) {
      const name = clean(m2[1]);
      const resolvable = name === "武器" || name === "剣" || AGGREGATE_ITEMS.some((a) => a.names.includes(name)) || !!TYPE_ITEMS[name];
      if (valid(name) && resolvable) return { name };
    }
    return null;
  },
  (c, t, m) => {
    const name = m.name;
    if (name === "武器" || name === "剣") {
      if (typeof c.inv?.hasWeapon !== "boolean") return unknown(t);
      return c.inv.hasWeapon ? "武器は持っています" : "武器は、今は持っていません";
    }
    for (const a of AGGREGATE_ITEMS) {
      if (a.names.includes(name)) {
        const n = a.get(c);
        if (n === null) return unknown(t);
        return n > 0 ? `${a.label}は、${n}個持っています` : `${a.label}は、今は持っていません`;
      }
    }
    const typeId = TYPE_ITEMS[name];
    if (typeId) {
      const n = itemsCount(c.x?.items, typeId);
      if (n !== null) return n > 0 ? `${name}は、${n}個持っています` : `${name}は、今は持っていません`;
      // 品目別に数えていない場合は、貴重品の総数だけは実値で添える
      if (isNum(c.inv?.valuableCount)) return `${name}単体の数は、私の記録では数えていません。貴重品は全部で${c.inv.valuableCount}個、持っています`;
      return `${name}単体の数は、私の記録では数えていません`;
    }
    return `『${name}』は、私の記録では確認できません。数えているのは、食料・松明・原木・石・貴重品です`;
  });

// --- 何持ってる（所持の要約） ---
def("inv_summary",
  has(/何持って|持ち物|所持品|インベントリ.*(中身|見せ|何)/),
  (c, t) => {
    const inv = c.inv;
    if (!inv || !isNum(inv.used)) return unknown(t);
    const parts = [`${inv.size}枠のうち${inv.used}枠を使っています`];
    if (isNum(inv.foodCount) && inv.foodCount > 0) parts.push(`食料${inv.foodCount}個`);
    if (isNum(inv.valuableCount) && inv.valuableCount > 0) parts.push(`貴重品${inv.valuableCount}個`);
    if (isNum(c.x?.woodCount) && c.x.woodCount > 0) parts.push(`原木${c.x.woodCount}個`);
    if (isNum(c.x?.stoneCount) && c.x.stoneCount > 0) parts.push(`丸石・石${c.x.stoneCount}個`);
    if (isNum(c.x?.torchCount) && c.x.torchCount > 0) parts.push(`松明${c.x.torchCount}本`);
    if (inv.hasWeapon) parts.push("武器あり");
    if (inv.full) parts.push("満杯です。預け先が必要です");
    else if (inv.nearFull) parts.push("そろそろ満杯です");
    return `私の荷物は、${parts.join("、")}です`;
  });

// --- 何個持ってる（量） ---
def("self_carry",
  has(/何個持って|いくつ持って|荷物.*(量|いっぱい)/),
  (c, t) => {
    const inv = c.inv;
    if (!inv || !isNum(inv.used) || !isNum(inv.size)) return unknown(t);
    return `荷物は、${inv.size}枠のうち${inv.used}枠です${inv.full ? "。満杯です" : inv.nearFull ? "。そろそろ満杯です" : ""}`;
  });

// --- 何日目 ---
def("day_count",
  has(/何日目|何日経った|今日.*日目|ワールド.*何日/),
  (c, t) => {
    if (isNum(c.x?.worldDay)) return `ワールドでは、${Math.floor(c.x.worldDay) + 1}日目です`;
    if (isNum(c.x?.daysTogether)) return `ワールドの通算日数は分かりません。ただ、私が起動してから数えると、${Math.floor(c.x.daysTogether) + 1}日目です`;
    return unknown(t);
  });

// --- どれくらい一緒にいる ---
def("together",
  has(/どれくらい一緒|何日一緒|一緒にいて|一緒にいる|付き合/),
  (c, t) => {
    const parts = [];
    if (isNum(c.x?.daysTogether)) parts.push(`一緒になって、${Math.floor(c.x.daysTogether) + 1}日目です`);
    if (isNum(c.x?.sessionMin)) parts.push(`今日のセッションでは、約${Math.round(c.x.sessionMin)}分一緒にいます`);
    if (!parts.length) return unknown(t);
    return parts.join("。");
  });

// --- 近くのドロップ ---
def("drops_near",
  // 確率／期待値／分数表記の計算質問は claim しない（近くのドロップ実況は維持）
  (t) => !RE_CALC_QUESTION.test(t) && /落ちてる|落ちている|ドロップ|地面に.*(ある|落ち)/.test(t),
  (c, t) => {
    const d = c.drops;
    if (!d || !isNum(d.count)) return unknown(t);
    if (d.count === 0) return "落ちているものは、近くにはありません";
    let s = `${d.count}件、落ちています`;
    if (isNum(d.nearestDist) && d.nearestDist >= 0) s += `。最寄りは${blocks(d.nearestDist)}先です`;
    if (isNum(d.valuableDist) && d.valuableDist >= 0) s += `。貴重品も混じっています、${blocks(d.valuableDist)}先です`;
    if (isNum(d.ownerDroppedDist) && d.ownerDroppedDist >= 0) s += "。あなたの落とし物も、近くにあります";
    return s;
  });

// --- 近くの設備 ---
def("facilities",
  // 作り方などの作成方法、使用時の効果、他との違いを問う知識質問は claim しない
  // （近くにあるかどうかの実況は維持）
  (t) => !RE_CRAFT_QUESTION.test(t) && !RE_USE_OR_DIFF_QUESTION.test(t) && /作業台|かまど|ベッド|設備|機械.*(近く|ある)/.test(t),
  (c, t) => {
    const x = c.x || {};
    const flags = [["作業台", x.nearCraft], ["かまど", x.nearFurnace], ["ベッド", x.nearBed], ["機械", x.nearMachine]];
    const known = flags.filter(([, v]) => typeof v === "boolean");
    if (!known.length) return unknown(t);
    const here = known.filter(([, v]) => v).map(([n]) => n);
    // 聞かれた設備が特定できる場合は、それを主語に答える
    const asked = flags.find(([n, v]) => typeof v === "boolean" && t.includes(n));
    if (asked) {
      const [n, v] = asked;
      if (v) return `${n}は、近くにあります`;
      const others = here.filter((o) => o !== n);
      return `${n}は、近くにありません${others.length ? `。あるのは、${others.join("と")}です` : ""}`;
    }
    return here.length ? `近くにあるのは、${here.join("と")}です` : "作業台も、かまども、近くにはありません";
  });

// --- 村 ---
def("village",
  // 治療・やり方などの方法を問う知識質問は claim しない（村・村人の近さの実況は維持）
  (t) => !RE_METHOD_QUESTION.test(t) && /村.*(近い|ある|どこ)|村人/.test(t),
  (c, t) => {
    if (typeof c.x?.nearVillage !== "boolean" && !isNum(c.x?.villagerDist)) return unknown(t);
    if (c.x?.nearVillage) return `村は近くにあります${isNum(c.x.villagerDist) && c.x.villagerDist < 900 ? `。村人は${blocks(c.x.villagerDist)}先です` : ""}`;
    return "村は、近くにはありません";
  });

// --- 作物 ---
def("crops",
  has(/作物|畑|実って|収穫でき/),
  (c, t) => {
    const x = c.x || {};
    if (typeof x.nearCrop !== "boolean" && !isNum(x.cropReadyDist)) return unknown(t);
    if (x.cropMature || (isNum(x.cropReadyDist) && x.cropReadyDist >= 0)) return `実った作物が近くにあります${isNum(x.cropReadyDist) && x.cropReadyDist >= 0 ? `。${blocks(x.cropReadyDist)}先です` : ""}。収穫しておきましょうか`;
    if (x.nearCrop) return "作物はありますが、まだ実っていません";
    return "近くに畑はありません";
  });

// --- 実績 ---
def("pickup_stats",
  has(/何個拾った|拾った数|集めた数|実績|どれくらい(拾|集め)/),
  (c, t) => {
    const x = c.x || {};
    const parts = [];
    if (isNum(x.pickupTotal)) parts.push(`回収は累計${x.pickupTotal}個`);
    if (isNum(x.deliverTotal)) parts.push(`お届けは${x.deliverTotal}個`);
    if (isNum(x.depositTotal)) parts.push(`入庫は${x.depositTotal}個`);
    if (!parts.length) return unknown(t);
    return `${parts.join("、")}です`;
  });

// --- ハマり ---
def("stuck",
  has(/ハマって|はまって|詰まって|動けて/),
  (c, t) => {
    if (typeof c.self?.stuck !== "boolean") return unknown(t);
    return c.self.stuck ? `正直に言うと、ハマっています。${isNum(c.self.stuckSec) ? `約${Math.round(c.self.stuckSec)}秒、進めていません。` : ""}脱出を試みます` : "ハマっていません。動けています";
  });

// --- 他のプレイヤー ---
def("others",
  has(/誰か.*(いる|近い)|他.*(プレイヤー|人).*(いる|近い)/),
  (c, t) => {
    const n = c.x?.othersNear;
    if (!isNum(n)) return unknown(t);
    return n > 0 ? `他のプレイヤーが${n}人、近くにいます${isNum(c.x?.otherDist) && c.x.otherDist < 900 ? `。最寄りは${blocks(c.x.otherDist)}先です` : ""}` : "近くに、他のプレイヤーはいません";
  });

// ---------------- 本体 ----------------
export const QA_CATEGORIES = H.map((h) => h.id);

export function answerQuestion(text, ctx) {
  if (typeof text !== "string" || !text) return null;
  const t = text.replace(/[\s　]+/g, "");
  const c = ctx || {};
  // x / env 等の欠落に備えた浅い補完（参照は optional chaining でも守る）
  c.x = c.x || {};
  for (const h of H) {
    let m = null;
    try { m = h.match(t); } catch { m = null; }
    if (!m) continue;
    try {
      const ans = h.answer(c, t, m === true ? null : m);
      if (typeof ans === "string" && ans) return ans;
    } catch { return unknown(t); }
  }
  return null;
}
