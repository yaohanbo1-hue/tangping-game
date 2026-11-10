// Root hooks, real combat stepping and actual save restore. Budget injected only
// for this comparison fixture; it is not a legal-economy or human-playthrough claim.
const assert=require('node:assert/strict');
const {createGame}=require('./runtime');
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
const equal=(value,expected,message)=>{assert.deepEqual(value,expected,message);checks++;};
const plain=value=>JSON.parse(JSON.stringify(value));
const projection=`JSON.stringify({wave:G.wave,state:G.state,gold:G.gold,power:G.power,souls:G.souls,
 stats:G.stats,bed:G.bed,doors:G.doors,buff:G.buff,fate:G.fate,skills:G.skills,tech:G.tech,runes:G.runeBag,
 buildings:G.buildings.map(b=>({type:b.type,col:b.col,row:b.row,level:b.level,branch:b.branch,hp:b.hp,
 maxHp:b.maxHp,cd:b.cd,kills:b.kills,shield:b.shield,invested:b.invested,runes:b.runes})),
 enemies:G.enemies.map(e=>({type:e.type,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,shield:e.shield,phase:e.phase,
 dead:e.dead,affixes:e.affixes,stun:e.stun,slow:e.slow,poison:e.poison,attack:e.attackT})),
 spawn:G.spawnQueue,bosses:G.bossQueue,random:[Math.random(),Math.random(),Math.random()]})`;
function trajectory(seed,disableHooks) {
 const game=createGame(seed);
 if(disableHooks)game.run(`NightWatch.init=NightWatch.tick=NightWatch.onWaveStart=NightWatch.onWaveEnd=()=>{};
  HiddenSecrets.init=HiddenSecrets.tick=()=>{};`);
 game.run(`newGame();G.experience='combat';StoryFlow.setPlayback(false);paused=false;SFX.on=false;
  G.gold=G.power=1e7;G.souls=1e5;G.wave=14;G.state='build';G.prepTimer=.01;
  ['miner','generator','turret','frost','laser','tesla','flame','repair','shield','amp','poison','sonic','missile','gravity','prism']
   .forEach((type,index)=>{tryBuild(type,Math.floor(index/5),index%5);const b=G.buildings.at(-1);setBuildingLevel(b,6);tryBranch(b,index%2?'a':'b');});`);
 const frames=[];
 for(let frame=0;frame<1200;frame++) {
  game.run('statFrame++;step(1/60);');game.advance(1000/60);
  if(frame%60===0) {
   if(!disableHooks)game.run('NightWatch.view();HiddenSecrets.view();');
   frames.push(JSON.parse(game.run(projection)));
  }
 }
 assert.deepEqual(game.errors,[]);
 return {frames,damage:game.run('G.stats.dmg'),wave:game.run('G.wave'),choices:game.run('G.nightWatch?.decided||{}')};
}
for(const seed of [334455,72819]) {
 const enabled=trajectory(seed,false),reference=trajectory(seed,true);
 ok(enabled.damage>0 && enabled.wave>=15,'fixture actually starts a Boss wave and deals real combat damage');
 equal(plain(enabled.choices),{},'default play never auto-accepts a proposal');
 equal(enabled.frames,reference.frames,'same-seed combat trajectory and future RNG match no-op hooks: '+seed);
}

const game=createGame(1907),run=code=>game.run(code);
run(`newGame();G.experience='combat';StoryFlow.setPlayback(false);paused=false;
 G.wave=6;G.state='build';G.gold=10000;G.power=10000;G.souls=100;`);
ok(run("NightWatch.choose('prepare')"),'live root-initialized module accepts a valid preparation');
run('HiddenSecrets.interact("window");HiddenSecrets.interact("lamp");HiddenSecrets.interact("window");');
const snapshot=JSON.parse(run('JSON.stringify(SaveSystem.capture())'));
ok(snapshot.run.nightWatch.active?.kind==='overload','root capture includes the pending actual tactical choice');
ok(snapshot.run.hiddenSecrets.found.includes('rain_letter'),'root capture includes discovery collection');
run('newGame('+JSON.stringify(snapshot)+');');
equal(run('NightWatch.serialize().active.kind'),'overload','actual newGame/applySave restores the pending assignment');
equal(run('NightWatch.serialize().decided[7]'),'prepare','the same preparation remains consumed after restore');
equal(run('G.gold'),snapshot.run.gold,'restoring a preparation does not pay or charge again');
ok(run('HiddenSecrets.view().discoveries.find(d=>d.id==="rain_letter").discovered'),'root restore recovers the collection');
equal(run('NightWatch.view().choices.length'),0,'restored active assignment cannot be purchased twice');
const legacy=JSON.parse(JSON.stringify(snapshot));delete legacy.run.nightWatch;delete legacy.run.hiddenSecrets;
run('newGame('+JSON.stringify(legacy)+');');
ok(run('!!G.nightWatch && NightWatch.view().available'),'old v7 without new fields initializes normal optional proposals');
equal(run('NightWatch.serialize().active'),null,'old v7 cannot invent a pending paid assignment');
equal(run('G.gold'),legacy.run.gold,'old v7 keeps gameplay resources');
ok(run('HiddenSecrets.view().discoveries.find(d=>d.id==="rain_letter").discovered'),'old saves preserve newer local discoveries');

run('globalThis.before=JSON.stringify([G.gold,G.power,G.souls,META.storySeen,META.endingIds]);HiddenSecrets.interact("clock");HiddenSecrets.interact("window");HiddenSecrets.interact("clock");');
equal(run('JSON.stringify([G.gold,G.power,G.souls,META.storySeen,META.endingIds])'),run('before'),'corner discoveries neither mint resources nor acknowledge main plot or endings');
ok(run('!StoryKnowledge.canReveal(55)'),'optional discovery never reveals the unexperienced truth');
assert.deepEqual(game.errors,[]);
console.log('Immersion root integration: '+checks+' real-step trajectory, RNG, optional-play, save/legacy and spoiler checks passed');
