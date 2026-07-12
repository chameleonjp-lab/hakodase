import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUD } from '../src/ui/hud.js';
function el(){return {textContent:'',dataset:{},innerHTML:'',children:[],appendChild(x){this.children.push(x)},append(...xs){this.children.push(...xs)},classList:{add(){}}};}
globalThis.document={createElement(){return el();}};
test('seed更新で難易度selectを変更しない',()=>{const difficulty={value:'normal'}; const seed=el(); const hud=new HUD({seed,difficulty}); hud.setSeed('abc'); assert.equal(seed.textContent,'seed: abc'); assert.equal(difficulty.value,'normal');});
test('操作数を操作として表示し、距離はマスと区別する',()=>{const moves=el(); const target=el(); const hud=new HUD({moves,target}); hud.setStats(2,9); hud.setTarget(4,true); assert.equal(moves.textContent,'2操作 / 移動9マス'); assert.equal(target.textContent,'最短4操作');});
