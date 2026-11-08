require('./browser-env');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts', 'display');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  const target = file === root ? path.join(root, 'index.html') : file;
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return res.writeHead(404).end();
  res.setHeader('Content-Type', target.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
  fs.createReadStream(target).pipe(res);
});
async function exercise(engine, name, mobile) {
  const browser = await engine.launch(process.platform === 'linux' && engine === webkit
    ? { env: { ...process.env, WEBKIT_SKIA_ENABLE_CPU_RENDERING: '1' } } : {});
  const context = await browser.newContext({ viewport: mobile ? { width: 844, height: 390 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    // This suite checks the optional classic canvas controls; native phone mode has its own suite.
    if (mobile) await page.addInitScript(()=>localStorage.setItem('tangping_phone_controls','off'));
    await page.addInitScript(() => {
      if (!localStorage.getItem('displayTestInitialized')) {
        localStorage.setItem('tangping_accessibility', 'null');
        localStorage.setItem('displayTestInitialized', '1');
      }
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    assert.equal(await page.evaluate(() => Accessibility.uiEffects), 'simple', 'bad settings cannot prevent startup');
    assert.ok(await page.locator('body').evaluate(el => el.classList.contains('simple-ui')));
    await page.locator('.home-audio summary').click();
    await page.locator('#uiEffects').selectOption('full');
    await page.reload();
    assert.equal(await page.evaluate(() => Accessibility.uiEffects), 'full', 'full lighting persists');
    await page.locator('.home-audio summary').click();
    await page.locator('#uiEffects').selectOption('simple');
    await page.locator('[data-experience="combat"]').click();
    await page.locator('#btnStart').click();
    await page.evaluate(() => {
      G.gold = 10000; paused = true;
      globalThis.touchTrace = [];
      for (const type of ['pointerdown','pointerup','pointercancel','click']) cv.addEventListener(type, e => {
        const event = { type, pointer: e.pointerType, trusted: e.isTrusted, x: e.clientX, y: e.clientY,
          before: selectedBuildKey, hold: _holdFired };
        touchTrace.push(event);
        queueMicrotask(() => { event.after = selectedBuildKey; event.buildings = G.buildings.map(b => [b.col,b.row]); });
      }, true);
    });
    await page.mouse.move(0, 0);
    const layout = await page.evaluate(() => {
      const wrap = document.getElementById('wrap'), stage = wrap.getBoundingClientRect();
      return { scrollLeft: wrap.scrollLeft, stage: { left: stage.left, right: stage.right, top: stage.top, bottom: stage.bottom },
        cards: [...document.querySelectorAll('#buildBar .card')].map(el => {
          const r = el.getBoundingClientRect(); return { key: el.dataset.k, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        }), filter: getComputedStyle(document.getElementById('bottom')).backdropFilter,
        animation: getComputedStyle(document.querySelector('#buildBar .card')).animationName };
    });
    assert.equal(layout.cards.length, 16);
    assert.equal(layout.scrollLeft, 0, 'stage cannot scroll out from under the fixed UI');
    for (const card of layout.cards) {
      assert.ok(card.left >= layout.stage.left - 1 && card.right <= layout.stage.right + 1 && card.top >= layout.stage.top - 1 && card.bottom <= layout.stage.bottom + 1, name + ': whole card visible: ' + card.key);
    }
    assert.equal(layout.filter, 'none');
    assert.equal(layout.animation, 'none');
    await page.locator('#buildBar [data-k="miner"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#buildBar [data-k="miner"]').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('A');
    assert.equal(await page.evaluate(() => selectedBuildKey), 'poison', 'building shortcuts work while a card has keyboard focus');
    await page.locator('#buildBar [data-k="miner"]').click();
    const point = await page.evaluate(() => {
      const rect = cv.getBoundingClientRect(), p = cellCenter(0, 0);
      return { x: rect.left + p.x * rect.width / W, y: rect.top + p.y * rect.height / H };
    });
    if (mobile) {
      // Real touch drag and cancel followed by a fresh tap: preview must not place a building.
      if (engine === chromium) {
        const session = await context.newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + 20, y: point.y }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.equal(await page.evaluate(() => G.buildings.length), 0, 'drag only previews');
        await session.detach();
      }
      // Exercise the browser's synthesized click after a cancelled gesture as well.
      await page.evaluate(({ x, y }) => {
        cv.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: x, clientY: y }));
        cv.dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'touch' }));
        cv.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y }));
      }, point);
      assert.equal(await page.evaluate(() => G.buildings.length), 0, 'cancel cannot build');
      await page.touchscreen.tap(point.x, point.y);
    } else await page.mouse.click(point.x, point.y);
    // Mobile engines may deliver the synthesized click after touchend has returned.
    await page.waitForFunction(() => G.buildings.length === 1);
    assert.equal(await page.evaluate(() => G.buildings.length), 1, 'fresh input still places one building');
    assert.equal(await page.evaluate(() => selectedBuildKey), 'miner', 'zero power does not cancel an affordable gold-only build selection');
    if (mobile) {
      const directTouch = await page.evaluate(() => {
        const rect = cv.getBoundingClientRect(), p = cellCenter(1, 0);
        const input = { pointerType: 'touch', clientX: rect.left + p.x * rect.width / W, clientY: rect.top + p.y * rect.height / H };
        cv.dispatchEvent(new PointerEvent('pointerdown', input));
        cv.dispatchEvent(new PointerEvent('pointerup', input));
        const withoutClick = G.buildings.length;
        cv.dispatchEvent(new MouseEvent('click', input));
        return { withoutClick, afterClick: G.buildings.length, selection: selectedBuildKey };
      });
      assert.deepEqual(directTouch, { withoutClick: 2, afterClick: 2, selection: 'miner' }, 'touch works without a synthesized click, and a compatible click cannot repeat it');
    }

    const clock = await page.evaluate(() => {
      const originalRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = () => 0;
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      const before = { frame: statFrame, time: T, gold: G.gold };
      paused = false; simAcc = FIXED_DT / 2;
      loop(performance.now() + 60000);
      const after = { frame: statFrame, time: T, gold: G.gold };
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      const resumed = { accumulator: simAcc, paused, elapsed: performance.now() - last };
      paused = true;
      document.dispatchEvent(new Event('visibilitychange'));
      const manualPause = paused;
      delete document.hidden;
      window.requestAnimationFrame = originalRAF;
      resetFrameClock();
      return { before, after, resumed, manualPause };
    });
    assert.deepEqual(clock.before, clock.after, 'hidden page runs neither simulation nor rendering');
    assert.equal(clock.resumed.accumulator, 0, 'return discards accumulated simulation time');
    assert.equal(clock.resumed.paused, false);
    assert.ok(clock.resumed.elapsed < 1000);
    assert.equal(clock.manualPause, true, 'manual pause survives visibility changes');
    const tipPosition = await page.evaluate(() => {
      const original = ctx.fillText;
      let tipY = null;
      ctx.fillText = function(text, x, y, ...args) {
        if (text === G.tipText) tipY = y;
        return original.call(this, text, x, y, ...args);
      };
      try { drawTipBar(); } finally { ctx.fillText = original; }
      const canvas = cv.getBoundingClientRect();
      return { textY: canvas.top + tipY * canvas.height / H,
        forecastBottom: document.getElementById('wavePreview').getBoundingClientRect().bottom,
        controlsTop: document.getElementById('bottom').getBoundingClientRect().top };
    });
    assert.ok(tipPosition.textY > tipPosition.forecastBottom + 10 && tipPosition.textY < tipPosition.controlsTop - 10, 'command tip does not overlap forecast or controls');
    await page.screenshot({ path: path.join(output, name + '-controls.png') });

    // A failed video request must leave the authored choice, rewards and pause usable.
    await page.route('**/assets/story/**', route => route.abort());
    await page.evaluate(() => {
      newGame(); G.experience = 'story'; G.wave = 1; paused = false; StoryFlow.setPlayback(true);
      showStoryDialog(WAVE_STORY[0]);
    });
    // Windows WebKit's native media loader can bypass Playwright's network routes.
    // Deliver the media error to its real handler on that backend.
    if (engine === webkit) await page.locator('#storyMedia video').evaluate(video => video.dispatchEvent(new Event('error')));
    await page.waitForFunction(() => document.querySelector('#storyMedia .story-media-fallback'));
    assert.equal(await page.evaluate(() => paused), true);
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await page.evaluate(() => paused), true, 'story-owned pause survives return');
    await page.locator('#storyText').click();
    await page.locator('#storyChoices button').nth(1).click();
    assert.equal(await page.evaluate(() => G.gold), 50, 'video failure cannot lose or duplicate choice rewards');
    await page.locator('#storyNext').click();
    assert.equal(await page.evaluate(() => paused), false);
    assert.equal(await page.locator('#storyMedia video').count(), 0, 'closed story releases video');
    assert.equal(await page.evaluate(() => G.loopErrors || 0), 0);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify({ layout, clock, errors }, null, 2));
    console.log(name + ': layout, settings, keyboard/touch, background clock and video-failure checks passed');
  } catch (error) {
    console.error(name, JSON.stringify(await page.evaluate(() => ({ paused, state: G.state, wave: G.wave,
      current: currentStory && currentStory.sceneId, queue: storyQueue.length, errors: G.loopErrors || 0,
      selection: selectedBuildKey, holdFired: _holdFired, holdStart: _holdStart, trace: globalThis.touchTrace,
      media: document.getElementById('storyMedia').innerHTML, dialog: document.getElementById('storyDialog').style.display }))));
    await page.screenshot({ path: path.join(output, name + '-failure.png') });
    throw error;
  } finally { await context.close(); await browser.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const cases = process.argv.includes('--webkit-only') ? [[webkit, 'webkit', true]] : [[chromium, 'desktop', false], [chromium, 'android', true], [webkit, 'webkit', true]];
    for (const [engine, name, mobile] of cases) await exercise(engine, name, mobile);
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
