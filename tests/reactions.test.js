const assert=require('node:assert/strict'),{createGame}=require('./runtime');
const g=createGame(633),run=s=>g.run(s);let checks=0;const ok=(v,label)=>{assert.ok(v,label);checks++;};
const effects={steam:'enemy.slow>=.35',overload:'neighbor.hp<neighbor.maxHp',toxiburn:'enemy.poison===6&&enemy.poisonT===6',superduct:'enemy.vuln>1&&enemy.vulnT===6',crystal:'enemy.stun>=1.6&&enemy.slow>=.8',corrode:'DMG_KEYS.every(k=>Math.abs(enemy.res[k]-.32)<1e-8)'};
run('newGame();');
for(const rx of run('Object.values(REACTIONS).map(r=>({id:r.id,pair:r.pair}))'))for(const pair of [rx.pair,rx.pair.slice().reverse()]){
 run(`newGame();G.experience='combat';G.gold=1000;ACHIEVEMENTS.forEach(a=>G.ach[a.id]=1);tryBuild('turret',0,2);globalThis.source=G.buildings[0];
  G.wave=20;G.state='wave';G.spawnQueue=[];G.bossQueue=[];
  globalThis.enemy=spawnEnemy('grunt',1,1);enemy.x=300;enemy.y=source.y;enemy.speed=0;enemy.hp=enemy.maxHp=10000;enemy.shield=100;enemy.res=Object.fromEntries(DMG_KEYS.map(k=>[k,.5]));enemy.weak={};enemy.flat=0;enemy.elem={};enemy.poison=2;enemy.poisonDps=10;enemy.poisonT=2;
  globalThis.neighbor=spawnEnemy('grunt',1,1);neighbor.x=enemy.x-10;neighbor.y=enemy.y;neighbor.hp=neighbor.maxHp=10000;neighbor.shield=0;neighbor.res={};neighbor.weak={};
  applyDamage(enemy,10,${JSON.stringify(pair[0])},source);applyDamage(enemy,10,${JSON.stringify(pair[1])},source);`);
 ok(run('G.stats.reactions===1'),pair+' triggers one real reaction');ok(run(effects[rx.id]),rx.id+' settles its actual promised effect in '+pair+' order');
 ok(run('Math.abs(G.stats.dmg-((10000-enemy.hp)+(100-enemy.shield)+(10000-neighbor.hp)))<1e-7'),pair+' totals match actual body/shield loss');
 ok(run('Math.abs(CombatTelemetry.snapshot(source).total-G.stats.dmg)<1e-7'),pair+' is attributed once to its source');
 run('globalThis.count=G.stats.reactions;applyDamage(enemy,10,'+JSON.stringify(pair[1])+',source);');ok(run('G.stats.reactions===count'),pair+' consumes old marks instead of reacting on every repeat hit');
}
run("newGame();G.experience='combat';globalThis.enemy=spawnEnemy('grunt',1,1);enemy.speed=0;applyDamage(enemy,1,'fire');for(let i=0;i<61;i++)updateEnemies(.1);applyDamage(enemy,1,'frost');");
ok(run('!G.stats.reactions'),'expired elemental marks cannot react later');
ok(g.errors.length===0,g.errors.join('\n'));console.log('Six elemental reactions, both orders and real attribution: '+checks+' checks passed');
