// exp_recorder.js — LIZE-EXP v1 経験レコーダ純粋核 (Phase 7 準備 6-ML1〜5)
// 統合版 (cycle0710, v0.4.91): 元ドラフトは cycle0710-a02。 cycle0616-a11 ドラフトへ cycle0649-a03 のブロッカー
// B1/B2 を反映した「BP/scripts/exp_recorder.js へそのまま置ける形」。
//   B1: バイト数計測とハッシュは fail_vocab.js の utf8Bytes / fnv1a を import して使う。
//       Bedrock Script API に無い場合がある API を本モジュールで直接使わない
//       (無防備だと serialize 全体が例外→null になり、保存だけが無言で全滅する)。
//   B2: 統合側アダプタ expCtxOf を同梱する。現行 r.lastGoal は
//       { goal:{type,item,count,predicates,...}, key, state, at } 形であり、
//       本モジュールが期待する goal {kind,pred} ではないため、明示変換が必須。
// 転記排除: REASONS / CLS は転記せず、単一の正から import する。
//   KNOWN_REASONS 等は fail_vocab.js が actions_contract.js の REASONS から導出する
//   (cycle0649-a03 実測: 値集合48件・CLS 26件とも差分0、fnv1a も同一値)。
// import パスについて: 本ドラフトは solutions/cycle0710-a02/ に置いて契約テストを
//   回すため "../../../BP/scripts/..." と書く。BP/scripts/ へ移設する際は
//   "./fail_vocab.js" へ1行差し替えること (それ以外は無変更で移せる)。
// 境界 (fail_vocab.js / trace.js と同型): 純粋関数のみ・副作用なし・Date.now() を
//   内部で呼ばない・入力不変・例外を投げない。記録専用 (戻り値を分岐に使わない)。
//   接続点は既存の関門2点だけ: commitLastAction (result 軸) と noteFail (fail 軸)。
//   code.pack は config.js の VERSION が単一の正。呼び出し側が ctx.pack /
//   expCtxOf の opts.pack に渡す (本モジュールに版数をハードコードしない)。

import {
  KNOWN_REASONS, NON_FAILURE_REASONS, UNKNOWN_REASONS, CLS_BY_REASON,
  classifyKind, classifyFailure, utf8Bytes, fnv1a,
} from "./fail_vocab.js";
// 移設後も従来の import 面を保つための再輸出 (実体は fail_vocab.js が正)
export {
  KNOWN_REASONS, NON_FAILURE_REASONS, UNKNOWN_REASONS, CLS_BY_REASON,
  classifyKind, classifyFailure, utf8Bytes, fnv1a,
};

export const EXP_SCHEMA = "lize-exp/1";
export const EXP_RECORDER_VER = 1;
export const EXP_META_KEY = "cb_exp";
export const EXP_MAX_ITEMS_DEFAULT = 300;   // 設計値 (DESIGN §2.5: 数百件規模)
export const EXP_MAX_BYTES_DEFAULT = 65536; // 設計値 (要約レコード前提。7.0 で再見積)
export const EXP_SHARD_MAX_BYTES = 8192;    // fail_vocab S3b と同値

// Atomic Action 語彙 (DESIGN §2.1 / ARCHITECTURE_PLAN Phase 2)
export const ATOMIC_KINDS = Object.freeze(new Set([
  "MOVE","BREAK","PLACE","TAKE","STORE","WITHDRAW","ATTACK","USE_ITEM","EQUIP",
  "CRAFT","SMELT","INSPECT","WAIT","SPEAK","GATHER",
]));

const s = (v, max = 256) => (typeof v === "string" && v.length ? v.slice(0, max) : null);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pos3 = (v) => (Array.isArray(v) && v.length === 3 && v.every((n) => num(n) != null))
  ? [v[0], v[1], v[2]] : null;
const cmpPack = (a, b) => { // "0.4.84" 形式の単純比較。不正は null
  const pa = /^(\d+)\.(\d+)\.(\d+)$/.exec(a || ""), pb = /^(\d+)\.(\d+)\.(\d+)$/.exec(b || "");
  if (!pa || !pb) return null;
  for (let i = 1; i <= 3; i++) { const d = (+pa[i]) - (+pb[i]); if (d) return d < 0 ? -1 : 1; }
  return 0;
};

// ---------------------------------------------------------------------------
// 6-ML2: 一般化特徴の抽出器 v1 (純粋関数)
// 入力スナップショット (呼び出し側が World Model 三状態 fact から組む材料):
//   { invKnown, items:{id:count}, capacity:{used,total}|capacityCls, hp, hpMax,
//     hunger, hungerMax, toolClass, targetPresent:true|false|null, targetDist,
//     chestKnown, chestHas, chestContentsKnown, dangerKnown, hostiles, lavaNear,
//     fallRisk, light, dim, y, biomeCls, timeCls }
// 三状態の原則: 未観測は "UNKNOWN" のまま保持し FALSE/0 に潰さない。
// feat には絶対座標・ワールド固有 ID を絶対に入れない (座標は local 層)。
// ---------------------------------------------------------------------------
export function distBucket(dist) {
  const d = num(dist);
  if (d == null || d < 0) return 4; // 未知
  if (d <= 1.5) return 0;
  if (d <= 6) return 1;
  if (d <= 16) return 2;
  return 3;
}
export function depthBand(y, dim) {
  if (dim === "minecraft:nether") return "nether";
  if (dim === "minecraft:the_end") return "end";
  const v = num(y); if (v == null) return "unknown";
  if (v < 0) return "deep";
  if (v < 32) return "mid";
  if (v < 56) return "shallow";
  return "surface";
}
export function dangerClsOf(snap) {
  if (!snap || snap.dangerKnown === false) return "unknown";
  if (snap.lavaNear === true) return "lava_near";
  if ((num(snap.hostiles) ?? 0) > 0) return "hostile_near";
  if (snap.fallRisk === true) return "fall_risk";
  // 危険が「観測済みで無し」と言えるのは dangerKnown===true のときだけ
  return snap.dangerKnown === true ? "none" : "unknown";
}
export function lightClsOf(light) {
  const v = num(light); if (v == null) return "unknown";
  return v >= 7 ? "bright" : "dark";
}
const band = (v, max) => { // 0..1 の比率 -> 帯。未観測は "UNKNOWN"
  const a = num(v), b = num(max);
  if (a == null || b == null || b <= 0) return "UNKNOWN";
  const r = a / b;
  return r <= 0.25 ? "critical" : r <= 0.5 ? "low" : r <= 0.8 ? "mid" : "high";
};
export function buildCtxSnap(snap) {
  try {
    if (!snap || typeof snap !== "object") return null;
    const invKnown = snap.invKnown === true;
    const items = {};
    if (invKnown && snap.items && typeof snap.items === "object") {
      for (const [k, v] of Object.entries(snap.items)) {
        const n = num(v); if (s(k, 128) && n != null && n >= 0) items[k] = Math.floor(n);
      }
    }
    let capacityCls = s(snap.capacityCls, 16);
    if (!capacityCls && snap.capacity && typeof snap.capacity === "object") {
      const used = num(snap.capacity.used), total = num(snap.capacity.total);
      if (used != null && total != null && total > 0) {
        const r = used / total;
        capacityCls = r <= 0 ? "empty" : r < 0.6 ? "roomy" : r < 1 ? "tight" : "full";
      }
    }
    return {
      inv: invKnown ? items : "UNKNOWN",
      capacityCls: capacityCls ?? "UNKNOWN",
      target: {
        present: snap.targetPresent === true ? "TRUE" : snap.targetPresent === false ? "FALSE" : "UNKNOWN",
        distBucket: distBucket(snap.targetDist),
      },
      chest: {
        known: snap.chestKnown === true ? "TRUE" : snap.chestKnown === false ? "FALSE" : "UNKNOWN",
        has: snap.chestHas === true ? "TRUE" : snap.chestHas === false ? "FALSE" : "UNKNOWN",
        contentsKnown: snap.chestContentsKnown === true ? "TRUE" : snap.chestContentsKnown === false ? "FALSE" : "UNKNOWN",
      },
      self: { hpBand: band(snap.hp, snap.hpMax), hungerBand: band(snap.hunger, snap.hungerMax),
              toolClass: s(snap.toolClass, 32) ?? "UNKNOWN" },
      env: { dimCls: s(snap.dim, 64) ?? "UNKNOWN", depthBand: depthBand(snap.y, snap.dim),
             biomeCls: s(snap.biomeCls, 32) ?? "UNKNOWN", timeCls: s(snap.timeCls, 16) ?? "UNKNOWN" },
    };
  } catch { return null; }
}
/** feat 層全体。goal は goal_pred 述語形 {kind, pred} をそのまま保持する */
export function buildFeat(input) {
  try {
    if (!input || typeof input !== "object") return null;
    const before = input.snapBefore ?? input.before ?? null;
    const after = input.snapAfter ?? input.after ?? null;
    const dist = input.targetDist ?? before?.targetDist ?? after?.targetDist;
    const dim = input.dim ?? before?.dim ?? after?.dim;
    const y = input.y ?? before?.y ?? after?.y;
    return {
      goal: (input.goal && typeof input.goal === "object")
        ? { kind: s(input.goal.kind, 32), pred: s(input.goal.pred, 256) } : null,
      ctxBefore: buildCtxSnap(before),
      ctxAfter: buildCtxSnap(after),
      distBucket: distBucket(dist),
      depthBand: depthBand(y, dim),
      dangerCls: dangerClsOf(before ?? after),
      lightCls: lightClsOf((before ?? after)?.light),
    };
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// 6-ML4: 失敗帰属テーブル v1 ((where, reason, コード版) -> code_suspect)
// 完全な自動判別はできない (DESIGN §2.4)。「疑わしいものは弱く使う」側に倒し、
// 合致しなければ env と断定せず、分類可能な失敗だけ env、それ以外は unknown。
// ---------------------------------------------------------------------------
export const ATTRIBUTION_RULES = Object.freeze([
  // isSolid 誤認 (正式版 API では Block の isSolid が常に undefined で固体を空気と誤認。
  // v0.4.85 で全面排除され実機で掘削回復を確認済み)。それ以前の版で移動/掘削系の
  // 失敗が起きていればバグ起因を疑う (キュー1、validate.py queue1 検査が根拠)。
  { id: "issolid-pre-0485", domains: ["nav", "path", "branchmine", "bts_break"],
    packMax: "0.4.84", note: "isSolid misread, fixed in 0.4.85" },
  // パック版配列化でスクリプト全体が読み込まれなかった版域 (v0.4.50〜0.4.55)。
  // この版域のレコードはそもそも欠落しやすいが、残っていれば信頼しない。
  { id: "packver-0450-0455", domains: null, packMin: "0.4.50", packMax: "0.4.55",
    note: "script load failure era (API version overwritten by pack version)" },
]);
export function attributionFor({ where = null, reason = null, pack = null, ok = false } = {}) {
  try {
    if (ok) return null; // 成功レコードに帰属は付けない
    const domain = typeof where === "string" ? where.split(":")[0] : null;
    for (const rule of ATTRIBUTION_RULES) {
      if (rule.domains && (!domain || !rule.domains.includes(domain))) continue;
      if (rule.packMin && (cmpPack(pack, rule.packMin) ?? -1) < 0) continue;
      if (rule.packMax && (cmpPack(pack, rule.packMax) ?? 1) > 0) continue;
      if (rule.packMin || rule.packMax) { if (cmpPack(pack, pack) == null) continue; }
      return "code_suspect";
    }
    // 帰属は fail_vocab の計画側分類 (cls) とは別軸: SET_FAILED のように cls が無くても
    // 「実行が環境で失敗した」と読める理由は env とする。ただし API_ERROR /
    // NOT_IMPLEMENTED はコード側の汎用受け皿であり環境起因と断定できないため unknown。
    if (classifyKind(reason) !== "failure") return "unknown";
    return (reason === "API_ERROR" || reason === "NOT_IMPLEMENTED") ? "unknown" : "env";
  } catch { return "unknown"; }
}

// ---------------------------------------------------------------------------
// 6-ML1: EXP レコーダ (関門2点への相乗り)
// ctx (呼び出し側=統合側が組む文脈。欠けた材料は推測で埋めず null):
//   { seq, individual, modelGen, pack, episodeId, source, goal:{kind,pred},
//     chosenBy, alternatives, expected, method, params, skillRef,
//     snapBefore, snapAfter, targetDist, dim, y,
//     posBefore, posAfter, targetPos, worldIdHash, startedAt, ticks,
//     damageTaken, safetyViolation, goalProgress }
// ---------------------------------------------------------------------------
function kindOf(rec) {
  const act = s(rec?.act, 64); if (!act) return null;
  if (ATOMIC_KINDS.has(act)) return act;
  // fail_vocab.actKeyOf と同じ汎用規則: 既知語彙外の act は USE_ITEM の手段として扱う
  return "USE_ITEM";
}
function countOf(rec) {
  for (const k of ["taken", "moved", "gained"]) { const n = num(rec?.[k]); if (n != null) return Math.floor(n); }
  return null;
}
function baseRecord(ctx, at) {
  return {
    schema: EXP_SCHEMA,
    recId: `${s(ctx?.individual, 64) ?? "lize-main"}-${Number.isInteger(ctx?.seq) ? ctx.seq : 0}`,
    episodeId: s(ctx?.episodeId, 128),
    at: num(at) ?? num(ctx?.at) ?? 0,
    code: { pack: s(ctx?.pack, 32), expRecorder: EXP_RECORDER_VER },
    modelGen: Number.isInteger(ctx?.modelGen) ? ctx.modelGen : 0,
    individual: s(ctx?.individual, 64) ?? "lize-main",
    source: s(ctx?.source, 32) ?? "self",
  };
}
function localOf(ctx) {
  return {
    worldId: s(ctx?.worldIdHash, 128),
    dim: s(ctx?.dim, 64),
    posBefore: pos3(ctx?.posBefore), posAfter: pos3(ctx?.posAfter),
    targetPos: pos3(ctx?.targetPos),
  };
}
function rewardOf(ctx, rec, obtained) {
  const ticks = num(ctx?.ticks);
  return {
    goalProgress: num(ctx?.goalProgress),
    obtained,
    timePenalty: ticks != null ? -Math.min(1, Math.round((ticks / 10000) * 10000) / 10000) : null,
    damageTaken: num(ctx?.damageTaken) ?? 0,
    safetyViolation: num(ctx?.safetyViolation) ?? 0,
  };
}
function obtainedOf(ctx, item) {
  // 差分意味論 (DESIGN §5 と同じ): 前後スナップショットが両方読めた場合だけ差分を出す
  try {
    if (!item) return null;
    const b = ctx?.snapBefore?.items?.[item], a = ctx?.snapAfter?.items?.[item];
    if (ctx?.snapBefore?.invKnown !== true || ctx?.snapAfter?.invKnown !== true) return null;
    if (num(b) == null || num(a) == null) return null;
    return Math.floor(a) - Math.floor(b);
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// B2: 統合側アダプタ expCtxOf (main.js 側の形 -> 本モジュールの ctx 形)
// 現行 r.lastGoal (main.js で makeInvGoal から組む) は
//   { goal: {type,item,count,predicates,...}, key, state, at }
// であり {kind,pred} ではない。変換なしで渡すと feat.goal が常時 null になり
// 6-ML2 の goal 軸が丸ごと欠落する。変換規則 (cycle0649-a03 裁定):
//   kind = r.lastGoal?.goal?.type ?? null   (例 "inventory_at_least")
//   pred = r.lastGoal?.key ?? null          (goalKey 文字列が pred の受け皿)
// 最小統合の範囲 (同 REPORT): seq は r.actionSeq を流用、pack は呼び出し側が
// config.js の VERSION を opts.pack で渡す。commitLastAction には bot が無く
// runtime にも bot 参照が無いため、snap/pos/dim は供給せず null のままにする
// (本モジュールは欠落を UNKNOWN/null で正しく記録する)。例外安全: 壊れた r は
// 最小 ctx {seq:null, pack, goal:null} に倒す。rec 引数は将来の材料用に受けるが
// 現行の変換では使わない (推測で埋めない)。
// ---------------------------------------------------------------------------
export function expCtxOf(r, rec, opts = {}) {
  try {
    // 呼び出し形の互換: expCtxOf(r, {pack}) と書かれた場合は第2引数を opts とみなす
    const o = (opts && typeof opts === "object" && Object.keys(opts).length)
      ? opts
      : (rec && typeof rec === "object" && ("pack" in rec) ? rec : {});
    const pack = s(o?.pack, 32);
    const lg = (r && typeof r === "object") ? r.lastGoal : null;
    const kind = s(lg?.goal?.type, 32);
    const pred = s(lg?.key, 256);
    return {
      seq: Number.isInteger(r?.actionSeq) ? r.actionSeq : null,
      pack,
      goal: (kind != null || pred != null) ? { kind, pred } : null,
    };
  } catch { return { seq: null, pack: null, goal: null }; }
}

/** commitLastAction の材料 rec {act,ok,reason,item,at,mode?,kind?,via?,detail?,...} -> EXP 1件 */
export function buildExpFromCommit(rec, ctx = {}) {
  try {
    if (!rec || typeof rec !== "object") return null;
    const kind = kindOf(rec); if (!kind) return null;
    const ok = rec.ok === true;
    const reason = ok ? null : (s(rec.reason, 64) && KNOWN_REASONS.has(rec.reason) ? rec.reason : s(rec.reason, 64));
    const item = s(rec.item, 128) ?? s(ctx?.params?.item, 128);
    const at = num(rec.at) ?? num(ctx?.at) ?? 0;
    const ticks = num(ctx?.ticks) ?? (num(ctx?.startedAt) != null && at ? Math.max(0, Math.round((at - ctx.startedAt) / 50)) : null);
    const out = {
      ...baseRecord(ctx, at),
      local: localOf(ctx),
      feat: buildFeat({ goal: ctx?.goal, snapBefore: ctx?.snapBefore, snapAfter: ctx?.snapAfter,
                         targetDist: ctx?.targetDist, dim: ctx?.dim, y: ctx?.y }),
      action: {
        kind,
        method: s(ctx?.method, 64) ?? s(rec.mode, 64) ?? s(rec.kind, 64) ?? s(rec.via, 64)
          ?? (kind === "USE_ITEM" && !ATOMIC_KINDS.has(rec.act) ? s(rec.act, 64) : null),
        params: { item, count: num(ctx?.params?.count) ?? countOf(rec) },
        skillRef: ctx?.skillRef ?? null,
      },
      decision: {
        chosenBy: s(ctx?.chosenBy, 32),
        alternatives: Array.isArray(ctx?.alternatives) ? ctx.alternatives.slice(0, 4) : [],
        expected: ctx?.expected ?? null,
      },
      result: {
        ok, reason,
        failCls: ok ? null : classifyFailure(reason),
        actualEffects: Array.isArray(ctx?.actualEffects) ? ctx.actualEffects.slice(0, 8) : [],
        ticks,
        attribution: attributionFor({ where: ctx?.where ?? null, reason, pack: ctx?.pack, ok }),
      },
      reward: rewardOf(ctx, rec, obtainedOf(ctx, item) ?? countOf(rec)),
    };
    // reward.timePenalty は result.ticks (tick 単位) 基準で付け直す: -(ticks/10000), 上限 -1
    out.reward.timePenalty = ticks != null ? -Math.min(1, ticks / 10000) : null;
    return out;
  } catch { return null; }
}

/** noteFail の where が EXP 自身/トレース/failAgg の保存キーなら true (再帰防止) */
export function isExpInternalWhere(where) {
  if (typeof where !== "string") return false;
  const i = where.indexOf(":"); if (i < 0) return false;
  const domain = where.slice(0, i), key = where.slice(i + 1);
  if (domain !== "dp" && domain !== "dps") return false;
  return key === EXP_META_KEY || key.startsWith(EXP_META_KEY + ":")
    || key === "cb_trace" || key.startsWith("cb_trace:")
    || key === "cb_failagg" || key.startsWith("cb_failagg:");
}
/** noteFail 材料 (where, msg) -> EXP 1件。内部 fail は null (器側でも落とす) */
export function buildExpFromNoteFail(where, msg, ctx = {}) {
  try {
    if (typeof where !== "string" || !where) return null;
    if (isExpInternalWhere(where)) return null;
    const codeRaw = where.includes(":") ? where.slice(where.indexOf(":") + 1) : "";
    const up = codeRaw.toUpperCase();
    const reason = KNOWN_REASONS.has(up) ? up : null; // 寄せない (fail_vocab normalizeWhere と同方針の最小形)
    const at = num(ctx?.at) ?? 0;
    return {
      ...baseRecord(ctx, at),
      local: localOf(ctx),
      feat: buildFeat({ goal: ctx?.goal, snapBefore: ctx?.snapBefore, snapAfter: ctx?.snapAfter,
                         targetDist: ctx?.targetDist, dim: ctx?.dim, y: ctx?.y }),
      action: { kind: s(ctx?.act, 64) && ATOMIC_KINDS.has(ctx.act) ? ctx.act : "UNKNOWN",
                method: null, params: { item: s(ctx?.params?.item, 128), count: null }, skillRef: null },
      decision: { chosenBy: null, alternatives: [], expected: null },
      result: { ok: false, reason, failCls: classifyFailure(reason),
                actualEffects: [], ticks: num(ctx?.ticks),
                attribution: attributionFor({ where, reason, pack: ctx?.pack, ok: false }) },
      reward: { goalProgress: null, obtained: null, timePenalty: null, damageTaken: 0, safetyViolation: 0 },
      note: { where: s(where, 128), msg: s(msg, 120) },
      via: "noteFail",
    };
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// スキーマ検証 (7.0 のオフライン検証器の先行形。テストと書き出し検査で使う)
// ---------------------------------------------------------------------------
export function validateExpRecord(rec) {
  const errs = [];
  try {
    if (!rec || typeof rec !== "object") return ["not_object"];
    if (rec.schema !== EXP_SCHEMA) errs.push("schema");
    if (!s(rec.recId, 128)) errs.push("recId");
    if (typeof rec.at !== "number" || !Number.isFinite(rec.at)) errs.push("at");
    if (!rec.code || typeof rec.code !== "object") errs.push("code");
    if (!rec.local || typeof rec.local !== "object") errs.push("local");
    if (!rec.feat || typeof rec.feat !== "object") errs.push("feat");
    else {
      // feat に絶対座標が混入していないことの機械検査 (6-ML2 受け入れ条件)
      const fjson = JSON.stringify(rec.feat);
      for (const key of ["posBefore", "posAfter", "targetPos", "worldId"]) if (fjson.includes(key)) errs.push("feat_has_local:" + key);
      if (!(rec.feat.distBucket >= 0 && rec.feat.distBucket <= 4)) errs.push("distBucket");
    }
    if (!rec.action || !s(rec.action.kind, 64)) errs.push("action.kind");
    if (!rec.result || typeof rec.result.ok !== "boolean") errs.push("result.ok");
    if (rec.result && rec.result.ok === false && rec.result.attribution != null
        && !["env", "code_suspect", "unknown"].includes(rec.result.attribution)) errs.push("attribution");
    if (!rec.reward || typeof rec.reward !== "object") errs.push("reward");
    return errs;
  } catch { return ["exception"]; }
}

// ---------------------------------------------------------------------------
// 6-ML3: 環状保存と選別 (純粋な状態 + シャード化。DP 読み書きは統合側)
// 優先保持: 失敗 (prio 2) > 初回成功 (同一 kind+item の最初の成功, prio 1) > 通常 (prio 0)。
// 溢れたら「優先度が低く古いもの」から捨てる。入ってきたレコード自身が最弱で満杯なら入れない。
// ---------------------------------------------------------------------------
export function createExpStore(opts = {}) {
  return {
    maxItems: Number.isInteger(opts.maxItems) && opts.maxItems > 0 ? opts.maxItems : EXP_MAX_ITEMS_DEFAULT,
    maxBytes: num(opts.maxBytes) > 0 ? Math.floor(opts.maxBytes) : EXP_MAX_BYTES_DEFAULT,
    items: [], firstOkKeys: [],
  };
}
export function expBytes(store) {
  // B1: utf8Bytes (fail_vocab) は無い場合がある API へのガード＋手計算を内蔵する
  try { return utf8Bytes(JSON.stringify(store?.items ?? [])); }
  catch { return (JSON.stringify(store?.items ?? [])).length; }
}
/** store へ1件追加。保持したら true、選別で落ちたら false。store は変更される (器の状態) */
export function addExpRecord(store, rec) {
  try {
    if (!store || validateExpRecord(rec).length) return false;
    const key = `${rec.action.kind}:${rec.action.params?.item ?? "?"}`;
    const isFirstOk = rec.result.ok === true && !store.firstOkKeys.includes(key);
    store.items.push(rec);
    if (isFirstOk) store.firstOkKeys.push(key);
    while (store.items.length > store.maxItems || expBytes(store) > store.maxBytes) {
      // 最弱 (prio 最小・最古) を1件捨てる
      let worst = -1, worstPrio = Infinity;
      for (let i = 0; i < store.items.length; i++) {
        const p = store.items[i].result?.ok === false ? 2
          : (store.firstOkKeys.includes(`${store.items[i].action?.kind}:${store.items[i].action?.params?.item ?? "?"}`)
             && store.items[i] !== rec ? 1 : 0);
        // firstOkKeys はキー単位なので「初回」判定は近似: 同キーの最古の成功を初回とみなす
        if (p < worstPrio) { worstPrio = p; worst = i; if (p === 0) break; }
      }
      if (worst < 0) break;
      const dropped = store.items[worst];
      store.items.splice(worst, 1);
      if (dropped === rec) return false; // 入れた本人が落ちた
    }
    return store.items.includes(rec);
  } catch { return false; }
}

// --- シャード化 (fail_vocab S3b と同型: シャード -> meta の順、gen+hash で torn write 検出) ---
// fnv1a は fail_vocab.js から import 済み (B1。上部の再輸出を参照)。
export function expShardKey(i) { return Number.isInteger(i) && i >= 0 ? `${EXP_META_KEY}:${i}` : null; }
export function serializeExpStore(store, opts = {}) {
  try {
    if (!store || !Array.isArray(store.items)) return null;
    const gen = Number.isInteger(opts.gen) && opts.gen > 0 ? opts.gen : 1;
    const maxShard = num(opts.maxShardBytes) > 0 ? Math.floor(opts.maxShardBytes) : EXP_SHARD_MAX_BYTES;
    const shards = []; let cur = [];
    const shardStr = (i, arr) => JSON.stringify({ v: 1, gen, i, e: arr });
    for (const rec of store.items) {
      const trial = [...cur, rec];
      if (cur.length && utf8Bytes(shardStr(shards.length, trial)) > maxShard) {
        shards.push(shardStr(shards.length, cur)); cur = [rec];
      } else cur = trial;
    }
    if (cur.length || !shards.length) shards.push(shardStr(shards.length, cur));
    const writes = {};
    shards.forEach((str, i) => { writes[expShardKey(i)] = str; });
    const meta = { v: 1, gen, hash: fnv1a(shards.join("\n")), n: store.items.length,
                   shards: shards.length, firstOkKeys: store.firstOkKeys.slice(0, 256) };
    writes[EXP_META_KEY] = JSON.stringify(meta);
    return { writes, meta };
  } catch { return null; }
}
export function restoreExpStore(read, opts = {}) {
  const empty = () => ({ store: createExpStore(opts), status: "empty", dropped: 0 });
  try {
    const get = typeof read === "function" ? (k) => { try { const v = read(k); return typeof v === "string" ? v : null; } catch { return null; } }
      : (read instanceof Map ? (k) => read.get(k) ?? null : () => null);
    const metaRaw = get(EXP_META_KEY); if (!metaRaw) return empty();
    const meta = JSON.parse(metaRaw);
    if (!meta || meta.v !== 1 || !Number.isInteger(meta.gen) || meta.gen <= 0
        || !Number.isInteger(meta.shards) || meta.shards < 1 || meta.shards > 64
        || typeof meta.hash !== "string") return { store: createExpStore(opts), status: "corrupt", dropped: 0 };
    const raws = [];
    for (let i = 0; i < meta.shards; i++) { const r = get(expShardKey(i)); if (r == null) return { store: createExpStore(opts), status: "corrupt", dropped: 0 }; raws.push(r); }
    if (fnv1a(raws.join("\n")) !== meta.hash) return { store: createExpStore(opts), status: "corrupt", dropped: 0 };
    const store = createExpStore(opts); let dropped = 0;
    for (let i = 0; i < raws.length; i++) {
      const sh = JSON.parse(raws[i]);
      if (!sh || sh.v !== 1 || sh.gen !== meta.gen || sh.i !== i || !Array.isArray(sh.e))
        return { store: createExpStore(opts), status: "corrupt", dropped: 0 };
      for (const rec of sh.e) { if (validateExpRecord(rec).length) { dropped++; continue; } store.items.push(rec); }
    }
    store.firstOkKeys = Array.isArray(meta.firstOkKeys) ? meta.firstOkKeys.filter((k) => typeof k === "string") : [];
    return { store, status: "ok", dropped };
  } catch { return { store: createExpStore(opts), status: "corrupt", dropped: 0 }; }
}

// ---------------------------------------------------------------------------
// 6-ML5: 書き出し経路 (訓練系統) — JSONL の生成と復元 (一往復の純粋側)
// 実ログ出力 (コンテンツログ) は gametest 側の仕事で、本関数は文字列化まで。
// 通常版には入れない (INTEGRATION.md)。
// ---------------------------------------------------------------------------
export function exportExpJsonl(store) {
  try {
    if (!store || !Array.isArray(store.items)) return "";
    return store.items.map((r) => JSON.stringify(r)).join("\n") + (store.items.length ? "\n" : "");
  } catch { return ""; }
}
export function parseExpJsonl(text) {
  const records = []; let bad = 0;
  try {
    if (typeof text !== "string") return { records, bad: 0 };
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try { const rec = JSON.parse(line); if (validateExpRecord(rec).length) bad++; else records.push(rec); }
      catch { bad++; }
    }
    return { records, bad };
  } catch { return { records, bad }; }
}
