// index.js — リゼ (LIZE-07) 知識層の横断検索 (v0.3.0 統合)
// 全知識モジュールの lookup を呼び、ヒットしたエントリの中から
// 「入力テキスト（小文字化）に含まれるエントリ keys の最長一致長」で
// スコア付けし、最良の1件を { entry, source } で返す。
// 同点の場合はモジュール順序（SOURCES の並び）で先勝ち。
// 各 lookup は try/catch で包み、1モジュールの例外で全体は落ちない。
import { lookupKnowledge } from "./mc_knowledge.js";
import { lookupKnowledgeDeep } from "./knowledge_deep.js";
import { lookupScience } from "./knowledge_science.js";
import { lookupJapanese } from "./knowledge_japanese.js";
import { lookupEnglish } from "./knowledge_english.js";
import { lookupSocial } from "./knowledge_social.js";
import { lookupWorld } from "./knowledge_world.js";
import { lookupAcademic } from "./knowledge_academic.js";
import { lookupMathKnowledge } from "./knowledge_math.js";
import { lookupDailyKnowledge } from "./knowledge_daily.js";

export { detectLatestTopic, pickHonestyLine, countHonesty } from "./world_honesty.js";

// 既定のモジュール順序（同点時の優先順位）: mc, deep, science, japanese,
// english, social, world, academic, math, daily
const SOURCES = [
  { source: "mc", lookup: lookupKnowledge },
  { source: "deep", lookup: lookupKnowledgeDeep },
  { source: "science", lookup: lookupScience },
  { source: "japanese", lookup: lookupJapanese },
  { source: "english", lookup: lookupEnglish },
  { source: "social", lookup: lookupSocial },
  { source: "world", lookup: lookupWorld },
  { source: "academic", lookup: lookupAcademic },
  { source: "math", lookup: lookupMathKnowledge },
  { source: "daily", lookup: lookupDailyKnowledge },
];

// エントリの keys のうち、text（小文字化済み）に含まれるものの最長一致長。
// 一致するキーが無ければ 0。
function longestKeyMatch(entry, lowerText) {
  if (!entry || !Array.isArray(entry.keys)) return 0;
  let best = 0;
  for (const k of entry.keys) {
    const nk = String(k).toLowerCase();
    if (!nk) continue;
    if (lowerText.includes(nk) && nk.length > best) best = nk.length;
  }
  return best;
}

export function lookupAll(text) {
  if (!text) return null;
  const lowerText = String(text).toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const { source, lookup } of SOURCES) {
    let entry = null;
    try {
      entry = lookup(text);
    } catch {
      continue; // 1モジュールの例外で全体を落とさない
    }
    if (!entry) continue;
    const score = longestKeyMatch(entry, lowerText);
    // 厳密に大きい場合だけ更新する＝同点はモジュール順序で先勝ち
    if (score > bestScore) {
      bestScore = score;
      best = { entry, source };
    }
  }
  return best;
}
