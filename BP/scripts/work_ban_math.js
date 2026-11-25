// work_ban_math.js — work層の見切り ban (cycle0832, 収穫F5 是正)
// 問題: noteWorkHold は30秒累計で r.work を落とす出口を持つが、落とした先に
// 対象セルへの ban が無く、到達不能な最寄り候補 (囲われた畑の成熟作物等) を
// 次tickで選び直して30秒 hold を無限に繰り返す (キュー0-A バグ2と同型で、
// 作物では ban 自体の欠落として残っていた)。
// 是正: hold枯渇の発生点で対象を作業層共通の短期 ban (60秒) へ登録し、
// startWork の入口で ban 中対象を外す。キーは trunk_ban.banKeyFor が単一の正
// (原木/幹は幹キー、それ以外はセルキー) なので、原木では「見つけたセル≠
// 掘る最下段」の単位不一致も同時に防ぐ。作物専用分岐は入れない。
// 純粋核: @minecraft/server を import しない (banKeyFor は trunk_ban.js から)。
// 例外を投げない。now は引数で受ける。不正入力は「ban されていない」へ倒す。
import { banKeyFor } from "./trunk_ban.js";

export const WORK_BAN_MS = 60000;

export function createWorkBanState() {
  return { byKey: Object.create(null) };
}

function validState(state) {
  return !!state && typeof state === "object" && !!state.byKey && typeof state.byKey === "object";
}

/** hold枯渇1回の記録。until は延長のみ (短縮しない)。 */
export function recordWorkBan(state, loc, typeId, now, banMs = WORK_BAN_MS) {
  try {
    if (!validState(state)) return { recorded: false, key: null, until: null };
    if (!Number.isFinite(now) || !Number.isFinite(banMs) || banMs <= 0) return { recorded: false, key: null, until: null };
    const key = banKeyFor(loc, typeId);
    if (!key) return { recorded: false, key: null, until: null };
    const until = now + banMs;
    const prev = typeof state.byKey[key] === "number" ? state.byKey[key] : -Infinity;
    state.byKey[key] = Math.max(prev, until);
    return { recorded: true, key, until: state.byKey[key] };
  } catch { return { recorded: false, key: null, until: null }; }
}

/** 候補 (loc, typeId) が ban 中か。期限境界は now >= until で失効。 */
export function isWorkBanned(state, loc, typeId, now) {
  try {
    if (!validState(state) || !Number.isFinite(now)) return false;
    const key = banKeyFor(loc, typeId);
    if (!key) return false;
    const until = state.byKey[key];
    return typeof until === "number" && now < until;
  } catch { return false; }
}

/** 失効エントリの間引き (状態の無制限な増殖を防ぐ)。 */
export function pruneWorkBans(state, now) {
  try {
    if (!validState(state) || !Number.isFinite(now)) return 0;
    let removed = 0;
    for (const k of Object.keys(state.byKey)) {
      const u = state.byKey[k];
      if (typeof u !== "number" || now >= u) { delete state.byKey[k]; removed++; }
    }
    return removed;
  } catch { return 0; }
}
