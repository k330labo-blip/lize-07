// ============================================================
// factory_sim.js — 軌道工廠 工場設計の検証シミュレータ（純粋JS）
// 「設計どおりに組めば目標レートで回るか」を機械的に判定する。
//
// データ源（読み取りのみ・実測値）: ~/workspace/mc-debug-pc/of311/BP/
//   - scripts/config.js        : PROCESS_RECIPES（machine/in/out/sec/energy）、ENERGY
//   - scripts/ore-processing.js: 鉱石加工3段（粉砕×2 / 洗浄×3 / 選鉱×5）とコスト表
//   - scripts/machine-speed.js : 速度倍率 SPEEDS=[1,2,4,8]、所要時間 sec/speed、
//                                消費電力 energy×speed（/回、ceil）
//   - scripts/expansion.js     : ベルト搬送量（両レーン合計 個/秒）
//                                  Mk I 40（研究後80）/ Mk II 96 / Mk III 256
//   - scripts/main.js          : 石炭発電機 最大発電 10×速度上限 SE/秒
//   - scripts/fluids.js        : 石油火力発電機 最大発電 2000×速度 SE/秒
//   - scripts/solar.js         : 太陽光 100 SE/秒、集光型 600 SE/秒（昼間のみ）
// 読めなかった/表に無いレシピは標準値で計算し、warnings に必ず明示する。
// ============================================================

// 速度倍率（machine-speed.js SPEEDS）
export const SPEEDS = [1, 2, 4, 8];

// レシピ表（config.js PROCESS_RECIPES / ore-processing.js から転記した代表値）
// in/out は [[item, count], ...]。water は 1回あたりの水消費 mB。
export const RECIPES = {
  // --- 鉱石加工（ore-processing.js の3段。鉄は config.js の明示値と一致） ---
  crush_iron:    { machine: "crusher",         in: [["minecraft:raw_iron", 1]],        out: [["orbital_foundry:crushed_iron", 2]],    sec: 4,  energy: 15 },
  wash_iron:     { machine: "washer",          in: [["minecraft:raw_iron", 1]],        out: [["orbital_foundry:crushed_iron", 3]],    sec: 7,  energy: 80,  water: 1000 },
  benefit_iron:  { machine: "ore_beneficiator", in: [["minecraft:raw_iron", 1]],       out: [["orbital_foundry:crushed_iron", 5]],    sec: 14, energy: 400, water: 2000 },
  // --- 素材加工（config.js 明示値） ---
  steel_ingot:   { machine: "alloy_furnace",   in: [["minecraft:iron_ingot", 2], ["minecraft:coal", 1]], out: [["orbital_foundry:steel_ingot", 2]], sec: 8, energy: 40 },
  steel_plate:   { machine: "press",           in: [["orbital_foundry:steel_ingot", 2]], out: [["orbital_foundry:steel_plate", 2]],   sec: 5,  energy: 20 },
  copper_wire:   { machine: "wire_mill",       in: [["minecraft:copper_ingot", 1]],     out: [["orbital_foundry:copper_wire", 4]],     sec: 4,  energy: 15 },
  silicon:       { machine: "electric_furnace", in: [["minecraft:sand", 1]],            out: [["orbital_foundry:silicon", 1]],         sec: 5,  energy: 20 },
  nickel_ingot:  { machine: "electric_furnace", in: [["orbital_foundry:raw_nickel", 1]], out: [["orbital_foundry:nickel_ingot", 1]],     sec: 6,  energy: 25 },
  aluminum_plate:{ machine: "press",           in: [["orbital_foundry:raw_bauxite", 2]], out: [["orbital_foundry:aluminum_plate", 2]], sec: 6,  energy: 120 },
  heat_alloy:    { machine: "alloy_furnace",   in: [["orbital_foundry:nickel_ingot", 1], ["orbital_foundry:steel_ingot", 1]], out: [["orbital_foundry:heat_alloy", 1]], sec: 10, energy: 250 },
  resin_from_log:{ machine: "crusher",         in: [["minecraft:oak_log", 2]],          out: [["orbital_foundry:resin", 1]],           sec: 6,  energy: 15 },
  uranium_ingot: { machine: "electric_furnace", in: [["orbital_foundry:raw_uranium", 1]], out: [["orbital_foundry:uranium_ingot", 1]],   sec: 12, energy: 2000 },
  // --- 組立（config.js 明示値） ---
  gear:          { machine: "assembler", in: [["orbital_foundry:steel_plate", 1], ["minecraft:iron_ingot", 1]], out: [["orbital_foundry:gear", 1]], sec: 6, energy: 20 },
  bearing:       { machine: "assembler", in: [["orbital_foundry:steel_ingot", 1], ["orbital_foundry:copper_wire", 2]], out: [["orbital_foundry:bearing", 1]], sec: 6, energy: 20 },
  motor:         { machine: "assembler", in: [["orbital_foundry:copper_wire", 4], ["orbital_foundry:steel_ingot", 2], ["orbital_foundry:gear", 1]], out: [["orbital_foundry:motor", 1]], sec: 10, energy: 120 },
  basic_circuit: { machine: "assembler", in: [["orbital_foundry:copper_wire", 4], ["orbital_foundry:silicon", 2], ["minecraft:redstone", 1]], out: [["orbital_foundry:basic_circuit", 2]], sec: 8, energy: 80 },
  control_board: { machine: "assembler", in: [["orbital_foundry:basic_circuit", 2], ["orbital_foundry:resin", 2]], out: [["orbital_foundry:control_board", 1]], sec: 10, energy: 160 },
  drive_component:{ machine: "assembler", in: [["orbital_foundry:motor", 1], ["orbital_foundry:bearing", 2], ["orbital_foundry:heat_alloy", 1]], out: [["orbital_foundry:drive_component", 1]], sec: 8, energy: 250 },
  science_mechanical: { machine: "assembler", in: [["orbital_foundry:gear", 1], ["minecraft:copper_ingot", 1]], out: [["orbital_foundry:science_mechanical", 2]], sec: 4, energy: 15 },
  science_automation: { machine: "assembler", in: [["orbital_foundry:motor", 1], ["orbital_foundry:basic_circuit", 1]], out: [["orbital_foundry:science_automation", 2]], sec: 6, energy: 120 },
  storage_cell:  { machine: "assembler", in: [["orbital_foundry:copper_wire", 4], ["orbital_foundry:silicon", 2], ["orbital_foundry:nickel_ingot", 1], ["orbital_foundry:basic_circuit", 1]], out: [["orbital_foundry:storage_cell", 1]], sec: 6, energy: 70 },
};

// 鉱石加工の汎用段コスト（ore-processing.js baseCosts / industrialCosts）
// stage: 'crush'(×2) | 'wash'(×3) | 'benefit'(×5)、tier: 'base' | 'industrial'
const ORE_STAGE_COSTS = {
  base:       { crush: { sec: 4, energy: 15 }, wash: { sec: 7,  energy: 80,  water: 1000 }, benefit: { sec: 14, energy: 400, water: 2000 } },
  industrial: { crush: { sec: 6, energy: 55 }, wash: { sec: 10, energy: 160, water: 1500 }, benefit: { sec: 18, energy: 650, water: 2500 } },
};
const ORE_STAGE_MACHINE = { crush: "crusher", wash: "washer", benefit: "ore_beneficiator" };
const ORE_STAGE_OUT = { crush: 2, wash: 3, benefit: 5 };

export function oreStageRecipe(rawItem, productItem, stage = "crush", tier = "base") {
  const c = (ORE_STAGE_COSTS[tier] ?? ORE_STAGE_COSTS.base)[stage];
  if (!c) return null;
  return { machine: ORE_STAGE_MACHINE[stage], in: [[rawItem, 1]], out: [[productItem, ORE_STAGE_OUT[stage]]], ...c };
}

// 発電機（SE/秒）。coal: 10×速度上限（main.js）、thermal: 2000×速度（fluids.js）、
// solar: solar.js の rate（昼間のみ → solarDuty で平均化）
export const GENERATORS = {
  coal_generator:      { sePerSec: (speed = 1) => 10 * speed },
  thermal_generator:   { sePerSec: (speed = 1) => 2000 * speed },
  solar_generator:     { sePerSec: () => 100, solar: true },
  solar_concentrator:  { sePerSec: () => 600, solar: true },
};

// ベルト搬送量（個/秒、両レーン合計。expansion.js のコメント値）
export const BELTS = {
  conveyor_1: { itemsPerSec: 40, itemsPerSecResearched: 80 },
  conveyor_2: { itemsPerSec: 96 },
  conveyor_3: { itemsPerSec: 256 },
};

// 固定ドリル（config.js DRILL / ENERGY）: 0.5 ブロック/秒、10 SE/ブロック
export const DRILL = { blocksPerSec: 0.5, sePerBlock: 10 };

// 表に無い機械・レシピに使う標準値（必ず warnings に出す）
export const STANDARD_RECIPE = { sec: 6, energy: 20, in: [], out: [] };

export function getRecipe(id) {
  return RECIPES[id] ?? null;
}

// ------------------------------------------------------------
// 内部: ステージ解決
// ------------------------------------------------------------
function resolveStage(stage, index, warnings) {
  const machine = stage.machine ?? stage.type ?? "unknown";
  let recipe = null, recipeId = stage.recipeId ?? stage.recipe ?? null, assumed = false;

  if (recipeId && typeof recipeId === "object") { recipe = recipeId; recipeId = recipe.id ?? null; }
  else if (recipeId) {
    recipe = RECIPES[recipeId] ?? null;
    if (!recipe) { warnings.push(`ステージ${index}（${machine}）: レシピ "${recipeId}" は実データ表に無いため標準値（${STANDARD_RECIPE.sec}秒/${STANDARD_RECIPE.energy}SE）で計算しました`); assumed = true; }
  }
  if (!recipe && stage.sec != null) {
    recipe = { machine, in: stage.in ?? [], out: stage.out ?? [], sec: stage.sec, energy: stage.energy ?? STANDARD_RECIPE.energy, water: stage.water };
  }
  if (!recipe && machine === "fixed_drill") {
    // ドリルは「1ブロック=1回」のソース工程として扱う
    const outItem = stage.output ?? stage.out?.[0]?.[0] ?? "minecraft:raw_iron";
    recipe = { machine, in: [], out: [[outItem, 1]], sec: 1 / DRILL.blocksPerSec, energy: DRILL.sePerBlock, drill: true };
    recipeId = recipeId ?? "fixed_drill";
  }
  if (!recipe) {
    warnings.push(`ステージ${index}（${machine}）: レシピ未指定のため標準値（${STANDARD_RECIPE.sec}秒/${STANDARD_RECIPE.energy}SE、入出力1:1）で計算しました`);
    assumed = true;
    const inItem = stage.input ?? `stage${index}_in`;
    const outItem = stage.output ?? `stage${index}_out`;
    recipe = { machine, in: [[inItem, 1]], out: [[outItem, 1]], sec: STANDARD_RECIPE.sec, energy: STANDARD_RECIPE.energy };
  }

  const speed = SPEEDS.includes(stage.speed) ? stage.speed : 1;
  if (stage.speed != null && !SPEEDS.includes(stage.speed)) {
    warnings.push(`ステージ${index}（${machine}）: 速度 ${stage.speed} は実機の倍率（1/2/4/8）に無いため ×1 として計算しました`);
  }
  return {
    index, machine, recipeId, recipe, assumed,
    count: Math.max(1, stage.count ?? 1),
    speed,
    belt: stage.belt ?? null,
    mainIn: recipe.in[0] ?? null,           // [item, count] | null（ソース工程）
    mainOut: recipe.out[0] ?? null,         // [item, count]
    extraIns: recipe.in.slice(1),           // 副材料（外部供給が前提）
  };
}

function stageCapacity(st) {
  // 1台あたり ops/分 = 60 / (sec/speed)。電力/回 = ceil(energy × speed)（machine-speed.js）
  const opsPerMinPerMachine = 60 * st.speed / st.recipe.sec;
  const opsPerMin = opsPerMinPerMachine * st.count;
  return {
    opsPerMin,
    outPerMin: st.mainOut ? opsPerMin * st.mainOut[1] : 0,
    inPerMin: st.mainIn ? opsPerMin * st.mainIn[1] : 0,
    sePerSecFull: (opsPerMin / 60) * Math.ceil(st.recipe.energy * st.speed),
    waterPerMinFull: (st.recipe.water ?? 0) * opsPerMin,
  };
}

// 前方フロー計算。speedCap を与えると全ステージの速度をその倍率以下に抑えて再計算する。
function runFlow(stages, supplyOf, beltCapOf, speedCap = Infinity) {
  const sts = stages.map(st => ({ ...st, speed: Math.min(st.speed, speedCap) }));
  const caps = sts.map(stageCapacity);
  const flow = [];   // 各ステージの実効出力（個/分、主産物）
  const ops = [];    // 各ステージの実効 ops/分
  const beltLimited = [];
  let flowIn = Infinity;

  for (let i = 0; i < sts.length; i++) {
    const st = sts[i], cap = caps[i];
    if (i === 0 && st.mainIn) {
      const s = supplyOf(st.mainIn[0]);
      flowIn = s == null ? Infinity : s;
    }
    if (i > 0) {
      const beltCap = beltCapOf(sts[i - 1], st, i - 1);
      if (beltCap != null && flowIn > beltCap) { beltLimited.push({ link: i - 1, capPerMin: beltCap, flowPerMin: flowIn }); flowIn = beltCap; }
    }
    let actualOps;
    if (!st.mainIn) actualOps = cap.opsPerMin;                       // ソース工程（ドリル等）
    else if (flowIn === Infinity) actualOps = cap.opsPerMin;
    else actualOps = Math.min(cap.opsPerMin, flowIn / st.mainIn[1]);
    ops.push(actualOps);
    const out = st.mainOut ? actualOps * st.mainOut[1] : 0;
    flow.push(out);
    flowIn = out;
  }
  const drawSEPerSec = sts.reduce((sum, st, i) => sum + (ops[i] / 60) * Math.ceil(st.recipe.energy * st.speed), 0);
  const waterPerMin = sts.reduce((sum, st, i) => sum + (st.recipe.water ?? 0) * ops[i], 0);
  return { sts, caps, flow, ops, beltLimited, drawSEPerSec, waterPerMin };
}

// ------------------------------------------------------------
// simulate(design, opts)
// design（factory_design の想定形式 {chain, power, materials}）:
//   {
//     targetItem?: string, targetPerMin?: number,
//     chain: [{ machine, recipeId|recipe, count?, speed?, belt? }, ...],  // 配列順に直列接続
//     links?: [{ belt: 'conveyor_1'|... }],          // links[i] = ステージ i → i+1
//     power: { generators: [{type, count?, speed?}], supplySEPerSec?: number },
//     materials: [{ item, perMin }] | { inputs: [{item, perMin}] },
//   }
// opts: { beltResearched?: boolean, defaultBelt?: string|null,
//         solarDuty?: number (0..1, 既定0.5), waterPerMin?: number }
// ------------------------------------------------------------
export function simulate(design, opts = {}) {
  const warnings = [];
  const bottlenecks = [];
  const d = design ?? {};
  const chain = Array.isArray(d.chain) ? d.chain : [];
  if (chain.length === 0) {
    return { ok: false, throughputPerMin: 0, bottlenecks: [{ type: "empty_chain", severity: "error", detail: "chain が空です" }], powerOk: false, warnings: ["設計に chain（工程列）がありません"], stages: [], power: { drawSEPerSec: 0, supplySEPerSec: 0 }, materialsRequired: [] };
  }

  const stages = chain.map((s, i) => resolveStage(s, i, warnings));
  stages.forEach((st, i) => { if (st.assumed) warnings.push(`ステージ${i}（${st.machine}）は標準値計算のため、実機の所要時間と異なる可能性があります`); });

  // 外部供給（materials）
  const matList = Array.isArray(d.materials) ? d.materials : (d.materials?.inputs ?? []);
  const supplyMap = new Map(matList.map(m => [m.item, m.perMin]));
  const supplyOf = item => supplyMap.has(item) ? supplyMap.get(item) : null;
  if (stages[0].mainIn && supplyOf(stages[0].mainIn[0]) == null) {
    warnings.push(`原料 ${stages[0].mainIn[0]} の供給レートが materials に無いため、無制限と仮定しました`);
  }

  // ベルト容量（個/分）。links 指定 > ステージの belt 指定 > opts.defaultBelt（既定 conveyor_1）
  const beltCapOf = (fromStage, toStage, linkIndex) => {
    const beltId = d.links?.[linkIndex]?.belt ?? toStage.belt ?? fromStage.beltOut ?? opts.defaultBelt ?? "conveyor_1";
    if (!beltId) return null;
    const b = BELTS[beltId];
    if (!b) { warnings.push(`ベルト "${beltId}" は不明なため搬送制限なしで計算しました`); return null; }
    const perSec = (beltId === "conveyor_1" && opts.beltResearched) ? b.itemsPerSecResearched : b.itemsPerSec;
    return perSec * 60;
  };

  // 発電容量
  let supplySEPerSec = d.power?.supplySEPerSec ?? 0;
  let hasSolar = false;
  for (const g of d.power?.generators ?? []) {
    const gen = GENERATORS[g.type];
    if (!gen) { warnings.push(`発電機 "${g.type}" は不明なため発電量に数えていません`); continue; }
    let v = gen.sePerSec(g.speed ?? 1) * (g.count ?? 1);
    if (gen.solar) { hasSolar = true; v *= (opts.solarDuty ?? 0.5); }
    supplySEPerSec += v;
  }
  if (hasSolar) warnings.push(`太陽光発電は昼間のみのため、稼働率 ${(opts.solarDuty ?? 0.5) * 100}% で平均化して計算しました`);
  if (!d.power?.generators?.length && d.power?.supplySEPerSec == null) {
    warnings.push("発電設備の指定が無いため、供給電力 0 SE/秒として計算しました（power.supplySEPerSec でも指定可）");
  }

  // --- フロー計算（設計速度） ---
  let run = runFlow(stages, supplyOf, beltCapOf);
  let powerOk = run.drawSEPerSec <= supplySEPerSec + 1e-9;
  let derated = null;

  // --- 電力不足: 実機同様に速度倍率を落として回る範囲を推定 ---
  if (!powerOk) {
    const deficit = run.drawSEPerSec - supplySEPerSec;
    bottlenecks.push({ type: "power", severity: "error", detail: `電力不足: 必要 ${round(run.drawSEPerSec)} SE/秒 に対し供給 ${round(supplySEPerSec)} SE/秒（不足 ${round(deficit)} SE/秒）`, drawSEPerSec: round(run.drawSEPerSec), supplySEPerSec: round(supplySEPerSec), deficitSEPerSec: round(deficit), fix: "発電機の追加、速度倍率を下げる、または工程の台数を減らしてください" });
    for (const tier of [...SPEEDS].reverse()) {
      const r2 = runFlow(stages, supplyOf, beltCapOf, tier);
      if (r2.drawSEPerSec <= supplySEPerSec + 1e-9) { derated = { speedCap: tier, run: r2 }; break; }
    }
    if (!derated) {
      // ×1 でも不足: 供給/需要の比率で断続運転と近似（フローと消費を比率で落とす）
      const r1 = runFlow(stages, supplyOf, beltCapOf, 1);
      const ratio = r1.drawSEPerSec > 0 ? supplySEPerSec / r1.drawSEPerSec : 0;
      r1.flow = r1.flow.map(v => v * ratio);
      r1.ops = r1.ops.map(v => v * ratio);
      r1.drawSEPerSec *= ratio;
      derated = { speedCap: 1, run: r1, intermittentRatio: ratio };
      warnings.push("速度×1でも電力が不足するため、機械が断続的に止まる状態として近似しました（実機では速度が自動で落ち、さらに足りなければ停止します）");
    }
    run = derated.run;
  }

  const throughputPerMin = round(run.flow[run.flow.length - 1] ?? 0);
  const targetPerMin = d.targetPerMin ?? null;
  const targetItem = d.targetItem ?? stages[stages.length - 1].mainOut?.[0] ?? null;

  // --- ボトルネック検出 ---
  for (let i = 0; i < run.sts.length; i++) {
    const st = run.sts[i], cap = run.caps[i], actualOps = run.ops[i];
    const utilization = cap.opsPerMin > 0 ? actualOps / cap.opsPerMin : 0;
    // 後工程不足（前工程過多）: 自分の生産能力が、次工程の受入能力を超えている
    if (i + 1 < run.sts.length && run.sts[i + 1].mainIn) {
      const nextAcceptPerMin = run.caps[i + 1].opsPerMin * run.sts[i + 1].mainIn[1];
      if (cap.outPerMin > nextAcceptPerMin + 1e-9 && run.flow[i] >= nextAcceptPerMin - 1e-9) {
        bottlenecks.push({ type: "overproduction", severity: "warn", stage: i, machine: st.machine, item: st.mainOut?.[0], detail: `前工程過多: ステージ${i}（${st.machine}）は最大 ${round(cap.outPerMin)} 個/分 作れますが、次工程の受入は ${round(nextAcceptPerMin)} 個/分 までです`, capacityPerMin: round(cap.outPerMin), flowPerMin: round(nextAcceptPerMin), fix: `ステージ${i} の台数を減らすか、次工程（${run.sts[i + 1].machine}）を増やしてください` });
      }
    }
    // 稼働率100%で最終スループットを制限している工程 = ラインのボトルネック
    if (utilization >= 0.999 && i < run.sts.length - 1 || (utilization >= 0.999 && targetPerMin != null && throughputPerMin < targetPerMin)) {
      const downstreamStarved = i + 1 < run.sts.length && run.ops[i + 1] < run.caps[i + 1].opsPerMin - 1e-9;
      if (downstreamStarved || (targetPerMin != null && throughputPerMin < targetPerMin)) {
        bottlenecks.push({ type: "stage_capacity", severity: targetPerMin != null && throughputPerMin < targetPerMin ? "error" : "warn", stage: i, machine: st.machine, item: st.mainOut?.[0], detail: `ボトルネック: ステージ${i}（${st.machine} ×${st.count}）が稼働率100%で、ライン全体の上限になっています`, capacityPerMin: round(cap.outPerMin), flowPerMin: round(run.flow[i]), fix: `ステージ${i}（${st.machine}）の台数を増やすか速度倍率を上げてください（電力消費は速度の2乗で増えます）` });
      }
    }
    // 原料・副材料の不足
    if (i === 0 && st.mainIn) {
      const s = supplyOf(st.mainIn[0]);
      if (s != null && s < cap.inPerMin - 1e-9) {
        bottlenecks.push({ type: "material", severity: "error", stage: 0, item: st.mainIn[0], detail: `原料不足: ${st.mainIn[0]} の供給 ${round(s)} 個/分 に対し、ステージ0の最大需要は ${round(cap.inPerMin)} 個/分 です`, capacityPerMin: round(cap.inPerMin), flowPerMin: round(s), fix: "原料の供給（ドリル・搬入）を増やしてください" });
      }
    }
  }
  for (const bl of run.beltLimited) {
    bottlenecks.push({ type: "belt", severity: "error", stage: bl.link, detail: `搬送ボトルネック: ステージ${bl.link}→${bl.link + 1} のベルト容量 ${round(bl.capPerMin)} 個/分 に対し、流そうとする量が ${round(bl.flowPerMin)} 個/分 あります`, capacityPerMin: round(bl.capPerMin), flowPerMin: round(bl.flowPerMin), fix: "上位グレードのベルト（Mk II 5,760個/分 / Mk III 15,360個/分）に替えるか、ラインを分けてください" });
  }

  // 副材料の需要（実効レート）と水
  const materialsRequired = new Map();
  run.sts.forEach((st, i) => {
    for (const [item, cnt] of st.extraIns) materialsRequired.set(item, (materialsRequired.get(item) ?? 0) + run.ops[i] * cnt);
    if (i === 0 && st.mainIn) materialsRequired.set(st.mainIn[0], (materialsRequired.get(st.mainIn[0]) ?? 0) + run.ops[i] * st.mainIn[1]);
  });
  for (const [item, perMin] of materialsRequired) {
    const s = supplyOf(item);
    if (s != null && s < perMin - 1e-9 && item !== stages[0].mainIn?.[0]) {
      bottlenecks.push({ type: "material", severity: "error", item, detail: `副材料不足: ${item} が ${round(perMin)} 個/分 必要ですが、供給は ${round(s)} 個/分 です`, capacityPerMin: round(perMin), flowPerMin: round(s), fix: `${item} の供給ラインを追加してください` });
    }
  }
  if (run.waterPerMin > 0) {
    if (opts.waterPerMin != null) {
      if (run.waterPerMin > opts.waterPerMin) bottlenecks.push({ type: "water", severity: "error", detail: `水不足: 洗浄・選鉱に ${round(run.waterPerMin)} mB/分 必要ですが、供給は ${round(opts.waterPerMin)} mB/分 です`, capacityPerMin: round(opts.waterPerMin), flowPerMin: round(run.waterPerMin), fix: "給水ポンプを増やしてください（ポンプ1台 1,000mB/回・10SE）" });
    } else {
      warnings.push(`このラインは水を ${round(run.waterPerMin)} mB/分 消費します（洗浄・選鉱）。給水ポンプの用意を確認してください`);
    }
  }

  const targetMet = targetPerMin == null ? null : throughputPerMin >= targetPerMin - 1e-9;
  if (targetPerMin != null && !targetMet) {
    warnings.push(`目標 ${targetPerMin} 個/分 に対し、実効スループットは ${throughputPerMin} 個/分 です`);
  }

  const ok = powerOk && !bottlenecks.some(b => b.severity === "error") && (targetMet ?? true);

  return {
    ok,
    throughputPerMin,
    targetItem,
    targetPerMin,
    targetMet,
    bottlenecks,
    powerOk,
    power: {
      drawSEPerSec: round(run.drawSEPerSec),
      designDrawSEPerSec: round(derated ? runFlow(stages, supplyOf, beltCapOf).drawSEPerSec : run.drawSEPerSec),
      supplySEPerSec: round(supplySEPerSec),
      marginSEPerSec: round(supplySEPerSec - run.drawSEPerSec),
      deratedSpeedCap: derated?.speedCap ?? null,
    },
    waterPerMin: round(run.waterPerMin),
    stages: run.sts.map((st, i) => ({
      index: i, machine: st.machine, recipeId: st.recipeId, count: st.count, speed: st.speed,
      opsPerMin: round(run.ops[i]), outputPerMin: round(run.flow[i]),
      capacityPerMin: round(run.caps[i].outPerMin),
      utilization: run.caps[i].opsPerMin > 0 ? Math.round(1000 * run.ops[i] / run.caps[i].opsPerMin) / 1000 : 0,
      inputItem: st.mainIn?.[0] ?? null, outputItem: st.mainOut?.[0] ?? null,
    })),
    materialsRequired: [...materialsRequired].map(([item, perMin]) => ({ item, perMin: round(perMin) })),
    warnings,
  };
}

function round(v) { return Math.round(v * 100) / 100; }

export default simulate;
