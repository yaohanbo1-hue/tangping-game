# v2.0 开发审计（进行中）

基线：v1.9.2，提交 `4f6f557291ca98a6c01a63b6545d345ef2ca5dd5`。开发分支：`codex/v2-reconstruction`。未经全部验收不发布 2.0.0。

## 结构与状态流

`build.js` 按 story → data → names → core → save → net → dream → quest → render → ui → main 的顺序拼接到 shell.html，生成两个相同 HTML。运行时共享词法作用域；main 初始化 UI、绑定输入并驱动 step/render。core.newGame 重置 G 并先初始化 DreamEngine，再恢复 SaveSystem。core.startWave 驱动队列与梦境钩子，ui 对话系统独立持有队列和暂停状态。SaveSystem v6 分离 run/progress/dream，战斗读档回到本波开头并回滚净收入。

已逐项检查模块入口、构建、工作流、存档测试与媒体清单：16 建筑及各分支在 data.js；敌人/词缀/Boss 与波次表同处配置层；dream 管理生态、NPC、深层、旋律、理解、碎片和日记；quest 奖励走 applyStoryEffect。net 是本地命令/状态接口，未实现真实联机。

## 已确认的缺口

- 无玩法身份和独立剧情播放偏好；波次、Boss、委托、第四面墙、理解遭遇可直接进入演出/暂停。需集中策略，保留战斗型梦境。
- 剧情分支奖励在 UI 点击回调结算；无统一的逐事件结算记录，跳过/读档需要单独防重。
- 胜利 UI 直接读取分支笔记并播放结尾媒体；需阻止纯战斗解锁剧情结局，并提供完整直接结算和重开。
- 敌人本体 HP 在 spawnEnemy 计算，词缀后续原地修改；盾量在词缀前计算。需要统一最终生命/盾量结算，校准中后期曲线。
- 无尽 Boss 数量随 n/22 无上限增长；普通队列虽限制 90，但最终 Boss 队列仍需封顶。
- 工作流原来只校验构建，没有执行现有存档测试。已接入。
- render 已有 Canvas 炮塔绘制，不能把现有实现宣称为本轮美术重制。
- audio 有 8 首 MP3，story 有 12 段 MP4；保留原路径与 localStorage 键。

## 证据与限制

本机 shell 和 JavaScript 执行通道当前未返回可用运行结果；远端通过 GitHub 接口维护独立分支。Node 实测以 Actions 日志为准。没有实测帧时间，不声称性能瓶颈或 FPS 已达标。剩余全部视觉、数值模拟、移动端和完整剧情验收仍待实现/验证。
