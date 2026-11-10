// A deterministic player policy: normal starting resources and real combat.
// No HP writes, free money, forced kills, admin mode or skipped Boss phases.
const fs = require('node:fs');
const path = require('node:path');
const { createGame } = require('./runtime');

function campaign({ seed = 20261106, difficulty = 'normal', profile = 'balanced', maxWave = 60, seconds = 7200, log = false, watchChoices = false } = {}) {
  const game = createGame(seed);
  game.run(`newGame(); G.experience='combat'; G.diffKey=${JSON.stringify(difficulty)};
    G.prepTimer*=diffCfg().prepMul; G.prepTotal=G.prepTimer; paused=false;
    globalThis.policyProfile=${JSON.stringify(profile)};
    globalThis.policyWatch=${JSON.stringify(watchChoices)};globalThis.policyWatchLog=[];
    globalThis.policyClock=0; globalThis.policyNext=0; globalThis.policyWave=0;
    globalThis.policyActions={build:0,upgrade:0,branch:0,tech:0,rune:0,skills:0};
    globalThis.policySamples=[]; globalThis.policyBosses=[];
    const policyBossStart=new Map(), policyBossPhases=new Map(), policySpawn=spawnEnemy, policyKill=killEnemy;
    spawnEnemy=function(...args) { const e=policySpawn(...args); if(e && e.boss) {policyBossStart.set(e,policyClock);policyBossPhases.set(e,new Set([0]));} return e; };
    killEnemy=function(e,...args) { if(e && !e.dead && e.boss) policyBosses.push({wave:G.wave,boss:e.bossKey,seconds:+(policyClock-policyBossStart.get(e)).toFixed(2),phases:[...policyBossPhases.get(e)],expectedPhases:bossPhases(e).length,hp:e.maxHp,casts:e.encounter && e.encounter.casts || 0,interrupts:e.encounter && e.encounter.interrupts || 0,pulses:e.encounter && e.encounter.pulses || 0}); return policyKill(e,...args); };
    const policyPlan=[
      ['miner',2,0], ['turret',0,0], ['turret',0,2], ['turret',0,4],
      ['frost',0,1], ['repair',1,1], ['generator',2,4], ['repair',1,3],
      ['laser',1,0], ['tesla',1,2], ['poison',1,4], ['frost',0,3],
      ['shield',2,1], ['amp',2,2], ['miner',2,3],
      ['prism',3,0], ['missile',3,1], ['sonic',3,2], ['gravity',3,3], ['laser',3,4],
      ['prism',4,0], ['laser',4,1], ['prism',4,2], ['laser',4,3], ['prism',4,4],
      ['laser',5,0], ['prism',5,1], ['laser',5,2], ['prism',5,3], ['laser',5,4],
      ['laser',6,0], ['prism',6,1], ['laser',6,2], ['prism',6,3], ['laser',6,4],
      ['prism',7,0], ['laser',7,3], ['prism',7,4],
    ];
    if(policyProfile==='economy') { policyPlan[14][0]='bank'; policyPlan[15][0]='miner'; }
    if(policyProfile==='damage') { policyPlan[0][0]='turret'; policyPlan[14][0]='laser'; }
    if(policyProfile==='no-control')for(const entry of policyPlan)if(['frost','tesla','sonic','gravity'].includes(entry[0]))entry[0]=entry[0]==='frost'?'turret':'laser';
    const policyBranches={turret:'a',frost:'b',laser:'a',tesla:'a',flame:'a',poison:'b',sonic:'b',gravity:'a',prism:'b'};
    const policyTech=['economy','firepower','rapid','structure','ironwall','crit','electric','overload','swift','focus','mining','sleep','vitality','harvest','greed','fortify','berserk','compound','critmaster','soulstorm','overcore','annihilation','runemaster','runelord','fortress','eternity'];
    function policyAct() {
      if(policyWatch && G.state==='build'){
        const offer=NightWatch.view();
        if(offer.available){
          const choices=offer.choices.filter(c=>c.id!=='pass'&&!c.disabled);
          const preferred=Math.floor((G.wave-2)/4)%2?'venture':'prepare';
          const choice=choices.find(c=>c.id===preferred)||choices[0]||offer.choices.find(c=>c.id==='pass');
          if(choice&&NightWatch.choose(choice.id))policyWatchLog.push({wave:G.wave,nextWave:offer.nextWave,title:offer.title,choice:choice.id,cost:choice.cost,reward:choice.reward});
        }
      }
      const alive=G.enemies.filter(e=>!e.dead), boss=alive.some(e=>e.boss);
      const close=alive.some(e=>e.x>WALL_X-40);
      if(G.doors.some(d=>d.hp<d.maxHp*.5) || G.bed.hp<G.bed.maxHp*.65) {
      if(G.skills.mend<=0) {useSkill('mend');policyActions.skills++;}
      }
      const cast=(key,condition)=>{if(condition && G.skills[key]<=0) {useSkill(key);policyActions.skills++;}};
      cast('siphon',alive.length>=4 || boss); cast('meteor',alive.length>=8 || boss);
      cast('overclock',alive.length>=12 || boss); if(policyProfile!=='no-control')cast('freeze',alive.some(e=>e.boss && e.encounter && e.encounter.cast) || close && (alive.length>=10 || boss));
      if(policyProfile!=='no-control')cast('repel',alive.some(e=>e.x>WALL_X+40));
      for(const [type,c,r] of policyPlan) {
        if(!G.grid[r*COLS+c]) {
          if(G.gold>=BUILD_DEFS[type].cost.gold && tryBuild(type,c,r)) policyActions.build++;
          break;
        }
      }
      // Investments are bought through their real costs. Their income can fund later decisions.
      const wantedIncome=(policyProfile==='economy'?110:policyProfile==='damage'?20:policyProfile==='relaxed'?45:60)*Math.max(1,G.wave)+30;
      if(totalGoldRate()<wantedIncome) {
        const investments=G.buildings.filter(b=>b.type==='miner' && b.level<24).sort((a,b)=>a.level-b.level);
        const mine=investments[0];
        if(mine && canAfford(upgradeCost(mine.def,mine.level)) && tryUpgrade(mine)) policyActions.upgrade++;
        else if(G.bed.lv<24 && G.gold>=bedUpgradeCost(G.bed.lv)*1.2) upgradeBed();
      }
      for(const b of G.buildings) {
        if(b.level>=BRANCH_AT && !b.branch) {
          const branch=policyBranches[b.type] || 'a', def=b.def.branch[branch];
          if(canAfford(def.cost) && tryBranch(b,branch)) policyActions.branch++;
        }
      }
      const targetLevel=policyProfile==='relaxed'?Math.min(19,2+Math.floor(G.wave*.28)):Math.min(22,3+Math.floor(G.wave*.32));
      const upgrades=G.buildings.filter(b=>b.type!=='miner' && b.type!=='bank' && b.level<targetLevel)
        .sort((a,b)=>upgradeCost(a.def,a.level).gold-upgradeCost(b.def,b.level).gold);
      for(const b of (policyProfile==='relaxed'?upgrades.slice(0,2):upgrades)) if(canAfford(upgradeCost(b.def,b.level)) && tryUpgrade(b)) policyActions.upgrade++;
      for(const door of G.doors) if((door.hp<door.maxHp*.75 || door.lv<Math.min(12,2+Math.floor(G.wave*.2))) && G.gold>=doorUpgradeCost(door.lv)) upgradeDoor(door);
      const available=policyTech.filter(k=>G.tech[k]<TECH_DEFS[k].max && !techLocked(k));
      available.sort((a,b)=>G.tech[a]-G.tech[b] || policyTech.indexOf(a)-policyTech.indexOf(b));
      if(available[0] && G.souls>=TECH_DEFS[available[0]].cost(G.tech[available[0]])) {buyTech(available[0]);policyActions.tech++;}
      const towers=G.buildings.filter(b=>b.def.tower).sort((a,b)=>b.level-a.level);
      for(const b of towers) {
        if(policyProfile==='no-runes')break;
        if(!G.runeBag.length) break;
        if(ensureRuneSlots(b).some(r=>!r) && socketRune(b,G.runeBag[0].id)) policyActions.rune++;
      }
    }
    globalThis.policyTick=function() {
      if(G.over || paused) return;
      policyClock+=1/60; statFrame++;
      if(policyClock>=policyNext) {policyNext=policyClock+(policyProfile==='relaxed'?2.5:1);policyAct();}
      step(1/60);
      G.enemies.forEach(e=>{if(e.boss && policyBossPhases.has(e)) policyBossPhases.get(e).add(e.phase);});
      if(G.wave!==policyWave) {
        policyWave=G.wave;
        policySamples.push({wave:G.wave,seconds:+policyClock.toFixed(2),gold:Math.round(G.gold),income:Math.round(totalGoldRate()),
          buildings:G.buildings.length,meanLevel:+(G.buildings.reduce((s,b)=>s+b.level,0)/Math.max(1,G.buildings.length)).toFixed(2),
          kills:G.stats.kills,leaks:G.stats.leaks,damage:Math.round(G.stats.dmg),bedHp:Math.round(G.bed.hp),tech:Object.values(G.tech).reduce((a,b)=>a+b,0),
          dps:Math.round(G.buildings.reduce((sum,b)=>sum+(b.def.tower?towerDisplayDps(bstat(b),b):0),0))});
      }
    };
  `);
  const tick=game.run('policyTick');
  const inspect=game.run('()=>({over:G.over,wave:G.wave,waveTime:G.waveTime,state:G.state,samples:policySamples.length})');
  let last=0, stop='time-limit';
  for(let i=0;i<seconds*60;i++) {
    tick(); game.advance(1000/60);
    if(i%60!==0) continue;
    const state=inspect();
    if(state.samples!==last) {last=state.samples;if(log) console.log(JSON.stringify(game.run('policySamples[policySamples.length-1]')));}
    if(game.errors.length) {stop='runtime-error';break;}
    if(state.over) {stop=state.state;break;}
    if(state.wave>maxWave) {stop='wave-limit';break;}
    if(state.waveTime>900) {stop='wave-stall';break;}
  }
  const result=game.run(`({won:G.state==='win',wave:G.wave,seconds:+policyClock.toFixed(2),gold:Math.round(G.gold),power:Math.round(G.power),souls:Math.round(G.souls),
    kills:G.stats.kills,damage:Math.round(G.stats.dmg),leaks:G.stats.leaks,bedHp:G.bed.hp,buildings:G.buildings.length,actions:policyActions,
    samples:policySamples,bosses:policyBosses,endingIds:META.endingIds,admin:G.admin,prizes:G.prize,lotteryRolls:G.lot.n,
    buffs:{fate:G.fate,tech:G.tech},topTowers:G.buildings.filter(b=>b.def.tower).map(b=>({type:b.type,level:b.level,branch:b.branch,
      stats:bstat(b),damageMul:towerDmgMul(b),rateMul:towerRateMul()*towerRateMulOn(b),runes:b.runes})).slice(0,5)})`);
  return {seed,difficulty,profile,stop,videos:game.videos,errors:game.errors,...result,...(watchChoices?{watchLog:game.run('policyWatchLog')}:{} )};
}
if(require.main===module) {
  const arg=k=>{const a=process.argv.find(a=>a.startsWith('--'+k+'='));return a && a.split('=')[1];};
  const result=campaign({seed:+arg('seed') || 20261106,difficulty:arg('difficulty') || 'normal',profile:arg('profile') || 'balanced',maxWave:+arg('max-wave') || 60,log:!process.argv.includes('--quiet')});
  fs.mkdirSync(path.join(__dirname,'..','artifacts'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'..','artifacts','campaign-'+result.profile+'-'+result.difficulty+'-'+result.seed+'.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({won:result.won,wave:result.wave,seconds:result.seconds,leaks:result.leaks,errors:result.errors,stop:result.stop}));
  if(result.errors.length) process.exitCode=1;
}
module.exports={campaign};
