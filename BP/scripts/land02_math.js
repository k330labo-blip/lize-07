// land02_math.js — POLISH-ANIM-LAND-02 純粋核ドラフト (cycle0252-a05)
// 着地表現の環境差: 着地先の素材カテゴリで沈み量・復帰速度・ピッチを変える。
// 仕様の正: brain_parts/solutions/cycle0252-a05/DESIGN.md
// 前提 (解消済み): POLISH-ANIM-FALLLAND-01 は v0.5.38 で統合済み
//   (BP/scripts/fallland_math.js)。本核はその land 出力 (tier/sink/pitch/280ms)
//   を「変換」するだけであり、落下判定・着地判定は持たない (二重判定禁止)。
//
// 純粋モジュール (ドラフト): @minecraft/server を import しない。相対 import も
//   持たない (ドラフト置き場から単体で node 実行できること。統合時は
//    fallland_math.js の FALLLAND_TUNING.landSink / FALLLAND_LAND_PITCH_DEG /
//    landDurationMs と同値であることを契約テストで照合し続けること)。
// 決定的: 時刻・カテゴリ・tier は全て引数。Date.now/乱数なし。
// 例外を投げない: 不正入力は 不発(null) / 既定プロファイル(medium) / 0 に倒す。
// 表示層のみ: 移動・落下ダメージ・実座標には触らない。sink は表示オフセット。

// FALLLAND-01 基準値のローカル写し (統合時に import へ置換し写しを消すこと)
export const LAND02_BASE_DURATION_MS = 280;
export const LAND02_BASE_SINK = [0.0, 0.08, 0.13, 0.18]; // index = tier 1..3
export const LAND02_BASE_PITCH_DEG = [0, 4, 7, 10];       // index = tier 1..3

export const LAND02_SINK_MAX = 0.26;      // 沈みの絶対上限 (表示, ブロック相当)
export const LAND02_PITCH_MAX_DEG = 14;   // ピッチ絶対上限 (下向き正)
export const LAND02_DURATION_MIN_MS = 150;
export const LAND02_DURATION_MAX_MS = 700;

// 素材カテゴリ -> 硬さクラス。入力は sfx.js の素材カテゴリ名 (汎用分類) のみで、
// ブロック個別 ID は持たない。未知カテゴリは medium に倒し known:false を返す。
const SOFT = new Set(["snow", "powder_snow", "sand", "soul_sand", "gravel"]);
const HARD = new Set(["stone", "deepslate", "metal", "netherite", "glass", "ice"]);
const MEDIUM = new Set(["grass", "dirt", "wood", "cloth", "coral", "vines", "nylium", "soul_soil"]);

// class 別プロファイル。soft=深くゆっくり、hard=浅く速く、medium=FALLLAND基準そのまま。
export const LAND02_PROFILES = {
  soft:   { sinkMul: 1.45, durationMul: 1.60, pitchMul: 1.25, curveExp: 0.7 },
  medium: { sinkMul: 1.00, durationMul: 1.00, pitchMul: 1.00, curveExp: 1.0 },
  hard:   { sinkMul: 0.55, durationMul: 0.65, pitchMul: 0.80, curveExp: 1.3 },
};

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function validTier(t) { return t === 1 || t === 2 || t === 3; }

// landEnvClass(category) -> "soft" | "medium" | "hard"
//   非文字列・未知は "medium" (基準挙動に倒す安全側)。
export function landEnvClass(category) {
  try {
    if (typeof category !== "string") return "medium";
    if (SOFT.has(category)) return "soft";
    if (HARD.has(category)) return "hard";
    return "medium"; // MEDIUM 登録済みも未知も基準クラス
  } catch { return "medium"; }
}

// landEnvProfile(category) -> { cls, known, sinkMul, durationMul, pitchMul, curveExp }
//   known はカテゴリが SOFT/HARD/MEDIUM のいずれかに登録済みのときだけ true。
export function landEnvProfile(category) {
  try {
    const cls = landEnvClass(category);
    const known = typeof category === "string"
      && (SOFT.has(category) || HARD.has(category) || MEDIUM.has(category));
    return { cls, known, ...LAND02_PROFILES[cls] };
  } catch { return { cls: "medium", known: false, ...LAND02_PROFILES.medium }; }
}

// landEnvAdjust(tier, category)
//   -> { tier, cls, known, sink, pitchDeg, durationMs } | null
//   FALLLAND 基準 (tier 別 sink/pitch, 280ms) をカテゴリで変換し上限でクランプ。
//   tier が 1..3 でない場合は null (着地でないものは変換しない)。
export function landEnvAdjust(tier, category) {
  try {
    if (!validTier(tier)) return null;
    const p = landEnvProfile(category);
    return {
      tier,
      cls: p.cls,
      known: p.known,
      sink: clamp(LAND02_BASE_SINK[tier] * p.sinkMul, 0, LAND02_SINK_MAX),
      pitchDeg: clamp(LAND02_BASE_PITCH_DEG[tier] * p.pitchMul, 0, LAND02_PITCH_MAX_DEG),
      durationMs: clamp(Math.round(LAND02_BASE_DURATION_MS * p.durationMul),
        LAND02_DURATION_MIN_MS, LAND02_DURATION_MAX_MS),
    };
  } catch { return null; }
}

// landEnvCurve(cls, phase) -> 0..1
//   phase は着地経過割合 [0,1] (域外はクランプ)。両端 0・中央ピーク 1 は全 class 共通。
//   soft は曲線が太く (復帰が遅く感じられ)、hard は細く (素早く戻る)。
export function landEnvCurve(cls, phase) {
  try {
    const p = fin(phase); if (p === null) return 0;
    const prof = LAND02_PROFILES[cls] || LAND02_PROFILES.medium;
    const s = Math.sin(Math.PI * clamp(p, 0, 1));
    return Math.pow(s, prof.curveExp);
  } catch { return 0; }
}

export function createLandEnvState() {
  return { active: false, at: 0, until: 0, adj: null, episode: 0 };
}

// noteLandEnv(state, { tier, category, nowMs }) -> adj | null
//   FALLLAND の land イベント辺でのみ呼ぶ想定。tier 不正・時刻不正は不発で状態不変。
//   既に active でも新しい着地が正であり、上書きする (エピソードは単調増加)。
export function noteLandEnv(st, ev) {
  try {
    if (!st || typeof st !== "object" || !ev || typeof ev !== "object") return null;
    const now = fin(ev.nowMs); if (now === null) return null;
    const adj = landEnvAdjust(ev.tier, ev.category);
    if (!adj) return null;
    st.active = true; st.at = now; st.until = now + adj.durationMs; st.adj = adj;
    st.episode = (fin(st.episode) || 0) + 1;
    return adj;
  } catch { return null; }
}

// landEnvCurrent(state, nowMs)
//   -> { active, sink, pitchDeg, cls, tier, episode }
//   非 active / 期間外 / 不正入力は全て 0 オフセット。残留しない。
export function landEnvCurrent(st, nowMs) {
  const zero = { active: false, sink: 0, pitchDeg: 0, cls: null, tier: 0, episode: 0 };
  try {
    if (!st || typeof st !== "object" || !st.adj) return zero;
    const now = fin(nowMs); if (now === null) return zero;
    const ep = fin(st.episode) || 0;
    if (!st.active || now < st.at || now >= st.until || st.until <= st.at) return { ...zero, episode: ep };
    const k = landEnvCurve(st.adj.cls, (now - st.at) / (st.until - st.at));
    return {
      active: true, sink: st.adj.sink * k, pitchDeg: st.adj.pitchDeg * k,
      cls: st.adj.cls, tier: st.adj.tier, episode: ep,
    };
  } catch { return { active: false, sink: 0, pitchDeg: 0, cls: null, tier: 0, episode: 0 }; }
}
