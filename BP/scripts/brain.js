// 意思決定: 文脈を受け取り「移動ルール」と「発話ルール」を別々に選ぶ二層構造（監査指摘への対応）
// 手書きルール（1,400件超）で移動が決まらない場合は、1,440万通りのコンパイル済み決定木に落とす。
import { ALL_RULES, SPEECH_ACTS, GAZE_RULES } from "./brain/all.js";
import { compiledDecide } from "./brain/compiled_brain.js";

// 文脈 → コンパイル済み脳のシグネチャ（軸の意味は tools/gen_matrix.mjs の AXES 定義が正）
export function toSig(c) {
  const x = c.x || {};
  const mode = { follow: 0, stay: 1, work: 2, free: 3 }[c.mode] ?? 0;
  const dim = x.dimension === "nether" ? 1 : x.dimension === "end" ? 2 : 0;
  let danger = 0;
  if (x.bossNear) danger = 5;
  else if (c.danger.safetyCreeperDist < 8) danger = 4; // 0-O2
  else if (c.danger.safetyNearestDist < 900) danger = c.danger.safetyNearestDist <= 6 ? 3 : c.danger.safetyNearestDist <= 12 ? 2 : 1; // 0-O2
  let drops = 0;
  if (c.drops.ownerDroppedDist >= 0) drops = 4;
  else if (c.drops.valuableDist >= 0) drops = 2;
  else if (c.drops.foodDist >= 0) drops = 3;
  else if (c.drops.count > 0) drops = 1;
  let inv = 1;
  if (c.inv.full) inv = 4;
  else if (c.inv.hasValuable) inv = 3;
  else if (c.inv.hasFood) inv = 2;
  else if (c.inv.used <= 3) inv = 0;
  const time = c.env.isDawn ? 3 : c.env.isDusk ? 1 : c.env.isNight ? 2 : 0;
  const biome = x.biome === "desert" ? 1 : x.biome === "snow" ? 2 : x.biome === "jungle" ? 3 : x.biome === "ocean" ? 4 : 0;
  let owner = 0;
  if (!c.owner.present) owner = 4;
  else if (c.owner.hpPct < 0.3) owner = 2;
  else if (c.owner.hunger <= 6) owner = 3;
  else if (c.owner.hpPct < 0.7) owner = 1;
  const sp = c.self.hpPct;
  const selfHp = sp >= 0.95 ? 0 : sp >= 0.6 ? 1 : sp >= 0.3 ? 2 : 3;
  let home = 0;
  if (c.home.registered) home = c.home.chestFull ? 3 : c.home.chestMissing ? 4 : c.home.dist < 20 ? 2 : 1;
  const weather = c.env.isThundering || c.env.isRaining ? 1 : 0;
  const crowd = (x.othersNear || 0) > 0 ? 1 : 0;
  return { mode, dim, danger, drops, inv, time, biome, owner, selfHp, home, weather, crowd };
}

export function decideGaze(ctx) {
  for (const r of GAZE_RULES) {
    let hit = false;
    try { hit = r.when(ctx) === true; } catch { hit = false; }
    if (hit) return r;
  }
  return null;
}

export function decide(ctx) {
  let move = null, speech = null, stayAnchor = null;
  for (const r of ALL_RULES) {
    let hit = false;
    try { hit = r.when(ctx) === true; } catch { hit = false; }
    if (!hit) continue;
    if (r.act === "stay_anchor" && !stayAnchor) stayAnchor = r;
    if (SPEECH_ACTS.has(r.act)) { if (!speech) speech = r; }
    else if (!move) move = r;
    if (move && speech && stayAnchor) break;
    // stayAnchor は差し替え判定に必要なので、move/speech が揃っても stayAnchor 未発見なら走査を続ける。
    // ただし stayAnchor が speech 扱いになることはない（act は stay_anchor 固定）。
    if (move && speech && ctx.mode !== "stay") break;
  }
  // stay_anchor 優先: 待機モードで idle_hover 等にアンカー維持が負ける弱点の修正。
  // move が無いか move.p < 900（安全帯未満）なら、アンカー維持に差し替える。
  if (ctx.mode === "stay" && stayAnchor && (!move || move.p < 900)) move = stayAnchor;
  // 睡眠中の発話抑止: 主人が寝ている間に挨拶・祝い等で騒がない（p900 以上の緊急発話は残す）。
  if (ctx.x?.ownerInBed && speech && speech.p < 900) speech = null;
  if (!move) {
    try { move = { id: "compiled_matrix", p: 0, act: compiledDecide(toSig(ctx)), say: null }; } catch {}
  }
  return { move, speech };
}
