// Legal economy and combat with a policy accepting optional watch arrangements.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{campaign}=require('./campaign-sim');
const rows=[];
for(const difficulty of ['normal','hard']){
 const result=campaign({seed:20261110,difficulty,watchChoices:true});rows.push(result);
 assert.deepEqual(result.errors,[]);assert.equal(result.admin,false);assert.equal(Object.keys(result.prizes).length,0);
 assert.equal(result.won,true);assert.equal(result.samples.length,60);assert.equal(result.videos,0);assert.equal(result.endingIds.length,0);
 assert.ok(result.watchLog.length>=10,'policy encounters and decides on the watch opportunities');
 assert.ok(new Set(result.watchLog.map(r=>r.title)).size===6,'all six situations occur in a legal campaign');
 assert.ok(result.watchLog.some(r=>r.choice!=='pass'),'watch choices actually used');
 console.log(JSON.stringify({difficulty,won:result.won,wave:result.wave,leaks:result.leaks,decisions:result.watchLog.length,seconds:result.seconds}));
 fs.mkdirSync(path.join(__dirname,'..','artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'..','artifacts','watch-campaigns.json'),JSON.stringify({note:'Legal fixed player policy, not a human trial.',physicalPlayerTrial:false,results:rows},null,2));
}
