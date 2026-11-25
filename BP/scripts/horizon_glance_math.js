// horizonglance_math.js — POLISH-ANIM-HORIZONGLANCE-01 純粋核ドラフト (cycle0307-a18)
// 日の出/日の入りの帯に入った辺で、地平線(太陽方位)へ一度だけ視線を向ける表示層のみの要素。
// 純粋・決定的・例外なし: @minecraft/server を import しない、相対 import も持たない
// (ゲイズクランプ -60/+75 は gaze_math と同値のローカル写し。統合時に import へ置換すること)。
// 時刻・位相・方位は全て引数。Date.now/乱数なし。実座標・移動・作業には一切触らない。
"use strict";

export const HORIZON_PITCH_DEG = 9;        // 地平線を見る小さな見上げ量 (上向き=負で適用)
export const HORIZON_DURATION_MS = 1400;   // 全体: 入り400/保持600/戻り400
export const HORIZON_ENTER_MS = 400;
export const HORIZON_HOLD_END_MS = 1000;
export const HORIZON_YAW_MAX_DEG = 30;     // 太陽方位へ寄せるヨーの上限 (全回転はしない)
export const HORIZON_COOLDOWN_MS = 300000; // 5分 (帯の出入り反復でも最大5分に1回)
export const HORIZON_CONFIRM_SAMPLES = 2;  // 帯入り確定に必要な連続サンプル (境界のちらつき防止)

import { GAZE_PITCH_MIN as PITCH_MIN, GAZE_PITCH_MAX as PITCH_MAX } from "./gaze_math.js";
function fin(v){ return typeof v==="number" && Number.isFinite(v) ? v : null; }
function clampPitch(v){ return Math.max(PITCH_MIN, Math.min(PITCH_MAX, v)); }

// 位相は文字列のみ受理: "dawn"|"dusk" が帯、それ以外(day/night)は非帯、未観測は UNKNOWN
export function isHorizonBand(phase){ return phase==="dawn" || phase==="dusk"; }

// 最短角差 (-180,180] へ正規化。非数は null
export function shortestAngleDeltaDeg(fromDeg, toDeg){
  const a=fin(fromDeg), b=fin(toDeg); if(a===null||b===null) return null;
  let d=(b-a)%360; if(d>180)d-=360; if(d<=-180)d+=360; return d;
}

// 波形エンベロープ [0,1]: 入り sin / 保持 1 / 戻り cos。範囲外・非数は 0
export function horizonEnvelope(elapsedMs){
  const e=fin(elapsedMs); if(e===null||e<0||e>=HORIZON_DURATION_MS) return 0;
  if(e<HORIZON_ENTER_MS) return Math.sin((e/HORIZON_ENTER_MS)*Math.PI/2);
  if(e<HORIZON_HOLD_END_MS) return 1;
  return Math.cos(((e-HORIZON_HOLD_END_MS)/(HORIZON_DURATION_MS-HORIZON_HOLD_END_MS))*Math.PI/2);
}
export function horizonPitchOffset(elapsedMs){ const v=-HORIZON_PITCH_DEG*horizonEnvelope(elapsedMs); return v===0?0:v; }
// ヨー: 太陽方位への最短差を ±30 に制限しエンベロープで重み付け。差が取れなければ 0
export function horizonYawOffset(elapsedMs, currentYawDeg, sunYawDeg){
  const d=shortestAngleDeltaDeg(currentYawDeg, sunYawDeg); if(d===null) return 0;
  const capped=Math.max(-HORIZON_YAW_MAX_DEG, Math.min(HORIZON_YAW_MAX_DEG, d));
  const v=capped*horizonEnvelope(elapsedMs); return v===0?0:v;
}
export function applyHorizonPitch(baseDeg, elapsedMs){
  if(!Number.isFinite(baseDeg)) return baseDeg;
  return clampPitch(baseDeg + horizonPitchOffset(elapsedMs));
}

export function createHorizonState(){ return { active:false, startedAtMs:null, lastFiredAtMs:null, bandCount:0, prevBand:false, episode:0, bandKind:null }; }

// noteHorizon(state, sample) -> { fired, active, reason }
// sample: { phase, nowMs, suppressed?, danger?, combat?, falling?, flying?, inWater?, underground?, skyVisible?, hasWorkTarget? }
// 発火: 帯の外→帯の中が CONFIRM_SAMPLES 連続で確定した辺でのみ。抑制中でも帯サンプルは消費し
// (bandCount は進む)、抑制が解けた後の遅れ発火はしない。phase 未観測(非文字列)は UNKNOWN として状態不変。
export function noteHorizon(state, sample){
  try{
    if(!state || typeof state!=="object" || !sample || typeof sample!=="object") return { fired:false, active:false, reason:"invalid" };
    const now=fin(sample.nowMs); if(now===null) return { fired:false, active:state.active===true, reason:"invalid_time" };
    if(typeof sample.phase!=="string") return { fired:false, active:state.active===true, reason:"unknown" };
    const band=isHorizonBand(sample.phase);
    state.active = state.startedAtMs!==null && (now-state.startedAtMs)>=0 && (now-state.startedAtMs)<HORIZON_DURATION_MS;
    if(!band){ state.bandCount=0; state.prevBand=false; return { fired:false, active:state.active, reason:"outside_band" }; }
    state.bandCount=(state.prevBand? state.bandCount:0)+1; state.prevBand=true;
    if(state.bandCount!==HORIZON_CONFIRM_SAMPLES) return { fired:false, active:state.active, reason:"confirming" };
    // 確定の辺: ここでだけ発火判定。抑制/冷却で不発でも辺は消費済み (次サンプルは bandCount!=CONFIRM)
    const suppressed = sample.suppressed===true||sample.danger===true||sample.combat===true||sample.falling===true||sample.flying===true||sample.inWater===true||sample.underground===true||sample.skyVisible===false||sample.hasWorkTarget===true;
    if(suppressed) return { fired:false, active:state.active, reason:"suppressed" };
    if(state.lastFiredAtMs!==null && now-state.lastFiredAtMs < HORIZON_COOLDOWN_MS) return { fired:false, active:state.active, reason:"cooldown" };
    state.startedAtMs=now; state.lastFiredAtMs=now; state.episode+=1; state.bandKind=sample.phase; state.active=true;
    return { fired:true, active:true, reason:"fired" };
  }catch{ return { fired:false, active:false, reason:"error" }; }
}

export function horizonCurrentOffset(state, nowMs, currentYawDeg, sunYawDeg){
  try{
    if(!state || state.startedAtMs==null) return { pitchDeg:0, yawDeg:0, active:false };
    const n=fin(nowMs); if(n===null) return { pitchDeg:0, yawDeg:0, active:false };
    const e=n-state.startedAtMs;
    if(e<0||e>=HORIZON_DURATION_MS) return { pitchDeg:0, yawDeg:0, active:false };
    return { pitchDeg:horizonPitchOffset(e), yawDeg:horizonYawOffset(e, currentYawDeg, sunYawDeg), active:true };
  }catch{ return { pitchDeg:0, yawDeg:0, active:false }; }
}
