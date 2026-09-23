const $ = id => document.getElementById(id);
let hudT = 0;
function buildBuildBar() {
  const el = $('buildBar'); el.innerHTML = '';
  BUILD_KEYS.forEach(k => {
    const d = BUILD_DEFS[k];
    const c = document.createElement('div');
    c.className = 'card'; c.dataset.k = k;
    const dt = d.dmgType
      ? '<div class="dt" style="color:' + DMG[d.dmgType].color + '"><i>' + DMG[d.dmgType].icon + '</i>' + DMG[d.dmgType].name + '</div>'
      : '<div class="dt generic"><i>🔌</i>免电</div>';
    c.style.setProperty('--dc', (d.dmgType && DMG[d.dmgType].color) || d.color || '#8b8bd6');
    const dps1 = d.tower ? towerPanelDps(d.stat(1), { type: k }) : 0;
    c.innerHTML = '<div class="ico">' + d.icon + '</div><div class="nm">' + d.name + '</div>' + dt +
      (dps1 ? '<div class="dps">' + fmt1(dps1) + ' DPS</div>' : '') +
      '<div class="pr"><span class="g">' + fmt(d.cost.gold) + '💰</span></div>' +
      '<div class="kb">' + d.key + '</div><div class="cnt"></div>';
    // 悬停提示里补上面板 DPS —— 建造栏太窄，塞不下更多数字
    let tip = d.name + '：' + d.desc + '（建造不消耗电力）';
    if (d.tower) {
      if (dps1) tip += '\nLv1 面板 DPS ≈ ' + fmt1(dps1) + '/秒';
    }
    c.title = tip;
    c.onclick = () => selectBuild(k);
    el.appendChild(c);
  });
  if (typeof updateBuildBarOverflow === 'function') updateBuildBarOverflow();
  // 卡片是初始化之后才生成的，这里必须再跑一次宽度判定，否则永远不会进入 wide 均分模式
  if (typeof applyCompactBar === 'function') applyCompactBar();
}
function buildSkillBar() {
  const el = $('skillBar'); el.innerHTML = '';
  SKILL_KEYS.forEach(k => {
    const s = SKILL_DEFS[k];
    const b = document.createElement('div');
    b.className = 'skill'; b.dataset.k = k;
    b.innerHTML = '<div class="sico">' + s.icon + '</div><div class="scd"></div><div class="skey">' + s.key + '</div>';
    b.title = s.name + '：' + s.desc + '（冷却 ' + s.cd + 's）';
    b.onclick = () => Cmd.skill(k);
    el.appendChild(b);
  });
}
function buildTechPanel() {
  const el = $('techList'); el.innerHTML = '';
  [1, 2, 3].forEach(tier => {
    const h = document.createElement('div');
    h.className = 'tierh'; h.textContent = tier === 1 ? '第一层' : tier === 2 ? '第二层（需前置）' : '第三层（需前置）';
    el.appendChild(h);
    TECH_KEYS.filter(k => TECH_DEFS[k].tier === tier).forEach(k => {
      const d = TECH_DEFS[k];
      const r = document.createElement('div');
      r.className = 'tech'; r.dataset.k = k;
      const reqTxt = d.req ? Object.keys(d.req).map(rk => TECH_DEFS[rk].name + ' Lv' + d.req[rk]).join('、') : '';
      r.innerHTML = '<div class="tico">' + d.icon + '</div><div class="tinfo"><div class="tn"><span>' + d.name + '</span><b class="tlv">0/' + d.max + '</b></div>' +
        '<div class="td">' + d.desc + (reqTxt ? '<br><i class="req">需要 ' + reqTxt + '</i>' : '') + '</div><div class="tbar"><i></i></div></div><button class="tbtn">0🔮</button>';
      r.querySelector('.tbtn').onclick = () => buyTech(k);
      el.appendChild(r);
    });
  });
}
function buildAchPanel() {
  const el = $('achList'); el.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const d = document.createElement('div');
    d.className = 'ach'; d.dataset.k = a.id;
    d.innerHTML = '<div class="aico">' + (G.ach[a.id] ? '🏆' : '🔒') + '</div>' +
      '<div class="ainfo"><div class="an">' + a.name + '</div><div class="ad">' + a.desc + '</div></div>' +
      '<div class="arw">' + (a.reward.soul ? a.reward.soul + '🔮' : '') + (a.reward.gold ? a.reward.gold + '💰' : '') + '</div>';
    el.appendChild(d);
  });
}
function selectBuild(k) {
  // 费用不足：不选中，抖动 + 错误音 + 提示（判定与 tryBuild/灰显一致：建造只比金币）
  if (selectedBuildKey !== k && !G.admin && G.gold < BUILD_DEFS[k].cost.gold) {
    SFX.err();
    setTip('资源不足：' + BUILD_DEFS[k].name + ' 需要 ' + fmt(BUILD_DEFS[k].cost.gold) + '💰', 3);
    const card = $('buildBar').querySelector('.card[data-k="' + k + '"]');
    if (card) { card.classList.remove('deny'); void card.offsetWidth; card.classList.add('deny'); }
    return;
  }
  selectedBuildKey = (selectedBuildKey === k) ? null : k;
  selected = null;
  syncCards();
  if (selectedBuildKey) {
    setTip('已选择「' + BUILD_DEFS[k].name + '」，点击房间空位放置。再点一次或按 ESC 取消。', 5);
    if (typeof scrollBuildKeyIntoView === 'function') scrollBuildKeyIntoView(k);
  }
}
function syncCards() {
  $('buildBar').querySelectorAll('.card').forEach(c => c.classList.toggle('sel', c.dataset.k === selectedBuildKey));
}
function techLocked(k) {
  const d = TECH_DEFS[k];
  if (!d.req) return false;
  return Object.keys(d.req).some(rk => G.tech[rk] < d.req[rk]);
}
function buyTech(k) {
  const d = TECH_DEFS[k], lv = G.tech[k];
  if (lv >= d.max) return;
  if (techLocked(k)) { SFX.err(); setTip('前置科技未完成'); return; }
  const c = d.cost(lv);
  if (G.souls < c) { SFX.err(); setTip('灵魂不足，需要 ' + c + '🔮'); return; }
  G.souls -= c; G.tech[k]++;
  SFX.up();
  G.buildings.forEach(b => {
    const nh = buildingMaxHp(b.def, b.level, b.branch);
    b.hp += nh - b.maxHp; b.maxHp = nh;
  });
  G.doors.forEach(d2 => {
    const nh = doorMaxHp(d2.lv);
    d2.hp += nh - d2.maxHp; d2.maxHp = nh;
  });
  setTip(d.name + ' 提升至 Lv.' + G.tech[k], 3);
}
// HUD 数值脉冲：缓存上一帧数值，仅在「金币突增 / 灵魂增加 / 床·门掉血」时短暂切 class
// （金币按阈值判定突增，避免自然产出导致 8Hz 常闪；class 0.65s 后自动移除，不在每帧写 DOM）
let _hudPrev = null;
const _hudFlashT = {};
function _hudFlash(id, cls) {
  const b = $(id); if (!b) return;
  const el = b.parentElement; if (!el || !el.classList || el.classList.contains(cls)) return;
  el.classList.remove('flash-gold', 'flash-red', 'flash-soul');
  void el.offsetWidth; // 强制 reflow 让动画可重新触发
  el.classList.add(cls);
  clearTimeout(_hudFlashT[id]);
  _hudFlashT[id] = setTimeout(() => el.classList.remove(cls), 650);
}
function _hudPulseCheck() {
  const doorHp = G.doors.reduce((s, d) => s + d.hp, 0);
  const cur = { gold: G.gold, souls: G.souls, bedHp: G.bed.hp, doorHp: doorHp };
  if (_hudPrev) {
    const surge = Math.max(50, totalGoldRate() * 0.5);
    if (cur.gold - _hudPrev.gold >= surge) _hudFlash('hudGold', 'flash-gold');
    if (cur.souls > _hudPrev.souls) _hudFlash('hudSouls', 'flash-soul');
    if (cur.bedHp < _hudPrev.bedHp - 0.5) _hudFlash('hudBed', 'flash-red');
    if (cur.doorHp < _hudPrev.doorHp - 0.5) _hudFlash('hudDoor', 'flash-red');
  }
  _hudPrev = cur;
}
function updateHUD(dt) {
  hudT -= dt;
  if (hudT > 0) return;
  hudT = 0.08;
  updateDetail();
  $('hudWave').textContent = G.wave;
  $('hudGold').textContent = G.admin ? '∞' : fmt(G.gold);
  $('hudRate').textContent = '+' + fmt1(totalGoldRate()) + '/s';
  const net = powerNet();
  $('hudPower').textContent = G.admin ? '∞' : fmt(G.power);
  $('hudNet').textContent = (net > 0 ? '+' + fmt(net) + '/s' : '无发电机');
  $('hudNet').className = 'net ' + (net > 0 ? 'ok' : 'bad');
  $('hudPower').title = net > 0
    ? '电量由发电机持续产出；局内摇奖也可一次性补充，只用于 Lv8 以上升级'
    : '当前没有发电机，电量不会自动增长；局内摇奖可一次性补充电力';
  $('hudSouls').textContent = G.admin ? '∞' : fmt(G.souls);
  const doorPct = Math.round(G.doors.reduce((s, d) => s + d.hp / d.maxHp, 0) / 3 * 100);
  const broken = G.doors.filter(d => d.broken).length;
  $('hudDoor').textContent = doorPct + '%';
  $('hudDoor').style.color = broken ? '#f87171' : doorPct < 40 ? '#fbbf24' : '#e6e2ff';
  $('hudBroken').textContent = broken ? '破' + broken : '';
  $('hudBed').textContent = Math.ceil(G.bed.hp);
  $('hudGrow').textContent = G.grow + '/25';
  $('hudEnemies').textContent = G.enemies.length + (G.spawnQueue.length + G.bossQueue.length);
  $('hudTimer').textContent = G.state === 'build' ? Math.ceil(G.prepTimer) + 's' : '作战中';
  $('hudTimer').className = G.state === 'build' ? 'prep' : 'fight';
  const chEl = $('hudChallenge');
  if (chEl) {
    if (G.challenge && G.state === 'wave') {
      const c = G.challenge;
      const v = c.id === 'time' ? (G.waveTime || 0) : (G.track && G.track[c.def.track]) || 0;
      const tv = c.target;
      const shown = c.id === 'time' ? v.toFixed(0) + 's/' + tv + 's' : Math.floor(v) + '/' + Math.round(tv);
      const pass = c.def.cmp === 'le' ? v <= tv : v >= tv;
      chEl.style.display = '';
      chEl.innerHTML = '<span class="chi">' + c.def.icon + '</span><b>' + c.def.name + '</b><span class="chp ' +
        (pass ? 'ok' : 'no') + '">' + shown + '</span>';
      chEl.title = c.def.desc(G.wave);
    } else { chEl.style.display = 'none'; }
  }
  updateQuestHUD();   // 委托进度随 HUD 一起刷新（内部有签名缓存，不会每帧写 DOM）
  updateBossBar();    // BOSS 横幅（同样有签名缓存）
  $('btnSkip').style.display = G.state === 'build' ? '' : 'none';
  if ($('questPanel') && $('questPanel').classList.contains('open')) renderQuestPanel();
  // 建造栏角标：每种建筑已建几座（把「还能放几座」变得一眼可见）
  const cnt = {};
  G.buildings.forEach(b => { cnt[b.type] = (cnt[b.type] || 0) + 1; });
  $('buildBar').querySelectorAll('.card').forEach(c => {
    const n = cnt[c.dataset.k] || 0;
    const el2 = c.querySelector('.cnt');
    if (el2) { el2.textContent = n ? n : ''; el2.style.display = n ? 'block' : 'none'; }
  });
  // HUD 底边备战倒计时进度条（越接近开战越红）
  const pg = $('hudProg');
  if (pg) {
    if (G.state === 'build' && G.prepTotal > 0) {
      const p = clamp(G.prepTimer / G.prepTotal, 0, 1);
      pg.style.display = '';
      pg.classList.toggle('warn', p < 0.28);
      pg.firstElementChild.style.width = (p * 100).toFixed(1) + '%';
    } else pg.style.display = 'none';
  }
  _hudPulseCheck();
  $('buildBar').querySelectorAll('.card').forEach(c => {
    const d = BUILD_DEFS[c.dataset.k];
    const ok = G.gold >= d.cost.gold;
    c.classList.toggle('no', !ok);
    c.classList.toggle('ok', ok && c.dataset.k !== selectedBuildKey);
    c.classList.toggle('okTower', ok && !!d.tower && c.dataset.k !== selectedBuildKey);
    c.classList.toggle('sel', c.dataset.k === selectedBuildKey);
  });
  $('skillBar').querySelectorAll('.skill').forEach(b => {
    const k = b.dataset.k, cd = G.skills[k], s = SKILL_DEFS[k];
    b.classList.toggle('cool', cd > 0);
    b.querySelector('.scd').style.height = (cd / s.cd * 100) + '%';
    b.querySelector('.scd').textContent = cd > 0 ? Math.ceil(cd) : '';
  });
  $('techList').querySelectorAll('.tech').forEach(r => {
    const k = r.dataset.k, d = TECH_DEFS[k], lv = G.tech[k];
    r.querySelector('.tlv').textContent = lv + '/' + d.max;
    r.querySelector('.tbar i').style.width = (lv / d.max * 100) + '%';
    const btn = r.querySelector('.tbtn');
    const locked = techLocked(k);
    r.classList.toggle('locked', locked);
    if (lv >= d.max) { btn.textContent = 'MAX'; btn.disabled = true; }
    else if (locked) { btn.textContent = '🔒'; btn.disabled = true; }
    else { const c = d.cost(lv); btn.textContent = fmt(c) + '🔮'; btn.disabled = G.souls < c; }
  });
  $('techSouls').textContent = fmt(G.souls);
  if ($('achPanel').classList.contains('open')) {
    $('achList').querySelectorAll('.ach').forEach(d => {
      const got = !!G.ach[d.dataset.k];
      d.classList.toggle('got', got);
      d.querySelector('.aico').textContent = got ? '🏆' : '🔒';
    });
  }
  const got = ACHIEVEMENTS.filter(a => G.ach[a.id]).length;
  $('achCount').textContent = got + '/' + ACHIEVEMENTS.length;
  if ($('lotPanel').classList.contains('open')) updateLotteryHUD();
}
let detailSig = '';
function updateDetail(force) {
  const el = $('detail');
  const s = selected;
  if (!s) {
    if (el.style.display !== 'none') { el.style.display = 'none'; detailSig = ''; }
    return;
  }
  let sig;
  if (s.isBed) sig = 'bed|' + G.bed.lv + '|' + Math.ceil(G.bed.hp) + '|' + (G.gold > bedUpgradeCost(G.bed.lv) ? 1 : 0);
  else if (s.isDoor) sig = 'door|' + s.door.lane + '|' + s.door.lv + '|' + Math.ceil(s.door.hp) + '|' + (G.gold > doorUpgradeCost(s.door.lv) ? 1 : 0);
  else if (s.def) sig = 'b|' + s.type + '|' + s.level + '|' + (s.branch || '') + '|' + Math.ceil(s.hp) + '|' + G.buildings.indexOf(s) +
    '|' + (s.resN || 0) + '|' + (s.resDmg || 1) + '|' + (s.kills || 0) + '|' + (canAfford(upgradeCost(s.def, s.level)) ? 1 : 0);
  else return;
  if (!force && sig === detailSig) return;
  detailSig = sig;
  el.style.display = 'block';
  let html = '', act = '';
  if (s.isBed) {
    const c = bedUpgradeCost(G.bed.lv);
    const nx = G.bed.lv < 50 ? bedGoldEffOf(G.bed.lv + 1) : 0;
    const dm = diffCfg().goldMul;
    html = '<div class="dhead"><span class="dico">🛏️</span><b>' + bedName() + '</b><span class="dlv">Lv.' + G.bed.lv + '/50</span></div>' +
      '<div class="dst">金币产出 <b class="hl">' + fmt1(bedGoldEff()) + '</b>/秒' +
      (dm !== 1 ? '　<span class="dup2">基础 ' + fmt1(bedGold()) + ' × 难度 ' + dm + '</span>' : '') +
      (nx ? '　<span class="dup2">下一级 ' + fmt1(nx) + '/秒（x2）</span>' : '') + '</div>' +
      '<div class="dst">生命 ' + Math.ceil(G.bed.hp) + '/' + Math.ceil(G.bed.maxHp) + (G.bed.shieldMax ? '　护盾 ' + Math.ceil(G.bed.shield) : '') + '</div>' +
      '<div class="dnote">躺得久不再自动加金币，<b>升级床</b>才是提升产出的唯一途径。</div>';
    act = G.bed.lv >= 50 ? '<span class="max">已至巅峰</span>'
      : '<button id="dUp">升级 ' + fmt(c) + '💰</button><button id="dMax" class="maxup">⏫升满</button>';
  } else if (s.isDoor) {
    const d = s.door;
    const c = doorUpgradeCost(d.lv);
    html = '<div class="dhead"><span class="dico">🚪</span><b>' + doorName(d) + '</b><span class="dlv">Lv.' + d.lv + '/50</span></div>' +
      '<div class="dst">第 ' + (d.lane + 1) + ' 道门　生命 ' + Math.ceil(d.hp) + '/' + Math.ceil(d.maxHp) +
      (d.shieldMax ? '　护盾 ' + Math.ceil(d.shield) + '/' + Math.ceil(d.shieldMax) : '') + '</div>' +
      (d.lv < 50 ? '<div class="dup">下一级 → ' + NAME_POOL.door[d.lv] + '　生命 ' + Math.ceil(doorMaxHp(d.lv + 1)) + '</div>' : '') +
      '<div class="dnote">门被攻破后，该路敌人会冲进房间拆建筑。</div>';
    act = d.lv >= 50 ? '<span class="max">已至巅峰</span>'
      : '<button id="dUp">⬆ 加固<i>' + fmt(c) + '💰</i></button><button id="dMax" class="maxup">⏫ 升满</button>';
  } else if (s.def) {
    const st = bstat(s);
    const dtn = s.def.dmgType ? '<span class="dtn" style="color:' + DMG[s.def.dmgType].color + '">' + DMG[s.def.dmgType].icon + DMG[s.def.dmgType].name + '</span>' : '';
    html = '<div class="dhead"><span class="dico">' + (s.branch ? s.def.branch[s.branch].icon : s.def.icon) + '</span><b>' +
      buildName(s) + '</b><span class="dlv">Lv.' + s.level + '/50</span>' + dtn + '</div>' +
      (s.def.noPowerUp ? '<div class="dnote">⚡ <b>持续发电来源</b>，升级永不耗电，发电速率每级 <b>x2</b></div>'
        : (s.level < FREE_POWER_LV ? '<div class="dnote">⚡ Lv' + (FREE_POWER_LV + 1) + ' 之前升级<b>不消耗电量</b></div>' : '')) +
      '<div class="dst">' + s.def.statText(st) + '</div>' +
      '<div class="dst">生命 ' + Math.ceil(s.hp) + '/' + Math.ceil(s.maxHp) + (s.shieldMax ? '　护盾 ' + Math.ceil(s.shield) + '/' + Math.ceil(s.shieldMax) : '') +
      '　运行不消耗电力' +
      (s.kills ? '　击杀 <b class="hl">' + s.kills + '</b>' : '') + '</div>';
    // 面板 DPS：回答「这座炮塔到底值不值得升」
    if (s.def.tower) {
      const dps = towerPanelDps(st, s);
      const perK = dps / Math.max(1, s.invested) * 1000;
      html += '<div class="dst">面板 DPS ≈ <b class="hl">' + fmt1(dps) + '</b>/秒' +
        '<span class="dup2">　性价比 ' + perK.toFixed(2) + ' DPS / 千金币</span></div>';
    }
    // 共鸣：相邻不同元素炮塔互相增幅（原先只有内部倍率，玩家看不到）
    const rb = resBonusOf(s);
    if (rb.n >= 2) {
      html += '<div class="dres" style="--rc:' + rb.color + '">🎵 <b>' + rb.tier + '</b><span class="drn">相邻 ' + rb.n + ' 种元素</span>' +
        '<span>伤害 <b>x' + rb.dmg.toFixed(2) + '</b>　射速 <b>x' + rb.rate.toFixed(2) + '</b></span>' +
        (rb.extra ? '<span>' + rb.extra.icon + ' <b>' + rb.extra.name + '</b>：' + rb.extra.desc + '</span>' : '') + '</div>';
    } else if (s.def.tower && s.def.dmgType) {
      html += '<div class="dres dim">🎵 暂无共鸣 —— 把<b>不同元素</b>的炮塔挨着放（约 1.5 格内）即可互相增幅</div>';
    }
    if (s.level < 50) {
      const ns = bstat(Object.assign(Object.create(Object.getPrototypeOf(s)), s, { level: s.level + 1 }));
      html += '<div class="dup">下一级 → <b>' + (NAME_POOL[s.type] ? NAME_POOL[s.type][s.level] : s.def.name) + '</b>　' + s.def.statText(ns) + '</div>';
    }
    const hasR = (s.runes || []).filter(Boolean);
    if (hasR.length) {
      html += '<div class="runeon">' + hasR.map(r => {
        const q = qualityOf(r.q);
        return '<span class="ro" style="border-color:' + q.color + '66"><b style="color:' + q.color + '">' +
          RUNE_AFFIXES[r.affixes[0].k].icon + (r.lv ? '+' + r.lv : '') + '</b>' +
          r.affixes.map(a => RUNE_AFFIXES[a.k].name + '+' + affixVal(r, a) + '%').join(' ') + '</span>';
      }).join('') + '</div>';
    } else {
      html += '<div class="runeon"><span class="ro empty2">未镶嵌符文（' + runeSlots() + ' 槽）按 G 打开背包</span></div>';
    }
    const c = upgradeCost(s.def, s.level);
    const costTxt = fmt(c.gold) + '💰' + (c.power ? ' ' + fmt(c.power) + '⚡' : '');
    act = (s.level >= 50 ? '<span class="max">已至巅峰</span>'
      : '<button id="dUp">⬆ 升级<i>' + costTxt + '</i></button><button id="dMax" class="maxup">⏫ 升满</button>') +
      '<button id="dSell" class="sell">出售 +' + fmt(s.invested * SELL_RATE) + '</button>';
    if (!s.branch && s.def.branch && s.level >= BRANCH_AT) {
      const A = s.def.branch.a, B = s.def.branch.b;
      html += '<div class="brwrap"><div class="brt">可转职（二选一，转职后满血且属性提升）</div>' +
        '<div class="bropt" id="brA"><b>' + A.icon + ' ' + A.name + '</b><span>' + A.desc + '</span><em>' + A.cost.gold + '💰 ' + A.cost.soul + '🔮</em></div>' +
        '<div class="bropt" id="brB"><b>' + B.icon + ' ' + B.name + '</b><span>' + B.desc + '</span><em>' + B.cost.gold + '💰 ' + B.cost.soul + '🔮</em></div></div>';
    }
  }
  el.innerHTML = html + '<div class="dact">' + act + '</div>';
  const u = $('dUp'); if (u) u.onclick = () => { Cmd.upgradeSelection(selected); detailSig = ''; };
  const sl = $('dSell'); if (sl) sl.onclick = () => { Cmd.sellSelection(selected); detailSig = ''; };
  const dm = $('dMax'); if (dm) dm.onclick = () => { Cmd.maxSelection(selected); detailSig = ''; };
  const ba = $('brA'); if (ba) ba.onclick = () => { Cmd.branchSelection(selected, 'a'); detailSig = ''; };
  const bb = $('brB'); if (bb) bb.onclick = () => { Cmd.branchSelection(selected, 'b'); detailSig = ''; };
}
function showGameOver() {
  const o = $('overlay');
  const score = G.wave * 1200 + G.stats.kills * 12 + Math.floor(G.stats.goldTotal) + G.stats.bossKills * 500;
  const got = ACHIEVEMENTS.filter(a => G.ach[a.id]).length;
  const isEndless = G.mode === 'unlimited';
  const title = isEndless ? '♾ 无尽模式结束' : '💀 你的美梦被打断了';
  const titleGrad = isEndless
    ? 'background:linear-gradient(135deg,#7dd3fc,#60a5fa,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 20px rgba(96,165,250,.5))'
    : 'background:linear-gradient(135deg,#fca5a5,#f87171,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 20px rgba(248,113,113,.5))';
  const subColor = isEndless ? '#60a5fa' : '#f87171';
  const subText = isEndless
    ? '你在无尽模式中坚持到了第 ' + G.wave + ' 波'
    : '床铺被梦魇摧毁';
  const waveColor = isEndless ? '#7dd3fc' : '#fca5a5';
  const waveBg = isEndless
    ? 'background:linear-gradient(135deg,rgba(96,165,250,.15),rgba(59,130,246,.08));border-color:rgba(96,165,250,.35)'
    : 'background:linear-gradient(135deg,rgba(248,113,113,.15),rgba(239,68,68,.08));border-color:rgba(248,113,113,.35)';
  o.style.display = 'flex';
  o.innerHTML = '<div class="panel over">' +
    '<h1 style="font-size:42px;' + titleGrad + '">' + title + '</h1>' +
    '<div class="sub" style="font-size:16px;color:' + subColor + ';margin-bottom:20px">' + subText + '</div>' +
    '<div class="grid">' +
    '<div style="' + waveBg + '"><b style="font-size:32px;color:' + waveColor + ';text-shadow:0 0 25px ' + waveColor + '66">' + G.wave + '</b><span>存活波次</span></div>' +
    '<div style="background:linear-gradient(135deg,rgba(251,191,36,.12),rgba(245,158,11,.06))"><b style="font-size:28px;color:#fbbf24;text-shadow:0 0 18px rgba(251,191,36,.5)">' + G.stats.kills + '</b><span>击杀梦魇</span></div>' +
    '<div style="background:linear-gradient(135deg,rgba(167,139,250,.12),rgba(139,92,246,.06))"><b style="font-size:28px;color:#a78bfa;text-shadow:0 0 18px rgba(167,139,250,.5)">' + G.stats.bossKills + '</b><span>击杀 BOSS</span></div>' +
    '<div><b>' + fmt(G.stats.goldTotal) + '</b><span>累计金币</span></div>' +
    '<div><b>' + G.stats.build + '</b><span>建造数量</span></div>' +
    '<div><b>' + fmt(G.stats.dmg) + '</b><span>总伤害</span></div>' +
    '<div><b>' + G.buildings.filter(b => b.branch).length + '</b><span>转职次数</span></div>' +
    '<div><b>' + got + '/' + ACHIEVEMENTS.length + '</b><span>成就</span></div>' +
    '<div style="background:linear-gradient(135deg,rgba(251,191,36,.18),rgba(245,158,11,.1));border-color:rgba(251,191,36,.5);grid-column:span 3"><b style="font-size:36px;color:#fde68a;text-shadow:0 0 30px rgba(253,230,138,.6)">' + score + '</b><span>综合得分</span></div>' +
    '</div>' +
    '<div class="metabar"><span class="mg">💰 +' + (G.lastReward || 0) + '</span><span class="ms">本局获得金币 — 可在主菜单抽奖</span></div>' +
    '<div class="btns"><button class="big" id="toMenu">返回主界面</button></div>' +
    '<div class="tipend">' + (isEndless ? '无尽模式没有尽头，只有越来越强的梦魇。下次试试坚持更久！' : '提示：注意伤害类型克制（重甲怕能量、盾卫怕电磁、幽灵怕火焰）；聚能塔相邻增幅是后期输出核心。') + '</div>' +
    '</div>';
  $('toMenu').onclick = () => showMenu();
}
function showVictory() {
  const o = $('overlay');
  const score = G.wave * 1500 + G.stats.kills * 15 + Math.floor(G.stats.goldTotal) + G.stats.bossKills * 800 + 20000;
  const got = ACHIEVEMENTS.filter(a => G.ach[a.id]).length;
  o.style.display = 'flex';
  o.innerHTML = '<div class="panel win">' +
    '<h1 style="font-size:52px;background:linear-gradient(135deg,#ffd166,#fbbf24,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 35px rgba(251,191,36,.7))">👑 通关成功</h1>' +
    '<div class="sub" style="font-size:18px;color:#fbbf24;margin-bottom:20px;text-shadow:0 0 10px rgba(251,191,36,.4)">你击败了终焉梦魇，守住了这场美梦</div>' +
    '<div class="grid">' +
    '<div style="background:linear-gradient(135deg,rgba(251,191,36,.18),rgba(245,158,11,.1));border-color:rgba(251,191,36,.5)"><b style="font-size:36px;color:#fde68a;text-shadow:0 0 30px rgba(253,230,138,.7)">' + G.wave + '</b><span>通关波次</span></div>' +
    '<div style="background:linear-gradient(135deg,rgba(251,191,36,.12),rgba(245,158,11,.06))"><b style="font-size:28px;color:#fbbf24;text-shadow:0 0 18px rgba(251,191,36,.5)">' + G.stats.kills + '</b><span>击杀梦魇</span></div>' +
    '<div style="background:linear-gradient(135deg,rgba(167,139,250,.12),rgba(139,92,246,.06))"><b style="font-size:28px;color:#a78bfa;text-shadow:0 0 18px rgba(167,139,250,.5)">' + G.stats.bossKills + '</b><span>击杀 BOSS</span></div>' +
    '<div><b>' + fmt(G.stats.goldTotal) + '</b><span>累计金币</span></div>' +
    '<div><b>' + G.stats.build + '</b><span>建造数量</span></div>' +
    '<div><b>' + fmt(G.stats.dmg) + '</b><span>总伤害</span></div>' +
    '<div><b>' + G.bed.lv + '</b><span>床铺等级</span></div>' +
    '<div><b>' + got + '/' + ACHIEVEMENTS.length + '</b><span>成就</span></div>' +
    '<div style="background:linear-gradient(135deg,rgba(74,222,128,.18),rgba(34,197,94,.1));border-color:rgba(74,222,128,.5);grid-column:span 3"><b style="font-size:38px;color:#86efac;text-shadow:0 0 30px rgba(134,239,172,.6)">' + score + '</b><span>综合得分</span></div>' +
    '</div>' +
    '<div class="metabar"><span class="mg">💰 +' + (G.lastReward || 0) + '</span><span class="ms">本局获得金币 — 可在主菜单抽奖</span></div>' +
    '<div class="btns"><button class="big" id="toMenu2">返回主界面</button></div>' +
    '<div class="tipend">本局已终结 — 想无限发育请在主菜单选择「♾️ 无限模式」。</div>' +
    '</div>';
  $('toMenu2').onclick = () => showMenu();
}
function runeAffixText(r) {
  return r.affixes.map(a => RUNE_AFFIXES[a.k].icon + RUNE_AFFIXES[a.k].name + '+' + affixVal(r, a) + '%').join('　');
}
function updateRunePanel() {
  const el = $('runeList');
  if (!el) return;
  $('runeCount').textContent = G.runeBag.length + '/40';
  $('runeSlotsInfo').textContent = '每座建筑 ' + runeSlots() + ' 个槽位（符文宗师可增加）';
  let h = '';
  if (!G.runeBag.length) h = '<div class="empty">背包里还没有符文。击杀梦魇有几率掉落，波次越高掉率越高。</div>';
  G.runeBag.forEach(r => {
    const q = qualityOf(r.q);
    h += '<div class="rune" data-id="' + r.id + '" style="border-color:' + q.color + '66">' +
      '<div class="rhead"><b style="color:' + q.color + '">' + r.name + (r.lv ? ' +' + r.lv : '') + '</b>' +
      '<span class="rq" style="background:' + q.color + '22;color:' + q.color + '">' + q.name + '</span></div>' +
      '<div class="raff">' + runeAffixText(r) + '</div>' +
      '<div class="ract"><button class="rb" data-up="' + r.id + '">强化 ' + runeUpCost(r) + '🔮</button>' +
      '<button class="rb sal" data-sal="' + r.id + '">分解 +' + runeSalvage(r) + '🔮</button></div></div>';
  });
  el.innerHTML = h;
  el.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { upgradeRune(G.runeBag.find(r => r.id === b.dataset.up)); updateRunePanel(); updateDetail(true); });
  el.querySelectorAll('[data-sal]').forEach(b => b.onclick = () => { Cmd.salvage(b.dataset.sal); updateRunePanel(); updateDetail(true); });
  const slotEl = $('runeSlots');
  if (slotEl) {
    const b = (selected && selected.def) ? selected : null;
    if (!b) { slotEl.innerHTML = '<div class="empty">点击一座建筑，可在此镶嵌 / 强化 / 卸下符文</div>'; }
    else {
      const slots = runeSlots();
      let sh = '<div class="slottitle">『' + buildName(b) + '』的符文槽　<button class="rb" id="autoSocket">自动镶嵌最优</button></div><div class="slotrow">';
      for (let i = 0; i < slots; i++) {
        const r = b.runes[i];
        if (r) {
          const q = qualityOf(r.q);
          sh += '<div class="slot filled" style="border-color:' + q.color + '"><b style="color:' + q.color + '">' + r.name + (r.lv ? ' +' + r.lv : '') + '</b>' +
            '<span class="raff2">' + runeAffixText(r) + '</span>' +
            '<div class="sact"><button class="rb" data-su="' + i + '">强化 ' + runeUpCost(r) + '🔮</button>' +
            '<button class="rb sal" data-sus="' + i + '">卸下</button></div></div>';
        } else {
          sh += '<div class="slot"><span class="plus">＋ 空槽位</span><span class="hint2">点击背包符文镶嵌</span></div>';
        }
      }
      sh += '</div>';
      slotEl.innerHTML = sh;
      slotEl.querySelectorAll('[data-su]').forEach(x => x.onclick = () => { Cmd.upgradeRuneIn(b, +x.dataset.su); updateRunePanel(); updateDetail(true); });
      slotEl.querySelectorAll('[data-sus]').forEach(x => x.onclick = () => { Cmd.unsocket(b, +x.dataset.sus); updateRunePanel(); updateDetail(true); });
      const auto = $('autoSocket');
      if (auto) auto.onclick = () => {
        let n = 0;
        const bag = G.runeBag.slice().sort((p, q2) => (q2.affixes.length + q2.lv) - (p.affixes.length + p.lv));
        for (const r of bag) { if (Cmd.socket(b, r.id, null)) n++; }
        updateRunePanel(); updateDetail(true);
        if (n) setTip('自动镶嵌 ' + n + ' 枚符文', 3);
      };
    }
  }
}
function togglePanel(id) {
  ['techPanel', 'achPanel', 'helpPanel'].forEach(p => { if (p !== id) $(p).classList.remove('open'); });
  const el = $(id);
  el.classList.toggle('open');
  // 修复线上现存 bug：runePanel 是内联 display 结构（非 .slide 滑出面板），
  // 仅切 class 永远无法显示；同步 display 并在打开时刷新内容（此前 🔮符文 按钮与 G 键失效）
  if (id === 'savePanel') {
    const open = el.classList.contains('open');
    el.style.display = open ? '' : 'none';
    if (open) { renderSavePanel(); if (typeof SFX !== 'undefined' && SFX.coin) SFX.coin(); }
    return;
  }
  if (id === 'questPanel') {
    const open = el.classList.contains('open');
    el.style.display = open ? '' : 'none';
    if (open) { renderQuestPanel(true); if (typeof SFX !== 'undefined' && SFX.coin) SFX.coin(); }
    return;
  }
  if (id === 'runePanel') {
    const open = el.classList.contains('open');
    el.style.display = open ? '' : 'none';
    if (open) updateRunePanel();
  }
}
function buildLottery() {
  const el = $('lotPool');
  const byR = { common: [], rare: [], epic: [], legend: [] };
  LOTTERY_POOL.forEach(p => byR[p.r].push(p));
  let html = '';
  ['legend', 'epic', 'rare', 'common'].forEach(r => {
    const R = RARITY[r];
    html += '<div class="prh" style="color:' + R.color + '">' + R.name + '（' + byR[r].length + ' 项）</div><div class="prlist">';
    byR[r].forEach(p => {
      html += '<div class="pri" style="border-color:' + R.color + '44"><span class="pi">' + p.icon + '</span>' +
        '<span class="pn" style="color:' + R.color + '">' + p.name + '</span><span class="pd">' + p.desc + '</span></div>';
    });
    html += '</div>';
  });
  el.innerHTML = html;
  updateLotteryHUD();
}
function updateLotteryHUD() {
  if (!$('lotPanel')) return;
  $('lotCount').textContent = G.lot.n;
  $('lotPityE').textContent = Math.max(0, LOTTERY.pityEpic - G.lot.ep);
  $('lotPityL').textContent = Math.max(0, LOTTERY.pityLegend - G.lot.lg);
  const pe = 1 - G.lot.ep / LOTTERY.pityEpic, pl = 1 - G.lot.lg / LOTTERY.pityLegend;
  $('lotBarE').style.width = Math.min(100, pe * 100) + '%';
  $('lotBarL').style.width = Math.min(100, pl * 100) + '%';
  $('btnDraw1').disabled = G.gold < LOTTERY.cost;
  $('btnDraw10').disabled = G.gold < LOTTERY.tenCost;
  $('btnDrawS').disabled = G.souls < LOTTERY.soulCost;
  $('lotGold').textContent = fmt(G.gold);
  $('lotSoul').textContent = fmt(G.souls);
}
function showDrawResult(results) {
  const el = $('lotResult');
  el.innerHTML = '<div class="resgrid">' + results.map((r, i) => {
    const R = RARITY[r.r];
    return '<div class="dcard ' + r.r + '" style="animation-delay:' + (i * 0.09) + 's;border-color:' + R.color + ';box-shadow:0 0 18px ' + R.glow + '">' +
      '<div class="dico">' + r.icon + '</div>' +
      '<div class="dname" style="color:' + R.color + '">' + r.name + '</div>' +
      '<div class="drar" style="background:' + R.color + '22;color:' + R.color + '">' + R.name + '</div>' +
      '<div class="dtxt">' + (r.txt || r.desc) + '</div></div>';
  }).join('') + '</div>';
  const order = { legend: 4, epic: 3, rare: 2, common: 1 };
  const best = results.reduce((a, b) => order[b.r] > order[a.r] ? b : a, results[0]);
  if (order[best.r] >= 3) setTip('🎉 抽到【' + RARITY[best.r].name + '】' + best.name + '！', 5);
}
function doDraw(n, cur) {
  const res = Cmd.draw(n, cur);
  if (!res) return;
  showDrawResult(res);
  updateLotteryHUD();
}
let menuDiff = 'normal';
let menuMode = 'limited';
let MENU_HTML = '';
function ensureMenuDOM() {
  const o = $('overlay');
  if ($('startPanel')) return;
  o.innerHTML = MENU_HTML;
  wireMenu();
  if (typeof wireDreamMenuButtons === 'function') wireDreamMenuButtons();
}
function syncAudioUI() {
  if (typeof Music === 'undefined') return;
  const musicRange = $('musicVolume');
  const sfxRange = $('sfxVolume');
  const musicValue = $('musicVolumeValue');
  const sfxValue = $('sfxVolumeValue');
  if (musicRange) musicRange.value = Music.volume;
  if (sfxRange) sfxRange.value = SFX.volume;
  if (musicValue) musicValue.textContent = Math.round(Music.volume * 100) + '%';
  if (sfxValue) sfxValue.textContent = Math.round(SFX.volume * 100) + '%';
  const status = $('musicStatus');
  if (status) status.textContent = Music.status();
  const state = $('musicState');
  if (state) state.textContent = Music.on ? '开' : '关';
  const musicButton = $('btnMusicHome');
  if (musicButton) {
    musicButton.setAttribute('aria-pressed', Music.on ? 'true' : 'false');
    musicButton.setAttribute('aria-label', Music.on ? '关闭背景音乐' : '开启背景音乐');
  }
  const homeSfxButton = $('btnSoundHome');
  if (homeSfxButton) {
    homeSfxButton.textContent = (SFX.on ? '🔊 战斗音效：开启' : '🔇 战斗音效：关闭');
    homeSfxButton.setAttribute('aria-pressed', SFX.on ? 'true' : 'false');
  }
  const gameSfxButton = $('btnSound');
  if (gameSfxButton) {
    gameSfxButton.textContent = (SFX.on ? '🔊' : '🔇') + '音';
    gameSfxButton.setAttribute('aria-pressed', SFX.on ? 'true' : 'false');
    gameSfxButton.title = SFX.on ? '关闭战斗音效' : '开启战斗音效';
  }
}
function showMenu() {
  ensureMenuDOM();
  $('startPanel').style.display = '';
  $('gachaPanel').style.display = 'none';
  $('bagPanel').style.display = 'none';
  $('overlay').style.display = 'flex';
  if ($('adminBar')) $('adminBar').style.display = 'none';
  paused = true;
  if (typeof Music !== 'undefined') Music.play('menu');
  updateMenu();
}
function updateMenu() {
  const mg = $('metaGold'); if (mg) mg.textContent = META.gold;
  const bw = $('bestWave'); if (bw) bw.textContent = Math.max(META.best || 0, +Store.get('tangping_best', 0) || 0);
  LAST_SAVE = loadSave();
  const continueButton = $('btnContinue');
  const continueMeta = $('continueMeta');
  const saveInfo = $('saveInfo');
  const hasSave = !!(LAST_SAVE && LAST_SAVE.wave > 0);
  if (continueButton) {
    continueButton.style.display = hasSave ? '' : 'none';
    continueButton.setAttribute('aria-label', hasSave ? '继续第 ' + LAST_SAVE.wave + ' 波' : '没有可继续的存档');
  }
  if (continueMeta) continueMeta.textContent = hasSave ? '第 ' + LAST_SAVE.wave + ' 波 · ' + ((LAST_SAVE.buildings || []).length) + ' 座建筑' : '暂无自动存档';
  if (saveInfo) saveInfo.textContent = hasSave
    ? '自动记录 · 第 ' + LAST_SAVE.wave + ' 波 · ' + ((LAST_SAVE.buildings || []).length) + ' 座建筑'
    : '尚无继续记录 · 新游戏会自动保存';
  const dc = $('diffCards');
  if (dc) {
    dc.innerHTML = DIFF_KEYS.map(k => {
      const d = DIFFS[k], ok = META.gold >= d.cost;
      return '<div class="diff' + (d.admin ? ' adm' : '') + (menuDiff === k ? ' on' : '') + '" data-d="' + k + '" title="' + d.desc + '" role="button" tabindex="0" aria-pressed="' + (menuDiff === k) + '">' +
        '<div class="di">' + d.icon + '</div><div class="dn">' + d.name + '</div>' +
        '<div class="dd">' + d.desc + '</div>' +
        (d.cost ? '<div class="dc"' + (ok ? '' : ' style="color:#f87171"') + '>💰 ' + d.cost + '</div>' : '<div class="dc">免费</div>') +
        '<div class="dr">' + (d.admin ? '资源无限' : '结算 x' + d.reward) +
        (d.goldMul !== 1 ? ' · 金币 x' + d.goldMul : '') + '</div></div>';
    }).join('');
    dc.querySelectorAll('.diff').forEach(el => {
      const choose = () => { menuDiff = el.dataset.d; updateMenu(); };
      el.onclick = choose;
      el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(); } };
    });
  }
  const mc = $('modeCards');
  if (mc) {
    mc.innerHTML = MODE_KEYS.map(k => {
      const m = MODES[k];
      return '<div class="mode' + (menuMode === k ? ' on' : '') + '" data-m="' + k + '" role="button" tabindex="0" aria-pressed="' + (menuMode === k) + '">' +
        '<span class="mi">' + m.icon + '</span><div><div class="mn">' + m.name + '</div>' +
        '<div class="md">' + m.desc + '　·　' + m.tip + '</div></div></div>';
    }).join('');
    mc.querySelectorAll('.mode').forEach(el => {
      const choose = () => { menuMode = el.dataset.m; updateMenu(); };
      el.onclick = choose;
      el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(); } };
    });
  }
  const selectedDiff = DIFFS[menuDiff] || DIFFS.normal;
  const selectedMode = MODES[menuMode] || MODES.limited;
  const summary = $('setupSummary');
  if (summary) {
    const admFree = selectedDiff.admin && (META.equipped || []).indexOf('freeAdmin') >= 0;
    const cost = selectedDiff.cost && !admFree ? selectedDiff.cost : 0;
    summary.textContent = selectedDiff.name + ' · ' + selectedMode.name +
      (cost ? ' · 入场消耗 ' + cost + ' 金币' : ' · 免费入场') +
      (selectedDiff.admin ? ' · 管理员规则' : ' · 结算奖励 ×' + selectedDiff.reward);
  }
  const er = $('equipRow');
  if (er) {
    const eq = (META.equipped || []).filter(k => META_PRIZES[k]);
    const equipCount = $('equipCount'); if (equipCount) equipCount.textContent = eq.length + ' / 3 已装备';
    er.innerHTML = eq.length ? eq.map(k => '<span class="eq">' + META_PRIZES[k].icon + ' ' + META_PRIZES[k].name + '</span>').join('')
      : '<span class="eq none">未装备开局道具 — 去「🎒 仓库」装备（最多 3 件）</span>';
  }
  if (typeof syncAudioUI === 'function') syncAudioUI();
}
function wireMenu() {
  if (!$('btnStart')) return;
  $('btnStart').onclick = () => startRun();
  if ($('btnSaveMgr')) $('btnSaveMgr').onclick = () => showSavePanel();
  if ($('btnContinue')) $('btnContinue').onclick = () => {
    LAST_SAVE = loadSave();
    if (!LAST_SAVE) return;
    SFX.init(); Music.unlock(); Music.play('game'); $('overlay').style.display = 'none';
    newGame(LAST_SAVE); paused = false; $('btnPause').textContent = '⏸';
    setTip('欢迎回到梦境，第 ' + G.wave + ' 波即将继续…', 5);
  };
  $('btnGacha').onclick = () => openGacha();
  $('btnBag').onclick = () => openBag();
  $('btnDrawMeta1').onclick = () => metaDraw(1);
  $('btnDrawMeta10').onclick = () => metaDraw(10);
  $('btnGachaBag').onclick = () => openBag();
  $('gachaClose').onclick = () => showMenu();
  $('bagClose').onclick = () => showMenu();
  $('btnBagGacha').onclick = () => openGacha();
  if ($('btnMusicHome')) $('btnMusicHome').onclick = () => {
    if (Music.on) Music.setEnabled(false);
    else { Music.unlock(); Music.setEnabled(true); }
  };
  if ($('musicVolume')) {
    $('musicVolume').oninput = ev => Music.setVolume(ev.target.value, false);
    $('musicVolume').onchange = () => Music.persist();
  }
  if ($('sfxVolume')) {
    $('sfxVolume').oninput = ev => Music.setSfxVolume(ev.target.value, false);
    $('sfxVolume').onchange = () => Music.persist();
  }
  if ($('btnSoundHome')) $('btnSoundHome').onclick = () => Music.setSfx(!SFX.on);
  const setW = v => { const el = $('adWave'); if (el) el.value = Math.max(1, Math.min(999, v | 0)); };
  if ($('adM5')) $('adM5').onclick = () => setW((+$('adWave').value || 1) - 5);
  if ($('adP5')) $('adP5').onclick = () => setW((+$('adWave').value || 1) + 5);
  if ($('adGo')) $('adGo').onclick = () => Cmd.jump(+$('adWave').value || 1);
  if ($('adExit')) $('adExit').onclick = () => {
    if ($('adminBar')) $('adminBar').style.display = 'none';
    if (G && !G.over) { G.over = true; grantMetaReward(false); }
    showMenu();
  };
  if (typeof wireDreamMenuButtons === 'function') wireDreamMenuButtons();
  updateMenu();
}
function startRun() {
  const d = DIFFS[menuDiff] || DIFFS.normal;
  const freeAdm = d.admin && (META.equipped || []).indexOf('freeAdmin') >= 0;
  const cost = (d.cost > 0 && !freeAdm) ? d.cost : 0;
  if (META.gold < cost) {
    SFX.err(); setTip('金币不足：' + d.name + ' 需要 ' + d.cost + ' 金币（去抽奖或打其他难度攒金币）', 5);
    return false;
  }
  META.gold -= cost; saveMeta();
  SFX.init();
  Music.unlock(); Music.play('game');
  $('overlay').style.display = 'none';
  SaveSystem.remove(0);
  newGame();
  G.diffKey = menuDiff; G.admin = !!d.admin;
  G.mode = menuMode; G.rebuilds = 0;
  applyEquippedPrizes();
  G.prepTimer = G.prepTimer * d.prepMul * ((G.prize && G.prize.prep) || 1);
  G.prepTotal = G.prepTimer;
  paused = false; $('btnPause').textContent = '⏸';
  if ($('adminBar')) $('adminBar').style.display = G.admin ? 'flex' : 'none';
  if (G.admin && $('adWave')) $('adWave').value = 1;
  setTip('难度【' + d.name + '】· ' + MODES[menuMode].name +
    (d.admin ? ' — 资源无限、血量无限，顶部可自由跳波' : '') +
    (menuMode === 'unlimited' ? ' — 本局永不结束' : ''), 6);
  return true;
}
function rollMetaPrize() {
  META.pity = (META.pity || 0) + 1;
  let pool = META_RARITY_ORDER.map(id => ({ id, w: META_RARITY[id].w }));
  if (META.pity >= META_PITY_LEGEND) pool = [{ id: 'legend', w: 1 }];
  else if (META.pity >= META_PITY_EPIC) pool = pool.filter(p => p.id === 'epic' || p.id === 'legend');
  let total = pool.reduce((a, b) => a + b.w, 0), r = Math.random() * total, rid = pool[pool.length - 1].id;
  for (const p of pool) { r -= p.w; if (r <= 0) { rid = p.id; break; } }
  const keys = META_PRIZE_KEYS.filter(k => META_PRIZES[k].rarity === rid);
  const key = keys[Math.floor(Math.random() * keys.length)] || META_PRIZE_KEYS[0];
  if (rid === 'legend' || rid === 'epic') META.pity = 0;
  META.inv[key] = (META.inv[key] || 0) + 1;
  return key;
}
function metaDraw(n) {
  const cost = n === 10 ? META_TEN_COST : META_DRAW_COST * n;
  if (META.gold < cost) { SFX.err(); setTip('金币不足，需要 ' + cost + ' 金币', 4); return; }
  META.gold -= cost;
  const got = [];
  for (let i = 0; i < n; i++) got.push(rollMetaPrize());
  saveMeta();
  updateGacha(); updateMenu();
  const el = $('gachaResult');
  el.innerHTML = got.map((k, i) => {
    const P = META_PRIZES[k], R = metaRarityOf(P.rarity);
    return '<div class="gcard" style="border-color:' + R.color + ';animation-delay:' + (i * 0.05) + 's">' +
      '<div class="gi">' + P.icon + '</div><div class="gn">' + P.name + '</div>' +
      '<div class="gd">' + P.desc + '</div>' +
      '<span class="gr" style="background:' + R.color + '22;color:' + R.color + '">' + R.name + '</span></div>';
  }).join('');
  SFX.coin();
}
function openGacha() {
  ensureMenuDOM();
  $('startPanel').style.display = 'none';
  $('bagPanel').style.display = 'none';
  $('gachaPanel').style.display = '';
  updateGacha();
}
function updateGacha() {
  const g = $('gachaGold'); if (g) g.textContent = META.gold;
  const p = $('gachaPity'); if (p) p.textContent = Math.min(META.pity || 0, META_PITY_LEGEND);
  const pl = $('gachaPityL'); if (pl) pl.textContent = META_PITY_LEGEND;
  const el = $('gachaPool');
  if (el && !el.dataset.built) {
    el.dataset.built = '1';
    let h = '';
    ['legend', 'epic', 'rare', 'common'].forEach(r => {
      const R = META_RARITY[r];
      const ks = META_PRIZE_KEYS.filter(k => META_PRIZES[k].rarity === r);
      h += '<div class="prh" style="color:' + R.color + '">' + R.name + '（' + ks.length + ' 项）</div><div class="prlist">';
      ks.forEach(k => { const P = META_PRIZES[k]; h += '<span class="aff">' + P.icon + ' <b>' + P.name + '</b> ' + P.desc + '</span>'; });
      h += '</div>';
    });
    el.innerHTML = h;
  }
}
function toggleEquip(k) {
  const eq = META.equipped || [];
  const i = eq.indexOf(k);
  if (i >= 0) { eq.splice(i, 1); }
  else {
    if ((META.inv[k] || 0) <= 0) return;
    if (eq.length >= EQUIP_SLOTS) { setTip('最多装备 ' + EQUIP_SLOTS + ' 件开局道具', 3); return; }
    eq.push(k);
  }
  META.equipped = eq; saveMeta(); renderBag(); updateMenu();
  SFX.coin();
}
function renderBag() {
  const el = $('bagBody'); if (!el) return;
  const eq = META.equipped || [];
  const owned = META_PRIZE_KEYS.filter(k => (META.inv[k] || 0) > 0);
  if (!owned.length) {
    el.innerHTML = '<div class="empty" style="grid-column:1/-1">仓库空空如也。去「🎰 抽奖」获取开局道具吧。</div>';
    return;
  }
  const order = { legend: 0, epic: 1, rare: 2, common: 3 };
  owned.sort((a, b) => order[META_PRIZES[a].rarity] - order[META_PRIZES[b].rarity]);
  el.innerHTML = owned.map(k => {
    const P = META_PRIZES[k], R = metaRarityOf(P.rarity), on = eq.indexOf(k) >= 0;
    const perm = PERMANENT_PRIZES[k];
    const tag = perm
      ? '<span class="ptag" style="background:#a855f722;color:#c084fc">永久</span>'
      : '<span class="ptag" style="background:#f59e0b22;color:#fbbf24">消耗 · 开局用 1</span>';
    const cnt = perm ? '∞' : ('×' + META.inv[k]);
    return '<div class="bitem' + (on ? ' on' : '') + '" data-k="' + k + '">' +
      '<span class="bi">' + P.icon + '</span><div><div class="bn">' + P.name +
      '<span class="brare" style="background:' + R.color + '22;color:' + R.color + '">' + R.name + '</span>' + tag + '</div>' +
      '<div class="bd">' + P.desc + '</div></div>' +
      '<span class="bc">' + cnt + (on ? ' · 已装备' : '') + '</span></div>';
  }).join('');
  el.querySelectorAll('.bitem').forEach(x => x.onclick = () => toggleEquip(x.dataset.k));
}
function openBag() {
  ensureMenuDOM();
  $('startPanel').style.display = 'none';
  $('gachaPanel').style.display = 'none';
  $('bagPanel').style.display = '';
  renderBag();
}

/* ============================================================
 *  梦境系统 UI 集成
 * ============================================================ */

// === 事件监听初始化 ===
function initDreamUI() {
  if (typeof EventBus === 'undefined') return;

  // ---- 剧情对话（由 DreamEngine / core.js 波次钩子触发）----
  EventBus.on('story:dialog', (data) => {
    if (data && data.text) showStoryDialog(data);
  });

  // ---- 记忆碎片 ----
  EventBus.on('fragment:collect', (data) => showFragmentPopup(data));

  // ---- NPC 招募 ----
  EventBus.on('npc:recruit', (data) => {
    const nm = (data.def && data.def.name) || data.name || '梦境居民';
    pushDreamToast('👥 梦境居民', nm + ' 已驻守防线', 'green');
    if (typeof addText === 'function') addText(640, 300, '👥 ' + nm + ' 加入！', '#4ade80', true);
  });

  // ---- 第四面墙：四类演出统一由本层承担 ----
  EventBus.on('fourthWall:fakeCrash', (data) => showFakeCrash(data));
  EventBus.on('fourthWall:fakeCrashEnd', () => hideFakeCrash());
  EventBus.on('fourthWall:uiCorrupt', (data) => applyUICorrupt(data));
  EventBus.on('fourthWall:chatMessage', (data) => showChatMessage(data));
  EventBus.on('fourthWall:saveCorrupt', (data) => showSaveCorrupt(data));
  EventBus.on('fourthWall:revert', () => revertFourthWall());

  // ---- 深层梦境 ----
  EventBus.on('deepDream:enter', (level) => {
    showDeepDreamTransition(level);
    updateDeepHUD();
  });
  EventBus.on('deepDream:exit', () => {
    hideDeepDreamTransition();
    updateDeepHUD();
  });
  EventBus.on('deepDream:reward', (data) => {
    const lv = data.level || {};
    toggleDeepAtmosphere(true);
    pushDreamToast('🎁 ' + (lv.name || '深层梦境') + ' 通关', (data.got || []).join('　'), 'gold', 6);
    updateDeepHUD();
  });
  // 波次推进时刷新深层进度点
  EventBus.on('dream:waveStart', () => { if (typeof DeepDream !== 'undefined' && DeepDream.isActive()) updateDeepHUD(); });
  EventBus.on('dream:waveEnd', () => { if (typeof DeepDream !== 'undefined' && DeepDream.isActive()) updateDeepHUD(); });

  // ---- 隐藏旋律 ----
  EventBus.on('sound:secretMelody', (mel) => {
    pushDreamToast((mel.icon || '🎵') + ' 发现旋律 · ' + mel.name, (mel.story || '') + (mel.hint ? '\n线索：' + mel.hint : ''), '', 7);
  });
  EventBus.on('sound:melodyReward', (data) => {
    pushDreamToast('🎵 ' + (data.name || '旋律') + ' 回响', (data.got || []).join('　'), 'gold', 5);
  });

  // ---- 理解路线（不战而胜）：逐条台词对话 ----
  EventBus.on('mercy:start', (data) => showMercyDialog(data));
  EventBus.on('mercy:complete', (data) => {
    const nm = (data.encounter && data.encounter.name) || '梦境生物';
    pushDreamToast('🕊 理解达成 · ' + nm, (data.got || []).join('　') || '它安静地离开了', 'green', 6);
  });
  EventBus.on('mercy:refuse', (data) => {
    const nm = (data.encounter && data.encounter.name) || '梦境生物';
    pushDreamToast('⚔️ 你选择了战斗', nm + ' 被激怒了（伤害 +25%）', 'red', 4);
  });

  // ---- 梦境日记 ----
  EventBus.on('diary:add', () => { /* 日记面板打开时才渲染，无需实时刷新 */ });

  console.log('[DreamUI] 事件监听已初始化');
}

/* ============================================================
 *  沉浸层辅助：暂停 / 提示 / 深层 HUD
 * ============================================================ */

/** 剧情是否由本层暂停了游戏（用于恢复时避免覆盖玩家手动暂停） */
let _storyPausedByUI = false;

/** 剧情阅读时暂停游戏（仅当游戏正在进行） */
function _pauseForStory() {
  if (typeof G === 'undefined' || typeof paused === 'undefined') return;
  if (G.over || paused) return;
  paused = true;
  _storyPausedByUI = true;
  const btn = $('btnPause');
  if (btn) btn.textContent = '▶';
}

/** 剧情结束：只在「是本层暂停的」情况下恢复 */
function _resumeAfterStory() {
  if (!_storyPausedByUI) return;
  _storyPausedByUI = false;
  paused = false;
  const btn = $('btnPause');
  if (btn) btn.textContent = '⏸';
}

/**
 * 右下角梦境提示（toast）
 * @param {string} title - 标题
 * @param {string} body - 正文（支持 \n）
 * @param {string} [tone] - '' | 'gold' | 'green' | 'red'
 * @param {number} [secs] - 停留秒数（默认 4.5）
 */
function pushDreamToast(title, body, tone, secs) {
  const box = $('dreamToast');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'dream-toast' + (tone ? ' ' + tone : '');
  el.innerHTML = '<div class="tt"></div><div class="tb"></div>';
  el.querySelector('.tt').textContent = title || '';
  el.querySelector('.tb').textContent = body || '';
  box.appendChild(el);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 420);
  }, Math.max(1500, (secs || 4.5) * 1000));
}

/**
 * 深层梦境氛围（遮罩 + 暗角 + 顶部横幅）
 * @param {boolean} on - 是否处于深层
 */
function toggleDeepAtmosphere(on) {
  ['deepDreamOverlay', 'deepDreamVignette'].forEach(id => {
    const el = $(id);
    if (!el) return;
    if (on) { el.style.display = ''; el.classList.add('on'); }
    else { el.classList.remove('on'); el.style.display = 'none'; }
  });
}

/** 刷新深层梦境 HUD 横幅（名称 / 进度点 / 目标） */
function updateDeepHUD() {
  const banner = $('deepBanner');
  if (!banner) return;
  const active = typeof DeepDream !== 'undefined' && DeepDream.isActive();
  if (!active) {
    banner.classList.remove('show');
    banner.style.display = 'none';
    toggleDeepAtmosphere(false);
    return;
  }
  const prog = DeepDream.getProgress();
  const lv = (prog && prog.level) || DeepDream.getCurrentLevel() || {};
  toggleDeepAtmosphere(true);
  const ico = banner.querySelector('.db-ico');
  const name = banner.querySelector('.db-name');
  const dots = banner.querySelector('.db-dots');
  const goal = banner.querySelector('.db-goal');
  if (ico) ico.textContent = lv.icon || '🕳️';
  if (name) name.textContent = lv.name || '深层梦境';
  if (dots) {
    const total = (prog && prog.total) || lv.duration || 3;
    const cur = (prog && prog.wave) || 1;
    let html = '';
    for (let i = 0; i < total; i++) html += '<i class="db-dot' + (i < cur ? ' on' : '') + '"></i>';
    dots.innerHTML = html;
  }
  if (goal) {
    const g = lv.goal || '';
    goal.textContent = g ? ('目标：' + g) : '';
    goal.title = (lv.rules || '') ? ('规则：' + lv.rules) : '';
  }
  banner.style.display = 'flex';
  requestAnimationFrame(() => banner.classList.add('show'));
}

// === 剧情对话框（沉浸版）===
let storyQueue = [];
let storyTyping = false;
let _storyTimer = null;
let _storyAutoNext = null;

// 角色配置：颜色 + 头像 + 氛围光
// 唯一真相来源是 story.js 的 STORY_CHARACTERS（这里按「剧中人名」建索引），
// 找不到的名字才落回下面的兜底表，避免两处配色打架。
const STORY_SPEAKERS = (function () {
  const table = {
    '旁白':   { color: '#94a3b8', icon: '📖', glow: 'rgba(148,163,184,.12)' },
    '???':    { color: '#c77dff', icon: '👁️', glow: 'rgba(199,125,255,.15)' },
    '梦魇':   { color: '#ef4444', icon: '💀', glow: 'rgba(239,68,68,.12)' },
    '你':     { color: '#e2e8f0', icon: '🛏️', glow: 'rgba(226,231,240,.08)' },
    '系统':   { color: '#7dd3fc', icon: '🖥️', glow: 'rgba(125,211,252,.12)' },
  };
  if (typeof STORY_CHARACTERS !== 'undefined' && STORY_CHARACTERS) {
    Object.keys(STORY_CHARACTERS).forEach(k => {
      const c = STORY_CHARACTERS[k];
      if (!c || !c.name) return;
      table[c.name] = {
        color: c.color || '#c4b5fd',
        icon: c.icon || '💬',
        glow: c.glow || 'rgba(167,139,250,.12)',
        desc: c.desc || '',
      };
    });
  }
  return table;
})();

function showStoryDialog(data) {
  const panel = $('storyDialog');
  if (!panel) return;
  storyQueue.push(data);
  if (!storyTyping && panel.style.display !== 'flex') _processStoryQueue();
}

/** 可选剧情视频：素材缺失、解码失败或浏览器不支持时，文字剧情照常播放。 */
function _renderStoryMedia(data) {
  const box = $('storyMedia');
  if (!box) return;
  _clearStoryMedia();
  const slots = typeof STORY_VIDEO_SLOTS !== 'undefined' ? STORY_VIDEO_SLOTS : null;
  const slot = slots && data && data.sceneId ? slots[data.sceneId] : null;
  if (!slot || (!slot.video && !slot.poster)) return;

  box.style.display = 'block';
  box.setAttribute('aria-label', slot.title || '剧情镜头');
  const poster = typeof slot.poster === 'string' ? slot.poster.trim() : '';
  if (poster) {
    const image = document.createElement('img');
    image.className = 'story-media-poster';
    image.src = poster;
    image.alt = (slot.title || '剧情镜头') + '画面';
    image.onerror = () => { image.hidden = true; };
    box.appendChild(image);
  }

  const source = typeof slot.video === 'string' ? slot.video.trim() : '';
  if (!source) return;
  const video = document.createElement('video');
  video.className = 'story-media-video';
  video.src = source;
  if (poster) video.poster = poster;
  video.controls = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.setAttribute('aria-label', slot.title || '剧情视频');
  video.onerror = () => {
    if (!box.contains(video)) return;
    video.hidden = true;
    const fallback = document.createElement('div');
    fallback.className = 'story-media-fallback';
    fallback.textContent = '镜头暂不可用，文字记录仍可继续。';
    box.appendChild(fallback);
  };
  box.appendChild(video);
}

function _clearStoryMedia() {
  const box = $('storyMedia');
  if (!box) return;
  const video = box.querySelector('video');
  if (video) {
    video.onerror = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  while (box.firstChild) box.removeChild(box.firstChild);
  box.style.display = 'none';
  box.removeAttribute('aria-label');
}

function _processStoryQueue() {
  if (!storyQueue.length) { hideStoryDialog(); return; }
  const data = storyQueue.shift();
  const panel = $('storyDialog');
  if (!panel) return;
  panel.style.display = 'flex';
  if (typeof Music !== 'undefined') Music.setDucking(true);
  // 需要玩家做选择时暂停游戏，读完/选完再继续（避免「选着选着床没了」）
  const hasChoices = !!(data.choices && data.choices.length);
  if (hasChoices) {
    panel.dataset.inputLocked = 'true';
    _pauseForStory();
  }
  // 暗角效果
  const vig = $('storyVignette');
  if (vig) { vig.style.display = ''; requestAnimationFrame(() => vig.style.opacity = '1'); }
  // 角色氛围
  const sp = STORY_SPEAKERS[data.speaker] || STORY_SPEAKERS['???'];
  panel.style.setProperty('--sp-c', sp.color || '#a78bfa');
  panel.style.setProperty('--sp-glow', sp.glow || 'rgba(167,139,250,.16)');
  const spEl = $('storySpeaker');
  const avatar = $('storyAvatar');
  const storyMeta = $('storyMeta');
  if (avatar) {
    avatar.textContent = sp.icon || '◌';
    avatar.style.setProperty('--sp-c', sp.color || '#a78bfa');
    avatar.style.setProperty('--sp-glow', sp.glow || 'rgba(167,139,250,.35)');
    avatar.setAttribute('aria-label', (data.speaker || '未知声音') + '的头像');
  }
  if (storyMeta) storyMeta.textContent = [data.actTitle, data.wave ? '梦境记录 · 第 ' + data.wave + ' 波' : '梦境记录 · 未知时间'].filter(Boolean).join('　/　');
  if (spEl) {
    spEl.textContent = data.speaker || '???';
    spEl.style.color = sp.color;
  }
  panel.classList.toggle('narration', data.speaker === '旁白');
  // 氛围光
  const deco = panel.querySelector('.story-deco');
  if (deco) deco.style.background = 'linear-gradient(90deg,' + sp.glow + ',transparent)';
  // 角色小档案（来自 story.js，沉浸感：说话的人是谁）
  if (deco && sp.desc) deco.title = (data.speaker || '') + '：' + sp.desc;
  const textEl = $('storyText');
  _renderStoryMedia(data);
  textEl.textContent = '';
  textEl.scrollTop = 0;
  const choicesEl = $('storyChoices');
  choicesEl.innerHTML = '';
  choicesEl.style.display = '';
  const nextEl = $('storyNext');
  nextEl.style.display = hasChoices ? 'none' : '';
  storyTyping = true;
  textEl.classList.add('typing');

  // 打字机效果
  const text = data.text || '';
  let i = 0;
  if (_storyTimer) { clearInterval(_storyTimer); _storyTimer = null; }
  _storyTimer = setInterval(() => {
    if (i < text.length) {
      textEl.textContent += text[i++];
      // 追字时保持滚动到底部（长文案不再顶穿上沿）
      textEl.scrollTop = textEl.scrollHeight;
    } else {
      clearInterval(_storyTimer); _storyTimer = null;
      storyTyping = false;
      textEl.classList.remove('typing');
      if (hasChoices) _renderStoryChoices(data);
      else nextEl.style.display = '';
    }
  }, 32);

  nextEl.onclick = () => {
    if (storyTyping) {
      clearInterval(_storyTimer); _storyTimer = null;
      storyTyping = false;
      textEl.classList.remove('typing');
      textEl.textContent = text;
      textEl.scrollTop = textEl.scrollHeight;
      if (hasChoices) _renderStoryChoices(data);
      else nextEl.style.display = '';
    } else {
      _processStoryQueue();
    }
  };
}

/** 渲染剧情选项，并在点击时用统一解释器兑现选项承诺 */
function _renderStoryChoices(data) {
  const box = $('storyChoices');
  const nextEl = $('storyNext');
  if (!box) return;
  box.style.display = '';
  box.innerHTML = data.choices.map((c, idx) =>
    '<button class="story-choice" data-idx="' + idx + '">' + (c.text || '…') + '</button>'
  ).join('');
  if (nextEl) nextEl.style.display = 'none';
  box.querySelectorAll('.story-choice').forEach(btn => {
    btn.onclick = () => {
      const choice = data.choices[+btn.dataset.idx];
      _applyStoryChoice(choice, data);
    };
  });
}

/**
 * 执行剧情选项：把「选项文案里承诺的东西」真的发到玩家手上
 * @param {object} choice - { text, effect }
 * @param {object} data - 剧情数据（用于取说话人，判断好感度归属）
 */
function _applyStoryChoice(choice, data) {
  if (!choice) { _processStoryQueue(); return; }
  const eff = choice.effect || '';

  // ---- 特殊抉择：理解 / 攻击（不是文案效果，走 MercyPath 的真实结算）----
  if (eff.indexOf('__mercy_') === 0) {
    const isComplete = eff.indexOf('__mercy_complete__') === 0;
    const encId = eff.replace('__mercy_complete__', '').replace('__mercy_refuse__', '');
    let line = '✦ 你做出了选择';
    if (typeof MercyPath !== 'undefined') {
      if (isComplete) {
        const r = MercyPath.completeMercy(encId);
        const got = (r && r.got) || [];
        const nm = (r && r.encounter && r.encounter.name) || '梦境生物';
        line = '🕊 理解达成：' + nm + (got.length ? '（' + got.join('　') + '）' : ' 安静地离开了');
        pushDreamToast('🕊 理解 · ' + nm, got.join('　') || '它安静地离开了', 'green', 6);
      } else {
        const enc = MercyPath.refuseMercy();
        line = '⚔️ 你选择了战斗；' + ((enc && enc.name) || '它') + ' 被激怒（伤害 +25%）';
      }
    }
    _showChoiceResult(line, 2400);
    return;
  }

  let got = [];
  if (eff && typeof applyStoryEffect === 'function') {
    try {
      const r = applyStoryEffect(eff, { speaker: data && data.speaker });
      got = (r && r.got) || [];
    } catch (e) { console.warn('[story] effect failed:', e); }
  }
  _showChoiceResult(got.length ? '✓ 实际获得：' + got.join('　')
    : (eff ? '✦ 已记入梦境日记：' + eff : '✦ 你做出了选择'), 2800);
}

/** 展示选择结果，并自动/手动继续对话 */
function _showChoiceResult(line, autoMs) {
  const box = $('storyChoices');
  const nextEl = $('storyNext');
  if (box) {
    box.innerHTML = '<div class="story-result"></div>';
    box.querySelector('.story-result').textContent = line;
    box.style.display = '';
  }
  if (nextEl) {
    nextEl.style.display = '';
    nextEl.onclick = () => { clearTimeout(_storyAutoNext); _processStoryQueue(); };
  }
  clearTimeout(_storyAutoNext);
  _storyAutoNext = setTimeout(() => _processStoryQueue(), autoMs || 2600);
}

function hideStoryDialog() {
  if (_storyTimer) { clearInterval(_storyTimer); _storyTimer = null; }
  clearTimeout(_storyAutoNext);
  _clearStoryMedia();
  const panel = $('storyDialog');
  if (panel) {
    panel.style.display = 'none';
    panel.style.borderColor = '';
    panel.style.boxShadow = '';
    const d = panel.querySelector('.story-deco');
    if (d) { d.style.background = ''; d.title = ''; }
  }
  // 隐藏暗角
  const vig = $('storyVignette');
  if (vig) { vig.style.opacity = '0'; setTimeout(() => vig.style.display = 'none', 400); }
  storyQueue = [];
  storyTyping = false;
  if (panel) delete panel.dataset.inputLocked;
  if (typeof Music !== 'undefined') Music.setDucking(false);
  _resumeAfterStory();
  // 剧情读完后，把排队等着的第四面墙演出放出来
  _flushPendingFourthWall();
}

// === 日记面板 ===
function showDiaryPanel() {
  const panel = $('diaryPanel');
  if (!panel) return;
  if (typeof DreamEngine !== 'undefined') {
    const snap = DreamEngine.getSnapshot();
    const rate = snap.diary ? snap.diary.completion : 0;
    const bar = $('diaryBar');
    if (bar) bar.style.width = rate + '%';
    const list = $('diaryList');
    if (list) {
      // 最新在前，便于回看刚发生的事
      const entries = (typeof DreamDiary !== 'undefined' && DreamDiary._entries ? DreamDiary._entries.slice() : []).reverse();
      if (entries.length) {
        list.innerHTML = entries.map(e => {
          const td = e.typeDef || { name: '笔记', icon: '📝', color: '#94a3b8' };
          return '<div class="diary-entry">' +
            '<div class="diary-head">' +
              '<span class="diary-badge" style="background:' + td.color + '1f;color:' + td.color + ';border:1px solid ' + td.color + '44">' + td.icon + ' ' + td.name + '</span>' +
              '<span class="diary-date">' + (e.wave ? '第 ' + e.wave + ' 波' : '梦境之外') + '</span>' +
            '</div>' +
            '<div class="diary-text"></div></div>';
        }).join('');
        // 正文用 textContent 填充，避免剧情文案里的特殊字符破坏结构
        list.querySelectorAll('.diary-entry').forEach((el, i) => {
          const t = el.querySelector('.diary-text');
          if (t && entries[i]) t.textContent = entries[i].content || '';
        });
      } else {
        list.innerHTML = '<div class="diary-entry locked">还没有任何记录…去冒险吧。</div>';
      }
    }
  }
  panel.style.display = '';
  const startPanel = $('startPanel');
  if (startPanel) startPanel.style.display = 'none';
}

// === NPC面板（人格名/职能 + 真实驻守状态） ===
function showNPCPanel() {
  const panel = $('npcPanel');
  if (!panel) return;
  if (typeof NPCGuardians !== 'undefined') {
    const list = $('npcList');
    if (list) {
      const allNPCs = NPCGuardians.NPC_DATA || [];
      const recruited = NPCGuardians.getRecruited();
      const abilityNames = { heal: '治疗', atkBoost: '攻击增幅', slowEnemy: '减速', goldGen: '产金', shield: '护盾', reveal: '侦测' };
      list.innerHTML = allNPCs.map(npc => {
        // 驻守判定必须用「定义 ID」比对实例，否则永远显示未招募
        const inst = recruited.find(n => n.def && n.def.id === npc.id);
        const dialog = (typeof NPC_DIALOG !== 'undefined') ? NPC_DIALOG.find(d => d && d.abilityId === npc.id) : null;
        const persona = (dialog && dialog.name) || '';
        const role = (dialog && dialog.role) || '';
        return '<div class="npc-card' + (inst ? ' stationed' : '') + '">' +
          '<div class="npc-avatar">' + (npc.icon || '👤') + '</div>' +
          '<div class="npc-name">' + npc.name + (persona ? '<span class="npc-persona">' + persona + '</span>' : '') + '</div>' +
          '<div class="npc-role">' + (role ? role + ' · ' : '') + (abilityNames[npc.ability] || npc.ability || '') + '</div>' +
          '<div class="npc-ability">' + (npc.desc || '') +
            (dialog && dialog.stationed ? '<span class="npc-stationed">' + dialog.stationed + '</span>' : '') + '</div>' +
          (inst ? '<div class="npc-room">驻守中</div>' :
            '<button class="npc-recruit-btn" data-id="' + npc.id + '">招募</button>') +
          '</div>';
      }).join('');
      list.querySelectorAll('.npc-recruit-btn').forEach(btn => {
        btn.onclick = () => {
          const rooms = ['lane_0', 'lane_1', 'lane_2'];
          const usedRooms = NPCGuardians.getRecruited().map(n => n.roomId);
          const freeRoom = rooms.find(r => usedRooms.indexOf(r) < 0) || 'lane_0';
          const npc = NPCGuardians.recruitNPC(btn.dataset.id, freeRoom);
          if (npc) pushDreamToast('👥 招募成功', (npc.def && npc.def.name) + ' 已驻守防线', 'green');
          showNPCPanel(); // 刷新
        };
      });
    }
  }
  panel.style.display = '';
  const startPanel = $('startPanel');
  if (startPanel) startPanel.style.display = 'none';
}

// === 碎片画廊（卡片可点开读全文，长段落不再被 155px 卡片截断） ===
const FRAG_RARITY_NAMES = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };
const FRAG_RARITY_COLORS = { common: '#cbd5e1', rare: '#60a5fa', epic: '#a78bfa', legendary: '#fbbf24' };

function showFragmentGallery() {
  const panel = $('fragmentGallery');
  if (!panel) return;
  if (typeof DreamFragments !== 'undefined') {
    const defs = DreamFragments.FRAGMENT_DEFS || [];
    const collected = DreamFragments._collected;
    const list = $('fragmentList');
    const sub = panel.querySelector('.dream-panel-sub');
    const unlockedCount = defs.filter(f => collected && collected.has(f.id)).length;
    if (sub) sub.textContent = '散落在梦境中的记忆 — ' + unlockedCount + '/' + defs.length + ' 已收集';
    if (list) {
      list.innerHTML = defs.map(f => {
        const unlocked = !!(collected && collected.has(f.id));
        const rarity = unlocked ? DreamFragments.rarityOf(f) : 'locked';
        const rc = FRAG_RARITY_COLORS[rarity] || '#cbd5e1';
        return '<div class="fragment-card ' + rarity + '" data-id="' + f.id + '">' +
          '<div class="fico">' + (unlocked ? (f.icon || '💎') : '❓') + '</div>' +
          '<div class="fname">' + (unlocked ? (f.name || '') : '???') + '</div>' +
          '<div class="fdesc"></div>' +
          (unlocked
            ? '<span class="frag-rarity" style="background:' + rc + '22;color:' + rc + '">' + (FRAG_RARITY_NAMES[rarity] || rarity) + '</span>' +
              '<span class="fmore">点击读全文</span>'
            : '<span class="fmore">尚未拾得</span>') +
          '</div>';
      }).join('');
      // 正文用 textContent 填充（碎片文案里有引号等字符）
      const cards = list.querySelectorAll('.fragment-card');
      defs.forEach((f, i) => {
        const d = cards[i] && cards[i].querySelector('.fdesc');
        if (!d) return;
        const unlocked = !!(collected && collected.has(f.id));
        d.textContent = unlocked ? (f.story || f.desc || '') : '未解锁';
      });
      cards.forEach(card => {
        if (card.classList.contains('locked')) return;
        card.onclick = () => openFragmentDetail(card.dataset.id);
      });
    }
  }
  panel.style.display = '';
  const startPanel = $('startPanel');
  if (startPanel) startPanel.style.display = 'none';
}

/**
 * 打开碎片全文浮层
 * @param {string} id - 碎片 ID
 */
function openFragmentDetail(id) {
  const box = $('fragmentDetail');
  if (!box || typeof DreamFragments === 'undefined') return;
  const f = (DreamFragments.FRAGMENT_DEFS || []).find(x => x.id === id);
  if (!f) return;
  const rarity = DreamFragments.rarityOf(f);
  const rc = FRAG_RARITY_COLORS[rarity] || '#cbd5e1';
  box.innerHTML =
    '<div class="fd-ico"></div>' +
    '<div class="fd-name"></div>' +
    '<span class="fd-rar" style="background:' + rc + '22;color:' + rc + '">' + (FRAG_RARITY_NAMES[rarity] || rarity) + ' 记忆碎片</span>' +
    '<div class="fd-text"></div>' +
    '<button class="fd-close">关 闭</button>';
  box.querySelector('.fd-ico').textContent = f.icon || '💎';
  box.querySelector('.fd-name').textContent = f.name || '';
  box.querySelector('.fd-text').textContent = (f.story || f.desc || '') +
    (f.desc && f.story ? '\n\n—— ' + f.desc : '');
  box.querySelector('.fd-close').onclick = () => box.classList.remove('show');
  box.classList.add('show');
}

// === 第四面墙效果（引擎只广播，演出全部在这里） ===
let fourthWallActive = false;
let _fwCrashTimer = null, _fwChatTimer = null, _fwRevertTimer = null;
/** 剧情框正展示时，全屏第四面墙演出先排队（避免盖住玩家正在读的剧情与选项） */
let _fwPending = null;
let _fwPendingTimer = null;

/** 剧情框是否正在展示 */
function _storyPanelOpen() {
  const p = $('storyDialog');
  return !!(p && p.style.display === 'flex');
}

/**
 * 假崩溃：剧情进行中则排队，等剧情框收起再演
 * （第 30 波「最后一夜」的选择做完之后，才轮到蓝屏）
 * @param {object} [data] - { title, content }
 */
function showFakeCrash(data) {
  if (_storyPanelOpen()) {
    _fwPending = data || {};
    clearTimeout(_fwPendingTimer);
    // 兜底：玩家一直没点「继续」时，20 秒后仍把演出放出来，避免演出丢失
    _fwPendingTimer = setTimeout(() => { _flushPendingFourthWall(); }, 20000);
    return;
  }
  _playFakeCrash(data);
}

/** 释放排队的第四面墙演出 */
function _flushPendingFourthWall() {
  clearTimeout(_fwPendingTimer);
  if (!_fwPending) return;
  const d = _fwPending;
  _fwPending = null;
  _playFakeCrash(d);
}

/**
 * 假崩溃演出（蓝屏风格，多行文案完整展示）
 * @param {object} [data] - { title, content }
 */
function _playFakeCrash(data) {
  const overlay = $('fourthWallOverlay');
  if (!overlay) return;
  fourthWallActive = true;
  overlay.innerHTML =
    '<div class="bsod-icon">:(</div>' +
    '<div class="bsod-title"></div>' +
    '<div class="bsod-content"></div>' +
    '<div class="bsod-bar"><i></i></div>' +
    '<div class="bsod-hint">这只是梦境在跟你开玩笑。</div>';
  overlay.querySelector('.bsod-title').textContent = (data && data.title) || '梦境崩溃';
  overlay.querySelector('.bsod-content').textContent =
    (data && data.content) || '梦境遇到了问题，需要重新启动。\n错误代码：REALITY_NOT_FOUND';
  overlay.style.display = 'flex';
  // 进度条走满，像真的在「收集错误信息」
  const bar = overlay.querySelector('.bsod-bar i');
  requestAnimationFrame(() => { if (bar) bar.style.width = '100%'; });
  clearTimeout(_fwCrashTimer);
  _fwCrashTimer = setTimeout(() => hideFakeCrash(), 3400);
}

/** 收起假崩溃（引擎的 fakeCrashEnd 也会走到这里） */
function hideFakeCrash() {
  clearTimeout(_fwCrashTimer);
  const overlay = $('fourthWallOverlay');
  if (overlay) overlay.style.display = 'none';
  fourthWallActive = false;
}

/**
 * UI 篡改：金币倒置 / 按钮改名 / 全屏反色 / 故障抖动
 * @param {object} data - { type|subType, title, content }
 */
function applyUICorrupt(data) {
  if (!data) return;
  const type = data.subType || data.type;
  if (!type) return;
  fourthWallActive = true;
  const wrap = document.getElementById('wrap');
  if (type === 'goldInvert') {
    const g = $('hudGold');
    if (g) g.style.transform = 'scaleY(-1)';
  } else if (type === 'colorInvert') {
    if (wrap) wrap.style.filter = 'invert(1) hue-rotate(180deg)';
  } else if (type === 'glitch') {
    if (wrap) wrap.classList.add('fourth-wall-glitch');
  } else if (type === 'buttonReplace') {
    const cursed = ['逃跑', '投降', '放弃', '梦魇', '虚无', '混沌', '???', '错误', '迷失', '深渊', '绝望', '腐朽'];
    document.querySelectorAll('#buildBar .card .nm').forEach((el, i) => {
      if (!el._orig) el._orig = el.textContent;
      el.textContent = cursed[i % cursed.length];
    });
  }
  // 让玩家知道「这是梦在做怪」，而不是真的 bug
  // （若同波剧情框已经讲过同一段话，就只保留视觉演出，不重复弹文案）
  if (data.content && !data.silent) pushDreamToast('👁 ' + (data.title || '数据错乱'), data.content, 'red', 5.5);
  // 15 秒后自动恢复（与引擎的 corruptTimer 对齐）
  clearTimeout(_fwRevertTimer);
  _fwRevertTimer = setTimeout(() => revertFourthWall(), 15100);
}

/**
 * 梦魇在游戏画面里说话（长文案按长度延长停留时间）
 * @param {object} data - { text, title }
 */
function showChatMessage(data) {
  const chat = $('fourthWallChat');
  if (!chat) return;
  // 同波剧情框已经讲过这段话 → 不再重复一次气泡
  if (data && data.silent) return;
  const text = (data && (data.text || data.msg)) || '...';
  const sender = (data && data.title) || '梦魇';
  chat.innerHTML = '<div class="fw-sender"></div><div class="fw-msg"></div>';
  chat.querySelector('.fw-sender').textContent = '💀 ' + sender;
  chat.querySelector('.fw-msg').textContent = text;
  chat.style.display = '';
  chat.style.transition = '';
  chat.style.opacity = '1';
  clearTimeout(_fwChatTimer);
  const hold = Math.min(12000, 2800 + text.length * 60);
  _fwChatTimer = setTimeout(() => {
    chat.style.transition = 'opacity 1.2s ease-out';
    chat.style.opacity = '0';
    _fwChatTimer = setTimeout(() => { chat.style.display = 'none'; chat.style.transition = ''; }, 1200);
  }, hold);
}

/**
 * 存档损坏演出：屏幕故障抖动 + 长文案提示
 * @param {object} [data] - { title, content }
 */
function showSaveCorrupt(data) {
  const wrap = document.getElementById('wrap');
  if (wrap) {
    wrap.classList.add('fourth-wall-glitch');
    setTimeout(() => { if (!fourthWallActive) wrap.classList.remove('fourth-wall-glitch'); }, 1500);
  }
  if (typeof SFX !== 'undefined' && SFX.zap) { try { SFX.zap(); } catch (e) { /* 忽略音频错误 */ } }
  if (!data || !data.silent) {
    pushDreamToast('💾 ' + ((data && data.title) || '存档损坏'),
      (data && data.content) || '存档损坏。\n数据：████████████\n恢复失败。', 'red', 8);
  }
}

/** 恢复所有第四面墙篡改 */
function revertFourthWall() {
  clearTimeout(_fwRevertTimer);
  fourthWallActive = false;
  const wrap = document.getElementById('wrap');
  if (wrap) { wrap.style.filter = ''; wrap.classList.remove('fourth-wall-glitch'); }
  const g = $('hudGold');
  if (g) g.style.transform = '';
  document.querySelectorAll('#buildBar .card .nm').forEach(el => {
    if (el._orig) { el.textContent = el._orig; delete el._orig; }
  });
  document.querySelectorAll('button').forEach(btn => {
    if (btn._originalText) { btn.textContent = btn._originalText; delete btn._originalText; }
  });
}

// === 梦中梦过渡（深层梦境入场，电影感） ===
let _deepTransTimer = null;

/**
 * 坠入深层梦境的转场演出
 * @param {object} data - 深层关卡定义（story.js DEEP_DREAM_LEVELS 编译而来）
 */
function showDeepDreamTransition(data) {
  const overlay = $('deepDreamTransition');
  if (!overlay) return;
  const text = overlay.querySelector('.deep-dream-text');
  const sub = overlay.querySelector('.deep-dream-sub');
  if (text) text.textContent = data && data.name ? ('正在坠入「' + data.name + '」…') : '正在坠入深层梦境…';
  if (sub) sub.textContent = (data && data.desc) || '你感到意识在下沉';
  // 规则与目标：让玩家入场就知道这层有什么不一样
  let rules = overlay.querySelector('.deep-dream-rules');
  if (!rules) {
    rules = document.createElement('div');
    rules.className = 'deep-dream-sub deep-dream-rules';
    rules.style.cssText = 'font-size:11.5px;max-width:680px;text-align:center;line-height:2;color:#8b7fb8';
    overlay.appendChild(rules);
  }
  rules.textContent = [data && data.rules, data && data.goal ? ('目标：' + data.goal) : '']
    .filter(Boolean).join('\n');
  overlay.style.display = 'flex';
  clearTimeout(_deepTransTimer);
  _deepTransTimer = setTimeout(() => { overlay.style.display = 'none'; }, 4200);
}

/** 收起深层转场（进入战斗或提前退出时） */
function hideDeepDreamTransition() {
  clearTimeout(_deepTransTimer);
  const overlay = $('deepDreamTransition');
  if (overlay) overlay.style.display = 'none';
}

// === 碎片弹出 ===
function showFragmentPopup(data) {
  if (!data) return;
  if (typeof addText === 'function' && data.x != null && data.y != null) {
    addText(data.x, data.y - 40, (data.icon || '💎') + ' ' + (data.name || data.title || '记忆碎片') + '！', '#fbbf24', true);
  }
  if (data.story || data.text) {
    pushDreamToast('💎 拾得碎片 · ' + (data.name || data.title || ''), (data.story || data.text), 'gold', 6);
  }
}

// === 理解对话（不战而胜）：逐条播台词 → 由玩家决定理解或攻击 ===
function showMercyDialog(data) {
  if (!data || typeof MercyPath === 'undefined') return;
  const encounter = data.encounter || {};
  const encId = encounter.id || '';
  _pauseForStory();
  let lines = [];
  try { lines = MercyPath.getDialogueLines() || []; } catch (e) { lines = []; }
  if (!lines.length) {
    lines = [{ speaker: encounter.name || '???', text: encounter.dialogue || encounter.desc || '……' }];
  }
  const parts = lines.map(l => ({
    speaker: l.speaker || encounter.name || '???',
    text: l.text || '……',
  }));
  // 前面的台词逐条入场（无选项），最后一条挂上抉择
  parts.slice(0, -1).forEach(p => showStoryDialog({ speaker: p.speaker, text: p.text }));
  const last = parts[parts.length - 1];
  showStoryDialog({
    speaker: last.speaker,
    text: last.text + '\n\n（它停了下来，没有反抗。你打算怎么做？）',
    choices: [
      { text: '🕊 理解它 — ' + ((encounter.reward && encounter.reward.text) || '结束这场无意义的战斗'),
        effect: '__mercy_complete__' + encId },
      { text: '⚔️ 攻击它 — 继续把梦打碎',
        effect: '__mercy_refuse__' + encId },
    ],
  });
}

// === 绑定梦境菜单按钮 ===
function wireDreamMenuButtons() {
  const btnDiary = $('btnDiary');
  const btnNPC = $('btnNPC');
  const btnFragments = $('btnFragments');
  if (btnDiary) btnDiary.onclick = () => showDiaryPanel();
  if (btnNPC) btnNPC.onclick = () => showNPCPanel();
  if (btnFragments) btnFragments.onclick = () => showFragmentGallery();

  // 返回按钮
  const diaryClose = $('diaryClose');
  const npcClose = $('npcClose');
  const fragClose = $('fragClose');
  if (diaryClose) diaryClose.onclick = () => { $('diaryPanel').style.display = 'none'; showMenu(); };
  if (npcClose) npcClose.onclick = () => { $('npcPanel').style.display = 'none'; showMenu(); };
  if (fragClose) fragClose.onclick = () => { $('fragmentGallery').style.display = 'none'; showMenu(); };
}

/* ==================================================================
 *  梦境委托（任务系统）UI
 *  数据与引擎在 quest.js（QuestSystem），这里只负责"看得见、点得开"：
 *    · 幕卡演出 showActCard —— 接取/完成委托时的一秒仪式感
 *    · 委托面板 —— 当前目标进度 + 信物背包 + 六章进度
 *    · 信物详情 —— 点开读全文（lore），这是"掉落物也有叙事"的关键
 * ================================================================== */
let _actTimer = null;

/** 章节卡演出：先暂停游戏，避免全屏遮住时被偷家 */
function showActCard(act, title, sub) {
  const el = $('actCard');
  if (!el) return;
  _pauseForStory();
  $('acAct').textContent = act || '';
  $('acTitle').textContent = title || '';
  $('acSub').textContent = sub || '';
  el.classList.remove('out', 'show');
  el.style.display = 'flex';
  void el.offsetWidth;
  el.classList.add('show');
  if (_actTimer) clearTimeout(_actTimer);
  _actTimer = setTimeout(hideActCard, 2300);
}

function hideActCard() {
  const el = $('actCard');
  if (!el || el.style.display === 'none') return;
  if (_actTimer) { clearTimeout(_actTimer); _actTimer = null; }
  el.classList.remove('show');
  el.classList.add('out');
  setTimeout(() => { el.style.display = 'none'; el.classList.remove('out'); }, 620);
}

/** 渲染委托面板（打开时与每次进度变化后调用） */
let _questPanelSig = '';
function renderQuestPanel(force) {
  if (typeof QuestSystem === 'undefined' || !$('questPanel')) return;
  const snap = QuestSystem.getSnapshot();
  // 面板可能在游戏进行中被 updateHUD 反复刷新：数据没变就别重建 DOM
  const _sig = QuestSystem._s.idx + '|' + QuestSystem.totalItems() + '|' + JSON.stringify(QuestSystem._s.chapters);
  if (!force && _sig === _questPanelSig) return;
  _questPanelSig = _sig;

  // ---- 当前委托 ----
  const cur = $('questCurrent');
  if (snap.active) {
    const d = snap.active.def, it = QUEST_ITEMS[d.item];
    const en = (typeof ENEMY_DEFS !== 'undefined' && ENEMY_DEFS[d.enemy]) ? ENEMY_DEFS[d.enemy].name : d.enemy;
    const p = clamp(snap.active.items / Math.max(1, d.need), 0, 1);
    cur.innerHTML =
      '<div class="qcur">' +
        '<div class="qa">' + d.act + '　·　进行中</div>' +
        '<div class="qt">' + it.icon + ' ' + d.title + '</div>' +
        '<div class="qg">目标：击杀 <b>' + en + '</b>，收集 <b>' + it.name + '</b><br>' +
        '信物 <b>' + snap.active.items + ' / ' + d.need + '</b>　已击杀 <b>' + snap.active.kills + '</b> 只　（掉落来源：' + it.from + '）</div>' +
        '<div class="qbar"><i style="width:' + (p * 100).toFixed(0) + '%"></i></div>' +
      '</div>';
  } else if (snap.finished) {
    cur.innerHTML = '<div class="qcur"><div class="qa">全 篇 终</div><div class="qt">🔔 六件信物，六个夜晚</div>' +
      '<div class="qg">你已经把这场梦完整地读了一遍。梦魇还会再来，但你不再问「为什么是我」。</div></div>';
  } else {
    const nx = QuestSystem.getNext();
    cur.innerHTML = '<div class="qcur"><div class="qa">等 待 解 锁</div><div class="qt">📜 下一份委托尚未出现</div>' +
      '<div class="qg">' + (nx ? '推进到第 <b>' + nx.unlockWave + '</b> 波时，会有新的信物出现在梦魇身上。' : '全部委托已完成。') + '</div></div>';
  }

  // ---- 信物背包 ----
  const items = snap.items;
  $('questItemCount').textContent = QuestSystem.totalItems() + ' 件';
  const iel = $('questItems');
  iel.innerHTML = items.length
    ? items.map(x => {
        const r = (typeof RARITY !== 'undefined' && RARITY[x.def.rare]) ? RARITY[x.def.rare] : { color: '#94a3b8' };
        return '<div class="qitem" data-item="' + x.id + '" style="border-color:' + r.color + '55" title="点击查看全文">' +
          '<span class="qi">' + x.def.icon + '</span>' +
          '<span class="qn" style="color:' + r.color + '">' + x.def.name + '</span>' +
          '<span class="qc">×' + x.count + '</span></div>';
      }).join('')
    : '<div class="qempty">还没有信物。击杀委托指定的梦魇即可掉落 —— 面板上方写着"信物持有者"。</div>';
  iel.querySelectorAll('[data-item]').forEach(el => { el.onclick = () => openQuestItem(el.dataset.item); });

  // ---- 六章进度 ----
  $('questProg').textContent = snap.doneCount + ' / ' + snap.total + ' 完成';
  $('questList').innerHTML = snap.chapters.map(c => {
    const it = QUEST_ITEMS[c.def.item];
    const cls = c.done ? 'done' : (c.current ? 'cur' : 'locked');
    const st = c.done ? '✅ 已完成' : (c.current ? ('进行中 ' + c.items + '/' + c.def.need) : ('第 ' + c.def.unlockWave + ' 波解锁'));
    return '<div class="qrow ' + cls + '">' +
      '<span class="qi2">' + (c.done ? '✅' : it.icon) + '</span>' +
      '<div><div class="qn2">' + c.def.title + '</div>' +
      '<div class="qd2">' + c.def.act + '　·　' + it.name + ' ×' + c.def.need + '（' + it.from + '）</div></div>' +
      '<span class="qs">' + st + '</span></div>';
  }).join('');
}

function showQuestPanel() {
  const el = $('questPanel');
  if (!el) return;
  renderQuestPanel();
  el.style.display = '';
  el.classList.add('open');
}

function closeQuestPanel() {
  const el = $('questPanel');
  if (!el) return;
  el.style.display = 'none';
  el.classList.remove('open');
}

/** 信物详情浮层（"可以查看"的落点） */
function openQuestItem(id) {
  const d = (typeof QUEST_ITEMS !== 'undefined') ? QUEST_ITEMS[id] : null;
  if (!d) return;
  const r = (typeof RARITY !== 'undefined' && RARITY[d.rare]) ? RARITY[d.rare] : { name: '普通', color: '#94a3b8' };
  $('itemIco').textContent = d.icon;
  $('itemName').textContent = d.name;
  $('itemName').style.color = r.color;
  $('itemFrom').innerHTML = '来自「' + d.from + '」　·　' +
    '<span style="color:' + r.color + '">' + r.name + '</span>';
  $('itemDesc').textContent = d.desc;
  $('itemLore').textContent = d.lore;
  const el = $('itemDetail');
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function closeQuestItem() {
  const el = $('itemDetail');
  if (el) el.classList.remove('show');
}

/** HUD 上的委托进度小条（随时能看到"还差几件"） */
let _questHudSig = '';
function updateQuestHUD() {
  const el = $('hudQuest');
  if (!el) return;
  if (typeof QuestSystem === 'undefined' || typeof G === 'undefined' || !G || !G.quest) {
    if (el.style.display !== 'none') { el.style.display = 'none'; _questHudSig = ''; }
    return;
  }
  const act = QuestSystem.getActive();
  if (!act) {
    if (el.style.display !== 'none') { el.style.display = 'none'; _questHudSig = ''; }
    return;
  }
  const it = QUEST_ITEMS[act.def.item];
  const sig = act.def.id + '|' + act.prog.items + '|' + act.def.need;
  if (sig === _questHudSig) return;
  _questHudSig = sig;
  const done = act.prog.items >= act.def.need;
  el.style.display = '';
  el.innerHTML = '<span class="chi">📜</span><b>' + it.name + '</b>' +
    '<span class="chp ' + (done ? 'ok' : 'no') + '">' + act.prog.items + '/' + act.def.need + '</span>';
  const en = (typeof ENEMY_DEFS !== 'undefined' && ENEMY_DEFS[act.def.enemy]) ? ENEMY_DEFS[act.def.enemy].name : act.def.enemy;
  el.title = '【' + act.def.act + '】' + act.def.title + '\n目标：击杀 ' + en + ' 收集 ' + it.name +
    '（已击杀 ' + act.prog.kills + ' 只）\n点击查看全部委托（L）';
}

/* ==================================================================
 *  BOSS 血条横幅：把「正在打谁、打到哪一阶段」搬到屏幕顶部，
 *  小怪血条再密也不会和 BOSS 信息抢视线。
 * ================================================================== */
let _bossBarSig = '';
function updateBossBar() {
  const el = $('bossBar');
  if (!el || typeof G === 'undefined' || !G) return;
  let boss = null;
  for (const e of G.enemies) { if (e.boss && !e.dead) { boss = e; break; } }
  if (!boss) {
    if (_bossBarSig !== '') { _bossBarSig = ''; el.classList.remove('show'); el.style.display = 'none'; }
    return;
  }
  const hp = clamp(boss.hp / boss.maxHp, 0, 1);
  const bdef = (typeof BOSS_DEFS !== 'undefined' && BOSS_DEFS[boss.bossKey]) ? BOSS_DEFS[boss.bossKey] : null;
  const phN = bdef ? ((bdef.phases[boss.phase] || {}).name || '') : '';
  const sig = boss.maxHp + '|' + Math.round(hp * 1000) + '|' + boss.phase;
  if (sig === _bossBarSig) return;
  _bossBarSig = sig;
  el.style.display = 'block';
  requestAnimationFrame(() => el.classList.add('show'));
  $('bbName').textContent = '😈 ' + (bdef ? bdef.name : boss.def.name);
  $('bbPhase').textContent = phN;
  $('bbPhase').style.display = phN ? '' : 'none';
  $('bbHp').textContent = Math.ceil(boss.hp) + ' / ' + Math.ceil(boss.maxHp) + '　(' + Math.round(hp * 100) + '%)';
  $('bbFill').style.width = (hp * 100).toFixed(1) + '%';
  const sh = (boss.shieldMax > 0) ? Math.max(0, boss.shield / boss.shieldMax) * 100 : 0;
  $('bbShield').style.width = sh.toFixed(1) + '%';
}

/* ==================================================================
 *  存档管理面板
 *  槽位：0 = 自动存档，1~3 = 手动槽。数据层全在 save.js 的 SaveSystem。
 * ================================================================== */
let _svConfirmSlot = -1;
let _svToastTimer = null;

function svToast(msg, tone) {
  const el = $('svToast');
  if (!el) return;
  el.textContent = msg;
  el.className = tone || '';
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(_svToastTimer);
  _svToastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function renderSavePanel() {
  const el = $('saveSlots');
  if (!el || typeof SaveSystem === 'undefined') return;
  const slots = SaveSystem.list();
  const cur = (typeof G !== 'undefined' && G && !G.over) ? G : null;
  const DIFF_ICON = { normal: '🌙', hard: '🔥', hell: '💀', admin: '👑' };
  const MODE_ICON = { limited: '⏳', unlimited: '♾️' };

  el.innerHTML = slots.map(s => {
    const tag = s.auto ? '自动' : ('槽 ' + s.slot);
    const cls = 'svrow' + (s.auto ? ' auto' : '') + (s.info ? '' : ' empty');
    if (!s.info) {
      return '<div class="' + cls + '"><span class="svtag">' + tag + '</span>' +
        '<div class="svmain"><div class="svname">空槽位</div>' +
        '<div class="svmeta">把当前进度存到这里' + (cur ? '' : '（当前没有进行中的对局）') + '</div></div>' +
        '<div class="svacts"><div class="r1">' +
        '<button class="svbtn" data-save="' + s.slot + '"' + (cur ? '' : ' disabled') + '>存入</button>' +
        '</div></div></div>';
    }
    const m = s.info;
    const chips = [
      '<span class="svchip">' + (MODE_ICON[m.mode] || '⏳') + (m.mode === 'unlimited' ? ' 无限模式' : ' 有限模式') + '</span>',
      m.quest ? '<span class="svchip q">📜 委托 ' + m.quest + '/6</span>' : '',
      m.dream ? '<span class="svchip d">💎 梦境 ' + m.dream + ' 项</span>' : '',
      m.kills ? '<span class="svchip">⚔ ' + m.kills + ' 杀</span>' : '',
    ].filter(Boolean).join('');
    return '<div class="' + cls + '"><span class="svtag">' + tag + '</span>' +
      '<div class="svmain">' +
        '<div class="svname">第 ' + m.wave + ' 波 · ' + (DIFF_ICON[m.diff] || '') + ' ' + ((DIFFS[m.diff] || {}).name || m.diff) +
          (m.name ? '　<span style="font-size:10.5px;color:#8b85a8;font-weight:400">' + m.name + '</span>' : '') + '</div>' +
        '<div class="svmeta">💰 <b>' + fmt(m.gold) + '</b>　🏗 ' + m.buildings + ' 座　🕒 ' + SaveSystem.fmtTime(m.at) + '</div>' +
        '<div class="svchips">' + chips + '</div>' +
      '</div>' +
      '<div class="svacts">' +
        '<div class="r1">' +
          '<button class="svbtn" data-load="' + s.slot + '">载入</button>' +
          (s.auto ? '' : '<button class="svbtn blue" data-save="' + s.slot + '"' + (cur ? '' : ' disabled') + '>覆盖</button>') +
        '</div>' +
        '<div class="r1">' +
          '<button class="svbtn blue" data-export="' + s.slot + '">导出</button>' +
          '<button class="svbtn red" data-del="' + s.slot + '">删除</button>' +
        '</div>' +
      '</div></div>';
  }).join('');

  el.querySelectorAll('[data-save]').forEach(b => b.onclick = () => {
    const slot = +b.dataset.save;
    if (!G || G.over) { svToast('当前没有可保存的对局', 'warn'); return; }
    const r = SaveSystem.write(slot, SaveSystem.capture(), slot === 0 ? '自动存档' : '手动存档');
    if (r.ok) { renderSavePanel(); svToast('✅ 已保存到' + (slot === 0 ? '自动存档' : '槽 ' + slot)); SFX.coin(); }
    else svToast(r.reason === 'quota' ? '❌ 浏览器存储空间已满' : '❌ 保存失败', 'err');
  });
  el.querySelectorAll('[data-load]').forEach(b => b.onclick = () => loadSaveSlot(+b.dataset.load));
  el.querySelectorAll('[data-export]').forEach(b => b.onclick = () => {
    if (SaveSystem.exportFile(+b.dataset.export)) svToast('📥 已导出存档文件');
    else svToast('❌ 导出失败', 'err');
  });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    const slot = +b.dataset.del;
    if (_svConfirmSlot !== -1000 - slot) {
      _svConfirmSlot = -1000 - slot;
      svToast('⚠️ 再点一次「删除」确认', 'warn');
      setTimeout(() => { if (_svConfirmSlot === -1000 - slot) _svConfirmSlot = -1; }, 4000);
      return;
    }
    _svConfirmSlot = -1;
    SaveSystem.remove(slot);
    renderSavePanel();
    svToast('🗑 已删除' + (slot === 0 ? '自动存档' : '槽 ' + slot));
  });
}

/** 载入：进行中的对局会被替换，所以要二次确认 */
function loadSaveSlot(slot) {
  const d = SaveSystem.read(slot);
  if (!d) { svToast('这个槽位是空的', 'warn'); return; }
  if (typeof G !== 'undefined' && G && !G.over && G.wave > 0 && _svConfirmSlot !== slot) {
    _svConfirmSlot = slot;
    svToast('⚠️ 当前进度将被替换，再点一次「载入」确认', 'warn');
    setTimeout(() => { if (_svConfirmSlot === slot) _svConfirmSlot = -1; }, 4000);
    return;
  }
  _svConfirmSlot = -1;
  doLoadSlot(slot, d);
}

function doLoadSlot(slot, d) {
  try {
    newGame(d);                       // newGame 内部会 applySave → SaveSystem.restore
    if (typeof Music !== 'undefined') { Music.unlock(); Music.play('game'); }
    // 从主菜单载入时要把菜单收起来
    const ov = $('overlay');
    if (ov) ov.style.display = 'none';
    paused = false;
    if ($('btnPause')) $('btnPause').textContent = '⏸';
    if ($('adminBar')) $('adminBar').style.display = G.admin ? 'flex' : 'none';
    if (typeof closeSavePanel === 'function') closeSavePanel();
    if (typeof updateHUD === 'function') { hudT = 0; updateHUD(0.1); }
    setTip('已载入存档：第 ' + G.wave + ' 波 · ' + ((DIFFS[G.diffKey] || {}).name || G.diffKey), 6);
    if (typeof SFX !== 'undefined' && SFX.up) SFX.up();
  } catch (e) {
    console.error('[Save] 载入失败:', e);
    svToast('❌ 载入失败：' + e.message, 'err');
  }
}

function showSavePanel() {
  const el = $('savePanel');
  if (!el) return;
  renderSavePanel();
  el.style.display = '';
  el.classList.add('open');
}

function closeSavePanel() {
  const el = $('savePanel');
  if (!el) return;
  el.style.display = 'none';
  el.classList.remove('open');
}

function toggleSavePanel() {
  const el = $('savePanel');
  if (!el) return;
  if (el.classList.contains('open')) closeSavePanel(); else showSavePanel();
}
