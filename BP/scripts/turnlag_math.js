// turnlag_math.js — POLISH-ANIM-TURNLAG-01 (cycle1604): 大きく向きを変えた直後、
// 頭の向きが体へ少し遅れて追いつく小さな遅れ (表示層の純粋核先行・feeder 未接続、実機確認待ち)。
// プレイヤーは急な方向転換で頭が一拍遅れる。リゼが瞬時に完全同期すると機械的に見えるため、
// ヨー差を指数減衰で追う遅れ量だけをここで決める。移動・掘削の判定には一切使わない。
// 純粋: @minecraft/server を import しない。例外を投げない。角度は度、差は -180..180 へ正規化する。
export const TURNLAG_MAX_DEG = 18;
export const TURNLAG_MIN_TRIGGER_DEG = 25;

export function wrapDeg(d) {
  try {
    if (typeof d !== "number" || !Number.isFinite(d)) return 0;
    let x = d % 360;
    if (x > 180) x -= 360;
    if (x < -180) x += 360;
    return x;
  } catch { return 0; }
}

export function createTurnLagState() { return { lagDeg: 0, lastYaw: null }; }

// 1サンプル進める。yawDeg は現在の体ヨー。戻り値の applyDeg を頭ヨーへ加えると遅れて見える。
// 大きな転回 (>=25度/サンプル) でのみ遅れが生え、以後は毎サンプル 45% ずつ追いつく。
export function sampleTurnLag(state, yawDeg) {
  try {
    const s = state && typeof state === "object" ? state : createTurnLagState();
    if (typeof yawDeg !== "number" || !Number.isFinite(yawDeg)) return { state: s, applyDeg: 0, active: false };
    if (typeof s.lagDeg !== "number" || !Number.isFinite(s.lagDeg)) s.lagDeg = 0;
    if (typeof s.lastYaw !== "number" || !Number.isFinite(s.lastYaw)) { s.lastYaw = yawDeg; return { state: s, applyDeg: 0, active: false }; }
    const delta = wrapDeg(yawDeg - s.lastYaw);
    s.lastYaw = yawDeg;
    if (Math.abs(delta) >= TURNLAG_MIN_TRIGGER_DEG) {
      // 転回方向と逆向きに遅れる (頭が元の向きに残ろうとする)
      s.lagDeg = Math.max(-TURNLAG_MAX_DEG, Math.min(TURNLAG_MAX_DEG, s.lagDeg - delta * 0.35));
    } else {
      s.lagDeg = s.lagDeg * 0.55;
      if (Math.abs(s.lagDeg) < 0.3) s.lagDeg = 0;
    }
    return { state: s, applyDeg: s.lagDeg, active: s.lagDeg !== 0 };
  } catch { return { state: createTurnLagState(), applyDeg: 0, active: false }; }
}

export function isTurnLagActive(state) {
  try { return !!state && typeof state.lagDeg === "number" && state.lagDeg !== 0; } catch { return false; }
}
