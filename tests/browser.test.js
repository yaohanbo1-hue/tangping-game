const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium,webkit} = require('playwright');
const root=path.resolve(__dirname,'..'), output=path.join(root,'artifacts','browser');
fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mp3':'audio/mpeg','.mp4':'video/mp4','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (target!==root && !target.startsWith(root+path.sep)) { res.writeHead(403).end(); return; }
  const file=target===root?path.join(root,'index.html'):target;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
async function exercise(engine,name,mobile) {
  // WPE's GPU path can stop delivering animation frames on GPU-less Linux CI.
  // Use its actual CPU raster backend; keep all UI actions and frame measurements real.
  const browser=await engine.launch(process.platform==='linux' && engine===webkit
    ? {env:{...process.env,WEBKIT_SKIA_ENABLE_CPU_RENDERING:'1'}} : {});
  const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
  const page=await context.newPage(), errors=[], videos=[];
  page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error' && /^\\[(loop|init)\\]/.test(msg.text())) errors.push(msg.text());});
  page.on('request',r=>{if(r.url().includes('/assets/story/'))videos.push(r.url());});
  try {
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.locator('#experienceCards [data-experience="combat"]').click();
    await page.locator('#btnStart').click();
    await page.waitForFunction(()=>G && G.experience==='combat' && !paused);
    await page.evaluate(()=>{G.gold=500;});
    const readiness = await page.evaluate(async () => {
      const samples=[];
      for(let i=0;i<6;i++) {
        const el=document.querySelector('#buildBar [data-k="miner"]'), rect=el.getBoundingClientRect(), style=getComputedStyle(el);
        samples.push({rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},display:style.display,transform:style.transform,
          className:el.className,loopErrors:G.loopErrors || 0,paused,gold:G.gold,frame:statFrame,vp:{w:innerWidth,h:innerHeight,vw:visualViewport.width,vh:visualViewport.height}});
        await new Promise(resolve=>setTimeout(resolve,150));
      }
      return samples;
    });
    console.log(JSON.stringify({name,readiness}));
    fs.writeFileSync(path.join(output,name+'-layout.json'),JSON.stringify({readiness,errors},null,2));
    await page.screenshot({path:path.join(output,name+'-before-build.png')});
    await page.locator('#buildBar [data-k="miner"]').click();
    const point=await page.evaluate(()=>{const rect=cv.getBoundingClientRect(),p=cellCenter(0,0);return{x:rect.left+p.x*rect.width/W,y:rect.top+p.y*rect.height/H};});
    if(mobile) await page.touchscreen.tap(point.x,point.y); else await page.mouse.click(point.x,point.y);
    await page.waitForFunction(()=>G.buildings.some(b=>b.type==='miner' && b.col===0 && b.row===0));
    await page.locator('#btnSkip').click();
    await page.waitForFunction(()=>G.wave===1 && G.state==='wave');
    await page.screenshot({path:path.join(output,name+'-combat.png')});
    await page.evaluate(()=>{
      G.enemies=[]; G.wave=54; G.resumeWave=false; startWave();
    });
    await page.waitForTimeout(2300);
    assert.equal(await page.evaluate(()=>paused),false,'wave 55 combat does not pause');
    assert.equal(await page.locator('#storyDialog').evaluate(el=>getComputedStyle(el).display),'none');
    assert.equal(videos.length,0,'combat must not request story media');
    await page.evaluate(()=>{
      G.enemies=[]; G.wave=59; G.resumeWave=false; startWave();
      const e=spawnEnemy('final',60,1);
      killEnemy(e);
    });
    await page.waitForFunction(()=>G.state==='win');
    assert.equal(await page.evaluate(()=>META.endingIds.length),0,'combat does not unlock endings');
    await page.locator('#restartCombat').click();
    await page.waitForFunction(()=>G.wave===0 && G.experience==='combat' && !G.over);
    assert.equal(await page.evaluate(()=>Object.keys(G.storyState.events).length),0,'restart clears ledger');
    assert.equal(videos.length,0);

    // A real HUD click closes an in-progress story choice and restores the story-owned pause.
    await page.evaluate(()=>{
      G.experience='story'; StoryFlow.setPlayback(true); G.wave=1; showStoryDialog(WAVE_STORY[0]);
    });
    await page.waitForFunction(()=>paused);
    await page.locator('#btnStoryPlayback').click();
    await page.waitForFunction(()=>!paused && !StoryFlow.playback);
    assert.equal(await page.locator('#storyDialog').evaluate(el=>getComputedStyle(el).display),'none');
    await page.evaluate(()=>{
      newGame(); G.experience='combat'; G.mode='unlimited'; G.gold=1e10; G.power=1e10; G.souls=1e5; paused=false;
      const types=['turret','frost','laser','tesla','flame','poison','sonic','missile','prism','gravity','repair','shield','amp','generator','miner','bank'];
      for(let i=0;i<32;i++) if(tryBuild(types[i%16],Math.floor(i/5),i%5)) setBuildingLevel(G.buildings[G.buildings.length-1],12);
      G.wave=39; startWave();
      for(let i=0;i<90;i++) spawnEnemy(['brute','sprinter','healer','bulwark','emp'][i%5],40,i%3);
      globalThis.renderTimes=[];
      const originalRender=render;
      render=function(...args){const start=performance.now();const result=originalRender(...args);renderTimes.push(performance.now()-start);return result;};
    });
    const metrics=await page.evaluate(()=>new Promise(resolve=>{
      const frames=[];let previous=performance.now();
      function frame(now) {
        frames.push(now-previous); previous=now;
        if(frames.length<180)requestAnimationFrame(frame);else {
          const stats=values=>{const sorted=values.slice().sort((a,b)=>a-b);return{count:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted[sorted.length-1]};};
          resolve({frameMs:stats(frames),renderMs:stats(renderTimes),enemies:G.enemies.length,buildings:G.buildings.length});
        }
      }
      requestAnimationFrame(frame);
    }));
    await page.screenshot({path:path.join(output,name+'-stress.png')});
    if(mobile) {
      await page.setViewportSize({width:390,height:844});
      await page.waitForTimeout(300);
      await page.screenshot({path:path.join(output,name+'-portrait.png')});
      await page.setViewportSize({width:844,height:390});
      await page.waitForTimeout(300);
      assert.ok(await page.evaluate(()=>Number.isFinite(cv.getBoundingClientRect().width)));
    }
    assert.equal(await page.evaluate(()=>G.loopErrors || 0),0,'no swallowed game loop errors');
    assert.deepEqual(errors,[],'no browser script errors');
    return {name,engine:browser.version(),viewport:page.viewportSize(),headless:true,deviceEmulation:mobile,note:'CI software rendering; not physical phone FPS',...metrics};
  } finally {await page.screenshot({path:path.join(output,name+'-last.png')}).catch(()=>{});await context.close();await browser.close();}
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const results=[];
  try {
    for(const [engine,name,mobile]of (process.argv.includes('--webkit-only') ? [[webkit,'ios-webkit-emulated',true]] : [[chromium,'desktop-chromium',false],[chromium,'android-emulated',true],[webkit,'ios-webkit-emulated',true]])) {
      const result=await exercise(engine,name,mobile);results.push(result);console.log(JSON.stringify(result));
      fs.writeFileSync(path.join(output,'frame-times.json'),JSON.stringify(results,null,2));
    }
    console.log('Browser interactions and viewport checks passed');
  } finally {server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
