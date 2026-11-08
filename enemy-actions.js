// Shared by the forecast, bestiary and the checked combat reference.
const EnemyCounterplay={
  enemies:{
    grunt:'集中清理前排，避免梦魇在门前堆积。',sprinter:'在入口布置减速，保留紧急控制应对冲线。',
    brute:'使用能量火力克制重甲，减少低单发的动能投入。',phantom:'利用显形窗口集火，或招募侦察兵持续揭示。',
    bomber:'减速并在门外击杀，让死亡爆炸远离建筑。',healer:'优先集火治疗者，减少邻近敌人的恢复。',
    splitter:'保留群攻处理死亡后出现的分裂体。',bulwark:'电磁克制盾卫；毒液可绕过护盾侵蚀本体。',
    flier:'在床铺前保留射程覆盖，使用动能克制飞行目标。',summoner:'在召唤前摇中控制或击杀；召唤封印也能阻止增援。',
    berserker:'在残血狂暴前保留冰霜和爆发，缩短危险阶段。',vampire:'保持门线并及时减伤／控制，压低实际攻击带来的回血。',
    reflector:'用持续伤害避免直接反伤，并给开火炮塔配维修。',thief:'在接触门和建筑前控制或击杀，减少窃取次数。',
    chronos:'优先处理加速光环源，减缓整群敌人的推进。',nullifier:'从光环外远射或先集火光环源，恢复近处炮塔输出。',
    colossus:'用连续火力逐段拆甲，大额单次伤害会被段位截断。',saboteur:'它会绕门扑向建筑；在房内留火力并及时控制。',
    adaptive:'轮换元素并配合破抗，避免长期只用同一种伤害。',brood:'控制或击杀孵化源，配合群攻清理已出生幼虫。',
    digger:'潜入会绕过完整铁门，在床铺与后排留守火力。',emp:'在干扰前摇中控制或击杀，避免相邻炮塔同时停机。',
    mimic:'靠近建筑后会显形，布置后排火力覆盖揭示区。',wraith:'尽量在门外击杀，避免建筑留在死亡诅咒区内。',
    juggernaut:'保持铁门并用减速争取输出，避免它接触脆弱建筑。',swarm:'使用火焰、声波或溅射，减少单体火力浪费。',
    leech:'在0.6秒汲取前摇中控制；击退超出260范围也会断开寄生。',warden:'优先击杀护盾来源，或用毒液绕过盟友的护盾。',
    reaper:'使用冰霜控制并优先击杀，避免三倍建筑伤害接触后排。',frostbane:'在冻缓前摇中控制；火焰克制它的冰霜抗性。',
    necromancer:'在残骸复苏前摇中冻结／眩晕，或使用召唤封印。',rustbug:'它会优先扑向武器；用电磁克制并保留前排控制。',
    owl:'侦察兵或显形窗口处理隐身，在床前布置动能火力。',echo:'预留群攻清理回响分裂体，避免只靠慢速单发。',
    weaver:'优先集火织梦者，减少整群敌人的护盾补充。',
  },
  affixes:{
    tough:'集中火力并搭配易伤／破抗，避免伤害分散。',swift:'提前布置减速与拦截，留意冲线时间。',
    shielded:'持续接触压住回盾，或用毒液绕盾。',resist:'优先破抗科技、腐蚀与易伤，再集中输出。',
    vamp:'减伤、控制并守住门线，减少实际攻击带来的回血。',frenzy:'在残血前保留控制与爆发，避免让狂暴敌人贴脸。',
    splitter:'预留群攻与射程处理两只分裂体；召唤封印可拦截分裂。',deadly:'保持距离击杀，提前修复爆炸半径内的防御。',
    regen:'集中爆发压过回血；控制主要延缓推进，再生仍会持续。',armored:'提高单发伤害或配合破甲；持续伤害按时间结算固定减伤。',
  },
};
// Transient remains and interruptible resurrection. Bodies keep their original
// health calculation and identity; revival never rerolls or re-multiplies HP.
const EnemyRemains={
  life:12,range:210,windup:.85,limit:64,
  record(enemy) {
    if(enemy.hp>0 || enemy.boss || enemy.summoned || enemy.revived || enemy.def.revive) return;
    const list=G.corpses || (G.corpses=[]);
    if(list.length>=this.limit)list.shift();
    list.push({enemy,x:enemy.x,y:enemy.y,lane:enemy.lane,life:this.life,claimed:null});
  },
  age(dt) {
    const list=G.corpses || (G.corpses=[]);
    for(let i=list.length-1;i>=0;i--){
      const c=list[i];c.life-=dt;
      if(c.claimed){let active=false;for(const e of G.enemies){if(e && !e.dead && e.raiseCast && e.raiseCast.token===c.claimed){active=true;break;}}if(!active)c.claimed=null;}
      if(c.life<=0)list.splice(i,1);
    }
  },
  cancel(enemy) {
    if(!enemy.raiseCast)return;
    enemy.raiseCast.corpses.forEach(c=>{if(c.claimed===enemy.raiseCast.token)c.claimed=null;});enemy.raiseCast=null;enemy.reviveT=0;
  },
  clear() {for(const e of G.enemies)this.cancel(e);G.corpses=[];},
  updateCaster(enemy,dt,incapacitated) {
    if(incapacitated || G.buff.noSummon){this.cancel(enemy);return false;}
    if(enemy.raiseCast) {
      enemy.raiseCast.left-=dt;
      if(enemy.raiseCast.left>0)return true;
      let count=0;
      for(const corpse of enemy.raiseCast.corpses) {
        if(corpse.life<=0 || !corpse.enemy.dead || !(G.corpses || []).includes(corpse))continue;
        if(!admitEnemySummon())break;
        const body=corpse.enemy;
        body.dead=false;body.revived=true;body.hp=body.maxHp*.45;body.shield=0;
        body.x=corpse.x;body.y=corpse.y;body.target=null;body.atkCd=.85;
        body.stun=body.slow=body.slowT=body.burnT=body.burnDmg=body.burnStack=body.poison=body.poisonT=body.poisonDps=body.vulnT=0;
        body.poisonSrc=body.burnSrc=body.elem=null;EnemyParasite.cancel(body);
        body.dotAcc=body.dotT=0;
        body.anim=0;body.stealthT=2.2;body.alpha=1;body.untargetable=false;body.summonT=0;
        body.empT=body.def.emp?body.def.emp.cd:0;body.fzT=body.def.freezeTower?body.def.freezeTower.cd:0;
        G.corpses.splice(G.corpses.indexOf(corpse),1);
        if(!G.enemies.includes(body))G.enemies.push(body);count++;
      }
      this.cancel(enemy);
      if(count)addText(enemy.x,enemy.y-enemy.r-18,'亡骸复苏 ×'+count,'#c19cda');
      return true;
    }
    enemy.reviveT=Math.min(enemy.def.revive.every,(enemy.reviveT || 0)+dt);
    if(enemy.reviveT<enemy.def.revive.every)return false;
    const targets=(G.corpses || []).filter(c=>!c.claimed && c.life>this.windup && c.lane===enemy.lane && Math.hypot(c.x-enemy.x,c.y-enemy.y)<=this.range)
      .sort((a,b)=>Math.hypot(a.x-enemy.x,a.y-enemy.y)-Math.hypot(b.x-enemy.x,b.y-enemy.y)).slice(0,enemy.def.revive.n);
    if(!targets.length)return false;
    const token=(G.raiseSequence || 0)+1;G.raiseSequence=token;
    targets.forEach(c=>c.claimed=token);enemy.raiseCast={token,left:this.windup,total:this.windup,corpses:targets};return true;
  },
};

function enemyIsFrenzied(enemy) {
  return !!(enemy.frenzyOn || enemy.def.frenzy) && enemy.hp < enemy.maxHp * ((enemy.def.frenzy && enemy.def.frenzy.at) || .35);
}
function enemyAttackDamage(enemy) {
  let damage=enemy.dmg*(enemy.def.buildingBonus || 1);
  if(enemyIsFrenzied(enemy) && enemy.def.frenzy)damage*=enemy.def.frenzy.dmg || 1;
  const phase=enemy.boss && bossPhases(enemy)[enemy.phase];
  return damage*(phase && phase.dmg || 1);
}
// Healing uses the real shield/body loss after defense, immunity and overkill.
function enemyStrike(enemy,target,amount,leech=enemy.vamp || 0) {
  const before=Math.max(0,target.hp)+Math.max(0,target.shield || 0);
  damageTarget(target,amount);
  const dealt=Math.max(0,before-Math.max(0,target.hp)-Math.max(0,target.shield || 0));
  if(leech && !enemy.dead)enemy.hp=Math.min(enemy.maxHp,enemy.hp+dealt*leech);
  return dealt;
}
const EnemyParasite={
  range:260,windup:.6,rearm:3,
  cancel(enemy) {
    enemy.parasiteTarget=null;enemy.parasiteWindup=enemy.parasiteRemaining=0;enemy.parasiteCooldown=this.rearm;
  },
  releaseBuilding(building) {
    for(const enemy of G.enemies) {
      if(enemy.parasiteTarget===building)this.cancel(enemy);
      if(enemy.target===building)enemy.target=null;
    }
  },
  update(enemy,dt,incapacitated) {
    enemy.parasiteCooldown=Math.max(0,(enemy.parasiteCooldown || 0)-dt);
    const target=enemy.parasiteTarget;
    if(target && (incapacitated || target.hp<=0 || !G.buildings.includes(target) || dist(enemy,target)>this.range)) {
      this.cancel(enemy);return false;
    }
    if(incapacitated)return false;
    if(!target) {
      if(enemy.parasiteCooldown>0)return false;
      let best=null,range=this.range;
      for(const building of G.buildings)if(building.hp>0 && building.def.tower) {
        const d=dist(enemy,building);if(d<=range){range=d;best=building;}
      }
      if(!best)return false;
      enemy.parasiteTarget=best;enemy.parasiteWindup=this.windup;enemy.parasiteRemaining=enemy.def.parasite.dur;return true;
    }
    let active=dt;
    if(enemy.parasiteWindup>0) {
      const preparing=Math.min(active,enemy.parasiteWindup);enemy.parasiteWindup=Math.max(0,enemy.parasiteWindup-preparing);active-=preparing;
    }
    active=Math.min(active,enemy.parasiteRemaining);
    if(active>0) {
      enemyStrike(enemy,target,enemy.def.parasite.dps*active,.5);enemy.parasiteRemaining-=active;
      if(target.hp<=0)destroyBuilding(target);
    }
    if(enemy.parasiteRemaining<=1e-8 || target.hp<=0)this.cancel(enemy);
    return true;
  },
};

// Read-only warnings use the same cooldowns that trigger the actual action.
function enemyCastCue(enemy) {
  if(enemy.dead || enemy.stun>0 || G.buff.freeze>0 || enemy.phaseBarrier>0)return null;
  if(enemy.boss)return BossEncounters.cue(enemy);
  if(enemy.raiseCast)return {kind:'revive',label:'复苏',left:enemy.raiseCast.left,total:enemy.raiseCast.total,color:'#c0a1d8'};
  if(enemy.parasiteTarget)return {kind:'parasite',label:enemy.parasiteWindup>0?'寄生蓄力':'寄生吸取',left:enemy.parasiteWindup>0?enemy.parasiteWindup:enemy.parasiteRemaining,
    total:enemy.parasiteWindup>0?EnemyParasite.windup:enemy.def.parasite.dur,color:'#b8db72'};
  if(enemy.def.emp && enemy.empT<=.8)return {kind:'emp',label:'电磁脉冲',left:Math.max(0,enemy.empT),total:.8,range:enemy.def.emp.range,color:'#79d8e6'};
  if(enemy.def.freezeTower && enemy.fzT<=.8)return {kind:'frost',label:'霜噬',left:Math.max(0,enemy.fzT),total:.8,range:enemy.def.freezeTower.r,color:'#a5def2'};
  const phases=enemy.boss && bossPhases(enemy),summon=enemy.def.summon || (phases && phases[enemy.phase].summon);
  if(summon && !G.buff.noSummon && enemy.summonT>=summon.every-.8)return {kind:'summon',label:'召唤',left:Math.max(0,summon.every-enemy.summonT),total:.8,color:'#d5a5cf'};
  if(enemy.def.heal && enemy.anim%.5>=.25)return {kind:'heal',label:'治疗',left:.5-enemy.anim%.5,total:.25,range:120,color:'#82ca9e'};
  return null;
}
