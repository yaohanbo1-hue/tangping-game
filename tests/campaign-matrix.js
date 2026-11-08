const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {campaign}=require('./campaign-sim');
const rows=[];
for(const [profile,difficulty,seed] of [
  ['balanced','normal',20261106],['balanced','normal',8921],
  ['economy','normal',20261106],['damage','normal',20261106],
  ['balanced','hard',20261106],['balanced','hell',20261106],
  ['relaxed','normal',20261106],['relaxed','hard',20261106],['relaxed','hell',20261106],
  ['no-control','hell',20261106],['no-runes','normal',20261106],
]) {
  const result=campaign({profile,difficulty,seed}); rows.push(result);
  assert.deepEqual(result.errors,[],'no runtime failures');
  assert.equal(result.admin,false,'no administrator');
  assert.equal(Object.keys(result.prizes).length,0,'no starting prizes');
  assert.equal(result.videos,0,'no story media');
  assert.equal(result.endingIds.length,0,'no unexperienced ending unlock');
  assert.notEqual(result.stop,'wave-stall','no route may stall on a single wave');
  if(!['no-control','no-runes'].includes(profile))assert.equal(result.won,true,profile+' '+difficulty+' remains legally winnable');
  if(profile==='balanced' && difficulty==='normal') {
    assert.equal(result.won,true,'normal campaign must be winnable from zero');
    assert.equal(result.samples.length,60,'all sixty waves played');
    assert.ok(result.bosses.some(b=>b.boss==='final'),'final boss killed by combat');
    assert.ok(result.bosses.every(b=>b.phases.length===b.expectedPhases),'every Boss combat visits every phase');
    assert.ok(result.bosses.filter(b=>b.boss==='final').every(b=>b.seconds>=3 && b.casts+b.interrupts>0),'the final Boss offers a real cast/counter window');
    assert.ok(result.actions.tech>0 && result.actions.rune>0 && result.actions.branch>0,'technology, runes and branches used');
  }
  console.log(JSON.stringify({profile,difficulty,seed,won:result.won,wave:result.wave,seconds:result.seconds,leaks:result.leaks,bossSeconds:result.bosses.map(b=>b.seconds)}));
  fs.mkdirSync(path.join(__dirname,'..','artifacts'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'..','artifacts','campaign-matrix.json'),JSON.stringify({note:'Fixed player policy with legal purchases and real 60Hz combat; not a physical player trial.',results:rows},null,2));
}
console.log('Full campaign regression and strategy matrix passed');
