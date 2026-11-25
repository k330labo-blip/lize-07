// survey_reservoir.js — survey 案R (リザーバサンプリング, Algorithm R) 純粋核ドラフト
// cycle2036-a01: cycle2006-a02-surveyR/REPORT.md §2 候補形のモジュール化案。
// 統合時は survey_evict.js と同型に BP/scripts/survey_reservoir.js として置き、
// main.js の recordHit 本体を recordHitReservoir への委譲 (差分1) に置き換える。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// データ形の変更は sv.seen (種類別通算見た数) の追加のみ。hits の要素は毎回新規 {x,y,z}。
export const SURVEY_HITS_CAP_RESERVOIR = 96; // main.js SURVEY_HITS_CAP と同一値 (単一の正は main.js 側)

// 決定的 RNG (テスト用)。統合後の実働では rng 引数を省略し Math.random を使う。
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 案R の recordHit。現行との差分は3点だけ:
//  (1) 重複は seen を数えずに return する (重複判定を seen++ より前に置く)
//  (2) 非重複のたびに seen[id] を通算する
//  (3) 上限到達後は確率 CAP/n で既存スロット1つと置換する (drop-new の解消)
// rng は第5引数・既定 Math.random。main.js 側の既存呼び出し recordHit(sv,id,loc) は
// 統合形 (main.js 内関数が cap と rng 既定を束縛する) のため無変更で動く。
export function recordHitReservoir(sv, id, loc, cap = SURVEY_HITS_CAP_RESERVOIR, rng = Math.random) {
  try {
    if (!sv || typeof sv !== "object" || !id || !loc) return false;
    if (!sv.hits || typeof sv.hits !== "object") sv.hits = {};
    const arr = sv.hits[id] || (sv.hits[id] = []);
    for (const h of arr) if (h.x === loc.x && h.y === loc.y && h.z === loc.z) return false; // (1) 重複
    const seen = sv.seen || (sv.seen = {});
    const n = (seen[id] = (seen[id] || 0) + 1); // (2) 通算 (非重複のみ)
    const lim = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : SURVEY_HITS_CAP_RESERVOIR;
    if (arr.length < lim) { arr.push({ x: loc.x, y: loc.y, z: loc.z }); return true; }
    const r = typeof rng === "function" ? rng() : Math.random();
    const j = Math.floor(r * n);
    if (j < lim) { arr[j] = { x: loc.x, y: loc.y, z: loc.z }; return true; } // (3) 置換
    return false; // 確率で外れた (記録しないが seen は進む: Algorithm R の正)
  } catch { return false; }
}

// requestSurvey の鮮度切れリセットと対で使う: hits と seen は同時に初期化する。
// 鮮度内の再走査では呼ばないこと (呼ぶと毎回「最初のCAP件」分布に戻り drop-new と等価になる)。
export function resetReservoirSeen(sv) {
  try { if (sv && typeof sv === "object") sv.seen = {}; } catch {}
  return sv;
}

// 通算見た数 (未記録種類は 0)。診断・テスト用。
export function seenCount(sv, id) {
  try { const n = sv?.seen?.[id]; return Number.isFinite(n) ? n : 0; } catch { return 0; }
}
