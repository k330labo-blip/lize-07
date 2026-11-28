// observability.js — 観測可能性ゲート（X-ray 防止の中核・純粋モジュール）
//
//
// 従来のリゼはチャンク内のブロックを広範囲に直接走査し、壁に完全に隠れた地下鉱石の
// 正確な座標まで世界モデル・プランナーへ渡していた。これは実質的な X-ray であり、
// 「鉱石の場所を最初から知っている AI」になってしまう。本モジュールは、生の走査結果と
// 行動判断の間に必ず挟む「観測可能性ゲート」を提供する:
// world API → raw scan → → observation → world model → planner
// ゲートを通過した情報だけが「観測した」と言える。通過できなかった情報は、存在しない
// のではなく「unknown（分からない）」として扱う。未読込・走査失敗・視線不良は全て
// unknown 側へ倒し、confirmed_absent（見て無かった）とは絶対に混同しない。
//
// 本モジュールは @minecraft/server に依存しない。外部依存はセル種別プロバイダ
// provider(x, y, z) => typeId 文字列 | null （null = 未読込 / 取得失敗）
// のみ。統合側（main.js 等）が実 Dimension からこの関数を作って注入する。
// ローカルな衝突判定（足元・次の一歩など）には使わないこと。それは移動層の責務であり、
// ここを通すのは「意味情報を世界モデルへ登録する知覚」だけである（転用禁止）。

// ---------------------------------------------------------------------------
// 遮蔽分類（isOpaque）
// ---------------------------------------------------------------------------
// 視線が通るかは「そのブロックが視界を遮るか」で決まる。鉱石かどうかで
// 判定するのではない（鉱石 ID フィルタは禁止事項）。遮蔽はブロックの一般的な性質
// （不透明 / 透過 / 部分遮蔽 / 流体）として分類し、鉱石・チェスト・溶岩など対象の
// 種類に依らず同じ規則を適用する。

export const OCCLUSION = Object.freeze({
OPAQUE: "opaque", // 視界を完全に遮る（石・土・原木など大半の固体）
TRANSPARENT: "transparent", // 視界を通す（空気・ガラス・葉・水など）
PARTIAL: "partial", // 一部だけ遮る（ハーフブロック・階段・フェンス等）
FLUID: "fluid", // 流体（水は透過、溶岩は不透過として個別に扱う）
UNKNOWN: "unknown", // 分類不能・取得失敗 → 安全側（遮る扱い）
});

// 視界を通すブロック（完全一致）
const TRANSPARENT_EXACT = new Set([
"minecraft:air", "minecraft:cave_air", "minecraft:void_air",
"minecraft:glass", "minecraft:glass_pane", "minecraft:tinted_glass",
"minecraft:ice", "minecraft:barrier", "minecraft:light_block",
"minecraft:structure_void",
"minecraft:torch", "minecraft:soul_torch", "minecraft:redstone_torch",
"minecraft:redstone_wire", "minecraft:rail", "minecraft:golden_rail",
"minecraft:detector_rail", "minecraft:activator_rail",
"minecraft:lever", "minecraft:vine", "minecraft:glow_lichen",
"minecraft:lily_pad", "minecraft:sugar_cane", "minecraft:cobweb",
"minecraft:fire", "minecraft:soul_fire", "minecraft:ladder",
"minecraft:tripwire", "minecraft:string", "minecraft:scaffolding",
"minecraft:slime_block", "minecraft:honey_block",
// 0-P S0 (cyc2483, A01裁定 P2): 接尾辞形で拾えない単語形IDの族内不整合を是正 (草・シダ・枯れ木・薄雪・ベリー茂み・ウィザーローズは視線を遮らない)
"minecraft:grass", "minecraft:fern", "minecraft:dead_bush", "minecraft:snow_layer", "minecraft:sweet_berry_bush", "minecraft:wither_rose",
]);

// 一部だけ遮るブロック（接尾辞）。視線判定では保守的に「遮る」側へ倒す:
// 部分遮蔽越しに「見えた」と主張すると、床のハーフブロック越し・階段の隙間越しに
// 隠れた対象を観測済みにしてしまう（床越し X-ray の温床）ため。
const PARTIAL_SUFFIX = ["_slab", "_stairs", "_fence", "_wall", "_trapdoor"]; // 0-P S0 (cyc2483, A01裁定グループD): _carpet は床面の薄片で視線を遮らないため partial から外し transparent へ

// 不透過の流体。溶岩の中は視認できないため、溶岩越しの対象は観測できない。
const OPAQUE_FLUID = new Set(["minecraft:lava", "minecraft:flowing_lava"]);
// 透過の流体。水越しには（視認範囲内で）対象が見える。
const TRANSPARENT_FLUID = new Set(["minecraft:water", "minecraft:flowing_water"]);

/**
* typeId の遮蔽クラスを返す。
* 未知の ID は OPAQUE 側へ倒す（分からないブロック越しに「見えた」と言わないため）。
* null / undefined（未読込・取得失敗）は UNKNOWN を返し、呼び出し側は必ず
* 「観測できない」側へ倒すこと。存在しないことの証拠には決してならない。
*/
export function occlusionClass(typeId) {
if (typeId === null || typeId === undefined) return OCCLUSION.UNKNOWN;
const id = String(typeId);
if (TRANSPARENT_FLUID.has(id)) return OCCLUSION.TRANSPARENT;
if (OPAQUE_FLUID.has(id)) return OCCLUSION.OPAQUE;
if (TRANSPARENT_EXACT.has(id)) return OCCLUSION.TRANSPARENT;
if (id.includes("glass")) return OCCLUSION.TRANSPARENT; // 色付きガラス・板ガラス全般
if (id.endsWith("_leaves")) return OCCLUSION.TRANSPARENT; // 葉は透けて見える（隙間がある）
if (id.endsWith("_sign") || id.endsWith("_button") || id.endsWith("_pressure_plate")) return OCCLUSION.TRANSPARENT;
if (id.endsWith("_grass") || id.endsWith("_flower") || id.endsWith("_fern") || id.endsWith("_sapling") || id.endsWith("_tulip") || id.endsWith("_orchid") || id.endsWith("_daisy")) return OCCLUSION.TRANSPARENT;
if (id.endsWith("_carpet")) return OCCLUSION.TRANSPARENT; // 0-P S0: カーペット類は視線透過 (A01裁定)
for (const s of PARTIAL_SUFFIX) if (id.endsWith(s)) return OCCLUSION.PARTIAL;
return OCCLUSION.OPAQUE; // 大半の固体はこちら（鉱石・チェスト等の対象物も含む）
}

/**
* そのブロックが視線を遮るか。
* PARTIAL と UNKNOWN も遮る扱いにする（不明・部分遮蔽越しの観測主張を防ぐため）。
*/
export function isOpaque(typeId) {
const c = occlusionClass(typeId);
return c === OCCLUSION.OPAQUE || c === OCCLUSION.PARTIAL || c === OCCLUSION.UNKNOWN;
}

// ---------------------------------------------------------------------------
// 露出判定（hasExposure）
// ---------------------------------------------------------------------------
const FACES = Object.freeze([
[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
]);

/**
* 対象セルの6面のいずれかが、空気または非不透明セルに面しているか。
* 完全に石で囲まれたブロックは、たとえ存在を知っていても「見える」
* はずがない。露出していない対象を観測済みにする経路をここで断つ。
* 隣接セルが null（未読込）の面は「露出している」とは数えない（不明は unknown 側）。
*/
export function hasExposure(provider, cell) {
if (!provider ||!cell) return false;
for (const [dx, dy, dz] of FACES) {
const t = safeGet(provider, cell.x + dx, cell.y + dy, cell.z + dz);
if (t === null) continue; // 未読込の面からは露出を主張できない
if (!isOpaque(t)) return true;
}
return false;
}

function safeGet(provider, x, y, z) {
try {
const t = provider(x, y, z);
return t === undefined? null: t;
} catch {
return null; // 取得例外は未読込と同じ（unknown）。「無い」ことの証拠にしない
}
}

// ---------------------------------------------------------------------------
// 視線判定（lineOfSight）— ボクセル DDA 光線
// ---------------------------------------------------------------------------
/**
* 視点 eye（{x,y,z} 実数座標）から対象セル cell（整数座標）の中心へ光線を飛ばし、
* 途中に不透明ブロックが無いかを判定する。
* 露出していても、リゼの位置から壁・床・天井に遮られていれば見えない。
* 角越し・壁越し・床越しの観測を弾くのがこの関数の役割。DDA は軸ごとに1セルずつ
* 進むため、斜めの光線が角をかすめる場合は両側のセルを検査し、角抜けを許さない。
* 途中に未読込セル（null）があれば「不明」として false を返す（見えたとは言わない）。
* 対象セル自体と視点のあるセルは遮蔽として数えない（対象の面に到達した時点で可視）。
*/
export function lineOfSight(provider, eye, cell) {
if (!provider ||!eye ||!cell) return false;
const sx = eye.x, sy = eye.y, sz = eye.z;
const tx = cell.x + 0.5, ty = cell.y + 0.5, tz = cell.z + 0.5;
let vx = Math.floor(sx), vy = Math.floor(sy), vz = Math.floor(sz);
const gx = cell.x, gy = cell.y, gz = cell.z;
if (vx === gx && vy === gy && vz === gz) return true; // 同一セル内は遮るものがない

const dx = tx - sx, dy = ty - sy, dz = tz - sz;
const stepX = dx > 0? 1: -1, stepY = dy > 0? 1: -1, stepZ = dz > 0? 1: -1;
const tDeltaX = dx!== 0? Math.abs(1 / dx): Infinity;
const tDeltaY = dy!== 0? Math.abs(1 / dy): Infinity;
const tDeltaZ = dz!== 0? Math.abs(1 / dz): Infinity;
let tMaxX = dx!== 0? (dx > 0? (vx + 1 - sx): (sx - vx)) * tDeltaX: Infinity;
let tMaxY = dy!== 0? (dy > 0? (vy + 1 - sy): (sy - vy)) * tDeltaY: Infinity;
let tMaxZ = dz!== 0? (dz > 0? (vz + 1 - sz): (sz - vz)) * tDeltaZ: Infinity;

// 光線の最大踏破セル数（暴走防止）。距離上限は canObserve 側でも別途見る。
const MAX_STEPS = 256;
for (let i = 0; i < MAX_STEPS; i++) {
if (tMaxX <= tMaxY && tMaxX <= tMaxZ) { vx += stepX; tMaxX += tDeltaX;}
else if (tMaxY <= tMaxZ) { vy += stepY; tMaxY += tDeltaY;}
else { vz += stepZ; tMaxZ += tDeltaZ;}
if (vx === gx && vy === gy && vz === gz) return true; // 対象セルへ到達（露出面に届いた）
const t = safeGet(provider, vx, vy, vz);
if (t === null) return false; // 途中に未読込 → 不明。見えたことにはしない
if (isOpaque(t)) return false; // 壁・床・天井に遮られた
}
return false; // 上限到達は不明として倒す
}

// ---------------------------------------------------------------------------
// 観測可否（canObserve）
// ---------------------------------------------------------------------------
export const OBSERVE_DEFAULT_MAX_DIST = 64; // 0-P S0 (cyc2483): 認識距離の既定は約64ブロック (4チャンク)。露出+視線の条件は遠距離でも緩めない

/**
* 対象セルを「今、観測した」と主張してよいか。
* 条件は全て必須: (1) 対象セルが読み込めている (2) 対象が空気でない
* (3) 距離が上限以内 (4) 露出している (5) 視線が通っている。
* 世界モデルへの登録はこの関数の true を唯一の入口にする。
* 生の走査結果（raw scan）がこの関数を経ずにプランナー・目標選択・世界モデルへ
* 渡る経路が残っていると、ゲートの意味が無くなる。統合側は必ずここを通すこと。
*/
export function canObserve(provider, eye, cell, opts = {}) {
return canObserveDetail(provider, eye, cell, opts).ok;
}

/** canObserve の理由つき版。デバッグとテスト用。理由が行動判断へ漏れないよう、
* 統合側は ok の真偽だけを世界モデルへ渡し、reason はログ専用に留めること。 */
export function canObserveDetail(provider, eye, cell, opts = {}) {
const maxDist = Number.isFinite(opts.maxDist)? opts.maxDist: OBSERVE_DEFAULT_MAX_DIST;
if (!provider ||!eye ||!cell) return { ok: false, reason: "invalid_args"};
const target = safeGet(provider, cell.x, cell.y, cell.z);
if (target === null) return { ok: false, reason: "unloaded"}; // 未読込 = unknown
if (target === "minecraft:air" || target === "minecraft:cave_air" || target === "minecraft:void_air") {
return { ok: false, reason: "empty"}; // 観測対象が存在しない
}
const d = Math.hypot(cell.x + 0.5 - eye.x, cell.y + 0.5 - eye.y, cell.z + 0.5 - eye.z);
if (d > maxDist) return { ok: false, reason: "too_far"};
if (!hasExposure(provider, cell)) return { ok: false, reason: "not_exposed"}; // 完全に覆われている
if (!lineOfSight(provider, eye, cell)) return { ok: false, reason: "no_line_of_sight"}; // 壁・床・角の向こう
return { ok: true, reason: "observed"};
}

/**
* 生走査の候補リストをゲートに通し、観測できたものだけを観測レコード化して返す。
* 走査側が「見つけた座標リスト」をそのまま返すと、呼び出し側が
* うっかり全件を世界モデルへ入れてしまう。入力が raw scan でも、出力は観測済み
* レコードだけになるよう、境界をこの関数の形に固定する。
* 隠れた候補の件数・種類・座標は返り値に一切含めない（間接的な情報漏れ防止）。
*/
export function gateScanResults(provider, eye, rawCells, opts = {}) {
const out = [];
if (!Array.isArray(rawCells)) return out;
const at = Number.isFinite(opts.at)? opts.at: 0;
for (const cell of rawCells) {
if (!cell) continue;
if (!canObserve(provider, eye, cell, opts)) continue; // 見えないものは「無かったこと」ではなく「知らない」
const typeId = safeGet(provider, cell.x, cell.y, cell.z);
out.push(makeObservation({
cell: { x: cell.x, y: cell.y, z: cell.z},
typeId,
method: opts.method || "seen",
at,
confidence: opts.confidence,
}));
}
return out;
}

// ---------------------------------------------------------------------------
// 観測状態モデル
// ---------------------------------------------------------------------------
// 「知っている」と「知らない」の二値では、記憶の鮮度や推測を区別できず、
// 古い記憶や分布からの推測が確定情報として行動を引っ張ってしまう。状態を分けることで、
// プランナーは observed だけを確定として扱い、inferred_region は探索方針の参考にだけ
// 使える。confirmed_absent は「観測可能な位置を実際に見て、無かった」場合に限る。
export const OBS = Object.freeze({
UNKNOWN: "unknown", // まだ観測していない / 読めなかった
OBSERVED: "observed", // 実際に視認・接触して確認した
REMEMBERED: "remembered", // 以前確認したが今は直接見えていない
STALE: "stale", // 時間経過・再確認失敗で再確認が必要
INFERRED_REGION: "inferred_region", // 分布知識からの推測だけ（正確な座標なし）
CONFIRMED_ABSENT: "confirmed_absent", // 見える位置を実際に見て、存在しなかった
});

// 観測方法ごとの既定の信頼度。掘った・触った・開けたは直接証拠なので高い。
export const METHOD_CONFIDENCE = Object.freeze({
seen: 0.9,
dug: 1.0,
touched: 1.0,
opened: 1.0,
remembered: 0.6,
});

export const OBS_METHODS = Object.freeze(Object.keys(METHOD_CONFIDENCE));

/**
* 観測レコードを生成する。観測した時刻・方法・信頼度を必ず保持する
* （後から「なぜ知っているのか」を監査できなければ、X-ray 由来の知識と区別できない）。
* method が不正なら seen に倒す。confidence は 0..1 にクランプする。
*/
export function makeObservation({ cell, typeId, method = "seen", at = 0, confidence} = {}) {
const m = OBS_METHODS.includes(method)? method: "seen";
const conf = Number.isFinite(confidence)
? Math.min(1, Math.max(0, confidence))
: (METHOD_CONFIDENCE[m]?? 0.5);
return {
state: OBS.OBSERVED,
cell: cell? { x: cell.x | 0, y: cell.y | 0, z: cell.z | 0}: null,
typeId: typeId || null,
method: m,
observedAt: at, // 最初に観測した時刻
lastConfirmedAt: at, // 最後に実在を確認した時刻
confidence: conf,
};
}

/** unknown レコード（何も知らない。存在も不在も主張しない）。 */
export function makeUnknown(cell = null) {
return {
state: OBS.UNKNOWN,
cell: cell? { x: cell.x | 0, y: cell.y | 0, z: cell.z | 0}: null,
typeId: null,
method: null,
observedAt: null,
lastConfirmedAt: null,
confidence: 0,
};
}

/**
* inferred_region レコードを生成する。
* 分布知識は「この高度帯・この区画ではダイヤが期待できる」
* という粗い推測でしかない。ここに正確な座標を持たせると、推測の皮を被った X-ray
* 情報がプランナーへ流れる。よって本レコードは cell / x / z フィールドを構造的に
* 持たない。持つのは高度帯（yMin/yMax）と区画キー（regionKey）だけ。
* regionKey は統合側が作る粗い区画識別子（例: "overworld:r3:-2"）。座標そのものは入れない。
*/
export function makeInferredRegion({ regionKey, dimension = null, yMin, yMax, expectTypeId = null, at = 0, confidence = 0.3} = {}) {
return {
state: OBS.INFERRED_REGION,
regionKey: regionKey || null,
dimension: dimension || null,
yMin: Number.isFinite(yMin)? yMin: null,
yMax: Number.isFinite(yMax)? yMax: null,
expectTypeId: expectTypeId || null, // 期待する対象（存在の主張ではない）
inferredAt: at,
confidence: Number.isFinite(confidence)? Math.min(1, Math.max(0, confidence)): 0.3,
};
}

const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;

/**
* 観測レコードの状態遷移。入力レコードは変更せず、新しいレコードを返す。
* event:
* { type: "observe", method?, at, confidence?, typeId?} 再観測 → OBSERVED に戻す
* { type: "lose_sight", at} 見失う → REMEMBERED
* { type: "age", at, staleAfterMs?} 時間経過 → STALE（閾値超過時）
* 記憶は放っておくと鮮度が落ちる。時間経過や再確認失敗で STALE へ落とす
* ことで、「古い記憶だけを根拠に無限に同じ位置へ向かう」事故を防ぐ。
* ここでは CONFIRMED_ABSENT へは遷移しない。不在の確定は markConfirmedAbsent /
* recheckObservation のように「実際に見た」検証を伴う経路でだけ行う。
*/
export function transitionObservation(rec, event) {
if (!rec ||!event) return rec;
const at = Number.isFinite(event.at)? event.at: 0;
switch (event.type) {
case "observe": {
const m = OBS_METHODS.includes(event.method)? event.method: (rec.method || "seen");
return {
...rec,
state: OBS.OBSERVED,
typeId: event.typeId!== undefined? event.typeId: rec.typeId,
method: m,
lastConfirmedAt: at,
confidence: Number.isFinite(event.confidence)
? Math.min(1, Math.max(0, event.confidence))
: (METHOD_CONFIDENCE[m]?? rec.confidence),
};
}
case "lose_sight": {
if (rec.state!== OBS.OBSERVED) return rec;
return {...rec, state: OBS.REMEMBERED, method: "remembered"};
}
case "age": {
const staleAfter = Number.isFinite(event.staleAfterMs)? event.staleAfterMs: DEFAULT_STALE_AFTER_MS;
if ((rec.state === OBS.OBSERVED || rec.state === OBS.REMEMBERED)
&& Number.isFinite(rec.lastConfirmedAt) && at - rec.lastConfirmedAt >= staleAfter) {
return {...rec, state: OBS.STALE};
}
return rec;
}
default:
return rec;
}
}

/**
* そのセル位置が「今見える」かを、対象物の有無と切り離して判定する内部ヘルパー。
* 不在確認は「対象が無いセル」へ視線が届くことが前提になるため、対象セル自体の
* 中身ではなく、光線が対象セルの面まで到達するか（lineOfSight）で判定する。
*/
function positionVisible(provider, eye, cell, opts) {
const maxDist = Number.isFinite(opts.maxDist)? opts.maxDist: OBSERVE_DEFAULT_MAX_DIST;
const d = Math.hypot(cell.x + 0.5 - eye.x, cell.y + 0.5 - eye.y, cell.z + 0.5 - eye.z);
if (d > maxDist) return false;
return lineOfSight(provider, eye, cell);
}

/**
* 記憶した対象の再確認を行い、記憶をどうすべきか返す。
* 戻り値: { outcome, record}
* outcome "confirmed": 同じ対象が観測できた → record は OBSERVED に更新
* outcome "gone": 位置が見えていて、対象が消えている（空気・別物）→ record は null（記憶を除去）
* outcome "unknown": 未読込・視線不良・遠方で確認できない → record は STALE（記憶は消さない）
* 読めなかったことを「消滅」と解釈すると、正当な記憶まで失われる。
* 逆に、採掘済みの対象を記憶し続けると無限に同じ位置へ向かう。両者を分けるのがこの関数。
*/
export function recheckObservation(provider, eye, rec, at = 0, opts = {}) {
if (!rec ||!rec.cell) return { outcome: "unknown", record: rec};
const cell = rec.cell;
const now = safeGet(provider, cell.x, cell.y, cell.z);
if (now === null) {
// 未読込・走査失敗は「消えた」ではない。再確認が必要な STALE に落として保持する。
return { outcome: "unknown", record: {...rec, state: OBS.STALE}};
}
if (now === rec.typeId) {
if (canObserve(provider, eye, cell, opts)) {
return {
outcome: "confirmed",
record: transitionObservation(rec, { type: "observe", method: "seen", at}),
};
}
// 存在は読めたが今の位置からは見えない → 記憶として保持（鮮度は落とす）
return { outcome: "unknown", record: {...rec, state: OBS.STALE}};
}
// セルの中身が変わっている。ただし「位置が見えている」場合にだけ消滅と確定する。
// 見えていない位置の変化は、読み取り範囲の都合かもしれないため確定しない。
if (positionVisible(provider, eye, cell, opts)) {
return { outcome: "gone", record: null};
}
return { outcome: "unknown", record: {...rec, state: OBS.STALE}};
}

/**
* 「その場所に対象が無い」ことを確定してよいか判定し、CONFIRMED_ABSENT レコードを作る。
* 成立条件: 対象セルが読み込めていて空気であり、かつその位置まで視線が届いている
* （＝観測可能な範囲を実際に見た）。未読込・走査失敗・視線不良では絶対に確定せず、
* UNKNOWN レコードを返す。
* confirmed_absent を安易に付けると、未探索の区画を「鉱石なし」と
* 記録して二度と探索しなくなる。存在しないことの確定は、見たことの確定と同じ
* 厳しさで扱う。
*/
export function markConfirmedAbsent(provider, eye, cell, at = 0, opts = {}) {
if (!provider ||!eye ||!cell) return makeUnknown(cell);
const now = safeGet(provider, cell.x, cell.y, cell.z);
if (now === null) return makeUnknown(cell); // 読めなかった → 不在とは言えない
const isAir = now === "minecraft:air" || now === "minecraft:cave_air" || now === "minecraft:void_air";
if (!isAir) return makeUnknown(cell); // 何かある → 少なくとも「不在」ではない
if (!positionVisible(provider, eye, cell, opts)) return makeUnknown(cell); // 見えていない場所の不在は主張できない
return {
state: OBS.CONFIRMED_ABSENT,
cell: { x: cell.x | 0, y: cell.y | 0, z: cell.z | 0},
typeId: null,
method: "seen",
observedAt: at,
lastConfirmedAt: at,
confidence: 0.9,
};
}
