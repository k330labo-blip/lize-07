// nav_radius_math.js — NAV-RADIUS-BRAINACT-01 (cyc2496 A11 ドラフト・cyc2499 統合): act → nav 到達半径の単一の正 (純粋核)。
// 旧来は syncNavGoal の `(moveAct === "follow" || moveAct === "stay_anchor") ? 1 : 0` だけで、
// 脳 tick が入れる生 act (follow_close 等) は直書き "follow" を経ないため全て半径0になり、
// 目標セルへ体が入れない場面では到達にならず、距離≦1.4 では main 側 stuck も立たず出口が無かった
// (実測: tests/cyc2492_a11.md — 半径0は600tick到達せず direct 降格、半径1は tick17 で到達)。
// 是正は act 分類による一般化とし、追随専用の分岐は入れない:
// 半径1 (LOOSE): 追随系・主人接近系・帰還系・見回り・待機 — 目標は「相手/拠点の近傍」であり
// 目標セルそのものへ入る必要がない (主人セル・入口セルは他者/構造で塞がれうる)。
// 半径0 (STRICT): それ以外全て (作業系 pickup_*/deliver*/deposit/chest_alert・戦闘系・脱出系等)。
// 対象セルへの厳密到達が実行条件に結びつくため従来どおり維持する。
// 未知 act・非文字列は 0 (従来の暗黙既定と同値)。例外を投げない。
export const NAV_RADIUS_LOOSE = 1;
export const NAV_RADIUS_STRICT = 0;

const LOOSE_ACTS = new Set([
  "follow", // 直書き経路 (mission/チャット) — 従来から半径1。経路分裂の解消として表へ取り込む
  "stay_anchor", // 従来から半径1 (定位置維持は nav 到達後の静止で保たれ、半径とは無関係)
  "follow_close", // execTarget: behind(1.8)
  "follow_high", // execTarget: behind(4)
  "go_owner", // execTarget: behind(1.5) — 主人セル自体は体が入れない (FW-02)
  "warn_owner_low", // execTarget: behind(1.5) — 主人接近の警告
  "catchup", // execTarget: behind(2.5)
  "patrol_home", // execTarget: homeEntryPoint 周回点
  "return_home", // execTarget: homeEntryPoint
  "go_home", // execTarget: homeEntryPoint
  "rest_at_home", // execTarget: homeEntryPoint
]);

export function arriveRadiusFor(act) {
  try {
    return (typeof act === "string" && LOOSE_ACTS.has(act)) ? NAV_RADIUS_LOOSE : NAV_RADIUS_STRICT;
  } catch { return NAV_RADIUS_STRICT; }
}

// R4 (距離≦1.4 静止盲点・本件回帰同梱): main 側 stuck 加算の可否。
// 従来ゲートは 3D距離 > 1.4 のみで、未到達なのに ≦1.4 の静止は数えられなかった。
// ただし到達半径内の静止は正常終了であり数えてはならないため、一律に閾値を下げない:
// 「nav が到達不能 (partial) を返している」場合に限り、到達成立距離 max(0.6, 半径) の外側を数える。
// partial でない通常接近では従来どおり > 1.4 のみ (正常例の救済誤発火を防ぐ)。
export function mainStuckCounts(dist3d, act, partial) {
  try {
    if (typeof dist3d !== "number" || !Number.isFinite(dist3d)) return false;
    if (dist3d > 1.4) return true;
    if (partial && dist3d > Math.max(0.6, arriveRadiusFor(act))) return true;
    return false;
  } catch { return false; }
}
