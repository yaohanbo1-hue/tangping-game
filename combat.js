// Final enemy damage settlement: direct hits, poison and reactions share health,
// phase gates and actual-output accounting. Modifiers stay at their callers.
const EnemyDamage = {
  commit(enemy, amount, source, bypassShield=false) {
    if(!enemy || enemy.dead || !Number.isFinite(amount) || amount<=0 || (enemy.phaseBarrier || 0)>0) return 0;
    const shield=bypassShield ? 0 : Math.min(Math.max(0,enemy.shield || 0),amount);
    if(shield) enemy.shield-=shield;
    let health=Math.min(Math.max(0,enemy.hp),amount-shield);
    const phases=enemy.boss ? bossPhases(enemy) : null;
    const next=phases && phases[enemy.phase+1];
    const phaseGate=next ? enemy.maxHp*next.at : 0;
    const segmentGate=enemy.phaseShield && enemy.segIdx<enemy.phaseShield
      ? enemy.maxHp-enemy.segMax*(enemy.segIdx+1) : 0;
    const gate=Math.max(phaseGate,segmentGate);
    if(gate>0 && health>=Math.max(0,enemy.hp-gate)) {
      health=Math.max(0,enemy.hp-gate);
      if(next && phaseGate===gate) {
        enemy.phaseNext=enemy.phase+1;
        enemy.phaseBarrier=1.2;
      }
      if(segmentGate===gate) {
        enemy.segIdx++;
        addText(enemy.x,enemy.y-46,'护盾破碎 '+enemy.segIdx+'/'+enemy.phaseShield,'#a8a29e',true);
        spawnParts(enemy.x,enemy.y,16,'#d6d3d1',3,0.5);
        enemy.stun=Math.max(enemy.stun || 0,0.35);
      }
    }
    enemy.hp=Math.max(0,enemy.hp-health);
    enemy.inCombatT=2;
    const actual=shield+health;
    CombatTelemetry.damage(source,health,shield);
    G.stats.dmg+=actual;
    if(source && source.def && BUILD_DEFS[source.type]) {
      const damage=G.stats.towerDamage || (G.stats.towerDamage={});
      damage[source.type]=(damage[source.type] || 0)+actual;
    }
    return actual;
  },
  finish(enemy,source,dtype) {
    if(enemy.dead || enemy.hp>0) return;
    if(source && source.kills!==undefined) {
      source.kills++;
      if(BUILD_DEFS[source.type]) {
        const kills=G.stats.towerKills || (G.stats.towerKills={});
        kills[source.type]=(kills[source.type] || 0)+1;
      }
    }
    if(G.track && dtype==='fire') G.track.killFire=(G.track.killFire || 0)+1;
    killEnemy(enemy);
  },
};
