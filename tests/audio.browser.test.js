require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright'),root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts','audio');
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
function wav(channels,rate){
  const buffer=Buffer.alloc(44+channels.length*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);
  buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);
  buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(channels.length*2,40);
  channels.forEach((n,i)=>buffer.writeInt16LE(Math.round(Math.max(-1,Math.min(1,n))*32767),44+i*2));return buffer;
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const reports=[];
  for(const engine of [chromium,webkit]){
    const browser=await engine.launch();
    try{
      const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
      await page.locator('.home-audio summary').click();await page.locator('#masterVolume').focus();await page.keyboard.press('Home');
      assert.equal(await page.evaluate(()=>SFX.masterVolume),0,'native slider can mute master');
      await page.keyboard.press('End');assert.equal(await page.evaluate(()=>SFX.masterVolume),1);
      await page.locator('#graphicsQuality').selectOption('low');await page.reload();
      assert.equal(await page.evaluate(()=>Graphics.level),'low','quality survives reload');
      await page.locator('[data-experience="combat"]').tap();await page.locator('#phoneMenuStart').tap();
      const capability=await page.evaluate(()=>({live:typeof(window.AudioContext||window.webkitAudioContext),offline:typeof(window.OfflineAudioContext||window.webkitOfflineAudioContext)}));
      if(capability.live==='function')await page.waitForFunction(()=>SFX.ctx && SFX.ctx.state==='running',null,{timeout:10000});
      await page.evaluate(()=>{paused=true;});
      await page.locator('#phoneMore').click();await page.locator('[data-panel="helpPanel"]').click();
      await page.locator('.battle-settings summary').click();await page.locator('#gameGraphicsQuality').selectOption('medium');
      assert.equal(await page.evaluate(()=>Graphics.level),'medium','quality can change without leaving a run');
      await page.screenshot({path:path.join(output,engine.name()+'-settings.png')});
      if(capability.live!=='function' || capability.offline!=='function'){
        assert.ok(engine===webkit && process.platform==='win32','missing Web Audio is only an explicitly recorded Windows WebKit limitation');
        assert.equal(await page.evaluate(()=>G.loopErrors||0),0);assert.deepEqual(errors,[]);
        reports.push({browser:engine.name(),version:browser.version(),status:'unsupported-web-audio',capability,verified:['live settings','native slider persistence','graceful silent operation'],note:'This Windows WebKit binary exposes neither AudioContext nor OfflineAudioContext. No Safari audio or PCM output claim.'});
        console.log('webkit: settings and silent fallback passed; SKIP audio rendering (Web Audio APIs absent in this Windows binary)');continue;
      }
      const result=await page.evaluate(async()=>{
        const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext,rate=44100,rows=[],samples=[];
        const real=SFX.ctx;SFX.stopAll();
        const setup=()=>{SFX.ctx=new Offline(1,rate,rate);SFX.on=true;SFX.masterVolume=1;SFX.volume=SFX.uiVolume=SFX.ambienceVolume=1;SFX.background=false;Music.focus=1;SFX._graph();};
        const render=async(name,action)=>{
          setup();action();const context=SFX.ctx,buffer=await context.startRendering(),data=buffer.getChannelData(0);
          let peak=0,power=0,crossings=0,last=0,active=0;
          for(let i=0;i<data.length;i++){const n=data[i];peak=Math.max(peak,Math.abs(n));power+=n*n;if(i&&n*data[i-1]<0)crossings++;if(Math.abs(n)>.0001){last=i;active++;}}
          const row={name,peak,rms:Math.sqrt(power/data.length),lastSignalSeconds:last/rate,zeroCrossings:crossings,activeSamples:active,residualVoices:SFX.stats().active};rows.push(row);
          if(Object.hasOwn(SFX.weapons,name)||name.startsWith('alert:'))samples.push(...data);SFX.stopAll();return row;
        };
        for(const type of Object.keys(SFX.weapons))await render(type,()=>SFX.weapon(type));
        for(const key of Object.keys(BossEncounters.defs))await render('alert:'+key,()=>SFX.alert(key));
        await render('master-silent',()=>{SFX.setVolume('master',0);SFX.weapon('missile');SFX.build();});
        await render('background-silent',()=>{SFX.weapon('missile');Music.setBackground(true);});
        await render('combat-muted-ui-audible',()=>{SFX.setVolume('combat',0);SFX.weapon('missile');SFX.build();});
        await render('ui-muted-combat-audible',()=>{SFX.setVolume('ui',0);SFX.build();SFX.weapon('laser');});
        setup();const originalRandom=Math.random;Math.random=()=>{throw Error('audio consumed combat RNG');};
        try{for(let i=0;i<1000;i++)SFX.noise(.1);for(let i=0;i<50;i++)SFX.tone(500,.1,'sine',.1,0,'ui');SFX.ambient(2);}finally{Math.random=originalRandom;}
        const burst=SFX.stats(),context=SFX.ctx,burstBuffer=await context.startRendering();
        let burstPeak=0;for(const sample of burstBuffer.getChannelData(0))burstPeak=Math.max(burstPeak,Math.abs(sample));
        SFX.stopAll();const ended=SFX.stats();
        SFX.ctx=new Offline(1,rate*60,rate);SFX._graph();let longPeakVoices=0;const longContext=SFX.ctx;
        const jobs=Array.from({length:60},(_,i)=>longContext.suspend(i+.25).then(()=>{
          for(let n=0;n<40;n++)SFX.noise(.08,.1,800);
          longPeakVoices=Math.max(longPeakVoices,SFX.stats().active);return longContext.resume();
        }));
        const longRendering=longContext.startRendering();await Promise.all(jobs);await longRendering;
        const longSession={seconds:60,peakVoices:longPeakVoices,active:SFX.stats().active,buffers:SFX.stats().buffers};SFX.stopAll();
        setup();Music.volume=.57;Music.setDucking(true);Music.setBusVolume('ui',.31);const saved=JSON.parse(Store.get('tangping_audio','{}'));
        const duck={volume:Music.volume,saved:saved.musicVolume,output:Music.outputVolume(),gain:SFX.gain(.57)*.42};Music.setDucking(false);
        Music.setBackground(true);const background={voices:SFX.stats().active,muted:SFX.background,musicFocus:Music.focus};Music.setBackground(false);
        SFX.stopAll();SFX.ctx=real;SFX._graph();Music.init();
        return {rows,burst,burstPeak,ended,longSession,duck,background,samples,rate};
      });
      for(const row of result.rows.filter(r=>!r.name.includes('silent'))){
        assert.ok(Number.isFinite(row.peak)&&row.peak<.98,row.name+' has finite unclipped output');
        assert.ok(row.rms>.00001,row.name+' is audible in rendered PCM');
        assert.ok(row.lastSignalSeconds<.6,row.name+' releases cleanly');
        assert.equal(row.residualVoices,0,row.name+' disconnects naturally');
      }
      assert.equal(result.rows.find(r=>r.name==='master-silent').peak,0);
      assert.equal(result.rows.find(r=>r.name==='background-silent').peak,0);
      assert.ok(new Set(result.rows.slice(0,11).map(r=>r.zeroCrossings+':'+r.lastSignalSeconds.toFixed(3))).size===11,'weapon signatures are distinct');
      const alerts=result.rows.filter(r=>r.name.startsWith('alert:'));
      assert.equal(alerts.length,5);assert.equal(new Set(alerts.map(r=>r.zeroCrossings+':'+r.lastSignalSeconds.toFixed(3))).size,5,'five Boss alert signatures are distinct');
      assert.ok(result.burst.active<=24 && result.burst.buses.combat<=16 && result.burst.buses.ui<=6 && result.burst.buses.ambience<=1);
      assert.equal(result.burst.buffers,1,'burst reuses one noise buffer');assert.equal(result.ended.active,0,'voices disconnect after finishing');
      assert.ok(result.burstPeak<.98,'worst-case overlapping voices retain headroom');
      assert.ok(result.longSession.peakVoices<=16 && result.longSession.active===0 && result.longSession.buffers===1,'repeated playback cleans up over sixty rendered seconds');
      assert.equal(result.duck.saved,.57);assert.equal(result.duck.volume,.57);assert.ok(Math.abs(result.duck.output-result.duck.gain)<1e-8);
      assert.deepEqual(result.background,{voices:0,muted:true,musicFocus:0});assert.deepEqual(errors,[]);
      fs.writeFileSync(path.join(output,engine.name()+'-weapon-sampler.wav'),wav(result.samples,result.rate));delete result.samples;
      reports.push({browser:engine.name(),version:browser.version(),status:'verified-web-audio',capability,...result});console.log(engine.name()+': audio output, bounded voices, RNG isolation, live settings and persistence passed');
    }finally{await browser.close();}
  }
  fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(reports,null,2));server.close();
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
