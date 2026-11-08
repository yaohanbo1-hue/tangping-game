require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts','bosses');
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[],rows=[];
    page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
    await page.locator('[data-experience="combat"]').tap();await page.locator('#phoneMenuStart').tap();
    for(const key of ['lord','abyss','machine','void','final']){
      await page.evaluate(()=>TouchControls.closeSheet());
      const fixture=await page.evaluate(key=>{
        newGame();G.experience='combat';paused=true;Graphics.set('low');SFX.on=false;G.wave=40;G.state='wave';G.gold=G.power=1e6;
        tryBuild('turret',0,2);G.buildings[0].animY=G.buildings[0].animBounce=0;
        globalThis.caster=spawnEnemy(key,40,1);caster.x=280;caster.y=LANES[1].doorY;caster.speed=0;caster.encounter.cooldown=0;
        updateEnemies(.01);G.parts=[];G.effects=[];G.texts=[];G.upgradeFx=[];G.tipTimer=0;shake=flash=0;T=10;
        const cast=caster.encounter.cast,random=Math.random;
        try{
          Math.random=()=>{throw Error('Boss warning consumed combat RNG');};render(1/60);const shown=cv.toDataURL();
          caster.encounter.cast=null;T=10;render(1/60);const hidden=cv.toDataURL();caster.encounter.cast=cast;T=10;render(1/60);
          hudT=0;updateHUD(1);return{visible:shown!==hidden,label:BossEncounters.defs[key].name};
        }finally{Math.random=random;}
      },key);
      assert.ok(fixture.visible,key+' warning draws pixels even at low quality');
      assert.ok((await page.locator('#phoneThreat').textContent()).includes(fixture.label),key+' warning has native readable text');
      assert.equal(await page.locator('#phoneThreat').getAttribute('data-danger'),'true');
      await page.screenshot({path:path.join(output,key+'-phone-windup.png')});
      await page.locator('#phoneSkills').tap();await page.locator('[data-skill="freeze"]').tap();
      const interrupted=await page.evaluate(()=>{updateEnemies(.02);hudT=0;updateHUD(1);return{cast:!!caster.encounter.cast,count:caster.encounter.interrupts,paused,freeze:G.buff.freeze};});
      assert.deepEqual(interrupted,{cast:false,count:1,paused:true,freeze:4.5});
      rows.push({key,label:fixture.label,warningVisible:true,realFreezeTouch:true});
    }
    assert.equal(await page.evaluate(()=>G.loopErrors||0),0);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify({browser:browser.version(),viewport:{width:390,height:844},physicalDevice:false,rows,errors},null,2));
    console.log('Five Bosses: low-quality cast warnings, native phone text and real freeze touches passed');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
