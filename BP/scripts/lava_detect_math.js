// lava_detect_math.js — cycle0721 (LAVA-01/02): 溶岩検知の分離 (純粋核)
// c.danger.lavaNear は Bot 足元専用に残し、主人向け警告は ownerLavaNear、
// 落下先警告は lavaBelow (下方走査) へ分離するための分類・集約だけを行う。
// @minecraft/server を import しない。例外を投げない。
export const LAVA_BELOW_SCAN = 10; // 足元-2 から -11 まで (落下回避が間に合う窓)

export function isLavaId(id) {
  return typeof id === "string" && id.includes("lava");
}

// 主人の足元-1 セルと水平4近傍 (いずれも typeId の配列) のうち1つでも溶岩なら true。
export function ownerLavaNearFromIds(ids) {
  if (!Array.isArray(ids)) return false;
  for (const id of ids) if (isLavaId(id)) return true;
  return false;
}

// 足元-2 から下方向へ並んだ typeId 列 (先頭が最も浅い) を走査し、
// 最初に見つけた溶岩までの距離 (足元からの段数) を返す。無ければ null。
export function lavaBelowFromIds(ids) {
  if (!Array.isArray(ids)) return null;
  for (let i = 0; i < ids.length; i++) {
    if (isLavaId(ids[i])) return i + 2;
  }
  return null;
}
