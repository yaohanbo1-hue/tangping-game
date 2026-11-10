# v2 当前验收状态

以下为v2.0.0发布复核（2026-11-10新增玩法前）：PR #3和发布前小屏修复PR #4均已合并；核对时main为`2e5828d`，v2.0.0发布提交为`4b3f072`。VERSION、package与两份HTML统一为2.0.0，存档仍v7。正式[Release](https://github.com/yaohanbo1-hue/tangping-game/releases/tag/v2.0.0)已于2026-11-08发布；历史阶段记录见 [V2_STATUS_HISTORY.md](V2_STATUS_HISTORY.md)。

2026-11-10只读核对：线上GitHub Pages返回200，版本2.0.0、Apache-2.0标记存在，HTML与本地／Release附件逐字节一致，SHA-256为`f98ac131bbf52c4ec16b69852e9e5b8d48bb75230de82f938aa725d27569e52c`。完整游戏ZIP为33,185,672字节，SHA-256为`681f7ea3c40dc715927380e8b2754011fac455ea2cf60e4e65a6d566b9861cd6`；GitHub记录的上传摘要一致。

发布提交的[Linux CI](https://github.com/yaohanbo1-hue/tangping-game/actions/runs/42457562209)构建与浏览器均已通过，包含320px大字资源栏修复。Linux WebKit音频检查通过；Windows WebKit缺少Web Audio的既有记录继续保留，均不等于物理iPhone验收。

## 已落实的本地代码与证据

| 范围 | 当前结果 | 资料 |
|---|---|---|
| 武器／场景／敌人／UI | 保留三位子代理精修；48建筑外观、40怪物、人物／中立生物、雨夜场景和黄铜界面；继续完善长飘字和Boss预警 | [视觉](VISUAL_POLISH.md)、WEAPON_POLISH_FOLLOWUP.md、SCENE_ENEMY_FOLLOWUP.md、UI_POLISH_FOLLOWUP.md |
| 手机操作 | 原生主页、HUD、抽屉、档案／剧情／详情；竖屏8×5大格布防、44×48px以上目标、窄屏滚动、大字、同局旋转与通知 | [手机](MOBILE_ADAPTATION.md) |
| Boss | 五套行动／前摇／中断／阶段收益，弱点／韧性与编号路段；普通精英词缀排除Boss，奖励账本不重复支付 | [反制资料](ENEMY_COUNTERPLAY.md) |
| 数值／奖励 | 11条真实经济60波路线；32分支288组控制靶场；六反应双向结算、共鸣、自身计数、45词缀组合；摇奖赠礼／上限／读档修复 | [战役](CAMPAIGN_VALIDATION.md)、[分支](BRANCH_BENCHMARK.md) |
| 实战统计 | 近5模拟秒DPS、实际本体／护盾损失、真实经济／支援贡献；理论值与观察值分开说明，载入重置观察 | [运行时](RUNTIME_FOLLOWUP.md) |
| 剧情 | 收集／揭示分离；旁路按实际已读节点显示；五幕标题／序号进度／灯光底色、短屏大字与选项可见；两段镜头钟面校正为03:07 | [呈现复查](STORY_PRESENTATION_REVIEW.md)、narrative.test.js、narrative.browser.test.js、campaign.test.js |
| 声音／画质 | 三档战场画质、独立表现随机源、有界字形缓存；主／音乐／战斗／界面／环境设置，11武器及五Boss预警、声部预算、静音和后台恢复 | [运行时](RUNTIME_FOLLOWUP.md) |
| 许可／构建 | Apache-2.0全文、NOTICE、历史MIT声明和素材清单；两份一致的独立HTML，跨目录／换行／源码替换检查 | LICENSE、NOTICE、LICENSES/MIT-legacy.txt |
| 真机工具 | 本地Wi-Fi入口、独立游戏标签、13类操作／16项试听与10秒实际采样；音乐及媒体分段读取，schema 2手动听感报告 | [DEVICE_TESTING.md](DEVICE_TESTING.md) |

## 本地验证

3694项具名逻辑断言，另有设备验收服务器、构建与许可检查。美术、界面逐屏、原生手机流程、320px大字、Boss低画质预警／真实冻结点按、剧情防剧透、音频与验收工具浏览器测试均有实际结果；经典桌面／Android／WebKit的键盘、触控、后台恢复和媒体失败也已回归。

11条合法路线均从零资源开始并完成60波。均衡终焉普通33.83秒、困难54.10秒、地狱87.43秒；低频地狱113.17秒，缺少控制地狱1次破门，不装备符文普通64.70秒。程序决策不等于人工难度评价，控制靶场也不当作合法战役。

性能按固定32建筑／95敌人拆分采样，不用不同敌人数量的浏览器结果计算加速比，详细数据与范围见RUNTIME_FOLLOWUP.md。Windows WebKit26.6实测没有Web Audio：音频输出明确跳过，只验收设置与静音回退，不声称iPhone声音通过。

GitHub Actions配置已接入本轮新增检查与证据收集，远端结果以本轮PR对应提交的Actions为准，不能沿用旧提交的绿色记录。

最终补充陨石模拟时钟：暂停／后台不再落伤，旧弹道不会跨局；14项逻辑及实际手机尺寸的技能点按、暂停等待、恢复命中通过。最终战役数据已据此重新生成。

五幕呈现另完成桌面、390px手机、320px大字共15组实际MP4解码与MP3播放检查；章节条只显示序号，小屏回应按钮保持完整可见。两段03:07钟面校正保留完整294帧、12.25秒、原音轨与手机兼容格式，见 [STORY_PRESENTATION_REVIEW.md](STORY_PRESENTATION_REVIEW.md)。验收页使用实际生产音效提供16项试听，并记录Web Audio／PCM回退；自动播放和自动样例不会被计为真人听感通过。

## 仍待验收

- 物理Android与iPhone：真实安全区／地址栏、系统手势、旋转／全屏回退、后台恢复、声音解锁、持续密集战斗与大字操作。
- 实际扬声器／耳机听感、五幕剧情完整情绪与人工难度反馈。PCM波形、脚本中断和合法路线是客观覆盖，不替代这些体验。

逐项[完成情况审计](COMPLETION_AUDIT.md)保留31条计划的实现／证据与缺口：26项已落实、5项待实际记录；人工难度评价已从原说明单列为待验。CI配置补齐自动设备报告收集，结果以本轮PR对应提交为准。

执行入口和记录表已经准备，`npm run device:lab -- --lan`可供同一Wi-Fi手机访问。当前没有任何物理设备报告；自动样例均为 `physicalConfirmed:false`。因此完整目标仍保持未完成，版本更新不代表未测项目已经通过。详细发布文字见 [RELEASE_NOTES_NEXT.md](../RELEASE_NOTES_NEXT.md)，逐项进度见 [COMPLETION_PLAN.md](COMPLETION_PLAN.md)。

## v2.1.0 守夜互动续作

维护者追加减少无聊、增强沉浸和多个彩蛋的要求。本轮新增六类可选备战抉择、五件宿舍道具与六项收藏、实际战况回应；技能冷却与安排账本随v7存档恢复。当前代码版本2.1.0，正式Release v2.0.0保持不变，详见[本轮说明](IMMERSION_UPDATE.md)。本轮按最新指示直接合并推送，推送后核对CI和线上产物；原有五项实际体验仍未冒记完成。
