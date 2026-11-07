// Isolate raster/compositor cost without changing the simulation.
require('./browser-env');
const { webkit } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + (req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0])));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.locator('[data-experience="combat"]').click();
    await page.locator('#btnStart').click();
    await page.evaluate(() => { paused = true; });
    const results = [];
    const cases = [
      ['full-effects', 'full', ''],
      ['simple-effects', 'simple', ''],
      ['full-effects-repeat', 'full', ''],
      ['simple-effects-repeat', 'simple', ''],
      ['no-css-effects', 'full', '*{animation:none!important;transition:none!important;box-shadow:none!important;text-shadow:none!important;filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'],
      ['no-canvas', 'simple', '#game{visibility:hidden!important}'],
      ['no-css-or-canvas', 'simple', '*{animation:none!important;transition:none!important;box-shadow:none!important;text-shadow:none!important;filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}#game{visibility:hidden!important}'],
    ];
    for (const [name, effects, css] of cases) {
      await page.evaluate(({ css, effects }) => {
        Accessibility.set('uiEffects', effects);
        let style = document.getElementById('profileStyle');
        if (!style) { style = document.createElement('style'); style.id = 'profileStyle'; document.head.appendChild(style); }
        style.textContent = css;
      }, { css, effects });
      await page.waitForTimeout(250);
      const before = await page.evaluate(() => ({ time: performance.now(), frames: statFrame }));
      await page.waitForTimeout(3000);
      const after = await page.evaluate(() => ({ time: performance.now(), frames: statFrame }));
      const row = { name, elapsedMs: after.time - before.time, frames: after.frames - before.frames, fps: (after.frames - before.frames) * 1000 / (after.time - before.time) };
      results.push(row); console.log(JSON.stringify(row));
    }
    fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'artifacts', 'webkit-render-profile.json'), JSON.stringify({
      browser: browser.version(), platform: process.platform, viewport: page.viewportSize(),
      note: 'Paused empty battlefield, headless software raster; not physical phone FPS.', results,
    }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
