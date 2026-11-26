// placeadmire_math.js — POLISH-ANIM-PLACEADMIRE-01 (cycle1321): ブロックを
// 置いた直後、置いた物へ一瞬だけ視線を向けて小さく頷く「置けた」確認の
// 純粋核。プレイヤーは設置後に置いた物を見る。その所作だけを提案する。
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// feeder 未接続 (純粋核先行統合)。設置・移動の判定には一切関与しない。

export const PLACEADMIRE_COOLDOWN_MS = 20000; // 連続設置で毎回頷かない
export const PLACEADMIRE_DURATION_MS = 900;   // 視線を向ける長さ
export const PLACEADMIRE_MAX_DIST = 6;        // これより遠い設置は見ない
export const PLACEADMIRE_NOD_DEG = 6;         // 頷きの下向き角度

function fin(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

export function createPlaceAdmireState() {
  return { lastFiredMs: null, placedAtMs: null, placedDist: null };
}
function normalizeState(state) {
  const s = state && typeof state === "object" ? state : {};
  return { lastFiredMs: fin(s.lastFiredMs), placedAtMs: fin(s.placedAtMs), placedDist: fin(s.placedDist) };
}

// notePlaced(state, input) -> { state, fired }
// input = { nowMs, dist, suppressed, danger }
// 設置成功の観測で、クールダウン明け・近距離・抑制なし・危険なしのときだけ
// fired:true を1回返す。設置の成否そのものは呼び出し側が確定済みである前提。
export function notePlaced(state, input) {
  try {
    const prev = normalizeState(state);
    const inp = input && typeof input === "object" ? input : {};
    const now = fin(inp.nowMs);
    if (now === null) return { state: prev, fired: false };
    const next = { ...prev, placedAtMs: now, placedDist: fin(inp.dist) };
    if (inp.suppressed === true || inp.danger === true) return { state: next, fired: false };
    const d = fin(inp.dist);
    if (d === null || d > PLACEADMIRE_MAX_DIST) return { state: next, fired: false };
    if (prev.lastFiredMs !== null && now - prev.lastFiredMs < PLACEADMIRE_COOLDOWN_MS) return { state: next, fired: false };
    next.lastFiredMs = now;
    return { state: next, fired: true };
  } catch { return { state: normalizeState(state), fired: false }; }
}

// samplePlaceAdmire(state, nowMs) -> { active, pitchDeg }
// 発火直後 PLACEADMIRE_DURATION_MS の間だけ active。頷きは前半で下がり後半で戻る。
export function samplePlaceAdmire(state, nowMs) {
  try {
    const s = normalizeState(state);
    const now = fin(nowMs);
    if (s.lastFiredMs === null || now === null) return { active: false, pitchDeg: 0 };
    const t = now - s.lastFiredMs;
    if (t < 0 || t >= PLACEADMIRE_DURATION_MS) return { active: false, pitchDeg: 0 };
    const half = PLACEADMIRE_DURATION_MS / 2;
    const k = t < half ? t / half : 1 - (t - half) / half;
    return { active: true, pitchDeg: Math.round(PLACEADMIRE_NOD_DEG * k * 10) / 10 };
  } catch { return { active: false, pitchDeg: 0 }; }
}
