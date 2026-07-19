import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_STATES } from '../src/app/app-state.js';
import { RUN_STATUS } from '../src/app/run-controller.js';
import { installResultFlow } from '../src/ui/result-flow.js';

class FakeElement {
  constructor(){ this.textContent=''; this.value=''; this.hidden=false; this.disabled=false; this.dataset={}; this.listeners=new Map(); this.href='https://lab.test/'; }
  addEventListener(type,fn){ this.listeners.set(type,fn); }
  removeEventListener(type){ this.listeners.delete(type); }
  click(){ return this.listeners.get('click')?.({preventDefault(){}}); }
  focus(){ this.focused=true; }
  select(){ this.selected=true; }
}
function makeDocument(){
  const ids=['resultMode','resultPlayer','resultTime','resultSwipes','resultDistance','resultUndo','resultOptimal','resultDelta','resultProblem','resultFirst','resultBest','resultSaveStatus','resultNetworkStatus','resultMessage','resultRetry','resultNext','resultShare','resultHome','resultLab','resultShareFallback','homeLab'];
  const elements=Object.fromEntries(ids.map(id=>[id,new FakeElement()]));
  return { elements, getElementById(id){ return elements[id]||null; } };
}
function makeGame(){
  const listeners=new Set();
  const appController={
    state:APP_STATES.PLAYING,
    version:0,
    transition(next){ const allowed=(this.state===APP_STATES.PLAYING&&next===APP_STATES.RESULT)||(this.state===APP_STATES.RESULT&&(next===APP_STATES.HOME||next===APP_STATES.COUNTDOWN)); if(!allowed)return {accepted:false}; this.state=next; this.version++; for(const fn of listeners)fn({state:next}); return {accepted:true}; },
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  };
  const run={playId:1,status:RUN_STATUS.PLAYING,result:null};
  const runController={
    get status(){return run.status;},
    isCurrent(id){return id===run.playId;},
    snapshot(){return {playId:run.playId,status:run.status,result:run.result,config:{mode:'endless',seed:'abc'}};},
  };
  const game={
    appController,runController,currentPlayId:1,playerName:'箱係',activeMode:'endless',
    activeRunConfig:{mode:'endless',seed:'abc',difficulty:'normal',playerName:'箱係',official:false,preview:false},
    meta:{seed:'abc',difficulty:'normal',optimalSwipes:4,exact:true},
    engine:{status:'cleared',finalElapsedMs:1200,swipeCount:5,distanceCells:20,undoCount:1},
    inputLocked:true,view:[{}],target:[{}],exiting:[false],particles:[{}],dragIndex:-1,dragOffset:{},preview:null,
    ranking:{summaryCalls:0,async getScoreSummary(){this.summaryCalls+=1;return this.summaryCalls===1?{count:0,first:null,best:null}:{count:1,first:{timeMs:1200,swipeCount:5,distanceCells:20},best:{timeMs:1200,swipeCount:5,distanceCells:20}};}},
    hud:{message(t,k){this.last=[t,k];}},
    async _onClear(){run.status=RUN_STATUS.CLEARED;run.result={mode:'endless',seed:'abc',timeMs:1200,swipeCount:5,distanceCells:20,undoCount:1};},
    _restartActiveRun(seed){this.restarted=seed;this.currentPlayId=2;run.playId=2;run.status=RUN_STATUS.PLAYING;this.appController.state=APP_STATES.COUNTDOWN;return true;},
  };
  return game;
}

test('クリアを一度だけ結果へ遷移し全指標を表示する', async()=>{
  const doc=makeDocument(); const game=makeGame(); const tasks=[];
  installResultFlow(game,{documentRef:doc,navigatorRef:{},locationRef:{href:'https://game.test/#x'},schedule:(fn)=>{tasks.push(fn);return tasks.length;},cancelSchedule(){}});
  assert.equal(await game._onClear(),true);
  assert.equal(game.appController.state,APP_STATES.PLAYING);
  tasks.shift()();
  assert.equal(game.appController.state,APP_STATES.RESULT);
  assert.equal(doc.elements.resultTime.textContent,'1.20秒');
  assert.equal(doc.elements.resultSwipes.textContent,'5操作');
  assert.equal(doc.elements.resultDelta.textContent,'最短より +1操作');
  assert.equal(doc.elements.resultFirst.textContent,'1.20秒 / 5操作');
  assert.equal(await game._onClear(),false);
});

test('結果から同じseedを再挑戦できる', async()=>{
  const doc=makeDocument(); const game=makeGame(); const tasks=[];
  installResultFlow(game,{documentRef:doc,schedule:(fn)=>{tasks.push(fn);return 1;},cancelSchedule(){}});
  await game._onClear(); tasks.shift()(); doc.elements.resultRetry.click();
  assert.equal(game.restarted,'abc');
  assert.equal(game.appController.state,APP_STATES.COUNTDOWN);
});

test('結果からホームへ戻ると盤面参照を破棄する', async()=>{
  const doc=makeDocument(); const game=makeGame(); const tasks=[];
  installResultFlow(game,{documentRef:doc,schedule:(fn)=>{tasks.push(fn);return 1;},cancelSchedule(){}});
  await game._onClear(); tasks.shift()(); doc.elements.resultHome.click();
  assert.equal(game.appController.state,APP_STATES.HOME);
  assert.equal(game.engine,null);
  assert.equal(game.currentPlayId,null);
});

test('共有APIがない場合は選択可能な全文を表示する', async()=>{
  const doc=makeDocument(); const game=makeGame(); const tasks=[];
  installResultFlow(game,{documentRef:doc,navigatorRef:{},locationRef:{href:'https://game.test/#x'},schedule:(fn)=>{tasks.push(fn);return 1;},cancelSchedule(){}});
  await game._onClear(); tasks.shift()(); await doc.elements.resultShare.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(doc.elements.resultShareFallback.hidden,false);
  assert.match(doc.elements.resultShareFallback.value,/https:\/\/game\.test\//);
  assert.equal(doc.elements.resultShareFallback.selected,true);
});

test('古いクリア結果は新しいplayIdへ遷移しない', async()=>{
  const doc=makeDocument(); const game=makeGame(); const tasks=[];
  installResultFlow(game,{documentRef:doc,schedule:(fn)=>{tasks.push(fn);return 1;},cancelSchedule(){}});
  await game._onClear(); game.currentPlayId=2; tasks.shift()();
  assert.equal(game.appController.state,APP_STATES.PLAYING);
});
