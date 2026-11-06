const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let T = 0;
// 渲染帧时长：闪光/震屏/开火余晖等视觉衰减按真实帧时长推进，
// 否则 30Hz 屏会拖长一倍、144Hz 屏会快进 2.4 倍（模拟层已是固定步长，只有视觉层受影响）
let _frameDt = 1 / 60;
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
/** 同 rr，但不 beginPath：把多个圆角矩形并进同一条 path，批量填充/描边省每格的路径开销 */
function rrAdd(x, y, w, h, r) {
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function bar(x, y, w, h, p, c1, c2) {
  p = clamp(p, 0, 1);
  // 背景（带圆角）
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  rr(x - 1, y - 1, w + 2, h + 2, 3); ctx.fill();
  // 主体（渐变填充）
  if (p > 0) {
    const barGrad = ctx.createLinearGradient(x, y, x, y + h);
    barGrad.addColorStop(0, c1);
    barGrad.addColorStop(1, c2 || c1);
    ctx.fillStyle = barGrad;
    rr(x, y, w * p, h, 2); ctx.fill();
    // 高光条
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    rr(x, y, w * p, h / 2, 2); ctx.fill();
    // 末端发光点
    if (p > 0.05) {
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.beginPath(); ctx.arc(x + w * p - 1, y + h / 2, 2, 0, 6.2832); ctx.fill();
    }
  }
}
function emoji(e, x, y, size, alpha = 1, rot = 0) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ctx.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e, 0, 0); ctx.restore();
}
function visualRand(a,b,seed) { return a+(b-a)*SceneArt.noise(seed+(T*60|0)*37.3); }
function render(frameDt) {
  _frameDt = (typeof frameDt === 'number' && isFinite(frameDt) && frameDt > 0) ? Math.min(frameDt, 0.25) : 1 / 60;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0.4) { ctx.translate(visualRand(-shake,shake,0)*.5,visualRand(-shake,shake,1)*.5); shake *= Math.pow(0.86, _frameDt * 60); } else shake = 0;
  drawBg(); drawCorridors(); drawRoom(); drawRemains(); drawBuildings(); drawBed();
  drawEnemyCasts(); drawEnemies(); drawWallsDoors(); drawBullets(); drawEffects(); drawParts(); drawTexts();
  // 战斗氛围粒子（波次中飘浮火星）
  if (G.state === 'wave') {
    ctx.save();
    for (let i = 0; i < 15; i++) {
      const px = (i * 311 + T * (12 + i * 5)) % W;
      const py = (i * 197 + Math.sin(T * 0.8 + i * 2.3) * 40) % H;
      const a = 0.15 + Math.sin(T * 2.5 + i * 1.8) * 0.1;
      const sz = 1 + Math.sin(T * 3 + i) * 0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = i % 3 === 0 ? '#ff8c42' : (i % 3 === 1 ? '#ff4d6d' : '#c77dff');
      ctx.beginPath(); ctx.arc(px, py, sz, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }
  drawCursor();

  // 升级光环爆发特效（增强版）
  if (G.upgradeFx) {
    G.upgradeFx.forEach(f => {
      f.t -= _frameDt;
      const p = 1 - f.t / 0.8;
      const r = 15 + p * 50;
      // 外圈
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,215,0,' + (0.8 * (1 - p)) + ')';
      ctx.lineWidth = 4 - p * 3;
      ctx.stroke();
      // 内圈
      ctx.beginPath();
      ctx.arc(f.x, f.y, r * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,200,' + (0.5 * (1 - p)) + ')';
      ctx.lineWidth = 2 - p * 1.5;
      ctx.stroke();
      // 核心光晕
      ctx.save();
      ctx.globalAlpha = 0.4 * (1 - p);
      const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 0.4);
      glow.addColorStop(0, 'rgba(255,215,0,.6)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.4, 0, 6.2832); ctx.fill();
      ctx.restore();
    });
    G.upgradeFx = G.upgradeFx.filter(f => f.t > 0);
  }

  ctx.restore();
  if (flash > 0) {
    const flashMul = typeof Accessibility !== 'undefined' ? Accessibility.flashMul() : 1;
    ctx.fillStyle = 'rgba(255,60,80,' + (flash * 0.35 * flashMul) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,40,60,' + (flash * 0.25 * flashMul) + ')';
    ctx.fillRect(0, 0, W, H);
    flash -= _frameDt * 2.1;
  }
  if (G.buff.freeze > 0) {
    // 冰冻全屏效果
    ctx.fillStyle = 'rgba(120,200,255,.08)';
    ctx.fillRect(0, 0, W, H);
    // 冰晶边框
    ctx.strokeStyle = 'rgba(120,200,255,' + (0.15 + Math.sin(T * 3) * 0.08) + ')';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
  }
  drawEventBanner();
  drawTipBar();
  drawWaveTransition();
  // === 梦境系统渲染 ===
  drawDreamSystems();
  // 战斗暗角（波次中增强氛围）
  if (G.state === 'wave') {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, 0, W, H);
  }
}
// === 梦境系统渲染 ===
function drawDreamSystems() {
  if (typeof DreamEngine === 'undefined' || !DreamEngine._initialized) return;
  // 旧版这里每帧调 getSnapshot() 却不使用结果，白白制造 GC 压力（已删除）

  // 1. 中立生物绘制
  if (typeof NeutralCreatures !== 'undefined') {
    const creatures = NeutralCreatures.getCreatures();
    for (const c of creatures) {
      ctx.save();
      // 浮动动画
      const bobY = Math.sin(c.bobPhase) * 4;
      const pulse = 0.9 + Math.sin(T * 3 + c.bobPhase) * 0.1;
      // 光晕
      const glowR = c.def.firefly ? 28 : 22;
      const grad = ctx.createRadialGradient(c.x, c.y + bobY, 0, c.x, c.y + bobY, glowR);
      grad.addColorStop(0, c.def.color + '40');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(c.x, c.y + bobY, glowR, 0, 6.2832); ctx.fill();
      // 图标
      ctx.font = (18 * pulse) + 'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.def.icon, c.x, c.y + bobY);
      // 名字
      ctx.font = '9px "Courier New"';
      ctx.fillStyle = c.def.color;
      ctx.fillText(c.def.name, c.x, c.y + bobY + 16);
      // 影子猫偷金币指示
      if (c.type === 'shadowCat' && c.stealAccum > 0) {
        ctx.font = '8px monospace';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('-' + Math.floor(c.stealAccum) + '💰', c.x, c.y + bobY - 16);
      }
      ctx.restore();
    }
  }

  // 2. 生态效果连线（精英光环）
  if (typeof DreamEcology !== 'undefined' && G.state === 'wave') {
    for (const e of G.enemies) {
      if (e.dead || !e.elite) continue;
      // 精英光环
      ctx.save();
      ctx.strokeStyle = 'rgba(168,85,247,.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.arc(e.x, e.y, 200, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // 3. 深层梦境滤镜
  if (typeof DeepDream !== 'undefined' && DeepDream.isActive()) {
    const level = DeepDream.getCurrentLevel() || {};   // 判空：拿不到关卡定义时滤镜照画，不许抛错打断整帧
    // 紫色暗角
    ctx.save();
    const vign = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.7);
    vign.addColorStop(0, 'transparent');
    vign.addColorStop(1, 'rgba(80,20,160,.2)');
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, W, H);
    // 顶部标签
    ctx.font = 'bold 12px "Courier New"';
    ctx.fillStyle = '#c084fc';
    ctx.textAlign = 'center';
    ctx.fillText((level.icon || '🕳️') + ' ' + (level.name || '深层梦境') + '  —  ' + (level.desc || ''), W / 2, 70);
    ctx.restore();
  }

  // 4. NPC 驻守指示（小图标显示在房间上方）
  if (typeof NPCGuardians !== 'undefined') {
    const recruited = NPCGuardians.getRecruited();
    for (const npc of recruited) {
      if (!npc.active || !npc.def) continue;
      const laneIdx = parseInt((npc.roomId || '').replace('lane_', ''), 10);
      if (isNaN(laneIdx)) continue;
      ctx.save();
      ctx.font = '14px serif';
      ctx.textAlign = 'left';
      ctx.fillText(npc.def.icon, ROOM_X0 + 4, ARENA_TOP + laneIdx * ((ARENA_BOT - ARENA_TOP) / 3) + 14);
      ctx.restore();
    }
  }
}

function drawBg() { SceneArt.drawBase(ctx); }
function sceneMotion() { return Accessibility.flash === 'normal' && Accessibility.shake === 'normal'; }
function drawCorridors() { SceneArt.drawWeather(ctx,T,sceneMotion()); }
function drawRemains() {
  ctx.save();
  for(const c of G.corpses || []) {
    ctx.globalAlpha=Math.min(1,c.life/3)*(c.claimed ? .55 : .22);
    ctx.strokeStyle=c.claimed?'#ba9fcd':'#87959b';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.ellipse(c.x,c.y,9,4,0,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(c.x-4,c.y-3);ctx.lineTo(c.x+3,c.y+2);ctx.moveTo(c.x+4,c.y-3);ctx.lineTo(c.x-3,c.y+2);ctx.stroke();
  }
  ctx.restore();
}
function drawEnemyCasts() {
  ctx.save();ctx.lineWidth=1.2;
  for(const e of G.enemies) {
    const cue=enemyCastCue(e);if(!cue)continue;
    ctx.strokeStyle=cue.color;ctx.globalAlpha=.65;ctx.setLineDash([3,4]);
    if(e.raiseCast)for(const c of e.raiseCast.corpses) {ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(c.x,c.y);ctx.stroke();}
    if(e.parasiteTarget) {
      const t=e.parasiteTarget;ctx.setLineDash(e.parasiteWindup>0?[3,4]:[]);
      ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.quadraticCurveTo((e.x+t.x)/2,(e.y+t.y)/2-12,t.x,t.y);ctx.stroke();
      ctx.strokeRect(t.x-13,t.y-13,26,26);
    }
    if(cue.range) {
      ctx.globalAlpha=.28;ctx.beginPath();ctx.arc(e.x,e.y,cue.range,-.3,.3);ctx.stroke();
    }
    ctx.globalAlpha=1;ctx.setLineDash([]);
    bar(e.x-23,e.y-e.r-18,46,3,1-cue.left/cue.total,cue.color);
    ctx.font='9px sans-serif';ctx.fillStyle=cue.color;ctx.textAlign='center';ctx.fillText(cue.label+' '+Math.max(0,cue.left).toFixed(1)+'s',e.x,e.y-e.r-23);
  }
  ctx.restore();
}
function drawRoom() {
  if (selectedBuildKey) {
    const pulse = 0.5 + Math.sin(T * 3.2) * 0.5;
    const isTower = !!(BUILD_DEFS[selectedBuildKey] && BUILD_DEFS[selectedBuildKey].tower);
    const rgb = isTower ? '255,190,80' : '158,240,26';
    // 圆角柔光格：填充淡染 + 发光描边 + 圆头十字，去掉直角硬边的「表格感」。
    // 同色样式全格一致，合并成 3 条 path 批量画（原先每格 3 条 path + save/restore + shadowBlur，
    // 40 个空位就是 120 条路径）；save/restore 包住整段，lineCap/shadowBlur 一定还原。
    const cells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (G.grid[r * COLS + c] || inBed(c, r)) continue;
      cells.push(cellRect(c, r));
    }
    if (cells.length) {
      ctx.save();
      ctx.fillStyle = 'rgba(' + rgb + ',' + (0.05 + pulse * 0.06) + ')';
      ctx.beginPath();
      for (const R of cells) rrAdd(R.x + 3, R.y + 3, R.w - 6, R.h - 6, 9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.38 + pulse * 0.34) + ')';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = 'rgba(' + rgb + ',.5)';
      ctx.shadowBlur = 7;
      ctx.beginPath();
      for (const R of cells) rrAdd(R.x + 4, R.y + 4, R.w - 8, R.h - 8, 8);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.55 + pulse * 0.35) + ')';
      ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const R of cells) {
        const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
        ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
        ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
  if (hoverCell && !G.grid[hoverCell.r * COLS + hoverCell.c] && !inBed(hoverCell.c, hoverCell.r)) {
    const R = cellRect(hoverCell.c, hoverCell.r);
    const x = R.x + 2, y = R.y + 2, w = R.w - 4, h = R.h - 4;
    ctx.fillStyle = selectedBuildKey ? 'rgba(120,255,170,.18)' : 'rgba(255,255,255,.05)';
    rr(x, y, w, h, 9); ctx.fill();
    ctx.save();
    ctx.strokeStyle = selectedBuildKey ? 'rgba(180,255,120,.9)' : 'rgba(255,255,255,.24)';
    ctx.lineWidth = 2;
    if (selectedBuildKey) { ctx.shadowColor = 'rgba(160,255,120,.45)'; ctx.shadowBlur = 8; }
    rr(x, y, w, h, 9); ctx.stroke();
    ctx.restore();
  }
  if (selected && selected.def) {
    const R = cellRect(selected.col, selected.row);
    // 选中高亮框（脉动）
    const selPulse = 0.7 + Math.sin(T * 5) * 0.3;
    ctx.strokeStyle = 'rgba(255,224,102,' + selPulse + ')';
    ctx.lineWidth = 2.5; ctx.strokeRect(R.x + 2, R.y + 2, R.w - 4, R.h - 4);
    const s = bstat(selected);
    const range=s.range || s.zapRange || 0;
    if (range) {
      // 渐变填充范围
      ctx.beginPath(); ctx.arc(selected.x, selected.y, range, 0, 6.2832);
      const rangeGrad = ctx.createRadialGradient(selected.x, selected.y, 0, selected.x, selected.y, range);
      rangeGrad.addColorStop(0, 'rgba(255,224,102,.08)');
      rangeGrad.addColorStop(0.7, 'rgba(255,224,102,.03)');
      rangeGrad.addColorStop(1, 'rgba(255,224,102,.01)');
      ctx.fillStyle = rangeGrad; ctx.fill();
      // 动态虚线边框
      ctx.strokeStyle = 'rgba(255,224,102,.4)';
      ctx.setLineDash([6, 6]); ctx.lineDashOffset = -T * 20;
      ctx.lineWidth = 1.5; ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
  }
}
function drawWallsDoors() {
  for(const L of LANES) {
    const D=G.doors[L.i],broken=D.broken||D.hp<=0,p=clamp(D.hp/D.maxHp,0,1);
    SceneArt.drawDoor(ctx,L,D,T,_frameDt,sceneMotion());
    if(!broken) {
      bar(WALL_X-40,D.y-L.doorHalf-13,80,7,p,p>.5?'#8dc4b0':p>.25?'#e8bd70':'#f8758f');
      if(D.shield>0)bar(WALL_X-40,D.y-L.doorHalf-21,80,4,D.shield/(D.shieldMax||1),'#77cbd8');
    }
    ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#07131c';
    const label=broken?'通道已破 · '+doorName(D):doorName(D);
    ctx.strokeText(label,WALL_X,D.y+L.doorHalf+18);ctx.fillStyle=broken?'#f8758f':'#c6d0ca';
    ctx.fillText(label,WALL_X,D.y+L.doorHalf+18);
    if(!broken) {ctx.font='9px monospace';ctx.fillStyle='#cfb981';ctx.fillText('Lv.'+D.lv,WALL_X,D.y+L.doorHalf+29);}
    if(!broken && p<.3) {
      ctx.fillStyle='#f8758f';ctx.font='bold 10px sans-serif';ctx.fillText('危险',WALL_X,D.y-L.doorHalf-26);
    }
  }
}
/** 各炮塔的炮管/炮口造型 —— 让 10 种武器在战场上不用看名字也能一眼分辨 */
/* ==================================================================
 *  武器美术系统
 *  纯绘制层升级，不新增任何影响数值的状态（只有后座 recoil 一个纯视觉字段），
 *  所以平衡性零改动。
 *  性能关键：CanvasGradient 在「绘制那一刻」按当前 CTM 解析，因此所有渐变都能
 *  在局部坐标系（圆心/轴向 = 0,0）里建好后缓存复用。已用像素读回实测验证：
 *  同一个 gradient 在三个不同 translate 下，圆心与边缘颜色完全一致。
 *  于是 38 座炮塔每帧新增 0 个渐变对象，而不是 76 个。
 * ================================================================== */
const _rgbCache = new Map();
function hexRgb(hex) {
  let v = _rgbCache.get(hex);
  if (v) return v;
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16) || 0;
  v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  _rgbCache.set(hex, v);
  return v;
}
/** t > 0 向白提亮，t < 0 向黑压暗（t ∈ [-1,1]）。结果缓存：每帧被调用数百次，别反复拼字符串 */
const _shadeCache = new Map();
function shadeHex(hex, t) {
  const key = hex + '|' + ((t * 100) | 0);
  const hit = _shadeCache.get(key);
  if (hit) return hit;
  const c = hexRgb(hex);
  const f = v => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t));
  const out = 'rgb(' + f(c[0]) + ',' + f(c[1]) + ',' + f(c[2]) + ')';
  _shadeCache.set(key, out);
  return out;
}
const _gradCache = new Map();
function gradR(key, r1, stops) {
  let g = _gradCache.get(key);
  if (!g) {
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, r1);
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    _gradCache.set(key, g);
  }
  return g;
}
function gradL(key, x0, y0, x1, y1, stops) {
  let g = _gradCache.get(key);
  if (!g) {
    g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    _gradCache.set(key, g);
  }
  return g;
}
/** 圆角 + 描边的血条（比原来的纯色方块清楚很多） */
function gbar(x, y, w, h, p, color) {
  p = clamp(p, 0, 1);
  const r = h / 2;
  ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(x - 1, y - 1, w + 2, h + 2, r + 1); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(x, y, w, h, r); ctx.fill();
  if (p > 0) { ctx.fillStyle = color; rr(x, y, Math.max(h, w * p), h, r); ctx.fill(); }
}
// Cached device components, with labels and health information kept above them.
function drawBuildings() {
  for(const b of G.buildings) {
    const dt=_frameDt,R=cellRect(b.col,b.row),s=bstat(b);
    if(b.animY<0) {b.animY=Math.min(0,b.animY+300*dt);if(b.animY===0)b.animBounce=.3;}
    if(b.animBounce>0)b.animBounce=Math.max(0,b.animBounce-dt*3);
    if(b.fireFx>0)b.fireFx=Math.max(0,b.fireFx-dt);
    if(b.recoil>0)b.recoil=Math.max(0,b.recoil-dt*9);
    const scale=b.animBounce>0?1+.1*Math.sin(b.animBounce*10):1;
    ctx.save();ctx.translate(b.x,b.y+(b.animY||0));ctx.scale(scale,scale);ctx.translate(-b.x,-b.y);
    BuildingArt.draw(ctx,b,s,T,dt,{motion:sceneMotion(),selected:selected===b});
    const branch=b.branch && b.def.branch && b.def.branch[b.branch];
    const name=branch?branch.name:buildName(b);
    ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.strokeStyle='#08151f';ctx.lineWidth=2;
    ctx.strokeText(name,b.x,R.y+R.h-12);ctx.fillStyle=b.branch?'#e8c991':'#cbd4cf';ctx.fillText(name,b.x,R.y+R.h-12);
    ctx.font='8px monospace';ctx.fillStyle='#a7bbb5';ctx.fillText('Lv.'+b.level,b.x,R.y+R.h-2);
    if(b.hp<b.maxHp)gbar(b.x-27,R.y+4,54,4,b.hp/b.maxHp,b.hp/b.maxHp<.3?'#ee8192':'#9dc5ae');
    if(b.shield>0)gbar(b.x-27,R.y+10,54,2.5,b.shield/Math.max(1,b.shieldMax||b.maxHp),'#81c8d5');
    if(b.empT>0 || b.freezeT>0) {
      ctx.fillStyle='#1b3d50';rr(b.x-17,b.y-8,34,15,2);ctx.fill();
      ctx.font='bold 9px sans-serif';ctx.fillStyle='#c5e6e8';ctx.fillText(b.empT>0?'瘫痪':'霜缓',b.x,b.y+3);
    }
    if(!b.branch && b.level>=BRANCH_AT) {ctx.font='8px sans-serif';ctx.fillStyle='#d6b57c';ctx.fillText('可转职',b.x,R.y+16);}
    if(b.def.dmgType) {ctx.fillStyle=DMG[b.def.dmgType].color;ctx.fillRect(R.x+R.w-13,R.y+15,4,4);}
    ctx.restore();
  }
}
function drawBed() {
  const x=BED_CX,R=cellRect(7,1),hp=clamp(G.bed.hp/G.bed.maxHp,0,1);
  SceneArt.drawBed(ctx,G.bed,T,_frameDt,sceneMotion());
  if (G.bed.shield > 0) {
    const shieldPulse = .42 + Math.sin(T * 2.2) * .1;
    ctx.strokeStyle = 'rgba(93,230,255,' + shieldPulse + ')'; ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(93,230,255,.48)'; ctx.shadowBlur = 8;
    rr(R.x + 8, R.y + 7, R.w - 16, (R.h * 2) - 14, 13); ctx.stroke(); ctx.shadowBlur = 0;
  }
  if (G.bed.hp < G.bed.maxHp) {
    const hpColor = hp < .3 ? '#f87171' : (hp < .6 ? '#fbbf24' : '#4ade80');
    bar(x - 40, R.y + 2, 80, 6, hp, hpColor, hpColor);
  }
  const bn = bedName();
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)';
  ctx.strokeText(bn, x + 6, R.y + R.h * 2 - 16);
  ctx.fillStyle = '#ffd166'; ctx.fillText(bn, x + 6, R.y + R.h * 2 - 16);
  ctx.font = 'bold 9.5px sans-serif'; ctx.fillStyle = '#9ef01a';
  ctx.fillText('Lv' + G.bed.lv + '/50  ' + fmt(bedGold()) + '/秒', x + 6, R.y + R.h * 2 - 4);
}
/** 把十六进制色按比例混向目标色（敌人血条/描边用） */
function mixHex(a, b, t) {
  const ca = hexRgb(a), cb = hexRgb(b);
  const f = i => Math.round(ca[i] + (cb[i] - ca[i]) * t);
  return "rgb(" + f(0) + "," + f(1) + "," + f(2) + ")";
}
/** 飞行生物的翅膀（上下拍动） */
function drawWing(ang, len, beat) {
  ctx.save();
  ctx.rotate(ang);
  ctx.fillStyle = "rgba(220,225,255,.30)";
  ctx.beginPath();
  ctx.ellipse(len * 0.5, 0, len * 0.5, len * 0.22 + beat, 0, 0, 6.2832);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
/** 梦魇本体：投影 → 移动拖尾 → 威胁光环 → 暗描边机体 → 类型特征 → 图标 → 状态 */
function drawEnemies() {
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = e.def;
    const col = d.color || "#b28dff";
    const sp = enemySpeed(e);
    const bob = Math.sin(T * 8 + e.wob) * (sp > 0 ? 3 : 0.5) + (d.flying ? Math.sin(T * 4 + e.wob) * 6 : 0);
    const face = isFinite(e.dir) ? e.dir : 0;
    const moving = sp > 1;
    ctx.save();
    ctx.globalAlpha = e.alpha;

    // ① 地面投影
    ctx.fillStyle = "rgba(0,0,0,.38)";
    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.92, e.r * 0.85, e.r * 0.3, 0, 0, 6.2832); ctx.fill();

    // ② 移动拖尾：三截渐隐残影，让"速度"读得出来
    if (moving) {
      const back = Math.atan2(Math.sin(face), Math.cos(face));
      const dx = -Math.cos(back), dy = -Math.sin(back);
      for (let i = 1; i <= 3; i++) {
        const t = i / 3;
        ctx.globalAlpha = e.alpha * 0.16 * (1 - t);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(e.x + dx * e.r * 1.5 * i, e.y + dy * e.r * 1.5 * i + bob,
          e.r * (0.62 - t * 0.34), e.r * (0.5 - t * 0.28), 0, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = e.alpha;
    }

    // ③ 威胁光环（本体底光）
    const RK = Math.round(e.r);   // 半径必须进 key：同色不同体积的敌人不能共用一份渐变
    const gl = gradR("eg" + col + RK, e.r * 2.1, [[0, col + (e.boss ? "66" : (e.elite ? "55" : "3a"))], [1, "rgba(0,0,0,0)"]]);
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(e.x, e.y + bob, e.r * 2.1, 0, 6.2832); ctx.fill();

    // ④ 机体：暗描边 + 内层材质，先从地面里"抠"出来
    ctx.fillStyle = "rgba(8,6,18,.72)";
    ctx.beginPath(); ctx.arc(e.x, e.y + bob, e.r + 2.4, 0, 6.2832); ctx.fill();
    ctx.fillStyle = gradR("eb" + col + RK, e.r, [[0, mixHex(col, "#ffffff", 0.34)], [0.55, mixHex(col, "#000000", 0.28)], [1, mixHex(col, "#000000", 0.62)]]);
    ctx.beginPath(); ctx.arc(e.x, e.y + bob, e.r, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = d.boss || e.elite ? "#ffe066" : mixHex(col, "#ffffff", 0.45);
    ctx.lineWidth = d.boss ? 2.6 : (e.elite ? 2.2 : 1.4); ctx.stroke();

    // ⑤ 类型特征
    if (d.flying) {
      const beat = Math.sin(T * 14 + e.wob) * e.r * 0.16;
      ctx.save(); ctx.translate(e.x, e.y + bob);
      drawWing(face + Math.PI / 2 + 0.5, e.r * 1.5, beat);
      drawWing(face - Math.PI / 2 - 0.5, e.r * 1.5, beat);
      ctx.restore();
    }
    if (d.burrow) {
      ctx.save();
      ctx.globalAlpha = e.alpha * 0.75;
      ctx.fillStyle = "#78350f";
      ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 1.1, e.r * 1.25, e.r * 0.42, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#a16207";
      for (let i = 0; i < 4; i++) {
        const a = e.anim * 1.4 + i * 1.57;
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(a) * e.r * 1.15, e.y + e.r * 0.9 + Math.sin(a) * e.r * 0.3, 2, 0, 6.2832);
        ctx.fill();
      }
      ctx.restore();
    }
    if (d.stealth && !e.untargetable) {
      ctx.save();
      ctx.globalAlpha = e.alpha * 0.7;
      ctx.strokeStyle = "#d7e8ff"; ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]); ctx.lineDashOffset = -T * 10;
      ctx.beginPath(); ctx.arc(e.x, e.y + bob, e.r + 5, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      ctx.restore();
    }

    // ⑥ 图标（敌人的"身份"，放在最上层）
    emoji(d.icon, e.x, e.y + bob - 2, e.r * 1.9);

    // ⑦ 受击闪白
    if (e.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, e.hitFlash * 5);
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(e.x, e.y + bob - 2, e.r * 1.15, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // ⑧ 控制状态：减速 / 眩晕 / 冰冻
    if (G.buff.freeze > 0 || e.stun > 0) {
      ctx.strokeStyle = "rgba(127,223,255,.9)"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, 6.2832); ctx.stroke();
    }
    if (e.slowT > 0) {
      ctx.fillStyle = "rgba(127,223,255,.22)";
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, 6.2832); ctx.fill();
    }

    // ⑨ 精英 / BOSS 表现
    if (e.elite) {
      const af = AFFIX[e.affixes[0]] || { color: "#fb923c", icon: "✦" };
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.sin(T * 3) * 0.08;
      ctx.fillStyle = gradR("ea" + af.color, e.r * 2.6, [[0, af.color + "55"], [1, "rgba(0,0,0,0)"]]);
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 2.6, 0, 6.2832); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = af.color; ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]); ctx.lineDashOffset = -T * 12;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      ctx.font = "11px sans-serif"; ctx.textAlign = "center";
      let ox = -((e.affixes.length - 1) * 13) / 2;
      e.affixes.forEach(k => { ctx.fillText((AFFIX[k] || {}).icon || "✦", e.x + ox, e.y - e.r - 16); ox += 13; });
    }
    if (e.boss) {
      ctx.save();
      const bp = 0.28 + Math.sin(T * 2) * 0.12;
      ctx.globalAlpha = bp;
      ctx.fillStyle = gradR("bg", e.r * 3.2, [[0, "rgba(255,77,109,.45)"], [0.55, "rgba(255,77,109,.1)"], [1, "rgba(0,0,0,0)"]]);
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 3.2, 0, 6.2832); ctx.fill();
      ctx.restore();
      // 双层旋转环 + 尖刺
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(T * 0.5);
      ctx.strokeStyle = "rgba(255,77,109,.75)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, e.r + 12, 0, 6.2832); ctx.stroke();
      ctx.strokeStyle = "rgba(255,209,102,.6)"; ctx.lineWidth = 1.4;
      ctx.setLineDash([6, 10]);
      ctx.beginPath(); ctx.arc(0, 0, e.r + 20, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,77,109,.9)";
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (e.r + 11), Math.sin(a) * (e.r + 11));
        ctx.lineTo(Math.cos(a + 0.13) * (e.r + 19), Math.sin(a + 0.13) * (e.r + 19));
        ctx.lineTo(Math.cos(a + 0.26) * (e.r + 11), Math.sin(a + 0.26) * (e.r + 11));
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // 巨像 / 多段护盾：把进度画成实体护盾片
    if (e.phaseShield) {
      const total = e.phaseShield, left = total - e.segIdx;
      for (let i = 0; i < total; i++) {
        const a0 = -Math.PI / 2 + i * (6.2832 / total) + 0.08;
        ctx.strokeStyle = i < left ? "#5de6ff" : "rgba(120,113,108,.45)";
        ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 7, a0, a0 + (6.2832 / total) - 0.16); ctx.stroke();
      }
    }

    // ⑩ 血条 / 护盾条（圆角描边款，随血量变色）
    const w = e.boss ? 78 : e.r * 2.3;
    if (e.hp < e.maxHp || e.boss || e.elite) {
      const pr = clamp(e.hp / e.maxHp, 0, 1);
      const hc = e.boss ? "#ff4d6d" : (e.elite ? "#fb923c" : (pr < 0.3 ? "#f87171" : (pr < 0.6 ? "#fbbf24" : "#e0556f")));
      const by = e.y - e.r - (e.boss ? 13 : 10);
      gbar(e.x - w / 2, by, w, e.boss ? 7 : 4.5, pr, hc);
      if (e.shieldMax && e.shield > 0) gbar(e.x - w / 2, by - 6, w, 3.2, e.shield / e.shieldMax, "#5de6ff");
    }

    // ⑪ 状态徽记：持续伤害 / 易伤
    {
      const marks = [];
      if (e.burnT > 0) marks.push("🔥" + (e.burnStack >= 1 ? Math.round(e.burnStack) : ""));
      if (e.poison > 0) marks.push("☠️" + Math.round(e.poison));
      if (e.vulnT > 0) marks.push("⚡");
      if (e.def.reflect) marks.push("🪞");
      if (e.def.nullify) marks.push("🚫");
      if (marks.length) {
        const ty = e.y + e.r + 13;
        ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
        ctx.lineWidth = 2.6; ctx.strokeStyle = "rgba(0,0,0,.85)";
        const txt = marks.join(" ");
        ctx.strokeText(txt, e.x, ty);
        ctx.fillStyle = "#fff"; ctx.fillText(txt, e.x, ty);
      }
    }

    // 目标受击前短暂显示攻击环，不改伤害节奏，让玩家看清即将承受压力的防线。
    const attackReadyIn = e.atkCd || 0;
    if (!e.parasiteTarget && e.stun<=0 && G.buff.freeze<=0 &&
      (e.state === "door" || (e.state === "room" && e.target && dist(e,e.target)<=26)) && attackReadyIn > 0 && attackReadyIn <= 0.34) {
      const pulse = 0.72 + Math.sin(T * 18) * 0.18;
      const targetLabel = e.state === "door" ? "第" + (e.lane + 1) + "路铁门" :
        (e.target && e.target.isBed ? "床铺" : "房间建筑");
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "#ff7189"; ctx.lineWidth = 2.4;
      ctx.shadowColor = "rgba(255,77,109,.75)"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 12, -Math.PI / 2,
        -Math.PI / 2 + (1 - attackReadyIn / 0.34) * 6.2832); ctx.stroke();
      ctx.shadowBlur = 0; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center";
      ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(0,0,0,.9)"; ctx.fillStyle = "#ffd3da";
      ctx.strokeText("⚠ 即将攻击 " + targetLabel, e.x, e.y + e.r + 28);
      ctx.fillText("⚠ 即将攻击 " + targetLabel, e.x, e.y + e.r + 28);
      ctx.restore();
    }

    // ⑫ BOSS 名称与阶段
    if (e.boss) {
      const bdef = BOSS_DEFS[e.bossKey] || { name: d.name, phases: BOSS_PHASES };
      const phN = (bdef.phases[e.phase] || { name: "" }).name;
      ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.85)";
      const label = "👑 " + bdef.name + " · " + phN;
      ctx.strokeText(label, e.x, e.y - e.r - 26);
      ctx.fillStyle = "#ffd166"; ctx.fillText(label, e.x, e.y - e.r - 26);
    }
  }
}
function drawBullets() {
  for (const b of G.bullets) {
    const dx = b.tx - b.x, dy = b.ty - b.y;
    const a = Math.atan2(dy, dx) || 0;
    const cc = b.color || "#ffffff";
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(a);
    if (b.type === "missile") {
      // 尾焰 → 弹体 → 弹头，三段式
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = gradL("mtr" + cc, -8, -3.4, -8, 3.4, [[0, "rgba(255,255,255,.9)"], [1, "rgba(255,255,255,0)"]]);
      ctx.beginPath(); ctx.moveTo(-8, -3.4); ctx.lineTo(-30, 0); ctx.lineTo(-8, 3.4); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = gradL("mbt" + cc, 0, -4, 0, 4, [[0, "#ffe9b0"], [0.42, "#fb7185"], [1, "#7f1d1d"]]);
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(3, -4); ctx.lineTo(-8, -4); ctx.lineTo(-8, 4); ctx.lineTo(3, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fb7185";
      ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-12.5, -7.5); ctx.lineTo(-5, -4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-12.5, 7.5); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(3.5, 0, 1.7, 0, 6.2832); ctx.fill();
    } else if (b.type === "frost") {
      // 冰晶拖尾 + 旋转六角冰锥
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = gradL("ftr", -2, -3.6, -2, 3.6, [[0, "rgba(224,247,255,.95)"], [1, "rgba(127,223,255,0)"]]);
      ctx.beginPath(); ctx.moveTo(-2, -3.6); ctx.lineTo(-24, 0); ctx.lineTo(-2, 3.6); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = gradR("forb", 8, [[0, "#ffffff"], [0.38, "#bdf0ff"], [1, "rgba(127,223,255,0)"]]);
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const an = T * 6 + i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(an) * 5.2, -Math.sin(an) * 5.2);
        ctx.lineTo(Math.cos(an) * 5.2, Math.sin(an) * 5.2);
        ctx.stroke();
      }
    } else if (b.type === "poison") {
      // 毒液：液滴 + 冒泡拖尾
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = gradL("ptr", -2, -3, -2, 3, [[0, "rgba(247,254,231,.9)"], [1, "rgba(163,230,53,0)"]]);
      ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(-22, 0); ctx.lineTo(-2, 3); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      for (let i = 0; i < 3; i++) {
        const t = ((T * 3 + i * 0.33) % 1);
        ctx.globalAlpha = (1 - t) * 0.7;
        ctx.fillStyle = "#a3e635";
        ctx.beginPath(); ctx.arc(-6 - t * 16, Math.sin(t * 9 + i) * 2.4, 2.6 + t * 1.6, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = gradR("pdr", 6.5, [[0, "#f7fee7"], [0.4, "#a3e635"], [1, "#3f6212"]]);
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.quadraticCurveTo(0, -6, -4.5, 0); ctx.quadraticCurveTo(0, 6, 7, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.65)";
      ctx.beginPath(); ctx.arc(1, -1.6, 1.5, 0, 6.2832); ctx.fill();
    } else {
      // 动能曳光弹：辉光尾迹 + 亮芯
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = gradL("ktr" + cc, 0, -2, 0, 2, [[0, cc], [1, "rgba(255,255,255,0)"]]);
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-20, 0); ctx.lineTo(0, 2); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = gradL("kbd" + cc, -8, -2.6, -8, 2.6, [[0, shadeHex(cc, 0.6)], [0.45, cc], [1, shadeHex(cc, -0.5)]]);
      rr(-8, -2.6, 15, 5.2, 2.6); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(2.6, 0, 3.4, 1.5, 0, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }
}
function drawEffects() {
  for (const e of G.effects) {
    const p = e.life / e.maxLife;
    if(e.type==='impact') {
      BuildingArt.impact(ctx,e);
    } else if (e.type === 'laser') {
      // 激光：多层光束 + 光晕
      ctx.save(); ctx.globalAlpha = p;
      ctx.shadowColor = e.color; ctx.shadowBlur = 20;
      ctx.strokeStyle = e.color; ctx.lineWidth = 5 + p * 4;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x2, e.y2); ctx.stroke();
      // 内层白色高光
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 + p * 2; ctx.stroke();
      // 外层光晕
      ctx.shadowBlur = 0;
      ctx.globalAlpha = p * 0.3;
      ctx.lineWidth = 12 + p * 8;
      ctx.strokeStyle = e.color; ctx.stroke();
      ctx.restore();
    } else if (e.type === 'arc') {
      // 闪电：锯齿折线 + 光晕
      ctx.save(); ctx.globalAlpha = p;
      ctx.shadowColor = '#c77dff'; ctx.shadowBlur = 16;
      ctx.strokeStyle = '#e9d5ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e.x, e.y);
      for (let i = 1; i <= 5; i++) { const t = i / 5; ctx.lineTo(e.x + (e.x2 - e.x) * t + visualRand(-12,12,i+e.x), e.y + (e.y2 - e.y) * t + visualRand(-12,12,i+e.y+17)); }
      ctx.stroke();
      // 内层白芯
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(e.x, e.y);
      for (let i = 1; i <= 5; i++) { const t = i / 5; ctx.lineTo(e.x + (e.x2 - e.x) * t + visualRand(-8,8,i+e.x), e.y + (e.y2 - e.y) * t + visualRand(-8,8,i+e.y+17)); }
      ctx.stroke(); ctx.restore();
    } else if (e.type === 'ring') {
      ctx.save(); ctx.globalAlpha = p * 0.75; ctx.strokeStyle = e.color || '#f0abfc';
      ctx.lineWidth = 2 + p * 5; ctx.shadowColor = e.color || '#f0abfc'; ctx.shadowBlur = 10;
      const rr = e.r * (1.05 - p * 0.55);
      ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = p * 0.35;
      ctx.beginPath(); ctx.arc(e.x, e.y, rr * 0.62, 0, 6.2832); ctx.stroke(); ctx.restore();
    } else if (e.type === 'boom') {
      // 爆炸：多层光效
      ctx.save(); ctx.globalAlpha = p;
      const g = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, e.r);
      g.addColorStop(0, 'rgba(255,240,180,.95)');
      g.addColorStop(0.3, 'rgba(255,180,80,.7)');
      g.addColorStop(0.7, 'rgba(255,100,50,.3)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.2832); ctx.fill();
      // 冲击波环
      ctx.strokeStyle = 'rgba(255,200,120,' + (p * 0.8) + ')';
      ctx.lineWidth = 3 + p * 3; ctx.stroke();
      // 内层高光
      ctx.globalAlpha = p * 0.5;
      ctx.fillStyle = 'rgba(255,255,200,.6)';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.3, 0, 6.2832); ctx.fill();
      ctx.restore();
    } else if (e.type === 'curse') {
      ctx.save(); ctx.globalAlpha = 0.5 * p;
      const g2 = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, e.r);
      g2.addColorStop(0, 'rgba(148,163,184,.5)'); g2.addColorStop(0.6, 'rgba(107,33,168,.35)'); g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(168,85,247,' + (0.5 * p) + ')'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
      emoji('☠️', e.x, e.y - 8, 20, 0.7 * p); ctx.restore();
    } else if (e.type === 'meteor') {
      ctx.save(); ctx.fillStyle = '#ff8c42'; ctx.shadowColor = '#ff8c42'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,120,.6)'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x - 20, e.y - 40); ctx.stroke(); ctx.restore();
    }
  }
}
function drawParts() {
  for (const p of G.parts) {
    const lifeRatio = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = lifeRatio * 0.9;
    const currentSize = p.size * (0.5 + lifeRatio * 0.5); // 粒子逐渐缩小
    // 发光粒子效果（紫色、金色等特殊颜色）
    if (p.color === '#c77dff' || p.color === '#ffd166' || p.color === '#7cf39a') {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
    }
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, currentSize, 0, 6.2832); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}
function drawTexts() {
  ctx.textAlign = 'center';
  for (const t of G.texts) {
    const a = clamp(t.life / t.max, 0, 1);
    const age = 1 - a;
    // 弹出动画：先放大再缩回
    let scale;
    if (age < 0.15) scale = 1 + age * 5; // 快速放大到 1.75x
    else if (age < 0.3) scale = 1.75 - (age - 0.15) * 5; // 缩回到 1x
    else scale = 1 + age * 0.3; // 之后缓慢放大消失
    const fontSize = t.big ? 22 : 14;
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 2); // 更快淡入
    ctx.translate(t.x, t.y - age * 45); // 向上飘动更明显
    ctx.scale(scale, scale);
    ctx.font = (t.big ? 'bold ' : 'bold ') + fontSize + 'px sans-serif';
    // 双层描边增强可读性
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.9)'; ctx.strokeText(t.t, 0, 0);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeText(t.t, 0, 0);
    // 渐变色效果
    const gradient = ctx.createLinearGradient(-20, -10, 20, 10);
    gradient.addColorStop(0, t.color);
    gradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = gradient; ctx.fillText(t.t, 0, 0);
    ctx.restore();
  }
}
function drawEventBanner() {
  if (G.event.id === 'none' || G.state !== 'wave') return;
  const e = G.event;
  ctx.save();
  ctx.fillStyle = 'rgba(12,10,26,.82)'; rr(470, ARENA_TOP + 6, 340, 30, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,.45)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(e.icon + ' ' + e.name + '：' + e.desc, 640, ARENA_TOP + 21);
  ctx.restore();
  // 连杀计数器
  if (G.combo >= 5 && G.comboT > 0) {
    ctx.save();
    const comboAlpha = Math.min(1, G.comboT);
    ctx.globalAlpha = comboAlpha;
    const comboScale = 1 + Math.sin(T * 6) * 0.08;
    ctx.translate(W - 30, ARENA_TOP + 50);
    ctx.scale(comboScale, comboScale);
    // 连杀背景
    ctx.fillStyle = 'rgba(255,107,107,.2)';
    rr(-40, -18, 80, 36, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,107,107,.6)';
    ctx.lineWidth = 2; ctx.stroke();
    // 连杀文字
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#ff6b6b';
    ctx.textAlign = 'center';
    ctx.fillText('连杀', 0, -4);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(G.combo, 0, 16);
    ctx.restore();
  }
}
function drawTipBar() {
  if (G.tipTimer <= 0 || !G.tipText) return;
  ctx.save();
  ctx.globalAlpha = clamp(G.tipTimer, 0, 1);
  // 渐变背景
  const tipGrad = ctx.createLinearGradient(260, ARENA_TOP + 40, 1020, ARENA_TOP + 40);
  tipGrad.addColorStop(0, 'rgba(12,10,26,.85)');
  tipGrad.addColorStop(0.5, 'rgba(20,16,40,.92)');
  tipGrad.addColorStop(1, 'rgba(12,10,26,.85)');
  ctx.fillStyle = tipGrad; rr(260, ARENA_TOP + 40, 760, 30, 8); ctx.fill();
  // 上下边框光效
  ctx.strokeStyle = 'rgba(255,224,102,.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(268, ARENA_TOP + 40); ctx.lineTo(1012, ARENA_TOP + 40); ctx.stroke();
  ctx.strokeStyle = 'rgba(168,85,247,.25)';
  ctx.beginPath(); ctx.moveTo(268, ARENA_TOP + 70); ctx.lineTo(1012, ARENA_TOP + 70); ctx.stroke();
  ctx.fillStyle = '#ffe066'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(G.tipText, 640, ARENA_TOP + 55);
  ctx.restore();
}
function drawCursor() {
  if (selectedBuildKey && hoverCell && !G.grid[hoverCell.r * COLS + hoverCell.c]) {
    const R = cellRect(hoverCell.c, hoverCell.r);
    const def = BUILD_DEFS[selectedBuildKey];
    // 半透明建筑预览
    ctx.globalAlpha = 0.55;
    BuildingArt.preview(ctx,selectedBuildKey,def,R.x+R.w/2,R.y+R.h/2);
    ctx.globalAlpha = 1;
    // 范围预览圈（脉动）
    const rg = def.stat(1).range || 0;
    if (rg) {
      const pulse = 0.6 + Math.sin(T * 4) * 0.25;
      ctx.beginPath(); ctx.arc(R.x + R.w / 2, R.y + R.h / 2, rg, 0, 6.2832);
      ctx.fillStyle = 'rgba(158,240,26,' + (0.04 * pulse) + ')'; ctx.fill();
      ctx.strokeStyle = 'rgba(158,240,26,' + (0.35 * pulse) + ')';
      ctx.setLineDash([5, 7]); ctx.lineDashOffset = -T * 15;
      ctx.lineWidth = 1.5; ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
  }
}
// 波次开始过渡动画
function drawWaveTransition() {
  if (!G.waveTransition || G.waveTransition.t <= 0) return;
  const wt = G.waveTransition;
  const DUR = 1.5;
  const alpha = wt.t > DUR - 0.5 ? (DUR - wt.t) * 2 : (wt.t < 0.5 ? wt.t * 2 : 1);
  if (alpha <= 0.01) return;
  ctx.save();
  // 全屏渐变遮罩（原先 0.4 太黑，开战时整个战场糊掉看不清炮塔）
  ctx.fillStyle = 'rgba(0,0,0,' + (alpha * 0.2) + ')';
  ctx.fillRect(0, 0, W, H);
  // 水平光线扫描效果
  const scanX = W * (1 - wt.t / DUR);
  const scanGrad = ctx.createLinearGradient(scanX - 200, 0, scanX + 200, 0);
  scanGrad.addColorStop(0, 'transparent');
  scanGrad.addColorStop(0.5, 'rgba(255,209,102,' + (alpha * 0.15) + ')');
  scanGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = scanGrad;
  ctx.fillRect(scanX - 200, 0, 400, H);
  // 波次文字（带缩放动画）
  ctx.translate(W / 2, H / 2);
  const scale = 1 + (DUR - wt.t) * 0.3;
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  // 文字阴影光晕
  ctx.font = 'bold 46px "Noto Sans SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = 30 * alpha;
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.85)';
  ctx.strokeText('第 ' + wt.wave + ' 波', 0, 0);
  // 渐变文字
  const gradient = ctx.createLinearGradient(-120, -25, 120, 25);
  gradient.addColorStop(0, '#ffd166');
  gradient.addColorStop(0.5, '#ff6b6b');
  gradient.addColorStop(1, '#ffd166');
  ctx.fillStyle = gradient;
  ctx.fillText('第 ' + wt.wave + ' 波', 0, 0);
  ctx.shadowBlur = 0;
  // 副标题
  ctx.font = 'bold 18px "Noto Sans SC", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillText('梦魇来袭！', 0, 40);
  // 装饰性水平线
  ctx.strokeStyle = 'rgba(255,209,102,' + (alpha * 0.4) + ')';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-140, 60); ctx.lineTo(140, 60); ctx.stroke();
  ctx.restore();
}
