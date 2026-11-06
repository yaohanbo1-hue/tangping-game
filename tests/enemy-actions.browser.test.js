// A controlled cast fixture with a real touch on the player's freeze skill.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts','enemies');
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
  const requested=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname),file=requested===root?path.join(root,'index.html'):requested;
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch();
  try {
    const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[],videos=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/assets/story/'))videos.push(r.url());});
    await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('[data-experience="combat"]').click();await page.locator('#btnStart').click();
    await page.evaluate(()=>{
      newGame();G.experience='combat';paused=true;SFX.on=false;Music.setEnabled(false);G.wave=27;G.state='wave';
      globalThis.caster=spawnEnemy('necromancer',27,1);caster.x=320;caster.y=LANES[1].doorY;
      globalThis.victim=spawnEnemy('brute',27,1);victim.x=240;victim.y=caster.y;victim.hp=0;killEnemy(victim);
      caster.reviveT=7;updateEnemies(.1);G.parts=[];G.texts=[];G.tipTimer=0;shake=0;render(1/60);
    });
    async function capture(name) {const url=await page.evaluate(()=>{render(1/60);return cv.toDataURL();});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(url.split(',')[1],'base64'));}
    assert.equal(await page.evaluate(()=>!!caster.raiseCast&&victim.dead),true);await capture('revive-windup');
    const labels=await page.evaluate(()=>{
      const seen=[],text=ctx.fillText,random=Math.random;ctx.fillText=function(...args){seen.push(args[0]);return text.apply(this,args);};
      Math.random=()=>{throw Error('cast rendering consumes combat RNG');};
      try{render(1/60);}finally{ctx.fillText=text;Math.random=random;}return seen;
    });
    assert.ok(labels.some(s=>s.startsWith('复苏 ')),'actual windup is visible');
    const button=await page.locator('#skillBar [data-k="freeze"]').boundingBox();assert.ok(button);
    await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);
    await page.waitForFunction(()=>G.buff.freeze>0);
    await page.evaluate(()=>updateEnemies(.1));
    assert.equal(await page.evaluate(()=>!caster.raiseCast&&victim.dead),true,'real skill touch interrupts the cast');await capture('revive-interrupted');
    await page.evaluate(()=>{G.buff.freeze=0;caster.stun=0;caster.reviveT=7;updateEnemies(.1);for(let i=0;i<10;i++)updateEnemies(.1);G.parts=[];G.texts=[];shake=0;});
    assert.equal(await page.evaluate(()=>!victim.dead&&victim.revived&&victim.type==='brute'),true);await capture('revived-body');
    assert.equal(await page.evaluate(()=>G.loopErrors||0),0);assert.deepEqual(errors,[]);assert.deepEqual(videos,[]);
    fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify({engine:browser.version(),viewport:page.viewportSize(),headless:true,deviceEmulation:true,
      note:'Controlled fixture; real touch and Canvas, not a physical phone or player campaign',interruptByTouch:true,originalIdentityRevived:true,errors,videos},null,2));
    console.log('Enemy cast telegraph, real freeze touch, interruption and resurrection passed');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
