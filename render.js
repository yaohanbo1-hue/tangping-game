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
function drawBuildings() {
  for (const b of G.buildings) {
    // 建造落地动画
    if (b.animY !== undefined && b.animY < 0) {
      b.animY += 300 * (typeof dt !== 'undefined' ? dt : 0.016);
      if (b.animY >= 0) { b.animY = 0; b.animBounce = 0.3; }
    }
    if (b.animBounce > 0) {
      b.animBounce -= (typeof dt !== 'undefined' ? dt : 0.016) * 3;
    }
    // 开火脉冲衰减
    if (b.fireFx > 0) b.fireFx -= 0.016;
    const buildOffsetY = b.animY !== undefined ? b.animY : 0;
    const fireScale = b.fireFx > 0 ? 1 + 0.04 * Math.min(b.fireFx * 4, 1) : 0;
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
    const gl = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 46);
    gl.addColorStop(0, color + '44'); gl.addColorStop(1, 'transparent');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(b.x, b.y, 46, 0, 6.2832); ctx.fill();
    ctx.fillStyle = b.branch ? 'rgba(255,224,102,.10)' : 'rgba(255,255,255,.07)';
    rr(R.x + 10, R.y + 14, R.w - 20, R.h - 24, 6); ctx.fill();
    ctx.strokeStyle = b.branch ? '#ffe066' : color + '66'; ctx.lineWidth = b.branch ? 2 : 1.5; ctx.stroke();
    if (b.def.tower) {
      ctx.save(); ctx.translate(b.x, b.y + 2); ctx.rotate(b.angle);
      ctx.fillStyle = color;
      if (b.type === 'laser') { ctx.fillRect(0, -2.5, 30, 5); ctx.fillStyle = '#fff'; ctx.fillRect(24, -1.5, 6, 3); }
      else if (b.type === 'flame') { ctx.fillStyle = '#ff8c42'; ctx.fillRect(0, -4, 22, 8); }
      else if (b.type === 'tesla') { ctx.strokeStyle = '#c77dff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(26, 0, 4, 0, 6.2832); ctx.fillStyle = '#e9d5ff'; ctx.fill(); }
      else { ctx.fillRect(0, -3, b.type === 'frost' ? 24 : 26, 6); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(18, -2, 6, 4); }
      ctx.restore();
      if (b.cd > 0.82) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(b.x + Math.cos(b.angle) * 28, b.y + 2 + Math.sin(b.angle) * 28, 5, 0, 6.2832); ctx.fill(); }
      if (b.type === 'gravity') {
        const s2 = bstat(b);
        ctx.save(); ctx.globalAlpha = 0.16 + Math.sin(T * 2.4) * 0.05;
        const g3 = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, s2.range || 300);
        g3.addColorStop(0, 'rgba(129,140,248,.75)'); g3.addColorStop(0.5, 'rgba(99,102,241,.22)'); g3.addColorStop(1, 'transparent');
        ctx.fillStyle = g3; ctx.beginPath(); ctx.arc(b.x, b.y, s2.range || 300, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(165,180,252,.5)'; ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(b.x, b.y, s2.range || 300, 0, 6.2832); ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < 3; i++) {
          const a = T * (1.1 + i * 0.5) + i * 2.1, rr2 = (s2.range || 300) * (0.28 + i * 0.22);
          ctx.globalAlpha = 0.34; ctx.fillStyle = '#c7d2fe';
          ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * rr2, b.y + Math.sin(a) * rr2, 2.4, 0, 6.2832); ctx.fill();
        }
        ctx.restore();
      }
      if (b.type === 'flame' && b.flameOn) {
        ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(T * 18) * 0.2;
        ctx.fillStyle = '#ff8c42'; ctx.beginPath(); ctx.arc(b.x, b.y, s.radius * 0.35, 0, 6.2832); ctx.fill(); ctx.restore();
      }
      if (b.def.dmgType) {
        ctx.fillStyle = DMG[b.def.dmgType].color; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(R.x + R.w - 16, R.y + 16, 5, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    emoji(icon, b.x, b.y - 4, 30);
    // 开火光晕
    if (b.fireFx > 0 && b.def.tower) {
      ctx.save();
      ctx.globalAlpha = b.fireFx * 3;
      const fg = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 38);
      fg.addColorStop(0, color + 'bb');
      fg.addColorStop(0.5, color + '44');
      fg.addColorStop(1, 'transparent');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(b.x, b.y, 38, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    const nm = buildName(b);
    ctx.font = 'bold 9.5px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.strokeText(nm, b.x, R.y + R.h - 17);
    ctx.fillStyle = b.branch ? '#ffe066' : '#ddd8f5'; ctx.fillText(nm, b.x, R.y + R.h - 17);
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = b.branch ? '#ffe066' : '#9ef01a';
    ctx.fillText('Lv' + b.level + '/50', b.x, R.y + R.h - 6);
    if (b.hp < b.maxHp) bar(b.x - 32, R.y + 4, 64, 5, b.hp / b.maxHp, '#4ade80');
    if (b.shield > 0) {
      ctx.strokeStyle = 'rgba(93,230,255,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y - 4, 22, 0, 6.2832); ctx.stroke();
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
  // 床铺背景光晕
  const bedGlow = ctx.createRadialGradient(x, y, 10, x, y, 80);
  bedGlow.addColorStop(0, 'rgba(93,80,160,.25)');
  bedGlow.addColorStop(0.5, 'rgba(93,80,160,.08)');
  bedGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = bedGlow; ctx.beginPath(); ctx.arc(x, y, 80, 0, 6.2832); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.28)'; rr(R.x + 6, R.y + 8, R.w - 12, (R.h * 2) - 14, 12); ctx.fill();
  ctx.fillStyle = '#5b4b8a'; rr(R.x + 14, R.y + 16, R.w - 28, (R.h * 2) - 30, 10); ctx.fill();
  ctx.fillStyle = '#7d68b8'; rr(R.x + 14, R.y + 16, R.w - 28, 22, 10); ctx.fill();
  ctx.fillStyle = '#e8e0ff'; rr(R.x + 20, R.y + 18, 34, 20, 6); ctx.fill();
  const breathe = Math.sin(T * 1.6) * 2;
  ctx.save(); ctx.translate(x + 6, y + 6 + breathe);
  ctx.fillStyle = '#ffd9b3'; ctx.beginPath(); ctx.arc(-26, 0, 11, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#4a3f6b'; ctx.beginPath(); ctx.arc(-26, -3, 11, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#6fd3ff'; rr(-12, -9, 46, 18, 8); ctx.fill();
  ctx.fillStyle = '#ffd9b3'; ctx.beginPath(); ctx.arc(30, -4, 6, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-32, -1); ctx.lineTo(-28, -1); ctx.moveTo(-24, -1); ctx.lineTo(-20, -1); ctx.stroke();
  ctx.fillStyle = 'rgba(200,220,255,.75)'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  const zt = (T * 0.7) % 1;
  ctx.globalAlpha = 1 - zt; ctx.fillText('z', -34 - zt * 14, -14 - zt * 22);
  ctx.restore();
  const gp = G.grow / 25;
  // 发育光环（多层渐变）
  ctx.beginPath(); ctx.arc(x + 6, y + 6, 46 + gp * 18, 0, 6.2832);
  const growGrad = ctx.createRadialGradient(x + 6, y + 6, 30, x + 6, y + 6, 46 + gp * 18);
  growGrad.addColorStop(0, 'rgba(124,243,154,' + (0.05 + gp * 0.15) + ')');
  growGrad.addColorStop(0.7, 'rgba(124,243,154,' + (0.08 + gp * 0.2) + ')');
  growGrad.addColorStop(1, 'rgba(124,243,154,0)');
  ctx.fillStyle = growGrad; ctx.fill();
  ctx.strokeStyle = 'rgba(124,243,154,' + (0.15 + gp * 0.35) + ')';
  ctx.lineWidth = 1.5 + gp * 2.5; ctx.stroke();
  // 发育等级光点
  if (gp > 0.2) {
    for (let i = 0; i < Math.floor(G.grow / 5); i++) {
      const angle = T * 0.5 + i * (Math.PI * 2 / Math.max(1, Math.floor(G.grow / 5)));
      const r = 50 + gp * 15;
      const px = x + 6 + Math.cos(angle) * r;
      const py = y + 6 + Math.sin(angle) * r;
      const a = 0.4 + Math.sin(T * 3 + i) * 0.3;
      ctx.fillStyle = 'rgba(124,243,154,' + a + ')';
      ctx.beginPath(); ctx.arc(px, py, 2, 0, 6.2832); ctx.fill();
    }
  }
  if (G.bed.shield > 0) {
    ctx.strokeStyle = 'rgba(93,230,255,.6)'; ctx.lineWidth = 2;
    rr(R.x + 10, R.y + 12, R.w - 20, (R.h * 2) - 22, 12); ctx.stroke();
  }
  if (G.bed.hp < G.bed.maxHp) bar(x - 40, R.y + 2, 80, 6, G.bed.hp / G.bed.maxHp, '#4ade80');
  const bn = bedName();
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)';
  ctx.strokeText(bn, x + 6, R.y + R.h * 2 - 16);
  ctx.fillStyle = '#ffd166'; ctx.fillText(bn, x + 6, R.y + R.h * 2 - 16);
  ctx.font = 'bold 9.5px sans-serif'; ctx.fillStyle = '#9ef01a';
  ctx.fillText('Lv' + G.bed.lv + '/50  ' + fmt(bedGold()) + '/秒', x + 6, R.y + R.h * 2 - 4);
}
function drawEnemies() {
  for (const e of G.enemies) {
    if (e.dead) continue;
    const sp = enemySpeed(e);
    const bob = Math.sin(T * 8 + e.wob) * (sp > 0 ? 3 : 0.5) + (e.def.flying ? Math.sin(T * 4 + e.wob) * 6 : 0);
    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.9, e.r * 0.8, e.r * 0.3, 0, 0, 6.2832); ctx.fill();
    const gl = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, e.r * 2);
    gl.addColorStop(0, e.def.color + (e.boss ? '77' : (e.elite ? '66' : '44'))); gl.addColorStop(1, 'transparent');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 2, 0, 6.2832); ctx.fill();
    if (e.elite) {
      // 精英光环
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(T * 3) * 0.1;
      const eliteGlow = ctx.createRadialGradient(e.x, e.y, e.r * 0.3, e.x, e.y, e.r * 2.5);
      const affixColor = AFFIX[e.affixes[0]].color;
      eliteGlow.addColorStop(0, affixColor + '55');
      eliteGlow.addColorStop(0.5, affixColor + '22');
      eliteGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = eliteGlow;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 2.5, 0, 6.2832); ctx.fill();
      ctx.restore();
      // 旋转虚线圈
      ctx.strokeStyle = AFFIX[e.affixes[0]].color; ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]); ctx.lineDashOffset = -T * 12;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
    if (G.buff.freeze > 0 || e.stun > 0) { ctx.strokeStyle = 'rgba(127,223,255,.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, 6.2832); ctx.stroke(); }
    if (e.slowT > 0) { ctx.fillStyle = 'rgba(127,223,255,.22)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, 6.2832); ctx.fill(); }
    emoji(e.def.icon, e.x, e.y + bob - 2, e.r * 1.9);
    // 受击白色闪烁
    if (e.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = e.hitFlash * 5; // 快速闪烁
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x, e.y + bob - 2, e.r * 1.2, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    if (e.affixes.length) {
      ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
      let ox = -((e.affixes.length - 1) * 13) / 2;
      e.affixes.forEach(k => { ctx.fillText(AFFIX[k].icon, e.x + ox, e.y - e.r - 16); ox += 13; });
    }
    ctx.restore();
    if (e.def.emp || e.def.freezeTower || e.def.parasite) {
      ctx.save(); ctx.globalAlpha = e.alpha;
      const pulse2 = 0.6 + Math.sin(T * 6) * 0.35;
      if (e.def.emp) { ctx.strokeStyle = 'rgba(103,232,249,' + pulse2 + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 12, 0, 6.2832); ctx.stroke(); }
      if (e.parasiteTarget) { ctx.strokeStyle = 'rgba(132,204,22,.75)'; ctx.lineWidth = 2; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.parasiteTarget.x, e.parasiteTarget.y); ctx.stroke(); ctx.setLineDash([]); }
      if (e.def.mimic && !e.mimicRevealed) { ctx.fillStyle = 'rgba(240,171,252,.9)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('🎭', e.x, e.y - e.r - 12); }
      ctx.restore();
    }
    const w = e.boss ? 76 : e.r * 2.2;
    if (e.hp < e.maxHp || e.boss || e.elite) {
      // 血条背景光晕（BOSS/精英）
      if (e.boss || e.elite) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.shadowColor = e.boss ? '#ff4d6d' : '#fb923c';
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        rr(e.x - w / 2 - 1, e.y - e.r - 10, w + 2, (e.boss ? 7 : 4) + 2, 3);
        ctx.fill();
        ctx.restore();
      }
      // 血条颜色：低血量时脉动警告
      let barColor = e.boss ? '#ff4d6d' : (e.elite ? '#fb923c' : '#f87171');
      const hpRatio = e.hp / e.maxHp;
      if (hpRatio < 0.25) {
        const warnPulse = 0.7 + Math.sin(T * 8) * 0.3;
        barColor = e.boss ? `rgba(255,77,109,${warnPulse})` : `rgba(248,113,113,${warnPulse})`;
      }
      bar(e.x - w / 2, e.y - e.r - 9, w, e.boss ? 7 : 4, hpRatio, barColor, 'rgba(255,255,255,.2)');
    }
    if (e.shieldMax && e.shield > 0) bar(e.x - w / 2, e.y - e.r - (e.boss ? 15 : 13), w, 3, e.shield / e.shieldMax, '#5de6ff');
    if (e.boss) {
      // BOSS 大光环
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(T * 2) * 0.15;
      const bossGlow = ctx.createRadialGradient(e.x, e.y, e.r * 0.5, e.x, e.y, e.r * 3);
      bossGlow.addColorStop(0, 'rgba(255,77,109,.4)');
      bossGlow.addColorStop(0.5, 'rgba(255,77,109,.1)');
      bossGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = bossGlow;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 3, 0, 6.2832); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd166'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      const bdef = BOSS_DEFS[e.bossKey] || { name: e.def.name, phases: BOSS_PHASES };
      const phN = (bdef.phases[e.phase] || { name: '' }).name;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.strokeText('👑 ' + bdef.name + ' · ' + phN, e.x, e.y - e.r - 24);
      ctx.fillText('👑 ' + bdef.name + ' · ' + phN, e.x, e.y - e.r - 24);
    }
  }
}
function drawBullets() {
  for (const b of G.bullets) {
    if (b.type === 'frost') {
      // 冰霜弹：发光球 + 冰晶拖尾
      ctx.save();
      ctx.shadowColor = '#7fdfff';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#7fdfff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(127,223,255,.35)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 3, 0, 6.2832); ctx.fill();
      ctx.restore();
    } else {
      // 普通弹：带方向的弹头 + 发光核心
      const a = Math.atan2(b.ty - b.y, b.tx - b.x);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
      // 弹体
      ctx.fillStyle = b.color; ctx.fillRect(-8, -2.5, 16, 5);
      // 高光核心
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(2, -1.5, 5, 3);
      // 尾焰
      ctx.fillStyle = b.color + '44'; ctx.fillRect(-14, -1.5, 8, 3);
      ctx.restore();
    }
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
  const alpha = wt.t > 1.5 ? (2 - wt.t) * 2 : (wt.t < 0.5 ? wt.t * 2 : 1);
  ctx.save();
  // 全屏渐变遮罩
  ctx.fillStyle = 'rgba(0,0,0,' + (alpha * 0.4) + ')';
  ctx.fillRect(0, 0, W, H);
  // 水平光线扫描效果
  const scanX = W * (1 - wt.t / 2);
  const scanGrad = ctx.createLinearGradient(scanX - 200, 0, scanX + 200, 0);
  scanGrad.addColorStop(0, 'transparent');
  scanGrad.addColorStop(0.5, 'rgba(255,209,102,' + (alpha * 0.15) + ')');
  scanGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = scanGrad;
  ctx.fillRect(scanX - 200, 0, 400, H);
  // 波次文字（带缩放动画）
  ctx.translate(W / 2, H / 2);
  const scale = 1 + (2 - wt.t) * 0.35;
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  // 文字阴影光晕
  ctx.font = 'bold 52px "Noto Sans SC", sans-serif';
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
  ctx.font = 'bold 20px "Noto Sans SC", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillText('梦魇来袭！', 0, 44);
  // 装饰性水平线
  ctx.strokeStyle = 'rgba(255,209,102,' + (alpha * 0.4) + ')';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-140, 65); ctx.lineTo(140, 65); ctx.stroke();
  ctx.restore();
}
