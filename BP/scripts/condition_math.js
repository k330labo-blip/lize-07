// condition_math.js — 0-C2 読み手 (cycle1337): 条件付き注文 (constraints.condition) の
// 発火判定の純粋核。保持の形は変えず、tick 側消費者が「いま条件が成立しているか」を
// 三状態 (fire / wait / unknown) で引けるようにする。純粋: @minecraft/server を import しない。
// unknown は「評価材料が無い」であり、wait (未成立) と混同しない。発火側は fire の時だけ動く。

// 保留の有効期限。これを過ぎた保留は発火させず取り下げる (出口のない保留を作らない)。
export const CONDITION_TTL_MS = 6 * 60 * 60 * 1000;
// 満腹の閾値 (主人の hunger は 0..20)。実測できない場合は unknown に倒す。
export const SATIETY_FIRE_HUNGER = 18;

// R-C2-2 (cyc2372): 受理時点で評価可能な条件か。評価方法が無い条件 (custom 等) を
// 「保留します」と受けてしまうと、発火口が無く TTL 取り下げまで受理したように見える。
// 受理側はこれが false の条件を保留にせず、その場で明示返答する (0-C7 の原則)。
export const EVALUABLE_CONDITION_KINDS = ["rain", "night", "morning", "satiety", "rain_end"];

// R-C2-3+4 (cyc2380): 条件の役割。欄が無い旧形・壊れた形は "start" (開始トリガー、現行挙動) とみなす。
// "window" は継続条件 (duration): 述語が真の間だけ作業し、偽になったら止める。
export function conditionRole(condition) {
  try { return condition?.role === "window" ? "window" : "start"; } catch { return "start"; }
}
export function isEvaluableCondition(condition) {
  try {
    const kind = condition?.kind;
    return typeof kind === "string" && EVALUABLE_CONDITION_KINDS.includes(kind);
  } catch { return false; }
}

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
    if (kind === "rain_end") { // R-C2-3 (cyc2380): 「雨がやんだら」専用 kind。rain の反転 (止んでいる状態で fire)
      if (typeof e.isRaining !== "boolean") return "unknown";
      return e.isRaining ? "wait" : "fire";
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

// R-C2-4 (cyc2380): window (継続条件) の終了判定。戻り値: "ended" | "active" | "unknown"。
// evalCondition の写像 (fire→active / wait→ended / unknown→unknown)。終了側で使えない kind
// (rain_end・custom 等) は unknown とし、止める根拠にしない。unknown は終了でも継続確定でもない。
export function evalWindowEnd(condition, env) {
  try {
    const kind = condition?.kind;
    if (!kind || kind === "rain_end" || kind === "custom") return "unknown";
    const v = evalCondition(condition, env);
    if (v === "fire") return "active";
    if (v === "wait") return "ended";
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
