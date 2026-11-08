// Presentation-only Boss warning layout: no encounter, damage or AI changes.
require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','boss-warning-art');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch();
  try{
    const rows=[];
    for(const phone of [false,true]){
      const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:900},isMobile:phone,hasTouch:phone}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
      await page.locator('[data-experience="combat"]').click();
      const start=page.locator('#phoneMenuStart');if(await start.isVisible())await start.click();else await page.locator('#btnStart').click();
      for(const key of ['lord','abyss','machine','void','final','final-bottom']){
        const sample=await page.evaluate(key=>{
          newGame();G.experience='combat';paused=true;Graphics.set('low');SFX.on=false;G.wave=40;G.state='wave';G.gold=G.power=1e6;
          tryBuild('turret',0,2);G.buildings[0].animY=G.buildings[0].animBounce=0;
          const id=key==='final-bottom'?'final':key,e=spawnEnemy(id,40,1);e.x=280;e.y=key==='final-bottom'?ARENA_BOT-40:LANES[1].doorY;e.speed=0;e.encounter.cooldown=0;
          updateEnemies(.01);e.encounter.exposed=2;e.encounter.controlGuard=2;
          G.parts=[];G.effects=[];G.texts=[];G.upgradeFx=[];G.tipTimer=0;shake=flash=0;T=10;
          const snapshot=()=>JSON.stringify({gold:G.gold,power:G.power,stats:G.stats,doors:G.doors.map(d=>[d.hp,d.shield]),buildings:G.buildings.map(b=>[b.hp,b.shield,b.level]),bed:[G.bed.hp,G.bed.shield],enemies:G.enemies.map(e=>({hp:e.hp,x:e.x,y:e.y,phase:e.phase,encounter:e.encounter && {...e.encounter,cast:e.encounter.cast && {...e.encounter.cast,target:e.encounter.cast.target && {x:e.encounter.cast.target.x,y:e.encounter.cast.target.y,hp:e.encounter.cast.target.hp,shield:e.encounter.cast.target.shield}}}}))});
          const before=snapshot(),original=ctx.fillText,random=Math.random,labels=[];
          try{
            ctx.fillText=function(text,x,y,...args){labels.push({text:String(text),x,y});return original.call(this,text,x,y,...args);};
            Math.random=()=>{throw Error('Boss warning consumed combat RNG');};render(1/60);
          }finally{ctx.fillText=original;Math.random=random;}
          const cue=enemyCastCue(e),cast=labels.find(r=>r.text===cue.label+' · '+cue.left.toFixed(1)+'s'),name=labels.find(r=>r.text.startsWith(BOSS_DEFS[id].name+'  /  '));
          const weak=labels.find(r=>r.text==='弱点'),guard=labels.find(r=>r.text==='韧性');hudT=0;updateHUD(1);
          return {id,key,same:before===snapshot(),cast,name,weak,guard,laneFlag:labels.find(r=>r.text.startsWith('第 '+(cue.lane+1)+' 路 · ')),bounds:{top:ARENA_TOP,bottom:ARENA_BOT},native:cv.toDataURL()};
        },key);
        assert.ok(sample.same,key+' warning must not mutate simulation fields');assert.ok(sample.cast&&sample.name,key+' has independent cast/name labels');
        assert.ok(sample.cast.y-sample.name.y>50||sample.name.y-sample.cast.y>20,key+' cast is separated from Boss name/HP');
        assert.ok(sample.cast.y>=sample.bounds.top+10&&sample.cast.y<=sample.bounds.bottom-15,key+' cast remains inside the battlefield');
        assert.ok(sample.weak&&sample.guard&&Math.abs(sample.weak.x-sample.guard.x)>=40,key+' weakness and tenacity have separate badges');
        assert.ok(Math.abs(sample.cast.y-sample.weak.y)>=18,key+' cast and state badges do not share a text line');
        if(['machine','final'].includes(sample.id))assert.ok(sample.laneFlag,key+' lane warning includes a route number');
        const stem=(phone?'phone-':'desktop-')+key;
        fs.writeFileSync(path.join(out,stem+'-native.png'),Buffer.from(sample.native.split(',')[1],'base64'));delete sample.native;
        await page.screenshot({path:path.join(out,stem+'.png')});rows.push({phone,...sample});
      }
      assert.equal(await page.evaluate(()=>G.loopErrors||0),0);assert.deepEqual(errors,[]);await context.close();
    }
    fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({browser:browser.version(),physicalDevice:false,rows},null,2));
    console.log('Boss warning artwork: five cast cards, bottom-edge fallback, numbered lanes and separated state badges passed on desktop/phone');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
