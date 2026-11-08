require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','bestiary');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname),file=p===root?path.join(root,'index.html'):p;
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
function save(name,url){fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(url.split(',')[1],'base64'));}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port);
    const catalog=await page.evaluate(()=>{
      paused=true;
      const ids=Object.keys(ENEMY_DEFS).filter(k=>!ENEMY_DEFS[k].boss).concat(Object.keys(BOSS_DEFS));
      const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=Math.ceil(ids.length/8)*152;
      const c=sheet.getContext('2d');c.fillStyle='#101e28';c.fillRect(0,0,sheet.width,sheet.height);
      const sample=document.createElement('canvas');sample.width=sample.height=192;const s=sample.getContext('2d');
      function digest(draw){s.clearRect(0,0,192,192);draw(s);const data=s.getImageData(0,0,192,192).data;let hash=2166136261,ink=0,edge=0;
        for(let i=0;i<data.length;i++){hash=Math.imul(hash^data[i],16777619)>>>0;if(i%4===3&&data[i]){ink++;const p=(i-3)/4,x=p%192,y=Math.floor(p/192);if(x<2||x>189||y<2||y>189)edge++;}}return{hash,ink,edge};}
      const random=Math.random;Math.random=()=>{throw Error('enemy artwork advanced combat RNG');};const rows=[];
      try{ids.forEach((id,i)=>{
        const def=BOSS_DEFS[id]||ENEMY_DEFS[id],boss=!!BOSS_DEFS[id];
        const e={type:id,boss,bossKey:id,def,x:96,y:96,r:boss?38:30,phase:0,alpha:1,wob:.3,hitFlash:0,state:'walk'};
        const hash=digest(ctx=>EnemyArt.draw(ctx,e,0,.016,{motion:false}));
        const moveA=digest(ctx=>EnemyArt.draw(ctx,e,.2,.016,{motion:true})),moveB=digest(ctx=>EnemyArt.draw(ctx,e,1.3,.016,{motion:true}));
        const reduced=digest(ctx=>EnemyArt.draw(ctx,e,9,.016,{motion:false}));
        e.hitFlash=.12;const hit=digest(ctx=>EnemyArt.draw(ctx,e,0,.016,{motion:false}));e.hitFlash=0;
        const phases=[];if(boss)for(let p=0;p<def.phases.length;p++){e.phase=p;phases.push(digest(ctx=>EnemyArt.draw(ctx,e,0,.016,{motion:false})).hash);}e.phase=0;
        const x=(i%8)*160+80,y=Math.floor(i/8)*152+70;
        EnemyArt.preview(c,id,x,y,boss?31:28);c.fillStyle='#dfd8bd';c.font='11px sans-serif';c.textAlign='center';c.fillText(def.name,x,y+59);
        c.fillStyle='#7f969b';c.font='8px monospace';c.fillText(id.toUpperCase(),x,y+73);
        rows.push({id,...hash,moves:moveA.hash!==moveB.hash,reduced:reduced.hash===hash.hash,hit:hit.hash!==hash.hash,phases});
      });}finally{Math.random=random;}
      const badge=document.createElement('canvas');badge.width=600;badge.height=90;const b=badge.getContext('2d');b.fillStyle='#101e28';b.fillRect(0,0,600,90);
      Object.keys(AFFIX).forEach((key,i)=>{EnemyArt.mark(b,key,30+i*60,32,14,AFFIX[key].color);b.font='10px sans-serif';b.textAlign='center';b.fillStyle='#dfd8bd';b.fillText(AFFIX[key].name,30+i*60,69);});
      return{rows,sheet:sheet.toDataURL(),badges:badge.toDataURL(),cache:EnemyArt.stats()};
    });
    assert.equal(catalog.rows.length,40,'35 regular enemies plus five Bosses');
    assert.equal(new Set(catalog.rows.map(r=>r.hash)).size,40,'all enemies have distinct artwork');
    for(const r of catalog.rows){assert.ok(r.ink>300&&r.edge===0,r.id+' is visible without clipping');assert.ok(r.moves&&r.reduced&&r.hit,r.id+' has movement, reduced-motion and hit states');if(r.phases.length)assert.equal(new Set(r.phases).size,r.phases.length,r.id+' changes across actual phases');}
    assert.ok(catalog.cache.bytes<8e6&&catalog.cache.entries<=64,'bestiary cache stays bounded');save('catalog',catalog.sheet);save('elite-marks',catalog.badges);
    await page.locator('[data-experience="combat"]').click();await page.locator('#btnStart').click();
    const integration=await page.evaluate(()=>{
      paused=true;G.enemies=[];G.parts=[];G.texts=[];G.effects=[];G.upgradeFx=[];G.tipTimer=0;G.waveTransition=null;
      const ids=['grunt','brute','phantom','summoner','bulwark','leech','frostbane','owl','weaver','necromancer','reflector','bomber'];
      ids.forEach((id,i)=>{const e=spawnEnemy(id,10,i%3);e.x=105+(i%4)*70;e.y=115+Math.floor(i/4)*160;e.state='walk';});
      const boss=spawnEnemy('final',60,1);boss.x=285;boss.y=310;boss.phase=2;
      const snapshot=()=>JSON.stringify({gold:G.gold,power:G.power,souls:G.souls,stats:G.stats,enemies:G.enemies,bed:G.bed,doors:G.doors});
      const before=snapshot(),random=Math.random;Math.random=()=>{throw Error('render RNG leak');};
      try{for(let i=0;i<60;i++)render(1/60);}finally{Math.random=random;}
      const same=before===snapshot(),builds=EnemyArt.stats().builds;for(let i=0;i<30;i++)render(1/60);
      const warm=EnemyArt.stats().builds-builds,native=cv.toDataURL();
      const victim=G.enemies[0];victim.dead=true;G.enemies=G.enemies.slice(1);render(1/60);
      const death=EnemyArt.stats().deaths;newGame();render(1/60);
      return{same,warm,death,reset:EnemyArt.stats().deaths===0,native,cache:EnemyArt.stats()};
    });
    assert.ok(integration.same,'drawing never mutates combat or consumes simulation RNG');assert.equal(integration.warm,0,'live frames reuse bodies');assert.ok(integration.death>0&&integration.reset,'death observation follows actual removals and clears across runs');
    const eviction=await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=192;const c=canvas.getContext('2d'),limits=[];
      for(const boss of [true,false]){
        for(let i=0;i<100;i++)EnemyArt.draw(c,{type:boss?'final':'grunt',boss,bossKey:'final',def:{...ENEMY_DEFS.grunt,color:'#'+(0x234500+i).toString(16)},x:96,y:96,r:30,phase:0,alpha:1},0,0,{motion:false});
        limits.push(EnemyArt.stats());
      }
      return limits;
    });
    assert.ok(eviction.every(s=>s.bytes<=8e6&&s.entries<=64),'cache eviction enforces both byte and entry budgets after 200 distinct textures');
    save('battlefield',integration.native);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({rows:catalog.rows,cache:catalog.cache,integration:{...integration,native:undefined},eviction,errors},null,2));
    console.log('Enemy artwork: 40 distinct bodies, all Boss phases, ten elite marks, visual isolation and cache checks passed');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
