const assert = require('node:assert/strict');
const {createGame} = require('./runtime');
const game = createGame(31);
const run = code => game.run(code);
run("newGame(); G.experience='combat';");
let checks=0;
const ok=(value,msg)=>{assert.ok(value,msg);checks++;};
for(let w=1;w<=10;w++) ok(run(`EnemyBalance.curve(${w})`)===1,'early HP unchanged');
let previous=1;
for(let wave=10;wave<=60;wave+=0.05) {
  const next=run(`EnemyBalance.curve(${wave})`);
  ok(next>=previous-1e-10 && next-previous<0.005,'smooth monotone growth');
  previous=next;
}
for(const [wave,ratio]of [[20,1.18],[30,1.45],[40,1.85],[50,2.45],[60,3.15]]) {
  ok(Math.abs(run(`EnemyBalance.curve(${wave})`)-ratio)<1e-9,'HP anchor '+wave);
}
for(const diff of ['normal','hard','hell','admin']) for(const wave of [10,20,30,40,50,55,60,120,500,9999]) {
  run(`G.diffKey='${diff}'; G.event=EVENTS[0]; G.enemies=[]; G.wave=${wave};`);
  ok(run(`(()=>{ const e=spawnEnemy('bulwark',${wave},0);
    const hp=EnemyBalance.health(e.def,${wave},{difficulty:diffCfg().hpMul,affixes:e.affixes});
    return e.hp===hp.hp && e.maxHp===hp.hp && (e.shield || 0)===hp.shield && Number.isFinite(e.hp); })()`),'one final body/shield health');
}
run("G.diffKey='normal'; G.wave=40; G.enemies=[]; G.event=EVENTS.find(e=>e.eff.hpMul>1); G.trialId=POSTGAME_TRIALS.find(t=>t.hpMul>1).id; DeepDream.enterDeepDream(DeepDream.DEEP_LEVELS[0].id);");
ok(run(`(()=>{ const e=spawnEnemy('colossus',40,1);
 const trial=POSTGAME_TRIALS.find(t=>t.id===G.trialId), mods=DeepDream.getEnemyModifiers();
 const hp=EnemyBalance.health(e.def,40,{difficulty:1,event:G.event.eff.hpMul,trial:trial.hpMul,dream:mods.hpMul,affixes:e.affixes});
 return Math.abs(e.maxHp-hp.hp)<1e-5 && e.segMax===e.maxHp/(e.def.phaseShield+1); })()`),'event/trial/dream/phase shields share one calculation');
run("newGame(); G.experience='combat'; G.mode='unlimited';");
for(const wave of [60,120,500,9999]) {
  ok(run(`(()=>{ const q=buildWaveQueue(${wave}); return q.bossList.length<=3 && q.rest.length<=162; })()`),'bounded infinite queues');
}
const lanes=run("buildWaveQueue(40).rest.slice(0,9).map(e=>e.lane).join(',')");
ok(lanes==='0,1,2,0,1,2,0,1,2','all three lanes have formation roles');
ok(run("G.summonsThisWave=0; G.enemies=[]; for(let i=0;i<300;i++) spawnEnemy('grunt',60,0,true); G.enemies.length===120"),'summons have a finite wave budget');
ok(game.errors.length===0,game.errors.join('\n'));
console.log('Balance regression: '+checks+' checks passed');
