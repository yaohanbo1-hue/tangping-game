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
   */
  WAVE_EVENTS: [
    { wave: 7,  type: 'chatMessage', params: { msg: '你以为这样就能挡住我？' } },
    { wave: 13, type: 'uiCorrupt',   params: { type: 'goldInvert' } },
    { wave: 19, type: 'chatMessage', params: { msg: '你的金币…是我的了。' } },
    { wave: 25, type: 'fakeCrash',   params: {} },
    { wave: 31, type: 'uiCorrupt',   params: { type: 'buttonReplace' } },
    { wave: 37, type: 'chatMessage', params: { msg: '梦境正在崩塌……你感觉到了吗？' } },
    { wave: 43, type: 'saveCorrupt', params: {} },
    { wave: 49, type: 'fakeCrash',   params: {} },
    { wave: 55, type: 'uiCorrupt',   params: { type: 'colorInvert' } },
    { wave: 59, type: 'chatMessage', params: { msg: '最后一波了。祝你好运……真的。' } },
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
        this.applyEffect({ type: evt.type, params: evt.params, wave: waveNum });
      }
    }
  },

  /**
   * 假崩溃界面效果
   */
  fakeCrash() {
    if (!this._state) return;
    // 使用独立的 fourthWallOverlay 容器，不篡改游戏 overlay
    const overlay = typeof document !== 'undefined' ? document.getElementById('fourthWallOverlay') : null;
    if (!overlay) return;

    overlay.innerHTML =
      '<div style="text-align:center;color:#aaa;font-family:Consolas,monospace;padding:40px">' +
      '<div style="font-size:64px;margin-bottom:24px">:(</div>' +
      '<div style="font-size:24px;color:#f87171;margin-bottom:16px">APPLICATION ERROR</div>' +
      '<div style="font-size:13px;color:#666;line-height:2">' +
      'Runtime Error: dream_core.dll<br>' +
      'Memory access violation at 0x' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase() + '<br>' +
      '梦境稳定性: <span style="color:#f87171">CRITICAL</span><br><br>' +
      '<span style="color:#444">正在尝试恢复...</span></div></div>';
    overlay.style.display = '';

    this._state.activeEffects.push({ type: 'fakeCrash', timer: 3 });
    EventBus.emit('fourthWall:fakeCrash', null);

    // 3 秒后恢复
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.innerHTML = '';
      EventBus.emit('fourthWall:fakeCrashEnd', null);
    }, 3000);
  },

  /**
   * 篡改 UI 效果
   * @param {string} type - 篡改类型：'goldInvert' | 'buttonReplace' | 'colorInvert'
   */
  uiCorrupt(type) {
    if (!this._state) return;
    this._state.corruptTimer = 15; // 持续 15 秒

    switch (type) {
      case 'goldInvert': {
        // 金币数字上下颠倒（通过 CSS transform）
        const goldEl = typeof document !== 'undefined' ? document.getElementById('hudGold') : null;
        if (goldEl) goldEl.style.transform = 'scaleY(-1)';
        EventBus.emit('fourthWall:uiCorrupt', { type: 'goldInvert' });
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
        EventBus.emit('fourthWall:uiCorrupt', { type: 'buttonReplace' });
        break;
      }
      case 'colorInvert': {
        const wrap = typeof document !== 'undefined' ? document.getElementById('wrap') : null;
        if (wrap) wrap.style.filter = 'invert(1) hue-rotate(180deg)';
        EventBus.emit('fourthWall:uiCorrupt', { type: 'colorInvert' });
        break;
      }
    }

    this._state.activeEffects.push({ type: 'uiCorrupt', subType: type, timer: 15 });
  },

  /**
   * 在游戏画面显示"梦魇"的聊天消息
   * @param {string} msg - 消息文本
   */
  chatMessage(msg) {
    if (!this._state) return;
    this._state.chatMessages.push({
      text: msg,
      timer: 6,
      y: 0.3 + Math.random() * 0.4, // 随机垂直位置
    });
    // 使用游戏内浮动文字系统
    if (typeof addText === 'function' && typeof ROOM_X0 !== 'undefined') {
      addText(ROOM_X0 + 200, 200 + Math.random() * 200, '👁 ' + msg, '#b91c1c', true);
    }
    EventBus.emit('fourthWall:chatMessage', msg);
  },

  /**
   * 下次读档时出现"幽灵建筑"
   */
  saveCorrupt() {
    if (!this._state) return;
    this._state.saveCorruptActive = true;
    EventBus.emit('fourthWall:saveCorrupt', null);
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
   * @param {object} effect - 效果描述 { type, params, wave }
   */
  applyEffect(effect) {
    switch (effect.type) {
      case 'fakeCrash':
        this.fakeCrash();
        break;
      case 'uiCorrupt':
        this.uiCorrupt(effect.params.type);
        break;
      case 'chatMessage':
        this.chatMessage(effect.params.msg);
        break;
      case 'saveCorrupt':
        this.saveCorrupt();
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
  /** 深层关卡定义 */
  DEEP_LEVELS: [
    {
      id: 'abyss_1',
      name: '深渊第一层',
      icon: '🌑',
      enterWave: 15,
      duration: 3,            // 持续波数
      desc: '一切变得更加昏暗，某些敌人获得了强化',
      enemyBuffs: { hpMul: 1.5, spdMul: 1.2 },
      enemyNerfs: { fireWeakBonus: 0.3 },   // 火焰弱点额外 +30%
      buildingBonus: { dmgMul: 0.9 },        // 建筑伤害降低 10%
      timeScale: 1.0,
    },
    {
      id: 'abyss_2',
      name: '深渊第二层',
      icon: '🕳️',
      enterWave: 30,
      duration: 3,
      desc: '时间开始扭曲，梦魇的护甲变得诡异',
      enemyBuffs: { hpMul: 2.0, spdMul: 0.8, resAll: 0.2 },
      enemyNerfs: { shockWeakBonus: 0.4 },
      buildingBonus: { rateMul: 1.15 },      // 建筑射速 +15%
      timeScale: 0.85,                        // 时间流速变慢
    },
    {
      id: 'abyss_3',
      name: '深渊第三层',
      icon: '👁️',
      enterWave: 45,
      duration: 3,
      desc: '梦中之梦，所有规则被重写',
      enemyBuffs: { hpMul: 2.8, spdMul: 1.1, dmgMul: 1.5 },
      enemyNerfs: { energyWeakBonus: 0.5 },
      buildingBonus: { dmgMul: 1.2, rateMul: 1.1 }, // 攻防双增
      timeScale: 1.15,                               // 时间加速
    },
  ],

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
    const level = this.DEEP_LEVELS.find(l => l.id === levelId);
    if (!level) return false;
    this._active = level;
    this._wavesInDeep = 0;
    EventBus.emit('deepDream:enter', level);

    // 显示进入提示
    if (typeof addText === 'function' && typeof ROOM_X0 !== 'undefined') {
      addText(ROOM_X0 + 300, 250, level.icon + ' ' + level.name, '#b91c1c', true);
      addText(ROOM_X0 + 300, 280, level.desc, '#64748b');
    }
    if (typeof shakeBy === 'function') shakeBy(20);
    return true;
  },

  /**
   * 返回浅层梦境
   */
  exitDeepDream() {
    if (!this._active) return;
    const exited = this._active;
    this._active = null;
    this._wavesInDeep = 0;
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
   * 隐藏旋律序列：依次点击「矿机→发电机→冰霜塔→激光塔→电磁塔→火焰塔」
   */
  SECRET_MELODY: ['miner', 'generator', 'frost', 'laser', 'tesla', 'flame'],

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
   * 初始化音频上下文
   */
  initSound() {
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[DreamSound] 音频上下文初始化失败:', e);
    }
  },

  /**
   * 播放音调
   * @param {number} freq - 频率
   * @param {number} dur - 持续时间
   * @param {string} type - 波形类型
   * @param {number} vol - 音量
   * @param {number} slide - 频率滑动
   * @private
   */
  _tone(freq, dur, type, vol, slide) {
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
   * 不同伤害类型播放不同音效
   * @param {string} type - 伤害类型（kinetic/frost/energy/shock/fire/toxic）
   */
  playDamageSound(type) {
    const params = this.DMG_SOUNDS[type];
    if (!params) return;
    this._tone(params.freq, params.dur, params.type, params.vol, params.slide);
  },

  /**
   * 记录点击建筑（用于检测隐藏旋律）
   * @param {string} buildingType - 建筑类型 key
   */
  recordClick(buildingType) {
    this._clickHistory.push(buildingType);
    // 只保留最近 N 次记录
    if (this._clickHistory.length > 20) this._clickHistory.shift();
    this.checkMelody();
  },

  /**
   * 检查是否触发隐藏旋律
   * @returns {boolean} 是否触发
   */
  checkMelody() {
    if (this._melodyTriggered) return false;
    const seq = this.SECRET_MELODY;
    const hist = this._clickHistory;
    if (hist.length < seq.length) return false;

    // 检查末尾是否匹配
    const tail = hist.slice(hist.length - seq.length);
    const match = seq.every((k, i) => k === tail[i]);
    if (match) {
      this._melodyTriggered = true;
      this._playSecretMelody();
      EventBus.emit('sound:secretMelody', null);
      return true;
    }
    return false;
  },

  /**
   * 播放隐藏旋律的音符序列
   * @private
   */
  _playSecretMelody() {
    const notes = [523, 587, 659, 698, 784, 880]; // C5 D5 E5 F5 G5 A5
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._tone(f, 0.3, 'triangle', 0.12, 0);
      }, i * 180);
    });
    // 奖励
    setTimeout(() => {
      if (typeof G !== 'undefined') {
        G.gold += 500;
        G.souls += 25;
      }
      if (typeof addText === 'function' && typeof ROOM_X0 !== 'undefined') {
        addText(ROOM_X0 + 300, 250, '🎵 隐藏旋律！+500💰 +25🔮', '#ffd166', true);
      }
      EventBus.emit('sound:melodyReward', { gold: 500, soul: 25 });
    }, notes.length * 180 + 200);
  },

  /**
   * 根据梦境深度切换环境音
   * @param {number} depth - 深度（0=浅层，1/2/3=深层）
   */
  setAmbient(depth) {
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

  /**
   * 初始化
   */
  init() {
    this._completed = new Set();
    this._activeDialogue = null;
    this._dialogueStep = 0;
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
   * 推进对话到下一步
   * @returns {object|null} 当前对话行 { speaker, text }，或 null 表示结束
   */
  advanceDialogue() {
    if (!this._activeDialogue) return null;
    const dlg = this._activeDialogue.encounter.dialogue;
    if (this._dialogueStep >= dlg.length) {
      // 对话结束，自动完成理解
      const enc = this._activeDialogue.encounter;
      this.completeMercy(enc.id);
      return null;
    }
    const line = dlg[this._dialogueStep];
    this._dialogueStep++;
    return line;
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
    if (typeof G !== 'undefined') {
      if (encounter.reward.gold) G.gold += encounter.reward.gold;
      if (encounter.reward.soul) G.souls += encounter.reward.soul;
      // 特殊奖励：移除所有诅咒区域
      if (encounter.reward.bonus === 'removeCurses' && G.effects) {
        G.effects = G.effects.filter(e => e.type !== 'curse');
      }
    }

    // 让对应的敌人消失（理解后离开）
    if (this._activeDialogue && this._activeDialogue.enemy) {
      this._activeDialogue.enemy.dead = true;
    }

    EventBus.emit('mercy:complete', { encounter, reward: encounter.reward });
    this._activeDialogue = null;
    this._dialogueStep = 0;
    return encounter.reward;
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
  /** 碎片定义（来自 story.js DREAM_FRAGMENTS，共 20 个） */
  FRAGMENT_DEFS: [
    { id:'frag_1', name:'失眠的夜晚', icon:'🌙', desc:'凌晨三点的失眠', story:'凌晨三点，你盯着天花板数绵羊。数到第一百只的时候，你意识到它们都长着你的脸。', dropRate:0.08, dropFrom:'grunt' },
    { id:'frag_2', name:'闹钟的诅咒', icon:'⏰', desc:'醒不来的循环', story:'闹钟响了。你伸手去按，手指穿过了它。你还在梦里。今天是周几？你已经不记得了。', dropRate:0.07, dropFrom:'grunt' },
    { id:'frag_3', name:'褪色的照片', icon:'📷', desc:'模糊的记忆', story:'一张全家福，但所有人的脸都是模糊的。只有你自己的脸清晰——在笑，但眼睛里没有光。', dropRate:0.07, dropFrom:'brute' },
    { id:'frag_4', name:'未接来电', icon:'📱', desc:'错过的声音', story:'手机屏幕上显示：27 个未接来电，来自"妈妈"。你打了回去，听筒里只有雨声。', dropRate:0.06, dropFrom:'healer' },
    { id:'frag_5', name:'空教室', icon:'🏫', desc:'独自面对', story:'考试铃响了，但教室里只有你一个人。试卷上的题目你从未学过，而窗外是无尽的黑夜。', dropRate:0.06, dropFrom:'brute' },
    { id:'frag_6', name:'追逐', icon:'🏃', desc:'逃不掉的恐惧', story:'你在跑，身后有什么东西在追。你看不清它，但你知道——它没有形状，因为它就是"恐惧"本身。', dropRate:0.05, dropFrom:'phantom' },
    { id:'frag_7', name:'镜中人', icon:'🪞', desc:'另一个自己', story:'镜子里的你没有在模仿你的动作。它在摇头。它在说："回去。"', dropRate:0.05, dropFrom:'phantom' },
    { id:'frag_8', name:'消失的房间', icon:'🚪', desc:'回不去的地方', story:'你回到童年的卧室，但一切都缩小了。书桌上的作业本翻开——上面写满了同一个字："逃"。', dropRate:0.04, dropFrom:'berserker' },
    { id:'frag_9', name:'失声', icon:'🔇', desc:'发不出的声音', story:'你想呼救，但嘴巴一张一合，发不出任何声音。你周围的人都在正常地说话、笑，没有人注意到你。', dropRate:0.04, dropFrom:'phantom' },
    { id:'frag_10', name:'倒流的河', icon:'🌊', desc:'逆转的时间', story:'河水向上游流去。岸边的树在倒着长，落叶飞回枝头。时间在倒退——但只有你注意到了。', dropRate:0.04, dropFrom:'healer' },
    { id:'frag_11', name:'永恒的走廊', icon:'🏛️', desc:'走不到尽头', story:'走廊没有尽头。每扇门后面都是另一条走廊。你开始怀疑——也许"出口"这个概念本身就是个梦。', dropRate:0.03, dropFrom:'summoner' },
    { id:'frag_12', name:'被遗忘的名字', icon:'📝', desc:'失去的自我', story:'有人在叫你的名字。但你想不起那是谁的声音。你甚至开始怀疑——那真的是你的名字吗？', dropRate:0.03, dropFrom:'summoner' },
    { id:'frag_13', name:'天台的风', icon:'🌬️', desc:'真实的感觉', story:'你站在天台边缘。风很大。不是要跳下去——只是想感受一下"真实"的东西。风是真实的吗？', dropRate:0.03, dropFrom:'vampire' },
    { id:'frag_14', name:'最后一课', icon:'📝', desc:'未完的告别', story:'老师说："人生的考试没有标准答案。"你醒了，发现自己泪流满面，但想不起为什么。', dropRate:0.025, dropFrom:'vampire' },
    { id:'frag_15', name:'碎片拼图', icon:'🧩', desc:'拼凑的自己', story:'你把所有记忆碎片拼在一起，看到了一幅画——一个人躺在无数面镜子组成的房间里，每面镜子映出不同年龄的自己。', dropRate:0.02, dropFrom:'boss' },
    { id:'frag_16', name:'创造者的独白', icon:'🎭', desc:'造梦者的歉意', story:'"我创造了这个梦境来保护你。但保护太久，就变成了囚禁。对不起。"——一段不知来源的自言自语。', dropRate:0.02, dropFrom:'boss' },
    { id:'frag_17', name:'第一道光', icon:'🌅', desc:'从未到达的黎明', story:'在所有噩梦的最深处，有一扇小小的窗。窗外是黎明。你从没走到过那里——因为你总是在半路就建起了防线。', dropRate:0.015, dropFrom:'boss' },
    { id:'frag_18', name:'闹钟', icon:'🔔', desc:'梦的终结者', story:'闹钟。很简单的一个闹钟。但在梦境里，它是一个禁忌之物。因为闹钟意味着——梦要结束了。', dropRate:0.015, dropFrom:'boss' },
    { id:'frag_19', name:'两条路', icon:'🛤️', desc:'分岔口的选择', story:'一条路通向醒来，路上铺满了刺。另一条路通向永恒的安睡，路上开满了花。你站在分岔口，发现自己其实知道该走哪条。', dropRate:0.01, dropFrom:'boss' },
    { id:'frag_20', name:'写给自己的信', icon:'💌', desc:'来自内心的声音', story:'"亲爱的我：如果你正在读这封信，说明你已经足够勇敢了。梦魇不是你的敌人，它们是你未曾消化的情绪。不要消灭它们——理解它们。然后，醒来。"', dropRate:0.01, dropFrom:'boss' },
  ],

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
    EventBus.on('fourthWall:chatMessage', (msg) => {
      if (msg) {
        this.addEntry('fourth', '梦魇的声音："' + msg + '"');
      }
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
      mercy: MercyPath.getMercyProgress(),
      diary: { entries: DreamDiary._entries ? DreamDiary._entries.length : 0, completion: DreamDiary.getCompletionRate() },
    };
  },
};
