const assert = require('node:assert/strict');
const { createGame } = require('./runtime');
const game = createGame(547), run = code => game.run(code);
let checks = 0;
function ok(value, label) { assert.ok(value, label); checks++; }
function close(actual, expected, label) { ok(Math.abs(actual - expected) < 1e-7, label + ': ' + actual + ' vs ' + expected); }
function fixture(type = 'flame', branch = null) {
  run(`newGame(); G.experience='combat'; G.gold=1e6; G.power=1e6; G.souls=1e5;
    ACHIEVEMENTS.forEach(a=>G.ach[a.id]=1); tryBuild('${type}',0,2);
    globalThis.tower=G.buildings[0]; ${branch ? `setBuildingLevel(tower,6);tryBranch(tower,'${branch}');` : ''}
    G.state='wave'; G.wave=1; G.spawnQueue=[]; G.bossQueue=[];
    globalThis.enemy=spawnEnemy('grunt',1,1); enemy.x=300; enemy.y=tower.y;
    enemy.hp=enemy.maxHp=1e6; enemy.shield=0; enemy.flat=0; enemy.res={}; enemy.weak={};`);
}
for (const type of ['flame', 'gravity']) for (const branch of [null, 'a', 'b']) {
  fixture(type, branch); run('updateTowers(.1);');
  const base = run('G.stats.dmg');
  ok(base > 0, type + branch + ' deals real continuous damage');
  for (const [buff, factor, label] of [
    ['G.tech.rapid=4', 1.2, 'rapid technology'],
    ['G.tech.swift=3', 1.24, 'swift technology'],
    ['tower.resRate=1.26', 1.26, 'elemental resonance'],
    ['G.fateWave.rate=.2', 1.2, 'story rate reward'],
    ['tower.freezeT=2', .4, 'enemy frost slowdown'],
    ['G.buff.overclock=2', 2.7, 'overclock damage and rate'],
  ]) {
    fixture(type, branch); run(buff + ';statFrame++;updateTowers(.1);');
    close(run('G.stats.dmg'), base * factor, type + branch + ' respects ' + label);
  }
}
fixture('gravity', 'b'); run('updateTowers(.1);');
ok(run('enemy.slow===0 && bstat(tower).gravSlow===0'), 'collapse really trades slow for damage');
fixture('gravity', 'a'); run('updateTowers(.1);');
ok(run('enemy.slow>0'), 'black hole keeps its control identity');

// Actual enemy updates verify poison modifiers, not a second damage implementation.
for (const [modifiers, expected, label] of [
  ['', 10, 'neutral'], ['enemy.res.toxic=.5', 5, 'resistance'],
  ['enemy.weak.toxic=.25', 12.5, 'weakness'], ['enemy.affixRes=.4', 6, 'resistant elite'],
  ['enemy.flat=10', 9, 'armor per second'], ['enemy.vuln=1.5;enemy.vulnT=2', 15, 'vulnerability'],
]) {
  fixture('poison'); run(`enemy.shield=100;enemy.poison=1;enemy.poisonDps=100;enemy.poisonT=1;enemy.poisonSrc=tower;${modifiers};updateEnemies(.1);`);
  close(run('G.stats.dmg'), expected, 'poison respects ' + label);
  ok(run('enemy.shield===100'), 'poison bypasses shields with ' + label);
  close(run('G.stats.towerDamage.poison'), expected, 'poison output is attributed with ' + label);
}
fixture('poison'); run('enemy.poison=1;enemy.poisonDps=100;enemy.poisonT=.025;enemy.poisonSrc=tower;updateEnemies(.1);');
close(run('G.stats.dmg'), 2.5, 'last poison tick only covers its remaining duration');
ok(run('enemy.poison===0 && enemy.poisonDps===0 && enemy.poisonSrc===null'), 'expired stacks and ownership clear');
run('inflictPoison(enemy,{poisonDps:10,poisonStack:1,poisonMax:8,src:tower});');
ok(run('enemy.poison===1 && enemy.poisonDps===10'), 'old potent poison cannot contaminate a new application');
fixture('poison'); run('G.fate.dmg=.5;fire_(tower,enemy,bstat(tower));updateBullets(1);');
close(run('enemy.poisonDps'), run('bstat(tower).poisonDps') * 1.5, 'poison payload benefits from damage rewards');
fixture('poison', 'b'); run('enemy.res.toxic=.7;dotDamage(enemy,100,"toxic",tower,.1,true);');
close(run('enemy.res.toxic'), .7, 'poison ticks do not reapply corrosion armor shred every frame');
fixture('poison'); run('enemy.hp=1;enemy.shield=100;enemy.poison=1;enemy.poisonDps=100;enemy.poisonT=1;enemy.poisonSrc=tower;updateEnemies(.1);updateEnemies(.1);');
ok(run('enemy.dead && tower.kills===1 && G.stats.kills===1 && G.stats.dmg===1'), 'poison death counts actual output and one kill');

// Collection and revelation are separate: early rewards must stay spoiler-free on every public route.
run("newGame();G.wave=10;DreamFragments.collectFragment('frag_3');");
ok(run("DreamFragments._collected.has('frag_3')"), 'early story reward is retained');
ok(!run("JSON.stringify(DreamFragments.getCollectedFragments()).includes('床边的合照')"), 'collected API masks late titles');
ok(!run("DreamFragments.getUnlockStatus().stories.find(f=>f.id==='frag_3').unlocked"), 'collection does not prematurely reveal story');
run('G.wave=55;');
ok(!run("DreamFragments.isRevealed(DreamFragments.FRAGMENT_DEFS.find(f=>f.id==='frag_3'))"), 'wave 55 alone does not reveal the truth');
run("G.experience='story';StoryFlow.setPlayback(true);globalThis.truth=WAVE_STORY.find(s=>s.wave===55);StoryFlow.settle(truth,truth.choices[0],'manual');");
ok(run("DreamFragments.getCollectedFragments().find(f=>f.id==='frag_3').name==='床边的合照'"), 'the same reward reveals after reading the story');
ok(run("DreamFragments.getUnlockStatus().stories.find(f=>f.id==='frag_3').unlocked"), 'archive unlock follows revelation');
run("openFragmentDetail('frag_4');");
ok(game.elements.get('fragmentDetail').innerHTML === '', 'uncollected details cannot be opened directly');
run('newGame();G.wave=1;');
for (const id of ['necromancer', 'leech', 'emp', 'frostbane', 'reflector', 'phantom', 'flier']) {
  ok(run(`enemyCounterHint('${id}').length>0`), id + ' has an actionable counter hint');
}
for (const saved of ['null', '[]', '42', '"bad"', '{broken']) {
  game.storage.set('tangping_accessibility', saved); run('Accessibility.init();');
  ok(run("Accessibility.uiEffects==='simple' && Accessibility.textSize==='normal'"), 'malformed settings recover: ' + saved);
}
run("Accessibility.set('textSize','large');Accessibility.set('uiEffects','full');Accessibility.init();");
ok(run("Accessibility.uiEffects==='full' && Accessibility.textSize==='large'"), 'effect setting persists alongside accessibility choices');
ok(game.errors.length === 0, game.errors.join('\n'));
console.log('Weapon, enemy counter and story refinements: ' + checks + ' checks passed');
