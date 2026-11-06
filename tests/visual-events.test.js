const assert=require('node:assert/strict'),{createGame}=require('./runtime');let checks=0;
const ok=(v,label)=>{assert.ok(v,label);checks++;};
const game=createGame(81),run=s=>game.run(s);
for(const weapon of ['turret','frost','laser','tesla','flame','poison','sonic','missile','gravity','prism','generator']) {
  run(`newGame();G.gold=1000;tryBuild('${weapon}',0,2);globalThis.source=G.buildings[0];globalThis.target=spawnEnemy('grunt',1,1);
    target.hp=target.maxHp=10000;target.res={};target.weak={};applyDamage(target,20,null,source);`);
  ok(run(`G.effects.some(e=>e.type==='impact'&&e.weapon==='${weapon}'&&e.life===.26)`),weapon+' impact follows actual damage');
  run('G.effects=[];target.phaseBarrier=1;applyDamage(target,20,null,source);');
  ok(run('G.effects.length===0'),weapon+' blocked damage has no false impact');
}
run(`newGame();G.gold=1000;tryBuild('flame',0,2);globalThis.source=G.buildings[0];globalThis.target=spawnEnemy('grunt',1,1);
  target.hp=target.maxHp=10000;target.res={};target.weak={};for(let i=0;i<30;i++)dotDamage(target,30,'fire',source,1/60);`);
ok(run("G.effects.filter(e=>e.type==='impact').length<=1"),'continuous hits are merged, not emitted every step');
run('G.effects=Array.from({length:96},()=>({type:"ring",life:1,maxLife:1}));globalThis.hp=target.hp;applyDamage(target,20,null,source);');
ok(run('target.hp<hp && G.effects.length===96'),'visual budget never blocks damage');
run('G.effects=[];globalThis.random=Math.random;Math.random=()=>{throw Error("visual RNG leak");};emitHitFx(target,source);Math.random=random;');
ok(run('G.effects.length===1'),'impact event creation uses no combat random numbers');
function trace(impacts) {
  const g=createGame(8123);
  g.run(`newGame();G.experience='combat';G.mode='unlimited';G.gold=1e6;G.power=1e6;G.souls=1e5;
    ACHIEVEMENTS.forEach(a=>G.ach[a.id]=1);${impacts?'':'emitHitFx=()=>{};'}
    ['frost','flame','tesla','poison','gravity'].forEach((type,i)=>{tryBuild(type,0,i);setBuildingLevel(G.buildings.at(-1),6);tryBranch(G.buildings.at(-1),i%2?'a':'b');});
    G.wave=20;G.state='wave';G.spawnQueue=['grunt','bulwark'];G.bossQueue=[];
    for(let i=0;i<12;i++){const e=spawnEnemy(i%2?'bulwark':'grunt',20,i%3);e.x=240+i*4;}
    globalThis.calls=0;const random=Math.random;Math.random=()=>{calls++;return random();};
    for(let i=0;i<240;i++){statFrame++;step(1/60);}
    globalThis.result={gold:G.gold,power:G.power,souls:G.souls,stats:G.stats,bed:G.bed,doors:G.doors,randomCalls:calls,
      buildings:G.buildings.map(b=>[b.type,b.hp,b.shield,b.cd,b.zcd,b.kills]),enemies:G.enemies.map(e=>[e.type,e.hp,e.shield,e.x,e.y,e.state,e.stun,e.slow,e.poison,e.poisonDps])};`);
  assert.deepEqual(g.errors,[]);return JSON.parse(g.run('JSON.stringify(result)'));
}
run(`newGame();G.gold=10000;G.souls=1000;tryBuild('generator',0,2);globalThis.source=G.buildings[0];setBuildingLevel(source,6);tryBranch(source,'b');
  globalThis.target=spawnEnemy('grunt',1,1);target.x=300;target.y=source.y;updateTowers(.1);`);
ok(run('source.fireFx>0 && G.effects.some(e=>e.type==="arc")'),'generator attack animation follows its actual discharge');
assert.deepEqual(trace(true),trace(false),'hit artwork leaves damage, economy, AI and RNG trace identical');checks++;
console.log('Visual event regression: '+checks+' checks passed');
