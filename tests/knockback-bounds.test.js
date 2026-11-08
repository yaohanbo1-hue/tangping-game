const assert=require('node:assert/strict');
const {createGame}=require('./runtime');const game=createGame(77),run=code=>game.run(code);
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
run(`newGame();G.experience='combat';G.gold=G.power=1e8;G.souls=1e5;tryBuild('sonic',0,2);
  globalThis.tower=G.buildings[0];setBuildingLevel(tower,12);tryBranch(tower,'b');G.tech.rapid=G.tech.swift=10;
  G.wave=20;G.state='wave';G.spawnQueue=[];G.bossQueue=[];globalThis.enemy=spawnEnemy('grunt',20,1);
  enemy.x=310;enemy.y=tower.y;enemy.hp=enemy.maxHp=1e12;enemy.speed=0;enemy.regenR=0;enemy.res={};enemy.weak={};
  for(let i=0;i<600;i++){statFrame++;step(1/60);}`);
ok(run('enemy.x>=8 && enemy.x<=ROOM_X1-8'),'continuous knockback cannot strand a target outside the arena');
for(const state of ['walk','door','room'])for(const [x,y]of [[-1000,-1000],[9999,9999]]){
  run(`enemy.x=${x};enemy.y=${y};enemy.state='${state}';enemy.stun=5;updateEnemies(.01);`);
  ok(run('enemy.x>=8 && enemy.x<=ROOM_X1-8 && enemy.y>=ARENA_TOP+8 && enemy.y<=ARENA_BOT-8'),'stunned '+state+' enemies obey both bounds');
}
run("globalThis.boss=spawnEnemy('final',60,1);boss.x=-1000;boss.y=-1000;boss.phaseBarrier=1;updateEnemies(.01);");
ok(run('boss.x===8 && boss.y===ARENA_TOP+8'),'phase armor cannot bypass the boundary check');
run("boss.x=8;boss.y=LANES[1].doorY;boss.phaseBarrier=0;boss.speed=20;boss.stun=0;G.buff.freeze=0;boss.encounter.cooldown=10;globalThis.before=boss.x;updateEnemies(.1);");
ok(run('boss.x>before'),'boundary correction leaves normal movement working');
assert.deepEqual(game.errors,[]);console.log('Knockback and controlled-enemy arena bounds: '+checks+' checks passed');
