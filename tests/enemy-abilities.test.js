// Exercise the actual AI/damage pipeline, not a duplicate model of enemy data.
const assert=require('node:assert/strict'),{createGame}=require('./runtime');
const g=createGame(4021),run=s=>g.run(s);let checks=0;const failures=[];
function ok(value,label){checks++;if(!value)failures.push(label);}
function fixture(type='grunt') {
  run(`newGame();G.experience='combat';G.gold=10000;G.wave=1;G.state='wave';G.spawnQueue=[];G.bossQueue=[];
    ACHIEVEMENTS.forEach(a=>G.ach[a.id]=1);tryBuild('turret',0,2);globalThis.tower=G.buildings[0];tower.hp=tower.maxHp=10000;
    globalThis.enemy=spawnEnemy('${type}',1,1);enemy.x=300;enemy.y=tower.y;`);
}
function contact(type) {
  fixture(type);run('enemy.state="room";enemy.target=tower;enemy.x=tower.x-20;enemy.y=tower.y;enemy.atkCd=0;');
}
contact('vampire');run('enemy.hp=500;enemy.maxHp=1000;G.fate.def=.5;globalThis.oldHP=tower.hp;updateEnemies(.1);');
ok(run('Math.abs(enemy.hp-500-(oldHP-tower.hp)*.4)<1e-8'),'innate vampire heals 40% of actual post-defense damage');
contact('vampire');run('enemy.hp=500;enemy.maxHp=1000;tower.hp=1;updateEnemies(.1);');
ok(run('Math.abs(enemy.hp-500.4)<1e-8'),'vampire cannot heal from overkill');
contact('vampire');run('enemy.hp=500;enemy.maxHp=1000;G.admin=true;updateEnemies(.1);');
ok(run('enemy.hp===500 && tower.hp===10000'),'admin immunity yields no vampire healing');
fixture('vampire');run('enemy.hp=500;enemy.maxHp=1000;enemy.state="door";enemy.door=G.doors[1];enemy.atkCd=0;G.doors[1].shield=5;G.fate.def=.5;globalThis.oldHP=G.doors[1].hp+5;updateEnemies(.1);');
ok(run('Math.abs(enemy.hp-500-(oldHP-G.doors[1].hp-G.doors[1].shield)*.4)<1e-8'),'door and shield absorption use the same vampire accounting');

fixture('leech');run('enemy.speed=0;updateEnemies(.1);');
ok(run('tower.hp===tower.maxHp && enemy.parasiteWindup>0'),'parasite announces a wind-up before draining');
run('for(let i=0;i<8;i++)updateEnemies(.1);');
ok(run('tower.hp<tower.maxHp && enemy.parasiteRemaining>0'),'parasite channel really drains after wind-up');
run('enemy.x=50;globalThis.oldHP=tower.hp;updateEnemies(.1);');
ok(run('tower.hp===oldHP && !enemy.parasiteTarget && enemy.parasiteCooldown>0'),'knockback beyond tether range breaks parasite');
fixture('leech');run('enemy.speed=0;updateEnemies(.1);enemy.stun=1;updateEnemies(.1);');
ok(run('!enemy.parasiteTarget && enemy.parasiteCooldown>0 && tower.hp===tower.maxHp'),'stun interrupts parasite wind-up and starts rearm');
fixture('leech');run('enemy.speed=0;for(let i=0;i<90;i++)updateEnemies(.1);');
ok(run('!enemy.parasiteTarget && enemy.parasiteCooldown>0'),'configured eight-second duration cannot become an infinite tether');
fixture('leech');run('enemy.speed=0;updateEnemies(.1);destroyBuilding(tower);updateEnemies(.1);');
ok(run('!enemy.parasiteTarget'),'destroyed or sold building releases parasite references');
fixture('leech');run('enemy.speed=0;updateEnemies(.1);sellBuilding(tower);globalThis.refund=G.gold;sellBuilding(tower);');
ok(run('!enemy.parasiteTarget && G.gold===refund && G.buildings.length===0'),'sell releases tether immediately and repeated clicks cannot refund twice');
fixture('leech');run('enemy.speed=0;enemy.hp=40;G.fate.def=.5;for(let i=0;i<8;i++)updateEnemies(.1);');
ok(run('Math.abs(enemy.hp-40-(tower.maxHp-tower.hp)*.5)<1e-8'),'parasite heal follows real absorbed damage');
for(const step of [.05,.1,.25]) {
  fixture('leech');run(`enemy.speed=0;updateEnemies(${step});while(enemy.parasiteTarget)updateEnemies(${step});`);
  ok(run('Math.abs(tower.maxHp-tower.hp-22*8)<1e-6'),'parasite duration uses real time at '+step+' second steps');
}
contact('leech');run('enemy.hp=40;globalThis.x=enemy.x;for(let i=0;i<8;i++)updateEnemies(.1);');
ok(run('enemy.x===x && tower.maxHp-tower.hp<10'),'channel does not move or add concurrent melee damage');

for(const [type,timer,left,kind]of [['emp','empT',.7,'emp'],['frostbane','fzT',.7,'frost'],['summoner','summonT',4.5,'summon']]) {
  fixture(type);run(`enemy.${timer}=${left};`);
  ok(run(`enemyCastCue(enemy)?.kind==='${kind}'`),type+' actual cooldown has a readable warning');
  run('enemy.stun=1;');ok(run('enemyCastCue(enemy)===null'),type+' control suppresses the imminent warning');
}

contact('berserker');run('enemy.hp=enemy.maxHp*.2;globalThis.oldHP=tower.hp;updateEnemies(.1);');
ok(run('Math.abs(oldHP-tower.hp-enemy.dmg*enemy.def.frenzy.dmg)<1e-8'),'innate frenzy damage multiplier actually applies');
for(const type of run('Object.keys(BOSS_DEFS)')) {
  contact(type);run('enemy.phase=1;enemy.hp=enemy.maxHp*bossPhases(enemy)[1].at;globalThis.expected=enemy.dmg*(enemy.def.buildingBonus||1)*bossPhases(enemy)[1].dmg;globalThis.oldHP=tower.hp;updateEnemies(.1);');
  ok(run('Math.abs(oldHP-tower.hp-expected)<1e-8'),type+' phase damage applies to actual strikes');
}
fixture('rustbug');run('tryBuild("miner",6,2);enemy.x=G.buildings[1].x;enemy.y=G.buildings[1].y;');
ok(run('pickRoomTarget(enemy)===tower'),'rustbug prioritizes a live weapon over a nearer economy building');
run('tower.hp=0;');ok(run('pickRoomTarget(enemy)===G.buildings[1]'),'rustbug falls back after the last weapon dies');
for(const type of ['flier','owl']) {
  fixture(type);run('enemy.x=BED_CX-5;enemy.y=BED_CY;enemy.state="room";enemy.atkCd=0;globalThis.oldHP=G.bed.hp;updateEnemies(.1);');
  ok(run('enemy.target.isBed && G.bed.hp<oldHP'),type+' continues its bed attack after bypassing the door');
}
fixture('bomber');run('enemy.x=BED_CX;enemy.y=BED_CY;enemy.hp=0;globalThis.oldHP=G.bed.hp;killEnemy(enemy);');
ok(run('G.bed.hp<oldHP'),'death explosion can really damage the bed');
fixture('bomber');run('enemy.x=tower.x;enemy.y=tower.y;enemy.explodeN=70;enemy.hp=0;globalThis.oldHP=tower.hp;killEnemy(enemy);');
ok(run('Math.abs(oldHP-tower.hp-enemy.def.explode)<1e-8'),'deadly affix cannot weaken a stronger innate explosion');
fixture('wraith');run('enemy.x=BED_CX;enemy.y=BED_CY;enemy.hp=0;globalThis.oldHP=G.bed.hp;killEnemy(enemy);updateEffects(.1);');
ok(run('Math.abs(oldHP-G.bed.hp-enemy.def.curse.dps*.1)<1e-8'),'curse uses configured DPS against the bed');
fixture();run('G.effects=[];addEffect({type:"curse",x:BED_CX,y:BED_CY,r:20,dps:10,life:.05,maxLife:.05});globalThis.oldHP=G.bed.hp;updateEffects(.1);');
ok(run('Math.abs(oldHP-G.bed.hp-.5)<1e-8'),'expiring curse only damages for its remaining simulation lifetime');

for(const type of ['splitter','echo']) {
  fixture(type);run('enemy.hp=0;killEnemy(enemy);');
  ok(run('G.enemies.filter(e=>e.summoned&&!e.dead).length===enemy.def.split'),type+' actual death spawns declared split count');
}
for(const type of ['summoner','brood']) {
  fixture(type);run('enemy.summonT=enemy.def.summon.every;updateEnemies(.1);');
  ok(run('G.enemies.filter(e=>e.summoned).length===enemy.def.summon.n'),type+' uses actual declared summons');
  fixture(type);run('G.buff.noSummon=true;enemy.summonT=enemy.def.summon.every;updateEnemies(.1);');
  ok(run('G.enemies.length===1'),type+' is countered by summon suppression');
}
for(const type of ['phantom','owl']) {
  fixture(type);run('enemy.speed=0;updateEnemies(.1);');
  ok(run('enemy.untargetable && findTarget(tower,1000)===null'),type+' concealment affects real targeting');
  run('for(let i=0;i<23;i++)updateEnemies(.1);');
  ok(run('!enemy.untargetable && findTarget(tower,1000)===enemy'),type+' has a real reveal window');
}
fixture('mimic');run('enemy.x=80;updateEnemies(.1);');ok(run('enemy.untargetable'),'mimic conceals away from buildings');
run('enemy.x=300;updateEnemies(.1);');ok(run('!enemy.untargetable'),'mimic reveals near a real building');
for(const type of ['digger','saboteur']) {
  fixture(type);run('enemy.x=WALL_X-2;enemy.y=G.doors[1].y;for(let i=0;i<10;i++)updateEnemies(.1);');
  ok(run('enemy.state==="room" && !G.doors[1].broken'),type+' really bypasses an intact door');
}
for(const type of ['warden','weaver']) {
  fixture(type);run('globalThis.ally=spawnEnemy("grunt",1,1);ally.x=enemy.x;ally.y=enemy.y;ally.hp=ally.maxHp=1000;ally.shield=0;updateEnemies(.5);');
  ok(run('ally.shield>0 && ally.shieldMax===1000*enemy.def.ward.shield'),type+' supplies actual configured ally shield');
}
fixture('chronos');run('globalThis.ally=spawnEnemy("grunt",1,1);ally.x=enemy.x;ally.y=enemy.y;updateEnemies(.1);');
ok(run('Math.abs(enemySpeed(ally)/ally.speed-1.5)<1e-8'),'chronos speeds actual ally movement');
fixture('nullifier');run('enemy.x=tower.x;enemy.y=tower.y;');ok(run('towerDmgMul(tower)===.45'),'nullifier reduces real nearby tower output');
run('enemy.hp=0;killEnemy(enemy);');ok(run('towerDmgMul(tower)===1'),'killing nullifier immediately releases its aura');
fixture('reflector');run('globalThis.oldHP=tower.hp;applyDamage(enemy,20,"kinetic",tower);');ok(run('tower.hp<oldHP'),'reflector really damages the firing tower');
fixture('adaptive');run('enemy.hp=enemy.maxHp=10000;for(let i=0;i<30;i++)applyDamage(enemy,1,"fire",tower);');
ok(run('Math.abs(enemy.res.fire-.7)<1e-8'),'adaptive resistance caps at seventy percent');
fixture('colossus');run('applyDamage(enemy,1e9,"shock",tower);');ok(run('enemy.segIdx===1 && !enemy.dead && enemy.hp>0'),'colossus cannot lose multiple armor segments to one hit');
contact('thief');run('globalThis.oldGold=G.gold;globalThis.oldSpent=G.waveSpentGold;updateEnemies(.1);');
ok(run('G.gold<oldGold && G.waveSpentGold-oldSpent===oldGold-G.gold'),'theft changes actual resources and reload-loss ledger');
fixture();run('G.doors[1].hp=2;G.doors[1].shield=3;G.track={doorDmg:0};damageTarget(G.doors[1],1000);');
ok(run('G.doors[1].hp===0 && G.doors[1].shield===0 && G.track.doorDmg===5 && G.stats.laneDamage[1]===2'),'defense loss statistics exclude shield/body overkill');
run('damageTarget(G.bed,NaN);');ok(run('Number.isFinite(G.bed.hp)'),'invalid damage cannot corrupt bed health');
// Force only the affix lottery; all resulting stats and actions remain real.
function elite(keys,type='grunt') {
  fixture(type);run(`G.enemies=[];globalThis.savedPool=AFFIX_KEYS.slice();globalThis.savedRandom=Math.random;
    AFFIX_KEYS.splice(0,AFFIX_KEYS.length,...${JSON.stringify(keys)});Math.random=()=>0;
    try{enemy=spawnEnemy('${type}',35,1);}finally{AFFIX_KEYS.splice(0,AFFIX_KEYS.length,...savedPool);Math.random=savedRandom;}
    enemy.state='room';enemy.target=tower;enemy.x=tower.x-20;enemy.y=tower.y;enemy.atkCd=0;`);
}
elite(['vamp'],'vampire');ok(run('enemy.vamp===.4'),'vamp affix preserves a stronger innate drain');
elite(['vamp']);run('enemy.hp=enemy.maxHp*.5;globalThis.oldHP=enemy.hp;globalThis.towerHP=tower.hp;updateEnemies(.1);');
ok(run('Math.abs(enemy.hp-oldHP-(towerHP-tower.hp)*.35)<1e-6'),'vamp affix heals actual absorbed damage');
elite(['regen']);run('enemy.hp=enemy.maxHp*.5;globalThis.oldHP=enemy.hp;enemy.stun=1;updateEnemies(.1);');
ok(run('Math.abs(enemy.hp-oldHP-enemy.maxHp*.025*.1)<1e-6'),'regen is a real passive and does not bypass control to attack');
const keys=run('AFFIX_KEYS.slice()');
for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++) {
  elite([keys[i],keys[j]]);run('enemy.stun=1;globalThis.oldHP=tower.hp;updateEnemies(.1);');
  ok(run('tower.hp===oldHP'),keys[i]+'+'+keys[j]+' cannot attack through stun');
  run('enemy.stun=0;applyDamage(enemy,1e12,"energy",tower);');
  ok(run('enemy.dead && Number.isFinite(enemy.hp) && G.enemies.length<=3'),keys[i]+'+'+keys[j]+' can be killed and produces at most two children');
}
ok(g.errors.length===0,g.errors.join('\n'));
assert.deepEqual(failures,[],'Actual enemy behavior failures:\n'+failures.join('\n'));
console.log('Enemy ability regression: '+checks+' checks passed');
