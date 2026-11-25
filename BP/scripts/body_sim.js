// body_sim.js — リゼ (LIZE-07) の「体」: SimulatedPlayer (模擬プレイヤー) で歩かせる。v0.4.70
//
// これまでのリゼは、独自エンティティをスクリプトから瞬間移動の連続で動かしていたため、物理・当たり判定・
// 経路探索を自前で作り直す必要があり、埋まる・段差で滑る・葉の上で詰まる等の不具合が続いた。
// ここでは、本物のプレイヤーと同じ物理で動く模擬プレイヤー (@minecraft/server-gametest、ベータ API) を
// 透明な「体」にして、経路探索 (navigateToLocation) で歩かせる。リゼのモデル (見た目) は毎回その位置に重ねる。
//
// 役割分担:
//   - 脳 (main.js): これまで通り r.target (行き先) を決める。掘る・置く・会話も従来の処理。
//   - 体 (ここ): r.target へ歩く。経路が無い場所 (水や崖越え・地下) では従来の飛行/トンネル処理に任せ、
//     体はリゼの位置へ追従する。
//   - 同期: どちらが最後に動いたかで向きを決める。脳がリゼを瞬間移動させた (トンネル・呼び寄せ等) なら体を
//     そこへ移し、そうでなければリゼを体の位置へ重ねる。
//
// 必要条件: ワールドで「ベータ API」が有効、manifest に @minecraft/server-gametest (1.0.0-beta)。

export const BODY = {
  TAG: "lize_body",
  NAME: "LIZE-07",
  NAV_REISSUE_MS: 2500,      // 同じ行き先でも、この間隔で経路を引き直す (地形の変化・押し出し対策)
  ARRIVE_H: 1.2,             // 水平距離がこれ以内なら到着 (歩くのを止める)
  ARRIVE_V: 2.0,
  NO_PROGRESS_MS: 4000,      // この間、行き先へ近づけなければ従来の移動 (飛行) に切り替える
  FALLBACK_MS: 6000,         // 従来の移動に任せる時間
  LOGIC_MOVE_EPS: 0.6,       // 脳がリゼを動かしたとみなす距離
  EFFECT_REFRESH_MS: 20000,  // 透明・無敵などの効果を掛け直す間隔
  RESPAWN_RETRY_MS: 5000,
  FAR_LEGACY: 24,            // 行き先がこれより遠い (水平) 間は従来の飛行で速く移動し、近くでは体で歩く
};

const EFFECTS = [
  ["invisibility", 0], ["resistance", 4], ["saturation", 0], ["fire_resistance", 0], ["water_breathing", 0],
];

// gt: @minecraft/server-gametest の名前空間、mc: @minecraft/server の名前空間
export function createBodyManager(gt, mc, hooks = {}) {
  const log = hooks.noteFail || (() => {});
  const available = !!(gt && typeof gt.spawnSimulatedPlayer === "function");

  function valid(sim) { try { return !!sim && sim.isValid !== false && (typeof sim.isValid !== "function" || sim.isValid()); } catch { return false; } }
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  function applyEffects(sim) {
    for (const [id, amp] of EFFECTS) { try { sim.addEffect(id, 20 * 60 * 10, { amplifier: amp, showParticles: false }); } catch {} }
  }

  function spawn(bot, r) {
    if (!available) return null;
    const now = Date.now();
    if (r.bodySpawnFailAt && now - r.bodySpawnFailAt < BODY.RESPAWN_RETRY_MS) return null;
    try {
      const gm = (mc.GameMode && (mc.GameMode.Survival ?? mc.GameMode.survival)) ?? "Survival";
      const loc = bot.location;
      const sim = gt.spawnSimulatedPlayer({ dimension: bot.dimension, x: loc.x, y: loc.y, z: loc.z }, BODY.NAME, gm);
      try { sim.addTag(BODY.TAG); } catch {}
      try { sim.nameTag = ""; } catch {}
      applyEffects(sim);
      r.body = { sim, effectsAt: now, navKey: "", navAt: 0, fallbackUntil: 0, bestD: Infinity, bestAt: now, sync: { ...loc }, dim: bot.dimension.id };
      return r.body;
    } catch (err) { r.bodySpawnFailAt = now; log(bot, "body:spawn_failed", err); return null; }
  }

  function release(r) {
    const b = r.body; r.body = null;
    if (!b) return;
    try { b.sim.stopMoving(); } catch {}
    try { b.sim.disconnect(); } catch {}
  }

  // 体が拾ったアイテムはリゼの持ち物へ移す (入りきらない分は体の足元へ落とす)
  function moveLoot(bot, b, botContainer) {
    let sc = null; try { sc = b.sim.getComponent("minecraft:inventory")?.container; } catch {}
    if (!sc || !botContainer) return;
    for (let i = 0; i < sc.size; i++) {
      let it = null; try { it = sc.getItem(i); } catch {}
      if (!it) continue;
      let rest = null; try { rest = botContainer.addItem(it); } catch { continue; }
      try { sc.setItem(i, undefined); } catch {}
      if (rest) { try { bot.dimension.spawnItem(rest, bot.location); } catch {} }
    }
  }

  // 移動ループ (2tick ごと) から呼ぶ。戻り値: "body" = 体で動かした (従来の移動は飛ばす)、"legacy" = 従来の移動に任せる
  function tick(bot, r, opts = {}) {
    if (!available) return "legacy";
    let b = r.body;
    if (b && !valid(b.sim)) { r.body = null; b = null; }
    if (!b) b = spawn(bot, r);
    if (!b) return "legacy";
    const sim = b.sim, now = Date.now();
    if (now - b.effectsAt > BODY.EFFECT_REFRESH_MS) { applyEffects(sim); b.effectsAt = now; }
    try { if (opts.container) moveLoot(bot, b, opts.container); } catch {}

    // 1) 同期の向き: 脳がリゼを瞬間移動させた (次元の移動を含む) なら、体をそこへ移す
    const lz = bot.location;
    const sameDim = (() => { try { return sim.dimension.id === bot.dimension.id; } catch { return false; } })();
    if (!sameDim || d3(lz, b.sync) > BODY.LOGIC_MOVE_EPS) {
      try { sim.teleport({ x: lz.x, y: lz.y, z: lz.z }, { dimension: bot.dimension }); } catch (err) { log(bot, "body:teleport_failed", err); }
      try { sim.stopMoving(); } catch {}
      b.navKey = ""; b.sync = { ...lz };
      return "body";
    }

    // 2) 従来の移動に任せている間: 体はリゼの位置へ追従するだけ
    if (now < b.fallbackUntil) { b.followLegacy = true; return "legacy"; }
    b.followLegacy = false;

    // 3) 行き先へ歩かせる
    const t = r.target;
    if (t) {
      const sp = sim.location;
      const dh = d2(sp, t), dv = Math.abs(sp.y - t.y);
      // 遠い行き先へは飛行のほうが速い (歩きは約 4.3 ブロック/秒)。埋まり・段差・葉の問題は目的地の近くで起きるので、近くだけ体で歩く
      if (dh > BODY.FAR_LEGACY && !opts.walkFar) { if (b.navKey) { try { sim.stopMoving(); } catch {} b.navKey = ""; } b.followLegacy = true; return "legacy"; }
      if (dh <= BODY.ARRIVE_H && dv <= BODY.ARRIVE_V) { if (b.navKey) { try { sim.stopMoving(); } catch {} b.navKey = ""; } }
      else {
        const key = `${Math.floor(t.x)},${Math.floor(t.y)},${Math.floor(t.z)}`;
        if (key !== b.navKey || now - b.navAt > BODY.NAV_REISSUE_MS) {
          let full = true;
          try { const res = sim.navigateToLocation({ x: t.x, y: t.y, z: t.z }, opts.speed ?? 1); full = res ? res.isFullPath !== false : true; } catch (err) { full = false; log(bot, "body:navigate_failed", err); }
          if (key !== b.navKey) { b.bestD = Infinity; b.bestAt = now; }
          b.navKey = key; b.navAt = now; b.fullPath = full;
        }
        // 近づけていなければ、従来の移動 (飛行・トンネル) に任せる
        const dd = Math.hypot(dh, dv);
        if (dd < b.bestD - 0.5) { b.bestD = dd; b.bestAt = now; }
        if ((b.fullPath === false && now - b.navAt > 800) || now - b.bestAt > BODY.NO_PROGRESS_MS) {
          b.fallbackUntil = now + BODY.FALLBACK_MS; b.bestD = Infinity; b.bestAt = now + BODY.FALLBACK_MS; b.navKey = "";
          try { sim.stopMoving(); } catch {}
          return "legacy";
        }
      }
    }

    // 4) 見た目 (リゼのモデル) を体の位置へ重ねる
    const sp = sim.location;
    let yaw = 0; try { yaw = sim.getRotation().y; } catch {}
    try { bot.teleport({ x: sp.x, y: sp.y, z: sp.z }, { rotation: { x: 0, y: yaw } }); } catch {}
    b.sync = { x: sp.x, y: sp.y, z: sp.z };
    return "body";
  }

  // 従来の移動でリゼが動いた後に呼ぶ: 体をリゼの位置へ移す
  function followBot(bot, r) {
    const b = r.body; if (!b || !valid(b.sim)) return;
    const lz = bot.location;
    if (d3(lz, b.sim.location) > 0.3) { try { b.sim.teleport({ x: lz.x, y: lz.y, z: lz.z }, { dimension: bot.dimension }); } catch {} }
    b.sync = { ...lz };
  }

  const isBody = (e) => { try { return !!e && typeof e.hasTag === "function" && e.hasTag(BODY.TAG); } catch { return false; } };

  return { available, tick, followBot, release, isBody };
}
