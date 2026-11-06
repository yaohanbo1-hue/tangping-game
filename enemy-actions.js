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
        body.poisonSrc=body.burnSrc=body.elem=body.parasiteTarget=null;
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
