// Original mechanical silhouettes. Static chassis/heads are cached separately so
// aiming and recoil never rebuild textures. All observations live outside G/save.
const BuildingArt=(()=>{
  const TAU=Math.PI*2,cache=new Map(),history=new WeakMap(),LIMIT=144;
  const types=['miner','generator','turret','frost','laser','tesla','flame','repair','shield','amp','poison','sonic','missile','gravity','prism','bank'];
  const metal='#405761',rim='#95aaa9',dark='#0b1b25',bronze='#ae9365',cloth='#273e4b';
  let builds=0,bytes=0;
  const clip=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  function rect(c,x,y,w,h,fill,stroke) {c.fillStyle=fill;c.fillRect(x,y,w,h);if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);}}
  function poly(c,p,fill,stroke=dark,width=1.5) {c.beginPath();p.forEach((v,i)=>i?c.lineTo(...v):c.moveTo(...v));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  function line(c,x,y,x2,y2,color,width=1) {c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  function oval(c,x,y,rx,ry,fill,stroke) {c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.2;c.stroke();}}
  function arc(c,x,y,r,start,end,color,width=1.2) {c.beginPath();c.arc(x,y,r,start,end);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  function plate(c,x,y,w,h,color=metal) {
    poly(c,[[x+4,y],[x+w-4,y],[x+w,y+4],[x+w,y+h-4],[x+w-4,y+h],[x+4,y+h],[x,y+h-4],[x,y+4]],color);
    line(c,x+4,y+1,x+w-4,y+1,rim);line(c,x+1,y+4,x+1,y+h-4,'#687f87');
  }
  function bolts(c,x,y,w,h) {for(const [px,py]of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]){oval(c,px,py,1.4,1.4,bronze);line(c,px-1,py,px+1,py,dark);}}
  function crystal(c,x,y,r,color,wide=1) {poly(c,[[x+r,y],[x,y-r*wide],[x-r,y],[x,y+r*wide]],color);poly(c,[[x,y-r*wide],[x-r,y],[x,y+1]],'#cfeded',null);line(c,x,y-r*wide,x,y+r*wide,'rgba(255,255,255,.35)');}
  function coil(c,x,y,r,color) {oval(c,x,y,r,r*.62,metal,rim);for(let i=-2;i<=2;i++)arc(c,x,y+i*2,r*.72,Math.PI,TAU,bronze,1.5);oval(c,x,y-5,r*.65,r*.35,color,dark);}
  function tube(c,x,y,len,width,accent) {rect(c,x,y-width/2,len,width,metal,dark);line(c,x,y-width/2,x+len,y-width/2,rim);rect(c,x+len-5,y-width/2-2,4,width+4,bronze,dark);rect(c,x+len-1,y-width/2+1,2,width-2,accent);}
  function grade(level) {return level>=30?2:level>=12?1:0;}
  function sprite(type,branch,level,color,part) {
    const tier=part==='head'?0:grade(level),key=[type,branch||'base',tier,part,color].join('|');
    if(cache.has(key)){const image=cache.get(key);cache.delete(key);cache.set(key,image);return image;}
    const image=document.createElement('canvas'),size=part==='head'?96:80;image.width=image.height=size;
    const c=image.getContext('2d');c.translate(size/2,size/2);
    if(part==='head')head(c,type,branch,color);else chassis(c,type,branch,tier,color);
    while(cache.size>=LIMIT){const old=cache.keys().next().value,img=cache.get(old);bytes-=img.width*img.height*4;cache.delete(old);}
    cache.set(key,image);bytes+=size*size*4;builds++;return image;
  }
  function chassis(c,type,b,tier,a) {
    oval(c,2,20,29,10,'rgba(2,11,18,.5)');
    switch(type) {
      case 'turret':
        plate(c,-21,-12,42,34);rect(c,-27,-8,8,28,cloth,dark);rect(c,19,-8,8,28,cloth,dark);
        for(let i=0;i<4;i++){line(c,-26,-3+i*6,-21,-3+i*6,rim);line(c,21,-3+i*6,26,-3+i*6,rim);}
        oval(c,0,0,16,14,'#263d49',rim);bolts(c,-16,-8,32,25);break;
      case 'frost':
        poly(c,[[-24,18],[-19,-8],[-7,-20],[14,-14],[25,8],[15,24],[-10,26]],'#345365',rim);
        for(const [x,y,r]of [[-20,-13,9],[17,-19,10],[-15,13,7]])crystal(c,x,y,r,a,1.4);
        if(b==='a'){crystal(c,0,-24,12,a,1.3);crystal(c,25,-5,9,a,1.6);}
        if(b==='b'){plate(c,-29,-5,10,31);rect(c,-27,1,6,15,'#b9dce1');}
        line(c,-16,18,16,18,'#b8dbe1',2);break;
      case 'laser':
        for(const angle of [-Math.PI/2,Math.PI/6,Math.PI*5/6]) {
          c.save();c.rotate(angle);plate(c,7,-5,25,10,'#334b58');rect(c,24,-3,7,6,bronze,dark);c.restore();
        }
        oval(c,0,0,17,17,metal,rim);oval(c,0,0,11,11,dark,a);
        if(b==='a') {rect(c,-23,12,46,7,bronze,dark);bolts(c,-18,15,36,0);}
        if(b==='b')for(const x of [-20,20])crystal(c,x,10,7,a);break;
      case 'tesla':
        plate(c,-22,-8,44,32);rect(c,-26,15,52,6,cloth,rim);
        coil(c,-15,-9,10,a);coil(c,15,-9,10,a);line(c,-14,9,14,9,bronze,3);
        if(b==='a'){coil(c,0,-25,10,a);plate(c,-10,17,20,10);}
        if(b==='b'){oval(c,0,-3,23,9,dark,rim);arc(c,0,-3,19,Math.PI,TAU,a,3);}
        break;
      case 'flame':
        plate(c,-21,-8,42,30,'#514a40');
        for(const x of b==='a'?[-22,22]:[-20]) {oval(c,x,-4,8,16,'#6a5140',bronze);rect(c,x-7,-9,14,9,'#374951',dark);rect(c,x-3,-23,6,5,bronze,dark);}
        if(b==='b'){oval(c,20,-1,10,18,'#743c34',bronze);line(c,18,-12,18,12,'#da9c6c',2);}
        line(c,-16,16,18,16,bronze,3);oval(c,0,12,5,5,dark,bronze);break;
      case 'poison':
        plate(c,-23,-3,46,26,'#3d5044');
        for(const [x,r,h]of b==='b'?[[-13,11,31],[16,7,22]]:[[-17,7,27],[15,7,27]]) {
          rect(c,x-r,-h,r*2,h,'#294244',rim);rect(c,x-r+2,-h*.65,r*2-4,h*.65-2,a);
          rect(c,x-r-1,-h-3,r*2+2,5,bronze,dark);line(c,x-r+3,-h+6,x-r+3,-5,'#c4d9bd');
        }
        if(b==='a'){oval(c,0,-11,9,13,'#6e8d50',rim);rect(c,-7,-26,14,6,bronze,dark);}
        line(c,-19,14,18,14,bronze,3);break;
      case 'sonic':
        poly(c,[[-25,19],[-25,-15],[-13,-22],[16,-17],[25,-3],[20,22]],metal,rim);
        for(const x of [-19,18]) {rect(c,x,-12,5,30,dark);for(let i=0;i<4;i++)rect(c,x,-10+i*7,4,2,bronze);}
        if(b==='a')plate(c,-29,7,58,14,'#3b4d56');
        if(b==='b'){crystal(c,0,-27,7,a,1.2);rect(c,-5,-21,10,8,bronze);}
        break;
      case 'missile':
        plate(c,-25,-17,50,39,'#4f5350');
        for(const x of [-28,21]) {rect(c,x,-11,7,29,'#253944',rim);line(c,x,-3,x+6,-3,bronze,2);}
        if(b==='a'){rect(c,-22,21,44,5,bronze,dark);rect(c,-30,-19,10,8,metal,rim);}
        if(b==='b'){plate(c,-17,-27,34,15,'#6b4c45');rect(c,-5,17,10,12,bronze,dark);}
        break;
      case 'gravity':
        for(let i=0;i<3;i++){c.save();c.rotate(i*TAU/3);plate(c,12,-5,20,10);rect(c,25,-3,7,6,bronze);c.restore();}
        oval(c,0,0,b==='a'?25:21,21,dark,rim);arc(c,0,0,18,0,TAU,a,2);
        if(b==='b'){for(const x of [-27,21])plate(c,x,-21,6,42,'#4b465c');}
        break;
      case 'prism':
        poly(c,[[0,-28],[27,19],[-27,19]],'#34545c',rim);poly(c,[[0,-20],[19,14],[-19,14]],dark,bronze);
        if(b==='a')for(let i=0;i<6;i++){const an=i*TAU/6;crystal(c,Math.cos(an)*23,Math.sin(an)*23,6,a);}
        if(b==='b'){plate(c,-25,17,50,7);crystal(c,0,-29,9,a,1.15);}
        break;
      case 'miner':
        plate(c,-23,-3,46,26,'#514d40');rect(c,-26,18,52,7,cloth,rim);
        for(const x of [-19,15]) {rect(c,x,-25,5,39,bronze,dark);bolts(c,x+2,-20,0,28);}
        if(b==='b') {
          plate(c,-15,-22,30,33,'#66523c');rect(c,-11,-15,22,13,dark,bronze);
          for(let i=0;i<3;i++)poly(c,[[-10+i*7,-4],[-7+i*7,-13],[-3+i*7,-4]],'#dca764',null);
          rect(c,13,-30,9,15,metal,rim);rect(c,-20,10,40,7,bronze,dark);
        } else {
          rect(c,-12,-27,24,8,metal,rim);rect(c,-3,-20,6,36,'#8d9d99',dark);
          for(let i=0;i<(b==='a'?6:4);i++)line(c,-9,-15+i*5,9,-20+i*5,bronze,3);
          if(b==='a') {plate(c,-29,3,9,24);plate(c,20,3,9,24);}
        }
        break;
      case 'generator':
        plate(c,-25,-10,50,30,'#3e5459');rect(c,-28,17,56,7,cloth,rim);
        if(b==='b'){coil(c,-17,-17,11,a);coil(c,17,-17,11,a);line(c,-17,-4,17,-4,bronze,3);}
        else {oval(c,0,-7,b==='a'?20:16,b==='a'?20:16,dark,rim);oval(c,0,-7,b==='a'?14:10,b==='a'?14:10,a,bronze);
          if(b==='a')for(const x of [-27,22])rect(c,x,-24,5,40,bronze,dark);}
        for(let i=0;i<4;i++)rect(c,-18+i*10,14,5,3,bronze);break;
      case 'repair':
        plate(c,-24,0,48,23,'#3b514c');rect(c,-16,-4,32,12,cloth,rim);
        for(const x of b==='a'?[-29,-17,17,29]:[-24,24]) {
          line(c,x,7,x*.8,-15,bronze,4);line(c,x*.8,-15,x*.4,-23,rim,3);
          line(c,x*.4,-23,x*.4-3,-28,metal,2);line(c,x*.4,-23,x*.4+3,-28,metal,2);
        }
        if(b==='b'){coil(c,-12,-15,8,a);coil(c,12,-15,8,a);arc(c,0,-11,18,Math.PI,TAU,a,2);}
        else {rect(c,-10,-18,20,19,dark,rim);rect(c,-2,-15,4,12,a);rect(c,-6,-11,12,4,a);}
        bolts(c,-18,12,36,0);break;
      case 'shield':
        poly(c,[[-28,13],[-20,-13],[0,-23],[20,-13],[28,13],[0,26]],metal,rim);
        if(b==='b')for(const side of [-1,1])poly(c,[[side*2,-16],[side*21,-23],[side*29,4],[side*6,11]],'#668791',bronze);
        else {oval(c,0,0,b==='a'?25:20,14,dark,bronze);arc(c,0,0,b==='a'?21:16,Math.PI,TAU,a,4);
          if(b==='a')for(const x of [-22,0,22])crystal(c,x,-15,6,a);}
        oval(c,0,4,6,4,a,rim);break;
      case 'amp':
        plate(c,-24,9,48,15);line(c,-16,14,0,-24,bronze,3);line(c,16,14,0,-24,bronze,3);
        if(b==='b'){oval(c,0,-10,28,10,'#7a8b89',rim);arc(c,0,-10,23,0,Math.PI,dark,2);line(c,-18,-10,18,-10,bronze);line(c,0,-24,0,-6,a,3);}
        else {rect(c,-8,-29,16,38,dark,rim);for(let i=0;i<(b==='a'?5:3);i++)rect(c,-15,-25+i*7,30,3,bronze,dark);oval(c,0,-26,4,4,a);}
        break;
      case 'bank':
        plate(c,-26,-16,52,40,'#52564d');rect(c,-19,-10,34,28,'#2e4346',bronze);
        oval(c,-1,4,11,11,metal,rim);line(c,-9,4,7,4,bronze,3);line(c,-1,-4,-1,12,bronze,3);
        rect(c,18,-7,4,22,bronze,dark);bolts(c,-21,-11,42,29);
        if(b==='a') {for(let i=0;i<4;i++)rect(c,-18+i*10,-22-i*2,7,7+i*2,bronze,dark);}
        if(b==='b'){crystal(c,0,-24,11,'#bc9bcd');for(const x of [-24,24])rect(c,x-4,-25,8,15,'#6a5974',rim);}
        break;
    }
    if(tier>=1) {plate(c,-29,16,12,12,'#52646a');plate(c,17,16,12,12,'#52646a');}
    if(tier>=2) {for(const x of [-30,25]){plate(c,x,-8,6,24,'#5d6660');for(let i=0;i<3;i++)line(c,x,-3+i*6,x+5,-3+i*6,bronze);}}
    rect(c,-11,21,22,3,dark);for(let i=0;i<=tier;i++)rect(c,-9+i*6,21,4,2,b?bronze:a);
  }
  function head(c,type,b,a) {
    switch(type) {
      case 'turret':
        plate(c,-12,-11,28,22);oval(c,-5,0,5,5,bronze,dark);
        if(b==='a'){for(const y of [-6,0,6])tube(c,7,y,26,4,a);rect(c,26,-10,5,20,metal,rim);}
        else {tube(c,7,0,b==='b'?37:25,b==='b'?5:8,a);if(b==='b'){rect(c,1,-10,23,4,cloth,rim);oval(c,22,-8,3,3,a);}}
        break;
      case 'frost':
        plate(c,-12,-9,28,18,'#466579');tube(c,10,0,19,6,'#d8f5ee');
        if(b==='b')poly(c,[[20,-7],[43,0],[20,7]],'#a6e8ef',rim);
        else {for(const y of b==='a'?[-11,0,11]:[-7,7])crystal(c,27,y,8,a);}
        break;
      case 'laser':
        plate(c,-13,-9,28,18);tube(c,5,0,b==='a'?33:25,5,a);
        if(b==='b')for(const an of [-.4,0,.4]){c.save();c.rotate(an);crystal(c,30,0,7,a,.6);c.restore();}
        else {for(let i=0;i<(b==='a'?4:2);i++)rect(c,11+i*6,-8,3,16,bronze,dark);crystal(c,b==='a'?41:34,0,5,a,.8);}
        break;
      case 'tesla':
        plate(c,-10,-10,23,20,'#524f60');
        if(b==='b'){poly(c,[[9,-14],[24,-14],[31,0],[24,14],[9,14]],metal,rim);oval(c,23,0,5,8,a,dark);}
        else {for(const y of [-9,9]){line(c,3,y,27,y,bronze,4);oval(c,27,y,4,4,a,dark);}line(c,11,-9,11,9,rim,2);}
        break;
      case 'flame':
        plate(c,-12,-10,24,20,'#625346');
        if(b==='a')for(const y of [-7,7]){tube(c,8,y,24,7,'#eab46c');poly(c,[[28,y-7],[36,y-4],[36,y+4],[28,y+7]],'#745247',bronze);}
        else {tube(c,6,0,21,10,'#eab46c');poly(c,[[24,-9],[37,-7],[37,7],[24,9]],b==='b'?'#8e4f3b':metal,bronze);}
        break;
      case 'poison':
        plate(c,-12,-8,25,16,'#57664c');tube(c,8,0,b==='b'?29:20,b==='b'?10:6,a);
        if(b==='a'){for(const y of [-8,8]){tube(c,4,y,19,4,a);oval(c,22,y,3,3,a);}}
        if(b==='b')rect(c,24,-9,5,18,bronze,dark);break;
      case 'sonic':
        plate(c,-12,-9,22,18);poly(c,[[7,-6],[b==='a'?35:29,b==='a'?-20:-15],[b==='a'?35:29,b==='a'?20:15],[7,6]],'#647880',rim);
        oval(c,b==='a'?35:29,0,4,b==='a'?18:13,dark,bronze);oval(c,b==='a'?35:29,0,2,8,a);
        if(b==='b'){for(const y of [-12,12])crystal(c,18,y,5,a);}
        break;
      case 'missile':
        if(b==='b') {plate(c,-14,-13,42,26,'#5f574d');poly(c,[[-7,-8],[26,-8],[42,0],[26,8],[-7,8]],'#c8c4a8',bronze);poly(c,[[1,-8],[-6,-16],[9,-8]],metal,rim);poly(c,[[1,8],[-6,16],[9,8]],metal,rim);}
        else {const offsets=b==='a'?[-12,0,12]:[-7,7];for(const y of offsets){tube(c,-12,y,38,8,a);poly(c,[[19,y-3],[31,y],[19,y+3]],'#d7d3b9',bronze);}}
        break;
      case 'gravity':
        oval(c,0,0,b==='a'?20:15,b==='a'?20:15,'#142536',a);oval(c,0,0,b==='b'?10:7,b==='b'?10:7,'#070d1b',bronze);
        if(b==='a')for(let i=0;i<3;i++){c.save();c.rotate(i*TAU/3);rect(c,18,-4,9,8,metal,rim);c.restore();}
        if(b==='b')for(const y of [-19,19])rect(c,-15,y-2,30,4,bronze,dark);break;
      case 'prism':
        if(b==='a')for(let i=0;i<6;i++){const an=i*TAU/6;crystal(c,Math.cos(an)*14,Math.sin(an)*14,9,a,.7);}
        else if(b==='b'){poly(c,[[-13,-7],[16,-7],[41,0],[16,7],[-13,7]],a,bronze);line(c,-6,-4,31,0,'#d8efdc',2);}
        else {poly(c,[[0,-19],[21,15],[-17,15]],a,rim);poly(c,[[0,-19],[3,7],[-17,15]],'#c4e6e1',null);}
        break;
    }
  }
  function observe(b,dt) {
    let h=history.get(b);if(!h){h={hp:b.hp,shield:b.shield||0,level:b.level,branch:b.branch,hit:0,repair:0,upgrade:0};history.set(b,h);}
    if(b.hp<h.hp-.01 || (b.shield||0)<h.shield-.01)h.hit=.18;
    if(b.level>h.level || b.branch!==h.branch)h.upgrade=.7;
    else if(b.hp>h.hp+.01)h.repair=.55;
    h.hp=b.hp;h.shield=b.shield||0;h.level=b.level;h.branch=b.branch;
    for(const key of ['hit','repair','upgrade'])h[key]=Math.max(0,h[key]-dt);return h;
  }
  function brackets(c,r,color) {for(const [sx,sy]of [[-1,-1],[1,-1],[-1,1],[1,1]]) {line(c,sx*r,sy*(r-7),sx*r,sy*r,color,2);line(c,sx*r,sy*r,sx*(r-7),sy*r,color,2);}}
  function draw(c,b,s,time,dt=1/60,options={}) {
    if(!types.includes(b.type))throw Error('Missing building artwork: '+b.type);
    const a=b.def.color,h=observe(b,dt),motion=options.motion!==false,t=motion?time:0;
    const hot=b.empT>0?0:clip((b.fireFx||0)/.2),live=!!(b.flameOn||b.gravOn),damage=1-clip(b.hp/b.maxHp);
    c.save();c.translate(b.x,b.y);c.drawImage(sprite(b.type,b.branch,b.level,a,'base'),-40,-40);
    if(b.def.tower) {
      c.save();c.translate(0,-3);c.rotate((b.angle||0)+(motion&&!hot&&!live?Math.sin(t*.6+(b.col||0))*.04:0));
      c.translate(-3*clip(b.recoil||0),0);c.drawImage(sprite(b.type,b.branch,b.level,a,'head'),-48,-48);
      deviceMotion(c,b,s,t,hot,live,a,motion);c.restore();
    } else supportMotion(c,b,t,a,motion,hot);
    if(damage>.25) {line(c,-17,-2,-7,5,dark,2);line(c,-7,5,-12,13,dark,2);line(c,-16,-3,-7,3,'#a38c78');}
    if(damage>.65){line(c,9,10,18,15,'#8f6060',2);brackets(c,31,'#e77e8f');}
    if(h.hit>0) {c.globalAlpha=h.hit/.18;line(c,-21,-13,-9,-17,'#f6b9b0',3);line(c,8,19,23,13,'#f6b9b0',2);c.globalAlpha=1;}
    if(h.repair>0) {c.globalAlpha=h.repair/.55;line(c,-16,5,-8,10,'#a9dbb6',3);for(let i=0;i<3;i++){const u=(t*3+i*.3)%1;line(c,-11,7,-18-u*8,4+i*6-u*8,'#efd89b');}c.globalAlpha=1;}
    if(h.upgrade>0){c.globalAlpha=h.upgrade/.7;brackets(c,32+(1-h.upgrade/.7)*7,bronze);c.globalAlpha=1;}
    if(options.selected)brackets(c,34,'#e7c88c');
    if(b.resN>=2)for(let i=0;i<Math.min(6,b.resN);i++)crystal(c,-15+i*6,31,2,b.resColor||a,.8);
    c.restore();
  }
  function deviceMotion(c,b,s,t,hot,live,a,motion) {
    const blink=.65+(motion?Math.sin(t*2)*.12:0),m=b.branch;
    switch(b.type) {
      case 'turret':
        if(hot>0){poly(c,[[m==='b'?44:34,-3],[m==='b'?49:40,0],[m==='b'?44:34,3]],'#f3d49c',null);for(let i=0;i<2;i++){const p=1-hot;rect(c,-2-p*16-i*5,-13-p*20+p*p*33,4,2,bronze);}}
        break;
      case 'frost':
        for(let i=0;i<3;i++){const ph=t*.8+i*TAU/3;crystal(c,9+Math.cos(ph)*9,Math.sin(ph)*9,2.2,'#ceeef0');}
        if(hot)for(const y of [-5,5])crystal(c,36+(1-hot)*6,y,2+hot,a);break;
      case 'laser':
        c.globalAlpha=.25+.55*clip(1-(b.cd||0));line(c,7,0,m==='a'?39:29,0,a,2);c.globalAlpha=1;
        if(hot)oval(c,m==='a'?41:32,0,3+hot*2,2+hot*2,'#fff1cb',a);break;
      case 'tesla':
        if(hot || m==='a'){line(c,21,-9,27,-3,a);line(c,27,-3,22,2,a);line(c,22,2,27,9,a);}
        if(m==='b')arc(c,22,0,7,-Math.PI/2,Math.PI/2,a,1+hot);break;
      case 'flame':
        if(live){for(const y of m==='a'?[-7,7]:[0]){const f=motion?Math.sin(t*23+y)*3:0;poly(c,[[35,y-4],[54+f,y-5],[49+f,y],[54+f,y+4],[35,y+4]],'#c27b45',null);poly(c,[[35,y-2],[48+f,y],[35,y+2]],'#e6c181',null);}}
        else oval(c,35,0,1.6,1.6,'#d9a362');break;
      case 'poison':
        if(hot)for(let i=0;i<3;i++)oval(c,31+(1-hot)*9+i*3,Math.sin(i*2)*3,2,1.5,a);
        oval(c,10,-2,2,2,'#c8d8a9');break;
      case 'sonic':
        if(hot)for(let i=0;i<2;i++)arc(c,29,0,8+(1-hot)*15+i*5,-.7,.7,a,1.5);break;
      case 'missile':
        if(hot){for(const y of m==='a'?[-12,0,12]:[0])poly(c,[[-13,y-3],[-25-(1-hot)*6,y],[-13,y+3]],'#c8b17c',null);}
        break;
      case 'gravity': {
        const active=live?1:.35,spin=t*(m==='b'?-1.7:.8);
        for(let i=0;i<3;i++){const r=(m==='a'?25:20)-(motion?(t*6+i*7)%17:i*5);c.globalAlpha=active*.6;arc(c,0,0,r,spin+i,spin+i+1.3,a,1.3);}c.globalAlpha=1;break;
      }
      case 'prism':
        c.globalAlpha=hot?1:.3;line(c,-5,-5,15,4,'#dbf0df');if(m==='b')line(c,10,-3,38,0,a,1+hot);c.globalAlpha=1;break;
    }
    c.globalAlpha=blink;rect(c,-6,3,3,2,a);c.globalAlpha=1;
  }
  function supportMotion(c,b,t,a,motion,hot) {
    const phase=motion?t*2:0;
    switch(b.type) {
      case 'miner':
        if(b.branch==='b'){c.globalAlpha=.5+Math.sin(phase)*.2;rect(c,-8,-12,16,9,'#d7a86b');c.globalAlpha=1;}
        else {const y=motion?((t*10)%5):0;for(let i=0;i<3;i++)line(c,-7,-12+i*5+y,7,-17+i*5+y,'#c9b78d',1.2);}
        break;
      case 'generator':
        if(b.branch==='b'){const flash=hot?'#d6ece0':a;line(c,-16,-23,-4,-26,flash,hot?2:1);line(c,-4,-26,3,-19,flash,hot?2:1);line(c,3,-19,16,-23,flash,hot?2:1);}
        else for(let i=0;i<3;i++){const n=phase+i*TAU/3;poly(c,[[0,-7],[Math.cos(n)*11,-7+Math.sin(n)*11],[Math.cos(n+.7)*7,-7+Math.sin(n+.7)*7]],bronze,null);}
        break;
      case 'repair':
        c.save();c.translate(0,-11);c.rotate(motion?Math.sin(phase)*.18:0);line(c,-7,0,7,0,'#b6d3ba',2);line(c,0,-6,0,6,'#b6d3ba',2);c.restore();break;
      case 'shield':
        c.globalAlpha=.6;arc(c,0,-1,b.branch==='a'?23:18,Math.PI+(motion?Math.sin(phase)*.04:0),TAU,a,1.3);c.globalAlpha=1;break;
      case 'amp':
        for(let i=0;i<2;i++)arc(c,0,-22,9+i*5,-2.7,-.45,bronze,1.2);oval(c,0,-22,2,2,a);break;
      case 'bank':
        if(b.branch==='b'){c.globalAlpha=.65+Math.sin(phase)*.12;crystal(c,0,-24,4,'#e2c7dc');c.globalAlpha=1;}
        else for(let i=0;i<3;i++)rect(c,16,-9+i*6,3,3,i===(Math.floor(phase)%3)?a:bronze);
        break;
    }
    c.globalAlpha=.65+(motion?Math.sin(phase)*.15:0);oval(c,-17,14,1.6,1.6,a);c.globalAlpha=1;
  }
  function preview(c,type,def,x,y) {
    c.save();c.translate(x,y);c.drawImage(sprite(type,null,1,def.color,'base'),-40,-40);
    if(def.tower){c.translate(0,-3);c.rotate(-Math.PI/2);c.drawImage(sprite(type,null,1,def.color,'head'),-48,-48);}c.restore();
  }
  function impact(c,e) {
    const p=clip(1-e.life/e.maxLife),a=e.color||'#d6c18d',weapon=e.weapon;
    c.save();c.translate(e.x,e.y);c.globalAlpha=1-p;
    switch(weapon) {
      case 'turret':
        for(let i=0;i<4;i++){const an=i*TAU/4+.4,r=3+p*9;line(c,Math.cos(an)*3,Math.sin(an)*3,Math.cos(an)*r,Math.sin(an)*r,'#eed8ad',1.6);}break;
      case 'frost':
        for(let i=0;i<5;i++){const an=i*TAU/5,r=3+p*11;crystal(c,Math.cos(an)*r,Math.sin(an)*r,3*(1-p)+1,'#bddfe6',1.3);}break;
      case 'laser':
        line(c,-7,-5,8,6,'#1c252d',4);line(c,-7,-5,8,6,a,1.5);arc(c,0,0,4+p*8,0,TAU,'#dbcdb4',1);break;
      case 'tesla':
        for(let i=0;i<3;i++){c.save();c.rotate(i*TAU/3);line(c,2,0,7,-3,a,1.5);line(c,7,-3,6,3,a,1.5);line(c,6,3,12+p*4,1,'#d8d2e2');c.restore();}break;
      case 'flame':
        for(let i=0;i<4;i++)oval(c,Math.sin(i*7+p*2)*8,-p*14+i*2,1.5,2.2,i%2?'#d6b677':'#bd7150');break;
      case 'poison':
        for(let i=0;i<3;i++) {const an=i*TAU/3;oval(c,Math.cos(an)*(3+p*6),Math.sin(an)*(3+p*6),3-p,2.5-p,a,dark);}
        if(e.target && e.target.poison>1){c.font='bold 9px monospace';c.textAlign='center';c.fillStyle='#d5deb8';c.fillText('×'+e.target.poison,0,-15);}break;
      case 'sonic':
        for(let i=0;i<2;i++)arc(c,0,0,3+p*12+i*4,0,TAU,a,1);break;
      case 'missile':
        arc(c,0,0,3+p*22,0,TAU,'#c8a677',2*(1-p)+.5);
        for(let i=0;i<3;i++){const an=i*TAU/3;oval(c,Math.cos(an)*p*8,Math.sin(an)*p*8-p*8,2+p*5,2+p*4,p<.3?'#d5b684':'#5b6060');}break;
      case 'gravity':
        for(let i=0;i<3;i++){const an=i*TAU/3+p*2;arc(c,0,0,3+(1-p)*12,an,an+.9,a,1.5);}break;
      case 'prism':
        for(let i=0;i<3;i++){const an=i*TAU/3;line(c,0,0,Math.cos(an)*(4+p*12),Math.sin(an)*(4+p*12),i%2?a:'#d0e3dc',1.5);}break;
      case 'generator':
        line(c,-8,-7,-2,1,a,2);line(c,-2,1,2,-2,a,2);line(c,2,-2,7,7,a,2);break;
    }
    c.restore();
  }
  return {draw,preview,impact,types:types.slice(),grade,stats:()=>({entries:cache.size,builds,bytes,limit:LIMIT}),
    // Read-only presentation observation for integration diagnostics.
    state:b=>{const h=history.get(b);return h?{hit:h.hit,repair:h.repair,upgrade:h.upgrade}:null;}};
})();
