import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approachValue, approachPoint } from '../src/render/animation.js';
function run(steps){let v=0; for(let i=0;i<steps;i++) v=approachValue(v,10,1/steps,{maxDt:1, snapEpsilon:0}); return v;}
test('1秒間を60分割した結果と120分割した結果が近い',()=>{assert.ok(Math.abs(run(60)-run(120))<0.001);});
test('スナップ条件で目標値と完全一致する',()=>{assert.equal(approachValue(9.999,10,1/60,{snapEpsilon:0.01}),10);});
test('極端なdtでNaNや大移動を起こさない',()=>{const p=approachPoint({x:0,y:0},{x:10,y:10},999); assert.equal(Number.isFinite(p.x),true); assert.ok(p.x<=10 && p.x>=0);});
