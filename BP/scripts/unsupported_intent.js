// unsupported_intent.js — 0-C7 (cycle1337): 未対応の依頼が知識説明・計算・別作業へ流れて
// 「受理されたのか判断できない」状態になるのを防ぐ純粋核。意図の形 (座標三つ組+移動動詞、
// 条件節+動詞のみの後続、容器+出し入れ動詞、手持ち+受け渡し動詞、案内+目的地) だけで判定し、
// 対応する実行経路が無いものは「何ができないか」をその場で返すための分類を返す。
// 純粋: @minecraft/server を import しない。例外を投げない。迷ったら null (従来経路) へ倒す。
// 判定材料として parseOrder の結果 (parsedKind / hasTarget) を任意で受け取る:
// 注文として成立している発話 (材料メンションのある条件付き注文など) はゲート対象にしない。

function s(v) { return typeof v === "string" ? v : ""; }

const COORD_TRIPLE_RE = /-?\d{1,6}[\s,、]+-?\d{1,6}[\s,、]+-?\d{1,6}/;
const MOVE_VERB_RE = /来て|来い|行って|移動して|向かって|集合して/;
const COND_PREFIX_RE = /たら|なったら|になったら|降ったら|れば|ている間|てる間/;
const COND_ACTION_RE = /戻って|帰って|帰還|来て|待って|寝て|休んで/;
const CONTAINER_RE = /チェスト|倉庫|トラップチェスト|樽|バレル|シュルカー/;
const TRANSFER_VERB_RE = /出して|取り出して|取出して|入れて|しまって|預けて|移して/;
const HELD_RE = /手持ち|持っている|持ってる/;
const HANDOVER_RE = /渡して|渡す|ちょうだい|頂戴/;
const GUIDE_RE = /案内して|案内し|連れて行って|連れてって|連れていって/;
const GUIDE_DEST_RE = /まで|拠点|家|座標|村|入口|出口/;

export function detectUnsupportedIntent(text, opts = {}) {
  try {
    const t = s(text);
    if (!t) return null;
    const parsedKind = opts && typeof opts.parsedKind === "string" ? opts.parsedKind : null;
    const hasTarget = !!(opts && opts.hasTarget);
    const hasOrder = !!parsedKind && parsedKind !== "clarify" && hasTarget;

    // 手持ちの受け渡し: parseOrder が採集に化けるため、注文成立でも優先して止める
    if (HELD_RE.test(t) && HANDOVER_RE.test(t)) {
      return { kind: "hand_over_held", missing: "手持ちの物を渡す指定", reply: "それはまだできません。手持ちの物を渡す指定は、文字指示では未対応です" };
    }
    // 案内 (先導): escort (追随) として受理されてしまうため、注文成立でも止める
    if (GUIDE_RE.test(t) && GUIDE_DEST_RE.test(t)) {
      return { kind: "guide_to", missing: "目的地への案内", reply: "それはまだできません。目的地への案内は未対応です。ついてくることはできます" };
    }
    // 指定座標への移動: 座標は数の組であって計算式ではない。質問形は対象外
    if (COORD_TRIPLE_RE.test(t) && MOVE_VERB_RE.test(t) && !/[？?]/.test(t) && !/教えて|ですか/.test(t)) {
      return { kind: "goto_coord", missing: "指定した座標への移動", reply: "それはまだできません。指定した座標への移動は、文字指示では未対応です" };
    }
    // 以下は注文として成立していない発話だけを対象にする (成立した注文は壊さない)
    if (hasOrder) return null;
    // 条件節 + 動詞のみの後続 (「夜になったら拠点に戻って」): 条件付きの帰還・移動の予約は未対応。
    // 材料メンションのある条件付き注文は parseOrder が condition 付きで成立させるため、ここには来ない
    if (COND_PREFIX_RE.test(t) && COND_ACTION_RE.test(t) && !hasTarget) {
      return { kind: "cond_action_only", missing: "条件が来たら動く予約", reply: "それはまだできません。条件が来たら動く予約は、文字指示では未対応です" };
    }
    // チェスト等の出し入れ: 実行部は内部にあるが、文字指示から到達する経路が無い
    if (CONTAINER_RE.test(t) && TRANSFER_VERB_RE.test(t)) {
      return { kind: "chest_transfer", missing: "チェストの出し入れ", reply: "それはまだできません。チェストの出し入れは、文字指示では未対応です。集めた物の入庫は自動で行います" };
    }
    return null;
  } catch { return null; }
}
