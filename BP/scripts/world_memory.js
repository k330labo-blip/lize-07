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

export const WMEM_VERSION = 2; // 0-P (cyc2483): 観測状態 os/oa を持つ保存形式 v2

// Phase1残件: source の保存形は2文字コード。正名・別名も受け口で吸収する（未知値は欠落化）
export const WMEM_SOURCE = Object.freeze({ direct_scan: "ds", direct_inspect: "di", home_measured: "hm", event: "ev", self_placed: "sp", self_action: "sa", owner_told: "ot", owner_action: "oa", inferred: "in", hearsay: "hs", system: "sy" });
const SOURCE_BY_CODE = Object.fromEntries(Object.entries(WMEM_SOURCE).map(([k, v]) => [v, k]));
const SOURCE_ALIAS = { scan: "ds" };
export const normSource = (v) => { if (!v) return undefined; if (SOURCE_BY_CODE[v]) return v; return WMEM_SOURCE[v] || SOURCE_ALIAS[v] || undefined; };
export const sourceName = (code) => SOURCE_BY_CODE[code] ?? null;
const SRC_RANK = { sy: 0, hs: 1, in: 2, ds: 3, di: 3, ot: 4, oa: 5, sa: 6, sp: 6, ev: 7, hm: 8 };
const resolveSource = (next, prev) => { const n = normSource(next), o = normSource(prev); if (!n) return o; if (!o) return n; return (SRC_RANK[n] ?? 0) >= (SRC_RANK[o] ?? 0) ? n : o; };
// 0-P (v2): 観測状態の保存コード。observability.js の OBS と対応するが、永続層は
// 32KB 上限のため2文字コードで持つ。unknown/inferred_region/confirmed_absent は
// pos キーのマップへ保存しない (unknown=レコード無し、推測は座標を持たせない、
// 不在は除去で表す)。X-ray防止: ゲート未通過の走査由来記録を確定情報にしない。
export const WMEM_OBS = Object.freeze({ observed: "ob", remembered: "rm", stale: "st", unknown: "un", inferred_region: "ir", confirmed_absent: "ca" });
const OBS_BY_CODE = Object.fromEntries(Object.entries(WMEM_OBS).map(([k, v]) => [v, k]));
const OBS_STORABLE = new Set(["ob", "rm", "st"]);
export const normObsState = (v) => { if (!v) return undefined; if (OBS_BY_CODE[v]) return OBS_STORABLE.has(v) ? v : undefined; const c = WMEM_OBS[v]; return c && OBS_STORABLE.has(c) ? c : undefined; };
export const obsStateName = (code) => OBS_BY_CODE[code] ?? null;
export const WMEM_STALE_AFTER_MS = 30 * 60 * 1000;
// v1 からの移行で「正当な直接根拠」とみなす source (実開封・実測・自設置・自行動・所有者明示・実体験イベント)
const TRUSTED_SOURCE = new Set(["di", "hm", "sp", "sa", "ot", "oa", "ev"]);
// レコードの現在状態を導出する (保存値は書き換えない)。seen はゲート通過で
// 今見ている場合にだけ呼び出し側が渡す。保存だけでは observed と主張しない。
export function obsStateOf(rec, opts = {}) {
  if (!rec || typeof rec !== "object") return "unknown";
  if (rec.lg === 1) return "stale";
  const os = OBS_BY_CODE[rec.os] ? rec.os : null;
  if (!os || os === "st") return "stale";
  const oa = Number.isFinite(rec.oa) ? rec.oa : NaN;
  if (!Number.isFinite(oa) || oa <= 0) return "stale";
  const at = Number.isFinite(opts.now) ? opts.now : 0;
  const staleAfter = Number.isFinite(opts.staleAfterMs) ? opts.staleAfterMs : WMEM_STALE_AFTER_MS;
  if (at > 0 && at - oa >= staleAfter) return "stale";
  return opts.seen === true ? "observed" : "remembered";
}
// 記録時の os/oa/lg を決める。観測を伴う記録 (observe:true が既定) は基礎値を
// observed にし lg を外す。メタ更新だけの記録は前回値を保持する。
function obsFields(opts, prev, at) {
  if (opts?.observe === false) {
    return {
      ...(prev?.os && OBS_STORABLE.has(prev.os) ? { os: prev.os } : {}),
      ...(Number.isFinite(prev?.oa) ? { oa: prev.oa } : {}),
      ...(prev?.lg === 1 ? { lg: 1 } : {}),
    };
  }
  const want = normObsState(opts?.obsState) || "ob";
  return { os: want, oa: at };
}

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
    // containers: { "o:10,64,20": { t: 最終確認ms, full: 0|1, k: 種類(任意), os: 観測状態コード, oa: 最終観測ms, lg?: 1=移行未検証 } }
    containers: {},
    // danger: [ { d: 次元コード, x, y, z, k: 種類, w: 重み, t: 最終記録ms } ]
    danger: [],
    // beds / workstations: { "o:10,64,20": { t: 最終確認ms, k: 種類(設備のみ), os, oa, lg? } } (danger の各スポットも os/oa を持つ)
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
      // 0-P (v2移行): 観測根拠のない旧レコードを確定情報として移行しない。
      // parsed.v < 2 のときだけ発動する (v2 の ds は「ゲート通過した直接観測」の
      // 新意味であり、再移行で降格させない)。座標は捨てず stale+lg で残し、
      // 再観測されるまで確定読み手からは外れる。X-ray防止のための移行。
      const legacy = !(Number.isFinite(parsed.v) && parsed.v >= 2);
      let migrated = false;
      const migrateRec = (rec) => {
        if (!rec || typeof rec !== "object") return;
        const oaFb = Number.isFinite(rec.t) && rec.t > 0 ? rec.t : 0;
        if (legacy) {
          if (TRUSTED_SOURCE.has(rec.s)) { rec.os = "rm"; rec.oa = oaFb; delete rec.lg; }
          else { rec.os = "st"; rec.oa = oaFb; rec.lg = 1; }
          migrated = true;
        } else {
          if (!OBS_STORABLE.has(rec.os)) { rec.os = TRUSTED_SOURCE.has(rec.s) ? "rm" : "st"; if (!TRUSTED_SOURCE.has(rec.s)) rec.lg = 1; migrated = true; }
          if (!Number.isFinite(rec.oa)) { rec.oa = oaFb; migrated = true; }
        }
      };
      for (const m of [data.containers, data.beds, data.workstations]) for (const k of Object.keys(m)) migrateRec(m[k]);
      for (const sp of data.danger) migrateRec(sp);
      if (migrated) dirty = true;
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

  // 0-P: 読み出しコピーへ導出状態を併記する (保存形コード os とは別に、
  // 正名 state と未検証印 unverified を読める形で渡す。追加のみ・既存キーは不変)
  function withState(rec, opts = {}) {
    if (!rec || typeof rec !== "object") return rec;
    const st = obsStateOf(rec, { now: now(), seen: opts.seen === true, staleAfterMs: opts.staleAfterMs });
    return { ...rec, state: st, unverified: rec.lg === 1 };
  }
  const isConfirmed = (rec) => !!rec && rec.lg !== 1 && obsStateOf(rec, { now: now() }) !== "stale";

  // ---------- コンテナ ----------
  function recordContainer(pos, dim = DEFAULT_DIM, opts = {}) {
    const key = posKey(dim, pos);
    const prev = data.containers[key];
    const at = now();
    const snap = sanitizeContents(opts.contents);
    data.containers[key] = {
      t: at,
      // 0-P: 観測状態。観測を伴う記録は observed として刻み、移行印 lg を外す
      ...obsFields(opts, prev, at),
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
    // 0-P: 満杯印だけでは観測したことにならない。新規作成時は未検証 (stale+lg)
    // として刻み、確定情報として読まれないようにする。既存の os/oa/lg は不変。
    if (!data.containers[key]) data.containers[key] = { t: now(), full: 0, os: "st", oa: 0, lg: 1 };
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
    return rec ? withState({ ...rec }) : null;
  }

  function knownContainers(dim = null, opts = {}) {
    return Object.entries(data.containers)
      .map(([k, rec]) => withState({ ...parsePosKey(k), ...rec }))
      .filter((c) => !dim || c.dim === dim)
      .filter((c) => opts.verifiedOnly !== true || isConfirmed(c))
      .sort((a, b) => b.t - a.t);
  }

  // 最も近い既知コンテナ。excludeFull=true で満杯を候補から外す
  function nearestContainer(pos, dim = DEFAULT_DIM, opts = {}) {
    const fs = [];
    if (opts.excludeFull) fs.push((rec) => !rec.full);
    if (opts.excludeUnverified) fs.push((rec) => isConfirmed(rec));
    return nearest(data.containers, pos, dim, fs.length ? (rec) => fs.every((f) => f(rec)) : null);
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
        s.t = at; s.os = "ob"; s.oa = at; delete s.lg; // 0-P: 再体験は再観測と同義
        s.x = Math.floor(pos.x); s.y = Math.floor(pos.y); s.z = Math.floor(pos.z);
        dirty = true;
        return { ...s, dim: codeDim(s.d) };
      }
    }
    const spot = { d: code, x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z), k: kind, w, t: at, s: "ev", c: w, os: "ob", oa: at }; // 0-P: 実体験イベントは観測
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
      out.push({ dim: codeDim(s.d), x: s.x, y: s.y, z: s.z, kind: s.k, weight, dist: d, lastAt: s.t, ...(s.s ? { source: sourceName(s.s) || s.s } : {}), ...(s.c !== undefined ? { confidence: s.c } : {}), state: obsStateOf(s, { now: at }), unverified: s.lg === 1 }); // 0-P: 状態併記 (追加のみ)
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
    const _at = now();
    data.beds[_k] = { t: _at, s: resolveSource(opts.source, _prev?.s) || "ds", c: opts.confidence !== undefined ? Math.max(0, Math.min(1, opts.confidence)) : (_prev?.c !== undefined ? _prev.c : 0.9), ...obsFields(opts, _prev, _at) };
    pruneMapByAge(data.beds, opt.maxBeds);
    dirty = true;
  }
  function nearestBed(pos, dim = DEFAULT_DIM, opts = {}) { return nearest(data.beds, pos, dim, opts.excludeUnverified ? (rec) => isConfirmed(rec) : null); }
  function knownBeds(dim = null, opts = {}) {
    return Object.entries(data.beds).map(([k, rec]) => withState({ ...parsePosKey(k), ...rec })).filter((b) => !dim || b.dim === dim).filter((b) => opts.verifiedOnly !== true || isConfirmed(b));
  }

  // kind 例: "crafting_table" | "furnace" | "enchanting_table" | 軌道工廠の機械ID など
  function recordWorkstation(pos, dim = DEFAULT_DIM, kind = "unknown", opts = {}) {
    const _k = posKey(dim, pos); const _prev = data.workstations[_k];
    const _at = now();
    data.workstations[_k] = { t: _at, k: kind, s: resolveSource(opts.source, _prev?.s) || "ds", c: opts.confidence !== undefined ? Math.max(0, Math.min(1, opts.confidence)) : (_prev?.c !== undefined ? _prev.c : 0.9), ...obsFields(opts, _prev, _at) };
    pruneMapByAge(data.workstations, opt.maxWorkstations);
    dirty = true;
  }
  function nearestWorkstation(pos, dim = DEFAULT_DIM, kind = null, opts = {}) {
    const fs = [];
    if (kind) fs.push((rec) => rec.k === kind);
    if (opts.excludeUnverified) fs.push((rec) => isConfirmed(rec));
    return nearest(data.workstations, pos, dim, fs.length ? (rec) => fs.every((f) => f(rec)) : null);
  }
  function knownWorkstations(dim = null, kind = null, opts = {}) {
    return Object.entries(data.workstations)
      .map(([k, rec]) => withState({ ...parsePosKey(k), ...rec }))
      .filter((w) => (!dim || w.dim === dim) && (!kind || w.k === kind))
      .filter((w) => opts.verifiedOnly !== true || isConfirmed(w));
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
    obsState: (rec, o) => obsStateOf(rec, { now: now(), ...(o || {}) }), // 0-P: 状態導出の公開
    // 保存 / 診断
    save, stats, serialize,
    get dirty() { return dirty; },
  };
}

export default createWorldMemory;
