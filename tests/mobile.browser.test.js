require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','mobile');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname),file=p===root?path.join(root,'index.html'):p;
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);});
async function exercise(engine,name,viewport){
  const browser=await engine.launch(process.platform==='linux'&&engine===webkit?{env:{...process.env,WEBKIT_SKIA_ENABLE_CPU_RENDERING:'1'}}:{});
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  async function capture(label){await page.screenshot({path:path.join(out,name+'-'+label+'.png')});}
  async function more(panel){await page.locator('#phoneMore').tap();await page.locator('#phoneSheet [data-panel="'+panel+'"]').tap();await page.locator('#'+panel).waitFor({state:'visible'});}
  async function cell(col,row){return page.evaluate(({col,row})=>{const r=cv.getBoundingClientRect(),p=cellCenter(col,row);return{x:r.left+p.x*r.width/W,y:r.top+p.y*r.height/H};},{col,row});}
  try{
    await page.goto('http://127.0.0.1:'+server.address().port);
    assert.ok(await page.evaluate(()=>TouchControls.active()),'phone UI activates automatically on touch phones');
    assert.equal(await page.locator('#overlay').evaluate(el=>el.parentElement.tagName),'BODY','home uses native CSS pixels');
    await capture('home');
    for(const [button,panel,close]of [['btnNPC','npcPanel','npcClose'],['btnDiary','diaryPanel','diaryClose'],['btnFragments','fragmentGallery','fragClose']]){
      await page.locator('#'+button).tap();await page.locator('#'+panel).waitFor({state:'visible'});await page.locator('#'+close).tap();await page.locator('#startPanel').waitFor({state:'visible'});
    }
    await page.locator('#btnSaveMgr').tap();await page.locator('#saveClose').tap();await page.locator('#startPanel').waitFor({state:'visible'});
    await page.locator('[data-experience="combat"]').tap();await page.locator('#phoneMenuStart').tap();
    await page.waitForFunction(()=>TouchControls.playing()&&document.body.classList.contains('phone-playing'));
    await page.evaluate(()=>{paused=true;G.gold=5000;G.souls=1000;SFX.on=false;Music.setEnabled(false);hudT=0;updateHUD(1);});
    const layout=await page.evaluate(()=>{const wrap=document.getElementById('wrap').getBoundingClientRect(),dock=document.getElementById('phoneDock').getBoundingClientRect(),hud=document.getElementById('phoneHud').getBoundingClientRect();
      return{stage:{top:wrap.top,bottom:wrap.bottom,left:wrap.left,right:wrap.right},dockTop:dock.top,hudBottom:hud.bottom,buttons:[...document.querySelectorAll('#phoneDock button')].map(el=>({height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width})),font:getComputedStyle(document.getElementById('phoneGold')).fontSize};});
    await capture('battlefield');
    await page.evaluate(()=>{G.bed.hp=G.bed.maxHp*.2;G.doors[0].broken=true;hudT=0;updateHUD(1);});assert.equal(await page.locator('#phoneThreat').getAttribute('data-danger'),'true');assert.ok((await page.locator('#phoneThreat').textContent()).includes('铁门 2/3'),'native HUD keeps the defense state readable');await page.evaluate(()=>{G.bed.hp=G.bed.maxHp;G.doors[0].broken=false;hudT=0;updateHUD(1);});
    const bossLabel=await page.evaluate(()=>{const boss=spawnEnemy('lord',5,0);TouchControls.update();const label=document.getElementById('phoneThreat').textContent;G.enemies=G.enemies.filter(e=>e!==boss);TouchControls.update();return label;});assert.ok(bossLabel.includes('梦魇领主')&&bossLabel.includes('生命'),'native boss threat stays readable');
    await page.evaluate(()=>Accessibility.set('textSize','large'));assert.equal(await page.locator('#phoneHud>div').evaluate(el=>getComputedStyle(el).fontSize),'15px','native HUD respects the large-text preference');await page.evaluate(()=>Accessibility.set('textSize','normal'));
    await page.evaluate(()=>{for(const [k,v]of Object.entries({sat:12,sab:14,sal:16,sar:8}))document.documentElement.style.setProperty('--'+k,v+'px');refitAll();});
    const safe=await page.evaluate(()=>{const b=document.getElementById('wrap').getBoundingClientRect(),h=document.getElementById('phoneHud').getBoundingClientRect(),d=document.getElementById('phoneDock').getBoundingClientRect();return{left:b.left,right:b.right,top:b.top,bottom:b.bottom,hud:h.bottom,dock:d.top};});
    assert.ok(safe.left>=15&&safe.right<=viewport.width-7&&safe.top>=safe.hud-1&&safe.bottom<=safe.dock+1,'asymmetric safe areas apply to the native controls and battlefield');
    await page.evaluate(()=>{for(const key of ['sat','sab','sal','sar'])document.documentElement.style.removeProperty('--'+key);refitAll();});
    assert.ok(layout.stage.top>=layout.hudBottom-1&&layout.stage.bottom<=layout.dockTop+1,'battlefield stays between native HUD and dock: '+JSON.stringify(layout));
    assert.ok(layout.stage.left>=-1&&layout.stage.right<=viewport.width+1,'battlefield fits width');assert.ok(layout.buttons.every(b=>b.height>=44&&b.width>=44),'all primary actions have native 44px or larger targets');assert.ok(parseFloat(layout.font)>=13);
    await capture('battlefield');
    await page.locator('#phoneBuild').tap();assert.equal(await page.locator('.phone-build').count(),16);await capture('build');
    await page.locator('[data-build="miner"]').tap();assert.equal(await page.evaluate(()=>selectedBuildKey),'miner');
    const p=await cell(0,0);await page.touchscreen.tap(p.x,p.y);await page.waitForFunction(()=>G.buildings.length===1);assert.equal(await page.evaluate(()=>G.buildings[0].type),'miner','native selection reaches the original build command');
    await page.locator('#phoneCancel').tap();await page.touchscreen.tap(p.x,p.y);await page.locator('#dDismiss').waitFor({state:'visible'});
    assert.ok(await page.locator('#dUp').evaluate(el=>el.getBoundingClientRect().height>=44),'upgrade remains a native tap target');
    await page.locator('#dUp').tap();await page.waitForFunction(()=>G.buildings[0].level===2);await capture('detail');await page.locator('#dDismiss').tap();
    await page.evaluate(()=>G.runeBag.push({id:'phone-rune',name:'手机刻印',q:'common',lv:0,affixes:[{k:'dmg',v:20}]}));
    await more('runePanel');await page.locator('#runePhoneBuilding').selectOption('0');await page.locator('#autoSocket').tap();assert.ok(await page.evaluate(()=>G.buildings[0].runes.some(r=>r&&r.id==='phone-rune')),'native building selector supports socketing without returning to the board');
    await page.locator('#runeSlots [data-sus="0"]').tap();assert.ok(await page.evaluate(()=>G.runeBag.some(r=>r.id==='phone-rune')),'native rune removal works');await capture('runes');await page.locator('#runeClose').tap();await page.locator('#dDismiss').tap();
    await more('techPanel');assert.equal(await page.locator('#techPanel').evaluate(el=>el.parentElement.tagName),'BODY');
    await page.locator('#techList [data-k="economy"] .tbtn').tap();assert.equal(await page.evaluate(()=>G.tech.economy),1);await capture('technology');await page.locator('#techClose').tap();
    await more('savePanel');assert.equal(await page.locator('#saveSlots .svrow').count(),4);await capture('saves');await page.locator('#saveClose').tap();
    await page.locator('#phoneSkills').tap();assert.equal(await page.locator('.phone-skill').count(),6);await page.locator('[data-skill="freeze"]').tap();assert.ok(await page.evaluate(()=>G.buff.freeze>0));assert.ok(await page.locator('[data-skill="freeze"]').isDisabled(),'cooldown is reflected immediately');await capture('skills');await page.locator('#phoneSheetClose').tap();
    await page.evaluate(()=>{G.trialId=POSTGAME_TRIALS.find(t=>t.noSkills).id;});await page.locator('#phoneSkills').tap();assert.equal(await page.locator('.phone-skill:disabled').count(),6,'sealed trial rules apply in the new UI');await page.locator('#phoneSheetClose').tap();await page.evaluate(()=>G.trialId=null);
    // Keeping a menu sheet open never takes ownership of a manual pause.
    await page.locator('#phoneBuild').tap();await page.locator('#phoneSheetClose').tap();assert.equal(await page.evaluate(()=>paused),true);
    await page.locator('#phoneBuild').tap();const skillState=await page.evaluate(()=>JSON.stringify(G.skills));await page.keyboard.press('q');assert.equal(await page.evaluate(()=>JSON.stringify(G.skills)),skillState,'game shortcuts do not pass through a modal sheet');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.build),await page.evaluate(()=>BUILD_KEYS.at(-1)),'modal sheet keeps keyboard focus inside');await page.keyboard.press('Escape');assert.equal(await page.locator('#phoneSheet').isVisible(),false);
    await page.locator('#phonePause').tap();assert.equal(await page.evaluate(()=>paused),false);await page.locator('#phonePause').tap();assert.equal(await page.evaluate(()=>paused),true);
    await page.locator('#phoneMore').tap();await page.locator('[data-native="skip"]').tap();assert.equal(await page.evaluate(()=>G.state),'wave','native management retains early-wave summon');
    await page.evaluate(()=>{G.experience='story';G.wave=2;StoryFlow.setPlayback(true);showStoryDialog(WAVE_STORY.find(s=>s.wave===2));});
    await page.locator('#storyText').tap();await page.waitForFunction(()=>!storyTyping);await capture('story');
    const choice=await page.locator('.story-choices button').first().evaluate(el=>({height:el.getBoundingClientRect().height,min:getComputedStyle(el).minHeight,transform:getComputedStyle(el).transform,parent:el.parentElement.className}));assert.ok(choice.height>=48,JSON.stringify(choice));await page.evaluate(()=>{hideStoryDialog();G.experience='combat';});
    await page.setViewportSize(viewport.width>viewport.height?{width:390,height:844}:{width:844,height:390});await page.evaluate(()=>refitAll());
    await page.locator('#phoneBuild').tap();await page.locator('[data-build="miner"]').tap();const secondCell=await cell(1,0);await page.touchscreen.tap(secondCell.x,secondCell.y);await page.waitForFunction(()=>G.grid[1]&&G.grid[1].type==='miner');await page.locator('#phoneCancel').tap();await capture('opposite-orientation');
    await page.evaluate(()=>{G.bed.hp=0;gameOver();});await page.locator('#toMenu').tap();await page.locator('#phoneMenuStart').waitFor({state:'visible'});await page.locator('#phoneMenuStart').tap();await page.waitForFunction(()=>TouchControls.playing());await page.evaluate(()=>{paused=true;G.gold=5000;});
    await page.locator('#phoneMore').tap();await page.locator('[data-native="classic"]').tap();assert.equal(await page.evaluate(()=>TouchControls.active()),false);assert.equal(await page.locator('#overlay').evaluate(el=>el.parentElement.id),'wrap','classic mode returns the original DOM controls');
    await page.reload();assert.equal(await page.evaluate(()=>TouchControls.active()),false,'phone mode choice persists');await page.locator('#phoneEnable').tap();assert.equal(await page.evaluate(()=>TouchControls.active()),true);
    // Reorientation uses the same state and pointer geometry; no separate mobile save.
    await page.locator('[data-experience="combat"]').tap();await page.locator('#phoneMenuStart').tap();await page.evaluate(()=>{paused=true;G.gold=5000;});
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);await page.evaluate(()=>Mobile.useRotatedLayout());await page.waitForFunction(()=>!TouchControls.active());
    const rotated=await page.evaluate(()=>{selectBuild('miner');const r=cv.getBoundingClientRect(),p=cellCenter(2,0);return{x:r.right-p.y/H*r.width,y:r.top+p.x/W*r.height};});
    await page.touchscreen.tap(rotated.x,rotated.y);await page.waitForFunction(()=>G.grid[2]&&G.grid[2].type==='miner');
    await page.evaluate(()=>Mobile.exitRotated());await page.waitForFunction(()=>TouchControls.active());
    assert.equal(await page.evaluate(()=>G.grid[2].type),'miner','orientation changes preserve the same game');
    assert.equal(await page.evaluate(()=>G.loopErrors||0),0);assert.deepEqual(errors,[]);
    return{name,engine:browser.version(),viewport,layout,errors};
  }finally{await context.close();await browser.close();}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const results=[];for(const [engine,name,size]of [[chromium,'android-portrait',{width:390,height:844}],[chromium,'android-small',{width:320,height:568}],[chromium,'android-landscape',{width:844,height:390}],[chromium,'android-compact-landscape',{width:667,height:375}],[webkit,'webkit-portrait',{width:390,height:844}]]){results.push(await exercise(engine,name,size));console.log(name+': native menu, build/skills, upgrades, tech/save/story, trial rules, safe areas, persistence and rotated touch passed');}fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(results,null,2));}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
