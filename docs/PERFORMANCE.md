# 性能证据（尚未达标）

测试代码：`node tests/browser.test.js`；拆分 raster/compositor：`node tests/profile-render.js`。

提交 `2becb98` 的 Windows 本机、WebKit 27.2、844×390 仿真触控视口、DPR 1、headless、32 座 Lv12 建筑与约 90 个初始敌人的压力场景：

- 180 帧的平均间隔 226.76ms，P95 373ms；Canvas JS 提交平均 10.72ms，P95 18ms。
- 输入、建造、55/60 波、重开、关闭进行中的剧情、旋转均通过；不是物理 iOS 测试。
- 同一空战场、暂停模拟、每个条件约 3 秒的 WebKit 对照：正常 10.95 FPS；去除 CSS 阴影/滤镜/动画 14.94 FPS；仅隐藏 Canvas 24.98 FPS；同时关闭两者 39.92 FPS。

这说明模拟之外的绘制和合成有重大成本，不能只做目标查询微优化。后续应分别量测背景缓存、Canvas shadowBlur/透明叠画、DOM backdrop-filter 与阴影动画，逐项改动后在同一场景复测。尚未实施这些优化，不保证桌面60或手机30FPS。

Linux WPE 27.2 在 CI 的特殊现象：开始后 statFrame 固定在 9，计时器仍工作，无 JS loopErrors；Playwright 建造点击因等不到稳定 rAF 而超时。Windows 同版本可继续，已保留截图和布局 JSON。CI 现改用固定 Playwright 1.63.0 的 CPU raster 后端复测；1.64 CPU 模式存在上游退出崩溃问题，见 [Playwright #43394](https://github.com/microsoft/playwright/issues/43394)。当前证据尚不足以认定 Linux 停帧与该退出问题同因。

所有原始截图和 frame-times.json 留在 Actions `browser-evidence` 工件。本机临时文件在 artifacts/，不混入游戏发布文件。
