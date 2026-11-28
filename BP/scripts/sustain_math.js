// sustain_math.js — 持続採掘の共通枠の純粋核 (SUSTAIN-FRAME-01 単位1, cyc2521)。
// 0-L ブランチマイニング／0-M 露天掘りは別系統にせず、本枠を共用する (横断基盤 (先行))。
// 単位1 の範囲: S1 共通 DP キー (cb_sustain, persist_registry へ先行登録) ／
// S2 保存・復元・破棄の純粋核 ／ S3 満杯時共通判断 ／ S4 recordContainer 既存形への記録統一 ／
// S5 再開計画形 (ENDGOAL と同じ「中断→準備→再開」の計画形。専用分岐の直書きをしない) ／
// S6 保存座標への dim 必須化 (DIMCOORD-01 併せ裁定: 新規保存状態のみ・遡及なし)。
// 明示ゲート (branch_mining_unsupported / open_pit_unsupported) は単位1 では外さない。
// 採掘パターンと幾何は単位2／単位3 の範囲であり、本モジュールには含めない。
// 出口 (D6 で定義): E1 保管先が両経路とも不能なら打ち切り報告 ／ E2 ツルハシ再作成も不能なら打ち切り ／
// E3 露天掘りで水・溶岩が流れ込む層では進めない ／ E4 無効な復元状態は破棄する ／
// E5 保管・帰還の途中で中止された場合は鉱場状態を保存形で保持する。
// 新規フィールドは宣言してから使う (RSTATE-01 新規分併記): 状態の全フィールドは
// SUSTAIN_FIELDS に列挙し、列挙外フィールドは復元時に落とす。
// 例外を投げない。
export const SUSTAIN_VERSION = 1;
export const SUSTAIN_DP_KEY = "cb_sustain";
export const SUSTAIN_KINDS = Object.freeze(["branch", "pit"]);
export const SUSTAIN_FIELDS = Object.freeze([
  "v", "kind", "origin", "dir", "targetDepth", "progress", "containers", "phase",
]);

function isNum(n) { return typeof n === "number" && Number.isFinite(n); }
function validLoc(loc) {
  return !!loc && isNum(loc.x) && isNum(loc.y) && isNum(loc.z)
    && typeof loc.dim === "string" && loc.dim.length > 0; // S6: dim 必須
}
function normLoc(loc) { return { x: loc.x, y: loc.y, z: loc.z, dim: loc.dim }; }

// 状態の生成。dim を欠く origin・未知の kind は null (保存へ進めない)。
export function makeSustainState(input) {
  if (!input || !SUSTAIN_KINDS.includes(input.kind)) return null;
  if (!validLoc(input.origin)) return null;
  const progress = (input.progress && typeof input.progress === "object") ? input.progress : {};
  return {
    v: SUSTAIN_VERSION,
    kind: input.kind,
    origin: normLoc(input.origin),
    dir: Number.isInteger(input.dir) ? input.dir : null,
    targetDepth: isNum(input.targetDepth) ? input.targetDepth : null,
    progress: {
      branchIndex: Number.isInteger(progress.branchIndex) ? progress.branchIndex : 0,
      layer: Number.isInteger(progress.layer) ? progress.layer : 0,
    },
    containers: Array.isArray(input.containers)
      ? input.containers.filter(validLoc).map(normLoc) : [],
    phase: "active",
  };
}

export function serializeSustain(state) {
  const s = makeSustainState(state);
  return s ? { ...s, phase: (state && typeof state.phase === "string") ? state.phase : "active" } : null;
}

// 復元。未来版・dim 欠落・kind 不正は E4 として破棄する (ok:false)。
// 復元できた場合も保存された予定をそのまま実行せず、phase を "resume_check" へ倒して
// 現状態の読み直しから入る (S2／S5)。
export function restoreSustain(raw) {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "not_object" };
  if (raw.v !== SUSTAIN_VERSION) return { ok: false, reason: "version" };
  if (!SUSTAIN_KINDS.includes(raw.kind)) return { ok: false, reason: "kind" };
  if (!validLoc(raw.origin)) return { ok: false, reason: "origin_dim" };
  const s = makeSustainState(raw);
  if (!s) return { ok: false, reason: "shape" };
  s.phase = "resume_check";
  return { ok: true, state: s };
}

// S5: 再開は計画の形で返す (再確認→帰還→再開)。専用分岐の直書きをしない。
export function resumePlan(state) {
  const s = makeSustainState(state);
  if (!s) return null;
  return [
    { step: "recheck_site", loc: s.origin },
    { step: "return_to_site", loc: s.origin },
    { step: "resume_work", kind: s.kind },
  ];
}

// S3: 満杯時の共通判断。どちらの保管経路も材料調達も不能なら E1 で打ち切り、
// 無進捗のまま粘らない。
export function decideFullStorage(f) {
  const x = f || {};
  if (x.homeRegistered && x.homeReachable) return { action: "deposit_home" };
  if (x.hasChest || x.canMakeChest) return { action: "place_chest", recordContainer: true };
  if (x.canGatherChestMaterial) return { action: "gather_chest_material" };
  return { action: "stop", exit: "E1", reason: "no_storage_route" };
}

// E2: ツルハシが使えず、作り直しも材料調達もできないなら打ち切る。
export function decideToolExit(f) {
  const x = f || {};
  if (x.pickaxeUsable) return { action: "continue" };
  if (x.canRecraft) return { action: "recraft" };
  if (x.canGatherToolMaterial) return { action: "gather_tool_material" };
  return { action: "stop", exit: "E2", reason: "no_pickaxe_route" };
}

// E3: 露天掘り (pit) で液体が流れ込む層では進めない。ブランチ側は既存の安全層の迂回に従う。
export function decideLayerHazard(kind, f) {
  const x = f || {};
  if (!x.fluidInflow) return { action: "continue" };
  if (kind === "pit") return { action: "pause_layer", exit: "E3", reason: "fluid_inflow" };
  return { action: "detour", reason: "fluid_inflow" };
}

// S4: 満杯チェストの記録は world_memory.recordContainer(pos, dim, opts) の既存形へ揃える。
export function containerRecordFor(state, pos) {
  const s = makeSustainState(state);
  if (!s || !validLoc(pos)) return null;
  return { pos: { x: pos.x, y: pos.y, z: pos.z }, dim: pos.dim, opts: { via: "sustain", kind: s.kind } };
}

// E5: 保管・帰還の途中で中止されても鉱場状態は保存形のまま保持する (破棄しない)。
export function suspendSustain(state) {
  const s = serializeSustain(state);
  if (!s) return null;
  s.phase = "suspended";
  return s;
}
