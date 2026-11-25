// lookback_math.mjs — POLISH-ANIM-LOOKBACK-01 純粋核ドラフト (cycle1153-a06)
// 仕様の正: brain_parts/solutions/cycle1133-a21/REPORT.md §1 / §4 / §5
// 純粋モジュール: サーバーAPI非依存、時刻・座標は引数、例外を投げない、表示層のみ。
// 波形: 入り250ms / 保持200ms / 戻り250ms = 700ms。振幅は主人方向への最短角を ±70度へクランプ。
export const LOOKBACK_DIST = 10;
export const LOOKBACK_HEAD_MAX = 70;
export const LOOKBACK_DURATION_MS = 700;
export const LOOKBACK_ENTER_MS = 250;
export const LOOKBACK_HOLD_MS = 200;
export const LOOKBACK_COOLDOWN_MS = 25000;

function fin(v){return typeof v==="number"&&Number.isFinite(v)?v:null;}
export function wrapYawDeg(deg){try{if(!Number.isFinite(deg))return deg;let d=((deg+180)%360+360)%360-180;if(d===-180)d=180;return d;}catch{return deg;}}
export function shortestAngleDeg(fromDeg,toDeg){try{const a=fin(fromDeg),b=fin(toDeg);if(a===null||b===null)return null;return wrapYawDeg(b-a);}catch{return null;}}
export function lookbackEnvelope(elapsedMs){try{const e=fin(elapsedMs);if(e===null||e<0||e>=LOOKBACK_DURATION_MS)return 0;if(e<LOOKBACK_ENTER_MS)return Math.sin((e/LOOKBACK_ENTER_MS)*Math.PI/2);if(e<LOOKBACK_ENTER_MS+LOOKBACK_HOLD_MS)return 1;return Math.cos(((e-LOOKBACK_ENTER_MS-LOOKBACK_HOLD_MS)/LOOKBACK_ENTER_MS)*Math.PI/2);}catch{return 0;}}
export function lookbackYawOffset(baseYawDeg,ownerYawDeg,elapsedMs){try{const rel=shortestAngleDeg(baseYawDeg,ownerYawDeg);if(rel===null)return 0;const clamped=Math.max(-LOOKBACK_HEAD_MAX,Math.min(LOOKBACK_HEAD_MAX,rel));const v=clamped*lookbackEnvelope(elapsedMs);return v===0?0:v;}catch{return 0;}}
export function lookbackYawAt(startMs,nowMs,baseYawDeg,ownerYawDeg){try{const s=fin(startMs),n=fin(nowMs);if(s===null||n===null)return 0;return lookbackYawOffset(baseYawDeg,ownerYawDeg,n-s);}catch{return 0;}}
export function applyLookbackYaw(baseYawDeg,ownerYawDeg,elapsedMs){try{if(!Number.isFinite(baseYawDeg))return baseYawDeg;return wrapYawDeg(baseYawDeg+lookbackYawOffset(baseYawDeg,ownerYawDeg,elapsedMs));}catch{return baseYawDeg;}}
export function isLookbackActive(startMs,nowMs){try{const s=fin(startMs),n=fin(nowMs);if(s===null||n===null)return false;const e=n-s;return e>=0&&e<LOOKBACK_DURATION_MS;}catch{return false;}}
export function lookbackDue(lastFiredMs,nowMs){try{const n=fin(nowMs);if(n===null)return false;const l=fin(lastFiredMs);if(l===null)return true;return n-l>=LOOKBACK_COOLDOWN_MS;}catch{return false;}}
// shouldLookback: 2形式対応
//  (a) shouldLookback(prevDist, dist, lastFiredMs, nowMs) — 仕様§4の最小形
//  (b) shouldLookback({prevDist,dist|distance,lastFiredAtMs|lastFiredMs,nowMs, baseYawDeg,ownerYawDeg,
//      danger,working|digging|placing|attacking,overlayActive|inspectActive|nodActive|flinchActive|
//      summonScanActive|skyglanceActive,falling,inWater,justTeleported,moving})
// 成立: prev<10<=dist の辺のみ AND 主人方向が±70以内(角度が渡された場合) AND 抑制なし AND 冷却明け。
// 抑制時は false を返すだけ(辺の消費は配線側が prevDist を毎tick更新することで行う — skyglance流儀)。
export function shouldLookback(a,b,c,d){try{
  let prevDist,dist,last,now,extra={};
  if(a&&typeof a==="object"){prevDist=a.prevDist;dist=a.dist!==undefined?a.dist:a.distance;last=a.lastFiredAtMs!==undefined?a.lastFiredAtMs:a.lastFiredMs;now=a.nowMs;extra=a;}
  else {prevDist=a;dist=b;last=c;now=d;}
  const p=fin(prevDist),q=fin(dist);if(p===null||q===null)return false;
  if(!(p<LOOKBACK_DIST&&q>=LOOKBACK_DIST))return false;
  if(fin(now)===null)return false;
  if(extra.danger===true||extra.working===true||extra.digging===true||extra.placing===true||extra.attacking===true)return false;
  if(extra.overlayActive===true||extra.inspectActive===true||extra.nodActive===true||extra.flinchActive===true||extra.summonScanActive===true||extra.skyglanceActive===true)return false;
  if(extra.falling===true||extra.inWater===true||extra.justTeleported===true)return false;
  if(extra.moving===false)return false;
  if(extra.baseYawDeg!==undefined&&extra.ownerYawDeg!==undefined){const rel=shortestAngleDeg(extra.baseYawDeg,extra.ownerYawDeg);if(rel===null||Math.abs(rel)>LOOKBACK_HEAD_MAX)return false;}
  return lookbackDue(last,now);
}catch{return false;}}
