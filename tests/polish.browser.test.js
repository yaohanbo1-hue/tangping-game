require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','polish');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname),file=p===root?path.join(root,'index.html'):p;
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch();
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[],report={};
    page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
    async function capture(name){await page.waitForFunction(()=>[...document.images].every(i=>i.complete));await page.screenshot({path:path.join(out,name+'.png')});}
    assert.equal(await page.locator('.home-brand h1 .title-lantern').count(),1);
    assert.equal(await page.locator('#buildBar .building-portrait').count(),16);
    assert.equal(await page.locator('#skillBar svg').count(),6);
    assert.equal(await page.locator('#techList .tico svg').count(),28);
    assert.ok(await page.locator('#helpBody .enemy-portrait').count()>=35);
    const entry=await page.evaluate(()=>{const button=document.getElementById('btnStart').getBoundingClientRect(),panel=document.getElementById('startPanel').getBoundingClientRect();return{top:button.top,bottom:button.bottom,panelBottom:panel.bottom};});
    assert.ok(entry.top>0&&entry.bottom<entry.panelBottom,'primary start action is fully visible before scrolling');
    report.contrast=await page.evaluate(()=>{
      const lum=color=>{const values=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return values[0]*.2126+values[1]*.7152+values[2]*.0722;};
      return ['.home-title-sub','.setup-summary','.home-section-title>small'].map(selector=>{
        const el=document.querySelector(selector);let parent=el,bg='rgb(20,35,43)';
        while(parent){const value=getComputedStyle(parent).backgroundColor;if(/^rgb\(/.test(value)){bg=value;break;}parent=parent.parentElement;}
        const color=getComputedStyle(el).color,a=lum(color),b=lum(bg);return{selector,color,baseBackground:bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      });
    });
    assert.ok(report.contrast.every(r=>r.ratio>=4.5),'key small text contrasts with its declared solid substrate');
    report.companions=await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d');
      const original=Math.random;Math.random=()=>{throw Error('companion art consumes combat RNG');};
      try{return ['firefly','spirit','shadowCat'].map(type=>{
        const draw=(time,motion)=>{c.clearRect(0,0,64,64);UiArt.companion(c,type,32,32,time,motion);return canvas.toDataURL();};
        const idle=draw(0,false);return{type,idle,moves:draw(.2,true)!==draw(1.3,true),reduced:idle===draw(9,false)};
      });}finally{Math.random=original;}
    });
    assert.equal(new Set(report.companions.map(c=>c.idle)).size,3,'three distinct neutral creature silhouettes');
    assert.ok(report.companions.every(c=>c.moves&&c.reduced),'neutral creatures animate and respect reduced motion');
    report.companions.forEach(c=>delete c.idle);
    await capture('home');
    await page.locator('.home-audio summary').click();await page.locator('#a11yText').selectOption('large');await capture('settings-large');
    await page.locator('#a11yText').selectOption('normal');await page.locator('.home-audio summary').click();
    for(const [button,panel,name,close]of [['btnNPC','npcPanel','residents','npcClose'],['btnDiary','diaryPanel','diary','diaryClose'],['btnFragments','fragmentGallery','fragments','fragClose'],['btnGacha','gachaPanel','gacha','gachaClose'],['btnBag','bagPanel','inventory','bagClose']]){
      await page.locator('#'+button).click();assert.ok(await page.locator('#'+panel).isVisible());await capture(name);await page.locator('#'+close).click();
    }
    await page.locator('[data-experience="combat"]').click();await page.locator('#btnStart').click();
    await page.evaluate(()=>{
      paused=true;G.gold=1e8;G.power=1e8;G.souls=10000;G.wave=18;G.prepTimer=25;G.tipTimer=0;G.waveTransition=null;
      const types=['turret','frost','laser','tesla','flame','repair','shield','amp','poison','sonic','missile','gravity','prism','generator','miner','bank'];
      types.forEach((type,i)=>{tryBuild(type,Math.floor(i/5),i%5);const b=G.buildings.at(-1);setBuildingLevel(b,6);if(i%3)tryBranch(b,i%2?'a':'b');b.animY=0;b.animBounce=0;});
      for(let i=0;i<12;i++){const e=spawnEnemy(['grunt','brute','flier','mimic','warden','bomber'][i%6],18,i%3);e.x=115+(i%4)*67;e.y=126+Math.floor(i/4)*155;}
      G.runeBag.push({id:'art-rune',q:'epic',name:'雨夜刻印',lv:3,affixes:[{k:'dmg',v:12},{k:'rate',v:8}]});
      G.parts=[];G.effects=[];G.texts=[];G.upgradeFx=[];G.resDirty=true;hudT=0;updateHUD(1);render(1/60);
    });
    await capture('battlefield');
    for(const [button,panel,name]of [['btnTech','techPanel','technology'],['btnAch','achPanel','achievements'],['btnHelp','helpPanel','bestiary'],['btnLot','lotPanel','lottery'],['btnRune','runePanel','runes'],['btnQuest','questPanel','quests'],['btnSave','savePanel','saves']]){
      await page.locator('#'+button).click();assert.ok(await page.locator('#'+panel).isVisible());
      if(panel==='techPanel'){assert.equal(await page.locator('#techSouls').textContent(),'10.0K');assert.notEqual(await page.locator('#techList [data-k="economy"] .tbtn').textContent(),'0🔮');}
      if(panel==='achPanel')assert.equal(await page.locator('#achList .aico svg').count(),await page.locator('#achList .ach').count());
      await capture(name);await page.evaluate(id=>togglePanel(id),panel);
    }
    await page.evaluate(()=>{selected=G.buildings[0];updateDetail(true);});await capture('specializations');
    await page.locator('#brA').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>G.buildings[0].branch),'a','specialization controls support native keyboard activation');
    await page.evaluate(()=>{selected=null;G.experience='story';G.wave=2;StoryFlow.setPlayback(true);showStoryDialog(WAVE_STORY.find(s=>s.wave===2));});
    await page.locator('#storyText').click();assert.equal(await page.evaluate(()=>storyTyping),false,'clicking story text reveals all text and choices');assert.equal(await page.locator('#storyAvatar svg').count(),1);await capture('story');
    await page.evaluate(()=>{hideStoryDialog();G.experience='combat';G.wave=18;G.bed.hp=0;gameOver();});await capture('summary');
    assert.ok(await page.locator('#toMenu').evaluate(el=>{const r=el.getBoundingClientRect(),w=document.getElementById('wrap').getBoundingClientRect();return r.top>=w.top&&r.bottom<=w.bottom;}),'summary action remains in the visible stage');
    assert.equal(await page.evaluate(()=>G.loopErrors||0),0);assert.deepEqual(errors,[]);
    report.cache=await page.evaluate(()=>({enemies:EnemyArt.stats(),ui:UiArt.stats()}));
    await context.close();
    const mobile=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),touch=await mobile.newPage();
    touch.on('pageerror',e=>errors.push(e.message));await touch.goto('http://127.0.0.1:'+server.address().port);
    await touch.screenshot({path:path.join(out,'mobile-home.png')});await touch.locator('[data-experience="combat"]').click();await touch.locator('#btnStart').click();
    await touch.screenshot({path:path.join(out,'mobile-battlefield.png')});
    report.mobile=await touch.evaluate(()=>({cards:document.querySelectorAll('#buildBar .building-portrait').length,loopErrors:G.loopErrors||0}));assert.equal(report.mobile.cards,16);assert.equal(report.mobile.loopErrors,0);
    await mobile.close();assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2));
    console.log('Visual polish: menu, all archives/drawers, real building portraits, story, summary, contrast and mobile captures passed');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
