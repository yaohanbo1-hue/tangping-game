// Same paused actors before/after the presentation change; no simulated combat.
require('./browser-env');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const baseline = process.argv.find(a => a.startsWith('--baseline='))?.slice(11) || 'f27f95e';
if (!/^[a-zA-Z0-9_./-]+$/.test(baseline) || baseline.startsWith('-')) throw Error('Invalid baseline ref');
const oldHTML = execFileSync('git', ['show', baseline + ':index.html'], { cwd: root, maxBuffer: 8e6 });
const currentHTML = fs.readFileSync(path.join(root, 'index.html'));
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/' || pathname === '/baseline.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(pathname === '/' ? currentHTML : oldHTML);
  }
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  fs.createReadStream(file).pipe(res);
});
const stats = values => {
  const sorted = [...values].sort((a,b) => a-b);
  return { meanMs: values.reduce((a,b) => a+b,0)/values.length, p95Ms: sorted[Math.floor(sorted.length*.95)] };
};
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    const results = [];
    for (const count of [24, 90]) for (const version of ['before','after','after','before']) {
      const page = await browser.newPage({ viewport: {width:1440,height:900} });
      const errors = [];page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:' + server.address().port + (version === 'before' ? '/baseline.html' : '/'));
      await page.locator('[data-experience="combat"]').click();await page.locator('#btnStart').click();
      await page.evaluate(count => {
        paused=true;Accessibility.set('uiEffects','simple');G.gold=G.power=1e8;G.souls=10000;G.wave=30;
        let seed=424242;const original=Math.random;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
        try {
          const types=Object.keys(BUILD_DEFS);
          for(let i=0;i<32;i++) {
            if(!tryBuild(types[i%types.length],Math.floor(i/5),i%5))throw Error('Profile fixture building failed');
            const b=G.buildings.at(-1);setBuildingLevel(b,12);tryBranch(b,i%2?'a':'b');b.animY=b.animBounce=0;
          }
          G.enemies=[];const ids=Object.keys(ENEMY_DEFS).filter(id=>!ENEMY_DEFS[id].boss);
          for(let i=0;i<count;i++){const e=spawnEnemy(ids[i%ids.length],30,i%3);e.x=65+(i%10)*28;e.y=90+(Math.floor(i/10)%9)*51;e.state='walk';e.hitFlash=0;}
          Object.keys(BOSS_DEFS).forEach((id,i)=>{const e=spawnEnemy(id,60,i%3);e.x=150+(i%2)*120;e.y=150+i*90;e.phase=1;e.hitFlash=0;});
        } finally {Math.random=original;}
        G.parts=[];G.effects=[];G.texts=[];G.upgradeFx=[];G.tipTimer=0;G.waveTransition=null;selected=null;shake=0;hudT=0;updateHUD(1);
        window.profileSamples=[];window.profileFrames=[];let last=0,warm=0;const originalRender=render;
        render=function(dt){const start=performance.now();originalRender(dt);const end=performance.now();
          if(++warm>45&&window.profileSamples.length<150){window.profileSamples.push(end-start);if(last)window.profileFrames.push(start-last);}last=start;};
        window.profileActors={buildings:G.buildings.length,enemies:G.enemies.length};
      }, count);
      await page.waitForFunction(()=>window.profileSamples.length>=150, {timeout:30000});
      const row = await page.evaluate(()=>({renderMs:window.profileSamples,frameMs:window.profileFrames,actors:window.profileActors,finalActors:{buildings:G.buildings.length,enemies:G.enemies.length},loopErrors:G.loopErrors||0}));
      assert.equal(row.actors.buildings,32);assert.equal(row.actors.enemies,count+5);assert.deepEqual(row.finalActors,row.actors);assert.equal(row.loopErrors,0);assert.deepEqual(errors,[]);
      const result={version,regularEnemies:count,...row.actors,render:stats(row.renderMs),frame:stats(row.frameMs)};results.push(result);console.log(JSON.stringify(result));await page.close();
    }
    const report={baseline,browser:browser.version(),platform:process.platform,viewport:{width:1440,height:900},samplesPerRun:150,
      note:'Paused fixed actors; two runs in before/after/after/before order for each density. Headless Chromium software raster, not physical phone FPS. Includes Canvas, DOM and frame scheduling; no combat simulation.',results};
    fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts','presentation-profile.json'),JSON.stringify(report,null,2));
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
