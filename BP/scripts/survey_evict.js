// survey_evict.js — survey Map 容量削除の複合キー (案C, cycle2006) 純粋核
// 削除優先: TTL切れ・未完了 (tier0) → 未完了 (tier1) → 完了ラッチ済み (tier2)、同 tier は wantAt 古い順。
// F1ラッチ (doneAt) を容量削除で真っ先に消さないための是正。
export const SURVEY_TTL_MS_EVICT = 15 * 60 * 1000;
export function surveyEvictTier(sv, now, ttlMs = SURVEY_TTL_MS_EVICT) {
  if (!sv || typeof sv !== "object") return 0;
  const done = sv.doneMask === 0xffff && sv.doneAt != null;
  const fresh = typeof sv.at === "number" && now - sv.at < ttlMs;
  const hasHits = !!sv.hits && typeof sv.hits === "object" && Object.values(sv.hits).some((a) => Array.isArray(a) && a.length > 0);
  const progress = typeof sv.doneMask === "number" ? (sv.doneMask & 0xffff).toString(2).split("1").length - 1 : 0;
  if (!fresh && !done && !hasHits && progress < 8) return 0; // S3 (cycle2006敵対監査): ヒット持ちは陳腐でも真っ先に消さない / cyc2369 SURVEY-EVICT-PROGRESS-01: 進捗1/2以上もヒット持ちと同格に保護する
  if (!done) return 1;
  return 2;
}
export function compareSurveyEvict(a, b, now, ttlMs = SURVEY_TTL_MS_EVICT) {
  const d = surveyEvictTier(a, now, ttlMs) - surveyEvictTier(b, now, ttlMs);
  if (d !== 0) return d;
  return (a?.wantAt || 0) - (b?.wantAt || 0);
}
export function pickSurveyEvictions(entries, count, now, ttlMs = SURVEY_TTL_MS_EVICT) {
  if (!Array.isArray(entries)) return [];
  return [...entries].sort((x, y) => compareSurveyEvict(x[1], y[1], now, ttlMs)).slice(0, count);
}
