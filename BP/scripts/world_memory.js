// world_memory.js — リゼ (LIZE-07) 世界記憶モジュール
//
// 「行った場所・危険だった場所・コンテナの場所」を覚えるための記憶層。
// 純粋JS: @minecraft/server には一切依存しない。保存は adapter 経由のみ。
//
//   const mem = createWorldMemory({
//     load: () => world.getDynamicProperty("cb_wmem") ?? null, // string | null
//     save: (s) => world.setDynamicProperty("cb_wmem", s),
//   });
//
// データは全て JSON 化可能なプレーンオブジェクトで保持し、
// シリアライズ後の総サイズが maxBytes (既定 32KB) を超えたら
// 「古いもの・弱いもの」から捨てて上限内に収める。
//
// 時刻は options.now ( () => ms ) で差し替え可能（テスト用）。
// 座標 pos は {x, y, z}、次元 dim は文字列（例 "minecraft:overworld"）。
// どちらも省略時は "minecraft:overworld" 扱い。

export const WMEM_VERSION = 1;

// Phase1残件: source の保存形は2文字コード。正名・別名も受け口で吸収する（未知値は欠落化）
export const WMEM_SOURCE = Object.freeze({ direct_scan: "ds", direct_inspect: "di", home_measured: "hm", event: "ev", self_placed: "sp", self_action: "sa", owner_told: "ot", owner_action: "oa", inferred: "in", hearsay: "hs", system: "sy" });
const SOURCE_BY_CODE = Object.fromEntries(Object.entries(WMEM_SOURCE).map(([k, v]) => [v, k]));
const SOURCE_ALIAS = { scan: "ds" };
export const normSource = (v) => { if (!v) return undefined; if (SOURCE_BY_CODE[v]) return v; return WMEM_SOURCE[v] || SOURCE_ALIAS[v] || undefined; };
export const sourceName = (code) => SOURCE_BY_CODE[code] ?? null;
const SRC_RANK = { sy: 0, hs: 1, in: 2, ds: 3, di: 3, ot: 4, oa: 5, sa: 6, sp: 6, ev: 7, hm: 8 };
const resolveSource = (next, prev) => { const n = normSource(next), o = normSource(prev); if (!n) return o; if (!o) return n; return (SRC_RANK[n] ?? 0) >= (SRC_RANK[o] ?? 0) ? n : o; };

const DEFAULTS = {
  maxBytes: 32768,          // シリアライズ後 JSON の上限 (UTF-8 バイト)
  maxVisited: 512,          // 訪問チャンク上限 (LRU)
  maxContainers: 128,       // 既知コンテナ上限 (古い確認から削除)
  maxDanger: 256,           // 危険地点上限 (弱いものから削除)
  maxBeds: 64,              // 既知ベッド上限
  maxWorkstations: 128,     // 既知設備上限
  dangerHalfLifeMs: 30 * 60 * 1000, // 危険の重みが半減する時間 (30分)
  dangerMinWeight: 0.05,    // これ未満まで減衰した危険は忘れる
  familiarityPerVisit: 8,   // 1回の訪問で上がる親密度
  familiarityMax: 100,
};

const DEFAULT_DIM = "minecraft:overworld";

// 次元IDは長い ("minecraft:overworld") ので、保存時は短縮コードにする
const DIM_TO_CODE = { "minecraft:overworld": "o", "minecraft:nether": "n", "minecraft:the_end": "e" };
const CODE_TO_DIM = { o: "minecraft:overworld", n: "minecraft:nether", e: "minecraft:the_end" };
const dimCode = (dim) => DIM_TO_CODE[dim] ?? String(dim ?? DEFAULT_DIM);
const codeDim = (code) => CODE_TO_DIM[code] ?? code;

export function chunkOf(pos) {
  return { cx: Math.floor(pos.x / 16), cz: Math.floor(pos.z / 16) };
}

function utf8Bytes(str) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str).length;
  // Bedrock Script API には TextEncoder が無いので手計算する
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; } // サロゲートペア
    else n += 3;
  }
  return n;
}

function emptyData() {
  return {
    v: WMEM_VERSION,
    // visited: { "o:3,-2": { t: 最終訪問ms, n: 訪問回数, f: 親密度0..100 } }
    visited: {},
    // containers: { "o:10,64,20": { t: 最終確認ms, full: 0|1, k: 種類(任意) } }
    containers: {},
    // danger: [ { d: 次元コード, x, y, z, k: 種類, w: 重み, t: 最終記録ms } ]
    danger: [],
    // beds / workstations: { "o:10,64,20": { t: 最終確認ms, k: 種類(設備のみ) } }
    beds: {},
    workstations: {},
  };
}

const posKey = (dim, pos) => `${dimCode(dim)}:${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
const chunkKey = (dim, cx, cz) => `${dimCode(dim)}:${cx},${cz}`;

function parsePosKey(key) {
  const i = key.indexOf(":");
  const [x, y, z] = key.slice(i + 1).split(",").map(Number);
  return { dim: codeDim(key.slice(0, i)), x, y, z };
}

// Phase3 (v0.4.17) W1: contents は完全スナップショット時のみ整形して保持する (部分情報を載せない)
function sanitizeContents(v) {
  try {
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    const out = Object.create(null); // cycle1834: __proto__ キーが setter に吸われて消失するのを防ぐ
    for (const [k, n] of Object.entries(v)) {
      if (typeof k === "string" && k.length > 0 && typeof n === "number" && Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
    }
    return out;
  } catch { return undefined; }
}
export function createWorldMemory(adapter, options = {}) {
  if (!adapter || typeof adapter.load !== "function" || typeof adapter.save !== "function") {
    throw new TypeError("createWorldMemory: adapter { load(), save(s) } が必要です");
  }
  const opt = { ...DEFAULTS, ...options };
  const now = typeof options.now === "function" ? options.now : () => Date.now();

  let data = emptyData();
  let dirty = false;

  // ---------- 読み込み ----------
  (function load() {
    let raw = null;
    try { raw = adapter.load(); } catch { raw = null; }
    if (typeof raw !== "string" || raw.length === 0) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const d = emptyData();
      if (parsed.visited && typeof parsed.visited === "object") d.visited = parsed.visited;
      if (parsed.containers && typeof parsed.containers === "object") d.containers = parsed.containers;
      if (Array.isArray(parsed.danger)) d.danger = parsed.danger;
      if (parsed.beds && typeof parsed.beds === "object") d.beds = parsed.beds;
      if (parsed.workstations && typeof parsed.workstations === "object") d.workstations = parsed.workstations;
      data = d;
      // source 旧表記を2文字コードへ受動正規化（冪等・未知値は欠落化）
      for (const m of [data.containers, data.beds, data.workstations]) for (const k of Object.keys(m)) { if (m[k]?.s !== undefined) { const n = normSource(m[k].s); if (n) m[k].s = n; else delete m[k].s; } }
      for (const sp of data.danger) { if (sp?.s !== undefined) { const n = normSource(sp.s); if (n) sp.s = n; else delete sp.s; } }
    } catch { /* 壊れた保存データは空から始める */ }
  })();

  // ---------- 内部ユーティリティ ----------
  function decayedWeight(spot, at = now()) {
    const age = Math.max(0, at - (spot.t || 0));
    return (spot.w || 0) * Math.pow(0.5, age / opt.dangerHalfLifeMs);
  }

  function pruneDanger() {
    const at = now();
    data.danger = data.danger.filter((s) => decayedWeight(s, at) >= opt.dangerMinWeight);
    if (data.danger.length > opt.maxDanger) {
      data.danger.sort((a, b) => decayedWeight(b, at) - decayedWeight(a, at));
      data.danger.length = opt.maxDanger;
    }
  }

  // 件数上限: map から最も古い (t が小さい) ものから落とす
  function pruneMapByAge(map, max) {
    const keys = Object.keys(map);
    if (keys.length <= max) return;
    keys.sort((a, b) => (map[a].t || 0) - (map[b].t || 0));
    for (let i = 0; i < keys.length - max; i++) delete map[keys[i]];
  }

  function pruneVisited() {
    // 訪問チャンクは LRU: 最終訪問が古いものから落とす（親密度も一緒に消える）
    pruneMapByAge(data.visited, opt.maxVisited);
  }

  function pruneCounts() {
    pruneVisited();
    pruneMapByAge(data.containers, opt.maxContainers);
    pruneMapByAge(data.beds, opt.maxBeds);
    pruneMapByAge(data.workstations, opt.maxWorkstations);
    pruneDanger();
  }

  function serialize() {
    return JSON.stringify(data);
  }

  // 総サイズ上限: 超えたら 危険(弱い順) → 訪問(古い順) → 設備 → ベッド → コンテナ の順に間引く
  function enforceSizeLimit() {
    let s = serialize();
    if (utf8Bytes(s) <= opt.maxBytes) return s;
    pruneCounts();
    s = serialize();
    // 段階的に上限を締めて再試行する
    const shrink = [
      () => { data.danger = data.danger.slice(0, Math.floor(data.danger.length / 2)); },
      () => pruneMapByAge(data.visited, Math.max(16, Math.floor(Object.keys(data.visited).length / 2))),
      () => pruneMapByAge(data.workstations, Math.max(8, Math.floor(Object.keys(data.workstations).length / 2))),
      () => pruneMapByAge(data.beds, Math.max(8, Math.floor(Object.keys(data.beds).length / 2))),
      () => pruneMapByAge(data.containers, Math.max(8, Math.floor(Object.keys(data.containers).length / 2))),
      () => { data.danger = []; },
      () => pruneMapByAge(data.visited, 16),
      () => pruneMapByAge(data.containers, 8),
    ];
    for (const step of shrink) {
      step();
      s = serialize();
      if (utf8Bytes(s) <= opt.maxBytes) break;
    }
    return s;
  }

  function nearest(map, pos, dim, filter) {
    let best = null, bestD = Infinity;
    for (const key of Object.keys(map)) {
      const p = parsePosKey(key);
      if (dim && p.dim !== dim) continue;
      const rec = map[key];
      if (filter && !filter(rec, p)) continue;
      const d = Math.hypot(p.x - pos.x, p.y - pos.y, p.z - pos.z);
      if (d < bestD) { bestD = d; best = { ...p, dist: d, ...rec }; }
    }
    return best;
  }

  // ---------- 訪問チャンク / 親密度 ----------
  function recordVisit(pos, dim = DEFAULT_DIM) {
    const { cx, cz } = chunkOf(pos);
    const key = chunkKey(dim, cx, cz);
    const prev = data.visited[key];
    data.visited[key] = {
      t: now(),
      n: (prev?.n || 0) + 1,
      f: Math.min(opt.familiarityMax, (prev?.f || 0) + opt.familiarityPerVisit),
    };
    pruneVisited();
    dirty = true;
    return key;
  }

  function getVisited(cx, cz, dim = DEFAULT_DIM) {
    const rec = data.visited[chunkKey(dim, cx, cz)];
    return rec ? { ...rec } : null;
  }

  function isVisited(pos, dim = DEFAULT_DIM) {
    const { cx, cz } = chunkOf(pos);
    return !!data.visited[chunkKey(dim, cx, cz)];
  }

  function lastVisitAt(pos, dim = DEFAULT_DIM) {
    const { cx, cz } = chunkOf(pos);
    return data.visited[chunkKey(dim, cx, cz)]?.t ?? null;
  }

  function familiarityAt(pos, dim = DEFAULT_DIM) {
    const { cx, cz } = chunkOf(pos);
    return data.visited[chunkKey(dim, cx, cz)]?.f ?? 0;
  }

  // 親密度だけを直接加減する（滞在ボーナス等）。0..max にクランプ
  function bumpFamiliarity(pos, dim = DEFAULT_DIM, amount = 1) {
    const { cx, cz } = chunkOf(pos);
    const key = chunkKey(dim, cx, cz);
    const prev = data.visited[key] || { t: now(), n: 0, f: 0 };
    prev.f = Math.max(0, Math.min(opt.familiarityMax, (prev.f || 0) + amount));
    data.visited[key] = prev;
    dirty = true;
    return prev.f;
  }

  // 最近訪れたチャンクを新しい順に返す
  function recentChunks(limit = 16, dim = null) {
    return Object.entries(data.visited)
      .filter(([k]) => !dim || codeDim(k.slice(0, k.indexOf(":"))) === dim)
      .sort((a, b) => b[1].t - a[1].t)
      .slice(0, limit)
      .map(([k, rec]) => {
        const i = k.indexOf(":");
        const [cx, cz] = k.slice(i + 1).split(",").map(Number);
        return { dim: codeDim(k.slice(0, i)), cx, cz, ...rec };
      });
  }

  // ---------- コンテナ ----------
  function recordContainer(pos, dim = DEFAULT_DIM, opts = {}) {
    const key = posKey(dim, pos);
    const prev = data.containers[key];
    const at = now();
    const snap = sanitizeContents(opts.contents);
    data.containers[key] = {
      t: at,
      // N1 (v0.4.18): contents 専用時刻 ct。スナップショット採用時のみ contents と対で刻み、
      // 未指定時は contents+ct を対で保持する (中身と無関係な t 更新で鮮度が延命しない)
      ...(snap !== undefined ? { ct: at } : (prev?.ct !== undefined ? { ct: prev.ct } : {})),
      full: opts.full !== undefined ? (opts.full ? 1 : 0) : (prev?.full || 0),
      ...(opts.kind || prev?.k ? { k: opts.kind || prev.k } : {}),
      // Phase1: 任意メタ s=source / c=confidence(0..1)。旧レコードは欠落=undefinedで後方互換
      ...(resolveSource(opts.source, prev?.s) ? { s: resolveSource(opts.source, prev?.s) } : {}),
      ...(opts.confidence !== undefined || prev?.c !== undefined ? { c: Math.max(0, Math.min(1, opts.confidence !== undefined ? opts.confidence : prev.c)) } : {}),
      // Phase3 (v0.4.17) W1: contents は完全スナップショットで置換、未指定時は前回値を保持 (知覚走査が実測中身を消さない)
      ...(snap !== undefined ? { contents: snap } : (prev?.contents ? { contents: prev.contents } : {})),
    };
    pruneMapByAge(data.containers, opt.maxContainers);
    dirty = true;
    return key;
  }

  function markContainerFull(pos, dim = DEFAULT_DIM, full = true) {
    const key = posKey(dim, pos);
    if (!data.containers[key]) data.containers[key] = { t: now(), full: 0 };
    data.containers[key].full = full ? 1 : 0;
    data.containers[key].t = now();
    dirty = true;
  }

  function forgetContainer(pos, dim = DEFAULT_DIM) {
    const key = posKey(dim, pos);
    if (data.containers[key]) { delete data.containers[key]; dirty = true; return true; }
    return false;
  }

  function getContainer(pos, dim = DEFAULT_DIM) {
    const rec = data.containers[posKey(dim, pos)];
    return rec ? { ...rec } : null;
  }

  function knownContainers(dim = null) {
    return Object.entries(data.containers)
      .map(([k, rec]) => ({ ...parsePosKey(k), ...rec }))
      .filter((c) => !dim || c.dim === dim)
      .sort((a, b) => b.t - a.t);
  }

  // 最も近い既知コンテナ。excludeFull=true で満杯を候補から外す
  function nearestContainer(pos, dim = DEFAULT_DIM, opts = {}) {
    return nearest(data.containers, pos, dim, opts.excludeFull ? (rec) => !rec.full : null);
  }

  // ---------- 危険地点 ----------
  // kind 例: "lava" | "creeper" | "fall" | "hostile" | "gvc" | "owner_death" | "void" ...
  // severity は 0..1 目安。近い既存スポット (同一種別・8ブロック以内) は重ねて強化する
  function recordDanger(pos, dim = DEFAULT_DIM, kind = "hostile", severity = 0.6) {
    const code = dimCode(dim);
    const at = now();
    const w = Math.max(0.05, Math.min(1, severity));
    for (const s of data.danger) {
      if (s.d === code && s.k === kind && Math.hypot(s.x - pos.x, s.y - pos.y, s.z - pos.z) <= 8) {
        s.w = Math.min(1, Math.max(decayedWeight(s, at), w) + 0.15);
        s.t = at;
        s.x = Math.floor(pos.x); s.y = Math.floor(pos.y); s.z = Math.floor(pos.z);
        dirty = true;
        return { ...s, dim: codeDim(s.d) };
      }
    }
    const spot = { d: code, x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z), k: kind, w, t: at, s: "ev", c: w };
    data.danger.push(spot);
    pruneDanger();
    dirty = true;
    return { ...spot, dim };
  }

  // 半径内の危険を、減衰後の重みつきで強い順に返す
  function dangerNear(pos, dim = DEFAULT_DIM, radius = 16) {
    const at = now();
    const code = dimCode(dim);
    const out = [];
    for (const s of data.danger) {
      if (s.d !== code) continue;
      const d = Math.hypot(s.x - pos.x, s.y - pos.y, s.z - pos.z);
      if (d > radius) continue;
      const weight = decayedWeight(s, at);
      if (weight < opt.dangerMinWeight) continue;
      out.push({ dim: codeDim(s.d), x: s.x, y: s.y, z: s.z, kind: s.k, weight, dist: d, lastAt: s.t, ...(s.s ? { source: sourceName(s.s) || s.s } : {}), ...(s.c !== undefined ? { confidence: s.c } : {}) });
    }
    return out.sort((a, b) => b.weight - a.weight);
  }

  // 場所の危険度 0..1（半径内スポットの減衰重みの最大値、無ければ 0）
  function dangerLevelAt(pos, dim = DEFAULT_DIM, radius = 16) {
    const list = dangerNear(pos, dim, radius);
    return list.length ? list[0].weight : 0;
  }

  function forgetDangerNear(pos, dim = DEFAULT_DIM, radius = 16, kind = null) {
    const code = dimCode(dim);
    const before = data.danger.length;
    data.danger = data.danger.filter((s) =>
      !(s.d === code && (!kind || s.k === kind) && Math.hypot(s.x - pos.x, s.y - pos.y, s.z - pos.z) <= radius));
    if (data.danger.length !== before) dirty = true;
    return before - data.danger.length;
  }

  // ---------- ベッド / 設備 ----------
  function recordBed(pos, dim = DEFAULT_DIM, opts = {}) {
    const _k = posKey(dim, pos); const _prev = data.beds[_k];
    data.beds[_k] = { t: now(), s: resolveSource(opts.source, _prev?.s) || "ds", c: opts.confidence !== undefined ? Math.max(0, Math.min(1, opts.confidence)) : (_prev?.c !== undefined ? _prev.c : 0.9) };
    pruneMapByAge(data.beds, opt.maxBeds);
    dirty = true;
  }
  function nearestBed(pos, dim = DEFAULT_DIM) { return nearest(data.beds, pos, dim, null); }
  function knownBeds(dim = null) {
    return Object.entries(data.beds).map(([k, rec]) => ({ ...parsePosKey(k), ...rec })).filter((b) => !dim || b.dim === dim);
  }

  // kind 例: "crafting_table" | "furnace" | "enchanting_table" | 軌道工廠の機械ID など
  function recordWorkstation(pos, dim = DEFAULT_DIM, kind = "unknown", opts = {}) {
    const _k = posKey(dim, pos); const _prev = data.workstations[_k];
    data.workstations[_k] = { t: now(), k: kind, s: resolveSource(opts.source, _prev?.s) || "ds", c: opts.confidence !== undefined ? Math.max(0, Math.min(1, opts.confidence)) : (_prev?.c !== undefined ? _prev.c : 0.9) };
    pruneMapByAge(data.workstations, opt.maxWorkstations);
    dirty = true;
  }
  function nearestWorkstation(pos, dim = DEFAULT_DIM, kind = null) {
    return nearest(data.workstations, pos, dim, kind ? (rec) => rec.k === kind : null);
  }
  function knownWorkstations(dim = null, kind = null) {
    return Object.entries(data.workstations)
      .map(([k, rec]) => ({ ...parsePosKey(k), ...rec }))
      .filter((w) => (!dim || w.dim === dim) && (!kind || w.k === kind));
  }
  function forgetPlace(mapName, pos, dim = DEFAULT_DIM) {
    const map = data[mapName];
    const key = posKey(dim, pos);
    if (map && map[key]) { delete map[key]; dirty = true; return true; }
    return false;
  }

  // ---------- 保存 ----------
  function save() {
    pruneCounts();
    const s = enforceSizeLimit();
    try { adapter.save(s); } catch { return false; }
    dirty = false;
    return true;
  }

  function stats() {
    return {
      visited: Object.keys(data.visited).length,
      containers: Object.keys(data.containers).length,
      danger: data.danger.length,
      beds: Object.keys(data.beds).length,
      workstations: Object.keys(data.workstations).length,
      bytes: utf8Bytes(serialize()),
      maxBytes: opt.maxBytes,
      dirty,
    };
  }

  return {
    // 訪問 / 親密度
    recordVisit, getVisited, isVisited, lastVisitAt, familiarityAt, bumpFamiliarity, recentChunks,
    // コンテナ
    recordContainer, markContainerFull, forgetContainer, getContainer, knownContainers, nearestContainer,
    // 危険
    recordDanger, dangerNear, dangerLevelAt, forgetDangerNear,
    // 設備
    recordBed, nearestBed, knownBeds, recordWorkstation, nearestWorkstation, knownWorkstations,
    forgetBed: (pos, dim) => forgetPlace("beds", pos, dim),
    forgetWorkstation: (pos, dim) => forgetPlace("workstations", pos, dim),
    forgetContainer,
    // 保存 / 診断
    save, stats, serialize,
    get dirty() { return dirty; },
  };
}

export default createWorldMemory;
