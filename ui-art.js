// Code-native brass/ink symbols and portraits. No fonts, network assets or RNG.
const UiArt = (() => {
  const thumbnails = new Map();
  const paths = {
    lantern:'<path d="M9 5h14l3 23-10 5L6 28 9 5Z"/><path d="M12 5V3h8v2M7 12h18M8 27h16M13 13l-2 13m10-13 2 13"/><path d="M16 13c6 7 5 11 0 13-5-2-6-6 0-13Z" fill="currentColor" stroke="none"/>',
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
  };
  const aliases={gold:'coin',souls:'soul',tech:'research',help:'book',rune:'gem',quest:'archive',skills:'storm',upgrade:'arrow',
    economy:'coin',firepower:'target',vitality:'cross',rapid:'pulse',electric:'power',structure:'shield',ironwall:'door',greed:'coin',mining:'coin',sleep:'bed',focus:'target',
    crit:'blade',harvest:'soul',overload:'power',swift:'clock',runemaster:'gem',fortify:'shield',plunder:'chest',berserk:'fire',thorns:'blade',compound:'coin',critmaster:'target',soulstorm:'storm',overcore:'pulse',annihilation:'meteor',runelord:'gem',fortress:'shield',eternity:'infinity',
    freeze:'frost',overclock:'pulse',mend:'cross',repel:'storm',siphon:'soul',heal:'cross',atkBoost:'blade',slowEnemy:'frost',goldGen:'coin',reveal:'target'};
  function icon(id,extra='') {const key=aliases[id]||id;return '<svg class="ui-glyph '+extra+'" viewBox="0 0 32 34" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">'+(paths[key]||paths.research)+'</svg>';}
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
    const cast={'林小夏':{hair:'#51423d',coat:'#ac925f',style:1},'周默':{hair:'#293b42',coat:'#6a8b98',glasses:true,style:2},'赵磊':{hair:'#4a3630',coat:'#729182',style:3},'你':{hair:'#2a3035',coat:'#607c8e',style:0}};
    const p=cast[name];
    if(!p)return '<svg class="character-art" viewBox="0 0 80 80" aria-hidden="true"><path fill="#182632" d="M0 0h80v80H0z"/><path fill="#354454" d="m9 80 9-43 8-24 14-8 15 9 9 22 9 44Z"/><path fill="#101a26" d="m22 43 5-20 13-8 15 9 6 20-21 21Z"/><path fill="#c5b88e" d="m25 36 10 4-2 3-8-3m20 0 10-4v4l-8 3"/></svg>';
    return '<svg class="character-art" viewBox="0 0 80 80" aria-hidden="true"><path fill="#1c2c35" d="M0 0h80v80H0z"/><path fill="'+p.coat+'" d="M7 80c0-30 66-30 66 0Z"/><path fill="#bba68c" d="M34 48h13v19H34z"/><path fill="'+p.hair+'" d="M19 30c0-31 44-31 44 0l'+(p.style===1?'4 30-15 5-34-5':'-1 20-41 1')+'Z"/><path fill="#d1bba0" d="M24 30c0-20 34-20 34 0v10c-1 22-32 22-34 0Z"/><path fill="'+p.hair+'" d="M21 31c-4-27 43-28 42-1L49 18 32 29Z"/><path fill="none" stroke="#3b3834" stroke-width="2" d="M29 36h6m10 0h6m-14 13h7"/>'+(p.glasses?'<path fill="none" stroke="#4f656c" stroke-width="2" d="M27 31h12v11H27Zm16 0h12v11H43Zm-4 4h4"/>':'')+'<path fill="#e1d2b2" d="m25 63 9-5 6 9 7-9 9 5-10 14H35Z"/><path fill="#586a70" d="M38 68h5v12h-5z"/></svg>';
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
  return {icon,building,enemy,character,companion,decorate,stats:()=>({thumbnails:thumbnails.size})};
})();
