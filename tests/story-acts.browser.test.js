// Presentation + state-boundary review, using the actual MP4/MP3 files.
require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright'),{createServer}=require('../tools/mobile-lab');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','story-acts');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch(),reports=[];
 try{
  for(const [name,viewport,phone,large]of [['desktop',{width:1440,height:900},false,false],['phone',{width:390,height:844},true,false],['small-large',{width:320,height:568},true,true]]){
   const context=await browser.newContext({viewport,isMobile:phone,hasTouch:phone}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/game');await page.locator('[data-experience="story"]').click();
   await page.locator(phone?'#phoneMenuStart':'#btnStart').click();
   if(await page.locator('#tutorialSkip').isVisible())await page.locator('#tutorialSkip').click();
   await page.evaluate(large=>{hideStoryDialog();G.experience='story';StoryFlow.setPlayback(true);Accessibility.set('textSize',large?'large':'normal');SFX.on=false;Music.on=true;Music.unlocked=true;Music.volume=.37;},large);
   for(const [index,wave]of [1,13,32,48,55].entries()){
    const before=await page.evaluate(({wave,index})=>{
     hideStoryDialog();G.wave=wave;G.prepTimer=999;paused=index%2===0;Music.play(Music.trackForWave(wave));
     const data=WAVE_STORY.find(s=>s.wave===wave),before={gold:G.gold,souls:G.souls,paused,seen:JSON.stringify(META.storySeen||[])};
     showStoryDialog(data);return before;
    },{wave,index});
    await page.waitForFunction(()=>document.querySelector('#storyMedia video')?.readyState>=2,null,{timeout:15000});
    await page.waitForFunction(()=>Music.active?.readyState>=2&&!Music.active.paused&&Music.active.currentTime>0,null,{timeout:10000});
    const media=await page.locator('#storyMedia video').evaluate(video=>{video.pause();video.currentTime=Math.min(2,video.duration/2);return{duration:video.duration,width:video.videoWidth,height:video.videoHeight,source:video.getAttribute('src')};});
    await page.waitForFunction(()=>!document.querySelector('#storyMedia video').seeking);
    await page.locator('#storyText').click();
    const shown=await page.evaluate(()=>{
     const panel=document.getElementById('storyDialog'),rail=document.getElementById('storyArc'),meta=document.getElementById('storyMeta'),r=panel.getBoundingClientRect();
     const raw=getComputedStyle(panel),accent=raw.getPropertyValue('--story-accent'),ground=raw.getPropertyValue('--story-ground');
     const channel=v=>{const n=parseInt(v,16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;};
     const luminance=hex=>{const c=hex.trim().replace('#','');return .2126*channel(c.slice(0,2))+.7152*channel(c.slice(2,4))+.0722*channel(c.slice(4,6));};
     const bodyColor=getComputedStyle(document.getElementById('storyText')).color,bodyHex='#'+bodyColor.match(/[\d.]+/g).slice(0,3).map(n=>Math.round(Number(n)).toString(16).padStart(2,'0')).join('');
     return{act:panel.dataset.storyAct,title:meta.textContent,rail:rail.getAttribute('aria-label'),current:rail.querySelectorAll('[data-stage="current"]').length,
      futureTitles:STORY_ARCS.slice([...rail.children].findIndex(el=>el.dataset.stage==='current')+1).filter(a=>[meta.textContent,rail.textContent,rail.getAttribute('aria-label')].join(' ').includes(a.title)).map(a=>a.id),
      metadataFont:parseFloat(getComputedStyle(meta).fontSize),overflow:panel.scrollWidth-panel.clientWidth,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},accent,ground,
      controls:[...document.querySelectorAll('#storyChoices button')].map(b=>{const br=b.getBoundingClientRect();return{top:br.top,bottom:br.bottom,height:br.height};}),
      textContrast:(luminance(bodyHex)+.05)/(luminance(ground)+.05),textScroll:document.getElementById('storyText').scrollTop,paused,duck:Music.duck,volume:Music.volume,track:Music.current,musicSource:Music.active.currentSrc,musicTime:Music.active.currentTime,revealed55:StoryKnowledge.canReveal(55)};
    });
    assert.equal(shown.current,1);assert.deepEqual(shown.futureTitles,[],'chapter rail never reveals future titles');assert.equal(shown.paused,true);assert.equal(shown.duck,.42);assert.equal(shown.volume,.37);
    assert.ok(shown.metadataFont>=(large?13:11));assert.ok(shown.overflow<=1);assert.ok(shown.textContrast>=7,'body remains legible on the act ground');
    assert.equal(shown.textScroll,0,'manually showing a long dialogue starts at its beginning');
    assert.equal(shown.revealed55,false,'a displayed scene alone never acknowledges the truth');
    if(phone){assert.ok(shown.rect.left>=0&&shown.rect.right<=viewport.width&&shown.rect.top>=0&&shown.rect.bottom<=viewport.height);assert.ok(shown.controls.every(b=>b.height>=48&&b.top>=shown.rect.top&&b.bottom<=shown.rect.bottom-6),'reply buttons remain fully visible: '+JSON.stringify(shown));}
    await page.screenshot({path:path.join(out,name+'-act-'+(index+1)+'.png')});
    const after=await page.evaluate(()=>{hideStoryDialog();return{gold:G.gold,souls:G.souls,paused,seen:JSON.stringify(META.storySeen||[]),duck:Music.duck,volume:Music.volume,railHidden:document.getElementById('storyArc').hidden,act:document.getElementById('storyDialog').dataset.storyAct};});
    assert.equal(after.gold,before.gold);assert.equal(after.souls,before.souls);assert.equal(after.seen,before.seen);assert.equal(after.paused,before.paused);assert.equal(after.duck,1);assert.equal(after.volume,.37);assert.equal(after.railHidden,true);assert.equal(after.act,undefined);
    reports.push({name,index,wave,physicalDevice:false,media,...shown});
   }
   await page.evaluate(()=>{paused=true;showStoryDialog({wave:55,speaker:'旁白',text:'一段支线对话。'});});assert.equal(await page.locator('#storyArc').isVisible(),false,'side conversations never borrow a main act from current wave');
   assert.deepEqual(errors,[]);await context.close();console.log(name+': five real media scenes, act lighting/metadata, no future titles, music ducking and pause/reward boundaries passed');
  }
  fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({browser:browser.version(),physicalDevice:false,reports},null,2));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
