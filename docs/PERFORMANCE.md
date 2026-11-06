# 性能证据（尚未达标）

测试代码：`node tests/browser.test.js`；拆分 raster/compositor：`node tests/profile-render.js`。

提交 `2becb98` 的 Windows 本机、WebKit 27.2、844×390 仿真触控视口、DPR 1、headless、32 座 Lv12 建筑与约 90 个初始敌人的压力场景：

- 180 帧的平均间隔 226.76ms，P95 373ms；Canvas JS 提交平均 10.72ms，P95 18ms。
- 输入、建造、55/60 波、重开、关闭进行中的剧情、旋转均通过；不是物理 iOS 测试。
- 同一空战场、暂停模拟、每个条件约 3 秒的 WebKit 对照：正常 10.95 FPS；去除 CSS 阴影/滤镜/动画 14.94 FPS；仅隐藏 Canvas 24.98 FPS；同时关闭两者 39.92 FPS。

这说明模拟之外的绘制和合成有重大成本，不能只做目标查询微优化。后续应分别量测背景缓存、Canvas shadowBlur/透明叠画、DOM backdrop-filter 与阴影动画，逐项改动后在同一场景复测。尚未实施这些优化，不保证桌面60或手机30FPS。

Linux WPE 27.2 在旧 CI 的特殊现象：开始后 statFrame 固定在 9，计时器仍工作，无 JS loopErrors；Playwright 建造点击因等不到稳定 rAF 而超时。Windows 同版本可继续，已保留截图和布局 JSON。固定 Playwright 1.63.0 / CPU raster 后，提交 e6bc560 的 Linux browser job 已通过：[42132345492](https://github.com/yaohanbo1-hue/tangping-game/actions/runs/42132345492)。此前 1.64 CPU 模式存在上游退出崩溃问题，见 [Playwright #43394](https://github.com/microsoft/playwright/issues/43394)。不能据此认定原停帧和退出崩溃同因。

## 雨夜场景阶段实测

新场景固定内容烘焙到离屏图层，移除旧 CSS 紫色扫描叠层；动态雨雾及床头灯保留。像素缓存 4,014,080 字节，60 帧只构建一次，无逐帧背景渐变/纹理生成。`render.js` 不再调用战斗随机数。

场景提交 `629c8b0`，本机 Windows / Playwright1.63 / DPR1 / headless，`tests/browser.test.js` 的 180 帧压力回归：

| 引擎/视口 | 平均帧间隔 ms | P95 ms | JS render 平均 ms | 结束时敌人/建筑 |
|---|---:|---:|---:|---:|
| Chromium153 桌面 1440×900 | 281.47 | 433.4 | 15.93 | 88 / 31 |
| Chromium153 Android 仿真 844×390 | 216.07 | 316.7 | 13.04 | 68 / 31 |
| WebKit26.6 iOS 仿真 844×390 | 193.47 | 261 | 9.75 | 114 / 32 |

三种交互回归均通过。敌人/建筑会在实时战斗中变化，旧记录的浏览器版本和结束场景也不同；不能将这些数字作严格的新旧性能比。当前软件栅格化帧间隔远未达标。尚需在固定实体场景下量测全部建筑/文字/粒子/DOM 模糊合成，接入画质分级并测试物理设备。

新场景同机 WebKit26.6 空场暂停的 3 秒对照：正常 17.58 FPS，关闭 CSS 动画/阴影/滤镜 38.13 FPS，仅隐藏 Canvas 20.58 FPS，同时关闭两者 52.37 FPS。这将后续优先项指向 DOM 模糊合成与动态样式；旧数据来自另一 WebKit 版本，不能拿来计算新场景加速比。原始 `webkit-render-profile.json` 保留在本机 artifacts。

## 建筑组件阶段实测

同机 Windows / Playwright1.63、DPR1、headless，在新的 16 建筑组件及命中反馈上重跑 180 帧：

| 引擎/视口 | 平均帧间隔 ms | P95 ms | JS render 平均 ms | 结束敌人/建筑 |
|---|---:|---:|---:|---:|
| Chromium153 桌面 1440×900 | 170.01 | 266.6 | 10.71 | 87 / 32 |
| Chromium153 Android 仿真 844×390 | 115.75 | 199.9 | 8.90 | 112 / 32 |
| WebKit26.6 iOS 仿真 844×390 | 160.58 | 210 | 8.68 | 80 / 32 |

三浏览器交互均过。主体改为缓存底盘/旋转头、去除旧常驻巨型光雾；联系表缓存 3,153,920 字节，16 建筑实景 3,563,520 字节，热缓存30帧零重建。新命中事件最多在现有effects少于96时追加，持续武器合并反馈。实时敌人组成不同，不能据上两张表计算严格加速比；性能仍未达目标，仿真不是物理手机。原始证据仍在 artifacts/browser 和 artifacts/buildings。

## 第二轮敌人行为阶段实测

同样180帧，三浏览器交互再次通过：桌面平均142.69ms/P95 233.3ms、Android仿真166.11ms/P95 333.3ms、WebKit仿真203.95ms/P95 313ms。JS绘制平均分别11.33/11.06/11.20ms，结束敌人/建筑分别77/31、88/31、9/31。这次同时运行完整Node战役，存在CPU竞争且实时组成差异很大，不能拿来证明性能改善；仍远未达标。

所有原始截图和 frame-times.json 留在 Actions `browser-evidence` 工件。本机临时文件在 artifacts/，不混入游戏发布文件。
