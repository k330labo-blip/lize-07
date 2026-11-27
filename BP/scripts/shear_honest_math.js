// shear_honest_math.js — SHEAR-HONEST-01 (0-N5, 外部評価 v0.5.185 由来, cyc2452): 羊毛刈りの正直化 純粋核。
// 世界を読まない・例外を投げない・決定的。
//
// API切り分け (cyc2452 統括): 正式版 @minecraft/server 2.0.0 には、プレイヤーでない
// エンティティ (リゼ) が「アイテムを別のエンティティへ使う」手段が無い。
// playerInteractWithEntity はプレイヤーの操作の通知イベントであり Bot から発火できない。
// 羊の被毛状態 (sheared) を読み書きする正式版 API も無く、BP 全体でも参照は0件だった。
// よって本物の毛刈りは実装できない。黙って討伐方式へ化かすのではなく、受理時に
// 方式の違いを明示し、使わないハサミの調達・装備はしない (0-C7 の原則)。
// 実機での最終確認は未実施 (実機確認待ち)。

export const SHEAR_DISCLOSURE_NOTE = "毛刈りはできません。ハサミで刈るのではなく、羊を倒して羊毛を取る形になります。";

function bareId(id) {
  if (typeof id !== "string" || !id) return "";
  return id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
}

// 羊毛ファミリーか (白 wool / 色付き *_wool / 素の wool)。カーペット等は対象外。
export function isWoolTargetId(id) {
  const b = bareId(id);
  return b === "wool" || b.endsWith("_wool");
}

export function isShearsTool(tool) {
  try {
    if (!tool) return false;
    const raw = typeof tool === "string" ? tool : (tool.item || tool.typeId || tool.id || null);
    if (typeof raw !== "string" || !raw) return false;
    return bareId(raw) === "shears";
  } catch { return false; }
}

// 入力: { tool, target, raw, kind }
//   tool: 注文の tool 指定、target: 対象ID (item/block)、raw: 原文、kind: 注文種別
// 毛刈りの意図がある羊毛注文 (ハサミ指定、または「刈」る動詞) なら方式明示の印を返す。
// それ以外 (通常の羊毛集め・羊の討伐・ハサミ自体の作製) は null (正常例を壊さない)。
export function shearDisclosureFor(input) {
  try {
    const kind = input?.kind ?? "gather";
    if (kind !== "gather") return null;
    if (!isWoolTargetId(input?.target)) return null;
    const raw = typeof input?.raw === "string" ? input.raw : "";
    if (!isShearsTool(input?.tool) && !/刈/.test(raw)) return null;
    return { method: "kill_instead_of_shear", suppressTool: true, note: SHEAR_DISCLOSURE_NOTE };
  } catch { return null; }
}

// SHEAR 否定併記形 (0-N5 残存, cyc2457 A03 裁定 (b), cyc2458 統合):
// 「羊を殺さずに羊毛を集めて」では、羊毛の直接の入手元である羊の討伐が禁止されている。
// 毛刈りは実装できず (上記)、糸からの合成への読み替えは計画層・実行層に受け皿が無い
// (別件「禁止ソースの読み替え」)。禁止に反する討伐方式で受理するのは 0-C7 違反のため、
// 明示して開始しない。判定は毛刈り意図 (ハサミ/刈) とは別軸: gather の羊毛注文で、
// negations に羊 (entity sheep) の hunt 禁止 (verb 無指定も含む) があれば発火する。
export const SHEAR_FORBID_BLOCK_NOTE = "羊を倒さずに羊毛を取る手段が、私にはありません。毛刈りはできず、糸からの合成も今は選べません。この指示は受けていません。";

// 入力: { target, kind, negations } — negations は parseOrder の形
// ({ target: { item, block, entity }, verb } の配列) をそのまま受ける。
export function shearForbidBlockFor(input) {
  try {
    const kind = input?.kind ?? "gather";
    if (kind !== "gather") return null;
    if (!isWoolTargetId(input?.target)) return null;
    const negs = Array.isArray(input?.negations) ? input.negations : [];
    const hit = negs.some((n) => {
      const ent = n?.target?.entity ?? null;
      if (!ent || bareId(String(ent)) !== "sheep") return false;
      return n?.verb == null || n.verb === "hunt";
    });
    if (!hit) return null;
    return { method: "blocked_by_forbid", note: SHEAR_FORBID_BLOCK_NOTE };
  } catch { return null; }
}
