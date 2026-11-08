// SPDX-License-Identifier: Apache-2.0
// Native-size phone controls. Simulation, saves and world coordinates stay shared.
const TouchControls = (() => {
  const panelIds=['techPanel','achPanel','helpPanel','lotPanel','runePanel','questPanel','savePanel'];
  const portalIds=['overlay',...panelIds,'detail','storyDialog','npcPanel','diaryPanel','fragmentGallery','fragmentDetail','tutorialOverlay','itemDetail'];
  const mounts=new Map();
  let initialized=false,active=false,enabled=true,playing=false,tab='',scheduled=false,fitPending=false;
  const node=id=>document.getElementById(id);
  const icon=key=>typeof UiArt!=='undefined'?UiArt.icon(key):'';
  function text(id,value){const el=node(id);if(el&&el.textContent!==String(value))el.textContent=String(value);}
  function gameVisible(){return !!G&&!G.over&&node('overlay').style.display==='none';}
  function eligible(){const v=viewportSize();return Mobile.isTouch&&Math.min(v.w,v.h)<=600&&!Mobile.rotated;}
  function requestFit(){if(fitPending)return;fitPending=true;requestAnimationFrame(()=>{fitPending=false;refitAll();});}
  function setEnabled(value){enabled=!!value;try{localStorage.setItem('tangping_phone_controls',enabled?'on':'off');}catch(e){}layout();requestFit();}
  function mount(on){
    for(const id of portalIds){const el=node(id);if(!el)continue;
      if(on){if(!mounts.has(id)){const anchor=document.createComment('phone portal: '+id);el.before(anchor);mounts.set(id,anchor);}el.classList.add('phone-portal');if(el.parentElement!==document.body)document.body.appendChild(el);}
      else {const anchor=mounts.get(id);if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(el,anchor.nextSibling);el.classList.remove('phone-portal');}
    }
  }
  function layout(){
    if(!initialized)return;
    const next=enabled&&eligible(),changed=next!==active;active=next;
    document.body.classList.toggle('phone-ui',active);
    document.body.classList.toggle('phone-available',!active&&eligible());
    const classicButton=node('btnPhoneControls');if(classicButton)classicButton.hidden=active||!eligible();
    if(changed){mount(active);closeSheet(false);detailSig='';}
    if(active)node('rotateHint')?.classList.remove('show');
    update();
  }
  function insets(){return active&&gameVisible()?{t:52,b:66}:{t:0,b:0};}
  function openPanel(id){closeSheet(false);togglePanel(id);update();requestAnimationFrame(()=>node(id)?.querySelector('button')?.focus({preventScroll:true}));}
  function closePanels(){_closeOtherPanels(null);selected=null;updateDetail(true);update();}
  function updateRoomMap(){
    if(!playing || !isPortrait())return;
    const map=node('phoneRoomMap'),building=selectedBuildKey&&BUILD_DEFS[selectedBuildKey];
    map.dataset.building=String(!!building);
    for(const cell of map.querySelectorAll('[data-room-cell]')){
      const c=Number(cell.dataset.col),r=Number(cell.dataset.row),occupant=G.grid[r*COLS+c],bed=inBed(c,r);
      const b=occupant&&occupant!=='bed'?occupant:null;
      const label=bed?'床铺 Lv.'+G.bed.lv:b?b.def.name+' Lv.'+b.level:building?'建造'+building.name:'空地';
      const critical=bed?G.bed.hp/G.bed.maxHp<.3:b&&b.hp/b.maxHp<.3;
      const signature=bed?'bed:'+G.bed.lv:b?b.type+':'+b.level+':'+(b.branch||''):'empty';
      if(cell.dataset.signature!==signature){
        cell.dataset.signature=signature;
        cell.innerHTML=bed?icon('bed')+'<small>Lv.'+G.bed.lv+'</small>':b?UiArt.building(b.type,b.branch)+'<small>Lv.'+b.level+'</small>':'<span class="room-cell-plus" aria-hidden="true">＋</span><small>'+(r+1)+'·'+(c+1)+'</small>';
      }
      cell.dataset.occupied=bed?'bed':b?'building':'empty';cell.dataset.critical=String(!!critical);
      cell.setAttribute('aria-label','第'+(r+1)+'行第'+(c+1)+'列，'+label+(critical?'，生命危急':''));
      cell.setAttribute('aria-pressed',String(b?selected===b:bed?!!selected?.isBed:false));
      cell.disabled=!bed&&!b&&!building;
    }
    text('phoneRoomHint',map.scrollWidth>map.clientWidth+1?'向左滑动查看右侧 · 点大格建造／升级':'左侧临门 · 右侧床铺 · 点大格建造／升级');
  }
  function closeSheet(restore=true){
    if(!initialized)return;const old=tab;tab='';node('phoneSheet').hidden=true;node('phoneSheetShade').hidden=true;
    document.querySelectorAll('#phoneDock [data-tab]').forEach(el=>el.setAttribute('aria-expanded','false'));
    hudT=0;
    if(restore&&old)node('phone'+old[0].toUpperCase()+old.slice(1))?.focus({preventScroll:true});
  }
  function openSheet(next){
    if(!active||!gameVisible())return;
    if(tab===next){closeSheet();return;}
    tab=next;_closeOtherPanels(null);updateDetail(true);
    const body=node('phoneSheetBody');
    if(next==='build'){
      text('phoneSheetTitle','选择防御建筑');
      body.innerHTML='<div class="phone-build-grid">'+BUILD_KEYS.map(k=>{const d=BUILD_DEFS[k];return '<button type="button" class="phone-build" data-build="'+k+'" aria-pressed="'+(selectedBuildKey===k)+'">'+UiArt.building(k)+'<b>'+d.name+'</b><span>'+fmt(d.cost.gold)+' 金币</span></button>';}).join('')+'</div>';
      body.querySelectorAll('[data-build]').forEach(el=>el.onclick=()=>{selectBuild(el.dataset.build);closeSheet();update();});
    }else if(next==='skills'){
      text('phoneSheetTitle','守夜技能');
      body.innerHTML='<div class="phone-skill-grid">'+Object.entries(SKILL_DEFS).map(([k,d])=>'<button type="button" class="phone-skill" data-skill="'+k+'">'+icon(k)+'<span><b>'+d.name+'</b><small>'+d.desc+'</small><em data-cooldown="'+k+'"></em></span></button>').join('')+'</div>';
      body.querySelectorAll('[data-skill]').forEach(el=>el.onclick=()=>{Cmd.skill(el.dataset.skill);update();});
    }else{
      text('phoneSheetTitle','防线与档案');
      const panels=[['techPanel','research','灵魂科技'],['runePanel','gem','符文背包'],['savePanel','save','存档管理'],['questPanel','archive','梦境委托'],['helpPanel','book','图鉴与设置'],['achPanel','trophy','成就'],['lotPanel','chest','梦境摇奖']];
      body.innerHTML='<div class="phone-management">'+panels.map(([id,key,label])=>'<button type="button" data-panel="'+id+'">'+icon(key)+label+'</button>').join('')+
        '<button type="button" data-native="bed">'+icon('bed')+'升级床铺</button>'+[0,1,2].map(i=>'<button type="button" data-door="'+i+'">'+icon('door')+'第'+(i+1)+'路铁门</button>').join('')+
        '<button type="button" data-native="skip">'+icon('arrow')+'提前召唤下一波</button>'+[['btnUpAll','arrow','全体升级'],['btnUpTower','target','炮塔升级'],['btnMaxAll','arrow','全体升满'],['btnStoryPlayback','book','剧情开关'],['btnSound','volume','音效开关']].map(([id,key,label])=>'<button type="button" data-forward="'+id+'">'+icon(key)+label+'</button>').join('')+
        '<button type="button" data-native="speed">'+icon('clock')+'速度 '+timeScale+'×</button><button type="button" data-native="full">'+icon('fullscreen')+'全屏 / 横屏</button><button type="button" data-native="rotate">'+icon('rotate')+'旋转画面</button><button type="button" data-native="classic">'+icon('phone')+'使用经典界面</button></div>';
      body.querySelectorAll('[data-panel]').forEach(el=>el.onclick=()=>openPanel(el.dataset.panel));
      body.querySelectorAll('[data-door]').forEach(el=>el.onclick=()=>{selectedBuildKey=null;selected={isDoor:true,door:G.doors[Number(el.dataset.door)]};closeSheet();updateDetail(true);update();});
      body.querySelector('[data-native="bed"]').onclick=()=>{selectedBuildKey=null;selected={isBed:true};closeSheet();updateDetail(true);update();};
      body.querySelector('[data-native="speed"]').onclick=()=>{node('btnSpeed').click();closeSheet();update();};
      body.querySelector('[data-native="skip"]').onclick=()=>{node('btnSkip').click();closeSheet();update();};
      body.querySelectorAll('[data-forward]').forEach(el=>el.onclick=()=>{node(el.dataset.forward).click();closeSheet();update();});
      body.querySelector('[data-native="full"]').onclick=()=>{closeSheet();Mobile.goFullscreenLandscape();};
      body.querySelector('[data-native="rotate"]').onclick=()=>{closeSheet();Mobile.useRotatedLayout();};
      body.querySelector('[data-native="classic"]').onclick=()=>setEnabled(false);
    }
    node('phoneSheet').hidden=false;
    node('phoneSheetShade').hidden=false;
    document.querySelectorAll('#phoneDock [data-tab]').forEach(el=>el.setAttribute('aria-expanded',String(el.dataset.tab===next)));
    update();node('phoneSheetClose').focus({preventScroll:true});
  }
  function update(){
    if(!initialized)return;
    const nextPlaying=active&&gameVisible();
    document.body.classList.toggle('phone-classic-playing',!active&&eligible()&&gameVisible());
    if(nextPlaying!==playing){playing=nextPlaying;document.body.classList.toggle('phone-playing',playing);if(!playing)closeSheet(false);fit();}
    if(!active)return;
    let modal=false;
    for(const id of panelIds){const el=node(id);if(el.classList.contains('open')&&(el.classList.contains('slide')||el.style.display!=='none')){modal=true;break;}}
    if(node('detail').style.display!=='none')modal=true;
    const story=node('storyDialog').style.display!=='none';
    const menu=!playing&&node('overlay').style.display!=='none'&&!!node('startPanel')&&node('startPanel').style.display!=='none'&&!modal&&!story;
    document.body.classList.toggle('phone-menu',menu);
    if(menu){text('phoneMenuSummary',node('setupSummary')?.textContent||'选择难度、规则与玩法，开始本次守夜');node('phoneMenuStart').disabled=!!node('btnStart')?.disabled;node('phoneMenuContinue').hidden=!node('btnContinue')||node('btnContinue').style.display==='none';}
    node('phoneShade').hidden=!playing||(!modal&&!story);
    document.body.classList.toggle('phone-story',story);
    node('phoneSheetShade').hidden=!playing||!tab;
    if(!G)return;
    text('phoneWave','第 '+G.wave+' 波');text('phoneGold',G.admin?'∞':fmt(G.gold));text('phonePower',G.admin?'∞':fmt(G.power));text('phoneSouls',G.admin?'∞':fmt(G.souls));
    const boss=G.enemies.find(e=>e.boss&&!e.dead),d=selectedBuildKey&&BUILD_DEFS[selectedBuildKey];
    const broken=G.doors.filter(door=>door.broken).length;
    const defense='床 '+Math.ceil(G.bed.hp)+' · 铁门 '+(3-broken)+'/3';
    const cue=boss && enemyCastCue(boss),threat=boss?(BOSS_DEFS[boss.bossKey]?.name||boss.def.name)+' · '+(bossPhases(boss)[boss.phase]?.name||'')+' · 生命 '+Math.max(0,Math.ceil(boss.hp/boss.maxHp*100))+'%':G.state==='build'?'备战 '+Math.ceil(G.prepTimer)+' 秒 · 下一波 '+(G.wave+1):'作战中 · 敌人 '+G.enemies.filter(e=>!e.dead).length;
    text('phoneThreat',cue?cue.label+' '+cue.left.toFixed(1)+'秒 · 冻结可打断 · '+defense:(d?'已选 '+d.name+' · 点空格放置 · ':'')+defense+' · '+threat);
    node('phoneThreat').dataset.danger=String(!!cue||broken>0||G.bed.hp/G.bed.maxHp<.3);
    text('phonePauseText',paused?'继续':'暂停');node('phonePause').setAttribute('aria-pressed',String(paused));
    text('phoneSelection',d?'已选 '+d.name:boss?threat:'守住三路铁门与床铺');text('phoneGuideText',d?'点下方大格或上方战场放置，可连续建造。':boss?BossEncounters.defs[boss.bossKey]?.hint||'观察攻击预警，保留控制与抢修。':'下方是房间布防板。先选建筑，再点空地；点已有建筑可升级。');
    updateRoomMap();
    const feedback=G.tipTimer>0?G.tipText:'';text('phoneFeedback',feedback);node('phoneFeedback').hidden=!feedback;
    node('phoneCancel').disabled=!selectedBuildKey&&!selected;
    const skip=node('phoneSheetBody').querySelector('[data-native="skip"]');if(skip)skip.disabled=G.state!=='build';
    if(tab==='build')document.querySelectorAll('#phoneSheet [data-build]').forEach(el=>{const k=el.dataset.build;el.disabled=!G.admin&&G.gold<BUILD_DEFS[k].cost.gold;el.setAttribute('aria-pressed',String(selectedBuildKey===k));});
    if(tab==='skills')document.querySelectorAll('#phoneSheet [data-skill]').forEach(el=>{const k=el.dataset.skill,remaining=G.skills[k]||0,sealed=!!(G.trialId&&POSTGAME_TRIALS.find(t=>t.id===G.trialId)?.noSkills);el.disabled=sealed||remaining>0||G.over;el.querySelector('em').textContent=sealed?'试炼已封印':remaining>0?'冷却 '+Math.ceil(remaining)+' 秒':'可使用';});
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;update();});}
  function init(){
    if(initialized)return;initialized=true;try{enabled=localStorage.getItem('tangping_phone_controls')!=='off';}catch(e){}
    const root=document.createElement('div');root.id='phoneControls';
    root.innerHTML='<button type="button" id="phoneEnable">'+icon('phone')+'手机界面</button><section id="phoneMenuActions"><small id="phoneMenuSummary"></small><div><button type="button" id="phoneMenuStart">进入梦境</button><button type="button" id="phoneMenuContinue" hidden>继续梦境</button></div></section><header id="phoneHud"><div><b id="phoneWave"></b><span>'+icon('coin')+'<b id="phoneGold"></b></span><span>'+icon('power')+'<b id="phonePower"></b></span><span>'+icon('soul')+'<b id="phoneSouls"></b></span></div><small id="phoneThreat"></small></header>'+
      '<aside id="phoneGuide"><b id="phoneSelection"></b><p id="phoneGuideText"></p><div class="phone-room-heading"><b>房间布防</b><span>8列 × 5行</span></div><div id="phoneRoomMap" role="group" aria-label="房间布防板">'+Array.from({length:ROWS*COLS},(_,i)=>'<button type="button" data-room-cell data-col="'+(i%COLS)+'" data-row="'+Math.floor(i/COLS)+'"></button>').join('')+'</div><small id="phoneRoomHint"></small></aside><p id="phoneFeedback" role="status" hidden></p><button type="button" id="phoneShade" aria-label="关闭当前面板" hidden></button><button type="button" id="phoneSheetShade" aria-label="收起手机操作面板" hidden></button>'+
      '<section id="phoneSheet" role="dialog" aria-modal="true" aria-labelledby="phoneSheetTitle" hidden><header><h2 id="phoneSheetTitle"></h2><button type="button" id="phoneSheetClose" aria-label="关闭手机操作面板">'+icon('close')+'</button></header><div id="phoneSheetBody"></div></section>'+
      '<nav id="phoneDock" aria-label="手机操作栏"><button type="button" id="phoneBuild" data-tab="build" aria-expanded="false">'+icon('build')+'<span>建造</span></button><button type="button" id="phoneSkills" data-tab="skills" aria-expanded="false">'+icon('storm')+'<span>技能</span></button><button type="button" id="phoneMore" data-tab="more" aria-expanded="false">'+icon('menu')+'<span>管理</span></button><button type="button" id="phoneCancel">'+icon('hand')+'<span>取消</span></button><button type="button" id="phonePause" aria-pressed="false">'+icon('pause')+'<span id="phonePauseText">暂停</span></button></nav>';
    document.body.appendChild(root);
    const classicButton=document.createElement('button');classicButton.id='btnPhoneControls';classicButton.type='button';classicButton.className='btn';classicButton.textContent='手机界面';classicButton.hidden=true;classicButton.onclick=()=>setEnabled(true);node('ctrls').appendChild(classicButton);
    node('phoneMenuStart').onclick=()=>node('btnStart')?.click();node('phoneMenuContinue').onclick=()=>node('btnContinue')?.click();
    node('phoneEnable').onclick=()=>setEnabled(true);node('phoneSheetClose').onclick=()=>closeSheet();node('phoneShade').onclick=closePanels;
    node('phoneSheetShade').onclick=()=>closeSheet();
    node('phoneRoomMap').addEventListener('click',event=>{
      const cell=event.target.closest('[data-room-cell]');
      if(!cell||cell.disabled||!playing||tab||node('storyDialog').style.display!=='none')return;
      const p=cellCenter(Number(cell.dataset.col),Number(cell.dataset.row));
      handleCanvasTap(p.x,p.y);updateDetail(true);update();
    });
    document.querySelectorAll('#phoneDock [data-tab]').forEach(el=>el.onclick=()=>openSheet(el.dataset.tab));
    node('phoneCancel').onclick=()=>{selectedBuildKey=null;selected=null;hoverCell=null;updateDetail(true);closeSheet(false);update();};
    node('phonePause').onclick=()=>{node('btnPause').click();update();};
    document.addEventListener('keydown',e=>{
      if(!active||!tab)return;
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeSheet();return;}
      if(e.key==='Tab'){
        const controls=[...node('phoneSheet').querySelectorAll('button:not(:disabled),select,input,a[href]')].filter(el=>el.getClientRects().length);
        const first=controls[0],last=controls.at(-1);
        if(first&&(!node('phoneSheet').contains(document.activeElement)||(!e.shiftKey&&document.activeElement===last)||(e.shiftKey&&document.activeElement===first))){e.preventDefault();(e.shiftKey?last:first).focus({preventScroll:true});}
        e.stopImmediatePropagation();
      }else if(/^[a-zA-Z0-9]$/.test(e.key)&&!e.ctrlKey&&!e.metaKey&&!e.altKey)e.stopImmediatePropagation();
    },true);
    const observer=new MutationObserver(schedule);
    for(const id of portalIds){const el=node(id);if(el)observer.observe(el,{attributes:true,attributeFilter:['style','class'],subtree:id==='overlay',childList:id==='overlay'});}
    layout();
  }
  return {init,layout,update,insets,setEnabled,openSheet,closeSheet,sheetOpen:()=>!!tab,active:()=>active,playing:()=>active&&gameVisible()};
})();
