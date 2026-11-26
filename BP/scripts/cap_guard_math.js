// cap_guard_math.js — 0-C2 読み手 (cycle1337): 「N体以上は狩らないで」型の上限 (caps) の
// 正規化と照合の純粋核。保持の形 (order_parser の caps / r.caps / mission 制約) は変えず、
// 実行側が読むための単一の正を提供する。純粋: @minecraft/server を import しない。例外を投げない。
// 上限の意味は既存の復唱 ("〜はNまでです。それ以上はしません") と一致させる: cap = 許容最大数。

export function normCapId(id) {
  try {
    if (typeof id !== "string" || !id) return null;
    return id.includes(":") ? id : `minecraft:${id}`;
  } catch { return null; }
}

// caps 配列を {target: 完全ID, cap: 正整数, verb} の形へ正規化する。不正な要素は落とす。
export function normalizeCaps(caps) {
  try {
    if (!Array.isArray(caps)) return [];
    const out = [];
    for (const c of caps) {
      if (!c || typeof c !== "object") continue;
      const rawT = typeof c.target === "string" ? c.target : (c.target?.item || c.target?.block || c.target?.entity || null);
      const target = normCapId(rawT);
      const cap = typeof c.cap === "number" && Number.isFinite(c.cap) ? Math.floor(c.cap) : NaN;
      if (!target || !Number.isFinite(cap) || cap < 1) continue;
      out.push({ target, cap, verb: typeof c.verb === "string" ? c.verb : null });
    }
    return out;
  } catch { return []; }
}

// 複数リストを正規化して結合する (同一 target+verb は最小の cap を残す = 厳しい方が勝つ)。
export function mergeCaps(...lists) {
  try {
    const byKey = new Map();
    for (const list of lists) {
      for (const c of normalizeCaps(list)) {
        const k = `${c.target}|${c.verb ?? ""}`;
        const prev = byKey.get(k);
        if (!prev || c.cap < prev.cap) byKey.set(k, c);
      }
    }
    return [...byKey.values()];
  } catch { return []; }
}

// target に対する上限を返す。verb が指定された場合は verb 一致 (または verb 未指定の cap) だけを見る。
// 該当が無ければ null (= 上限なし。0 や Infinity で代用しない)。
export function capForTarget(caps, targetId, verb = null) {
  try {
    const t = normCapId(targetId);
    if (!t) return null;
    let best = null;
    for (const c of normalizeCaps(caps)) {
      if (c.target !== t) continue;
      if (verb != null && c.verb != null && c.verb !== verb) continue;
      if (best === null || c.cap < best) best = c.cap;
    }
    return best;
  } catch { return null; }
}

// 0-C2 (cyc2020): セッション caps の DP 永続化形式。保存は正規化済み配列の JSON、
// 復元は normalizeCaps を通すため壊れた保存は上限なし (空配列) に倒れる。at 等の付随情報は保存しない。
export function serializeCaps(caps) {
  try { return JSON.stringify(normalizeCaps(caps).slice(-16)); } catch { return "[]"; }
}
export function restoreCaps(json) {
  try { if (typeof json !== "string" || !json) return []; return normalizeCaps(JSON.parse(json)); } catch { return []; }
}

// 狩猟の必要数を上限で clamp する。cap が無い場合は need をそのまま返す。
export function clampHuntNeed(need, caps, targetId, verb = "hunt") {
  try {
    const n = typeof need === "number" && Number.isFinite(need) ? Math.max(1, Math.floor(need)) : 1;
    const cap = capForTarget(caps, targetId, verb);
    return cap === null ? n : Math.min(n, cap);
  } catch { return 1; }
}
