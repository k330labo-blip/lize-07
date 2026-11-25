// spiral.js — 螺旋階段の潜行パターン (要望バッチB、v0.4.90 で正式化。設計: brain_parts/solutions/dig-reach-spiral)
//
// tickBranchMine の縦穴 (足元を掘って真下に降りる) を置き換えるための純粋幾何モジュール。
// 移動・掘削は持たない。ステップ列の幾何だけを決める (teleport_gate / work_access と同型に、
// 統合時は main.js 側が dig_gate + tunnel ゲートを通して実行する)。
//
// 形状: 2×2 螺旋。ステップ k の足元セルは、2×2 フットプリントの角を 1 周 4 ステップで
// 回りながら 1 ステップごとに 1 段下がる (1 周 = 4 段)。古典的な 2x2 spiral staircase
// と同じ形で、特徴は:
//   - 各ステップの移動は「水平 1 セル + 下降 1」だけ。落下距離は常に 0 (段差 1 は歩行可能)。
//   - 上りも同じ列を逆にたどれば段差 1 ずつで歩いて戻れる (tunnelPath 互換)。
//   - ステップ k+1 を開くのに掘るセルは、その足元と頭上の 2 セルだけ。
//     どのステップの「床」(足元セルの真下) も掘らないため、階段が自壊しない
//     (test_spiral.mjs で全ステップについて機械検証する)。
//   - 中心柱は持たない (2×2 の内側は 4 セルともステップ列が使う)。
//
// 状態: { x0, z0, y0, targetY, chirality, phase, k }
//   (x0, z0) は 2×2 フットプリントの原点 (最小 x/z の角)、y0 はステップ 0 の足元 Y。
//   ステップ k の足元セル = (x0 + off[k mod 4].x, y0 - k, z0 + off[k mod 4].z)。
//   状態は r.mineLeg 配下に持つ想定 (r.tunnel と同じ runtime 保持)。
//   再開時は locateK で現在位置から k を復元できる (幾何が位置から決まるため)。
//
// バリアント: 回転方向 (cw/ccw) × 開始角の回転 (phase 0..3) の 8 通り。
// 目標深度での出口の向き (ステップ K→K+1 の水平方向) がバリアントで変わるため、
// chooseVariant で目標鉱石の水平方向に最も近い出口を持つものを選ぶ。
// 合わなくても最終段から tickTunnel の水平掘りで接続できる (フォールバック)。

export const SPIRAL = {
  // 時計回り (上から見て +x → +z → -x → -z) と反時計回りの角列
  CYCLES: {
    cw: [[0, 0], [1, 0], [1, 1], [0, 1]],
    ccw: [[0, 0], [0, 1], [1, 1], [1, 0]],
  },
};

export function spiralCycle(chirality = "cw", phase = 0) {
  const base = SPIRAL.CYCLES[chirality] || SPIRAL.CYCLES.cw;
  const out = [];
  for (let i = 0; i < 4; i++) out.push(base[(i + phase) % 4]);
  return out;
}

// (x, z, y) をステップ 0 として螺旋を開始する。原点は cycle[0] が (x,z) に一致するよう逆算する。
export function createSpiral({ x, z, y, targetY, chirality = "cw", phase = 0 }) {
  const cyc = spiralCycle(chirality, phase);
  return {
    x0: x - cyc[0][0], z0: z - cyc[0][1],
    y0: y, targetY, chirality, phase, k: 0,
  };
}

export function spiralStepsTotal(state) {
  return Math.max(0, state.y0 - state.targetY);
}

// ステップ k の足元セル { x, y, z }
export function spiralStepCell(state, k = state.k) {
  const cyc = spiralCycle(state.chirality, state.phase);
  const [dx, dz] = cyc[k % 4];
  return { x: state.x0 + dx, y: state.y0 - k, z: state.z0 + dz };
}

// ステップ k (k>=1) を開くために掘る構造セル: 頭上 → 足元の順。
// 順序が本質: 足元セルは 6 近傍が全て固体 (斜め下にしか開空間が無い) ため、
// 先に掘ろうとすると dig_gate が enclosed で正しく拒否する。頭上セルは
// 現在のステップの足元セルと水平に面しているので常に先に掘れ、頭上が開けば
// 足元セルも「開空間に面した」状態になって掘れるようになる。
// 実行時は各セルを dig_gate.evaluateDig に通すこと (区間の角をかすめるセルが
// dig_first として先に返る場合がある。その追加セルは階段の床ではないため掘ってよい)。
// 既に空いているセル (地表直下の頭上など) は掘らずに開通済みとして扱う。
export function spiralDigCells(state, k) {
  const f = spiralStepCell(state, k);
  return [{ x: f.x, y: f.y + 1, z: f.z }, f];
}

// ステップ j の床セル (絶対に掘らない)
export function spiralFloorCell(state, j) {
  const f = spiralStepCell(state, j);
  return { x: f.x, y: f.y - 1, z: f.z };
}

// ステップ k → k+1 の水平移動方向 [dx, dz]
export function spiralHeading(state, k = state.k) {
  const a = spiralStepCell(state, k), b = spiralStepCell(state, k + 1);
  return [b.x - a.x, b.z - a.z];
}

// 現在位置 (エンティティ座標) から k を復元する。再開・割り込み後の再同期用。
// 候補が無ければ null (螺旋の外にいる)。
export function spiralLocateK(state, pos) {
  const fx = Math.floor(pos.x), fy = Math.floor(pos.y), fz = Math.floor(pos.z);
  const total = spiralStepsTotal(state);
  for (let k = 0; k <= total + 4; k++) {
    const c = spiralStepCell(state, k);
    if (c.x === fx && c.y === fy && c.z === fz) return k;
  }
  return null;
}

// 目標深度での出口の向きが wantDir ([dx,dz]、省略可) に最も近いバリアントを選ぶ。
// 戻り値 { chirality, phase, heading, score } (score は方向ベクトルの内積、1=一致)。
export function chooseSpiralVariant({ y0, targetY, wantDir = null }) {
  const K = Math.max(0, y0 - targetY);
  let best = null;
  for (const chirality of ["cw", "ccw"]) {
    for (let phase = 0; phase < 4; phase++) {
      const st = { x0: 0, z0: 0, y0, targetY, chirality, phase, k: K };
      const h = spiralHeading(st, K);
      const score = wantDir ? (h[0] * wantDir[0] + h[1] * wantDir[1]) : 0;
      if (!best || score > best.score) best = { chirality, phase, heading: h, score };
    }
  }
  return best;
}
