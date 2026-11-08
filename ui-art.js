// Code-native brass/ink symbols and portraits. No fonts, network assets or RNG.
const UiArt = (() => {
  const thumbnails = new Map(), glyphs = new Map(), portraits = new Map();
  const paths = {
    lantern:'<path d="M10 6h12l3 22-9 4-9-4 3-22Z"/><path d="M12 6V3h8v3M11 3l1-2h8l1 2M8 12h16M8 27h16M12 13l-2 12m10-12 2 12M11 30h10"/><path d="M16 14c5 6 4 10 0 11-4-1-5-5 0-11Z" fill="currentColor" stroke="none"/><path d="M16 8v2M13 28h6" opacity=".55"/>',
    coin:'<ellipse cx="16" cy="16" rx="11" ry="12"/><ellipse cx="16" cy="16" rx="7" ry="9"/><path d="M16 9v14m-3-11h6m-6 8h6"/>',
    power:'<path d="m18 3-12 16h10l-2 12 13-18H17l1-10Z"/>',
    soul:'<path d="M16 3c-9 7-11 11-9 17 1 5 6 6 5 11l5-4 4 2c0-4 6-7 5-13-1-5-5-9-10-13Z"/><path d="m12 15 2 2m5-3 2 2"/>',
    door:'<path d="M8 30V3h17v27M5 30h23M11 7h11v19H11Z"/><circle cx="19" cy="17" r="1"/>',
    bed:'<path d="M5 10h22v19H5zM8 10V4h16v6M5 16h22M8 7h6m4 0h3M8 29v3m16-3v3"/><path d="m14 20 2-3 3 5h-6l1-2Z"/>',
    wave:'<path d="M4 10c5-7 8 7 13 0s8-2 11 0M4 17c5-7 8 7 13 0s8-2 11 0M4 24c5-7 8 7 13 0s8-2 11 0"/>',
    leaf:'<path d="M16 30V12M16 23C2 23 3 9 3 9c11 0 13 7 13 14Zm0-6C29 17 29 4 29 4 19 4 16 10 16 17Z"/>',
    enemy:'<path d="m9 5 7-3 8 5 4 22-8-4-4 6-5-6-7 4L9 5Z"/><path d="m10 13 4 2m4 0 4-2m-9 8h6"/>',
    research:'<path d="M12 4h8m-6 0v10L6 26c-1 2 1 4 3 4h14c3 0 4-2 3-4l-8-12V4M10 22h13"/><circle cx="16" cy="24" r="1"/>',
    trophy:'<path d="M9 4h14v9c0 10-14 10-14 0V4Zm0 3H4v7l7 4m12-11h5v7l-7 4M16 22v6m-6 2h12"/>',
    chest:'<path d="M4 12c1-12 23-12 24 0v17H4V12Zm0 3h24M10 5v10m12-10v10"/><path d="M13 13h6v8h-6z"/>',
    book:'<path d="M4 5c6-2 10 1 12 3 4-3 8-4 12-3v23c-5-1-9 0-12 2-3-2-7-3-12-2V5Zm12 3v22M8 11h4m8 0h4M8 16h4m8 0h4"/>',
    bag:'<path d="M8 9c0-10 16-10 16 0l3 21H5L8 9Zm3 0h10M8 19h16m-13-6h10v13H11z"/>',
    people:'<circle cx="11" cy="10" r="5"/><path d="M2 29v-6c0-9 18-9 18 0v6M22 5c8 0 8 11 0 11m2 4c5 1 6 5 6 9"/>',
    gem:'<path d="m8 5 16 0 6 9-14 17L2 14l6-9Zm-6 9h28M8 5l8 26L24 5M8 5l8 9 8-9"/>',
    archive:'<path d="M6 3h20v28H6zM3 8h7M3 15h7M3 23h7M14 9h8m-8 6h8m-8 6h5"/>',
    save:'<path d="M5 3h19l4 5v23H4V3h1Zm4 0v9h13V3M9 30V19h14v11M18 6v4"/>',
    shield:'<path d="m16 2 12 5-2 14-10 10L6 21 4 7l12-5Z"/><path d="m10 16 4 5 9-11"/>',
    cross:'<path d="M12 3h8v9h9v8h-9v9h-8v-9H3v-8h9V3Z"/>',
    fire:'<path d="M17 2c0 9-10 10-5 17-7-2-3-7-5-9C-4 25 12 35 22 28c11-8-3-20-5-26Z"/><path d="M16 18c-6 5-4 10 0 11 6-1 6-6 0-11Z"/>',
    frost:'<path d="M16 2v28M4 9l24 14M4 23 28 9M11 5l5 4 5-4M11 27l5-4 5 4M4 14l6-1-1-6M28 18l-6 1 1 6M3 19l7 1-1 6M29 13l-7-1 1-6"/>',
    meteor:'<path d="m5 13 10 5 4 10c-13 8-23-3-14-15ZM11 12 21 2M18 14 28 4M21 21l10-11M6 21h1"/>',
    pulse:'<path d="M2 17h6l4-12 6 23 5-17 3 6h4"/>',
    storm:'<circle cx="16" cy="16" r="5"/><path d="M16 2v5m0 18v5M2 16h5m18 0h5M6 6l4 4m12 12 4 4M6 26l4-4M22 10l4-4"/>',
    target:'<circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="4"/><path d="M16 1v7m0 17v7M1 16h7m17 0h7"/>',
    blade:'<path d="m21 2 9 0-1 9-15 15-8-8L21 2ZM6 18l-3 4 7 7 4-3M3 30l5-5M20 8l4 4"/>',
    clock:'<circle cx="16" cy="17" r="12"/><path d="M16 9v9l7 4M12 1h8M7 5 3 9m22-4 4 4"/>',
    key:'<circle cx="11" cy="11" r="7"/><path d="m16 16 13 13m-6-6 4-4m-8 0 4-4"/>',
    infinity:'<path d="M16 16C6-1-5 20 6 24c8 3 14-19 21-16 11 4 0 25-11 8Z"/>',
    arrow:'<path d="M3 16h25M18 6l10 10-10 10"/>',
    lock:'<path d="M7 13h18v18H7zM11 13V7c0-8 10-8 10 0v6M16 21v4"/>',
    volume:'<path d="M3 12h6l8-8v24l-8-8H3v-8Zm18-2c6 3 6 9 0 12m3-16c10 6 10 14 0 20"/>',
    phone:'<rect x="7" y="2" width="18" height="30" rx="3"/><path d="M12 6h8M8 25h16"/><circle cx="16" cy="29" r=".8" fill="currentColor" stroke="none"/>',
    rotate:'<path d="M7 6a13 13 0 0 1 22 8M7 6V1M7 6h6M25 28A13 13 0 0 1 3 20m22 8v5m0-5h-6"/><rect x="11" y="9" width="10" height="16" rx="1" transform="rotate(30 16 17)"/>',
    fullscreen:'<path d="M3 12V3h9M20 3h9v9M29 22v9h-9M12 31H3v-9M3 3l9 9m8 10 9 9M29 3l-9 9M12 22l-9 9"/>',
    menu:'<path d="M9 8h20M9 17h20M9 26h20"/><circle cx="3" cy="8" r="1" fill="currentColor"/><circle cx="3" cy="17" r="1" fill="currentColor"/><circle cx="3" cy="26" r="1" fill="currentColor"/>',
    build:'<path d="m3 24 5 6L26 7l-7-5-5 7m-4 6-4-4 7-8 5 4M8 30l-6 2 1-8M18 16l11 10-5 5-10-11"/>',
    hand:'<path d="M10 18V7c0-5 5-5 5 0v8-11c0-4 5-4 5 0v11-8c0-4 5-4 5 0v11-5c0-4 5-4 5 0v9c0 10-19 15-23 4l-5-9c-2-4 3-6 5-3l3 4Z"/>',
    close:'<path d="m7 7 18 20M25 7 7 27"/>',
    pause:'<path d="M7 5h6v24H7zM20 5h6v24h-6z"/>',
    play:'<path d="m9 4 20 13L9 30V4Z"/>',
    settings:'<g transform="translate(.5 1) scale(.94)"><path d="m12 2 8 0 1 5 4 3 5-1 2 7-4 3-1 5 2 4-6 4-4-3-5 0-4 3-6-4 2-4-1-5-4-3 2-7 5 1 4-3 1-5Z"/><circle cx="16" cy="17" r="6"/></g>',
  };
  const aliases={gold:'coin',souls:'soul',tech:'research',help:'book',rune:'gem',quest:'archive',skills:'storm',upgrade:'arrow',
    economy:'coin',firepower:'target',vitality:'cross',rapid:'pulse',electric:'power',structure:'shield',ironwall:'door',greed:'coin',mining:'coin',sleep:'bed',focus:'target',
    crit:'blade',harvest:'soul',overload:'power',swift:'clock',runemaster:'gem',fortify:'shield',plunder:'chest',berserk:'fire',thorns:'blade',compound:'coin',critmaster:'target',soulstorm:'storm',overcore:'pulse',annihilation:'meteor',runelord:'gem',fortress:'shield',eternity:'infinity',
    freeze:'frost',overclock:'pulse',mend:'cross',repel:'storm',siphon:'soul',heal:'cross',atkBoost:'blade',slowEnemy:'frost',goldGen:'coin',reveal:'target'};
  function icon(id,extra='') {
    const resolved=aliases[id]||id,key=paths[resolved]?resolved:'research',cacheKey=key+'|'+extra;
    if(!glyphs.has(cacheKey))glyphs.set(cacheKey,'<svg class="ui-glyph '+extra+'" data-symbol="'+key+'" viewBox="0 0 32 34" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">'+paths[key]+'</svg>');
    return glyphs.get(cacheKey);
  }
  function building(type,branch=null){
    const key='building:'+type+':'+(branch||'');if(thumbnails.has(key))return thumbnails.get(key);
    const def=BUILD_DEFS[type];if(!def||typeof BuildingArt==='undefined')return '';
    const image=document.createElement('canvas');image.width=112;image.height=96;const c=image.getContext('2d');c.translate(56,48);c.scale(.9,.9);
    const fake={type,def,level:branch?6:1,branch,x:0,y:0,hp:100,maxHp:100,angle:-Math.PI/2,col:0,row:0};
    const stats=branch?Object.assign({},def.stat(6),def.branch[branch].mod(def.stat(6),fake)):def.stat(1);
    BuildingArt.draw(c,fake,stats,0,0,{motion:false});
    const html='<img class="building-portrait" src="'+image.toDataURL()+'" alt="" draggable="false">';thumbnails.set(key,html);return html;
  }
  function enemy(id){
    const key='enemy:'+id;if(thumbnails.has(key))return thumbnails.get(key);
    const image=document.createElement('canvas');image.width=image.height=100;EnemyArt.preview(image.getContext('2d'),id,50,50,26);
    const html='<img class="enemy-portrait" src="'+image.toDataURL()+'" alt="" draggable="false">';thumbnails.set(key,html);return html;
  }
  function character(name){
    const cast={'林小夏':{hair:'#51423d',light:'#746052',coat:'#ac925f',shade:'#6a6250',style:1},'周默':{hair:'#25353d',light:'#42545b',coat:'#6a8b98',shade:'#385964',glasses:true,style:2},'赵磊':{hair:'#473831',light:'#6f5946',coat:'#729182',shade:'#3d5c53',style:3},'你':{hair:'#283239',light:'#4d5b62',coat:'#607c8e',shade:'#344d5f',style:0}};
    const p=cast[name],key=p?name:'unknown';if(portraits.has(key))return portraits.get(key);
    const frame='<path fill="#152630" d="M0 0h80v80H0z"/><path fill="#233d43" d="M5 5h70v70H5z"/><path fill="#314b4b" d="M7 7h24v49H7z"/><path fill="none" stroke="#617268" stroke-width=".7" d="M17 7v46M7 22h24M7 40h24M5 5h70v70H5z"/><path fill="#c2ad78" opacity=".45" d="M6 6h9v1H7v8H6zM65 6h9v9h-1V7h-8z"/>';
    let face;
    if(!p){face='<path fill="#111e28" d="M4 80 12 42 24 15 39 7 56 15 68 43 77 80Z"/><path fill="#3c4c59" d="M13 80 19 43 28 21 40 13 54 23 62 45 68 80Z"/><path fill="#0b1823" d="m22 44 6-19 12-9 14 10 6 20-20 20Z"/><path fill="#1c2b37" d="m25 28 15-12 15 11-15-6Z"/><path fill="#c5b88e" d="m26 36 9 4-2 3-7-3m19 0 9-4v4l-7 3"/><path fill="none" stroke="#768176" stroke-width="1" d="m19 66 11-10 10 11 12-11 10 11M40 67v13"/>';}
    else {
      const hairBack=p.style===1?'M18 34C14 3 64 2 64 34l4 28-18 6-34-6Z':p.style===3?'M20 32 21 19 29 11 45 9 59 18 62 33 58 47H23Z':'M19 32C16 3 65 3 63 33l-4 19-39-2Z';
      const fringe=p.style===1?'M20 32c-3-25 43-29 44-1L51 20 39 28 27 26 25 38Z':p.style===3?'M22 30 21 20 30 14 46 12 58 19 59 31 53 24 30 23Z':p.style===0?'M21 33C14 10 55 2 62 24l-5 11-6-12-13 8-12-3Z':'M21 32C17 7 60 4 63 27l-9 8-6-14-21 12Z';
      face='<path fill="'+p.shade+'" d="M4 80c1-16 12-21 29-23h15c19 3 27 9 29 23Z"/><path fill="'+p.coat+'" d="M8 80c1-15 12-19 26-21l7 9 7-9c16 4 23 9 24 21Z"/><path fill="'+p.hair+'" d="'+hairBack+'"/><path fill="#ac927c" d="M33 48h15v17l-7 6-8-7Z"/><path fill="#d7bea0" d="M24 30c0-19 34-20 34 0v11c-1 12-9 18-17 18-8 0-16-6-17-18Z"/><path fill="#bfa286" d="M50 23c9 4 8 23 1 29l-9 7c15-1 19-13 16-29Z"/><path fill="#e8d0ac" opacity=".5" d="M27 29c0-6 7-10 11-10l-5 8-6 14Z"/><path fill="'+p.hair+'" d="'+fringe+'"/><path fill="none" stroke="'+p.light+'" stroke-width="1.4" d="M26 22c5-7 14-9 21-8M52 18l5 7"/><path fill="none" stroke="#655044" stroke-width="1.5" stroke-linecap="round" d="M29 35h6m11 0h6"/><path fill="#2e3032" d="M30 37h3v3h-3zM47 37h3v3h-3z"/><path fill="none" stroke="#a08269" stroke-width="1" d="m40 38-2 7h4"/><path fill="none" stroke="#765a4c" stroke-width="1.2" stroke-linecap="round" d="M36 49c3 2 7 2 10-1"/>'+(p.glasses?'<path fill="none" stroke="#6f8889" stroke-width="1.4" d="M26 32h12v11H26Zm17 0h13v11H43Zm-5 4h5M23 34l3 1m30 0 3-1"/><path fill="#c7d6cb" opacity=".45" d="m28 33 2 0-2 6m17-6h2l-2 6"/>':'')+'<path fill="#d7ccb0" d="m24 63 9-6 8 10 7-10 10 6-12 10H35Z"/><path fill="'+p.shade+'" d="m24 63 10 10-7 5-9-9m40-6-11 10 6 5 10-9"/><path fill="#cfb77e" d="M13 70h6v7h-6z"/><path fill="#475c58" d="m14 75 2-4 2 4Z"/><path fill="none" stroke="#d0d2b8" opacity=".45" stroke-width=".8" d="M12 79v-8M66 79v-8"/><path fill="#293d46" d="M39 70h4v10h-4z"/><circle cx="41" cy="76" r=".9" fill="#cfb77e"/>';
    }
    const html='<svg class="character-art" viewBox="0 0 80 80" aria-hidden="true">'+frame+face+'</svg>';portraits.set(key,html);return html;
  }
  function companion(c,type,x,y,time,motion=true){
    const key='companion:'+type;let image=thumbnails.get(key);
    if(!image){image=document.createElement('canvas');image.width=image.height=48;const p=image.getContext('2d');p.translate(24,24);p.lineWidth=1.2;p.strokeStyle='#aeb8a3';
      if(type==='shadowCat'){
        p.fillStyle='#293b48';p.beginPath();p.ellipse(-1,7,12,9,0,0,Math.PI*2);p.fill();p.stroke();
        p.beginPath();p.moveTo(-12,-2);p.lineTo(-12,-15);p.lineTo(-4,-9);p.lineTo(4,-10);p.lineTo(12,-16);p.lineTo(11,0);p.closePath();p.fill();p.stroke();
        p.strokeStyle='#d8c78f';p.beginPath();p.moveTo(-8,-4);p.lineTo(-4,-3);p.moveTo(4,-3);p.lineTo(8,-4);p.stroke();
        p.strokeStyle='#788b91';p.lineWidth=3;p.beginPath();p.moveTo(8,11);p.quadraticCurveTo(22,11,18,-4);p.stroke();
      }else if(type==='firefly'){
        p.fillStyle='#9aaf9b';for(const s of [-1,1]){p.beginPath();p.ellipse(s*8,-2,8,4,s*.6,0,Math.PI*2);p.fill();}
        p.fillStyle='#e8d797';p.beginPath();p.ellipse(0,5,5,8,0,0,Math.PI*2);p.fill();p.stroke();p.fillStyle='#435346';p.beginPath();p.arc(0,-6,4,0,Math.PI*2);p.fill();
      }else{
        p.fillStyle='#aaa4be';for(const s of [-1,1]){p.beginPath();p.ellipse(s*9,-1,9,5,s*.6,0,Math.PI*2);p.fill();}
        p.fillStyle='#e0d4bd';p.beginPath();p.arc(0,-9,5,0,Math.PI*2);p.fill();p.fillStyle='#6d8c87';p.beginPath();p.moveTo(0,-3);p.lineTo(9,15);p.lineTo(0,12);p.lineTo(-9,15);p.closePath();p.fill();p.stroke();
      }thumbnails.set(key,image);
    }
    c.save();c.translate(x,y);if(motion)c.rotate(Math.sin(time*2)*.06);c.drawImage(image,-19,-19,38,38);c.restore();
  }
  function decorate(){
    const buttons={btnSkip:'arrow',btnSkip2:'arrow',btnTech:'research',btnTech2:'research',btnAch:'trophy',btnLot:'chest',btnLot2:'chest',btnHelp:'book',btnHelp2:'book',btnRune:'gem',btnQuest:'archive',btnSave:'save',btnSaveMgr:'save',btnUpAll:'arrow',btnUpTower:'target',btnMaxSel:'arrow',btnMaxAll:'arrow'};
    for(const [id,key]of Object.entries(buttons)){
      const el=document.getElementById(id);if(!el||el.dataset.inkIcon)continue;
      for(const node of el.childNodes)if(node.nodeType===3)node.textContent=node.textContent.replace(/^[^\p{L}\p{N}]+/u,'');
      el.insertAdjacentHTML('afterbegin',icon(key));el.dataset.inkIcon='true';
    }
    for(const [id,key]of Object.entries({btnGacha:'chest',btnBag:'bag',btnDiary:'book',btnNPC:'people',btnFragments:'gem',btnTrials:'infinity',btnEndings:'archive'})){
      const el=document.querySelector('#'+id+' > span');if(el)el.innerHTML=icon(key);
    }
    const resource=['wave','coin','power','soul','door','bed','leaf','enemy'];
    document.querySelectorAll('#hud > .stat > i').forEach((el,i)=>{if(resource[i]&&!el.dataset.inkIcon){el.innerHTML=icon(resource[i]);el.dataset.inkIcon='true';}});
    const logo=document.querySelector('#hud .logo');if(logo&&!logo.dataset.inkIcon){logo.innerHTML=icon('lantern')+'<span>守灯人</span>';logo.dataset.inkIcon='true';}
    const title=document.querySelector('.home-brand h1');if(title&&!title.querySelector('svg'))title.insertAdjacentHTML('afterbegin',icon('lantern','title-lantern'));
    const lottery=document.querySelector('.lotmachine');if(lottery&&!lottery.querySelector('svg'))lottery.innerHTML=icon('chest');
  }
  return {icon,building,enemy,character,companion,decorate,stats:()=>({thumbnails:thumbnails.size,glyphs:glyphs.size,portraits:portraits.size})};
})();
