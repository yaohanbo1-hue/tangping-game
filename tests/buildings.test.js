const assert=require('node:assert/strict');
const {createGame}=require('./runtime');
const g=createGame(918),run=code=>g.run(code);let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
function fixture(type,branch) {
  run(`newGame();G.experience='combat';G.gold=1e7;G.power=1e7;G.souls=1e5;
    ACHIEVEMENTS.forEach(a=>G.ach[a.id]=1); // isolate purchase costs from one-time achievement income
    tryBuild('${type}',0,2);globalThis.tower=G.buildings[0];setBuildingLevel(tower,6);statFrame++;
    ${branch?`tryBranch(tower,'${branch}');statFrame++;`:''}
    G.wave=10;G.state='wave';G.spawnQueue=[];G.bossQueue=[];
    globalThis.target=spawnEnemy('grunt',10,1);target.x=300;target.y=tower.y;target.hp=target.maxHp=1e6;
    target.res={};target.weak={};target.flat=0;target.shield=0;target.elem={};`);
}
for(const type of run('BUILD_KEYS')) for(const branch of ['a','b']) {
  fixture(type,null);
  run('globalThis.beforeCost={gold:G.gold,souls:G.souls};bstat(tower);');
  ok(run(`tryBranch(tower,'${branch}')`),type+branch+' can purchase at Lv6');
  ok(run(`G.gold===beforeCost.gold-tower.def.branch.${branch}.cost.gold && G.souls===beforeCost.souls-tower.def.branch.${branch}.cost.soul`),type+branch+' costs are real');
  ok(run(`tower.branch==='${branch}' && tower.hp===tower.maxHp`),type+branch+' state committed');
  ok(run('Object.values(bstat(tower)).every(v=>typeof v!=="number"||Number.isFinite(v))'),type+branch+' stats finite');
  ok(run('!tryBranch(tower,"a") && !tryBranch(tower,"b")'),type+branch+' cannot buy twice');
  for(const level of [6,25,50]) {
    run(`setBuildingLevel(tower,${level});statFrame++;`);
    ok(run('Object.values(bstat(tower)).every(v=>typeof v!=="number"||Number.isFinite(v))'),type+branch+' finite at Lv'+level);
    ok(run('!/(NaN|undefined|Infinity)/.test(tower.def.statText(bstat(tower)))'),type+branch+' usable description at Lv'+level);
  }
  fixture(type,null);run('G.gold=0;G.souls=0;');
  ok(run(`!tryBranch(tower,'${branch}') && !tower.branch && G.gold===0 && G.souls===0`),type+branch+' insufficient funds leaves state intact');
}
for(const type of run('BUILD_KEYS')) for(const branch of [null,'a','b']) {
  fixture(type,branch);
  if(run('tower.def.tower')) {
    run('updateTowers(.1);updateBullets(1);');
    ok(run('target.hp<1e6 && G.stats.dmg>0'),type+branch+' produces actual damage');
  } else if(type==='generator') {
    run('globalThis.powerBefore=G.power;updateEconomy(1);updateTowers(.1);');
    ok(run('G.power>powerBefore'),type+branch+' produces power');
    if(branch==='b')ok(run('target.hp<1e6'),'generator coil actually attacks');
  } else if(type==='miner') {
    run('globalThis.goldBefore=G.gold;updateEconomy(1);');
    ok(run('G.gold-goldBefore>bedGold()'),'miner'+branch+' really produces extra gold');
    if(branch==='b') {run('G.souls=0;endWave();');ok(run('G.souls>=2'),'refinery produces souls');}
  } else if(type==='repair') {
    run('G.doors[1].hp-=100;globalThis.hpBefore=G.doors[1].hp;updateEconomy(1);');
    ok(run('G.doors[1].hp>hpBefore'),'repair'+branch+' heals the lane');
  } else if(type==='shield') {
    run('updateEconomy(1);');ok(run('G.doors[1].shieldMax>0 && G.doors[1].shield>0'),'shield'+branch+' protects the lane');
  } else if(type==='amp') {
    run("tryBuild('turret',1,2);statFrame++;");
    ok(run('towerDmgMul(G.buildings[1])>1'),'amplifier'+branch+' increases neighbouring tower damage');
  } else if(type==='bank') {
    run('G.gold=1000;G.souls=0;endWave();globalThis.bankResult={gold:G.gold,souls:G.souls};');
    const withBank=run('JSON.stringify(bankResult)');fixture(type,branch);
    run('G.gold=1000;G.souls=0;G.buildings=[];endWave();');
    ok(run(`G.gold<(${withBank}).gold`),'bank'+branch+' pays actual interest');
    if(branch==='b')ok(run(`G.souls+6===(${withBank}).souls`),'soul exchange pays six souls');
  }
}
for(const branch of ['a','b']) {
  fixture('poison',branch);run('updateTowers(.02);updateBullets(1);');
  ok(run('target.poison===1 && target.poisonDps>0 && target.poisonSrc===tower'),'poison'+branch+' really inflicts attributed poison');
  ok(run('bstat(tower).rate>1'),'poison'+branch+' retains attack cadence');
}
fixture('poison','a');
run(`globalThis.neighbors=Array.from({length:4},(_,i)=>{const e=spawnEnemy('grunt',10,1);e.x=target.x-10-i*10;e.y=target.y;e.hp=e.maxHp=1e6;return e;});
  updateTowers(.02);updateBullets(1);`);
ok(run('neighbors.filter(e=>e.poison>0).length===3'),'plague infects up to three nearby enemies');
ok(run('neighbors[0].poisonDps===target.poisonDps*.5 && neighbors[0].poisonSrc===tower'),'infection has half potency and source');
fixture('repair','b');run('updateEconomy(.1);');
ok(run('target.hp===1e6 && tower.shieldMax>0 && tower.shield>0'),'repair shield branch supplies a real standalone shield');
fixture('tesla','b');
run(`globalThis.neighbor=spawnEnemy('grunt',10,1);neighbor.x=target.x-12;neighbor.y=target.y+12;neighbor.hp=1e6;
  globalThis.other=spawnEnemy('grunt',10,1);other.x=target.x-16;other.y=target.y-12;other.hp=1e6;fire_(tower,target,bstat(tower));`);
ok(run('bstat(tower).chain<BUILD_DEFS.tesla.stat(6).chain'),'pulse sacrifices chain length');
ok(run('target.stun>0 && neighbor.stun>0 && other.stun>0'),'pulse stuns targets around impact, not only the chain');
fixture('missile','b');
run(`globalThis.neighbor=spawnEnemy('grunt',10,1);neighbor.x=target.x-180;neighbor.y=target.y;neighbor.hp=1e6;neighbor.res={};neighbor.weak={};
  fire_(tower,target,bstat(tower));updateBullets(1);`);
ok(run('neighbor.hp<1e6'),'missile explosion is centred on impact, independent of flight step');
for(const branch of [null,'a','b']) {
  fixture('frost',branch);run('setBuildingLevel(tower,50);statFrame++;fire_(tower,target,bstat(tower));updateBullets(1);target.stun=0;');
  ok(run('target.slow<=.85 && enemySpeed(target)>0'),'high frost '+branch+' cannot reverse enemy movement');
}
fixture('turret',null);run('globalThis.oldDamage=bstat(tower).dmg;tryUpgrade(tower);');
ok(run('bstat(tower).dmg>oldDamage'),'upgrade invalidates same-frame cached stats');
fixture('poison',null);run('bstat(tower);tryBranch(tower,"a");');
ok(run('bstat(tower).spread===true'),'branch invalidates same-frame cached stats');
ok(g.errors.length===0,g.errors.join('\n'));
console.log('Building and branch regression: '+checks+' checks passed');
