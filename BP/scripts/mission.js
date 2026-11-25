// リゼ (LIZE-07) ミッション実行エンジン — 注文（order）をタスク列に分解し、実行状態を管理する層
// 純粋JS。@minecraft/server には依存しない。統合時は BP/scripts/ へコピーして使う想定。
//
// 位置づけ（三層構造の真ん中）:
//   上: 指示パーサ … 主人のチャット/メニューを注文オブジェクトに変換する（別担当）
//   中: 本エンジン … 注文 → ステップ列に分解し、観測スナップショットを受けて
//       「次に実行すべき指令」を返す。進捗はインベントリ実測で判定する。
//   下: 実行部（main.js）… 指令（move/work/zap/deliver/say）を実際の移動・作業・発話に変換する。
//       安全系の即時反応（意思決定表）は常に本エンジンより優先する想定だが、
//       制約 hostiles:'ignore' のような「注文側の意思」は本エンジンが保持し、
//       実行部は directive.reason を見て反応層の割り込み可否を判断する（mission.md 参照）。
//
// order（パーサ出力）:
//   { kind: 'gather'|'hunt'|'collect'|..., target: itemId|entityId|blockId,
//     amount: number, constraints: { hostiles: 'ignore'|'fight'|'avoid' },
//     sideTasks: [{ kind, target, amount }], returnTo: 'owner'|'home'|{x,y,z,dim} }
// sourcing（統合側が知覚から渡す任意ヒント。無くても動く）:
//   { area: {x,y,z,dim} | null, initialRadius: number, maxRadius: number }
//
// observation（実行部が脳サイクルごとに渡す観測スナップショット）:
//   { invCounts: {itemId: n},        … リゼ所持品の実測カウント
//     kills: number,                 … ミッション開始からの累計討伐数（実行部が数える）
//     nearestDist: number,           … 現在ステップ目標までの距離（不明は -1）
//     dangerDist: number,            … 最寄り敵までの距離（なし = 999）
//     pos: {x,y,z}, dim: string,     … リゼの現在位置と次元
//     foundTarget: boolean,          … 現在ステップの対象が知覚範囲内に在るか
//     foundSide: string|null,        … 近くで見つけた寄り道対象の target（あれば）
//     selfHpPct: number,             … リゼのHP割合 0..1
//     invFull: boolean,              … リゼの所持枠が満杯か
//     atReturn: boolean,             … 帰還先の近くに居るか
//     delivered: boolean,            … 納品動作が完了したか（deliver ステップ用）
//     posKnown: boolean }            … リゼの現在位置が測れたか（false の間は停滞計上を凍結、Step 3c-2）
//
// directive（advance の返り値）:
//   { action: 'move'|'work'|'zap'|'deliver'|'say'|'none',
//     target?: 対象（座標/ステップ対象/探索サークル等）, reason?: string,
//     step?: 現在ステップの type, missionStatus?: mission.status }

export const STEP_TYPES = ["goto_area", "gather_block", "hunt_entity", "side_collect", "return", "deliver", "report"];
export const MISSION_STATUS = ["active", "done", "failed", "suspended"];

const num = (v, fb) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
const HOSTILE_MODES = ["ignore", "fight", "avoid"];

// 探索半径の段階（ブロック）。見つからないとき directive の target.radius がこの順に広がる
// v0.4.66: 見える範囲 (水平 ±32) に合わせて、巡回の輪を 32 ブロック間隔で外へ広げる。
export const SEARCH_STAGES = [24, 56, 88, 120, 152];
// v0.4.66: 輪 1 周の巡回点の間隔 (ブロック)。見える幅 64 より短くして取りこぼしを防ぐ
export const SEARCH_WP_SPACING = 40;
// v0.4.66: 1 つの巡回点に着けないまま何回観測したら、その点を飛ばすか (約 25 秒)
export const SEARCH_WP_TIMEOUT_OBS = 25;
// 各探索段階で「見つからない」観測が何回続いたら次の段階へ広げるか
const SEARCH_OBS_PER_STAGE = 3;
// v0.4.64: 「対象の状態が分からない (unknown/pending)」を何回まで保持するか。これを超えたら
// absent とみなして探索拡大・停止判定へ進む。無期限の保持は「プレイヤーの周りを回り続けて
// 止まりもしない」固着の原因になった (原木の樹種別走査が TTL と噛み合い pending が解けなかった)。
export const UNKNOWN_HOLD_OBS = 10;
// 進捗ゼロの観測が何回続いたら停滞とみなすか（脳サイクル ≒ 0.5秒想定で約30秒）
const STALL_LIMIT = 60;
// cycle0710: foundTarget 免除の累計上限。進捗ゼロのまま見え続ける場合は免除を外し通常計上へ合流する。600観測≒5分。
export const FOUND_STALL_LIMIT = 600;
// cycle0731: recovering(critical_hp) の吸収状態への出口。HPが 0.25〜0.5 帯に留まり続けると
// 回復手段が無い場合に recovering が無期限に続いた (先行実測: 0.20→0.30固定で10,000観測すべて recovering)。
// HP実測がある観測だけを単調計上し、上限超過で suspend へ抜ける (他の見切りと同型)。
export const RECOVER_STALL_LIMIT = 600;
// cycle0753: region 探索 (searchDirective regionMode) の単調上限。region 経路は mission 側カウンタを
// 一切進めず、searchExhausted が外部要因 (survey 鮮度 TTL との追いかけっこ等) で立たないと無出口だった
// (cycle0710-a16 / cycle0731-a02 で楽観条件 10,000 観測でも active のままを実測)。
// waypoint 全行程相当 ≒1,900 観測を上限とし、超過は exhausted 扱いで suspend(target_not_found) へ落とす。
export const REGION_STALL_LIMIT = 1900;
// cycle1110: Known region 探索の単調総量上限。49区画の正当な探索は 1,900 観測を正当に超える
// (digdown 契約が固定) ため凍結上限とは分離し1桁大きく取る。それでも有限であることが終了保証になる
// (cycle1110-a02: 上限なしでは楽観条件 100,000 観測でも active のまま=無出口を実測)。
export const REGION_TOTAL_LIMIT = 20000;
// NT-02b (cycle2319-a15 §3.2): WITHDRAW 候補への接近を進捗と認める最小の累積前進 (ブロック)。
// ホバー飛行の微振動で延命しないよう、単調に下げる最良距離から 1.0 超縮んだ時だけ進捗とする。
export const WITHDRAW_PROGRESS_EPS = 1.0;
// 寄り道を連続で何回まで許すか（本作業へ戻るための予算）
const SIDE_BUDGET = 3;
// 敵がこの距離以内なら fight/avoid が発動する
const HOSTILE_TRIGGER_DIST = 7;
// avoid のとき、この距離を割ったら作業を止めて距離を取る
const AVOID_DIST = 5;
// ignore でも中断する瀕死ライン
const CRITICAL_HP = 0.25;

let missionSeq = 0;

function stepFor(task, isSide) {
  const kind = task?.kind || "gather";
  const type = isSide ? "side_collect" : kind === "hunt" ? "hunt_entity" : "gather_block";
  return {
    type,
    kind,
    target: task?.target ?? null,
    need: Math.max(1, num(task?.amount, 1)),
    have: 0,
    banked: 0, // 満杯デツアーの納品で確定した進捗（在庫から消えても数え続ける）
    base: null, // ステップ開始時点の実測値（invCounts / kills）。初回観測で記録する
    status: "pending", // pending | active | done | skipped
    searchStage: 0,
    searchObs: 0,
    stallObs: 0,
    foundStallObs: 0, // cycle0710: foundTarget=true かつ進捗ゼロの累計。進捗時のみ 0 に戻る
    lastHave: 0,
    lostObs: 0,
    seen: false,
    wdKey: null, // NT-02b: 追跡中の WITHDRAW 候補キー (遅延初期化でも可、旧セーブ互換)
    wdBestDist: null, // NT-02b: 進捗アンカー距離 (候補切替時/進捗認定時のみ更新、悪化では上げない)
  };
}

// 注文 → ミッション（ステップ列）を生成する。純粋なデータオブジェクトで、
// そのまま Dynamic Properties に JSON 保存できる形に保つ（関数は持たせない）。
export function createMission(order, sourcing = null) {
  const o = order || {};
  const steps = [];
  // Phase5 forbidden gate Slice1 (v0.4.68): 禁止対象は機会的経路 (寄り道) へ入れない。
  // 正規化を steps 生成より前に行い、完全一致のみで判定する (派生物・燃料へは広げない)。
  // cycle0753 NEG-05/06: 禁止IDは接頭辞なし (例 "iron_ingot") で渡されても実対象 (minecraft:iron_ingot) と
  // 照合できるよう、名前空間が無いものは minecraft: を補って正規化する (照合側は完全一致のまま)。
  const normForbiddenId = (x) => (typeof x === "string" && x && !x.includes(":") ? `minecraft:${x}` : x);
  const forbiddenEarly = Array.isArray(o.constraints?.forbiddenTargets) ? [...new Set(o.constraints.forbiddenTargets.filter((x) => typeof x === "string" && x).map(normForbiddenId))] : [];
  const isForbiddenId = (id) => typeof id === "string" && forbiddenEarly.includes(id);
  const area = sourcing?.area || o.area || null;
  if (area) steps.push({ type: "goto_area", kind: "goto", target: area, need: 0, have: 0, base: null, status: "pending", searchStage: 0, searchObs: 0, stallObs: 0, lastHave: 0 });
  steps.push(stepFor(o, false));
  for (const side of Array.isArray(o.sideTasks) ? o.sideTasks : []) { if (isForbiddenId(side?.target)) continue; steps.push(stepFor(side, true)); }
  // legsOnly: 長期タスクの1工程として使う場合、帰還・納品・報告は付けない（親タスクが担う）
  if (!o.legsOnly) {
    steps.push({ type: "return", kind: "return", target: o.returnTo ?? "owner", need: 0, have: 0, base: null, status: "pending", searchStage: 0, searchObs: 0, stallObs: 0, lastHave: 0 });
    steps.push({ type: "deliver", kind: "deliver", target: o.returnTo ?? "owner", need: 0, have: 0, base: null, status: "pending", searchStage: 0, searchObs: 0, stallObs: 0, lastHave: 0 });
    steps.push({ type: "report", kind: "report", target: null, need: 0, have: 0, base: null, status: "pending", searchStage: 0, searchObs: 0, stallObs: 0, lastHave: 0 });
  }

  const hostiles = HOSTILE_MODES.includes(o.constraints?.hostiles) ? o.constraints.hostiles : "avoid";
  const forbiddenTargets = forbiddenEarly;
  return {
    id: `mission_${++missionSeq}`,
    order: {
      kind: o.kind || "gather",
      target: o.target ?? null,
      amount: Math.max(1, num(o.amount, 1)),
      constraints: { hostiles, forbiddenTargets },
      sideTasks: (Array.isArray(o.sideTasks) ? o.sideTasks : []).filter((t) => !isForbiddenId(t?.target)),
      returnTo: o.returnTo ?? "owner",
      legsOnly: !!o.legsOnly, // v0.4.67: 長期タスクの途中工程か (完了時に「お渡ししました」と言わないため。以前は書き写していなかった)
    },
    steps,
    currentStep: 0,
    status: "active", // active | done | failed | suspended
    suspendReason: null,
    suspendCount: 0, // 同一ステップでの連続 suspend 回数。finishStep でのみ 0 に戻す (cycle0238-a24)
    blocked: null, // 一時的な中断理由（critical_hp 等）。解消すれば自動で戻る
    recoverObs: 0, // cycle0731: recovering の単調計上 (HP実測がある観測のみ、解除時に 0)
    detour: null, // 満杯時の帰還デツアー { phase: 'to_return'|'deliver', resumeStep: number }
    initialRadius: num(sourcing?.initialRadius, SEARCH_STAGES[0]),
    maxRadius: num(sourcing?.maxRadius, SEARCH_STAGES[SEARCH_STAGES.length - 1]),
    startedAt: Date.now(),
    updatedAt: Date.now(),
    obsCount: 0,
    sideStreak: 0,
  };
}

function currentStepOf(m) {
  return m.steps[m.currentStep] || null;
}

function finishStep(m) {
  const s = currentStepOf(m);
  if (s) s.status = "done";
  m.suspendCount = 0; // 進捗が確定したので見切りカウンタを戻す (消去経路はここだけ)
  m.currentStep++;
  const next = currentStepOf(m);
  if (next) next.status = "active";
}

function suspend(m, reason) {
  m.status = "suspended";
  m.suspendReason = reason;
  m.suspendCount = (m.suspendCount || 0) + 1;
  return { action: "say", reason: `suspended:${reason}`, step: currentStepOf(m)?.type, missionStatus: m.status };
}

// ステップの進捗を実測値から更新する。hunt は kills、それ以外は invCounts[target]。
function measure(s, obs) {
  if (s.type !== "hunt_entity" && obs?.invKnown === false) return s.have || 0; // 所持が測れていない tick は base を汚染しない
  const raw = s.type === "hunt_entity" ? num(obs.kills, 0) : num(obs.invCounts?.[s.target], 0);
  if (s.base === null) { s.base = raw; s.lastHave = s.banked || 0; }
  s.have = (s.banked || 0) + Math.max(0, raw - s.base);
  return s.have;
}

// cycle1003 (withdraw W-N1): 凍結集合の単一の正。trackStall と withdrawDirective が同じ定義を参照し、
// 集合のずれ (dangerKnown だけ withdraw 側に無い等) で見切りカウンタが進まない事故を構造的に防ぐ。
function isFrozenObs(obs) {
  return obs?.invKnown === false || obs?.dangerKnown === false || obs?.targetKnown === false || obs?.posKnown === false;
}
function trackStall(m, s, obs) {
  if (isFrozenObs(obs)) {
    // A09-FROZEN-ROUTE (cycle1133): 恒常凍結にも単調な累計上限を持たせ、経路系の無出口を解消する (region/WITHDRAW と同型)。
    // リセットは進捗認定点 (have 増加 / WITHDRAW 接近) でのみ行い、Known 1回では戻さない (フラッピング対策)。
    s.routeFrozenObs = (s.routeFrozenObs || 0) + 1;
    if (s.routeFrozenObs > REGION_STALL_LIMIT) { s.routeFrozenObs = 0; return true; }
    return false;
  } // Phase2 INSPECT Step 3b (v0.4.12) + Step 3c-2 (v0.4.34): 測れていない時間 (所持/走査/対象/位置) は停滞に数えない
  if (s.have > s.lastHave) { s.lastHave = s.have; s.stallObs = 0; s.foundStallObs = 0; s.wdFrozenObs = 0; s.routeFrozenObs = 0; return false; } // wdFrozenObs のリセットは進捗認定点でのみ (cycle1003 案B) // foundStallObs のリセットは進捗時のみ (cycle0710)
  // 対象が見えている間の作業中は停滞に数えない（掘削・戦闘は実行部側の所要時間がある）
  if (obs.foundTarget) {
    s.foundStallObs = (s.foundStallObs || 0) + 1;
    if (s.foundStallObs <= FOUND_STALL_LIMIT) { s.stallObs = 0; return false; }
    // 上限超過: fall through して通常の stallObs++ / STALL_LIMIT 判定へ合流する (cycle0710)
  }
  // NT-02b: 追跡中の WITHDRAW 候補への接近は進捗。最良距離が有意に (EPS 超) 縮んだ時だけ数える。
  // 候補が替わったら基準だけ張り直す (進捗にはしない)。blocked 済み候補は対象外
  // (探索側 trackStall が誤ってリセットされないための担保、a15 §3.2)。
  // withdrawDist が null/不在の tick は素通りし、従来同値 (延命もしない)。
  try {
    const wd = obs?.withdrawDist, cand = obs?.withdrawCandidate;
    if (cand && typeof wd === "number" && Number.isFinite(wd)) {
      const key = _withdrawKeyOf(m.currentStep, cand);
      const blocked = Array.isArray(obs?.withdrawBlocked) && obs.withdrawBlocked.includes(key);
      if (key && !blocked) {
        if (s.wdKey !== key) { s.wdKey = key; s.wdBestDist = wd; }
        else if (wd < s.wdBestDist - WITHDRAW_PROGRESS_EPS) { s.wdBestDist = wd; s.stallObs = 0; s.wdFrozenObs = 0; s.routeFrozenObs = 0; return false; } // cycle1003 案B: 接近進捗でも wdFrozenObs を戻す
        // a15 §3.2 原文の第3分岐 (EPS未満の前進を wdBestDist へ毎tick繰り込む) は採らない:
        // 繰り込むと最良距離との差が常に1歩分以下になり EPS を永遠に超えず、0.5/観測の
        // steady な接近が未修正と同じ59観測目で suspend する (cycle2341-a10 実測、REPORT §2)。
        // wdBestDist は「最後に進捗と認めた時点の距離 (アンカー)」とし、切替/進捗時のみ更新する。
        // これで 0.4ずつの接近は3観測で累積 1.2 > EPS となり発火する (a15 §3.2 の意図どおり)。
      }
    }
  } catch { /* 壊れた候補材料では進捗にせず、従来の停滞計上へ落とす */ }
  s.stallObs++;
  return s.stallObs >= STALL_LIMIT;
}

// 敵への反応。作業系ステップ中だけ意味を持つ。戻り値が null なら通常処理へ。
function hostileDirective(m, s, obs) {
  const mode = m.order.constraints.hostiles;
  const danger = num(obs.dangerDist, 999);
  const hp = num(obs.selfHpPct, 1);
  // 瀕死は制約によらず中断（ignore でも死なせない）
  if (hp < CRITICAL_HP) {
    // cycle1443 (a08 到達可能性監査): hp<0.25 に留まり続けると本分岐が毎回先行し、下段の回復待ち計上
    // (0.25<=hp 帯でしか到達できない) が永遠に進まず cannot_recover へ出られなかった (楽観条件100,000観測でも active のまま実測)。
    // 既に blocked 中の退避観測も HP実測がある場合だけ単調計上し、上限超過で suspend する。
    if (m.blocked === "critical_hp" && typeof obs.selfHpPct === "number" && Number.isFinite(obs.selfHpPct)) {
      m.recoverObs = (m.recoverObs || 0) + 1;
      if (m.recoverObs > RECOVER_STALL_LIMIT) return suspend(m, "cannot_recover");
    }
    m.blocked = "critical_hp";
    return { action: "move", target: m.order.returnTo, reason: "retreat_critical_hp", step: s.type, missionStatus: m.status };
  }
  if (m.blocked === "critical_hp" && hp >= 0.5) { m.blocked = null; m.recoverObs = 0; }
  if (m.blocked === "critical_hp") {
    // cycle0731: 回復待ちの単調計上 (HP実測がある観測のみ)。上限超過は cannot_recover で中断し出口を作る
    if (typeof obs.selfHpPct === "number" && Number.isFinite(obs.selfHpPct)) {
      m.recoverObs = (m.recoverObs || 0) + 1;
      if (m.recoverObs > RECOVER_STALL_LIMIT) return suspend(m, "cannot_recover");
    }
    return { action: "none", reason: "recovering", step: s.type, missionStatus: m.status };
  }
  m.recoverObs = 0;
  if (obs?.dangerKnown === false) return null; // 敵が見えていない時は番兵距離で戦闘/回避を決めない（瀕死処理は上段で済み）
  if (danger >= HOSTILE_TRIGGER_DIST) return null;
  if (mode === "ignore") return null; // 敵が近くても作業継続（directive は通常処理が返す）
  if (mode === "fight") return { action: "zap", reason: "hostiles_fight", step: s.type, missionStatus: m.status };
  // avoid
  if (danger < AVOID_DIST) return { action: "move", target: m.order.returnTo, reason: "avoid_hostile", step: s.type, missionStatus: m.status };
  return null;
}

// 寄り道の挿入判定: 本ステップの作業中、近所で寄り道対象が見つかればそちらを先にやる。
// 寄り道ステップ自体は steps に残し、完了したら done にする（本ステップは進めない）。
function sideDirective(m, obs) {
  if (obs?.invKnown === false) return null; // 所持が測れていない時は寄り道の完了判定をしない
  if ((m.sideStreak || 0) >= SIDE_BUDGET) return null;
  if (!obs.foundSide) return null;
  if (Array.isArray(m.order?.constraints?.forbiddenTargets) && m.order.constraints.forbiddenTargets.includes(obs.foundSide)) return null; // Phase5 Slice1: 禁止対象の寄り道は旧セーブの step が残っていても発火させない
  const side = m.steps.find((s) => s.type === "side_collect" && s.status !== "done" && s.target === obs.foundSide);
  if (!side) return null;
  const have = measure(side, obs);
  if (have >= side.need) { side.status = "done"; return null; }
  m.sideStreak = (m.sideStreak || 0) + 1;
  return { action: "work", target: side.target, reason: "side_collect_opportunistic", step: "side_collect", missionStatus: m.status };
}

// 満杯デツアー: 帰還 → 納品 → 元ステップへ復帰
function detourDirective(m, obs) {
  const d = m.detour;
  if (!d) return null;
  if (d.phase === "to_return") {
    if (obs.atReturn) { d.phase = "deliver"; d.stallObs = 0; return { action: "deliver", target: m.order.returnTo, reason: "detour_deliver", step: "deliver", missionStatus: m.status }; }
    // 到達可能性監査 (v0.4.88, cycle0616-a07): to_return 相にも終了保証を共通化する。従来は計上自体が無く、到達できないと無期限に滞留した (楽観条件10,000観測でも未完了を実測)
    if (obs?.invKnown !== false && obs?.dangerKnown !== false && obs?.targetKnown !== false && obs?.posKnown !== false) {
      d.stallObs = (d.stallObs || 0) + 1;
      if (d.stallObs >= STALL_LIMIT) { m.detour = null; return suspend(m, "cannot_return"); }
    } else {
      d.routeFrozenObs = (d.routeFrozenObs || 0) + 1; // A09-FROZEN-ROUTE (cycle1133): デツアーにも凍結上限
      if (d.routeFrozenObs > REGION_STALL_LIMIT) { m.detour = null; return suspend(m, "cannot_return"); }
    }
    return { action: "move", target: m.order.returnTo, reason: "detour_return_full", step: "return", missionStatus: m.status };
  }
  // deliver phase
  if (obs.delivered) {
    // 納品した分は進捗として確定させる（在庫から消えても have が巻き戻らないように）
    const s = m.steps[d.resumeStep];
    if (s) { s.banked = (s.banked || 0) + (s.have || 0); s.base = null; s.have = s.banked; s.lastHave = s.banked; s.stallObs = 0; s.foundStallObs = 0; } // banked確定は進捗 (cycle0710)
    m.detour = null;
    return { action: "say", reason: "detour_resume", step: currentStepOf(m)?.type, missionStatus: m.status };
  }
  // v0.4.79 N-2: デツアー deliver 相にも終了保証 (trackStall と同じ Known ガードの単調計上、STALL_LIMIT 共用。to_return 相は元のステップの保証に委ね意図的に未計上 = D-1)
  if (obs?.invKnown !== false && obs?.dangerKnown !== false && obs?.targetKnown !== false && obs?.posKnown !== false) {
    d.stallObs = (d.stallObs || 0) + 1;
    if (d.stallObs >= STALL_LIMIT) { m.detour = null; return suspend(m, "cannot_return"); }
  } else {
    d.routeFrozenObs = (d.routeFrozenObs || 0) + 1; // A09-FROZEN-ROUTE (cycle1133)
    if (d.routeFrozenObs > REGION_STALL_LIMIT) { m.detour = null; return suspend(m, "cannot_return"); }
  }
  return { action: "deliver", target: m.order.returnTo, reason: "detour_deliver", step: "deliver", missionStatus: m.status };
}

// Phase2 WITHDRAW Step B (v0.4.11): 既知コンテナ候補のキー。blocked 判定は候補単位 (集合) で行い、
// 単一キー上書きによる A→B→A ピンポンを構造的に防ぐ (cycle-1001 a01 §3)。
export { withdrawKeyOf } from "./withdraw_candidate.js"; // B1 (v0.4.26): 正は withdraw_candidate.js、ここは再輸出
import { withdrawKeyOf as _withdrawKeyOf } from "./withdraw_candidate.js";

// 既知コンテナから不足分を取り出す指令。候補の在庫は world_memory が保持しないため断定せず、
// 確定は実行部 (WITHDRAW executor の stock) が担う。優先順位は 完了→瀕死→寄り道→自然対象→withdraw→探索拡大。
function withdrawDirective(m, s, obs) {
  if (s.type !== "gather_block" && s.type !== "side_collect") return null;
  if (obs?.invKnown === false) return null;
  if (m.detour || m.blocked === "critical_hp") return null;
  if (num(obs.selfHpPct, 1) < CRITICAL_HP) return null; // 瀕死は距離の近さで上書きしない (SWB-C-02)
  const cand = obs?.withdrawCandidate || null;
  if (!cand || typeof cand.item !== "string" || !cand.item.includes(":")) return null;
  if (Array.isArray(m.order?.constraints?.forbiddenTargets) && m.order.constraints.forbiddenTargets.includes(cand.item)) return null; // Phase5 Slice1: 禁止対象はコンテナからも取り出さない (完全一致のみ)
  if ((s.need - s.have) <= 0) return null;
  const key = _withdrawKeyOf(m.currentStep, cand);
  if (Array.isArray(obs?.withdrawBlocked) && obs.withdrawBlocked.includes(key)) return null;
  // cycle0753-a01 A/C: target/pos が unknown の間は trackStall が凍結し withdraw が無期限に返り続ける。
  // 凍結観測にも単調な累計上限を付け、上限超過は no_progress で中断する (凍結解除で 0 に戻る)。
  // cycle1003 W-N1/W-N2 (案A+B): 凍結判定は isFrozenObs で trackStall と統一する (invKnown は冒頭ガードで到達不能)。
  // 凍結でない観測では戻さない (単調累計)。Known 1回で戻すと周期フラッピングで上限に届かない (実測 60xP 観測)。
  // リセットは trackStall の進捗認定点 (have 増加 / WITHDRAW EPS 接近) でのみ行う。
  if (isFrozenObs(obs)) {
    s.wdFrozenObs = (s.wdFrozenObs || 0) + 1;
    if (s.wdFrozenObs > REGION_STALL_LIMIT) { s.wdFrozenObs = 0; return suspend(m, "no_progress"); }
  }
  // 明示 trackStall: withdraw で早期 return すると探索拡大側の trackStall に到達せず終了保証が消えるため、ここで1回だけ数える
  if (trackStall(m, s, obs)) {
    // Phase3 READ-1 (G-1 第2層): 割引済み allow が立ち未消費の場合に限り、停滞中断を指令1回分だけ保留する (planShield の書き手はここ1か所のみ)
    if (obs?.planAdoptAllow === true) return { action: "withdraw", target: cand, reason: obs?.withdrawInRange ? "withdraw_known_container" : "withdraw_move_to_container", step: s.type, missionStatus: m.status, needRemaining: s.need - s.have, withdrawKey: key, planShield: true };
    return suspend(m, "no_progress");
  }
  return { action: "withdraw", target: cand, reason: obs?.withdrawInRange ? "withdraw_known_container" : "withdraw_move_to_container", step: s.type, missionStatus: m.status, needRemaining: s.need - s.have, withdrawKey: key };
}

// v0.4.66: 輪の巡回点の数。円周を SEARCH_WP_SPACING で割る (最低 6 点)
export function searchWpCount(radius) { return Math.max(6, Math.ceil((2 * Math.PI * radius) / SEARCH_WP_SPACING)); }
// v0.4.64: 探索指令。中心はミッション開始地点に固定し (s.searchCenter)、半径ごとの巡回点
// (60°刻み6点) を順に訪れる。中心を現在位置にすると巡回点も一緒に動いてその場で円を描くだけ
// になり、外へ広がらない (実機症状「プレイヤーの周りを回るだけ」の主因)。
function searchDirective(m, s, obs, reason) {
  // v0.4.66: 探索の進み方を「観測回数」から「実際に巡回点を回ったか」に変えた。旧方式は 3 観測ごとに
  // 半径を広げ、約 21 秒で最大半径に達して保留になっていた (遠くの巡回点には一度も行けていない)。
  // 輪の巡回点をすべて回り終えたら 1 段外の輪へ。全段を回り終えたら null (= 探し尽くした)。
  if (!s.searchCenter && obs.pos) s.searchCenter = { x: obs.pos.x, y: obs.pos.y, z: obs.pos.z };
  // v0.4.66: チャンク調査が使えるときは区画探索。行き先 (未調査の区画) は実行側が決め、ここは探し尽くしたかだけを見る
  if (obs.regionSearch) {
    if (obs.searchExhausted) { s.regionObs = 0; return null; }
    // cycle1110 (a02実測): Known 経路は regionObs に上限が無く、searchExhausted が TTL 追いかけで
    // 永遠に立たないと 100,000 観測でも active のまま (無出口)。リセット条件を持たない単調
    // カウンタで終了保証する (進捗リセットの対象にしない)。上限超過で探し尽くし (null) へ。
    s.regionTotalObs = (s.regionTotalObs || 0) + 1;
    if (s.regionTotalObs > REGION_TOTAL_LIMIT) { s.regionTotalObs = 0; return null; }
    // cycle0753-a02 ケースE: region 探索中でも所持が増えたら進捗として region 系カウンタを戻す (誤 suspend 防止)
    if (typeof s.have === "number" && s.have > (s.regionLastHave ?? -1)) { s.regionObs = 0; s.regionFrozenObs = 0; }
    s.regionLastHave = typeof s.have === "number" ? s.have : (s.regionLastHave ?? 0);
    // cycle0753: Known な region 探索は 49 区画で 1,900 観測を正当に超える (digdown 契約テストが
    // 「探索が続く」ことを固定) ため観測数では見切らない。出口は main 側 searchExhausted が担う。
    // ただし情報ゼロ (target/pos が unknown) の凍結が恒常化した場合は下の累計上限で見切る。
    if (obs?.targetKnown !== false && obs?.posKnown !== false) {
      s.regionObs = (s.regionObs || 0) + 1; s.regionFrozenObs = 0;
    } else {
      // cycle0753-a01 B'/B'': 凍結が恒常化すると regionObs が永遠に進まず無出口になるため、凍結観測にも同型の累計上限を付ける
      s.regionFrozenObs = (s.regionFrozenObs || 0) + 1;
      if (s.regionFrozenObs > REGION_STALL_LIMIT) { s.regionFrozenObs = 0; return null; }
    }
    return { action: "move", target: { type: "search", center: s.searchCenter || null, dim: obs.dim || null, regionMode: true }, reason, step: s.type, missionStatus: m.status };
  }
  const c = s.searchCenter || null;
  for (let guard = 0; guard < SEARCH_STAGES.length + 1; guard++) {
    const stage = s.searchStage || 0;
    if (stage >= SEARCH_STAGES.length) return null;
    const radius = Math.max(m.initialRadius || 0, SEARCH_STAGES[stage]);
    if (radius > (m.maxRadius ?? Infinity)) return null;
    const n = searchWpCount(radius);
    const off = stage * 0.5; // 段ごとに巡回点の角度をずらす (同じ方角ばかり見ない)
    const wpAt = (i) => { const a = ((i % n) + off) * (2 * Math.PI / n); return { x: c.x + Math.cos(a) * radius, z: c.z + Math.sin(a) * radius }; };
    if (!c || !obs.pos) {
      // cycle1603 S-1-NULLPOS: pos が測れない観測では wpObs が進まず無出口だったため、
      // region 経路と同型の単調凍結上限を付ける (リセットは pos が読めた観測でのみ)。
      s.searchFrozenObs = (s.searchFrozenObs || 0) + 1;
      if (s.searchFrozenObs > REGION_STALL_LIMIT) { s.searchFrozenObs = 0; return null; }
      return { action: "move", target: { type: "search", center: c, dim: obs.dim || null, radius, wp: null }, reason, step: s.type, missionStatus: m.status };
    }
    s.searchFrozenObs = 0;
    let idx = s.searchWp || 0;
    let wp = wpAt(idx);
    s.wpObs = (s.wpObs || 0) + 1;
    if (Math.hypot(obs.pos.x - wp.x, obs.pos.z - wp.z) <= 4 || s.wpObs > SEARCH_WP_TIMEOUT_OBS) {
      idx++; s.wpObs = 0;
      if (idx >= n) { s.searchStage = stage + 1; s.searchWp = 0; continue; } // この輪は回り終えた → 外の輪へ
      s.searchWp = idx; wp = wpAt(idx);
    }
    return { action: "move", target: { type: "search", center: c, dim: obs.dim || null, radius, wp }, reason, step: s.type, missionStatus: m.status };
  }
  return null;
}

// 観測を1回分与えて、次に実行すべき指令を返す。mission は破壊的に更新される。
export function advance(mission, observation) {
  const m = mission;
  const obs = observation || {};
  if (!m || m.status === "done" || m.status === "failed") return { action: "none", reason: "mission_closed", missionStatus: m?.status };
  if (m.status === "suspended") return { action: "none", reason: `suspended:${m.suspendReason}`, missionStatus: m.status };
  m.obsCount++;
  m.updatedAt = Date.now();

  const s = currentStepOf(m);
  if (!s) { m.status = "done"; return { action: "say", reason: "mission_complete", missionStatus: m.status }; }
  if (s.status === "pending") s.status = "active";

  // 満杯デツアー（作業系ステップの途中だけ割り込む）
  if (m.detour) { const d = detourDirective(m, obs); if (d) return d; }
  if (obs.invFull && obs?.invKnown !== false && (s.type === "gather_block" || s.type === "hunt_entity" || s.type === "side_collect")) {
    m.detour = { phase: "to_return", resumeStep: m.currentStep };
    return { action: "move", target: m.order.returnTo, reason: "detour_return_full", step: "return", missionStatus: m.status };
  }

  switch (s.type) {
    case "goto_area": {
      const d = num(obs.nearestDist, -1);
      if (obs.atReturn || (d >= 0 && d <= 3)) { finishStep(m); return { action: "say", reason: "arrived_area", step: "goto_area", missionStatus: m.status }; }
      if (trackStall(m, s, obs)) return suspend(m, "cannot_reach_area");
      return { action: "move", target: s.target, reason: "goto_area", step: s.type, missionStatus: m.status };
    }
    case "gather_block":
    case "hunt_entity":
    case "side_collect": {
      measure(s, obs);
      if (s.have >= s.need) {
        finishStep(m);
        return { action: "say", reason: "step_complete", step: s.type, missionStatus: m.status };
      }
      const hostile = hostileDirective(m, s, obs);
      if (hostile) return hostile;
      // 本ステップ（side_collect 自身でない）作業中は寄り道を差し込む
      if (s.type !== "side_collect") { const side = sideDirective(m, obs); if (side) return side; if ((m.sideStreak || 0) < SIDE_BUDGET) m.sideStreak = 0; } // 到達可能性監査 (cycle1518-a09): 予算枯渇で null になった観測自身がカウンタを消す自己消去を是正。枯渇時はリセットせず、本ステップ指令が返り機会が無い/完了した観測でのみ戻す
      if (obs.foundTarget) {
        s.seen = true; s.lostObs = 0;
        // cycle0710: この分岐は従来 trackStall を経由せず無出口だった。1回だけ呼び累計上限を効かせる
        const progressed = s.have > (s.lastHave || 0);
        if (trackStall(m, s, obs)) return suspend(m, "no_progress");
        // 探索進度の初期化は進捗があった観測だけ (見えただけでは消さない)
        if (progressed) {
        s.searchStage = 0; s.searchObs = 0;
        s.searchCenter = null; s.searchWp = 0; s.unknownObs = 0; s.wpObs = 0; s.regionObs = 0;
        }
        return { action: "work", target: s.target, reason: s.type === "hunt_entity" ? "hunt_target" : "gather_target", step: s.type, missionStatus: m.status };
      }
      // 一度見えた対象が1回だけ見失われた場合は作業を保持する（デバウンス）
      if (s.seen && obs?.targetKnown !== false && (s.lostObs = (s.lostObs || 0) + 1) < 2) { // Step 3b デバウンス凍結 (v0.4.13): unknown/pending では猶予を消費しない
        return { action: "work", target: s.target, reason: s.type === "hunt_entity" ? "hunt_target" : "gather_target", step: s.type, missionStatus: m.status };
      }
      // Phase2 WITHDRAW Step B: 自然対象が無いときだけ既知コンテナ調達を試す (在庫は未確定情報、自然対象は確定情報)
      const wd = withdrawDirective(m, s, obs); if (wd) return wd;
      // Phase2 INSPECT Step 3b + v0.4.64: 対象状態が unknown/pending の間は「不在」と断定せず
      // 探索拡大も失敗計上も凍結する。ただし保持は UNKNOWN_HOLD_OBS 回まで。超えたら absent と
      // みなして下の拡大・停止判定へ進む (無期限保持は固着の原因になったため)。
      if (obs?.targetKnown === false) {
        s.unknownObs = (s.unknownObs || 0) + 1;
        if (s.unknownObs <= UNKNOWN_HOLD_OBS) {
          const hd = searchDirective(m, s, obs, "search_hold_unknown");
          if (hd) return hd;
          return suspend(m, "target_not_found");
        }
      } else s.unknownObs = 0;
      // 見つからない → 巡回しながら外へ広げる (v0.4.66: 段の進みは巡回点ベース。探索中は停滞に数えない)
      const sd = searchDirective(m, s, obs, "search_expand");
      if (sd) return sd;
      return suspend(m, "target_not_found"); // 全段の輪を回り終えても無かった
    }
    case "return": {
      if (obs.atReturn || num(obs.nearestDist, -1) >= 0 && num(obs.nearestDist, -1) <= 2.5) {
        finishStep(m);
        return { action: "say", reason: "returned", step: "return", missionStatus: m.status };
      }
      if (trackStall(m, s, obs)) return suspend(m, "cannot_return");
      return { action: "move", target: s.target, reason: "return", step: s.type, missionStatus: m.status };
    }
    case "deliver": {
      if (obs.delivered) { finishStep(m); return { action: "say", reason: "delivered", step: "deliver", missionStatus: m.status }; }
      if (trackStall(m, s, obs)) return suspend(m, "cannot_return"); // v0.4.79 N-2: deliver にも return と同型の終了保証 (出口なし解消)
      if (!obs.atReturn) return { action: "move", target: s.target, reason: "return_for_deliver", step: s.type, missionStatus: m.status };
      return { action: "deliver", target: s.target, reason: "deliver", step: s.type, missionStatus: m.status };
    }
    case "report": {
      finishStep(m);
      m.status = "done";
      return { action: "say", reason: "mission_complete", step: "report", missionStatus: m.status };
    }
    default:
      return { action: "none", reason: "unknown_step", step: s.type, missionStatus: m.status };
  }
}

// 主人への報告・状態表示用にミッションを要約する（実行部がセリフ生成へ渡す素材）
export function missionSummary(m) {
  if (!m) return null;
  const done = m.steps.filter((s) => s.status === "done").length;
  const cur = currentStepOf(m);
  return {
    id: m.id,
    status: m.status,
    suspendReason: m.suspendReason,
    kind: m.order.kind,
    target: m.order.target,
    amount: m.order.amount,
    stepsDone: done,
    stepsTotal: m.steps.length,
    currentStep: cur ? { type: cur.type, target: cur.target, need: cur.need, have: cur.have } : null,
    elapsedMs: (m.updatedAt || m.startedAt) - m.startedAt,
  };
}
