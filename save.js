// ============================================================
//  守灯人：梦魇防线  —  存档系统
// ============================================================
//  为什么单独做一个模块：
//    旧的 saveGame() 只写了 11 个字段，实测会丢：难度 / 模式 / 命运加成（剧情
//    奖励）/ 开局道具加成 / 重生次数 / 通关波次 / 好感度 / 旋律增益 / 护盾上限
//    / 整个梦境进度（碎片、日记、NPC、旋律、深层梦境）。读档后剧情奖励白拿。
//  本模块负责：
//    · 完整状态快照与恢复（capture / restore）—— 这也是将来联机「状态同步」的序列化层
//    · 3 个手动槽 + 1 个自动槽
//    · 版本号 + 迁移链（老存档不丢）
//    · 结构校验与容错恢复（不计算校验和，也不提供防篡改保证）
//    · 导出 / 导入 .json 文件（存档真正属于玩家，不锁死在浏览器里）
// ============================================================

const SaveSystem = {
  /** 存档格式版本。每次改动快照结构都必须 +1，并在 migrate() 里补一条迁移 */
  VERSION: 6,
  /** 手动槽位数量（0 号保留给自动存档） */
  SLOTS: 3,
  /** 保留合法的 0 HP；只有缺失或非数值才回退到满血。 */
  _restoreHp(value, maxHp) {
    const hp = value === null ? NaN : Number(value);
    return clamp(Number.isFinite(hp) ? hp : maxHp, 0, maxHp);
  },
  /** 数值容错：脏存档里的非数值字段一律回退默认，避免 NaN 报废整局 */
  _num(value, fallback, min, max) {
    const n = Number(value);
    return clamp(Number.isFinite(n) ? n : (fallback || 0), min === undefined ? -Infinity : min, max === undefined ? Infinity : max);
  },
  /** 写入失败的两种已知名：Chromium 用 QuotaExceededError，Firefox 用 NS_ERROR_DOM_QUOTA_REACHED */
  _isQuota(name) {
    return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
  },
  /** 存档名只作展示：去掉标签字符并限长，避免导入文件注入 HTML */
  _safeName(name, fallback) {
    if (typeof name !== 'string') return fallback || '';
    return name.replace(/[<>&"'`]/g, '').trim().slice(0, 24) || (fallback || '');
  },
  KEY: n => 'tangping_save_slot' + n,
  IDX: 'tangping_saves_index',
  LEGACY: 'tangping_save',       // v2 时代的单槽 key，会自动迁移到 0 号槽

  /* ---------------- 槽位读写 ---------------- */

  list() {
    const out = [];
    for (let s = 0; s <= this.SLOTS; s++) {
      const raw = Store.get(this.KEY(s), null);
      let info = null;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          // 老版本存档没有 meta 摘要，直接取 d.meta 会让槽位在面板里显示成「空」。
          // 先走一遍迁移，再按需现算一份摘要。
          const d = this.migrate(parsed) || parsed;
          info = (d && d.meta) ? d.meta : (d && d.run ? this._metaOf(d) : { broken: true });
          // 未来版本的存档迁移不了：标成 tooNew，让面板提示「来自新版本」而不是当成空槽。
          if (info && !info.broken && parsed && typeof parsed.v === 'number' && parsed.v > this.VERSION) info.tooNew = true;
        } catch (e) { info = { broken: true }; }
      }
      out.push({ slot: s, auto: s === 0, info });
    }
    return out;
  },

  /** 只存摘要，菜单/面板列槽位时不用把所有存档都解析一遍 */
  _metaOf(d) {
    const run = (d && d.run) || {};
    return {
      wave: run.wave | 0,
      diff: run.diffKey || 'normal',
      mode: run.mode || 'limited',
      gold: Math.round(run.gold || 0),
      buildings: (d && d.buildings ? d.buildings.length : 0),
      kills: (d && d.progress && d.progress.stats ? (d.progress.stats.kills | 0) : 0),
      quest: (d && d.progress && d.progress.quest) ? (d.progress.quest.idx + 1) | 0 : 0,
      dream: (d && d.dream) ? Object.keys(d.dream).length : 0,
      resumeWave: run.state === 'wave' || !!run.resumeWave,
      at: (d && d.savedAt) || Date.now(),
      name: this._safeName(d && d.name),
    };
  },

  /**
   * 写入一个槽
   * @returns {{ok:boolean, reason?:string}}
   */
  write(slot, data, name) {
    try {
      const d = Object.assign({}, data);
      d.v = this.VERSION;
      d.savedAt = Date.now();
      if (name !== undefined) d.name = name;
      d.name = this._safeName(d.name);
      d.meta = this._metaOf(d);
      const json = JSON.stringify(d);
      const write = Store.set(this.KEY(slot), json);
      if (!write || !write.ok) {
        return { ok: false, reason: this._isQuota(write && write.name) ? 'quota' : 'storage-blocked' };
      }
      // 回读并逐字比对：覆盖旧槽失败时，不能把仍存在的旧值误报为保存成功。
      if (Store.get(this.KEY(slot), null) !== json) return { ok: false, reason: 'storage-blocked' };
      return { ok: true, bytes: json.length };
    } catch (e) {
      return { ok: false, reason: this._isQuota(e && e.name) ? 'quota' : 'error' };
    }
  },

  read(slot) {
    const raw = Store.get(this.KEY(slot), null);
    if (!raw) return null;
    let d;
    try { d = JSON.parse(raw); } catch (e) { return null; }
    return this.migrate(d);
  },

  remove(slot) { Store.del(this.KEY(slot)); },

  /* ---------------- 版本迁移 ---------------- */

  /**
   * 把任意历史版本的存档升级到当前结构。
   * v2（旧单槽）：扁平字段 → 包成 { run / bed / doors / buildings / progress }
   * v3/v4：增加可恢复的试炼标记；v5 为炮塔保存独立集火偏好；v6 记录战斗中存档的本波重开标记。
   */
  migrate(d) {
    if (!d || typeof d !== 'object') return null;
    if (d.v === this.VERSION && d.run) return d;
    if ((d.v === 3 || d.v === 4 || d.v === 5) && d.run) {
      const migratedRun = Object.assign({}, d.run, {
        trialId: d.run.trialId || null,
        resumeWave: !!d.run.resumeWave || d.run.state === 'wave',
      });
      const migrated = Object.assign({}, d, { v: this.VERSION, run: migratedRun });
      migrated.meta = Object.assign({}, migrated.meta || {}, this._metaOf(migrated));
      return migrated;
    }
    // ---- v2 → v6 ----
    if (d.v === 2 || (d.wave !== undefined && !d.run)) {
      const migrated = {
        v: this.VERSION,
        savedAt: d.savedAt || Date.now(),
        migratedFrom: d.v || 2,
        name: d.name || '',
        run: {
          wave: d.wave | 0, state: 'build',
          gold: d.gold || 0, power: d.power || 0, souls: d.souls || 0,
          grow: d.grow || 0, growTimer: 0,
          diffKey: d.diffKey || 'normal', mode: d.mode || 'limited',
          admin: !!d.admin, winWave: d.winWave | 0,
          prepTimer: 20, prepTotal: 20, reviveLeft: d.reviveLeft | 0,
          combo: 0, maxCombo: 0,
          prize: d.prize || {}, fate: d.fate || null, fateWave: null,
          affection: d.affection || {}, melodyBuff: null, buff: null,
        },
        bed: d.bed ? { lv: d.bed.lv || 1, hp: d.bed.hp } : null,
        doors: d.doors || null,
        buildings: d.buildings || [],
        progress: {
          tech: d.tech, ach: d.ach, stats: d.stats,
          lot: d.lot, runeBag: d.runeBag, quest: d.quest,
        },
        dream: null,
      };
      migrated.meta = this._metaOf(migrated);
      return migrated;
    }
    return null;
  },

  /** 把老的单槽存档搬进 0 号槽（只做一次） */
  migrateLegacy() {
    const raw = Store.get(this.LEGACY, null);
    if (!raw) return false;
    if (Store.get(this.KEY(0), null)) { Store.del(this.LEGACY); return false; }
    try {
      const d = this.migrate(JSON.parse(raw));
      if (!d) { Store.del(this.LEGACY); return false; }
      const r = this.write(0, d, '旧版存档');
      if (r.ok) { Store.del(this.LEGACY); console.log('[Save] 旧存档已迁移到自动槽'); return true; }
    } catch (e) { }
    return false;
  },

  /* ---------------- 校验 ---------------- */

  /**
   * 结构校验：挡住被手动改坏 / 截断的 JSON。不是安全校验，只求"能安全读进来"。
   * @returns {{ok:boolean, issues:string[]}}
   */
  validate(d) {
    const issues = [];
    if (!d || typeof d !== 'object') return { ok: false, issues: ['不是对象'] };
    if (!d.run || typeof d.run !== 'object') issues.push('缺少 run 段');
    const run = d.run || {};
    if (!isFinite(run.wave) || run.wave < 0 || run.wave > 9999) issues.push('wave 非法: ' + run.wave);
    ['gold', 'power', 'souls'].forEach(k => {
      if (run[k] !== undefined && !isFinite(run[k])) issues.push(k + ' 非数值');
    });
    if (run.diffKey && typeof DIFFS !== 'undefined' && !DIFFS[run.diffKey]) issues.push('未知难度: ' + run.diffKey);
    if (run.mode && typeof MODES !== 'undefined' && !MODES[run.mode]) issues.push('未知模式: ' + run.mode);
    if (d.buildings !== undefined) {
      if (!Array.isArray(d.buildings)) issues.push('buildings 不是数组');
      else d.buildings.forEach((b, i) => {
        if (!b || !b.t) issues.push('第 ' + i + ' 座建筑缺少类型');
        else if (typeof BUILD_DEFS !== 'undefined' && !BUILD_DEFS[b.t]) issues.push('第 ' + i + ' 座建筑类型未知: ' + b.t);
        if (b && (!isFinite(b.c) || !isFinite(b.r) || b.c < 0 || b.c >= COLS || b.r < 0 || b.r >= ROWS)) issues.push('第 ' + i + ' 座建筑坐标越界');
      });
    }
    if (d.doors !== undefined && !Array.isArray(d.doors)) issues.push('doors 不是数组');
    if (d.progress && d.progress.tech && typeof d.progress.tech !== 'object') issues.push('tech 结构异常');
    return { ok: issues.length === 0, issues };
  },

  /* ---------------- 快照 / 恢复 ---------------- */

  /** 采集当前全局状态（这是将来联机状态同步的雏形） */
  capture() {
    if (typeof G === 'undefined' || !G) return null;
    return {
      v: this.VERSION,
      savedAt: Date.now(),
      run: {
        wave: G.wave, state: G.state,
        gold: G.gold, power: G.power, souls: G.souls,
        grow: G.grow, growTimer: G.growTimer,
        diffKey: G.diffKey, mode: G.mode,
        admin: !!G.admin, winWave: G.winWave | 0, trialId: G.trialId || null,
        resumeWave: !!G.resumeWave,
        prepTimer: G.prepTimer, prepTotal: G.prepTotal,
        reviveLeft: G.reviveLeft | 0,
        combo: G.combo | 0, comboT: G.comboT || 0, maxCombo: G.maxCombo | 0,
        eventId: (G.event && G.event.id) || 'none',
        eventTimer: G.eventTimer | 0,
        // challenge.def 含函数，序列化后会丢——只存纯数据，读档时按 id 重链
        challenge: G.challenge ? {
          id: G.challenge.id, target: G.challenge.target,
          prog: G.challenge.prog | 0, done: !!G.challenge.done,
        } : null,
        prize: G.prize || {},
        fate: G.fate || null,
        fateWave: G.fateWave || null,
        affection: G.affection || {},
        melodyBuff: G.melodyBuff || null,
        buff: G.buff || null,
        // 战斗中存档的经济基准：读档重开本波时回滚本波净收益，防止反复存/读刷击杀掉落
        waveEcon: {
          startGold: +G.waveStartGold || 0, spentGold: +G.waveSpentGold || 0,
          startSouls: +G.waveStartSouls || 0, spentSouls: +G.waveSpentSouls || 0,
          runes: (G.waveRuneIds || []).slice(),
        },
      },
      bed: { lv: G.bed.lv, hp: G.bed.hp, shield: G.bed.shield || 0, shieldMax: G.bed.shieldMax || 0 },
      doors: G.doors.map(d => ({ lv: d.lv, hp: d.hp, shield: d.shield || 0, shieldMax: d.shieldMax || 0, broken: !!d.broken })),
      buildings: G.buildings.map(b => ({
        t: b.type, c: b.col, r: b.row, lv: b.level, br: b.branch, targetMode: b.targetMode || null,
        hp: b.hp, inv: b.invested, runes: b.runes || [],
        kills: b.kills | 0, shield: b.shield || 0, shieldMax: b.shieldMax || 0,
      })),
      progress: {
        tech: G.tech, ach: G.ach, stats: G.stats,
        lot: G.lot, runeBag: G.runeBag, quest: G.quest,
      },
      dream: this.captureDream(),
    };
  },

  /** 梦境系统的进度（碎片 / 日记 / NPC / 旋律 / 理解路线 / 深层梦境） */
  captureDream() {
    const o = {};
    try {
      if (typeof DreamFragments !== 'undefined' && DreamFragments._collected) o.fragments = Array.from(DreamFragments._collected);
      if (typeof DreamDiary !== 'undefined' && DreamDiary._entries) o.diary = DreamDiary._entries.slice(-60);
      if (typeof NPCGuardians !== 'undefined' && NPCGuardians._recruited) o.npcs = NPCGuardians._recruited.map(n => ({ id: n.def.id, roomId: n.roomId }));
      if (typeof DreamSound !== 'undefined' && DreamSound._triggeredMelodies) o.melodies = DreamSound._triggeredMelodies.slice();
      if (typeof MercyPath !== 'undefined' && MercyPath._completed) o.mercy = Array.from(MercyPath._completed);
      if (typeof DeepDream !== 'undefined' && DeepDream._active) o.deep = { level: DeepDream._active.id, waves: DeepDream._wavesInDeep | 0 };
      if (typeof FourthWall !== 'undefined' && FourthWall._triggeredWaves) o.fourthWall = Array.from(FourthWall._triggeredWaves);
    } catch (e) { console.warn('[Save] captureDream:', e); }
    return o;
  },

  restoreDream(dm) {
    if (!dm) return;
    try {
      if (Array.isArray(dm.fragments) && typeof DreamFragments !== 'undefined' && DreamFragments._collected) {
        dm.fragments.forEach(id => DreamFragments._collected.add(id));
      }
      if (Array.isArray(dm.diary) && typeof DreamDiary !== 'undefined') {
        DreamDiary._entries = dm.diary.slice();
      }
      if (Array.isArray(dm.npcs) && typeof NPCGuardians !== 'undefined') {
        dm.npcs.forEach(n => {
          // captureDream() 存的是 NPC_DATA 的能力 id（abilityId），不是 NPC_DIALOG 的 npc_N。
          // 之前只按 x.id 查找，永远匹配不到 —— 表现就是「读档后驻守的梦境居民全部消失」。
          const def = (typeof NPC_DIALOG !== 'undefined') ? NPC_DIALOG.find(x => x.id === n.id || x.abilityId === n.id) : null;
          if (def && !NPCGuardians._recruited.some(r => r.def.abilityId === def.abilityId)) {
            NPCGuardians._recruited.push({ def, roomId: n.roomId });
          }
        });
      }
      if (Array.isArray(dm.melodies) && typeof DreamSound !== 'undefined') {
        DreamSound._triggeredMelodies = dm.melodies.slice();
      }
      if (Array.isArray(dm.mercy) && typeof MercyPath !== 'undefined' && MercyPath._completed) {
        dm.mercy.forEach(id => MercyPath._completed.add(id));
      }
      if (Array.isArray(dm.fourthWall) && typeof FourthWall !== 'undefined' && FourthWall._triggeredWaves) {
        dm.fourthWall.forEach(w => FourthWall._triggeredWaves.add(w));
      }
      if (dm.deep && typeof DeepDream !== 'undefined') {
        const lv = DeepDream.DEEP_LEVELS && DeepDream.DEEP_LEVELS.find(x => x.id === dm.deep.level);
        if (lv) { if (!DeepDream._active) DeepDream.enterDeepDream(lv.id); DeepDream._wavesInDeep = dm.deep.waves | 0; }
      }
    } catch (e) { console.warn('[Save] restoreDream:', e); }
  },

  /**
   * 把快照应用到当前 G（newGame 已建好全新 G，这里做叠加）
   * @returns {boolean} 是否成功应用
   */
  restore(d) {
    if (typeof G === 'undefined' || !G) return false;
    const v = this.validate(d);
    if (!v.ok) console.warn('[Save] 存档有 ' + v.issues.length + ' 处异常，已尽量恢复：', v.issues);
    try {
      const run = d.run || {};
      const resumeWave = run.state === 'wave' || !!run.resumeWave;
      G.wave = Math.max(0, Math.min(9999, run.wave | 0));
      G.state = resumeWave ? 'build' : (run.state || 'build');   // 读档中的战斗波先进入备战，再重开同一波
      G.resumeWave = resumeWave;
      G.gold = this._num(run.gold, 0, 0); G.power = this._num(run.power, 0, 0); G.souls = this._num(run.souls, 0, 0);
      G.grow = this._num(run.grow, 0, 0, 25);
      G.growTimer = this._num(run.growTimer, 0, 0);
      if (run.diffKey && typeof DIFFS !== 'undefined' && DIFFS[run.diffKey]) G.diffKey = run.diffKey;
      if (run.mode && typeof MODES !== 'undefined' && MODES[run.mode]) G.mode = run.mode;
      G.admin = !!run.admin;
      G.winWave = run.winWave | 0;
      G.trialId = (typeof POSTGAME_TRIALS !== 'undefined' && POSTGAME_TRIALS.some(t => t.id === run.trialId)) ? run.trialId : null;
      if (run.state === 'wave') {
        G.prepTimer = isFinite(run.prepTotal) && run.prepTotal > 0
          ? +run.prepTotal
          : Math.max(12, 24 - G.wave * 0.16) * diffCfg().prepMul * ((run.prize && run.prize.prep) || 1);
        G.prepTotal = G.prepTimer;
      } else {
        G.prepTimer = isFinite(run.prepTimer) ? +run.prepTimer : G.prepTimer;
        G.prepTotal = isFinite(run.prepTotal) && run.prepTotal > 0 ? +run.prepTotal : G.prepTimer;
      }
      // 挑战：def 含函数无法序列化，按 id 重链 CHALLENGES 定义（否则 updateHUD 每帧抛错）
      G.challenge = null;
      if (run.challenge && typeof run.challenge === 'object' && typeof CHALLENGES !== 'undefined') {
        const def = CHALLENGES.find(x => x.id === run.challenge.id);
        if (def) {
          G.challenge = {
            id: def.id, def,
            target: this._num(run.challenge.target, 0),
            prog: run.challenge.prog | 0, done: !!run.challenge.done,
          };
        }
      }
      G.reviveLeft = run.reviveLeft | 0;
      G.combo = run.combo | 0; G.comboT = +run.comboT || 0; G.maxCombo = run.maxCombo | 0;
      G.eventTimer = +run.eventTimer || 0;
      if (run.eventId && typeof EVENTS !== 'undefined') {
        const ev = EVENTS.find(e => e.id === run.eventId);
        if (ev) G.event = ev;
      }
      if (run.prize) Object.assign(G.prize, run.prize);
      if (run.fate) Object.assign(G.fate, run.fate);
      if (run.fateWave) Object.assign(G.fateWave, run.fateWave);
      if (run.affection) G.affection = Object.assign({}, run.affection);
      if (run.melodyBuff) G.melodyBuff = run.melodyBuff;
      if (run.buff) Object.assign(G.buff, run.buff);

      const prog = d.progress || {};
      if (prog.tech) Object.keys(prog.tech).forEach(k => { if (G.tech[k] !== undefined) G.tech[k] = Math.max(0, prog.tech[k] | 0); });
      if (prog.ach && typeof prog.ach === 'object') G.ach = Object.assign({}, prog.ach);
      if (prog.stats && typeof prog.stats === 'object') Object.assign(G.stats, prog.stats);
      if (!Array.isArray(G.stats.laneLeaks)) G.stats.laneLeaks = [0, 0, 0];
      if (!Array.isArray(G.stats.laneDamage)) G.stats.laneDamage = [0, 0, 0];
      if (!G.stats.towerDamage || typeof G.stats.towerDamage !== 'object') G.stats.towerDamage = {};
      if (!G.stats.towerKills || typeof G.stats.towerKills !== 'object') G.stats.towerKills = {};
      if (prog.lot && typeof prog.lot === 'object') Object.assign(G.lot, prog.lot);
      if (Array.isArray(prog.runeBag)) G.runeBag = prog.runeBag.map(r => this._fixRune(r)).filter(Boolean);
      if (prog.quest && typeof prog.quest === 'object') G.quest = prog.quest;

      // 战斗中存档重开本波：回滚本波净收益（击杀掉落、利息等可重复获取的部分），
      // 本波花费随建筑保留（花费已从基准里扣除）——反复存/读不再刷资源。
      const econ = run.waveEcon;
      if (resumeWave && econ && typeof econ === 'object') {
        G.gold = Math.max(0, this._num(econ.startGold, G.gold) - this._num(econ.spentGold, 0));
        G.souls = Math.max(0, this._num(econ.startSouls, G.souls) - this._num(econ.spentSouls, 0));
        if (Array.isArray(econ.runes) && Array.isArray(G.runeBag) && econ.runes.length) {
          const dropIds = new Set(econ.runes);
          G.runeBag = G.runeBag.filter(r => !(r && dropIds.has(r.id)));
        }
      }
      // 重定本波经济基准：之后的读档都以当前值为新基准，多次读档不会重复回滚
      G.waveStartGold = G.gold; G.waveSpentGold = 0;
      G.waveStartSouls = G.souls; G.waveSpentSouls = 0;
      G.waveRuneIds = [];

      if (d.bed) {
        G.bed.lv = Math.max(1, Math.min(50, d.bed.lv | 0 || 1));
        G.bed.maxHp = bedMaxHp(G.bed.lv);
        G.bed.hp = this._restoreHp(d.bed.hp, G.bed.maxHp);
        G.bed.shieldMax = +d.bed.shieldMax || 0;
        G.bed.shield = clamp(+d.bed.shield || 0, 0, G.bed.shieldMax || G.bed.maxHp);
      }
      if (Array.isArray(d.doors)) {
        d.doors.forEach((v2, i) => {
          const o = G.doors[i]; if (!o) return;
          o.lv = Math.max(1, Math.min(50, v2.lv | 0 || 1));
          o.maxHp = doorMaxHp(o.lv);
          o.hp = this._restoreHp(v2.hp, o.maxHp);
          o.shieldMax = +v2.shieldMax || 0;
          o.shield = clamp(+v2.shield || 0, 0, o.shieldMax || o.maxHp);
          o.broken = !!v2.broken && o.hp <= 0;
        });
      }
      if (Array.isArray(d.buildings)) {
        d.buildings.forEach(v2 => {
          const def = BUILD_DEFS[v2.t]; if (!def) return;
          const c = v2.c | 0, r = v2.r | 0;
          if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
          if (G.grid[r * COLS + c] || inBed(c, r)) return;
          const p = cellCenter(c, r);
          const b = {
            type: v2.t, def, level: Math.max(1, Math.min(def.maxLv || 50, v2.lv | 0 || 1)),
            col: c, row: r, x: p.x, y: p.y, branch: (def.branch && v2.br) ? v2.br : null,
            targetMode: ['front', 'strongest', 'weakest', 'nearest'].indexOf(v2.targetMode) >= 0 ? v2.targetMode : null,
            cd: 0, angle: -Math.PI / 2, target: null, pulse: 0, idle: 0,
            kills: v2.kills | 0, invested: +v2.inv || def.cost.gold,
            shield: 0, shieldMax: 0, runes: this._fixRunes(v2.runes),
          };
          b.maxHp = buildingMaxHp(def, b.level, b.branch);
          b.hp = this._restoreHp(v2.hp, b.maxHp);
          b.shieldMax = +v2.shieldMax || 0;
          b.shield = clamp(+v2.shield || 0, 0, b.shieldMax || b.maxHp);
          G.buildings.push(b); G.grid[r * COLS + c] = b;
        });
      }
      this.restoreDream(d.dream);
      G.resDirty = true;
      if (typeof QuestSystem !== 'undefined') QuestSystem.init();
      return true;
    } catch (e) {
      console.error('[Save] restore 失败:', e);
      return false;
    }
  },

  /** 单个符文清洗：词条必须是已知类型且数值有限，否则丢弃该词条（防导入脏数据打成 NaN） */
  _fixRune(r) {
    if (!r || typeof r !== 'object' || !r.id || !Array.isArray(r.affixes)) return null;
    const known = (typeof RUNE_AFFIXES !== 'undefined') ? RUNE_AFFIXES : null;
    const affixes = [];
    for (const a of r.affixes) {
      if (!a || typeof a !== 'object') continue;
      if (known && !known[a.k]) continue;
      const v = Number(a.v);
      if (!Number.isFinite(v)) continue;
      affixes.push({ k: a.k, v: Math.max(0, Math.round(v * 10) / 10) });
    }
    if (!affixes.length) return null;
    const lv = Number(r.lv);
    return Object.assign({}, r, {
      affixes,
      lv: Number.isFinite(lv) ? Math.max(0, Math.min(99, Math.round(lv))) : 0,
    });
  },

  /** 符文槽数组规整（数量随「符文宗师」科技变化） */
  _fixRunes(arr) {
    const n = (typeof runeSlots === 'function') ? runeSlots() : 2;
    const out = new Array(n).fill(null);
    if (Array.isArray(arr)) for (let i = 0; i < Math.min(n, arr.length); i++) {
      const r = this._fixRune(arr[i]);
      if (r) out[i] = r;
    }
    return out;
  },

  /* ---------------- 导出 / 导入（存档真正属于玩家） ---------------- */

  exportFile(slot) {
    const d = this.read(slot);
    if (!d) return false;
    try {
      const payload = { game: 'shoudengren-nightmare', v: this.VERSION, exportedAt: Date.now(), data: d };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = 'shoudengren-save-w' + (d.meta ? d.meta.wave : 0) + '-' + stamp + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return true;
    } catch (e) { console.warn('[Save] export:', e); return false; }
  },

  /** 从 File 对象导入到指定槽 */
  importFile(file, slot, cb) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      let payload = null;
      try { payload = JSON.parse(fr.result); } catch (e) { cb({ ok: false, reason: 'json' }); return; }
      // 兼容两种形态：带外壳的导出文件，或直接是存档对象
      const d = this.migrate(payload && payload.data ? payload.data : payload);
      if (!d) { cb({ ok: false, reason: 'format' }); return; }
      const v = this.validate(d);
      if (!v.ok) { cb({ ok: false, reason: 'invalid', issues: v.issues }); return; }
      const r = this.write(slot, d, this._safeName(d.name, '导入的存档'));
      cb(Object.assign({ ok: r.ok, reason: r.reason, meta: this._metaOf(d) }, r));
    };
    fr.onerror = () => cb({ ok: false, reason: 'read' });
    fr.readAsText(file);
  },

  /** 时间戳格式化（面板用） */
  fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  },
};

// 模块加载时顺手把 v2 的老存档搬过来
try { SaveSystem.migrateLegacy(); } catch (e) { }
