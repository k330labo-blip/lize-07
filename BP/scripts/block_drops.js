// block_drops.js — リゼ (LIZE-07) 基礎 N1 是正 (cycle2319 v0.4.65 で正式化、a02 ドラフトが原案)
// 純粋モジュール: sourcing.js の決定的 block 源を逆引きし、
// 「ブロックを壊したら何が・最低いくつ手に入るか」を決める。
//
// 背景 (N1, brain_parts/solutions/cycle2303-a13-stuck-gather/REPORT.md):
//   実行部 (tickWork) の獲得決定が sourcing の dropItem / yield を参照せず、
//   ブロックID != ドロップの採取 13 件で進捗が永遠に立たなかった。
//   修正方向は「獲得決定の正を sourcing の源定義へ一本化する」であり、
//   本モジュールはその逆引き層 (block -> drop) だけを担う純粋核である。
//   アイテム個別分岐は持たない。データは sourcing.js が単一の正。
//
// 決定的 block 源の定義 (本ドラフトの契約):
//   kind === "block"
//   かつ dropItem が非空文字列
//   かつ yield が [min, max] (有限数, 1 <= min <= max)
//   すなわち yield[0] >= 1 = 「壊せば最低 1 個は必ず出る」源だけを採用する。
//   確率源 (yield[0] === 0: chorus_fruit / flint / 棒 / リンゴ等) と
//   収量 0 (ice [0,0]) は決定的獲得として扱わない (別途、副産物/確率の
//   進捗モデルで扱うべきもので、本モジュールの範囲外)。
//   process (smelt/craft) は不問: dropItem は「ブロックから落ちる物」で、
//   process はその後の工程を指すため、逆引きの可否には影響しない。
//
// 競合規則 (fail-closed):
//   同一ブロックに異なる dropItem の決定的源が複数ある場合、そのブロックは
//   「決定的に決められない」として索引から除外し conflicts に記録する。
//   推奨順の先頭を黙って採用するような推測はしない。
//   同一ブロック・同一 dropItem の重複源 (例: iron_ore は iron_ingot 経由と
//   raw_iron 経由の 2 件) は統合する: yieldMin は各源の最小値のうち最小
//   (保証を過大に言わない保守側)、yieldMax は各源の最大値のうち最大。
//   統合は可換演算のみで決まるため、走査順に依存しない。
//
// 境界:
//   純粋関数のみ。@minecraft/server 非依存。Date.now() / 乱数を使わない。
//   例外を投げない (不正入力・壊れたエントリ・例外を投げる getter は
//   スキップないし null で吸収する)。入力 (sourcing テーブル) は変更しない。
//   返却するエントリと索引は凍結し、yield 配列は複製して返す。
//   BP へは未接続。これは統合前のドラフトであり、共有ファイルは編集していない。
//
// 統合時裁定 (cycle2319 a03 反対監査):
//   ハサミ相当が必要でリゼには採取できないと sourcing の note 自身が明記する
//   ブロック (bee_nest / vine) は決定的獲得にしない。現行のフォールバック挙動を
//   そのまま残し、sourcing の「採取不可」注記と実行部の付与が矛盾しないようにする。
//   これは知識データとしての除外であり、アイテム個別の分岐ではない。
export const HAND_UNOBTAINABLE = Object.freeze(new Set(["minecraft:bee_nest", "minecraft:vine"]));

import { SOURCING } from "./sourcing.js";

// ---------- 内部ユーティリティ (例外安全な読み取り) ----------

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

// yield が決定的範囲 [min, max] (1 <= min <= max, 有限数) なら [min, max] を、
// そうでなければ null を返す。yield 本体は変更しない。
function deterministicYield(y) {
  try {
    if (!Array.isArray(y) || y.length < 2) return null;
    const min = y[0];
    const max = y[1];
    if (typeof min !== "number" || typeof max !== "number") return null;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (min < 1 || max < min) return null;
    return [min, max];
  } catch {
    return null;
  }
}

// ---------- 公開 API ----------

// 1 件の sourcing 源が「決定的 block 源」かどうか。
// 壊れた値 (null / 非オブジェクト / getter 例外) は false。
export function isDeterministicBlockSource(source) {
  try {
    if (!source || typeof source !== "object") return false;
    if (source.kind !== "block") return false;
    if (!isNonEmptyString(source.id)) return false;
    if (!isNonEmptyString(source.dropItem)) return false;
    return deterministicYield(source.yield) !== null;
  } catch {
    return false;
  }
}

// sourcing テーブルから逆引き索引を構築する。
// 返り値 (凍結): {
//   byBlock:   { [blockId]: frozen { block, dropItem, yieldMin, yieldMax, yield:[min,max] } },
//   conflicts: frozen [{ block, dropItems: frozen [...] }],  // dropItem 競合で除外したブロック
//   stats:     frozen { entries, blockSources, deterministicSources, indexedBlocks, conflictBlocks }
// }
// 入力がテーブルでない場合は空の索引を返す (例外は投げない)。入力は変更しない。
export function buildBlockDropIndex(sourcing) {
  const stats = { entries: 0, blockSources: 0, deterministicSources: 0, indexedBlocks: 0, conflictBlocks: 0 };
  // blockId -> { dropItem, yieldMin, yieldMax } の作業用マップ (内部のみ・非公開)
  const merged = new Map();
  // blockId -> Set<dropItem> (競合検出用)
  const dropSets = new Map();
  try {
    if (!sourcing || typeof sourcing !== "object") {
      return freezeIndex({}, [], stats);
    }
    let entries;
    try { entries = Object.entries(sourcing); } catch { return freezeIndex({}, [], stats); }
    for (const [, entry] of entries) {
      stats.entries++;
      try {
        if (!entry || typeof entry !== "object") continue;
        const sources = entry.sources;
        if (!Array.isArray(sources)) continue;
        for (const source of sources) {
          try {
            if (!source || typeof source !== "object") continue;
            if (source.kind !== "block") continue;
            stats.blockSources++;
            if (HAND_UNOBTAINABLE.has(source.id)) continue; // 裁定: ハサミ必須で採取不可 (sourcing note)
            if (!isDeterministicBlockSource(source)) continue;
            const yr = deterministicYield(source.yield);
            if (!yr) continue; // isDeterministicBlockSource と二重だが getter 変動にも fail-closed
            stats.deterministicSources++;
            const block = source.id;
            const dropItem = source.dropItem;
            if (!dropSets.has(block)) dropSets.set(block, new Set());
            dropSets.get(block).add(dropItem);
            const cur = merged.get(block);
            if (!cur) {
              merged.set(block, { dropItem, yieldMin: yr[0], yieldMax: yr[1] });
            } else if (cur.dropItem === dropItem) {
              // 保守的統合: 保証 (min) は小さい方、見込み上限 (max) は大きい方
              if (yr[0] < cur.yieldMin) cur.yieldMin = yr[0];
              if (yr[1] > cur.yieldMax) cur.yieldMax = yr[1];
            }
          } catch {
            continue; // 壊れた源は 1 件だけ捨て、索引全体は壊さない
          }
        }
      } catch {
        continue; // 壊れたエントリはスキップ
      }
    }
  } catch {
    // ここに来ても空索引を返す (呼び出し側を例外で止めない)
    return freezeIndex({}, [], { entries: 0, blockSources: 0, deterministicSources: 0, indexedBlocks: 0, conflictBlocks: 0 });
  }
  const byBlock = {};
  const conflicts = [];
  for (const [block, m] of merged) {
    const drops = dropSets.get(block);
    if (drops && drops.size > 1) {
      conflicts.push(Object.freeze({ block, dropItems: Object.freeze([...drops].sort()) }));
      continue; // 競合ブロックは索引に入れない
    }
    byBlock[block] = Object.freeze({
      block,
      dropItem: m.dropItem,
      yieldMin: m.yieldMin,
      yieldMax: m.yieldMax,
      yield: Object.freeze([m.yieldMin, m.yieldMax]),
    });
  }
  conflicts.sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0));
  stats.indexedBlocks = Object.keys(byBlock).length;
  stats.conflictBlocks = conflicts.length;
  return freezeIndex(byBlock, conflicts, stats);
}

function freezeIndex(byBlock, conflicts, stats) {
  return Object.freeze({
    byBlock: Object.freeze(byBlock),
    conflicts: Object.freeze(conflicts),
    stats: Object.freeze({ ...stats }),
  });
}

// sourcing.js から構築した既定の索引 (モジュール読み込み時に 1 回だけ構築)。
export const BLOCK_DROP_INDEX = buildBlockDropIndex(SOURCING);

// ブロック ID から決定的獲得を引く。
//   dropForBlock("minecraft:melon_block")
//     -> frozen { block, dropItem: "minecraft:melon_slice", yieldMin: 3, yieldMax: 7, yield: [3, 7] }
//   未知ブロック / 確率源のみのブロック / 競合ブロック / 不正入力 -> null
// 第 2 引数 index には buildBlockDropIndex の返り値を渡せる (省略時は既定索引)。
// 例外は投げない。返却エントリは凍結済みのため共有しても安全。
export function dropForBlock(blockId, index) {
  try {
    if (!isNonEmptyString(blockId)) return null;
    const key = blockId.trim();
    if (!key) return null;
    const idx = index && typeof index === "object" ? index : BLOCK_DROP_INDEX;
    const byBlock = idx.byBlock;
    if (!byBlock || typeof byBlock !== "object") return null;
    if (!Object.prototype.hasOwnProperty.call(byBlock, key)) return null;
    const hit = byBlock[key];
    if (!hit || typeof hit !== "object") return null;
    if (!isNonEmptyString(hit.dropItem)) return null;
    if (typeof hit.yieldMin !== "number" || !(hit.yieldMin >= 1)) return null;
    return hit;
  } catch {
    return null;
  }
}

// tickWork の既存表 (CROP_DROPS / ORE_DROPS) と同形のタプルで返す薄いラッパ。
// [dropItem, yieldMin] (個数は最小保証 = sourcing yield の下限) か、決められない場合は null。
export function dropTupleForBlock(blockId, index) {
  const hit = dropForBlock(blockId, index);
  return hit ? [hit.dropItem, hit.yieldMin] : null;
}

// 索引に載っているブロック ID の一覧 (ソート済みの新規配列で返す)。
export function listBlockDrops(index) {
  try {
    const idx = index && typeof index === "object" ? index : BLOCK_DROP_INDEX;
    if (!idx.byBlock || typeof idx.byBlock !== "object") return [];
    return Object.keys(idx.byBlock).sort();
  } catch {
    return [];
  }
}
