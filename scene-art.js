// Original procedural environment art. All state here is presentation-only;
// no combat RNG, timers, entity mutations or collision geometry.
const SceneArt = (() => {
  const TAU=Math.PI*2, doorHistory=new WeakMap(), bedHistory=new WeakMap();
  const palette={night:'#080f1c',stone:'#172735',edge:'#3b5261',gold:'#eab96a',danger:'#eb6685'};
  let floor=null, lampGlow=null, fog=null, builds=0;
  const noise=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  function canvas(w,h) { const el=document.createElement('canvas');el.width=w;el.height=h;return el; }
  function box(c,x,y,w,h,color) { c.fillStyle=color;c.fillRect(x,y,w,h); }
  function path(c,points,fill,stroke,width=1) {
    c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();
    if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
  }
  function round(c,x,y,w,h,r,fill,stroke) {
    c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
    if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}
  }
  function line(c,x,y,x2,y2,color,width=1) {
    c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();
  }
  function ellipse(c,x,y,rx,ry,color) {
    c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();
  }
  function glow(size,stops) {
    const el=canvas(size,size),c=el.getContext('2d'),r=size/2,g=c.createRadialGradient(r,r,0,r,r,r);
    stops.forEach(s=>g.addColorStop(s[0],s[1]));c.fillStyle=g;c.fillRect(0,0,size,size);return el;
  }
  function makeFloor() {
    floor=canvas(W,H);const c=floor.getContext('2d');builds++;
    box(c,0,0,W,H,palette.night);
    // A cold exterior strip and actual masonry, rather than a full-screen grid.
    box(c,0,ARENA_TOP,40,ARENA_BOT-ARENA_TOP,'#070d17');
    for(let y=ARENA_TOP;y<ARENA_BOT;y+=24) {
      box(c,4,y,29,22,'#152331');line(c,5,y+1,32,y+1,'#263b4a');
    }
    for(const L of LANES) corridor(c,L);
    room(c);
    // Continuous wall cap and skirting have a different material from the floor.
    box(c,ROOM_X0,HUD_H,ROOM_X1-ROOM_X0,10,'#0c1721');
    box(c,ROOM_X0,ARENA_TOP-3,ROOM_X1-ROOM_X0,3,'#53616a');
    for(let x=ROOM_X0+14;x<ROOM_X1-20;x+=110) {
      box(c,x,HUD_H+2,6,7,'#364853');box(c,x+1,HUD_H+2,4,1,'#8a9994');
    }
    box(c,ROOM_X0,ARENA_BOT,ROOM_X1-ROOM_X0,9,'#0b151e');
    line(c,ROOM_X0,ARENA_BOT,ROOM_X1,ARENA_BOT,'#65706b',2);
    box(c,ROOM_X1-5,ARENA_TOP,5,ARENA_BOT-ARENA_TOP,'#111c25');
    line(c,ROOM_X1-5,ARENA_TOP,ROOM_X1-5,ARENA_BOT,'#687267');
    // Wall cable, clipped notices and vents stay outside the building centres.
    line(c,ROOM_X1-10,ARENA_TOP+12,ROOM_X1-10,198,'#a08151',2);
    round(c,ROOM_X0+22,ARENA_TOP+7,88,15,2,'#263740','#52636a');
    c.font='8px monospace';c.fillStyle='#b1bfb8';c.textAlign='left';c.fillText('DORM / 03:07',ROOM_X0+29,ARENA_TOP+18);
    for(let i=0;i<6;i++) box(c,ROOM_X0+127+i*6,ARENA_TOP+9,3,9,'#08141e');
    line(c,ROOM_X0+124,ARENA_TOP+8,ROOM_X0+162,ARENA_TOP+8,'#6f7e79');
    // Recessed service rail and numbered clips remain on the wall, not build cells.
    for(const x of [ROOM_X0+240,ROOM_X0+520,ROOM_X0+720]) {
      round(c,x,ARENA_TOP+4,24,12,1,'#142630','#52656b');
      box(c,x+4,ARENA_TOP+7,16,2,'#879387');box(c,x+4,ARENA_TOP+11,9,1,'#51676c');
    }
    // A dedicated bedside mat frames the two occupied cells.
    round(c,1155,170,99,188,6,'#313b3b','#697068');
    round(c,1160,175,89,178,4,null,'#927c55');
    for(let i=0;i<10;i++)line(c,1161+i*9,350,1161+i*9,354,'#b29a6d');
    for(let y=182;y<347;y+=9)line(c,1162,y,1247,y,'rgba(167,145,103,.08)');
    // A discreet lamp cable follows the existing occupied bedside strip.
    path(c,[[1257,216],[1253,230],[1255,249],[1250,258],[1252,282]],null,'#121d25',3);
    path(c,[[1257,216],[1253,230],[1255,249],[1250,258],[1252,282]],null,'#807450',1);
    lampGlow=glow(256,[[0,'rgba(255,218,144,.48)'],[.24,'rgba(237,175,78,.23)'],[.65,'rgba(220,151,65,.07)'],[1,'rgba(220,151,65,0)']]);
    fog=glow(128,[[0,'rgba(114,152,174,.24)'],[.5,'rgba(69,101,129,.12)'],[1,'rgba(69,101,129,0)']]);
  }
  function corridor(c,L) {
    const x=CORRIDOR_X0,y=L.y0,w=WALL_X-x,h=L.y1-y;
    box(c,x,y,w,h,L.i===1?'#152534':'#182a39');
    // Staggered slate tiles and restrained chips, baked once.
    for(let row=0;row<6;row++) for(let col=0;col<7;col++) {
      const tx=x+col*58-(row%2)*29,ty=y+row*28;
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
      box(c,tx+1,ty+1,56,26,noise(col*13+row+L.i*55)>.5?'#1a2e3e':'#1c3040');
      line(c,tx+3,ty+2,tx+54,ty+2,'rgba(118,148,166,.10)');
      line(c,tx+55,ty+4,tx+55,ty+24,'rgba(5,15,24,.32)');
      if(noise(col*17+row*43+L.i)>.64) {
        path(c,[[tx+5,ty+21],[tx+14,ty+17],[tx+22,ty+19],[tx+29,ty+15]],null,'rgba(7,20,29,.27)');
        line(c,tx+6,ty+20,tx+14,ty+16,'rgba(111,144,158,.12)');
      }
      if((col+row)%4===0)line(c,tx+8,ty+20,tx+18,ty+19,'rgba(108,142,163,.12)');
      c.restore();
    }
    box(c,x,y,w,30,'#101d2b');box(c,x,y+28,w,5,'#080f1a');
    line(c,x,y+27,WALL_X,y+27,'#405566');
    line(c,x,y+31,WALL_X,y+31,'#0a1520',2);
    for(const px of [89,219,345]){box(c,px,y+2,3,24,'#263c4b');line(c,px,y+3,px,y+24,'#546772');}
    // A pair of recessed rain windows in each corridor wall.
    for(const wx of [96,237]) {
      round(c,wx-4,y+2,104,26,2,'#060e19','#4a6372');
      box(c,wx,y+5,96,18,'#274452');
      // Distant dormitory roofs sit behind the glass and its nearer mullions.
      for(let block=0;block<3;block++) {
        const bx=wx+4+block*30,roof=y+9+Math.floor(noise(block+L.i*7)*4);
        path(c,[[bx,roof+3],[bx+12,roof-2],[bx+25,roof+3],[bx+25,y+23],[bx,y+23]],'#142a38',null);
        box(c,bx+5,roof+7,3,2,'#53656a');box(c,bx+16,roof+7,3,2,'#3e5b66');
      }
      for(let i=0;i<8;i++)box(c,wx+i*13,y+5,3,18,'rgba(93,139,159,.10)');
      box(c,wx+45,y+4,4,21,'#0b1823');box(c,wx,y+13,96,2,'#101e2b');
      line(c,wx-3,y+28,wx+102,y+28,'#75929d');
      line(c,wx-2,y+1,wx+99,y+1,'#6a8290');
      line(c,wx+99,y+4,wx+99,y+24,'#07121e',2);
      box(c,wx+43,y+21,8,3,'#98a9a4');box(c,wx+46,y+19,3,3,'#7b8f91');
      for(const sx of [wx+9,wx+70])path(c,[[sx,y+6],[sx-3,y+11],[sx-1,y+17]],null,'rgba(166,197,204,.15)');
      // Window projection on wet slate, with mullion shadows and glints.
      path(c,[[wx,y+34],[wx+93,y+34],[wx+110,y+107],[wx+8,y+97]],'rgba(80,124,149,.12)');
      path(c,[[wx+44,y+34],[wx+49,y+34],[wx+61,y+103],[wx+55,y+102]],'#172b3b');
      line(c,wx+9,y+67,wx+103,y+71,'rgba(7,16,27,.5)',3);
    }
    // Pipes, brackets and puddles use metal/glass value bands distinct from enemies.
    line(c,52,y+8,87,y+8,'#50616d',3);line(c,53,y+11,87,y+11,'#192938',2);
    for(const px of [56,79])box(c,px,y+4,3,11,'#687a81');
    ellipse(c,168,L.doorY+39,63,7,'rgba(6,14,24,.43)');
    ellipse(c,168,L.doorY+37,54,3,'rgba(105,150,171,.16)');
    line(c,133,L.doorY+36,182,L.doorY+36,'rgba(143,187,200,.16)');
    ellipse(c,288,L.doorY-25,36,4,'rgba(4,12,22,.42)');
    line(c,267,L.doorY-26,301,L.doorY-26,'rgba(126,171,191,.16)');
    // An inset drainage grate and a broken reflection explain the wet material.
    round(c,304,L.y1-18,47,8,1,'#091521','#3a5360');
    for(let gx=308;gx<349;gx+=6)line(c,gx,L.y1-16,gx,L.y1-12,'#617984');
    for(const [gx,gy,len]of [[112,43,24],[218,78,33],[288,110,19]])
      line(c,gx,L.y0+gy,gx+len,L.y0+gy-1,'rgba(135,173,188,.12)');
    const dark=c.createLinearGradient(x,0,x+66,0);dark.addColorStop(0,'#040914');dark.addColorStop(1,'rgba(4,9,20,0)');
    c.fillStyle=dark;c.fillRect(x,y,66,h);
    // The pink fissure marks the spawn edge, leaving the floor calm.
    path(c,[[47,y+39],[54,y+53],[49,y+84],[55,y+112],[48,y+145]],null,'#6b345b',3);
    round(c,60,y+39,24,18,2,'#152532','#465a66');
    box(c,61,y+40,3,16,'#61777e');box(c,63,y+59,19,2,'#0b1822');
    c.fillStyle='#a5bdc9';c.font='bold 10px monospace';c.textAlign='center';c.fillText('0'+(L.i+1),72,y+52);
    // Low floor guides point toward the actual opening.
    for(const px of [108,214,320])path(c,[[px,L.doorY-3],[px+6,L.doorY],[px,L.doorY+3]],null,'rgba(124,156,170,.25)');
    box(c,x,L.y1-6,w,6,'#080f18');line(c,x,L.y1-6,WALL_X,L.y1-6,'#425767');
    line(c,x,L.y1-1,WALL_X,L.y1-1,'#152b3b');
  }
  function room(c) {
    const w=ROOM_X1-ROOM_X0,h=ARENA_BOT-ARENA_TOP;
    box(c,ROOM_X0,ARENA_TOP,w,h,'#182932');
    // Broad timber boards have fine grain, bevels and offset end joints.
    for(let r=0;r<ROWS;r++) for(let col=0;col<COLS;col++) {
      const x=ROOM_X0+col*CW,y=ARENA_TOP+r*CH;
      for(let p=0;p<3;p++) {
        const px=x+p*CW/3;
        box(c,px+1,y+1,CW/3-2,CH-2,noise(col*37+r*11+p)>.5?'#25343b':'#22323a');
        line(c,px+2,y+2,px+CW/3-2,y+2,'rgba(154,165,148,.10)');
        line(c,px+2,y+CH-2,px+CW/3-2,y+CH-2,'#14232c');
        for(let g=0;g<3;g++) {
          const sx=px+7+noise(col*49+r*61+g*7+p)*20,sy=y+8+noise(g*29+col+r*13+p*19)*55;
          line(c,sx,sy,sx+noise(g*7+col)*4,Math.min(y+CH-6,sy+22),'rgba(9,22,29,.19)');
        }
        if((col+r+p)%5===0) {
          const knotX=px+CW/6,knotY=y+23+noise(col+r*9+p)*38;
          c.strokeStyle='rgba(13,26,32,.25)';c.lineWidth=.7;c.beginPath();c.ellipse(knotX,knotY,2.5,6,0,0,TAU);c.stroke();
        }
        for(const sy of [6,CH-6]){box(c,px+5,y+sy,1.5,1.5,'rgba(7,20,27,.5)');}
      }
      // Four short brackets make a build cell readable without a glowing table.
      c.strokeStyle='rgba(137,161,159,.23)';c.lineWidth=1;c.beginPath();
      for(const [dx,dy,sx,sy]of [[5,5,1,1],[CW-5,5,-1,1],[5,CH-5,1,-1],[CW-5,CH-5,-1,-1]]) {
        c.moveTo(x+dx,y+dy+sy*6);c.lineTo(x+dx,y+dy);c.lineTo(x+dx+sx*6,y+dy);
      }c.stroke();
    }
    const light=c.createLinearGradient(ROOM_X0,0,ROOM_X1,0);
    light.addColorStop(0,'rgba(5,19,31,.40)');light.addColorStop(.6,'rgba(7,18,27,.04)');light.addColorStop(1,'rgba(173,124,66,.09)');
    c.fillStyle=light;c.fillRect(ROOM_X0,ARENA_TOP,w,h);
  }
  function ensure() { if(!floor || floor.width!==W || floor.height!==H)makeFloor(); }
  function drawBase(c) {ensure();c.drawImage(floor,0,0);}
  function drawWeather(c,time,motion=true) {
    ensure();const t=motion?time:0;c.save();
    c.beginPath();c.rect(CORRIDOR_X0,ARENA_TOP,WALL_X-CORRIDOR_X0,ARENA_BOT-ARENA_TOP);c.clip();
    for(const L of LANES) {
      c.strokeStyle='rgba(176,207,220,.28)';c.lineWidth=.8;c.beginPath();
      for(let i=0;i<16;i++) {
        const wx=i<8?96:237,x=wx+3+noise(i+L.i*13)*89;
        const y=L.y0+5+((noise(i*3+4)*19+t*(18+noise(i)*14))%18);
        c.moveTo(x,y);c.lineTo(x-2,Math.min(L.y0+24,y+5));
      }c.stroke();
      // Reflected rain is softer and never passes over combat entities.
      c.strokeStyle='rgba(128,171,190,.10)';c.beginPath();
      for(let i=0;i<8;i++) {
        const x=112+i*29+Math.sin(t*.25+i)*3,y=L.y0+46+((t*17+i*13)%53);
        c.moveTo(x,y);c.lineTo(x+2,y+8);
      }c.stroke();
      c.globalAlpha=.35;c.drawImage(fog,37+Math.sin(t*.3+L.i)*13,L.doorY-29,125,55);
      c.globalAlpha=.18;c.drawImage(fog,214+Math.sin(t*.21+L.i)*20,L.doorY+25,150,40);
    }
    c.restore();
    // The warm pool breathes slowly; it is under buildings, enemies and warnings.
    c.save();c.globalAlpha=motion ? .76+Math.sin(t*1.3)*.07 : .76;
    c.drawImage(lampGlow,1092,75,300,300);c.restore();
  }
  function healing(history,entity,dt) {
    let s=history.get(entity);
    if(!s){s={hp:entity.hp,repair:0};history.set(entity,s);}
    if(entity.hp>s.hp+.01)s.repair=.6;
    s.hp=entity.hp;s.repair=Math.max(0,s.repair-dt);return s.repair;
  }
  function drawDoor(c,L,D,time,dt,motion=true) {
    const x=WALL_X,y=D.y,half=L.doorHalf,p=Math.max(0,Math.min(1,D.hp/D.maxHp)),broken=D.broken||D.hp<=0;
    const repair=healing(doorHistory,D,dt);c.save();
    // Heavy jambs and inset masonry. The opening matches the collision gap.
    for(const [a,b]of [[L.y0,y-half],[y+half,L.y1]]) {
      box(c,x-9,a,18,b-a,'#111b24');box(c,x-9,a,4,b-a,'#586873');
      box(c,x+5,a,4,b-a,'#35434c');
      for(let by=a+10;by<b-3;by+=18)line(c,x-4,by,x+5,by,'#24343f');
    }
    box(c,x-21,y-half-6,42,6,'#0c141f');box(c,x-19,y-half-7,38,2,'#7b8c8d');
    box(c,x-21,y+half,42,7,'#0a121c');line(c,x-18,y+half,x+18,y+half,'#64787e',2);
    for(let i=0;i<5;i++)path(c,[[x-19+i*8,y+half+1],[x-15+i*8,y+half+1],[x-19+i*8,y+half+6],[x-23+i*8,y+half+6]],'#77684b');
    box(c,x-19,y-half,4,half*2,'#1d2d3a');box(c,x+15,y-half,4,half*2,'#526977');
    if(broken) {
      // An open route, buckled steel and dropped fasteners; no ghost solid slab.
      path(c,[[x-14,y-half],[x-1,y-half+4],[x-8,y-half+25],[x-14,y-half+34]],'#3c4c59','#69818c');
      path(c,[[x-13,y+half-13],[x+11,y+half-18],[x+18,y+half-5],[x-7,y+half]],'#344754','#627b88');
      line(c,x-3,y+half-10,x+11,y+half-8,'#1a2c37',2);
      ellipse(c,x+23,y+half+7,2,1,'#8a9292');ellipse(c,x-24,y+half+8,2,1,'#778b95');
    } else {
      const level=Math.min(4,Math.floor((D.lv-1)/10));
      path(c,[[x-14,y-half+6],[x-9,y-half],[x+10,y-half],[x+14,y-half+5],[x+14,y+half-5],[x+9,y+half],[x-10,y+half],[x-14,y+half-5]],'#526977','#a0adb0');
      path(c,[[x-11,y-half+7],[x-6,y-half+3],[x+10,y-half+3],[x+10,y+half-4],[x-10,y+half-4]],'#415764');
      const wooden=D.lv<=5;
      box(c,x-10,y-half+10,16,half*2-20,wooden?'#64513f':'#344b5a');
      line(c,x-9,y-half+9,x-9,y+half-9,wooden?'#a18760':'#74939c');line(c,x+10,y-half+7,x+10,y+half-7,'#1a2b38',2);
      if(wooden) for(let i=0;i<3;i++)line(c,x-6+i*5,y-half+12,x-5+i*5,y+half-11,'#493c32');
      else {
        box(c,x-7,y-half+12,10,2,'#526d79');line(c,x+3,y-half+15,x+3,y+half-12,'#1b303e');
        for(const by of [-12,11]){box(c,x-8,y+by,10,2,'#223a47');line(c,x-8,y+by-1,x+2,y+by-1,'#56737e');}
      }
      // Crossbars, hinges and an independent latch create a steel-door silhouette.
      for(const off of [-22,22]) {
        box(c,x-16,y+off-3,32,6,'#172a36');box(c,x-15,y+off-3,30,2,'#7d939a');
        box(c,x-18,y+off-5,5,10,'#62747c');
        ellipse(c,x-15,y+off,1.2,1.2,'#bec6bd');ellipse(c,x+11,y+off,1.1,1.1,'#a7b2ae');
      }
      round(c,x-1,y-8,11,16,2,'#1b2c37','#8b9d9f');box(c,x+5,y-2,8,3,palette.gold);
      ellipse(c,x+3,y+4,1,1,'#0a1a25');line(c,x-12,y-half+6,x-12,y+half-7,'#b6bcb0');
      box(c,x-5,y-half+13,7,3,p<.3?palette.danger:'#a3d7bb');
      for(let i=0;i<level;i++)box(c,x-8+i*4,y+half-13,2,5,'#e6be78');
      if(p<.7) {
        line(c,x-7,y-15,x+2,y-7,'#112530',2);line(c,x+2,y-7,x-3,y+2,'#10212d',2);
        line(c,x-6,y-14,x+1,y-7,'#8e8990');
      }
      if(p<.4) {
        line(c,x+3,y+8,x-6,y+17,'#0a1925',2);line(c,x-6,y+17,x+3,y+29,'#0a1925',2);
        path(c,[[x-12,y+16],[x-8,y+19],[x-9,y+25]],null,'#a4817c');
      }
      if(D.shield>0)round(c,x-17,y-half-2,34,half*2+4,4,null,'#77cbd8');
      if(p<.3) {c.strokeStyle=palette.danger;c.lineWidth=2;c.strokeRect(x-20,y-half-3,40,half*2+6);}
    }
    if(repair>0) {
      c.globalAlpha=Math.min(1,repair*2);line(c,x-10,y+6,x+10,y+6,'#9cdbc0',2);
      for(let i=0;i<4;i++){const n=noise(i+Math.floor((motion?time:0)*14));line(c,x+2,y+6,x+2+n*12,y-1+i*6,'#ffe4a0');}
    }
    c.restore();
  }
  function drawBed(c,B,time,dt,motion=true) {
    ensure();const x=BED_CX,y=175,bx=x-32,w=66,h=167;
    const hp=Math.max(0,Math.min(1,B.hp/B.maxHp)),t=motion?time:0,breathe=Math.sin(t*1.3)*.8;
    const repair=healing(bedHistory,B,dt);c.save();
    // Feet and rails support a solid wood frame, edged with brass.
    ellipse(c,x+5,270,43,91,'rgba(3,11,18,.43)');
    for(const dx of [-29,28])box(c,x+dx,336,7,10,'#1e211f');
    round(c,bx-4,y,w+8,h,5,'#463c33','#b09a6c');
    box(c,bx-1,y+8,3,h-16,'#8f7855');box(c,bx+w-2,y+8,4,h-16,'#292c29');
    round(c,bx,y+3,w,28,4,'#655944','#b6a074');
    line(c,bx+7,y+11,bx+w-7,y+11,'#a18e69');
    round(c,bx+4,y+27,w-8,h-36,4,'#acb9b5','#d3d8c7');
    round(c,x-25,y+32,50,23,5,'#e7dfc8','#b0b7ad');
    line(c,x-21,y+36,x+21,y+36,'#fff1d5');
    path(c,[[x-23,y+43],[x-20,y+50],[x-7,y+53]],null,'#b8beaf');
    // Sleeping child and fabric folds, no emoji or text used as the subject.
    ellipse(c,x-2,y+49+breathe*.2,11,9,'#d8ac85');
    path(c,[[x-13,y+48],[x-12,y+41],[x-6,y+38],[x+4,y+40],[x+9,y+45],[x+2,y+44],[x-4,y+46]],'#27313a');
    line(c,x-7,y+50,x-3,y+51,'#6f5549');line(c,x+1,y+51,x+5,y+50,'#6f5549');
    const qy=y+57+breathe;
    round(c,bx+6,qy,w-12,97,5,'#466577','#85a4a7');
    path(c,[[bx+7,qy+8],[x-5,qy+3],[bx+w-8,qy+8],[bx+w-8,qy+17],[x,qy+12],[bx+7,qy+19]],'#6c8990');
    path(c,[[bx+7,qy+19],[bx+13,qy+24],[bx+12,qy+86],[bx+7,qy+91]],'#344e60');
    line(c,bx+18,qy+29,bx+22,qy+67,'#5f7e86');line(c,x+11,qy+31,x+15,qy+84,'#3b586b');
    for(const dx of [-19,21])for(let sy=27;sy<86;sy+=8)line(c,x+dx,qy+sy,x+dx,qy+sy+3,'#8ba19e',.7);
    path(c,[[bx+7,qy+86],[x-3,qy+91],[bx+w-7,qy+85],[bx+w-7,qy+96],[bx+7,qy+96]],'#2e485b');
    for(let i=0;i<5;i++)line(c,bx+9+i*9,qy+93,bx+13+i*9,qy+93,'#9eae9f');
    // A stitched lamp emblem on the quilt ties the silhouette to the title.
    path(c,[[x+9,qy+65],[x+15,qy+65],[x+19,qy+75],[x+5,qy+75]],'#d5bd81');
    line(c,x+12,qy+75,x+12,qy+82,'#d5bd81',2);line(c,x+7,qy+83,x+17,qy+83,'#d5bd81');
    // Emergency bedside lamp, table, switch and winding supply lead.
    round(c,1237,190,21,27,2,'#514735','#99845d');box(c,1239,195,17,2,'#292e2b');
    ellipse(c,1248,190,8,3,'#bd9b58');box(c,1246,176,3,14,'#c4a366');
    path(c,[[1239,162],[1255,162],[1259,178],[1235,178]],'#c0a26d','#f3d599');
    box(c,1236,176,22,3,'#f0cf87');line(c,1242,165,1240,175,'#e3c384');
    box(c,1246,163,2,12,'#ad895a');ellipse(c,1247,180,4,2,'#ffe6a6');
    line(c,1255,188,1257,194,'#bfa675');box(c,1244,202,6,2,'#b9c394');
    // A closed notebook and a mug sit on the existing nightstand.
    path(c,[[1239,207],[1252,208],[1252,214],[1239,213]],'#677a73','#afaf8d');line(c,1241,209,1250,210,'#c3c1a4');
    ellipse(c,1253,199,3,2,'#d1c8ab');box(c,1250,199,6,5,'#a6ad9d');ellipse(c,1253,204,3,1,'#64766e');
    if(hp<.5) {
      path(c,[[x-9,qy+40],[x-3,qy+46],[x-8,qy+53],[x+1,qy+58]],null,'#132f43',2);
      if(hp<.3)round(c,bx-7,y-3,w+14,h+6,6,null,palette.danger);
    }
    if(repair>0) {c.globalAlpha=repair;round(c,x-13,qy+39,18,18,2,'#a1c5a9');c.globalAlpha=1;}
    c.restore();
  }
  return {drawBase,drawWeather,drawDoor,drawBed,noise,palette,
    stats:()=>({builds,bytes:floor?4*(floor.width*floor.height+256*256+128*128):0})};
})();
