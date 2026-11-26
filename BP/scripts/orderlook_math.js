// orderlook_math.js — POLISH-ANIM-ORDERLOOK-01 (cycle1337、新規発案): 指示を受けた直後、
// 主人の方を向いて小さく一度だけ頷く「受けました」の所作の純粋核。
// プレイヤーは頼んだ相手がこちらを見て頷くのを確認して安心する。その確認だけを提案する。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// feeder 未接続 (純粋核先行統合)。移動・作業の判定には一切関与しない。実機確認待ち。

export const ORDERLOOK_COOLDOWN_MS = 12000; // 連続指示で毎回頷かない
export const ORDERLOOK_DURATION_MS = 850;   // 視線と頷きの長さ
export const ORDERLOOK_NOD_DEG = 7;         // 頷きの下向き角度
export const ORDERLOOK_MAX_DIST = 10;       // これより遠い主人には向けない

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

export function createOrderLookState() {
  return { lastFiredMs: null };
}
function normalizeState(state) {
  const s = state && typeof state === "object" ? state : {};
  return { lastFiredMs: fin(s.lastFiredMs) };
}

// noteOrderAccepted(state, input) -> { state, fired }
// input = { nowMs, dist, suppressed, danger, falling }
// 指示受理の辺で、クールダウン明け・近距離・抑制なし・危険なし・落下中でないときだけ fired:true を1回返す。
export function noteOrderAccepted(state, input) {
  try {
    const prev = normalizeState(state);
    const inp = input && typeof input === "object" ? input : {};
    const now = fin(inp.nowMs);
    if (now === null) return { state: prev, fired: false };
    if (inp.suppressed === true || inp.danger === true || inp.falling === true) return { state: prev, fired: false };
    const d = fin(inp.dist);
    if (d === null || d > ORDERLOOK_MAX_DIST) return { state: prev, fired: false };
    if (prev.lastFiredMs !== null && now - prev.lastFiredMs < ORDERLOOK_COOLDOWN_MS) return { state: prev, fired: false };
    return { state: { lastFiredMs: now }, fired: true };
  } catch { return { state: normalizeState(state), fired: false }; }
}

// sampleOrderLook(state, nowMs) -> { active, pitchDeg }
// 発火直後 ORDERLOOK_DURATION_MS の間だけ active。頷きは前半で下がり後半で戻る。
export function sampleOrderLook(state, nowMs) {
  try {
    const s = normalizeState(state);
    const now = fin(nowMs);
    if (s.lastFiredMs === null || now === null) return { active: false, pitchDeg: 0 };
    const t = now - s.lastFiredMs;
    if (t < 0 || t >= ORDERLOOK_DURATION_MS) return { active: false, pitchDeg: 0 };
    const half = ORDERLOOK_DURATION_MS / 2;
    const pitchDeg = t <= half ? ORDERLOOK_NOD_DEG * (t / half) : ORDERLOOK_NOD_DEG * (1 - (t - half) / half);
    return { active: true, pitchDeg };
  } catch { return { active: false, pitchDeg: 0 }; }
}
