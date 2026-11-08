const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createServer,cleanReport}=require('../tools/mobile-lab');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const response=await fetch(base),html=await response.text();assert.equal(response.status,200);assert.ok(html.includes('物理手机'));
  const token=html.match(/const labToken='([a-f0-9]+)'/)[1];assert.equal(token.length,48);
  for(const route of ['/.git/config','/package.json','/tools/mobile-lab.js','/artifacts/branch-benchmark.json','/assets/../README.md'])assert.equal((await fetch(base+route)).status,404,route+' is outside the shared game files');
  assert.equal((await fetch(base+'/game',{method:'HEAD'})).headers.get('content-type'),'text/html; charset=utf-8');
  assert.equal((await fetch(base+'/audio/README.md')).status,404,'only music files are shared from audio/');
  const music=fs.readFileSync(path.join(__dirname,'..','audio','game-loop.mp3'));
  const part=await fetch(base+'/audio/game-loop.mp3',{headers:{Range:'bytes=0-15'}});
  assert.equal(part.status,206);assert.equal(part.headers.get('content-type'),'audio/mpeg');assert.equal(part.headers.get('content-range'),'bytes 0-15/'+music.length);
  assert.deepEqual(Buffer.from(await part.arrayBuffer()),music.subarray(0,16),'the actual music file supports byte ranges');
  const suffix=await fetch(base+'/audio/game-loop.mp3',{headers:{Range:'bytes=-7'}});assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),music.subarray(-7));
  assert.equal((await fetch(base+'/audio/game-loop.mp3',{headers:{Range:'bytes='+music.length+'-'}})).status,416);
  const video=await fetch(base+'/assets/story/01-wake-0307.mp4',{headers:{Range:'bytes=0-31'}});assert.equal(video.status,206);assert.equal((await video.arrayBuffer()).byteLength,32);
  const runtime=await fetch(base+'/audio-runtime.js');assert.equal(runtime.status,200);assert.ok((await runtime.text()).includes('const SFX ='));
  assert.equal((await fetch(base+'/report',{method:'POST',body:'{}'})).status,403);
  assert.equal((await fetch(base+'/report',{method:'POST',headers:{'X-Device-Lab-Token':token},body:'['})).status,400);
  const report=await fetch(base+'/report',{method:'POST',headers:{'Content-Type':'application/json','X-Device-Lab-Token':token},body:JSON.stringify({physicalConfirmed:true,checks:{build:'pass',audio:'invented'},sample:{measurement:{frames:{mean:Infinity}}}})});
  const saved=await report.json();assert.equal(saved.report.physicalConfirmed,false,'empty device identity cannot silently become a physical result');assert.equal(saved.report.checks.audio,'untested');assert.equal(saved.report.checks.build,'pass');assert.equal(saved.report.sample.measurement.frames.mean,null);
  assert.equal(cleanReport({device:'Android test',physicalConfirmed:true}).physicalConfirmed,true,'a device requires explicit manual assertion');
  assert.equal(cleanReport({device:'iPhone'}).physicalConfirmed,false,'a device name alone is never proof');
  const listen=cleanReport({listening:{turret:'clear',frost:'invented'},audioPreview:{method:'web-audio',volume:.6,contextState:'running'}});
  assert.equal(Object.keys(listen.listening).length,16);assert.equal(listen.listening.turret,'clear');assert.equal(listen.listening.frost,'untested');assert.equal(listen.physicalConfirmed,false);
  assert.equal(listen.audioPreview.method,'web-audio');assert.equal(cleanReport({audioPreview:{method:'guessed'}}).audioPreview.method,'untested');
  console.log('Device lab: real music/video ranges, 16 listening records, local routes and explicit physical-device labeling passed');
 }finally{server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
