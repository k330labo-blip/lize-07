// swap_sound_math.js — POLISH-FX-SWAP-01 (cycle2311): 主手の持ち替え音の発火決定 (純粋核)
// 設計: brain_parts/solutions/cycle2311-a16/DESIGN.md。音単独先行形 (アニメ側 SWAP は前提改修待ち)。
// @minecraft/server を import しない。時刻は注入式・乱数なし・全関数例外なし。不正値は「鳴らさない」側。
// 本版は記録のみ配線 (音 ID 未照合のため実音は出さない)。decision は将来の ANIM-SWAP のトリガに流用可能な形。
export const SWAP_COOLDOWN_MS = 900;
export const SWAP_BURST_MS = 180;
export const SWAP_VOLUME = 0.45;
export const SWAP_PITCH_BASE = 1.0;

function normTypeId(v) { return typeof v === "string" && v ? v : null; }
function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }

export function createSwapSoundState() {
  return { seen: false, prevTypeId: null, lastFiredMs: null, burstAnchorMs: null };
}

export function classifySwap(fromTypeId, toTypeId) {
  try {
    const f = normTypeId(fromTypeId), t = normTypeId(toTypeId);
    if (f === t) return "none";
    if (f === null) return "equip";
    if (t === null) return "unequip";
    return "swap";
  } catch { return "none"; }
}

export function swapPitchFor(kind) {
  try {
    if (kind === "equip") return SWAP_PITCH_BASE + 0.1;
    if (kind === "unequip") return SWAP_PITCH_BASE - 0.1;
    if (kind === "swap") return SWAP_PITCH_BASE;
    return null;
  } catch { return null; }
}

export function isSwapCoolingDown(state, nowMs) {
  try {
    const last = finiteOrNull(state?.lastFiredMs), n = finiteOrNull(nowMs);
    if (last === null || n === null) return false;
    return n - last < SWAP_COOLDOWN_MS; // 巻き戻り (負差分) も冷却中として鳴らさない
  } catch { return false; }
}

function noneDecision(fromTypeId, toTypeId) {
  return { fire: false, reason: "none", fromTypeId: normTypeId(fromTypeId), toTypeId: normTypeId(toTypeId), volume: null, pitch: null };
}

// noteHeldItem(state, { typeId, nowMs, suppressed }) -> { state, decision }
// 規則順序は DESIGN §3.4: 無効入力→初回観測→同一ID→辺の消費→抑制→バースト束ね→冷却→発火。
export function noteHeldItem(state, input) {
  try {
    const st = state && typeof state === "object" ? state : createSwapSoundState();
    if (!input || typeof input !== "object") return { state: st, decision: noneDecision(st.prevTypeId, st.prevTypeId) };
    const now = finiteOrNull(input.nowMs);
    if (now === null) return { state: st, decision: noneDecision(st.prevTypeId, st.prevTypeId) };
    const cur = normTypeId(input.typeId);
    if (!st.seen) { st.seen = true; st.prevTypeId = cur; return { state: st, decision: noneDecision(cur, cur) }; }
    const from = normTypeId(st.prevTypeId);
    if (cur === from) return { state: st, decision: noneDecision(from, cur) };
    // 辺の消費: 以後の結果にかかわらず prevTypeId は新値へ更新する (遅れ発火をしない)
    st.prevTypeId = cur;
    const kind = classifySwap(from, cur);
    if (input.suppressed === true) return { state: st, decision: noneDecision(from, cur) };
    const anchor = finiteOrNull(st.burstAnchorMs);
    const burst = anchor !== null && now - anchor < SWAP_BURST_MS;
    if (burst) return { state: st, decision: noneDecision(from, cur) }; // 束ね中は起点を更新しない (DESIGN §3.4 規則6)
    st.burstAnchorMs = now;
    if (isSwapCoolingDown(st, now)) return { state: st, decision: noneDecision(from, cur) };
    if (kind === "none") return { state: st, decision: noneDecision(from, cur) };
    st.lastFiredMs = now;
    return { state: st, decision: { fire: true, reason: kind, fromTypeId: from, toTypeId: cur, volume: SWAP_VOLUME, pitch: swapPitchFor(kind) } };
  } catch { return { state: state && typeof state === "object" ? state : createSwapSoundState(), decision: noneDecision(null, null) }; }
}
