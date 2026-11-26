// endgoal_math.js — ENDGOAL 段階1 (M1) の純粋状態機械 (cyc2003, A04 設計 §5)。
// 役割: エンド到着済み・装備ありの状態から「クリスタル処理→討伐→帰還」までの
// 状態遷移と節目ログ名だけを決める純粋核。実行 (移動・攻撃・次元移動) は feeder 側の責務で、
// 本モジュールは観測スナップショットから次の状態と出すべき節目を返すだけ (挙動は変えない先行統合)。
// 失敗出口を必須とする。ただし射程手段の有無は失敗ではない (W-1, cyc2122):
// クリスタルは接近して近接でも壊せるため、核は「手段なし」を「失敗」と同一視しない。
// 到達不能の見切りは実行側の滞在タイマー (B5) が終了理由として記録する。

export const ENDGOAL_MILESTONES = ["エンド到達", "討伐", "帰還"];

export function createEndgoalState() {
  return { phase: "pre_start", crystalsLeft: null, startedAt: null, failed: null };
}

// obs: { inEnd, crystalsAlive (number|null), dragonAlive (bool|null), dragonPerched (bool),
//        hasRanged (bool), hpRatio (0..1|null), portalSeen (bool), returned (bool) }
// -> { state, milestone: string|null, action: string }
export function stepEndgoal(state, obs) {
  const s = { ...state };
  if (s.failed) return { state: s, milestone: null, action: "failed" };
  // W-1 開始辺: pre_start でエンド内を観測した tick だけが「エンド到達」を返せる (冪等)。
  if (s.phase === "pre_start") {
    if (obs && obs.inEnd === true) { s.phase = "seek_crystals"; return { state: s, milestone: "エンド到達", action: "start" }; }
    s.failed = "LEFT_END_EARLY"; return { state: s, milestone: null, action: "failed" };
  }
  if (!obs || obs.inEnd === false) {
    if (s.phase === "seek_return_portal" && obs.returned) { s.phase = "done"; return { state: s, milestone: "帰還", action: "done" }; }
    if (s.phase !== "done") { s.failed = "LEFT_END_EARLY"; return { state: s, milestone: null, action: "failed" }; }
    return { state: s, milestone: null, action: "done" };
  }
  switch (s.phase) {
    case "seek_crystals": {
      if (typeof obs.crystalsAlive === "number") s.crystalsLeft = obs.crystalsAlive;
      if (obs.crystalsAlive === 0) { s.phase = "dragon_fight"; return { state: s, milestone: null, action: "engage_dragon" }; }
      return { state: s, milestone: null, action: "destroy_crystal" };
    }
    case "dragon_fight": {
      if (obs.dragonAlive === false) { s.phase = "seek_return_portal"; return { state: s, milestone: "討伐", action: "seek_portal" }; }
      if (typeof obs.hpRatio === "number" && obs.hpRatio < 0.25) return { state: s, milestone: null, action: "retreat_heal" };
      if (obs.dragonPerched) return { state: s, milestone: null, action: "melee_dragon" };
      if (obs.hasRanged === false) return { state: s, milestone: null, action: "wait_perch" };
      return { state: s, milestone: null, action: "shoot_dragon" };
    }
    case "seek_return_portal": {
      if (obs.returned) { s.phase = "done"; return { state: s, milestone: "帰還", action: "done" }; }
      return { state: s, milestone: null, action: obs.portalSeen ? "enter_portal" : "seek_portal" };
    }
    default:
      return { state: s, milestone: null, action: "done" };
  }
}
