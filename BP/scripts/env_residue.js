// env_residue.js — 環境残留表現 POLISH-FX-ENVRESIDUE-01 (統合準備ドラフト, cycle0942-a07)
// 出典: brain_parts/solutions/cycle0922-a17-polish/DRAFT.md §2 (発案・設計の正)
// 純粋モジュール: @minecraft/server を import しない。例外を投げない。
// 表示層のみ: 移動・掘削ゲート・作業判定・速度には一切触らない。
//
// 統合時: 本ファイルを無変更で BP/scripts/env_residue.js へコピーする。
// パーティクル ID は未照合のため particleId は null 占位のままにする。
// null の媒体は emit しても spawnParticle を呼ばない (虚偽の見た目を作らない)。
// 照合済み ID が得られた媒体だけ、統合担当が particleId を文字列へ差し替える。

// ---------------------------------------------------------------------------
// 減衰プロファイル (DRAFT §2.2 の数値が正。変更はこの表だけ)
// particleId: null = 未照合・無効。断定しない。
// ---------------------------------------------------------------------------
export const RESIDUE_PROFILES = Object.freeze({
  water: Object.freeze({
    durationMs: 3000,
    firstIntervalMs: 200,
    lastIntervalMs: 900,
    particleId: null,
  }),
  powder_snow: Object.freeze({
    durationMs: 1500,
    firstIntervalMs: 250,
    lastIntervalMs: 700,
    particleId: null,
  }),
});

export const RESIDUE_MEDIUMS = Object.freeze(Object.keys(RESIDUE_PROFILES));

// medium が残留対象か (文字列以外・未知は false)。例外を投げない。
export function isResidueMedium(medium) {
  try {
    return typeof medium === "string" &&
      Object.prototype.hasOwnProperty.call(RESIDUE_PROFILES, medium);
  } catch {
    return false;
  }
}

// 媒体のパーティクル ID。未照合なら null (呼び出し側は null なら出さない)。
export function residueParticleId(medium) {
  try {
    if (!isResidueMedium(medium)) return null;
    const id = RESIDUE_PROFILES[medium].particleId;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

function finiteOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// ---------------------------------------------------------------------------
// residueStep(medium, elapsedMs) -> { emit, intervalMs }
// 純粋関数。elapsedMs は「媒体を出た辺」からの経過時間。
// - 間隔は firstIntervalMs -> lastIntervalMs へ線形に広がる (減衰)。
// - elapsedMs >= durationMs で emit=false (終了)。
// - 入力異常 (未知 medium / 非数 / NaN / 負値の非有限) は例外なく emit=false。
//   負値は 0 にクランプする (時計の巻き戻しで暴走させない)。
// - 終了時の intervalMs は lastIntervalMs を返す (ログ・テスト用に安定させる)。
// ---------------------------------------------------------------------------
export function residueStep(medium, elapsedMs) {
  try {
    if (!isResidueMedium(medium)) return { emit: false, intervalMs: 0 };
    const p = RESIDUE_PROFILES[medium];
    const e = finiteOrNull(elapsedMs);
    if (e === null) return { emit: false, intervalMs: 0 };
    const elapsed = Math.max(0, e);
    if (elapsed >= p.durationMs) return { emit: false, intervalMs: p.lastIntervalMs };
    const t = p.durationMs > 0 ? elapsed / p.durationMs : 1;
    const intervalMs = p.firstIntervalMs + (p.lastIntervalMs - p.firstIntervalMs) * t;
    return { emit: true, intervalMs };
  } catch {
    return { emit: false, intervalMs: 0 };
  }
}

// ---------------------------------------------------------------------------
// 状態 (呼び出し側が保持する plain object。関数は入力 state を変更しない)
//   medium:       現在表示中の残留媒体 (null = 残留なし)
//   startedAtMs:  残留を開始した時刻 (残留なしは null)
//   lastEmitMs:   最後に emit した時刻 (未 emit は null)
//   insideMedium: 現在身を置いている媒体 (null = 媒体外)
// ---------------------------------------------------------------------------
export function createResidueState() {
  return { medium: null, startedAtMs: null, lastEmitMs: null, insideMedium: null };
}

// 任意の値から安全な状態へ正規化する (壊れた state でも例外を投げない)。
function normalizeState(state) {
  try {
    if (!state || typeof state !== "object") return createResidueState();
    return {
      medium: isResidueMedium(state.medium) ? state.medium : null,
      startedAtMs: finiteOrNull(state.startedAtMs),
      lastEmitMs: finiteOrNull(state.lastEmitMs),
      insideMedium: isResidueMedium(state.insideMedium) ? state.insideMedium : null,
    };
  } catch {
    return createResidueState();
  }
}

// 媒体へ入ったことを明示的に記録したい統合側向けの開始/取消ヘルパー。
// 媒体内では残留を出さない (DRAFT §2.1 の統一規則)。
export function enterMedium(state, medium) {
  const s = normalizeState(state);
  if (!isResidueMedium(medium)) return { ...s, insideMedium: null };
  return { medium: null, startedAtMs: null, lastEmitMs: null, insideMedium: medium };
}

// ---------------------------------------------------------------------------
// residueTick(state, insideMediumNow, nowMs)
//   -> { state, emit, medium, intervalMs, particleId }
// 1 tick 分の統合入口。辺検出・再計時・間隔ゲートをここに閉じ込める。
// - insideMediumNow: この tick に身を置いている媒体 ("water"|"powder_snow"|null|他)
// - 媒体内: 残留は出さず、insideMedium だけ記録する (emit=false)。
// - 媒体内 -> 媒体外の辺: その媒体で残留を開始し、初回は即 emit する。
// - 残留中: residueStep の間隔を満たした tick だけ emit=true (1 tick 最大1回)。
// - durationMs 超過で残留を終了し state を空に戻す (残り続けない)。
// - 媒体を直接切り替えた場合 (water 内 -> powder_snow 内) は残留を挟まず、
//   最後にいた媒体で出た辺から計時する。
// - nowMs が非数/NaN の場合は何も進めず emit=false で現状態を返す。
// - nowMs が startedAtMs より小さい (時計巻き戻し) 場合は経過 0 として扱う。
// ---------------------------------------------------------------------------
export function residueTick(state, insideMediumNow, nowMs) {
  try {
    const prev = normalizeState(state);
    const now = finiteOrNull(nowMs);
    if (now === null) {
      return { state: prev, emit: false, medium: prev.medium, intervalMs: 0, particleId: null };
    }
    const inside = isResidueMedium(insideMediumNow) ? insideMediumNow : null;

    // 媒体内: 残留は出さない。入っていた媒体だけ覚える。
    if (inside !== null) {
      return {
        state: { medium: null, startedAtMs: null, lastEmitMs: null, insideMedium: inside },
        emit: false, medium: null, intervalMs: 0, particleId: null,
      };
    }

    let cur = prev;
    // 出た辺: 直前まで媒体内にいて、まだ残留が始まっていない。
    if (cur.insideMedium !== null && cur.medium === null) {
      cur = {
        medium: cur.insideMedium, startedAtMs: now, lastEmitMs: null, insideMedium: null,
      };
    }
    if (cur.medium === null || cur.startedAtMs === null) {
      return {
        state: { ...cur, insideMedium: null },
        emit: false, medium: null, intervalMs: 0, particleId: null,
      };
    }

    const elapsed = Math.max(0, now - cur.startedAtMs);
    const step = residueStep(cur.medium, elapsed);
    if (!step.emit) {
      return {
        state: createResidueState(),
        emit: false, medium: null, intervalMs: step.intervalMs, particleId: null,
      };
    }
    // 間隔ゲート: 前回 emit から intervalMs 未満なら出さない。
    if (cur.lastEmitMs !== null && now - cur.lastEmitMs < step.intervalMs) {
      return {
        state: cur, emit: false, medium: cur.medium,
        intervalMs: step.intervalMs, particleId: residueParticleId(cur.medium),
      };
    }
    return {
      state: { ...cur, lastEmitMs: now },
      emit: true, medium: cur.medium,
      intervalMs: step.intervalMs, particleId: residueParticleId(cur.medium),
    };
  } catch {
    return { state: createResidueState(), emit: false, medium: null, intervalMs: 0, particleId: null };
  }
}

// ---------------------------------------------------------------------------
// emitResidueParticle(dimension, location, medium) -> boolean
// 統合側の薄い発射ヘルパー。dimension は注入される (sfx.js と同じ流儀)。
// - particleId が null (未照合) の媒体は spawnParticle を呼ばず false。
// - dimension/location 異常・spawnParticle の例外は全て握って false。
// ---------------------------------------------------------------------------
export function emitResidueParticle(dimension, location, medium) {
  try {
    const id = residueParticleId(medium);
    if (id === null) return false;
    if (!dimension || typeof dimension.spawnParticle !== "function") return false;
    if (!location || !Number.isFinite(location.x) ||
        !Number.isFinite(location.y) || !Number.isFinite(location.z)) return false;
    dimension.spawnParticle(id, location);
    return true;
  } catch {
    return false;
  }
}
