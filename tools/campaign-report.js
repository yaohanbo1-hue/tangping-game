const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
const input=JSON.parse(fs.readFileSync(path.join(root,'artifacts','campaign-matrix.json'),'utf8'));
assert.equal(input.results.length,11,'complete the eleven-route matrix before updating evidence');
const labels={balanced:'均衡',economy:'经济',damage:'输出',relaxed:'低频操作／较低升级目标','no-control':'缺少控制','no-runes':'不装备符文'};
const difficulty={normal:'普通',hard:'困难',hell:'地狱'};
const results=input.results.map(r=>({
  profile:r.profile,difficulty:r.difficulty,seed:r.seed,won:r.won,stop:r.stop,wave:r.wave,
  seconds:r.seconds,leaks:r.leaks,bedHp:r.bedHp,damage:r.damage,actions:r.actions,lotteryRolls:r.lotteryRolls,
  final:r.bosses.find(b=>b.boss==='final'),bosses:r.bosses,
  keyWaves:r.samples.filter(s=>[1,5,10,20,30,40,50,60].includes(s.wave)),
  errors:r.errors,admin:r.admin,prizes:r.prizes,videos:r.videos,endingIds:r.endingIds,
}));
for(const row of results){
  assert.equal(row.won,true);assert.deepEqual(row.errors,[]);
  assert.equal(row.admin,false);assert.equal(row.lotteryRolls,0);
}
const route=(profile,level)=>results.find(r=>r.profile===profile&&r.difficulty===level&&r.seed===20261106);
const seconds=(profile,level)=>route(profile,level).final.seconds.toFixed(1);
fs.writeFileSync(path.join(root,'docs','campaign-validation.json'),JSON.stringify({note:input.note,physicalPlayerTrial:false,results},null,2));
const lines=[
  '# 从零资源的完整战役验证','',
  '2026-11-08本地记录；当前文件版本'+version+'，未提交／发布。`npm run test:campaign`运行11条路线，并用本脚本从原始结果生成本文和 `campaign-validation.json`。','',
  '## 方法','',
  '真实起始经济，无管理员、无跨局奖品；决策器调用公开建造、购买、升级、分支、符文与技能接口，实际 `step(1/60)` 结算，并推进虚拟时钟。没有额外金币、敌人HP改写或强制击杀。本矩阵没有使用摇奖；奖励与摇奖极端情况由独立回归覆盖。','',
  '均衡／经济／输出每模拟秒决策一次，共用固定布阵但投资重点不同。低频路线每2.5秒决策、每次至多升级两座武器、后期目标Lv19；它是操作延迟／预算取舍对照，不等于人工玩家。缺少控制路线替换控制武器并禁用冻结／击退技能；不装备符文路线保留其他操作。','',
  '## 完整结果','',
  '| 路线 | 难度 | 种子 | 波次 | 模拟秒数 | 破门 | 终焉秒数 | 终焉施法／打断／钟声 |',
  '|---|---|---:|---:|---:|---:|---:|---:|',
  ...results.map(r=>'| '+labels[r.profile]+' | '+difficulty[r.difficulty]+' | '+r.seed+' | '+r.wave+' | '+r.seconds.toFixed(2)+' | '+r.leaks+' | '+r.final.seconds.toFixed(2)+' | '+[r.final.casts,r.final.interrupts,r.final.pulses].join('／')+' |'),
  '',
  '全部11条路线通关；每场均无运行错误、无剧情视频、无未体验结局解锁。普通均衡还断言所有60波记录、Boss全部阶段访问及科技／符文／分支真实使用。有限终局只出现1位终焉，预告与生成数量一致。','',
  '## 观察与取舍','',
  '- 旧记录终焉约3.6秒，当前均衡普通约'+seconds('balanced','normal')+'秒、困难'+seconds('balanced','hard')+'秒、地狱'+seconds('balanced','hell')+'秒，保留施法和打断窗口。耐久由独立后期曲线产生，转阶段保护仍只有原定的短暂时间。',
  '- 低频地狱终焉'+seconds('relaxed','hell')+'秒；缺少控制地狱破门'+route('no-control','hell').leaks+'次；普通不装备符文的终焉'+seconds('no-runes','normal')+'秒。这些是具体策略的代价，不代表所有反制缺失必输。',
  '- 当前受测的均衡／低频路线保留防线运营空间；不把零破门直接解释为普遍简单或普遍平衡。需要物理输入延迟、更多人工布阵与主观试玩继续评价难度。',
  '- 修复过的地狱终局停滞由Boss误抽普通精英再生词缀引起；Boss已排除该抽取，普通精英的再生仍需集中火力处理。',
  '- 32分支／3等级／3靶场是注入预算的控制工作台，见 [BRANCH_BENCHMARK.md](BRANCH_BENCHMARK.md)；不能当作合法经济通关证明。元素／共鸣与45词缀交互另有专项检查。','',
  '原始逐波资源、理论DPS样本、建筑均级、击杀、实际伤害、各Boss生命／阶段／施法耗时在 `artifacts/campaign-matrix.json`；精简关键波与全部Boss记录随仓库保存在 [campaign-validation.json](campaign-validation.json)。物理设备、实机声音和最终人工评价仍待验收。','',
];
fs.writeFileSync(path.join(root,'docs','CAMPAIGN_VALIDATION.md'),lines.join('\n'));
console.log('Campaign evidence updated: eleven complete routes and key-wave records');
