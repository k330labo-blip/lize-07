// ownerfalltrack_math.js — 主人の小さな落下を目で追う追視 (持続追従)
// POLISH-ANIM-OWNERFALLTRACK-01 (純粋核ドラフト, cycle0033-a12・作り込み常設)
// 仕様の正: brain_parts/solutions/cycle0005-a12/REPORT.md §2 (発案・定数・検証方法)
// 本ファイルはドラフト置き場の自己完結版。統合時は BP/scripts/ownerfalltrack_math.js
// へ移す想定。共有ファイル (main.js / brain.js / all.js / manifest 等) は編集しない。
//
// 純粋モジュール: @minecraft/server を import しない。相対 import も持たない。
// 例外を投げない。時刻・座標・エンティティ参照を持たず全て引数で受ける。
// 乱数・Date.now を持たない (決定的)。真偽は厳密一致 (===true) のみ。
// 表示層のみ: 移動・経路・掘削ゲート・戦闘・発話・合流・救助には一切触らない。
// 戻り値は applyGaze 最下位への重畳値と r.lastOwnerFallTrack 記録以外へ
// 流さないことが統合条件。音・セリフ・粒子・新規ボーン・スキン変更はなし。
// gen_lize_model.py は実行禁止 (未実行)。
//
// 仕様 (cycle0005-a12 §2.3〜§2.4 の固定値):
// - 発火: 主人の落下距離が 3 以上 18 未満に達した辺でのみ。2.9 止まりは不発。
//   18 以上は行動ルール emg2_owner_fall_big/fatal の領域として不発・辺消費。
//   1 tick で 3 未満から 18 以上へ跳んだ場合も不発・辺消費 (大きな落下)。
// - 表示: 単発波形ではなく持続追従。落下中のみ主人方向への実角度へ寄せ、
//   追加ピッチは最大 +28 度 (下向き正) で頭打ち。追従上限 900ms (超えたら
//   落下継続中でも静かに終了し復帰相へ)。着地の辺で終了し 150ms で 0 へ戻る。
// - 冷却 8000ms (発火開始基準)。冷却中・抑制中の閾値到達はその落下エピソード
//   の辺を消費し、着地後・抑制解除後・冷却経過後に遅れて発火しない。
// - 三状態: ownerFalling が boolean でない (undefined/null 等) tick は
//   UNKNOWN として計測・辺・エピソードを一切進めない。fallDist が非有限の
//   tick も発火判定を進めない (辺を消費しない)。
// - 追従中に落下距離が 18 以上へ達したら追従を静かに終了し復帰相へ入る
//   (行動ルール側の領域へ表示を重ね続けない。本ドラフトの明示的解釈であり
//   統合時に統括確認を要する点として REPORT にも明記する)。
// - ヨー: 主人方向への相対ヨーを ±60 度で頭打ちにして寄せる (仕様はヨーの
//   上限値を定めていないため、CATCHSIGHT の ±50 より少し広い ±60 を
//   ドラフト値として置く。統合時に統括確認を要する)。
//
// 抑制 (いずれも ===true のときだけ。truthy な 1 等では倒さない):
//   suppressed / inCombat / combat / hurtRecent / selfFalling / falling /
//   flying / inWater / swimming / climbing / working / digging / attacking /
//   placing / hasWorkTarget / flinchActive / overlayActive
// 抑制は発火判定 (note) と表示 (current のその tick を 0 へ倒す) の両方に効く。
// current での抑制は追従そのものを終了させない (着地・上限・超過だけが終了)。
//
// 呼び出し順序 (統合時の feeder 契約): 毎 tick、noteOwnerfalltrack を先に
// 呼び、次に ownerfalltrackCurrent で重畳値を取る。note が辺・エピソード・
// 終了遷移を進め、current が表示値だけを計算する (current は表示キャッシュ
// lastPitchDeg/lastYawDeg のみを更新する)。

export const OWNERFALLTRACK_MIN_FALL = 3;        // 発火する最小落下距離
export const OWNERFALLTRACK_MAX_FALL = 18;       // これ以上は行動ルール側の領域
export const OWNERFALLTRACK_MAX_TRACK_MS = 900;  // 追従の上限
export const OWNERFALLTRACK_RETURN_MS = 150;     // 終了後に 0 へ戻る時間
export const OWNERFALLTRACK_COOLDOWN_MS = 8000;  // 冷却 (発火開始基準)
export const OWNERFALLTRACK_MAX_PITCH_DEG = 28;  // 追加ピッチの上限 (下向き正)
export const OWNERFALLTRACK_YAW_LIMIT_DEG = 60;  // 相対ヨーの頭打ち (ドラフト値)

export const OWNERFALLTRACK_CONSTANTS = Object.freeze({
  MIN_FALL: OWNERFALLTRACK_MIN_FALL,
  MAX_FALL: OWNERFALLTRACK_MAX_FALL,
  MAX_TRACK_MS: OWNERFALLTRACK_MAX_TRACK_MS,
  RETURN_MS: OWNERFALLTRACK_RETURN_MS,
  COOLDOWN_MS: OWNERFALLTRACK_COOLDOWN_MS,
  MAX_PITCH_DEG: OWNERFALLTRACK_MAX_PITCH_DEG,
  YAW_LIMIT_DEG: OWNERFALLTRACK_YAW_LIMIT_DEG,
});

export const OWNERFALLTRACK_REASONS = Object.freeze({
  FIRED: "fired",
  BELOW_MIN: "below_min",       // 落下中だが距離 3 未満 (辺はまだ消費しない)
  TOO_BIG: "too_big",           // 18 以上へ到達 (不発・辺消費)
  COOLDOWN: "cooldown",         // 冷却中の閾値到達 (不発・辺消費)
  SUPPRESSED: "suppressed",     // 抑制中の閾値到達 (不発・辺消費)
  CONSUMED: "consumed",         // この落下エピソードの辺は消費済み
  TRACKING: "tracking",         // 追従継続中
  LANDED: "landed",             // 着地の辺で追従終了 (復帰相へ)
  OVERSHOOT_END: "overshoot_end", // 追従中に 18 以上へ達し終了 (復帰相へ)
  TIMEOUT_END: "timeout_end",   // 追従上限 900ms で終了 (復帰相へ)
  NOT_FALLING: "not_falling",   // 落下していない
  UNKNOWN: "unknown",           // 観測が取れない (状態を進めない)
  BAD_INPUT: "bad_input",       // nowMs 等の必須入力が無効
});

function finiteOrNull(v) { return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function zeroCurrent(episode) {
  return { pitchDeg: 0, yawOffsetDeg: 0, active: false, episode: Number.isFinite(episode) ? episode : 0 };
}

export function wrapOwnerfalltrackYawDeg(deg) {
  try {
    if (!Number.isFinite(deg)) return deg;
    let d = ((deg + 180) % 360 + 360) % 360 - 180;
    if (d === -180) d = 180;
    return d;
  } catch { return deg; }
}

export function isOwnerfalltrackSuppressed(sample) {
  try {
    if (!sample || typeof sample !== "object") return false;
    if (sample.suppressed === true) return true;
    if (sample.inCombat === true || sample.combat === true || sample.hurtRecent === true) return true;
    if (sample.selfFalling === true || sample.falling === true || sample.flying === true) return true;
    if (sample.inWater === true || sample.swimming === true || sample.climbing === true) return true;
    if (sample.working === true || sample.digging === true || sample.attacking === true
      || sample.placing === true || sample.hasWorkTarget === true) return true;
    if (sample.flinchActive === true || sample.overlayActive === true) return true;
    return false;
  } catch { return false; }
}

export function ownerfalltrackDue(state, nowMs) {
  try {
    const n = finiteOrNull(nowMs);
    if (n === null) return false;
    if (!state || typeof state !== "object") return true;
    const last = finiteOrNull(state.lastFiredMs);
    if (last === null) return true;
    return n - last >= OWNERFALLTRACK_COOLDOWN_MS;
  } catch { return false; }
}

export function createOwnerfalltrackState() {
  return {
    tracking: false, startedAtMs: null, lastFiredMs: null, episode: 0,
    prevFalling: null, episodeConsumed: false, episodeFired: false,
    returnFromMs: null, returnPitchDeg: 0, returnYawDeg: 0,
    lastPitchDeg: 0, lastYawDeg: 0,
    firedCount: 0, lastReason: null, lastRecord: null,
  };
}

export function resetOwnerfalltrackState(state) {
  try {
    if (!state || typeof state !== "object") return state;
    Object.assign(state, createOwnerfalltrackState());
    return state;
  } catch { return state; }
}

function beginReturn(state, now) {
  state.tracking = false;
  state.startedAtMs = null;
  state.returnFromMs = now;
  state.returnPitchDeg = finiteOrNull(state.lastPitchDeg) ?? 0;
  state.returnYawDeg = finiteOrNull(state.lastYawDeg) ?? 0;
}

// noteOwnerfalltrack(state, sample, nowMs) -> { fired, reason }
// sample: { ownerFalling, fallDist, relPitchDeg?, relYawDeg?, ...抑制群, nowMs? }
// 毎 tick 呼ぶ前提。発火した tick だけ fired:true を返す。
export function noteOwnerfalltrack(state, sample, nowMsArg) {
  try {
    if (!state || typeof state !== "object") return { fired: false, reason: "bad_input" };
    if (!sample || typeof sample !== "object") {
      state.lastReason = "bad_input";
      return { fired: false, reason: "bad_input" };
    }
    const now = finiteOrNull(nowMsArg) !== null ? finiteOrNull(nowMsArg) : finiteOrNull(sample.nowMs);
    if (now === null) { state.lastReason = "bad_input"; return { fired: false, reason: "bad_input" }; }
    // UNKNOWN: ownerFalling が boolean でない tick は何も進めない
    if (sample.ownerFalling !== true && sample.ownerFalling !== false) {
      state.lastReason = "unknown";
      return { fired: false, reason: "unknown" };
    }
    const done = (reason) => {
      state.lastReason = reason;
      state.lastRecord = { atMs: now, fired: reason === "fired", reason, episode: state.episode };
      return { fired: reason === "fired", reason };
    };
    if (sample.ownerFalling === false) {
      const wasTracking = state.tracking === true;
      if (wasTracking) beginReturn(state, now);
      state.prevFalling = false;
      state.episodeConsumed = false;
      state.episodeFired = false;
      return done(wasTracking ? "landed" : "not_falling");
    }
    // ownerFalling === true
    if (state.prevFalling !== true) {
      state.episode = (Number.isFinite(state.episode) ? state.episode : 0) + 1;
      state.episodeConsumed = false;
      state.episodeFired = false;
    }
    state.prevFalling = true;
    const fallDist = finiteOrNull(sample.fallDist);
    if (state.tracking === true) {
      if (fallDist !== null && fallDist >= OWNERFALLTRACK_MAX_FALL) {
        beginReturn(state, now);
        state.episodeConsumed = true;
        return done("overshoot_end");
      }
      const started = finiteOrNull(state.startedAtMs);
      if (started !== null && now - started >= OWNERFALLTRACK_MAX_TRACK_MS) {
        // 上限到達: 復帰相の起点は started+900 に固定する (tick 間引きに依らない)
        state.tracking = false;
        state.startedAtMs = null;
        state.returnFromMs = started + OWNERFALLTRACK_MAX_TRACK_MS;
        state.returnPitchDeg = finiteOrNull(state.lastPitchDeg) ?? 0;
        state.returnYawDeg = finiteOrNull(state.lastYawDeg) ?? 0;
        return done("timeout_end");
      }
      return done("tracking");
    }
    if (state.episodeConsumed === true || state.episodeFired === true) return done("consumed");
    if (fallDist === null) { state.lastReason = "unknown"; return { fired: false, reason: "unknown" }; }
    if (fallDist >= OWNERFALLTRACK_MAX_FALL) { state.episodeConsumed = true; return done("too_big"); }
    if (fallDist < OWNERFALLTRACK_MIN_FALL) return done("below_min");
    // 閾値到達の辺: 抑制・冷却なら消費して不発
    if (isOwnerfalltrackSuppressed(sample)) { state.episodeConsumed = true; return done("suppressed"); }
    if (!ownerfalltrackDue(state, now)) { state.episodeConsumed = true; return done("cooldown"); }
    state.tracking = true;
    state.startedAtMs = now;
    state.lastFiredMs = now;
    state.episodeFired = true;
    state.returnFromMs = null;
    state.returnPitchDeg = 0;
    state.returnYawDeg = 0;
    state.lastPitchDeg = 0;
    state.lastYawDeg = 0;
    state.firedCount = (Number.isFinite(state.firedCount) ? state.firedCount : 0) + 1;
    return done("fired");
  } catch { return { fired: false, reason: "bad_input" }; }
}

// ownerfalltrackCurrent(state, sample, nowMs)
//   -> { pitchDeg, yawOffsetDeg, active, episode }
// 追従中は sample の主人相対角へ寄せた値を返し表示キャッシュを更新する。
// 復帰相 (着地・上限・超過の後 150ms) は線形に 0 へ戻る。非アクティブ・
// 不正入力・抑制中の tick は全て 0 (残留なし)。
export function ownerfalltrackCurrent(state, sample, nowMsArg) {
  try {
    if (!state || typeof state !== "object") return zeroCurrent(0);
    const now = finiteOrNull(nowMsArg) !== null ? finiteOrNull(nowMsArg)
      : finiteOrNull(sample?.nowMs);
    if (now === null) return zeroCurrent(state.episode);
    if (sample && typeof sample === "object" && isOwnerfalltrackSuppressed(sample)) {
      return zeroCurrent(state.episode);
    }
    if (state.tracking === true) {
      const started = finiteOrNull(state.startedAtMs);
      if (started === null) return zeroCurrent(state.episode);
      const e = now - started;
      if (e < 0) return zeroCurrent(state.episode);
      if (e >= OWNERFALLTRACK_MAX_TRACK_MS) {
        // note を経ずに上限へ達した場合の復帰相 (起点 started+900 で同じ形)
        const re = now - (started + OWNERFALLTRACK_MAX_TRACK_MS);
        if (re >= OWNERFALLTRACK_RETURN_MS) return zeroCurrent(state.episode);
        const k = 1 - re / OWNERFALLTRACK_RETURN_MS;
        return {
          pitchDeg: (finiteOrNull(state.lastPitchDeg) ?? 0) * k,
          yawOffsetDeg: (finiteOrNull(state.lastYawDeg) ?? 0) * k,
          active: k > 0, episode: state.episode,
        };
      }
      const relPitch = finiteOrNull(sample?.relPitchDeg);
      const relYaw = finiteOrNull(sample?.relYawDeg);
      const pitch = relPitch === null ? (finiteOrNull(state.lastPitchDeg) ?? 0)
        : clamp(relPitch, -OWNERFALLTRACK_MAX_PITCH_DEG, OWNERFALLTRACK_MAX_PITCH_DEG);
      const yaw = relYaw === null ? (finiteOrNull(state.lastYawDeg) ?? 0)
        : clamp(wrapOwnerfalltrackYawDeg(relYaw), -OWNERFALLTRACK_YAW_LIMIT_DEG, OWNERFALLTRACK_YAW_LIMIT_DEG);
      state.lastPitchDeg = pitch === 0 ? 0 : pitch;
      state.lastYawDeg = yaw === 0 ? 0 : yaw;
      return { pitchDeg: state.lastPitchDeg, yawOffsetDeg: state.lastYawDeg, active: true, episode: state.episode };
    }
    const rf = finiteOrNull(state.returnFromMs);
    if (rf !== null) {
      const re = now - rf;
      if (re < 0 || re >= OWNERFALLTRACK_RETURN_MS) return zeroCurrent(state.episode);
      const k = 1 - re / OWNERFALLTRACK_RETURN_MS;
      const p = (finiteOrNull(state.returnPitchDeg) ?? 0) * k;
      const y = (finiteOrNull(state.returnYawDeg) ?? 0) * k;
      return { pitchDeg: p === 0 ? 0 : p, yawOffsetDeg: y === 0 ? 0 : y, active: k > 0 && (p !== 0 || y !== 0), episode: state.episode };
    }
    return zeroCurrent(state.episode);
  } catch { return { pitchDeg: 0, yawOffsetDeg: 0, active: false, episode: 0 }; }
}

export function isOwnerfalltrackActive(state, nowMs) {
  try {
    if (!state || typeof state !== "object" || state.tracking !== true) return false;
    const s = finiteOrNull(state.startedAtMs), n = finiteOrNull(nowMs);
    if (s === null || n === null) return false;
    const e = n - s;
    return e >= 0 && e < OWNERFALLTRACK_MAX_TRACK_MS;
  } catch { return false; }
}

// --- 自己テスト (仕様 §2.6 の単体ハーネス項目に対応) ---
export function runOwnerfalltrackSelfTests() {
  let pass = 0; const failures = [];
  const ok = (c, n) => { if (c) pass++; else failures.push(n); };
  const near = (a, b, eps = 1e-9) => typeof a === "number" && Math.abs(a - b) <= eps;
  try {
    const fall = (over = {}) => ({ ownerFalling: true, fallDist: 5, relPitchDeg: 40, relYawDeg: 20, ...over });
    const land = (over = {}) => ({ ownerFalling: false, fallDist: 0, relPitchDeg: 0, relYawDeg: 0, ...over });

    // 定数 (仕様 §2.4 の固定値)
    ok(OWNERFALLTRACK_MIN_FALL === 3 && OWNERFALLTRACK_MAX_FALL === 18, "F-01 min/max fall");
    ok(OWNERFALLTRACK_MAX_TRACK_MS === 900 && OWNERFALLTRACK_RETURN_MS === 150, "F-02 track/return ms");
    ok(OWNERFALLTRACK_COOLDOWN_MS === 8000 && OWNERFALLTRACK_MAX_PITCH_DEG === 28, "F-03 cooldown/pitch");
    ok(Object.isFrozen(OWNERFALLTRACK_CONSTANTS) && Object.isFrozen(OWNERFALLTRACK_REASONS), "F-04 frozen");

    // §2.6-1: 距離3到達で発火1回、ピッチは +28 で頭打ち、着地で150ms以内に完全な0
    {
      const st = createOwnerfalltrackState();
      ok(noteOwnerfalltrack(st, fall({ fallDist: 1 }), 0).reason === "below_min" && st.firedCount === 0, "F-05 below min no fire");
      const r = noteOwnerfalltrack(st, fall({ fallDist: 3 }), 50);
      ok(r.fired === true && r.reason === "fired" && st.firedCount === 1 && st.episode === 1, "F-06 fires at dist 3");
      const cur = ownerfalltrackCurrent(st, fall(), 100);
      ok(cur.active === true && cur.pitchDeg === 28 && cur.yawOffsetDeg === 20, "F-07 pitch capped at +28, yaw follows");
      ok(noteOwnerfalltrack(st, fall(), 150).reason === "tracking", "F-08 tracking continues");
      ok(noteOwnerfalltrack(st, land(), 200).reason === "landed", "F-09 landed ends tracking");
      const mid = ownerfalltrackCurrent(st, land(), 275);
      ok(near(mid.pitchDeg, 14) && near(mid.yawOffsetDeg, 10), "F-10 return halfway at 75ms");
      const end = ownerfalltrackCurrent(st, land(), 350);
      ok(end.active === false && end.pitchDeg === 0 && end.yawOffsetDeg === 0, "F-11 exact zero at 150ms after landing");
      ok(ownerfalltrackCurrent(st, land(), 10000).pitchDeg === 0, "F-12 no residue later");
    }
    // §2.6-2: 2.9止まり / 18以上 / 落下なし は不発 (18以上は辺消費)
    {
      const st = createOwnerfalltrackState();
      noteOwnerfalltrack(st, fall({ fallDist: 2.9 }), 0);
      noteOwnerfalltrack(st, land(), 100);
      ok(st.firedCount === 0, "F-13 dist 2.9 never fires");
      const st2 = createOwnerfalltrackState();
      ok(noteOwnerfalltrack(st2, fall({ fallDist: 18 }), 0).reason === "too_big" && st2.firedCount === 0, "F-14 dist 18 too_big");
      ok(noteOwnerfalltrack(st2, fall({ fallDist: 10 }), 50).reason === "consumed" && st2.firedCount === 0, "F-15 too_big consumes episode");
      const st3 = createOwnerfalltrackState();
      ok(noteOwnerfalltrack(st3, fall({ fallDist: 25 }), 0).reason === "too_big", "F-16 jump straight past 18 also too_big");
      const st4 = createOwnerfalltrackState();
      for (let t = 0; t < 5; t++) noteOwnerfalltrack(st4, land(), t * 100);
      ok(st4.firedCount === 0 && st4.episode === 0, "F-17 no fall no fire, no episode");
    }
    // §2.6-3: 冷却8秒内は初回のみ、経過後の新落下で再発火
    {
      const st = createOwnerfalltrackState();
      noteOwnerfalltrack(st, fall(), 0); noteOwnerfalltrack(st, land(), 300);
      ok(noteOwnerfalltrack(st, fall(), 1000).reason === "cooldown" && st.firedCount === 1, "F-18 cooldown consumes second fall");
      noteOwnerfalltrack(st, land(), 1300);
      ok(noteOwnerfalltrack(st, fall(), 7999).reason === "cooldown" && st.firedCount === 1, "F-19 still cooldown at 7999");
      noteOwnerfalltrack(st, land(), 8100 - 100);
      ok(noteOwnerfalltrack(st, fall(), 8000).fired === true && st.firedCount === 2, "F-20 refires at +8000");
      ok(ownerfalltrackDue(createOwnerfalltrackState(), 0) === true && ownerfalltrackDue(st, 15999) === false && ownerfalltrackDue(st, 16000) === true, "F-21 due boundary");
    }
    // §2.6-4: 抑制中の落下は不発・辺消費・遅れ発火なし (全キー ===true のみ)
    {
      for (const key of ["suppressed", "inCombat", "selfFalling", "flying", "inWater", "climbing", "digging", "flinchActive"]) {
        const st = createOwnerfalltrackState();
        ok(noteOwnerfalltrack(st, fall({ [key]: true }), 0).reason === "suppressed" && st.firedCount === 0, `F-22 suppress ${key}`);
        noteOwnerfalltrack(st, fall(), 100);
        ok(st.firedCount === 0, `F-23 no delayed fire after ${key}`);
        noteOwnerfalltrack(st, land(), 200);
      }
      const st = createOwnerfalltrackState();
      ok(noteOwnerfalltrack(st, fall({ digging: 1, suppressed: "yes" }), 0).fired === true, "F-24 suppression strict-true only");
    }
    // §2.6-5: UNKNOWN 区間は計測・辺を進めず、復帰後に誤発火しない
    {
      const st = createOwnerfalltrackState();
      noteOwnerfalltrack(st, fall({ fallDist: 2 }), 0);
      const u = noteOwnerfalltrack(st, { ownerFalling: undefined, fallDist: 99 }, 50);
      ok(u.reason === "unknown" && st.episode === 1 && st.firedCount === 0, "F-25 unknown does not advance");
      ok(noteOwnerfalltrack(st, { ownerFalling: null, fallDist: 99 }, 60).reason === "unknown", "F-26 null is unknown");
      ok(noteOwnerfalltrack(st, fall({ fallDist: 2.5 }), 100).reason === "below_min" && st.firedCount === 0, "F-27 no spurious fire after unknown");
      ok(noteOwnerfalltrack(st, fall({ fallDist: NaN }), 150).reason === "unknown" && st.episodeConsumed === false, "F-28 NaN fallDist unknown, edge kept");
      ok(noteOwnerfalltrack(st, fall({ fallDist: 4 }), 200).fired === true, "F-29 fires when dist truly reaches band");
    }
    // §2.6-6: 900msを超える落下 (18未満) は上限で静かに終了し残留しない
    {
      const st = createOwnerfalltrackState();
      noteOwnerfalltrack(st, fall(), 0);
      ownerfalltrackCurrent(st, fall(), 400);
      ok(isOwnerfalltrackActive(st, 899) === true && isOwnerfalltrackActive(st, 900) === false, "F-30 active window 900ms");
      ok(noteOwnerfalltrack(st, fall({ fallDist: 10 }), 950).reason === "timeout_end", "F-31 timeout ends tracking");
      const mid = ownerfalltrackCurrent(st, fall({ fallDist: 10 }), 975);
      ok(near(mid.pitchDeg, 14), "F-32 timeout return halfway (start fixed at 900)");
      const end = ownerfalltrackCurrent(st, fall({ fallDist: 10 }), 1050);
      ok(end.active === false && end.pitchDeg === 0 && end.yawOffsetDeg === 0, "F-33 timeout exact zero, no residue");
      ok(noteOwnerfalltrack(st, fall({ fallDist: 10 }), 1100).reason === "consumed", "F-34 same episode does not refire after timeout");
    }
    // 追従中に 18 以上へ到達したら終了 (overshoot)
    {
      const st = createOwnerfalltrackState();
      noteOwnerfalltrack(st, fall(), 0);
      ownerfalltrackCurrent(st, fall(), 100);
      ok(noteOwnerfalltrack(st, fall({ fallDist: 18 }), 200).reason === "overshoot_end" && st.tracking === false, "F-35 overshoot ends tracking");
      ok(ownerfalltrackCurrent(st, fall({ fallDist: 20 }), 350).pitchDeg === 0, "F-36 overshoot return completes");
    }
    // current の抑制はその tick だけ 0 (追従自体は終わらない)、角度の追従とクランプ
    {
      const st = createOwnerfalltrackState();
      noteOwnerfalltrack(st, fall(), 0);
      ok(ownerfalltrackCurrent(st, fall({ digging: true }), 100).pitchDeg === 0, "F-37 suppressed tick shows zero");
      const cur = ownerfalltrackCurrent(st, fall({ relPitchDeg: -50, relYawDeg: 200 }), 150);
      ok(cur.pitchDeg === -28 && cur.yawOffsetDeg === -60, "F-38 pitch/yaw clamps (yaw wraps 200->-160->-60)");
      ok(wrapOwnerfalltrackYawDeg(190) === -170 && wrapOwnerfalltrackYawDeg(-180) === 180, "F-39 yaw wrap helper");
      const hold = ownerfalltrackCurrent(st, { ownerFalling: true, fallDist: 6 }, 200);
      ok(hold.pitchDeg === -28 && hold.active === true, "F-40 missing angles hold last offsets");
    }
    // 入力異常・決定的・reset
    {
      ok(noteOwnerfalltrack(null, fall(), 0).fired === false && noteOwnerfalltrack(createOwnerfalltrackState(), null, 0).reason === "bad_input", "F-41 null safe");
      ok(noteOwnerfalltrack(createOwnerfalltrackState(), fall(), NaN).reason === "bad_input", "F-42 NaN now bad_input");
      ok(ownerfalltrackCurrent(null, fall(), 0).active === false && ownerfalltrackCurrent(createOwnerfalltrackState(), fall(), NaN).pitchDeg === 0, "F-43 current null/NaN safe");
      const run = () => {
        const st = createOwnerfalltrackState(); const out = [];
        const seq = [[fall({ fallDist: 1 }), 0], [fall(), 50], [fall(), 100], [land(), 200], [fall(), 1000], [land(), 1200], [fall(), 9000]];
        for (const [s, t] of seq) out.push(noteOwnerfalltrack(st, s, t).reason);
        return out.join(",");
      };
      ok(run() === run() && run() === "below_min,fired,tracking,landed,cooldown,not_falling,fired", "F-44 deterministic sequence");
      const st = createOwnerfalltrackState();
      noteOwnerfalltrack(st, fall(), 0);
      resetOwnerfalltrackState(st);
      ok(st.tracking === false && st.firedCount === 0 && st.episode === 0 && ownerfalltrackCurrent(st, fall(), 10).active === false, "F-45 reset");
    }
  } catch (e) {
    failures.push("F-XX self-test threw: " + (e && e.message ? e.message : String(e)));
  }
  return { pass, fail: failures.length, failures };
}

// 直接実行時のみ自己テストを回す (import 時は副作用なし)。
try {
  const isMain = typeof process !== "undefined" && Array.isArray(process.argv)
    && typeof process.argv[1] === "string" && import.meta.url.endsWith(process.argv[1].split("/").pop());
  if (isMain) {
    const r = runOwnerfalltrackSelfTests();
    console.log(`ownerfalltrack_math_draft: ${r.pass} passed, ${r.fail} failed`);
    for (const f of r.failures) console.log("FAIL", f);
    if (typeof process !== "undefined") process.exitCode = r.fail ? 1 : 0;
  }
} catch { /* 自己テストの表示失敗は本体の契約に影響させない */ }
