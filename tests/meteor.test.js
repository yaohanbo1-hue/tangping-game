const assert=require('node:assert/strict'),{createGame}=require('./runtime');
const g=createGame(553),run=s=>g.run(s);let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
function fixture(){run(`newGame();G.experience='combat';G.wave=20;G.state='wave';G.spawnQueue=[];G.bossQueue=[];
 globalThis.enemy=spawnEnemy('grunt',1,1);enemy.hp=enemy.maxHp=100000;enemy.res={};enemy.weak={};enemy.shield=0;enemy.speed=0;useSkill('meteor');paused=true;globalThis.before=enemy.hp;`);}
fixture();g.advance(2000);ok(run('enemy.hp===before'),'wall-clock time cannot detonate a paused meteor');
run('updateEffects(.44);');ok(run('enemy.hp===before'),'meteor retains its full simulation windup');
run('updateEffects(.02);');ok(run('enemy.hp<before'),'meteor detonates after simulation time resumes');
run('globalThis.after=enemy.hp;updateEffects(1);');ok(run('enemy.hp===after'),'one meteor never detonates twice');
fixture();run('enemy.dead=true;globalThis.damage=G.stats.dmg;updateEffects(1);');ok(run('G.stats.dmg===damage'),'dead targets receive no delayed damage');
fixture();run('G.enemies=[];globalThis.damage=G.stats.dmg;updateEffects(1);');ok(run('G.stats.dmg===damage'),'removed targets cannot receive a phantom hit');
fixture();run('newGame();globalThis.gold=G.gold;globalThis.damage=G.stats.dmg;globalThis.shakeBefore=shake;');g.advance(2000);
ok(run('G.gold===gold && G.stats.dmg===damage && shake===shakeBefore'),'old volley cannot damage or shake a new run');
fixture();run('globalThis.snapshot=SaveSystem.capture();newGame(snapshot);globalThis.damage=G.stats.dmg;');g.advance(2000);
ok(run('G.stats.dmg===damage && !G.effects.some(e=>e.type==="meteor")'),'wave-restart load discards the old volley');
for(const quality of ['low','medium','high']){
 fixture();run(`Graphics.set('${quality}');for(let i=0;i<1000;i++)addEffect({type:'laser',life:1,maxLife:1});updateEffects(1);`);
 ok(run('Math.abs(before-enemy.hp-(200+20*50))<1e-8'),'visual budget preserves delayed meteor settlement: '+quality);
}
fixture();run('globalThis.boss=spawnEnemy("final",60,1);boss.phaseBarrier=1;G.skills.meteor=0;useSkill("meteor");globalThis.hp=boss.hp;updateEffects(.5);');
ok(run('boss.hp===hp'),'meteor obeys transition immunity at impact');
fixture();run('G.effects=[];G.enemies=[];for(let i=0;i<3;i++){const e=spawnEnemy("grunt",1,1);e.hp=e.maxHp=1e9;e.res={};e.weak={};}globalThis.booms=0;globalThis.boom=SFX.boom;SFX.boom=()=>{booms++;};G.skills.meteor=0;useSkill("meteor");updateEffects(.5);SFX.boom=boom;');
ok(run('booms===1'),'one volley shares its impact sound');ok(g.errors.length===0,g.errors.join('\n'));
console.log('Meteor simulation clock, pause and stale-volley boundaries: '+checks+' checks passed');
