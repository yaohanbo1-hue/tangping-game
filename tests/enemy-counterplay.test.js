const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createGame}=require('./runtime');
const g=createGame(426),run=code=>g.run(code);let checks=0;const ok=(v,label)=>{assert.ok(v,label);checks++;};
run('newGame();');const catalog=JSON.parse(JSON.stringify(run('Object.entries(ENEMY_DEFS).filter(([,d])=>!d.boss).map(([id,d])=>({id,name:d.name,tip:d.tip||"",counter:EnemyCounterplay.enemies[id]}))')));
ok(catalog.length===35,'all thirty-five ordinary enemy identities are covered');
for(const row of catalog)ok(row.counter?.length>=12 && run(`enemyCounterHint(${JSON.stringify(row.id)}).includes(${JSON.stringify(row.counter)})`),row.id+' exposes its actionable counter in the real forecast');
for(const id of run('AFFIX_KEYS'))ok(run(`EnemyCounterplay.affixes[${JSON.stringify(id)}]?.length>=12`),id+' has a specific counter');
const pairs=[],keys=run('AFFIX_KEYS.slice()');
for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){
 const pair=[keys[i],keys[j]];
 run(`newGame();G.experience='combat';G.gold=G.power=1e9;G.souls=1e6;ACHIEVEMENTS.forEach(a=>G.ach[a.id]=1);
  tryBuild('turret',0,2);globalThis.tower=G.buildings[0];tower.hp=tower.maxHp=1e9;G.wave=35;G.state='wave';G.spawnQueue=[];G.bossQueue=[];
  globalThis.pool=AFFIX_KEYS.slice();globalThis.random=Math.random;AFFIX_KEYS.splice(0,AFFIX_KEYS.length,...${JSON.stringify(pair)});Math.random=()=>0;
  try{globalThis.enemy=spawnEnemy('grunt',35,1);}finally{AFFIX_KEYS.splice(0,AFFIX_KEYS.length,...pool);Math.random=random;}
  enemy.x=tower.x-20;enemy.y=tower.y;enemy.state='room';enemy.target=tower;enemy.hp=enemy.maxHp*.6;enemy.atkCd=0;
  for(let f=0;f<180;f++){statFrame++;applyDamage(enemy,3,'energy',tower);updateEnemies(1/60);updateEffects(1/60);}
 `);
 ok(run('Number.isFinite(enemy.hp)&&enemy.hp>=0&&enemy.hp<=enemy.maxHp&&Number.isFinite(tower.hp)&&tower.hp>=0'),pair+' has finite clamped damage/healing');
 ok(run('enemy.x>=8&&enemy.x<=ROOM_X1-8&&enemy.y>=ARENA_TOP+8&&enemy.y<=ARENA_BOT-8'),pair+' stays in the arena');
 ok(run('enemySpeed(enemy)>=0 && enemySpeed(enemy)<=enemy.speed*5'),pair+' has bounded movement');
 run('enemy.stun=1;globalThis.before=tower.hp;updateEnemies(.1);');ok(run('tower.hp===before'),pair+' obeys stun during real attacks');
 run('enemy.stun=0;applyDamage(enemy,1e12,"energy",tower);');ok(run('enemy.dead && G.enemies.length<=3 && (G.summonsThisWave||0)<=120'),pair+' can die without an unbounded split cascade');
 pairs.push({pair:pair.join('+'),maxHp:run('enemy.maxHp'),children:run('G.enemies.filter(e=>e!==enemy&&!e.dead).length')});
}
ok(g.errors.length===0,g.errors.join('\n'));
const root=path.resolve(__dirname,'..'),bosses=JSON.parse(JSON.stringify(run('Object.entries(BossEncounters.defs).map(([id,d])=>({id,...d,name:BOSS_DEFS[id].name,action:d.name}))'))),affixes=JSON.parse(JSON.stringify(run('AFFIX_KEYS.map(id=>({id,name:AFFIX[id].name,desc:AFFIX[id].desc,counter:EnemyCounterplay.affixes[id]}))')));
const lines=['# 敌人与词缀反制验收','','`node tests/enemy-counterplay.test.js` 生成。35个普通敌种中包含基础敌人、被动特性与主动技能，并非35套主动施法。运行时行为另由 `enemies.test.js`、`enemy-abilities.test.js` 和 `boss-encounters.test.js` 验证。以下说明也用于实际游戏的图鉴与波次预告。','','## 35个普通敌种','','| 敌人 | 应对 |','|---|---|',...catalog.map(r=>'| '+r.name+'（'+r.id+'） | '+r.counter+' |'),'','## 5位Boss','','| Boss／行动 | 前摇／冷却（模拟秒） | 应对 |','|---|---:|---|',...bosses.map(r=>'| '+r.name+'／'+r.action+' | '+r.windup+'／'+r.cooldown+' | '+r.hint+' |'),'','阶段会打断旧施法并提供对应防守收益；武器连续眩晕触发4秒韧性，主动时间冻结仍可打断。读档依旧重开当前波、清空敌人临时施法；当前波阶段奖励账本保留，避免重新获得。前摇、死亡、阶段、目标出售、召唤上限与账本另有专项逻辑及触控测试。','','## 10种普通精英词缀','','| 词缀 | 效果 | 应对 |','|---|---|---|',...affixes.map(r=>'| '+r.name+' | '+r.desc+' | '+r.counter+' |'),'','## 全部45种双词缀组合','','统一使用实际35波精英抽取入口，固定只抽取指定两词缀，在60Hz下受击／近战3秒，再验收眩晕、死亡和分裂。所有组合的生命、治疗、位置、移动及分裂数量有界。再生是被动回血，冻结不等于禁止回血；它们仍需合适的火力处理。Boss不参与这套普通精英抽取。','','| 组合 | 本次生命上限 | 死亡后存活子体 |','|---|---:|---:|',...pairs.map(r=>'| '+r.pair+' | '+r.maxHp.toFixed(1)+' | '+r.children+' |'),'','该矩阵验证交互与边界；不声称45种组合在任何布局、难度下都同等容易。合法经济路线见 `CAMPAIGN_VALIDATION.md`。',''];
fs.writeFileSync(path.join(root,'docs','ENEMY_COUNTERPLAY.md'),lines.join('\n'));fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts','enemy-counterplay.json'),JSON.stringify({catalog,affixes,bosses,pairs,checks},null,2));
console.log('Enemy counterplay: 35 identities, 10 affixes, 45 real-combat pairs; '+checks+' checks passed');
