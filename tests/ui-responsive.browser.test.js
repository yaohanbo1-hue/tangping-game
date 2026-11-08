// Native UI layout checks. Build source in memory; never write generated HTML.
require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','ui-responsive');fs.mkdirSync(out,{recursive:true});
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n?/g,'\n');
const fileBlock=read('build.js').match(/const files = \[([\s\S]*?)\];/)[1],files=[...fileBlock.matchAll(/'([^']+)'/g)].map(m=>m[1]);
const html=read('shell.html').replace('<!--THEME-->',()=>read('theme.css')+'\n'+read('mobile.css')).replace('<!--VERSION-->',()=>read('VERSION').trim()).replace('<!--SCRIPT-->',()=>'<script>\n'+files.map(read).join('\n')+'\n</script>');
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();fs.createReadStream(file).pipe(res);});
async function exercise(engine,name,viewport,large){
  const browser=await engine.launch(process.platform==='linux'&&engine===webkit?{env:{...process.env,WEBKIT_SKIA_ENABLE_CPU_RENDERING:'1'}}:{});
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  const report={name,engine:browser.version(),viewport,large,settings:[],details:[]};
  async function snapshot(label){await page.screenshot({path:path.join(out,name+'-'+label+'.png')});}
  async function target(selector){
    const locator=page.locator(selector);await locator.scrollIntoViewIfNeeded();
    return locator.evaluate(el=>{const r=el.getBoundingClientRect(),at=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{x:r.x,y:r.y,width:r.width,height:r.height,reachable:!!at&&(el===at||el.contains(at)),font:getComputedStyle(el).fontSize};});
  }
  try{
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.locator('[data-experience="combat"]').tap();await page.locator('#phoneMenuStart').tap();
    await page.waitForFunction(()=>TouchControls.playing());
    await page.evaluate(large=>{paused=true;SFX.on=false;Music.setEnabled(false);Accessibility.set('textSize',large?'large':'normal');G.gold=1e36;G.power=1e24;G.souls=1e15;G.wave=1200;hudT=0;updateHUD(1);const boss=spawnEnemy('final',60,1);boss.x=260;BossEncounters.plan(boss);TouchControls.update();},large);
    report.hud=await page.evaluate(()=>{const hud=document.getElementById('phoneHud'),row=hud.firstElementChild,threat=document.getElementById('phoneThreat'),r=threat.getBoundingClientRect(),range=document.createRange();range.setStart(threat.firstChild,0);range.setEnd(threat.firstChild,threat.textContent.indexOf('秒')+1);return{rowOverflow:row.scrollWidth-row.clientWidth,threat:threat.textContent,countdownRight:range.getBoundingClientRect().right,threatRight:r.right,font:getComputedStyle(threat).fontSize};});
    assert.ok(report.hud.rowOverflow<=1,'resource HUD must not overflow: '+JSON.stringify(report.hud));
    assert.ok(report.hud.countdownRight<=report.hud.threatRight+1,'Boss cast name and countdown remain readable before truncation');
    await snapshot('boss-hud');await page.evaluate(()=>{G.enemies=[];TouchControls.update();});
    await page.locator('#phoneMore').tap();await page.locator('[data-panel="helpPanel"]').tap();await page.locator('.battle-settings summary').tap();
    const panel=await page.locator('#helpPanel').evaluate(el=>({width:el.clientWidth,overflow:el.scrollWidth-el.clientWidth,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom}));
    assert.ok(panel.overflow<=1&&panel.top>=-1&&panel.bottom<=viewport.height+1,'help panel fits viewport: '+JSON.stringify(panel));
    const quality=await target('#gameGraphicsQuality');assert.ok(quality.reachable&&quality.height>=44&&quality.width>=110,'quality select is a reachable native target: '+JSON.stringify(quality));
    await page.locator('#gameGraphicsQuality').selectOption('medium');
    for(const id of ['gameMasterVolume','gameMusicVolume','gameCombatVolume','gameUiVolume','gameAmbienceVolume']){
      const row=await target('#'+id);report.settings.push({id,...row});
      assert.ok(row.reachable&&row.height>=44&&row.width>=90,id+' stays usable: '+JSON.stringify(row));
      await page.locator('#'+id).focus();await page.keyboard.press('ArrowLeft');
      assert.ok(await page.locator('#'+id+'Value').textContent(),id+' has a visible value');
    }
    const close=await target('#helpClose');if(!close.reachable){await snapshot('blocked-close');console.log(await page.locator('#helpClose').evaluate(el=>{const r=el.getBoundingClientRect(),at=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {close:{x:r.x,y:r.y,w:r.width,h:r.height},at:at?.outerHTML?.slice(0,300),panelScroll:document.getElementById('helpPanel').scrollTop};}));}assert.ok(close.reachable&&close.height>=44,'help close remains reachable after scrolling settings: '+JSON.stringify(close));
    await snapshot('settings');await page.locator('#helpClose').tap();
    await page.evaluate(()=>{G.gold=G.power=1e12;G.souls=1e6;G.wave=30;for(const [i,type]of ['turret','miner','generator','repair','shield','amp','bank'].entries()){tryBuild(type,Math.floor(i/5),i%5);const b=G.buildings.at(-1);setBuildingLevel(b,6);b.animY=b.animBounce=0;}CombatTelemetry.tick(1);CombatTelemetry.damage(G.buildings[0],1234567,34567);});
    for(const type of ['turret','miner','generator','repair','shield','amp','bank']){
      await page.evaluate(type=>{selected=G.buildings.find(b=>b.type===type);selectedBuildKey=null;updateDetail(true);TouchControls.update();document.getElementById('detail').scrollTop=0;},type);
      const detail=await page.locator('#detail').evaluate(el=>{const c=document.getElementById('dContribution'),r=el.getBoundingClientRect();return{overflow:el.scrollWidth-el.clientWidth,contributionOverflow:c.scrollWidth-c.clientWidth,font:getComputedStyle(c.querySelector('.dps-note')).fontSize,top:r.top,bottom:r.bottom,text:c.textContent};});
      report.details.push({type,...detail});assert.ok(detail.overflow<=1&&detail.contributionOverflow<=1,type+' detail has no horizontal overflow: '+JSON.stringify(detail));
      assert.ok(detail.top>=-1&&detail.bottom<=viewport.height+1,type+' detail stays in the viewport');
      assert.ok(parseFloat(detail.font)>=(large?13:11),'contribution explanation follows text preference');
      const upgrade=await target('#dUp');assert.ok(upgrade.reachable&&upgrade.height>=44,type+' upgrade action is reachable: '+JSON.stringify(upgrade));
      if(type==='turret'||type==='repair'||type==='bank')await snapshot('detail-'+type);
      await page.locator('#dDismiss').tap();
    }
    assert.deepEqual(errors,[]);return report;
  }finally{await context.close();await browser.close();}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const results=[];for(const [engine,name,size,large]of [
  [chromium,'320-normal',{width:320,height:568},false],[chromium,'320-large',{width:320,height:568},true],
  [chromium,'390-normal',{width:390,height:844},false],[chromium,'390-large',{width:390,height:844},true],
  [chromium,'844-normal',{width:844,height:390},false],[chromium,'844-large',{width:844,height:390},true],
  [webkit,'webkit-320-large',{width:320,height:568},true],[webkit,'webkit-844-large',{width:844,height:390},true]]){
    results.push(await exercise(engine,name,size,large));console.log(name+': settings, live contribution, Boss countdown and native targets passed');
  }fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(results,null,2));}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
