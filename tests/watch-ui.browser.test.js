// Native notebook interaction: real buttons, same run, bounded scroll and focus.
require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','watch-ui');fs.mkdirSync(out,{recursive:true});
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n?/g,'\n');
const files=[...read('build.js').match(/const files = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const html=read('shell.html').replace('<!--THEME-->',()=>read('theme.css')+'\n'+read('mobile.css')+'\n'+read('watch-ui.css')).replace('<!--VERSION-->',()=>read('VERSION').trim()).replace('<!--SCRIPT-->',()=>'<script>\n'+files.map(read).join('\n')+'\n</script>');
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname;if(name==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();fs.createReadStream(file).pipe(res);});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const reports=[];
 try{
  const cases=[[chromium,'desktop',{width:1440,height:900},false,false],[chromium,'phone-small-large',{width:320,height:568},true,true],[chromium,'phone-landscape',{width:844,height:390},true,false],[webkit,'webkit-small-large',{width:320,height:568},true,true]];
  for(const [engine,name,viewport,phone,large]of cases.filter(([engine])=>!process.argv.includes('--chromium-only')||engine===chromium)){
   const browser=await engine.launch(process.platform==='linux'&&engine===webkit?{env:{...process.env,WEBKIT_SKIA_ENABLE_CPU_RENDERING:'1'}}:{});
   const context=await browser.newContext({viewport,isMobile:phone,hasTouch:phone}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
   try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('[data-experience="combat"]').click();await page.locator(phone?'#phoneMenuStart':'#btnStart').click();
    await page.evaluate(large=>{hideStoryDialog();paused=false;G.wave=2;G.state='build';G.prepTimer=9999;G.gold=5000;G.power=5000;G.doors[0].hp=100;NightWatch.init();Accessibility.set('textSize',large?'large':'normal');SFX.on=false;Music.setEnabled(false);WatchUI.update(1);},large);
    async function open(){if(phone){await page.locator('#phoneMore').click();await page.locator('[data-native="watch"]').click();}else await page.locator('#watchEntry').click();await page.locator('#watchNotebook').waitFor({state:'visible'});}
    await open();assert.equal(await page.evaluate(()=>paused),true);assert.equal(await page.evaluate(()=>WatchUI.isOpen()),true);
    assert.equal(await page.locator('#watchEntry').evaluate(el=>el.hidden),true,'opening immediately hides the desktop notebook entry');
    const layout=await page.locator('.watch-notebook').evaluate(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:el.scrollWidth-el.clientWidth};});
    assert.ok(layout.left>=0&&layout.right<=viewport.width&&layout.top>=0&&layout.bottom<=viewport.height);assert.ok(layout.overflow<=1);
    const choiceReasons=await page.evaluate(()=>[...document.querySelectorAll('.watch-choice-reason')].filter(p=>p.textContent.trim()).map(p=>{const r=p.getBoundingClientRect(),card=p.parentElement,cr=card.getBoundingClientRect(),br=card.querySelector('button').getBoundingClientRect();return{text:p.textContent,top:r.top,bottom:r.bottom,cardBottom:cr.bottom,buttonBottom:br.bottom,overlapsOtherAction:[...document.querySelectorAll('.watch-choice-action')].filter(b=>b!==card.querySelector('button')).some(b=>{const o=b.getBoundingClientRect();return r.left<o.right&&r.right>o.left&&r.top<o.bottom&&r.bottom>o.top;})};}));
    assert.ok(choiceReasons.length>0,'fixture includes a real disabled reason');for(const reason of choiceReasons){assert.ok(reason.top>=reason.buttonBottom-1&&reason.bottom<=reason.cardBottom+1,'disabled reason remains in its own card: '+JSON.stringify(reason));assert.equal(reason.overlapsOtherAction,false,'disabled reason is never covered by another choice');}
    await page.screenshot({path:path.join(out,name+'-decision.png')});
    const keyState=await page.evaluate(()=>JSON.stringify(G.skills));await page.keyboard.press('q');assert.equal(await page.evaluate(()=>JSON.stringify(G.skills)),keyState,'notebook keeps gameplay shortcuts out');
    const firstChoice=page.locator('[data-choice="prepare"]');await firstChoice.scrollIntoViewIfNeeded();const chosen=await firstChoice.boundingBox();assert.ok(chosen.height>=44&&chosen.width>=44);await firstChoice.click();
    assert.equal(await page.locator('[data-choice]').count(),0,'a chosen opportunity cannot be paid twice');
    assert.ok(['watchResult','watchActive'].includes(await page.evaluate(()=>document.activeElement.id)),'accepted choices move focus to a readable outcome without rebuilding the notebook');
    const expectedRoomMessage=await page.evaluate(()=>{const message=NightWatch.view().roomMessage;return{object:!!message&&typeof message==='object',text:[message?.speaker,message?.text].filter(Boolean).join(' · ')};});
    assert.equal(expectedRoomMessage.object,true,'actual roommate messages are structured objects');assert.equal(await page.locator('#watchRoommate').textContent(),expectedRoomMessage.text,'structured roommate messages render the speaker and actual text');
    await page.locator('[data-watch-tab="room"]').click();const before=await page.evaluate(()=>({gold:G.gold,power:G.power,souls:G.souls}));
    const responseRects=[];
    for(const key of ['window','lamp','window']){
      await page.locator('[data-prop="'+key+'"]').click();
      const responseRect=await page.evaluate(()=>{const r=document.getElementById('watchInteraction').getBoundingClientRect(),v=document.querySelector('.watch-pages').getBoundingClientRect(),f=document.querySelector('.watch-footer').getBoundingClientRect();return{top:r.top,bottom:r.bottom,viewportTop:v.top,viewportBottom:v.bottom,footerTop:f.top,focus:document.activeElement.dataset.prop};});
      assert.ok(responseRect.top>=responseRect.viewportTop-1&&responseRect.bottom<=Math.min(responseRect.viewportBottom,responseRect.footerTop)+1,'interaction response stays visible above the footer: '+JSON.stringify(responseRect));
      assert.equal(responseRect.focus,key,'revealing feedback does not move focus away from its prop');responseRects.push(responseRect);
    }
    assert.deepEqual(await page.evaluate(()=>({gold:G.gold,power:G.power,souls:G.souls})),before,'dorm discoveries do not mint resources');
    assert.ok(!(await page.locator('#watchFoundCount').textContent()).startsWith('0/'),'a hidden sequence discovers a keepsake');
    await page.screenshot({path:path.join(out,name+'-room.png')});
    await page.locator('[data-watch-tab="finds"]').click();assert.ok(await page.locator('.watch-find[data-found="true"]').count()>=1);assert.ok(await page.locator('.watch-find[data-found="false"]').count()>=1);
    assert.equal(await page.locator('.watch-find[data-found="false"] h4').first().textContent(),'尚未记录','unknown discoveries never expose titles');
    await page.locator('#watchResume').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'watchClose','tab wraps within the notebook');
    await page.screenshot({path:path.join(out,name+'-discoveries.png')});await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>WatchUI.isOpen()),false);assert.equal(await page.evaluate(()=>paused),false,'closing restores the original running state');
    await page.evaluate(()=>{paused=true;});await open();await page.locator('#watchClose').click();assert.equal(await page.evaluate(()=>paused),true,'opening from a manual pause preserves it');
    await page.evaluate(()=>{paused=false;});await open();assert.equal(await page.evaluate(()=>paused),true);
    const handoff=await page.evaluate(()=>{G.experience='story';StoryFlow.setPlayback(true);showStoryDialog({speaker:'旁白',text:'门外又响起脚步。',choices:[{text:'把灯留着',effect:''}]});WatchUI.update(1);return{notebook:WatchUI.isOpen(),storyVisible:document.getElementById('storyDialog').style.display,storyLocked:document.getElementById('storyDialog').dataset.inputLocked,paused};});
    assert.deepEqual(handoff,{notebook:false,storyVisible:'flex',storyLocked:'true',paused:true},'a real story choice takes pause ownership from an already open notebook');
    await page.evaluate(()=>hideStoryDialog());assert.equal(await page.evaluate(()=>paused),false,'closing the interrupting story restores the originally running game');
    await page.evaluate(()=>{paused=true;G.wave=6;G.state='build';NightWatch.init();NightWatch.choose('prepare');WatchUI.update(1);});await open();
    assert.equal(await page.locator('#watchActive').isVisible(),true,'a real next-wave overclock commitment is visible');assert.equal(await page.locator('#watchActive progress').isVisible(),false,'a whole-wave commitment never invents a numeric completion bar');assert.ok((await page.locator('#watchActive small').textContent()).includes('本波结束后结算'));await page.locator('#watchClose').click();
    await page.evaluate(()=>{G.experience='story';StoryFlow.setPlayback(true);showStoryDialog({speaker:'旁白',text:'灯还亮着。',choices:[{text:'继续守夜',effect:''}]});});assert.equal(await page.evaluate(()=>WatchUI.open()),false,'notebook never takes over a story choice');await page.evaluate(()=>hideStoryDialog());
    await page.evaluate(()=>{showNPCPanel();});assert.equal(await page.evaluate(()=>WatchUI.open()),false,'notebook never takes focus over the resident panel');await page.evaluate(()=>document.getElementById('npcPanel').style.display='none');
    await open();await page.evaluate(()=>{document.getElementById('npcPanel').style.display='block';paused=true;WatchUI.update(1);});assert.equal(await page.evaluate(()=>WatchUI.isOpen()),false);assert.equal(await page.evaluate(()=>paused),true,'a newly visible modal keeps its pause ownership');await page.evaluate(()=>document.getElementById('npcPanel').style.display='none');
    assert.deepEqual(errors,[]);reports.push({name,viewport,large,physicalDevice:false,layout,choiceReasons,responseRects,errors});fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({platform:process.platform,requested:process.argv.includes('--chromium-only')?'chromium-only':'chromium-and-webkit',physicalDevice:false,reports},null,2));console.log(name+': real notebook actions, discoveries, safe layout, focus and pause ownership passed');
   }finally{await context.close();await browser.close();}
  }
 }finally{server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
