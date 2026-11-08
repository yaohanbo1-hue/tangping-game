require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright'),{createServer,previews}=require('../tools/mobile-lab');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch();
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
  const errors=[];context.on('page',p=>p.on('pageerror',error=>errors.push(error.message)));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.locator('#audioCheck summary').tap();assert.equal(await page.locator('[data-preview]').count(),16);
  const oldAudio=await page.evaluate(()=>localStorage.getItem('tangping_audio'));
  await page.locator('[data-preview="turret"]').tap();await page.waitForFunction(()=>SFX.ctx?.state==='running'&&SFX.counts.played>0);
  assert.equal(await page.locator('[data-listen="turret"]').inputValue(),'untested','playing a tone never auto-passes its listening check');
  await page.locator('[data-listen="turret"]').selectOption('clear');await page.locator('#stopAudio').tap();
  assert.equal(await page.evaluate(()=>SFX.stats().active),0);assert.equal(await page.evaluate(()=>localStorage.getItem('tangping_audio')),oldAudio,'isolated preview leaves game preferences alone');
  const popup=context.waitForEvent('page');await page.locator('#launch').tap();const game=await popup;await game.waitForLoadState('domcontentloaded');
  await game.locator('[data-experience="combat"]').tap();await game.locator('#phoneMenuStart').tap();await game.evaluate(()=>{paused=true;Music.setEnabled(false);SFX.on=false;});
  assert.deepEqual(previews.map(row=>row[0]),await game.evaluate(()=>[...Object.keys(SFX.weapons),...Object.keys(BossEncounters.defs).map(id=>'boss_'+id)]),'listening labels and PCM offsets follow production recipes');
  const before=await game.evaluate(()=>({gold:G.gold,buildings:G.buildings.length,renderer:render.name}));
  await page.bringToFront();await page.locator('#sample').tap();await game.bringToFront();
  await page.waitForFunction(()=>document.getElementById('sampleResult').textContent.includes('measurement'),null,{timeout:20000});
  const sample=JSON.parse(await page.locator('#sampleResult').textContent());assert.ok(sample.measurement.frames.count>30);assert.equal(sample.measurement.paused,true);
  assert.deepEqual(await game.evaluate(()=>({gold:G.gold,buildings:G.buildings.length,renderer:render.name})),before,'sampling restores the renderer and injects no game resources');
  await page.bringToFront();const savedResponse=page.waitForResponse(r=>r.url().endsWith('/report'));await page.locator('#save').tap();await page.locator('#download').waitFor({state:'visible'});
  const saved=await(await savedResponse).json();assert.equal(saved.report.listening.turret,'clear');assert.equal(saved.report.listening.frost,'untested');assert.equal(saved.report.audioPreview.method,'web-audio');
  assert.ok((await page.locator('#saved').textContent()).includes('未确认物理设备'));assert.equal(await page.locator('#physical').isChecked(),false);assert.deepEqual(errors,[]);
  const fallbackContext=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});await fallbackContext.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});
  const fallback=await fallbackContext.newPage();fallback.on('pageerror',e=>errors.push(e.message));await fallback.goto('http://127.0.0.1:'+server.address().port);await fallback.locator('#audioCheck summary').tap();
  await fallback.locator('[data-preview="boss_final"]').tap();
  const hasPCM=fs.existsSync(path.join(__dirname,'..','artifacts','audio','chromium-weapon-sampler.wav'));
  await fallback.waitForFunction(()=>/离线PCM回退|尚不能播放/.test(document.getElementById('audioStatus').textContent));
  if(hasPCM){assert.ok((await fallback.locator('#audioStatus').textContent()).includes('离线PCM回退'));const pcm=await fallback.request.get('http://127.0.0.1:'+server.address().port+'/sound-samples/boss_final.wav',{headers:{Range:'bytes=0-43'}});assert.equal(pcm.status(),206);assert.equal((await pcm.body()).toString('ascii',0,4),'RIFF');}
  else assert.ok((await fallback.locator('#audioStatus').textContent()).includes('尚不能播放'));
  assert.equal(await fallback.locator('[data-listen="boss_final"]').inputValue(),'untested');assert.deepEqual(errors,[]);await fallbackContext.close();
  console.log('Device lab browser: live production tones, explicit listening records, PCM fallback, real game sampling and non-physical report passed');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
