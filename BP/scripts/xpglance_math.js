// xpglance_math.js — POLISH-ANIM-XPGLANCE-01 純粋核 (cycle0628 統合、元ドラフト cycle0628-a08)
// 近づいてくる経験値オーブを一瞬だけ目で追う追視。表示層のみ。
// 純粋・決定的・例外なし: importなし、時刻は引数、入力stateを破壊せず新stateは呼び出し側管理
// (note* は既存流儀に倣い state を更新して結果文字列を返す)。
"use strict";
export const XPGLANCE_MAX_DIST = 6.0;
export const XPGLANCE_MIN_DIST = 0.8;
export const XPGLANCE_APPROACH_MIN = 0.3; // 前回観測からの距離減少の下限
export const XPGLANCE_MAX_GAP_MS = 1500;
export const XPGLANCE_CONFIRM = 2;        // 同一オーブの接近観測が2回連続で確定
export const XPGLANCE_DURATION_MS = 600;
export const XPGLANCE_RISE_MS = 120;
export const XPGLANCE_FALL_MS = 180;
export const XPGLANCE_COOLDOWN_MS = 6000;
export const XPGLANCE_REARM_MS = 3000;    // 抑制で消費した後の再武装
export const XPGLANCE_BLEND = 0.8;        // 目標方向へ完全一致させない
export const XPGLANCE_EYE_HEIGHT = 1.4;   // gaze_math GAZE_EYE_HEIGHT と同値の写し
const PITCH_MIN = -60, PITCH_MAX = 75, PITCH_SIGN = -1, DEADZONE = 0.3;
function fin(v){return typeof v==="number"&&Number.isFinite(v)?v:null;}
function vec(v){if(!v||typeof v!=="object")return null;const x=fin(v.x),y=fin(v.y),z=fin(v.z);return(x===null||y===null||z===null)?null:{x,y,z};}
function clampPitch(v){return Math.max(PITCH_MIN,Math.min(PITCH_MAX,v));}
function wrapDeg(d){return ((d+540)%360)-180;}
function clamp01(v){return v<0?0:v>1?1:v;}
function smooth(v){const t=clamp01(v);return t*t*(3-2*t);}
export function createXpGlanceState(){return{orbId:null,prevDist:null,prevAtMs:null,confirmCount:0,firedAtMs:null,lastFiredMs:null,rearmUntilMs:0,targetYawDeg:null,targetPitchDeg:null,lastRecord:null};}
function dist3(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}
function gazeTo(selfPos,orbPos){const dx=orbPos.x-selfPos.x,dz=orbPos.z-selfPos.z;const horiz=Math.hypot(dx,dz);if(!(horiz>DEADZONE))return null;const dy=orbPos.y-(selfPos.y+XPGLANCE_EYE_HEIGHT);const yaw=Math.atan2(-dx,dz)*180/Math.PI;const pitch=clampPitch(PITCH_SIGN*Math.atan2(dy,horiz)*180/Math.PI);return(Number.isFinite(yaw)&&Number.isFinite(pitch))?{yawDeg:yaw,pitchDeg:pitch}:null;}
// sample:{orbId,orbPos,selfPos,sameDimension,suppressed}
// 戻り値: "fired"|"tracking"|"consumed"|"none"
export function noteXpGlance(state,sample,nowMs){
  if(!state||!sample||fin(nowMs)===null)return "none";
  const orbPos=vec(sample.orbPos),selfPos=vec(sample.selfPos);
  if(typeof sample.orbId!=="string"||!sample.orbId||!orbPos||!selfPos||sample.sameDimension===false){
    state.orbId=null;state.prevDist=null;state.prevAtMs=null;state.confirmCount=0;return "none";}
  const d=dist3(selfPos,orbPos);
  if(d>XPGLANCE_MAX_DIST||d<XPGLANCE_MIN_DIST){state.orbId=null;state.prevDist=null;state.prevAtMs=null;state.confirmCount=0;return "none";}
  const sameOrb=state.orbId===sample.orbId;
  const gap=sameOrb&&fin(state.prevAtMs)!==null?nowMs-state.prevAtMs:null;
  const approaching=sameOrb&&fin(state.prevDist)!==null&&gap!==null&&gap>0&&gap<=XPGLANCE_MAX_GAP_MS&&(state.prevDist-d)>=XPGLANCE_APPROACH_MIN;
  state.orbId=sample.orbId;state.prevDist=d;state.prevAtMs=nowMs;
  state.confirmCount=approaching?(state.confirmCount>0?state.confirmCount+1:2):1;
  if(state.confirmCount<XPGLANCE_CONFIRM)return "tracking";
  // 確定: 冷却/再武装/抑制なら辺を消費する (遅れ発火しない)
  if(nowMs<(state.rearmUntilMs||0))return "consumed";
  if(state.lastFiredMs!==null&&nowMs-state.lastFiredMs<XPGLANCE_COOLDOWN_MS){state.rearmUntilMs=nowMs+XPGLANCE_REARM_MS;return "consumed";}
  if(sample.suppressed===true){state.rearmUntilMs=nowMs+XPGLANCE_REARM_MS;state.lastRecord={reason:"suppressed",atMs:nowMs,orbId:sample.orbId};return "consumed";}
  const g=gazeTo(selfPos,orbPos);if(!g)return "none";
  state.firedAtMs=nowMs;state.lastFiredMs=nowMs;state.targetYawDeg=g.yawDeg;state.targetPitchDeg=g.pitchDeg;
  state.lastRecord={reason:"fired",atMs:nowMs,orbId:sample.orbId,dist:d,targetYawDeg:g.yawDeg,targetPitchDeg:g.pitchDeg};
  return "fired";
}
export function sampleXpGlance(state,nowMs){
  if(!state||fin(nowMs)===null||fin(state.firedAtMs)===null)return{active:false,weight:0,targetYawDeg:null,targetPitchDeg:null};
  const t=nowMs-state.firedAtMs;if(t<0||t>=XPGLANCE_DURATION_MS)return{active:false,weight:0,targetYawDeg:null,targetPitchDeg:null};
  let w;if(t<XPGLANCE_RISE_MS)w=smooth(t/XPGLANCE_RISE_MS);else if(t>XPGLANCE_DURATION_MS-XPGLANCE_FALL_MS)w=1-smooth((t-(XPGLANCE_DURATION_MS-XPGLANCE_FALL_MS))/XPGLANCE_FALL_MS);else w=1;
  return{active:w>0,weight:w,targetYawDeg:state.targetYawDeg,targetPitchDeg:state.targetPitchDeg};
}
// base:{yawDeg,pitchDeg} へ weight*BLEND で寄せる。無効入力は base の複製を返す。
export function blendXpGlanceGaze(base,sample){
  if(!base||fin(base.yawDeg)===null||fin(base.pitchDeg)===null)return base?{...base}:base;
  if(!sample||!sample.active||fin(sample.targetYawDeg)===null||fin(sample.targetPitchDeg)===null)return{...base};
  const k=clamp01(sample.weight)*XPGLANCE_BLEND;
  return{yawDeg:base.yawDeg+wrapDeg(sample.targetYawDeg-base.yawDeg)*k,pitchDeg:clampPitch(base.pitchDeg+(sample.targetPitchDeg-base.pitchDeg)*k)};
}
