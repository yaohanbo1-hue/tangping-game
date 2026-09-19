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
    c.innerHTML = '<div class="ico">' + d.icon + '</div><div class="nm">' + d.name + '</div>' + dt +
      '<div class="pr"><span class="g">' + fmt(d.cost.gold) + '💰</span></div>' +
      '<div class="kb">' + d.key + '</div>';
    c.title = d.name + '：' + d.desc + '（建造不消耗电力）';
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
    b.onclick = () => useSkill(k);
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
    const nh = b.def.hp * (1 + (b.level - 1) * 0.35) * techVal('structure', 0.12) * techVal('vitality', 0.10) * techVal('fortress', 0.50) * ((G.prize && G.prize.hp) || 1) * (b.branch ? 1.3 : 1);
    b.hp += nh - b.maxHp; b.maxHp = nh;
  });
  G.doors.forEach(d2 => {
    const nh = (420 + 200 * (d2.lv - 1)) * techVal('ironwall', 0.15) * techVal('fortress', 0.50) * ((G.prize && G.prize.hp) || 1);
    d2.hp += nh - d2.maxHp; d2.maxHp = nh;
  });
  setTip(d.name + ' 提升至 Lv.' + G.tech[k], 3);
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
    ? '电量由发电机产出（唯一来源），只用于 Lv8 以上升级'
    : '当前没有发电机，电量不会增长 —— 建一台发电机才能产出电力';
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
  $('btnSkip').style.display = G.state === 'build' ? '' : 'none';
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
    '|' + (canAfford(upgradeCost(s.def, s.level)) ? 1 : 0);
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
      (d.lv < 50 ? '<div class="dup">下一级 → ' + NAME_POOL.door[d.lv] + '　生命 ' + Math.ceil((420 + 200 * d.lv) * techVal('ironwall', 0.15)) + '</div>' : '') +
      '<div class="dnote">门被攻破后，该路敌人会冲进房间拆建筑。</div>';
    act = d.lv >= 50 ? '<span class="max">已至巅峰</span>'
      : '<button id="dUp">加固 ' + fmt(c) + '💰</button><button id="dMax" class="maxup">⏫升满</button>';
  } else if (s.def) {
    const st = bstat(s);
    const dtn = s.def.dmgType ? '<span class="dtn" style="color:' + DMG[s.def.dmgType].color + '">' + DMG[s.def.dmgType].icon + DMG[s.def.dmgType].name + '</span>' : '';
    html = '<div class="dhead"><span class="dico">' + (s.branch ? s.def.branch[s.branch].icon : s.def.icon) + '</span><b>' +
      buildName(s) + '</b><span class="dlv">Lv.' + s.level + '/50</span>' + dtn + '</div>' +
      (s.def.noPowerUp ? '<div class="dnote">⚡ <b>电力的唯一来源</b>，升级永不耗电，发电速率每级 <b>x2</b></div>'
        : (s.level < FREE_POWER_LV ? '<div class="dnote">⚡ Lv' + (FREE_POWER_LV + 1) + ' 之前升级<b>不消耗电量</b></div>' : '')) +
      '<div class="dst">' + s.def.statText(st) + '</div>' +
      '<div class="dst">生命 ' + Math.ceil(s.hp) + '/' + Math.ceil(s.maxHp) + (s.shieldMax ? '　护盾 ' + Math.ceil(s.shield) + '/' + Math.ceil(s.shieldMax) : '') +
      '　耗电 ' + (s.def.upkeep * (1 + (s.level - 1) * 0.15)).toFixed(1) + '/s</div>';
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
    act = (s.level >= 50 ? '<span class="max">已至巅峰</span>'
      : '<button id="dUp">升级 ' + fmt(c.gold) + '💰' + (c.power ? ' ' + fmt(c.power) + '⚡' : '') + '</button><button id="dMax" class="maxup">⏫升满</button>') +
      '<button id="dSell" class="sell">出售 +' + fmt(s.invested * SELL_RATE) + '</button>';
    if (!s.branch && s.def.branch && s.level >= BRANCH_AT) {
      const A = s.def.branch.a, B = s.def.branch.b;
      html += '<div class="brwrap"><div class="brt">可转职（二选一，转职后满血且属性提升）</div>' +
        '<div class="bropt" id="brA"><b>' + A.icon + ' ' + A.name + '</b><span>' + A.desc + '</span><em>' + A.cost.gold + '💰 ' + A.cost.soul + '🔮</em></div>' +
        '<div class="bropt" id="brB"><b>' + B.icon + ' ' + B.name + '</b><span>' + B.desc + '</span><em>' + B.cost.gold + '💰 ' + B.cost.soul + '🔮</em></div></div>';
    }
  }
  el.innerHTML = html + '<div class="dact">' + act + '</div>';
  const u = $('dUp'); if (u) u.onclick = () => {
    if (selected && selected.isBed) upgradeBed();
    else if (selected && selected.isDoor) upgradeDoor(selected.door);
    else tryUpgrade(selected);
    detailSig = '';
  };
  const sl = $('dSell'); if (sl) sl.onclick = () => { sellBuilding(selected); detailSig = ''; };
  const dm = $('dMax'); if (dm) dm.onclick = () => { upgradeMaxSelected(selected); detailSig = ''; };
  const ba = $('brA'); if (ba) ba.onclick = () => { tryBranch(selected, 'a'); detailSig = ''; };
  const bb = $('brB'); if (bb) bb.onclick = () => { tryBranch(selected, 'b'); detailSig = ''; };
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
  el.querySelectorAll('[data-sal]').forEach(b => b.onclick = () => { salvageRune(b.dataset.sal); updateRunePanel(); updateDetail(true); });
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
      slotEl.querySelectorAll('[data-su]').forEach(x => x.onclick = () => { upgradeRuneIn(b, +x.dataset.su); updateRunePanel(); updateDetail(true); });
      slotEl.querySelectorAll('[data-sus]').forEach(x => x.onclick = () => { unsocketRune(b, +x.dataset.sus); updateRunePanel(); updateDetail(true); });
      const auto = $('autoSocket');
      if (auto) auto.onclick = () => {
        let n = 0;
        const bag = G.runeBag.slice().sort((p, q2) => (q2.affixes.length + q2.lv) - (p.affixes.length + p.lv));
        for (const r of bag) { if (socketRune(b, r.id, null)) n++; }
        updateRunePanel(); updateDetail(true);
        if (n) setTip('自动镶嵌 ' + n + ' 枚符文', 3);
      };
    }
  }
}
function togglePanel(id) {
  ['techPanel', 'achPanel', 'helpPanel'].forEach(p => { if (p !== id) $(p).classList.remove('open'); });
  $(id).classList.toggle('open');
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
  const res = drawLottery(n, cur);
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
}
function showMenu() {
  ensureMenuDOM();
  $('startPanel').style.display = '';
  $('gachaPanel').style.display = 'none';
  $('bagPanel').style.display = 'none';
  $('overlay').style.display = 'flex';
  if ($('adminBar')) $('adminBar').style.display = 'none';
  paused = true;
  updateMenu();
}
function updateMenu() {
  const mg = $('metaGold'); if (mg) mg.textContent = META.gold;
  const bw = $('bestWave'); if (bw) bw.textContent = Math.max(META.best || 0, +Store.get('tangping_best', 0) || 0);
  const dc = $('diffCards');
  if (dc) {
    dc.innerHTML = DIFF_KEYS.map(k => {
      const d = DIFFS[k], ok = META.gold >= d.cost;
      return '<div class="diff' + (d.admin ? ' adm' : '') + (menuDiff === k ? ' on' : '') + '" data-d="' + k + '" title="' + d.desc + '">' +
        '<div class="di">' + d.icon + '</div><div class="dn">' + d.name + '</div>' +
        '<div class="dd">' + d.desc + '</div>' +
        (d.cost ? '<div class="dc"' + (ok ? '' : ' style="color:#f87171"') + '>💰 ' + d.cost + '</div>' : '<div class="dc">免费</div>') +
        '<div class="dr">' + (d.admin ? '资源无限' : '结算 x' + d.reward) +
        (d.goldMul !== 1 ? ' · 金币 x' + d.goldMul : '') + '</div></div>';
    }).join('');
    dc.querySelectorAll('.diff').forEach(el => el.onclick = () => { menuDiff = el.dataset.d; updateMenu(); });
  }
  const mc = $('modeCards');
  if (mc) {
    mc.innerHTML = MODE_KEYS.map(k => {
      const m = MODES[k];
      return '<div class="mode' + (menuMode === k ? ' on' : '') + '" data-m="' + k + '">' +
        '<span class="mi">' + m.icon + '</span><div><div class="mn">' + m.name + '</div>' +
        '<div class="md">' + m.desc + '　·　' + m.tip + '</div></div></div>';
    }).join('');
    mc.querySelectorAll('.mode').forEach(el => el.onclick = () => { menuMode = el.dataset.m; updateMenu(); });
  }
  const er = $('equipRow');
  if (er) {
    const eq = (META.equipped || []).filter(k => META_PRIZES[k]);
    er.innerHTML = eq.length ? eq.map(k => '<span class="eq">' + META_PRIZES[k].icon + ' ' + META_PRIZES[k].name + '</span>').join('')
      : '<span class="eq none">未装备开局道具 — 去「🎒 仓库」装备（最多 3 件）</span>';
  }
}
function wireMenu() {
  if (!$('btnStart')) return;
  $('btnStart').onclick = () => startRun();
  $('btnContinue').onclick = () => {
    if (!LAST_SAVE) return;
    SFX.init(); $('overlay').style.display = 'none';
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
  const setW = v => { const el = $('adWave'); if (el) el.value = Math.max(1, Math.min(999, v | 0)); };
  if ($('adM5')) $('adM5').onclick = () => setW((+$('adWave').value || 1) - 5);
  if ($('adP5')) $('adP5').onclick = () => setW((+$('adWave').value || 1) + 5);
  if ($('adGo')) $('adGo').onclick = () => jumpToWave(+$('adWave').value || 1);
  if ($('adExit')) $('adExit').onclick = () => {
    if ($('adminBar')) $('adminBar').style.display = 'none';
    if (G && !G.over) { G.over = true; grantMetaReward(false); }
    showMenu();
  };
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
  $('overlay').style.display = 'none';
  Store.del('tangping_save');
  newGame();
  G.diffKey = menuDiff; G.admin = !!d.admin;
  G.mode = menuMode; G.rebuilds = 0;
  applyEquippedPrizes();
  G.prepTimer = G.prepTimer * d.prepMul * ((G.prize && G.prize.prep) || 1);
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

  // 剧情对话（由 DreamEngine 波次钩子触发）
  EventBus.on('story:dialog', (data) => {
    if (data && data.text) showStoryDialog(data);
  });

  // 记忆碎片掉落动画
  EventBus.on('fragment:collect', (data) => showFragmentPopup(data));

  // NPC招募通知
  EventBus.on('npc:recruit', (data) => {
    if (typeof addText === 'function') addText(640, 300, '👥 ' + (data.name || data.def?.name || '梦境居民') + ' 加入！', '#4ade80', true);
  });

  // 理解路线对话
  EventBus.on('mercy:start', (data) => showMercyDialog(data));

  console.log('[DreamUI] 事件监听已初始化');
}

// === 剧情对话框（沉浸版）===
let storyQueue = [];
let storyTyping = false;
let _storyTimer = null;

// 角色配置：颜色 + 头像 + 氛围光
const STORY_SPEAKERS = {
  '旁白':    { color:'#94a3b8', icon:'📖', glow:'rgba(148,163,184,.12)' },
  '???':     { color:'#c77dff', icon:'👁️', glow:'rgba(199,125,255,.15)' },
  '梦魇':    { color:'#ef4444', icon:'💀', glow:'rgba(239,68,68,.12)' },
  '林小夏':  { color:'#fbbf24', icon:'🌻', glow:'rgba(251,191,36,.10)' },
  '周默':    { color:'#60a5fa', icon:'📚', glow:'rgba(96,165,250,.10)' },
  '赵磊':    { color:'#34d399', icon:'😂', glow:'rgba(52,211,153,.10)' },
  '你':      { color:'#e2e8f0', icon:'🛏️', glow:'rgba(226,231,240,.08)' },
};

function showStoryDialog(data) {
  const panel = $('storyDialog');
  if (!panel) return;
  storyQueue.push(data);
  if (!storyTyping) _processStoryQueue();
}

function _processStoryQueue() {
  if (!storyQueue.length) { hideStoryDialog(); return; }
  const data = storyQueue.shift();
  const panel = $('storyDialog');
  panel.style.display = '';
  // 暗角效果
  const vig = $('storyVignette');
  if (vig) { vig.style.display = ''; requestAnimationFrame(() => vig.style.opacity = '1'); }
  // 角色氛围
  const sp = STORY_SPEAKERS[data.speaker] || STORY_SPEAKERS['???'];
  const spEl = $('storySpeaker');
  spEl.innerHTML = '<span style="margin-right:6px;font-size:22px;vertical-align:middle">' + sp.icon + '</span>' + (data.speaker || '???');
  spEl.style.color = sp.color;
  panel.style.borderColor = sp.color.replace(')', ',.35)').replace('rgb', 'rgba');
  // 氛围光
  const deco = panel.querySelector('.story-deco');
  if (deco) deco.style.background = 'linear-gradient(90deg,' + sp.glow + ',transparent)';
  $('storyText').textContent = '';
  $('storyChoices').innerHTML = '';
  $('storyNext').style.display = data.choices && data.choices.length ? 'none' : '';
  storyTyping = true;

  // 打字机效果（加速到 22ms）
  const text = data.text || '';
  let i = 0;
  _storyTimer = setInterval(() => {
    if (i < text.length) {
      $('storyText').textContent += text[i++];
    } else {
      clearInterval(_storyTimer); _storyTimer = null;
      storyTyping = false;
      if (data.choices && data.choices.length) {
        $('storyChoices').innerHTML = data.choices.map((c, idx) =>
          '<button class="story-choice" data-idx="' + idx + '">' + c.text + '</button>'
        ).join('');
        $('storyChoices').querySelectorAll('.story-choice').forEach(btn => {
          btn.onclick = () => {
            const choice = data.choices[+btn.dataset.idx];
            if (choice && choice.effect) setTip(choice.effect, 4);
            _processStoryQueue();
          };
        });
      } else {
        $('storyNext').style.display = '';
      }
    }
  }, 35);

  $('storyNext').onclick = () => {
    if (storyTyping) {
      clearInterval(_storyTimer); _storyTimer = null;
      $('storyText').textContent = text; storyTyping = false;
      if (data.choices && data.choices.length) {
        $('storyChoices').innerHTML = data.choices.map((c, idx) =>
          '<button class="story-choice" data-idx="' + idx + '">' + c.text + '</button>'
        ).join('');
        $('storyNext').style.display = 'none';
      }
    } else {
      _processStoryQueue();
    }
  };
}

function hideStoryDialog() {
  if (_storyTimer) { clearInterval(_storyTimer); _storyTimer = null; }
  const panel = $('storyDialog');
  if (panel) {
    panel.style.display = 'none';
    panel.style.borderColor = '';
    panel.style.boxShadow = '';
    const d = panel.querySelector('.story-deco');
    if (d) d.style.background = '';
  }
  // 隐藏暗角
  const vig = $('storyVignette');
  if (vig) { vig.style.opacity = '0'; setTimeout(() => vig.style.display = 'none', 400); }
  storyQueue = [];
  storyTyping = false;
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
      const entries = DreamDiary._entries || [];
      list.innerHTML = entries.length ? entries.map(e =>
        '<div class="diary-entry"><span class="diary-date">' + (e.wave ? '第' + e.wave + '波' : '') + '</span>' +
        '<span class="diary-text">' + e.content + '</span></div>'
      ).join('') : '<div class="diary-entry locked">还没有任何记录…去冒险吧。</div>';
    }
  }
  panel.style.display = '';
  const startPanel = $('startPanel');
  if (startPanel) startPanel.style.display = 'none';
}

// === NPC面板 ===
function showNPCPanel() {
  const panel = $('npcPanel');
  if (!panel) return;
  if (typeof DreamEngine !== 'undefined') {
    const snap = DreamEngine.getSnapshot();
    const list = $('npcList');
    if (list) {
      const npcs = snap.npcs || [];
      // 也显示未招募的NPC
      const allNPCs = typeof NPCGuardians !== 'undefined' ? (NPCGuardians.NPC_DATA || []) : [];
      const abilityNames = { heal:'治疗', atkBoost:'攻击', slowEnemy:'减速', goldGen:'产金', shield:'护盾', reveal:'侦测' };
      list.innerHTML = allNPCs.map(npc => {
        const recruited = npcs.find(n => n.id === npc.id);
        return '<div class="npc-card' + (recruited ? ' stationed' : '') + '">' +
          '<div class="npc-avatar">' + (npc.icon || '👤') + '</div>' +
          '<div class="npc-name">' + npc.name + '</div>' +
          '<div class="npc-role">' + (abilityNames[npc.ability] || npc.ability || '') + '</div>' +
          '<div class="npc-ability">' + (npc.desc || '') + '</div>' +
          (recruited ? '<div class="npc-room">驻守中</div>' :
            '<button class="npc-recruit-btn" data-id="' + npc.id + '">招募</button>') +
          '</div>';
      }).join('');
      list.querySelectorAll('.npc-recruit-btn').forEach(btn => {
        btn.onclick = () => {
          if (typeof NPCGuardians !== 'undefined') {
            // 分配到第一个可用房间
            const rooms = ['lane_0', 'lane_1', 'lane_2'];
            const usedRooms = NPCGuardians.getRecruited().map(n => n.roomId);
            const freeRoom = rooms.find(r => !usedRooms.includes(r)) || 'lane_0';
            NPCGuardians.recruitNPC(btn.dataset.id, freeRoom);
            showNPCPanel(); // 刷新
          }
        };
      });
    }
  }
  panel.style.display = '';
  const startPanel = $('startPanel');
  if (startPanel) startPanel.style.display = 'none';
}

// === 碎片画廊 ===
function showFragmentGallery() {
  const panel = $('fragmentGallery');
  if (!panel) return;
  if (typeof DreamEngine !== 'undefined') {
    const snap = DreamEngine.getSnapshot();
    const list = $('fragmentList');
    if (list) {
      const status = snap.fragments || { stories: [], total: 0, collected: 0, percentage: 0 };
      const allFrags = status.stories || [];
      const unlockedCount = allFrags.filter(f => f.unlocked).length;
      const totalCount = allFrags.length || 1;
      // 更新标题显示进度
      const fragTitle = panel.querySelector('.dream-panel-sub');
      if (fragTitle) fragTitle.textContent = '散落在梦境中的记忆 — ' + unlockedCount + '/' + totalCount + ' 已收集';
      list.innerHTML = allFrags.map((f, idx) => {
        const unlocked = f.unlocked;
        // 根据 dropRate 推导稀有度
        const fragDefs = typeof DreamFragments !== 'undefined' ? DreamFragments.FRAGMENT_DEFS : [];
        const dr = (fragDefs[idx] && fragDefs[idx].dropRate) || 0.05;
        const rarity = dr >= 0.08 ? 'common' : dr >= 0.04 ? 'rare' : dr >= 0.02 ? 'epic' : 'legendary';
        const rarityNames = {common:'普通',rare:'稀有',epic:'史诗',legendary:'传说'};
        return '<div class="fragment-card ' + (unlocked ? rarity : 'locked') + '">' +
          '<div class="fico">' + (unlocked ? (f.icon || '💎') : '❓') + '</div>' +
          '<div class="fname">' + (unlocked ? (f.name || f.title) : '???') + '</div>' +
          '<div class="fdesc">' + (unlocked ? (f.story || f.desc || f.text) : '未解锁') + '</div>' +
          (unlocked ? '<span class="frag-rarity">' + (rarityNames[rarity] || rarity) + '</span>' : '') +
          '</div>';
      }).join('');
    }
  }
  panel.style.display = '';
  const startPanel = $('startPanel');
  if (startPanel) startPanel.style.display = 'none';
}

// === 第四面墙效果 ===
let fourthWallActive = false;

function showFakeCrash() {
  const overlay = $('fourthWallOverlay');
  if (!overlay) return;
  fourthWallActive = true;
  overlay.innerHTML = '<div class="bsod-icon">:(</div>' +
    '<div class="bsod-title">你的电脑遇到问题，需要重新启动</div>' +
    '<div class="bsod-code">' +
    'Runtime Error: dream_core.dll<br>' +
    'Memory access violation at 0x' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase() + '<br>' +
    '梦境稳定性: CRITICAL<br>' +
    '收集错误信息... ' + Math.floor(Math.random() * 100) + '% 完成</div>' +
    '<div class="bsod-hint">这只是梦境在跟你开玩笑。</div>';
  overlay.style.display = '';
  setTimeout(() => {
    overlay.style.display = 'none';
    fourthWallActive = false;
  }, 3000);
}

function applyUICorrupt(data) {
  if (!data || !data.type) return;
  fourthWallActive = true;
  const gameWrap = document.getElementById('wrap');
  if (data.type === 'invert') {
    if (gameWrap) gameWrap.style.filter = 'invert(1) hue-rotate(180deg)';
  } else if (data.type === 'glitch') {
    if (gameWrap) gameWrap.classList.add('fourth-wall-glitch');
  } else if (data.type === 'text_replace') {
    // 替换所有按钮文字
    document.querySelectorAll('button').forEach(btn => {
      if (!btn._originalText) btn._originalText = btn.textContent;
      btn.textContent = data.text || '梦魇在看着你';
    });
  }
  setTimeout(() => revertFourthWall(), 5000);
}

function showChatMessage(data) {
  const chat = $('fourthWallChat');
  if (!chat) return;
  chat.innerHTML = '<div class="fw-sender">💀 梦魇</div><div class="fw-msg">' + (data.text || data.msg || '...') + '</div>';
  chat.style.display = '';
  chat.style.opacity = '1';
  chat.style.transition = '';
  setTimeout(() => {
    chat.style.transition = 'opacity 1.2s ease-out';
    chat.style.opacity = '0';
    setTimeout(() => { chat.style.display = 'none'; chat.style.transition = ''; }, 1200);
  }, 4500);
}

function revertFourthWall() {
  fourthWallActive = false;
  const gameWrap = document.getElementById('wrap');
  if (gameWrap) { gameWrap.style.filter = ''; gameWrap.classList.remove('fourth-wall-glitch'); }
  document.querySelectorAll('button').forEach(btn => {
    if (btn._originalText) { btn.textContent = btn._originalText; delete btn._originalText; }
  });
}

// === 梦中梦过渡 ===
function showDeepDreamTransition(data) {
  const overlay = $('deepDreamTransition');
  if (!overlay) return;
  overlay.style.display = '';
  const text = overlay.querySelector('.deep-dream-text');
  const sub = overlay.querySelector('.deep-dream-sub');
  if (text && data && data.name) text.textContent = '正在坠入「' + data.name + '」...';
  if (sub && data && data.desc) sub.textContent = data.desc;
  setTimeout(() => { overlay.style.display = 'none'; }, 3500);
}

function hideDeepDreamTransition() {
  const overlay = $('deepDreamTransition');
  if (overlay) overlay.style.display = 'none';
}

// === 碎片弹出 ===
function showFragmentPopup(data) {
  if (!data) return;
  if (typeof addText === 'function' && data.x != null && data.y != null) {
    addText(data.x, data.y - 40, (data.icon || '💎') + ' ' + (data.name || '记忆碎片') + '！', '#fbbf24', true);
  }
}

// === 理解对话 ===
function showMercyDialog(data) {
  if (!data) return;
  const panel = $('storyDialog');
  if (panel) {
    panel.style.borderColor = 'rgba(74,222,128,.35)';
    panel.style.boxShadow = '0 8px 40px rgba(0,0,0,.6),0 0 60px rgba(74,222,128,.1)';
    const deco = panel.querySelector('.story-deco');
    if (deco) deco.style.background = 'linear-gradient(90deg,transparent 5%,rgba(74,222,128,.5) 30%,rgba(110,231,183,.4) 50%,rgba(74,222,128,.5) 70%,transparent 95%)';
    showStoryDialog({
      speaker: data.encounter ? (data.encounter.name || '梦境生物') : '???',
      text: data.encounter ? (data.encounter.dialogue || data.encounter.desc || '...') : '...',
      choices: [
        { text: '🙏 理解它', effect: data.encounter ? ('获得奖励：' + (data.encounter.reward || '记忆碎片')) : '获得奖励' },
        { text: '⚔️ 攻击', effect: '继续战斗' }
      ]
    });
  }
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
