// goap_sig.js — Phase3 S1b P4拡張 (v0.4.22, cycle1301 A01設計): 計画署名と残必要量
// 純粋関数 computePlanSig(fields) / needRemainOf(need, have)
// - sig 形式 v2: "psig2|2|<mid>|<step>|<type>|<target>|<need>|<goalKey>|<firstStep>"
//   全要素 encodeURIComponent で単射化 (生 ":" 連結は target の ":" と衝突するため不採用)。
// - 解釈不能な材料では代替値を作らず sig=null (材料欠落は照合側で unknown に倒れる)。
// - needRemain/candKey は sig へ埋め込まず別フィールドで照合する (原定義どおり)。
// - 契約: 入力を変更しない / 例外を絶対に投げない / Date.now() を呼ばない。
const enc = (v) => { try { return encodeURIComponent(String(v)); } catch { return null; } };
const normNeed = (v) => { try { const n = typeof v === "number" ? v : NaN; return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : null; } catch { return null; } };
export function needRemainOf(need, have) {
  try {
    const n = normNeed(need); if (n === null) return null;
    const h = typeof have === "number" && Number.isFinite(have) ? Math.max(0, Math.floor(have)) : null;
    if (h === null) return null;
    return Math.max(0, n - h);
  } catch { return null; }
}
export function computePlanSig(f) {
  try {
    if (!f || typeof f !== "object") return null;
    const need = normNeed(f.need); if (need === null) return null;
    const parts = [f.missionId, f.stepIndex, f.stepType, f.target, need, f.goalKey, f.firstStep];
    const out = [];
    for (const p of parts) {
      if (p === null || p === undefined || (typeof p === "string" && p.length === 0)) return null;
      if (typeof p === "number" && !Number.isFinite(p)) return null;
      const e = enc(p); if (e === null) return null;
      out.push(e);
    }
    return "psig2|2|" + out.join("|");
  } catch { return null; }
}
