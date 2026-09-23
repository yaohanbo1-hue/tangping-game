const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** 角度插值：把 from 朝 to 转 t 比例（t 取 0~1，自动走最短弧） */
function turnTo(from, to, t) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, Math.max(0, t));
}
const pick = arr => arr[(Math.random() * arr.length) | 0];
const cellRect = (c, r) => ({ x: ROOM_X0 + c * CW, y: ARENA_TOP + r * CH, w: CW, h: CH });
const cellCenter = (c, r) => ({ x: ROOM_X0 + c * CW + CW / 2, y: ARENA_TOP + r * CH + CH / 2 });
const inBed = (c, r) => BED_CELLS.some(b => b[0] === c && b[1] === r);
const FMT_UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd'];
function fmt(n) {
  if (n === Infinity) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return String(Math.floor(n));
  let i = 0;
  while (n >= 1000 && i < FMT_UNITS.length - 1) { n /= 1000; i++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : String(Math.floor(n))) + FMT_UNITS[i];
}
function fmt1(n) {
  if (n === Infinity) return '∞';
  if (!isFinite(n)) return '0';
  if (n < 0) return '-' + fmt1(-n);
  if (n < 100) return String(Math.round(n * 10) / 10);
  return fmt(n);
}
function bedGoldEff() {
  return bedGold() * techVal('sleep', 0.12) * techVal('eternity', 0.60) * diffCfg().goldMul;
}
function bedGoldEffOf(lv) {
  return bedGoldOf(lv) * techVal('sleep', 0.12) * techVal('eternity', 0.60) * diffCfg().goldMul;
}
const SFX = {
  ctx: null, on: true,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.on = false; } } },
  tone(freq, dur, type = 'sine', vol = 0.14, slide = 0) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.2, filt = 900) {
    if (!this.on || !this.ctx) return;
    const n = (this.ctx.sampleRate * dur) | 0, buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.ctx.destination); s.start();
  },
  shoot() { this.tone(680, 0.06, 'square', 0.04, -420); },
  laser() { this.tone(1250, 0.13, 'sawtooth', 0.05, -900); },
  zap() { this.tone(320, 0.11, 'sawtooth', 0.06, 520); },
  hit() { this.tone(200, 0.05, 'triangle', 0.045, -110); },
  boom() { this.noise(0.34, 0.26, 700); this.tone(90, 0.3, 'sine', 0.15, -55); },
  build() { this.tone(430, 0.09, 'triangle', 0.1); setTimeout(() => this.tone(650, 0.1, 'triangle', 0.09), 70); },
  up() { this.tone(520, 0.08, 'sine', 0.1); setTimeout(() => this.tone(780, 0.12, 'sine', 0.1), 65); },
  coin() { this.tone(900, 0.05, 'square', 0.04); },
  err() { this.tone(160, 0.14, 'square', 0.09, -60); },
  wave() { this.tone(300, 0.16, 'sawtooth', 0.1, 220); setTimeout(() => this.tone(420, 0.22, 'sawtooth', 0.1, 180), 140); },
  lose() { this.tone(260, 0.5, 'sine', 0.2, -180); setTimeout(() => this.tone(180, 0.7, 'sine', 0.18, -110), 260); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.12), i * 110)); },
  skill() { this.tone(700, 0.2, 'sine', 0.12, 700); this.noise(0.25, 0.12, 1600); },
  achieve() { [660, 880, 1180].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'sine', 0.12), i * 90)); },
};
const Store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } },
};
const META_KEY = 'tangping_meta';
const META = { gold: 0, pity: 0, inv: {}, equipped: [], runs: 0, best: 0 };
function loadMeta() {
  try { const o = JSON.parse(Store.get(META_KEY, '{}') || '{}'); Object.assign(META, o); } catch (e) { }
  if (!META.inv || typeof META.inv !== 'object') META.inv = {};
  if (!Array.isArray(META.equipped)) META.equipped = [];
  META.gold = Math.max(0, Math.floor(META.gold || 0));
}
function saveMeta() { Store.set(META_KEY, JSON.stringify(META)); }
loadMeta();
function diffCfg() { return (G && G.diffKey && DIFFS[G.diffKey]) || DIFFS.normal; }
const finalWave = () => (G && G.winWave ? G.winWave : FINAL_WAVE);
function placeBuildingAt(type, level) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!G.grid[r * COLS + c] && !inBed(c, r)) {
      G.gold += BUILD_DEFS[type].cost.gold;
      if (tryBuild(type, c, r)) {
        const b = G.buildings[G.buildings.length - 1];
        setBuildingLevel(b, level || 1);
        addText(b.x, b.y - 34, '🎁 开局赠礼', '#ffd166', true);
        return b;
      }
      G.gold -= BUILD_DEFS[type].cost.gold;
    }
  }
  return null;
}
/* ==================================================================
 * 生命值公式的唯一来源
 * 这条公式（基础 × 等级成长 × 加固工程 × 生命强化 × 不朽要塞 × 道具加成 × 转职 1.3）
 * 原先在 12 个地方各抄了一遍，抄漏的地方直接变成数值 Bug：
 *   · upgradeDoor / upgradeBed 漏「要塞加固」→ 装备该道具后升门/床反而掉血
 *   · applySave 漏「要塞加固」→ 读档后铁门与床铺生命凭空少 50%
 *   · setBuildingLevel 漏等级成长 → 开局赠礼的 Lv10 炮塔只有 Lv1 的生命
 *   · 剧情奖励「所有建筑免费升级」只留等级项 → 建筑最大生命被砍掉一大截
 * 现在统一走这三个函数，且都写成 function 声明以便前面的代码提前调用。
 * ================================================================== */
const prizeHpMul = () => (G && G.prize && G.prize.hp) || 1;
const buildingHpMul = () => techVal('structure', 0.12) * techVal('vitality', 0.10) * techVal('fortress', 0.50) * prizeHpMul();
/** 建筑最大生命：def + 等级 + 是否已转职 */
function buildingMaxHp(def, level, branch) {
  return def.hp * (1 + (Math.max(1, level) - 1) * 0.35) * buildingHpMul() * (branch ? 1.3 : 1);
}
/** 铁门最大生命：等级 */
function doorMaxHp(lv) {
  return (420 + 200 * (Math.max(1, lv) - 1)) * techVal('ironwall', 0.15) * techVal('fortress', 0.50) * prizeHpMul();
}
/** 床铺最大生命：等级 */
function bedMaxHp(lv) {
  return (420 + 95 * (Math.max(1, lv) - 1)) * techVal('fortress', 0.50) * prizeHpMul();
}
function setBuildingLevel(b, lv) {
  b.level = Math.max(1, Math.min(b.def.maxLv || 50, lv));
  b.maxHp = buildingMaxHp(b.def, b.level, b.branch); b.hp = b.maxHp;
}
function setBedLevel(lv) {
  G.bed.lv = Math.max(1, Math.min(50, lv));
  G.bed.maxHp = bedMaxHp(G.bed.lv);
  G.bed.hp = G.bed.maxHp;
}
function setDoorLevel(d, lv) {
  d.lv = Math.max(1, Math.min(50, lv));
  d.maxHp = doorMaxHp(d.lv);
  d.hp = d.maxHp; d.broken = false;
}
// 永久型道具：装备后永久生效，每局不消耗库存。其余为消耗型——开局自动用掉 1 个，本局持续生效。
const PERMANENT_PRIZES = { freeAdmin: 1 };
function applyEquippedPrizes() {
  G.prize = {};
  const list = (META.equipped || []).filter(k => META_PRIZES[k] && (PERMANENT_PRIZES[k] || (META.inv[k] || 0) > 0));
  list.forEach(k => {
    try { META_PRIZES[k].apply(); } catch (e) { console.warn('prize', k, e); }
    if (!PERMANENT_PRIZES[k]) {          // ★ 消耗型：开局消耗 1 个
      META.inv[k] = (META.inv[k] || 0) - 1;
      if (META.inv[k] <= 0) delete META.inv[k];
    }
  });
  const hp = G.prize.hp || 1;
  if (hp !== 1) { G.doors.forEach(d => { d.maxHp *= hp; d.hp = d.maxHp; }); G.bed.maxHp *= hp; G.bed.hp = G.bed.maxHp; }
  saveMeta();                              // 库存已变，立即持久化
  return list;
}
function metaReward(won) {
  const d = diffCfg();
  if (d.admin) return 0;
  let g = Math.round((G.wave * 14 + G.stats.kills * 0.6 + G.stats.bossKills * 20) * d.reward);
  if (won) g = Math.round(g * 1.5 + 300);
  g = Math.round(g * ((G.prize && G.prize.reward) || 1));
  return g;
}
function grantMetaReward(won) {
  const g = metaReward(won);
  G.lastReward = g;
  META.gold += g; META.runs = (META.runs || 0) + 1;
  if (G.wave > (META.best || 0)) META.best = G.wave;
  saveMeta();
  return g;
}
function jumpToWave(n) {
  if (!G || !G.admin) return false;
  n = Math.max(1, Math.min(999, n | 0));
  G.enemies = []; G.spawnQueue = []; G.bossQueue = []; G.effects = [];
  G.wave = n - 1;
  startWave();
  return true;
}
let G = null;
let mouse = { x: -999, y: -999 };
let hoverCell = null, selected = null, selectedBuildKey = null;
let shake = 0, flash = 0, hitStop = 0, timeScale = 1, paused = false;
function newGame(loadFrom) {
  EventBus.clear(); // 清理上一局事件监听，防止累积
  G = {
    state: 'build', wave: 0,
    gold: 0, power: 0, souls: 0,
    runeBag: [], challenge: null, combo: 0, comboT: 0, maxCombo: 0,
    quest: null,   // 梦境委托状态（quest.js QuestSystem 管理，随存档持久化）
    diffKey: 'normal', admin: false, winWave: 0, prize: {}, reviveLeft: 0, lastReward: 0,
    mode: 'limited', rebuilds: 0,
    prepTimer: 34, prepTotal: 34,
    spawnQueue: [], bossQueue: [], spawnTimer: 0,
    grid: new Array(COLS * ROWS).fill(null),
    buildings: [], enemies: [], bullets: [], effects: [], parts: [], texts: [],
    doors: LANES.map(l => ({ lane: l.i, y: l.doorY, hp: 420, maxHp: 420, lv: 1, shield: 0, shieldMax: 0, broken: false })),
    bed: { hp: 420, maxHp: 420, lv: 1, shield: 0, shieldMax: 0 },
    grow: 0, growTimer: 0,
    buff: { overclock: 0, freeze: 0, goldBoost: 0, dmgBoost: 0 },
    // 剧情/旋律带来的命运加成：fate = 本局永久，fateWave = 仅本波，melodyBuff = 限波次
    fate: { dmg: 0, rate: 0, def: 0, crit: 0, critDmg: 0, notes: [], shield: 0, immune: false, bedRegen: 0, autoRebuild: 0, noSummonWave: false },
    fateWave: { dmg: 0, rate: 0, def: 0, crit: 0, critDmg: 0 },
    affection: {}, melodyBuff: null,
    lot: { ep: 0, lg: 0, n: 0 }, lastDraw: null,
    tech: {}, skills: {}, ach: {},
    event: EVENTS[0], eventTimer: 0,
    stats: { kills: 0, bossKills: 0, goldTotal: 0, dmg: 0, build: 0, leaks: 0 },
    startTime: performance.now(),
    tipText: '', tipTimer: 0,
    over: false, upgradeFx: [], waveTransition: null, resDirty: false,
  };
  TECH_KEYS.forEach(k => G.tech[k] = 0);
  SKILL_KEYS.forEach(k => G.skills[k] = 0);
  BED_CELLS.forEach(([c, r]) => G.grid[r * COLS + c] = 'bed');
  selected = null; selectedBuildKey = null;
  if (loadFrom) applySave(loadFrom);
  else setTip('点击左侧建筑卡片，再点击房间空位建造。先放「金币矿机」和「发电机」！', 8);
  // 初始化梦境系统
  if (typeof DreamEngine !== 'undefined') { try { DreamEngine.init(); } catch(e) { console.warn('DreamEngine init failed:', e); } }
}
const techVal = (k, per) => 1 + G.tech[k] * per;
/* ------------------------------------------------------------------
 * 面板属性计算（bstat）—— 每帧缓存
 * 调用频率极高：渲染时每座建筑每帧一次、开火时 towerDmgMul 还会遍历所有增幅塔、
 * 经济结算里再遍历一次。而每次计算都要重跑转职公式 + 遍历符文词条（还会 new 对象）。
 * 主循环每帧把 statFrame +1，同帧内复用结果即可，实测可省掉 4~6 倍重复计算。
 * ------------------------------------------------------------------ */
let statFrame = 0;
function bstat(b) {
  if (b.__sf === statFrame && b.__ss) return b.__ss;
  const s = b.def.stat(b.level);
  const base = (b.branch && b.def.branch && b.def.branch[b.branch]) ? b.def.branch[b.branch].mod(s, b) : s;
  if (b.runes && b.runes.length) {
    const rm = 1 + G.tech.runemaster * 0.15;
    b.runes.forEach(r => {
      if (!r) return;
      r.affixes.forEach(a => {
        const A = RUNE_AFFIXES[a.k];
        if (A) A.apply(base, affixVal(r, a) * rm);
      });
    });
  }
  if (base.range != null) base.range *= techVal('focus', 0.06);
  if (base.dmg != null && G.prize && G.prize.dmg) base.dmg *= G.prize.dmg;
  if (base.rate != null) base.rate *= techVal('swift', 0.08);
  b.__sf = statFrame; b.__ss = base;
  return base;
}
/* ------------------------------------------------------------------
 * 面板 DPS 估算 —— 回答「这座炮塔到底多强」
 * 只用于展示，不参与实际结算。多目标武器按折算目标数估算。
 * ------------------------------------------------------------------ */
function towerPanelDps(s, b) {
  if (!s || !s.dmg) return 0;
  const fate = G.fate || {}, fateW = G.fateWave || {};
  const critC = clamp(G.tech.crit * 0.04 + (fate.crit || 0) + (fateW.crit || 0), 0, 1);
  const critM = 2.2 + G.tech.critmaster * 0.4 + (fate.critDmg || 0) + (fateW.critDmg || 0);
  const critMul = 1 + critC * (critM - 1);
  let targets = 1;
  if (s.split) targets = Math.min(4, s.split);
  else if (s.multi) targets = s.multi;
  else if (s.chain) targets = Math.min(3, s.chain);
  else if (s.aoe) targets = 2.5;      // 全范围声波：按 2.5 个目标折算
  else if (s.splash) targets = 1.6;   // 溅射导弹：按 1.6 折算
  const dps = s.dmg * targets;
  if (b && b.type === 'flame') return dps * 1.5;   // 接触伤害 + 50% 灼烧残留
  if (b && b.type === 'gravity') return dps;       // 引力塔伤害极低，价值在控场
  return dps * (s.rate || 0) * critMul;
}
/** 共鸣增幅快照，供详情面板展示（把「隐形机制」显性化） */
function resBonusOf(b) {
  return {
    n: (b && b.resN) || 0,
    dmg: (b && b.resDmg) || 1,
    rate: (b && b.resRate) || 1,
    tier: (b && b.resTier) || '',
    extra: (b && b.resExtra) || null,
    color: (b && b.resColor) || '#7dd3fc',
  };
}
const runeSlots = () => 2 + G.tech.runelord;
function tryDropRune(wave, x, y) {
  const chance = (0.012 + wave * 0.0016) * (1 + G.tech.looting * 0.2);
  if (Math.random() > Math.min(0.5, chance)) return null;
  const r = rollRune(wave);
  G.runeBag.push(r);
  addText(x, y - 26, '🔮 ' + r.name + '（' + qualityOf(r.q).name + '）', qualityOf(r.q).color, true);
  SFX.coin(); checkAchievements();
  return r;
}
function bedGold() { return 8 * Math.pow(2, G.bed.lv - 1); }
function bedGoldOf(lv) { return 8 * Math.pow(2, lv - 1); }
function totalGoldRate() {
  const bed = bedGold() * techVal('sleep', 0.12) * techVal('eternity', 0.60);
  let r = bed;
  G.buildings.forEach(b => { if (b.type === 'miner') r += (bstat(b).gold || 0) * techVal('mining', 0.10); });
  return r * techVal('economy', 0.07) * techVal('compound', 0.25) * (G.event.eff.goldMul || 1) * (G.buff.goldBoost ? 2 : 1) * diffCfg().goldMul;
}
function powerInfo() {
  let regen = 0;
  G.buildings.forEach(b => { const s = bstat(b); if (s.regen) regen += s.regen; });
  return { regen: regen * (1 + G.tech.electric * 0.12) * techVal('overcore', 0.40) * (G.event.eff.powerMul || 1) };
}
const powerNet = () => powerInfo().regen;
const canFire = () => true;
function computeResonance() {
  const tw = G.buildings.filter(b => b.def && b.def.tower);
  for (const b of tw) {
    const types = new Set();
    for (const o of tw) {
      if (o === b || !o.def.dmgType) continue;
      if (dist(o, b) <= RESONANCE_R) types.add(o.def.dmgType);
    }
    const n = types.size;
    let tier = null;
    RESONANCE_TIERS.forEach(t => { if (n >= t.n) tier = t; });
    b.resN = n;
    b.resTier = tier ? tier.name : '';
    b.resTierN = tier ? tier.n : 0;
    b.resColor = tier ? tier.color : null;
    b.resDmg = tier ? tier.dmg : 1;
    b.resRate = tier ? tier.rate : 1;
    b.resExtra = null;
    const selfType = b.def.dmgType;
    const arr = [...types].filter(Boolean);
    // 优先：自身元素 + 邻居元素 的组合（更符合"两座塔互相增幅"）
    if (selfType) {
      for (const t of arr) {
        const rx = RESONANCE_PAIRS[[selfType, t].sort().join('+')];
        if (rx) { b.resExtra = rx; break; }
      }
    }
    // 其次：邻居元素之间的组合
    if (!b.resExtra) {
      outer:
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const rx = RESONANCE_PAIRS[[arr[i], arr[j]].sort().join('+')];
          if (rx) { b.resExtra = rx; break outer; }
        }
      }
    }
  }
}
function towerDmgMul(b) {
  let m = techVal('firepower', 0.08) * techVal('annihilation', 0.20);
  // 虚无梦魇光环：附近炮塔伤害大幅降低
  for (const e of G.enemies) {
    if (e.dead || !e.def || !e.def.nullify) continue;
    if (dist(e, b) <= e.def.nullify.range) { m *= e.def.nullify.mul; break; }
  }
  G.buildings.forEach(o => {
    if (o.type === 'amp' && dist(o, b) <= bstat(o).range + 30) m += bstat(o).bonus;
  });
  if (G.buff.overclock > 0) m *= 1.5;
  if (G.buff.dmgBoost) m *= 1.6;
  // 血怒：建筑残血时伤害提升（此前写在 return 之后，从未生效）
  if (G.tech.berserk > 0 && b.hp < b.maxHp * 0.4) m *= 1 + G.tech.berserk * 0.25;
  if (b.resDmg) m *= b.resDmg;
  // 剧情命运加成 + 旋律增益
  m *= 1 + (G.fate.dmg || 0) + (G.fateWave.dmg || 0);
  if (G.melodyBuff && G.melodyBuff.dmgMul) m *= G.melodyBuff.dmgMul;
  // 深层梦境对建筑的影响（story.js DEEP_DREAM_LEVELS 里写的规则，此前没接线）
  if (typeof DeepDream !== 'undefined' && DeepDream.isActive()) {
    const bm = DeepDream.getBuildingModifiers();
    if (bm && bm.dmgMul) m *= bm.dmgMul;
  }
  return m;
}
function towerRateMulOn(b) {
  let m = 1;
  if ((b.freezeT || 0) > 0) m *= 0.4;
  if (b.resRate) m *= b.resRate;
  if (typeof DeepDream !== 'undefined' && DeepDream.isActive()) {
    const bm = DeepDream.getBuildingModifiers();
    if (bm && bm.rateMul) m *= bm.rateMul;
  }
  return m;
}
function towerRateMul() {
  let m = techVal('rapid', 0.05);
  if (G.buff.overclock > 0) m *= 1.8;
  m *= 1 + (G.fate.rate || 0) + (G.fateWave.rate || 0);
  if (G.melodyBuff && G.melodyBuff.rateMul) m *= G.melodyBuff.rateMul;
  return m;
}
function typeMul(e, dtype) {
  if (!dtype) return 1;
  let res = (e.res && e.res[dtype]) || 0;
  const weak = (e.weak && e.weak[dtype]) || 0;
  if (e.affixRes) res = Math.min(0.85, res + e.affixRes);
  res = Math.max(0, res - G.tech.overload * 0.06);
  return clamp(1 - res + weak, 0.15, 3);
}
const SELL_RATE = 0.7;
const COST_MUL = 2;
const FREE_POWER_LV = 7;
const upgradeCost = (def, lv) => {
  const free = def.noPowerUp || lv <= FREE_POWER_LV;
  return {
    gold: Math.round(def.cost.gold * Math.pow(COST_MUL, lv - 1)),
    power: free ? 0 : Math.round(def.cost.power * Math.pow(1.5, lv - FREE_POWER_LV) * (G.event.eff.powerCostMul || 1)),
  };
};
const doorUpgradeCost = lv => Math.round(85 * Math.pow(COST_MUL, lv - 1));
const bedUpgradeCost = lv => Math.round(200 * Math.pow(COST_MUL, lv - 1));
function buildName(b) {
  const pool = NAME_POOL[b.type];
  if (!pool) return b.def.name;
  const base = pool[clamp(b.level, 1, 50) - 1] || b.def.name;
  return b.branch ? base + (BRANCH_SUFFIX[b.level - 1] || '') : base;
}
function bedName() { return NAME_POOL.bed[clamp(G.bed.lv, 1, 50) - 1] || '床铺'; }
function doorName(d) { return NAME_POOL.door[clamp(d.lv, 1, 50) - 1] || '铁门'; }
const canAfford = c => !!(G && G.admin) || (G.gold >= c.gold && G.power >= (c.power || 0) && G.souls >= (c.soul || 0));
function payCost(c) { if (G.admin) return; G.gold -= c.gold; G.power -= (c.power || 0); G.souls -= (c.soul || 0); }
function tryBuild(key, c, r) {
  const def = BUILD_DEFS[key];
  if (!def || c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
  if (G.grid[r * COLS + c]) return false;
  if (!G.admin && G.gold < def.cost.gold) { SFX.err(); setTip('资源不足：需要 ' + fmt(def.cost.gold) + ' 金币'); return false; }
  G.gold -= def.cost.gold;
  const p = cellCenter(c, r);
  const b = {
    type: key, def, level: 1, col: c, row: r, x: p.x, y: p.y,
    hp: def.hp * techVal('structure', 0.12) * techVal('vitality', 0.10) * techVal('fortress', 0.50) * ((G.prize && G.prize.hp) || 1), maxHp: def.hp * techVal('structure', 0.12) * techVal('vitality', 0.10) * techVal('fortress', 0.50) * ((G.prize && G.prize.hp) || 1),
    shield: 0, shieldMax: 0, cd: 0, angle: -Math.PI / 2, target: null, branch: null,
    invested: def.cost.gold, pulse: 0, kills: 0, runes: [null, null], fireFx: 0,
  };
  b.animY = -60; b.animBounce = 0.3;
  G.buildings.push(b); G.grid[r * COLS + c] = b; G.resDirty = true;
  G.stats.build++;
  SFX.build();
  // 梦境系统：建筑建造钩子
  if (typeof DreamEngine !== 'undefined') { try { DreamEngine.onBuildingClick(key); } catch(e) { console.warn('DreamEngine buildingClick:', e); } }
  // 建造粒子爆发（增强版）
  spawnParts(p.x, p.y, 22, def.color, 3.5, 0.8);
  spawnParts(p.x, p.y, 8, '#fff', 2, 0.4); // 白色核心粒子
  addText(p.x, p.y - 20, '建造完成', def.color);
  shakeBy(3); // 建造微震
  return true;
}
function tryUpgrade(b) {
  if (b.level >= b.def.maxLv) { SFX.err(); return false; }
  const c = upgradeCost(b.def, b.level);
  if (!canAfford(c)) { SFX.err(); setTip('资源不足，无法升级'); return false; }
  payCost(c); b.level++; b.invested += c.gold;
  const nh = buildingMaxHp(b.def, b.level, b.branch);
  b.hp += nh - b.maxHp; b.maxHp = nh;
  if (!G.upgradeFx) G.upgradeFx = [];
  G.upgradeFx.push({ x: b.x, y: b.y, t: 0.8 }); // 升级光环爆发（更久）
  SFX.up();
  spawnParts(b.x, b.y, 20, b.def.color, 3.5, 0.8); // 更多粒子
  spawnParts(b.x, b.y, 6, '#ffe066', 2.5, 0.5); // 金色星光
  addText(b.x, b.y - 22, 'Lv.' + b.level, '#ffe066');
  shakeBy(3); // 升级微震
  return true;
}
function tryBranch(b, which) {
  const br = b.def.branch && b.def.branch[which];
  if (!br || b.branch || b.level < BRANCH_AT) { SFX.err(); return false; }
  if (!canAfford(br.cost)) { SFX.err(); setTip('资源不足，无法转职'); return false; }
  payCost(br.cost); b.branch = which; b.invested += br.cost.gold;
  b.maxHp *= 1.3; b.hp = b.maxHp;
  SFX.achieve(); spawnParts(b.x, b.y, 30, '#ffe066', 4);
  addText(b.x, b.y - 26, '转职：' + br.name, '#ffe066', true);
  checkAchievements();
  return true;
}
function sellBuilding(b) {
  const back = Math.round(b.invested * SELL_RATE);
  G.gold += back;
  recycleRunes(b, '出售');
  G.grid[b.row * COLS + b.col] = null;
  G.buildings.splice(G.buildings.indexOf(b), 1);
  if (selected === b) selected = null;
  SFX.coin();
  // 出售金币粒子爆发
  spawnParts(b.x, b.y, 20, '#ffd166', 3.5, 0.9); // 金色粒子
  spawnParts(b.x, b.y, 8, '#fff', 2, 0.4); // 白色核心
  addText(b.x, b.y, '+' + back, '#ffd166');
  shakeBy(2);
  G.resDirty = true;
}
function upgradeDoor(d) {
  if (d.lv >= 50) { SFX.err(); return; }
  const c = { gold: doorUpgradeCost(d.lv) };
  if (!canAfford(c)) { SFX.err(); return; }
  payCost(c); d.lv++;
  const nh = doorMaxHp(d.lv);
  d.hp += nh - d.maxHp; d.maxHp = nh;
  SFX.up(); addText(WALL_X + 10, d.y - 62, '铁门 Lv.' + d.lv, '#9ef01a');
  spawnParts(WALL_X, d.y, 20, '#9ef01a', 3);
}
function upgradeBed() {
  if (G.bed.lv >= 50) { SFX.err(); return; }
  const c = { gold: bedUpgradeCost(G.bed.lv) };
  if (!canAfford(c)) { SFX.err(); return; }
  payCost(c); G.bed.lv++;
  const nh = bedMaxHp(G.bed.lv);
  G.bed.hp += nh - G.bed.maxHp; G.bed.maxHp = nh;
  SFX.up(); addText(BED_CX, BED_CY - 64, '床铺 Lv.' + G.bed.lv, '#ffd166');
  spawnParts(BED_CX, BED_CY, 18, '#ffd166', 3);
}
function spawnParts(x, y, n, color, spd = 2, life = 0.6) {
  // 性能保护：粒子上限 800，超出时减少生成数量
  if (G.parts.length > 800) n = Math.max(1, Math.floor(n / 3));
  else if (G.parts.length > 500) n = Math.max(1, Math.floor(n / 2));
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(0.4, 1) * spd;
    G.parts.push({ x, y, vx: Math.cos(a) * s * 60, vy: Math.sin(a) * s * 60, life: rnd(life * 0.6, life * 1.3), max: life, color, size: rnd(2, 5) });
  }
}
function addText(x, y, t, color = '#fff', big = false) {
  // 性能保护：浮动文字上限 60
  if (G.texts.length > 60) G.texts.shift();
  G.texts.push({ x: x + rnd(-8, 8), y, t, color, life: big ? 1.5 : 0.9, max: big ? 1.5 : 0.9, big });
}
const addEffect = e => G.effects.push(e);
const shakeBy = v => { shake = Math.min(30, shake + v); };
function setTip(t, d = 5) { G.tipText = t; G.tipTimer = d; }
function updateEconomy(dt) {
  const g = totalGoldRate() * dt;
  G.gold += g; G.stats.goldTotal += g;
  G.power = Math.max(0, G.power + powerNet() * dt);
  G.growTimer += dt;
  if (G.growTimer >= 8 && G.grow < 25) { G.growTimer -= 8; G.grow++; addText(BED_CX, BED_CY - 74, '发育 +1（灵魂 +2%）', '#7cf39a'); SFX.coin(); checkAchievements(); }
  G.buildings.forEach(b => {
    const s = bstat(b);
    if (b.type === 'repair' || s.heal) {
      G.doors.forEach(d => { if (Math.abs(d.y - b.y) < 130 && dist({ x: WALL_X, y: d.y }, b) <= s.range + 90) healTarget(d, s.heal * dt); });
      G.buildings.forEach(o => { if (o !== b && dist(b, o) <= s.range) healTarget(o, s.heal * 0.6 * dt); });
      if (s.shieldHeal) G.buildings.forEach(o => { if (o !== b && dist(b, o) <= s.range && o.shieldMax > 0) o.shield = Math.min(o.shieldMax, o.shield + s.shieldHeal * dt); });
    }
    if (b.type === 'shield' || s.shield) {
      G.doors.forEach(d => { if (Math.abs(d.y - b.y) < 150) d.shieldMax = Math.max(d.shieldMax, s.shield); });
      G.bed.shieldMax = Math.max(G.bed.shieldMax, s.shield * 0.8);
      G.buildings.forEach(o => { if (dist(b, o) <= s.range) o.shieldMax = Math.max(o.shieldMax, s.shield); });
    }
  });
  const maxLvShield = Math.max(1, ...G.buildings.filter(b => b.type === 'shield').map(b => b.level));
  const regen = Math.max(3, 14 - maxLvShield);
  [G.bed, ...G.doors, ...G.buildings].forEach(t => {
    if (t.shieldMax > 0 && t.shield < t.shieldMax) t.shield = Math.min(t.shieldMax, t.shield + regen * dt);
  });
  G.doors.forEach(d => {
    if (d.broken && d.hp > d.maxHp * 0.25) { d.broken = false; addText(WALL_X + 20, d.y - 70, '铁门已修复！', '#7cf39a', true); }
  });
}
function healTarget(t, v) { if (t.hp < t.maxHp) { t.hp = Math.min(t.maxHp, t.hp + v); return true; } return false; }
/**
 * 剧情承诺的统一解释器
 * 剧情里写下的每一条选择/理解奖励都通过这里结算，避免「说了给却没给」的冲突。
 * 无法量化的标记会写进命运印记（G.fate.notes）并同步到梦境日记，绝不明着骗玩家。
 *
 * @param {string} text - 来自 story.js 的效果文案
 * @param {object} [ctx] - 上下文（如 { speaker: '林小夏' }），可选
 * @returns {{ got: string[], notes: string[] }}
 */
function applyStoryEffect(text, ctx) {
  const got = [], notes = [];
  if (!text) return { got, notes };
  const t = String(text);
  const waveScoped = /本波/.test(t);           // 只在当前波生效
  const bucket = waveScoped ? G.fateWave : G.fate;
  const durLabel = waveScoped ? '本波' : '本局';

  // 1) 金币 / 灵魂
  const gold = t.match(/获得\s*(\d+)\s*金币/);
  if (gold) { G.gold += +gold[1]; got.push('+' + gold[1] + '💰'); }
  const soul = t.match(/获得\s*(\d+)\s*灵魂/);
  if (soul) { G.souls += +soul[1]; got.push('+' + soul[1] + '🔮'); }
  const goldMul = t.match(/金币(获取|收益)\s*\+(\d+)%/);
  if (goldMul) { G.buff.goldBoost = Math.max(G.buff.goldBoost || 0, +goldMul[2] / 100); got.push('金币产出 +' + goldMul[2] + '%' + durLabel); }

  // 2) 百分比加成：伤害 / 射速 / 防御 / 暴击 / 全属性
  const all = t.match(/全属性\s*\+(\d+)%/) || t.match(/全属性提升\s*(\d+)%/);
  if (all) {
    const v = +all[1] / 100;
    bucket.dmg += v; bucket.rate += v; bucket.def += v; bucket.crit += v * 0.5;
    G.bed.maxHp *= 1 + v; G.bed.hp *= 1 + v;
    G.doors.forEach(d => { d.maxHp *= 1 + v; d.hp *= 1 + v; });
    G.buildings.forEach(b => { b.maxHp *= 1 + v; b.hp *= 1 + v; });
    got.push('全属性 +' + all[1] + '%（含生命）' + durLabel);
  } else {
    const dmg = t.match(/(?:炮塔|全炮塔|所有炮塔|攻击力)[^%]{0,8}?\+(\d+)%/);
    if (dmg && !/射速/.test(t)) { bucket.dmg += +dmg[1] / 100; got.push('炮塔伤害 +' + dmg[1] + '%' + durLabel); }
  }
  const rate = t.match(/射速[^%]{0,6}?\+(\d+)%/) || t.match(/攻速[^%]{0,6}?\+(\d+)%/);
  if (rate) { bucket.rate += +rate[1] / 100; got.push('炮塔射速 +' + rate[1] + '%' + durLabel); }
  const def = t.match(/(?:防御|护甲)[^%]{0,6}?\+(\d+)%/);
  if (def && !/射速/.test(t)) { bucket.def += +def[1] / 100; got.push('建筑防御 +' + def[1] + '%' + durLabel); }
  const crit = t.match(/暴击率\s*\+(\d+)%/);
  if (crit) { bucket.crit += +crit[1] / 100; got.push('暴击率 +' + crit[1] + '%' + durLabel); }
  const critDmg = t.match(/暴击伤害\s*\+(\d+)%/);
  if (critDmg) { bucket.critDmg = (bucket.critDmg || 0) + +critDmg[1] / 100; got.push('暴击伤害 +' + critDmg[1] + '%' + durLabel); }

  // 3) 回复类
  if (/床铺?[^，。]{0,6}(满血|恢复至满|回复至满)|床铺回满|全回复|完全恢复|满血复活/.test(t)) {
    G.bed.hp = G.bed.maxHp;
    got.push('床铺回满');
  } else if (/床铺|回复|恢复/.test(t)) {
    const pct = t.match(/回复\s*(\d+)%/) || t.match(/恢复\s*(\d+)%/);
    const flat = t.match(/回复\s*(\d+)\s*点/) || t.match(/每秒恢复\s*(\d+)\s*点/);
    if (/每秒恢复\s*(\d+)\s*点/.test(t)) {
      const v = +t.match(/每秒恢复\s*(\d+)\s*点/)[1];
      G.fate.bedRegen = (G.fate.bedRegen || 0) + v; got.push('床铺每秒 +' + v + ' 生命（本局）');
    } else if (pct) {
      G.bed.hp = Math.min(G.bed.maxHp, G.bed.hp + G.bed.maxHp * (+pct[1] / 100)); got.push('床铺回复 ' + pct[1] + '%');
    } else if (flat) {
      G.bed.hp = Math.min(G.bed.maxHp, G.bed.hp + (+flat[1])); got.push('床铺回复 ' + flat[1] + ' 生命');
    }
  }

  // 4) 记忆碎片
  if (/碎片/.test(t) && typeof DreamFragments !== 'undefined') {
    const rarity = /传说/.test(t) ? 'legendary' : /史诗/.test(t) ? 'epic' : /稀有/.test(t) ? 'rare' : 'common';
    const f = DreamFragments.grantRandomFragment(rarity);
    if (f) got.push('碎片「' + f.name + '」');
  }

  // 5) 特殊机制
  if (/免疫(控制|恐惧|眩晕)/.test(t)) { G.fate.immune = true; got.push('免疫控制（本局）'); }
  if (/永久护盾|护盾\s*\+(\d+)/.test(t)) {
    const sh = t.match(/护盾\s*\+(\d+)/);
    const v = sh ? +sh[1] : 300;
    G.fate.shield = (G.fate.shield || 0) + v;
    G.bed.maxHp += v; G.bed.hp += v;
    got.push('永久护盾 +' + v);
  }
  if (/自动重建/.test(t)) { G.fate.autoRebuild = Math.max(G.fate.autoRebuild || 0, 0.2); got.push('建筑自动重建 20%（本局）'); }
  if (/不再召唤额外敌人|停止召唤/.test(t)) { G.fate.noSummonWave = true; got.push('本波停止召唤'); }
  if (/超频/.test(t)) {
    const s = t.match(/超频\s*(\d+)\s*秒/);
    G.buff.overclock = Math.max(G.buff.overclock || 0, s ? +s[1] : 8);
    got.push('超频 ' + (s ? s[1] : 8) + ' 秒');
  }
  if (/(所有|全部|全体)[^。；]{0,12}建筑[^。；]{0,8}(免费)?升级/.test(t)) {
    let n = 0;
    G.buildings.forEach(b => { if (b.level < b.def.maxLv) { b.level++; b.maxHp = buildingMaxHp(b.def, b.level, b.branch); b.hp = b.maxHp; n++; } });
    if (n) got.push(n + ' 座建筑免费升级');
  }

  // 6) 深层梦境入口
  if (/深层梦境/.test(t) && typeof DeepDream !== 'undefined' && !DeepDream.isActive()) {
    const lv = DeepDream.DEEP_LEVELS[0];
    if (lv) { DeepDream.enterDeepDream(lv.id); got.push('坠入' + lv.name); }
  }

  // 7) 好感度
  const aff = t.match(/好感度\s*\+(\d+)/);
  if (aff) {
    const who = (ctx && ctx.speaker) || (t.match(/(林小夏|周默|赵磊|艾拉|摩伊拉|凯恩|奈亚|阿尔忒弥斯)/) || [, '???'])[1];
    G.affection[who] = (G.affection[who] || 0) + +aff[1];
    got.push(who + ' 好感度 +' + aff[1]);
  }

  // 8) NPC 相关
  const npcName = t.match(/(守梦者·艾拉|记忆商人·摩伊拉|梦行者·凯恩|铁匠|低语者·奈亚|守床人·阿尔忒弥斯)/);
  if (npcName && typeof NPCGuardians !== 'undefined' && typeof NPCGuardians.recruitByName === 'function') {
    const n = NPCGuardians.recruitByName(npcName[1]);
    if (n) got.push('驻守：' + n);
  }

  // 9) 兜底：无法量化的剧情标记 → 命运印记 + 梦境日记，绝不静默吞掉
  if (!got.length) {
    notes.push(t);
    G.fate.notes.push(t);
    if (typeof DreamDiary !== 'undefined' && typeof DreamDiary.addEntry === 'function') {
      DreamDiary.addEntry('story', '命运印记：' + t);
    }
  } else if (typeof DreamDiary !== 'undefined' && typeof DreamDiary.addEntry === 'function') {
    DreamDiary.addEntry('story', '选择回响：' + t + '（实际获得：' + got.join('、') + '）');
  }
  if (got.length) setTip('✓ ' + got.join('　'), 4);
  return { got, notes };
}
function damageTarget(t, dmg) {
  if (G.admin && t && t.dead === undefined) return false;
  if (G.track && t && t.lane != null && t.y != null && t.def === undefined && !t.isBed)
    G.track.doorDmg = (G.track.doorDmg || 0) + Math.max(0, dmg);
  // 剧情加成的防御：建筑受伤减免（最高 60%）
  const defSum = (G.fate.def || 0) + (G.fateWave.def || 0);
  if (defSum > 0) dmg *= Math.max(0.4, 1 - defSum);
  if (t.shield > 0) { const a = Math.min(t.shield, dmg); t.shield -= a; dmg -= a; }
  if (dmg > 0) t.hp -= dmg;
  return t.hp <= 0;
}
function bossPhases(e) {
  if (!e.boss) return null;
  return (BOSS_DEFS[e.bossKey] && BOSS_DEFS[e.bossKey].phases) || BOSS_PHASES;
}
function bossKeyForWave(n) {
  if (n >= finalWave()) return 'final';
  const idx = Math.floor(n / 5 - 1) % BOSS_ORDER.length;
  return BOSS_ORDER[(idx + BOSS_ORDER.length) % BOSS_ORDER.length];
}
function spawnEnemy(type, wave, lane) {
  let d = ENEMY_DEFS[type];
  let bossKey = null;
  if (type === 'boss' || !d) {
    bossKey = BOSS_DEFS[type] ? type : bossKeyForWave(wave);
    d = BOSS_DEFS[bossKey];
    type = 'boss';
  }
  const L = LANES[lane !== undefined ? lane : (Math.random() * 3) | 0];
  const hpScale = (1 + wave * 0.18 + Math.pow(Math.max(0, wave - 10), 1.4) * 0.075 + Math.pow(Math.max(0, wave - 30), 1.5) * 0.04) * (G.event.eff.hpMul || 1) * diffCfg().hpMul;
  const dmgScale = (1 + wave * 0.10) * diffCfg().dmgMul;
  const e = {
    type, def: d, lane: L.i,
    x: rnd(8, 54), y: rnd(L.y0 + 22, L.y1 - 22),
    hp: d.hp * hpScale, maxHp: d.hp * hpScale,
    dmg: d.dmg * dmgScale, speed: d.speed * rnd(0.92, 1.08) * (G.event.eff.spdMul || 1),
    r: d.r, state: 'walk', target: null, atkCd: 0, door: null,
    slow: 0, slowT: 0, burn: 0, burnT: 0, burnDmg: 0, burnStack: 0,
    poison: 0, poisonT: 0, poisonDps: 0,
    elem: null, vuln: 0, vulnT: 0,
    stealthT: 0, alpha: 1, untargetable: false, stun: 0,
    res: Object.assign({}, d.res), weak: Object.assign({}, d.weak),
    affixes: [], affixRes: 0, phase: 0, summonT: 0,
    wob: rnd(0, 6.28), anim: 0, dead: false, boss: !!d.phases, bossKey,
    hitFlash: 0, hasteT: 0, hasteMul: 1, inCombatT: 0,
    maxPhase: d.phases ? d.phases.length - 1 : 0,
    empT: 0, reviveT: 0, mimicRevealed: false, parasiteTarget: null,
  };
  if (d.shieldself) { e.shield = e.maxHp * d.shieldself; e.shieldMax = e.shield; }
  if (d.phaseShield) { e.phaseShield = d.phaseShield; e.segMax = e.maxHp / (d.phaseShield + 1); e.segIdx = 0; }
  const eliteChance = clamp((wave - 4) * 0.035, 0, 0.42);
  if (wave >= 5 && Math.random() < eliteChance && !d.boss) {
    const n = wave >= 20 && Math.random() < 0.3 ? 2 : 1;
    const pool = AFFIX_KEYS.slice();
    for (let i = 0; i < n && pool.length; i++) {
      const k = pool.splice((Math.random() * pool.length) | 0, 1)[0];
      e.affixes.push(k);
      const a = AFFIX[k];
      if (a.hp) { e.maxHp *= a.hp; e.hp = e.maxHp; }
      if (a.spd) e.speed *= a.spd;
      if (a.shield) { e.shield = e.maxHp * a.shield; e.shieldMax = e.shield; }
      if (a.allres) e.affixRes = a.allres;
      if (a.flat) e.flat = a.flat;
      if (a.regen) e.regenR = a.regen;
      if (a.vamp) e.vamp = a.vamp;
      if (a.frenzy) e.frenzyOn = true;
      if (a.split) e.splitN = a.split;
      if (a.explode) e.explodeN = a.explode;
    }
    e.elite = true;
  }
  G.enemies.push(e);
  // BOSS 出场演出：震屏 + 警戒飘字 + 冲击环（纯视觉，数值零改动；x 有偏移避免被左缘裁切）
  if (e.boss) {
    shakeBy(12); SFX.boom();
    addText(e.x + 70, e.y - 34, '⚠️ ' + d.name + ' 现身', '#ff4d6d', true);
    addEffect({ type: 'ring', x: e.x + 34, y: e.y, r: 110, color: '#ff4d6d', life: 0.7, maxLife: 0.7 });
  }
  // 深层梦境修正
  if (typeof DeepDream !== 'undefined' && DeepDream.isActive()) {
    const mods = DeepDream.getEnemyModifiers();
    if (mods) {
      if (mods.hpMul) { e.maxHp *= mods.hpMul; e.hp = e.maxHp; }
      if (mods.spdMul) e.speed *= mods.spdMul;
      if (mods.dmgMul) e.dmg *= mods.dmgMul;
      if (mods.resAll) { for (const k in e.res) e.res[k] = Math.min(0.9, e.res[k] + mods.resAll); }
    }
    // 深层规则里写的「对某属性额外脆弱 +N%」，进 e.weak（typeMul 会算进去）
    const nerfs = DeepDream.getEnemyNerfs();
    if (nerfs) {
      e.weak = e.weak || {};
      for (const k in nerfs) e.weak[k] = (e.weak[k] || 0) + nerfs[k];
    }
  }
  return e;
}
function enemySpeed(e) {
  let s = e.speed;
  if (e.slowT > 0) s *= (1 - e.slow);
  // 精英词缀狂暴 + 敌人内置狂暴（如 berserker）
  const frenzyThreshold = (e.def.frenzy && e.def.frenzy.at) || 0.35;
  const frenzySpd = (e.def.frenzy && e.def.frenzy.spd) || 1.9;
  if ((e.frenzyOn || e.def.frenzy) && e.hp < e.maxHp * frenzyThreshold) s *= frenzySpd;
  if (e.phase > 0 && e.boss) {
    const bps = bossPhases(e);
    if (bps[e.phase]) s *= bps[e.phase].speed;
  }
  if (e.hasteT > 0 && e.hasteMul) s *= e.hasteMul;
  if (G.buff.freeze > 0 || e.stun > 0) s = 0;
  return s;
}
function updateEnemies(dt) {
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.dead) { G.enemies.splice(i, 1); continue; }
    e.anim += dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.slowT > 0) e.slowT -= dt;
    if (e.stun > 0) e.stun -= dt;
    if (e.boss) {
      const p = e.hp / e.maxHp;
      const phs = bossPhases(e);
      let np = 0;
      for (let k = 1; k < phs.length; k++) if (p <= phs[k].at) np = k;
      if (np > e.phase) {
        e.phase = np;
        const ph = phs[np];
        e.res = Object.assign({}, ph.res);
        addText(e.x, e.y - 60, ph.name + '！', '#ff4d6d', true);
        spawnParts(e.x, e.y, 34, '#ff4d6d', 5, 0.9); shakeBy(12); SFX.boom();
      }
    }
    if (e.def.stealth) {
      e.stealthT += dt;
      const cyc = e.stealthT % 6;
      e.alpha = cyc < 2.2 ? 0.28 : 1;
      e.untargetable = cyc < 2.2;
    }
    // 灼烧叠层衰减：火焰塔每帧会重新点亮 flameOn，离开火舌后才开始掉层
    if (!e.flameOn && e.burnStack > 0) e.burnStack = Math.max(0, e.burnStack - dt * 1.2);
    e.flameOn = false;
    if (e.burnT > 0) {
      e.burnT -= dt;
      // 走统一伤害管线：抗性 / 护盾 / 统计 / 击杀归属（烈焰专精挑战）全部生效
      if (e.burnDmg > 0) dotDamage(e, e.burnDmg, 'fire', e.burnSrc, dt);
      if (Math.random() < dt * 8) spawnParts(e.x, e.y, 1, '#ff8c42', 1.2, 0.4);
      if (e.hp <= 0) { killEnemy(e); continue; }
      if (e.burnT <= 0) { e.burnDmg = 0; e.burnStack = 0; e.burnSrc = null; }
    }
    if (e.elem) { for (const k in e.elem) { if (e.elem[k] > 0) e.elem[k] -= dt; } }
    if (e.hasteT > 0) e.hasteT -= dt;
    if (e.def && e.def.haste) {
      G.enemies.forEach(o => {
        if (o === e || o.dead) return;
        if (dist(o, e) <= e.def.haste.range) { o.hasteT = 0.5; o.hasteMul = e.def.haste.mul; }
      });
    }
    if (e.vulnT > 0) { e.vulnT -= dt; if (e.vulnT <= 0) e.vuln = 0; }
    if (e.poisonT > 0) {
      e.poisonT -= dt;
      e.hp -= e.poisonDps * e.poison * dt;
      G.stats.dmg += e.poisonDps * e.poison * dt;
      if (Math.random() < dt * 5) spawnParts(e.x, e.y, 1, '#a3e635', 1.1, 0.4);
      if (e.hp <= 0) { killEnemy(e); continue; }
    }
    const sp_ = e.def;
    if (sp_.emp) {
      e.empT -= dt;
      if (e.empT <= 0) {
        e.empT = sp_.emp.cd;
        let n = 0;
        G.buildings.forEach(b => {
          if (b.def.tower && !G.fate.immune && dist(b, e) <= sp_.emp.range) { b.empT = Math.max(b.empT || 0, sp_.emp.dur); n++; }
        });
        if (n) {
          addEffect({ type: 'boom', x: e.x, y: e.y, r: 0, max: sp_.emp.range, life: 0.4, maxLife: 0.4 });
          addText(e.x, e.y - e.r - 22, '📴 瘫痪 ' + n + ' 座炮塔！', '#67e8f9');
          SFX.zap();
        }
      }
    }
    if (sp_.freezeTower) {
      e.fzT = (e.fzT || 0) - dt;
      if (e.fzT <= 0) {
        e.fzT = sp_.freezeTower.cd;
        G.buildings.forEach(b => {
          if (b.def.tower && !G.fate.immune && dist(b, e) <= sp_.freezeTower.r) b.freezeT = Math.max(b.freezeT || 0, sp_.freezeTower.dur);
        });
        addEffect({ type: 'boom', x: e.x, y: e.y, r: 0, max: sp_.freezeTower.r, life: 0.35, maxLife: 0.35 });
      }
    }
    if (sp_.ward && Math.floor(e.anim * 2) !== Math.floor((e.anim - dt) * 2)) {
      G.enemies.forEach(o => {
        if (!o.dead && o !== e && dist(o, e) <= sp_.ward.r) {
          const want = o.maxHp * sp_.ward.shield;
          if (!o.shieldMax || o.shieldMax < want) { o.shieldMax = want; o.shield = want; }
          else o.shield = Math.min(o.shieldMax, o.shield + want * 0.25);
        }
      });
    }
    if (sp_.revive) {
      e.reviveT += dt;
      if (e.reviveT >= sp_.revive.every) {
        e.reviveT = 0;
        for (let k = 0; k < sp_.revive.n; k++) {
          const c = spawnEnemy(Math.random() < 0.5 ? 'grunt' : 'swarm', G.wave, e.lane);
          c.x = e.x - rnd(0, 24); c.y = e.y + rnd(-28, 28);
        }
        addText(e.x, e.y - e.r - 14, '💀 亡魂复活！', '#a855f7');
      }
    }
    if (sp_.parasite) {
      if (!e.parasiteTarget || e.parasiteTarget.hp <= 0 || G.buildings.indexOf(e.parasiteTarget) < 0) {
        let best = null, bd = 260;
        G.buildings.forEach(b => { if (b.def.tower) { const d2 = dist(b, e); if (d2 < bd) { bd = d2; best = b; } } });
        e.parasiteTarget = best;
      }
      if (e.parasiteTarget) {
        const t = e.parasiteTarget;
        damageTarget(t, sp_.parasite.dps * dt);
        e.hp = Math.min(e.maxHp, e.hp + sp_.parasite.dps * 0.5 * dt);
        if (Math.random() < dt * 6) addEffect({ type: 'arc', x: e.x, y: e.y, x2: t.x, y2: t.y, life: 0.15, maxLife: 0.15 });
        if (t.hp <= 0) { destroyBuilding(t); e.parasiteTarget = null; }
      }
    }
    if (sp_.mimic) {
      let near = false;
      for (const b of G.buildings) { if (dist(b, e) < 190) { near = true; break; } }
      e.mimicRevealed = near;
      e.untargetable = !near;
      e.alpha = near ? 1 : 0.45;
    }
    if (e.regenR && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regenR * dt);
    if (e.shieldMax && e.shield < e.shieldMax && !e.inCombatT) e.shield = Math.min(e.shieldMax, e.shield + e.shieldMax * 0.06 * dt);
    if (e.inCombatT > 0) e.inCombatT -= dt;
    if (e.def.heal && Math.floor(e.anim * 2) !== Math.floor((e.anim - dt) * 2)) {
      G.enemies.forEach(o => {
        if (o !== e && !o.dead && dist(o, e) < 120 && o.hp < o.maxHp) {
          o.hp = Math.min(o.maxHp, o.hp + e.def.heal);
          addText(o.x, o.y - o.r, '+' + e.def.heal, '#6bff9e');
        }
      });
    }
    const bps = e.boss ? bossPhases(e) : null;
    const sm = e.def.summon || (e.boss && e.phase > 0 && bps[e.phase] && bps[e.phase].summon);
    if (sm) {
      e.summonT += dt;
      if (e.summonT >= sm.every) {
        e.summonT = 0;
        for (let k = 0; k < sm.n; k++) { const c = spawnEnemy(sm.type, G.wave, e.lane); c.x = e.x - rnd(0, 20); c.y = e.y + rnd(-24, 24); c.state = e.state; }
        addText(e.x, e.y - e.r - 14, '召唤！', '#f0abfc');
      }
    }
    if (G.buff.freeze > 0 && Math.random() < dt * 3) spawnParts(e.x, e.y, 1, '#7fdfff', 0.6, 0.5);
    const sp = enemySpeed(e);
    const L = LANES[e.lane];
    const D = G.doors[e.lane];
    if (e.state === 'walk') {
      if (e.def.flying) {
        const tx = BED_CX, ty = BED_CY;
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
        if (d < 30) { e.state = 'room'; }
        else { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; }
        e.dir = Math.atan2(dy, dx);
      } else if (e.def.burrow) {
        const tx = WALL_X + 90, ty = D.y;
        const dx = tx - e.x, dy = ty - e.y, d = Math.max(1, Math.hypot(dx, dy));
        e.x += dx / d * sp * dt; e.y += dy / d * sp * dt;
        e.dir = Math.atan2(dy, dx);
        if (e.x > WALL_X) { e.state = 'room'; e.x = WALL_X + 26; }
      } else {
        const tx = WALL_X - 26, ty = D.y;
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
        if (e.def.targetBuilding) {
          if (e.x >= WALL_X - 34) { e.state = 'room'; e.x = WALL_X + 26; e.y = D.y; addText(e.x, e.y - 30, '🔧 绕过铁门！', '#fb923c', true); }
          else { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; }
        } else if (d < 12) { e.state = 'door'; e.door = D; }
        else { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; }
        e.dir = Math.atan2(dy, dx);
      }
    } else if (e.state === 'door') {
      const d = e.door || D;
      if (!d.broken && d.hp > 0) {
        e.atkCd -= dt;
        if (e.atkCd <= 0) {
          e.atkCd = 0.85;
          damageTarget(d, e.dmg * (e.def.buildingBonus || 1));
          if (G.tech.thorn > 0) { applyDamage(e, e.dmg * G.tech.thorn * 0.2, 'kinetic'); G.track && (G.track.doorDmg = G.track.doorDmg || 0); }
          addText(WALL_X - 30, e.y + rnd(-30, 30), '-' + Math.round(e.dmg), '#ff6b6b');
          spawnParts(WALL_X - 16, e.y, 6, '#ff9e6b', 2, 0.4); shakeBy(1.6); SFX.hit();
          if (e.vamp) e.hp = Math.min(e.maxHp, e.hp + e.dmg * e.vamp);
          if (d.hp <= 0) breakDoor(d);
        }
      } else { e.state = 'room'; e.x = WALL_X + 26; e.y = d.y; }
    } else if (e.state === 'room') {
      if (!e.target || e.target.hp <= 0 || (e.target.isBed && G.bed.hp <= 0)) {
        e.target = pickRoomTarget(e) || { x: BED_CX, y: BED_CY, isBed: true, hp: 1 };
      }
      const t = e.target;
      const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
      if (d > 26) { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; e.dir = Math.atan2(dy, dx); }
      else {
        e.atkCd -= dt;
        if (e.atkCd <= 0) {
          e.atkCd = 0.8;
          const tgt = t.isBed ? G.bed : t;
          let dmg = e.dmg * (e.def.buildingBonus || 1);
          if (!t.isBed && t.shield > 0) {
            G.buildings.forEach(o => { const s = bstat(o); if (s.reflect && dist(o, t) <= s.range) dmg *= (1 - s.reflect); });
          }
          damageTarget(tgt, dmg);
          if (e.def && e.def.steal && G.gold > 0) {
            const st = Math.min(G.gold, Math.round(G.gold * e.def.steal) + 2);
            G.gold -= st;
            addText(e.x, e.y - 40, '-' + st + '💰', '#facc15', true);
          }
          addText(t.x, t.y - 20, '-' + Math.round(dmg), '#ff6b6b');
          spawnParts(t.x, t.y, 5, '#ff9e6b', 2, 0.4);
          if (t.isBed) {
            shakeBy(5); flash = 0.25; // 床铺受击：强震 + 闪屏
          } else {
            shakeBy(1.8);
          }
          SFX.hit();
          if (e.vamp) e.hp = Math.min(e.maxHp, e.hp + dmg * e.vamp);
          if (!t.isBed && tgt.hp <= 0) { destroyBuilding(tgt); e.target = null; }
          if (t.isBed && G.bed.hp <= 0) { gameOver(); return; }
        }
      }
    }
    e.y = clamp(e.y, ARENA_TOP + 8, ARENA_BOT - 8);
  }
}
function pickRoomTarget(e) {
  let best = null, bd = 1e9;
  G.buildings.forEach(b => { const d = dist(e, b); if (d < bd) { bd = d; best = b; } });
  return best;
}
function breakDoor(d) {
  if (d.broken) return;
  d.broken = true;
  addText(WALL_X + 24, d.y - 66, '铁门被攻破！', '#ff4d6d', true);
  shakeBy(16); SFX.boom(); flash = 0.5; G.stats.leaks++;
  setTip('第 ' + (d.lane + 1) + ' 道铁门被攻破！敌人涌入房间，会拆掉建筑再攻击床铺。', 6);
  G.enemies.forEach(e => { if (e.state === 'door' && e.door === d) e.state = 'room'; });
}
/* 建筑离开棋盘时把镶嵌的符文退回背包。
   原先卖掉或被打掉一座建筑，镶在上面的符文（可能是传说级）会直接蒸发，
   而符文是本作最重要的成长资产 —— 玩家没有任何提示就永久损失。 */
function recycleRunes(b, why) {
  const rs = (b.runes || []).filter(Boolean);
  if (!rs.length) return 0;
  rs.forEach(r => G.runeBag.push(r));
  b.runes = [];
  addText(b.x, b.y - 40, '🔮 取回 ' + rs.length + ' 个符文', '#c084fc');
  setTip('建筑' + why + '，已把 ' + rs.length + ' 个符文退回背包', 4);
  return rs.length;
}
function destroyBuilding(b) {
  if (G.track) G.track.buildLost = (G.track.buildLost || 0) + 1;
  recycleRunes(b, '被摧毁');
  G.grid[b.row * COLS + b.col] = null;
  G.buildings.splice(G.buildings.indexOf(b), 1);
  if (selected === b) selected = null;
  spawnParts(b.x, b.y, 26, b.def.color, 4, 0.9);
  addText(b.x, b.y, '建筑被摧毁！', '#ff4d6d', true);
  shakeBy(9); SFX.boom();
  G.resDirty = true;
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  G.stats.kills++;
  G.combo = (G.combo || 0) + 1; G.comboT = 3;
  G.maxCombo = Math.max(G.maxCombo || 0, G.combo);
  if (G.combo === 10 || (G.combo > 10 && G.combo % 10 === 0))
    addText(e.x, e.y - 44, G.combo + ' 连杀！', '#ffd166', true);
  G.gold += e.def.gold * (e.elite ? 2.5 : 1) * techVal('greed', 0.08) * (G.event.eff.rewardMul || 1);
  const soulGain = Math.round((e.def.soul + G.tech.harvest) * (G.event.eff.soulMul || 1) * (e.elite ? 2 : 1) * (1 + G.grow * 0.02) * techVal('soulstorm', 0.30) * diffCfg().soulMul);
  G.souls += soulGain;
  tryDropRune(G.wave, e.x, e.y);
  // 增强击杀粒子效果
  const pCount = e.boss ? 50 : (e.elite ? 28 : 18);
  const pSpd = e.boss ? 7 : (e.elite ? 4.5 : 3.5);
  spawnParts(e.x, e.y, pCount, e.def.color, pSpd, 0.8);
  // 击杀白色冲击粒子
  spawnParts(e.x, e.y, Math.min(8, pCount / 2), '#fff', pSpd * 1.3, 0.4);
  // 灵魂光球上升效果
  if (soulGain > 0) {
    for (let i = 0; i < 3; i++) {
      spawnParts(e.x + rnd(-10, 10), e.y + rnd(-10, 10), 1, '#c77dff', 1.5 + i * 0.5, 1.2);
    }
  }
  // 普通击杀微震
  if (!e.boss && !e.elite) shakeBy(2);
  // 精英/BOSS 击杀停顿
  if (e.boss) hitStop = 0.15;
  else if (e.elite) hitStop = 0.06;
  addText(e.x, e.y - e.r, '+' + Math.round(e.def.gold * (e.elite ? 2.5 : 1)), '#ffd166');
  if (soulGain) addText(e.x + 14, e.y - e.r - 14, '+' + soulGain + '🔮', '#c77dff');
  if (e.boss) {
    G.stats.bossKills++; shakeBy(18); SFX.boom();
    addText(e.x, e.y - 50, 'BOSS 击杀！', '#ffd166', true);
    if (e.def.finalBoss) { setTimeout(() => gameWin(), 900); }
  }
  else if (e.elite) SFX.hit();
  // 梦境系统：敌人击杀钩子
  if (typeof DreamEngine !== 'undefined') { try { DreamEngine.onEnemyKilled(e); } catch(err) { console.warn('DreamEngine enemyKilled:', err); } }
  if (e.def.curse) {
    const c = e.def.curse;
    addEffect({ type: 'curse', x: e.x, y: e.y, r: c.r, life: c.dur, maxLife: c.dur });
    addText(e.x, e.y - 20, '☠️ 诅咒区域', '#94a3b8');
  }
  if (e.splitN || e.def.split) {
    const n = e.splitN || e.def.split;
    for (let i = 0; i < n; i++) {
      const c = spawnEnemy('grunt', G.wave, e.lane);
      c.x = e.x + rnd(-18, 18); c.y = e.y + rnd(-18, 18); c.state = e.state;
    }
  }
  const ex = e.explodeN || e.def.explode;
  if (ex) {
    addEffect({ type: 'boom', x: e.x, y: e.y, r: 0, max: 130, life: 0.45, maxLife: 0.45 });
    SFX.boom(); shakeBy(8);
    G.doors.forEach(d => { if (dist({ x: WALL_X, y: d.y }, e) < 130) { damageTarget(d, ex); if (d.hp <= 0) breakDoor(d); } });
    G.buildings.forEach(b => { if (dist(b, e) < 130) damageTarget(b, ex); });
  }
  checkAchievements();
}
function findTarget(b, range, mode) {
  let best = null, bv = -1e9;
  for (const e of G.enemies) {
    if (e.dead || e.untargetable) continue;
    if (dist(e, b) > range) continue;
    let v;
    if (mode === 'strongest') v = e.hp + (e.boss ? 1e6 : 0);
    else if (mode === 'weakest') v = -e.hp;
    else v = (e.x) - (e.state === 'walk' ? 0 : 600);
    if (v > bv) { bv = v; best = e; }
  }
  return best;
}
function updateTowers(dt) {
  const fire = canFire();
  for (const b of G.buildings) {
    const s = bstat(b);
    b.pulse += dt;
    if (b.empT > 0) { b.empT -= dt; continue; }   // 瘫痪：主火力与自动放电一起停
    if (s.zapDmg) {
      b.zcd = (b.zcd || 0) - dt;
      if (b.zcd <= 0) {
        const t = findTarget(b, s.zapRange, 'front');
        if (t) { b.zcd = 1.4; applyDamage(t, s.zapDmg * towerDmgMul(b), 'shock', b); addEffect({ type: 'arc', x: b.x, y: b.y, x2: t.x, y2: t.y, life: 0.2, maxLife: 0.2 }); SFX.zap(); }
      }
    }
    if (!b.def.tower || !fire) continue;
    if (b.freezeT > 0) b.freezeT -= dt;
    if (b.type === 'flame') {
      const targets = G.enemies.filter(e => !e.dead && !e.untargetable && dist(e, b) <= s.range);
      b.flameOn = targets.length > 0;
      if (targets.length) b.angle = Math.atan2(targets[0].y - b.y, targets[0].x - b.x);
      targets.forEach(e => {
        // 灼烧叠层：仅在持续被喷到期间累积，离开火舌后会衰减（以前叠满 5 层就永久不减）
        if (s.stack) e.burnStack = Math.min(5, (e.burnStack || 0) + dt * 1.2);
        e.flameOn = true;
        let d = s.dmg * towerDmgMul(b) * (1 + (e.burnStack || 0) * 0.35);
        // 灼烧残留：离开火舌后仍持续 1.4 秒。注意以前 burnDmg 直接等于接触伤害，
        // 而 updateEnemies 的灼烧结算与直接伤害同时生效 → 火焰塔实际打出双倍面板 DPS。
        e.burnT = Math.max(e.burnT, 1.4);
        e.burnDmg = Math.max(e.burnDmg || 0, d * 0.5);
        e.burnSrc = b;
        // 接触伤害交给统一管线：护盾/固定减伤/抗性/统计全部生效，且不再每帧刷数字
        dotDamage(e, d, 'fire', b, dt);
      });
      if (targets.length && Math.random() < dt * 22) spawnParts(rnd(b.x - 20, b.x + 20), rnd(b.y - 20, b.y + 20), 1, '#ff8c42', 1.4, 0.5);
      continue;
    }
    if (s.gravity) {
      const targets = G.enemies.filter(e => !e.dead && !e.untargetable && dist(e, b) <= s.range);
      b.gravOn = targets.length > 0;
      const gm = s.dmg * towerDmgMul(b);
      targets.forEach(e => {
        const dx = b.x - e.x, dy = b.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (d > 26) { const sp = s.pull * dt * (e.boss ? 0.28 : 1); e.x += dx / d * sp; e.y += dy / d * sp; }
        e.slow = Math.max(e.slow || 0, s.gravSlow); e.slowT = Math.max(e.slowT || 0, 0.4);
        dotDamage(e, gm, 'energy', b, dt);
      });
      if (targets.length && Math.random() < dt * 14) spawnParts(rnd(b.x - 16, b.x + 16), rnd(b.y - 16, b.y + 16), 1, '#818cf8', 1.3, 0.5);
      continue;
    }
    const rate = (s.rate || 1) * towerRateMul() * towerRateMulOn(b);
    b.cd -= dt * rate;
    if (b.cd > 0) continue;
    const mode = b.type === 'laser' ? 'strongest' : 'front';
    const t = findTarget(b, s.range, mode);
    if (!t) { b.cd = 0; b.idle = (b.idle || 0) + dt; continue; }
    b.cd = 1;
    b.idle = 0;
    // 炮塔转向加插值：原来瞬间跳变，视觉上像瞬移；现在按 14 rad/s 级别的速度追目标
    b.angle = turnTo(b.angle, Math.atan2(t.y - b.y, t.x - b.x), dt * 14);
    if (s.aoe) {
      const mul = towerDmgMul(b);
      const all = G.enemies.filter(e => !e.dead && !e.untargetable && dist(e, b) <= s.range);
      all.forEach(e => {
        applyDamage(e, s.dmg * mul * critRoll(), 'kinetic', b);
        const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy) || 1;
        // BOSS 享受击退/眩晕减免，否则一座声波塔能把 BOSS 永久定在走廊口
        const ctrl = e.boss ? 0.25 : 1;
        if (s.knock) { e.x += dx / d * s.knock * ctrl; e.y += dy / d * s.knock * ctrl; }
        if (s.sonicStun) e.stun = Math.max(e.stun || 0, s.sonicStun * ctrl);
      });
      addEffect({ type: 'ring', x: b.x, y: b.y, r: s.range, life: 0.3, maxLife: 0.3, color: '#f0abfc' });
      b.fireFx = 0.25; b.recoil = 1; // 开火脉冲 + 后座
      spawnParts(b.x, b.y, 5, b.def.color, 1.5, 0.3);
      SFX.shoot();
      continue;
    }
    fire_(b, t, s);
  }
}
function critRoll() {
  // 剧情加成（暴击率 +N%）也计入：基础来自灵魂科技树
  const chance = G.tech.crit * 0.04 + (G.fate.crit || 0) + (G.fateWave.crit || 0);
  const extra = (G.fate.critDmg || 0) + (G.fateWave.critDmg || 0);
  return Math.random() < chance ? (2.2 + G.tech.critmaster * 0.4 + extra) : 1;
}
function fire_(b, t, s) {
  const mul = towerDmgMul(b);
  const dtype = b.def.dmgType;
  b.recoil = 1;                 // 后座 + 炮口闪光（纯视觉，不参与结算）
  b.fireFx = 0.2;
  if (b.type === 'laser') {
    const shots = s.multi || 1;
    let list = [t];
    if (shots > 1) {
      list = G.enemies.filter(e => !e.dead && !e.untargetable && dist(e, b) <= s.range)
        .sort((p, q) => dist(p, b) - dist(q, b)).slice(0, shots);
    }
    list.forEach(tg => {
      addEffect({ type: 'laser', x: b.x, y: b.y, x2: tg.x, y2: tg.y, life: 0.18, maxLife: 0.18, color: '#ff5d8f' });
      let hits = 0;
      const ang = Math.atan2(tg.y - b.y, tg.x - b.x);
      const sorted = G.enemies.filter(e => !e.dead).sort((p, q) => dist(p, b) - dist(q, b));
      for (const e of sorted) {
        if (hits >= (s.pierce || 1)) break;
        const a2 = Math.atan2(e.y - b.y, e.x - b.x);
        if (Math.abs(Math.atan2(Math.sin(a2 - ang), Math.cos(a2 - ang))) < 0.24 && dist(e, b) <= s.range + 40) {
          applyDamage(e, s.dmg * mul * critRoll(), dtype, b); hits++;
        }
      }
    });
    SFX.laser();
  } else if (b.type === 'tesla') {
    let cur = t; const hit = new Set([t]); const chain = [t];
    for (let i = 1; i < (s.chain || 3); i++) {
      let nx = null, nd = 210;
      for (const e of G.enemies) { if (e.dead || hit.has(e)) continue; const d = dist(e, cur); if (d < nd) { nd = d; nx = e; } }
      if (!nx) break;
      hit.add(nx); chain.push(nx); cur = nx;
    }
    let px = b.x, py = b.y;
    chain.forEach((e, i) => {
      addEffect({ type: 'arc', x: px, y: py, x2: e.x, y2: e.y, life: 0.22, maxLife: 0.22 });
      applyDamage(e, s.dmg * mul * Math.pow(0.84, i), dtype, b);
      if (s.stun) e.stun = Math.max(e.stun || 0, s.stun * (e.boss ? 0.4 : 1));
      if (s.splash) {
        G.enemies.forEach(o => { if (!o.dead && !hit.has(o) && dist(o, e) < s.splash) applyDamage(o, s.dmg * mul * 0.5, dtype, b); });
      }
      px = e.x; py = e.y;
    });
    SFX.zap();
  } else if (b.type === 'prism') {
    const n = s.split || 3;
    const pool = G.enemies.filter(e => !e.dead && !e.untargetable && dist(e, b) <= s.range);
    const tg = pool.length <= n ? pool : pool.sort(() => Math.random() - 0.5).slice(0, n);
    if (!tg.length) tg.push(t);
    tg.forEach(e => {
      addEffect({ type: 'laser', x: b.x, y: b.y, x2: e.x, y2: e.y, life: 0.16, maxLife: 0.16, color: '#67e8f9' });
      applyDamage(e, s.dmg * mul * critRoll(), dtype, b);
    });
    SFX.laser();
  } else {
    const nm = s.multi || 1;
    const bspd = b.type === 'frost' ? 390 : (b.type === 'missile' ? 330 : (b.type === 'poison' ? 470 : 640));
    const br = b.type === 'frost' ? 6 : (b.type === 'missile' ? 7 : 4);
    for (let i = 0; i < nm; i++) {
      G.bullets.push({
        x: b.x, y: b.y, tx: t.x, ty: t.y, target: t, spd: bspd,
        dmg: s.dmg * mul, crit: critRoll(), type: b.type, dtype,
        slow: s.slow || 0, freezeChance: s.freezeChance || 0, shred: s.shred || 0,
        splash: s.splash || 0, poisonStack: s.poison ? 1 : 0, poisonDps: s.poisonDps || 0, poisonMax: s.maxStack || 0,
        r: br, color: b.def.color, src: b, life: 0,
      });
    }
    b.fireFx = 0.2; // 开火脉冲
    // 炮口闪光粒子
    const tipX = b.x + Math.cos(b.angle) * 28;
    const tipY = b.y + Math.sin(b.angle) * 28;
    spawnParts(tipX, tipY, 3, b.def.color, 1.2, 0.25);
    SFX.shoot();
  }
}
function triggerReaction(e, rx, baseDmg) {
  const fx = (baseDmg || 20);
  if (rx.id === 'steam') {
    const d = fx * 1.6;
    e.hp -= d; G.stats.dmg += d;
    addText(e.x, e.y - 30, '💨 蒸汽 ' + Math.round(d), '#e0f2fe', true);
    spawnParts(e.x, e.y, 16, '#e0f2fe', 3, 0.6);
    e.slow = Math.max(e.slow || 0, 0.35); e.slowT = 2;
  } else if (rx.id === 'overload') {
    const d = fx * 1.2;
    G.enemies.forEach(o => { if (!o.dead && dist(o, e) < 110) { o.hp -= d * 0.8; G.stats.dmg += d * 0.8; } });
    e.hp -= d; G.stats.dmg += d;
    addText(e.x, e.y - 30, '💥 过载 ' + Math.round(d), '#fbbf24', true);
    spawnParts(e.x, e.y, 22, '#fbbf24', 4, 0.6); shakeBy(4);
    // 注意 max 字段：缺了它 updateEffects 会算出 NaN 半径，createRadialGradient 直接抛异常
    addEffect({ type: 'boom', x: e.x, y: e.y, r: 110, max: 110, life: 0.35, maxLife: 0.35 });
  } else if (rx.id === 'toxiburn') {
    e.poison = Math.min(16, (e.poison || 0) * 2 + 2);
    e.poisonDps = Math.max(e.poisonDps || 0, 14 + G.wave * 1.2);
    e.poisonT = 6;
    addText(e.x, e.y - 30, '☠️ 毒燃 x' + e.poison, '#a3e635', true);
    spawnParts(e.x, e.y, 14, '#a3e635', 3, 0.6);
  } else if (rx.id === 'superduct') {
    e.vuln = 1.35 + Math.min(0.4, G.wave * 0.004); e.vulnT = 6;
    addText(e.x, e.y - 30, '⚡ 超导 易伤', '#67e8f9', true);
    spawnParts(e.x, e.y, 12, '#67e8f9', 3, 0.6);
  } else if (rx.id === 'crystal') {
    e.stun = Math.max(e.stun || 0, 1.6);
    e.slow = 0.8; e.slowT = 2;
    addText(e.x, e.y - 30, '🧊 结晶 定身', '#bae6fd', true);
    spawnParts(e.x, e.y, 14, '#bae6fd', 3, 0.6);
  } else if (rx.id === 'corrode') {
    DMG_KEYS.forEach(k => { e.res[k] = Math.max(0, (e.res[k] || 0) - 0.18); });
    addText(e.x, e.y - 30, '🧬 腐蚀 破抗', '#f0abfc', true);
    spawnParts(e.x, e.y, 12, '#f0abfc', 3, 0.6);
  }
  const dead = e.hp <= 0;
  if (dead && !e.dead) killEnemy(e);
}
/* 元素标记登记 + 反应触发。从 applyDamage 里抽出来，便于 DoT 按节流频率单独调用 */
function touchElement(e, dtype, baseDmg) {
  if (!dtype || e.boss || e.dead) return false;
  if (!e.elem) e.elem = {};
  let reacted = null, other = null;
  for (const k in e.elem) {
    if (k !== dtype && e.elem[k] > 0) { const rx = findReaction(dtype, k); if (rx) { reacted = rx; other = k; break; } }
  }
  if (reacted) {
    e.elem[other] = 0; e.elem[dtype] = 0;
    G.stats.reactions = (G.stats.reactions || 0) + 1;
    triggerReaction(e, reacted, baseDmg);
    return true;
  }
  e.elem[dtype] = 5;
  return false;
}
/* ------------------------------------------------------------------
 * 持续伤害通道（火焰灼烧 / 引力奇点微伤）
 * 以前这两个每秒 60 次直接调 applyDamage，后果：
 *   ① 每帧弹一个伤害数字 → 满屏刷字，还会把 60 条浮动文字上限挤爆
 *   ② 每帧受击闪白 + 粒子 → 敌人像频闪灯
 *   ③ 绕过了护盾、固定减伤、抗性与 G.stats.dmg 统计
 * 现在统一走这里：静默结算 + 每 0.5 秒合并弹一个数字，
 * 并按 0.5 秒登记一次元素标记，保证与其它元素塔仍能触发反应。
 * ------------------------------------------------------------------ */
const DOT_MERGE_INTERVAL = 0.5;
function dotDamage(e, dps, dtype, src, dt) {
  if (e.dead || !(dps > 0)) return 0;
  const d = applyDamage(e, dps * dt, dtype, src, false, true);
  if (d > 0 && !e.dead) {
    e.dotAcc = (e.dotAcc || 0) + d;
    e.dotT = (e.dotT || 0) + dt;
    if (e.dotT >= DOT_MERGE_INTERVAL) {
      addText(e.x + rnd(-5, 5), e.y - e.r, Math.round(e.dotAcc), (DMG[dtype] && DMG[dtype].color) || '#ffd6d6');
      e.dotAcc = 0; e.dotT = 0;
      touchElement(e, dtype, dps * DOT_MERGE_INTERVAL);
    }
  }
  return d;
}
/**
 * @param {boolean} [silent] - true = 持续伤害帧结算：不弹数字/不闪光/不触发反伤与适应
 */
function applyDamage(e, dmg, dtype, src, chain, silent) {
  if (e.dead) return 0;
  const tm = typeMul(e, dtype);
  let d = dmg * tm;
  if (e.flat) d = Math.max(1, d - e.flat);
  if (dtype === 'frost' && src) {
    const s = bstat(src);
    if (s.shred) DMG_KEYS.forEach(k => { e.res[k] = Math.max(0, (e.res[k] || 0) - s.shred * 0.1); });
  }
  // 元素反应：不同伤害类型叠加触发连锁
  if (!silent) touchElement(e, dtype, dmg);
  if (e.vulnT > 0 && e.vuln > 1) d *= e.vuln;
  if (e.phaseShield && e.segIdx < e.phaseShield && d > 0) {
    const gate = e.maxHp - e.segMax * (e.segIdx + 1);
    if (e.hp - d <= gate) {
      d = Math.max(0, e.hp - gate);
      e.segIdx++;
      addText(e.x, e.y - 46, '🛡 护盾破碎 ' + e.segIdx + '/' + e.phaseShield, '#a8a29e', true);
      spawnParts(e.x, e.y, 26, '#d6d3d1', 4, 0.7); shakeBy(6);
      e.stun = Math.max(e.stun || 0, 0.35);
      if (e.state === 'walk') e.x = Math.max(20, e.x - 34);
    }
  }
  // 反伤：DoT 帧不反，否则火焰塔会被镜面梦魇每帧反弹致死
  if (!silent && e.def && e.def.reflect && src && src.def && d > 0) {
    const rb = d * e.def.reflect;
    damageTarget(src, rb);
    if (Math.random() < 0.3) addText(e.x, e.y - 44, '🪞 反弹 ' + Math.round(rb), '#e2e8f0');
  }
  // 适应：同样只在真正的「一击」上累积，否则一帧就叠满抗性
  if (!silent && e.def && e.def.adapt && dtype && d > 0) {
    e.res[dtype] = Math.min(0.7, (e.res[dtype] || 0) + e.def.adapt);
    e.adapted = (e.adapted || 0) + 1;
  }
  // 炮塔共鸣附加效果（只吃单次命中，不吃 DoT 帧）
  if (!silent && src && src.resExtra && dtype && d > 0 && !chain) {
    const rx = src.resExtra;
    if (rx.burn) { e.burnT = Math.max(e.burnT || 0, 2.2); e.burnDmg = Math.max(e.burnDmg || 0, rx.burn); }
    if (rx.poison) {
      e.poison = Math.min(10, (e.poison || 0) + rx.poison);
      e.poisonDps = Math.max(e.poisonDps || 0, rx.poisonDps);
      e.poisonT = 3;
    }
    if (rx.shred) DMG_KEYS.forEach(k => { e.res[k] = Math.max(0, (e.res[k] || 0) - rx.shred * 0.12); });
    if (rx.stunChance && Math.random() < rx.stunChance) e.stun = Math.max(e.stun || 0, 0.8);
    if (rx.splash) {
      G.enemies.forEach(o => { if (!o.dead && o !== e && dist(o, e) < rx.splash) applyDamage(o, d * 0.45, dtype, src, true); });
    }
  }
  if (e.shield > 0) { const a = Math.min(e.shield, d); e.shield -= a; d -= a; }
  if (d > 0) e.hp -= d;
  e.inCombatT = 2;
  G.stats.dmg += d;
  if (silent) {
    if (e.hp <= 0) { if (src && src.kills !== undefined) src.kills++; if (G.track && dtype === 'fire') G.track.killFire = (G.track.killFire || 0) + 1; killEnemy(e); }
    return d;
  }
  e.hitFlash = 0.12; // 受击白色闪烁
  // 打击音效（按伤害属性区分，内部已做节流）
  if (typeof DreamSound !== 'undefined' && DreamSound.playDamageSound) DreamSound.playDamageSound(dtype);
  // 理解之路：残血的梦魇可能突然停下（由 MercyPath 决定是否触发；触发时走剧情对话）
  if (e.hp > 0 && !e.mercyOffered && e.maxHp > 0 && e.hp / e.maxHp <= 0.15
      && typeof MercyPath !== 'undefined' && MercyPath.tryTrigger) {
    try { MercyPath.tryTrigger(e); } catch (err) { console.warn('MercyPath:', err); }
  }
  const crit = tm > 1.05 || tm < 0.95;
  // 大伤害数字使用更醒目的颜色
  const dmgColor = d > 200 ? '#ff4d6d' : (d > 80 ? '#ffa500' : (tm > 1.05 ? '#ffe066' : (tm < 0.95 ? '#94a3b8' : '#ffffff')));
  addText(e.x + rnd(-6, 6), e.y - e.r, Math.round(d), dmgColor);
  spawnParts(e.x, e.y, crit ? 5 : 3, crit ? '#ffe066' : '#ffd6d6', crit ? 3 : 2, 0.35);
  if (e.hp <= 0) { if (src && src.kills !== undefined) src.kills++; if (G.track && dtype === 'fire') G.track.killFire = (G.track.killFire || 0) + 1; killEnemy(e); }
  return d;
}
function updateBullets(dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    const t = b.target;
    if (t && !t.dead) { b.tx = t.x; b.ty = t.y; }
    const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
    const step = b.spd * dt;
    if (d <= step + (t ? t.r * 0.6 : 0) || d < 4) {
      if (t && !t.dead) {
        applyDamage(t, b.dmg * b.crit, b.dtype, b.src);
        if (b.splash) {
          G.enemies.forEach(o => {
            if (!o.dead && o !== t && dist(o, b) < b.splash) applyDamage(o, b.dmg * b.crit * 0.55, b.dtype, b.src);
          });
          spawnParts(b.tx, b.ty, 12, '#fb7185', 3, 0.5); shakeBy(2);
        }
        if (b.poisonStack) {
          t.poison = Math.min(b.poisonMax || 8, (t.poison || 0) + b.poisonStack);
          t.poisonDps = Math.max(t.poisonDps || 0, b.poisonDps);
          t.poisonT = 3.2;
        }
        if (b.slow) { t.slow = Math.max(t.slow || 0, b.slow); t.slowT = 2.0; }
        if (b.freezeChance && Math.random() < b.freezeChance) t.stun = Math.max(t.stun || 0, 0.9);
        spawnParts(b.tx, b.ty, b.crit > 1 ? 9 : 5, b.crit > 1 ? '#fff' : b.color, 2, 0.3);
      }
      G.bullets.splice(i, 1); continue;
    }
    b.x += dx / d * step; b.y += dy / d * step;
    b.life += dt;
    // 导弹基础速度 330px/s、射程可到 1200+，原来的 2 秒存活常常「飞不到就凭空消失」
    if (b.life > 3.5) G.bullets.splice(i, 1);
  }
}
function rollEvent() {
  if (G.wave < 3) return EVENTS[0];
  const pool = EVENTS.filter(e => e.id !== 'none');
  return Math.random() < 0.55 ? pick(pool) : EVENTS[0];
}
function buildWaveQueue(n) {
  const pool = waveUnlocks(n);
  const cnt = Math.min(90, 6 + Math.floor(n * 2.1)) * (G.event.eff.countMul || 1);
  const q = [];
  for (let i = 0; i < cnt; i++) q.push(pick(pool));
  const bosses = n % 5 === 0 ? 1 + Math.floor(n / 22) : 0;
  const bossList = [];
  const bossType = n >= finalWave() ? 'final' : 'boss';
  for (let i = 0; i < bosses; i++) bossList.push(bossType);
  q.sort(() => Math.random() - 0.5);
  return { rest: q, bossList };
}
function startWave() {
  G.wave++;
  G.event = rollEvent();
  const { rest, bossList } = buildWaveQueue(G.wave);
  G.spawnQueue = rest; G.bossQueue = bossList; G.spawnTimer = 0;
  G.state = 'wave';
  const sm = diffCfg().spawnMul;
  if (sm > 1 && G.spawnQueue.length) {
    const extra = Math.round(G.spawnQueue.length * (sm - 1));
    for (let i = 0; i < extra; i++) G.spawnQueue.push(G.spawnQueue[i % G.spawnQueue.length]);
  }
  G.waveTime = 0; G.challenge = rollChallenge(G.wave);
  G.track = { doorDmg: 0, buildLost: 0, killFire: 0, skillUsed: 0 };
  SFX.wave();
  addText(ROOM_X0 + 340, DOOR_MID_Y() - 150, '第 ' + G.wave + ' 波来袭！', '#ff6b6b', true);
  if (G.event.id !== 'none') { addText(ROOM_X0 + 340, DOOR_MID_Y() - 118, G.event.icon + ' ' + G.event.name, '#ffd166', true); setTip('本波事件【' + G.event.name + '】：' + G.event.desc, 6); }
  flash = 0.35; shakeBy(6 + Math.min(G.wave, 20) * 0.3); // 波次越高震动越强
  G.waveTransition = { t: 1.5, wave: G.wave }; // 波次过渡动画（1.5s，别长时间糊住战场）
  if (G.wave === 1) setTip('敌人分三路进攻！三条走廊各有一扇铁门，别只顾一边。', 8);
  if (G.wave === 5) setTip('精英梦魇开始出现（带词缀），BOSS 波也来了。注意伤害类型克制。', 8);
  if (G.wave === finalWave()) {
    setTip('⚠️ 最终决战！击败【终焉梦魇】即可通关胜利。', 10);
    addText(ROOM_X0 + 300, DOOR_MID_Y() - 200, '⚠️ 最终决战 ⚠️', '#ff4d6d', true);
    flash = 0.6; shakeBy(20);
  }
  // 梦境系统：波次开始钩子
  if (typeof DreamEngine !== 'undefined') { try { DreamEngine.onWaveStart(G.wave); } catch(e) { console.warn('DreamEngine waveStart:', e); } }
  // 波次剧情触发
  if (typeof WAVE_STORY !== 'undefined') {
    const story = WAVE_STORY.find(s => s.wave === G.wave);
    if (story) {
      setTimeout(() => {
        if (typeof showStoryDialog === 'function') showStoryDialog(story);
        else if (typeof EventBus !== 'undefined') EventBus.emit('story:dialog', story);
      }, 800);
    }
  }
  // BOSS对话触发
  if (typeof BOSS_DIALOG !== 'undefined') {
    const bossKeys = Object.keys(BOSS_DIALOG);
    const bossDlg = bossKeys.map(k => BOSS_DIALOG[k]).find(b => b.wave === G.wave);
    if (bossDlg) {
      setTimeout(() => {
        if (typeof showStoryDialog === 'function') {
          showStoryDialog({ speaker: bossDlg.name || 'BOSS', text: bossDlg.intro || '...' });
        }
      }, 2000);
    }
  }
}
const DOOR_MID_Y = () => LANES[1].doorY;
function updateWave(dt) {
  if (G.state === 'build') {
    G.prepTimer -= dt;
    if (G.prepTimer <= 0) startWave();
    return;
  }
  G.waveTime = (G.waveTime || 0) + dt;
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  G.spawnTimer -= dt;
  if (G.spawnTimer <= 0 && (G.spawnQueue.length || G.bossQueue.length)) {
    const interval = Math.max(0.20, 0.85 - G.wave * 0.018);
    const type = G.spawnQueue.length ? G.spawnQueue.shift() : G.bossQueue.shift();
    spawnEnemy(type, G.wave);
    G.spawnTimer = interval;
  }
  if (!G.spawnQueue.length && !G.bossQueue.length && !G.enemies.length) endWave();
}
function endWave() {
  // 梦境系统：波次结束钩子
  if (typeof DreamEngine !== 'undefined') { try { DreamEngine.onWaveEnd(G.wave); } catch(e) { console.warn('DreamEngine waveEnd:', e); } }
  if (G.challenge && !G.challenge.done) {
    const c = G.challenge, t = c.target;
    const v = c.id === 'time' ? G.waveTime : (G.track[c.def.track] || 0);
    const pass = c.def.cmp === 'le' ? v <= t : v >= t;
    if (pass) {
      const rw = challengeRewardSouls(G.wave);
      G.souls += rw; G.stats.challenges = (G.stats.challenges || 0) + 1;
      addText(ROOM_X0 + 300, DOOR_MID_Y() - 200, '✅ 挑战达成：' + c.def.name + ' +' + rw + '🔮', '#7cf39a', true);
      SFX.up();
    } else {
      addText(ROOM_X0 + 300, DOOR_MID_Y() - 200, '❌ 挑战失败：' + c.def.name, '#f87171', true);
    }
  }
  G.challenge = null;
  G.state = 'build';
  G.buff.goldBoost = 0; G.buff.dmgBoost = 0;
  // 本波限定加成到期；旋律增益按波数递减
  G.fateWave = { dmg: 0, rate: 0, def: 0, crit: 0, critDmg: 0 };
  if (G.melodyBuff) {
    G.melodyBuff.wavesLeft--;
    if (G.melodyBuff.wavesLeft <= 0) {
      G.melodyBuff = null;
      addText(ROOM_X0 + 300, DOOR_MID_Y() - 230, '🎵 旋律增益结束', '#94a3b8');
    }
  }
  G.prepTimer = Math.max(12, 24 - G.wave * 0.16) * diffCfg().prepMul * ((G.prize && G.prize.prep) || 1);
  G.prepTotal = G.prepTimer;
  let interest = 0, soulsFromBank = 0;
  G.buildings.forEach(b => {
    const s = bstat(b);
    if (s.interest) interest += G.gold * s.interest;
    if (s.souls) soulsFromBank += s.souls;
  });
  interest = Math.min(interest, G.gold * 0.7);
  if (interest > 0) { G.gold += interest; addText(BED_CX - 100, BED_CY + 46, '银行利息 +' + Math.round(interest), '#ffc300'); }
  if (soulsFromBank > 0) { G.souls += soulsFromBank; addText(BED_CX - 100, BED_CY + 64, '+' + soulsFromBank + '🔮', '#c77dff'); }
  const bonus = Math.round((45 + G.wave * 18) * (G.event.eff.rewardMul || 1));
  G.gold += bonus;
  addText(ROOM_X0 + 300, DOOR_MID_Y() - 150, '波次奖励 +' + bonus, '#ffd166', true);
  // 波次通关庆祝效果
  shakeBy(6);
  flash = 0.2;
  // 金币雨粒子
  for (let i = 0; i < 20; i++) {
    spawnParts(rnd(ROOM_X0, ROOM_X1), rnd(ARENA_TOP, ARENA_BOT), 1, '#ffd166', rnd(1, 3), rnd(0.6, 1.2));
  }
  // 治愈光球
  for (let i = 0; i < 8; i++) {
    spawnParts(rnd(ROOM_X0, ROOM_X1), rnd(ARENA_TOP, ARENA_BOT), 1, '#7cf39a', rnd(0.8, 2), rnd(0.5, 1));
  }
  SFX.win();
  setTip('第 ' + G.wave + ' 波清除！+' + bonus + ' 金币。趁机扩建防线。', 5);
  checkAchievements();
  saveGame();
}
function skipPrep() {
  if (G.state !== 'build') return;
  const bonus = Math.round(G.prepTimer * 3);
  G.gold += bonus;
  addText(ROOM_X0 + 300, DOOR_MID_Y() - 110, '提前召唤 +' + bonus, '#ffd166');
  G.prepTimer = 0;
  startWave();
}
function useSkill(key) {
  const s = SKILL_DEFS[key];
  if (!G || G.over || !s) return false;
  if (G.skills[key] > 0) { SFX.err(); return; }
  G.skills[key] = s.cd;
  if (G.track) G.track.skillUsed = (G.track.skillUsed || 0) + 1;
  SFX.skill();
  if (key === 'meteor') {
    const dmg = 200 + G.wave * 50;
    G.enemies.forEach(e => {
      if (e.dead) return;
      addEffect({ type: 'meteor', x: e.x + rnd(-40, 40), y: e.y - 400, tx: e.x, ty: e.y, life: 0.5, maxLife: 0.5 });
      setTimeout(() => { if (!e.dead) { applyDamage(e, dmg, 'fire'); spawnParts(e.x, e.y, 18, '#ff8c42', 4, 0.7); } }, 450);
    });
    setTimeout(() => { shakeBy(14); SFX.boom(); }, 460);
    addText(ROOM_X0 + 300, DOOR_MID_Y() - 170, '☄️ 陨石雨！', '#ff8c42', true);
  } else if (key === 'freeze') {
    G.buff.freeze = 4.5;
    G.enemies.forEach(e => spawnParts(e.x, e.y, 8, '#7fdfff', 2, 0.8));
    addText(ROOM_X0 + 300, DOOR_MID_Y() - 170, '❄️ 时间冻结！', '#7fdfff', true);
  } else if (key === 'overclock') {
    G.buff.overclock = 8;
    addText(ROOM_X0 + 300, DOOR_MID_Y() - 170, '⚡ 超频狂暴！', '#ffe066', true);
  } else if (key === 'mend') {
    let n = 0;
    G.buildings.forEach(b => {
      if (b.hp < b.maxHp) { b.hp = b.maxHp; n++; }
      b.shield = b.shieldMax;
      spawnParts(b.x, b.y, 8, '#7cf39a', 2, 0.6);
    });
    G.doors.forEach(d => {
      if (d.hp < d.maxHp) { d.hp = d.maxHp; n++; }
      d.shield = d.shieldMax;
      if (d.broken) { d.broken = false; n++; }
      spawnParts(WALL_X, d.y, 10, '#7cf39a', 2.5, 0.6);
    });
    if (G.bed.hp < G.bed.maxHp) { G.bed.hp = G.bed.maxHp; n++; }
    G.bed.shield = G.bed.shieldMax;
    spawnParts(BED_CX, BED_CY, 16, '#7cf39a', 3, 0.8);
    addText(ROOM_X0 + 300, DOOR_MID_Y() - 170, '🩹 紧急抢修！全部修复', '#7cf39a', true);
    addText(ROOM_X0 + 300, DOOR_MID_Y() - 140, '修复 ' + n + ' 处（含铁门与床铺）', '#a7f3d0');
  } else if (key === 'repel') {
    G.enemies.forEach(e => {
      const L = LANES[e.lane];
      spawnParts(e.x, e.y, 12, '#c77dff', 3, 0.6);
      e.x = rnd(10, 70); e.y = rnd(L.y0 + 20, L.y1 - 20);
      e.stun = 2; e.state = 'walk'; e.target = null;
    });
    shakeBy(10);
    addText(ROOM_X0 + 300, DOOR_MID_Y() - 170, '🧲 磁力风暴！', '#c77dff', true);
  } else if (key === 'siphon') {
    const n = 30 + G.wave * 4;
    G.souls += n;
    const dmg = 60 + G.wave * 20;
    G.enemies.forEach(e => { if (!e.dead) applyDamage(e, dmg, 'shock'); });
    addText(ROOM_X0 + 300, DOOR_MID_Y() - 170, '🔮 灵魂虹吸 +' + n, '#c77dff', true);
  }
}
function updateSkills(dt) {
  SKILL_KEYS.forEach(k => { if (G.skills[k] > 0) G.skills[k] = Math.max(0, G.skills[k] - dt); });
  if (G.buff.freeze > 0) G.buff.freeze -= dt;
  if (G.buff.overclock > 0) G.buff.overclock -= dt;
}
function updateEffects(dt) {
  for (let i = G.effects.length - 1; i >= 0; i--) {
    const e = G.effects[i];
    e.life -= dt;
    if (e.type === 'meteor') { e.x += (e.tx - e.x) * dt * 5; e.y += (e.ty - e.y) * dt * 5; }
    if (e.type === 'boom') { const mx = (e.max != null) ? e.max : e.r; e.r = mx * (1 - e.life / e.maxLife); }
    if (e.type === 'curse') {
      const dps = 26;
      G.buildings.forEach(b => { if (dist(b, e) < e.r) damageTarget(b, dps * dt); });
      G.doors.forEach(d => { if (dist({ x: WALL_X, y: d.y }, e) < e.r) { damageTarget(d, dps * dt); if (d.hp <= 0) breakDoor(d); } });
      if (Math.random() < dt * 10) spawnParts(e.x + rnd(-e.r, e.r), e.y + rnd(-e.r, e.r), 1, '#94a3b8', 0.8, 0.6);
    }
    if (e.life <= 0) G.effects.splice(i, 1);
  }
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.vy += 60 * dt;
    if (p.life <= 0) G.parts.splice(i, 1);
  }
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const t = G.texts[i];
    t.life -= dt; t.y -= dt * 34;
    if (t.life <= 0) G.texts.splice(i, 1);
  }
}
function checkAchievements() {
  ACHIEVEMENTS.forEach(a => {
    if (G.ach[a.id]) return;
    let ok = false;
    try { ok = a.check(); } catch (e) { ok = false; }
    if (ok) {
      G.ach[a.id] = 1;
      if (a.reward.gold) G.gold += a.reward.gold;
      if (a.reward.soul) G.souls += a.reward.soul;
      setTip('🏆 成就达成【' + a.name + '】！奖励 ' + (a.reward.soul ? a.reward.soul + '🔮' : '') + (a.reward.gold ? a.reward.gold + '💰' : ''), 6);
      SFX.achieve();
      addText(ROOM_X0 + 300, DOOR_MID_Y() - 130, '🏆 ' + a.name, '#ffe066', true);
    }
  });
}
/* ------------------------------------------------------------------
 * 存档入口：真正的实现与格式定义都在 save.js 的 SaveSystem。
 * 保留这三个函数名是因为 endWave / 摇奖 / 按钮 / 主菜单都在调它们。
 * ------------------------------------------------------------------ */
function saveGame(slot) {
  if (!G || G.over) return false;
  const s = (slot === undefined) ? 0 : slot;
  const d = SaveSystem.capture();
  if (!d) return false;
  const r = SaveSystem.write(s, d);
  const b = +Store.get('tangping_best', 0) || 0;
  if (G.wave > b) Store.set('tangping_best', G.wave);
  if (!r.ok) {
    setTip(r.reason === 'quota' ? '⚠️ 浏览器存储空间已满，存档失败（可在存档面板导出备份）' : '⚠️ 存档写入失败', 6);
    return false;
  }
  return true;
}
function loadSave(slot) {
  return SaveSystem.read((slot === undefined) ? 0 : slot);
}
/** 读档：完整恢复（含难度/模式/命运加成/开局道具/护盾/梦境进度），实现见 save.js */
function applySave(d) { return SaveSystem.restore(d); }
function gameOver() {
  if (G.over) return;
  if (G.admin) {
    G.bed.hp = G.bed.maxHp; G.bed.shield = G.bed.shieldMax;
    addText(BED_CX, BED_CY - 90, '👑 管理员不会死亡', '#fbbf24', true);
    flash = 0.4; SFX.up();
    setTip('管理员模式：血量无限，本局不会死亡', 4);
    return;
  }
  if (G.reviveLeft > 0) {
    G.reviveLeft--;
    G.bed.hp = G.bed.maxHp; G.bed.shield = G.bed.shieldMax;
    addText(BED_CX, BED_CY - 90, '🔁 梦境重生！', '#c084fc', true);
    spawnParts(BED_CX, BED_CY, 40, '#c084fc', 5, 1.1);
    flash = 0.6; shakeBy(16); SFX.up();
    setTip('「梦境重生」生效，床铺已恢复满血', 5);
    return;
  }
  G.over = true; G.state = 'over';
  grantMetaReward(false);
  SFX.lose(); shakeBy(24); flash = 0.8;
  const b = +Store.get('tangping_best', 0) || 0;
  if (G.wave > b) Store.set('tangping_best', G.wave);
  SaveSystem.remove(0);   // 结局后清掉自动存档（存档系统统一走 SaveSystem）
  showGameOver();
}
function gameWin() {
  if (G.over) return;
  if (G.mode === 'unlimited') {
    G.cleared = (G.cleared || 0) + 1;
    G.state = 'build'; G.prepTimer = 25;
    addText(ROOM_X0 + 300, DOOR_MID_Y() - 170, '♾ 已击败终焉梦魇，无尽继续！', '#7dd3fc', true);
    spawnParts(640, 300, 60, '#7dd3fc', 5, 1.2);
    setTip('无限模式：本局永不结束，梦魇会越来越强 — 看你能撑到第几波', 7);
    return;
  }
  G.over = true; G.state = 'win';
  grantMetaReward(true);
  SFX.win(); flash = 0.7; shakeBy(20);
  const b = +Store.get('tangping_best', 0) || 0;
  if (G.wave > b) Store.set('tangping_best', G.wave);
  Store.set('tangping_cleared', 1);
  SaveSystem.remove(0);
  spawnParts(640, 300, 80, '#ffd166', 6, 1.4);
  showVictory();
}
function step(dt) {
  // 击杀停顿：精英/BOSS 击杀时短暂冻结时间
  if (hitStop > 0) { hitStop -= dt; return; }
  // 深层梦境的时间流速（story.js 里写的 ×0.85 / ×1.15，此前没有接线）
  if (typeof DeepDream !== 'undefined' && DeepDream.isActive()) {
    const ts = DeepDream.getTimeScale();
    if (ts && ts !== 1) dt *= ts;
  }
  if (G.fate.bedRegen) G.bed.hp = Math.min(G.bed.maxHp, G.bed.hp + G.fate.bedRegen * dt);
  if (G.resDirty) { computeResonance(); G.resDirty = false; }
  updateWave(dt);
  updateEconomy(dt);
  updateTowers(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updateSkills(dt);
  updateEffects(dt);
  G.doors.forEach(d => { d.hp = clamp(d.hp, 0, d.maxHp); });
  G.bed.hp = clamp(G.bed.hp, 0, G.bed.maxHp);
  if (G.tipTimer > 0) G.tipTimer -= dt;
  if (G.waveTransition && G.waveTransition.t > 0) G.waveTransition.t -= dt;
  // 梦境系统：每帧更新
  if (typeof DreamEngine !== 'undefined') { try { DreamEngine.tick(dt); } catch(e) { console.warn('DreamEngine tick:', e); } }
}
function rollLotteryItem() {
  G.lot.n++; G.lot.ep++; G.lot.lg++;
  let pool = LOTTERY_POOL;
  if (G.lot.lg >= LOTTERY.pityLegend) pool = LOTTERY_POOL.filter(p => p.r === 'legend');
  else if (G.lot.ep >= LOTTERY.pityEpic) pool = LOTTERY_POOL.filter(p => p.r === 'epic' || p.r === 'legend');
  let total = 0; for (const p of pool) total += p.w;
  let x = Math.random() * total, hit = pool[pool.length - 1];
  for (const p of pool) { x -= p.w; if (x <= 0) { hit = p; break; } }
  if (hit.r === 'legend') { G.lot.lg = 0; G.lot.ep = 0; }
  else if (hit.r === 'epic') G.lot.ep = 0;
  return hit;
}
function drawLottery(n, currency) {
  if (!G || G.over) return null;
  if ((n !== 1 && n !== 10) || (currency !== 'gold' && currency !== 'soul')) { SFX.err(); return null; }
  const useSoul = currency === 'soul';
  const cost = useSoul ? LOTTERY.soulCost * n : (n === 10 ? LOTTERY.tenCost : LOTTERY.cost * n);
  const has = useSoul ? G.souls : G.gold;
  if (has < cost) { SFX.err(); setTip((useSoul ? '灵魂' : '金币') + '不足，需要 ' + cost, 3); return null; }
  if (useSoul) G.souls -= cost; else G.gold -= cost;
  const results = [];
  for (let i = 0; i < n; i++) {
    const item = rollLotteryItem();
    let txt = '';
    try { txt = item.apply() || ''; } catch (e) { txt = '奖励已生效'; }
    results.push({ id: item.id, r: item.r, name: item.name, icon: item.icon, desc: item.desc, txt });
  }
  G.lastDraw = results;
  checkAchievements();
  const best = ['common', 'rare', 'epic', 'legend'].reduce((a, b) =>
    results.some(x => x.r === b) ? b : a, 'common');
  if (best === 'legend') { SFX.achieve(); shakeBy(10); flash = 0.4; }
  else if (best === 'epic') { SFX.up(); flash = 0.2; }
  else SFX.coin();
  spawnParts(640, 300, best === 'legend' ? 40 : 16, RARITY[best].color, best === 'legend' ? 5 : 3, 0.9);
  saveGame();
  return results;
}
function upgradeAllBuildings(onlyTower) {
  let n = 0, spent = 0;
  const list = G.buildings.filter(b => !onlyTower || b.def.tower);
  for (const b of list) {
    if (b.level >= b.def.maxLv) continue;
    const c = upgradeCost(b.def, b.level);
    if (!canAfford(c)) continue;
    payCost(c); b.level++; b.invested += c.gold; spent += c.gold;
    const nh = buildingMaxHp(b.def, b.level, b.branch);
    b.hp += nh - b.maxHp; b.maxHp = nh; n++;
    spawnParts(b.x, b.y, 8, b.def.color, 2, 0.5);
  }
  if (n) { SFX.up(); setTip('批量升级：' + n + ' 座建筑，消耗 ' + fmt(spent) + ' 金币', 4); }
  else { SFX.err(); setTip('没有可升级的建筑或资源不足', 3); }
  return n;
}
function upgradeMaxSelected(b) {
  if (!b) return 0;
  if (b.isBed) {
    let n = 0;
    while (G.bed.lv < 50 && canAfford({ gold: bedUpgradeCost(G.bed.lv) })) { upgradeBed(); n++; if (n > 60) break; }
    if (n) setTip(bedName() + ' 连升 ' + n + ' 级！', 3);
    return n;
  }
  if (b.isDoor) {
    const d = b.door; let n = 0;
    while (d.lv < 50 && canAfford({ gold: doorUpgradeCost(d.lv) })) { upgradeDoor(d); n++; if (n > 60) break; }
    if (n) setTip(doorName(d) + ' 连升 ' + n + ' 级！', 3);
    return n;
  }
  if (!b.def) return 0;
  let n = 0;
  while (b.level < b.def.maxLv) {
    const c = upgradeCost(b.def, b.level);
    if (!canAfford(c)) break;
    if (!tryUpgrade(b)) break;
    n++;
    if (n > 60) break;
  }
  if (n) setTip(buildName(b) + ' 连升 ' + n + ' 级！', 3);
  return n;
}
function socketRune(b, runeId, slot) {
  if (!b || !b.def) return false;
  const idx = G.runeBag.findIndex(r => r.id === runeId);
  if (idx < 0) return false;
  const slots = runeSlots();
  if (slot == null) slot = b.runes.findIndex((r, i) => !r && i < slots);
  if (slot < 0 || slot >= slots) { SFX.err(); setTip('没有空的符文槽，升级「符文宗师」可增加槽位', 3); return false; }
  const old = b.runes[slot];
  b.runes[slot] = G.runeBag.splice(idx, 1)[0];
  if (old) G.runeBag.push(old);
  SFX.up(); setTip('已镶嵌「' + b.runes[slot].name + '」到 ' + buildName(b), 3);
  return true;
}
function unsocketRune(b, slot) {
  if (!b || !b.runes || !b.runes[slot]) return false;
  G.runeBag.push(b.runes[slot]); b.runes[slot] = null;
  SFX.coin(); return true;
}
function upgradeRune(r) {
  if (!r) return false;
  const c = runeUpCost(r);
  if (G.souls < c) { SFX.err(); setTip('灵魂不足，需要 ' + c + '🔮', 3); return false; }
  G.souls -= c; r.lv++;
  SFX.up(); setTip('符文强化至 +' + r.lv + '（效果 +' + Math.round((runeMul(r) - 1) * 100) + '%）', 3);
  return true;
}
function upgradeRuneIn(b, slot) {
  if (!b || !b.runes || !b.runes[slot]) return false;
  return upgradeRune(b.runes[slot]);
}
function salvageRune(runeId) {
  const idx = G.runeBag.findIndex(r => r.id === runeId);
  if (idx < 0) {
    for (const b of G.buildings) {
      for (let i = 0; i < (b.runes || []).length; i++) {
        if (b.runes[i] && b.runes[i].id === runeId) { const rr = b.runes[i]; b.runes[i] = null; G.souls += runeSalvage(rr); SFX.coin(); setTip('分解获得 ' + runeSalvage(rr) + '🔮', 3); return true; }
      }
    }
    return false;
  }
  const r = G.runeBag.splice(idx, 1)[0];
  const v = runeSalvage(r); G.souls += v;
  SFX.coin(); setTip('分解「' + r.name + '」获得 ' + v + '🔮', 3);
  return true;
}
function upgradeAllMax() {
  let n = 0, lv = 0;
  G.buildings.slice().forEach(b => { const before = b.level; n += upgradeMaxSelected(b); lv += b.level - before; });
  const bl = G.bed.lv; n += upgradeMaxSelected({ isBed: true }); lv += G.bed.lv - bl;
  G.doors.forEach(d => { const before = d.lv; n += upgradeMaxSelected({ isDoor: true, door: d }); lv += d.lv - before; });
  if (lv) { setTip('⏫ 全体升满！共提升 ' + lv + ' 级', 4); SFX.up(); }
  else { SFX.err(); setTip('资源不足，无法继续升级', 3); }
  return lv;
}
