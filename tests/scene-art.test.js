// Real Canvas checks, native captures and render-only invariants.
require('./browser-env');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts','scene');
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  const target=file===root?path.join(root,'index.html'):file;
  if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',target.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');
  fs.createReadStream(target).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.locator('[data-experience="combat"]').click();await page.locator('#btnStart').click();
    await page.evaluate(()=>{paused=true;SFX.on=false;Music.setEnabled(false);G.tipTimer=0;G.waveTransition=null;});
    async function capture(name) {
      const url=await page.evaluate(()=>{render(1/60);return cv.toDataURL('image/png');});
      fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(url.split(',')[1],'base64'));
    }
    await capture('rain-dorm-native');
    const result=await page.evaluate(()=>{
      const surface=document.createElement('canvas');surface.width=W;surface.height=H;const c=surface.getContext('2d');
      const state=()=>JSON.stringify({gold:G.gold,tech:G.tech,bed:G.bed,doors:G.doors,enemies:G.enemies,stats:G.stats});
      const before=state(),random=Math.random;Math.random=()=>{throw Error('render consumes combat RNG');};
      try {
        for(let i=0;i<60;i++) {SceneArt.drawBase(c);SceneArt.drawWeather(c,i/10);SceneArt.drawBed(c,G.bed,i/10,1/60);
          for(const L of LANES)SceneArt.drawDoor(c,L,G.doors[L.i],i/10,1/60);}
        // Exercise full renderer, shake and two lightning paths too.
        const effects=G.effects;G.effects=[{type:'arc',x:300,y:200,x2:500,y2:210,t:.5,max:1,color:'#d0b0ff'}];
        shake=3;render(1/60);G.effects=effects;
      } finally {Math.random=random;}
      const pixels=(time,motion)=>{SceneArt.drawBase(c);SceneArt.drawWeather(c,time,motion);return surface.toDataURL();};
      const props=time=>{SceneArt.drawBase(c);SceneArt.drawWeather(c,time,false);SceneArt.drawBed(c,G.bed,time,0,false);for(const L of LANES)SceneArt.drawDoor(c,L,G.doors[L.i],time,0,false);return surface.toDataURL();};
      return {same:before===state(),animated:pixels(0,true)!==pixels(2,true),reducedStable:pixels(0,false)===pixels(2,false),reducedPropsStable:props(0)===props(2),...SceneArt.stats()};
    });
    assert.equal(result.same,true,'rendering cannot change combat fields');
    assert.equal(result.builds,1,'static scene built once across sixty frames');
    assert.equal(result.animated,true,'rain, fog and lamp breathing are connected');
    assert.equal(result.reducedStable,true,'reduced motion holds decorative atmosphere still');
    assert.equal(result.reducedPropsStable,true,'door, bedside objects and fabric remain still with reduced motion');
    assert.ok(result.bytes<4.1e6,'bounded scene texture budget');
    await page.evaluate(()=>{shake=0;G.doors[0].hp=G.doors[0].maxHp*.24;G.doors[1].hp=0;G.doors[1].broken=true;G.doors[2].shield=100;G.doors[2].shieldMax=100;G.bed.hp=G.bed.maxHp*.28;});
    await capture('damage-breach-native');
    await page.evaluate(()=>{G.doors[0].hp=G.doors[0].maxHp*.8;G.bed.hp=G.bed.maxHp;});
    await capture('repair-native');
    await page.evaluate(()=>{
      G.gold=1e10;G.power=1e10;G.souls=1000;
      for(const [k,col,row]of [['turret',0,0],['frost',0,1],['laser',0,2],['tesla',0,3],['flame',0,4],['poison',1,4],['gravity',1,3],['missile',1,1],['miner',2,0],['repair',2,2]]) {
        tryBuild(k,col,row);setBuildingLevel(G.buildings.at(-1),6);
      }
      G.buildings.forEach(b=>{b.animY=0;b.animBounce=0;});
      G.texts=[];G.parts=[];G.tipTimer=0;shake=0;
      for(let i=0;i<3;i++)spawnEnemy(['grunt','bulwark','healer'][i],25,i);
      G.enemies.forEach(e=>{e.x=290;});
    });
    await capture('combat-family-native');
    await page.screenshot({path:path.join(output,'desktop-context.png')});
    await page.setViewportSize({width:844,height:390});await page.waitForTimeout(300);
    await page.screenshot({path:path.join(output,'mobile-context.png')});
    assert.deepEqual(errors,[],'scene has no browser script errors');
    fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify({engine:browser.version(),headless:true,...result,errors},null,2));
    console.log('Scene native captures and render invariants passed '+JSON.stringify(result));
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
