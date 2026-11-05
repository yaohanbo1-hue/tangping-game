// Reproducible controlled-budget combat scenarios, not a player-completion proof.
const fs = require('node:fs');
const path = require('node:path');
const {createGame} = require('./runtime');
const profiles = {
  economy: ['miner','miner','bank','generator','repair','shield','amp','turret','frost','laser','tesla','flame','poison','missile'],
  balanced: ['miner','generator','repair','shield','amp','frost','poison','tesla','laser','turret','missile','sonic','prism','gravity'],
  damage: ['generator','amp','turret','turret','laser','laser','tesla','tesla','flame','poison','missile','sonic','prism','turret'],
};
function scenario(profile,wave,legacy,seed=8841) {
  const g=createGame(seed), budget=Math.round(1600+wave*wave*80);
  g.run(`newGame(); G.experience='combat'; G.mode='unlimited'; G.wave=${wave-1}; G.gold=${budget}; G.power=${budget}; G.souls=300;
    if (${legacy}) EnemyBalance.curve=()=>1;
    globalThis.simTime=0; globalThis.bossDurations=[]; globalThis.lifeDurations=[];
    globalThis.totalSpawnHp=0; globalThis.maxEnemyHp=0;
    const originalSpawn=spawnEnemy, originalKill=killEnemy, originalDamage=applyDamage;
    spawnEnemy=function(...args) { const e=originalSpawn(...args); if (e) {
      e.simSpawn=simTime; totalSpawnHp+=e.maxHp+(e.shield || 0); maxEnemyHp=Math.max(maxEnemyHp,e.maxHp);
    } return e; };
    applyDamage=function(e,...args) { if(e && !e.dead && e.simFirstHit===undefined) e.simFirstHit=simTime; return originalDamage(e,...args); };
    killEnemy=function(e,...args) { if(e && !e.dead) {
      if(e.boss) bossDurations.push(simTime-e.simSpawn);
      lifeDurations.push(simTime-(e.simFirstHit===undefined ? e.simSpawn : e.simFirstHit));
    } return originalKill(e,...args); };
  `);
  const types=profiles[profile];
  g.run(`[${types.map(t=>"'"+t+"'").join(',')}].forEach((type,i)=>tryBuild(type,Math.floor(i/5),i%5));
    for (let pass=0;pass<16;pass++) {
      const order=G.buildings.slice().sort((a,b)=>upgradeCost(a.def,a.level).gold-upgradeCost(b.def,b.level).gold);
      order.forEach(b=>{ if(b.level<12) tryUpgrade(b); });
      G.doors.forEach(d=>{ if(d.lv<14) upgradeDoor(d); });
      if(G.bed.lv<12) upgradeBed();
    }
    G.buildings.forEach(b=>{ if(b.level>=6) tryBranch(b,(b.type==='turret' || b.type==='frost') ? 'b' : 'a'); });
    G.resDirty=true; computeResonance(); statFrame++;
    globalThis.initialDps=G.buildings.reduce((sum,b)=>{const s=bstat(b); return sum+towerPanelDps(s,b)*towerDmgMul(b)*towerRateMulOn(b);},0);
    globalThis.initialGold=G.gold; globalThis.initialIncome=totalGoldRate();
    paused=false; startWave();`);
  let elapsed=0;
  for(let frame=0;frame<3600;frame++) {
    g.run("simTime+=0.05; statFrame++; if(!G.over && !paused) step(0.05);");
    g.advance(50); elapsed+=0.05;
    if(g.run("G.over || G.state==='build'")) break;
  }
  const data=g.run(`({
    cleared:G.over && G.state==='win' || (G.state==='build' && !G.spawnQueue.length && !G.bossQueue.length && !G.enemies.length),
    hp:Math.round(totalSpawnHp), maxHp:Math.round(maxEnemyHp), panelDps:Math.round(initialDps),
    effectiveDps:Math.round(G.stats.dmg/Math.max(0.05,simTime)), kills:G.stats.kills,
    meanKillSeconds:lifeDurations.length ? +(lifeDurations.reduce((a,b)=>a+b,0)/lifeDurations.length).toFixed(2) : null,
    doorBreaks:G.stats.leaks, doorBreakRate:+(G.stats.leaks/3).toFixed(3),
    bossSeconds:bossDurations.map(n=>+n.toFixed(2)), bossSurvivors:G.enemies.filter(e=>e.boss && !e.dead).length,
    gold:Math.round(G.gold), initialGold:Math.round(initialGold), initialIncome:Math.round(initialIncome), finalIncome:Math.round(totalGoldRate())
  })`);
  if(g.errors.length) throw new Error(g.errors.join('\n'));
  return {profile,wave,healthModel:legacy?'v1.9.2':'v2',seed,budget,elapsed:+elapsed.toFixed(2),...data};
}
if (require.main===module) {
  const results=[];
  const waves=process.argv.includes('--quick')?[30]:[10,20,30,40,50,55,60,120,500];
  for(const profile of Object.keys(profiles)) for(const wave of waves) for(const legacy of [true,false]) {
    const row=scenario(profile,wave,legacy); results.push(row); console.log(JSON.stringify(row));
  }
  const dir=path.join(__dirname,'..','artifacts');
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'balance-simulation.json'),JSON.stringify({note:'Controlled-budget scenarios; legacy changes HP curve only. Not a full player run.',results},null,2));
}
module.exports={scenario};
