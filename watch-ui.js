// Native, non-blocking entry to the night's decisions and small discoveries.
const WatchUI = (() => {
  let root, entry, open = false, tab = 'watch', previousFocus = null, pauseGame = null, previousPause = true;
  let observedGame = null, refresh = 0, lastWave = -1, interactionText = '', propKey = '';
  const byId = id => document.getElementById(id);
  const text = (el, value) => { const next = String(value == null ? '' : value); if (el.textContent !== next) el.textContent = next; };
  const visible = el => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  const node = (tag, cls, value) => { const el = document.createElement(tag); if (cls) el.className = cls; if (value != null) text(el, value); return el; };
  const messageText = value => typeof value === 'string' ? value : value?.text ? [value.speaker,value.text].filter(Boolean).join(' · ') : '';
  function game() { return typeof G !== 'undefined' ? G : null; }
  function watchView() { return typeof NightWatch !== 'undefined' ? NightWatch.view() : {}; }
  function secretView() { return typeof HiddenSecrets !== 'undefined' ? HiddenSecrets.view() : {}; }
  function blocked() {
    return ['overlay','tutorialOverlay','storyDialog','npcPanel','diaryPanel','fragmentGallery','fragmentDetail','itemDetail','actCard','deepDreamTransition'].some(id=>visible(byId(id))) ||
      !!document.querySelector('.slide.open, #questPanel.open, #runePanel.open, #savePanel.open') ||
      (typeof TouchControls !== 'undefined' && TouchControls.sheetOpen());
  }
  function setTab(value, focus = false) {
    tab = ['watch', 'room', 'finds'].includes(value) ? value : 'watch';
    for (const button of root.querySelectorAll('[data-watch-tab]')) {
      const selected = button.dataset.watchTab === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    }
    for (const panel of root.querySelectorAll('[data-watch-page]')) panel.hidden = panel.dataset.watchPage !== tab;
  }
  function init() {
    if (root?.isConnected) return;
    entry = node('button', 'watch-entry'); entry.type = 'button'; entry.id = 'watchEntry';
    entry.innerHTML = '<span class="watch-entry-icon" aria-hidden="true">▤</span><span>守夜手记</span><i aria-hidden="true"></i>';
    entry.hidden = true; entry.onclick = () => api.open(); document.body.appendChild(entry);
    root = node('div', 'watch-backdrop'); root.id = 'watchNotebook'; root.hidden = true;
    root.innerHTML = '<section class="watch-notebook" role="dialog" aria-modal="true" aria-labelledby="watchTitle">'+
      '<header class="watch-heading"><div><small>值夜记录 · 灯还亮着</small><h2 id="watchTitle">守夜手记</h2></div><button id="watchClose" type="button" aria-label="关闭守夜手记">关闭</button></header>'+
      '<p class="watch-intro">门外有脚步，身边也有人。下一步，由你来定。</p>'+
      '<nav class="watch-tabs" role="tablist" aria-label="手记栏目"><button type="button" role="tab" id="watchTabWatch" data-watch-tab="watch" aria-controls="watchPageWatch">这一夜</button><button type="button" role="tab" id="watchTabRoom" data-watch-tab="room" aria-controls="watchPageRoom">宿舍角落</button><button type="button" role="tab" id="watchTabFinds" data-watch-tab="finds" aria-controls="watchPageFinds">发现册 <span id="watchFoundCount"></span></button></nav>'+
      '<div class="watch-pages"><section id="watchPageWatch" role="tabpanel" aria-labelledby="watchTabWatch" data-watch-page="watch"><div class="watch-scene-line"><span class="watch-lamp" aria-hidden="true"></span><small id="watchWave"></small></div><h3 id="watchOfferTitle"></h3><p id="watchOfferDescription"></p><p id="watchOfferHint" class="watch-muted"></p><div id="watchChoices" class="watch-choices"></div><section id="watchActive" class="watch-active" hidden><b></b><p></p><progress max="1" value="0" aria-label="当前守夜约定进度"></progress><small></small></section><p id="watchResult" class="watch-result" hidden></p><blockquote id="watchRoommate" class="watch-roommate"></blockquote><details id="watchPast"><summary>之前的守夜记录</summary><ol id="watchHistory"></ol></details></section>'+
      '<section id="watchPageRoom" role="tabpanel" aria-labelledby="watchTabRoom" data-watch-page="room" hidden><h3>把目光从炮塔上移开一会儿</h3><p class="watch-muted">雨声、旧物，还有留给别人的一点位置。这里有些东西值得再看一眼。</p><div id="watchProps" class="watch-props"></div><p id="watchPropDescription" class="watch-prop-description"></p><p id="watchInteraction" class="watch-response" role="status" aria-live="polite">选择一处角落，听听它的回应。</p></section>'+
      '<section id="watchPageFinds" role="tabpanel" aria-labelledby="watchTabFinds" data-watch-page="finds" hidden><h3>夹在本子里的小事</h3><p class="watch-muted">未发现的页只留下线索。慢慢来，没有倒计时。</p><div id="watchFinds" class="watch-finds"></div></section></div>'+
      '<footer class="watch-footer"><span>翻开手记时战斗暂停，合上后保持原来的节奏。</span><button id="watchResume" type="button">合上手记</button></footer></section>';
    document.body.appendChild(root);
    byId('watchClose').onclick = byId('watchResume').onclick = () => api.close();
    root.addEventListener('click', event => { if (event.target === root) api.close(); });
    for (const button of root.querySelectorAll('[data-watch-tab]')) {
      button.onclick = () => setTab(button.dataset.watchTab);
      button.onkeydown = event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const all = [...root.querySelectorAll('[data-watch-tab]')], index = all.indexOf(button);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? all.length-1 : (index+(event.key === 'ArrowRight' ? 1 : -1)+all.length)%all.length;
        setTab(all[next].dataset.watchTab, true);
      };
    }
    document.addEventListener('keydown', event => {
      if (!open) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); api.close(); return; }
      if (event.key === 'Tab') {
        const items = [...root.querySelectorAll('button:not(:disabled),summary,[tabindex="0"]')].filter(el => el.tabIndex >= 0 && el.getClientRects().length);
        const first = items[0], last = items.at(-1), active = document.activeElement;
        if (event.shiftKey && (active === first || !root.contains(active))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (active === last || !root.contains(active))) { event.preventDefault(); first?.focus(); }
      }
      // Keep gameplay shortcuts out while retaining normal button/arrow defaults.
      if (!root.contains(event.target) || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) event.stopPropagation();
    }, true);
    setTab('watch');
  }
  function syncChoices(view) {
    const host = byId('watchChoices'), choices = view.available ? view.choices || [] : [];
    const keys = choices.map(c => String(c.id)).join('|');
    if (host.dataset.keys !== keys) {
      host.replaceChildren(); host.dataset.keys = keys;
      for (const choice of choices) {
        const card = node('div', 'watch-choice'), button = node('button', 'watch-choice-action');
        button.type = 'button'; button.dataset.choice = choice.id;
        button.append(node('b'), node('span'), node('small', 'watch-choice-cost'), node('small', 'watch-choice-reward'));
        card.append(button, node('p', 'watch-choice-reason')); host.appendChild(card);
        button.onclick = () => { if (typeof NightWatch !== 'undefined') {
          const accepted = NightWatch.choose(button.dataset.choice); render();
          if (accepted) {
            const active = byId('watchActive'), result = byId('watchResult'), destination = !active.hidden ? active : !result.hidden ? result : byId('watchOfferTitle');
            destination.tabIndex = -1; destination.focus({preventScroll:true});
          }
        } };
      }
    }
    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i], card = host.children[i], button = card.querySelector('button');
      text(button.querySelector('b'), choice.title); text(button.querySelector('span'), choice.description);
      text(button.querySelector('.watch-choice-cost'), choice.cost ? '付出 · '+choice.cost : '');
      text(button.querySelector('.watch-choice-reward'), choice.reward ? '约定 · '+choice.reward : '');
      button.disabled = !!choice.disabled; text(card.querySelector('p'), choice.reason || '');
    }
  }
  function renderWatch(view) {
    if (messageText(view.roomMessage)) text(byId('watchRoommate'), messageText(view.roomMessage));
    text(byId('watchWave'), '第 '+(view.wave || game()?.wave || 1)+' 波 · '+(game()?.state === 'build' ? '备战灯下' : '防线进行中'));
    text(byId('watchOfferTitle'), view.title || '这一夜才刚刚开始');
    text(byId('watchOfferDescription'), view.description || '先守住眼前的防线。等到备战时，再来看看有什么需要你决定。');
    text(byId('watchOfferHint'), view.hint || '抉择不会强制弹出，照常守夜也是一种选择。'); syncChoices(view);
    const active = byId('watchActive'); active.hidden = !view.active;
    if (view.active) {
      text(active.querySelector('b'), view.active.title); text(active.querySelector('p'), view.active.description);
      const current = Math.max(0,Number(view.active.progress)||0), target = Number(view.active.target)||0, progress = active.querySelector('progress');
      progress.hidden = target <= 0;
      if (target > 0) { progress.max = target; progress.value = Math.min(target,current); }
      text(active.querySelector('small'), target > 0 ? '当前约定 '+Math.min(target,current)+' / '+target+' · 本波结束后结算' : '已守夜 '+Math.floor(current)+' 秒 · 本波结束后结算');
    }
    const result = byId('watchResult'); result.hidden = !view.result;
    if (view.result) { text(result, [view.result.title, view.result.description].filter(Boolean).join(' · ')); result.dataset.success = String(!!view.result.success); }
    const history = (view.history || []).slice(-6).reverse(), list = byId('watchHistory');
    const signature = JSON.stringify(history);
    if (list.dataset.signature !== signature) { list.dataset.signature = signature; list.replaceChildren(...history.map(r => node('li','', '第'+r.wave+'波 · '+r.title+'：'+(r.description||'')))); }
    byId('watchPast').hidden = !history.length;
  }
  function renderSecrets(view) {
    text(byId('watchFoundCount'), (view.found||0)+'/'+(view.total||0));
    const props = view.props || [], host = byId('watchProps'), keys = props.map(p => p.key || p.id).join('|');
    const drawings = {
      window:'<path d="M7 6h38v39H7zM26 6v39M7 25h38M4 46h44M13 12l-2 6m10-4-2 6m15-8-2 6m9 11-2 6m-22-4-2 6"/>',
      lamp:'<path d="M24 5h4m-2 0v7M18 13h16l6 22H12zM19 13l-2 22m16-22 2 22M26 13v22M12 35h28M26 35v9m-9 3h18"/><path d="M22 24q4-9 8 0v6h-8z" fill="currentColor" opacity=".35"/>',
      clock:'<rect x="5" y="15" width="42" height="24" rx="3"/><path d="M11 39v4m30-4v4M9 10h7m20 0h7"/><text x="26" y="31" text-anchor="middle" stroke="none" fill="currentColor" font-size="10" font-family="monospace">03:07</text>',
      cat:'<path d="M11 45V16l9 9 6-5 6 5 9-9v29zM11 16l15 20 15-20M19 33h1m12 0h1M23 40l3 2 3-2M26 36v6M7 47h38"/>',
      door:'<path d="M8 46V6h35v40M14 46V12h23v34M5 47h41M30 28v5M18 39h10M18 42h7"/>'
    };
    if (host.dataset.keys !== keys) {
      host.dataset.keys = keys; host.replaceChildren();
      for (const prop of props) {
        const key = prop.key || prop.id, button = node('button', 'watch-prop'); button.type = 'button'; button.dataset.prop = key;
        const symbol = node('i', 'watch-prop-symbol'); symbol.setAttribute('aria-hidden','true');
        symbol.innerHTML = '<svg viewBox="0 0 52 52" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(drawings[key]||'<path d="M26 8l18 18-18 18L8 26z"/>')+'</svg>';
        button.append(symbol, node('b','',prop.name)); host.appendChild(button);
        button.onclick = () => {
          propKey = key;
          if (typeof HiddenSecrets !== 'undefined') { const result = HiddenSecrets.interact(key); interactionText = result?.message || '你仔细看了一会儿。'; }
          render();
          const response = byId('watchInteraction'), viewport = root.querySelector('.watch-pages');
          const r = response.getBoundingClientRect(), v = viewport.getBoundingClientRect();
          if (r.top < v.top || r.bottom > v.bottom) response.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
        };
      }
    }
    for (const button of host.children) button.setAttribute('aria-pressed', String(button.dataset.prop === propKey));
    const selected = props.find(p => (p.key || p.id) === propKey);
    text(byId('watchPropDescription'), selected ? [selected.description,selected.hint].filter(Boolean).join(' ') : '不必急着找到所有东西。熟悉一处角落，也算有了收获。');
    text(byId('watchInteraction'), interactionText || view.message || view.lastMessage || '选择一处角落，听听它的回应。');
    const finds = view.discoveries || view.entries || [], list = byId('watchFinds');
    const signature = JSON.stringify(finds);
    if (list.dataset.signature !== signature) {
      list.dataset.signature = signature; list.replaceChildren(...finds.map(item => {
        const found = !!(item.discovered || item.found), card = node('article', 'watch-find'); card.dataset.found = String(found);
        card.append(node('small','',found ? '已夹入手记' : '一页空白'), node('h4','', found ? item.name || item.title : '尚未记录'), node('p','',found ? item.text : item.hint)); return card;
      }));
    }
  }
  function render() { if (!root) return; renderWatch(watchView()); renderSecrets(secretView()); }
  function roommate() {
    const g = game(); if (!g || g.wave === lastWave) return; lastWave = g.wave;
    const authored = messageText(watchView().roomMessage); if (authored) { text(byId('watchRoommate'), authored); return; }
    const damaged = g.bed && g.bed.hp < g.bed.maxHp*.45, broken = (g.doors||[]).filter(d=>d.broken).length;
    const line = damaged ? '室友把床沿的东西收好：“先护住这里，我帮你看着门。”' : broken ? '有人搬来一把椅子：“这边门线松了。别硬撑，修好再说。”' :
      ['走廊又静了一点。室友压低声音：“下一波你来安排，我不乱跑。”','有人把窗边的水擦掉：“雨还没停。你刚才那套布置，挺稳的。”','你听见身后一声轻轻的“嗯”。不是每次回应都需要很多话。'][Math.abs(g.wave||0)%3];
    text(byId('watchRoommate'), line);
  }
  const api = {
    init,
    isOpen: () => open,
    open(section = 'watch') {
      init(); const g = game(); if (open) { setTab(section); return true; }
      if (!g || g.over || blocked()) return false;
      pauseGame = g; previousPause = typeof paused !== 'undefined' ? paused : true; previousFocus = document.activeElement;
      if (typeof paused !== 'undefined') paused = true;
      open = true; entry.hidden = true; root.hidden = false; document.body.classList.add('watch-open'); render(); roommate(); setTab(section);
      byId('watchClose').focus({preventScroll:true}); return true;
    },
    close() {
      if (!open) return;
      open = false; root.hidden = true; document.body.classList.remove('watch-open');
      const anotherModal = blocked();
      if (pauseGame === game() && !game()?.over && !anotherModal && typeof paused !== 'undefined') paused = previousPause;
      pauseGame = null;
      entry.hidden = !game() || game().over || game().wave < 2 || anotherModal;
      if (!anotherModal) {
        if (previousFocus?.isConnected && previousFocus.getClientRects().length) previousFocus.focus({preventScroll:true});
        else (document.body.classList.contains('phone-ui') ? byId('phoneMore') : entry)?.focus({preventScroll:true});
      }
      previousFocus = null;
    },
    update(dt = 0) {
      init(); const g = game();
      if (observedGame !== g) { api.close(); observedGame = g; interactionText = ''; propKey = ''; lastWave = -1; }
      refresh += Math.max(0,Number(dt)||0); if (refresh < .3) return; refresh = 0;
      const anotherModal = blocked(), available = !!g && !g.over && g.wave >= 2 && !anotherModal; entry.hidden = !available || open;
      if (open && (!g || g.over || anotherModal)) { api.close(); return; }
      const view = watchView(); entry.dataset.offer = String(!!view.available);
      entry.setAttribute('aria-label', view.available ? '守夜手记，有新的备战抉择' : '打开守夜手记');
      if (open) { renderWatch(view); renderSecrets(secretView()); roommate(); }
    }
  };
  return api;
})();
