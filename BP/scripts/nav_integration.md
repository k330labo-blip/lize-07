# nav.js 統合手順（main.js への組み込み）

対象：`BP/scripts/nav.js`（実装済み・tests/test_nav.mjs 全45件合格）を
`BP/scripts/main.js` の移動ループへ組み込む手順。設計の正は `autonomy/navigation_spec.md`。
本書の手順は main.js を書き換える作業者向けで、脳・文脈・到達時アクションには触らない。

## 1. 追加するもの一覧

| 箇所 | 変更 |
|---|---|
| import | `import { createNav, navSetGoal, navClearGoal, navTick, classifyTypeId } from "./nav.js";` を追加 |
| `rt()` の初期値 | `nav: null` を追加（Bot ごとに1つ、遅延生成） |
| 移動ループ（2tick） | 本体を「navTick の結果で path/direct を振り分ける」形に置換。現行処理は `moveDirect(bot, r)` として関数化して温存 |
| 脳ループ（10tick） | `r.target = execTarget(...)` の直後に `syncNavGoal(bot, r)` を1行追加 |
| 新規ヘルパー | `probeFor(dim)`（probe 生成、次元ごとにキャッシュ）、`applyDoors(bot, res, r)`（扉開閉の実適用） |

## 2. probe アダプタ（dimension → probe 関数）

nav.js は純粋関数のため、ブロック参照はこのアダプタが担う。次元が変わると
probe も作り直す必要があるので、runtime に `{ dim, probe }` を持たせる。

```js
const probeCache = new Map(); // dimensionId -> probe
function probeFor(dim) {
  if (probeCache.has(dim.id)) return probeCache.get(dim.id);
  const probe = (x, y, z) => {
    let b = null;
    try { b = dim.getBlock({ x, y, z }); } catch { return null; }
    if (!b) return null; // 未読み込み等は通行不可に倒す
    let api = null;
    try { api = { isSolid: b.isSolid, isLiquid: b.isLiquid }; } catch {}
    return classifyTypeId(b.typeId, api);
  };
  probeCache.set(dim.id, probe);
  return probe;
}
```

注意：
- `classifyTypeId` は typeId リスト照合＋`isSolid` で大半を捌く。溶岩・水・ドア・
  magma・サボテン等は typeId 側で先に確定する。
- トラップドアは「閉＝支持」で固定している（開状態の判別は未実装）。天井トラップドアが
  ある建物で頭セル判定がずれる可能性が残る。実機で気になれば permutation の
  `open_bit` を見て `solid` を切り替える拡張をここに入れる。

## 3. runtime への nav 保持と目標同期

```js
function navOf(bot, r) {
  if (!r.nav) r.nav = createNav(probeFor(bot.dimension));
  // 次元が変わっていたら probe を差し替えて作り直す
  if (r.navDim !== bot.dimension.id) { r.nav = createNav(probeFor(bot.dimension)); r.navDim = bot.dimension.id; }
  return r.nav;
}

// 脳ループ：r.target = execTarget(...) の直後
function syncNavGoal(bot, r) {
  const nav = navOf(bot, r);
  if (!r.target) { navClearGoal(nav); return; }
  // 到達半径は act ごとに現行 execArrive の判定へ寄せる（大まかでよい。最終判定は execArrive 側）
  const arriveRadius = (r.moveAct === "follow" || r.moveAct === "stay_anchor") ? 1 : 0;
  navSetGoal(nav, r.target, { arriveRadius });
}
```

- `navSetGoal` は目標列＋到達半径が変わったときだけ内部状態をリセットする。
  主人が歩くたびに目標列が変わる追従では、再探索は nav 側の最短間隔
  （REPATH_MIN_STEPS=10ステップ=20tick）で抑制される。
- catchup（次元違い・距離20超）の即テレポートは現行 `execTarget` 内の処理を
  そのまま維持する。nav はその後の歩行だけを担う。

## 4. 移動ループの置換

現行ループ本体（`groundY` で Y を決めて `bot.teleport` する部分）を
`moveDirect(bot, r)` として切り出し、ループは次のディスパッチに置き換える。

```js
system.runInterval(() => {
  tick++;
  for (const [id, r] of bots) {
    let bot = null; try { bot = world.getEntity(id); } catch {}
    if (!bot) { bots.delete(id); continue; }
    if (!r.target) continue;
    const nav = navOf(bot, r);
    const res = navTick(nav, bot.location, 0.1, { act: r.moveAct });
    r.navMode = res.mode; // デバッグ表示用（状態メニュー等で参照可）
    if (res.mode === "path" && res.move) {
      try { bot.teleport({ x: res.move.x, y: res.move.y, z: res.move.z }, { rotation: { x: 0, y: res.move.yaw } }); } catch {}
      r.lastPos = { ...bot.location }; // ハマり検出は nav 側にもあるが、脳側 c.self.stuck 用に現行も維持する
      // 現行の stuckSec 更新式をここでも回す（脳への見え方を変えない）
    } else {
      moveDirect(bot, r); // 現行方式（内部で stuckSec/lastPos も従来どおり更新）
    }
    applyDoors(bot, res, r);
  }
}, 2);
```

ポイント：
- **脳側の `c.self.stuck`（stuckSec>=3）は従来どおり**。path モードでも
  stuckSec の更新式（前回位置との差 0.05 未満かつ目標まで2超で +0.1）は
  維持すること。nav 内部のスタック検出（1秒で再探索→direct）は別系統で、
  二重になっても競合しない。
- `moveDirect` は現行コードをそのまま関数化するだけ（`groundY` も温存）。
- オフライン待機ループ（40tick、target=現在位置）は変更不要。目標が現在位置なら
  nav は到達済みを返し、実質動かない。

## 5. 扉の開閉（applyDoors）

navTick の戻り値 `openDoors` / `closeDoors` はセル座標 `{x, y, z}` の配列。
実適用は permutation の状態書き換えで行う。

```js
function setDoor(dim, cell, open) {
  try {
    const b = dim.getBlock(cell);
    if (!b) return;
    b.setPermutation(b.permutation.withState("open_bit", open));
  } catch {}
}
function applyDoors(bot, res, r) {
  for (const d of res.openDoors || []) setDoor(bot.dimension, d, true);
  for (const d of res.closeDoors || []) setDoor(bot.dimension, d, false);
}
```

**実機で1回確認して固定すること**：
- 状態名が `open_bit` であること（木製ドア／フェンスゲート共通の想定）。
  違えば `b.permutation.getAllStates()` で実名を確認して差し替える。
- ドアは2セル（下段・上段）あり、nav は両セルを返す。両方に同じ open を
  書けばよい想定だが、片方だけで連動する場合は重複適用でも無害。

## 6. 向き（yaw）の符号確認

`nav.js` の `yawToward(dx, dz) = atan2(-dx, dz)`（度）は Bedrock の
rotation.y（0=南/+Z、-90=東/+X…）の想定で置いてある。
**実機で1回確認**：平地で東へ歩かせ、進行方向を向くか見る。
逆を向く場合は `yawToward` の返り値に 180 を足す（または符号反転）して
nav.js 側の定数を固定する。テストは yaw の「変化量上限」だけを見るので影響しない。

## 7. パラメータと予算

- 初期値は nav.js の `NAV`（仕様 §10 と一致）。調整は nav.js 側だけで完結する。
- グリッド分割構築は `createNav(probe)` の既定 budget=400 probe/tick。
  Bot が複数いる場合は生成タイミングが重ならないよう、脳ループ同様に
  Bot ごとに開始 tick をずらす（navOf の初回生成をずらすだけでよい）。
- 状態メニューに `r.navMode`（"path"/"direct"）を表示すると、
  フォールバック頻度が実機で把握できて調整が楽になる。

## 8. 統合後の確認（実機・クリエイティブ）

仕様 §11 の目視確認リストに従う。特に：
- 平地追従で滑らず歩く／進行方向を向く
- 段差1を小ジャンプで上る、フェンス（2段相当）を乗り越えない
- 屋内で屋根に吸着しない（現行方式との比較）
- 木製ドアを開けて入り後ろで閉める、鉄ドアは迂回 or direct
- 崖・溶岩の縁で落ちない、水辺で direct（泳ぎ）に落ちる
- 詰まり時に再探索→direct へ段階的に落ち、無限往復しない
