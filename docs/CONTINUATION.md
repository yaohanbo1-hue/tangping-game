# 当前执行检查点

当前只在 `D:\CodexArtifacts\tangping-game\workspace` 独立副本、分支 `codex/v2-reconstruction` 工作。C盘反复写满，原C盘worktree及父仓库保留；D副本从b4782b6继承同一分支历史，origin指向GitHub。home根仓库不是游戏项目；main未改动（本地81079f6），禁止合并。完整2.0目标未完成，VERSION保持1.9.2。草稿PR https://github.com/yaohanbo1-hue/tangping-game/pull/1 。剩余逐项要求见V2_STATUS.md，不缩小原始范围。

已推送基础阶段：纯战斗/剧情播放与奖励账本分离、旧档v7迁移、HP平滑倍率/三路编队、真实伤害统计和Boss阶段阈值、经济/科技校准、从零60波、雨夜场景、建筑机制修复。d9b6cfb的Linux build/browser CI均绿：[42135913487](https://github.com/yaohanbo1-hue/tangping-game/actions/runs/42135913487)。此前GitHub ref错误已恢复，不要重复创建等价提交。

本轮新建筑美术：building-art.js原创建模16原型+32分支，不再hex+emoji；80²底盘、96²旋转头，LRU144组件。全家族工作/待机、实际受击/修复/升级、Lv12/30装甲、选中、实体建造预览；高等级仍显示实际转职名，原风味名留在详情。真实射程包含generator.b的zapRange。11类命中按实际伤害触发，持续武器合并，新增impact在effects已有96时省略；不改变伤害。SceneArt另加窗外远楼。文档与真实图：BUILDING_ART.md、assets/art/buildings.json、docs/images/buildings-*。

验证：Node23+255+1064+64+68+451+27=1952项全过。npm run test:art通过环境及48外观/16状态家族、等级结构、选中/范围、降低动态、缓存、全16实体60帧不改战斗状态/不消耗Math.random。热缓存30帧零重建，联系表3,153,920B、实景3,563,520B。新增impact开启/关闭240步实际模拟的HP/伤害/经济/AI/RNG轨迹完全一致。注意旧spawnParts/addText仍共享模拟RNG，不得声称全画质随机源隔离完成。

本轮完整三浏览器交互过：Chromium153桌面1440x900平均170.01ms、P95266.6，Android仿真844x390平均115.75ms、P95199.9，WebKit26.6 iOS仿真平均160.58ms、P95210。软件栅格、实时敌群不同，不算严格新旧加速比或物理手机证据；性能远未达标。原始artifacts/browser及artifacts/buildings。此后仅加发电机范围显示、建筑标签和缓存远楼，已有原生回归覆盖；新提交需远端CI验证。

建筑分支451项曾复现并修复毒塔转职失去poison/rate、瘟疫标记未消费、独立维修盾、范围脉冲眩晕/连锁取舍、导弹溅射中心、高等级冰霜倒退和同帧缓存。六场合法运营重跑全60波、零错误/视频/结局串档/破门；普通均衡两种子2553.78/2585.93游戏秒，经济2543.65，输出2580.13，困难2644.78，地狱2740。终焉仍3.6秒左右，高难不达标。docs/campaign-validation.json对应c2acaa2。54场当前HP新旧对照已完成并复制docs/balance-simulation.json；旧模型只换HP，粒子/击杀导致随机路径分化，不能拿总输出差全部归因HP。固定单位HP比较见BALANCE.md。

下一步按顺序35普通梦魇与五Boss。数据ENEMY_DEFS有36项（35非Boss+一个通用boss），BOSS_DEFS另定义5个Boss身份。刚读过所有能力键：stealth/explode/heal/split/shieldself/flying/summon/frenzy/vamp/reflect/steal/haste/nullify/phaseShield/targetBuilding/adapt/burrow/emp/mimic/curse/swarm/parasite/ward/freezeTower/revive/buildingBonus。要真实验证再画，死灵revive旧实现只是生成小怪，不能称尸体复活。35非Boss新轮廓、移动/前摇/受击/死亡、10词缀新标识、五Boss专属美术/独立机制尚未实施。

继续注意：火焰/引力持续武器是否遗漏freezeT和射速（源码没有乘towerRateMulOn）；毒DOT抗性、全部共鸣反应需审计；collapse未消费；科技/符文的同帧缓存需更广审计。32分支成本收益与困难/地狱策略性未验收。全UI/Logo/音频/剧情防剧透/视频失败/全面画质/后台恢复/性能仍在原任务范围。net.js非真联机。

桌面1440x900初始建造栏首卡x=-142.875被裁出，Playwright滚入后能点击；UI阶段修正并断言16卡全部可见。手机仿真能见16卡，非实机。当前旧UI/敌人外观仍不算新重制。

C盘再次满导致build写入失败，旧index测试曾误跑（已不计入，并重建复测）。本任务下载的chromium-1243、chromium_headless_shell-1243、webkit-2359现全部实体位于 `D:\CodexArtifacts\tangping-game\browser-cache\`，C盘原ms-playwright目录通过junction保持路径；本地headless测试可用，未移动用户文件。C盘目前约400MB可用，大文件前先检查。

当前全部本地测试会话已正常结束（19181三浏览器、64011单位/原生、各4秒gallery）。新外观提交推送后查最新head对应CI。create-game-assets技能已读取并告知使用；无需重复读技能或唤醒睡眠中的用户。不调用完成标记，不发布2.0。

## 后续敌人行动阶段

建筑外观已推送8cad214，Linux build/browser均绿：[42139100228](https://github.com/yaohanbo1-hue/tangping-game/actions/runs/42139100228)。

本轮又完成enemy-actions.js真实残骸复苏及控制反制。原先眩晕只令速度0，贴身仍攻击/EMP/治疗/寄生/召唤；已复现并停止控制期间主动攻击/能力。被动光环/恢复和DOT继续。火焰/引力接触输出与拉扯现在吃冻缓40%，全局射速/毒伤抗性仍待审计。

复苏记录真死的非Boss、非召唤、非已复苏、非死灵单位；残骸12秒/64个、同路210范围最多3个、每7秒、0.85秒前摇可被眩晕/时间冻结/击杀/禁召打断。复苏原对象及原HP上限，当前HP45%，不再发金币/魂/符文/击杀型剧情掉落。共用admitEnemySummon的120次/在场200停止接纳预算，不能反复复苏同一体。预约为数字token，JSON无循环；读档重开波不序列化残骸/施法。画面已接简洁残骸/连线/进度预警，仍是旧敌人外观。

100项敌人回归全过：35移动、35+5Boss的眩晕反制、冻结/EMP/霜噬/治疗、持续武器冻缓、复苏/打断/原身份/HP/不重发/数量/过期/换波/读档。Node总计2052；原生环境及48建筑回归仍过。新enemy-actions.browser.test.js以844x390仿真真实触控W打断，原重甲单位复苏通过，无视频请求/loop错误。见ENEMY_AUDIT.md与docs/images/revive-windup.png。

六场真实运营再次全通：普通均衡两种子2553.78/2585.93秒、经济2508.38、输出2509.42、困难2660.40、地狱2812.83，均零破门/视频/结局串档。终焉仍约3.6秒，不能验收高难。最新docs/campaign-validation.json已更新；54场旧HP对照仍为c2acaa2阶段，不假称敌人修复后又跑过。当前所有本地测试会话已正常结束。新行动提交推送后再查新head CI。

下一步继续35普通怪各特殊能力/前摇/反制的真实审计和35新形态、10词缀新标识，再5Boss新机制/专属美术。不要重复先前基线与已过的48建筑整套重做。仍未完成全UI、剧情音频、防剧透、画质/性能、分支平衡等完整范围。

## 第二轮敌人结算

新tests/enemy-abilities.test.js155项已复现23条旧行为失败并修复，Node合计2207。吸血40%本体赋值/实际损伤回血、寄生0.6s/8s/3s/260距离及控制打断、狂暴和五Boss阶段攻击倍率、飞行扑床/锈蚀优先炮塔、爆炸/诅咒床铺伤害及余时/过量统计均已回归。45个词缀两两组合的控制/击杀测试不是平衡验收。即时清理出售目标、重复出售防退款也通过。enemyCastCue共用真实冷却，旧重复预警已移除；寄生触控时间冻结、连线和范围打断真实Chromium通过。docs/images/parasite-channel.png是实拍旧怪物形状，不能算新怪美术。

六场真实运营再跑结果与b4782b6完全一致（完整docs/campaign-validation.json更新）；近防线机制另由受控战斗测试触发。当前三浏览器交互均通过，平均帧间隔142.69/166.11/203.95ms，软件栅格且同时跑战役，不是性能改善证据。全部本地会话50093/1040/1735均已正常结束。b4782b6远端build/browser均绿42142215644。

C盘再次0字节，新D副本继续工作。node_modules通过junction复用原安装，artifacts通过junction放D runtime-artifacts。tests/browser-env.js仅修改测试进程临时目录；npm命令需显式`--cache D:\CodexArtifacts\tangping-game\npm-cache`避免npm日志写满C。不要移除用户文件，不要继续尝试被策略阻止的目录迁移。
