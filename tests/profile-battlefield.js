// Synthetic, reproducible load. Resources/HP below are fixtures, not balance evidence.
require('./browser-env');
const { chromium, webkit } = require('playwright');
const {createHash}=require('node:crypto');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '..');
const label = process.argv.find(a => a.startsWith('--label='))?.slice(8) || 'current';
const ablation = process.argv.includes('--ablation');
const option=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.split('=')[1];
const engine=option('engine')==='webkit'?webkit:chromium;
if (!/^[a-z0-9-]+$/i.test(label)) throw Error('Invalid report label');
const server = http.createServer((req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const stats = xs => ({ meanMs: xs.reduce((a,b)=>a+b,0)/xs.length, p95Ms: [...xs].sort((a,b)=>a-b)[Math.floor(xs.length*.95)] });
(async () => {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser = await engine.launch(process.platform==='linux'&&engine===webkit?{env:{...process.env,WEBKIT_SKIA_ENABLE_CPU_RENDERING:'1'}}:{});
  try {
    const results=[];
    const cases=ablation?['full','no-texts','no-effects','no-hitflash','no-canvas','no-dom'].map(omit=>({quality:'low',mode:'active-simulation',omit})):
      ['low','medium','high'].flatMap(quality=>['fixed-render','active-simulation'].map(mode=>({quality,mode,omit:'full'})));
    const selected=cases.filter(row=>(!option('quality')||row.quality===option('quality'))&&(!option('mode')||row.mode===option('mode'))&&(!option('omit')||row.omit===option('omit')));
    assert.ok(selected.length,'choose a supported profile case');
    for (const {quality,mode,omit} of selected) {
      const page=await browser.newPage({viewport:{width:1440,height:900}}), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:'+server.address().port);
      await page.locator('[data-experience="combat"]').click();await page.locator('#btnStart').click();
      await page.evaluate(({quality,mode,omit})=>{
        // Clicking Start can advance a few live frames before this evaluation.
        // Seed before a fresh run so clock-dependent browser delivery cannot
        // leave a different initial economy/statistics state in each sample.
        let seed=424242;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
        newGame();G.experience='combat';paused=true;SFX.on=false;Music.setEnabled(false);Accessibility.set('uiEffects','simple');
        if(typeof Graphics!=='undefined')Graphics.set(quality);
        G.gold=G.power=1e12;G.souls=10000;G.wave=30;
        const types=Object.keys(BUILD_DEFS);
        for(let i=0;i<32;i++) {
          if(!tryBuild(types[i%types.length],Math.floor(i/5),i%5))throw Error('Fixture building failed');
          const b=G.buildings.at(-1);setBuildingLevel(b,12);tryBranch(b,i%2?'a':'b');b.animY=b.animBounce=0;b.hp=b.maxHp=1e12;
        }
        G.enemies=[];
        const ids=mode==='fixed-render'?Object.keys(ENEMY_DEFS).filter(id=>!ENEMY_DEFS[id].boss):['grunt','swarm'];
        for(let i=0;i<95;i++){const e=spawnEnemy(ids[i%ids.length],30,i%3);e.x=65+(i%10)*28;e.y=90+(Math.floor(i/10)%9)*51;e.state='walk';e.hitFlash=0;e.hp=e.maxHp=1e15;e.affixes=[];e.elite=false;}
        G.doors.forEach(d=>{d.hp=d.maxHp=1e12;});G.bed.hp=G.bed.maxHp=1e12;
        G.parts=[];G.effects=[];G.texts=[];G.upgradeFx=[];G.tipTimer=0;G.waveTransition=null;selected=null;shake=0;
        for(let i=0;i<60;i++)addEffect({type:i%2?'laser':'arc',x:400+i*3,y:100+i*6,x2:120+i*2,y2:90+i*6,color:'#c77dff',life:.8,maxLife:1});
        spawnParts(420,300,300,'#ffd166',4,1);
        G.state=mode==='active-simulation'?'wave':'prep';G.spawnQueue=[];G.bossQueue=[];
        if(omit==='no-texts')drawTexts=()=>{};
        if(omit==='no-effects'){drawParts=()=>{};drawEffects=()=>{};}
        if(omit==='no-hitflash'){const original=EnemyArt.draw;EnemyArt.draw=(ctx,e,...rest)=>{const flash=e.hitFlash;e.hitFlash=0;try{return original(ctx,e,...rest);}finally{e.hitFlash=flash;}};}
        if(omit==='no-dom')updateHUD=()=>{};
        window.measurements={};window.frameTimes=[];window.initialActors={buildings:G.buildings.length,enemies:G.enemies.length};window.initialLoad={effects:G.effects.length,particles:G.parts.length};
        let warm=0,last=0,collect=false,frames=0;
        const instrument=name=>{
          const original=window.eval(name);
          window.eval(name+' = function(...args) {const start=performance.now();try{return window.profileOriginals["'+name+'"](...args);}finally{if(window.profileCollect)(window.measurements["'+name+'"]??=[]).push(performance.now()-start);}}');
          window.profileOriginals[name]=original;
        };
        window.profileOriginals={};
        for(const name of ['step','updateTowers','updateBullets','updateEnemies','updateEffects','drawBg','drawCorridors','drawBuildings','drawEnemies','drawEffects','drawParts','drawTexts','updateHUD'])instrument(name);
        const originalRender=omit==='no-canvas'?()=>{}:render;
        render=function(dt){
          collect=++warm>45 && frames<150;window.profileCollect=collect;
          if(collect){if(last)window.frameTimes.push(performance.now()-last);frames++;}last=performance.now();
          if(mode==='active-simulation'){statFrame++;step(1/60);}
          const start=performance.now();originalRender(dt);
          if(collect)(window.measurements.render??=[]).push(performance.now()-start);
          if(frames===150 && !window.endSnapshot)window.endSnapshot=JSON.stringify({stats:G.stats,gold:G.gold,power:G.power,enemies:G.enemies.map(e=>({type:e.type,x:e.x,y:e.y,hp:e.hp,shield:e.shield}))});
          window.profileDone=frames>=150;
        };
      },{quality,mode,omit});
      try { await page.waitForFunction(()=>window.profileDone,null,{timeout:180000}); }
      catch(error) { console.error(await page.evaluate(()=>({loopErrors:G.loopErrors||0,measurements:Object.fromEntries(Object.entries(window.measurements).map(([k,v])=>[k,v.length])),enemies:G.enemies.length,effects:G.effects.length,parts:G.parts.length})));throw error; }
      const data=await page.evaluate(()=>({measurements,frameTimes,initialActors,initialLoad,endSnapshot,textCache:typeof FloatingTextArt==='undefined'?null:FloatingTextArt.stats(),actors:{buildings:G.buildings.length,enemies:G.enemies.length},loopErrors:G.loopErrors||0}));
      assert.deepEqual(errors,[]);assert.equal(data.loopErrors,0);
      if(mode==='fixed-render')assert.deepEqual(data.actors,data.initialActors);
      const row={quality,mode,omit,initialActors:data.initialActors,initialLoad:data.initialLoad,finalActors:data.actors,endHash:createHash('sha256').update(data.endSnapshot).digest('hex'),...(process.argv.includes('--debug')?{endState:JSON.parse(data.endSnapshot)}:{}),textCache:data.textCache,frame:stats(data.frameTimes),timing:Object.fromEntries(Object.entries(data.measurements).map(([k,xs])=>[k,stats(xs)]))};
      results.push(row);console.log(JSON.stringify(row));await page.close();
    }
    const report={label,engine:engine.name(),browser:browser.version(),platform:process.platform,viewport:{width:1440,height:900},samples:150,
      note:'Headless browser software rendering, not physical device FPS. Fixed render: 32 buildings, 95 mixed enemies, 60 beams, 300 particles. Active: same buildings, 95 high-HP grunt/swarm enemies; real 1/60 simulation step per frame. Nested timings are not additive. Pre-quality baseline repeats identical settings under each quality label.',results};
    fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts','runtime-profile-'+label+'.json'),JSON.stringify(report,null,2));
    if(!ablation)assert.equal(new Set(results.filter(r=>r.mode==='active-simulation').map(r=>r.endHash)).size,1,'quality preserves the profiled combat state');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
