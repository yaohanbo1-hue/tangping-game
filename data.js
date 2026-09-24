const W = 1280, H = 720;
const HUD_H = 56;
const ARENA_TOP = 66, ARENA_BOT = 556;
const CORRIDOR_X0 = 40, WALL_X = 380;
const ROOM_X0 = 380, ROOM_X1 = 1260;
const COLS = 8, ROWS = 5, CW = 110, CH = 98;
const LANES = (function () {
  const h = (ARENA_BOT - ARENA_TOP) / 3, a = [];
  for (let i = 0; i < 3; i++) { const y0 = ARENA_TOP + i * h; a.push({ i, y0, y1: y0 + h, doorY: y0 + h / 2, doorHalf: 40 }); }
  return a;
})();
const BED_CELLS = [[7, 1], [7, 2]];
const BED_CX = ROOM_X0 + 7 * CW + CW / 2;
const BED_CY = ARENA_TOP + 1 * CH + CH;
const BRANCH_AT = 6;
const DMG = {
  kinetic: { name: '动能', color: '#9ef01a', icon: '🔫' },
  frost: { name: '冰霜', color: '#7fdfff', icon: '❄️' },
  energy: { name: '能量', color: '#ff5d8f', icon: '🔆' },
  shock: { name: '电磁', color: '#c77dff', icon: '⚡' },
  fire: { name: '火焰', color: '#ff8c42', icon: '🔥' },
  toxic: { name: '剧毒', color: '#a3e635', icon: '🧪' },
};
const DMG_KEYS = Object.keys(DMG);
const BUILD_DEFS = {
  miner: {
    name: '金币矿机', icon: '⛏️', key: '1', color: '#f5c542',
    cost: { gold: 60, power: 10 }, upkeep: 1.0, hp: 180, maxLv: 50,
    desc: '持续挖掘金币，是躺平的经济支柱。',
    stat: lv => ({ gold: 3 * Math.pow(2, lv - 1) }),
    statText: s => `产出 ${fmt(s.gold)} 金币/秒`,
    branch: {
      a: { name: '深井矿机', icon: '🕳️', desc: '产量大幅提升', cost: { gold: 400, soul: 12 }, mod: s => ({ gold: s.gold * 2.3 }) },
      b: { name: '精炼厂', icon: '🧪', desc: '金币产量进一步提升', cost: { gold: 350, soul: 12 }, mod: s => ({ gold: s.gold * 1.5 }) },
    },
  },
  generator: {
    name: '梦境发电机', icon: '🔋', key: '2', color: '#4ad6ff',
    cost: { gold: 80, power: 0 }, upkeep: 0, hp: 160, maxLv: 50,
    desc: '电力的持续来源。开局电量为 0；产出每级 x2，升级永不耗电。局内摇奖也能一次性补充电力。',
    noPowerUp: true,
    stat: lv => ({ regen: 6 * Math.pow(2, lv - 1) }),
    statText: s => `发电 ${fmt(s.regen)} 电量/秒`,
    branch: {
      a: { name: '核能核心', icon: '☢️', desc: '发电速率 x2.1', cost: { gold: 500, soul: 15 }, mod: s => ({ regen: s.regen * 2.1 }) },
      b: { name: '特斯拉线圈', icon: '🌀', desc: '发电 x1.2，并自动对最近敌人放电', cost: { gold: 450, soul: 15 }, mod: s => ({ regen: s.regen * 1.2, zapDmg: 30, zapRange: 260 }) },
    },
  },
  turret: {
    name: '机枪炮塔', icon: '🔫', key: '3', color: '#9ef01a',
    cost: { gold: 70, power: 15 }, upkeep: 1.2, hp: 220, maxLv: 50, tower: true, dmgType: 'kinetic',
    desc: '稳定输出的动能炮塔，对无甲梦魇效率最高。',
    stat: lv => ({ dmg: 12 + 5 * (lv - 1), rate: 1.6 + 0.14 * (lv - 1), range: 520 + 22 * (lv - 1) }),
    statText: s => `动能 ${s.dmg}  射速 ${s.rate.toFixed(2)}/秒  射程 ${s.range | 0}`,
    branch: {
      a: { name: '加特林', icon: '🌪️', desc: '射速 x2.6，单发伤害降低', cost: { gold: 520, soul: 14 }, mod: s => ({ dmg: s.dmg * 0.5, rate: s.rate * 2.6, range: s.range }) },
      b: { name: '狙击塔', icon: '🎯', desc: '伤害 x3.4、射程 +70%，射速减半', cost: { gold: 520, soul: 14 }, mod: s => ({ dmg: s.dmg * 3.4, rate: s.rate * 0.45, range: s.range * 1.7 }) },
    },
  },
  frost: {
    name: '冰霜塔', icon: '❄️', key: '4', color: '#7fdfff',
    cost: { gold: 90, power: 25 }, upkeep: 1.6, hp: 200, maxLv: 50, tower: true, dmgType: 'frost',
    desc: '减速敌人，为其他炮塔创造输出窗口。',
    stat: lv => ({ dmg: 6 + 3 * (lv - 1), rate: 1.2 + 0.08 * (lv - 1), range: 480 + 20 * (lv - 1), slow: 0.30 + 0.035 * (lv - 1) }),
    statText: s => `冰霜 ${s.dmg}  减速 ${(s.slow * 100) | 0}%  射程 ${s.range | 0}`,
    branch: {
      a: { name: '绝对零度', icon: '🧊', desc: '减速翻倍并概率冻结', cost: { gold: 480, soul: 14 }, mod: s => ({ dmg: s.dmg * 1.2, rate: s.rate, range: s.range * 1.15, slow: Math.min(0.85, s.slow * 2), freezeChance: 0.22 }) },
      b: { name: '破冰者', icon: '💠', desc: '伤害大幅提升并削弱敌人抗性', cost: { gold: 480, soul: 14 }, mod: s => ({ dmg: s.dmg * 3.6, rate: s.rate * 1.2, range: s.range, slow: s.slow * 0.7, shred: 0.3 }) },
    },
  },
  laser: {
    name: '激光塔', icon: '🔆', key: '5', color: '#ff5d8f',
    cost: { gold: 190, power: 60 }, upkeep: 3.2, hp: 200, maxLv: 50, tower: true, dmgType: 'energy',
    desc: '超远射程高伤穿透，专治重甲与BOSS。',
    stat: lv => ({ dmg: 45 + 22 * (lv - 1), rate: 0.55 + 0.05 * (lv - 1), range: 780 + 30 * (lv - 1), pierce: 2 }),
    statText: s => `能量 ${s.dmg}  穿透 ${s.pierce}  射程 ${s.range | 0}`,
    branch: {
      a: { name: '聚变激光', icon: '💥', desc: '单体重伤，穿透+2', cost: { gold: 700, soul: 18 }, mod: s => ({ dmg: s.dmg * 2.0, rate: s.rate, range: s.range * 1.1, pierce: s.pierce + 2 }) },
      b: { name: '散射棱镜', icon: '🌈', desc: '同时射击 3 个目标', cost: { gold: 700, soul: 18 }, mod: s => ({ dmg: s.dmg * 0.85, rate: s.rate * 1.3, range: s.range, pierce: s.pierce, multi: 3 }) },
    },
  },
  tesla: {
    name: '电磁塔', icon: '⚡', key: '6', color: '#c77dff',
    cost: { gold: 150, power: 45 }, upkeep: 2.8, hp: 210, maxLv: 50, tower: true, dmgType: 'shock',
    desc: '闪电在敌群中连锁跳跃，清理小怪极快。',
    stat: lv => ({ dmg: 18 + 8 * (lv - 1), rate: 1.0 + 0.07 * (lv - 1), range: 380 + 16 * (lv - 1), chain: 3 + Math.floor((lv - 1) / 2) }),
    statText: s => `电磁 ${s.dmg}  连锁 ${s.chain}  射程 ${s.range | 0}`,
    branch: {
      a: { name: '雷暴之眼', icon: '⛈️', desc: '连锁目标翻倍', cost: { gold: 620, soul: 16 }, mod: s => ({ dmg: s.dmg * 1.15, rate: s.rate * 1.2, range: s.range * 1.25, chain: s.chain * 2 }) },
      b: { name: '电磁脉冲', icon: '📴', desc: '命中范围眩晕，连锁减少', cost: { gold: 620, soul: 16 }, mod: s => ({ dmg: s.dmg * 2.2, rate: s.rate * 0.8, range: s.range, chain: s.chain, stun: 0.7, splash: 70 }) },
    },
  },
  flame: {
    name: '火焰喷射器', icon: '🔥', key: '7', color: '#ff8c42',
    cost: { gold: 130, power: 35 }, upkeep: 2.4, hp: 240, maxLv: 50, tower: true, dmgType: 'fire',
    desc: '近距离范围灼烧，堵门利器；脱离火舌后仍会残留 1.4 秒燃烧。',
    stat: lv => ({ dmg: 10 + 5 * (lv - 1), range: 300 + 14 * (lv - 1), radius: 110 + 8 * (lv - 1) }),
    statText: s => `火焰 ${s.dmg}/秒（+50% 灼烧残留）  范围 ${s.radius | 0}`,
    branch: {
      a: { name: '炼狱风暴', icon: '🌋', desc: '范围与灼烧大幅提升', cost: { gold: 560, soul: 15 }, mod: s => ({ dmg: s.dmg * 1.8, range: s.range * 1.35, radius: s.radius * 1.6 }) },
      b: { name: '熔岩印记', icon: '🩸', desc: '灼烧可无限叠加，伤害递增', cost: { gold: 560, soul: 15 }, mod: s => ({ dmg: s.dmg * 1.3, range: s.range, radius: s.radius * 1.2, stack: true }) },
    },
  },
  repair: {
    name: '维修台', icon: '🛠️', key: '8', color: '#7cf39a',
    cost: { gold: 120, power: 30 }, upkeep: 2.0, hp: 200, maxLv: 50,
    desc: '持续修复铁门与周围建筑。',
    stat: lv => ({ heal: 8 + 4 * (lv - 1), range: 300 + 15 * (lv - 1) }),
    statText: s => `修复 ${s.heal}/秒  范围 ${s.range | 0}`,
    branch: {
      a: { name: '纳米工厂', icon: '🔬', desc: '修复速度 x2.6，范围扩大', cost: { gold: 480, soul: 13 }, mod: s => ({ heal: s.heal * 2.6, range: s.range * 1.4 }) },
      b: { name: '护盾发生器', icon: '🛡️', desc: '改为持续附加护盾', cost: { gold: 480, soul: 13 }, mod: s => ({ heal: s.heal * 0.5, range: s.range * 1.3, shieldHeal: 18 }) },
    },
  },
  shield: {
    name: '护盾核心', icon: '🛡️', key: '9', color: '#5de6ff',
    cost: { gold: 200, power: 70 }, upkeep: 3.0, hp: 220, maxLv: 50,
    desc: '为铁门与范围内建筑附加可再生护盾。',
    stat: lv => ({ shield: 60 + 35 * (lv - 1), range: 320 + 18 * (lv - 1) }),
    statText: s => `护盾 ${s.shield}  范围 ${s.range | 0}`,
    branch: {
      a: { name: '群体力场', icon: '🔵', desc: '护盾值 x2.2，范围 x1.5', cost: { gold: 620, soul: 16 }, mod: s => ({ shield: s.shield * 2.2, range: s.range * 1.5 }) },
      b: { name: '反射力场', icon: '🪞', desc: '护盾反射 40% 近战伤害', cost: { gold: 620, soul: 16 }, mod: s => ({ shield: s.shield * 1.3, range: s.range, reflect: 0.4 }) },
    },
  },
  amp: {
    name: '聚能塔', icon: '📡', key: '0', color: '#ffd166',
    cost: { gold: 170, power: 40 }, upkeep: 1.5, hp: 190, maxLv: 50,
    desc: '增幅相邻炮塔伤害与射速，布局核心。',
    stat: lv => ({ bonus: 0.25 + 0.09 * (lv - 1), range: 165 }),
    statText: s => `相邻炮塔 +${(s.bonus * 100) | 0}% 伤害`,
    branch: {
      a: { name: '超频矩阵', icon: '🔺', desc: '伤害增幅翻倍', cost: { gold: 560, soul: 15 }, mod: s => ({ bonus: s.bonus * 2.1, range: s.range }) },
      b: { name: '全域增幅', icon: '🌐', desc: '范围 x2.4，覆盖更多炮塔', cost: { gold: 560, soul: 15 }, mod: s => ({ bonus: s.bonus * 1.15, range: s.range * 2.4 }) },
    },
  },
  poison: {
    name: '毒液喷射塔', icon: '🧪', key: 'a', color: '#a3e635',
    cost: { gold: 145, power: 22 }, upkeep: 1.6, hp: 210, maxLv: 50, tower: true, dmgType: 'toxic',
    desc: '喷射腐蚀性毒液，命中叠加毒层持续掉血，无视护盾直接侵蚀生命。',
    stat: lv => ({ dmg: 9 * 1.075 + 3.6 * 1.075 * (lv - 1), rate: 1.15 + 0.09 * (lv - 1), range: 400 + 16 * (lv - 1), poison: 1, poisonDps: 7 * 1.075 + 2.4 * 1.075 * (lv - 1), maxStack: 8 }),
    statText: s => `剧毒 ${s.dmg}  毒伤 ${s.poisonDps}/秒/层  上限 ${s.maxStack} 层  射程 ${s.range | 0}`,
    branch: {
      a: { name: '瘟疫之源', icon: '🦠', desc: '毒伤 x2.2，毒层上限 +4，可传染邻近敌人', cost: { gold: 620, soul: 18 }, mod: s => ({ dmg: s.dmg * 1.15, poisonDps: s.poisonDps * 2.2, maxStack: s.maxStack + 4, spread: true, range: s.range }) },
      b: { name: '腐蚀炮', icon: '☠️', desc: '伤害 x2.6，毒液附带破甲（降低全抗性）', cost: { gold: 620, soul: 18 }, mod: s => ({ dmg: s.dmg * 2.6, poisonDps: s.poisonDps * 0.7, maxStack: s.maxStack, shred: 0.9, range: s.range * 1.1 }) },
    },
  },
  sonic: {
    name: '声波共振塔', icon: '📢', key: 'c', color: '#f0abfc',
    cost: { gold: 165, power: 26 }, upkeep: 1.8, hp: 240, maxLv: 50, tower: true, dmgType: 'kinetic',
    desc: '发出扇形声波，同时打击射程内所有梦魇并击退，对群体极为有效。',
    stat: lv => ({ dmg: 11 * 1.075 + 4.2 * 1.075 * (lv - 1), rate: 0.85 + 0.06 * (lv - 1), range: 330 + 13 * (lv - 1), knock: 16 + 2 * (lv - 1), aoe: true }),
    statText: s => `全范围 ${s.dmg}  击退 ${s.knock | 0}  射速 ${s.rate.toFixed(2)}/秒  射程 ${s.range | 0}`,
    branch: {
      a: { name: '次声炮', icon: '🔊', desc: '范围 +45%，击退翻倍', cost: { gold: 660, soul: 20 }, mod: s => ({ dmg: s.dmg * 1.1, rate: s.rate, range: s.range * 1.45, knock: s.knock * 2, aoe: true }) },
      b: { name: '共振尖啸', icon: '🎵', desc: '伤害 x2.4，声波使敌人眩晕', cost: { gold: 660, soul: 20 }, mod: s => ({ dmg: s.dmg * 2.4, rate: s.rate * 0.8, range: s.range, knock: s.knock * 0.5, aoe: true, sonicStun: 0.5 }) },
    },
  },
  missile: {
    name: '导弹发射塔', icon: '🚀', key: 'd', color: '#fb7185',
    cost: { gold: 190, power: 30 }, upkeep: 2.0, hp: 230, maxLv: 50, tower: true, dmgType: 'fire',
    desc: '发射追踪导弹，飞行较慢但命中后大范围爆炸，适合清理密集敌群。',
    stat: lv => ({ dmg: 34 * 1.075 + 13 * 1.075 * (lv - 1), rate: 0.6 + 0.04 * (lv - 1), range: 620 + 26 * (lv - 1), splash: 90 + 3 * (lv - 1) }),
    statText: s => `爆炸 ${s.dmg}  溅射半径 ${s.splash | 0}  射速 ${s.rate.toFixed(2)}/秒  射程 ${s.range | 0}`,
    branch: {
      a: { name: '集束导弹', icon: '🎆', desc: '一次发射 3 枚小型导弹', cost: { gold: 700, soul: 22 }, mod: s => ({ dmg: s.dmg * 0.55, rate: s.rate * 1.15, range: s.range, splash: s.splash * 0.8, multi: 3 }) },
      b: { name: '战术核弹', icon: '☢️', desc: '伤害 x2.8、溅射 x1.8，射速减半', cost: { gold: 700, soul: 22 }, mod: s => ({ dmg: s.dmg * 2.8, rate: s.rate * 0.5, range: s.range * 1.2, splash: s.splash * 1.8 }) },
    },
  },
  gravity: {
    name: '引力奇点塔', icon: '🕳️', key: 'v', color: '#818cf8',
    cost: { gold: 175, power: 28 }, upkeep: 1.7, hp: 260, maxLv: 50, tower: true, dmgType: 'energy',
    desc: '制造引力奇点，持续将梦魇拉向中心并大幅减速，本身伤害极低但控场极强。',
    stat: lv => ({ dmg: 4 + 1.6 * (lv - 1), rate: 1, range: 300 + 12 * (lv - 1), pull: 52 + 4 * (lv - 1), gravSlow: 0.34 + 0.011 * (lv - 1), gravity: true }),
    statText: s => `拉扯力 ${s.pull | 0}  减速 ${Math.round(s.gravSlow * 100)}%  微伤 ${s.dmg}  射程 ${s.range | 0}`,
    branch: {
      a: { name: '黑洞', icon: '🌑', desc: '拉扯力 x2.2、减速 +25%，范围 +20%', cost: { gold: 680, soul: 20 }, mod: s => ({ dmg: s.dmg, rate: 1, range: s.range * 1.2, pull: s.pull * 2.2, gravSlow: Math.min(0.85, s.gravSlow + 0.25), gravity: true }) },
      b: { name: '奇点坍缩', icon: '💫', desc: '伤害 x6，被聚集的敌人受到额外伤害', cost: { gold: 680, soul: 20 }, mod: s => ({ dmg: s.dmg * 6, rate: 1, range: s.range, pull: s.pull * 1.3, gravSlow: s.gravSlow, gravity: true, collapse: 0.5 }) },
    },
  },
  prism: {
    name: '棱镜分裂塔', icon: '🔺', key: 'n', color: '#67e8f9',
    cost: { gold: 205, power: 32 }, upkeep: 2.1, hp: 220, maxLv: 50, tower: true, dmgType: 'energy',
    desc: '射出可分裂的光束，一次攻击同时打击多个随机目标，目标越多越划算。',
    stat: lv => ({ dmg: 16 * 1.075 + 6.4 * 1.075 * (lv - 1), rate: 1.0 + 0.07 * (lv - 1), range: 500 + 20 * (lv - 1), split: 3 + Math.floor((lv - 1) / 8) }),
    statText: s => `能量 ${s.dmg}  分裂 ${s.split} 目标  射速 ${s.rate.toFixed(2)}/秒  射程 ${s.range | 0}`,
    branch: {
      a: { name: '万花筒', icon: '🌈', desc: '分裂数 x2（每个目标伤害略降）', cost: { gold: 720, soul: 24 }, mod: s => ({ dmg: s.dmg * 0.62, rate: s.rate, range: s.range, split: s.split * 2 }) },
      b: { name: '聚焦棱镜', icon: '🔷', desc: '分裂数降为 2，但伤害 x4.2', cost: { gold: 720, soul: 24 }, mod: s => ({ dmg: s.dmg * 4.2, rate: s.rate * 0.85, range: s.range * 1.15, split: 2 }) },
    },
  },
  bank: {
    name: '梦境银行', icon: '🏦', key: '-', color: '#ffc300',
    cost: { gold: 250, power: 20 }, upkeep: 0.5, hp: 180, maxLv: 50,
    desc: '每波结束按存款发放利息。',
    stat: lv => ({ interest: 0.08 + 0.035 * (lv - 1) }),
    statText: s => `每波利息 ${(s.interest * 100).toFixed(1)}%`,
    branch: {
      a: { name: '投资银行', icon: '📈', desc: '利息 x2.2', cost: { gold: 600, soul: 14 }, mod: s => ({ interest: s.interest * 2.2 }) },
      b: { name: '灵魂交易所', icon: '🔮', desc: '利息降低，改为每波产灵魂', cost: { gold: 600, soul: 14 }, mod: s => ({ interest: s.interest * 0.8, souls: 6 }) },
    },
  },
};
const BUILD_KEYS = Object.keys(BUILD_DEFS);
const ENEMY_DEFS = {
  grunt: { name: '梦魇', icon: '👻', hp: 60, speed: 38, dmg: 8, gold: 6, soul: 1, cost: 10, r: 17, color: '#b28dff' },
  sprinter: { name: '疾行梦魇', icon: '💨', hp: 42, speed: 80, dmg: 6, gold: 8, soul: 1, cost: 14, r: 14, color: '#8ef6ff' },
  brute: { name: '重甲梦魇', icon: '🦍', hp: 280, speed: 26, dmg: 24, gold: 22, soul: 3, cost: 30, r: 24, color: '#ff9e6b', res: { kinetic: 0.45 }, weak: { energy: 0.35 } },
  phantom: { name: '幽灵', icon: '🌫️', hp: 95, speed: 52, dmg: 12, gold: 15, soul: 2, cost: 22, r: 18, color: '#d7e8ff', stealth: true, res: { kinetic: 0.3 }, weak: { fire: 0.4 } },
  bomber: { name: '自爆梦魇', icon: '💣', hp: 75, speed: 58, dmg: 5, gold: 13, soul: 2, cost: 20, r: 18, color: '#ff6b6b', explode: 90, weak: { frost: 0.5 }, res: { fire: 0.5 } },
  healer: { name: '治疗梦魇', icon: '💚', hp: 130, speed: 34, dmg: 4, gold: 19, soul: 3, cost: 28, r: 19, color: '#6bff9e', heal: 10, res: { energy: 0.4 }, weak: { fire: 0.45 } },
  splitter: { name: '分裂梦魇', icon: '🕷️', hp: 120, speed: 44, dmg: 10, gold: 13, soul: 2, cost: 24, r: 20, color: '#ff7ff0', split: 2, weak: { fire: 0.35 } },
  bulwark: { name: '盾卫梦魇', icon: '🛡️', hp: 160, speed: 32, dmg: 14, gold: 20, soul: 3, cost: 32, r: 21, color: '#5de6ff', shieldself: 0.6, res: { energy: 0.5 }, weak: { shock: 0.55 } },
  flier: { name: '飞行梦魇', icon: '🦇', hp: 70, speed: 66, dmg: 10, gold: 14, soul: 2, cost: 26, r: 16, color: '#c4b5fd', flying: true, weak: { kinetic: 0.45 }, res: { fire: 0.3 } },
  summoner: { name: '召唤梦魇', icon: '🌀', hp: 210, speed: 28, dmg: 8, gold: 26, soul: 4, cost: 38, r: 22, color: '#f0abfc', summon: { type: 'grunt', every: 4.5, n: 2 }, res: { fire: 0.35 } },
  berserker: { name: '狂暴梦魇', icon: '😤', hp: 150, speed: 50, dmg: 18, gold: 21, soul: 3, cost: 34, r: 20, color: '#fbbf24', frenzy: { at: 0.35, spd: 2.0, dmg: 1.9 }, weak: { frost: 0.5 } },
  vampire: { name: '吸血梦魇', icon: '🧛', hp: 180, speed: 42, dmg: 16, gold: 24, soul: 4, cost: 36, r: 20, color: '#f87171', vamp: 0.4, res: { frost: 0.4 }, weak: { energy: 0.4 } },
  boss: { name: '梦魇领主', icon: '😈', hp: 2200, speed: 22, dmg: 65, gold: 170, soul: 24, cost: 200, r: 38, color: '#ff4d6d', boss: true },
};
const BOSS_PHASES = [
  { at: 1.0, name: '第一阶段', res: {}, speed: 1, dmg: 1 },
  { at: 0.6, name: '第二阶段', res: { kinetic: 0.35, frost: 0.35 }, speed: 1.15, dmg: 1.2, summon: { type: 'grunt', every: 3.5, n: 3 } },
  { at: 0.3, name: '狂暴阶段', res: { kinetic: 0.5, frost: 0.5, fire: 0.3 }, speed: 1.7, dmg: 1.6, aura: true },
];
const AFFIX = {
  tough: { name: '坚韧', icon: '💪', color: '#fb923c', hp: 3.0, desc: '生命 x3' },
  swift: { name: '迅捷', icon: '💨', color: '#8ef6ff', spd: 1.8, desc: '速度 +80%' },
  shielded: { name: '护盾', icon: '🛡️', color: '#5de6ff', shield: 0.55, desc: '带可再生护盾' },
  resist: { name: '抗性', icon: '🪨', color: '#94a3b8', allres: 0.4, desc: '全属性减伤 40%' },
  vamp: { name: '吸血', icon: '🩸', color: '#f87171', vamp: 0.35, desc: '攻击回复生命' },
  frenzy: { name: '狂暴', icon: '😤', color: '#fbbf24', frenzy: true, desc: '残血时狂暴' },
  splitter: { name: '分裂', icon: '🕷️', color: '#ff7ff0', split: 2, desc: '死亡后分裂' },
  deadly: { name: '亡语', icon: '💥', color: '#ff6b6b', explode: 70, desc: '死亡时爆炸' },
  regen: { name: '再生', icon: '💚', color: '#6bff9e', regen: 0.025, desc: '持续回复生命' },
  armored: { name: '重甲', icon: '🦾', color: '#a8a29e', flat: 10, desc: '受到伤害固定减免' },
};
const AFFIX_KEYS = Object.keys(AFFIX);
function waveUnlocks(n) {
  const u = [];
  const add = (t, base, k) => { for (let i = 0; i < base + Math.floor(n * k); i++) u.push(t); };
  add('grunt', 2, 0.55);
  if (n >= 3) add('sprinter', 1, 0.32);
  if (n >= 5) add('flier', 1, 0.20);
  if (n >= 6) add('brute', 1, 0.20);
  if (n >= 8) add('phantom', 1, 0.16);
  if (n >= 9) add('bulwark', 1, 0.14);
  if (n >= 10) add('bomber', 0, 0.14);
  if (n >= 11) add('splitter', 0, 0.13);
  if (n >= 12) add('healer', 0, 0.12);
  if (n >= 14) add('berserker', 0, 0.14);
  if (n >= 16) add('vampire', 0, 0.13);
  if (n >= 18) add('summoner', 0, 0.12);
  if (n >= 9) add('swarm', 1, 0.30);
  if (n >= 13) add('digger', 0, 0.12);
  if (n >= 15) add('leech', 0, 0.11);
  if (n >= 17) add('mimic', 0, 0.11);
  if (n >= 19) add('emp', 0, 0.10);
  if (n >= 21) add('wraith', 0, 0.11);
  if (n >= 23) add('frostbane', 0, 0.10);
  if (n >= 25) add('warden', 0, 0.09);
  if (n >= 27) add('necromancer', 0, 0.09);
  if (n >= 29) add('reaper', 0, 0.09);
  if (n >= 32) add('juggernaut', 0, 0.07);
  if (n >= 12) add('reflector', 0, 0.10);
  if (n >= 14) add('thief', 0, 0.09);
  if (n >= 20) add('adaptive', 0, 0.10);
  if (n >= 22) add('saboteur', 0, 0.10);
  if (n >= 24) add('brood', 0, 0.08);
  if (n >= 26) add('chronos', 0, 0.08);
  if (n >= 30) add('nullifier', 0, 0.07);
  if (n >= 34) add('colossus', 0, 0.05);
  // 追加梦魇的解锁节奏（22 波起陆续登场）
  if (n >= 22) add('rustbug', 0, 0.09);
  if (n >= 24) add('owl', 0, 0.09);
  if (n >= 26) add('echo', 0, 0.08);
  if (n >= 28) add('weaver', 0, 0.07);
  return u;
}
const TECH_DEFS = {
  economy: { name: '经济头脑', icon: '💰', tier: 1, max: 10, cost: l => 4 + l * 2, desc: '金币产出 +7%/级' },
  firepower: { name: '火力强化', icon: '💥', tier: 1, max: 10, cost: l => 3 + l * 2, desc: '所有炮塔伤害 +8%/级' },
  rapid: { name: '急速射击', icon: '⏩', tier: 2, req: { firepower: 3 }, max: 10, cost: l => 3 + l * 2, desc: '炮塔射速 +5%/级' },
  electric: { name: '电力工程', icon: '🔌', tier: 2, req: { economy: 2 }, max: 8, cost: l => 4 + l * 3, desc: '电力容量 +15%、回复 +12%/级' },
  structure: { name: '加固工程', icon: '🧱', tier: 2, max: 10, cost: l => 3 + l * 2, desc: '建筑生命 +12%/级' },
  ironwall: { name: '铁壁加强', icon: '🚪', tier: 2, req: { structure: 3 }, max: 10, cost: l => 4 + l * 3, desc: '铁门生命 +15%/级' },
  crit: { name: '致命一击', icon: '🎯', tier: 3, req: { firepower: 5 }, max: 8, cost: l => 5 + l * 3, desc: '暴击率 +4%/级（暴击 2.2 倍）' },
  harvest: { name: '灵魂汲取', icon: '🔮', tier: 3, req: { economy: 4 }, max: 5, cost: l => 6 + l * 4, desc: '击杀额外 +1 灵魂/级' },
  overload: { name: '能量超载', icon: '☄️', tier: 3, req: { electric: 4 }, max: 6, cost: l => 6 + l * 4, desc: '所有伤害类型无视 6% 抗性/级' },
  vitality:     { name: '生命强化', icon: '❤️', tier: 1, max: 10, cost: l => 3 + l * 2, desc: '建筑生命 +10%/级' },
  greed:        { name: '贪婪之心', icon: '🤑', tier: 2, req: { economy: 3 }, max: 8, cost: l => 4 + l * 3, desc: '击杀金币 +8%/级' },
  mining:       { name: '采矿学',   icon: '⛏️', tier: 2, req: { economy: 2 }, max: 10, cost: l => 3 + l * 2, desc: '矿机产出 +10%/级' },
  sleep:        { name: '深度睡眠', icon: '😴', tier: 2, req: { economy: 2 }, max: 10, cost: l => 4 + l * 3, desc: '床铺产出 +12%/级' },
  focus:        { name: '远程校准', icon: '🔭', tier: 2, req: { firepower: 3 }, max: 8, cost: l => 3 + l * 2, desc: '炮塔射程 +6%/级' },
  swift:        { name: '急速装填', icon: '⏱️', tier: 3, req: { rapid: 4 }, max: 8, cost: l => 5 + l * 3, desc: '炮塔射速额外 +8%/级' },
  runemaster:   { name: '符文亲和', icon: '🔮', tier: 3, req: { harvest: 2 }, max: 6, cost: l => 6 + l * 4, desc: '符文效果 +15%/级' },
  fortify:      { name: '要塞化',   icon: '🏰', tier: 3, req: { structure: 4 }, max: 6, cost: l => 6 + l * 4, desc: '建筑获得最大生命 3% 护盾/级' },
  looting:      { name: '贪婪掠夺', icon: '🎁', tier: 3, req: { greed: 3 }, max: 5, cost: l => 8 + l * 5, desc: '符文掉落率 +20%/级' },
  berserk:      { name: '血怒',     icon: '😤', tier: 4, req: { firepower: 8 }, max: 5, cost: l => 10 + l * 6, desc: '建筑残血(<40%)时伤害 +25%/级' },
  thorn:        { name: '荆棘反伤', icon: '🌵', tier: 4, req: { ironwall: 5 }, max: 5, cost: l => 10 + l * 6, desc: '铁门反弹 20% 伤害/级' },
  compound:     { name: '复利奇迹', icon: '📈', tier: 4, req: { economy: 8 }, max: 5, cost: l => 12 + l * 7, desc: '金币产出额外 +25%/级' },
  critmaster:   { name: '致命精通', icon: '🗡️', tier: 4, req: { crit: 5 }, max: 5, cost: l => 10 + l * 6, desc: '暴击伤害 +40%/级' },
  soulstorm:    { name: '灵魂风暴', icon: '🌪️', tier: 4, req: { harvest: 4 }, max: 5, cost: l => 10 + l * 6, desc: '灵魂获取 +30%/级' },
  overcore:     { name: '超频核心', icon: '🔋', tier: 4, req: { electric: 6 }, max: 5, cost: l => 10 + l * 6, desc: '发电量 +40%/级' },
  annihilation: { name: '湮灭协议', icon: '☢️', tier: 4, req: { firepower: 10 }, max: 4, cost: l => 14 + l * 8, desc: '所有炮塔伤害 +20%/级' },
  runelord:     { name: '符文宗师', icon: '👑', tier: 4, req: { runemaster: 4 }, max: 4, cost: l => 14 + l * 8, desc: '所有建筑 +1 符文槽' },
  fortress:     { name: '不朽要塞', icon: '🛡️', tier: 4, req: { fortify: 4 }, max: 4, cost: l => 14 + l * 8, desc: '铁门与床铺生命 +50%/级' },
  eternity:     { name: '永恒梦境', icon: '🌌', tier: 4, req: { sleep: 6 }, max: 4, cost: l => 14 + l * 8, desc: '床铺产出额外 +60%/级' },
};
const TECH_KEYS = Object.keys(TECH_DEFS);
const SKILL_DEFS = {
  meteor: { name: '陨石雨', icon: '☄️', cd: 45, key: 'Q', desc: '对全场敌人造成巨额伤害' },
  freeze: { name: '时间冻结', icon: '❄️', cd: 60, key: 'W', desc: '冻结所有敌人 4.5 秒' },
  overclock: { name: '超频狂暴', icon: '⚡', cd: 50, key: 'E', desc: '8 秒内炮塔射速+80%、伤害+50%' },
  mend: { name: '紧急抢修', icon: '🩹', cd: 40, key: 'R', desc: '所有建筑、铁门、床铺全部修复至满血' },
  repel: { name: '磁力风暴', icon: '🧲', cd: 70, key: 'T', desc: '所有敌人被击退回走廊并眩晕 2 秒' },
  siphon: { name: '灵魂虹吸', icon: '🔮', cd: 55, key: 'F', desc: '立即获得大量灵魂并造成全屏伤害' },
};
const SKILL_KEYS = Object.keys(SKILL_DEFS);
const EVENTS = [
  { id: 'none', name: '平静', icon: '🌙', desc: '无事发生', eff: {} },
  { id: 'storm', name: '电力风暴', icon: '⚡', desc: '本波电力产出 -50%', eff: { powerMul: 0.5 } },
  { id: 'goldrain', name: '金币雨', icon: '🌧️', desc: '本波金币产出 x2', eff: { goldMul: 2 } },
  { id: 'surge', name: '梦魇狂潮', icon: '🌊', desc: '敌人 x1.5，奖励 x2', eff: { countMul: 1.5, rewardMul: 2 } },
  { id: 'calm', name: '宁静之夜', icon: '😴', desc: '敌人数量 x0.6', eff: { countMul: 0.6 } },
  { id: 'soul', name: '灵魂涌动', icon: '🔮', desc: '灵魂掉落 x2', eff: { soulMul: 2 } },
  { id: 'haste', name: '疾行时刻', icon: '⏩', desc: '敌人速度 x1.4', eff: { spdMul: 1.4 } },
  { id: 'blackout', name: '断电危机', icon: '🕯️', desc: '本波升级耗电量 x1.6', eff: { powerCostMul: 1.6 } },
  { id: 'brittle', name: '梦境脆弱', icon: '💔', desc: '敌人生命 -35%', eff: { hpMul: 0.65 } },
  // ── 追加事件：全部只用引擎已支持的 eff 字段（powerMul / goldMul / countMul /
  //    rewardMul / soulMul / spdMul / powerCostMul / hpMul），不需要改逻辑 ──
  { id: 'bloodmoon',  name: '血月当空', icon: '🌑', desc: '敌人生命 +40%，但灵魂掉落 x2.5', eff: { hpMul: 1.4, soulMul: 2.5 } },
  { id: 'twinrain',   name: '双倍宝箱', icon: '📦', desc: '敌人 x1.3，波次奖励 x2.5', eff: { countMul: 1.3, rewardMul: 2.5 } },
  { id: 'static',     name: '静电弥漫', icon: '🌫️', desc: '敌人速度 -25%，但电力产出 -35%', eff: { spdMul: 0.75, powerMul: 0.65 } },
  { id: 'inflation',  name: '梦境通胀', icon: '💸', desc: '本波金币产出 x3，但升级耗电 x2', eff: { goldMul: 3, powerCostMul: 2 } },
  { id: 'reaperhour', name: '收割时刻', icon: '⏳', desc: '敌人 x1.8、速度 x1.25，灵魂掉落 x3', eff: { countMul: 1.8, spdMul: 1.25, soulMul: 3 } },
];
const ACHIEVEMENTS = [
  { id: 'w10', name: '初露锋芒', desc: '存活到第 10 波', check: () => G.wave >= 10, reward: { soul: 15 } },
  { id: 'w25', name: '熟睡大师', desc: '存活到第 25 波', check: () => G.wave >= 25, reward: { soul: 40 } },
  { id: 'w40', name: '梦境主宰', desc: '存活到第 40 波', check: () => G.wave >= 40, reward: { soul: 90 } },
  { id: 'k500', name: '梦魇屠夫', desc: '累计击杀 500 只梦魇', check: () => G.stats.kills >= 500, reward: { gold: 400 } },
  { id: 'k2000', name: '歼灭专家', desc: '累计击杀 2000 只梦魇', check: () => G.stats.kills >= 2000, reward: { soul: 60 } },
  { id: 'rich', name: '小富即安', desc: '金币储量达到 3000', check: () => G.gold >= 3000, reward: { soul: 20 } },
  { id: 'growth', name: '彻底躺平', desc: '发育度达到满级 25', check: () => G.grow >= 25, reward: { soul: 30 } },
  { id: 'allbuild', name: '集大成者', desc: '同时拥有 11 种不同的建筑', check: () => new Set(G.buildings.map(b => b.type)).size >= 11, reward: { soul: 50 } },
  { id: 'branch', name: '进化之路', desc: '完成 5 次建筑转职', check: () => G.buildings.filter(b => b.branch).length >= 5, reward: { soul: 45 } },
  { id: 'nolose', name: '固若金汤', desc: '第 20 波时三扇门全部完好', check: () => G.wave >= 20 && G.doors.every(d => d.hp >= d.maxHp), reward: { soul: 55 } },
  { id: 'tower20', name: '炮塔森林', desc: '同时拥有 20 座炮塔', check: () => G.buildings.filter(b => b.def.tower).length >= 20, reward: { soul: 35 } },
  { id: 'boss5', name: '弑君者', desc: '击杀 5 个 BOSS', check: () => G.stats.bossKills >= 5, reward: { soul: 70 } },
  // ── 追加成就 ──
  { id: 'w55', name: '守夜人', desc: '存活到第 55 波', check: () => G.wave >= 55, reward: { soul: 150 } },
  { id: 'k5000', name: '梦魇清理者', desc: '累计击杀 5000 只梦魇', check: () => G.stats.kills >= 5000, reward: { soul: 120 } },
  { id: 'boss15', name: '梦魇终结者', desc: '击杀 15 个 BOSS', check: () => G.stats.bossKills >= 15, reward: { soul: 140 } },
  { id: 'rich30k', name: '梦境富豪', desc: '单局金币储量达到 30000', check: () => G.gold >= 30000, reward: { soul: 60 } },
  { id: 'combo30', name: '连杀艺术家', desc: '达成 30 连杀', check: () => G.maxCombo >= 30, reward: { soul: 50 } },
  { id: 'branch16', name: '全员进化', desc: '同时拥有 16 座已转职的建筑', check: () => G.buildings.filter(b => b.branch).length >= 16, reward: { soul: 110 } },
  { id: 'rune10', name: '符文收藏家', desc: '背包与建筑上共有 10 枚符文', check: () => (G.runeBag.length + G.buildings.reduce((n, b) => n + (b.runes || []).filter(Boolean).length, 0)) >= 10, reward: { soul: 70 } },
  { id: 'chal20', name: '挑战达人', desc: '累计完成 20 次波次挑战', check: () => (G.stats.challenges | 0) >= 20, reward: { soul: 80 } },
  { id: 'frag5', name: '拾忆者', desc: '收集 5 块记忆碎片', check: () => typeof DreamFragments !== 'undefined' && !!DreamFragments._collected && DreamFragments._collected.size >= 5, reward: { soul: 90 } },
  { id: 'npc3', name: '梦境召集人', desc: '同时驻守 3 位梦境居民', check: () => typeof NPCGuardians !== 'undefined' && !!NPCGuardians._recruited && NPCGuardians._recruited.length >= 3, reward: { soul: 85 } },
];
const RARITY = {
  common: { name: '普通', color: '#94a3b8', glow: 'rgba(148,163,184,.5)' },
  rare: { name: '稀有', color: '#38bdf8', glow: 'rgba(56,189,248,.6)' },
  epic: { name: '史诗', color: '#c084fc', glow: 'rgba(192,132,252,.7)' },
  legend: { name: '传说', color: '#fbbf24', glow: 'rgba(251,191,36,.9)' },
};
const LOTTERY = {
  cost: 220, tenCost: 1980, soulCost: 30,
  pityEpic: 12, pityLegend: 40,
};
const LOTTERY_POOL = [
  { id: 'g1', r: 'common', w: 22, name: '金币小礼', icon: '💰', desc: '获得 180~320 金币',
    apply: () => { const v = 180 + Math.round(Math.random() * 140); G.gold += v; return '获得 ' + v + ' 金币'; } },
  { id: 's1', r: 'common', w: 20, name: '灵魂碎片', icon: '🔮', desc: '获得 4~7 灵魂',
    apply: () => { const v = 4 + Math.round(Math.random() * 3); G.souls += v; return '获得 ' + v + ' 灵魂'; } },
  { id: 'h1', r: 'common', w: 18, name: '梦境修复', icon: '🩹', desc: '所有建筑回复 30% 生命',
    apply: () => { let n = 0; G.buildings.forEach(b => { if (b.hp < b.maxHp) { b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.3); n++; } }); G.doors.forEach(d => { if (d.hp < d.maxHp) { d.hp = Math.min(d.maxHp, d.hp + d.maxHp * 0.3); n++; } }); return n + ' 处建筑得到修复'; } },
  { id: 'p1', r: 'common', w: 16, name: '电力补充', icon: '⚡', desc: '电力立即充满',
    apply: () => { const v = Math.max(300, Math.round(powerInfo().regen * 60)); G.power += v; return '获得 ' + fmt(v) + ' 电量'; } },
  { id: 'g2', r: 'rare', w: 10, name: '金币大礼', icon: '💵', desc: '获得 650~1100 金币',
    apply: () => { const v = 650 + Math.round(Math.random() * 450); G.gold += v; return '获得 ' + v + ' 金币'; } },
  { id: 'u1', r: 'rare', w: 9, name: '强化祝福', icon: '⬆️', desc: '随机一座建筑免费升 1 级',
    apply: () => { const c = G.buildings.filter(b => b.level < b.def.maxLv); if (!c.length) { G.gold += 400; return '无建筑可升级，改为获得 400 金币'; } const b = pick(c); b.level++; const nh = buildingMaxHp(b.def, b.level, b.branch); b.hp += nh - b.maxHp; b.maxHp = nh; return b.def.name + ' 升至 Lv.' + b.level; } },
  { id: 'gr1', r: 'rare', w: 8, name: '加速发育', icon: '🌱', desc: '发育度 +3',
    apply: () => { G.grow = Math.min(25, G.grow + 3); return '发育度提升至 ' + G.grow; } },
  { id: 'gb1', r: 'rare', w: 8, name: '淘金热', icon: '🤑', desc: '本波金币产出 x2',
    apply: () => { G.buff.goldBoost = 1; return '本波金币产出翻倍！'; } },
  { id: 'd1', r: 'rare', w: 8, name: '铁门抢修', icon: '🚪', desc: '三扇铁门全部满血',
    apply: () => { G.doors.forEach(d => { d.hp = d.maxHp; d.broken = false; }); return '三扇铁门恢复如初'; } },
  { id: 'b1', r: 'epic', w: 3.2, name: '天降建筑', icon: '🏗️', desc: '免费获得一座随机建筑',
    apply: () => { const keys = BUILD_KEYS.slice(); for (let i = 0; i < 40; i++) { const c = (Math.random() * COLS) | 0, r = (Math.random() * ROWS) | 0; if (!G.grid[r * COLS + c] && !inBed(c, r)) { const k = pick(keys); const g = G.gold; G.gold = 1e9; const ok = tryBuild(k, c, r); G.gold = g; if (ok) return '免费建成：' + BUILD_DEFS[k].name; } } G.gold += 900; return '房间已满，改为获得 900 金币'; } },
  { id: 'u2', r: 'epic', w: 3, name: '全体强化', icon: '📈', desc: '所有炮塔免费升 1 级',
    apply: () => { let n = 0; G.buildings.forEach(b => { if (b.def.tower && b.level < b.def.maxLv) { b.level++; const nh = buildingMaxHp(b.def, b.level, b.branch); b.hp += nh - b.maxHp; b.maxHp = nh; n++; } }); if (!n) { G.gold += 1200; return '没有可升级炮塔，获得 1200 金币'; } return n + ' 座炮塔集体升级！'; } },
  { id: 'd2', r: 'epic', w: 2.8, name: '铁壁升华', icon: '🧱', desc: '三扇铁门各升 1 级并满血',
    apply: () => { G.doors.forEach(d => { d.lv++; d.maxHp = (420 + 200 * (d.lv - 1)) * techVal('ironwall', 0.15) * techVal('fortress', 0.50) * ((G.prize && G.prize.hp) || 1); d.hp = d.maxHp; d.broken = false; }); return '铁门强化至 Lv.' + G.doors[0].lv; } },
  { id: 's2', r: 'epic', w: 3, name: '灵魂涌泉', icon: '🔮', desc: '获得 45 灵魂',
    apply: () => { G.souls += 45; return '获得 45 灵魂'; } },
  { id: 'db1', r: 'epic', w: 2.6, name: '火力全开', icon: '💥', desc: '本波所有炮塔伤害 +60%',
    apply: () => { G.buff.dmgBoost = 1; return '本波炮塔伤害 +60%！'; } },
  { id: 'c1', r: 'legend', w: 0.9, name: '梦境清场', icon: '🌟', desc: '立即消灭场上所有梦魇',
    apply: () => { const n = G.enemies.length; G.enemies.forEach(e => { if (!e.dead) killEnemy(e); }); return n ? '清除了 ' + n + ' 只梦魇！' : '场上无敌人，改为获得 2000 金币'; } },
  { id: 't1', r: 'legend', w: 0.75, name: '天启转职', icon: '⭐', desc: '随机一座满级建筑免费转职',
    apply: () => { const c = G.buildings.filter(b => !b.branch && b.level >= BRANCH_AT && b.def.branch); if (!c.length) { G.gold += 2500; return '无建筑可转职，改为获得 2500 金币'; } const b = pick(c); const w = pick(['a', 'b']); const g = G.gold, s = G.souls; G.gold = 1e9; G.souls = 1e9; tryBranch(b, w); G.gold = g; G.souls = s; return b.def.branch[b.branch].name + ' 诞生！'; } },
  { id: 'u3', r: 'legend', w: 0.6, name: '万物升华', icon: '🎆', desc: '所有建筑免费升 2 级',
    apply: () => { let n = 0; G.buildings.forEach(b => { for (let i = 0; i < 2 && b.level < b.def.maxLv; i++) { b.level++; n++; } const nh = buildingMaxHp(b.def, b.level, b.branch); b.hp += nh - b.maxHp; b.maxHp = nh; }); return n ? '全部建筑共提升 ' + n + ' 级！' : '无可升级建筑，获得 3000 金币'; } },
  { id: 'g3', r: 'legend', w: 0.7, name: '金山银海', icon: '🏆', desc: '获得 3500 金币',
    apply: () => { G.gold += 3500; return '获得 3500 金币'; } },
  { id: 'f1', r: 'legend', w: 0.55, name: '永恒守护', icon: '🛡️', desc: '铁门与床铺最大生命永久 +50%',
    apply: () => { G.doors.forEach(d => { d.maxHp *= 1.5; d.hp = d.maxHp; }); G.bed.maxHp *= 1.5; G.bed.hp = G.bed.maxHp; return '铁门与床铺最大生命 +50%！'; } },
];
Object.assign(ENEMY_DEFS, {
  reflector: { name: '镜面梦魇', icon: '🪞', hp: 190, speed: 36, dmg: 14, gold: 27, soul: 4, cost: 42, r: 20, color: '#e2e8f0',
    reflect: 0.28, res: { energy: 0.4, shock: 0.35 }, weak: { kinetic: 0.5 },
    tip: '反弹 28% 远程伤害给开火的炮塔' },
  thief: { name: '窃金梦魇', icon: '🦠', hp: 140, speed: 62, dmg: 9, gold: 20, soul: 3, cost: 36, r: 17, color: '#facc15',
    steal: 0.06, weak: { toxic: 0.5 }, res: { frost: 0.3 },
    tip: '每次攻击窃取你当前金币的 6%' },
  chronos: { name: '时空梦魇', icon: '⏳', hp: 230, speed: 30, dmg: 10, gold: 30, soul: 5, cost: 48, r: 22, color: '#a78bfa',
    haste: { range: 260, mul: 1.5 }, weak: { shock: 0.5 }, res: { frost: 0.45 },
    tip: '光环内友军移速 +50%' },
  nullifier: { name: '虚无梦魇', icon: '🚫', hp: 260, speed: 28, dmg: 12, gold: 32, soul: 5, cost: 52, r: 23, color: '#334155',
    nullify: { range: 230, mul: 0.45 }, weak: { energy: 0.55 }, res: { toxic: 0.45 },
    tip: '光环内炮塔伤害 -55%' },
  colossus: { name: '梦魇巨像', icon: '🗿', hp: 1500, speed: 18, dmg: 55, gold: 60, soul: 10, cost: 90, r: 34, color: '#78716c',
    phaseShield: 3, res: { kinetic: 0.3, frost: 0.3, fire: 0.3 }, weak: { shock: 0.4 },
    tip: '三段护盾，每段需打破后才能继续掉血' },
  saboteur: { name: '破坏梦魇', icon: '🔧', hp: 160, speed: 54, dmg: 26, gold: 26, soul: 4, cost: 44, r: 19, color: '#fb923c',
    targetBuilding: true, buildingBonus: 2.2, weak: { fire: 0.5 }, res: { toxic: 0.4 },
    tip: '无视铁门，直扑你的建筑' },
  adaptive: { name: '适应梦魇', icon: '🧬', hp: 210, speed: 40, dmg: 15, gold: 28, soul: 4, cost: 46, r: 21, color: '#2dd4bf',
    adapt: 0.05, res: {}, weak: { kinetic: 0.3 },
    tip: '每次受伤都会对该伤害类型产生抗性（最高 70%）' },
  brood: { name: '孵化母虫', icon: '🐝', hp: 320, speed: 24, dmg: 12, gold: 34, soul: 6, cost: 56, r: 26, color: '#84cc16',
    summon: { type: 'grunt', every: 3.2, n: 3 }, weak: { fire: 0.6, toxic: 0.4 }, res: { frost: 0.35 },
    tip: '持续孵化梦魇幼虫' },

  digger: { name: '钻地梦魇', icon: '🦔', hp: 140, speed: 30, dmg: 14, gold: 18, soul: 3, cost: 30, r: 19, color: '#a16207', burrow: true, res: { frost: 0.5 }, weak: { fire: 0.4 } },
  emp: { name: '干扰梦魇', icon: '📴', hp: 120, speed: 40, dmg: 8, gold: 22, soul: 4, cost: 34, r: 19, color: '#67e8f9', emp: { range: 200, dur: 3.5, cd: 9 }, res: { shock: 0.6 }, weak: { kinetic: 0.45 } },
  mimic: { name: '拟态梦魇', icon: '🎭', hp: 110, speed: 46, dmg: 16, gold: 20, soul: 3, cost: 30, r: 18, color: '#f0abfc', mimic: true, weak: { energy: 0.4 } },
  wraith: { name: '怨灵', icon: '👤', hp: 100, speed: 48, dmg: 11, gold: 17, soul: 3, cost: 28, r: 18, color: '#94a3b8', curse: { dur: 6, dps: 26, r: 95 }, weak: { fire: 0.5 }, res: { kinetic: 0.35 } },
  juggernaut: { name: '战争机器', icon: '🤖', hp: 900, speed: 18, dmg: 45, gold: 55, soul: 8, cost: 90, r: 30, color: '#78716c', buildingBonus: 2.2, res: { kinetic: 0.5, fire: 0.4 }, weak: { energy: 0.5 } },
  swarm: { name: '梦魇虫群', icon: '🐛', hp: 26, speed: 92, dmg: 4, gold: 4, soul: 1, cost: 8, r: 11, color: '#bef264', swarm: true, weak: { fire: 0.6 } },
  leech: { name: '寄生体', icon: '🪱', hp: 90, speed: 54, dmg: 6, gold: 16, soul: 3, cost: 26, r: 16, color: '#84cc16', parasite: { dps: 22, dur: 8 }, weak: { fire: 0.5 }, res: { frost: 0.4 } },
  warden: { name: '守望者', icon: '👁️', hp: 220, speed: 30, dmg: 12, gold: 28, soul: 4, cost: 42, r: 22, color: '#38bdf8', ward: { shield: 0.3, r: 150 }, res: { energy: 0.45 }, weak: { shock: 0.5 } },
  reaper: { name: '收割者', icon: '⚔️', hp: 260, speed: 44, dmg: 30, gold: 34, soul: 5, cost: 50, r: 23, color: '#dc2626', buildingBonus: 3.0, weak: { frost: 0.45 } },
  frostbane: { name: '霜噬兽', icon: '🐺', hp: 190, speed: 50, dmg: 18, gold: 25, soul: 4, cost: 40, r: 21, color: '#a5f3fc', freezeTower: { r: 170, dur: 4, cd: 11 }, res: { frost: 0.75 }, weak: { fire: 0.6 } },
  necromancer: { name: '死灵法师', icon: '💀', hp: 240, speed: 28, dmg: 10, gold: 36, soul: 6, cost: 52, r: 22, color: '#6b21a8', revive: { every: 7, n: 3 }, res: { fire: 0.5 }, weak: { energy: 0.5 } },
});
// ── 追加梦魇：全部复用引擎既有机制字段，不需要新增战斗/渲染逻辑。
//    敌人是按 def.color + def.icon 泛化绘制的，加进来即生效，图鉴也会自动收录。 ──
Object.assign(ENEMY_DEFS, {
  rustbug: { name: '锈蚀梦魇', icon: '⚙️', hp: 240, speed: 32, dmg: 20, gold: 30, soul: 4, cost: 46, r: 21, color: '#c9a227',
    buildingBonus: 1.6, res: { kinetic: 0.5, fire: 0.3 }, weak: { shock: 0.5 },
    tip: '建筑克星：对建筑造成 1.6 倍伤害，优先扑向炮塔' },
  owl: { name: '夜枭梦魇', icon: '🦉', hp: 150, speed: 74, dmg: 12, gold: 24, soul: 4, cost: 40, r: 16, color: '#a78bfa',
    flying: true, stealth: true, res: { fire: 0.35 }, weak: { kinetic: 0.5 },
    tip: '隐身飞行，无视铁门 —— 需要侦察兵或范围伤害才能稳稳处理' },
  echo: { name: '回响梦魇', icon: '🔊', hp: 260, speed: 38, dmg: 14, gold: 28, soul: 5, cost: 48, r: 22, color: '#7dd3fc',
    split: 2, res: { shock: 0.4 }, weak: { toxic: 0.5 },
    tip: '死亡后分裂成两只梦魇，别用单体高伤硬拆' },
  weaver: { name: '织梦者', icon: '🕸️', hp: 300, speed: 26, dmg: 11, gold: 34, soul: 6, cost: 56, r: 24, color: '#e2e8f0',
    ward: { shield: 0.35, r: 160 }, res: { energy: 0.45 }, weak: { fire: 0.45 },
    tip: '为周围友军持续叠加护盾，优先集火' },
});
const BOSS_DEFS = {
  lord: {
    name: '梦魇领主', icon: '😈', hp: 2200, speed: 22, dmg: 65, gold: 170, soul: 24, r: 38, color: '#ff4d6d',
    phases: [
      { at: 1.0, name: '第一阶段', res: {}, speed: 1, dmg: 1 },
      { at: 0.6, name: '第二阶段', res: { kinetic: 0.35, frost: 0.35 }, speed: 1.15, dmg: 1.2, summon: { type: 'grunt', every: 3.5, n: 3 } },
      { at: 0.3, name: '狂暴阶段', res: { kinetic: 0.5, frost: 0.5, fire: 0.3 }, speed: 1.7, dmg: 1.6, aura: true },
    ],
  },
  abyss: {
    name: '深渊巨口', icon: '🦑', hp: 3400, speed: 20, dmg: 80, gold: 260, soul: 34, r: 42, color: '#7c3aed',
    devour: true, buildingBonus: 2.5,
    phases: [
      { at: 1.0, name: '潜伏', res: {}, speed: 1, dmg: 1 },
      { at: 0.65, name: '吞噬', res: { kinetic: 0.3 }, speed: 1.2, dmg: 1.3, summon: { type: 'swarm', every: 3, n: 4 } },
      { at: 0.3, name: '深渊', res: { kinetic: 0.45, fire: 0.4 }, speed: 1.6, dmg: 1.7, aura: true },
    ],
  },
  machine: {
    name: '机械核心', icon: '🛰️', hp: 4200, speed: 16, dmg: 70, gold: 320, soul: 40, r: 40, color: '#64748b',
    emp: { range: 320, dur: 3, cd: 8 }, buildingBonus: 1.8,
    phases: [
      { at: 1.0, name: '启动', res: { kinetic: 0.4 }, speed: 1, dmg: 1 },
      { at: 0.7, name: '干扰', res: { kinetic: 0.5, shock: 0.6 }, speed: 1.1, dmg: 1.2, summon: { type: 'swarm', every: 2.5, n: 5 } },
      { at: 0.35, name: '过载', res: { kinetic: 0.6, shock: 0.5 }, speed: 1.5, dmg: 1.8, aura: true },
    ],
  },
  void: {
    name: '虚空之影', icon: '🌑', hp: 5200, speed: 26, dmg: 85, gold: 420, soul: 52, r: 40, color: '#312e81',
    stealth: true, devour: true,
    phases: [
      { at: 1.0, name: '隐匿', res: { kinetic: 0.5 }, speed: 1.2, dmg: 1 },
      { at: 0.7, name: '显形', res: { kinetic: 0.4, fire: 0.4 }, speed: 1.3, dmg: 1.3, summon: { type: 'phantom', every: 3, n: 3 } },
      { at: 0.35, name: '虚空', res: { kinetic: 0.55, frost: 0.5 }, speed: 1.8, dmg: 1.9, aura: true },
    ],
  },
  final: {
    name: '终焉梦魇', icon: '👁️‍🗨️', hp: 12000, speed: 24, dmg: 120, gold: 1200, soul: 150, r: 50, color: '#b91c1c',
    devour: true, emp: { range: 400, dur: 2.5, cd: 7 }, buildingBonus: 3, finalBoss: true,
    phases: [
      { at: 1.0, name: '启示', res: { kinetic: 0.3 }, speed: 1.1, dmg: 1 },
      { at: 0.75, name: '灾厄', res: { kinetic: 0.45, frost: 0.4 }, speed: 1.25, dmg: 1.3, summon: { type: 'juggernaut', every: 6, n: 1 } },
      { at: 0.5, name: '湮灭', res: { kinetic: 0.55, fire: 0.5 }, speed: 1.5, dmg: 1.6, summon: { type: 'reaper', every: 5, n: 2 } },
      { at: 0.2, name: '终焉', res: { kinetic: 0.65, frost: 0.6, fire: 0.55, energy: 0.4 }, speed: 2.0, dmg: 2.2, aura: true },
    ],
  },
};
const BOSS_ORDER = ['lord', 'abyss', 'machine', 'void'];
const FINAL_WAVE = 60;
const RUNE_QUALITY = [
  { id: 'common',   name: '普通', color: '#9ca3af', n: 1, mul: 1.00, w: 44 },
  { id: 'uncommon', name: '精良', color: '#4ade80', n: 2, mul: 1.55, w: 28 },
  { id: 'rare',     name: '稀有', color: '#38bdf8', n: 2, mul: 2.30, w: 16 },
  { id: 'epic',     name: '史诗', color: '#c084fc', n: 3, mul: 3.30, w: 9  },
  { id: 'legend',   name: '传说', color: '#fbbf24', n: 4, mul: 4.60, w: 3  },
];
const qualityOf = id => RUNE_QUALITY.find(q => q.id === id) || RUNE_QUALITY[0];
const RUNE_AFFIXES = {
  dmg:     { name: '伤害',     icon: '💥', base: 7,  apply: (s, v) => { if (s.dmg != null) s.dmg *= 1 + v / 100; } },
  rate:    { name: '射速',     icon: '⏩', base: 6,  apply: (s, v) => { if (s.rate != null) s.rate *= 1 + v / 100; } },
  range:   { name: '射程',     icon: '🎯', base: 5,  apply: (s, v) => { if (s.range != null) s.range *= 1 + v / 100; } },
  crit:    { name: '暴击率',   icon: '✨', base: 4,  apply: (s, v) => { s.crit = (s.crit || 0) + v / 100; } },
  critDmg: { name: '暴击伤害', icon: '💫', base: 16, apply: (s, v) => { s.critDmg = (s.critDmg || 2.2) + v / 100; } },
  pierce:  { name: '穿透',     icon: '➡️', base: 1,  apply: (s, v) => { if (s.pierce != null) s.pierce += v; } },
  slow:    { name: '减速',     icon: '❄️', base: 5,  apply: (s, v) => { if (s.slow != null) s.slow = Math.min(0.85, s.slow + v / 100); } },
  gold:    { name: '金币产出', icon: '💰', base: 11, apply: (s, v) => { if (s.gold != null) s.gold *= 1 + v / 100; } },
  regen:   { name: '发电量',   icon: '⚡', base: 13, apply: (s, v) => { if (s.regen != null) s.regen *= 1 + v / 100; } },
};
const RUNE_AFFIX_KEYS = Object.keys(RUNE_AFFIXES);
const RUNE_NAMES = ['梦境','深渊','星辰','雷霆','寒霜','烈焰','虚空','命运','永恒','混沌',
                    '曙光','黄昏','苍穹','幽冥','太初','玄黄','九霄','黄泉','碧落','洪荒'];
let runeSeq = 1;
function rollRune(wave, forceQ) {
  const boost = Math.min(3, Math.floor((wave || 1) / 12));
  const pool = RUNE_QUALITY.map(q => ({
    q, w: q.w * (q.id === 'common' ? Math.max(0.2, 1 - boost * 0.3) : 1 + boost * 0.55),
  }));
  let total = pool.reduce((a, b) => a + b.w, 0), r = Math.random() * total, q = RUNE_QUALITY[0];
  for (const p of pool) { r -= p.w; if (r <= 0) { q = p.q; break; } }
  // forceQ：指定品质（深层梦境奖励等"保底符文"用），不传则按波次权重随机
  if (forceQ) q = RUNE_QUALITY.find(x => x.id === forceQ) || q;
  const keys = RUNE_AFFIX_KEYS.slice(), affixes = [];
  for (let i = 0; i < q.n && keys.length; i++) {
    const k = keys.splice(Math.floor(Math.random() * keys.length), 1)[0];
    affixes.push({ k, v: Math.round(RUNE_AFFIXES[k].base * q.mul * (0.7 + Math.random() * 0.6) * 10) / 10 });
  }
  return { id: 'r' + (runeSeq++), lv: 0, q: q.id,
    name: RUNE_NAMES[Math.floor(Math.random() * RUNE_NAMES.length)] + '符文', affixes };
}
const runeMul = r => 1 + (r.lv || 0) * 0.12;
const affixVal = (r, a) => Math.round(a.v * runeMul(r) * 10) / 10;
const runeUpCost = r => 20 + (r.lv + 1) * 18;
const runeSalvage = r => 8 + r.lv * 6 + RUNE_QUALITY.findIndex(q => q.id === r.q) * 12;
const CHALLENGES = [
  { id: 'swift',  name: '疾风清场', icon: '⚡', minWave: 3, track: 'time',      cmp: 'le',
    target: w => Math.max(20, 50 - w * 0.5), desc: w => Math.round(Math.max(20, 50 - w * 0.5)) + ' 秒内清空本波' },
  { id: 'intact', name: '铁壁无损', icon: '🚪', minWave: 3, track: 'doorDmg',   cmp: 'le',
    target: () => 0, desc: () => '本波铁门不受到任何伤害' },
  { id: 'noloss', name: '秋毫无犯', icon: '🧱', minWave: 4, track: 'buildLost', cmp: 'le',
    target: () => 0, desc: () => '本波不损失任何建筑' },
  { id: 'fire',   name: '烈焰专精', icon: '🔥', minWave: 6, track: 'killFire',  cmp: 'ge',
    target: w => 10 + Math.floor(w / 2), desc: w => '用火焰伤害击杀 ' + (10 + Math.floor(w / 2)) + ' 个梦魇' },
  { id: 'silent', name: '静默作战', icon: '🤫', minWave: 5, track: 'skillUsed', cmp: 'le',
    target: () => 0, desc: () => '不使用任何技能清空本波' },
  { id: 'combo',  name: '连环斩杀', icon: '🗡️', minWave: 8, track: 'maxCombo',  cmp: 'ge',
    target: w => 8 + Math.floor(w / 3), desc: w => '达成 ' + (8 + Math.floor(w / 3)) + ' 连杀' },
];
function rollChallenge(wave) {
  const pool = CHALLENGES.filter(c => wave >= c.minWave);
  if (!pool.length) return null;
  const c = pool[Math.floor(Math.random() * pool.length)];
  return { id: c.id, def: c, target: c.target(wave), prog: 0, done: false };
}
const challengeRewardSouls = w => 12 + w * 3;
const DIFFS = {
  normal: {
    name: '正常', icon: '🌙', cost: 0, reward: 1,
    hpMul: 1, dmgMul: 1, goldMul: 1, soulMul: 1, spawnMul: 1, prepMul: 1,
    desc: '标准梦魇强度', tip: '适合第一次入梦',
  },
  hard: {
    name: '困难', icon: '🔥', cost: 0, reward: 2.2,
    hpMul: 1.75, dmgMul: 1.4, goldMul: 0.85, soulMul: 1.2, spawnMul: 1.15, prepMul: 0.85,
    desc: '血更厚 · 打更疼', tip: '结算金币 x2.2',
  },
  hell: {
    name: '地狱', icon: '💀', cost: 0, reward: 4,
    hpMul: 2.9, dmgMul: 1.9, goldMul: 0.7, soulMul: 1.5, spawnMul: 1.35, prepMul: 0.7,
    desc: '极度残酷', tip: '结算金币 x4',
  },
  admin: {
    name: '管理员', icon: '👑', cost: 2000, reward: 0, admin: true,
    hpMul: 1, dmgMul: 1, goldMul: 1, soulMul: 1, spawnMul: 1, prepMul: 1,
    desc: '资源无限 · 自由跳波', tip: '每次消耗 2000 金币',
  },
};
const DIFF_KEYS = Object.keys(DIFFS);
const META_DRAW_COST = 100, META_TEN_COST = 900;
const META_PITY_EPIC = 10, META_PITY_LEGEND = 30;
const META_RARITY = {
  common: { name: '普通', color: '#9ca3af', w: 48 },
  rare: { name: '稀有', color: '#38bdf8', w: 30 },
  epic: { name: '史诗', color: '#c084fc', w: 15 },
  legend: { name: '传说', color: '#fbbf24', w: 7 },
};
const META_RARITY_ORDER = ['common', 'rare', 'epic', 'legend'];
const metaRarityOf = id => META_RARITY[id] || META_RARITY.common;
const EQUIP_SLOTS = 3;
const META_PRIZES = {
  startGold: { name: '启动资金', icon: '💰', rarity: 'common', desc: '开局 +2000 金币',
    apply: () => { G.gold += 2000; } },
  startSoul: { name: '灵魂祝福', icon: '🔮', rarity: 'common', desc: '开局 +80 灵魂',
    apply: () => { G.souls += 80; } },
  cozyBed: { name: '舒适床铺', icon: '🛏️', rarity: 'common', desc: '开局床铺 Lv3',
    apply: () => { setBedLevel(3); } },
  minerStart: { name: '熟练矿工', icon: '⛏️', rarity: 'common', desc: '开局赠送一座 Lv5 矿机',
    apply: () => { placeBuildingAt('miner', 5); } },
  freeGen: { name: '免费发电机', icon: '🔋', rarity: 'rare', desc: '开局赠送一台 Lv5 发电机',
    apply: () => { placeBuildingAt('generator', 5); } },
  ironDoor: { name: '强化铁门', icon: '🚪', rarity: 'rare', desc: '开局三扇铁门 Lv8',
    apply: () => { G.doors.forEach(d => setDoorLevel(d, 8)); } },
  randTower: { name: '随机炮塔', icon: '🎁', rarity: 'rare', desc: '开局赠送一座 Lv10 随机炮塔',
    apply: () => { placeBuildingAt(['turret', 'frost', 'laser', 'tesla', 'flame'][Math.floor(Math.random() * 5)], 10); } },
  dmgBoost: { name: '火力增幅', icon: '💥', rarity: 'epic', desc: '本局炮塔伤害 +30%',
    apply: () => { G.prize.dmg = 1.3; } },
  hpBoost: { name: '要塞加固', icon: '🧱', rarity: 'epic', desc: '本局建筑与铁门生命 +50%',
    apply: () => { G.prize.hp = 1.5; } },
  revive: { name: '梦境重生', icon: '🔁', rarity: 'epic', desc: '床被摧毁时原地满血复活一次',
    apply: () => { G.reviveLeft = 1; } },
  fastPrep: { name: '从容准备', icon: '⏳', rarity: 'epic', desc: '每波备战时间翻倍',
    apply: () => { G.prize.prep = 2; } },
  halve: { name: '减半', icon: '📉', rarity: 'legend', desc: '本局只需挺过 30 波即胜利',
    apply: () => { G.winWave = 30; } },
  doubleGain: { name: '双倍收益', icon: '🌊', rarity: 'legend', desc: '结算金币 x2',
    apply: () => { G.prize.reward = 2; } },
  freeAdmin: { name: '管理员权限', icon: '👑', rarity: 'legend', desc: '本局资源无限，且不扣 2000 金币',
    apply: () => { G.admin = true; G.prize.freeAdmin = true; } },
};
const META_PRIZE_KEYS = Object.keys(META_PRIZES);
const MODES = {
  limited: {
    name: '有限模式', icon: '⏳',
    desc: '有始有终 — 第 ' + 60 + ' 波通关，或床铺被摧毁即结束',
    tip: '结束后本局彻底终结，返回主界面',
  },
  unlimited: {
    name: '无限模式', icon: '♾️',
    desc: '永不结束 — 床铺被摧毁会自动重构，通关后继续',
    tip: '一直发育下去，看能撑到第几波',
  },
};
const MODE_KEYS = Object.keys(MODES);

/* ============================================================
 *  元素反应 —— 不同伤害类型命中同一梦魇触发连锁效果
 * ============================================================ */
const REACTIONS = {
  steam: { id: 'steam', name: '蒸汽爆破', icon: '💨', pair: ['fire', 'frost'], color: '#e0f2fe',
    desc: '火焰 + 冰霜 → 瞬间汽化，造成一次额外伤害' },
  overload: { id: 'overload', name: '过载爆轰', icon: '💥', pair: ['shock', 'fire'], color: '#fbbf24',
    desc: '电磁 + 火焰 → 引燃过载，小范围爆炸' },
  toxiburn: { id: 'toxiburn', name: '剧毒燃烧', icon: '☠️', pair: ['toxic', 'fire'], color: '#a3e635',
    desc: '剧毒 + 火焰 → 毒层翻倍并持续灼烧' },
  superduct: { id: 'superduct', name: '超导易伤', icon: '⚡', pair: ['frost', 'shock'], color: '#67e8f9',
    desc: '冰霜 + 电磁 → 躯体超导，受到伤害提升' },
  crystal: { id: 'crystal', name: '寒霜结晶', icon: '🧊', pair: ['toxic', 'frost'], color: '#bae6fd',
    desc: '剧毒 + 冰霜 → 毒素结晶，定身梦魇' },
  corrode: { id: 'corrode', name: '能量腐蚀', icon: '🧬', pair: ['energy', 'toxic'], color: '#f0abfc',
    desc: '能量 + 剧毒 → 腐蚀躯体，永久降低全抗性' },
};
const REACTION_PAIRS = (function () {
  const m = {};
  Object.values(REACTIONS).forEach(r => { m[r.pair.slice().sort().join('+')] = r; });
  return m;
})();
function findReaction(a, b) { return REACTION_PAIRS[[a, b].sort().join('+')] || null; }

/* ============================================================
 *  炮塔共鸣 —— 相邻不同元素的炮塔互相增幅
 * ============================================================ */
const RESONANCE_R = 158;
const RESONANCE_TIERS = [
  // color 供画布徽记 / 详情面板使用，让「共鸣」这个隐形机制能被看见
  { n: 2, dmg: 1.12, rate: 1.00, name: '双元素共鸣', icon: '🎵', color: '#7dd3fc' },
  { n: 3, dmg: 1.26, rate: 1.10, name: '三元素共鸣', icon: '🎶', color: '#a78bfa' },
  { n: 4, dmg: 1.44, rate: 1.18, name: '四元素共鸣', icon: '🎼', color: '#f0abfc' },
  { n: 5, dmg: 1.62, rate: 1.26, name: '全谱共鸣', icon: '🌈', color: '#fbbf24' },
  { n: 6, dmg: 1.85, rate: 1.34, name: '万物共鸣', icon: '✨', color: '#fff1a8' },
];
// 特定双元素组合：额外附加效果
const RESONANCE_PAIRS = {
  'fire+kinetic': { id: 'incendiary', name: '爆燃弹药', icon: '🔥', burn: 16, desc: '攻击附加灼烧' },
  'frost+shock': { id: 'conductive', name: '导电冰霜', icon: '⚡', splash: 60, desc: '攻击附带小范围溅射' },
  'energy+toxic': { id: 'corrosive', name: '腐蚀光斑', icon: '🧬', shred: 0.5, desc: '攻击削减敌人抗性' },
  'fire+toxic': { id: 'venomflame', name: '毒焰', icon: '☠️', poison: 1, poisonDps: 12, desc: '攻击附加毒层' },
  'frost+kinetic': { id: 'shatter', name: '碎冰弹', icon: '🧊', stunChance: 0.25, desc: '概率定身' },
  'energy+shock': { id: 'arcfield', name: '弧光场', icon: '🌩️', chain: 1, desc: '攻击额外弹射一个目标' },
};
