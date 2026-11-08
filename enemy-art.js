// Original rain-night bestiary. Cached vector bodies; presentation never writes to enemies.
const EnemyArt = (() => {
  const TAU = Math.PI * 2, cache = new Map(), active = new Map(), deaths = [];
  const LIMIT = 64, INK = '#09131f', BONE = '#d7d1bc', METAL = '#52616e';
  let builds = 0, bytes = 0, gameRef = null;
  const clamp01 = n => Math.max(0, Math.min(1, n));
  function mix(a, b, t) {
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const x = rgb(a), y = rgb(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  function path(c, points, fill, stroke = INK, width = 1.6) {
    c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  function oval(c, x, y, rx, ry, fill, stroke) {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.4; c.stroke(); }
  }
  function line(c, x, y, ex, ey, color = BONE, width = 1.5) {
    c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }
  function arc(c, x, y, r, a, b, color, width = 1.5) {
    c.beginPath(); c.arc(x, y, r, a, b); c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }
  function plate(c, x, y, w, h, fill = METAL) {
    path(c, [[x+4,y],[x+w-4,y],[x+w,y+4],[x+w,y+h-4],[x+w-4,y+h],[x+4,y+h],[x,y+h-4],[x,y+4]], fill);
    line(c, x+4, y+1, x+w-4, y+1, '#9aa3a5', 1);
  }
  function eye(c, x, y, r, color) {
    path(c, [[x-r,y],[x-r*.35,y-r*.6],[x+r*.45,y-r*.5],[x+r,y],[x+r*.3,y+r*.55],[x-r*.45,y+r*.45]], BONE);
    oval(c, x, y, r*.35, r*.58, color, INK); line(c,x,y-r*.32,x,y+r*.32,INK,1.5);
  }
  function mask(c, x, y, r, color, long = false) {
    path(c, [[x-r,y-r*.65],[x-r*.45,y-r],[x+r*.6,y-r],[x+r,y-r*.4],[x+r*.65,y+r*.65],[x,y+r*(long?1.5:1)],[x-r*.75,y+r*.5]], BONE);
    line(c,x-r*.6,y-r*.12,x-r*.12,y+r*.03,INK,2.7);
    line(c,x+r*.12,y+r*.03,x+r*.6,y-r*.12,INK,2.7);
    oval(c,x-r*.33,y-r*.03,1.2,1.2,color); oval(c,x+r*.33,y-r*.03,1.2,1.2,color);
    line(c,x+1,y-r*.8,x-r*.1,y-r*.15,'#857d7a',1);
    line(c,x-r*.1,y-r*.15,x+r*.3,y+r*.58,'#857d7a',1);
  }
  function cloak(c, color, width = 22, length = 29) {
    path(c, [[-width,24],[-width*.7,-12],[-8,-29],[9,-30],[width*.8,-12],[width,length],[11,length-5],[3,length],[0,length-7],[-10,length-1]], color);
    path(c, [[-7,-22],[-13,21],[-3,17],[3,25],[9,-20]], mix(color,INK,.35), null);
    line(c,-width*.7,-8,-width+3,19,mix(color,BONE,.35),1);
  }
  function legs(c, n, color, spread = 33) {
    for (let i=0;i<n;i++) for (const s of [-1,1]) {
      const y=-13+i*11;
      line(c,s*11,y,s*spread,y-9,color,3); line(c,s*spread,y-9,s*(spread+5),y+8,INK,4);
      line(c,s*spread,y-9,s*(spread+5),y+8,color,1.7);
    }
  }
  function wings(c, color, owl = false) {
    for (const s of [-1,1]) path(c, [[s*7,-12],[s*25,-29],[s*44,-17],[s*34,-4],[s*39,10],[s*24,5],[s*21,18],[s*11,11]], color);
    for (const s of [-1,1]) for(let i=0;i<3;i++) line(c,s*12,-10,s*(25+i*5),-14+i*7,owl?BONE:mix(color,BONE,.4),1);
  }
  function horns(c, color, height = 36) {
    for(const s of [-1,1]) path(c, [[s*8,-20],[s*16,-height],[s*24,-height-2],[s*17,-height+11],[s*20,-17]],color);
  }
  function body(c, id, color, phase) {
    const skin = mix(color,'#34404c',.58), light = mix(color,BONE,.42), deep = mix(color,INK,.62);
    c.lineJoin='round'; c.lineCap='round';
    switch(id) {
      case 'grunt': cloak(c,skin,20,26);mask(c,0,-8,12,color,true);line(c,-12,18,-20,26,light,2);break;
      case 'sprinter':
        path(c,[[-33,6],[-22,-13],[4,-20],[27,-10],[36,0],[19,6],[11,22],[-2,14],[-23,20]],skin);
        for(const x of [-18,0,15])path(c,[[x,5],[x+11,9],[x-1,30],[x-7,28]],deep);
        path(c,[[12,-14],[18,-31],[24,-17],[35,-10],[35,0],[19,5]],light);eye(c,24,-8,6,color);break;
      case 'brute':
        for(const s of [-1,1]){plate(c,s<0?-35:18,-16,18,39,deep);plate(c,s<0?-25:8,17,17,16,skin);}
        plate(c,-23,-20,46,45,skin);plate(c,-14,-29,28,23,light);line(c,-10,-17,10,-17,color,4);line(c,-5,-4,-5,18,BONE);line(c,5,-4,5,18,BONE);break;
      case 'phantom': case 'wraith':
        path(c,[[-28,29],[-19,0],[-23,-12],[-10,-32],[11,-34],[23,-15],[19,6],[29,31],[11,22],[7,37],[-4,24],[-15,32]],deep);
        path(c,[[-12,-23],[-15,16],[-4,9],[4,27],[11,10],[12,-20]],skin,null);mask(c,0,-13,id==='wraith'?8:13,light,true);
        if(id==='wraith')for(const x of [-23,19])line(c,x,-2,x*1.45,26,light,2);break;
      case 'bomber':
        line(c,-8,-26,-8,-35,light,3);arc(c,0,-28,10,Math.PI,TAU,light,2);plate(c,-22,-21,44,48,deep);
        oval(c,0,2,15,19,color,light);for(const x of [-16,-7,7,16])line(c,x,-18,x,24,METAL,3);
        path(c,[[-6,4],[0,-12],[8,5],[0,15]],BONE,null);break;
      case 'healer':
        for(let i=0;i<6;i++){c.save();c.rotate(i*TAU/6);path(c,[[9,-6],[29,-11],[34,0],[25,10],[9,6]],skin);c.restore();}
        oval(c,0,0,17,21,deep,light);eye(c,0,-2,12,color);line(c,-4,14,4,14,light,2);break;
      case 'splitter': case 'weaver':
        legs(c,id==='weaver'?4:3,light,33);oval(c,0,11,id==='weaver'?18:22,20,skin,light);
        if(id==='weaver'){path(c,[[0,-30],[17,-8],[0,13],[-17,-8]],BONE);for(const x of [-8,0,8])line(c,x,-12,x,9,deep);}
        else {mask(c,-8,-13,10,color);mask(c,9,-10,10,color);line(c,0,-8,0,26,INK,2);}break;
      case 'bulwark':
        cloak(c,deep,24,28);mask(c,9,-20,9,color);path(c,[[-32,-18],[-7,-28],[17,-17],[14,18],[-8,33],[-30,18]],skin);
        path(c,[[-24,-13],[-9,-19],[8,-12],[6,13],[-8,23],[-23,13]],deep,light);line(c,-20,-3,2,-3,color,3);break;
      case 'flier': case 'owl':
        wings(c,skin,id==='owl');oval(c,0,2,id==='owl'?15:10,25,deep,light);
        if(id==='owl'){path(c,[[-17,-26],[-9,-17],[9,-17],[17,-26],[14,3],[0,13],[-14,3]],light);eye(c,-7,-7,6,color);eye(c,7,-7,6,color);path(c,[[-3,0],[3,0],[0,7]],'#b5a078');}
        else {horns(c,light,27);mask(c,0,-11,9,color);path(c,[[-6,22],[0,35],[6,22]],skin);}break;
      case 'summoner': case 'necromancer':
        cloak(c,deep,id==='necromancer'?24:20,32);mask(c,-3,-13,10,color,true);
        line(c,26,-35,22,34,BONE,3);arc(c,27,-28,10,-2.8,2.8,light,2);oval(c,27,-28,4,5,color);
        if(id==='necromancer'){for(let i=0;i<4;i++)line(c,-11,-1+i*6,7,1+i*6,BONE,1.8);horns(c,BONE,34);}
        else for(const [x,y]of [[-28,-20],[-29,8],[13,-34]])path(c,[[x,y-5],[x+4,y],[x,y+5],[x-4,y]],color,light);break;
      case 'berserker':
        path(c,[[-34,24],[-31,-6],[-19,-21],[18,-22],[32,-3],[35,28],[20,17],[10,27],[-12,26],[-22,15]],skin);
        for(const s of [-1,1])for(let i=0;i<3;i++)line(c,s*(27+i*3),9,s*(29+i*3),30,light,2);
        horns(c,BONE);mask(c,0,-11,13,color);path(c,[[-7,5],[0,17],[7,5]],color);break;
      case 'vampire':
        path(c,[[-35,-27],[-22,-4],[-31,29],[0,19],[32,29],[21,-3],[35,-27],[9,-13],[-9,-13]],deep,light);
        mask(c,0,-12,11,color,true);for(const x of [-5,5])path(c,[[x-2,0],[x+2,0],[x,10]],BONE);oval(c,0,12,4,6,color);break;
      case 'reflector':
        path(c,[[0,-35],[26,-23],[31,14],[0,34],[-30,16],[-25,-21]],'#697986',light);
        path(c,[[0,-27],[18,-17],[22,11],[0,25],[-21,12],[-18,-15]],'#b2c3ca',BONE);
        path(c,[[0,-27],[-18,-15],[-10,15],[0,25],[2,-5]],'#5c7183',null);line(c,-16,-15,17,10,'#eef0de',2);eye(c,2,-1,8,'#9a7fa6');break;
      case 'thief':
        oval(c,-8,9,23,23,deep,light);path(c,[[-18,-18],[4,-30],[25,-14],[20,16],[5,22],[-7,10]],skin);
        mask(c,12,-7,10,color,true);line(c,-21,10,-35,23,BONE,3);oval(c,-26,-8,8,10,'#bba477',INK);line(c,-26,-13,-26,-3,deep,2);break;
      case 'chronos':
        plate(c,-23,-31,46,8,skin);plate(c,-23,24,46,8,skin);
        path(c,[[-17,-23],[17,-23],[6,-2],[17,23],[-17,23],[-6,-2]],'#677584',light);
        path(c,[[-13,-18],[13,-18],[0,0]],color,null);path(c,[[-12,20],[0,8],[12,20]],BONE,null);
        for(const s of [-1,1])line(c,s*22,-22,s*22,23,light,3);eye(c,0,0,7,color);break;
      case 'nullifier':
        for(let i=0;i<7;i++){c.save();c.rotate(i*TAU/7);path(c,[[18,-9],[31,-12],[36,0],[28,12],[17,8]],skin,light);c.restore();}
        oval(c,0,0,19,23,INK,light);line(c,-15,19,16,-20,color,4);break;
      case 'colossus':
        for(const s of [-1,1]){plate(c,s<0?-37:20,-12,17,42,skin);plate(c,s<0?-23:6,19,17,20,deep);}
        plate(c,-25,-27,50,50,'#6f7574');plate(c,-16,-36,32,25,light);line(c,-9,-23,9,-23,color,4);
        for(let i=0;i<3;i++)plate(c,-15,-4+i*9,30,6,deep);line(c,-17,-12,-6,15,'#c4c0a9');break;
      case 'saboteur':
        legs(c,2,light,28);plate(c,-21,-17,42,38,skin);mask(c,0,-14,10,color);
        for(const s of [-1,1]){line(c,s*17,-4,s*33,-27,BONE,4);line(c,s*33,-27,s*39,-24,light,2);line(c,s*33,-27,s*29,-36,light,2);}break;
      case 'adaptive':
        for(let i=0;i<7;i++){const a=i*TAU/7;path(c,[[0,0],[Math.cos(a)*31,Math.sin(a)*31],[Math.cos(a+.7)*22,Math.sin(a+.7)*22]],i%2?deep:skin,light);}
        eye(c,0,-2,14,color);path(c,[[-12,16],[0,32],[11,17]],light);break;
      case 'brood':
        legs(c,3,light,32);oval(c,0,10,26,26,skin,light);oval(c,0,-17,13,13,deep,light);
        for(const [x,y]of [[-13,4],[8,-1],[0,15],[14,19],[-13,22]])oval(c,x,y,7,9,mix(color,BONE,.55),INK);eye(c,0,-18,9,color);break;
      case 'digger':
        oval(c,0,10,27,18,deep);for(let i=0;i<5;i++)path(c,[[-25+i*11,5],[-18+i*10,-25],[-8+i*10,6]],skin,light);
        path(c,[[14,-8],[36,2],[16,15]],BONE);line(c,22,-2,20,10,deep);eye(c,8,-3,6,color);break;
      case 'emp':
        plate(c,-18,-10,36,36,skin);oval(c,0,-15,14,17,deep,light);eye(c,0,-15,10,color);
        for(const s of [-1,1]){line(c,s*12,-24,s*27,-35,light,2);oval(c,s*27,-35,4,4,color);arc(c,s*24,5,11,-2,1.8,light,2);}break;
      case 'mimic':
        cloak(c,deep,28,28);mask(c,-11,-7,16,color);c.save();c.rotate(.3);mask(c,13,0,15,mix(color,BONE,.6),true);c.restore();
        path(c,[[-10,13],[0,30],[12,12]],skin);break;
      case 'juggernaut':
        for(const s of [-1,1]){plate(c,s<0?-36:19,-18,17,49,deep);for(let i=0;i<6;i++)line(c,s*21,-12+i*7,s*33,-12+i*7,light,2);}
        plate(c,-24,-22,48,45,skin);plate(c,-16,-31,32,20,METAL);line(c,-10,-21,10,-21,color,5);
        for(let i=0;i<3;i++)line(c,-13,1+i*5,13,1+i*5,INK,2);break;
      case 'swarm':
        for(const [x,y,r]of [[-16,-9,11],[15,-3,12],[0,15,13]]){oval(c,x,y,r,r*1.2,skin,light);eye(c,x,y-3,r*.65,color);line(c,x-r,y+4,x-r-5,y+9,light);line(c,x+r,y+4,x+r+5,y+9,light);}break;
      case 'leech':
        for(let i=5;i>=0;i--)oval(c,Math.sin(i*.8)*13,i*9-23,13-i,11-i*.5,i%2?skin:deep,light);
        oval(c,0,-24,13,11,INK,light);for(let i=0;i<5;i++){const a=i*TAU/5;path(c,[[Math.cos(a)*12,Math.sin(a)*10-24],[Math.cos(a+.2)*5,Math.sin(a+.2)*4-24],[Math.cos(a+.5)*12,Math.sin(a+.5)*10-24]],BONE);}break;
      case 'warden':
        path(c,[[0,-36],[27,-14],[25,21],[0,36],[-25,21],[-27,-14]],deep,light);eye(c,0,-4,23,color);
        for(const s of [-1,1])path(c,[[s*24,-13],[s*38,0],[s*25,26],[s*16,18]],skin,light);break;
      case 'reaper':
        cloak(c,deep,22,34);mask(c,-3,-14,9,color,true);line(c,20,-30,26,35,BONE,3);
        path(c,[[20,-31],[4,-37],[-20,-31],[-35,-14],[-20,-20],[3,-21],[22,-23]],light);line(c,-8,12,13,7,color,2);break;
      case 'frostbane':
        path(c,[[-34,10],[-25,-6],[-5,-12],[14,-26],[27,-15],[38,-4],[26,7],[15,12],[8,30],[0,17],[-17,26],[-24,15]],skin,light);
        for(const x of [-20,-9,1])path(c,[[x,-7],[x+5,-28],[x+11,-9]],BONE);eye(c,21,-8,7,color);path(c,[[24,4],[29,4],[26,14]],BONE);break;
      case 'rustbug':
        legs(c,3,'#b59e6a',31);for(let i=0;i<8;i++){c.save();c.rotate(i*TAU/8);plate(c,19,-5,12,10,skin);c.restore();}
        oval(c,0,0,25,27,deep,light);plate(c,-16,-18,32,38,skin);eye(c,0,-7,11,color);line(c,-9,9,9,9,BONE,2);break;
      case 'echo':
        path(c,[[-23,-21],[0,-32],[25,-18],[32,12],[9,31],[-22,25]],skin,light);
        for(let i=0;i<4;i++)oval(c,0,-6+i*7,19-i*2,7,deep,light);eye(c,0,-17,9,color);break;
      case 'lord': case 'boss':
        cloak(c,deep,35,42);horns(c,light,48);mask(c,0,-8,20,color,true);
        path(c,[[-18,-26],[-20,-44],[-8,-34],[0,-47],[9,-34],[23,-44],[18,-24]],'#b39a70');
        for(const s of [-1,1])path(c,[[s*25,-9],[s*48,9],[s*43,33],[s*32,19],[s*21,27]],skin,light);eye(c,0,17,10,color);break;
      case 'abyss':
        for(let i=0;i<8;i++){const a=i*TAU/8;c.save();c.rotate(a);path(c,[[16,-9],[35,-16],[51,-7],[42,3],[53,13],[37,9],[24,13]],skin,light);c.restore();}
        oval(c,0,0,29,33,deep,light);oval(c,0,0,20,27,INK);
        for(let i=0;i<10;i++){const a=i*TAU/10;path(c,[[Math.cos(a)*23,Math.sin(a)*27],[Math.cos(a+.2)*11,Math.sin(a+.2)*16],[Math.cos(a+.4)*23,Math.sin(a+.4)*27]],BONE);}eye(c,0,-23,7,color);break;
      case 'machine':
        for(let i=0;i<3;i++){c.save();c.rotate(i*TAU/3);plate(c,19,-13,32,26,skin);plate(c,40,-18,13,36,deep);line(c,43,-10,43,10,color,3);c.restore();}
        oval(c,0,0,30,30,METAL,light);oval(c,0,0,22,22,INK,light);eye(c,0,0,19,color);break;
      case 'void':
        for(const s of [-1,1])path(c,[[s*6,-43],[s*35,-31],[s*46,-3],[s*34,28],[s*11,44],[s*24,14],[s*19,-10]],skin,light);
        cloak(c,INK,19,28);mask(c,0,-4,12,'#b39ccd',true);for(const [x,y]of [[-40,33],[38,-37],[-16,-46]])path(c,[[x,y-8],[x+5,y],[x,y+9],[x-5,y]],light);break;
      case 'final':
        for(let i=0;i<12;i++){c.save();c.rotate(i*TAU/12);path(c,[[31,-3],[48,-5],[55,0],[48,5],[31,3]],i%3?'#7e5961':'#c2a16e',light,1);c.restore();}
        cloak(c,deep,31,43);horns(c,BONE,48);oval(c,0,-1,34,28,skin,light);eye(c,0,-1,28,color);
        for(const s of [-1,1]){line(c,s*22,25,s*37,39,BONE,3);line(c,s*37,39,s*43,26,BONE,2);}break;
      default: cloak(c,skin);mask(c,0,-8,12,color);
    }
    if(phase>0){
      for(let i=0;i<phase+1;i++){const a=-Math.PI/2+i*TAU/(phase+1);path(c,[[Math.cos(a)*30,Math.sin(a)*30],[Math.cos(a)*40-3,Math.sin(a)*40],[Math.cos(a)*40+3,Math.sin(a)*40]],'#e4cda0',INK,1);}
      line(c,-7,9,0,3,color,2);line(c,0,3,5,19,BONE,1.5);
    }
  }
  function sprite(id, color, phase = 0) {
    const key=id+'|'+color+'|'+phase;
    if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
    const boss=['lord','boss','abyss','machine','void','final'].includes(id), size=boss?160:112;
    const image=document.createElement('canvas');image.width=image.height=size;
    const c=image.getContext('2d');c.translate(size/2,size/2);body(c,id,color,phase);
    const hit=document.createElement('canvas');hit.width=hit.height=size;
    const h=hit.getContext('2d');h.drawImage(image,0,0);h.globalCompositeOperation='source-in';h.fillStyle='#e8e5d4';h.fillRect(0,0,size,size);
    const item={image,hit,size,bytes:size*size*8};
    while(cache.size && (cache.size>=LIMIT || bytes+item.bytes>8e6)){const first=cache.keys().next().value;bytes-=cache.get(first).bytes;cache.delete(first);}
    cache.set(key,item);bytes+=item.bytes;builds++;return item;
  }
  function mark(c, key, x, y, size = 7, color = '#d0b87c') {
    c.save();c.translate(x,y);c.scale(size/8,size/8);c.lineJoin='round';c.lineCap='round';
    switch(key){
      case 'tough':path(c,[[-6,-6],[6,-6],[6,5],[0,9],[-6,5]],null,color,2);line(c,-3,0,3,0,color,2);break;
      case 'swift':path(c,[[-2,-8],[6,-8],[0,0],[5,0],[-5,9],[-1,2],[-6,2]],color,null);break;
      case 'shielded':path(c,[[0,-8],[7,-5],[5,4],[0,9],[-5,4],[-7,-5]],null,color,2);break;
      case 'resist':for(let i=0;i<3;i++)arc(c,0,0,3+i*3,-2.3,1,color,1.4);break;
      case 'vamp':path(c,[[0,-9],[6,1],[4,7],[-4,7],[-6,1]],color);break;
      case 'frenzy':path(c,[[-7,6],[-4,-7],[0,-1],[5,-9],[8,6]],null,color,2);break;
      case 'splitter':line(c,-5,-7,-5,7,color,2);line(c,5,-7,5,7,color,2);line(c,-8,0,8,0,color);break;
      case 'deadly':oval(c,0,1,6,6,color);line(c,0,-5,4,-9,color,2);break;
      case 'regen':line(c,-7,0,7,0,color,3);line(c,0,-7,0,7,color,3);break;
      case 'armored':plate(c,-7,-7,14,14,color);line(c,-3,-3,3,3,INK,2);break;
      case 'burn':path(c,[[-6,5],[-4,-3],[0,0],[2,-9],[7,2],[4,8],[-3,8]],color);break;
      case 'poison':oval(c,-3,0,4,6,color);oval(c,3,0,4,6,color);line(c,-3,7,3,7,color,2);break;
      case 'vuln':path(c,[[0,-8],[7,0],[0,8],[-7,0]],null,color,2);line(c,-3,0,3,0,color);break;
      default:eye(c,0,0,7,color);
    }c.restore();
  }
  function draw(c,e,time,dt,options={}) {
    const id=e.boss?e.bossKey||'lord':e.type, col=e.def.color||'#b28dff', texture=sprite(id,col,e.boss?e.phase||0:0);
    const motion=options.motion!==false, moving=motion && !options.frozen && !(e.stun>0) && (e.state==='walk'||e.state==='room');
    const pulse=moving?Math.sin(time*(e.def.flying?7:8)+(e.wob||0)):0;
    const bob=pulse*(e.def.flying?3.5:1.3), scale=e.r/32;
    c.save();c.globalAlpha=Number.isFinite(e.alpha)?e.alpha:1;
    oval(c,e.x,e.y+e.r*.8,e.r*.8,e.r*.22,'rgba(3,10,16,.46)');
    c.translate(e.x,e.y+bob);c.scale(scale,scale);c.rotate(moving?pulse*.025:0);
    if(e.def.flying && moving){c.save();c.scale(1+Math.sin(time*10)*.035,1);c.drawImage(texture.image,-texture.size/2,-texture.size/2);c.restore();}
    else c.drawImage(texture.image,-texture.size/2,-texture.size/2);
    if(e.hitFlash>0 && options.flash!==0){c.globalAlpha*=Math.min(.65,e.hitFlash*4)*(options.flash==null?1:options.flash);c.drawImage(texture.hit,-texture.size/2,-texture.size/2);}
    c.restore();
  }
  function observe(c,enemies,time,dt,options={}) {
    if(gameRef!==options.game){active.clear();deaths.length=0;gameRef=options.game;}
    for(const state of active.values())state.seen=false;
    for(const e of enemies){if(e.dead)continue;const state=active.get(e)||{};Object.assign(state,{seen:true,x:e.x,y:e.y,r:e.r,type:e.type,boss:e.boss,bossKey:e.bossKey,phase:e.phase,def:e.def,alpha:e.alpha});active.set(e,state);}
    for(const [entity,state]of active)if(!state.seen){if(entity.dead && deaths.length<40)deaths.push({...state,life:.4});active.delete(entity);}
    for(let i=deaths.length-1;i>=0;i--){const d=deaths[i];d.life-=dt;if(d.life<=0){deaths.splice(i,1);continue;}
      const p=d.life/.4;c.save();c.translate(d.x,d.y);if(options.motion!==false)c.scale(1+(1-p)*.15,p*.5+.5);draw(c,{...d,x:0,y:0,alpha:p*.45,hitFlash:0},time,dt,{motion:false});c.restore();}
  }
  function preview(c,id,x,y,r=27,phase=0){const def=BOSS_DEFS[id]||ENEMY_DEFS[id]||ENEMY_DEFS.grunt;draw(c,{type:id,boss:!!BOSS_DEFS[id],bossKey:id,def,x,y,r,phase,alpha:1,hitFlash:0,state:'idle'},0,0,{motion:false});}
  return {draw,observe,mark,preview,stats:()=>({entries:cache.size,bytes,builds,limit:LIMIT,deaths:deaths.length,observed:active.size})};
})();
