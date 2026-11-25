// リゼ (LIZE-07) 寄り道タスク層 — 「ついで」作業の機会検出
// 純粋JS。@minecraft/server には依存しない。統合時は BP/scripts/ へコピーして使う想定。
//
// 位置づけ:
//   指示層（未実装・別担当）が「素材XをN個」のような注文（sideOrders）を出す。
//   本モジュールは移動中に「進行方向のついでに拾える/獲れる機会」だけを検出し、
//   マイクロタスクとして1件だけ返す。実行（移動・攻撃・回収）は実行部（main.js）の仕事。
//   本流のタスクを中断してまで取りに行く判断はしない。「通りすがりに、ほぼタダで
//   拾えるもの」だけを挿入するのが原則。
//
// 羊毛の制約（重要）:
//   Bedrock Script API には「エンティティにハサミを使う」手段が無い（インタラクトの
//   模倣はできても毛刈りの結果＝羊毛アイテム化＋羊の被毛状態変化は再現できない）。
//   よって羊毛は「羊を倒してドロップを拾う」方式のみ。倒す→落ちた羊毛を pickup で
//   回収する2段になる（hunt の後に item 機会が出る）。side_tasks.md に詳述。
//
// 入力契約:
//   ctx: BP/scripts/main.js の buildContext が作る文脈と同形。
//     使うフィールド: ctx.x.selfPos {x,y,z}、ctx.danger {nearestDist, creeperDist,
//     lavaNear}、ctx.x.bossNear、ctx.inv {full, nearFull, used, size}、
//     ctx.x.percTargets {crop:{x,y,z,typeId}}（成熟作物のみ既存知覚が入れる）。
//     機会候補は統合側が ctx.x.opportunities に配列で渡す:
//       { kind: "entity"|"item"|"block", typeId, pos:{x,y,z}, id?, amount? }
//       kind="item" の typeId はアイテムID（例 "minecraft:white_wool"）。
//     進行方向は以下の優先順で解決する（どれも無ければコーン判定を中立扱い）:
//       ctx.x.heading {x,z} / ctx.x.moveDir {x,z} / ctx.x.destPos {x,y,z} から導出。
//   sideOrders: [{ target, item, amount, have, label? }]
//     target は注文の識別子（例 "wool"）、item は欲しいアイテムID、
//     amount は必要数、have は現在までの確保数（インベントリ＋回収済み）。
//   state: 呼び出し側が保持する可変オブジェクト（無ければ {} でよい）。
//     state.cooldowns {key: expiryMs}、state.now（ms epoch、テスト再現性用）。
//     挿入を決めたら noteAttempt(state, task) を呼ぶとクールダウンが記録される。
//
// 返り値: { type:"hunt"|"pickup"|"harvest"|"break", targetDesc, entityType?,
//           blockType?, itemType?, pos, dist, estDetour, orderTarget, expectedGain,
//           key } または null。

const num = (v, fb) => (typeof v === "number" && Number.isFinite(v) ? v : fb);

// ---------- 調整定数 ----------
export const SIDE_TUNING = {
  coneCos: 0.5,          // 前方コーン半角60°（cos≧0.5 を前方とみなす）
  perpMax: 12,           // 直線路（進行方向の射線）からの横ずれ上限（ブロック）
  detourMax: 30,         // 迂回距離の絶対上限（ブロック）
  detourBase: 10,        // 価値判定の基礎予算: estDetour ≦ base + perGain×gain で許可
  detourPerGain: 9,
  dangerStop: 8,         // 敵がこの距離未満なら寄り道自体を見送る
  creeperStop: 10,       // クリーパーは少し広めに見送る
  maxDist: 20,           // 候補として見る最大距離（buildContext の走査半径と整合）
  maxDy: 4,              // 高さ差がこれを超える候補は対象外（崖上/穴底は「ついで」ではない）
  cooldownMs: 20000,     // 同一対象への再試行抑制
  neutralMaxDist: 6,     // 進行方向が不明なとき拾ってよい最大距離
};

// ---------- アイテム → 入手源テーブル ----------
// item アイテムID → { entities: [{typeId, yields, label}], blocks: [{typeId, yields, label, harvest?}] }
// item ドロップ自体（kind="item" かつ typeId === order.item）はテーブル不要で常に対象。
const ENTITY_SOURCES = [
  // 羊毛（全色）← 羊。倒して獲る方式のみ（ハサミ不可は冒頭コメント参照）
  { item: /_wool$/, typeId: "minecraft:sheep", yields: 1, label: "羊" },
  { item: /^minecraft:leather$/, typeId: "minecraft:cow", yields: 1, label: "牛" },
  { item: /^minecraft:leather$/, typeId: "minecraft:horse", yields: 1, label: "馬" },
  { item: /^minecraft:beef$/, typeId: "minecraft:cow", yields: 2, label: "牛" },
  { item: /^minecraft:porkchop$/, typeId: "minecraft:pig", yields: 2, label: "豚" },
  { item: /^minecraft:chicken$/, typeId: "minecraft:chicken", yields: 1, label: "ニワトリ" },
  { item: /^minecraft:feather$/, typeId: "minecraft:chicken", yields: 1, label: "ニワトリ" },
  { item: /^minecraft:mutton$/, typeId: "minecraft:sheep", yields: 2, label: "羊" },
  { item: /^minecraft:ink_sac$/, typeId: "minecraft:squid", yields: 2, label: "イカ" },
  { item: /^minecraft:rabbit_hide$/, typeId: "minecraft:rabbit", yields: 1, label: "ウサギ" },
];
const BLOCK_SOURCES = [
  // 雪玉 ← 雪ブロック/雪の層（壊して獲る）
  { item: /^minecraft:snowball$/, typeId: "minecraft:snow", yields: 4, label: "雪ブロック", taskType: "break" },
  { item: /^minecraft:snowball$/, typeId: "minecraft:snow_layer", yields: 1, label: "雪", taskType: "break" },
  // 花 ← 花ブロック（壊すとそのまま落ちる）
  { item: /flower|tulip|^minecraft:poppy$|^minecraft:dandelion$|^minecraft:cornflower$|^minecraft:lily_of_the_valley$|^minecraft:oxeye_daisy$|^minecraft:azure_bluet$|^minecraft:allium$|^minecraft:blue_orchid$|^minecraft:sunflower$|^minecraft:lilac$|^minecraft:rose_bush$|^minecraft:peony$/,
    typeId: /flower|tulip|poppy|dandelion|cornflower|lily_of_the_valley|oxeye_daisy|azure_bluet|allium|blue_orchid|sunflower|lilac|rose_bush|peony/,
    yields: 1, label: "花", taskType: "break", matchItem: true },
  // スイカ/カボチャ ← 実ったブロック
  { item: /^minecraft:melon_slice$/, typeId: "minecraft:melon_block", yields: 4, label: "スイカ", taskType: "break" },
  { item: /^minecraft:pumpkin$/, typeId: "minecraft:pumpkin", yields: 1, label: "カボチャ", taskType: "break" },
  // サトウキビ ← 背の高い株（壊すのは実行部の判断、ここでは機会として出す）
  { item: /^minecraft:sugar_cane$/, typeId: "minecraft:sugar_cane", yields: 1, label: "サトウキビ", taskType: "break" }, // 基礎 N2 (v0.4.65): 現行IDは sugar_cane が正 (recipes.js の裁定)。旧ID reeds では実ブロックと永遠に一致しなかった
];
// 作物（成熟判定は既存知覚 percTargets.crop が済ませている前提）
const CROP_FOR_ITEM = {
  "minecraft:wheat": "minecraft:wheat",
  "minecraft:carrot": "minecraft:carrots",
  "minecraft:potato": "minecraft:potatoes",
  "minecraft:beetroot": "minecraft:beetroot",
};
// 収穫F-5 (cycle1518-a04): 寄り道の期待収量は main.js の CROP_DROPS と同値にする (一律2は小麦/ビートルートで過大評価だった)。validate.py が両表の突合を検査する
const CROP_YIELDS = {
  "minecraft:wheat": 1,
  "minecraft:carrots": 2,
  "minecraft:potatoes": 2,
  "minecraft:beetroot": 1,
};

// ---------- 幾何ヘルパー ----------
function resolveHeading(ctx, selfPos) {
  const h = ctx?.x?.heading ?? ctx?.x?.moveDir;
  if (h && (h.x || h.z)) {
    const m = Math.hypot(h.x, h.z);
    if (m > 0.001) return { x: h.x / m, z: h.z / m };
  }
  const dest = ctx?.x?.destPos ?? ctx?.x?.goalPos;
  if (dest && selfPos) {
    const dx = dest.x - selfPos.x, dz = dest.z - selfPos.z;
    const m = Math.hypot(dx, dz);
    if (m > 1) return { x: dx / m, z: dz / m };
  }
  return null;
}

// 候補1件の評価。ダメなら null、よければ採点つき候補を返す。
function evalCandidate(order, cand, geom, tuning) {
  const { selfPos, heading } = geom;
  if (!cand?.pos) return null;
  const dx = cand.pos.x - selfPos.x, dz = cand.pos.z - selfPos.z;
  const dy = Math.abs(num(cand.pos.y, selfPos.y) - selfPos.y);
  if (dy > tuning.maxDy) return null;
  const dist = Math.hypot(dx, dz);
  if (dist > tuning.maxDist) return null;

  // 前方コーン & 迂回見積もり
  let perp, forward, estDetour;
  if (heading) {
    forward = dx * heading.x + dz * heading.z;             // 進行方向への射影
    const px = dx - forward * heading.x, pz = dz - forward * heading.z;
    perp = Math.hypot(px, pz);                              // 直線路からの横ずれ
    if (forward < -0.5) return null;                        // 真後ろは見送り
    if (dist > 0.5 && forward / dist < tuning.coneCos) return null; // コーン外
    if (perp > tuning.perpMax) return null;
    // 迂回 = 横ずれの往復 + 前進で相殺できない分。目的地が分かれば三点式が正確だが、
    // ここでは射線近似（往復 2×perp、前方分は本流で回収できるのでほぼ無料）を使う。
    estDetour = 2 * perp + Math.max(0, dist - forward) * 0.5;
  } else {
    // 進行方向不明: 足元のごく近くしか「ついで」と言えない
    if (dist > tuning.neutralMaxDist) return null;
    perp = dist; forward = 0; estDetour = 2 * dist;
  }
  if (estDetour > tuning.detourMax) return null;

  // 価値判定: 残り必要数に対して見合う迂回か
  const gain = Math.max(1, Math.min(num(cand.yields, 1), order.remaining));
  if (estDetour > tuning.detourBase + tuning.detourPerGain * gain) return null;

  const score = gain * 10 - estDetour - dist * 0.3;
  return { cand, dist, estDetour, gain, score };
}

function keyFor(order, cand) {
  if (cand.id) return `${order.target}|${cand.kind}|${cand.id}`;
  const p = cand.pos || {};
  return `${order.target}|${cand.kind}|${cand.typeId}|${Math.round(p.x)},${Math.round(p.z)}`;
}

// 候補リストの構築: ctx.x.opportunities + percTargets.crop を注文ごとに照合する
function collectCandidates(ctx, order) {
  const out = [];
  const opps = Array.isArray(ctx?.x?.opportunities) ? ctx.x.opportunities : [];
  for (const o of opps) {
    if (!o?.typeId || !o.pos) continue;
    if (o.kind === "item") {
      if (o.typeId === order.item) out.push({ ...o, taskType: "pickup", yields: Math.max(1, num(o.amount, 1)), srcLabel: "落ちている分" });
      continue;
    }
    if (o.kind === "entity") {
      for (const s of ENTITY_SOURCES) {
        if (s.item.test(order.item) && o.typeId === s.typeId) out.push({ ...o, taskType: "hunt", yields: s.yields, srcLabel: s.label });
      }
      continue;
    }
    if (o.kind === "block") {
      for (const s of BLOCK_SOURCES) {
        const itemOk = s.matchItem ? s.item.test(order.item) && o.typeId === order.item : s.item.test(order.item);
        const typeOk = s.typeId instanceof RegExp ? s.typeId.test(o.typeId) : o.typeId === s.typeId;
        if (itemOk && typeOk) out.push({ ...o, taskType: s.taskType, yields: s.yields, srcLabel: s.label });
      }
    }
  }
  // 成熟作物（既存知覚が「実ったもの」だけを入れている）
  const cropBlock = CROP_FOR_ITEM[order.item];
  const crop = ctx?.x?.percTargets?.crop ?? ctx?.percTargets?.crop;
  if (cropBlock && crop && crop.typeId === cropBlock) {
    out.push({ kind: "block", typeId: crop.typeId, pos: { x: crop.x, y: crop.y, z: crop.z }, taskType: "harvest", yields: CROP_YIELDS[crop.typeId] ?? 1, srcLabel: "実った作物" });
  }
  return out;
}

// ---------- 本体 ----------
export function scanOpportunities(ctx, sideOrders, state) {
  if (!Array.isArray(sideOrders) || sideOrders.length === 0) return null;
  const selfPos = ctx?.x?.selfPos;
  if (!selfPos) return null;
  const st = state || {};
  const now = num(st.now, Date.now());
  const cooldowns = st.cooldowns || {};

  // 全体ゲート: 危険が近い・満杯なら、寄り道は一切しない
  const danger = ctx?.danger || {};
  if (num(danger.nearestDist, 999) < SIDE_TUNING.dangerStop) return null;
  if (num(danger.creeperDist, 999) < SIDE_TUNING.creeperStop) return null;
  if (danger.lavaNear || ctx?.x?.bossNear) return null;
  if (ctx?.inv?.full) return null;
  // ほぼ満杯のときは「落ちている注文品そのもの」だけ拾う余地を残す（下で候補側で絞る）
  const nearFull = !!ctx?.inv?.nearFull;

  const heading = resolveHeading(ctx, selfPos);
  const geom = { selfPos, heading };

  let best = null;
  for (const raw of sideOrders) {
    if (!raw?.item) continue;
    const remaining = num(raw.amount, 0) - num(raw.have, 0);
    if (remaining <= 0) continue; // 必要数に届いている注文は見送り
    const order = { ...raw, remaining };
    for (const cand of collectCandidates(ctx, order)) {
      if (nearFull && cand.taskType !== "pickup") continue;
      const key = keyFor(order, cand);
      if (num(cooldowns[key], 0) > now) continue; // 再試行抑制
      const ev = evalCandidate(order, cand, geom, SIDE_TUNING);
      if (!ev) continue;
      if (!best || ev.score > best.ev.score) best = { order, cand, ev, key };
    }
  }
  if (!best) return null;

  const { order, cand, ev, key } = best;
  const label = order.label || order.target;
  const task = {
    type: cand.taskType,
    targetDesc: `${label}（${cand.srcLabel}）`,
    itemType: order.item,
    pos: { x: cand.pos.x, y: cand.pos.y, z: cand.pos.z },
    dist: Math.round(ev.dist * 10) / 10,
    estDetour: Math.round(ev.estDetour * 10) / 10,
    orderTarget: order.target,
    expectedGain: ev.gain,
    key,
  };
  if (cand.taskType === "hunt") task.entityType = cand.typeId;
  if (cand.taskType === "break" || cand.taskType === "harvest") task.blockType = cand.typeId;
  if (cand.taskType === "pickup") task.itemEntityType = cand.typeId;
  if (cand.id) task.targetId = cand.id;
  return task;
}

// 挿入を実行に移した（または試みた）ことを記録し、同一対象への再試行を抑える。
export function noteAttempt(state, task, nowMs) {
  if (!state || !task?.key) return;
  state.cooldowns = state.cooldowns || {};
  state.cooldowns[task.key] = num(nowMs, num(state.now, Date.now())) + SIDE_TUNING.cooldownMs;
}

// 期限切れクールダウンの掃除（state 肥大防止。呼び出し側が時々呼ぶ想定）
export function pruneCooldowns(state, nowMs) {
  if (!state?.cooldowns) return;
  const now = num(nowMs, num(state.now, Date.now()));
  for (const k of Object.keys(state.cooldowns)) if (state.cooldowns[k] <= now) delete state.cooldowns[k];
}

export { keyFor as opportunityKey };
