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
    desc: '应急灯罩上凝住的雨滴',
    lore: '它不是眼泪，是灯罩从室外带回来的雨水。你把水滴放到灯下，'
        + '墙上的值夜记录显出一小截字：03:07，三人下楼。',
  },
  mirror_shard: {
    name: '裂开的镜片', icon: '🪞', rare: 'rare', from: '镜面梦魇',
    desc: '只能照见床边三人的碎镜',
    lore: '镜片里，小夏、周默和赵磊站在床边，最靠近镜框的位置被裂纹切开。'
        + '你把镜片转向床沿，只看见被子轻轻动了一下，手环上的字迹被裂纹遮住。',
  },
  faded_photo: {
    name: '褪色的合照', icon: '📷', rare: 'rare', from: '治疗梦魇',
    desc: '雨水泡皱、人物模糊的旧照片',
    lore: '照片边缘被雨水泡皱了。几个人影围着一团模糊的白色，像床，也像被折起的纸。'
        + '背面写着：“灯……放好了。”剩下的字被水泡散，无法辨认。',
  },
  broken_pendulum: {
    name: '断裂的钟摆', icon: '⏳', rare: 'epic', from: '时空梦魇',
    desc: '停在断电时刻的摆锤',
    lore: '摆锤卡在 03:07，背面却留着一道新刻的 03:14。'
        + '两道时间中间隔着七分钟。不是钟走错了，是有人把那段等待单独记了下来。',
  },
  blank_letter: {
    name: '空白的信纸', icon: '📄', rare: 'epic', from: '召唤梦魇',
    desc: '写着出发与一段空白的录音便笺',
    lore: '纸面看似空白，斜着迎光才看见几行压痕：“我们去拿灯，很快……”'
        + '后半句被反复擦过，只剩一声模糊的“嗒”，像句号，也像录音机的停止键。',
  },
  last_clock: {
    name: '最后一只闹钟', icon: '🔔', rare: 'legend', from: '梦魇领主',
    desc: '一只没有响过的床头闹钟',
    lore: '背盖里刻着 03:07 和 03:14，中间画着一盏灯。最后一行写到一半：'
        + '“如果他还没醒，就……”后面的字没有补完，像是留给醒来的人自己写。',
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
      text: '你听……走廊尽头有哭声。那些灰白的东西不撞门，只对着门缝反复念着一句听不清的话。\n'
          + '地上有几滴水，像是从应急灯一路滴过来的。能帮我捡回来吗？我想看看灯是不是从那条走廊来的。',
      choices: [
        { text: '我去。你在这别动。', effect: '林小夏好感度 +1' },
        { text: '……哭声？我什么都没听见。', effect: '获得 150 金币（她塞给你的）' },
      ],
    },
    done: {
      speaker: '林小夏',
      text: '三颗……都是雨水。灯罩上也有同样的水痕。\n'
          + '所以那盏灯真的走过这条走廊，不是梦魇捡来的。'
          + '（她把水滴凑近灯光。墙上浮出一行很浅的字：三人下楼。）',
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
      text: '我照了。镜子里的人影总比房间里多一道，又总在我数清之前消失。\n'
          + '换几个角度，裂纹都会刚好挡住那一块。也许镜片坏了，也许有人不想被看见。\n'
          + '（他把镜片收进口袋。）等录音播完，我们再核对记录。',
      choices: [
        { text: '先别急着数。', effect: '解锁记忆碎片，理解加深' },
        { text: '镜子会说谎。别信它。', effect: '扎下心防：全队防御 +15%（本波）' },
      ],
    },
    rewardText: '获得 1200 金币、获得 30 灵魂、所有炮塔射程 +8%（本局）',
    fragment: 'frag_12',
  },
  {
    id: 'q3', act: '第三幕 · 缺席者', title: '被雨水泡皱的合照',
    unlockWave: 17, enemy: 'healer', need: 3, dropRate: 0.34, item: 'faded_photo',
    from: '治疗梦魇',
    hook: {
      speaker: '赵磊',
      text: '哦豁，这次的怪会给人回血——我第一次见敌人比我妈还关心我。\n'
          + '不过说真的，它们身上有照片。几道影子围着一团白色，背后还有没写完的名字。\n'
          + '……帮个忙，弄三张回来。我想知道照片里的人到底在看什么。',
      choices: [
        { text: '我们当然认识。', effect: '赵磊好感度 +1，全队士气 +' },
        { text: '我不确定我们认识。', effect: '获得 300 金币，防御 +10%（本波）' },
      ],
    },
    done: {
      speaker: '赵磊',
      text: '……照片上的人脸全被水泡开了，只剩床头一团暖黄色。\n'
          + '每张照片背面都压着同一句话：“灯放好了……”后面没有写完。\n'
          + '（他难得没讲冷笑话。）小夏，你记得是谁把照片放在这里的吗？',
      choices: [
        { text: '先把照片留着。', effect: '解锁记忆碎片，理解加深' },
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
      text: '走廊尽头的钟停在 03:07。可记录里又出现了 03:14。\n'
          + '取应急灯的三个人说只离开了七分钟；梦里却像等了整整一夜。\n'
          + '把断掉的钟摆找回来，看看究竟是哪段时间被梦藏起来了。',
      choices: [
        { text: '我记得那个时间。', effect: '命运印记：时间线收束' },
        { text: '我不想记得。', effect: '获得 500 金币，防御 +15%（本波）' },
      ],
    },
    done: {
      speaker: '???',
      text: '03:07 和 03:14 都出现在摆锤背面，中间隔着七分钟。\n'
          + '录音里有雨声、脚步声，还有一声很轻的停止键；顺序却被剪乱了。\n'
          + '（声音停顿了很久。）你怕听见的，是空白里真的什么都没有，还是有句话被删掉了？',
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
      text: '召唤梦魇身上带着几张空白便笺。\n'
          + '举到灯下能看见压痕：有人先写了一个时间，下一行却被水痕彻底盖住，最后一句也没有写完。\n'
          + '帮我找四张吧。我想知道，这段空白后面原本写了什么。',
      choices: [
        { text: '你想写给谁？', effect: '林小夏好感度 +1' },
        { text: '先收集，别多想。', effect: '获得 700 金币' },
      ],
    },
    done: {
      speaker: '林小夏',
      text: '拼出来了。\n'
          + '“03:07……”\n'
          + '“灯……”\n'
          + '（她把四张纸按顺序排好，手指停在被水泡开的最后一行。）\n'
          + '压痕到这里就断了。谁也不知道后面原本写了什么，只能听见纸背留下的一声轻响。',
      choices: [
        { text: '我想亲自听完录音。', effect: '解锁记忆碎片，理解加深' },
        { text: '我还没准备好听完。', effect: '获得 1500 金币，全队防御 +20%（本波）' },
      ],
    },
    rewardText: '获得 6000 金币、获得 120 灵魂、所有炮塔伤害 +10%（本局）',
    fragment: 'frag_13',
  },
  {
    id: 'q6', act: '终幕 · 亲口回答', title: '最后一只闹钟',
    unlockWave: 55, enemy: 'boss', need: 1, dropRate: 1, item: 'last_clock',
    from: '梦魇领主',
    hook: {
      speaker: '周默',
      text: '最大的梦魇手里有一只闹钟。指针停在 03:07，背盖却刻着另一个时间：03:14。\n'
          + '那七分钟里，录音留下了脚步、雨声和一段被剪掉的空白。\n'
          + '拿到闹钟。也许它能让我们听见被删掉的那一句。',
      choices: [
        { text: '我要醒。', effect: '决心：所有伤害 +10%（本局）' },
        { text: '我要先弄清楚全部真相。', effect: '获得 2000 金币，防御 +20%（本波）' },
      ],
    },
    done: {
      speaker: '???',
      text: '你拿到它了。\n'
          + '背盖里没有诅咒，只有一行没写完的话：“灯放好了。如果……”\n'
          + '赵磊说：“我记得后面还有一句。”小夏看向床头，周默却把录音机递给你。\n'
          + '屏幕停在 03:14，播放键没有按下。镜子里的人影都望向你，但谁也没有替你伸手。\n'
          + '你想先听哪一段？',
      choices: [
        { text: '先听留言，再亲口回答。', effect: '解锁最终记忆碎片，理解已达终点' },
        { text: '先把闹钟按停。', effect: '获得 10000 金币与结局印记' },
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
    G.quest = this.normalizeState(G.quest);
    this._s = G.quest;
    this._initd = true;
    EventBus.emit('quest:init', this.getActive());
  },

  blank() {
    return { idx: -1, chapters: {}, items: {}, finished: false };
  },

  /** 规整导入或损坏的进度对象，避免初始化任务时因缺少嵌套字段而中断读档。 */
  normalizeState(raw) {
    const out = this.blank();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

    const idx = raw.idx;
    out.idx = Number.isInteger(idx) && idx >= -1 && idx < QUEST_CHAPTERS.length ? idx : -1;
    const count = value => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.min(999999, Math.max(0, Math.floor(n))) : 0;
    };

    if (raw.chapters && typeof raw.chapters === 'object' && !Array.isArray(raw.chapters)) {
      QUEST_CHAPTERS.forEach(def => {
        const progress = raw.chapters[def.id];
        if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return;
        out.chapters[def.id] = {
          kills: count(progress.kills),
          items: count(progress.items),
          pity: Math.min(3, count(progress.pity)),
          done: progress.done === true,
        };
      });
    }
    if (raw.items && typeof raw.items === 'object' && !Array.isArray(raw.items)) {
      Object.keys(QUEST_ITEMS).forEach(id => { out.items[id] = count(raw.items[id]); });
    }
    out.finished = raw.finished === true;
    return out;
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
            text: '六件信物，六段被雨声隔开的记忆。\n你把 03:07 到 03:14 的线索重新排好，却没有替那晚的自己编一个完美答案。\n'
                + '录音还在。床头灯也还亮着。下一次开口，由你自己决定。\n'
                + '（梦境委托 · 暂告一段落）',
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
