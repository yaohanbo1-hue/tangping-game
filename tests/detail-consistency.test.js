const assert = require('node:assert/strict');
const {createGame} = require('./runtime');
const game = createGame(3207), run = code => game.run(code);
let checks = 0;
const ok = (value, label) => { assert.ok(value,label); checks++; };
const close = (actual, expected, label) => ok(Math.abs(actual-expected)<1e-8*Math.max(1,Math.abs(expected)),label+': '+actual+' vs '+expected);
function fixture(type='turret',level=1,branch=null) {
  run(`newGame();G.gold=G.power=1e12;G.souls=1e8;G.admin=true;G.wave=60;
    ACHIEVEMENTS.forEach(a=>G.ach[a.id]=1);tryBuild('${type}',0,2);globalThis.tower=G.buildings[0];
    setBuildingLevel(tower,${level});${branch?`tryBranch(tower,'${branch}');`:''}selected=tower;`);
}

// Real detail markup, with an already-hot cache, must show the *next* level.
for (const type of run('BUILD_KEYS')) for (const branch of [null,'a','b']) for (const level of [branch?6:1,8,25]) {
  fixture(type,level,branch);
  run(`globalThis.current=bstat(tower);updateDetail(true);
    globalThis.nextBase=tower.def.stat(tower.level+1);
    globalThis.expectedStats=tower.branch?Object.assign({},nextBase,tower.def.branch[tower.branch].mod(nextBase,tower)):nextBase;
    if(expectedStats.slow!=null)expectedStats.slow=Math.min(.85,expectedStats.slow);
    if(expectedStats.gravSlow!=null)expectedStats.gravSlow=Math.min(.85,expectedStats.gravSlow);
    globalThis.expectedNext=tower.def.statText(expectedStats);`);
  ok(run(`document.getElementById('detail').innerHTML.includes('</b>　'+expectedNext+'</div>')`),type+'/'+branch+'/'+level+' next stats use next level');
  ok(run('tower.level==='+level+' && bstat(tower)===current'),type+'/'+branch+'/'+level+' preview leaves the entity and its warm stats intact');
}

fixture(); run(`bstat(tower);G.runeBag.push({id:'cache-rune',name:'缓存刻印',q:'common',lv:0,affixes:[{k:'dmg',v:20}]});socketRune(tower,'cache-rune',0);`);
close(run('bstat(tower).dmg'),14.4,'socket is effective in the same frame');
run('bstat(tower);upgradeRuneIn(tower,0);');
close(run('bstat(tower).dmg'),14.688,'equipped upgrade is effective in the same frame');
run('bstat(tower);unsocketRune(tower,0);');
close(run('bstat(tower).dmg'),12,'removal is effective in the same frame');
run(`socketRune(tower,'cache-rune',0);bstat(tower);salvageRune('cache-rune');`);
close(run('bstat(tower).dmg'),12,'equipped salvage clears cached bonuses');
run(`G.tech.firepower=3;globalThis.oldRange=bstat(tower).range;buyTech('focus');`);
close(run('bstat(tower).range'),run('oldRange')*1.06,'range technology refreshes warm stats');
run(`G.tech.rapid=4;globalThis.oldRate=bstat(tower).rate;buyTech('swift');`);
close(run('bstat(tower).rate'),run('oldRate')*1.08,'cadence technology refreshes warm stats');

fixture(); run(`G.runeBag.push({id:'master-rune',name:'亲和刻印',q:'common',lv:0,affixes:[{k:'dmg',v:20}]});socketRune(tower,'master-rune',0);bstat(tower);G.tech.harvest=2;buyTech('runemaster');`);
close(run('bstat(tower).dmg'),14.76,'rune affinity technology refreshes equipped effects');
run(`updateDetail(true);globalThis.previous=document.getElementById('detail').innerHTML;unsocketRune(tower,0);updateDetail();`);
ok(run(`document.getElementById('detail').innerHTML!==previous && document.getElementById('detail').innerHTML.includes('未镶嵌符文')`),'removing a rune refreshes the visible detail without reselecting');

fixture(); close(run('towerDisplayDps(bstat(tower),tower)'),19.2,'default turret estimate');
run(`updateDetail(true);G.buff.overclock=10;updateDetail();`);
close(run('towerDisplayDps(bstat(tower),tower)'),51.84,'overclock includes damage and cadence');
ok(run(`document.getElementById('detail').innerHTML.includes('id="dDpsValue">51.8</b>')`),'buff acquisition refreshes displayed DPS');
run('tower.freezeT=4;updateDetail();');
close(run('towerDisplayDps(bstat(tower),tower)'),20.736,'frost slow appears in the estimate');
run('tower.empT=3;updateDetail();');
ok(run(`document.getElementById('detail').innerHTML.includes('id="dDpsValue">0</b>') && document.getElementById('detail').innerHTML.includes('瘫痪中')`),'EMP displays zero output and a reason');
run('tower.empT=tower.freezeT=0;G.buff.overclock=0;updateDetail();');
ok(run(`document.getElementById('detail').innerHTML.includes('id="dDpsValue">19.2</b>')`),'expired effects restore the display');
for(const type of ['flame','gravity']) {
  fixture(type);run('globalThis.baseDps=towerDisplayDps(bstat(tower),tower);G.buff.overclock=10;');
  close(run('towerDisplayDps(bstat(tower),tower)'),run('baseDps')*2.7,type+' estimate follows continuous weapon multipliers');
}

run(`newGame();G.tech.economy=2;G.tech.compound=1;G.fate.goldBoost=.3;G.event.eff.goldMul=2;
  selected={isBed:true};globalThis.goldBefore=G.gold;updateEconomy(1);updateDetail(true);`);
close(run('bedGoldEff()'),29.64,'bed includes economy, compound, story and event bonuses');
close(run('G.gold-goldBefore'),run('bedGoldEff()'),'displayed bed-only income equals settled income');
run(`globalThis.previous=document.getElementById('detail').innerHTML;G.event.eff.goldMul=1;updateDetail();`);
ok(run(`document.getElementById('detail').innerHTML!==previous && document.getElementById('detail').innerHTML.includes('14.8</b>/秒')`),'event expiry refreshes bed income');
run('setBedLevel(8);updateDetail(true);');
ok(run(`document.getElementById('detail').innerHTML.includes('（x1.8）') && !document.getElementById('detail').innerHTML.includes('（x2）')`),'late bed upgrade advertises the real 1.8 multiplier');
run('setBedLevel(7);updateDetail(true);');
ok(run(`document.getElementById('detail').innerHTML.includes('（x2）')`),'early bed upgrade still advertises doubling');

fixture('miner');run('G.tech.mining=2;G.tech.economy=2;G.event.eff.goldMul=2;updateDetail(true);');
const minerContribution=run('totalGoldRate()-bedGoldEff()');
ok(run(`document.getElementById('detail').innerHTML.includes('当前贡献 <b class="hl">'+fmt1(${minerContribution})+'</b> 金币/秒')`),'miner contribution matches its share of total income');
fixture('generator');run('G.tech.electric=2;G.tech.overcore=1;G.event.eff.powerMul=2;updateDetail(true);');
const powerContribution=run('powerInfo().regen');
ok(run(`document.getElementById('detail').innerHTML.includes('当前贡献 <b class="hl">'+fmt1(${powerContribution})+'</b> 电量/秒')`),'generator contribution matches actual generation');

run(`globalThis.random=Math.random;globalThis.before=JSON.stringify({gold:G.gold,souls:G.souls,stats:G.stats,level:tower.level});
  Math.random=()=>{throw Error('detail consumed combat RNG');};try{updateDetail(true);}finally{Math.random=random;}`);
ok(run('before===JSON.stringify({gold:G.gold,souls:G.souls,stats:G.stats,level:tower.level})'),'detail refresh does not mutate resources or advance combat RNG');
ok(game.errors.length===0,game.errors.join('\n'));
console.log('Detail, production and live-stat consistency: '+checks+' checks passed');
