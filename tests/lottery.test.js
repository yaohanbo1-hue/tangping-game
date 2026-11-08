const assert=require('node:assert/strict'),{createGame}=require('./runtime');let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const g=createGame(72),run=code=>g.run(code);
function fixture(){run(`newGame();G.experience='combat';G.gold=G.power=1e8;G.souls=1e6;ACHIEVEMENTS.forEach(a=>G.ach[a.id]=1);
  tryBuild('turret',0,0);setBuildingLevel(G.buildings[0],6);startWave();G.enemies=[];`);}
for(const id of run('LOTTERY_POOL.map(p=>p.id)'))for(const currency of ['gold','soul']){
  fixture();run(`globalThis.before=JSON.stringify(G.lot);globalThis.draw=rollLotteryItem;rollLotteryItem=()=>LOTTERY_POOL.find(p=>p.id===${JSON.stringify(id)});
    drawLottery(1,${JSON.stringify(currency)});rollLotteryItem=draw;globalThis.after={gold:G.gold,souls:G.souls,door:G.doors[0].maxHp,bed:G.bed.maxHp,level:G.buildings[0].level,branch:G.buildings[0].branch};
    globalThis.snapshot=SaveSystem.capture();newGame(snapshot);`);
  ok(run('G.gold===after.gold && G.souls===after.souls'),id+' '+currency+' gift and real cost survive wave restart');
  ok(run('G.doors[0].maxHp===after.door && G.bed.maxHp===after.bed'),id+' '+currency+' defenses survive reload');
  ok(run('G.buildings[0].level===after.level && G.buildings[0].branch===after.branch'),id+' '+currency+' upgrades survive reload');
  run('globalThis.snapshot2=SaveSystem.capture();newGame(snapshot2);');
  ok(run('G.gold===after.gold && G.souls===after.souls'),id+' '+currency+' second restore cannot pay again');
}
fixture();run(`G.buildings=[];G.grid.fill(null);globalThis.gold=G.gold;LOTTERY_POOL.find(p=>p.id==='c1').apply();`);
ok(run('G.gold===gold+2000 && LOTTERY_POOL.find(p=>p.id==="c1").desc.includes("阶段护甲")'),'empty clear really pays and explains Boss limits');
fixture();run("G.buildings.forEach(b=>setBuildingLevel(b,50));globalThis.beforeGold=G.gold;LotteryRewards.settle(LOTTERY_POOL.find(p=>p.id==='u3'));");
ok(run('G.gold===beforeGold+3000'),'full-level upgrade fallback really pays');
fixture();run('G.doors.forEach(d=>setDoorLevel(d,50));globalThis.beforeGold=G.gold;for(let i=0;i<10;i++)LotteryRewards.upgradeDoors();');
ok(run('G.doors.every(d=>d.lv===50 && d.maxHp===doorMaxHp(50))'),'repeated prize cannot bypass the door level cap');
ok(run('G.gold===beforeGold+12000'),'capped doors get the advertised replacement');
fixture();run('globalThis.base=G.doors[0].maxHp;for(let i=0;i<100;i++)LotteryRewards.fortify();');
ok(run('G.lot.hpBonus===2 && G.doors[0].maxHp===base*3'),'one hundred guardian prizes remain at +200%');
run('setDoorLevel(G.doors[0],2);setBedLevel(2);');ok(run('G.doors[0].maxHp===doorMaxHp(2) && G.bed.maxHp===bedMaxHp(2)'),'normal upgrades retain guardian bonus');
run('globalThis.snapshot=SaveSystem.capture();snapshot.progress.lot.hpBonus=1e99;newGame(snapshot);');ok(run('G.lot.hpBonus===2'),'import cannot exceed the new defense cap');
fixture();run("bstat(G.buildings[0]);globalThis.oldDamage=bstat(G.buildings[0]).dmg;LotteryRewards.settle(LOTTERY_POOL.find(p=>p.id==='u2'));");
ok(run('bstat(G.buildings[0]).dmg>oldDamage'),'free upgrades immediately invalidate cached attributes');
fixture();run("G.wave=60;globalThis.boss=spawnEnemy('final',60,1);for(let i=0;i<20;i++)LotteryRewards.clear();globalThis.hpAfter=boss.hp;");
ok(run('!boss.dead && boss.phaseBarrier>0 && boss.phaseNext===1'),'repeated clear prize stops at the first Boss phase gate');
run('LotteryRewards.clear();');ok(run('boss.hp===hpAfter'),'clear respects visible transition immunity');
fixture();run("globalThis.enemy=spawnEnemy('colossus',1,1);LotteryRewards.clear();");ok(run('enemy.dead'),'legendary clear can settle all ordinary armor segments');
fixture();run('globalThis.epicGap=0;globalThis.legendGap=0;globalThis.maxEpic=0;globalThis.maxLegend=0;for(let i=0;i<2000;i++){const p=rollLotteryItem();epicGap++;legendGap++;if(p.r===\'epic\'||p.r===\'legend\'){maxEpic=Math.max(maxEpic,epicGap);epicGap=0;}if(p.r===\'legend\'){maxLegend=Math.max(maxLegend,legendGap);legendGap=0;}}');
ok(run('maxEpic<=12 && maxLegend<=40 && G.lot.n===2000'),'real weighted lottery preserves both pity bounds across 2000 rolls');
fixture();run("globalThis.before=G.gold;drawLottery(1,'bad');drawLottery(100,'gold');G.gold=0;drawLottery(1,'gold');");
ok(run('G.gold===0 && G.lot.n===0'),'invalid or unaffordable requests never roll');
ok(g.errors.length===0,g.errors.join('\n'));console.log('Lottery settlement, reload and bounded extremes: '+checks+' checks passed');
