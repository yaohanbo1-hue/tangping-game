const assert=require('node:assert/strict');
const {createGame}=require('./runtime');
const g=createGame(74),run=code=>g.run(code);
let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
function setup() {
  run(`newGame(); G.experience='combat'; G.gold=1000; tryBuild('turret',0,0); globalThis.source=G.buildings[0]; G.wave=1; globalThis.enemy=spawnEnemy('grunt',1,0);
    enemy.hp=enemy.maxHp=100; enemy.shield=enemy.shieldMax=25; enemy.res={}; enemy.weak={};`);
}
setup();
run("applyDamage(enemy,1e9,'kinetic',source)");
ok(run('enemy.hp===0 && enemy.shield===0'),'damage clamps to actual body and shield');
ok(run('G.stats.dmg===125 && G.stats.towerDamage.turret===125'),'summary counts shields without overkill');
ok(run('G.stats.kills===1 && source.kills===1'),'kill attribution remains once');
run("applyDamage(enemy,1e9,'kinetic',source)");
ok(run('G.stats.dmg===125 && G.stats.kills===1'),'dead enemies do not produce output');
setup();
run("[NaN,Infinity,-5,0].forEach(amount=>applyDamage(enemy,amount,'kinetic',source))");
ok(run('enemy.hp===100 && enemy.shield===25 && G.stats.dmg===0'),'invalid damage cannot corrupt health');
setup();
run("enemy.hp=20; enemy.shield=100; enemy.poison=1; enemy.poisonDps=1000; enemy.poisonT=1; enemy.poisonSrc=source; updateEnemies(.1);");
ok(run('enemy.dead && enemy.shield===100'),'poison keeps bypass-shield behavior');
ok(run('G.stats.dmg===20 && G.stats.towerDamage.turret===20'),'poison counts actual damage');
setup();
run("enemy.hp=20; enemy.shield=0; enemy.elem={frost:5}; applyDamage(enemy,100,'fire',source)");
ok(run('G.stats.kills===1 && G.stats.dmg===20 && source.kills===1'),'lethal reactions do not double-count the following hit');
setup();
run("enemy.hp=80; enemy.shield=0; globalThis.neighbor=spawnEnemy('grunt',1,0); neighbor.x=enemy.x;neighbor.y=enemy.y;neighbor.hp=30; triggerReaction(enemy,{id:'overload'},1000,source);");
ok(run('enemy.dead && neighbor.dead && G.stats.kills===2'),'overload resolves every affected death immediately');
ok(run('G.stats.dmg===110 && G.stats.towerDamage.turret===110'),'reaction damage is attributed without duplicate center hit');
for(const frequency of [30,60,120]) {
  setup();
  run(`enemy.hp=enemy.maxHp=10000; enemy.shield=0; enemy.flat=5; for(let i=0;i<${frequency};i++)dotDamage(enemy,60,'kinetic',source,1/${frequency});`);
  ok(run('Math.abs(G.stats.dmg-55)<1e-6'),'continuous armor is frame-rate independent at '+frequency+'Hz');
}
for(const key of run('Object.keys(BOSS_DEFS)')) {
  run(`newGame(); G.experience='combat'; G.gold=1000;tryBuild('turret',0,0);globalThis.source=G.buildings[0]; G.wave=60;globalThis.enemy=spawnEnemy('${key}',60,1);`);
  const phases=run('bossPhases(enemy).length');
  for(let phase=1;phase<phases;phase++) {
    run('applyDamage(enemy,enemy.maxHp*1000,null,source)');
    ok(run(`!enemy.dead && Math.abs(enemy.hp/enemy.maxHp-bossPhases(enemy)[${phase}].at)<1e-9`),'large hit stops at '+key+' phase '+phase);
    run('updateEnemies(.01)');
    ok(run('enemy.phase')===phase,'phase advances once');
    const hp=run('enemy.hp');
    run('EnemyDamage.commit(enemy,enemy.maxHp*1000,source,true); applyDamage(enemy,enemy.maxHp*1000,null,source);');
    ok(run('enemy.hp')===hp,'direct and poison respect visible transition armor');
    run('updateEnemies(1.3)');
    ok(run('enemy.phaseBarrier===0'),'transition armor always expires');
  }
  run('applyDamage(enemy,enemy.maxHp*1000,null,source)');
  ok(run('enemy.dead && G.stats.bossKills===1'),'final phase can be defeated: '+key);
  ok(run('Math.abs(G.stats.dmg-(enemy.maxHp+(enemy.shieldMax || 0)))<1e-5'),'phase totals match actual health: '+key);
}
ok(g.errors.length===0,g.errors.join('\n'));
console.log('Combat settlement regression: '+checks+' checks passed');
