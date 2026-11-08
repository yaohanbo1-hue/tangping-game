// Boss actions run on simulation time. Warnings read this state; they never
// schedule damage through wall-clock timers or consume presentation RNG.
const BossEncounters = {
  defs: {
    lord: {name:'号令冲锋',windup:1.8,cooldown:8,hint:'冻结或眩晕打断号令；分路防守召来的护卫。'},
    abyss: {name:'深渊汲取',windup:2.2,cooldown:9,hint:'标记锁定后冻结／眩晕巨口，或出售诱饵；减伤会压低汲取量，护盾承接生命损失。'},
    machine: {name:'轨道扫射',windup:2,cooldown:10,hint:'冻结或眩晕打断；用护盾与抢修承接扫射，趁核心过热集火。'},
    void: {name:'虚空跃迁',windup:1.9,cooldown:8.5,hint:'跃迁前控制它；完整铁门挡住落点，利用施法与落地显形期集火。'},
    final: {name:'三声终钟',windup:1.4,cooldown:10,hint:'依次预警三路；控制可打断整轮，保持铁门完整并保留抢修。'},
  },
  init(enemy) {
    if(!enemy.boss || !Object.hasOwn(this.defs,enemy.bossKey))return;
    const slot=(G.bossSpawnSerial || 0)+1;G.bossSpawnSerial=slot;
    enemy.encounter={cooldown:1.1,cycle:0,cast:null,exposed:0,casts:0,interrupts:0,pulses:0,bornLane:enemy.lane,slot,controlFatigue:0,controlGuard:0};
  },
  control(enemy,dt) {
    const state=enemy.encounter;if(!state)return enemy.stun>0 || G.buff.freeze>0;
    state.controlGuard=Math.max(0,state.controlGuard-dt);
    if(G.buff.freeze>0)return true; // The player's active freeze always works.
    if(state.controlGuard>0){enemy.stun=0;return false;}
    if(enemy.stun>0){
      state.controlFatigue+=Math.min(dt,enemy.stun);
      if(state.controlFatigue>=1.2){state.controlFatigue=0;state.controlGuard=4;enemy.stun=0;addText(enemy.x,enemy.y-enemy.r-35,'韧性 · 武器眩晕抵抗4秒','#e0bf80',true);return false;}
      return true;
    }
    state.controlFatigue=Math.max(0,state.controlFatigue-dt*.35);return false;
  },
  damageMultiplier(enemy) { return enemy.encounter && enemy.encounter.exposed>0 ? (enemy.bossKey==='machine'?1.5:1.2) : 1; },
  revealed(enemy) { return !!(enemy.encounter && (enemy.encounter.cast || enemy.encounter.exposed>0)); },
  cancel(enemy,counter=false) {
    const state=enemy.encounter;if(!state || !state.cast)return;
    state.cast=null;state.cooldown=3;
    if(counter){state.interrupts++;state.exposed=Math.max(state.exposed,3);G.stats.bossInterrupts=(G.stats.bossInterrupts || 0)+1;addText(enemy.x,enemy.y-enemy.r-35,'施法打断 · 弱点显露','#b9e1d7',true);}
  },
  stage(enemy,phase) {
    this.cancel(enemy);const state=enemy.encounter;if(state){state.cooldown=1;state.exposed=0;}
    const paid=G.bossStageRewards || (G.bossStageRewards={}),key=[G.wave,enemy.bossKey,state?state.slot:1,phase].join('|');
    if(paid[key])return;paid[key]=true;
    if(enemy.bossKey==='lord')G.doors.forEach(d=>healTarget(d,d.maxHp*.08));
    if(enemy.bossKey==='abyss')G.buildings.forEach(b=>healTarget(b,b.maxHp*.06));
    if(enemy.bossKey==='machine')G.buildings.forEach(b=>{b.empT=Math.max(0,(b.empT || 0)-1.5);});
    if(enemy.bossKey==='void')G.skills.freeze=Math.max(0,G.skills.freeze-3);
    if(enemy.bossKey==='final'){
      healTarget(G.bed,G.bed.maxHp*.06);G.doors.forEach(d=>healTarget(d,d.maxHp*.06));
      SKILL_KEYS.forEach(key=>G.skills[key]=Math.max(0,G.skills[key]-2));
    }
    G.stats.bossStageRewards=(G.stats.bossStageRewards || 0)+1;
    const labels={lord:'铁门修复8%',abyss:'建筑修复6%',machine:'瘫痪缩短1.5秒',void:'冻结冷却缩短3秒',final:'床门修复6% · 技能冷却缩短2秒'};
    addText(ROOM_X0+270,ARENA_TOP+42,'阶段突破 · '+labels[enemy.bossKey],'#e5ce99',true);
  },
  validTarget(cast) {
    if(!cast.target)return true;
    return cast.target.hp>0 && (G.buildings.includes(cast.target) || G.doors.includes(cast.target));
  },
  plan(enemy) {
    const state=enemy.encounter,def=this.defs[enemy.bossKey],kind=enemy.bossKey;
    const cast={kind,left:def.windup,total:def.windup,lane:enemy.lane,beat:0};
    if(kind==='machine' || kind==='final')cast.lane=state.cycle%3;
    if(kind==='void')cast.lane=(enemy.lane+1+(state.cycle%2))%3;
    if(kind==='abyss'){
      cast.target=G.buildings.filter(b=>b.hp>0 && dist(b,enemy)<=500).sort((a,b)=>dist(a,enemy)-dist(b,enemy))[0];
      if(!cast.target){const door=G.doors[enemy.lane];if(door.hp>0)cast.target=door;else return false;}
    }
    state.cast=cast;state.cycle++;
    if(kind==='void'){enemy.alpha=1;enemy.untargetable=false;}
    SFX.alert(kind);return true;
  },
  strike(enemy,target,factor) {
    if(!target || target.hp<=0 || G.over)return;
    enemyStrike(enemy,target,enemyAttackDamage(enemy)*factor,enemy.bossKey==='abyss'?.6:0);
    if(target.hp<=0){if(target===G.bed)gameOver();else if(G.doors.includes(target))breakDoor(target);else if(G.buildings.includes(target))destroyBuilding(target);}
  },
  reinforce(enemy) {
    const phase=bossPhases(enemy)[enemy.phase],spec=phase && phase.summon;
    if(!spec || G.buff.noSummon)return;
    for(let i=0;i<Math.min(3,spec.n);i++){
      const child=spawnEnemy(spec.type,G.wave,enemy.lane,true);if(!child)break;
      child.x=Math.max(12,enemy.x-20-i*8);child.y=clamp(enemy.y+(i-1)*18,ARENA_TOP+16,ARENA_BOT-16);
      child.state=enemy.state==='room' && G.doors[enemy.lane].broken?'room':'walk';
      if(child.state!=='room')child.x=Math.min(WALL_X-28,child.x);
    }
  },
  resolve(enemy,cast) {
    const state=enemy.encounter,kind=cast.kind,door=G.doors[cast.lane],lane=LANES[cast.lane];
    if(kind==='lord'){
      G.enemies.forEach(e=>{if(!e.dead && e.lane===enemy.lane){e.hasteT=4;e.hasteMul=1.3;}});
      if(enemy.x>=WALL_X-95 && !door.broken)this.strike(enemy,door,1.25);
      const max=door.broken?ROOM_X1-70:WALL_X-28;enemy.x=Math.min(max,enemy.x+55);
      this.reinforce(enemy);
    }else if(kind==='abyss')this.strike(enemy,cast.target,2.1);
    else if(kind==='machine'){
      this.strike(enemy,door,1.25);
      for(const b of G.buildings.slice())if(b.y>=lane.y0 && b.y<=lane.y1){this.strike(enemy,b,.7);if(!G.fate.immune)b.empT=Math.max(b.empT || 0,1.2);}
      if(door.broken && BED_CY>=lane.y0 && BED_CY<=lane.y1)this.strike(enemy,G.bed,.8);
      state.exposed=4;this.reinforce(enemy);
    }else if(kind==='void'){
      enemy.lane=cast.lane;enemy.y=door.y;enemy.x=door.broken?WALL_X+26:Math.min(WALL_X-28,enemy.x+75);
      enemy.state=door.broken?'room':'walk';enemy.target=null;enemy.door=door;enemy.atkCd=.85;enemy.alpha=1;enemy.untargetable=false;
      state.exposed=3;this.reinforce(enemy);
    }else if(kind==='final'){
      state.pulses++;
      const broken=door.broken;this.strike(enemy,door,1.35);
      if(broken)this.strike(enemy,G.bed,.65);
      cast.beat++;SFX.alert('final');
      if(cast.beat<3){cast.lane=(cast.lane+1)%3;cast.left+=1.1;cast.total=1.1;return false;}
      this.reinforce(enemy);state.exposed=2.5;
    }
    addEffect({type:'ring',x:enemy.x,y:enemy.y,r:85,color:enemy.def.color,life:.4,maxLife:.4});
    return true;
  },
  update(enemy,dt,incapacitated) {
    const state=enemy.encounter;if(!state)return false;
    state.exposed=Math.max(0,state.exposed-dt);
    state.cooldown=Math.max(0,state.cooldown-dt);
    if(enemy.dead){this.cancel(enemy);return false;}
    if(incapacitated){this.cancel(enemy,true);return false;}
    if(state.cast){
      if(!this.validTarget(state.cast)){this.cancel(enemy,true);return false;}
      state.cast.left-=dt;
      for(let i=0;i<3 && state.cast && state.cast.left<=0;i++){
        if(this.resolve(enemy,state.cast)){state.cast=null;state.casts++;G.stats.bossCasts=(G.stats.bossCasts || 0)+1;state.cooldown=this.defs[enemy.bossKey].cooldown;}
      }
      return true;
    }
    if(state.cooldown<=0){if(!this.plan(enemy))state.cooldown=.8;return !!state.cast;}
    return enemy.bossKey==='machine' && state.exposed>0;
  },
  cue(enemy) {
    const state=enemy.encounter,cast=state && state.cast;if(!cast)return null;
    return {kind:'boss',label:this.defs[enemy.bossKey].name+(cast.kind==='final'?' '+(cast.beat+1)+'/3':''),left:Math.max(0,cast.left),total:cast.total,
      lane:cast.lane,target:cast.target,color:{lord:'#edb39d',abyss:'#c9b0e5',machine:'#8ed9e5',void:'#bfc8ef',final:'#edb7a2'}[enemy.bossKey]};
  },
};
