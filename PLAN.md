# 🎮 躺平发育：梦魇防线 — 创新系统实现计划

## 阶段1：基础架构 + 数据层 ✅ 完成
- [x] **T1.1** story.js — 剧情数据（WAVE_STORY 7条、BOSS_DIALOG 5个、DREAM_FRAGMENTS 20个、NPC_DIALOG 6个、DEEP_DREAM_LEVELS 3个、FOURTH_WALL_EVENTS 7个、MERCY_ENCOUNTERS 8个、SOUND_MELODIES 6个）
- [x] **T1.2** dream.js — 梦境系统引擎（EventBus、DreamEcology、NeutralCreatures、NPCGuardians、FourthWall、DeepDream、DreamSound、MercyPath、DreamFragments、DreamDiary、DreamEngine）
- [x] **T1.3** build.js — 更新加载 story.js、dream.js
- [x] **T1.4** core.js 事件集成 — 6个钩子：newGame→init、step→tick、startWave→onWaveStart、endWave→onWaveEnd、killEnemy→onEnemyKilled、tryBuild→onBuildingClick

## 阶段2-4：UI集成 ✅ 完成
- [x] shell.html — 7个新面板HTML + 约200行CSS（梦境日记、NPC驻守、第四面墙、梦中梦、剧情对话、碎片画廊、理解路线、声音可视化）
- [x] ui.js — 梦境UI函数（showStoryDialog、showDiaryPanel、showNPCPanel、showFragmentGallery、showFakeCrash、applyUICorrupt、showChatMessage、showDeepDreamTransition、showMercyDialog）
- [x] main.js — 初始化调用（wireDreamMenuButtons、initDreamUI）
- [x] core.js — 波次剧情触发（WAVE_STORY、BOSS_DIALOG）

## 构建结果
- tangping.html: 341KB（含所有新系统）
- 旧版HTML已备份至父目录

## 待用户测试/后续优化
- 运行游戏测试波次剧情弹出、NPC招募、碎片掉落等交互效果
- 根据实际运行效果微调数值平衡
- 添加更多波次剧情、NPC支线
