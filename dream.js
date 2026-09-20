/**
 * dream.js — 梦境系统引擎
 * 「躺平发育：梦魇防线」扩展系统
 *
 * 包含：事件总线、梦境生态、中立生物、NPC驻守、第四面墙、
 *       梦中梦、声音系统、不战而胜、记忆碎片、梦境日记
 *
 * 所有系统通过 EventBus 通信，与 core.js 的 game loop 兼容。
 * 调用方式：在 step() 中加入 DreamEngine.tick(dt) 即可。
 */

'use strict';

/* ============================================================
 *  1. 事件系统 EventBus
 *  简单的发布-订阅模式，供所有新系统通信
 * ============================================================ */

const EventBus = {
  /** @type {Object<string, Function[]>} 事件处理器映射 */
  _handlers: {},

  /**
   * 订阅事件
   * @param {string} event - 事件名称
   * @param {Function} fn - 回调函数
   */
  on(event, fn) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(fn);
  },

  /**
   * 一次性订阅
   * @param {string} event - 事件名称
   * @param {Function} fn - 回调函数
   */
  once(event, fn) {
    const wrap = (data) => { this.off(event, wrap); fn(data); };
    this.on(event, wrap);
  },

  /**
   * 取消订阅
   * @param {string} event - 事件名称
   * @param {Function} fn - 要移除的回调函数
   */
  off(event, fn) {
    const list = this._handlers[event];
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
  },

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {*} data - 传递给回调的数据
   */
  emit(event, data) {
    const list = this._handlers[event];
    if (list) list.forEach(fn => { try { fn(data); } catch (e) { console.warn('[EventBus]', event, e); } });
  },

  /**
   * 清除所有事件监听
   */
  clear() {
    this._handlers = {};
  },
};


/* ============================================================
 *  2. 梦境生态 DreamEcology
 *  管理敌人之间的交互关系
 * ============================================================ */

const DreamEcology = {
  /** @type {Object|null} 生态状态 */
  _state: null,

  /**
   * 初始化生态状态
   */
  initEcology() {
    this._state = {
      /** @type {Map<string, object>} 每个敌人的生态效果缓存 */
      effects: new Map(),
      /** @type {number} 计时器，用于低频更新 */
      tickTimer: 0,
    };
    EventBus.emit('ecology:init', null);
  },

  /**
   * 每帧处理敌人交互
   * 治疗型 → 治疗友方；召唤型小怪 + 火焰型 → 范围伤害；
   * 精英 → 给周围小怪加 buff；梦魇型 → 互相增幅
   * @param {object[]} enemies - 当前场上敌人数组 (G.enemies)
   * @param {number} dt - 帧间隔（秒）
   */
  processEcologyTick(enemies, dt) {
    if (!this._state) return;
    // 低频更新：每 0.5 秒计算一次，减少性能开销
    this._state.tickTimer += dt;
    if (this._state.tickTimer < 0.5) return;
    this._state.tickTimer -= 0.5;
    this._state.effects.clear();

    const alive = enemies.filter(e => !e.dead);
    if (!alive.length) return;

    for (const e of alive) {
      const chain = [];
      const eDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

      // 治疗型敌人：治疗周围友方
      if (e.def && e.def.heal) {
        for (const o of alive) {
          if (o === e || o.dead) continue;
          if (eDist(e, o) < 120 && o.hp < o.maxHp) {
            chain.push({ type: 'heal', target: o.type, amount: e.def.heal });
          }
        }
      }

      // 召唤型 + 火焰型交互：召唤小怪被火焰点燃造成范围伤害
      if (e.def && e.def.summon) {
        for (const o of alive) {
          if (o === e || o.dead) continue;
          // 火焰型敌人（burn 字段或 fire 属性）在附近时引燃召唤物
          if (o.burn > 0 || (o.def && o.def.burnDmg)) {
            if (eDist(e, o) < 160) {
              chain.push({ type: 'ignite', source: o.type, aoeRadius: 100 });
            }
          }
        }
      }

      // 精英敌人：给周围小怪加 buff
      if (e.elite) {
        let buffCount = 0;
        for (const o of alive) {
          if (o === e || o.dead || o.elite || o.boss) continue;
          if (eDist(e, o) < 200) buffCount++;
        }
        if (buffCount > 0) {
          chain.push({ type: 'eliteAura', buffed: buffCount, bonus: 0.15 });
        }
      }

      // 梦魇型（普通 grunt）之间互相增幅
      if (e.type === 'grunt') {
        let nearbyCount = 0;
        for (const o of alive) {
          if (o === e || o.dead) continue;
          if (o.type === 'grunt' && eDist(e, o) < 100) nearbyCount++;
        }
        if (nearbyCount > 0) {
          chain.push({ type: 'swarmBoost', nearby: nearbyCount, speedBonus: nearbyCount * 0.04 });
        }
      }

      if (chain.length > 0) {
        this._state.effects.set(e, chain);
      }
    }

    // 触发生态事件
    if (this._state.effects.size > 0) {
      EventBus.emit('ecology:tick', this._state.effects);
    }
  },

  /**
   * 获取敌人当前生态效果链
   * @param {object} enemy - 单个敌人对象
   * @returns {object[]} 生态效果数组
   */
  getEcologyChain(enemy) {
    if (!this._state) return [];
    return this._state.effects.get(enemy) || [];
  },
};


/* ============================================================
 *  3. 中立生物 NeutralCreatures
 *  房间内随机生成的中立生物
 * ============================================================ */

const NeutralCreatures = {
  /** @type {object[]} 当前存活的中立生物 */
  _creatures: [],

  /** 中立生物定义 */
  TYPES: {
    firefly: {
      name: '萤火虫', icon: '🪲', color: '#a3e635',
      /** 效果：提高附近建筑攻击速度 */
      effect: 'atkSpeedBuff',
      buffRange: 160,
      buffAmount: 0.12,   // +12% 攻速
      lifetime: 40,       // 存活秒数
      spawnWeight: 50,
    },
    spirit: {
      name: '梦境精灵', icon: '🧚', color: '#c084fc',
      /** 效果：被保护 3 波后给奖励 */
      effect: 'waveGuard',
      guardWaves: 3,
      reward: { gold: 300, soul: 15 },
      lifetime: Infinity,
      spawnWeight: 30,
    },
    shadowCat: {
      name: '影子猫', icon: '🐈‍⬛', color: '#64748b',
      /** 效果：偷金币，但保护后给稀有道具 */
      effect: 'stealAndReward',
      stealRate: 2,       // 每秒偷 2 金币
      protectWaves: 5,
      reward: { gold: 500, soul: 30 },
      lifetime: Infinity,
      spawnWeight: 20,
    },
  },

  /**
   * 在房间内生成中立生物
   * @param {object} room - 房间信息（使用 G 的网格数据）
   * @returns {object|null} 生成的生物对象，或 null
   */
  spawnNeutral() {
    if (typeof G === 'undefined' || typeof COLS === 'undefined' || typeof ROWS === 'undefined') return null;
    // 收集所有空格
    const empty = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!G.grid[r * COLS + c]) empty.push({ c, r });
    }
    if (!empty.length) return null;

    const types = Object.keys(this.TYPES);
    const totalWeight = types.reduce((s, k) => s + this.TYPES[k].spawnWeight, 0);
    let rnd = Math.random() * totalWeight;
    let chosen = types[0];
    for (const k of types) {
      rnd -= this.TYPES[k].spawnWeight;
      if (rnd <= 0) { chosen = k; break; }
    }
    const def = this.TYPES[chosen];
    const spot = empty[Math.floor(Math.random() * empty.length)];
    const pos = typeof cellCenter === 'function' ? cellCenter(spot.c, spot.r)
      : { x: 380 + spot.c * 110 + 55, y: 66 + spot.r * 98 + 49 };

    const creature = {
      id: 'neutral_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      type: chosen,
      def,
      x: pos.x,
      y: pos.y,
      col: spot.c,
      row: spot.r,
      alive: true,
      age: 0,
      wavesProtected: 0,
      stealAccum: 0,
      rewarded: false,
      bobPhase: Math.random() * Math.PI * 2,
    };

    this._creatures.push(creature);
    EventBus.emit('neutral:spawn', creature);
    return creature;
  },

  /**
   * 每帧处理中立生物行为
   * @param {number} dt - 帧间隔（秒）
   */
  processNeutralTick(dt) {
    for (let i = this._creatures.length - 1; i >= 0; i--) {
      const c = this._creatures[i];
      if (!c.alive) { this._creatures.splice(i, 1); continue; }

      c.age += dt;
      c.bobPhase += dt * 2.5;

      // 影子猫偷金币
      if (c.def.effect === 'stealAndReward' && typeof G !== 'undefined' && G.gold > 0) {
        c.stealAccum += c.def.stealRate * dt;
        if (c.stealAccum >= 1) {
          const steal = Math.floor(c.stealAccum);
          c.stealAccum -= steal;
          G.gold = Math.max(0, G.gold - steal);
        }
      }

      // 超过生命时间则消失
      if (c.def.lifetime !== Infinity && c.age >= c.def.lifetime) {
        c.alive = false;
        EventBus.emit('neutral:expire', c);
      }
    }
  },

  /**
   * 波次结束时调用：检查中立生物的波次保护进度
   */
  onWaveEnd() {
    for (const c of this._creatures) {
      if (!c.alive) continue;
      c.wavesProtected++;

      // 梦境精灵：保护 3 波后给奖励
      if (c.def.effect === 'waveGuard' && c.wavesProtected >= c.def.guardWaves && !c.rewarded) {
        c.rewarded = true;
        if (typeof G !== 'undefined') {
          G.gold += c.def.reward.gold;
          G.souls += c.def.reward.soul;
        }
        EventBus.emit('neutral:reward', { creature: c, reward: c.def.reward });
        c.alive = false; // 完成使命后消失
      }

      // 影子猫：保护足够波次后给稀有奖励
      if (c.def.effect === 'stealAndReward' && c.wavesProtected >= c.def.protectWaves && !c.rewarded) {
        c.rewarded = true;
        if (typeof G !== 'undefined') {
          G.gold += c.def.reward.gold;
          G.souls += c.def.reward.soul;
        }
        EventBus.emit('neutral:reward', { creature: c, reward: c.def.reward });
        c.alive = false;
      }
    }
  },

  /**
   * 获取当前所有中立生物
   * @returns {object[]}
   */
  getCreatures() {
    return this._creatures.filter(c => c.alive);
  },

  /**
   * 检查萤火虫对指定建筑的攻速加成
   * @param {object} building - 建筑对象
   * @returns {number} 攻速倍率加成（0 表示无加成）
   */
  getFireflyBuff(building) {
    let bonus = 0;
    for (const c of this._creatures) {
      if (!c.alive || c.type !== 'firefly') continue;
      const d = Math.hypot(c.x - building.x, c.y - building.y);
      if (d <= c.def.buffRange) bonus += c.def.buffAmount;
    }
    return bonus;
  },
};


/* ============================================================
 *  4. NPC驻守系统 NPCGuardians
 *  管理梦境居民 NPC
 * ============================================================ */

const NPCGuardians = {
  /** @type {object[]} 所有 NPC 定义 */
  NPC_DATA: [
    {
      id: 'healer_npc',
      name: '梦境医师',
      icon: '💊',
      desc: '持续治疗房间内生命最低的建筑',
      ability: 'heal',
      abilityValue: 15,     // 每秒治疗量
      abilityRange: 400,
    },
    {
      id: 'warrior_npc',
      name: '梦境战士',
      icon: '⚔️',
      desc: '提升房间内所有炮塔伤害',
      ability: 'atkBoost',
      abilityValue: 0.18,   // +18% 伤害
      abilityRange: 350,
    },
    {
      id: 'frost_mage',
      name: '寒霜法师',
      icon: '🧙',
      desc: '减速进入房间的敌人',
      ability: 'slowEnemy',
      abilityValue: 0.25,   // 25% 减速
      abilityRange: 300,
    },
    {
      id: 'merchant',
      name: '行商',
      icon: '🧳',
      desc: '每波结束额外产出金币',
      ability: 'goldGen',
      abilityValue: 80,     // 每波额外金币
      abilityRange: 0,
    },
    {
      id: 'guardian',
      name: '护盾守卫',
      icon: '🛡️',
      desc: '为铁门和床铺附加护盾',
      ability: 'shield',
      abilityValue: 40,     // 护盾值/秒
      abilityRange: 500,
    },
    {
      id: 'scout',
      name: '侦察兵',
      icon: '🔭',
      desc: '揭示隐身敌人并标记精英',
      ability: 'reveal',
      abilityValue: 200,    // 揭示范围
      abilityRange: 600,
    },
  ],

  /** @type {object[]} 已招募的 NPC 实例 */
  _recruited: [],

  /** NPC 关系网：两个 NPC 相邻时的羁绊/冲突 */
  SYNERGIES: [
    { pair: ['healer_npc', 'guardian'], type: 'bond', name: '坚不可摧', bonus: { healBoost: 0.3, shieldBoost: 0.2 } },
    { pair: ['warrior_npc', 'scout'], type: 'bond', name: '先发制人', bonus: { atkBoost: 0.1, revealDmg: 0.15 } },
    { pair: ['frost_mage', 'warrior_npc'], type: 'bond', name: '冰火交融', bonus: { slowBoost: 0.1, atkBoost: 0.08 } },
    { pair: ['merchant', 'scout'], type: 'bond', name: '情报贩子', bonus: { goldBoost: 0.2 } },
    { pair: ['healer_npc', 'frost_mage'], type: 'conflict', name: '元素冲突', penalty: { healReduce: 0.15, slowReduce: 0.1 } },
    { pair: ['merchant', 'guardian'], type: 'conflict', name: '理念不合', penalty: { goldReduce: 0.1, shieldReduce: 0.1 } },
  ],

  /**
   * 初始化 NPC 系统
   */
  initNPCs() {
    this._recruited = [];
    EventBus.emit('npc:init', null);
  },

  /**
   * 招募 NPC 到指定房间
   * @param {string} npcId - NPC 定义 ID
   * @param {string} roomId - 房间/区域标识（如 'lane_0', 'lane_1', 'lane_2'）
   * @returns {object|null} 招募的 NPC 实例，或 null
   */
  recruitNPC(npcId, roomId) {
    const def = this.NPC_DATA.find(n => n.id === npcId);
    if (!def) return null;
    // 同一房间同类型 NPC 不可重复
    if (this._recruited.some(n => n.def.id === npcId && n.roomId === roomId)) return null;

    const npc = {
      id: npcId + '_' + Date.now(),
      def,
      roomId,
      active: true,
      cooldown: 0,
    };
    this._recruited.push(npc);
    EventBus.emit('npc:recruit', npc);
    return npc;
  },

  /**
   * 按剧情里的人格名招募（story.js NPC_DIALOG 的 name → abilityId → NPC_DATA）
   * 剧情选项写「守梦者·艾拉驻守」时由 applyStoryEffect 调用，保证「说到做到」
   * @param {string} name - 剧情里的 NPC 名（可部分匹配）
   * @returns {string|null} 实际驻守者的名字，或 null
   */
  recruitByName(name) {
    if (!name || typeof NPC_DIALOG === 'undefined') return null;
    const entry = NPC_DIALOG.find(d => d && d.name && (d.name === name || d.name.indexOf(name) >= 0 || name.indexOf(d.name) >= 0));
    if (!entry || !entry.abilityId) return null;
    const def = this.NPC_DATA.find(n => n.id === entry.abilityId);
    if (!def) return null;
    if (this._recruited.some(n => n.def.id === def.id)) return entry.name || def.name;
    const rooms = ['lane_0', 'lane_1', 'lane_2'];
    const used = this._recruited.map(n => n.roomId);
    const room = rooms.find(r => used.indexOf(r) < 0) || 'lane_0';
    const npc = this.recruitNPC(def.id, room);
    return npc ? (entry.name || def.name) : null;
  },

  /**
   * 每帧处理 NPC 能力
   * @param {number} dt - 帧间隔（秒）
   */
  processNPCTick(dt) {
    if (typeof G === 'undefined') return;
    for (const npc of this._recruited) {
      if (!npc.active) continue;
      npc.cooldown -= dt;
      if (npc.cooldown > 0) continue;
      npc.cooldown = 1; // 每秒执行一次能力

      const buffs = this._getSynergyBuffs(npc);
      const roomBuildings = this._getBuildingsInRoom(npc.roomId);

      switch (npc.def.ability) {
        case 'heal': {
          // 治疗房间内生命最低的建筑
          const healAmt = npc.def.abilityValue * (1 + (buffs.healBoost || 0));
          let weakest = null, minHp = Infinity;
          for (const b of roomBuildings) {
            if (b.hp < b.maxHp && b.hp < minHp) { minHp = b.hp; weakest = b; }
          }
          if (weakest) {
            weakest.hp = Math.min(weakest.maxHp, weakest.hp + healAmt);
            EventBus.emit('npc:heal', { npc, target: weakest, amount: healAmt });
          }
          break;
        }
        case 'atkBoost': {
          // 被动增益，通过 getNPCBuffs 查询
          break;
        }
        case 'slowEnemy': {
          const slowAmt = npc.def.abilityValue * (1 + (buffs.slowBoost || 0));
          for (const e of G.enemies) {
            if (e.dead) continue;
            const laneIdx = parseInt(npc.roomId.replace('lane_', ''), 10);
            if (e.lane === laneIdx && e.state === 'room') {
              e.slow = Math.max(e.slow || 0, slowAmt);
              e.slowT = Math.max(e.slowT || 0, 0.5);
            }
          }
          break;
        }
        case 'goldGen': {
          // 波次结束时通过 onWaveEnd 处理
          break;
        }
        case 'shield': {
          const shieldAmt = npc.def.abilityValue * (1 + (buffs.shieldBoost || 0));
          for (const d of G.doors) {
            if (d.lane === parseInt(npc.roomId.replace('lane_', ''), 10)) {
              d.shieldMax = Math.max(d.shieldMax || 0, shieldAmt);
              d.shield = Math.min(d.shieldMax, (d.shield || 0) + shieldAmt * 0.3);
            }
          }
          break;
        }
        case 'reveal': {
          const range = npc.def.abilityValue;
          for (const e of G.enemies) {
            if (e.dead) continue;
            // 使隐身敌人显形
            if (e.def && (e.def.stealth || e.def.mimic)) {
              const laneIdx = parseInt(npc.roomId.replace('lane_', ''), 10);
              if (e.lane === laneIdx) {
                e.untargetable = false;
                e.alpha = 1;
                e.mimicRevealed = true;
              }
            }
          }
          break;
        }
      }
    }
  },

  /**
   * 波次结束时调用
   */
  onWaveEnd() {
    if (typeof G === 'undefined') return;
    for (const npc of this._recruited) {
      if (!npc.active) continue;
      if (npc.def.ability === 'goldGen') {
        const buffs = this._getSynergyBuffs(npc);
        const gold = Math.round(npc.def.abilityValue * (1 + (buffs.goldBoost || 0)));
        G.gold += gold;
        EventBus.emit('npc:goldGen', { npc, gold });
      }
    }
  },

  /**
   * 获取指定房间 NPC 提供的增益效果总和
   * @param {string} roomId - 房间 ID
   * @returns {object} 增益对象 { atkBoost, slowEnemy, reveal }
   */
  getNPCBuffs(roomId) {
    const result = { atkBoost: 0, slowEnemy: 0, reveal: false };
    for (const npc of this._recruited) {
      if (!npc.active || npc.roomId !== roomId) continue;
      const buffs = this._getSynergyBuffs(npc);
      switch (npc.def.ability) {
        case 'atkBoost':
          result.atkBoost += npc.def.abilityValue + (buffs.atkBoost || 0);
          break;
        case 'slowEnemy':
          result.slowEnemy += npc.def.abilityValue + (buffs.slowBoost || 0);
          break;
        case 'reveal':
          result.reveal = true;
          break;
      }
    }
    return result;
  },

  /**
   * 获取 NPC 与同房间其他 NPC 的羁绊/冲突加成
   * @param {object} npc - NPC 实例
   * @returns {object} 合并后的 buff 对象
   * @private
   */
  _getSynergyBuffs(npc) {
    const result = {};
    const roomMates = this._recruited.filter(n => n.active && n.roomId === npc.roomId && n !== npc);
    for (const mate of roomMates) {
      for (const syn of this.SYNERGIES) {
        const pairSet = new Set(syn.pair);
        if (pairSet.has(npc.def.id) && pairSet.has(mate.def.id)) {
          if (syn.type === 'bond' && syn.bonus) {
            for (const k in syn.bonus) result[k] = (result[k] || 0) + syn.bonus[k];
          }
          // 冲突：施加惩罚（负值）
          if (syn.type === 'conflict' && syn.penalty) {
            for (const k in syn.penalty) {
              const buffKey = k.replace('Reduce', 'Boost');
              result[buffKey] = (result[buffKey] || 0) - syn.penalty[k];
            }
          }
        }
      }
    }
    return result;
  },

  /**
   * 获取房间内属于指定 lane 的建筑
   * @param {string} roomId - 如 'lane_0'
   * @returns {object[]}
   * @private
   */
  _getBuildingsInRoom(roomId) {
    if (typeof G === 'undefined') return [];
    const laneIdx = parseInt(roomId.replace('lane_', ''), 10);
    if (isNaN(laneIdx)) return G.buildings || [];
    // 按行过滤：lane_0=row0, lane_1=row1, lane_2=row2
    return (G.buildings || []).filter(b => b.row === laneIdx);
  },

  /**
   * 获取已招募 NPC 列表
   * @returns {object[]}
   */
  getRecruited() {
    return this._recruited;
  },
};


/* ============================================================
 *  5. 第四面墙系统 FourthWall
 *  管理打破第四面墙的效果
 * ============================================================ */

const FourthWall = {
  /** @type {object} 当前状态 */
  _state: null,

  /** 已触发过的波次，防止重复触发 */
  _triggeredWaves: null,

  /**
   * 第四面墙事件定义：波次 → 效果
   * 唯一真相来源是 story.js 的 FOURTH_WALL_EVENTS（含文案），这里只做兜底，
   * 避免出现「两份时间表」导致剧情冲突。
   */
  WAVE_EVENTS: (typeof FOURTH_WALL_EVENTS !== 'undefined')
    ? FOURTH_WALL_EVENTS.map(e => ({
        wave: e.wave, type: e.type, params: e.params || {},
        title: e.title || '', content: e.content || '',
      }))
    : [
        { wave: 7,  type: 'chatMessage', params: { msg: '你以为这样就能挡住我？' }, title: '低语', content: '你以为这样就能挡住我？' },
        { wave: 25, type: 'fakeCrash',   params: {}, title: '梦境崩溃', content: '梦境遇到了问题，需要重新启动。' },
        { wave: 31, type: 'uiCorrupt',   params: { type: 'buttonReplace' }, title: '数据错乱', content: '按钮上的字不再是字。' },
      ],

  /**
   * 初始化第四面墙系统
   */
  initFourthWall() {
    this._state = {
      activeEffects: [],
      corruptTimer: 0,
      chatMessages: [],
      saveCorruptActive: false,
    };
    this._triggeredWaves = new Set();
    EventBus.emit('fourthWall:init', null);
  },

  /**
   * 检查当前波次是否触发第四面墙事件
   * @param {number} waveNum - 当前波次
   */
  checkWave(waveNum) {
    for (const evt of this.WAVE_EVENTS) {
      if (evt.wave === waveNum && !this._triggeredWaves.has(waveNum)) {
        this._triggeredWaves.add(waveNum);
        // 同一波次里 WAVE_STORY（剧情框）已经讲过同一段话时：
        // 第四面墙只保留「视觉演出」，文字交给剧情框，避免同一句讲两遍
        const silent = this._isDupWithWaveStory(evt);
        this.applyEffect({ type: evt.type, params: evt.params, wave: waveNum, title: evt.title, content: evt.content, silent });
      }
    }
  },

  /**
   * 判断某个第四面墙事件是否与同波的 WAVE_STORY 文案重复
   * @param {object} evt - 第四面墙事件
   * @returns {boolean}
   */
  _isDupWithWaveStory(evt) {
    if (!evt || !evt.content || typeof WAVE_STORY === 'undefined') return false;
    const s = WAVE_STORY.find(x => x.wave === evt.wave);
    if (!s || !s.text) return false;
    // 比对时忽略换行差异（story.js 里的 \n 是字面两字符）
    const norm = t => String(t).replace(/\\n/g, '').replace(/[\s\n]+/g, '').slice(0, 12);
    return norm(s.text) === norm(evt.content);
  },

  /**
   * 假崩溃界面效果
   * 演出交给 ui.js（showFakeCrash），这里只维护状态与广播。
   * @param {object} [evt] - 事件对象，携带 story.js 的文案
   */
  fakeCrash(evt) {
    if (!this._state) return;
    const text = (evt && evt.content) || '梦境遇到了问题，需要重新启动。\n错误代码：REALITY_NOT_FOUND';
    this._state.activeEffects.push({ type: 'fakeCrash', timer: 3 });
    EventBus.emit('fourthWall:fakeCrash', { title: (evt && evt.title) || '梦境崩溃', content: text, silent: !!(evt && evt.silent) });

    // 3 秒后恢复（演出层自己也会收起浮层）
    setTimeout(() => {
      EventBus.emit('fourthWall:fakeCrashEnd', null);
    }, 3000);
  },

  /**
   * 篡改 UI 效果
   * @param {string} type - 篡改类型：'goldInvert' | 'buttonReplace' | 'colorInvert' | 'glitch'
   * @param {object} [evt] - 事件对象，携带 story.js 的文案
   */
  uiCorrupt(type, evt) {
    if (!this._state) return;
    this._state.corruptTimer = 15; // 持续 15 秒

    switch (type) {
      case 'goldInvert': {
        // 金币数字上下颠倒（通过 CSS transform）
        const goldEl = typeof document !== 'undefined' ? document.getElementById('hudGold') : null;
        if (goldEl) goldEl.style.transform = 'scaleY(-1)';
        break;
      }
      case 'buttonReplace': {
        // 按钮文字替换为奇怪内容
        const btns = typeof document !== 'undefined' ? document.querySelectorAll('#buildBar .card .nm') : [];
        const cursedNames = ['逃跑', '投降', '放弃', '梦魇', '虚无', '混沌', '???', '错误', '迷失', '深渊', '绝望', '腐朽'];
        btns.forEach((el, i) => {
          el._originalText = el.textContent;
          el.textContent = cursedNames[i % cursedNames.length];
        });
        break;
      }
      case 'colorInvert': {
        const wrap = typeof document !== 'undefined' ? document.getElementById('wrap') : null;
        if (wrap) wrap.style.filter = 'invert(1) hue-rotate(180deg)';
        break;
      }
      case 'glitch': {
        const wrap = typeof document !== 'undefined' ? document.getElementById('wrap') : null;
        if (wrap) wrap.classList.add('fourth-wall-glitch');
        break;
      }
    }

    EventBus.emit('fourthWall:uiCorrupt', {
      type, subType: type,
      title: (evt && evt.title) || '数据错乱',
      content: (evt && evt.content) || '',
      silent: !!(evt && evt.silent),
    });
    this._state.activeEffects.push({ type: 'uiCorrupt', subType: type, timer: 15 });
  },

  /**
   * 在游戏画面显示"梦魇"的聊天消息
   * @param {string} msg - 消息文本（单行摘要）
   * @param {object} [evt] - 事件对象，content 为完整多行文案
   */
  chatMessage(msg, evt) {
    if (!this._state) return;
    const text = (evt && evt.content) || msg || '...';
    this._state.chatMessages.push({
      text,
      timer: 6,
      y: 0.3 + Math.random() * 0.4, // 随机垂直位置
    });
    // 长文案交给 UI 的聊天气泡；短句额外飘一行字增加存在感（剧情框已讲过时不重复）
    const silent = !!(evt && evt.silent);
    if (!silent && text.length <= 24 && typeof addText === 'function' && typeof ROOM_X0 !== 'undefined') {
      addText(ROOM_X0 + 200, 200 + Math.random() * 200, '👁 ' + text, '#b91c1c', true);
    }
    EventBus.emit('fourthWall:chatMessage', { text, title: (evt && evt.title) || '梦魇', silent: !!(evt && evt.silent) });
  },

  /**
   * 下次读档时出现"幽灵建筑"
   * @param {object} [evt] - 事件对象，携带 story.js 的文案
   */
  saveCorrupt(evt) {
    if (!this._state) return;
    this._state.saveCorruptActive = true;
    EventBus.emit('fourthWall:saveCorrupt', {
      title: (evt && evt.title) || '存档损坏',
      content: (evt && evt.content) || '存档损坏。\n数据：████████████\n恢复失败。',
      silent: !!(evt && evt.silent),
    });
    // 在 localStorage 标记
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tangping_ghost', JSON.stringify({
          active: true,
          time: Date.now(),
        }));
      }
    } catch (e) { /* 忽略存储错误 */ }
  },

  /**
   * 应用第四面墙效果
   * @param {object} effect - 效果描述 { type, params, wave, title, content }
   */
  applyEffect(effect) {
    switch (effect.type) {
      case 'fakeCrash':
        this.fakeCrash(effect);
        break;
      case 'uiCorrupt':
        this.uiCorrupt(effect.params.type, effect);
        break;
      case 'chatMessage':
        this.chatMessage(effect.params.msg, effect);
        break;
      case 'saveCorrupt':
        this.saveCorrupt(effect);
        break;
    }
    EventBus.emit('fourthWall:apply', effect);
  },

  /**
   * 恢复正常
   * @param {object} effect - 要恢复的效果对象
   */
  revertEffect(effect) {
    if (!effect) return;
    const t = effect.subType || effect.type;
    switch (t) {
      case 'goldInvert': {
        const goldEl = typeof document !== 'undefined' ? document.getElementById('hudGold') : null;
        if (goldEl) goldEl.style.transform = '';
        break;
      }
      case 'buttonReplace': {
        const btns = typeof document !== 'undefined' ? document.querySelectorAll('#buildBar .card .nm') : [];
        btns.forEach(el => {
          if (el._originalText) { el.textContent = el._originalText; delete el._originalText; }
        });
        break;
      }
      case 'colorInvert': {
        const wrap = typeof document !== 'undefined' ? document.getElementById('wrap') : null;
        if (wrap) wrap.style.filter = '';
        break;
      }
      case 'glitch': {
        const wrap = typeof document !== 'undefined' ? document.getElementById('wrap') : null;
        if (wrap) wrap.classList.remove('fourth-wall-glitch');
        break;
      }
    }
    EventBus.emit('fourthWall:revert', effect);
  },

  /**
   * 每帧更新（处理倒计时恢复）
   * @param {number} dt - 帧间隔
   */
  update(dt) {
    if (!this._state) return;
    // 聊天消息倒计时
    for (let i = this._state.chatMessages.length - 1; i >= 0; i--) {
      this._state.chatMessages[i].timer -= dt;
      if (this._state.chatMessages[i].timer <= 0) this._state.chatMessages.splice(i, 1);
    }
    // 篡改效果倒计时
    if (this._state.corruptTimer > 0) {
      this._state.corruptTimer -= dt;
      if (this._state.corruptTimer <= 0) {
        // 恢复所有 UI 篡改
        for (let i = this._state.activeEffects.length - 1; i >= 0; i--) {
          if (this._state.activeEffects[i].type === 'uiCorrupt') {
            this.revertEffect(this._state.activeEffects[i]);
            this._state.activeEffects.splice(i, 1);
          }
        }
      }
    }
    // 其他活跃效果倒计时
    for (let i = this._state.activeEffects.length - 1; i >= 0; i--) {
      const e = this._state.activeEffects[i];
      if (e.timer !== undefined && e.type !== 'uiCorrupt') {
        e.timer -= dt;
        if (e.timer <= 0) this._state.activeEffects.splice(i, 1);
      }
    }
  },

  /**
   * 加载存档时检查幽灵建筑标记
   * @returns {boolean} 是否有幽灵建筑应被生成
   */
  checkGhostSave() {
    try {
      if (typeof localStorage === 'undefined') return false;
      const data = JSON.parse(localStorage.getItem('tangping_ghost') || 'null');
      if (data && data.active) {
        localStorage.removeItem('tangping_ghost');
        return true;
      }
    } catch (e) { /* 忽略 */ }
    return false;
  },
};


/* ============================================================
 *  6. 梦中梦系统 DeepDream
 *  管理深层梦境关卡
 * ============================================================ */

const DeepDream = {
  /**
   * 深层关卡定义
   * 唯一真相来源是 story.js 的 DEEP_DREAM_LEVELS（名称/文案/波次/数值都在那里），
   * 这里只做「编译」，避免规则文案和实际数值打架。
   */
  DEEP_LEVELS: (function () {
    // 兜底副本：仅在 story.js 未加载（DEEP_DREAM_LEVELS 缺失）时生效，数值与 story.js 保持一致；
    // 正常路径走下面的编译，改数值请改 story.js。
    const fallback = [
      { id: 'deep_1', name: '记忆走廊', icon: '🏛️', enterWave: 15, duration: 3,
        desc: '一切变得更加昏暗，某些敌人获得了强化',
        enemyBuffs: { hpMul: 1.5, spdMul: 1.2 }, enemyNerfs: { fire: 0.3 },
        buildingBonus: { dmgMul: 0.9 }, timeScale: 1.0, rewardSpec: null, rewardText: '' },
      { id: 'deep_2', name: '镜像迷宫', icon: '🪞', enterWave: 30, duration: 3,
        desc: '时间开始扭曲，梦魇的护甲变得诡异',
        enemyBuffs: { hpMul: 2.0, spdMul: 0.8, resAll: 0.2 }, enemyNerfs: { shock: 0.4 },
        buildingBonus: { rateMul: 1.15 }, timeScale: 0.85, rewardSpec: null, rewardText: '' },
      { id: 'deep_3', name: '意识深渊', icon: '🕳️', enterWave: 45, duration: 3,
        desc: '梦中之梦，所有规则被重写',
        enemyBuffs: { hpMul: 2.8, spdMul: 1.1, dmgMul: 1.5 }, enemyNerfs: { energy: 0.5 },
        buildingBonus: { dmgMul: 1.2, rateMul: 1.1 }, timeScale: 1.15, rewardSpec: null, rewardText: '' },
    ];
    if (typeof DEEP_DREAM_LEVELS === 'undefined') return fallback;
    return DEEP_DREAM_LEVELS.map((l, i) => {
      const m = l.modifier || {};
      return {
        id: l.id || ('deep_' + (i + 1)),
        name: l.name, icon: l.icon,
        enterWave: l.triggerWave, duration: l.duration || 3,
        desc: l.description, rules: l.rules || '', goal: l.goal || '',
        rewardSpec: l.rewardSpec || null, rewardText: l.reward || '',
        enemyBuffs: m.enemyBuffs || {},
        enemyNerfs: m.enemyNerfs || {},   // 形如 { fire: 0.3 }：让对应属性弱点 +30%
        buildingBonus: m.buildingBonus || {},
        timeScale: m.timeScale === undefined ? 1.0 : m.timeScale,
      };
    });
  })(),

  /** @type {object|null} 当前深层状态 */
  _active: null,

  /** @type {number} 深层内已过波数 */
  _wavesInDeep: 0,

  /**
   * 检查是否该进入深层梦境
   * @param {number} waveNum - 当前波次
   * @returns {object|null} 要进入的深层关卡，或 null
   */
  checkTransition(waveNum) {
    if (this._active) return null; // 已在深层中
    for (const level of this.DEEP_LEVELS) {
      if (waveNum === level.enterWave) return level;
    }
    return null;
  },

  /**
   * 切换到深层梦境
   * @param {string} levelId - 深层关卡 ID
   * @returns {boolean} 是否成功进入
   */
  enterDeepDream(levelId) {
    const level = this.DEEP_LEVELS.find(l => l.id === levelId)
      || this.DEEP_LEVELS.find(l => l.enterWave === (typeof G !== 'undefined' ? G.wave : -1));
    if (!level) return false;
    this._active = level;
    this._wavesInDeep = 0;
    EventBus.emit('deepDream:enter', level);

    if (typeof shakeBy === 'function') shakeBy(20);
    return true;
  },

  /**
   * 发放深层梦境通关奖励（必须与 story.js 里 reward 文案一致）
   * @param {object} level - 关卡定义
   */
  grantReward(level) {
    const spec = level && level.rewardSpec;
    if (!spec) return null;
    const got = [];
    if (typeof G === 'undefined') return null;
    if (spec.souls) { G.souls += spec.souls; got.push('+' + spec.souls + ' 灵魂'); }
    if (spec.rune && typeof rollRune === 'function') {
      const r = rollRune(G.wave || 1, spec.rune);
      if (r) {
        r.fromDeep = level.id;
        G.runeBag.push(r);
        const qdef = (typeof RUNE_QUALITY !== 'undefined') ? RUNE_QUALITY.find(q => q.id === r.q) : null;
        got.push((qdef ? qdef.name : r.q) + '「' + r.name + '」');
      }
    }
    EventBus.emit('deepDream:reward', { level, spec, got });
    if (typeof addText === 'function' && typeof ROOM_X0 !== 'undefined') {
      addText(ROOM_X0 + 300, 300, '🎁 深层奖励：' + got.join(' + '), '#fbbf24', true);
    }
    return got;
  },

  /**
   * 返回浅层梦境
   * @param {boolean} [silent] - 为 true 时不发奖励（读档/中途重置用）
   */
  exitDeepDream(silent) {
    if (!this._active) return;
    const exited = this._active;
    this._active = null;
    this._wavesInDeep = 0;
    if (!silent) this.grantReward(exited);
    EventBus.emit('deepDream:exit', exited);

    if (typeof addText === 'function' && typeof ROOM_X0 !== 'undefined') {
      addText(ROOM_X0 + 300, 250, '☁️ 返回浅层梦境', '#7dd3fc', true);
    }
  },

  /**
   * 当前是否在深层梦境
   * @returns {boolean}
   */
  isActive() {
    return this._active !== null;
  },

  /**
   * 深层进度（第几波 / 共几波），供 HUD 显示
   * @returns {object|null}
   */
  getProgress() {
    if (!this._active) return null;
    return { wave: this._wavesInDeep + 1, total: this._active.duration, level: this._active };
  },

  /**
   * 波次结束时调用，检查是否该退出深层
   * @param {number} waveNum - 当前波次
   */
  onWaveEnd(waveNum) {
    if (!this._active) return;
    this._wavesInDeep++;
    if (this._wavesInDeep >= this._active.duration) {
      this.exitDeepDream();
    }
  },

  /**
   * 获取当前深层关卡对敌人的属性修正
   * @returns {object|null}
   */
  getEnemyModifiers() {
    return this._active ? this._active.enemyBuffs : null;
  },

  /**
   * 获取当前深层关卡的「弱点强化」修正
   * 形如 { fire: 0.3 }：该属性伤害对敌人额外 +30%（进 e.weak，与 typeMul 对齐）
   * @returns {object|null}
   */
  getEnemyNerfs() {
    return this._active ? this._active.enemyNerfs : null;
  },

  /**
   * 获取当前深层关卡对建筑的属性修正
   * @returns {object|null}
   */
  getBuildingModifiers() {
    return this._active ? this._active.buildingBonus : null;
  },

  /**
   * 获取当前时间流速修正
   * @returns {number}
   */
  getTimeScale() {
    return this._active ? this._active.timeScale : 1.0;
  },

  /**
   * 获取当前深层信息
   * @returns {object|null}
   */
  getCurrentLevel() {
    return this._active;
  },
};


/* ============================================================
 *  7. 声音系统 DreamSound
 *  管理音效和隐藏旋律
 * ============================================================ */

const DreamSound = {
  /** @type {AudioContext|null} 音频上下文 */
  _ctx: null,

  /** @type {string[]} 记录的建筑点击序列 */
  _clickHistory: [],

  /** @type {boolean} 隐藏旋律是否已触发 */
  _melodyTriggered: false,

  /** @type {number} 当前环境音深度 */
  _ambientDepth: 0,

  /** @type {OscillatorNode|null} 环境音节点 */
  _ambientNode: null,

  /** @type {GainNode|null} 环境音增益 */
  _ambientGain: null,

  /**
   * 隐藏旋律表
   * 唯一真相来源是 story.js 的 SOUND_MELODIES（含 6 段旋律与奖励文案），这里只做编译。
   * 每段旋律只触发一次；sequence 是建筑 key 的点击顺序。
   */
  MELODIES: (typeof SOUND_MELODIES !== 'undefined')
    ? SOUND_MELODIES.map(m => ({
        id: m.id, name: m.name, sequence: (m.sequence || []).slice(),
        reward: m.reward || '', rewardSpec: m.rewardSpec || null,
      }))
    : [
        { id: 'melody_secret', name: '隐藏旋律', sequence: ['miner', 'generator', 'frost', 'laser', 'tesla', 'flame'],
          reward: '获得 500 金币 + 25 灵魂', rewardSpec: { gold: 500, souls: 25 } },
      ],

  /** @type {string[]} 已触发过的旋律 id */
  _triggeredMelodies: [],

  /**
   * 不同伤害类型的音效参数
   */
  DMG_SOUNDS: {
    kinetic: { freq: 680,  dur: 0.06, type: 'square',   vol: 0.05, slide: -420 },
    frost:   { freq: 1200, dur: 0.12, type: 'sine',     vol: 0.06, slide: -600 },
    energy:  { freq: 880,  dur: 0.15, type: 'sawtooth', vol: 0.05, slide: -300 },
    shock:   { freq: 320,  dur: 0.11, type: 'sawtooth', vol: 0.07, slide: 520 },
    fire:    { freq: 200,  dur: 0.20, type: 'triangle', vol: 0.06, slide: -80 },
    toxic:   { freq: 440,  dur: 0.18, type: 'square',   vol: 0.04, slide: 200 },
  },

  /**
   * 初始化音频：复用游戏主音频上下文 SFX（这样静音开关有效，且不会开两个 AudioContext）
   */
  initSound() {
    if (typeof SFX !== 'undefined' && typeof SFX.init === 'function') {
      SFX.init();
      this._ctx = SFX.ctx;
    } else {
      try {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('[DreamSound] 音频上下文初始化失败:', e);
      }
    }
    this._bindGestureResume();
  },

  /**
   * 浏览器要求「用户手势」之后音频才能真正出声：
   * 首次点击/按键时恢复被挂起的上下文，否则深层环境音与打击音会一直静默。
   */
  _bindGestureResume() {
    if (typeof document === 'undefined' || this._gestureBound) return;
    this._gestureBound = true;
    const resume = () => {
      try {
        if (typeof SFX !== 'undefined' && SFX.ctx && SFX.ctx.state === 'suspended') SFX.ctx.resume();
      } catch (e) { /* 忽略 */ }
    };
    document.addEventListener('pointerdown', resume);
    document.addEventListener('keydown', resume);
  },

  /**
   * 播放音调（走 SFX，受静音开关控制）
   * @param {number} freq - 频率
   * @param {number} dur - 持续时间
   * @param {string} type - 波形类型
   * @param {number} vol - 音量
   * @param {number} slide - 频率滑动
   * @private
   */
  _tone(freq, dur, type, vol, slide) {
    if (typeof SFX !== 'undefined' && typeof SFX.tone === 'function') {
      SFX.tone(freq, dur, type, vol, slide);
      return;
    }
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    const o = this._ctx.createOscillator();
    const g = this._ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this._ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  /**
   * 不同伤害类型播放不同音效（带节流：几十座塔同时开火时不糊成一团）
   * @param {string} type - 伤害类型（kinetic/frost/energy/shock/fire/toxic）
   */
  playDamageSound(type) {
    const params = this.DMG_SOUNDS[type] || this.DMG_SOUNDS.kinetic;
    if (!params) return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (this._lastDmgSound && now - this._lastDmgSound < 80) return;
    this._lastDmgSound = now;
    this._tone(params.freq, params.dur, params.type, params.vol, params.slide);
  },

  /**
   * 记录点击建筑（用于检测隐藏旋律）
   * @param {string} buildingType - 建筑类型 key
   */
  recordClick(buildingType) {
    this._clickHistory.push(buildingType);
    // 只保留最近 N 次记录
    if (this._clickHistory.length > 24) this._clickHistory.shift();
    this.checkMelody();
  },

  /**
   * 检查是否触发隐藏旋律（6 段独立判定，每段只触发一次）
   * @returns {boolean} 是否触发
   */
  checkMelody() {
    const hist = this._clickHistory;
    for (const mel of this.MELODIES) {
      const seq = mel.sequence;
      if (!seq || !seq.length || hist.length < seq.length) continue;
      if (this._triggeredMelodies.indexOf(mel.id) >= 0) continue;
      const tail = hist.slice(hist.length - seq.length);
      if (seq.every((k, i) => k === tail[i])) {
        this._triggeredMelodies.push(mel.id);
        this._playMelody(mel);
        EventBus.emit('sound:secretMelody', mel);
        return true;
      }
    }
    return false;
  },

  /**
   * 播放旋律音符序列，并按 rewardSpec 真实结算奖励
   * @param {object} mel - 旋律定义
   * @private
   */
  _playMelody(mel) {
    const notes = [523, 587, 659, 698, 784, 880]; // C5 D5 E5 F5 G5 A5
    notes.forEach((f, i) => {
      setTimeout(() => { this._tone(f, 0.3, 'triangle', 0.12, 0); }, i * 180);
    });
    setTimeout(() => {
      const got = this.grantMelodyReward(mel.rewardSpec, mel.name);
      EventBus.emit('sound:melodyReward', { melody: mel.id, name: mel.name, got });
    }, notes.length * 180 + 200);
  },

  /**
   * 结算旋律奖励（必须与 story.js 里 reward 文案一致）
   * @param {object} spec - 奖励规格
   * @param {string} name - 旋律名（提示用）
   * @returns {string[]} 实际获得的内容
   */
  grantMelodyReward(spec, name) {
    const got = [];
    if (!spec || typeof G === 'undefined') {
      return got;
    }
    // 金币 / 灵魂
    if (spec.gold) { G.gold += spec.gold; got.push('+' + spec.gold + '💰'); }
    if (spec.souls) { G.souls += spec.souls; got.push('+' + spec.souls + '🔮'); }
    // 床铺回满
    if (spec.healBed && G.bed) { G.bed.hp = G.bed.maxHp; got.push('床铺回满'); }
    // 全体修复
    if (spec.healAll) {
      G.buildings.forEach(b => { b.hp = b.maxHp; });
      G.doors.forEach(d => { d.hp = d.maxHp; d.broken = false; });
      if (G.bed) { G.bed.hp = G.bed.maxHp; }
      got.push('全建筑回满');
    }
    // 超频
    if (spec.overclock) { G.buff.overclock = Math.max(G.buff.overclock || 0, spec.overclock); got.push('超频 ' + spec.overclock + 's'); }
    // 持续若干波的炮塔增益
    if (spec.dmgMul || spec.rateMul || spec.waves) {
      G.melodyBuff = {
        dmgMul: spec.dmgMul || 1,
        rateMul: spec.rateMul || 1,
        wavesLeft: spec.waves || 1,
      };
      if (spec.dmgMul) got.push('炮塔伤害 ×' + spec.dmgMul + '（' + (spec.waves || 1) + ' 波）');
    }
    // 元素共鸣：全场冰火双伤
    if (spec.nova && typeof applyDamage === 'function' && G.enemies) {
      G.enemies.slice().forEach(e => {
        if (e.dead) return;
        if (spec.nova.frost) applyDamage(e, spec.nova.frost, 'frost', null);
        if (!e.dead && spec.nova.fire) applyDamage(e, spec.nova.fire, 'fire', null);
      });
      got.push('元素共鸣');
    }
    // 奇点风暴：全场定身 + 能量伤害
    if (spec.storm && G.enemies) {
      G.enemies.slice().forEach(e => {
        if (e.dead) return;
        e.stun = Math.max(e.stun || 0, spec.storm.stun || 3);
        if (spec.storm.energy && typeof applyDamage === 'function') applyDamage(e, spec.storm.energy, 'energy', null);
      });
      if (typeof shakeBy === 'function') shakeBy(16);
      got.push('奇点风暴');
    }
    // 指定品质的记忆碎片
    if (spec.fragment && typeof DreamFragments !== 'undefined') {
      const f = DreamFragments.grantRandomFragment(spec.fragment);
      if (f) got.push('碎片「' + f.name + '」');
    }

    const line = '🎵 ' + (name || '隐藏旋律') + '：' + (got.length ? got.join(' + ') : '旋律回响');
    if (typeof addText === 'function' && typeof ROOM_X0 !== 'undefined') {
      addText(ROOM_X0 + 300, 250, line, '#ffd166', true);
    }
    if (got.length && typeof setTip === 'function') setTip(line, 4);
    return got;
  },

  /**
   * 根据梦境深度切换环境音
   * @param {number} depth - 深度（0=浅层，1/2/3=深层）
   */
  setAmbient(depth) {
    if (!this._ctx) this._ctx = (typeof SFX !== 'undefined') ? SFX.ctx : null;
    if (!this._ctx) return;
    this._ambientDepth = depth;

    // 停止旧环境音
    if (this._ambientNode) {
      try { this._ambientNode.stop(); } catch (e) { /* 忽略 */ }
      this._ambientNode = null;
    }

    if (depth === 0) return; // 浅层不播放环境音

    // 深层环境：低频嗡鸣 + 随机诡异音
    const ctx = this._ctx;
    const baseFreq = 60 - depth * 10;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    g.gain.setValueAtTime(0.03 + depth * 0.015, ctx.currentTime);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    this._ambientNode = o;
    this._ambientGain = g;
  },
};


/* ============================================================
 *  8. 不战而胜系统 MercyPath
 *  管理"理解"路线
 * ============================================================ */

const MercyPath = {
  /** 可被理解的敌人列表 */
  MERCY_ENCOUNTERS: [
    {
      id: 'mercy_ghost',
      enemyType: 'phantom',
      name: '迷失幽灵',
      desc: '它并不想伤害你，只是想找回自己的记忆',
      dialogue: [
        { speaker: '幽灵', text: '我……我在哪？这里好暗……' },
        { speaker: '你', text: '别怕，你只是迷失在梦境里了。' },
        { speaker: '幽灵', text: '梦……对，我想起来了。谢谢你。' },
      ],
      reward: { gold: 200, soul: 10 },
      unlockText: '解锁剧情：「迷失者的归途」',
    },
    {
      id: 'mercy_spirit',
      enemyType: 'healer',
      name: '慈悲灵',
      desc: '它在治疗同伴，而非攻击你',
      dialogue: [
        { speaker: '灵', text: '请不要伤害他们……他们只是害怕。' },
        { speaker: '你', text: '我理解。但我也要保护自己的家园。' },
        { speaker: '灵', text: '如果可以……我会让他们离开。' },
      ],
      reward: { gold: 350, soul: 18 },
      unlockText: '解锁剧情：「非暴力之盾」',
    },
    {
      id: 'mercy_shadow',
      enemyType: 'brute',
      name: '影卫',
      desc: '它用巨大的身躯保护着身后的小怪物们',
      dialogue: [
        { speaker: '影卫', text: '……（沉默地挡在前方）' },
        { speaker: '你', text: '你是在保护它们吗？' },
        { speaker: '影卫', text: '……（缓缓让开道路）' },
      ],
      reward: { gold: 500, soul: 25 },
      unlockText: '解锁剧情：「沉默的守护者」',
    },
    {
      id: 'mercy_wraith',
      enemyType: 'wraith',
      name: '悔恨之魂',
      desc: '诅咒区域里残留着它的泪水',
      dialogue: [
        { speaker: '怨灵', text: '我不想诅咒任何人……这只是痛苦的溢出。' },
        { speaker: '你', text: '让我帮你化解这份痛苦。' },
        { speaker: '怨灵', text: '……谢谢你。终于可以安息了。' },
      ],
      reward: { gold: 400, soul: 20, bonus: 'removeCurses' },
      unlockText: '解锁剧情：「化解怨恨」',
    },
    {
      id: 'mercy_adaptive',
      enemyType: 'adaptive',
      name: '适应者',
      desc: '它不断变化只是为了生存',
      dialogue: [
        { speaker: '适应者', text: '我变来变去……因为这个世界一直在变。' },
        { speaker: '你', text: '也许我们可以找到一种不变的东西。' },
        { speaker: '适应者', text: '不变的？……（安静下来）原来如此。' },
      ],
      reward: { gold: 600, soul: 30 },
      unlockText: '解锁剧情：「变化中的恒常」',
    },
  ],

  /** @type {Set<string>} 已完成的理解事件 ID */
  _completed: null,

  /** @type {object|null} 当前进行中的对话 */
  _activeDialogue: null,

  /** @type {number} 当前对话步骤索引 */
  _dialogueStep: 0,

  /** 触发前提：最早波次、单次触发概率、两次触发至少间隔波数 */
  MIN_WAVE: 4,
  CHANCE: 0.35,
  WAVE_GAP: 4,

  /** @type {number} 上次触发理解的波次 */
  _lastMercyWave: -99,

  /**
   * 初始化
   */
  init() {
    this._completed = new Set();
    this._activeDialogue = null;
    this._dialogueStep = 0;
    this._lastMercyWave = -99;
    this.mergeStoryEncounters();
  },

  /**
   * 把 story.js 的 MERCY_ENCOUNTERS 文案并入本表
   * （story.js 只写文案，机制/分镜在这里；已有同类型敌人的保留本地完整分镜）
   */
  mergeStoryEncounters() {
    if (typeof MERCY_ENCOUNTERS === 'undefined' || typeof ENEMY_DEFS === 'undefined') return;
    const used = new Set(this.MERCY_ENCOUNTERS.map(m => m.enemyType));
    MERCY_ENCOUNTERS.forEach((s, i) => {
      if (!s || !s.enemyType || used.has(s.enemyType)) return;
      if (!ENEMY_DEFS[s.enemyType]) return;
      used.add(s.enemyType);
      this.MERCY_ENCOUNTERS.push({
        id: s.id || ('mercy_story_' + i),
        enemyType: s.enemyType,
        name: s.name,
        desc: s.desc,
        dialogue: [
          { speaker: '旁白', text: s.dialogue || s.desc },
          { speaker: '你', text: '……我理解你。你不用再战斗了。' },
        ],
        reward: { text: s.reward || '' },   // 文案型奖励：交给 applyStoryEffect 结算，保证「说到做到」
        unlockText: s.unlockText || ('解锁剧情：' + s.name),
      });
    });
  },

  /**
   * 运行时入口：敌人被削到残血时给它一次「被理解」的机会
   * （由 core.js 的 applyDamage 调用；同一敌人只给一次机会）
   * @param {object} enemy - 敌人对象
   * @returns {boolean} 是否真的触发了理解
   */
  tryTrigger(enemy) {
    if (!enemy || enemy.dead || enemy.mercyOffered || enemy.boss) return false;
    if (this._activeDialogue) return false;
    if (this._completed && this._completed.has('__all__')) return false;
    const wave = (typeof G !== 'undefined') ? (G.wave || 1) : 1;
    if (wave < this.MIN_WAVE) return false;
    if (wave - this._lastMercyWave < this.WAVE_GAP) return false;
    enemy.mercyOffered = true;
    if (!this.checkMercy(enemy)) return false;
    if (Math.random() > this.CHANCE) return false;
    this._lastMercyWave = wave;
    return this.startMercyDialogue(enemy);
  },

  /**
   * 检查敌人是否可被理解
   * @param {object} enemy - 敌人对象
   * @returns {object|null} 对应的 mercy encounter，或 null
   */
  checkMercy(enemy) {
    if (!enemy || enemy.dead) return null;
    const encounter = this.MERCY_ENCOUNTERS.find(m =>
      m.enemyType === enemy.type && !this._completed.has(m.id)
    );
    return encounter || null;
  },

  /**
   * 开始理解对话
   * @param {object} enemy - 敌人对象
   * @returns {boolean} 是否成功开始
   */
  startMercyDialogue(enemy) {
    const encounter = this.checkMercy(enemy);
    if (!encounter) return false;
    this._activeDialogue = { encounter, enemy };
    this._dialogueStep = 0;
    EventBus.emit('mercy:start', { encounter, enemy });
    return true;
  },

  /**
   * 取当前遭遇的全部分镜台词（给 UI 逐条播放用）
   * @returns {object[]} [{ speaker, text }]
   */
  getDialogueLines() {
    if (!this._activeDialogue) return [];
    return this._activeDialogue.encounter.dialogue || [];
  },

  /**
   * 推进对话到下一步
   * @returns {object|null} 当前对话行 { speaker, text }，或 null 表示已到结尾
   */
  advanceDialogue() {
    if (!this._activeDialogue) return null;
    const dlg = this._activeDialogue.encounter.dialogue;
    if (this._dialogueStep >= dlg.length) return null;
    const line = dlg[this._dialogueStep];
    this._dialogueStep++;
    return line;
  },

  /**
   * 拒绝理解（玩家选择攻击）：恢复战斗，不再给这只梦魇机会
   * @returns {object|null} 被拒绝的遭遇
   */
  refuseMercy() {
    if (!this._activeDialogue) return null;
    const enc = this._activeDialogue.encounter;
    const enemy = this._activeDialogue.enemy;
    if (enemy) {
      enemy.mercyOffered = true;
      enemy.mercyAngry = true;   // 被拒绝后会狂暴一点，给玩家一点代价
      enemy.dmg = (enemy.dmg || 0) * 1.25;
    }
    this._activeDialogue = null;
    this._dialogueStep = 0;
    EventBus.emit('mercy:refuse', { encounter: enc });
    return enc;
  },

  /**
   * 完成理解，获得奖励
   * @param {string} encounterId - 理解事件 ID
   * @returns {object|null} 奖励信息
   */
  completeMercy(encounterId) {
    const encounter = this.MERCY_ENCOUNTERS.find(m => m.id === encounterId);
    if (!encounter || this._completed.has(encounterId)) return null;
    this._completed.add(encounterId);

    // 发放奖励
    let got = [];
    if (typeof G !== 'undefined') {
      if (encounter.reward.gold) { G.gold += encounter.reward.gold; got.push('+' + encounter.reward.gold + '💰'); }
      if (encounter.reward.soul) { G.souls += encounter.reward.soul; got.push('+' + encounter.reward.soul + '🔮'); }
      // 特殊奖励：移除所有诅咒区域
      if (encounter.reward.bonus === 'removeCurses' && G.effects) {
        G.effects = G.effects.filter(e => e.type !== 'curse');
        got.push('净化所有诅咒');
      }
      // 文案型奖励：由统一的效果解释器结算（未实现的部分会记进梦境日记，不会「说了不算」）
      if (encounter.reward.text && typeof applyStoryEffect === 'function') {
        const r = applyStoryEffect(encounter.reward.text);
        if (r && r.got.length) got = got.concat(r.got);
      }
    }

    // 让对应的敌人消失（理解后离开）
    if (this._activeDialogue && this._activeDialogue.enemy) {
      this._activeDialogue.enemy.dead = true;
      this._activeDialogue.enemy.understood = true;
    }

    EventBus.emit('mercy:complete', { encounter, reward: encounter.reward, got });
    this._activeDialogue = null;
    this._dialogueStep = 0;
    return { encounter, got };
  },

  /**
   * 获取理解进度
   * @returns {{ completed: number, total: number, percentage: number, list: object[] }}
   */
  getMercyProgress() {
    const total = this.MERCY_ENCOUNTERS.length;
    const completed = this._completed ? this._completed.size : 0;
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round(completed / total * 100) : 0,
      list: this.MERCY_ENCOUNTERS.map(m => ({
        id: m.id,
        name: m.name,
        desc: m.desc,
        completed: this._completed ? this._completed.has(m.id) : false,
        unlockText: m.unlockText,
      })),
    };
  },

  /**
   * 当前是否有进行中的对话
   * @returns {boolean}
   */
  isDialogueActive() {
    return this._activeDialogue !== null;
  },
};


/* ============================================================
 *  9. 记忆碎片系统 DreamFragments
 *  管理碎片收集
 * ============================================================ */

const DreamFragments = {
  /**
   * 碎片定义
   * 文案唯一真相在 story.js 的 DREAM_FRAGMENTS；这里只叠加引擎侧的掉落参数
   * （哪类敌人掉、掉率），避免同一份碎片在两处各写一遍。
   */
  FRAGMENT_DEFS: (function () {
    const DROPS = {
      frag_1: ['grunt', 0.08],
      frag_2: ['grunt', 0.07],
      frag_3: ['brute', 0.07],
      frag_4: ['healer', 0.06],
      frag_5: ['brute', 0.06],
      frag_6: ['phantom', 0.05],
      frag_7: ['phantom', 0.05],
      frag_8: ['berserker', 0.04],
      frag_9: ['phantom', 0.04],
      frag_10: ['healer', 0.04],
      frag_11: ['summoner', 0.03],
      frag_12: ['summoner', 0.03],
      frag_13: ['vampire', 0.03],
      frag_14: ['vampire', 0.025],
      frag_15: ['boss', 0.02],
      frag_16: ['boss', 0.02],
      frag_17: ['boss', 0.015],
      frag_18: ['boss', 0.015],
      frag_19: ['boss', 0.01],
      frag_20: ['boss', 0.01],
    };
    return (typeof DREAM_FRAGMENTS !== 'undefined' ? DREAM_FRAGMENTS : []).map(f => {
      const d = DROPS[f.id] || ['any', 0.02];
      return {
        id: f.id,
        name: f.title,
        icon: f.icon || '💎',
        desc: f.desc || '',
        story: f.text,
        rarity: f.rarity,
        dropFrom: d[0],
        dropRate: d[1],
      };
    });
  })(),

  /** @type {Set<string>} 已收集的碎片 ID */
  _collected: null,

  /**
   * 初始化碎片状态
   */
  initFragments() {
    this._collected = new Set();
    EventBus.emit('fragments:init', null);
  },

  /**
   * 击败敌人时尝试掉落碎片
   * @param {object} enemy - 被击败的敌人对象
   * @returns {object|null} 掉落的碎片定义，或 null
   */
  tryDropFragment(enemy) {
    if (!enemy || !enemy.type) return null;
    // 找到匹配的碎片
    const candidates = this.FRAGMENT_DEFS.filter(f =>
      f.dropFrom === enemy.type && !this._collected.has(f.id)
    );
    if (!candidates.length) return null;

    for (const frag of candidates) {
      const rate = frag.dropRate * (enemy.elite ? 2.5 : 1) * (enemy.boss ? 5 : 1);
      if (Math.random() < rate) {
        return this.collectFragment(frag.id);
      }
    }
    return null;
  },

  /**
   * 收集碎片
   * @param {string} fragmentId - 碎片 ID
   * @returns {object|null} 碎片定义，或 null（已收集过）
   */
  collectFragment(fragmentId) {
    if (this._collected.has(fragmentId)) return null;
    const frag = this.FRAGMENT_DEFS.find(f => f.id === fragmentId);
    if (!frag) return null;
    this._collected.add(fragmentId);
    EventBus.emit('fragment:collect', frag);
    return frag;
  },

  /**
   * 碎片稀有度（按掉率推导，掉率越低越稀有）
   * @param {object} f - 碎片定义
   * @returns {string}
   */
  rarityOf(f) {
    if (!f) return 'common';
    if (f.rarity) return f.rarity;
    if (f.dropRate >= 0.05) return 'common';
    if (f.dropRate >= 0.03) return 'rare';
    if (f.dropRate >= 0.02) return 'epic';
    return 'legendary';
  },

  /**
   * 直接授予一枚指定稀有度的碎片（旋律奖励 / 剧情奖励用）
   * @param {string} rarity - 稀有度：common | rare | epic | legendary
   * @returns {object|null} 碎片定义，或 null（该稀有度已全收集）
   */
  grantRandomFragment(rarity) {
    const pool = this.FRAGMENT_DEFS.filter(f =>
      (!rarity || this.rarityOf(f) === rarity) && !(this._collected && this._collected.has(f.id))
    );
    if (!pool.length) return null;
    return this.collectFragment(pool[Math.floor(Math.random() * pool.length)].id);
  },

  /**
   * 获取已收集碎片列表
   * @returns {object[]}
   */
  getCollectedFragments() {
    return this.FRAGMENT_DEFS.filter(f => this._collected && this._collected.has(f.id));
  },

  /**
   * 获取解锁的剧情状态
   * @returns {{ collected: number, total: number, stories: object[] }}
   */
  getUnlockStatus() {
    const total = this.FRAGMENT_DEFS.length;
    const collected = this._collected ? this._collected.size : 0;
    return {
      collected,
      total,
      percentage: total > 0 ? Math.round(collected / total * 100) : 0,
      stories: this.FRAGMENT_DEFS.map(f => ({
        id: f.id,
        name: f.name,
        icon: f.icon,
        desc: f.desc,
        story: this._collected && this._collected.has(f.id) ? f.story : '???',
        unlocked: this._collected ? this._collected.has(f.id) : false,
      })),
    };
  },
};


/* ============================================================
 *  10. 梦境日记系统 DreamDiary
 *  管理剧情记录
 * ============================================================ */

const DreamDiary = {
  /** @type {object[]} 日记条目 */
  _entries: null,

  /** 日记条目类型 */
  ENTRY_TYPES: {
    story:    { name: '剧情', icon: '📖', color: '#c084fc' },
    battle:   { name: '战斗', icon: '⚔️', color: '#f87171' },
    discover: { name: '发现', icon: '🔍', color: '#38bdf8' },
    mercy:    { name: '理解', icon: '🕊️', color: '#6bff9e' },
    fragment: { name: '碎片', icon: '💎', color: '#fbbf24' },
    npc:      { name: '驻守', icon: '🏠', color: '#a78bfa' },
    deep:     { name: '深层', icon: '🌑', color: '#64748b' },
    fourth:   { name: '异常', icon: '👁️', color: '#ef4444' },
    custom:   { name: '笔记', icon: '📝', color: '#94a3b8' },
  },

  /**
   * 初始化日记
   */
  initDiary() {
    this._entries = [];
    // 自动监听其他系统的事件，写入日记
    EventBus.on('mercy:complete', (data) => {
      if (data && data.encounter) {
        this.addEntry('mercy', '理解了「' + data.encounter.name + '」：' + data.encounter.desc);
      }
    });
    EventBus.on('fragment:collect', (frag) => {
      if (frag) {
        this.addEntry('fragment', '收集到「' + frag.name + '」：' + frag.story);
      }
    });
    EventBus.on('deepDream:enter', (level) => {
      if (level) {
        this.addEntry('deep', '进入了' + level.name + '：' + level.desc);
      }
    });
    EventBus.on('deepDream:exit', (level) => {
      if (level) {
        this.addEntry('deep', '从' + level.name + '返回浅层');
      }
    });
    EventBus.on('npc:recruit', (npc) => {
      if (npc && npc.def) {
        this.addEntry('npc', '招募了「' + npc.def.name + '」：' + npc.def.desc);
      }
    });
    EventBus.on('fourthWall:fakeCrash', () => {
      this.addEntry('fourth', '系统出现了异常……屏幕突然黑屏');
    });
    EventBus.on('fourthWall:chatMessage', (data) => {
      const t = (data && (data.text || data.msg)) || '';
      if (t) this.addEntry('fourth', '梦魇的声音：' + t.replace(/\n+/g, ' '));
    });
    EventBus.on('fourthWall:saveCorrupt', () => {
      this.addEntry('fourth', '存档出现了奇怪的波动……');
    });
    EventBus.on('sound:secretMelody', () => {
      this.addEntry('discover', '发现了一段隐藏的旋律，似乎触发了什么……');
    });

    EventBus.emit('diary:init', null);
  },

  /**
   * 添加日记条目
   * @param {string} type - 条目类型 key（story/battle/discover/mercy/fragment/npc/deep/fourth/custom）
   * @param {string} content - 条目内容
   */
  addEntry(type, content) {
    if (!this._entries) this._entries = [];
    const typeDef = this.ENTRY_TYPES[type] || this.ENTRY_TYPES.custom;
    const entry = {
      id: 'diary_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      type,
      typeDef,
      content,
      wave: (typeof G !== 'undefined' && G.wave) ? G.wave : 0,
      timestamp: Date.now(),
    };
    this._entries.push(entry);
    EventBus.emit('diary:add', entry);
  },

  /**
   * 获取所有日记条目
   * @param {string} [filterType] - 可选，按类型过滤
   * @returns {object[]}
   */
  getEntries(filterType) {
    if (!this._entries) return [];
    if (filterType) return this._entries.filter(e => e.type === filterType);
    return this._entries.slice();
  },

  /**
   * 获取完成度百分比
   * 基于：碎片收集、理解进度、NPC 招募、深层探索、日记条目数
   * @returns {number} 0~100 的百分比
   */
  getCompletionRate() {
    let total = 0;
    let done = 0;

    // 碎片收集（权重 25%）
    const fragTotal = DreamFragments.FRAGMENT_DEFS.length;
    const fragDone = DreamFragments._collected ? DreamFragments._collected.size : 0;
    total += 25;
    done += fragTotal > 0 ? (fragDone / fragTotal) * 25 : 0;

    // 理解进度（权重 20%）
    const mercyTotal = MercyPath.MERCY_ENCOUNTERS.length;
    const mercyDone = MercyPath._completed ? MercyPath._completed.size : 0;
    total += 20;
    done += mercyTotal > 0 ? (mercyDone / mercyTotal) * 20 : 0;

    // NPC 招募（权重 15%）
    const npcTotal = NPCGuardians.NPC_DATA.length;
    const npcDone = NPCGuardians._recruited ? NPCGuardians._recruited.length : 0;
    total += 15;
    done += npcTotal > 0 ? Math.min(1, npcDone / npcTotal) * 15 : 0;

    // 深层探索（权重 15%）
    const deepTotal = DeepDream.DEEP_LEVELS.length;
    // 简化：通过日记中 deep 类型条目数估算
    const deepDone = this._entries
      ? new Set(this._entries.filter(e => e.type === 'deep').map(e => e.content)).size
      : 0;
    total += 15;
    done += deepTotal > 0 ? Math.min(1, deepDone / (deepTotal * 2)) * 15 : 0;

    // 日记条目数（权重 25%，满 50 条算 100%）
    const entryCount = this._entries ? this._entries.length : 0;
    total += 25;
    done += Math.min(1, entryCount / 50) * 25;

    return Math.round((done / total) * 100);
  },
};


/* ============================================================
 *  梦境引擎主控 DreamEngine
 *  统一初始化与帧更新入口
 * ============================================================ */

const DreamEngine = {
  /** @type {boolean} 是否已初始化 */
  _initialized: false,

  /** 中立生物生成计时器 */
  _neutralSpawnTimer: 0,

  /**
   * 初始化所有梦境子系统
   * 在 newGame() 之后调用
   */
  init() {
    DreamEcology.initEcology();
    NPCGuardians.initNPCs();
    FourthWall.initFourthWall();
    DreamSound.initSound();
    MercyPath.init();
    DreamFragments.initFragments();
    DreamDiary.initDiary();
    if (typeof QuestSystem !== 'undefined') QuestSystem.init();
    this._initialized = true;
    EventBus.emit('dream:init', null);
  },

  /**
   * 每帧调用 — 在 core.js 的 step() 函数中加入 DreamEngine.tick(dt)
   * @param {number} dt - 帧间隔（秒）
   */
  tick(dt) {
    if (!this._initialized || typeof G === 'undefined') return;

    // 梦境生态
    DreamEcology.processEcologyTick(G.enemies, dt);

    // 中立生物
    NeutralCreatures.processNeutralTick(dt);
    // 每15秒尝试生成一只中立生物（场上最多3只）
    this._neutralSpawnTimer += dt;
    if (this._neutralSpawnTimer >= 15 && NeutralCreatures.getCreatures().length < 3) {
      this._neutralSpawnTimer = 0;
      NeutralCreatures.spawnNeutral();
    }

    // NPC 能力
    NPCGuardians.processNPCTick(dt);

    // 第四面墙
    FourthWall.update(dt);

    // 深层梦境时间修正（不直接修改 dt，通过 getTimeScale 获取）
    // 实际修改应在 core.js 的 step() 中乘以 DeepDream.getTimeScale()
  },

  /**
   * 波次开始时调用
   * @param {number} waveNum - 新波次号
   */
  onWaveStart(waveNum) {
    if (!this._initialized) return;

    // 第四面墙检查
    FourthWall.checkWave(waveNum);

    // 深层梦境检查
    const deepLevel = DeepDream.checkTransition(waveNum);
    if (deepLevel) {
      DeepDream.enterDeepDream(deepLevel.id);
      DreamSound.setAmbient(DeepDream.DEEP_LEVELS.indexOf(deepLevel) + 1);
    }

    // 日记：波次开始
    DreamDiary.addEntry('story', '第 ' + waveNum + ' 波开始' + (DeepDream.isActive() ? '（深层梦境）' : ''));

    // 梦境委托：到达解锁波次则接取下一章
    if (typeof QuestSystem !== 'undefined') { try { QuestSystem.onWaveStart(waveNum); } catch (e) { console.warn('QuestSystem waveStart:', e); } }

    EventBus.emit('dream:waveStart', waveNum);
  },

  /**
   * 波次结束时调用
   * @param {number} waveNum - 刚结束的波次号
   */
  onWaveEnd(waveNum) {
    if (!this._initialized) return;

    NeutralCreatures.onWaveEnd();
    NPCGuardians.onWaveEnd();
    DeepDream.onWaveEnd(waveNum);

    // 如果从深层退出，恢复环境音
    if (!DeepDream.isActive()) {
      DreamSound.setAmbient(0);
    }

    EventBus.emit('dream:waveEnd', waveNum);
  },

  /**
   * 击败敌人时调用
   * @param {object} enemy - 被击败的敌人
   */
  onEnemyKilled(enemy) {
    if (!this._initialized) return;

    // 尝试掉落碎片
    const frag = DreamFragments.tryDropFragment(enemy);
    if (frag) {
      if (typeof addText === 'function') {
        addText(enemy.x, enemy.y - 40, frag.icon + ' ' + frag.name + '！', '#fbbf24', true);
      }
    }

    // 梦境委托：信物掉落与进度
    if (typeof QuestSystem !== 'undefined') { try { QuestSystem.onEnemyKilled(enemy); } catch (e) { console.warn('QuestSystem kill:', e); } }

    // 检查是否可被理解（应在此之前调用 checkMercy）
    EventBus.emit('dream:enemyKilled', enemy);
  },

  /**
   * 点击建筑时调用
   * @param {string} buildingType - 建筑类型 key
   */
  onBuildingClick(buildingType) {
    if (!this._initialized) return;
    DreamSound.recordClick(buildingType);
  },

  /**
   * 获取全部子系统的快照（用于调试或 UI 展示）
   * @returns {object}
   */
  getSnapshot() {
    return {
      ecology: DreamEcology._state ? { activeEffects: DreamEcology._state.effects.size } : null,
      neutrals: NeutralCreatures.getCreatures().map(c => ({ type: c.type, name: c.def.name, age: Math.round(c.age) })),
      npcs: NPCGuardians.getRecruited().map(n => ({ id: n.def.id, name: n.def.name, room: n.roomId })),
      fourthWall: FourthWall._state ? { activeEffects: FourthWall._state.activeEffects.length, chatMessages: FourthWall._state.chatMessages.length } : null,
      deepDream: DeepDream.isActive() ? { level: DeepDream.getCurrentLevel().name, wavesIn: DeepDream._wavesInDeep } : null,
      fragments: DreamFragments.getUnlockStatus(),
      quest: typeof QuestSystem !== 'undefined' ? QuestSystem.getSnapshot() : null,
      mercy: MercyPath.getMercyProgress(),
      diary: { entries: DreamDiary._entries ? DreamDiary._entries.length : 0, completion: DreamDiary.getCompletionRate() },
    };
  },
};
