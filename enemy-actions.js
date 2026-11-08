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
