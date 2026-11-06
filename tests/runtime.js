const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
// A matrix run uses one source snapshot even if a developer edits files meanwhile.
const files = ['story.js','data.js','names.js','balance.js','combat.js','enemy-actions.js','core.js','campaign.js','save.js','net.js','dream.js','quest.js','ui.js'];
const sourceText=files.map(file => fs.readFileSync(path.join(__dirname,'..',file),'utf8')).join('\n');
function createGame(seed = 1) {
  let time = 1000, next = 1, rng = seed >>> 0, videos = 0;
  const timers = new Map(), storage = new Map(), elements = new Map(), errors = [];
  function element() {
    return { style: { display: 'none', setProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
      textContent: '', innerHTML: '', value: '', children: [], offsetWidth: 1280,
      setAttribute() {}, removeAttribute() {}, remove() {}, pause() {}, load() {}, play() { return Promise.resolve(); }, appendChild(el) { this.children.push(el); }, removeChild() {},
      querySelector(selector) { if (selector === 'video') return this.children.find(el => el.tagName === 'video') || null; return element(); }, querySelectorAll() { return []; }, contains() { return true; } };
  }
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    querySelectorAll() { return []; }, addEventListener() {},
    createElement(tag) { if (tag === 'video') videos++; const el = element(); el.tagName = tag; return el; }, body: element(),
  };
  const math = Object.create(Math);
  math.random = () => { rng = (Math.imul(1664525, rng) + 1013904223) >>> 0; return rng / 4294967296; };
  const sandbox = {
    document, window: {}, Math: math, performance: { now: () => time },
    console: { log() {}, warn(...args) { errors.push(args.map(String).join(' ')); }, error(...args) { errors.push(args.map(String).join(' ')); } },
    localStorage: { getItem: k => storage.has(k) ? storage.get(k) : null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) },
    setTimeout(fn, ms = 0) { const id = next++; timers.set(id, { fn, at: time + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval(fn, ms) { const id = next++; timers.set(id, { fn, at: time + ms, interval: ms }); return id; },
    clearInterval(id) { timers.delete(id); }, requestAnimationFrame() { return 0; },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(sourceText, context);
  return {
    run: code => vm.runInContext(code, context), storage, elements, errors,
    get videos() { return videos; },
    advance(ms) {
      const until = time + ms;
      for (let i=0; i<10000; i++) {
        const item = [...timers].filter(([,t]) => t.at <= until).sort((a,b) => a[1].at-b[1].at)[0];
        if (!item) break;
        const [id,t] = item; time = t.at;
        if (t.interval) t.at += t.interval; else timers.delete(id);
        t.fn();
      }
      time = until;
    },
  };
}
module.exports = { createGame };
