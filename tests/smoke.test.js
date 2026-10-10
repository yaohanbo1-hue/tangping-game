// ============================================================
//  存档层回归测试（node tests/smoke.test.js）
//  锁住 v1.9.2 修掉的几类问题：挑战重链、符文清洗、脏数值回退、
//  读档重开波的经济回滚、存档名过滤、新版本存档标记。
//  只用 Node 内置能力，不依赖任何第三方包。
// ============================================================
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, name) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.error('  ✗ ' + name); }
}

// ---- 浏览器/游戏环境的最小桩 ----
const mem = new Map();
global.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: k => { mem.delete(k); },
};
global.Store = {
  get: (k, d) => { const v = mem.get(k); return v === undefined ? d : v; },
  set: (k, v) => { try { mem.set(k, String(v)); return { ok: true }; } catch (e) { return { ok: false, name: e.name }; } },
  del: k => { mem.delete(k); },
};
global.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
global.COLS = 8; global.ROWS = 5;
global.BUILD_DEFS = { miner: { cost: { gold: 60 }, maxLv: 50, hp: 180 }, turret: { cost: { gold: 70 }, maxLv: 50, hp: 220 } };
global.DIFFS = { normal: { name: '正常' }, hard: { name: '困难' } };
global.MODES = { limited: { name: '有限' }, endless: { name: '无尽' } };
global.RUNE_AFFIXES = { dmg: {}, rate: {}, hp: {} };
global.CHALLENGES = [
  { id: 'combo', name: '连环斩杀', icon: '🗡️', track: 'maxCombo', cmp: 'ge', target: w => 8, desc: w => '达成 ' + w + ' 连杀' },
  { id: 'swift', name: '疾风清场', icon: '⚡', track: 'time', cmp: 'le', target: () => 30, desc: () => '限时' },
];
global.runeSlots = () => 2;
global.bedMaxHp = lv => 420 + 95 * (lv - 1);
global.doorMaxHp = lv => 420 + 200 * (lv - 1);
global.buildingMaxHp = (def, lv) => def.hp * (1 + (lv - 1) * 0.35);
global.inBed = () => false;
global.cellCenter = (c, r) => ({ x: c * 80, y: r * 80 });

function makeG() {
  return {
    state: 'build', wave: 0, resumeWave: false,
    gold: 0, power: 0, souls: 0,
    runeBag: [], challenge: null, combo: 0, comboT: 0, maxCombo: 0,
    quest: null, diffKey: 'normal', admin: false, winWave: 0, prize: {}, reviveLeft: 0, trialId: null,
    mode: 'limited', prepTimer: 34, prepTotal: 34,
    grid: new Array(40).fill(null), buildings: [], enemies: [],
    doors: [0, 1, 2].map(i => ({ lane: i, y: 100 + i * 200, hp: 420, maxHp: 420, lv: 1, shield: 0, shieldMax: 0, broken: false })),
    bed: { hp: 420, maxHp: 420, lv: 1, shield: 0, shieldMax: 0 },
    grow: 0, growTimer: 0,
    buff: { overclock: 0, freeze: 0, goldBoost: 0, dmgBoost: 0, noSummon: false },
    fate: { dmg: 0, rate: 0, def: 0, crit: 0, critDmg: 0, range: 0, goldBoost: 0, notes: [], shield: 0, immune: false, bedRegen: 0, autoRebuild: 0, noSummonWave: false },
    fateWave: { dmg: 0, rate: 0, def: 0, crit: 0, critDmg: 0, range: 0 },
    affection: {}, melodyBuff: null,
    lot: { ep: 0, lg: 0, n: 0 }, lastDraw: null,
    tech: {}, skills: {}, ach: {},
    event: { id: 'none', eff: {} }, eventTimer: 0,
    stats: { kills: 0, bossKills: 0, goldTotal: 0, dmg: 0, build: 0, leaks: 0, laneLeaks: [0, 0, 0], laneDamage: [0, 0, 0], towerDamage: {}, towerKills: {} },
    startTime: 0, waveStartGold: 0, waveSpentGold: 0, waveStartSouls: 0, waveSpentSouls: 0, waveRuneIds: [],
    runStamp: 1, tipText: '', tipTimer: 0,
    over: false, upgradeFx: [], waveTransition: null, resDirty: false,
  };
}

// ---- 载入真实 save.js ----
const src = fs.readFileSync(path.join(__dirname, '..', 'save.js'), 'utf8');
(0, eval)(src + '\n;globalThis.SaveSystem = SaveSystem;');
const SaveSystem = global.SaveSystem;

console.log('\n[1] 挑战对象序列化往返：def 函数不丢失');
{
  global.G = makeG();
  const def = CHALLENGES[0];
  G.challenge = { id: 'combo', def, target: 10, prog: 3, done: false };
  G.gold = 500; G.wave = 7;
  const snap = JSON.parse(JSON.stringify(SaveSystem.capture()));   // 模拟 JSON 存取
  assert(snap.run.challenge.def === undefined, '序列化后 def（含函数）被丢弃');
  global.G = makeG();
  SaveSystem.restore(snap);
  assert(G.challenge && G.challenge.id === 'combo', '读档后挑战恢复');
  assert(typeof G.challenge.def.desc === 'function' && G.challenge.def.desc(1) === '达成 1 连杀', 'def 按 id 重链，desc 可调用');
  assert(G.challenge.target === 10 && G.challenge.prog === 3, '纯数据字段完整');
}

console.log('\n[2] 符文深层校验：非法数值不再打穿全局');
{
  const fixed = SaveSystem._fixRune({ id: 'r1', lv: 'abc', q: 'rare', name: 'X', affixes: [{ k: 'dmg', v: 'x' }, { k: 'nope', v: 5 }, { k: 'dmg', v: 3.5 }] });
  assert(fixed && fixed.affixes.length === 1 && fixed.affixes[0].v === 3.5, '未知词条与非数值词条被剔除');
  assert(fixed.lv === 0, '非法等级回退 0');
  assert(SaveSystem._fixRune({ id: 'r2', affixes: [{ k: 'dmg', v: NaN }] }) === null, '全非法词条的符文整颗丢弃');
  assert(SaveSystem._fixRune({ id: 'r3', lv: 2, affixes: [{ k: 'rate', v: 7.25 }] }).affixes[0].v === 7.3, '合法符文保留并归整');
}

console.log('\n[3] 脏数值回退：NaN 不再报废整局');
{
  global.G = makeG();
  const snap = JSON.parse(JSON.stringify(SaveSystem.capture()));
  snap.run.gold = 'abc'; snap.run.power = null; snap.run.souls = '12x';
  global.G = makeG();
  SaveSystem.restore(snap);
  assert(G.gold === 0 && G.power === 0 && G.souls === 0, '非数值资源回退 0，不产生 NaN');
}

console.log('\n[4] 读档重开波：本波净收益回滚，反复读档不刷资源');
{
  global.G = makeG();
  G.state = 'wave'; G.wave = 9;
  G.waveStartGold = 1000; G.waveSpentGold = 400;
  G.waveStartSouls = 50; G.waveSpentSouls = 20;
  G.gold = 1500; G.souls = 130;                 // 本波赚了 900 金 / 100 魂又花了部分
  G.waveRuneIds = ['rx1', 'rx2'];
  G.runeBag = [{ id: 'old1', lv: 0, q: 'rare', name: '旧', affixes: [{ k: 'dmg', v: 1 }] },
               { id: 'rx1', lv: 0, q: 'rare', name: '掉', affixes: [{ k: 'dmg', v: 1 }] }];
  const snap = JSON.parse(JSON.stringify(SaveSystem.capture()));
  global.G = makeG();
  SaveSystem.restore(snap);
  assert(G.gold === 600, '金币回滚到 基准-花费（1000-400），本波收益清零');
  assert(G.souls === 30, '灵魂同规则回滚（50-20）');
  assert(!G.runeBag.some(r => r.id === 'rx1') && G.runeBag.some(r => r.id === 'old1'), '本波掉落符文移除，旧符文保留');
  assert(G.waveStartGold === 600 && G.waveSpentGold === 0, '基准重定：二次读档不会重复回滚');
  // 第二次读档模拟
  G.gold = 700; G.waveSpentGold = 100;
  const snap2 = JSON.parse(JSON.stringify(SaveSystem.capture()));
  global.G = makeG();
  SaveSystem.restore(snap2);
  assert(G.gold === 500, '连续两次读档按新基准核算（600-100）');
}

console.log('\n[5] 存档名过滤：导入文件不能注入 HTML');
{
  assert(SaveSystem._safeName('<i>x&y</i>') === 'ixy/i', '尖括号与 & 被剥离');
  assert(!/[<>&"'`]/.test(SaveSystem._safeName('<img src=x onerror=alert(1)>长名字'.repeat(3))), '超长恶意名字净化后无任何标签字符');
  assert(SaveSystem._safeName(12345) === '', '非字符串回退空');
  assert(SaveSystem._safeName('a'.repeat(99)).length === 24, '长度截断 24');
}

console.log('\n[6] 新版本存档标记：不当成空槽');
{
  mem.set('tangping_save_slot0', JSON.stringify({ v: 99, savedAt: 1, run: { wave: 3 }, meta: { wave: 3 } }));
  const info = SaveSystem.list().find(x => x.slot === 0).info;
  assert(info && info.tooNew === true, 'v99 存档被标记 tooNew');
  assert(SaveSystem.read(0) === null, 'read 拒绝未来版本（面板显示占位提示而不是报错）');
}

console.log('\n[7] 写入即净化：带标签的存档名落到磁盘前已清洗');
{
  mem.clear();
  const r = SaveSystem.write(1, { v: 6, savedAt: 1, run: { wave: 2 }, name: '<b>坏名字</b>' });
  assert(r.ok === true, '写入成功');
  const raw = JSON.parse(mem.get('tangping_save_slot1'));
  assert(raw.name === 'b坏名字/b', '落盘名字无尖括号');
  assert(raw.meta.name === 'b坏名字/b', '摘要同样净化');
}

console.log('\n----------------------------------------');
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项');
process.exit(failed ? 1 : 0);
