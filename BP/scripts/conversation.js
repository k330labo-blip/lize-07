// ============================================================
// リゼ (LIZE-07) 会話状態マネージャ — 純粋JS（@minecraft/server 非依存）
// 「単発反応」から「会話が続いている」感覚へ格上げするための層。
//
// 役割:
//  - 話題スタック（最大5件・時間減衰つき）を保持し、直近の話題を返す
//  - 最後に言及したアイテム/場所/敵を保持し、指示語（それ/あれ/その〜/
//    さっきの/続き）を実対象へ解決する
//  - 会話の流れ（質問→回答→相槌の連鎖）と、呼びかけ頻度・感情語からの
//    簡易ムードを推定する
//  - chat_followups の prev 判定に使える matchesPrev() を提供する
//    （移行案は conversation.md 参照）
//
// 使い方:
//  const conv = createConversation();
//  conv.hear("ダイヤ取れた", "found_diamond", { item: "minecraft:diamond" });
//  conv.resolveReference("それ何個目？");
//    -> { kind: "count", target: { id:"minecraft:diamond", name:"ダイヤモンド", count:1 }, ... }
//  conv.getContext(); // チャット判定へ渡す文脈
//
// 時刻は options.now（関数）で差し替え可能（テスト用）。既定は Date.now。
// ============================================================

// ---------- 辞書（本文からの対象抽出） ----------
// [表示名キーワード, 正規化id, 表示名]。長い語を先に置く（部分一致の誤爆防止）。
const ITEM_WORDS = [
  ["エンチャント本", "minecraft:enchanted_book", "エンチャント本"],
  ["ネザライトインゴット", "minecraft:netherite_ingot", "ネザライトインゴット"],
  ["ネザライト", "minecraft:netherite_ingot", "ネザライト"],
  ["ダイヤモンド", "minecraft:diamond", "ダイヤモンド"],
  ["ダイヤ", "minecraft:diamond", "ダイヤモンド"],
  ["エメラルド", "minecraft:emerald", "エメラルド"],
  ["エリトラ", "minecraft:elytra", "エリトラ"],
  ["トーテム", "minecraft:totem_of_undying", "不死のトーテム"],
  ["ツルハシ", "tool:pickaxe", "ツルハシ"],
  ["シャベル", "tool:shovel", "シャベル"],
  ["オノ", "tool:axe", "オノ"],
  ["斧", "tool:axe", "オノ"],
  ["剣", "tool:sword", "剣"],
  ["弓", "minecraft:bow", "弓"],
  ["盾", "minecraft:shield", "盾"],
  ["鉄インゴット", "minecraft:iron_ingot", "鉄インゴット"],
  ["鉄", "minecraft:iron_ingot", "鉄"],
  ["金インゴット", "minecraft:gold_ingot", "金インゴット"],
  ["金", "minecraft:gold_ingot", "金"],
  ["石炭", "minecraft:coal", "石炭"],
  ["レッドストーン", "minecraft:redstone", "レッドストーン"],
  ["ラピス", "minecraft:lapis_lazuli", "ラピスラズリ"],
  ["クォーツ", "minecraft:quartz", "クォーツ"],
  ["羊毛", "minecraft:white_wool", "羊毛"],
  ["原木", "log", "原木"],
  ["丸石", "minecraft:cobblestone", "丸石"],
  ["松明", "minecraft:torch", "松明"],
  ["パン", "minecraft:bread", "パン"],
  ["ベッド", "minecraft:bed", "ベッド"],
  ["チェスト", "minecraft:chest", "チェスト"],
  ["本", "minecraft:book", "本"],
];
const ENEMY_WORDS = [
  ["帯電クリーパー", "minecraft:creeper", "帯電クリーパー"],
  ["クリーパー", "minecraft:creeper", "クリーパー"],
  ["スケルトン", "minecraft:skeleton", "スケルトン"],
  ["エンダーマン", "minecraft:enderman", "エンダーマン"],
  ["ピリジャー", "minecraft:pillager", "ピリジャー"],
  ["ウォーデン", "minecraft:warden", "ウォーデン"],
  ["ゾンビ", "minecraft:zombie", "ゾンビ"],
  ["ウィッチ", "minecraft:witch", "ウィッチ"],
  ["スライム", "minecraft:slime", "スライム"],
  ["ガスト", "minecraft:ghast", "ガスト"],
  ["ブレイズ", "minecraft:blaze", "ブレイズ"],
  ["クモ", "minecraft:spider", "クモ"],
  ["ドラゴン", "minecraft:ender_dragon", "エンダードラゴン"],
  ["ウィザー", "minecraft:wither", "ウィザー"],
];
const PLACE_WORDS = [
  ["ネザー", "nether", "ネザー"],
  ["エンド", "end", "エンド"],
  ["洞窟", "cave", "洞窟"],
  ["廃坑", "mineshaft", "廃坑"],
  ["拠点", "home", "拠点"],
  ["村", "village", "村"],
  ["海", "ocean", "海"],
  ["砂漠", "desert", "砂漠"],
  ["雪原", "snow", "雪原"],
  ["森", "forest", "森"],
  ["山", "mountain", "山"],
  ["家", "home", "家"],
];

// 既存カテゴリid（chat_followups の prev 等）→ 暗黙の対象。
// hear(text, intentId) で intentId だけ渡された場合の補完に使う。
const INTENT_ENTITIES = {
  found_diamond: { item: { id: "minecraft:diamond", name: "ダイヤモンド" } },
  found_netherite: { item: { id: "minecraft:netherite_ingot", name: "ネザライト" } },
  found_treasure: { item: { id: "treasure", name: "お宝" } },
  opened_chest: { place: { id: "chest", name: "チェストの場所" } },
  cave_scary: { place: { id: "cave", name: "洞窟" } },
  enemy_spotted: { enemy: { id: "hostile", name: "敵" } },
  boss_defeated: { enemy: { id: "boss", name: "ボス" } },
  owner_died: { place: { id: "death_point", name: "死んだ場所" } },
  owner_lost: { place: { id: "unknown", name: "今の場所" } },
  order_go_home: { place: { id: "home", name: "拠点" } },
  rei_coffee: { item: { id: "coffee", name: "コーヒー" } },
  found_snow: { place: { id: "snow", name: "雪原" } },
};

// ---------- 発話タイプ分類（会話の流れ用） ----------
const QUESTION_HINTS = ["何", "なに", "どう", "どこ", "いつ", "だれ", "誰", "いくつ", "何個", "何本", "なぜ", "なんで", "どれ", "？", "?", "かな", "かね"];
const REACTION_WORDS = ["そっか", "そうか", "うん", "へえ", "ほう", "なるほど", "わかった", "了解", "おっけー", "オッケー", "いいね", "すごい", "やった", "まじ", "ほんと", "本当"];
const CALL_WORDS = ["リゼ", "LIZE", "lize"];
const MOOD_WORDS = {
  cheerful: ["嬉しい", "うれしい", "楽しい", "やった", "最高", "わーい"],
  tired: ["疲れた", "つかれた", "眠い", "ねむい", "しんどい", "だるい"],
  anxious: ["怖い", "こわい", "不安", "やばい", "危ない", "死にそう"],
  affectionate: ["ありがとう", "好き", "かわいい", "可愛い", "助かる", "頼りになる"],
};

function findWord(text, table) {
  for (const [word, id, name] of table) if (text.includes(word)) return { id, name, word };
  return null;
}
function classifyTurn(text) {
  const t = text || "";
  if (QUESTION_HINTS.some((w) => t.includes(w)) && (t.includes("？") || t.includes("?") || t.includes("何") || t.includes("どう") || t.includes("どこ") || t.includes("いくつ") || t.includes("何個") || t.includes("だれ") || t.includes("誰"))) return "question";
  if (REACTION_WORDS.some((w) => t.includes(w)) && t.length <= 12) return "reaction";
  if (CALL_WORDS.some((w) => t.includes(w))) return "call";
  if (/取れた|取った|見つけた|倒した|できた|着いた|帰った|死んだ|やられた/.test(t)) return "report";
  if (/して|行って|来て|掘って|集めて|作って|戻って|ついて/.test(t)) return "order";
  return "statement";
}

// ---------- 本体 ----------
export function createConversation(options = {}) {
  const nowFn = typeof options.now === "function" ? options.now : () => Date.now();
  const HALF_LIFE_MS = options.halfLifeMs ?? 120000;   // 話題の半減期（既存followup窓90秒と同オーダー）
  const STACK_MAX = 5;
  const STACK_KEEP_MS = options.keepMs ?? 15 * 60 * 1000;

  let stack = [];            // [{intent, topic, at}] 新しい順
  let lastItem = null;       // {id, name, at}
  let lastPlace = null;      // {id, name, at, pos?}
  let lastEnemy = null;      // {id, name, at}
  let itemCounts = new Map(); // itemId -> {name, count}
  let turnCount = 0;
  let flowHistory = [];      // [{type, at}] 直近6件
  let awaitingAnswer = false;
  let pendingClarify = null;   // Phase5 clarify保持 (SPEC §1.4): 聞き返し1件だけを保持する
  const CLARIFY_TTL_MS = options.clarifyTtlMs ?? 90000;
  let moodScores = { cheerful: 0, tired: 0, anxious: 0, affectionate: 0, engaged: 0 };
  let callTimes = [];        // 呼びかけ時刻（頻度→engaged）
  let lastHearAt = 0;

  const weight = (at) => Math.pow(0.5, (nowFn() - at) / HALF_LIFE_MS);
  function prune() {
    const now = nowFn();
    stack = stack.filter((e) => now - e.at <= STACK_KEEP_MS && weight(e.at) >= 0.03);
  }
  function pushTopic(intent, topic) {
    if (!intent && !topic) return;
    const key = intent || topic;
    stack = stack.filter((e) => (e.intent || e.topic) !== key);
    stack.unshift({ intent: intent || null, topic: topic || intent || null, at: nowFn() });
    if (stack.length > STACK_MAX) stack.length = STACK_MAX;
  }
  function setEntity(kind, ent, pos) {
    if (!ent) return;
    const rec = { id: ent.id, name: ent.name, at: nowFn() };
    if (pos) rec.pos = pos;
    if (kind === "item") {
      lastItem = rec;
      const cur = itemCounts.get(ent.id) || { name: ent.name, count: 0 };
      cur.count++; cur.name = ent.name;
      itemCounts.set(ent.id, cur);
    } else if (kind === "place") lastPlace = rec;
    else if (kind === "enemy") lastEnemy = rec;
  }

  // hear(text, intentId, meta?) — 主人の発話1件を取り込む。
  // meta: {item:{id,name}|id文字列, place:{...}, enemy:{...}, pos} を呼び出し側
  // （ゲーム側の実イベント）が渡せば、本文抽出より優先して対象を確定する。
  function hear(text, intentId = null, meta = {}) {
    const t = String(text || "");
    const now = nowFn();
    turnCount++;
    lastHearAt = now;

    // 対象の確定: meta > intentId の暗黙対象 > 本文抽出
    const norm = (v, table) => {
      if (!v) return null;
      if (typeof v === "string") { const hit = table.find(([, id]) => id === v); return hit ? { id: hit[1], name: hit[2] } : { id: v, name: v }; }
      return { id: v.id, name: v.name || v.id };
    };
    const implicit = (intentId && INTENT_ENTITIES[intentId]) || {};
    // 優先順: meta（実イベント）> 本文抽出（具体名）> intentId の暗黙対象（総称の補完）
    setEntity("item", norm(meta.item, ITEM_WORDS) || findWord(t, ITEM_WORDS) || implicit.item, meta.pos);
    setEntity("place", norm(meta.place, PLACE_WORDS) || findWord(t, PLACE_WORDS) || implicit.place, meta.pos);
    setEntity("enemy", norm(meta.enemy, ENEMY_WORDS) || findWord(t, ENEMY_WORDS) || implicit.enemy, meta.pos);

    // 話題スタック
    pushTopic(intentId, meta.topic || null);
    prune();

    // 会話の流れ
    const type = classifyTurn(t);
    if (awaitingAnswer && (type === "statement" || type === "report" || type === "reaction")) awaitingAnswer = false;
    if (type === "question") awaitingAnswer = true;
    flowHistory.push({ type, at: now });
    if (flowHistory.length > 6) flowHistory.shift();

    // ムード: 感情語 + 呼びかけ頻度
    for (const [mood, words] of Object.entries(MOOD_WORDS)) if (words.some((w) => t.includes(w))) moodScores[mood] += 2;
    if (CALL_WORDS.some((w) => t.includes(w))) {
      callTimes.push(now);
      callTimes = callTimes.filter((x) => now - x <= 5 * 60 * 1000);
      if (callTimes.length >= 3) moodScores.engaged += 2;
      moodScores.affectionate += 0.5;
    }
    return getContext();
  }

  // noteBot(intentId, topic?) — リゼ側の返信が話題を進めた場合に任意で呼ぶ。
  function noteBot(intentId, topic = null) { pushTopic(intentId, topic); prune(); }

  // ---------- 指示語解決 ----------
  // 戻り値: {kind:'item'|'place'|'enemy'|'topic'|'count'|'none',
  //          phrase: 検出した言い回し, target: {...}|null, fresh: 減衰後の重み}
  function resolveReference(text) {
    const t = String(text || "");
    prune();
    const none = (phrase) => ({ kind: "none", phrase: phrase || null, target: null, fresh: 0 });
    const withRec = (kind, phrase, rec, extra = {}) => rec
      ? { kind, phrase, target: { id: rec.id, name: rec.name, ...(rec.pos ? { pos: rec.pos } : {}), ...extra }, fresh: weight(rec.at) }
      : none(phrase);

    // 「それ/あれ 何個目？」系 — 個数の問い合わせは最優先で count 解決
    if (/(それ|あれ|これ)?.{0,4}(何個目|なんこめ|何本目|何回目)/.test(t) || /それ.{0,3}(いくつ|何個)/.test(t)) {
      if (lastItem) {
        const c = itemCounts.get(lastItem.id);
        return { kind: "count", phrase: "何個目", target: { id: lastItem.id, name: lastItem.name, count: c ? c.count : 0 }, fresh: weight(lastItem.at) };
      }
      return none("何個目");
    }
    // 「続き」
    if (t.includes("続き") || t.includes("つづき")) {
      const top = stack[0];
      return top ? { kind: "topic", phrase: "続き", target: { intent: top.intent, topic: top.topic }, fresh: weight(top.at) } : none("続き");
    }
    // 「さっきの〜」「あの〜」: 直後の名詞で対象種別を寄せる
    const past = t.match(/(さっきの|あの|その)\s*(\S{1,8})/);
    if (past) {
      const noun = past[2];
      const iw = findWord(noun, ITEM_WORDS); if (iw) return withRec("item", past[1], iw.id === lastItem?.id ? lastItem : { ...iw, at: lastItem?.at ?? nowFn() });
      const ew = findWord(noun, ENEMY_WORDS); if (ew) return withRec("enemy", past[1], { ...ew, at: lastEnemy?.at ?? nowFn() });
      const pw = findWord(noun, PLACE_WORDS); if (pw) return withRec("place", past[1], { ...pw, at: lastPlace?.at ?? nowFn() });
      if (/場所|ところ|とこ|ポイント/.test(noun)) return withRec("place", past[1], lastPlace);
      if (/敵|やつ/.test(noun)) return withRec("enemy", past[1], lastEnemy);
      // 名詞が特定できない「その/あの」は一番新しい対象へ
      const newest = [lastItem, lastPlace, lastEnemy].filter(Boolean).sort((a, b) => b.at - a.at)[0];
      if (newest) {
        const kind = newest === lastItem ? "item" : newest === lastPlace ? "place" : "enemy";
        return withRec(kind, past[1], newest);
      }
      return none(past[1]);
    }
    // 「さっきの場所」「あそこ」「あの場所」
    if (/さっきの場所|あの場所|あそこ|その場所|そのへん/.test(t)) return withRec("place", "さっきの場所", lastPlace);
    // 素の指示語: それ/あれ/これ → 文脈で一番可能性が高い対象
    // 動詞ヒント: 倒した/やっつけた→敵、戻る/行く→場所、それ以外→アイテム優先
    if (/(それ|あれ|これ)/.test(t)) {
      if (/倒し|やっつけ|殺し|討伐/.test(t) && lastEnemy) return withRec("enemy", "それ", lastEnemy);
      if (/戻|行|連れて|案内/.test(t) && lastPlace) return withRec("place", "それ", lastPlace);
      if (lastItem) return withRec("item", "それ", lastItem);
      if (lastEnemy) return withRec("enemy", "それ", lastEnemy);
      if (lastPlace) return withRec("place", "それ", lastPlace);
      return none("それ");
    }
    return none(null);
  }

  // followups の prev 判定用: prevIds のどれかが話題スタックに新しく残っていれば
  // その intent を返す（既存の「lastTopic 一致＋90秒」より緩く・正確に）。
  function matchesPrev(prevIds) {
    prune();
    for (const e of stack) if (e.intent && prevIds.includes(e.intent)) return e.intent;
    return null;
  }

  function currentMood() {
    // 時間減衰: 最後の発話から5分で半減扱い（簡易）
    const idle = lastHearAt ? (nowFn() - lastHearAt) / 300000 : 1;
    let best = "calm", bestScore = 0.8;
    for (const [k, v] of Object.entries(moodScores)) {
      const s = v * Math.pow(0.5, idle);
      if (s > bestScore) { best = k; bestScore = s; }
    }
    return best;
  }
  function flowChain() {
    const types = flowHistory.map((f) => f.type);
    const last3 = types.slice(-3).join(">");
    if (last3 === "question>statement>reaction" || last3 === "question>report>reaction") return "question_answer_reaction";
    if (types.slice(-2).join(">") === "question>statement" || types.slice(-2).join(">") === "question>report") return "question_answer";
    if (types[types.length - 1] === "question") return "question_open";
    return "free";
  }


  // ---------- Phase5: 聞き返し (clarify) のスロット保持 ----------
  // 保持は1件だけ。候補は最大2件に切り詰める（3択以上の提示をしない）。
  function setPendingClarify(pc) {
    if (!pc || typeof pc !== "object") { pendingClarify = null; return null; }
    const cap2 = (arr) => Array.isArray(arr) ? arr.slice(0, 2) : [];
    pendingClarify = {
      ...pc,
      slot: pc.slot || "target",
      candidates: cap2(pc.candidates),
      retainedCandidates: cap2(pc.retainedCandidates),
      askedAt: typeof pc.askedAt === "number" ? pc.askedAt : nowFn(),
    };
    pushTopic("clarify", "clarify");
    return pendingClarify;
  }
  function getPendingClarify() {
    if (!pendingClarify) return null;
    if (nowFn() - (pendingClarify.askedAt || 0) > CLARIFY_TTL_MS) { pendingClarify = null; return null; }
    return pendingClarify;
  }
  function clearPendingClarify(reason) { pendingClarify = null; return reason || null; }

  function getContext() {
    prune();
    const top = stack[0] || null;
    return {
      lastIntent: top ? top.intent : null,
      lastTopic: top ? top.topic : null,
      topicStack: stack.map((e) => ({ intent: e.intent, topic: e.topic, weight: Number(weight(e.at).toFixed(3)) })),
      lastTargetItem: lastItem ? { id: lastItem.id, name: lastItem.name } : null,
      lastPlace: lastPlace ? { id: lastPlace.id, name: lastPlace.name, ...(lastPlace.pos ? { pos: lastPlace.pos } : {}) } : null,
      lastEnemy: lastEnemy ? { id: lastEnemy.id, name: lastEnemy.name } : null,
      itemCounts: Object.fromEntries([...itemCounts.entries()].map(([k, v]) => [k, v.count])),
      turnCount,
      mood: currentMood(),
      flow: { lastType: flowHistory.length ? flowHistory[flowHistory.length - 1].type : null, chain: flowChain(), awaitingAnswer },
      sinceLastSec: lastHearAt ? Math.round((nowFn() - lastHearAt) / 1000) : null,
      pendingClarify: (() => { const pc = getPendingClarify(); if (!pc) return null; const labels = (pc.candidates && pc.candidates.length ? pc.candidates.map((c) => c?.label) : (pc.retainedCandidates || []).map((c) => c?.target?.name || c?.name)).filter(Boolean); return { slot: pc.slot || "target", reason: pc.reason ?? null, candidateLabels: labels }; })(),
    };
  }

  // 状態の保存/復元（ワールドDP等に載せる統合側向け、任意）
  function serialize() {
    return JSON.stringify({ stack, lastItem, lastPlace, lastEnemy, itemCounts: [...itemCounts.entries()], turnCount, moodScores, pendingClarify });
  }
  function restore(json) {
    try {
      const d = JSON.parse(json);
      stack = d.stack || []; lastItem = d.lastItem || null; lastPlace = d.lastPlace || null; lastEnemy = d.lastEnemy || null;
      itemCounts = new Map(d.itemCounts || []); turnCount = d.turnCount || 0; moodScores = { ...moodScores, ...(d.moodScores || {}) }; pendingClarify = d.pendingClarify || null;
    } catch { /* 壊れた保存データは空で開始 */ }
  }

  return { hear, noteBot, resolveReference, matchesPrev, getContext, serialize, restore, setPendingClarify, getPendingClarify, clearPendingClarify };
}

export default createConversation;
