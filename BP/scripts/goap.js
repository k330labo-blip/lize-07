// a04-goap-module.mjs — GOAP-lite 純粋モジュール 統合用コピー (cycle-1016 / a04)
// 出典: brain_parts/solutions/cycle-0936/a11-goap-lite.mjs (cycle-0936 / a11)
//   の実証済みロジック (satisfies/goalSatisfied/heuristic/applicable/
//   applyAction/DEFAULT_WEIGHTS/actionCost/plan/sourcingActions/
//   craftAction/placeStationAction と自己テスト T01〜T14) を保持する。
//   ロジック本体は変更していない。統合用に変えたのは本ヘッダと
//   ファイル末尾のランナーだけ: import 時は自己テストを実行しない
//   (副作用なし) よう、直接実行時のみ走るガードへ包み、結果を
//   runSelfTests() としても export した。process は Bedrock 環境に
//   無いため、参照は全て typeof ガード越し (例外安全)。
// Phase 3 (ARCHITECTURE_PLAN.md): Action の preconditions/effects から
// 現在状態 → Goal 述語への計画探索を行う最小実装。依存なし・副作用なし。
// 実行: node a04-goap-module.mjs  (自己テストを実行し、失敗時 exit 1)
//   import しただけでは何も実行されない (下記「統合手順」参照)。
//
// ===== BP/scripts への統合手順 (コーディネータが直列で行う) =====
// 1. 本ファイルを BP/scripts/goap.js としてコピーする
//    (.mjs → .js への拡張子変更のみ。中身・export 名は変えない。
//    本モジュールは import 文を持たず @minecraft/server に依存しない)。
// 2. 呼び出し側 (main.js / mission.js / longtask.js 等、統合先は
//    コーディネータが決める) の冒頭へ named import を 1 行追加する:
//      import { plan, goalSatisfied, satisfies, sourcingActions,
//               craftAction, placeStationAction } from "./goap.js";
//    (パスは統合先ファイルからの相対に合わせる。default export は無い)
// 3. 呼び出し契約: plan(state, goal, actions, options?) は純粋関数。
//    state は fact->number|boolean|string の平坦オブジェクトを毎回
//    新規に組み立てて渡す (c.x は optional chaining で読み、欠落 fact
//    は渡さない = UNKNOWN 扱い)。入力は変更されない。戻り値は
//    {ok:true, steps, actions, cost, finalState, expanded} または
//    {ok:false, reason:'NO_PLAN'|'NODE_LIMIT'|'EMPTY_GOAL', expanded}。
//    ok:false は例外ではないので try/catch でなく reason で分岐する。
//    mission/longtask への接続 (Plan の実行監視への受け渡し) は
//    本モジュールの範囲外: 統合側で steps/actions を既存の実行系へ
//    段階移行させる (ARCHITECTURE_PLAN.md Phase 3 の記載どおり)。
// 4. 統合前チェック: node --check BP/scripts/goap.js と、
//    本ファイルの node 実行で自己テスト 14/14 PASS を確認してから
//    tools/validate.py を全合格させる。版上げ時は BP/RP 両 manifest
//    の header・依存と config.js の VERSION を揃える (単一の正は
//    config.js の VERSION)。
// 5. 制約の維持: ctx フィールドの削除・意味変更をしない (本モジュール
//    は ctx を直接読まない)。decide の p 数値意味論と effMove.id
//    接頭辞 (mood_/fb_/compiled_matrix) には触れない。本モジュールが
//    生成する Action id は GATHER:/WITHDRAW:/PICKUP:/RECEIVE:/CRAFT:/
//    PLACE: 接頭辞であり effMove.id とは別名前空間。
//
// 設計原則 (汎用層のみ、特定アイテムのハードコードはテストデータ側だけ):
// - WorldState は fact(string) -> number|boolean|string の平坦な Map 的オブジェクト。
//   欠落した fact は UNKNOWN として扱い、述語は satisfied にならない (例外にしない)。
// - Predicate: { fact, op: '>='|'=='|'>'|'<='|'<'|'!=', value }
// - Action: { id, cost:{ticks,distance,danger,durability,successP},
//             pre:[Predicate], effects:[{fact, add?|set?}] , repeatable?:bool }
//   effects の add は数値 fact への加算、set は上書き。非数値への add は適用しない。
// - Planner は A* 前向き探索。ヒューリスティクス = 未充足述語の不足量の正規化和。
//   同一状態への再訪問は最良コストで枝刈りし、maxNodes で必ず終了する。
// - コストは重み付きスカラー化: ticks + 2*distance + 50*danger + 5*durability
//   - 100*log(successP) (successP<1 ほど高コスト)。重みは options で差し替え可能。
// - 入力 (state / actions / goal) は変更しない (凍結テストで検証)。

// ---------- 述語 ----------
export function satisfies(state, pred) {
  const v = state?.[pred.fact];
  if (v === undefined || v === null) return false; // UNKNOWN は未充足
  switch (pred.op) {
    case '>=': return typeof v === 'number' && v >= pred.value;
    case '>':  return typeof v === 'number' && v >  pred.value;
    case '<=': return typeof v === 'number' && v <= pred.value;
    case '<':  return typeof v === 'number' && v <  pred.value;
    case '==': return v === pred.value;
    case '!=': return v !== pred.value;
    default: return false;
  }
}
export const goalSatisfied = (state, goal) => (goal ?? []).every(p => satisfies(state, p));

// 不足量 (ヒューリスティクス用): 数値述語は不足分/目標値、それ以外は 0/1
function deficit(state, pred) {
  if (satisfies(state, pred)) return 0;
  const v = state?.[pred.fact];
  if ((pred.op === '>=' || pred.op === '>') && typeof v === 'number' && typeof pred.value === 'number')
    return Math.min(1, Math.max(0, (pred.value - v) / Math.max(1, Math.abs(pred.value))));
  return 1;
}
export const heuristic = (state, goal) => (goal ?? []).reduce((s, p) => s + deficit(state, p), 0);

// ---------- Action 適用 (純粋) ----------
export function applicable(state, action) {
  return (action?.pre ?? []).every(p => satisfies(state, p));
}
export function applyAction(state, action) {
  const next = { ...(state ?? {}) };
  for (const e of action?.effects ?? []) {
    if ('set' in e) next[e.fact] = e.set;
    else if ('add' in e) {
      const cur = typeof next[e.fact] === 'number' ? next[e.fact] : 0;
      next[e.fact] = cur + e.add;
    }
  }
  return next;
}

// ---------- コストモデル ----------
export const DEFAULT_WEIGHTS = Object.freeze({ ticks: 1, distance: 2, danger: 50, durability: 5, risk: 100 });
export function actionCost(action, weights = DEFAULT_WEIGHTS) {
  const c = action?.cost ?? {};
  const p = typeof c.successP === 'number' ? Math.min(1, Math.max(0.01, c.successP)) : 1;
  return (c.ticks ?? 0) * weights.ticks + (c.distance ?? 0) * weights.distance
       + (c.danger ?? 0) * weights.danger + (c.durability ?? 0) * weights.durability
       - Math.log(p) * weights.risk;
}

// 状態キー: 数値 fact は Goal/効果に関係する範囲でそのまま使う (小規模プロトタイプ前提)
function stateKey(state) {
  return Object.keys(state).sort().map(k => `${k}=${JSON.stringify(state[k])}`).join('|');
}

// ---------- Planner: A* ----------
// Phase4 P4-A S1 (v0.4.81, cycle0417): 探索本体をジェネレータ planGen へ移し、
// plan() はそれを最後まで駆動する同期ドライバとした (挙動不変)。
// yield 挿入点は NODE_LIMIT 判定の直後の1箇所だけ。探索順序・タイブレーク
// (overshoot)・枝刈り (best) は同期版と完全同一で、最後まで駆動した結果は
// plan() 従来形と ok/reason/steps/cost/expanded/finalState が一致する
// (tests/test_goap_gen.mjs が等価性を恒常検査する)。
// ランナー (system.runJob) への接続は S2 以降で goap_runner.js 側の仕事。
/**
 * planGen(initialState, goalPredicates, actions, options?)
 * options: plan() と同一 { maxNodes=2000, weights, maxDepth=32 }
 *          + { yieldEvery=25 } (1スライスの展開ノード数上限、主上限)
 *          + { maxSliceMs=0 } (1スライスの経過時間上限 ms、補助上限。
 *              0=無効。Date.now の粒度が粗く発火しない場合でも
 *              yieldEvery 側で上限は守られる)
 * yield 値: { type:'progress', expanded, open } (進捗通知専用。結果に影響しない)
 * 戻り値: { ok:true, steps:[actionId...], actions:[...], cost, finalState, expanded }
 *         | { ok:false, reason:'NO_PLAN'|'NODE_LIMIT'|'EMPTY_GOAL', expanded }
 * 注意: ジェネレータ関数は初回 next() まで本体が実行されない (遅延実行)。
 *   EMPTY_GOAL / 達成済みの早期 return も初回 next() で返る。
 */
export function* planGen(initialState, goal, actions, options = {}) {
  const maxNodes = options.maxNodes ?? 2000;
  const maxDepth = options.maxDepth ?? 32;
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const yieldEvery = Math.max(1, Math.floor(options.yieldEvery ?? 25) || 25);
  const maxSliceMs = typeof options.maxSliceMs === "number" && options.maxSliceMs > 0 ? options.maxSliceMs : 0;
  // 時間補助の確認粒度: 毎展開で Date.now を引くと計測自体が重く、
  // 粒度も粗いため、確認は TIME_CHECK_EVERY 展開に1回まで。
  const TIME_CHECK_EVERY = 16;
  if (!Array.isArray(goal) || goal.length === 0) return { ok: false, reason: 'EMPTY_GOAL', expanded: 0 };
  const start = { ...(initialState ?? {}) };
  if (goalSatisfied(start, goal)) return { ok: true, steps: [], actions: [], cost: 0, finalState: start, expanded: 0 };

  // 優先度付きキュー (小規模なので配列+線形最小抽出で十分、依存なし)
  // 同コスト時のタイブレーク (v0.4.38, 汎用): Goal 述語に対する過剰充足
  // (overshoot) が小さい状態を優先する。>= 述語の過剰調達 (例: 必要3に
  // 2+2=4) とちょうどの調達 (2+1=3) が同コストで競合したとき、台帳の
  // 「総和 == 需要ちょうど」を planner 側でも成立させるための汎用規則。
  const overshoot = (state) => (goal ?? []).reduce((s, p) => {
    const v = state?.[p.fact];
    return (p.op === ">=" && typeof v === "number" && typeof p.value === "number" && v > p.value) ? s + (v - p.value) : s;
  }, 0);
  const open = [{ state: start, g: 0, f: heuristic(start, goal), seq: [] }];
  const best = new Map([[stateKey(start), 0]]);
  let expanded = 0;
  let sinceYield = 0;              // 直近 yield からの展開数 (主上限の判定用)
  let sliceStart = Date.now();     // 直近 yield からの経過時間 (補助上限の判定用)
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bi].f) bi = i;
      else if (open[i].f === open[bi].f && overshoot(open[i].state) < overshoot(open[bi].state)) bi = i;
    }
    const node = open.splice(bi, 1)[0];
    if (++expanded > maxNodes) return { ok: false, reason: 'NODE_LIMIT', expanded };
    sinceYield++;
    // === yield 挿入点 (同期版との唯一の差分) ===
    // 主上限: sinceYield が yieldEvery に達したら yield する。
    // 補助上限: maxSliceMs 有効時、TIME_CHECK_EVERY 展開ごとに経過時間を
    //   確認し、超過していれば yieldEvery 未満でも yield する。
    // 状態 (open/best/expanded) はジェネレータのローカル変数に保持される
    // ため、再開時はこの続きから正確に再開する。yield は結果に影響しない。
    const timeOver = maxSliceMs > 0 && sinceYield >= TIME_CHECK_EVERY && (sinceYield % TIME_CHECK_EVERY) === 0
      && (Date.now() - sliceStart) >= maxSliceMs;
    if (sinceYield >= yieldEvery || timeOver) {
      yield { type: 'progress', expanded, open: open.length };
      sinceYield = 0;
      sliceStart = Date.now();
    }
    if (goalSatisfied(node.state, goal))
      return { ok: true, steps: node.seq.map(a => a.id), actions: node.seq, cost: node.g, finalState: node.state, expanded };
    if (node.seq.length >= maxDepth) continue;
    for (const a of actions ?? []) {
      if (!applicable(node.state, a)) continue;
      const ns = applyAction(node.state, a);
      const key = stateKey(ns);
      const ng = node.g + actionCost(a, weights);
      if (best.has(key) && best.get(key) <= ng) continue; // 改善なしは枝刈り (ループ防止)
      best.set(key, ng);
      open.push({ state: ns, g: ng, f: ng + heuristic(ns, goal), seq: [...node.seq, a] });
    }
  }
  return { ok: false, reason: 'NO_PLAN', expanded };
}

// ---------- 同期ドライバ (plan の実体) ----------
/** ジェネレータを最後まで駆動し { result, yields } を返す。 */
export function driveGenToCompletion(gen) {
  let yields = 0;
  let r = gen.next();
  while (!r.done) { yields++; r = gen.next(); }
  return { result: r.value, yields };
}

/**
 * plan(initialState, goalPredicates, actions, options?)
 * 同期互換の入口 (名前・引数・戻り値は S1 以前と不変)。
 * 実体は planGen を最後まで駆動するドライバであり、戻り値は .result のみ
 * ({ result, yields } 形は返さない。yields が要る読み手は
 * driveGenToCompletion(planGen(...)) を使うこと)。
 */
export function plan(initialState, goal, actions, options = {}) {
  return driveGenToCompletion(planGen(initialState, goal, actions, options)).result;
}

// ---------- 代替調達アクション生成 (データ駆動、アイテム非依存) ----------
// 同じ effect (inventory.<item> の増加) を持つ調達手段を、観測事実から生成する。
// 採取 / 既知チェストから WITHDRAW / ドロップ回収 / 主人から受取 を計画空間で競わせる。
// Phase3 NQ-01 P1 (v0.4.18): facts.dist が存在する場合のみ実距離を使う (案A)。
// dist キーが無い呼び出しは従来定数のまま (後方互換、自己テスト T01〜T14)。
// dist.<手段> が有限な非負数ならその値、それ以外は距離 UNKNOWN として
// その Action を生成しない (推測定数で埋めない)。閾値・交差点の数値は書かない。
const LEGACY_DIST = Object.freeze({ gather: 12, withdraw: 4, pickup: 6, receive: 1 });
export const isValidDist = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
export function sourcingActions(item, amount, facts = {}) {
  const inv = `inv.${item}`;
  const hasDist = !!facts && typeof facts === "object" && Object.prototype.hasOwnProperty.call(facts, "dist");
  const dist = hasDist && facts.dist && typeof facts.dist === "object" ? facts.dist : null;
  const specs = [
    { key: "gather", legacy: LEGACY_DIST.gather, action: (distance) => ({ id: `GATHER:${item}`, cost: { ticks: 40, distance, danger: 0.1, durability: 1, successP: 0.9 },
      pre: [{ fact: `near.${item}_source`, op: ">=", value: 1 }],
      effects: [{ fact: inv, add: amount }, { fact: `near.${item}_source`, add: -1 }] }) },
    { key: "withdraw", legacy: LEGACY_DIST.withdraw, action: (distance) => ({ id: `WITHDRAW:${item}`, cost: { ticks: 8, distance, danger: 0, durability: 0, successP: 0.98 },
      pre: [{ fact: `chest.${item}`, op: ">=", value: amount }],
      effects: [{ fact: inv, add: amount }, { fact: `chest.${item}`, add: -amount }] }) },
    { key: "pickup", legacy: LEGACY_DIST.pickup, action: (distance) => ({ id: `PICKUP:${item}`, cost: { ticks: 10, distance, danger: 0.05, durability: 0, successP: 0.95 },
      pre: [{ fact: `drop.${item}`, op: ">=", value: amount }],
      effects: [{ fact: inv, add: amount }, { fact: `drop.${item}`, add: -amount }] }) },
    { key: "receive", legacy: LEGACY_DIST.receive, action: (distance) => ({ id: `RECEIVE:${item}`, cost: { ticks: 5, distance, danger: 0, durability: 0, successP: 0.99 },
      pre: [{ fact: `owner_has.${item}`, op: ">=", value: amount }, { fact: "owner_near", op: "==", value: true }],
      effects: [{ fact: inv, add: amount }, { fact: `owner_has.${item}`, add: -amount }] }) },
  ];
  const holders = Array.isArray(facts?.holders) && facts.holders.length ? facts.holders : null;
  const acts = [];
  for (const sp of specs) {
    if (holders && sp.key === "withdraw") continue; // 保持者モードでは合算形を置換する (併出禁止)
    if (!hasDist) { acts.push(sp.action(sp.legacy)); continue; }
    if (isValidDist(dist?.[sp.key])) acts.push(sp.action(dist[sp.key]));
  }
  if (holders) acts.push(...holderWithdrawActions(item, holders, amount, facts?.otherAvails ?? {}));
  return acts;
}

// ---------- NQ-03 ステップ3 (v0.4.38): 保持者別 WITHDRAW 変種 ----------
// 設計 cycle1301-nq03 §2.3/§3.6 の確定形。生成関数は変種総数上限を知らない
// (予算36の所有者は goap_state.buildActions、R-07)。候補集合 K_h は
// { min(A_h, D) } ∪ { D - s | s は他の保持者と他手段の可用量の部分和 }。
// 部分和の列挙は保持者あたり128通りで打ち切る (R-07 の列挙上限)。
export function holderWithdrawActions(item, holders, demand, otherAvails = {}) {
  const D = Math.max(1, Math.floor(demand) || 1);
  const hs = (Array.isArray(holders) ? holders : [])
    .filter(h => h && typeof h.alias === "string" && /^h\d+$/.test(h.alias)
      && Number.isInteger(h.count) && h.count > 0);
  const extra = Object.values(otherAvails ?? {}).filter(v => Number.isInteger(v) && v > 0);
  const acts = [];
  for (const h of hs) {
    const cap = Math.min(h.count, D);
    const others = [...hs.filter(o => o !== h).map(o => o.count), ...extra];
    const sums = new Set([0]);
    for (const a of others) {
      for (const s of [...sums]) { sums.add(s + a); if (sums.size > 128) break; }
      if (sums.size > 128) break;
    }
    const ks = new Set([cap]);
    for (const s of sums) { const k = D - s; if (k >= 1 && k <= cap) ks.add(k); }
    for (const k of [...ks].sort((a, b) => b - a)) {
      acts.push({
        id: `WITHDRAW:${item}@${h.alias}#${k}`,
        cost: { ticks: 8, distance: isValidDist(h.dist) ? h.dist : LEGACY_DIST.withdraw, danger: 0, durability: 0, successP: 0.98 },
        pre: [{ fact: `chest@${h.alias}.${item}`, op: ">=", value: k }],
        effects: [{ fact: `inv.${item}`, add: k },
                  { fact: `chest@${h.alias}.${item}`, add: -k },
                  { fact: `chest.${item}`, add: -k }],
      });
    }
  }
  return acts;
}

// 汎用クラフト Action 生成 (レシピはデータとして渡す: {out, n, inputs:{item:count}, station?})
export function craftAction(recipe) {
  const pre = Object.entries(recipe.inputs ?? {}).map(([it, n]) => ({ fact: `inv.${it}`, op: '>=', value: n }));
  if (recipe.station) pre.push({ fact: `station.${recipe.station}`, op: '==', value: true });
  const effects = Object.entries(recipe.inputs ?? {}).map(([it, n]) => ({ fact: `inv.${it}`, add: -n }));
  effects.push({ fact: `inv.${recipe.out}`, add: recipe.n ?? 1 });
  return { id: `CRAFT:${recipe.out}`, cost: { ticks: 6, distance: 0, danger: 0, durability: 0, successP: 1 },
    pre, effects };
}
// 燃料1単位の燃焼量 burn から正確バッチ {ops, units} を導出する純粋関数
// (Phase3 SMELT L1, v0.4.39)。quarter (0.25) 整数演算のみ。0.25 の倍数でない
// burn は null (= その燃料の L1 変種は作らず L3 集約でのみ数える。近似しない)。
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
export function batchFor(burn) {
  if (typeof burn !== "number" || !Number.isFinite(burn) || burn <= 0) return null;
  const q = burn * 4;
  if (Math.abs(q - Math.round(q)) > 1e-9) return null;
  const burnQ = Math.round(q);
  const g = gcd(burnQ, 4);
  const ops = burnQ / g;
  return { ops, units: (ops * 4) / burnQ };
}
// 汎用精錬 Action 生成 (Phase3 SMELT燃料述語, v0.4.16): kind:"smelt" レシピ専用。
// 燃料は個別アイテムでなく派生 fact "fuel.burn" (精錬可能個数の集約値、
// 状態構築側が recipes.js FUEL_TABLE から換算) で述語化する。生成器自体は
// 燃料アイテム名を知らない。1回の適用で inputs 総数ぶんの燃焼容量を消費する。
// コスト ticks は 6 + 200/個 (バニラかまど 200tick/個、a16 監査の汎用式)。
export function smeltAction(recipe) {
  const pre = Object.entries(recipe.inputs ?? {}).map(([it, n]) => ({ fact: `inv.${it}`, op: '>=', value: n }));
  if (recipe.station) pre.push({ fact: `station.${recipe.station}`, op: '==', value: true });
  const inputTotal = Object.values(recipe.inputs ?? {}).reduce((s, n) => s + (typeof n === 'number' ? n : 0), 0);
  pre.push({ fact: 'fuel.burn', op: '>=', value: Math.max(1, inputTotal) });
  const effects = Object.entries(recipe.inputs ?? {}).map(([it, n]) => ({ fact: `inv.${it}`, add: -n }));
  effects.push({ fact: 'fuel.burn', add: -Math.max(1, inputTotal) });
  effects.push({ fact: `inv.${recipe.out}`, add: recipe.n ?? 1 });
  return { id: `SMELT:${recipe.out}`, cost: { ticks: 6 + 200 * Math.max(1, inputTotal), distance: 0, danger: 0, durability: 0, successP: 0.9 },
    pre, effects };
}
// L1: 燃料を一次 fact (inv.<fuelId>) で述べる精錬変種 (Phase3 SMELT L1, v0.4.39)。
// 燃料値は引数注入 (知識層の単一構築点 fuelValueMap が正。本モジュールは import を
// 持たない純粋モジュールの性質を維持する)。材料=燃料のときは pre/effects を
// fact 単位に合算し、二重計上 (V-2) を構造的に避ける。
// R1 是正 (案A′): 集約プール fuel.burn は全 SMELT で共有される単一資源。
// 一次表現で消費する L1 もプールを ops ぶん消費する (E: 常時)。
// さらに、当該燃料が初期 inv. に既知として存在する局面では、適用前に
// プール残量も確認する (P: 第4引数 fuelInitiallyInInv が true のときだけ。
// 初期 inv. に無い燃料は L3 の消費対象と物理的に重ならないため付けない。
// 調達・引出・生成で計画内に現れる燃料については (E) の一方向防止のみが働く)。
export function smeltVariantAction(recipe, fuelId, burn, fuelInitiallyInInv = false) {
  const batch = batchFor(burn);
  if (!recipe?.out || typeof fuelId !== "string" || !batch) return null;
  const { ops, units } = batch;
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const preByFact = new Map();
  const addPre = (fact, value) => preByFact.set(fact, (preByFact.get(fact) ?? 0) + value);
  for (const [it, n] of Object.entries(recipe.inputs ?? {}))
    if (isNum(n) && n > 0) addPre(`inv.${it}`, n * ops);
  addPre(`inv.${fuelId}`, units); // 材料と同一なら上で合算される
  const pre = [...preByFact.entries()].map(([fact, value]) => ({ fact, op: ">=", value }));
  if (recipe.station) pre.push({ fact: `station.${recipe.station}`, op: "==", value: true });
  if (fuelInitiallyInInv === true) pre.push({ fact: "fuel.burn", op: ">=", value: ops }); // (P)
  const effByFact = new Map();
  const addEff = (fact, d) => effByFact.set(fact, (effByFact.get(fact) ?? 0) + d);
  for (const [it, n] of Object.entries(recipe.inputs ?? {}))
    if (isNum(n) && n > 0) addEff(`inv.${it}`, -n * ops);
  addEff(`inv.${fuelId}`, -units); // 材料と同一なら合算され二重に引かない
  addEff("fuel.burn", -ops); // (E) 局面によらず常時
  addEff(`inv.${recipe.out}`, (recipe.n ?? 1) * ops);
  const effects = [...effByFact.entries()].map(([fact, add]) => ({ fact, add }));
  return { id: `SMELT:${recipe.out}@fuel:${fuelId}`,
    cost: { ticks: 6 + 200 * ops, distance: 0, danger: 0, durability: 0, successP: 0.9 },
    pre, effects, meta: { kind: "smelt", fuel: fuelId, fuelUnits: units, ops } };
}
export const placeStationAction = (station) => ({
  id: `PLACE:${station}`, cost: { ticks: 10, distance: 1, danger: 0, durability: 0, successP: 0.99 },
  pre: [{ fact: `inv.${station}`, op: '>=', value: 1 }],
  effects: [{ fact: `inv.${station}`, add: -1 }, { fact: `station.${station}`, set: true }],
});

// ---------- 自己テスト ----------
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
function assert(cond, msg) { if (!cond) throw new Error(msg ?? 'assertion failed'); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg ?? 'not equal'}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }

const LOG = 'minecraft:oak_log', PLANK = 'minecraft:oak_planks', STICK = 'minecraft:stick', TABLE = 'minecraft:crafting_table';

test('T01 単純採取: 原木ソースがあれば GATHER 1手で達成', () => {
  const s = { [`near.${LOG}_source`]: 3, [`inv.${LOG}`]: 0 };
  const r = plan(s, [{ fact: `inv.${LOG}`, op: '>=', value: 4 }], sourcingActions(LOG, 4));
  assert(r.ok, 'plan should succeed'); eq(r.steps, [`GATHER:${LOG}`]);
});

test('T02 代替調達: 既知チェスト在庫があれば低コストの WITHDRAW が選ばれる', () => {
  const s = { [`near.${LOG}_source`]: 3, [`chest.${LOG}`]: 10, [`inv.${LOG}`]: 0 };
  const r = plan(s, [{ fact: `inv.${LOG}`, op: '>=', value: 4 }], sourcingActions(LOG, 4));
  assert(r.ok); eq(r.steps, [`WITHDRAW:${LOG}`], 'WITHDRAW must beat GATHER on cost');
});

test('T03 WITHDRAW 不可 (チェスト未知=UNKNOWN) では採取へフォールバック', () => {
  const s = { [`near.${LOG}_source`]: 2, [`inv.${LOG}`]: 0 }; // chest.* fact 自体が無い
  const r = plan(s, [{ fact: `inv.${LOG}`, op: '>=', value: 4 }], sourcingActions(LOG, 4));
  assert(r.ok); eq(r.steps, [`GATHER:${LOG}`]);
});

test('T04 WITHDRAW 不可 (在庫不足) かつ採取源なしでは NO_PLAN (例外なし)', () => {
  const s = { [`chest.${LOG}`]: 2, [`inv.${LOG}`]: 0 };
  const r = plan(s, [{ fact: `inv.${LOG}`, op: '>=', value: 4 }], sourcingActions(LOG, 4));
  assert(!r.ok && r.reason === 'NO_PLAN', `expected NO_PLAN, got ${JSON.stringify(r)}`);
});

test('T05 ドロップ回収と受取も同じ計画空間で競合する', () => {
  const s = { [`drop.${LOG}`]: 4, [`owner_has.${LOG}`]: 4, owner_near: true, [`inv.${LOG}`]: 0 };
  const r = plan(s, [{ fact: `inv.${LOG}`, op: '>=', value: 4 }], sourcingActions(LOG, 4));
  assert(r.ok); eq(r.steps, [`RECEIVE:${LOG}`], 'cheapest feasible alternative wins');
});

test('T06 多段クラフト: 原木→板材→作業台設置まで連鎖探索', () => {
  const acts = [...sourcingActions(LOG, 1),
    craftAction({ out: PLANK, n: 4, inputs: { [LOG]: 1 } }),
    craftAction({ out: TABLE, n: 1, inputs: { [PLANK]: 4 } }),
    placeStationAction(TABLE)];
  const s = { [`near.${LOG}_source`]: 5, [`inv.${LOG}`]: 0 };
  const r = plan(s, [{ fact: `station.${TABLE}`, op: '==', value: true }], acts);
  assert(r.ok, JSON.stringify(r));
  eq(r.steps, [`GATHER:${LOG}`, `CRAFT:${PLANK}`, `CRAFT:${TABLE}`, `PLACE:${TABLE}`]);
});

test('T07 既所持で不足分だけ計画する (部分充足)', () => {
  const acts = [...sourcingActions(PLANK, 2),
    craftAction({ out: STICK, n: 4, inputs: { [PLANK]: 2 } })];
  const s = { [`inv.${PLANK}`]: 2, [`near.${PLANK}_source`]: 1 };
  const r = plan(s, [{ fact: `inv.${STICK}`, op: '>=', value: 4 }], acts);
  assert(r.ok); eq(r.steps, [`CRAFT:${STICK}`], 'no sourcing needed when inputs already held');
});

test('T08 既に達成済みの Goal は空計画', () => {
  const r = plan({ [`inv.${LOG}`]: 9 }, [{ fact: `inv.${LOG}`, op: '>=', value: 4 }], sourcingActions(LOG, 4));
  assert(r.ok && r.steps.length === 0 && r.cost === 0);
});

test('T09 到達不能 Goal は NO_PLAN で終了し無限ループしない', () => {
  const loop = { id: 'LOOP', cost: { ticks: 1 }, pre: [], effects: [{ fact: 'x', add: 0 }] };
  const r = plan({}, [{ fact: 'never', op: '==', value: true }], [loop], { maxNodes: 50 });
  assert(!r.ok && (r.reason === 'NO_PLAN' || r.reason === 'NODE_LIMIT'));
});

test('T10 危険な採取より安全な WITHDRAW を danger 重みで選ぶ', () => {
  const risky = { id: 'GATHER:risky', cost: { ticks: 1, danger: 1, successP: 0.5 }, pre: [], effects: [{ fact: 'inv.z', add: 1 }] };
  const safe = { id: 'WITHDRAW:safe', cost: { ticks: 30, danger: 0, successP: 1 }, pre: [], effects: [{ fact: 'inv.z', add: 1 }] };
  const r = plan({}, [{ fact: 'inv.z', op: '>=', value: 1 }], [risky, safe]);
  assert(r.ok); eq(r.steps, ['WITHDRAW:safe']);
});

test('T11 Planner は入力 state/actions を変更しない', () => {
  const s = Object.freeze({ [`near.${LOG}_source`]: 1, [`inv.${LOG}`]: 0 });
  const acts = Object.freeze(sourcingActions(LOG, 4).map(a => Object.freeze(a)));
  const r = plan(s, [{ fact: `inv.${LOG}`, op: '>=', value: 4 }], acts);
  assert(r.ok); eq(s[`inv.${LOG}`], 0);
});

test('T12 決定性: 同一入力では同一計画・同一コスト', () => {
  const mk = () => plan({ [`near.${LOG}_source`]: 3, [`chest.${LOG}`]: 10 },
    [{ fact: `inv.${LOG}`, op: '>=', value: 4 }], sourcingActions(LOG, 4));
  const a = mk(), b = mk(); eq(a.steps, b.steps); eq(a.cost, b.cost);
});

test('T13 空 Goal / 欠落フィールドでも例外なし', () => {
  assert(plan({}, [], []).reason === 'EMPTY_GOAL');
  assert(plan(null, [{ fact: 'a', op: '>=', value: 1 }], null).ok === false);
  assert(satisfies(null, { fact: 'a', op: '==', value: 1 }) === false);
  assert(applicable(undefined, { id: 'X' }) === true); // pre 省略 = 無条件
});

test('T14 複合 Goal (AND): 在庫+設置の両方を満たす計画', () => {
  const acts = [...sourcingActions(LOG, 1),
    craftAction({ out: PLANK, n: 4, inputs: { [LOG]: 1 } }),
    craftAction({ out: TABLE, n: 1, inputs: { [PLANK]: 4 } }),
    placeStationAction(TABLE), ...sourcingActions(STICK, 4),
    craftAction({ out: STICK, n: 4, inputs: { [PLANK]: 2 }, station: TABLE })];
  // 板材が足りない構成では解けない場合があるため、解ける入力で AND 充足のみ確認する
  const s = { [`near.${LOG}_source`]: 9, [`inv.${LOG}`]: 0, [`near.${STICK}_source`]: 0 };
  const r = plan(s, [{ fact: `station.${TABLE}`, op: '==', value: true }, { fact: `inv.${PLANK}`, op: '>=', value: 0 }], acts);
  assert(r.ok && goalSatisfied(r.finalState, [{ fact: `station.${TABLE}`, op: '==', value: true }]));
});

// ---------- ランナー (統合用ガード: import 時は実行しない) ----------
// a11 原典はモジュール読み込みと同時にテストを実行し process.exit まで
// 呼んでいた。BP/scripts では import 時の副作用・終了は許されないため、
// 同じテスト群を runSelfTests() として export し、自動実行は
// 「Node で本ファイルを直接実行したとき」だけに限定する。
// process / import.meta は Bedrock 環境に無い/異なるため typeof ガード越し。
export function runSelfTests(log = (...a) => { try { console.log(...a); } catch {} }) {
  let pass = 0, fail = 0;
  for (const [name, fn] of tests) {
    try { fn(); pass++; log(`PASS ${name}`); }
    catch (e) { fail++; log(`FAIL ${name}: ${e?.message ?? e}`); }
  }
  log(`RESULT ${pass}/${tests.length} passed, ${fail} failed`);
  return { pass, fail, total: tests.length };
}
const isDirectRun = (() => {
  try {
    if (typeof process === 'undefined' || !process?.argv?.[1]) return false;
    return import.meta.url === new URL(`file://${process.argv[1]}`).href
        || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
  } catch { return false; }
})();
if (isDirectRun) {
  const r = runSelfTests();
  if (r.fail && typeof process !== 'undefined') process.exit(1);
}

// ---------- テスト結果 (cycle-0936 / a11, 実行記録) ----------
// 実行: node --check a11-goap-lite.mjs (構文OK) / node a11-goap-lite.mjs (Node v24.22.1)
// PASS T01 単純採取 / T02 WITHDRAW優先(低コスト) / T03 UNKNOWN時採取フォールバック
// PASS T04 在庫不足+採取源なし=NO_PLAN / T05 PICKUP・RECEIVE競合 / T06 多段クラフト連鎖
// PASS T07 部分充足 / T08 達成済み=空計画 / T09 到達不能で終了 / T10 危険回避のコスト選択
// PASS T11 入力不変 / T12 決定性 / T13 欠落フィールド例外なし / T14 複合Goal(AND)
// RESULT 14/14 passed, 0 failed, exit=0
// 既知の限界: 状態キーは全fact直列化のため大規模fact空間ではmaxNodes前提。
//   数値factの無限増加Actionは best-cost 枝刈り+maxDepth で打ち切る設計。
//   三状態の UNKNOWN は「fact欠落=未充足」として扱い、INSPECT生成は Phase 6 の範囲 (本試作外)。
//
// ---------- テスト結果 (cycle-1016 / a04, 実行記録 2026-11-24) ----------
// 原典 a11 を本サイクルで再実行: node --check (exit=0) / node a11-goap-lite.mjs
//   → RESULT 14/14 passed, 0 failed, exit=0 (Node v24.22.1)
// 本ファイル a04-goap-module.mjs:
//   node --check a04-goap-module.mjs → exit=0
//   node a04-goap-module.mjs → PASS T01〜T14 全件, RESULT 14/14 passed, 0 failed, exit=0
//   import 副作用テスト (node -e で dynamic import):
//     import のみではテスト出力なし (副作用なし) を確認。
//     exports = DEFAULT_WEIGHTS, actionCost, applicable, applyAction,
//       craftAction, goalSatisfied, heuristic, placeStationAction, plan,
//       runSelfTests, satisfies, sourcingActions (12件)
//     runSelfTests(()=>{}) → {pass:14, fail:0, total:14}
//     plan() の sanity (達成済み Goal) → ok:true, steps 0
//   a11 との diff: 変更箇所は冒頭コメント (統合手順) とランナーの
//     ガード化のみ。ロジック本体・テストケース T01〜T14 は無変更。
