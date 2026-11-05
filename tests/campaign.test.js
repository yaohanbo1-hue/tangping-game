const assert = require('node:assert/strict');
const { createGame } = require('./runtime');
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }

// Flow regression: the real wave/spawn/kill hooks, with scripted lethal hits.
// This verifies orchestration, not player skill or balance.
{
  const g = createGame(17);
  g.run("newGame(); G.experience='combat'; paused=false;");
  for (let wave=1; wave<=60; wave++) {
    g.run('startWave()');
    check(g.run('G.wave') === wave, 'wave advances: '+wave);
    if (wave===60) check(g.run("G.bossQueue.length === 1 && G.bossQueue[0] === 'final'"), 'final Boss still spawns');
    g.run(`for (let tick=0; tick<1500 && G.state==='wave'; tick++) {
      updateWave(1);
      for (const enemy of G.enemies.slice()) if (!enemy.dead) killEnemy(enemy);
      G.enemies = G.enemies.filter(enemy => !enemy.dead);
    }`);
    g.advance(2200);
    check(!g.run('paused'), 'no story pause at wave '+wave);
    check(g.run("!MercyPath._activeDialogue"), 'no forced mercy encounter');
  }
  check(g.run("G.state==='win' && G.over"), 'finite combat victory');
  check(g.run('META.endingIds.length') === 0, 'combat cannot unlock story endings');
  check(g.videos === 0, 'combat requests no story videos');
  check(g.elements.get('overlay').innerHTML.includes('剩余电力'), 'direct summary has resources');
  check(g.elements.get('overlay').innerHTML.includes('restartCombat'), 'restart is wired');
  check(g.errors.length===0, g.errors.join('\n'));
}

// Identity / playback / finite-infinite state matrix and persisted rewards.
for (const experience of ['story','combat']) for (const mode of ['limited','unlimited']) for (const playback of [true,false]) {
  const g = createGame();
  g.run(`newGame(); G.experience='${experience}'; G.mode='${mode}'; paused=false; StoryFlow.setPlayback(${playback}); startWave();`);
  g.advance(2500);
  if (experience==='story' && playback) g.run("StoryFlow.settle(WAVE_STORY[0], WAVE_STORY[0].choices[1], 'manual'); hideStoryDialog();");
  const before = g.run('G.gold');
  const snapshot = g.run('JSON.parse(JSON.stringify(SaveSystem.capture()))');
  g.run('globalThis.saved = null'); // pass only JSON data into the VM
  g.run('newGame('+JSON.stringify(snapshot)+')');
  check(g.run('G.experience')===experience, 'identity survives load');
  check(g.run('G.mode')===mode, 'mode survives load');
  check(g.run('StoryFlow.playback')===playback, 'save does not overwrite device preference');
  g.run('startWave()'); g.advance(2500);
  check(g.run('G.gold')===before, 'load/restart-wave cannot duplicate or erase branch gold');
  g.run('StoryFlow.setPlayback(false); StoryFlow.setPlayback(true); StoryFlow.onWave(G.wave);');
  check(g.run('G.gold')===before, 'setting changes cannot duplicate reward');
  g.run('newGame()');
  check(g.run("G.experience==='story' && Object.keys(G.storyState.events).length===0"), 'new run has isolated identity and ledger');
  check(g.errors.length===0, g.errors.join('\n'));
}

// Turning playback off while a choice/video owns pause resolves once and restores ownership.
{
  const g=createGame();
  g.run("newGame(); paused=false; G.wave=1; showStoryDialog(WAVE_STORY[0]);");
  check(g.run('paused'), 'choice owns pause');
  g.run('StoryFlow.setPlayback(false)');
  check(!g.run('paused'), 'disable releases story pause');
  const gold=g.run('G.gold');
  g.run('StoryFlow.setPlayback(false); showStoryDialog(WAVE_STORY[0]);');
  check(g.run('G.gold')===gold, 'skip is idempotent');
  g.run("newGame(); paused=true; StoryFlow.setPlayback(true); showStoryDialog(WAVE_STORY[0]); StoryFlow.setPlayback(false);");
  check(g.run('paused'), 'manual pause remains paused');
}

// Mid-dialogue save recovery, v6 migration, new-version refusal, four manual ending routes.
{
  const g=createGame();
  g.run("newGame(); G.wave=1; G.state='wave'; paused=false; showStoryDialog(WAVE_STORY[0]);");
  const snap=g.run('JSON.parse(JSON.stringify(SaveSystem.capture()))');
  g.run('newGame('+JSON.stringify(snap)+')');
  check(g.run('G.gold')===50, 'interrupted branch resolves on restore once');
  const again=g.run('JSON.parse(JSON.stringify(SaveSystem.capture()))');
  g.run('newGame('+JSON.stringify(again)+')');
  check(g.run('G.gold')===50, 'second restore keeps reward once');
  g.run("newGame(); const old=SaveSystem.capture(); old.v=6; delete old.run.experience; delete old.run.storyState; globalThis.migrated=SaveSystem.migrate(old); newGame(migrated);");
  check(g.run("G.experience==='story'"), 'legacy identity defaults to story');
  check(g.run('SaveSystem.migrate({v:99,run:{}})===null'), 'future format rejected');
}
for (const route of [0,1]) for (const reply of [0,1]) {
  const g=createGame();
  g.run(`newGame(); G.wave=55; StoryFlow.settle(WAVE_STORY.find(s=>s.wave===55),WAVE_STORY.find(s=>s.wave===55).choices[${route}],'manual');
    G.wave=60; StoryFlow.settle(WAVE_STORY.find(s=>s.wave===60),WAVE_STORY.find(s=>s.wave===60).choices[${reply}],'manual'); gameWin();`);
  check(g.run('META.endingIds.length')===1, 'manual ending combination '+route+'/'+reply);
}
console.log('Campaign regression: '+checks+' checks passed');
