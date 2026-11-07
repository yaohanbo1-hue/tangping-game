const assert=require('node:assert/strict'),{createGame}=require('./runtime');
const g=createGame(929),run=s=>g.run(s);let checks=0;const ok=(v,label)=>{assert.ok(v,label);checks++;};
function fixture(type='grunt') {
  run(`newGame();G.experience='combat';G.gold=1000;G.wave=1;G.state='wave';G.spawnQueue=[];G.bossQueue=[];
    ACHIEVEMENTS.forEach(a=>G.ach[a.id]=1);
    tryBuild('turret',0,2);globalThis.building=G.buildings[0];building.hp=building.maxHp=1e5;
    globalThis.enemy=spawnEnemy('${type}',1,1);`);
}
for(const type of run('Object.keys(ENEMY_DEFS).filter(k=>!ENEMY_DEFS[k].boss)')) {
  fixture(type);run('globalThis.oldX=enemy.x;updateEnemies(.1);');
  ok(run('enemy.x>oldX && Number.isFinite(enemy.hp)'),type+' moves using its real AI');
}
for(const type of [...run('Object.keys(ENEMY_DEFS).filter(k=>!ENEMY_DEFS[k].boss)'),...run('Object.keys(BOSS_DEFS)')]) {
  fixture(type);run('enemy.state="room";enemy.target=building;enemy.x=building.x-20;enemy.y=building.y;enemy.atkCd=0;enemy.stun=1;updateEnemies(.1);');
  ok(run('building.hp===building.maxHp'),type+' cannot attack or drain while stunned');
}
function continuousDamage(type,frozen) {
  fixture();run(`G.buildings=[];G.grid.fill(null);tryBuild('${type}',0,2);globalThis.tower=G.buildings[0];setBuildingLevel(tower,6);
    tower.freezeT=${frozen?4:0};enemy.x=300;enemy.y=tower.y;enemy.hp=enemy.maxHp=10000;enemy.res={};enemy.weak={};enemy.flat=0;statFrame++;
    updateTowers(.1);`);return run('G.stats.dmg');
}
for(const type of ['flame','gravity'])ok(Math.abs(continuousDamage(type,true)/continuousDamage(type,false)-.4)<1e-9,type+' freezing also slows continuous damage');
function graveyard() {
  fixture('necromancer');
  run(`enemy.x=250;enemy.y=LANES[1].doorY;globalThis.victim=spawnEnemy('brute',1,1);victim.x=230;victim.y=enemy.y;victim.hp=0;killEnemy(victim);
    globalThis.firstLoot={gold:G.gold,souls:G.souls,runes:G.runeBag.length,maxHp:victim.maxHp};enemy.reviveT=7;`);
}
fixture('necromancer');run('enemy.reviveT=7;updateEnemies(.1);');
ok(run('G.enemies.length===1'),'necromancer cannot invent bodies with no corpse');
graveyard();run('updateEnemies(.1);');
ok(run('!!enemy.raiseCast && victim.dead'),'corpse revival has a visible wind-up');
run('for(let i=0;i<10;i++)updateEnemies(.1);');
ok(run('!victim.dead && victim.type==="brute" && victim.revived'),'actual original corpse returns, not a random grunt');
ok(run('Math.abs(victim.hp/victim.maxHp-.45)<1e-9 && G.summonsThisWave===1'),'revival restores 45% health and uses summon budget');
ok(run('victim.maxHp===firstLoot.maxHp'),'revival does not multiply finalized maximum health again');
run('victim.hp=0;killEnemy(victim);');
ok(run('G.gold===firstLoot.gold && G.souls===firstLoot.souls && G.runeBag.length===firstLoot.runes'),'a raised corpse cannot pay loot again');
ok(run('G.corpses.length===0'),'a corpse cannot be raised repeatedly');
graveyard();run('updateEnemies(.1);enemy.stun=1;updateEnemies(.1);');
ok(run('!enemy.raiseCast && victim.dead'),'stun interrupts revival');
graveyard();run('updateEnemies(.1);enemy.hp=0;killEnemy(enemy);for(let i=0;i<12;i++)updateEnemies(.1);');
ok(run('victim.dead'),'killing the caster cancels revival');
graveyard();run('G.buff.noSummon=true;updateEnemies(.1);');
ok(run('!enemy.raiseCast && victim.dead'),'no-summon counter also blocks revival');
graveyard();run('G.summonsThisWave=120;updateEnemies(.1);for(let i=0;i<10;i++)updateEnemies(.1);');
ok(run('victim.dead && G.summonsThisWave===120'),'revival respects infinite-mode summon limits');
graveyard();run('enemy.stun=100;for(let i=0;i<130;i++)updateEnemies(.1);');
ok(run('G.corpses.length===0'),'remains expire instead of accumulating');
graveyard();run('startWave();');ok(run('G.corpses.length===0'),'new wave clears old remains');
graveyard();run('updateEnemies(.1);JSON.stringify(G);globalThis.saved=SaveSystem.capture();JSON.stringify(saved);newGame(saved);');
ok(run('G.corpses.length===0 && G.enemies.length===0'),'loading restarts the wave without serializing cyclic corpse/cast references');
fixture();run('enemy.state="room";enemy.target=building;enemy.x=building.x-20;enemy.y=building.y;enemy.atkCd=0;G.buff.freeze=1;updateEnemies(.1);');
ok(run('building.hp===building.maxHp'),'global freeze also prevents attacks');
for(const [type,timer,status]of [['emp','empT','empT'],['frostbane','fzT','freezeT']]) {
  fixture(type);run(`enemy.x=300;enemy.y=building.y;enemy.${timer}=0;enemy.stun=1;updateEnemies(.1);`);
  ok(run(`!(building.${status}>0)`),type+' ability is stopped by control');
  run('enemy.stun=0;updateEnemies(.1);');ok(run(`building.${status}>0`),type+' ability resumes after control');
}
fixture('healer');run(`enemy.x=250;enemy.y=building.y;globalThis.ally=spawnEnemy('grunt',1,1);ally.x=240;ally.y=enemy.y;ally.hp=1;enemy.stun=1;updateEnemies(.5);`);
ok(run('ally.hp===1'),'stunned healer cannot cast');run('enemy.stun=0;updateEnemies(.5);');ok(run('ally.hp>1'),'healing resumes after control');
fixture();run('for(let i=0;i<100;i++){const e=spawnEnemy("grunt",1,1);e.hp=0;killEnemy(e);}');
ok(run('G.corpses.length<=64'),'corpse memory is bounded during dense waves');
ok(g.errors.length===0,g.errors.join('\n'));
console.log('Enemy action regression: '+checks+' checks passed');
