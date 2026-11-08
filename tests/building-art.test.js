// Native-scale catalog plus live render invariants. This is visual verification,
// separate from the legal player-policy campaign and branch combat regression.
require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts','buildings');
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
  const filename=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname),file=filename===root?path.join(root,'index.html'):filename;
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
function save(name,url) {fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(url.split(',')[1],'base64'));}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch();
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('[data-experience="combat"]').click();await page.locator('#btnStart').click();
    await page.evaluate(()=>{paused=true;SFX.on=false;Music.setEnabled(false);G.tipTimer=0;});
    const catalog=await page.evaluate(()=>{
      const make=()=>{const c=document.createElement('canvas');c.width=1200;c.height=720;const x=c.getContext('2d');x.fillStyle='#20303a';x.fillRect(0,0,1200,720);return [c,x];};
      const [sheet,c]=make(),[states,sc]=make(),[shots,ac]=make(),rows=[],sink=document.createElement('canvas').getContext('2d');
      function fake(type,branch,level=6) {return {type,def:BUILD_DEFS[type],branch,level,x:0,y:0,col:0,row:0,hp:100,maxHp:100,shield:0,angle:-Math.PI/2,cd:.5,fireFx:0,recoil:0};}
      function draw(context,b,x,y,time=0,motion=true) {b.x=x;b.y=y;BuildingArt.draw(context,b,bstat(b),time,0,{motion});}
      function digest(b,time=0,motion=true,selected=false) {
        const surface=document.createElement('canvas');surface.width=surface.height=128;const x=surface.getContext('2d');
        b.x=b.y=64;BuildingArt.draw(x,b,bstat(b),time,0,{motion,selected});const bytes=x.getImageData(0,0,128,128).data;let h=2166136261,ink=0,edge=0;
        for(let i=0;i<bytes.length;i++){h=Math.imul(h^bytes[i],16777619);if(i%4===3&&bytes[i]){ink++;const p=i>>2,px=p%128,py=p>>7;if(px===0||px===127||py===0||py===127)edge++;}}
        return {hash:(h>>>0).toString(16),ink,edge};
      }
      BuildingArt.types.forEach((type,index)=>{
        const gx=index%4*300,gy=Math.floor(index/4)*180,hashes=[],animations=[],grades=[];
        for(const context of [c,sc,ac]) {context.fillStyle='#aec2bf';context.font='bold 12px sans-serif';context.textAlign='left';context.fillText(BUILD_DEFS[type].name,gx+10,gy+20);}
        [null,'a','b'].forEach((branch,j)=>{
          const b=fake(type,branch),x=gx+50+j*100,y=gy+87,normal=digest(b),animated=digest(b,1.7),reduced0=digest(b,0,false),reduced1=digest(b,1.7,false);
          const expectedRange=bstat(b).range||bstat(b).zapRange||0,arcs=[],arc=ctx.arc;
          ctx.arc=function(...args){arcs.push(args[2]);return arc.apply(this,args);};selected=b;
          try{drawRoom();}finally{ctx.arc=arc;}
          hashes.push(normal);animations.push({changed:normal.hash!==animated.hash,reducedStable:reduced0.hash===reduced1.hash,
            selected:normal.hash!==digest(b,0,true,true).hash,range:!expectedRange||arcs.includes(expectedRange)});
          draw(c,b,x,y);c.fillStyle='#d4d8c9';c.font='10px sans-serif';c.textAlign='center';c.fillText(branch?b.def.branch[branch].name:'原型 Lv.6',x,gy+150,96);
          if(j===0) {
            const damaged=fake(type,null);digest(damaged);damaged.hp=20;draw(sc,damaged,gx+50,gy+87);
            BuildingArt.draw(sink,damaged,bstat(damaged),0,.2,{motion:false});
            damaged.hp=80;draw(sc,damaged,gx+150,gy+87);
            BuildingArt.draw(sink,damaged,bstat(damaged),0,.6,{motion:false});
            setBuildingLevel(damaged,30);draw(sc,damaged,gx+250,gy+87);
            for(const [k,label]of ['受损 / 受击','实际回血 / 修复','Lv.30 / 升级'].entries()){sc.font='10px sans-serif';sc.textAlign='center';sc.fillStyle='#d4d8c9';sc.fillText(label,gx+50+k*100,gy+150);}
          }
          b.fireFx=.2;b.recoil=1;b.flameOn=type==='flame';b.gravOn=type==='gravity';draw(ac,b,x,y,1);
          BuildingArt.impact(ac,{weapon:type,x:x+24,y:y-23,color:b.def.color,life:.18,maxLife:.26,target:{poison:4}});
          ac.fillStyle='#d4d8c9';ac.font='10px sans-serif';ac.textAlign='center';ac.fillText(branch?b.def.branch[branch].name:'工作 / 开火',x,gy+150,96);
        });
        for(const level of [6,12,30])grades.push(digest(fake(type,null,level)).hash);
        rows.push({type,hashes,animations,gradeHashes:grades});
      });
      const fitted=[];
      for(const type of BuildingArt.types)for(const branch of [null,'a','b']){const b=fake(type,branch);BuildingArt.draw(sink,b,bstat(b),0,0,{motion:false});fitted.push(b);}
      let warmGradients=0;const gradient=CanvasRenderingContext2D.prototype.createLinearGradient;
      CanvasRenderingContext2D.prototype.createLinearGradient=function(...args){warmGradients++;return gradient.apply(this,args);};
      try{for(let frame=0;frame<30;frame++)for(const b of fitted){b.angle=frame*.2;BuildingArt.draw(sink,b,bstat(b),frame/10,0,{motion:true});}}
      finally{CanvasRenderingContext2D.prototype.createLinearGradient=gradient;}
      return {rows,idle:sheet.toDataURL(),states:states.toDataURL(),shots:shots.toDataURL(),cache:BuildingArt.stats(),warmGradients};
    });
    for(const row of catalog.rows) {
      assert.equal(new Set(row.hashes.map(h=>h.hash)).size,3,row.type+' has three distinct silhouettes');
      assert.ok(row.hashes.every(h=>h.ink>250&&h.edge===0),row.type+' is visible without clipping');
      assert.ok(row.animations.every(a=>a.changed&&a.reducedStable&&a.selected&&a.range),row.type+' idle, reduced motion, selection and real ranges work');
      assert.equal(new Set(row.gradeHashes).size,3,row.type+' evolves at high levels');
    }
    assert.equal(catalog.rows.length,16);assert.ok(catalog.cache.entries<=144&&catalog.cache.bytes<5.4e6);
    assert.equal(catalog.warmGradients,0,'brushed metal and lenses bake gradients only when building cached components');
    save('catalog-idle',catalog.idle);save('catalog-states',catalog.states);save('catalog-working',catalog.shots);
    const integration=await page.evaluate(()=>{
      newGame();G.experience='combat';paused=true;G.gold=1e10;G.power=1e10;G.souls=1e5;
      BUILD_KEYS.forEach((type,i)=>{tryBuild(type,Math.floor(i/5),i%5);const b=G.buildings.at(-1);setBuildingLevel(b,12);tryBranch(b,i%2?'a':'b');b.animY=0;b.animBounce=0;});
      G.texts=[];G.parts=[];G.upgradeFx=[];G.tipTimer=0;G.waveTransition=null;shake=0;
      selected=G.buildings.find(b=>b.type==='gravity');
      const snapshot=()=>JSON.stringify({gold:G.gold,power:G.power,souls:G.souls,stats:G.stats,tech:G.tech,bed:G.bed,doors:G.doors,
        buildings:G.buildings.map(b=>[b.type,b.level,b.branch,b.hp,b.maxHp,b.shield,b.cd,b.zcd,b.angle,b.x,b.y,b.runes]),enemies:G.enemies});
      const before=snapshot(),random=Math.random,startCache=BuildingArt.stats().builds;
      Math.random=()=>{throw Error('art consumed combat RNG');};
      try {for(let i=0;i<60;i++)render(1/60);}finally{Math.random=random;}
      const labels=[],fillText=ctx.fillText;ctx.fillText=function(...args){labels.push(args[0]);return fillText.apply(this,args);};
      try{render(1/60);}finally{ctx.fillText=fillText;}
      return {same:before===snapshot(),branchLabels:G.buildings.every(b=>labels.includes(b.def.branch[b.branch].name)),
        rebuilds:BuildingArt.stats().builds-startCache,cache:BuildingArt.stats(),native:cv.toDataURL()};
    });
    assert.equal(integration.same,true,'all sixteen live buildings render without changing combat state');
    assert.equal(integration.branchLabels,true,'real branch identities remain readable at high levels');
    const warmed=await page.evaluate(()=>{const before=BuildingArt.stats().builds;for(let i=0;i<30;i++)render(1/60);return BuildingArt.stats().builds-before;});
    assert.equal(warmed,0,'aiming and idle frames reuse cached components');save('battlefield-native',integration.native);
    await page.setViewportSize({width:844,height:390});await page.waitForTimeout(250);await page.screenshot({path:path.join(output,'mobile-context.png')});
    assert.deepEqual(errors,[]);
    const report={engine:browser.version(),headless:true,rows:catalog.rows,cache:catalog.cache,warmGradients:catalog.warmGradients,integration:{same:integration.same,cache:integration.cache,warmedRebuilds:warmed},errors};
    fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(report,null,2));console.log('Building art: 48 variants, 16 animation/state/level families and live render invariants passed');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
