require('./browser-env');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts','narrative');
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
    await page.locator('[data-experience="combat"]').tap();await page.locator('#phoneMenuStart').tap();
    await page.evaluate(()=>{paused=true;G.wave=60;DreamFragments.collectFragment('frag_3');showFragmentGallery();});
    assert.equal(await page.locator('.fragment-card[data-id="frag_3"] .fname').textContent(),'???');
    assert.ok((await page.locator('.fragment-card[data-id="frag_3"] .fmore').textContent()).includes('已收集'));
    assert.ok(!(await page.locator('#fragmentGallery').innerText()).includes('第四个人被被子盖住'));
    await page.screenshot({path:path.join(output,'collected-sealed.png')});await page.locator('#fragClose').tap();
    await page.evaluate(()=>{showDiaryPanel();});
    assert.ok(!(await page.locator('#diaryList').innerText()).includes('第四个人被被子盖住'));
    await page.locator('#diaryClose').tap();
    await page.evaluate(()=>{G.experience='story';G.wave=55;StoryFlow.setPlayback(true);showStoryDialog(WAVE_STORY.find(s=>s.wave===55));});
    assert.equal(await page.evaluate(()=>StoryKnowledge.canReveal(55)),false,'opening the scene does not count as acknowledging it');
    await page.locator('#storyText').tap();await page.locator('#storyChoices .story-choice').first().tap();
    assert.equal(await page.evaluate(()=>StoryKnowledge.canReveal(55)),true,'actual touch on the story reply unlocks known narrative');
    await page.locator('#storyNext').tap();await page.evaluate(()=>showFragmentGallery());
    await page.locator('.fragment-card[data-id="frag_3"]').tap();
    assert.equal(await page.locator('.fd-name').textContent(),'床边的合照');
    assert.ok((await page.locator('.fd-text').textContent()).includes('第四个人被被子盖住'));
    await page.screenshot({path:path.join(output,'acknowledged-revealed.png')});
    await page.reload();await page.locator('#btnFragments').tap();
    assert.equal(await page.locator('.fragment-card[data-id="frag_3"] .fname').textContent(),'床边的合照','known story persists after a real reload and new run');
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>G.loopErrors||0),0);
    fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify({browser:browser.version(),viewport:{width:390,height:844},errors,physicalDevice:false,verified:['combat cannot reveal truth','gallery and diary sealed','trusted story reply reveals','reload retains known narrative']},null,2));
    console.log('Real touch: collected/hidden story, diary, manual reveal and reload persistence passed');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
