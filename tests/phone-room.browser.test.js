require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','phone-room');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const reports=[];
  try{for(const [engine,width,height,large]of [[chromium,390,844,false],[chromium,320,568,true],[webkit,320,568,true]]){
    const browser=await engine.launch(process.platform==='linux'&&engine===webkit?{env:{...process.env,WEBKIT_SKIA_ENABLE_CPU_RENDERING:'1'}}:{});
    try{
      const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('[data-experience="combat"]').tap();await page.locator('#phoneMenuStart').tap();
      await page.evaluate(large=>{paused=true;G.gold=5000;SFX.on=false;Accessibility.set('textSize',large?'large':'normal');TouchControls.update();},large);
      assert.equal(await page.locator('[data-room-cell]').count(),40);
      await page.locator('#phoneBuild').tap();await page.locator('[data-build="turret"]').tap();
      const cell=page.locator('[data-room-cell][data-col="0"][data-row="0"]');await cell.tap();
      assert.deepEqual(await page.evaluate(()=>({type:G.grid[0]?.type,gold:G.gold,build:G.stats.build})),{type:'turret',gold:4930,build:1},'native cell uses the real purchase and charges exactly once');
      await cell.tap();await page.locator('#dUp').tap();
      assert.equal(await page.evaluate(()=>G.grid[0].level),2,'native cell selects the actual building for real upgrade');await page.locator('#dDismiss').tap();
      await page.locator('#phoneBuild').tap();await page.locator('[data-build="miner"]').tap();
      const right=page.locator('[data-room-cell][data-col="7"][data-row="4"]');await right.scrollIntoViewIfNeeded();
      const rect=await right.boundingBox();assert.ok(rect.width>=44&&rect.height>=44,'small phone keeps finger-size cells');
      await right.tap();assert.equal(await page.evaluate(()=>G.grid[4*COLS+7]?.type),'miner','rightmost cell remains accessible after scrolling');
      const before=await page.evaluate(()=>G.gold),bed=page.locator('[data-room-cell][data-col="7"][data-row="1"]');await bed.scrollIntoViewIfNeeded();await bed.tap();
      assert.equal(await page.evaluate(()=>!!selected?.isBed),true,'bed cells select the shared bed');assert.equal(await page.evaluate(()=>G.gold),before,'bed cannot be overwritten by a selected building');await page.locator('#dDismiss').tap();
      assert.equal(await page.locator('#phoneCancel').isDisabled(),true,'closing the bed detail leaves no stale placement');assert.equal(await page.locator('[data-room-cell][data-col="6"][data-row="4"]').isDisabled(),true);
      const layout=await page.evaluate(()=>{const guide=document.getElementById('phoneGuide').getBoundingClientRect(),dock=document.getElementById('phoneDock').getBoundingClientRect();return{guideBottom:guide.bottom,dockTop:dock.top,documentOverflow:document.documentElement.scrollWidth-innerWidth};});
      assert.ok(layout.guideBottom<=layout.dockTop-5&&layout.documentOverflow<=1,'board scrolls within available space and never covers the dock');
      const stem=engine.name()+'-'+width+(large?'-large':'');await page.screenshot({path:path.join(out,stem+'.png')});
      await page.setViewportSize({width:height,height:width});await page.waitForTimeout(150);assert.equal(await page.locator('#phoneGuide').isVisible(),false,'landscape prioritizes the battlefield');
      assert.equal(await page.evaluate(()=>G.grid[0].level),2,'orientation preserves the same game');assert.deepEqual(errors,[]);
      reports.push({browser:engine.name(),version:browser.version(),width,height,large,physicalDevice:false,layout});
    }finally{await browser.close();}
  }fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(reports,null,2));console.log('Phone room board: 40 native cells, one purchase, upgrade, right-edge scrolling, bed protection and rotation passed');
  }finally{server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
