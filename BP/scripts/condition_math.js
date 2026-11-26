// condition_math.js — 0-C2 読み手 (cycle1337): 条件付き注文 (constraints.condition) の
// 発火判定の純粋核。保持の形は変えず、tick 側消費者が「いま条件が成立しているか」を
// 三状態 (fire / wait / unknown) で引けるようにする。純粋: @minecraft/server を import しない。
// unknown は「評価材料が無い」であり、wait (未成立) と混同しない。発火側は fire の時だけ動く。

// 保留の有効期限。これを過ぎた保留は発火させず取り下げる (出口のない保留を作らない)。
export const CONDITION_TTL_MS = 6 * 60 * 60 * 1000;
// 満腹の閾値 (主人の hunger は 0..20)。実測できない場合は unknown に倒す。
export const SATIETY_FIRE_HUNGER = 18;

// env: { isRaining, isNight, isDawn, ownerHunger } — いずれも boolean / number で測れた値だけを渡すこと。
// 戻り値: "fire" | "wait" | "unknown"
export function evalCondition(condition, env) {
  try {
    const kind = condition?.kind;
    if (!kind || typeof kind !== "string") return "unknown";
    const e = env || {};
    if (kind === "rain") {
      if (typeof e.isRaining !== "boolean") return "unknown";
      return e.isRaining ? "fire" : "wait";
    }
    if (kind === "night") {
      if (typeof e.isNight !== "boolean") return "unknown";
      return e.isNight ? "fire" : "wait";
    }
    if (kind === "morning") {
      if (typeof e.isDawn !== "boolean") return "unknown";
      return e.isDawn ? "fire" : "wait";
    }
    if (kind === "satiety") {
      if (typeof e.ownerHunger !== "number" || !Number.isFinite(e.ownerHunger)) return "unknown";
      return e.ownerHunger >= SATIETY_FIRE_HUNGER ? "fire" : "wait";
    }
    // custom 等、評価方法が無い条件は発火させない (保持のみ)。
    return "unknown";
  } catch { return "unknown"; }
}

export function conditionExpired(at, nowMs, ttlMs = CONDITION_TTL_MS) {
  try {
    if (typeof at !== "number" || !Number.isFinite(at)) return true; // 時刻が無い保留は期限切れとして扱う (出口を保証する)
    if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) return false;
    return nowMs - at > ttlMs;
  } catch { return false; }
}
