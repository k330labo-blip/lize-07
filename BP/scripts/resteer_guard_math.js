// resteer_guard_math.js — resteer 配線のガード純粋核 (ドラフト, cycle0005-a03)
// 出典: cycle2350-a20 敵対監査 F-1/F-2/F-3 への是正。現行配線 (v0.5.35, main.js
// tickBranchMine の applyReSteer) は reSteerDir (survey_hint.js) の結果を無条件に
// 適用するため、次の詰み経路がある:
//   F-1: ヒント方向 W が blocked の元凶 → 90°回転して N → resteer が W へ戻す →
//        次 tick も W が blocked → … を無限反復。前方掘り経路には blocked/liquid の
//        累計時計が無く (unknown/hold/gate には 30 秒時計がある) 出口も無い。
//   F-2: surveyHintLoc が steerDecision の安全弁 (STEER_RADIUS=64 / 深度帯 ±8 /
//        到達判定) を迂回し、何百セル先のヒントへでも寄せ続ける。
// 本モジュールはその「適用してよいか」の判断だけを純粋関数化する。移動・掘削・
// 実世界読み取り・survey 走査は持たない (survey_hint.js / spiral.js と同型)。
// reSteerDir 自体は変更しない: 本核はその前段のガードであり、統括の統合時は
//   candidate = reSteerDir(pos, loc, rotatedDir) → decideResteer(...) → 適用/不適用
// の順で main.js 側が呼ぶ想定 (配線案は REPORT.md)。
//
// 仕様 (本サイクルの委任 4 項):
//   (1) 元凶方向への復帰禁止: resteer が設定しようとする方向 (＝blocked 回転を
//       経た後に resteer 適用まで進んだ場合の最終方向) が「直前に blocked だった
//       方向」と一致する場合は resteer を適用しない。回転結果 (rotatedDir) は
//       そのまま維持される。これが F-1 ループの 1 tick 目からの遮断になる。
//       ※用語: 「blocked 回転後の方向」は配線手順全体 (回転→resteer 適用) を
//       経た後の方向を指す。回転だけの結果は rotatedDir として別に渡し、
//       rotatedDir 自体が lastBlockedDir と一致する退化ケース (回転が効いて
//       いない) も同理由で不適用とする。
//   (2) 再 blocked カウンタ: 同一 leg で resteer 復帰 (適用) の後に、その復帰
//       方向のまま再び blocked/liquid したら resteer をその leg 中無効化する
//       (閾値既定 1 回)。(1) をすり抜ける経路 (螺旋出口の resteer 等、
//       lastBlockedDir と候補が一致しない形) への第二の防衛線。
//   (3) 終了保証: blocked/liquid の leg 単位累計が 30 秒を超えたら leg を畳む
//       出口の純粋判定。既存 holdUnknown/holdHeld/holdGateHeld と同型
//       (間隔 2 秒未満の tick だけ加算、所持数増加でリセット、>30000 で発火)
//       だが、キーはセルでなく leg のみ: blocked は毎回方向が回るため
//       セル/方向キーでは累計が永遠に育たない (F-1 の実測形そのもの)。
//       blocked と liquid は同一時計で合算する (交互に現れても出口が要る)。
//   (4) 距離・深度ガード (F-2 是正): ヒントまでの水平距離 > 64、または
//       ヒント/現在位置が深度帯 (leg.depth ±8) 外なら resteer しない。
//       定数は survey_hint.js の SURVEY_HINT (STEER_RADIUS / DEPTH_BAND /
//       ARRIVE_H) と同一値。判定の正は将来 steerDecision 側へ寄せる想定で、
//       ここでは値を複写し出典を明記する (二重定義の解消は統括の統合判断)。
//
// 純粋性・安全性の契約:
//   - @minecraft/server を import しない。c.x 等への参照を持たない。
//   - 例外を投げない (全関数 try/catch)。不正入力は「resteer しない /
//     畳まない / 状態据え置き」の安全側へ倒す (fail-closed for resteer)。
//   - 決定的: Math.random を使わない。Date.now も読まない — 時刻は呼び出し側が
//     now (ms) で注入し、欠落/不正なら dt=0 として加算しない。
//   - 入力を変更しない: 状態は常に新しいオブジェクトを返す (immutable reducer)。
//     呼び出し側は返り値を r 等へ代入し直すこと。
//   - 方向は tickBranchMine の mineDir 形 {x,z} (4 直交・成分は -1/0/1) のみを
//     有効とする。それ以外は不正方向として扱う。

export const RESTEER_GUARD = {
  STEER_RADIUS: 64,      // survey_hint.js SURVEY_HINT.STEER_RADIUS と同一値 (F-2)
  DEPTH_BAND: 8,         // survey_hint.js SURVEY_HINT.DEPTH_BAND と同一値 (F-2)
  ARRIVE_H: 1.5,         // survey_hint.js SURVEY_HINT.ARRIVE_H と同一値
  BLOCKED_LIMIT_MS: 30000, // holdUnknown/holdHeld/holdGateHeld の 30 秒と同一値 (仕様3)
  GAP_RESET_MS: 2000,    // 既存 30 秒時計群と同一: この間隔未満の tick だけ加算
  REBLOCK_LIMIT: 1,      // resteer 復帰後の再 blocked がこの回数で無効化 (仕様2)
};

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isDir = (d) =>
  !!d && typeof d === "object" && isNum(d.x) && isNum(d.z) &&
  ((Math.abs(d.x) === 1 && d.z === 0) || (d.x === 0 && Math.abs(d.z) === 1));
const copyDir = (d) => (isDir(d) ? { x: d.x, z: d.z } : null);

// 方向の一致判定 (不正方向同士は「一致」とみなさない: null は元凶方向ではない)。
export function dirEq(a, b) {
  try { return isDir(a) && isDir(b) && a.x === b.x && a.z === b.z; }
  catch { return false; }
}

// main.js 現行の 90° 回転 {x: d.z, z: -d.x} と同一。不正方向は null。
export function rotate90Dir(d) {
  try { return isDir(d) ? { x: d.z, z: -d.x } : null; }
  catch { return null; }
}

// leg の同一性キー。leg が変われば状態は別物 (呼び出し側が key を作る手間を核へ寄せる)。
// item/depth のどちらかでも欠ければ null (= leg を特定できない → ガード状態は使わない)。
export function legKeyOf(leg) {
  try {
    if (!leg || typeof leg !== "object") return null;
    const item = typeof leg.item === "string" ? leg.item : "";
    if (!item || !isNum(leg.depth)) return null;
    return `${item}@${leg.depth}`;
  } catch { return null; }
}

// ガード状態の初期値。legKey は legKeyOf の結果か同形式の文字列。
// 形: { legKey, disabled, resteerApplied, reblocked, pendingDir,
//       lastBlockedDir, clock: { totalMs, lastAt, count } }
// pendingDir: 直近に resteer で復帰した方向 (再 blocked 判定の照合先)。
// clock: 仕様 (3) の blocked/liquid 累計時計 (count は進捗リセット用の所持数)。
export function createGuardState(legKey) {
  return {
    legKey: typeof legKey === "string" && legKey ? legKey : null,
    disabled: false,
    resteerApplied: 0,
    reblocked: 0,
    pendingDir: null,
    lastBlockedDir: null,
    clock: { totalMs: 0, lastAt: null, count: null },
  };
}

// 状態が対象 leg のものか。違う leg の状態は初期値として読み替える (純粋: 元は不変)。
function stateFor(state, legKey) {
  const base = state && typeof state === "object" ? state : null;
  if (!base || base.legKey !== (typeof legKey === "string" ? legKey : null)) {
    return createGuardState(legKey);
  }
  // 欠けたフィールドは安全側で補ったコピーを返す (手書き/復元途中の状態でも例外にしない)
  return {
    legKey: base.legKey ?? null,
    disabled: base.disabled === true,
    resteerApplied: isNum(base.resteerApplied) ? base.resteerApplied : 0,
    reblocked: isNum(base.reblocked) ? base.reblocked : 0,
    pendingDir: copyDir(base.pendingDir),
    lastBlockedDir: copyDir(base.lastBlockedDir),
    clock: {
      totalMs: isNum(base.clock?.totalMs) ? base.clock.totalMs : 0,
      lastAt: isNum(base.clock?.lastAt) ? base.clock.lastAt : null,
      count: isNum(base.clock?.count) ? base.clock.count : null,
    },
  };
}

// 水平距離 (chooseHint の distH と同じく生座標の hypot。床丸めはしない)。
export function hintDistH(pos, hintLoc) {
  try {
    if (!pos || !hintLoc || !isNum(pos.x) || !isNum(pos.z) || !isNum(hintLoc.x) || !isNum(hintLoc.z)) return null;
    return Math.hypot(hintLoc.x - pos.x, hintLoc.z - pos.z);
  } catch { return null; }
}

// 深度帯判定 (survey_hint.js inDepthBand と同義。depth 不正なら帯で絞らない=true)。
export function inDepthBandY(y, depth, band = RESTEER_GUARD.DEPTH_BAND) {
  try {
    if (!isNum(depth)) return true;
    if (!isNum(y)) return false;
    const b = isNum(band) && band >= 0 ? band : RESTEER_GUARD.DEPTH_BAND;
    return Math.abs(y - depth) <= b;
  } catch { return false; }
}

// ── 仕様 (1)(2)(4): resteer 適用可否の純粋判定 ─────────────────────────────
// 入力: { pos, hintLoc, depth, rotatedDir, candidateDir, lastBlockedDir, state, legKey }
//   rotatedDir:   blocked 90° 回転の結果 (螺旋出口など回転を経ない発火点では curDir)
//   candidateDir: reSteerDir が返した dir (changed=false の場合は rotatedDir と同値で渡す想定。
//                 null/欠落は「候補なし」として不適用)
//   lastBlockedDir: 直前に blocked/liquid だった進行方向 (state 側にも保持するが、
//                 配線直後の 1 tick 目を確実に守るため入力でも受ける。優先順位は入力 > state)
//   state/legKey: createGuardState 系の状態とその leg キー
// 返り値: { apply:boolean, dir, reason, distH }
//   apply=true のとき dir は candidateDir のコピー。false のとき dir は rotatedDir の
//   コピー (= 回転結果を維持せよ、という配線への指示)。どちらも取れなければ null。
//   reason: "ok" | "same_as_blocked" | "disabled" | "too_far" |
//           "hint_out_of_depth_band" | "pos_out_of_depth_band" | "arrived" |
//           "no_candidate" | "bad_input"
// 判定順は固定 (決定的): bad_input → disabled → same_as_blocked → too_far →
// 深度帯 (hint→pos) → arrived → ok。手前ほど「構造的な禁止」を優先する。
export function decideResteer(input = {}) {
  try {
    const o = input && typeof input === "object" ? input : {};
    const rotated = copyDir(o.rotatedDir);
    const deny = (reason, extra = {}) => ({ apply: false, dir: rotated, reason, distH: null, ...extra });
    if (!o.pos || !isNum(o.pos.x) || !isNum(o.pos.y) || !isNum(o.pos.z) ||
        !o.hintLoc || !isNum(o.hintLoc.x) || !isNum(o.hintLoc.y) || !isNum(o.hintLoc.z)) {
      return deny("bad_input");
    }
    const candidate = copyDir(o.candidateDir);
    if (!candidate) return deny("no_candidate");
    const st = stateFor(o.state, o.legKey ?? o.state?.legKey ?? null);
    // legKey が明示され状態と食い違う場合は別 leg として読み替える (stateFor 済み)。
    // ただし入力 legKey と state.legKey の不一致は「新しい leg = 無効化を引き継がない」
    // が正であり、stateFor が初期状態を返すため disabled は自然に false になる。
    if (st.disabled) return deny("disabled");
    // (1) 元凶方向への復帰禁止: 候補が直前 blocked 方向と一致したら適用しない。
    const lastBlocked = copyDir(o.lastBlockedDir) || st.lastBlockedDir;
    if (dirEq(candidate, lastBlocked)) return deny("same_as_blocked");
    // 回転自体が効いていない退化ケース (rotated == lastBlocked) も resteer で
    // 動かさない: 現方向の維持も含め、この tick は回転系に委ねるのが安全。
    if (rotated && dirEq(rotated, lastBlocked) && !dirEq(candidate, rotated)) {
      return deny("same_as_blocked");
    }
    // (4) 距離ガード: STEER_RADIUS 超は steerDecision の too_far と同じく従来挙動へ。
    const distH = hintDistH(o.pos, o.hintLoc);
    if (distH == null) return deny("bad_input");
    if (distH > RESTEER_GUARD.STEER_RADIUS) return deny("too_far", { distH });
    // (4) 深度帯ガード: ヒントが帯外 / 自分が帯外のどちらでも寄せない。
    if (!inDepthBandY(o.hintLoc.y, o.depth)) return deny("hint_out_of_depth_band", { distH });
    if (!inDepthBandY(o.pos.y, o.depth)) return deny("pos_out_of_depth_band", { distH });
    // 到達近傍: steerDecision の arrived と同義。寄せる意味が無く、振動源になる。
    if (distH <= RESTEER_GUARD.ARRIVE_H) return deny("arrived", { distH });
    // 候補が回転結果と同一なら適用しても無変化だが、呼び出し側の記録を素直に
    // するため apply=true で返す (pendingDir の記録は recordResteerApplied 側の判断)。
    return { apply: true, dir: candidate, reason: "ok", distH };
  } catch { return { apply: false, dir: null, reason: "bad_input", distH: null }; }
}

// ── 仕様 (2): resteer 適用の記録 ───────────────────────────────────────────
// decideResteer が apply=true を返し、実際に mineDir を候補へ差し替えた直後に呼ぶ。
// rotatedDir と候補が同一 (無変化) の場合は pending を張らない (再 blocked を
// resteer の失敗と数えないため)。返り値: 新しい状態 (入力は不変)。
export function recordResteerApplied(state, legKey, appliedDir, rotatedDir) {
  try {
    const st = stateFor(state, legKey ?? state?.legKey ?? null);
    const dir = copyDir(appliedDir);
    if (!dir || dirEq(dir, rotatedDir)) return st;
    return { ...st, resteerApplied: st.resteerApplied + 1, pendingDir: dir };
  } catch { return createGuardState(null); }
}

// ── 仕様 (2)+(3): blocked/liquid 発生の記録と出口判定 ──────────────────────
// blocked/liquid の tick ごとに 1 回呼ぶ (回転・resteer 判定より前に呼ぶこと:
// 再 blocked による無効化を、その tick の decideResteer へ即反映させるため)。
// 入力 event: { legKey, dir, kind:"blocked"|"liquid", now, count }
//   dir: blocked になった時点の進行方向 (= 回転前の mineDir)
//   now: 注入時刻 ms (不正なら dt 加算なしで lastAt も進めない)
//   count: 対象アイテムの現在所持数 (進捗リセット用。不正ならリセット判定なし)
// 返り値: { state, shouldFold, disabledNow, totalMs, reason }
//   shouldFold: (3) 累計 > 30000ms で true。呼び出し側は leg を畳む。
//   disabledNow: この blocked で (2) の無効化が新たに発火したら true。
//   reason: "reblocked_after_resteer" | "blocked_limit" | null (両方ありうる場合は
//           "blocked_limit" を優先して返すが、disabledNow/shouldFold は独立に立つ)
export function recordBlocked(state, event = {}) {
  try {
    const ev = event && typeof event === "object" ? event : {};
    const st = stateFor(state, ev.legKey ?? state?.legKey ?? null);
    const kind = ev.kind === "blocked" || ev.kind === "liquid" ? ev.kind : null;
    if (!kind) return { state: st, shouldFold: false, disabledNow: false, totalMs: st.clock.totalMs, reason: null };
    const dir = copyDir(ev.dir);
    let next = { ...st, lastBlockedDir: dir || st.lastBlockedDir };
    // (2) resteer 復帰方向のまま再 blocked → カウンタ加算、閾値で無効化。
    let disabledNow = false;
    if (st.pendingDir && dir && dirEq(dir, st.pendingDir)) {
      const reblocked = st.reblocked + 1;
      const disabled = st.disabled || reblocked >= RESTEER_GUARD.REBLOCK_LIMIT;
      disabledNow = disabled && !st.disabled;
      next = { ...next, reblocked, disabled, pendingDir: null };
    }
    // (3) 累計時計: 既存 30 秒時計群と同型 (間隔 <2000ms の分だけ加算、
    //     所持数増加でリセット)。キーは leg のみ (方向で割らない)。
    const clock = { ...next.clock };
    if (isNum(ev.count)) {
      if (clock.count != null && ev.count > clock.count) clock.totalMs = 0;
      clock.count = ev.count;
    }
    if (isNum(ev.now)) {
      if (clock.lastAt != null && ev.now - clock.lastAt >= 0 && ev.now - clock.lastAt < RESTEER_GUARD.GAP_RESET_MS) {
        clock.totalMs += ev.now - clock.lastAt;
      }
      clock.lastAt = ev.now;
    }
    next = { ...next, clock };
    const shouldFold = clock.totalMs > RESTEER_GUARD.BLOCKED_LIMIT_MS;
    return {
      state: next,
      shouldFold,
      disabledNow,
      totalMs: clock.totalMs,
      reason: shouldFold ? "blocked_limit" : disabledNow ? "reblocked_after_resteer" : null,
    };
  } catch {
    return { state: createGuardState(null), shouldFold: false, disabledNow: false, totalMs: 0, reason: null };
  }
}

// ── 仕様 (3) 単体形: 時計だけを進める薄いラッパ ────────────────────────────
// recordBlocked の clock 部分だけを使いたい配線 (blocked 記録と分離したい場合) 用。
// state は createGuardState 形でなく { totalMs, lastAt, count } 単体でもよい。
export function tickBlockedClock(clock, event = {}) {
  try {
    const c = clock && typeof clock === "object" ? clock : {};
    const base = {
      totalMs: isNum(c.totalMs) ? c.totalMs : 0,
      lastAt: isNum(c.lastAt) ? c.lastAt : null,
      count: isNum(c.count) ? c.count : null,
    };
    const ev = event && typeof event === "object" ? event : {};
    if (ev.kind !== "blocked" && ev.kind !== "liquid") {
      return { clock: base, shouldFold: false, totalMs: base.totalMs };
    }
    const next = { ...base };
    if (isNum(ev.count)) {
      if (next.count != null && ev.count > next.count) next.totalMs = 0;
      next.count = ev.count;
    }
    if (isNum(ev.now)) {
      if (next.lastAt != null && ev.now - next.lastAt >= 0 && ev.now - next.lastAt < RESTEER_GUARD.GAP_RESET_MS) {
        next.totalMs += ev.now - next.lastAt;
      }
      next.lastAt = ev.now;
    }
    return { clock: next, shouldFold: next.totalMs > RESTEER_GUARD.BLOCKED_LIMIT_MS, totalMs: next.totalMs };
  } catch { return { clock: { totalMs: 0, lastAt: null, count: null }, shouldFold: false, totalMs: 0 }; }
}

// leg が畳まれた/差し替わったときの破棄判定 (純粋): 対象 leg の状態なら初期値を、
// 違う leg の状態ならそのまま返す。呼び出し側の掃除分岐を 1 行にするための補助。
export function resetGuardForLeg(state, legKey) {
  try {
    if (!state || typeof state !== "object") return createGuardState(legKey ?? null);
    return state.legKey === (legKey ?? null) ? createGuardState(state.legKey) : stateFor(state, state.legKey);
  } catch { return createGuardState(null); }
}
