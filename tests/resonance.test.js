const assert=require('node:assert/strict'),{createGame}=require('./runtime');
const game=createGame(881),run=code=>game.run(code);let checks=0;
function ok(value,label){assert.ok(value,label);checks++;}
function fixture(types){run(`newGame();G.gold=G.power=1e9;G.souls=1e5;ACHIEVEMENTS.forEach(a=>G.ach[a.id]=1);
  ${JSON.stringify(types)}.forEach((type,i)=>{tryBuild(type,i%4,Math.floor(i/4));const b=G.buildings[i];b.x=700+i*10;b.y=300;});computeResonance();`);}
fixture(['turret']);ok(run('G.buildings[0].resN===1 && G.buildings[0].resDmg===1'),'one element never grants a tier');
fixture(['turret','turret']);ok(run('G.buildings.every(b=>b.resN===1 && b.resDmg===1)'),'duplicates do not fabricate an element');
fixture(['turret','frost']);ok(run('G.buildings.every(b=>b.resN===2 && b.resDmg===1.12 && b.resTierN===2)'),'a different adjacent element grants the same two-element tier to both');
ok(run('G.buildings.every(b=>b.resExtra.id==="shatter")'),'a real pair retains its special effect');
run('G.buildings[1].x=G.buildings[0].x+RESONANCE_R+.001;computeResonance();');
ok(run('G.buildings.every(b=>b.resN===1 && b.resDmg===1 && !b.resExtra)'),'outside radius clears tier and special effect');
run('G.buildings[1].x=G.buildings[0].x+RESONANCE_R;computeResonance();');
ok(run('G.buildings.every(b=>b.resTierN===2)'),'exact radius remains included');
const elements=['turret','frost','laser','tesla','flame','poison'];
for(let n=3;n<=6;n++){
  fixture(elements.slice(0,n));ok(run(`G.buildings.every(b=>b.resN===${n} && b.resDmg===RESONANCE_TIERS[${n-2}].dmg && b.resRate===RESONANCE_TIERS[${n-2}].rate)`),n+' elements have a symmetric documented tier');
  run('tryBuild("turret",7,4);G.buildings.at(-1).x=720;G.buildings.at(-1).y=300;computeResonance();');
  ok(run(`G.buildings.every(b=>b.resN===${n})`),'a duplicate cannot inflate '+n+' elements');
}
for(const pair of run('Object.keys(RESONANCE_PAIRS)')){
  const types=pair.split('+').map(element=>({kinetic:'turret',frost:'frost',energy:'laser',shock:'tesla',fire:'flame',toxic:'poison'}[element]));
  fixture(types);ok(run(`G.buildings.every(b=>b.resExtra.id===RESONANCE_PAIRS[${JSON.stringify(pair)}].id)`),pair+' grants its documented pair effect');
}
fixture(['turret','frost','miner','repair','amp']);ok(run('G.buildings.slice(0,2).every(b=>b.resN===2)'),'support buildings never add elements');
ok(game.errors.length===0,'no runtime errors');console.log('Element resonance regression passed: '+checks+' checks');
