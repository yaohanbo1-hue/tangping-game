const assert = require('node:assert/strict');
const { createGame } = require('./runtime');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
function trajectory(quality,sound) {
  const game=createGame(334455);
  game.run(`newGame();G.experience='combat';Graphics.set('${quality}');SFX.on=${sound};
    G.gold=G.power=1e8;G.souls=1e5;G.wave=25;G.state='wave';G.spawnQueue=[];G.bossQueue=[];
    Object.keys(BUILD_DEFS).forEach((type,i)=>{tryBuild(type,Math.floor(i/5),i%5);const b=G.buildings.at(-1);setBuildingLevel(b,8);tryBranch(b,i%2?'a':'b');});
    for(let i=0;i<24;i++){const e=spawnEnemy(['grunt','swarm','rustbug','vampire'][i%4],25,i%3);e.x=220+i%6*15;}
    // A usable bounded audio context forces the noise path to run in this logic
    // regression. Real OfflineAudioContext output is checked separately.
    const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
    const node=()=>({gain:param(),frequency:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){},disconnect(){},start(){},stop(){}});
    SFX.ctx={currentTime:0,sampleRate:1000,destination:node(),createGain:node,createDynamicsCompressor:node,createOscillator:node,createBiquadFilter:node,createBufferSource:node,createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)})};
    globalThis.tick=()=>{SFX.ctx.currentTime+=1/60;statFrame++;step(1/60);};`);
  const tick=game.run('tick'),frames=[];
  for(let i=0;i<900;i++){
    tick();game.advance(1000/60);
    if(i%60===0)frames.push(JSON.stringify(game.run(`({wave:G.wave,state:G.state,gold:G.gold,power:G.power,souls:G.souls,stats:G.stats,
      enemies:G.enemies.map(e=>({type:e.type,x:e.x,y:e.y,hp:e.hp,shield:e.shield,phase:e.phase,affixes:e.affixes,dead:e.dead})),
      buildings:G.buildings.map(b=>({type:b.type,hp:b.hp,kills:b.kills})),doors:G.doors.map(d=>d.hp),bag:G.runeBag,bed:G.bed.hp,random:Math.random()})`)));
  }
  assert.deepEqual(game.errors,[]);return {frames,stats:game.run('SFX.stats()')};
}
const baseline=trajectory('high',true);
for(const quality of ['low','medium','high'])for(const sound of [true,false]){
  const result=trajectory(quality,sound);
  assert.deepEqual(result.frames,baseline.frames,quality+' / sound '+sound+' preserves the entire combat trajectory and RNG');checks++;
  ok(result.stats.peak<=24,'audio hard limit applies during actual combat');
}
const game=createGame(1),run=code=>game.run(code);run('newGame();');
run(`globalThis.oldRandom=Math.random;Math.random=()=>{throw Error('presentation consumed combat RNG');};
  spawnParts(100,100,1000,'#ffd166');addText(100,100,'test');FourthWall._state={chatMessages:[]};FourthWall.chatMessage('test');
  DreamDiary.addEntry('custom','test');Math.random=oldRandom;`);
ok(run('G.parts.length<=Graphics.profile.particles'),'particle cap is hard');
for(const quality of ['low','medium','high']){
  run(`Graphics.set('${quality}');G.parts=[];G.effects=[];for(let i=0;i<100;i++){spawnParts(1,1,50,'#fff');addEffect({type:'laser',life:1,maxLife:1});}
    addEffect({type:'curse',x:BED_CX,y:BED_CY,r:50,dps:10,life:.1,maxLife:.1});globalThis.before=G.bed.hp;updateEffects(.1);`);
  ok(run('G.parts.length<=Graphics.profile.particles && G.effects.filter(e=>e.type==="laser").length<=Graphics.profile.beams'),'bounded quality '+quality);
  ok(run('G.bed.hp<before'),'quality never suppresses gameplay curse damage '+quality);
}
run("Graphics.set('low');Graphics.init();");ok(run("Graphics.level==='low'"),'graphics preference persists');
run("Store.set('tangping_graphics','__proto__');Graphics.init();");ok(run("Graphics.level==='medium'"),'unknown graphics setting recovers safely');
run("newGame();DreamSound._playMelody({name:'test',rewardSpec:{gold:10000}});newGame();globalThis.newGold=G.gold;");game.advance(2000);
ok(run('G.gold===newGold'),'old melody callback cannot reward the next run');
run("globalThis.beforeReward=G.gold;DreamSound._playMelody({name:'test',rewardSpec:{gold:10000}});SFX.on=false;");game.advance(2000);
ok(run('G.gold===beforeReward+10000'),'muting sound never cancels a real gameplay reward');
run("newGame();G.experience='combat';startWave();globalThis.beforeReward=G.gold;globalThis.testMelody={id:'test-save-melody',name:'test',sequence:['test'],rewardSpec:{gold:10000,souls:50}};DreamSound.MELODIES=[testMelody];DreamSound.recordClick('test');globalThis.afterMelody=G.gold;globalThis.afterSouls=G.souls;globalThis.save=SaveSystem.capture();newGame(save);");
ok(run('G.gold===afterMelody && G.souls===afterSouls'),'saving immediately after discovery preserves gold and soul rewards');
run("DreamSound.recordClick('test');");ok(run('G.gold===afterMelody && G.souls===afterSouls'),'restored melody cannot pay twice');
run("newGame();");ok(run('DreamSound._clickHistory.length===0 && DreamSound._triggeredMelodies.length===0'),'a new run clears previous melody discoveries and click history');
console.log('Presentation isolation and quality: '+checks+' checks passed');
