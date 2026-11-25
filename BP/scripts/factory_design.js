// ============================================================
// factory_design.js — 軌道工廠オートメーション設計エンジン
// 「こういう自動化装置を組んで」と言われたら、目的アイテムから
// レシピグラフを遡り、機械構成・電力収支・ベルト・必要素材・
// 設置面積を返す純粋JSモジュール（@minecraft/server 非依存）。
//
// 数値の出典は全て軌道工廠 v0.8.311 実データ:
// ~/workspace/mc-debug-pc/of311/BP/scripts/config.js (PROCESS_RECIPES / ENERGY)
// ~/workspace/mc-debug-pc/of311/BP/scripts/ore-processing.js (鉱石加工3段)
// ~/workspace/mc-debug-pc/of311/BP/scripts/solar.js (太陽光の発電レート)
// ~/workspace/mc-debug-pc/of311/BP/scripts/fluids.js (石油火力の最大発電)
// ~/workspace/mc-debug-pc/of311/BP/scripts/machine-speed.js (速度倍率と消費)
// ~/workspace/mc-debug-pc/of311/BP/scripts/expansion.js (ベルト級別・接続)
// ~/workspace/mc-debug-pc/of311/BP/recipes/*.json (バニラかまど精錬)
// 読み取れなかった値は推測で埋めず factory_design.md の「要確認」に分離。
// ============================================================

const OF = "orbital_foundry:";
const MC = "minecraft:";

// --- 機械定義 -------------------------------------------------
// genPerSec: 発電レート SE/秒（発電機のみ、出典つき）
// fuelSE: 石炭発電機の燃料価値 SE/個（config.js ENERGY.coal = 100）
export const MACHINES = {
crusher: { block: OF + "crusher", label: "粉砕機"},
washer: { block: OF + "washer", label: "洗浄機"},
ore_beneficiator: { block: OF + "ore_beneficiator", label: "選鉱機"},
electric_furnace: { block: OF + "electric_furnace", label: "電気炉"},
alloy_furnace: { block: OF + "alloy_furnace", label: "合金炉"},
press: { block: OF + "press", label: "プレス機"},
wire_mill: { block: OF + "wire_mill", label: "伸線機"},
assembler: { block: OF + "assembler", label: "組立機"},
refinery: { block: OF + "refinery", label: "精製所"},
blast_furnace: { block: MC + "blast_furnace", label: "溶鉱炉（バニラ）"},
coal_generator: { block: OF + "coal_generator", label: "石炭発電機", fuelSE: 100},
solar_generator: { block: OF + "solar_generator", label: "太陽光発電機", genPerSec: 100},
solar_concentrator: { block: OF + "solar_concentrator", label: "集光型太陽光発電機", genPerSec: 600},
thermal_generator: { block: OF + "thermal_generator", label: "石油火力発電機", genPerSec: 2000},
battery: { block: OF + "battery", label: "蓄電池 Mk I", capacity: 20000},
water_pump: { block: OF + "water_pump", label: "揚水ポンプ"},
};

// --- レシピグラフ ---------------------------------------------
// { id, machine, in:[[item,count]...], out:[[item,count]...], sec, energy(SE/回),
// fluidsIn?: [[fluid, mB]...], alt?: 代替工程（既定では選ばない）}
// energy は「加工1回あたりの消費SE」（config.js PROCESS_RECIPES の energy）。
// 速度倍率を上げると sec は割り算、energy は倍率倍になる（machine-speed.js）。
export const RECIPES = [
// 鉱石加工（ore-processing.js: 粉砕x2 / 洗浄x3 / 選鉱x5。鉄は config.js の明示レシピが正）
{ id: "crush_iron", machine: "crusher", in: [[MC + "raw_iron", 1]], out: [[OF + "crushed_iron", 2]], sec: 4, energy: 15},
{ id: "wash_iron", machine: "washer", in: [[MC + "raw_iron", 1]], out: [[OF + "crushed_iron", 3]], sec: 7, energy: 80, fluidsIn: [["water", 1000]], alt: true},
{ id: "smelt_crushed_iron", machine: "blast_furnace", in: [[OF + "crushed_iron", 1]], out: [[MC + "iron_ingot", 1]], sec: 5, energy: 0},
{ id: "crush_copper", machine: "crusher", in: [[MC + "raw_copper", 1]], out: [[OF + "crushed_copper", 2]], sec: 4, energy: 15},
{ id: "smelt_crushed_copper", machine: "blast_furnace", in: [[OF + "crushed_copper", 1]], out: [[MC + "copper_ingot", 1]], sec: 5, energy: 0},
{ id: "crush_gold", machine: "crusher", in: [[MC + "raw_gold", 1]], out: [[OF + "crushed_gold", 2]], sec: 4, energy: 15},
{ id: "smelt_crushed_gold", machine: "blast_furnace", in: [[OF + "crushed_gold", 1]], out: [[MC + "gold_ingot", 1]], sec: 5, energy: 0},
{ id: "crush_nickel", machine: "crusher", in: [[OF + "raw_nickel", 1]], out: [[OF + "crushed_nickel", 2]], sec: 4, energy: 15},
{ id: "finish_crushed_nickel", machine: "electric_furnace", in: [[OF + "crushed_nickel", 1]], out: [[OF + "nickel_ingot", 1]], sec: 6, energy: 25},
{ id: "crush_bauxite", machine: "crusher", in: [[OF + "raw_bauxite", 1]], out: [[OF + "crushed_bauxite", 2]], sec: 4, energy: 15},
{ id: "finish_crushed_bauxite", machine: "press", in: [[OF + "crushed_bauxite", 1]], out: [[OF + "aluminum_plate", 1]], sec: 3, energy: 60},
{ id: "crush_sulfur", machine: "crusher", in: [[OF + "unprocessed_sulfur", 1]], out: [[OF + "sulfur", 2]], sec: 6, energy: 55},
// 基本加工（config.js PROCESS_RECIPES）
{ id: "steel_ingot", machine: "alloy_furnace", in: [[MC + "iron_ingot", 2], [MC + "coal", 1]], out: [[OF + "steel_ingot", 2]], sec: 8, energy: 40},
{ id: "steel_plate", machine: "press", in: [[OF + "steel_ingot", 2]], out: [[OF + "steel_plate", 2]], sec: 5, energy: 20},
{ id: "copper_wire", machine: "wire_mill", in: [[MC + "copper_ingot", 1]], out: [[OF + "copper_wire", 4]], sec: 4, energy: 15},
{ id: "silicon", machine: "electric_furnace", in: [[MC + "sand", 1]], out: [[OF + "silicon", 1]], sec: 5, energy: 20},
{ id: "resin_from_log", machine: "crusher", in: [[MC + "oak_log", 2]], out: [[OF + "resin", 1]], sec: 6, energy: 15},
{ id: "nickel_ingot_direct", machine: "electric_furnace", in: [[OF + "raw_nickel", 1]], out: [[OF + "nickel_ingot", 1]], sec: 6, energy: 25, alt: true},
{ id: "aluminum_plate_direct", machine: "press", in: [[OF + "raw_bauxite", 2]], out: [[OF + "aluminum_plate", 2]], sec: 6, energy: 120, alt: true},
{ id: "heat_alloy", machine: "alloy_furnace", in: [[OF + "nickel_ingot", 1], [OF + "steel_ingot", 1]], out: [[OF + "heat_alloy", 1]], sec: 10, energy: 250},
{ id: "uranium_ingot", machine: "electric_furnace", in: [[OF + "raw_uranium", 1]], out: [[OF + "uranium_ingot", 1]], sec: 12, energy: 2000},
// 組立（config.js PROCESS_RECIPES）
{ id: "gear", machine: "assembler", in: [[OF + "steel_plate", 1], [MC + "iron_ingot", 1]], out: [[OF + "gear", 1]], sec: 6, energy: 20},
{ id: "bearing", machine: "assembler", in: [[OF + "steel_ingot", 1], [OF + "copper_wire", 2]], out: [[OF + "bearing", 1]], sec: 6, energy: 20},
{ id: "motor", machine: "assembler", in: [[OF + "copper_wire", 4], [OF + "steel_ingot", 2], [OF + "gear", 1]], out: [[OF + "motor", 1]], sec: 10, energy: 120},
{ id: "basic_circuit", machine: "assembler", in: [[OF + "copper_wire", 4], [OF + "silicon", 2], [MC + "redstone", 1]], out: [[OF + "basic_circuit", 2]], sec: 8, energy: 80},
{ id: "control_board", machine: "assembler", in: [[OF + "basic_circuit", 2], [OF + "resin", 2]], out: [[OF + "control_board", 1]], sec: 10, energy: 160},
{ id: "processing_unit", machine: "assembler", in: [[OF + "control_board", 2], [OF + "silicon", 2], [OF + "sulfur", 1]], out: [[OF + "processing_unit", 1]], sec: 10, energy: 3000},
{ id: "drive_component", machine: "assembler", in: [[OF + "motor", 1], [OF + "bearing", 2], [OF + "heat_alloy", 1]], out: [[OF + "drive_component", 1]], sec: 8, energy: 250},
{ id: "storage_cell", machine: "assembler", in: [[OF + "copper_wire", 4], [OF + "silicon", 2], [OF + "nickel_ingot", 1], [OF + "basic_circuit", 1]], out: [[OF + "storage_cell", 1]], sec: 6, energy: 70},
{ id: "solar_cell", machine: "assembler", in: [[OF + "silicon", 3], [OF + "copper_wire", 2], [MC + "glass", 1]], out: [[OF + "solar_cell", 1]], sec: 10, energy: 300},
{ id: "repair_kit", machine: "assembler", in: [[OF + "steel_plate", 2], [OF + "copper_wire", 2], [OF + "resin", 1]], out: [[OF + "repair_kit", 2]], sec: 4, energy: 40},
{ id: "rocket_fuel", machine: "assembler", in: [[MC + "coal", 4], [OF + "resin", 2], [OF + "sulfur", 1]], out: [[OF + "rocket_fuel", 4]], sec: 10, energy: 40},
];

// 出力アイテム -> 優先レシピ（alt は既定では選ばない）
const RECIPE_FOR = new Map();
for (const r of RECIPES) {
if (r.alt) continue;
const outItem = r.out[0][0];
if (!RECIPE_FOR.has(outItem)) RECIPE_FOR.set(outItem, r);
}

// 目標アイテムの別名（日本語・短縮名 -> アイテムID）
export const GOAL_ALIASES = {
"鉄": MC + "iron_ingot", "鉄インゴット": MC + "iron_ingot", "iron_ingot": MC + "iron_ingot",
"銅": MC + "copper_ingot", "銅インゴット": MC + "copper_ingot",
"金": MC + "gold_ingot", "金インゴット": MC + "gold_ingot",
"鋼鉄": OF + "steel_ingot", "鋼インゴット": OF + "steel_ingot", "steel": OF + "steel_ingot",
"鋼板": OF + "steel_plate", "銅線": OF + "copper_wire", "シリコン": OF + "silicon",
"樹脂": OF + "resin", "ニッケル": OF + "nickel_ingot", "ニッケルインゴット": OF + "nickel_ingot",
"アルミ板": OF + "aluminum_plate", "耐熱合金": OF + "heat_alloy",
"歯車": OF + "gear", "ギア": OF + "gear", "軸受": OF + "bearing", "ベアリング": OF + "bearing",
"モーター": OF + "motor", "回路": OF + "basic_circuit", "基礎回路": OF + "basic_circuit",
"制御基板": OF + "control_board", "高度制御ユニット": OF + "processing_unit",
"駆動部品": OF + "drive_component", "蓄電セル": OF + "storage_cell",
"太陽電池": OF + "solar_cell", "補修キット": OF + "repair_kit",
"ロケット燃料": OF + "rocket_fuel", "ウラン": OF + "uranium_ingot", "ウランインゴット": OF + "uranium_ingot",
"硫黄": OF + "sulfur",
};

/**
* 目的アイテムの自動生産ラインを設計する。
* @param {{item:string, rate?:number, generator?:string, speed?:number}} goal
* item: アイテムID または日本語別名 / rate: 目標 個/分（無指定は最小構成）
* generator: 'solar'|'concentrator'|'thermal'|'coal'（既定 solar）
* speed: 機械の速度倍率 1|2|4|8（既定 1。消費SEは倍率倍・時間は割り算）
* @returns {{chain:Array, power:Object, belts:Object, materials:Object,
* footprint:Object, notes:string[], achievableRate:number}|null}
*/
export function designFactory(goal) {
if (!goal || typeof goal.item!== "string") return null;
const item = GOAL_ALIASES[goal.item]?? (goal.item.includes(":")? goal.item: null);
if (!item ||!RECIPE_FOR.has(item)) return null;
const speed = [1, 2, 4, 8].includes(goal.speed)? goal.speed: 1;
const genKey = { solar: "solar_generator", concentrator: "solar_concentrator", thermal: "thermal_generator", coal: "coal_generator"}[goal.generator]?? "solar_generator";

// 需要伝播: 目標アイテムから原料方向へ、必要生産量（個/分）を集計する
const demand = new Map(); // ライン外から供給する原料 itemId -> 個/分
const recipeUse = new Map(); // recipeId -> 必要生産量（出力個/分）
function propagate(targetItem, perMin, seen) {
const r = RECIPE_FOR.get(targetItem);
if (!r || seen.has(r.id)) return;
seen.add(r.id);
recipeUse.set(r.id, (recipeUse.get(r.id)?? 0) + perMin);
const crafts = perMin / r.out[0][1];
for (const [inItem, inCount] of r.in) {
const need = crafts * inCount;
if (RECIPE_FOR.has(inItem)) propagate(inItem, need, seen);
else demand.set(inItem, (demand.get(inItem)?? 0) + need);
}
}

// 台数計算: 必要クラフト/分 x 1回秒数 / speed / 60 -> 切り上げ
function sizeFor(ratePerMin, forceOne = false) {
recipeUse.clear(); demand.clear();
propagate(item, ratePerMin, new Set());
let totalSEmin = 0;
const steps = [];
for (const [rid, outPerMin] of recipeUse) {
const r = RECIPES.find(x => x.id === rid);
const crafts = outPerMin / r.out[0][1];
const count = forceOne? 1: Math.max(1, Math.ceil((crafts * (r.sec / speed)) / 60 - 1e-9));
const seMin = crafts * r.energy * speed;
totalSEmin += seMin;
steps.push({ recipe: r, count, craftsPerMin: crafts, sePerMin: seMin});
}
return { steps, totalSEmin};
}

let rate = (typeof goal.rate === "number" && goal.rate > 0)? goal.rate: null;
let sized;
if (rate) {
sized = sizeFor(rate);
} else {
// 最小構成: 目標1個あたりの必要クラフト数 k_i を求め、
// 各工程1台で律速される達成レート rate = min_i ( 1台の処理能力 / k_i)
recipeUse.clear(); demand.clear();
propagate(item, 1, new Set());
rate = Infinity;
for (const [rid, outPerUnit] of recipeUse) {
const r = RECIPES.find(x => x.id === rid);
const k = outPerUnit / r.out[0][1];
rate = Math.min(rate, (60 / (r.sec / speed)) / k);
}
sized = sizeFor(rate, true);
}

// 工程列を原料 -> 製品の順に並べる（トポロジカル）
const order = [];
const placed = new Set();
const stepByOut = new Map(sized.steps.map(s => [s.recipe.out[0][0], s]));
function visit(s) {
if (placed.has(s.recipe.id)) return;
placed.add(s.recipe.id);
for (const [inItem] of s.recipe.in) {
const up = stepByOut.get(inItem);
if (up) visit(up);
}
order.push(s);
}
for (const s of sized.steps) visit(s);

const chain = order.map(s => ({
machine: s.recipe.machine,
block: MACHINES[s.recipe.machine].block,
count: s.count,
role: s.recipe.id,
produces: s.recipe.out[0][0],
perMin: +(s.craftsPerMin * s.recipe.out[0][1]).toFixed(2),
sePerMin: +s.sePerMin.toFixed(1),
}));

// 電力収支: 消費は SE/分。発電は SE/秒 x 60 に換算して台数を決める
const use = sized.totalSEmin;
const genSpec = MACHINES[genKey];
let genCount, genPerMin, fuelPerMin = null;
if (genKey === "coal_generator") {
// 石炭1個 = 100 SE（ENERGY.coal）。燃焼速度（個/秒）は実データ未確認のため
// 台数は最低1台とし、収支は「燃料が続く限り釣り合う」前提で燃料量を確定値として出す
genCount = 1;
genPerMin = use;
fuelPerMin = Math.ceil(use / genSpec.fuelSE);
} else {
genCount = Math.max(1, Math.ceil(use / (genSpec.genPerSec * 60) - 1e-9));
genPerMin = genCount * genSpec.genPerSec * 60;
}
const power = {
gen: +genPerMin.toFixed(1),
use: +use.toFixed(1),
margin: +(genPerMin - use).toFixed(1),
generator: genKey,
generatorCount: genCount,
batteryRecommended: use > 0, // 系統容量は蓄電池なしで 5,000 SE（ENERGY.baseCapacity）
...(fuelPerMin!== null? { fuelPerMin: { item: MC + "coal", count: fuelPerMin}}: {}),
};
chain.push({ machine: genKey, block: genSpec.block, count: genCount, role: "generate", produces: null, perMin: null, sePerMin: null});

// ベルト: 工程間接続の本数を見積もる（各工程の台数ぶんの搬出列 + 発電機の燃料列）
const beltSegments = order.reduce((a, s) => a + s.count, 0) + genCount;
const belts = {
type: OF + "conveyor_1",
count: beltSegments,
capPerBelt: 4, // config.js C.beltItems（研究「ベルト積載量アップ」で 8）
note: "ベルトは機械の側面に接続し、向きは隣接ブロックから自動判定される（expansion.js）。粉砕機は背面給電・左右搬入・前面搬出。",
};

// 必要素材（ライン外から供給する原料、個/分を切り上げ）
const materials = {};
for (const [inItem, perMin] of demand) materials[inItem] = Math.ceil(perMin);
if (fuelPerMin!== null) materials[MC + "coal"] = (materials[MC + "coal"]?? 0) + fuelPerMin;

// 設置面積（概算）: 工程ごとに「機械列＋ベルト列」の帯を積む
const maxParallel = Math.max(...order.map(s => s.count), 1);
const footprint = { w: maxParallel + 2, d: order.length * 2 + 2};

const notes = [
"達成生産レート: 約 " + (+rate.toFixed(2)) + " 個/分（速度倍率 x" + speed + "）",
"消費SEは「加工1回あたり」の値（config.js）。速度倍率を上げると消費SEも倍率倍になります（machine-speed.js）。",
"バニラ精錬（粉砕鉱→インゴット）は溶鉱炉・かまどで SE を消費しませんが、燃料が別途必要です。",
];
if (genKey === "solar_generator" || genKey === "solar_concentrator")
notes.push("太陽光は昼間のみ発電します。夜間をまたぐ場合は蓄電池 Mk I（容量 20,000 SE）の併設を推奨します。");
if (genKey === "coal_generator")
notes.push("石炭発電機の燃焼速度（石炭 個/秒）は実データで未確認のため、台数は最低構成の1台で置いています。燃料消費量（個/分）は確定値です。");
if (order.some(s => s.recipe.fluidsIn))
notes.push("洗浄工程は水 1,000 mB/回を使います。揚水ポンプ（1,000 mB・10 SE/回）の併設が必要です。");
if (item === OF + "steel_ingot")
notes.push("鋼の原料の鉄インゴットは粉砕（x2化）経由が既定です。原鉄を直接精錬する x1 経路もありますが効率が半分になります。");
notes.push("ベルトの搬送速度（個/秒）の確定値は実データから読み取れていないため、ベルト本数は接続数ベースの見積もりです。");

return { chain, power, belts, materials, footprint, notes, achievableRate: +rate.toFixed(2)};
}

export default designFactory;
