import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PointerInput } from '../src/input/pointer-input.js';
class El{constructor(){this.style={};this.handlers={};this.captures=new Set();} addEventListener(t,h){(this.handlers[t]??=[]).push(h)} removeEventListener(t,h){this.handlers[t]=(this.handlers[t]||[]).filter(x=>x!==h)} setPointerCapture(id){this.captures.add(id)} releasePointerCapture(id){this.captures.delete(id); this.dispatch('lostpointercapture',{pointerId:id})} dispatch(t,e){(this.handlers[t]||[]).forEach(h=>h({clientX:0,clientY:0,preventDefault(){},...e}))}}
const mapper={clientToCell:()=>({x:0,y:0}),getLayout:()=>({cell:40})};
function setup(){const el=new El(); const calls=[]; const input=new PointerInput(el,mapper,{pickBlockAt:()=>0,onRelease:(i,d)=>calls.push(['release',i,d]),onCancel:(i)=>calls.push(['cancel',i])}); return {el,calls,input};}
test('pointerupは1回確定する',()=>{const {el,calls}=setup(); el.dispatch('pointerdown',{pointerId:1,clientX:0,clientY:0}); el.dispatch('pointerup',{pointerId:1,clientX:20,clientY:0}); assert.deepEqual(calls,[['release',0,'right']]);});
test('pointercancelは確定しない',()=>{const {el,calls}=setup(); el.dispatch('pointerdown',{pointerId:1}); el.dispatch('pointercancel',{pointerId:1}); assert.deepEqual(calls,[['cancel',0]]);});
test('lostpointercaptureは確定しない',()=>{const {el,calls}=setup(); el.dispatch('pointerdown',{pointerId:1}); el.dispatch('lostpointercapture',{pointerId:1}); assert.deepEqual(calls,[['cancel',0]]);});
test('2本目のpointerは確定しない',()=>{const {el,calls}=setup(); el.dispatch('pointerdown',{pointerId:1}); el.dispatch('pointerdown',{pointerId:2}); el.dispatch('pointerup',{pointerId:2,clientX:30}); assert.deepEqual(calls,[]);});
test('中断後に新しいpointerを受け付ける',()=>{const {el,calls}=setup(); el.dispatch('pointerdown',{pointerId:1}); el.dispatch('pointercancel',{pointerId:1}); el.dispatch('pointerdown',{pointerId:2}); el.dispatch('pointerup',{pointerId:2,clientX:30}); assert.deepEqual(calls,[['cancel',0],['release',0,'right']]);});
test('destroy後はハンドラが残らない',()=>{const {el,input}=setup(); input.destroy(); assert.equal(Object.values(el.handlers).every(a=>a.length===0),true);});
