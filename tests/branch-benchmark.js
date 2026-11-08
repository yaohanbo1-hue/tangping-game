// Controlled workbench: injected budget and stationary targets, never a proof
// of a legal campaign. Purchases and damage still use the actual game pipeline.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createGame}=require('./runtime');
const root=path.resolve(__dirname,'..'),probe=createGame(1),types=probe.run('Object.keys(BUILD_DEFS)'),rows=[];
for(const type of types)for(const branch of ['a','b'])for(const level of [6,12,20])for(const scenario of ['single','swarm','shield-armor']){
  const game=createGame(721),run=code=>game.run(code);
  run(`newGame();G.experience='combat';G.gold=G.power=1e9;G.souls=1e6;ACHIEVEMENTS.forEach(a=>G.ach[a.id]=1);
    if(!tryBuild(${JSON.stringify(type)},2,2))throw Error('cannot buy source');globalThis.source=G.buildings[0];
    for(let lv=1;lv<${level};lv++)if(!tryUpgrade(source))throw Error('cannot upgrade source');
    if(!tryBranch(source,${JSON.stringify(branch)}))throw Error('cannot branch source');
    globalThis.cost={gold:1e9-G.gold,power:1e9-G.power,souls:1e6-G.souls};
    globalThis.ally=null;
    if(['repair','shield','amp'].includes(source.type)){
      tryBuild('turret',3,2);ally=G.buildings[1];for(let lv=1;lv<6;lv++)tryUpgrade(ally);
    }
    G.gold=2000;G.wave=20;G.state='wave';G.waveTime=0;G.spawnQueue=[];G.bossQueue=[];
    const count=${scenario==='single'?1:scenario==='swarm'?6:3};
    for(let i=0;i<count;i++){
      const e=spawnEnemy('grunt',1,1);e.x=source.x-160-(i%3)*18;e.y=source.y+(Math.floor(i/3)-.5)*22;e.speed=0;
      e.hp=e.maxHp=1e12;e.shield=${scenario==='shield-armor'?'1e8':'0'};e.flat=${scenario==='shield-armor'?10:0};
      e.res=${scenario==='shield-armor'?'{kinetic:.6,fire:.4}':'{}'};e.weak={};e.affixes=[];e.elite=null;
      e.regen=0;e.enraged=false;e.reflect=0;e.thorns=0;e.blinkT=1e6;e.explodeN=0;e.boss=false;
    }
    globalThis.wear=function(dt){
      if(source.type==='repair'){if(ally)ally.hp=Math.max(1,ally.hp-20*dt);for(const d of G.doors)d.hp=Math.max(1,d.hp-5*dt);}
      if(source.type==='shield'&&ally)damageTarget(ally,20*dt);
    };
    globalThis.sample=function(){return {name:source.def.branch[source.branch].name,tower:!!source.def.tower,
      theory:source.def.tower?towerDisplayDps(bstat(source),source):0,source:CombatTelemetry.snapshot(source),
      ally:ally?CombatTelemetry.snapshot(ally):null,sourceAlive:source.hp>0,invested:source.invested,cost};};`);
  const tick=run('dt=>{wear(dt);statFrame++;step(dt);}');
  for(let i=0;i<480;i++){tick(1/60);game.advance(1000/60);}
  run('endWave();');const sample=JSON.parse(JSON.stringify(run('sample()')));
  assert.deepEqual(game.errors,[]);assert.ok(sample.sourceAlive,type+branch+' remains alive');
  if(sample.tower)assert.ok(sample.source.total>0,type+branch+' deals actual damage against '+scenario);
  for(const [key,value]of Object.entries(sample.source))assert.ok(Number.isFinite(value),type+branch+' finite '+key);
  rows.push({type,branch,level,scenario,seconds:8,...sample});
}
const report={note:'Controlled workbench with injected budget, stationary targets, no technology/runes/story. Costs use real purchases; not a legal campaign or an overall branch ranking.',rows};
fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts','branch-benchmark.json'),JSON.stringify(report,null,2));
const f=n=>Number(n).toFixed(1),lines=['# 32 个建筑分支的控制场景对照','','由 `node tests/branch-benchmark.js` 生成。16 类×2 分支×3 等级×3 靶场，共288组；8模拟秒，真实购买／升级／分支成本和实际伤害结算。预算、静止靶和耐久由测试注入，不能用来证明战役可通关。','','12级对照（护盾靶另有60%物理／40%火抗及10点固定减伤；含穿透、毒、控制导致的接触变化）。支援不排攻击DPS名次。','','| 建筑／分支 | 金币／电量／灵魂投入 | 单靶实际伤害 | 六靶实际伤害 | 护盾护甲靶实际伤害 | 其他贡献（单靶8秒） |','|---|---:|---:|---:|---:|---|'];
for(const type of types)for(const branch of ['a','b']){
  const select=scenario=>rows.find(r=>r.type===type&&r.branch===branch&&r.level===12&&r.scenario===scenario),one=select('single'),many=select('swarm'),shield=select('shield-armor'),s=one.source;
  const contribution=[s.gold?'金币 '+f(s.gold):'',s.power?'电量 '+f(s.power):'',s.souls?'灵魂 '+f(s.souls):'',s.healed?'修复 '+f(s.healed):'',s.absorbed?'吸收 '+f(s.absorbed):'',s.recharged?'回盾 '+f(s.recharged):'',one.ally?'覆盖友塔实际伤害 '+f(one.ally.total):''].filter(Boolean).join('；')||'—';
  lines.push('| '+type+'／'+one.name+' | '+[one.cost.gold,one.cost.power,one.cost.souls].map(f).join('／')+' | '+f(s.total)+' | '+f(many.source.total)+' | '+f(shield.source.total)+' | '+contribution+' |');
}
lines.push('','靶场限制：银行只结算一次固定存款；维修／护盾使用明确的受损负载；增幅只列受覆盖友塔的结算，不能把全部伤害当作净增益。伤害是8秒累计值，包含弹丸旅行和毒的起效时间，不等于详情面板的理论DPS。静止靶不涵盖推进、飞行、死亡传染、召唤和Boss转阶段；这些由专项回归及完整战役另外覆盖。低伤控场分支应结合推进距离与中断收益理解。','');
fs.writeFileSync(path.join(root,'docs','BRANCH_BENCHMARK.md'),lines.join('\n'));
console.log('Branch workbench: '+rows.length+' real-purchase / settled-contribution cases passed; report docs/BRANCH_BENCHMARK.md');
