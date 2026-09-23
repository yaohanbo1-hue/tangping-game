function cellFromXY(x, y) {
  if (x < ROOM_X0 || x > ROOM_X1 || y < ARENA_TOP || y > ARENA_BOT) return null;
  return { c: clamp(Math.floor((x - ROOM_X0) / CW), 0, COLS - 1), r: clamp(Math.floor((y - ARENA_TOP) / CH), 0, ROWS - 1) };
}
function toCanvas(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}
cv.addEventListener('mousemove', e => {
  const p = toCanvas(e); mouse.x = p.x; mouse.y = p.y; hoverCell = cellFromXY(p.x, p.y);
});
cv.addEventListener('mouseleave', () => { hoverCell = null; mouse.x = -999; });
cv.addEventListener('click', e => {
  SFX.init();
  const p = toCanvas(e), x = p.x, y = p.y;
  if (x > WALL_X - 44 && x < ROOM_X0 + 30) {
    for (const D of G.doors) {
      const L = LANES[D.lane];
      if (Math.abs(y - D.y) < L.doorHalf + 12) { selected = { isDoor: true, door: D }; selectedBuildKey = null; syncCards(); return; }
    }
  }
  const cell = cellFromXY(x, y);
  if (!cell) { selected = null; selectedBuildKey = null; syncCards(); return; }
  if (inBed(cell.c, cell.r)) { selected = { isBed: true }; selectedBuildKey = null; syncCards(); return; }
  const occ = G.grid[cell.r * COLS + cell.c];
  if (occ && occ !== 'bed') { selected = occ; selectedBuildKey = null; syncCards(); return; }
  if (selectedBuildKey) {
    if (Cmd.build(selectedBuildKey, cell.c, cell.r)) {   // 经命令层派发（联机时客机只发意图）
      if (!canAfford(BUILD_DEFS[selectedBuildKey].cost)) { selectedBuildKey = null; syncCards(); }
    }
    return;
  }
  selected = null;
});
cv.addEventListener('contextmenu', e => { e.preventDefault(); selectedBuildKey = null; selected = null; syncCards(); });
const SKILL_MAP = { q: 'meteor', w: 'freeze', e: 'overclock', r: 'mend', t: 'repel', f: 'siphon' };
window.addEventListener('keydown', e => {
  const target = e.target;
  if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  const k = e.key;
  if (k === 'Escape') {
    selectedBuildKey = null; selected = null; syncCards();
    ['techPanel', 'achPanel', 'helpPanel', 'lotPanel'].forEach(p => $(p).classList.remove('open'));
    if ($('itemDetail') && $('itemDetail').classList.contains('show')) { closeQuestItem(); return; }
    ['questPanel', 'runePanel'].forEach(p => { if ($(p) && $(p).classList.contains('open')) togglePanel(p); });
    return;
  }
  if (k === ' ') { e.preventDefault(); Cmd.skipPrep(); return; }
  if (k === 'p' || k === 'P') { paused = !paused; $('btnPause').textContent = paused ? '▶' : '⏸'; return; }
  const sk = SKILL_MAP[k.toLowerCase()];
  if (sk) { Cmd.skill(sk); return; }
  const bk = BUILD_KEYS.find(key => BUILD_DEFS[key].key === k);
  if (bk) { selectBuild(bk); return; }
  if (k === 'u' || k === 'U') { Cmd.upgradeSelection(selected); return; }
  if (k === 'x' || k === 'X') { Cmd.sellSelection(selected); return; }
  if (k === 'b' || k === 'B') { togglePanel('lotPanel'); return; }
  if (k === 'g' || k === 'G') { togglePanel('runePanel'); return; }
  if (k === 'l' || k === 'L') { togglePanel('questPanel'); return; }
  if (k === 'k' || k === 'K') { toggleSavePanel(); return; }
  if (k === 's' || k === 'S') { if (saveGame(0)) { setTip('💾 已保存到自动存档', 3); SFX.coin(); } return; }
  if (k.toLowerCase() === 'm') {
    if (e.shiftKey) Cmd.upgradeAllMax();
    else Cmd.maxSelection(selected);
    return;
  }
});
function bindUI() {
  $('btnSkip').onclick = () => Cmd.skipPrep();
  $('btnSkip2').onclick = () => Cmd.skipPrep();
  $('btnTech').onclick = () => togglePanel('techPanel');
  $('btnTech2').onclick = () => togglePanel('techPanel');
  $('btnAch').onclick = () => togglePanel('achPanel');
  $('btnHelp').onclick = () => togglePanel('helpPanel');
  $('btnLot').onclick = () => togglePanel('lotPanel');
  $('btnLot2').onclick = () => togglePanel('lotPanel');
  $('lotClose').onclick = () => $('lotPanel').classList.remove('open');
  $('btnDraw1').onclick = () => doDraw(1, 'gold');
  $('btnDraw10').onclick = () => doDraw(10, 'gold');
  $('btnDrawS').onclick = () => doDraw(1, 'soul');
  $('btnUpAll').onclick = () => Cmd.upgradeAll(false);
  $('runeClose').onclick = () => togglePanel('runePanel');
  if ($('btnQuest')) $('btnQuest').onclick = () => togglePanel('questPanel');
  if ($('questClose')) $('questClose').onclick = () => togglePanel('questPanel');
  if ($('itemClose')) $('itemClose').onclick = () => closeQuestItem();
  if ($('hudQuest')) $('hudQuest').onclick = () => togglePanel('questPanel');
  $('btnRune').onclick = () => togglePanel('runePanel');
  $('btnMaxSel').onclick = () => { if (selected) Cmd.maxSelection(selected); else setTip('请先点击一个建筑、床或门', 3); };
  $('btnMaxAll').onclick = () => Cmd.upgradeAllMax();
  $('btnUpTower').onclick = () => Cmd.upgradeAll(true);
  $('btnHelp2').onclick = () => togglePanel('helpPanel');
  $('btnPause').onclick = () => { paused = !paused; $('btnPause').textContent = paused ? '▶' : '⏸'; };
  $('btnSound').onclick = () => { SFX.on = !SFX.on; $('btnSound').textContent = SFX.on ? '🔊' : '🔇'; };
  $('btnSpeed').onclick = () => { timeScale = timeScale === 1 ? 2 : timeScale === 2 ? 3 : 1; $('btnSpeed').textContent = timeScale + '×'; };
  $('btnSave').onclick = () => toggleSavePanel();
  if ($('saveClose')) $('saveClose').onclick = () => closeSavePanel();
  if ($('svImport')) $('svImport').onclick = () => { const f = $('svFile'); if (f) f.click(); };
  if ($('svFile')) $('svFile').onchange = (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    // 导到第一个空的手动槽，满了就覆盖槽 1
    let slot = 1;
    const list = SaveSystem.list();
    const empty = list.find(s => s.slot >= 1 && !s.info);
    if (empty) slot = empty.slot;
    SaveSystem.importFile(file, slot, r => {
      if (r.ok) { renderSavePanel(); svToast('📥 已导入到槽 ' + slot + '（第 ' + (r.meta ? r.meta.wave : '?') + ' 波）'); SFX.achieve(); }
      else svToast('❌ 导入失败：' + (r.reason === 'invalid' ? '存档结构异常' : r.reason === 'json' ? '不是合法 JSON' : '文件不可读'), 'err');
    });
    ev.target.value = '';
  };
  if ($('svWipe')) $('svWipe').onclick = () => {
    if (!window.__svWipeArmed) { window.__svWipeArmed = 1; svToast('⚠️ 再点一次确认清空全部槽位', 'warn'); setTimeout(() => window.__svWipeArmed = 0, 4000); return; }
    window.__svWipeArmed = 0;
    for (let s = 0; s <= SaveSystem.SLOTS; s++) SaveSystem.remove(s);
    renderSavePanel(); svToast('🗑 已清空全部槽位');
  };
  $('techClose').onclick = () => $('techPanel').classList.remove('open');
  $('achClose').onclick = () => $('achPanel').classList.remove('open');
  $('helpClose').onclick = () => $('helpPanel').classList.remove('open');
}
function buildHelp() {
  const el = $('helpBody');
  el.innerHTML =
    '<h4>伤害类型克制</h4>' +
    '<table class="htab"><tr><th>类型</th><th>来源</th><th>克制</th><th>被抗</th></tr>' +
    '<tr><td style="color:#9ef01a">🔫 动能</td><td>机枪塔</td><td>飞行怪 +45%</td><td>重甲 -45%</td></tr>' +
    '<tr><td style="color:#7fdfff">❄️ 冰霜</td><td>冰霜塔</td><td>自爆、狂暴 +50%</td><td>吸血 -40%</td></tr>' +
    '<tr><td style="color:#ff5d8f">🔆 能量</td><td>激光塔</td><td>重甲、吸血 +35%</td><td>盾卫 -50%</td></tr>' +
    '<tr><td style="color:#c77dff">⚡ 电磁</td><td>电磁塔</td><td>盾卫 +55%</td><td>—</td></tr>' +
    '<tr><td style="color:#ff8c42">🔥 火焰</td><td>火焰塔</td><td>幽灵、治疗 +40%</td><td>自爆 -50%</td></tr>' +
    '</table>' +
    '<div class="hnote">右下角圆点标示炮塔的伤害类型。抗性可被「能量超载」科技削减。</div>' +
    '<h4>精英词缀</h4><div class="afflist">' +
    AFFIX_KEYS.map(k => '<span class="aff" style="border-color:' + AFFIX[k].color + '55">' + AFFIX[k].icon + ' <b style="color:' + AFFIX[k].color + '">' + AFFIX[k].name + '</b> ' + AFFIX[k].desc + '</span>').join('') +
    '</div>' +
    '<h4>敌人特殊机制</h4><div class="afflist">' +
    '<span class="aff">🦔 <b>钻地</b> 无视铁门，直接从地下潜入房间</span>' +
    '<span class="aff">📴 <b>EMP</b> 周期性瘫痪附近炮塔数秒，优先集火</span>' +
    '<span class="aff">🎭 <b>拟态</b> 未靠近建筑时无法被锁定</span>' +
    '<span class="aff">☠️ <b>诅咒</b> 死亡后留下持续伤害建筑的区域</span>' +
    '<span class="aff">🪱 <b>寄生</b> 附着炮塔持续吸血直至摧毁</span>' +
    '<span class="aff">👁️ <b>守望</b> 为周围友军持续附加护盾</span>' +
    '<span class="aff">💀 <b>亡魂复活</b> 定期复活小怪</span>' +
    '<span class="aff">🐺 <b>霜噬</b> 减速附近炮塔射速</span>' +
    '<span class="aff">⚔️ <b>建筑克星</b> 对建筑造成数倍伤害（战争机器 / 收割者 / 深渊巨口）</span>' +
    '</div>' +
    '<h4>元素反应</h4><div class="afflist">' +
    '<span class="aff">💨 <b>蒸汽爆破</b>：火焰 + 冰霜 → 瞬间汽化，额外伤害</span>' +
    '<span class="aff">💥 <b>过载爆轰</b>：电磁 + 火焰 → 小范围爆炸</span>' +
    '<span class="aff">☠️ <b>剧毒燃烧</b>：剧毒 + 火焰 → 毒层翻倍并持续灼烧</span>' +
    '<span class="aff">⚡ <b>超导易伤</b>：冰霜 + 电磁 → 受到伤害提升</span>' +
    '<span class="aff">🧊 <b>寒霜结晶</b>：剧毒 + 冰霜 → 定身梦魇</span>' +
    '<span class="aff">🧬 <b>能量腐蚀</b>：能量 + 剧毒 → 永久降低全抗性</span>' +
    '</div>' +
    '<h4>炮塔共鸣</h4><div class="afflist">' +
    '<span class="aff">🎵 <b>相邻不同元素炮塔互相增幅</b>：2 种 +12% 伤害；3 种 +26% 伤害/射速 +10%；最高 6 种 +85% 伤害/射速 +34%</span>' +
    '<span class="aff">📍 <b>怎么看出来</b>：正在共鸣的炮塔会亮起一圈<b>虚线光环</b>，格子左上角显示 <b>🎵元素种类数</b>；点开建筑详情可看到具体倍率与附加效果</span>' +
    '<span class="aff">🔥 <b>爆燃弹药</b>：动能 + 火焰 → 攻击附加灼烧</span>' +
    '<span class="aff">⚡ <b>导电冰霜</b>：冰霜 + 电磁 → 攻击附带小范围溅射</span>' +
    '<span class="aff">🧬 <b>腐蚀光斑</b>：能量 + 剧毒 → 攻击削减敌人抗性</span>' +
    '<span class="aff">☠️ <b>毒焰</b>：火焰 + 剧毒 → 攻击附加毒层</span>' +
    '<span class="aff">🧊 <b>碎冰弹</b>：冰霜 + 动能 → 概率定身</span>' +
    '<span class="aff">🌩️ <b>弧光场</b>：能量 + 电磁 → 攻击额外弹射一个目标</span>' +
    '</div>' +
    '<h4>新增炮塔</h4><div class="afflist">' +
    '<span class="aff">🧪 <b>毒液喷射塔</b>：叠加毒层持续掉血，无视护盾侵蚀生命</span>' +
    '<span class="aff">📢 <b>声波共振塔</b>：扇形声波同时打击射程内全部梦魇并击退</span>' +
    '<span class="aff">🚀 <b>导弹发射塔</b>：追踪导弹，命中后大范围爆炸</span>' +
    '<span class="aff">🕳️ <b>引力奇点塔</b>：持续拉扯敌人聚拢并大幅减速（控场）</span>' +
    '<span class="aff">🔺 <b>棱镜分裂塔</b>：光束分裂，一次攻击打击多个目标</span>' +
    '</div>' +
    '<h4>新增梦魇</h4><div class="afflist">' +
    '<span class="aff">🪞 <b>镜面</b>：反弹 28% 远程伤害给开火的炮塔</span>' +
    '<span class="aff">🦠 <b>窃金</b>：每次攻击窃取你当前金币的 6%</span>' +
    '<span class="aff">⏳ <b>时空</b>：光环内友军移速 +50%</span>' +
    '<span class="aff">🚫 <b>虚无</b>：光环内炮塔伤害 -55%</span>' +
    '<span class="aff">🗿 <b>巨像</b>：三段护盾，每段需持续输出打破</span>' +
    '<span class="aff">🔧 <b>破坏</b>：无视铁门，直扑你的建筑</span>' +
    '<span class="aff">🧬 <b>适应</b>：每次受伤对该伤害类型产生抗性（最高 70%）</span>' +
    '<span class="aff">🐝 <b>孵化母虫</b>：持续孵化梦魇幼虫</span>' +
    '</div>' +
    '<h4>符文系统</h4><div class="afflist">' +
    '<span class="aff">🔮 <b>掉落</b>：击杀梦魇有几率掉落符文，波次越高掉率与品质越好</span>' +
    '<span class="aff">🎨 <b>五档品质</b>：普通(1词条) 精良(2) 稀有(2) 史诗(3) 传说(4)，品质越高数值越强</span>' +
    '<span class="aff">💠 <b>镶嵌</b>：每座建筑 2 个符文槽（符文宗师每级 +1），按 <b>G</b> 打开背包镶嵌</span>' +
    '<span class="aff">⬆️ <b>强化</b>：消耗灵魂强化符文，每级效果 +12%；多余符文可分解换灵魂</span>' +
    '<span class="aff">📋 <b>词条</b>：伤害 / 射速 / 射程 / 暴击率 / 暴击伤害 / 穿透 / 减速 / 金币 / 发电</span>' +
    '</div>' +
    '<h4>波次挑战</h4><div class="afflist">' +
    '<span class="aff">⚡ <b>疾风清场</b>：限时清波　🚪 <b>铁壁无损</b>：门不受伤　🧱 <b>秋毫无犯</b>：不损建筑</span>' +
    '<span class="aff">🔥 <b>烈焰专精</b>：火焰击杀数　🤫 <b>静默作战</b>：不用技能　🗡️ <b>连环斩杀</b>：连杀数</span>' +
    '<span class="aff">🎁 达成奖励大量灵魂，HUD 实时显示进度</span>' +
    '</div>' +
    '<h4>胜负条件</h4><div class="afflist">' +
    '<span class="aff">💀 <b>失败</b>：床铺生命归零，美梦被打断</span>' +
    '<span class="aff">👑 <b>胜利</b>：第 <b>60 波</b>击败最终 BOSS【终焉梦魇】即可通关，之后可继续无尽模式</span>' +
    '<span class="aff">😈 <b>BOSS 轮换</b>：梦魇领主 → 深渊巨口 → 机械核心 → 虚空之影 →（终焉梦魇）</span>' +
    '</div>' +
    '<h4>敌人图鉴</h4><div class="afflist">' +
    Object.keys(ENEMY_DEFS).map(k => {
      const d = ENEMY_DEFS[k];
      const rw = [];
      if (d.res) Object.keys(d.res).forEach(t => rw.push('<i style="color:#8ef6ff">' + DMG[t].icon + '-' + (d.res[t] * 100) + '%</i>'));
      if (d.weak) Object.keys(d.weak).forEach(t => rw.push('<i style="color:#ffe066">' + DMG[t].icon + '+' + (d.weak[t] * 100) + '%</i>'));
      const sp = [];
      if (d.flying) sp.push('飞行·无视门'); if (d.stealth) sp.push('隐身'); if (d.heal) sp.push('治疗光环');
      if (d.burrow) sp.push('钻地·无视门'); if (d.emp) sp.push('EMP瘫痪'); if (d.mimic) sp.push('拟态');
      if (d.curse) sp.push('亡语诅咒'); if (d.parasite) sp.push('寄生'); if (d.ward) sp.push('守望护盾');
      if (d.revive) sp.push('亡魂复活'); if (d.freezeTower) sp.push('冻结炮塔'); if (d.swarm) sp.push('群体');
      if (d.buildingBonus) sp.push('建筑克星x' + d.buildingBonus); if (d.devour) sp.push('吞噬');
      if (d.summon) sp.push('召唤'); if (d.split) sp.push('分裂'); if (d.explode) sp.push('自爆');
      if (d.shieldself) sp.push('自带护盾'); if (d.vamp) sp.push('吸血'); if (d.frenzy) sp.push('残血狂暴');
      return '<span class="aff">' + d.icon + ' <b>' + d.name + '</b> ' + rw.join(' ') + (sp.length ? ' <em>' + sp.join('·') + '</em>' : '') + '</span>';
    }).join('') +
    '</div>' +
    '<h4>经济规则</h4><div class="hnote">' +
    '<b>所有建筑</b>：每升 1 级，花费 = 上一级的 <b>2 倍</b><br>' +
    '<b>床 / 矿机</b>：金币产出同样是每级 <b>2 倍</b> —— 成本与产出同步翻倍，' +
    '因此<b>回本周期恒定</b>（床约 35 秒、矿机约 20 秒），什么时候升都不亏，但等级越高占用资金越大<br>' +
    '<b>炮塔 / 门 / 其他</b>：属性按<b>原线性设计</b>成长，但成本同样翻倍 —— ' +
    '所以它们的升级性价比会随等级下降，高级升级是<b>奢侈品</b>，通常优先铺数量<br>' +
    '<b>结论</b>：金币靠升床/矿机滚雪球，火力靠多建塔而非硬升一座' +
    '</div>' +
    '<h4>电力规则</h4><div class="hnote">' +
    '<b>开局 0 金币、0 电量</b> —— 一切都得从零攒起<br>' +
    '<b>电量 = 第二种货币</b>：只用于 <b>Lv8 以上升级</b>，与机器能否运行完全无关<br>' +
    '<b>持续发电来源 = 发电机</b>：每级发电速率 x2，升级永不耗电；局内摇奖也能一次性补电<br>' +
    '<b>炮塔</b>：建造与运行均不耗电，<b>没电也照常开火</b><br>' +
    '开局提示：先靠床的金币产出攒钱，尽快建出第一台发电机' +
    '</div>' +
    '<h4>操作</h4><div class="hnote">' +
    '1-9/0/- 选择建筑并点击空位建造 · 点击已有建筑/铁门/床铺查看与升级<br>' +
    'Q/W/E/R/T/F 释放技能 · 空格 提前召唤下一波 · P 暂停 · 右键/ESC 取消<br>' +
    '建筑 / 床 / 铁门均可升到 <b>50 级</b>，<b>每级都有专属名字</b>（如激光塔 → 末影激光塔）<br>' +
    '<b>U</b> 升级选中 · <b>M</b> 升满选中 · <b>Shift+M</b> 全体升满 · <b>X</b> 出售选中<br>' +
    '床躺着不再自动涨金币 —— 想提高产出就必须<b>升级床</b>；躺平改为累积「发育」提升灵魂获取<br>' +
    '铁门 50 级终极形态为 <b>金钟罩</b><br>' +
    '建筑达到 Lv' + BRANCH_AT + ' 可在详情面板转职（二选一），转职后属性大幅提升<br>' +
    '进度每波自动保存，也可手动点 💾 保存；开局可选择「继续梦境」' +
    '</div>';
}
// 屏幕适配
function fit() {
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  const wrap = document.getElementById('wrap');
  wrap.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
}
function fitHUD() {
  var h = document.getElementById('hud');
  h.classList.remove('compact', 'ultra');
  if (h.scrollWidth > h.clientWidth + 1) h.classList.add('compact');
  if (h.scrollWidth > h.clientWidth + 1) h.classList.add('ultra');
}
function applyCompactBar() {
  var bar = document.getElementById('buildBar'); if (!bar) return;
  var cards = bar.children; if (!cards.length) return;
  var available = bar.clientWidth - 10;
  var need = cards.length * 88 + (cards.length - 1) * 6;
  // 卡片最少可压到 54px：只要放得下就整行均分，避免底部出现横向滚动条
  var minNeed = cards.length * 54 + (cards.length - 1) * 4;
  if (available >= need || available >= minNeed) { bar.classList.add('wide'); } else { bar.classList.remove('wide'); }
}
function updateBuildBarOverflow() {
  var el = document.getElementById('buildBar'); if (!el) return;
  requestAnimationFrame(function () {
    if (el.scrollWidth > el.clientWidth + 1) el.classList.add('canScroll');
    else el.classList.remove('canScroll');
  });
}
function scrollBuildKeyIntoView(k) {
  var el = document.getElementById('buildBar'); if (!el) return;
  var card = el.querySelector('.card[data-k="' + k + '"]');
  if (card && card.scrollIntoView) card.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
}
window.addEventListener('resize', function () { fit(); fitHUD(); updateBuildBarOverflow(); applyCompactBar(); });
fit(); fitHUD(); updateBuildBarOverflow(); applyCompactBar();

let last = performance.now();
const FIXED_DT = 1 / 60;   // 固定模拟步长（联机/复现的前提：模拟结果与帧率无关）
let simAcc = 0;
function loop(now) {
  // 先把下一帧排上：任何一帧里抛出的异常都不会再让主循环「静默死掉」——
  // 之前 render() 里一个 NaN 半径（过载爆轰的 boom 缺 max 字段）就能把整个游戏永久冻结。
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000; last = now;
  if (!isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 0.25);          // 切后台回来不要一次追几百帧
  T += dt;
  // 面板属性缓存按帧失效：一帧内（含 2×/3× 倍速的多次 step）bstat 只算一次
  statFrame++;
  try {
    // 固定步长累加器：无论 30/60/144Hz，模拟都按 1/60 秒推进，帧率只影响画面平滑度
    if (G && !G.over && !paused) {
      simAcc += dt * timeScale;
      let n = 0;
      while (simAcc >= FIXED_DT && n < 15) { step(FIXED_DT); simAcc -= FIXED_DT; n++; }
      if (n >= 15) simAcc = 0;      // 追不上就丢掉欠帧，避免雪崩
    } else simAcc = 0;
    if (G) { render(); updateHUD(dt); }
  } catch (err) {
    if (G) G.loopErrors = (G.loopErrors || 0) + 1;
    console.error('[loop]', err);
  }
}
let LAST_SAVE = null;
function init() {
  newGame();
  buildBuildBar(); buildSkillBar(); buildTechPanel(); buildAchPanel(); buildHelp(); buildLottery(); bindUI();
  paused = true;
  $('bestWave').textContent = +Store.get('tangping_best', 0) || 0;
  const sv = loadSave();
  $('btnContinue').style.display = sv && sv.wave > 0 ? '' : 'none';
  if (sv && sv.wave > 0) $('saveInfo').textContent = '存档：第 ' + sv.wave + ' 波 · ' + (sv.buildings ? sv.buildings.length : 0) + ' 座建筑';
  LAST_SAVE = sv;
  MENU_HTML = $('overlay').innerHTML;
  wireMenu();
  wireDreamMenuButtons();
  initDreamUI();
  showMenu();
  requestAnimationFrame(loop);
}
init();
