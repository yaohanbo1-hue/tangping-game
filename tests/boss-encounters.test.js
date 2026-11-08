const assert=require('node:assert/strict');
const {createGame}=require('./runtime');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},close=(a,b,m)=>ok(Math.abs(a-b)<1e-6,m);
const game=createGame(45),run=code=>game.run(code);
function fixture(key){run(`newGame();G.experience='combat';G.wave=40;G.state='wave';G.gold=G.power=1e6;G.souls=10000;
  G.doors.forEach(d=>{d.hp=d.maxHp=1e6;});G.bed.hp=G.bed.maxHp=1e6;
  tryBuild('turret',0,2);globalThis.tower=G.buildings[0];tower.hp=tower.maxHp=1e6;
  globalThis.enemy=spawnEnemy('${key}',40,1);enemy.x=280;enemy.y=LANES[1].doorY;enemy.speed=0;enemy.encounter.cooldown=0;`);}
for(const key of ['lord','abyss','machine','void','final']){
  fixture(key);ok(run('JSON.stringify(enemy.res)===JSON.stringify(bossPhases(enemy)[0].res)'),key+' initial phase armor is real');
  run('enemy.speed=20;');close(run('enemySpeed(enemy)'),run('20*bossPhases(enemy)[0].speed'),key+' initial movement multiplier is real');run('enemy.speed=0;');
  run('updateEnemies(.01);globalThis.before=JSON.stringify([G.doors.map(d=>d.hp),G.bed.hp,tower.hp]);');
  ok(run('!!enemy.encounter.cast && enemyCastCue(enemy)?.kind==="boss"'),key+' exposes the actual cast state');
  ok(run('Number.isFinite(enemyCastCue(enemy).left) && enemyCastCue(enemy).total>=1.4'),key+' warning offers a real reaction window');
  const windup=run(`BossEncounters.defs.${key}.windup`);run(`updateEnemies(${windup-.02});`);
  ok(run('before===JSON.stringify([G.doors.map(d=>d.hp),G.bed.hp,tower.hp])'),key+' cannot resolve before its wind-up');
  run('enemy.stun=1;updateEnemies(.01);');
  ok(run('!enemy.encounter.cast && enemy.encounter.interrupts===1 && enemy.encounter.exposed>0'),key+' stun interrupts and exposes a weak point');
  ok(run('before===JSON.stringify([G.doors.map(d=>d.hp),G.bed.hp,tower.hp])'),key+' interruption prevents damage');
  fixture(key);run('updateEnemies(.01);G.buff.freeze=4.5;updateEnemies(.01);');ok(run('!enemy.encounter.cast && enemy.encounter.interrupts===1'),key+' global freeze interrupts');
  fixture(key);run('updateEnemies(.01);killEnemy(enemy);updateEnemies(10);');ok(run('!enemy.encounter.cast && !G.stats.bossCasts'),key+' death cancels a pending action');
  fixture(key);run('updateEnemies(.01);enemy.hp=enemy.maxHp*bossPhases(enemy)[1].at;updateEnemies(.01);');
  ok(run('enemy.phase===1 && !enemy.encounter.cast && G.stats.bossStageRewards===1'),key+' phase change cancels pending damage and grants its reward');
  run('BossEncounters.stage(enemy,1);');ok(run('G.stats.bossStageRewards===1'),key+' cannot repeat a stage reward');
}
fixture('lord');run('updateEnemies(.01);globalThis.x=enemy.x;updateEnemies(1.81);');
ok(run('enemy.x>x && enemy.hasteT>0 && enemy.encounter.casts===1'),'lord advances with a real rally');
fixture('abyss');run('enemy.hp=enemy.maxHp*.8;updateEnemies(.01);globalThis.before=tower.hp;globalThis.bossHP=enemy.hp;updateEnemies(2.21);');
ok(run('tower.hp<before && enemy.hp>bossHP'),'abyss drains its marked target and heals from real damage');
fixture('abyss');run('updateEnemies(.01);sellBuilding(tower);updateEnemies(3);');
ok(run('enemy.encounter.interrupts===1 && enemy.encounter.casts===0'),'selling the marked decoy cancels devour');
fixture('abyss');run('G.admin=true;enemy.hp=enemy.maxHp*.8;updateEnemies(.01);globalThis.bossHP=enemy.hp;updateEnemies(2.21);');
ok(run('enemy.hp===bossHP && tower.hp===tower.maxHp'),'invulnerability cannot produce fake devour healing');
fixture('machine');run('updateEnemies(.01);globalThis.lane=enemy.encounter.cast.lane;globalThis.before=G.doors[lane].hp;updateEnemies(2.01);');
ok(run('G.doors[lane].hp<before && enemy.encounter.exposed>0'),'machine hits its warned lane and then overheats');
close(run('BossEncounters.damageMultiplier(enemy)'),1.5,'overheated core has a measurable weak point');
fixture('void');run('updateEnemies(.01);globalThis.destination=enemy.encounter.cast.lane;');
ok(run('!enemy.untargetable && enemy.alpha===1'),'void reveals itself during the wind-up');
run('updateEnemies(1.91);');ok(run('enemy.lane===destination && enemy.x<WALL_X && enemy.state==="walk"'),'void cannot blink through an intact door');
fixture('void');run('updateEnemies(.01);G.doors[enemy.encounter.cast.lane].broken=true;updateEnemies(1.91);');
ok(run('enemy.x>WALL_X && enemy.state==="room" && enemy.atkCd>0'),'void can exploit a breached lane with a fresh attack warning');
fixture('final');run('updateEnemies(.01);updateEnemies(1.41);');
ok(run('enemy.encounter.cast.beat===1 && G.doors[0].hp<G.doors[0].maxHp && G.doors[1].hp===G.doors[1].maxHp'),'first bell only strikes the first warned lane');
run('updateEnemies(1.11);');ok(run('enemy.encounter.cast.beat===2 && G.doors[1].hp<G.doors[1].maxHp && G.doors[2].hp===G.doors[2].maxHp'),'second bell gives its own warning window');
run('updateEnemies(1.11);');ok(run('!enemy.encounter.cast && enemy.encounter.casts===1 && G.doors[2].hp<G.doors[2].maxHp'),'third bell completes one bounded sequence');
fixture('void');run('G.skills.freeze=30;BossEncounters.stage(enemy,1);enemy.lane=2;BossEncounters.stage(enemy,1);');
close(run('G.skills.freeze'),27,'relocation cannot duplicate a phase reward');
run('globalThis.save=SaveSystem.capture();newGame(save);globalThis.restored=spawnEnemy("void",40,1);globalThis.counter=G.stats.bossStageRewards;BossEncounters.stage(restored,1);');
ok(run('G.stats.bossStageRewards===counter'),'wave-restart saves preserve the paid-stage ledger');
fixture('final');run('G.summonsThisWave=120;enemy.phase=2;enemy.hp=enemy.maxHp*.5;updateEnemies(.01);updateEnemies(5);');
ok(run('G.summonsThisWave===120 && G.enemies.length===1'),'Boss reinforcements obey the shared summon budget');
fixture('lord');run('for(let i=0;i<13;i++){enemy.stun=2;updateEnemies(.1);}');
ok(run('enemy.encounter.controlGuard>3.8 && enemy.stun===0 && !!enemy.encounter.cast'),'repeated weapon stuns cannot permanently prevent Boss actions');
run('G.buff.freeze=4.5;updateEnemies(.1);');
ok(run('!enemy.encounter.cast && enemy.encounter.interrupts===1'),'active freeze still interrupts through weapon-stun resistance');
fixture('void');run('G.bossStageRewards={"40|void|1|1":true,"39|void|1|1":true,"40|void|9|1":true,"40|void|1|2":"true"};globalThis.save=SaveSystem.capture();newGame(save);');
ok(run('Object.keys(G.bossStageRewards).length===1 && G.bossStageRewards["40|void|1|1"]===true'),'stage ledger validates wave, lane, phase and boolean values');
fixture('void');run('globalThis.other=spawnEnemy("void",40,1);G.skills.freeze=30;BossEncounters.stage(enemy,1);BossEncounters.stage(other,1);');
close(run('G.skills.freeze'),24,'different Bosses in the same lane each receive one stage reward');
fixture('final');run('enemy.encounter.cooldown=3;G.buff.freeze=10;for(let i=0;i<3;i++)updateEnemies(1);');
ok(run('enemy.encounter.cooldown===0 && !enemy.encounter.cast'),'cooldowns may recover under control without dispatching an action');
for(const mode of ['limited','unlimited'])for(const wave of [5,20,55,60,65,9995]){
  run(`G.mode='${mode}';`);close(run(`bossCountForWave(${wave})`),run(`buildWaveQueue(${wave}).bossList.length`),'forecast shares the actual Boss count '+mode+wave);
}
for(const key of ['lord','abyss','machine','void','final']){
  run(`newGame();G.wave=60;globalThis.savedPool=AFFIX_KEYS.slice();globalThis.random=Math.random;AFFIX_KEYS.splice(0,AFFIX_KEYS.length,'regen','tough');Math.random=()=>0;
    try{globalThis.target=spawnEnemy('${key}',60,1);}finally{Math.random=random;AFFIX_KEYS.splice(0,AFFIX_KEYS.length,...savedPool);}`);
  ok(run('target.boss && !target.elite && target.affixes.length===0 && !target.regenR'),key+' cannot accidentally inherit regenerative elite affixes');
}
assert.deepEqual(game.errors,[]);console.log('Five Boss encounters and counterplay: '+checks+' checks passed');
