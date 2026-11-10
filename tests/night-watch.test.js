const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createGame}=require('./runtime');
let checks=0;const equal=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},ok=(v,m)=>{assert.ok(v,m);checks++;};
function setup(slot=2,seed=412){
 const game=createGame(seed);if(game.run('typeof NightWatch')==='undefined')game.run(fs.readFileSync(path.join(__dirname,'..','night-watch.js'),'utf8'));
 game.run(`newGame();G.state='build';G.wave=${slot};G.gold=1000000;G.power=1000000;G.souls=1000;paused=false;NightWatch.init();`);return game;
}
const plain=value=>JSON.parse(JSON.stringify(value));
const game=setup(),run=code=>game.run(code);
equal(run('NightWatch.view().choices.length'),3,'two alternatives and an explicit pass');
equal(run('NightWatch.view().nextWave'),3);
ok(run('NightWatch.view().choices[0].disabled'),'undamaged door cannot waste a purchase');
run('G.doors[0].hp=100;globalThis.before=G.gold;');
ok(run("NightWatch.choose('prepare')"));
equal(run('G.doors[0].hp'),205,'actual damaged door repaired');ok(run('G.gold<before'),'repair actually costs gold');
equal(run("NightWatch.choose('prepare')"),false,'cannot purchase twice');
const saved=plain(run('NightWatch.serialize()'));run('NightWatch.init('+JSON.stringify(saved)+');');equal(run("NightWatch.choose('prepare')"),false,'load cannot repeat an immediate reward');
const poor=setup();poor.run('G.gold=0;G.power=0;G.doors[0].hp=100;');equal(poor.run("NightWatch.choose('prepare')"),false,'insufficient funds do not create partial choice');equal(poor.run('G.doors[0].hp'),100);ok(poor.run("NightWatch.choose('pass')"));equal(poor.run('G.gold'),0);equal(poor.run('NightWatch.view().available'),false);
const names=[];for(const slot of [2,6,10,14,18,22]){const g=setup(slot);names.push(g.run('NightWatch.view().title'));equal(g.run('NightWatch.view().choices.length'),3);}equal(new Set(names).size,6,'six actual situations');
for(const slot of [0,1,3,5,56,60]){const g=setup(slot);equal(g.run('NightWatch.view().available'),false,'bounded encounter cadence at '+slot);}
const over=setup(6);ok(over.run("NightWatch.choose('prepare')"));over.run("G.wave=7;G.state='wave';G.buff.overclock=0;NightWatch.onWaveStart();");equal(over.run('G.buff.overclock'),12);over.run('G.buff.overclock=8;NightWatch.onWaveStart();');equal(over.run('G.buff.overclock'),8,'same-start call does not refresh the buff');
over.run('NightWatch.tick(.2);paused=true;NightWatch.tick(.2);');equal(over.run('NightWatch.view().active.progress'),.2,'pause does not advance the assignment');
const lure=setup(10);ok(lure.run("NightWatch.choose('prepare')"));lure.run("G.wave=11;G.state='wave';G.spawnQueue=[{type:'sprinter',lane:1}];G.bossQueue=['lord'];NightWatch.onWaveStart();");equal(lure.run('G.spawnQueue.length'),4,'three regular enemies are real queue entries');equal(lure.run('G.bossQueue.length'),1,'Boss count unchanged');lure.run('NightWatch.onWaveStart();');equal(lure.run('G.spawnQueue.length'),4,'no duplicate reinforcements');
lure.run('globalThis.rewardGold=G.gold;NightWatch.onWaveEnd();globalThis.afterReward=G.gold;NightWatch.onWaveEnd();');ok(lure.run('afterReward>rewardGold'));equal(lure.run('G.gold'),lure.run('afterReward'),'completion cannot pay twice');
const deposit=setup(14);deposit.run("NightWatch.choose('prepare');globalThis.afterPay=G.gold;G.wave=15;G.state='wave';NightWatch.onWaveStart();G.stats.build++;NightWatch.tick(.1);");equal(deposit.run('NightWatch.view().active.progress'),0,'failed commitment is visible even from a zero-build baseline');deposit.run('NightWatch.onWaveEnd();');equal(deposit.run('G.gold'),deposit.run('afterPay'),'breaking the undertaking loses the deposit');equal(deposit.run('NightWatch.view().result.success'),false);
const held=setup(14);held.run("NightWatch.choose('prepare');globalThis.afterPay=G.gold;G.wave=15;G.state='wave';NightWatch.onWaveStart();NightWatch.onWaveEnd();");ok(held.run('G.gold>afterPay'));equal(held.run('NightWatch.view().result.success'),true);
const restart=setup(14);restart.run("NightWatch.choose('prepare');G.wave=15;G.state='wave';NightWatch.onWaveStart();globalThis.g=G.gold;globalThis.saveWatch=NightWatch.serialize();NightWatch.init(saveWatch);G.runStamp++;NightWatch.onWaveStart();");equal(restart.run('G.gold'),restart.run('g'),'restore neither charges nor prepays again');restart.run('NightWatch.onWaveEnd();globalThis.settled=NightWatch.serialize();NightWatch.init(settled);NightWatch.onWaveEnd();');equal(restart.run('NightWatch.view().history.length'),1,'settled state has no active reward');
const route=setup(18);route.run("G.doors[0].hp=10;G.doors[1].hp=20;NightWatch.choose('prepare');G.wave=19;G.state='wave';G.spawnQueue=Array.from({length:12},()=> 'grunt');NightWatch.onWaveStart();");equal(plain(route.run('G.spawnQueue.slice(0,8).map(x=>x.lane)')),Array(8).fill(2));equal(route.run('G.spawnQueue.length'),12,'route changes do not invent enemies');
const corrupted=setup(14);corrupted.run("NightWatch.choose('prepare');globalThis.invalid=NightWatch.serialize();invalid.active.reward=1e12;invalid.active.deposit=1e12;NightWatch.init(invalid);");ok(corrupted.run('NightWatch.serialize().active.reward<1000&&NightWatch.serialize().active.deposit<1000'),'saved payout rebuilt from the event, never trusted');
const chatter=setup(10);chatter.run("G.state='wave';G.stats.leaks++;NightWatch.tick(.1);NightWatch.tick(.1);G.stats.bossInterrupts=1;NightWatch.tick(.1);G.bed.hp=50;NightWatch.tick(.1);");equal(chatter.run('NightWatch.view().messages.length'),3,'three actual state changes, no repeated bark');chatter.run('for(let i=0;i<20;i++)NightWatch.tick(.1);');equal(chatter.run('NightWatch.view().messages.length'),3);
const noRandom=setup(6);noRandom.run("globalThis.random=Math.random;Math.random=()=>{throw Error('combat RNG touched')};NightWatch.view();NightWatch.choose('prepare');G.wave=7;G.state='wave';NightWatch.onWaveStart();NightWatch.tick(.1);NightWatch.onWaveEnd();Math.random=random;");equal(noRandom.errors.length,0,'decisions and messages consume no combat RNG');
const ignored=setup(6),baseline=plain(ignored.run('({gold:G.gold,power:G.power,souls:G.souls,stats:G.stats,buff:G.buff})'));ignored.run("NightWatch.view();G.wave=7;G.state='wave';NightWatch.onWaveStart();NightWatch.tick(.1);NightWatch.onWaveEnd();");equal(plain(ignored.run('({gold:G.gold,power:G.power,souls:G.souls,stats:G.stats,buff:G.buff})')),baseline,'ignoring every proposal leaves combat resources and buffs unchanged');
// Real game/save hooks: replaying a wave may rebuild its encounter, never a
// one-time cooldown refund or a failed pledge's eligibility.
const liveFreeze=setup(6);liveFreeze.run("G.skills.freeze=30;NightWatch.choose('venture');startWave();");equal(liveFreeze.run('G.skills.freeze'),22,'actual wave-start hook grants the refund once');
for(let i=0;i<3;i++){
 const save=liveFreeze.run('JSON.stringify(SaveSystem.capture())');
 ok(JSON.parse(save).run.nightWatch.active.freezeApplied,'refund application is saved');
 equal(JSON.parse(save).run.skills.freeze,22,'remaining cooldown is in the real snapshot');
 liveFreeze.run('newGame('+save+');startWave();');
 equal(liveFreeze.run('G.skills.freeze'),22,'actual save/load loop '+i+' preserves cooldown without another refund');
}
const livePledge=setup(14);livePledge.run("NightWatch.choose('prepare');startWave();paused=true;");
ok(livePledge.run("tryBuild('miner',0,0)"),'real purchase breaks the no-new-building commitment');
const brokenSave=livePledge.run('JSON.stringify(SaveSystem.capture())');
ok(JSON.parse(brokenSave).run.nightWatch.active.violated,'saving while paused captures the violation before any tick');
for(let i=0;i<3;i++){
 livePledge.run('newGame('+ (i?livePledge.run('JSON.stringify(SaveSystem.capture())'):brokenSave) +');startWave();');
 equal(livePledge.run('NightWatch.view().active.progress'),0,'restored commitment remains visibly failed');
 ok(livePledge.run('NightWatch.serialize().active.violated'),'violation survives the real reload loop '+i);
}
livePledge.run('globalThis.beforeFinish=G.gold;NightWatch.onWaveEnd();');
equal(livePledge.run('G.gold'),livePledge.run('beforeFinish'),'replaying cannot wash a broken deposit into a payout');
equal(livePledge.run('NightWatch.view().result.success'),false);
const skillCompatibility=setup(6);skillCompatibility.run('globalThis.legacy=JSON.parse(JSON.stringify(SaveSystem.capture()));delete legacy.run.skills;newGame(legacy);');
ok(skillCompatibility.run('SKILL_KEYS.every(key=>G.skills[key]===0)'),'old saves without cooldowns retain the ready-by-default migration');
skillCompatibility.run("globalThis.dirty=JSON.parse(JSON.stringify(SaveSystem.capture()));dirty.run.skills={freeze:1e12,overclock:-5,mend:'not-a-number',repel:null,siphon:NaN};newGame(dirty);");
equal(skillCompatibility.run('G.skills.freeze'),skillCompatibility.run('SKILL_DEFS.freeze.cd'),'oversized saved cooldown is bounded by its actual skill');
equal(skillCompatibility.run('G.skills.overclock'),0,'negative saved cooldown cannot produce a permanent bonus');
equal(skillCompatibility.run('G.skills.mend'),0,'invalid saved cooldown falls back to ready');
equal(skillCompatibility.run('G.skills.repel'),0,'null cooldown migrates safely');
equal(skillCompatibility.run('G.skills.siphon'),0,'NaN cooldown migrates safely');
const invalidChoice=setup(6);invalidChoice.run("NightWatch.choose('prepare');globalThis.mismatch=NightWatch.serialize();mismatch.active.kind='freeze';NightWatch.init(mismatch);");
equal(invalidChoice.run('NightWatch.serialize().active'),null,'restored action must match the actually selected option');
invalidChoice.run("NightWatch.init({decided:{'1':'prepare','3':'pass','9999':'venture'}});");equal(plain(invalidChoice.run('NightWatch.serialize().decided')),{'3':'pass'},'decision ledger accepts only bounded encounter slots');
console.log('Night watch: '+checks+' decision, cost, queue, commitment, pause, reload and room-response checks passed');
