// Lottery gifts are one-off purchases. Keep their settlement separate from
// repeatable enemy/wave earnings so restarting a wave cannot erase the gift.
const LotteryRewards={
  defenseMul(){return 1+Math.min(2,Math.max(0,Number.isFinite(G.lot?.hpBonus)?G.lot.hpBonus:0));},
  settle(item){
    const before={gold:G.gold,souls:G.souls,spentGold:G.waveSpentGold,spentSouls:G.waveSpentSouls};
    try{return item.apply() || '';}
    finally{
      G.waveSpentGold=before.spentGold-(G.gold-before.gold);
      G.waveSpentSouls=before.spentSouls-(G.souls-before.souls);
      G.buildings.forEach(b=>{b.__sf=-1;});
    }
  },
  upgradeDoors(){
    let n=0;G.doors.forEach(d=>{if(d.lv<50)n++;setDoorLevel(d,Math.min(50,d.lv+1));});
    if(!n){G.gold+=1200;return '铁门已满级并修复，改为获得 1200 金币';}
    return n+' 扇铁门提升1级并修复';
  },
  fortify(){
    const old=Math.min(2,Math.max(0,Number.isFinite(G.lot.hpBonus)?G.lot.hpBonus:0));
    if(old>=2){G.gold+=3500;return '永恒守护已达本局上限，改为获得 3500 金币';}
    G.lot.hpBonus=Math.min(2,old+.5);
    G.doors.forEach(d=>{d.maxHp=doorMaxHp(d.lv);d.hp=d.maxHp;d.broken=false;});
    G.bed.maxHp=bedMaxHp(G.bed.lv);G.bed.hp=G.bed.maxHp;
    return '守护加成 +'+Math.round(G.lot.hpBonus*100)+'%（本局上限 +200%）';
  },
  clear(){
    const alive=G.enemies.filter(e=>!e.dead);if(!alive.length){G.gold+=2000;return '场上无敌人，改为获得 2000 金币';}
    let normal=0,bosses=0;
    for(const enemy of alive){
      if(enemy.boss){EnemyDamage.commit(enemy,enemy.maxHp*.2,null,true);EnemyDamage.finish(enemy,null);bosses++;}
      else{
        for(let segment=0;segment<8&&!enemy.dead;segment++){EnemyDamage.commit(enemy,enemy.hp+Math.max(0,enemy.shield||0),null);EnemyDamage.finish(enemy,null);}
        if(enemy.dead)normal++;
      }
    }
    return '清除 '+normal+' 只普通梦魇'+(bosses?'；'+bosses+' 位Boss承受20%最大生命伤害（遵守阶段护甲）':'');
  },
};
