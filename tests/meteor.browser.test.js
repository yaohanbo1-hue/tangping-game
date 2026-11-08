require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('[data-experience="combat"]').tap();await page.locator('#phoneMenuStart').tap();
  await page.evaluate(()=>{paused=true;SFX.on=false;G.wave=20;G.state='wave';G.spawnQueue=[];G.bossQueue=[];G.enemies=[];globalThis.target=spawnEnemy('grunt',1,1);target.hp=target.maxHp=100000;target.speed=0;target.res={};target.weak={};target.shield=0;TouchControls.update();});
  await page.locator('#phoneSkills').tap();await page.locator('[data-skill="meteor"]').tap();await page.waitForTimeout(700);
  assert.deepEqual(await page.evaluate(()=>({paused,hp:target.hp,pending:G.effects.filter(e=>e.type==='meteor'&&!e.detonated).length})),{paused:true,hp:100000,pending:1},'a real skill touch cannot hurt while paused');
  await page.locator('#phoneSheetClose').tap();await page.locator('#phonePause').tap();await page.waitForFunction(()=>target.hp<100000);
  assert.equal(await page.evaluate(()=>paused),false);assert.deepEqual(errors,[]);console.log('Real phone touch: meteor waits through pause and hits only after resume');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
