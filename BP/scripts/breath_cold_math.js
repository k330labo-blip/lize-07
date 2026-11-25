// breath_cold_math.js — 寒冷地での小さな白い排気 POLISH-FX-BREATHCOLD-01 (純粋核ドラフト)
// 出典: brain_parts/solutions/cycle1322-a21/REPORT.md §4 (仕様の正)
// 純粋モジュール: @minecraft/server を import しない。現在時刻 / エンティティ参照を
// 持たない (時刻は引数で受ける)。乱数も持たない (周期の揺らぎは発火回数から決定的に
// 導く。同じ入力列には同じ発火列が返るため、ハーネスで再現できる)。例外を投げない。
// 表示層のみ: 移動・作業・戦闘・掘削ゲート・環境取得・発話には一切触らない。
// パーティクル自体も出さない (発火判定と口元オフセットの計算だけ。実表示は統合側が
// パーティクル ID を照合してから行い、未照合なら記録のみで倒す想定、ENVRESIDUE と同方式)。
// 流儀は dryoff_math.js に倣う: 定数 / should* (純粋判定) / note* (状態記録の薄い
// ラッパ) のセット + Due 判定。真偽は厳密一致 (===true) のみを条件として扱い、
// truthy な数値等では発火させない (dryoff / sky_glance と同規則)。
// 統合: cycle1343 で BP へ取り込み。パーティクル ID は未照合のため統合側は記録のみ (ENVRESIDUE と同方式)。

export const BREATH_COLD_INTERVAL_MS = 4000; // 基本周期 約4秒 (仕様 §4.2)
export const BREATH_INTERVAL_MS = BREATH_COLD_INTERVAL_MS; // 仕様 §4.4 の別名
export const BREATH_COLD_JITTER_MS = 1200;   // 周期の揺らぎ幅 ±1200ms (仕様 §4.5-1)
export const BREATH_JITTER_MS = BREATH_COLD_JITTER_MS;     // 仕様 §4.4 の別名
export const BREATH_COLD_MIN_INTERVAL_MS = BREATH_COLD_INTERVAL_MS - BREATH_COLD_JITTER_MS; // 2800
export const BREATH_COLD_MAX_INTERVAL_MS = BREATH_COLD_INTERVAL_MS + BREATH_COLD_JITTER_MS; // 5200
export const BREATH_COLD_FORWARD = 0.35;     // 口元: 頭部中心から顔の向きへ 0.35 ブロック
export const BREATH_COLD_DROP = 0.15;        // 口元: 目の高さから 0.15 ブロック下 (オフセットは -DROP)
export const BREATH_COLD_TEMPERATURE_MAX = 0; // temperature (℃相当) がこの値以下なら寒冷

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

// --- 寒冷条件 (汎用分類のみ。バイオーム名・ブロック ID の個別ハードコードはしない) ---

// isBreathColdCold(input) -> boolean: 寒冷条件が成立しているか
// 成立形 (いずれか1つ):
// - 明示フラグの厳密 true: cold / isCold / coldCondition / onSnow / footOnSnow /
//   inSnow / inPowderSnow / powderSnow / snowCovered
// - 素材カテゴリ文字列が雪系: footCategory / groundCategory / category /
//   materialCategory のいずれかが "snow" / "snowy" / "powder_snow"
//   (統合側が既存 sfx.js 等の汎用素材分類で判定したカテゴリを渡す想定)
// - 低温相当の観測値: temperature が有限で BREATH_COLD_TEMPERATURE_MAX 以下
// 明示フラグが false でも、他の形で成立していれば寒冷とみなす (観測源の併記を許す)。
// input がオブジェクトでない / どの形も無ければ false。例外を投げない。
export function isBreathColdCold(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.cold === true || input.isCold === true || input.coldCondition === true) return true;
    if (input.onSnow === true || input.footOnSnow === true) return true;
    if (input.inSnow === true || input.inPowderSnow === true || input.powderSnow === true) return true;
    if (input.snowCovered === true) return true;
    const cats = [input.footCategory, input.groundCategory, input.category, input.materialCategory];
    for (const c of cats) {
      if (c === "snow" || c === "snowy" || c === "powder_snow") return true;
    }
    const t = finiteOrNull(input.temperature);
    if (t !== null && t <= BREATH_COLD_TEMPERATURE_MAX) return true;
    return false;
  } catch { return false; }
}

// isBreathColdSuppressed(input) -> boolean: 抑制条件が立っているか (仕様 §4.2)
// 抑制: 水中 (inWater / underwater / headInWater)、高温次元 (hotDimension /
// isHotDimension / hotBiome、または dimension / dimensionId が "nether" /
// 末尾 "the_nether")、戦闘中 (inCombat / danger)、落下中 (falling / isFalling)、
// 被弾直後 (hurtRecent / justHurt)、統合側で束ねた suppressed。
// いずれも ===true のときだけ抑制として扱う。例外を投げない。
export function isBreathColdSuppressed(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (input.suppressed === true) return true;
    if (input.inWater === true || input.underwater === true || input.headInWater === true) return true;
    if (input.hotDimension === true || input.isHotDimension === true || input.hotBiome === true) return true;
    const dim = input.dimension !== undefined ? input.dimension : input.dimensionId;
    if (dim === "nether" || dim === "the_nether" || dim === "minecraft:the_nether") return true;
    if (typeof dim === "string" && dim.endsWith("the_nether")) return true;
    if (input.inCombat === true || input.danger === true) return true;
    if (input.falling === true || input.isFalling === true) return true;
    if (input.hurtRecent === true || input.justHurt === true) return true;
    return false;
  } catch { return false; }
}

// breathColdJitterMs(fireCount) -> [-1200, 1200) の決定的な揺らぎ (ms)
// Math.random は使わない: 発火回数 n に対する sin ハッシュで導く純粋関数。
// 同じ n には常に同じ値が返る。非有限・負の n は 0 回目として扱う。例外を投げない。
export function breathColdJitterMs(fireCount) {
  try {
    let n = finiteOrNull(fireCount);
    if (n === null || n < 0) n = 0;
    n = Math.floor(n);
    const x = Math.sin((n + 1) * 12.9898) * 43758.5453;
    const frac = x - Math.floor(x); // [0, 1)
    return Math.floor(frac * 2 * BREATH_COLD_JITTER_MS) - BREATH_COLD_JITTER_MS;
  } catch { return 0; }
}

// breathColdIntervalFor(fireCount) -> 次回までの間隔 (ms)。常に [2800, 5200) 内。
export function breathColdIntervalFor(fireCount) {
  try { return BREATH_COLD_INTERVAL_MS + breathColdJitterMs(fireCount); }
  catch { return BREATH_COLD_INTERVAL_MS; }
}

// breathColdDue(lastFiredAtMs, nowMs, fireCount) -> boolean: 周期が明けたか
// 初回 (lastFiredAtMs が非有限) は false: 寒冷地へ入った瞬間の即時発火はしない
// (滞在の開始は noteBreathCold が coldSinceMs / nextDueAtMs で管理する)。
// nowMs 非有限は false (発火させない側)。時計巻き戻しは false。例外を投げない。
export function breathColdDue(lastFiredAtMs, nowMs, fireCount) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    const last = finiteOrNull(lastFiredAtMs);
    if (last === null) return false;
    return n - last >= breathColdIntervalFor(fireCount);
  } catch { return false; }
}

// shouldBreathCold(input) -> boolean: 発火可否の純粋判定 (仕様 §4.2 + §4.5)
// input (寒冷条件の内訳は isBreathColdCold、抑制の内訳は isBreathColdSuppressed と共通):
// {
//   cold / isCold / onSnow / inPowderSnow / footCategory / temperature, // 寒冷条件
//   suppressed / inWater / hotDimension / inCombat / danger / falling / hurtRecent, // 抑制
//   lastFiredAtMs, lastFiredMs, // 前回発火 (lastFiredAtMs が正、lastFiredMs は別名)
//   nextDueAtMs, nextAtMs,      // note* が予約した次回発火時刻 (あれば最優先で使う)
//   coldSinceMs, enteredColdAtMs, // 寒冷滞在の開始時刻 (初回発火の判定に使う)
//   fireCount,                  // 揺らぎ導出用 (省略時は 0)
//   nowMs,
// }
// 成立条件: (1) 寒冷条件が成立し (2) 抑制に触れず (3) 周期が明けている。
// 周期の判定順: nextDueAtMs が有限なら nowMs >= nextDueAtMs、次に lastFiredAtMs が
// 有限なら breathColdDue、それも無ければ coldSinceMs からの経過が1周期以上。
// 滞在開始時刻も前回発火も無い単発の判定では発火しない (入口での即時発火防止)。
// 本関数は純粋判定であり状態を消費しない。例外を投げない。
export function shouldBreathCold(input) {
  try {
    if (!input || typeof input !== "object") return false;
    if (!isBreathColdCold(input)) return false;
    if (isBreathColdSuppressed(input)) return false;
    const now = finiteOrNull(input.nowMs);
    if (now === null) return false;
    const next = input.nextDueAtMs !== undefined ? finiteOrNull(input.nextDueAtMs)
      : finiteOrNull(input.nextAtMs);
    if (next !== null) return now >= next;
    const last = input.lastFiredAtMs !== undefined ? input.lastFiredAtMs : input.lastFiredMs;
    if (finiteOrNull(last) !== null) return breathColdDue(last, now, input.fireCount);
    const since = input.coldSinceMs !== undefined ? input.coldSinceMs : input.enteredColdAtMs;
    if (finiteOrNull(since) !== null) return now - since >= breathColdIntervalFor(input.fireCount);
    return false;
  } catch { return false; }
}

// noteBreathCold(state, envOrCold, nowMsArg) -> boolean (この tick で発火すべきなら true)
// 仕様 §4.4 の noteBreath に当たる状態記録ラッパ。state は配線側が保持する表示層状態:
//   { lastFiredAtMs, nextDueAtMs, coldSinceMs, fireCount, wasEligible }
// 受け形は3通り:
// - noteBreathCold(state, true|false /* 寒冷条件 */, nowMs)   … 抑制なしの最小形
// - noteBreathCold(state, { cold, inWater, ... , nowMs })     … 寒冷/抑制の内訳を渡す形
// - noteBreathCold(state, { cold, inWater, ... }, nowMs)      … 時刻を第3引数で渡す形
//   (第3引数が有限ならそちらを優先する)
// 振る舞い:
// - 寒冷かつ抑制なしの滞在が始まった tick では発火せず、coldSinceMs と
//   nextDueAtMs (= nowMs + 1周期) だけを予約する (入口での即時発火なし、仕様 §4.5-2)。
// - 予約時刻に達した tick で1回だけ true を返し、lastFiredAtMs / fireCount を進め、
//   次回をその tick から1周期先へ予約し直す。tick が間引かれても取り戻し発火は
//   しない (1回の呼び出しで最大1発、遅れてまとめて出ない、仕様 §4.5-3)。
// - 寒冷を外れた / 抑制が立った tick では予約を破棄する (nextDueAtMs / coldSinceMs
//   を null へ)。抑制が解けても予約は復活せず、滞在の再開から1周期待ち直す。
// - 時計巻き戻し (nowMs < coldSinceMs) では発火せず、滞在開始を nowMs へ張り直す。
// - nowMs が非有限の呼び出しは何も変えず false (状態を壊さない)。
// - 発火しなかった tick では lastFiredAtMs を進めない。
// state がオブジェクトでない場合は何もせず false。例外を投げない。
export function noteBreathCold(state, envOrCold, nowMsArg) {
  try {
    if (!state || typeof state !== "object") return false;
    let env = {}, nowMs;
    if (envOrCold && typeof envOrCold === "object") {
      env = envOrCold;
      nowMs = finiteOrNull(nowMsArg) !== null ? nowMsArg : envOrCold.nowMs;
    } else if (typeof envOrCold === "boolean") {
      env = { cold: envOrCold };
      nowMs = nowMsArg;
    } else {
      return false;
    }
    const now = finiteOrNull(nowMs);
    if (now === null) return false;
    const eligible = isBreathColdCold(env) && !isBreathColdSuppressed(env);
    if (!eligible) {
      state.nextDueAtMs = null;
      state.coldSinceMs = null;
      state.wasEligible = false;
      return false;
    }
    const since = finiteOrNull(state.coldSinceMs);
    const next = finiteOrNull(state.nextDueAtMs);
    if (state.wasEligible !== true || since === null || next === null) {
      state.coldSinceMs = now;
      state.nextDueAtMs = now + breathColdIntervalFor(state.fireCount);
      state.wasEligible = true;
      return false;
    }
    if (now < since) { // 時計巻き戻し: 張り直して発火しない
      state.coldSinceMs = now;
      state.nextDueAtMs = now + breathColdIntervalFor(state.fireCount);
      return false;
    }
    if (now < next) return false;
    state.lastFiredAtMs = now;
    const count = finiteOrNull(state.fireCount);
    state.fireCount = (count === null || count < 0 ? 0 : Math.floor(count)) + 1;
    state.coldSinceMs = now;
    state.nextDueAtMs = now + breathColdIntervalFor(state.fireCount);
    state.wasEligible = true;
    return true;
  } catch { return false; }
}

// noteBreath(state, env, nowMs) -> boolean: 仕様 §4.4 の名前での別名 (noteBreathCold と同一)
export function noteBreath(state, env, nowMs) {
  try { return noteBreathCold(state, env, nowMs); } catch { return false; }
}

// breathColdParticleCount(fireCount) -> 1回の発火で出す粒子の数 (1 または 2、仕様 §4.2)
// 発火回数の偶奇で決定的に決める (乱数なし)。無効入力は 1。例外を投げない。
export function breathColdParticleCount(fireCount) {
  try {
    const n = finiteOrNull(fireCount);
    if (n === null || n < 0) return 1;
    return Math.floor(n) % 2 === 0 ? 1 : 2;
  } catch { return 1; }
}

// breathColdOffset(headYawDeg, forwardArg) -> { x, y, z } 口元オフセット (ブロック)
// 仕様 §4.4 の breathOffset に当たる。ヨーの約束は統合版の向き: yaw 0 = 南 (+Z)、
// 90 = 西 (-X)、180 = 北 (-Z)、-90 = 東 (+X)。前方ベクトルは (-sin(yaw), cos(yaw))。
// 第2引数 forward で前方距離を差し替えられる (有限値のみ、0〜1 にクランプ)。
// ヨー非有限時は前方 0 のオフセット { x:0, y:-DROP, z:0 } を返す。例外を投げない。
export function breathColdOffset(headYawDeg, forwardArg) {
  try {
    let d = finiteOrNull(forwardArg);
    if (d === null) d = BREATH_COLD_FORWARD;
    d = Math.min(1, Math.max(0, d));
    const yaw = finiteOrNull(headYawDeg);
    if (yaw === null) return { x: 0, y: -BREATH_COLD_DROP, z: 0 };
    const rad = yaw * Math.PI / 180;
    const x = -Math.sin(rad) * d;
    const z = Math.cos(rad) * d;
    return { x: x === 0 ? 0 : x, y: -BREATH_COLD_DROP, z: z === 0 ? 0 : z };
  } catch { return { x: 0, y: -BREATH_COLD_DROP, z: 0 }; }
}

// breathOffset(headYawDeg) -> { x, y, z }: 仕様 §4.4 の名前での別名 (breathColdOffset と同一)
export function breathOffset(headYawDeg) {
  try { return breathColdOffset(headYawDeg); }
  catch { return { x: 0, y: -BREATH_COLD_DROP, z: 0 }; }
}
