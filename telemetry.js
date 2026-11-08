// Observations live outside saves and gameplay state. Reading statistics never
// changes damage, rewards or RNG. A load/new run starts a new observation period.
const CombatTelemetry = {
  game: null, clock: 0, sources: new WeakMap(), shieldOwners: new WeakMap(),
  window: 5, resolution: .1, slots: 50,
  sync() {
    if(this.game!==G){this.game=G;this.clock=0;this.sources=new WeakMap();this.shieldOwners=new WeakMap();}
  },
  tick(dt){this.sync();if(Number.isFinite(dt)&&dt>0)this.clock+=dt;},
  source(source) {
    this.sync();if(!source || typeof source!=='object')return null;
    let stats=this.sources.get(source);
    if(!stats){stats={total:0,hp:0,shield:0,healed:0,absorbed:0,recharged:0,gold:0,power:0,souls:0,
      stamps:new Float64Array(this.slots).fill(-1),damage:new Float64Array(this.slots)};this.sources.set(source,stats);}
    return stats;
  },
  damage(source,hp,shield) {
    const total=hp+shield;if(!(total>0)||!Number.isFinite(total))return;
    const stats=this.source(source);if(!stats)return;
    const stamp=Math.floor(this.clock/this.resolution+1e-7),slot=stamp%this.slots;
    if(stats.stamps[slot]!==stamp){stats.stamps[slot]=stamp;stats.damage[slot]=0;}
    stats.damage[slot]+=total;stats.total+=total;stats.hp+=hp;stats.shield+=shield;
  },
  add(source,key,amount){if(!(amount>0)||!Number.isFinite(amount))return;const stats=this.source(source);if(stats && Object.hasOwn(stats,key))stats[key]+=amount;},
  snapshot(source) {
    const stats=this.source(source),now=Math.floor(this.clock/this.resolution+1e-7);
    if(!stats)return {total:0,dps:0};
    let recent=0;for(let i=0;i<this.slots;i++)if(stats.stamps[i]>now-this.slots && stats.stamps[i]<=now)recent+=stats.damage[i];
    const {stamps,damage,...counts}=stats;return {...counts,dps:recent/this.window};
  },
  shield(target,capacity,source) {
    this.sync();if(capacity>target.shieldMax)this.shieldOwners.set(target,source);
  },
  resetShieldOwners(){this.sync();this.shieldOwners=new WeakMap();},
  absorb(target,amount){this.sync();this.add(this.shieldOwners.get(target),'absorbed',amount);},
  recharge(target,amount){this.sync();this.add(this.shieldOwners.get(target),'recharged',amount);},
};

function bankInterestShare(building) {
  let weight=0;for(const b of G.buildings)weight+=Math.max(0,bstat(b).interest || 0);
  if(!weight)return 0;
  return EconomyBalance.interest(G.gold*weight,G.gold,totalGoldRate())*(bstat(building).interest || 0)/weight;
}
function buildingContributionHTML(building,stats) {
  const measured=CombatTelemetry.snapshot(building);let html='';
  if(building.def.tower || measured.total>0)html+='<div class="dst measured-output">近5秒实测 DPS <b class="hl" id="dMeasuredDps">'+fmt1(measured.dps)+'</b>/秒'+
    '<span class="dup2"> · '+fmt1(measured.dps/Math.max(1,building.invested)*1000)+' DPS / 千金币</span></div>'+
    '<div class="dps-note">本次观察实际伤害 '+fmt1(measured.total)+'（本体 '+fmt1(measured.hp)+' / 护盾 '+fmt1(measured.shield)+'）；含毒、穿透、抗性与反应，排除过量和阶段免伤。近5模拟秒按0.1秒采样，空闲计零。</div>';
  if(building.type==='miner'){
    const rate=goldProductionRate((stats.gold || 0)*techVal('mining',.10));
    html+='<div class="dst">已产出 '+fmt1(measured.gold)+' 金币 · 按当前收益约 '+(rate>0?fmt1(building.invested/rate)+' 秒':'—')+' 回收账面投入</div>';
  }
  if(stats.regen)html+='<div class="dst">已产出 '+fmt1(measured.power)+' 电量<span class="dup2"> · 电量与金币分开计量，不折算金币回本</span></div>';
  if(stats.interest || stats.souls){
    const share=bankInterestShare(building);
    html+='<div class="dst">本波结算预计利息 '+fmt1(share)+' 金币 / '+fmt1(stats.souls || 0)+' 灵魂</div>'+
      '<div class="dps-note">已结算 '+fmt1(measured.gold)+' 金币、'+fmt1(measured.souls)+' 灵魂；预计利息按当前存款和全体银行上限分摊，实际以波末余额为准。'+(share>0?'约 '+fmt1(building.invested/share)+' 次同额结算回收账面投入。':'')+'</div>';
  }
  if(stats.heal || stats.shield)html+='<div class="dst">本次观察：修复 '+fmt1(measured.healed)+' 生命 · 吸收 '+fmt1(measured.absorbed)+' 伤害 · 恢复 '+fmt1(measured.recharged)+' 护盾</div>'+
    '<div class="dps-note">只计实际修复／吸收，满血不累计；重叠护盾归属提供最高上限的核心，不重复记账，不折算攻击DPS。</div>';
  if(building.type==='amp'){
    const count=G.buildings.filter(b=>b!==building && b.def.tower && dist(b,building)<=stats.range+30).length;
    html+='<div class="dst">当前增幅覆盖 '+count+' 座武器 · 伤害乘区增加 '+fmt1(stats.bonus*100)+' 个百分点</div>'+
      '<div class="dps-note">投入 '+fmt1(building.invested)+' 金币'+(count?'，每座覆盖武器分摊 '+fmt1(building.invested/count)+'。':'，尚无覆盖武器。')+'最终收益还受其他增益、目标与攻击状态影响，不虚构独立DPS。</div>';
  }
  return html+'<div class="dps-note observation-note">统计自本次开始／载入起，暂停时不推进；读档会重新观察。</div>';
}
