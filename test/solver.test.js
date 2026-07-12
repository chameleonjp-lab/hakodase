import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, solveOptimalSwipes, solveMinimumDistance, quickSolvable } from '../src/core/solver.js';
function lineBoard(){return {width:5,height:1,walls:new Set(),oneway:new Map(),gates:[{side:'right',line:0,color:0}],blocks:[{id:0,x:0,y:0,w:1,h:1,color:0}]};}
function orderBoard(){return {width:4,height:2,walls:new Set(),oneway:new Map(),gates:[{side:'right',line:0,color:0},{side:'top',line:2,color:1}],blocks:[{id:0,x:1,y:0,w:1,h:1,color:0},{id:1,x:2,y:0,w:1,h:1,color:1}]};}
function dead(){return {width:2,height:2,walls:new Set(['1,0','0,1']),oneway:new Map(),gates:[{side:'right',line:0,color:0}],blocks:[{id:0,x:0,y:0,w:1,h:1,color:0}]};}
test('距離が長くても1スワイプなら optimalSwipes は1',()=>{const r=solveOptimalSwipes(lineBoard()); assert.equal(r.solved,true); assert.equal(r.optimalSwipes,1); assert.deepEqual(r.solution,[{blockIndex:0,dir:'right'}]);});
test('solveはv2の最短操作数を返す',()=>{assert.equal(solve(lineBoard()).optimalSwipes,1);});
test('距離ソルバーは診断用に距離を返す',()=>{const r=solveMinimumDistance(lineBoard()); assert.equal(r.solved,true); assert.equal(r.moves,5);});
test('複数操作が必要な盤面の最短操作数',()=>{const r=solveOptimalSwipes(orderBoard()); assert.equal(r.solved,true); assert.equal(r.optimalSwipes,2); assert.deepEqual(r.solution,[{blockIndex:1,dir:'up'},{blockIndex:0,dir:'right'}]);});
test('解なし',()=>{const r=solveOptimalSwipes(dead()); assert.equal(r.solved,false); assert.equal(r.reason,'exhausted'); assert.equal(quickSolvable(dead()), false);});
test('ノード上限',()=>{const r=solveOptimalSwipes(orderBoard(),{maxNodes:1}); assert.equal(r.solved,false); assert.equal(r.reason,'maxNodes');});
test('同じ盤面で解法列が再現する',()=>{assert.deepEqual(solveOptimalSwipes(orderBoard()).solution, solveOptimalSwipes(orderBoard()).solution);});
test('退場済み状態を正しく扱う',()=>{const r=solveOptimalSwipes(orderBoard()); assert.equal(r.solution.length,2);});
