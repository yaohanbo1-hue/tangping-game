const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let T = 0;
function rr(x, y, w, h, r) {
  ctx.beginPath();
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
function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0.4) { ctx.translate(rnd(-shake, shake) * 0.5, rnd(-shake, shake) * 0.5); shake *= 0.86; } else shake = 0;
  drawBg(); drawCorridors(); drawRoom(); drawBuildings(); drawBed();
  drawEnemies(); drawWallsDoors(); drawBullets(); drawEffects(); drawParts(); drawTexts();
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
      f.t -= 0.016;
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
    ctx.fillStyle = 'rgba(255,60,80,' + (flash * 0.35) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,40,60,' + (flash * 0.25) + ')';
    ctx.fillRect(0, 0, W, H);
    flash -= 0.035;
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
  const snap = DreamEngine.getSnapshot();

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
    const level = DeepDream.getCurrentLevel();
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
    ctx.fillText(level.icon + ' ' + level.name + '  —  ' + level.desc, W / 2, 70);
    ctx.restore();
  }

  // 4. NPC 驻守指示（小图标显示在房间上方）
  if (typeof NPCGuardians !== 'undefined') {
    const recruited = NPCGuardians.getRecruited();
    for (const npc of recruited) {
      if (!npc.active || !npc.def) continue;
      const laneIdx = parseInt(npc.roomId.replace('lane_', ''), 10);
      if (isNaN(laneIdx)) continue;
      ctx.save();
      ctx.font = '14px serif';
      ctx.textAlign = 'left';
      ctx.fillText(npc.def.icon, ROOM_X0 + 4, ARENA_TOP + laneIdx * ((ARENA_BOT - ARENA_TOP) / 3) + 14);
      ctx.restore();
    }
  }
}

// 星空粒子系统（增强版）
const stars = [];
for (let i = 0; i < 100; i++) {
  stars.push({
    x: Math.random() * 1280,
    y: Math.random() * 720,
    s: 0.3 + Math.random() * 2.8,
    sp: 0.1 + Math.random() * 0.45,
    a: Math.random(),
    phase: Math.random() * Math.PI * 2,
    color: Math.random() < 0.3 ? '#c084fc' : (Math.random() < 0.5 ? '#a855f7' : '#818cf8')
  });
}
function drawStars() {
  const overlay = document.getElementById('overlay');
  const inMenu = overlay && overlay.style.display !== 'none';
  const alpha = inMenu ? 1.0 : 0.3; // 游戏中也显示但更暗
  stars.forEach(star => {
    star.a = (0.25 + 0.55 * Math.sin(T * 1.5 + star.phase)) * alpha;
    star.y -= star.sp * (inMenu ? 1 : 0.3); // 游戏中星星几乎不动
    if (star.y < -5) { star.y = 725; star.x = Math.random() * 1280; }
    ctx.fillStyle = star.color + Math.round(clamp(star.a, 0, 1) * 255).toString(16).padStart(2, '0');
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.s, 0, Math.PI * 2);
    ctx.fill();
    // 光晕（大星星）
    if (star.s > 1.5) {
      ctx.fillStyle = star.color + Math.round(clamp(star.a * 0.27, 0, 1) * 255).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.s * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // 十字闪光（最大的星星）
    if (star.s > 2.2 && inMenu) {
      ctx.strokeStyle = star.color + Math.round(clamp(star.a * 0.47, 0, 1) * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(star.x - star.s * 2, star.y); ctx.lineTo(star.x + star.s * 2, star.y);
      ctx.moveTo(star.x, star.y - star.s * 2); ctx.lineTo(star.x, star.y + star.s * 2);
      ctx.stroke();
    }
  });
}
function drawBg() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#141026'); g.addColorStop(0.5, '#1a1330'); g.addColorStop(1, '#0e0b1c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawStars();
  // 动态网格线（微弱脉动）
  const gridAlpha = 0.04 + Math.sin(T * 0.8) * 0.015;
  ctx.strokeStyle = 'rgba(168,85,247,' + gridAlpha + ')';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // 飘动的微光点（梦境氛围粒子）
  for (let i = 0; i < 24; i++) {
    const px = (i * 137 + T * (6 + i * 2.5)) % W;
    const py = (i * 199 + Math.sin(T * 0.4 + i * 0.9) * 40) % H;
    const a = 0.08 + Math.sin(T * 1.8 + i * 1.3) * 0.06;
    const r = 1 + Math.sin(T * 1.2 + i) * 0.8;
    // 交替颜色：紫/蓝/青
    const hue = i % 3 === 0 ? '199,125,255' : (i % 3 === 1 ? '96,165,250' : '52,211,253');
    ctx.fillStyle = 'rgba(' + hue + ',' + a + ')';
    ctx.beginPath(); ctx.arc(px, py, r, 0, 6.2832); ctx.fill();
  }
}
function drawCorridors() {
  const x0 = CORRIDOR_X0, x1 = WALL_X;
  LANES.forEach((L, i) => {
    const y0 = L.y0, y1 = L.y1;
    ctx.fillStyle = i % 2 ? '#171331' : '#191430';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = 'rgba(120,110,180,.12)'; ctx.lineWidth = 1;
    for (let x = x0; x < x1; x += 44) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
    for (let y = y0; y < y1; y += 44) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, y0, 0, y0 + 44);
    g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, 44);
    // 危险脉冲光效（波次进行中增强）
    const inWave = G.state === 'wave';
    const pulseBase = inWave ? 0.6 : 0.4;
    const pulseAmp = inWave ? 0.35 : 0.2;
    const pulse = pulseBase + Math.sin(T * (inWave ? 3.5 : 2) + i * 1.2) * pulseAmp;
    ctx.fillStyle = 'rgba(255,60,110,' + (0.1 + pulse * 0.12) + ')';
    ctx.fillRect(x0, y0, 26, y1 - y0);
    // 通道入口雾气
    const fogGrad = ctx.createLinearGradient(x0, y0, x0 + 60, y0);
    fogGrad.addColorStop(0, 'rgba(148,163,184,' + (inWave ? 0.12 : 0.06) + ')');
    fogGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = fogGrad; ctx.fillRect(x0, y0, 60, y1 - y0);
    ctx.save(); ctx.translate(x0 + 13, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(255,140,160,.55)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('梦魇通道 ' + (i + 1), 0, 0); ctx.restore();
    if (i < 2) {
      ctx.fillStyle = '#2e2750'; ctx.fillRect(x0, y1 - 5, x1 - x0, 10);
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x0, y1 - 5, x1 - x0, 3);
    }
  });
}
function drawRoom() {
  const y0 = ARENA_TOP, y1 = ARENA_BOT;
  // 房间背景（带微弱渐变）
  const roomGrad = ctx.createLinearGradient(ROOM_X0, y0, ROOM_X0, y1);
  roomGrad.addColorStop(0, '#241c42');
  roomGrad.addColorStop(0.5, '#221a3d');
  roomGrad.addColorStop(1, '#1e1636');
  ctx.fillStyle = roomGrad; ctx.fillRect(ROOM_X0, y0, ROOM_X1 - ROOM_X0, y1 - y0);
  ctx.fillStyle = 'rgba(90,70,150,.12)';
  ctx.fillRect(ROOM_X0 + 10, y0 + 10, ROOM_X1 - ROOM_X0 - 20, y1 - y0 - 20);
  // 网格线（更柔和）
  ctx.strokeStyle = 'rgba(140,130,220,.13)'; ctx.lineWidth = 0.8;
  for (let c = 0; c <= COLS; c++) { const x = ROOM_X0 + c * CW; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
  for (let r = 0; r <= ROWS; r++) { const y = y0 + r * CH; ctx.beginPath(); ctx.moveTo(ROOM_X0, y); ctx.lineTo(ROOM_X1, y); ctx.stroke(); }
  // 房间边框发光
  ctx.save();
  ctx.strokeStyle = 'rgba(168,85,247,.2)';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(168,85,247,.3)';
  ctx.shadowBlur = 12;
  ctx.strokeRect(ROOM_X0 + 1, y0 + 1, ROOM_X1 - ROOM_X0 - 2, y1 - y0 - 2);
  ctx.restore();
  if (selectedBuildKey) {
    const pulse = 0.5 + Math.sin(T * 3.2) * 0.5;
    const isTower = !!(BUILD_DEFS[selectedBuildKey] && BUILD_DEFS[selectedBuildKey].tower);
    const rgb = isTower ? '255,190,80' : '158,240,26';
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (G.grid[r * COLS + c] || inBed(c, r)) continue;
      const R = cellRect(c, r);
      ctx.fillStyle = 'rgba(' + rgb + ',' + (0.08 + pulse * 0.09) + ')';
      ctx.fillRect(R.x + 3, R.y + 3, R.w - 6, R.h - 6);
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.34 + pulse * 0.36) + ')';
      ctx.lineWidth = isTower ? 2 : 1.5;
      ctx.strokeRect(R.x + 3, R.y + 3, R.w - 6, R.h - 6);
      const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.3 + pulse * 0.35) + ')';
      ctx.lineWidth = isTower ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
      ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
      ctx.stroke();
    }
  }
  if (hoverCell && !G.grid[hoverCell.r * COLS + hoverCell.c] && !inBed(hoverCell.c, hoverCell.r)) {
    const R = cellRect(hoverCell.c, hoverCell.r);
    ctx.fillStyle = selectedBuildKey ? 'rgba(120,255,170,.2)' : 'rgba(255,255,255,.05)';
    ctx.fillRect(R.x + 2, R.y + 2, R.w - 4, R.h - 4);
    ctx.strokeStyle = selectedBuildKey ? 'rgba(180,255,120,.95)' : 'rgba(255,255,255,.2)';
    ctx.lineWidth = 2.5; ctx.strokeRect(R.x + 2, R.y + 2, R.w - 4, R.h - 4);
  }
  if (selected && selected.def) {
    const R = cellRect(selected.col, selected.row);
    // 选中高亮框（脉动）
    const selPulse = 0.7 + Math.sin(T * 5) * 0.3;
    ctx.strokeStyle = 'rgba(255,224,102,' + selPulse + ')';
    ctx.lineWidth = 2.5; ctx.strokeRect(R.x + 2, R.y + 2, R.w - 4, R.h - 4);
    const s = bstat(selected);
    if (s.range) {
      // 渐变填充范围
      ctx.beginPath(); ctx.arc(selected.x, selected.y, s.range, 0, 6.2832);
      const rangeGrad = ctx.createRadialGradient(selected.x, selected.y, 0, selected.x, selected.y, s.range);
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
  ctx.fillStyle = 'rgba(200,190,255,.22)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('你的宿舍 · 点击空位建造', ROOM_X0 + 8, y0 + 14);
}
function drawWallsDoors() {
  LANES.forEach(L => {
    const D = G.doors[L.i];
    ctx.fillStyle = '#3b3160';
    ctx.fillRect(WALL_X - 8, L.y0, 16, D.y - L.doorHalf - L.y0);
    ctx.fillRect(WALL_X - 8, D.y + L.doorHalf, 16, L.y1 - (D.y + L.doorHalf));
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(WALL_X - 8, L.y0, 6, D.y - L.doorHalf - L.y0);
    ctx.fillRect(WALL_X - 8, D.y + L.doorHalf, 6, L.y1 - (D.y + L.doorHalf));
    const broken = D.broken || D.hp <= 0;
    const p = D.hp / D.maxHp;
    ctx.save();
    if (broken) ctx.globalAlpha = 0.22;
    const g = ctx.createLinearGradient(WALL_X - 14, 0, WALL_X + 14, 0);
    g.addColorStop(0, broken ? '#4a3a3a' : '#6e7ba8'); g.addColorStop(0.5, broken ? '#3a2e2e' : '#9aa8d8'); g.addColorStop(1, broken ? '#4a3a3a' : '#5e6a94');
    ctx.fillStyle = g; ctx.fillRect(WALL_X - 14, D.y - L.doorHalf, 28, L.doorHalf * 2);
    ctx.strokeStyle = '#20203a'; ctx.lineWidth = 2; ctx.strokeRect(WALL_X - 14, D.y - L.doorHalf, 28, L.doorHalf * 2);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    for (let i = -1; i <= 1; i++) ctx.fillRect(WALL_X - 14, D.y + i * 22 - 3, 28, 6);
    // 损毁裂纹效果（HP 低于 50% 时出现）
    if (!broken && p < 0.5) {
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.6;
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(WALL_X - 8, D.y - 15); ctx.lineTo(WALL_X + 2, D.y - 5); ctx.lineTo(WALL_X - 3, D.y + 8);
      ctx.moveTo(WALL_X + 4, D.y - 12); ctx.lineTo(WALL_X + 10, D.y + 2);
      if (p < 0.25) {
        ctx.moveTo(WALL_X - 10, D.y + 5); ctx.lineTo(WALL_X, D.y + 18);
        ctx.moveTo(WALL_X + 6, D.y + 8); ctx.lineTo(WALL_X + 12, D.y + 20);
      }
      ctx.stroke();
      ctx.restore();
    }
    if (D.shield > 0) {
      ctx.strokeStyle = 'rgba(93,230,255,' + (0.4 + 0.3 * Math.sin(T * 4)) + ')'; ctx.lineWidth = 3;
      ctx.strokeRect(WALL_X - 17, D.y - L.doorHalf - 3, 34, L.doorHalf * 2 + 6);
    }
    ctx.restore();
    if (!broken) {
      bar(WALL_X - 40, D.y - L.doorHalf - 13, 80, 7, p, p > 0.5 ? '#4ade80' : p > 0.25 ? '#fbbf24' : '#f87171', 'rgba(255,255,255,.25)');
      if (D.shield > 0) bar(WALL_X - 40, D.y - L.doorHalf - 21, 80, 4, D.shield / (D.shieldMax || 1), '#5de6ff');
      const dn = doorName(D);
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.strokeText(dn, WALL_X, D.y + L.doorHalf + 15);
      ctx.fillStyle = D.lv >= 50 ? '#ffd166' : '#cbd5e1';
      ctx.fillText(dn, WALL_X, D.y + L.doorHalf + 15);
      ctx.font = '9px sans-serif'; ctx.fillStyle = '#9ef01a';
      ctx.fillText('Lv' + D.lv + '/50', WALL_X, D.y + L.doorHalf + 26);
    } else {
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('已损毁', WALL_X, D.y);
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#c77dff';
      ctx.fillText(doorName(D), WALL_X, D.y + L.doorHalf + 15);
    }
    if (!broken && p < 0.3) {
      ctx.strokeStyle = 'rgba(248,113,113,' + (0.3 + 0.3 * Math.sin(T * 8)) + ')'; ctx.lineWidth = 3;
      ctx.strokeRect(WALL_X - 16, D.y - L.doorHalf - 2, 32, L.doorHalf * 2 + 4);
    }
  });
  G.doors.forEach(D => { ctx.beginPath(); ctx.arc(WALL_X + 6, D.y, 4, 0, 6.2832); ctx.fillStyle = '#ffd166'; ctx.fill(); });
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
/** 金属炮管外壳：横向渐变（局部坐标，随旋转一起转，缓存复用） */
/** 正六边形路径（机械装甲基座用；rot 控制顶点朝向） */
function hexPath(r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + i * Math.PI / 3;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
/** 正六边形周长上的点：t ∈ [0,1)，从顶点 rot 起逆时针走一圈 */
function hexPoint(r, rot, t) {
  const k = (t * 6 + 6) % 6;
  const seg = Math.floor(k) % 6, f = k - Math.floor(k);
  const a0 = rot + seg * Math.PI / 3, a1 = rot + (seg + 1) * Math.PI / 3;
  const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
  return [(c0 + (c1 - c0) * f) * r, (s0 + (s1 - s0) * f) * r];
}
/** 金属炮管外壳：横向渐变 + 上沿高光 + 能量槽（hot>0 时点亮） */
function barrelBody(color, len, halfH, accent, hot) {
  ctx.fillStyle = gradL("bb" + color + len + halfH, 0, -halfH, 0, halfH, [
    [0, shadeHex(color, 0.6)], [0.4, shadeHex(color, 0.02)], [1, shadeHex(color, -0.66)],
  ]);
  ctx.fillRect(-3, -halfH, len + 3, halfH * 2);
  ctx.fillStyle = "rgba(255,255,255,.42)";
  ctx.fillRect(-3, -halfH, len + 3, 1.6);
  ctx.globalAlpha = 0.5; ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.ellipse(3, -halfH * 0.35, 2.2, 1.1, 0, 0, 6.2832); ctx.fill();
  ctx.globalAlpha = 1;
  if (accent) {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.35 + (hot || 0) * 0.65;
    ctx.fillRect(len - 7, -halfH + 1.2, 4, halfH * 2 - 2.4);
    ctx.globalAlpha = 1;
  }
}
/** 炮口制退器：末端的三道环槽，让管子有收束感 */
function muzzleBrake(len, halfH, color) {
  ctx.fillStyle = shadeHex(color, -0.3);
  ctx.fillRect(len - 8, -halfH - 1.6, 6, halfH * 2 + 3.2);
  ctx.fillStyle = "rgba(255,255,255,.22)";
  ctx.fillRect(len - 8, -halfH - 1.6, 1.4, halfH * 2 + 3.2);
}
/** 10 种武器的炮管/发射器造型 —— 长度、粗细、机构都不同，不看名字也能分辨 */
const TOWER_MUZZLE_LENGTH = {
  laser: 50, frost: 36, flame: 34, tesla: 27, poison: 26,
  sonic: 26, missile: 25, gravity: 12, prism: 32, turret: 28,
};
function drawBarrel(type, color, accent, hot, branch) {
  accent = accent || color;
  hot = hot || 0;
  switch (type) {
    case "laser": {
      // 长聚焦镜筒 + 三道聚能环 + 尖端晶体
      barrelBody(color, 34, 2.6, accent, hot);
      muzzleBrake(34, 2.6, color);
      for (let i = 1; i <= 3; i++) {
        ctx.strokeStyle = accent; ctx.globalAlpha = 0.35 + hot * 0.5;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(10 + i * 6, 0, 5.4, 0, 6.2832); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = gradL("lzc2", 36, -5, 36, 5, [[0, "#ffffff"], [0.5, accent], [1, shadeHex(accent, -0.6)]]);
      ctx.beginPath(); ctx.moveTo(36, 0); ctx.lineTo(44, -4.5); ctx.lineTo(50, 0); ctx.lineTo(44, 4.5); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.5 + hot * 0.5;
      ctx.fillStyle = gradR("lzg" + accent, 10, [[0, "#ffffff"], [0.4, accent], [1, "rgba(255,255,255,0)"]]);
      ctx.beginPath(); ctx.arc(44, 0, 9, 0, 6.2832); ctx.fill();
      break;
    }
    case "frost": {
      // 制冷管 + 扩散喇叭口 + 冰晶核
      barrelBody(color, 24, 3.2, accent, hot);
      ctx.fillStyle = gradL("fzc", 24, -7, 24, 7, [[0, "#ffffff"], [0.45, "#bdf0ff"], [1, "#4aa8c8"]]);
      ctx.beginPath(); ctx.moveTo(22, -7); ctx.lineTo(36, 0); ctx.lineTo(22, 7); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(224,247,255,.85)"; ctx.lineWidth = 1.1;
      for (let i = 0; i < 3; i++) {
        const an = T * 4 + i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(30 - Math.cos(an) * 4, -Math.sin(an) * 4);
        ctx.lineTo(30 + Math.cos(an) * 4, Math.sin(an) * 4);
        ctx.stroke();
      }
      break;
    }
    case "flame": {
      // 短粗喷口 + 点火环
      barrelBody("#7c2d12", 18, 4.4, accent, hot);
      ctx.fillStyle = gradL("flc", 16, -5, 16, 5, [[0, "#ffd166"], [0.5, "#ff8c42"], [1, "#9a3412"]]);
      ctx.beginPath(); ctx.moveTo(16, -5); ctx.lineTo(34, -8.5); ctx.lineTo(34, 8.5); ctx.lineTo(16, 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#ffd166"; ctx.globalAlpha = 0.5 + hot * 0.5; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(33, 0, 7.5, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case "tesla": {
      // 双叉电极 + 中央电弧球
      ctx.strokeStyle = shadeHex("#c77dff", -0.15); ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(24, -7); ctx.moveTo(0, 5); ctx.lineTo(24, 7); ctx.stroke();
      ctx.fillStyle = gradR("tsg", 9, [[0, "#ffffff"], [0.35, "#e9d5ff"], [1, "rgba(168,85,247,0)"]]);
      ctx.beginPath(); ctx.arc(27, 0, 9, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#e9d5ff";
      ctx.beginPath(); ctx.arc(27, 0, 4.2, 0, 6.2832); ctx.fill();
      // 随机电弧（用 T 做种子，避免额外状态）
      if (Math.sin(T * 37) > 0.55) {
        ctx.strokeStyle = "#f5f3ff"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(27, 0);
        ctx.lineTo(31, Math.sin(T * 53) * 5); ctx.lineTo(36, Math.cos(T * 41) * 5);
        ctx.stroke();
      }
      break;
    }
    case "poison": {
      // 双储液罐 + 喷嘴
      ctx.fillStyle = gradL("poc", 0, -8, 0, -1, [[0, "#d9f99d"], [1, "#3f6212"]]);
      ctx.fillRect(0, -8, 15, 7);
      ctx.fillStyle = gradL("poc2", 0, 1, 0, 8, [[0, "#d9f99d"], [1, "#3f6212"]]);
      ctx.fillRect(0, 1, 15, 7);
      barrelBody("#4d7c0f", 22, 3, accent, hot);
      ctx.fillStyle = gradR("pon", 8, [[0, "#f7fee7"], [0.35, "#a3e635"], [1, "#3f6212"]]);
      ctx.beginPath(); ctx.arc(26, 0, 7, 0, 6.2832); ctx.fill();
      ctx.fillStyle = gradR("ponin", 4.6, [[0, "#ffffff"], [1, "rgba(163,230,53,0)"]]);
      ctx.beginPath(); ctx.arc(26, 0, 4.6, 0, 6.2832); ctx.fill();
      break;
    }
    case "sonic": {
      // 大喇叭 + 波环
      ctx.fillStyle = gradL("soc", 0, -13, 0, 13, [[0, "#fdf4ff"], [0.45, "#f0abfc"], [1, "#86198f"]]);
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(26, -13); ctx.lineTo(26, 13); ctx.lineTo(0, 6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(240,171,252,.55)"; ctx.lineWidth = 1.5;
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 0.5 - i * 0.1 + hot * 0.4;
        ctx.beginPath(); ctx.arc(26, 0, 4 * i + 3, -0.72, 0.72); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "missile": {
      // 四联装发射巢：2×2 管口 + 露出的弹头
      const tube = (ty) => {
        ctx.fillStyle = gradL("msc" + ty, -1, ty - 3.4, -1, ty + 3.4, [[0, shadeHex("#9f1239", 0.55)], [1, shadeHex("#9f1239", -0.55)]]);
        ctx.fillRect(-1, ty - 3.4, 24, 6.8);
        ctx.fillStyle = "#450a0a";
        ctx.beginPath(); ctx.ellipse(22, ty, 2.2, 3, 0, 0, 6.2832); ctx.fill();
        ctx.fillStyle = gradL("msw" + ty, 14, ty - 3, 14, ty + 3, [[0, "#fff7cc"], [0.5, "#ffd166"], [1, "#b45309"]]);
        ctx.beginPath(); ctx.moveTo(14, ty - 3); ctx.lineTo(25, ty); ctx.lineTo(14, ty + 3); ctx.closePath(); ctx.fill();
      };
      tube(-5.2); tube(5.2);
      ctx.fillStyle = "rgba(255,255,255,.14)";
      ctx.fillRect(-1, -1.2, 24, 2.4);
      break;
    }
    case "gravity": {
      // 双环引力发生器 + 悬浮核心
      ctx.strokeStyle = "#c7d2fe"; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.ellipse(12, 0, 13, 6, 0, 0, 6.2832); ctx.stroke();
      ctx.strokeStyle = "rgba(165,180,252,.5)"; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.ellipse(12, 0, 7, 13, 0, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = gradR("gvg", 9, [[0, "#ffffff"], [0.32, "#818cf8"], [1, "rgba(49,46,129,0)"]]);
      ctx.beginPath(); ctx.arc(12, 0, 9, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#312e81";
      ctx.beginPath(); ctx.arc(12, 0, 3.6, 0, 6.2832); ctx.fill();
      break;
    }
    case "prism": {
      // 晶体 + 三根聚焦臂
      ctx.fillStyle = gradL("prc", 0, -9, 30, 9, [[0, "#ecfeff"], [0.42, "#67e8f9"], [1, "#0e7490"]]);
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(16, -10); ctx.lineTo(32, 0); ctx.lineTo(16, 10); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(207,250,254,.75)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(16, -10); ctx.lineTo(16, 10); ctx.moveTo(16, 0); ctx.lineTo(32, 0); ctx.stroke();
      ctx.fillStyle = gradR("prg", 7, [[0, "#ffffff"], [1, "rgba(103,232,249,0)"]]);
      ctx.beginPath(); ctx.arc(16, 0, 7, 0, 6.2832); ctx.fill();
      break;
    }
    default: {
      if (type === "turret" && branch === "a") {
        // 加特林分支：三联旋转枪管，保留原有转塔与射击逻辑
        for (const y of [-4.2, 0, 4.2]) {
          ctx.save(); ctx.translate(0, y);
          barrelBody(color, 29, 1.45, accent, hot);
          muzzleBrake(29, 1.45, color);
          ctx.restore();
        }
      } else if (type === "turret" && branch === "b") {
        // 狙击分支：加长重管与瞄准镜，纯外观标识
        barrelBody(color, 36, 2.5, accent, hot);
        muzzleBrake(36, 2.5, color);
        ctx.fillStyle = shadeHex(color, 0.45);
        rr(10, -6.2, 12, 2.4, 1); ctx.fill();
        ctx.fillStyle = accent; ctx.globalAlpha = 0.8;
        ctx.fillRect(14, -7.2, 4, 1.1); ctx.globalAlpha = 1;
      } else {
        // 基础机枪：双联管 + 制退器
        barrelBody(color, 28, 2.2, accent, hot);
        barrelBody(color, 26, 2.2, accent, hot);
        ctx.save(); ctx.translate(0, -3.4); muzzleBrake(28, 2.2, color); ctx.restore();
        ctx.save(); ctx.translate(0, 3.4); muzzleBrake(26, 2.2, color); ctx.restore();
      }
      break;
    }
  }
}
/** 炮塔本体：机械装甲基座 + 等级刻度 + 能量核心 + 转塔炮管 + 开火冲击 + 共鸣环 */
function drawTowerArt(b, s, color) {
  const elem = b.def.dmgType ? DMG[b.def.dmgType] : null;
  const accent = elem ? elem.color : color;
  const lvP = clamp((b.level || 1) / (b.def.maxLv || 50), 0, 1);
  const isBr = !!b.branch;
  const resN = b.resN || 0;
  const rc = b.resColor || "#7dd3fc";
  const pulse = 0.5 + 0.5 * Math.sin(T * 2.2 + (b.pulse || 0) * 0.9);
  const fxF = b.fireFx || 0;
  const hot = Math.min(1, fxF * 5);
  ctx.save();
  ctx.translate(b.x, b.y + 2);

  // ① 地面投影
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = gradR("sh" + color, 32, [[0, "rgba(0,0,0,.7)"], [1, "rgba(0,0,0,0)"]]);
  ctx.beginPath(); ctx.ellipse(0, 16, 28, 10, 0, 0, 6.2832); ctx.fill();
  ctx.globalAlpha = 1;

  // ② 基座泛光：共鸣/开火时更亮
  const glowA = 0.05 + (resN >= 2 ? 0.06 : 0) + hot * 0.20 + (isBr ? 0.04 : 0);
  ctx.globalAlpha = glowA;
  ctx.fillStyle = gradR("gl" + accent, 27, [[0, accent], [1, "rgba(0,0,0,0)"]]);
  ctx.beginPath(); ctx.arc(0, 2, 27, 0, 6.2832); ctx.fill();
  ctx.globalAlpha = 1;

  // ③ 六边形装甲基座：暗描边打底 → 装甲面 → 内层甲板 → 左上受光边 → 高光斑 → 铆钉
  hexPath(22, Math.PI / 6);
  ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = gradR("pl" + color, 24, [[0, shadeHex(color, -0.6)], [0.6, shadeHex(color, -0.42)], [1, shadeHex(color, -0.22)]]);
  ctx.fill();
  ctx.strokeStyle = isBr ? "#ffe066" : shadeHex(color, 0.32);
  ctx.lineWidth = isBr ? 2.2 : 1.8; ctx.stroke();
  hexPath(17.5, Math.PI / 6);
  ctx.fillStyle = gradR("pl2" + color, 20, [[0, shadeHex(color, -0.4)], [1, shadeHex(color, -0.1)]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.2; ctx.stroke();
  // 左上两道边受光（金属感的经典提示）
  ctx.strokeStyle = shadeHex(color, 0.8); ctx.lineWidth = 1.8; ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(Math.cos(Math.PI * 0.5) * 22, 3 + Math.sin(Math.PI * 0.5) * 22);
  ctx.lineTo(Math.cos(Math.PI * 0.5 + Math.PI / 3) * 22, 3 + Math.sin(Math.PI * 0.5 + Math.PI / 3) * 22);
  ctx.lineTo(Math.cos(Math.PI * 0.5 + Math.PI * 2 / 3) * 22, 3 + Math.sin(Math.PI * 0.5 + Math.PI * 2 / 3) * 22);
  ctx.stroke();
  // 甲板高光斑
  ctx.globalAlpha = 0.13; ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.ellipse(-5, -5, 7, 4, -0.6, 0, 6.2832); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = shadeHex(color, 0.45);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    const px2 = Math.cos(a) * 19.6, py2 = Math.sin(a) * 19.6;
    ctx.moveTo(px2 + 1.6, py2); ctx.arc(px2, py2, 1.6, 0, 6.2832);
  }
  ctx.fill();

  // ④ 等级刻度：沿六边形装甲边缘点亮 12 块甲片（弧长 = 等级进度）
  const SEG = 12, HR = 23.5;
  ctx.lineCap = "butt"; ctx.lineWidth = 2.6;
  const litN = Math.round(lvP * SEG);
  ctx.beginPath();
  for (let i = 0; i < SEG; i++) {
    if (i >= litN) continue;
    const p0 = hexPoint(HR, Math.PI / 6, i / SEG + 0.012);
    const p1 = hexPoint(HR, Math.PI / 6, (i + 1) / SEG - 0.012);
    ctx.moveTo(p0[0], 3 + p0[1]); ctx.lineTo(p1[0], 3 + p1[1]);
  }
  ctx.strokeStyle = accent; ctx.globalAlpha = 0.95; ctx.stroke();
  ctx.globalAlpha = 1; ctx.beginPath();
  for (let i = litN; i < SEG; i++) {
    const p0 = hexPoint(HR, Math.PI / 6, i / SEG + 0.012);
    const p1 = hexPoint(HR, Math.PI / 6, (i + 1) / SEG - 0.012);
    ctx.moveTo(p0[0], 3 + p0[1]); ctx.lineTo(p1[0], 3 + p1[1]);
  }
  ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.stroke();

  // ⑤ 能量核心脉动（图标下方透出的光）
  ctx.globalAlpha = 0.20 + pulse * 0.20 + hot * 0.22;
  ctx.fillStyle = gradR("core" + accent, 14, [[0, "#ffffff"], [0.24, accent], [1, "rgba(0,0,0,0)"]]);
  ctx.beginPath(); ctx.arc(0, -2, 14, 0, 6.2832); ctx.fill();
  ctx.globalAlpha = 1;

  // ⑥ 转塔 + 炮管（待机巡视 / 开火后座 / 能量导管）
  const idleSweep = (b.idle || 0) > 0.35 ? Math.sin(T * 1.05 + (b.pulse || 0) * 0.6) * 0.5 : 0;
  const rot = b.angle + idleSweep;
  ctx.save();
  ctx.translate(0, -3);
  ctx.rotate(rot);
  ctx.translate(-((b.recoil || 0) * 6), 0);
  ctx.fillStyle = gradR("hb" + color, 13, [[0, shadeHex(color, 0.5)], [0.55, shadeHex(color, -0.02)], [1, shadeHex(color, -0.5)]]);
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 2.4; ctx.stroke();
  const branchTrim = b.branch === "a" ? "#ffd166" : (b.branch === "b" ? "#7dd3fc" : shadeHex(color, 0.6));
  ctx.strokeStyle = isBr ? branchTrim : shadeHex(color, 0.6); ctx.lineWidth = isBr ? 1.8 : 1.4; ctx.stroke();
  ctx.strokeStyle = accent; ctx.globalAlpha = 0.72 + pulse * 0.2; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(0, 0, 8.8, -0.2, Math.PI * 1.42); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalAlpha = 0.18; ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.ellipse(-3.5, -3.5, 4.6, 3, -0.7, 0, 6.2832); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.globalAlpha = 0.4 + hot * 0.6;
  ctx.fillStyle = accent;
  ctx.fillRect(5, -1.7, 9, 3.4);
  ctx.globalAlpha = 1;
  drawBarrel(b.type, color, accent, hot, b.branch);
  ctx.restore();

  // ⑦ 炮口闪光 + 冲击环（用 fireFx 自身当进度，零新增状态）
  if (fxF > 0) {
    const muzzle = b.type === "turret" && b.branch === "a" ? 29
      : (b.type === "turret" && b.branch === "b" ? 36 : (TOWER_MUZZLE_LENGTH[b.type] || 28));
    const tipX = Math.cos(rot) * muzzle, tipY = -3 + Math.sin(rot) * muzzle;
    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.globalAlpha = (1 - hot) * 0.55;
    ctx.strokeStyle = accent; ctx.lineWidth = 1 + (1 - hot) * 2.2;
    ctx.beginPath(); ctx.arc(0, 0, 6 + (1 - hot) * 20, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = hot * 0.85;
    ctx.fillStyle = gradR("mf" + accent, 19, [[0, "#ffffff"], [0.28, accent], [1, "rgba(255,255,255,0)"]]);
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, 6.2832); ctx.fill();
    ctx.rotate(rot);
    ctx.globalAlpha = hot * 0.85; ctx.fillStyle = accent;
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(22, -8.5); ctx.lineTo(31, 0); ctx.lineTo(22, 8.5); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.globalAlpha = hot;
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(30, 0); ctx.lineTo(0, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -1.6); ctx.lineTo(-15, 0); ctx.lineTo(0, 1.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ⑧ 类型专属场效
  if (b.type === "gravity") {
    const rg = Math.max(80, Math.round((s.range || 300) / 40) * 40);
    ctx.globalAlpha = 0.15 + Math.sin(T * 2.4) * 0.05;
    ctx.fillStyle = gradR("gvf" + rg, rg, [[0, "rgba(129,140,248,.8)"], [0.45, "rgba(99,102,241,.22)"], [1, "rgba(49,46,129,0)"]]);
    ctx.beginPath(); ctx.arc(0, 0, rg, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 0.45; ctx.strokeStyle = "rgba(165,180,252,.5)"; ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 6]); ctx.lineDashOffset = -T * 12;
    ctx.beginPath(); ctx.arc(0, 0, rg, 0, 6.2832); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
    for (let i = 0; i < 4; i++) {
      const a = T * (1.0 + i * 0.42) + i * 1.7, r2 = rg * (0.22 + i * 0.19);
      ctx.globalAlpha = 0.4; ctx.fillStyle = "#c7d2fe";
      ctx.beginPath(); ctx.arc(Math.cos(a) * r2, Math.sin(a) * r2, 2.2, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (b.type === "flame" && b.flameOn) {
    ctx.globalAlpha = 0.3 + Math.sin(T * 16) * 0.1;
    ctx.fillStyle = gradR("flburn", Math.max(40, s.radius || 110), [[0, "rgba(255,180,80,.55)"], [0.6, "rgba(255,120,40,.18)"], [1, "rgba(255,80,20,0)"]]);
    ctx.beginPath(); ctx.arc(0, 0, Math.max(40, s.radius || 110), 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
  } else if (b.type === "sonic") {
    ctx.globalAlpha = 0.4 + Math.sin(T * 5) * 0.12;
    ctx.strokeStyle = "rgba(240,171,252,.55)"; ctx.lineWidth = 1.4;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath(); ctx.arc(0, 0, 16 + i * 13 + Math.sin(T * 3 + i) * 2, -0.55, 0.55); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ⑨ 共鸣：旋转虚线环 + 三颗环绕能量点（元素种类越多转得越快）
  if (resN >= 2) {
    const spin = T * (0.6 + resN * 0.2);
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = rc; ctx.lineWidth = 1.4;
    ctx.setLineDash([10, 12]); ctx.lineDashOffset = -spin * 12;
    ctx.beginPath(); ctx.arc(0, 2, 33, 0, 6.2832); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.85; ctx.fillStyle = rc;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = spin + i * 2.0944;
      const dx2 = Math.cos(a) * 33, dy2 = 2 + Math.sin(a) * 33;
      ctx.moveTo(dx2 + 1.9, dy2); ctx.arc(dx2, dy2, 1.9, 0, 6.2832);
    }
    ctx.fill();
    ctx.restore();
  }

  // ⑩ 转职塔：漂浮的金色符文微粒
  if (isBr) {
    ctx.save();
    ctx.fillStyle = "#ffe066";
    ctx.globalAlpha = 0.62; ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = T * 0.9 + i * 2.0944;
      const rr2 = 27 + Math.sin(T * 2 + i) * 2;
      const dx3 = Math.cos(a) * rr2, dy3 = 2 + Math.sin(a) * rr2;
      ctx.moveTo(dx3 + 1.5, dy3); ctx.arc(dx3, dy3, 1.5, 0, 6.2832);
    }
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
/** 非炮塔建筑：同一套装甲语言，但更低调，不抢炮塔的视觉焦点 */
function drawSupportArt(b, color) {
  const glow = 0.5 + Math.sin(T * 2 + (b.pulse || 0)) * 0.18;
  ctx.save();
  ctx.translate(b.x, b.y + 2);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = gradR("sh" + color, 26, [[0, "rgba(0,0,0,.6)"], [1, "rgba(0,0,0,0)"]]);
  ctx.beginPath(); ctx.ellipse(0, 14, 24, 9, 0, 0, 6.2832); ctx.fill();
  ctx.globalAlpha = 1;
  hexPath(19, Math.PI / 6);
  ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = 3.6; ctx.stroke();
  ctx.fillStyle = gradR("pl" + color, 22, [[0, shadeHex(color, -0.58)], [0.6, shadeHex(color, -0.4)], [1, shadeHex(color, -0.2)]]);
  ctx.fill();
  ctx.strokeStyle = shadeHex(color, 0.3); ctx.lineWidth = 1.6; ctx.stroke();
  hexPath(14.5, Math.PI / 6);
  ctx.fillStyle = gradR("pl2" + color, 18, [[0, shadeHex(color, -0.38)], [1, shadeHex(color, -0.08)]]);
  ctx.fill();
  ctx.globalAlpha = 0.12; ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.ellipse(-4, -4, 6, 3.4, -0.6, 0, 6.2832); ctx.fill();
  ctx.globalAlpha = 1;
  // 沿装甲边缘的甲片刻度（5 段，表示等级进度）
  const lvP2 = clamp((b.level || 1) / (b.def.maxLv || 50), 0, 1);
  ctx.lineCap = "butt"; ctx.lineWidth = 2.2;
  const lit2 = Math.round(lvP2 * 5);
  ctx.beginPath();
  for (let i = 0; i < lit2; i++) {
    const q0 = hexPoint(20.5, Math.PI / 6, i / 5 + 0.015);
    const q1 = hexPoint(20.5, Math.PI / 6, (i + 1) / 5 - 0.015);
    ctx.moveTo(q0[0], 3 + q0[1]); ctx.lineTo(q1[0], 3 + q1[1]);
  }
  ctx.strokeStyle = shadeHex(color, 0.35); ctx.stroke();
  ctx.beginPath();
  for (let i = lit2; i < 5; i++) {
    const q0 = hexPoint(20.5, Math.PI / 6, i / 5 + 0.015);
    const q1 = hexPoint(20.5, Math.PI / 6, (i + 1) / 5 - 0.015);
    ctx.moveTo(q0[0], 3 + q0[1]); ctx.lineTo(q1[0], 3 + q1[1]);
  }
  ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.stroke();
  ctx.globalAlpha = glow * 0.55;
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.setLineDash([3, 5]); ctx.lineDashOffset = -T * 8;
  ctx.beginPath(); ctx.arc(0, 3, 22.5, 0, 6.2832); ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  ctx.globalAlpha = 0.22 + glow * 0.2;
  ctx.fillStyle = gradR("core" + color, 13, [[0, "#ffffff"], [0.25, color], [1, "rgba(0,0,0,0)"]]);
  ctx.beginPath(); ctx.arc(0, -2, 13, 0, 6.2832); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}
function drawBuildings() {
  const frameDt = typeof dt !== 'undefined' && Number.isFinite(dt) ? Math.max(0, dt) : 1 / 60;
  for (const b of G.buildings) {
    // 建造落地动画
    if (b.animY !== undefined && b.animY < 0) {
      b.animY += 300 * frameDt;
      if (b.animY >= 0) { b.animY = 0; b.animBounce = 0.3; }
    }
    if (b.animBounce > 0) {
      b.animBounce -= frameDt * 3;
    }
    // 开火脉冲衰减
    if (b.fireFx > 0) b.fireFx = Math.max(0, b.fireFx - frameDt);
    if (b.recoil > 0) b.recoil = Math.max(0, b.recoil - frameDt * 9);
    const buildOffsetY = b.animY !== undefined ? b.animY : 0;
    const fireScale = b.fireFx > 0 ? 0.04 * Math.min(b.fireFx * 4, 1) : 0;
    const buildScale = (b.animBounce > 0 ? 1 + 0.1 * Math.sin(b.animBounce * 10) : 1) + fireScale;

    const R = cellRect(b.col, b.row);
    const s = bstat(b);
    const icon = b.branch ? b.def.branch[b.branch].icon : b.def.icon;
    const color = b.def.color;

    ctx.save();
    ctx.translate(b.x, b.y + buildOffsetY);
    ctx.scale(buildScale, buildScale);
    ctx.translate(-b.x, -b.y);

    ctx.fillStyle = 'rgba(0,0,0,.25)'; rr(R.x + 8, R.y + 10, R.w - 16, R.h - 16, 8); ctx.fill();
    const gl = gradR('cg' + color, 38, [[0, color + '2e'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(b.x, b.y, 38, 0, 6.2832); ctx.fill();
    ctx.fillStyle = b.branch ? 'rgba(255,224,102,.07)' : 'rgba(255,255,255,.045)';
    rr(R.x + 10, R.y + 14, R.w - 20, R.h - 24, 6); ctx.fill();
    ctx.strokeStyle = b.branch ? 'rgba(255,224,102,.75)' : color + '3d'; ctx.lineWidth = b.branch ? 2 : 1.2; ctx.stroke();
    if (b.def.tower) drawTowerArt(b, s, color);
    else drawSupportArt(b, color);
    // 元素宝石（替代原先右上角的纯色圆点）：按伤害类型着色，带内高光
    if (b.def.tower && b.def.dmgType) {
      const gx = R.x + R.w - 15, gy = R.y + 15, gc = DMG[b.def.dmgType].color;
      ctx.fillStyle = gc; ctx.globalAlpha = 0.16;
      ctx.beginPath(); ctx.arc(gx, gy, 8.5, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(gx, gy);
      ctx.fillStyle = gradR('gm' + gc, 5.6, [[0, '#ffffff'], [0.42, gc], [1, shadeHex(gc, -0.5)]]);
      ctx.beginPath(); ctx.arc(0, 0, 5.2, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath(); ctx.arc(-1.5, -1.5, 1.5, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    emoji(icon, b.x, b.y - 6, 24);
    const nm = buildName(b);
    ctx.font = 'bold 9.5px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.strokeText(nm, b.x, R.y + R.h - 17);
    ctx.fillStyle = b.branch ? '#ffe066' : '#ddd8f5'; ctx.fillText(nm, b.x, R.y + R.h - 17);
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = b.branch ? '#ffe066' : '#9ef01a';
    ctx.fillText('Lv' + b.level + '/50', b.x, R.y + R.h - 6);
    const bw = 58, bx = b.x - bw / 2, by = R.y + 5;
    if (b.hp < b.maxHp) gbar(bx, by, bw, 5, b.hp / b.maxHp, b.hp / b.maxHp < 0.3 ? '#f87171' : (b.hp / b.maxHp < 0.6 ? '#fbbf24' : '#4ade80'));
    if (b.shield > 0) {
      gbar(bx, by + 7, bw, 3.5, b.maxHp ? b.shield / Math.max(1, b.shieldMax || b.maxHp) : 0, '#5de6ff');
      ctx.strokeStyle = 'rgba(93,230,255,.65)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(b.x, b.y - 2, 20, 0, 6.2832); ctx.stroke();
    }
    if (b.def.tower && (b.empT > 0 || b.freezeT > 0)) {
      const dis = b.empT > 0;
      ctx.save(); ctx.globalAlpha = 0.55 + Math.sin(T * 9) * 0.3;
      ctx.fillStyle = dis ? 'rgba(103,232,249,.35)' : 'rgba(165,243,252,.3)';
      rr(R.x + 10, R.y + 14, R.w - 20, R.h - 24, 6); ctx.fill();
      ctx.restore();
      ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(dis ? '📴' : '❄️', b.x, R.y + R.h / 2 + 2);
    }
    if (!b.branch && b.level >= BRANCH_AT && b.def.branch) {
      ctx.fillStyle = 'rgba(255,224,102,' + (0.5 + 0.4 * Math.sin(T * 5)) + ')'; ctx.font = 'bold 9px sans-serif';
      ctx.fillText('可转职', b.x, R.y + 12);
    }
    /* 炮塔共鸣可视化 —— 相邻不同元素炮塔会互相增幅，但这套机制原先在画面上完全看不见：
       虚线光环表示「正在共鸣」，左上角徽记显示参与的元素种类数，颜色对应共鸣档位。 */
    if (b.def.tower && b.resN >= 2) {
      const rc = b.resColor || '#7dd3fc';
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = rc; ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 6]); ctx.lineDashOffset = -T * 14;
      ctx.beginPath(); ctx.arc(b.x, b.y, 30, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      ctx.globalAlpha = 0.07; ctx.fillStyle = rc;
      ctx.beginPath(); ctx.arc(b.x, b.y, 30, 0, 6.2832); ctx.fill();
      ctx.restore();
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.85)';
      const badge = '🎵' + b.resN;
      ctx.strokeText(badge, R.x + 15, R.y + 15);
      ctx.fillStyle = rc; ctx.fillText(badge, R.x + 15, R.y + 15);
    }
    // 选中建筑脉冲光环
    if (selected === b) {
      const pulse = 0.5 + 0.5 * Math.sin(T * 4);
      const radius = 24 + pulse * 8;
      const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, radius);
      grd.addColorStop(0, 'rgba(168,85,247,0.5)');
      grd.addColorStop(1, 'rgba(168,85,247,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(b.x, b.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore(); // 结束建筑动画变换
  }
}
function drawBed() {
  const x = BED_CX, y = BED_CY;
  const R = cellRect(7, 1);
  const bedH = R.h * 2, bedX = R.x + 12, bedY = R.y + 9;
  const bedW = R.w - 24, bedD = bedH - 22;
  const gp = clamp((G.grow || 0) / 25, 0, 1);
  const hp = G.bed.maxHp > 0 ? clamp(G.bed.hp / G.bed.maxHp, 0, 1) : 1;
  const breathe = Math.sin(T * 1.35) * 1.2;

  // 床是防线核心：先绘制随发育等级增强的柔和灵光，再画木框和寝具。
  const bedGlow = ctx.createRadialGradient(x, y, 10, x, y, 82);
  bedGlow.addColorStop(0, 'rgba(93,130,190,' + (0.13 + gp * 0.12) + ')');
  bedGlow.addColorStop(0.58, 'rgba(93,80,160,.08)');
  bedGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = bedGlow; ctx.beginPath(); ctx.arc(x, y, 82, 0, 6.2832); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  ctx.beginPath(); ctx.ellipse(x + 5, y + 8, bedW * .66, bedD * .48, 0, 0, 6.2832); ctx.fill();

  const growGrad = ctx.createRadialGradient(x, y, 32, x, y, 54 + gp * 18);
  growGrad.addColorStop(0, 'rgba(124,243,154,' + (0.025 + gp * 0.11) + ')');
  growGrad.addColorStop(.72, 'rgba(124,243,154,' + (0.035 + gp * 0.13) + ')');
  growGrad.addColorStop(1, 'rgba(124,243,154,0)');
  ctx.fillStyle = growGrad; ctx.beginPath(); ctx.arc(x, y, 72, 0, 6.2832); ctx.fill();

  // 深色木框、软包床头与黄铜包角，让床在密集战场中仍然一眼可辨。
  const wood = ctx.createLinearGradient(bedX, bedY, bedX + bedW, bedY + bedD);
  wood.addColorStop(0, '#473955'); wood.addColorStop(.48, '#302940'); wood.addColorStop(1, '#211e32');
  ctx.fillStyle = wood; rr(bedX, bedY, bedW, bedD, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(223,193,139,.55)'; ctx.lineWidth = 1.3;
  rr(bedX + 1, bedY + 1, bedW - 2, bedD - 2, 11); ctx.stroke();
  ctx.fillStyle = 'rgba(218,190,143,.52)';
  [[bedX + 5, bedY + 6], [bedX + bedW - 5, bedY + 6],
    [bedX + 5, bedY + bedD - 6], [bedX + bedW - 5, bedY + bedD - 6]].forEach(p => {
    ctx.beginPath(); ctx.arc(p[0], p[1], 1.5, 0, 6.2832); ctx.fill();
  });

  const headY = bedY + 5, headH = 29;
  const head = ctx.createLinearGradient(bedX, headY, bedX, headY + headH);
  head.addColorStop(0, '#76658e'); head.addColorStop(1, '#403854');
  ctx.fillStyle = head; rr(bedX + 5, headY, bedW - 10, headH, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(233,218,187,.35)'; ctx.lineWidth = 1;
  rr(bedX + 8, headY + 3, bedW - 16, headH - 6, 6); ctx.stroke();
  ctx.fillStyle = 'rgba(232,217,182,.9)';
  ctx.beginPath(); ctx.arc(x, headY + headH / 2, 2.1, 0, 6.2832); ctx.fill();
  ctx.fillStyle = 'rgba(198,179,234,.8)';
  ctx.beginPath(); ctx.arc(x - 12, headY + headH / 2, 1, 0, 6.2832); ctx.arc(x + 12, headY + headH / 2, 1, 0, 6.2832); ctx.fill();

  const mattress = { x: bedX + 7, y: headY + headH - 1, w: bedW - 14, h: bedD - headH - 11 };
  const matGrad = ctx.createLinearGradient(mattress.x, mattress.y, mattress.x + mattress.w, mattress.y + mattress.h);
  matGrad.addColorStop(0, '#ddd9ed'); matGrad.addColorStop(.46, '#b9bbd5'); matGrad.addColorStop(1, '#8589ad');
  ctx.fillStyle = matGrad; rr(mattress.x, mattress.y, mattress.w, mattress.h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
  rr(mattress.x + 1, mattress.y + 1, mattress.w - 2, mattress.h - 2, 7); ctx.stroke();

  // 枕头、侧躺的孩子与绗缝被面；轻微呼吸只移动被角，不影响碰撞或战斗判定。
  const pillow = { x: x - 24, y: mattress.y + 5, w: 48, h: 25 };
  const pillowGrad = ctx.createLinearGradient(pillow.x, pillow.y, pillow.x, pillow.y + pillow.h);
  pillowGrad.addColorStop(0, '#fff4e5'); pillowGrad.addColorStop(1, '#c7c7e2');
  ctx.fillStyle = pillowGrad; rr(pillow.x, pillow.y, pillow.w, pillow.h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(115,111,153,.4)'; ctx.lineWidth = 1;
  rr(pillow.x + 3, pillow.y + 3, pillow.w - 6, pillow.h - 6, 6); ctx.stroke();

  const faceX = x - 3, faceY = pillow.y + 18 + breathe * .25;
  ctx.fillStyle = '#e9bb9e'; ctx.beginPath(); ctx.ellipse(faceX, faceY, 12, 9, .08, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#302b42'; ctx.beginPath(); ctx.ellipse(faceX - 1, faceY - 5, 12, 6, -.12, Math.PI, 6.2832); ctx.fill();
  ctx.strokeStyle = 'rgba(72,54,59,.82)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(faceX - 7, faceY + 1); ctx.quadraticCurveTo(faceX - 5, faceY + 3, faceX - 3, faceY + 1);
  ctx.moveTo(faceX + 1, faceY + 1); ctx.quadraticCurveTo(faceX + 3, faceY + 3, faceX + 5, faceY + 1); ctx.stroke();

  const quilt = { x: mattress.x + 3, y: pillow.y + 23 + breathe, w: mattress.w - 6, h: mattress.y + mattress.h - pillow.y - 28 };
  const quiltGrad = ctx.createLinearGradient(quilt.x, quilt.y, quilt.x + quilt.w, quilt.y + quilt.h);
  quiltGrad.addColorStop(0, '#6d91b5'); quiltGrad.addColorStop(.52, '#526d91'); quiltGrad.addColorStop(1, '#34455f');
  ctx.fillStyle = quiltGrad; rr(quilt.x, quilt.y, quilt.w, quilt.h, 10); ctx.fill();
  ctx.save(); rr(quilt.x, quilt.y, quilt.w, quilt.h, 10); ctx.clip();
  ctx.strokeStyle = 'rgba(222,232,246,.30)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(quilt.x + 6, quilt.y + 13); ctx.quadraticCurveTo(x, quilt.y + 4, quilt.x + quilt.w - 6, quilt.y + 14);
  ctx.moveTo(quilt.x + 8, quilt.y + quilt.h * .47); ctx.quadraticCurveTo(x - 5, quilt.y + quilt.h * .40, quilt.x + quilt.w - 8, quilt.y + quilt.h * .49);
  ctx.moveTo(quilt.x + 7, quilt.y + quilt.h - 11); ctx.quadraticCurveTo(x, quilt.y + quilt.h - 18, quilt.x + quilt.w - 7, quilt.y + quilt.h - 11);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(220,228,244,.22)'; ctx.lineWidth = .7;
  for (let i = 0; i < 4; i++) {
    const sy = quilt.y + 21 + i * 16;
    if (sy < quilt.y + quilt.h - 8) { ctx.beginPath(); ctx.moveTo(quilt.x + 7, sy); ctx.lineTo(quilt.x + 11, sy + 2); ctx.stroke(); }
  }
  // 缝在被角上的小月亮，呼应主界面停在 03:07 的梦境意象。
  const moonX = x + 17, moonY = quilt.y + quilt.h - 17;
  ctx.fillStyle = 'rgba(244,218,164,.9)'; ctx.beginPath(); ctx.arc(moonX, moonY, 4.2, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#435b79'; ctx.beginPath(); ctx.arc(moonX + 2, moonY - 1.5, 4, 0, 6.2832); ctx.fill();
  ctx.fillStyle = 'rgba(242,228,190,.9)'; ctx.beginPath(); ctx.arc(moonX - 9, moonY - 5, 1, 0, 6.2832); ctx.arc(moonX + 8, moonY + 4, .8, 0, 6.2832); ctx.fill();
  if (hp < .3) {
    ctx.globalAlpha = .45 + Math.sin(T * 5) * .12;
    ctx.strokeStyle = 'rgba(255,135,151,.86)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(quilt.x + 9, quilt.y + 9); ctx.lineTo(quilt.x + 14, quilt.y + 19);
    ctx.lineTo(quilt.x + 10, quilt.y + 27); ctx.moveTo(quilt.x + 14, quilt.y + 19); ctx.lineTo(quilt.x + 20, quilt.y + 22); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // 发育等级光点沿床侧缓慢巡游，保留原有效果但降低遮挡。
  if (gp > .2) {
    const count = Math.min(5, Math.floor((G.grow || 0) / 5));
    for (let i = 0; i < count; i++) {
      const angle = T * .42 + i * (Math.PI * 2 / Math.max(1, count));
      const radius = 54 + gp * 13;
      const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
      ctx.globalAlpha = .28 + Math.sin(T * 2.5 + i) * .16;
      ctx.fillStyle = '#9bf4b4'; ctx.beginPath(); ctx.arc(px, py, 1.5, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const zt = (T * .7) % 1;
  ctx.save(); ctx.globalAlpha = 1 - zt; ctx.fillStyle = 'rgba(221,232,255,.78)';
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('z', x - 18 - zt * 8, mattress.y + 11 - zt * 20); ctx.restore();
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
    if (e.type === 'laser') {
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
      for (let i = 1; i <= 5; i++) { const t = i / 5; ctx.lineTo(e.x + (e.x2 - e.x) * t + rnd(-12, 12), e.y + (e.y2 - e.y) * t + rnd(-12, 12)); }
      ctx.stroke();
      // 内层白芯
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(e.x, e.y);
      for (let i = 1; i <= 5; i++) { const t = i / 5; ctx.lineTo(e.x + (e.x2 - e.x) * t + rnd(-8, 8), e.y + (e.y2 - e.y) * t + rnd(-8, 8)); }
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
    emoji(def.icon, R.x + R.w / 2, R.y + R.h / 2, 26);
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
