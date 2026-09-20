// ============================================================
//  躺平发育：梦魇防线  —  梦境委托（任务）系统
// ============================================================
//  设计目标（来自需求）：
//    · 击杀特定梦魇 → 掉落特定信物 → 可在面板里查看
//    · 集齐信物推进主线剧情，一环比一环接近「梦的真相」
//  与已有系统的关系：
//    · 复用 EventBus / DreamEngine 的钩子，不新增 core.js 耦合
//    · 奖励文案统一交给 core.js 的 applyStoryEffect() 解释，避免"说了给却没给"
//    · 每章完成解锁一枚 memory fragment（DreamFragments）
// ============================================================

/** 信物定义：掉落物本身也是叙事载体，lore 是「查看」时读到的内容 */
const QUEST_ITEMS = {
  mist_tear: {
    name: '雾之泪', icon: '💧', rare: 'common', from: '幽灵',
    desc: '一滴不会蒸发的雾',
    lore: '幽灵没有眼泪。所以当你在走廊地板上捡到这颗冰凉的水珠时，'
        + '你花了很久才明白：那是它还记得自己曾经是谁。',
  },
  mirror_shard: {
    name: '裂开的镜片', icon: '🪞', rare: 'rare', from: '镜面梦魇',
    desc: '映不出你的一张脸',
    lore: '你举起它，镜面里没有你。只有一间空教室，和一张没有人坐的椅子。'
        + '你把它转了个角度——椅子旁边站着一个背影，穿着你的校服。',
  },
  faded_photo: {
    name: '褪色的合照', icon: '📷', rare: 'rare', from: '治疗梦魇',
    desc: '四个人的合照，缺了一个角',
    lore: '照片上是四张床、四个孩子。可你数来数去只有三个人的脸，'
        + '第四个位置被烧掉了一个角。你认得那个空位的形状——是你自己的轮廓。',
  },
  broken_pendulum: {
    name: '断裂的钟摆', icon: '⏳', rare: 'epic', from: '时空梦魇',
    desc: '指针停在 03:07',
    lore: '钟摆断了，时间就停在了三点零七分。你忽然想起——'
        + '那个未接来电的时间，也是 03:07。',
  },
  blank_letter: {
    name: '空白的信纸', icon: '📄', rare: 'epic', from: '召唤梦魇',
    desc: '写满字又被擦掉的信',
    lore: '灯下侧着看，纸面上还留着上一版字迹的压痕：'
        + '"别再来找我了。"下面一行更浅，像是哭着写的："你会后悔的。"',
  },
  last_clock: {
    name: '最后一只闹钟', icon: '🔔', rare: 'legend', from: '梦魇领主',
    desc: '梦境里的禁忌之物',
    lore: '它一直响，但没有任何人听得见。因为闹钟意味着——梦要结束了。'
        + '你把它握在手里，第一次感到掌心是热的。',
  },
};

/**
 * 章节数据（第一章 → 第六章，共 6 环）
 * 字段说明：
 *   act       幕名，用于开场标题卡演出
 *   title     委托名
 *   unlockWave 解锁波次
 *   enemy     需要击杀的梦魇类型（key 对应 ENEMY_DEFS）
 *   need      需要集齐的信物数量
 *   dropRate  每次击杀的掉落概率（另带 4 次保底）
 *   from      信物持有者（提示去哪找）
 *   hook      接取时的剧情
 *   done      凑齐后的剧情（走 dialogue 结构与 WAVE_STORY 一致）
 *   rewardText 奖励文案，交给 applyStoryEffect 解释
 *   fragment  完成后解锁的记忆碎片 id
 */
const QUEST_CHAPTERS = [
  {
    id: 'q1', act: '第一幕 · 入梦', title: '走廊尽头的哭声',
    unlockWave: 4, enemy: 'phantom', need: 3, dropRate: 0.42, item: 'mist_tear',
    from: '幽灵',
    hook: {
      speaker: '林小夏',
      text: '你听……走廊尽头有哭声。是那些灰白色的东西——它们不打门，只是哭。\n'
          + '我数过了，它们哭的时候会掉东西，像水珠。你能捡几颗回来吗？我想看看那是什么。',
      choices: [
        { text: '我去。你在这别动。', effect: '林小夏好感度 +1' },
        { text: '……哭声？我什么都没听见。', effect: '获得 150 金币（她塞给你的）' },
      ],
    },
    done: {
      speaker: '林小夏',
      text: '三颗……都是凉的。\n'
          + '你知道吗，幽灵是没有眼泪的。因为它们已经不记得自己是谁了——'
          + '可它还记得要哭。\n'
          + '（她把水珠举到眼前，忽然不说话了。）',
      choices: [
        { text: '它是不是……在替谁哭？', effect: '解锁记忆碎片，理解加深' },
        { text: '别想了，先活下去。', effect: '获得 400 金币，全队防御 +10%（本波）' },
      ],
    },
    rewardText: '获得 600 金币、获得 20 灵魂、所有炮塔伤害 +6%（本局）',
    fragment: 'frag_7',
  },
  {
    id: 'q2', act: '第二幕 · 回声', title: '照不出人的镜子',
    unlockWave: 9, enemy: 'reflector', need: 2, dropRate: 0.38, item: 'mirror_shard',
    from: '镜面梦魇',
    hook: {
      speaker: '周默',
      text: '那些会反光的家伙——我朝它们开枪，子弹会弹回来。\n'
          + '它们身上掉碎片。我想要一片。我想确认一件事：'
          + '镜子里的东西，是不是也在看着我们。',
      choices: [
        { text: '你想确认什么？', effect: '周默好感度 +1' },
        { text: '碎片我帮你拿，别乱看。', effect: '获得 200 金币' },
      ],
    },
    done: {
      speaker: '周默',
      text: '我照了。里面没有我。\n'
          + '……有一张椅子，还有一件挂在椅背上的校服——是你的尺码。\n'
          + '（他把镜片收进口袋，声音很轻。）所以这个教室里，本来应该坐着四个人。',
      choices: [
        { text: '你的意思是，我们四个都在这？', effect: '解锁记忆碎片，理解加深' },
        { text: '镜子会说谎。别信它。', effect: '扎下心防：全队防御 +15%（本波）' },
      ],
    },
    rewardText: '获得 1200 金币、获得 30 灵魂、所有炮塔射程 +8%（本局）',
    fragment: 'frag_12',
  },
  {
    id: 'q3', act: '第三幕 · 缺席者', title: '四个人的合照',
    unlockWave: 17, enemy: 'healer', need: 3, dropRate: 0.34, item: 'faded_photo',
    from: '治疗梦魇',
    hook: {
      speaker: '赵磊',
      text: '哦豁，这次的怪会给人回血——我第一次见敌人比我妈还关心我。\n'
          + '不过说真的，它们身上有照片。四个人一张床那种合照。\n'
          + '……帮个忙，弄三张回来。我想知道我们四个到底认不认识。',
      choices: [
        { text: '我们当然认识。', effect: '赵磊好感度 +1，全队士气 +' },
        { text: '我不确定我们认识。', effect: '获得 300 金币，防御 +10%（本波）' },
      ],
    },
    done: {
      speaker: '赵磊',
      text: '……照片上只有三个人。\n'
          + '第四个位置被烧没了。我数了三遍，我把每张都翻过来看背面——'
          + '背面写着同一个学号。\n'
          + '（他难得没讲冷笑话。）小夏，你认识这个学号吗？',
      choices: [
        { text: '那是我的学号。', effect: '解锁记忆碎片，理解加深' },
        { text: '把照片收起来。现在不是时候。', effect: '获得 800 金币' },
      ],
    },
    rewardText: '获得 2000 金币、获得 45 灵魂、所有建筑生命 +12%（本局）',
    fragment: 'frag_3',
  },
  {
    id: 'q4', act: '第四幕 · 三点零七分', title: '停住的钟摆',
    unlockWave: 24, enemy: 'chronos', need: 2, dropRate: 0.30, item: 'broken_pendulum',
    from: '时空梦魇',
    hook: {
      speaker: '旁白',
      text: '走廊尽头的墙上出现过一道时钟的虚影，然后又消失了。\n'
          + '那些走得比谁都快的梦魇，身上挂着断掉的钟摆。\n'
          + '你需要两个。你需要知道，那一天到底停在哪一秒。',
      choices: [
        { text: '我记得那个时间。', effect: '命运印记：时间线收束' },
        { text: '我不想记得。', effect: '获得 500 金币，防御 +15%（本波）' },
      ],
    },
    done: {
      speaker: '???',
      text: '03:07。\n'
          + '你终于把它拿在手里了。\n'
          + '那通电话你打了回去，听筒里只有雨声——因为你根本没有按下拨号键。\n'
          + '（声音停顿了很久。）孩子，你要找的不是出口。是那天晚上你没说出口的那句话。',
      choices: [
        { text: '……你是谁？', effect: '解锁记忆碎片，理解加深' },
        { text: '我不需要谁来教我后悔。', effect: '怒火：所有炮塔伤害 +15%（本波）' },
      ],
    },
    rewardText: '获得 3500 金币、获得 70 灵魂、获得 60 电量、所有炮塔射速 +8%（本局）',
    fragment: 'frag_4',
  },
  {
    id: 'q5', act: '第五幕 · 未寄出的信', title: '空白的信纸',
    unlockWave: 33, enemy: 'summoner', need: 4, dropRate: 0.28, item: 'blank_letter',
    from: '召唤梦魇',
    hook: {
      speaker: '林小夏',
      text: '那些不停召唤小家伙的东西，身上带着纸。\n'
          + '纸是空白的，但举到灯下能看见压痕——是写给谁的信，写了又擦掉。\n'
          + '我要四张。我想拼出完整的句子。',
      choices: [
        { text: '你想写给谁？', effect: '林小夏好感度 +1' },
        { text: '先收集，别多想。', effect: '获得 700 金币' },
      ],
    },
    done: {
      speaker: '林小夏',
      text: '拼出来了。\n'
          + '"对不起，那天我没有拉住你。"\n'
          + '（她把四张纸按顺序摆好，手一直在抖。）\n'
          + '这不是写给谁的。这是写给"没被拉住的那个人的"。\n'
          + '你……你那天到底站在哪？',
      choices: [
        { text: '我站在天台边上。', effect: '解锁记忆碎片，理解加深' },
        { text: '我不记得了。真的。', effect: '获得 1500 金币，全队防御 +20%（本波）' },
      ],
    },
    rewardText: '获得 6000 金币、获得 120 灵魂、所有炮塔伤害 +10%（本局）',
    fragment: 'frag_13',
  },
  {
    id: 'q6', act: '终幕 · 醒来', title: '最后一只闹钟',
    unlockWave: 41, enemy: 'boss', need: 1, dropRate: 1, item: 'last_clock',
    from: '梦魇领主',
    hook: {
      speaker: '周默',
      text: '它们之中最大的那一个——领主、巨口、机械核心、虚空之影——身上挂着一只闹钟。\n'
          + '不，不是挂着。是被它攥在手里，攥得死死的。\n'
          + '拿到它。然后我们就能决定：是继续睡，还是醒。',
      choices: [
        { text: '我要醒。', effect: '决心：所有伤害 +10%（本局）' },
        { text: '我要先弄清楚全部真相。', effect: '获得 2000 金币，防御 +20%（本波）' },
      ],
    },
    done: {
      speaker: '???',
      text: '你拿到它了。\n'
          + '现在听好——我不再是"梦魇"了，我是你自己造出来的守门人。\n'
          + '我拦着你，不是为了困住你。是因为你醒过来的那一次，是最后一次。\n'
          + '（闹钟开始响。这一次，四个人都听见了。）\n'
          + '按下去吧。但先回头看看——他们还在等你。',
      choices: [
        { text: '我回头了。他们都还在。', effect: '解锁最终记忆碎片，理解已达终点' },
        { text: '按下去。独自醒来。', effect: '获得 10000 金币与结局印记' },
      ],
    },
    rewardText: '获得 12000 金币、获得 300 灵魂、所有伤害 +20%（本局）、所有建筑生命 +30%（本局）',
    fragment: 'frag_19',
  },
];

// ============================================================
//  QuestSystem — 委托引擎
// ============================================================
const QuestSystem = {
  /** 每章独立状态：kills / items / pity（保底计数）/ done */
  _s: null,
  _initd: false,

  init() {
    // 状态挂在 G 上，随核心存档一起持久化（core.js saveGame/applySave 已带 quest 字段）
    if (!G) return;
    if (!G.quest || typeof G.quest !== 'object') G.quest = this.blank();
    this._s = G.quest;
    this._initd = true;
    EventBus.emit('quest:init', this.getActive());
  },

  blank() {
    return { idx: -1, chapters: {}, items: {}, finished: false };
  },

  /** 取某一章的运行时进度（没有就建） */
  _ch(id) {
    if (!this._s.chapters[id]) this._s.chapters[id] = { kills: 0, items: 0, pity: 0, done: false };
    return this._s.chapters[id];
  },

  /** 当前委托（null 表示还没解锁或全部完成） */
  getActive() {
    if (!this._s || this._s.idx < 0) return null;
    const def = QUEST_CHAPTERS[this._s.idx];
    if (!def) return null;
    return { def, prog: this._ch(def.id) };
  },

  /** 下一章（用于面板预告） */
  getNext() {
    if (!this._s) return null;
    const n = this._s.idx + 1;
    return QUEST_CHAPTERS[n] || null;
  },

  /** 某一章是否已完成 */
  isDone(id) {
    return !!(this._s && this._s.chapters[id] && this._s.chapters[id].done);
  },

  /** 信物背包（用于面板查看） */
  getItems() {
    const out = [];
    if (!this._s) return out;
    Object.keys(QUEST_ITEMS).forEach(k => {
      const n = this._s.items[k] || 0;
      if (n > 0) out.push({ id: k, count: n, def: QUEST_ITEMS[k] });
    });
    return out;
  },

  /** 总计收集的信物件数（成就/面板用） */
  totalItems() {
    return Object.keys(this._s ? this._s.items : {}).reduce((a, k) => a + (this._s.items[k] || 0), 0);
  },

  /** 波次开始：按解锁波次推进到下一章 */
  onWaveStart(wave) {
    if (!this._initd) return;
    const nextIdx = this._s.idx + 1;
    const next = QUEST_CHAPTERS[nextIdx];
    if (!next) return;
    if (wave < next.unlockWave) return;
    // 上一章必须已完成（第一章 idx=-1 视为已完成）
    if (this._s.idx >= 0 && !this._ch(QUEST_CHAPTERS[this._s.idx].id).done) return;
    this._s.idx = nextIdx;
    this._ch(next.id);
    // 接取演出：先章节卡，再交对话
    if (typeof showActCard === 'function') showActCard(next.act, next.title, '新委托 · ' + next.from + ' 的请求');
    setTimeout(() => {
      if (typeof showStoryDialog === 'function') showStoryDialog(next.hook);
    }, 2500);
    if (typeof setTip === 'function') setTip('📜 新委托【' + next.title + '】——击杀 ' + (ENEMY_DEFS[next.enemy] ? ENEMY_DEFS[next.enemy].name : next.enemy) + '，收集 ' + next.need + ' 个' + QUEST_ITEMS[next.item].name, 8);
    EventBus.emit('quest:accept', next);
  },

  /** 击杀梦魇：判定掉落与完成 */
  onEnemyKilled(enemy) {
    if (!this._initd || !enemy || !enemy.def) return;
    const act = this.getActive();
    if (!act) return;
    const { def, prog } = act;
    const isTarget = enemy.type === def.enemy || (def.enemy === 'boss' && enemy.boss);
    if (!isTarget) return;
    if (prog.done) return;

    prog.kills++;
    const itemDef = QUEST_ITEMS[def.item];
    // 掉率 + 4 次保底：避免运气差卡住主线
    prog.pity++;
    const luck = prog.pity >= 4 || Math.random() < def.dropRate * (enemy.elite ? 1.8 : 1);
    if (luck) {
      prog.pity = 0;
      prog.items++;
      this._s.items[def.item] = (this._s.items[def.item] || 0) + 1;
      if (typeof addText === 'function') {
        addText(enemy.x, enemy.y - 34, itemDef.icon + ' ' + itemDef.name + '（' + prog.items + '/' + def.need + '）', '#ffd166', true);
      }
      if (typeof spawnParts === 'function') {
        spawnParts(enemy.x, enemy.y, 14, '#ffd166', 3, 0.7);
        spawnParts(enemy.x, enemy.y, 6, '#ffffff', 2, 0.4);
      }
      if (typeof SFX !== 'undefined' && SFX.coin) SFX.coin();
      // 每拿到一件就推进一次"快要集齐"的提示
      if (prog.items === def.need - 1 && typeof setTip === 'function') {
        setTip('📜 只差最后一件：' + itemDef.name, 5);
      }
      EventBus.emit('quest:item', { questId: def.id, item: def.item, have: prog.items, need: def.need });
    }
    if (prog.items >= def.need && !prog.done) this._complete(def, prog);
  },

  /** 凑齐 → 结算奖励 → 完结演出 → 推进下一章 */
  _complete(def, prog) {
    prog.done = true;
    this._s.chapters[def.id] = prog;
    // 奖励统一走 core.js 的文案解释器，避免"说了给却没给"
    if (typeof applyStoryEffect === 'function') {
      try { applyStoryEffect(def.rewardText); } catch (e) { console.warn('QuestSystem reward:', e); }
    }
    // 解锁记忆碎片
    if (def.fragment && typeof DreamFragments !== 'undefined' && DreamFragments.collectFragment) {
      try {
        const has = DreamFragments._collected && DreamFragments._collected.has(def.fragment);
        if (!has) DreamFragments.collectFragment(def.fragment);
      } catch (e) { console.warn('QuestSystem fragment:', e); }
    }
    if (typeof checkAchievements === 'function') checkAchievements();
    if (typeof SFX !== 'undefined' && SFX.achieve) SFX.achieve();
    if (typeof shakeBy === 'function') shakeBy(6);
    EventBus.emit('quest:complete', def);

    // 完结演出：幕卡 → 结局对话
    setTimeout(() => {
      if (typeof showActCard === 'function') showActCard(def.act, def.title, '委托完成 · 真相又近了一步');
    }, 700);
    setTimeout(() => {
      if (typeof showStoryDialog === 'function') showStoryDialog(def.done);
    }, 2400);

    // 全部完成
    if (this._s.idx >= QUEST_CHAPTERS.length - 1) {
      this._s.finished = true;
      setTimeout(() => {
        if (typeof showStoryDialog === 'function') {
          showStoryDialog({
            speaker: '旁白',
            text: '六件信物，六个夜晚。\n你终于把这场梦完整地读了一遍。\n'
                + '从今往后，梦魇再来，你不再问"为什么是我"——因为你知道答案了。\n'
                + '（梦境委托 · 全篇终）',
          });
        }
      }, 6000);
    }
  },

  /** 面板用的完整进度快照 */
  getSnapshot() {
    if (!this._s) this._s = this.blank();
    const act = this.getActive();
    const all = QUEST_CHAPTERS.map((c, i) => {
      const pr = this._s.chapters[c.id] || { kills: 0, items: 0, done: false };
      return {
        idx: i, def: c, kills: pr.kills, items: pr.items, done: !!pr.done,
        locked: i > this._s.idx && !pr.done,
        current: i === this._s.idx && !pr.done,
      };
    });
    return {
      active: act ? { def: act.def, kills: act.prog.kills, items: act.prog.items } : null,
      chapters: all,
      items: this.getItems(),
      finished: !!this._s.finished,
      total: QUEST_CHAPTERS.length,
      doneCount: all.filter(a => a.done).length,
    };
  },
};
