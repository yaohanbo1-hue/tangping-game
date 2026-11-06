# 当前执行检查点

开发工作树：`C:\Users\hambu\Documents\Codex\tangping-game-v2`，分支 `codex/v2-reconstruction`。不要操作 home 根仓库；main 不改动。完整 v2.0 目标仍未完成，VERSION 保持 1.9.2，草稿 PR https://github.com/yaohanbo1-hue/tangping-game/pull/1 禁止合并。逐项清单见 V2_STATUS.md。

原先 GitHub ref 更新服务错误已经恢复，远端成功推进到 `9fa50f4`，其 Linux build 与 browser CI 均绿：[42129308510](https://github.com/yaohanbo1-hue/tangping-game/actions/runs/42129308510)。无需再次创建等价提交。

当前新增阶段：真实经济/伤害的完整战役、经济与科技推进、同类符文加算、实际输出统计、Boss 阶段阈值、持续伤害帧率一致性。Node 共 1474 项全过，构建同步。本机 Chromium153 桌面/Android 仿真与 WebKit26.6 iOS 仿真全部真实交互通过（含第四层科技可见）。六场从零资源的真实运营均打完 60 波，原始 `artifacts/campaign-matrix.json`，精简追踪 `docs/campaign-validation.json`，说明 CAMPAIGN_VALIDATION.md。困难/地狱完美策略仍零破门，终焉约 3.6 秒，禁止宣称最终难度完成。

浏览器压力 WebKit 平均 268.62ms/帧、P95 353ms；当前性能远未达标。旧空场 A/B 定位绘制/合成成本明显，见 PERFORMANCE.md。仿真浏览器不等于真实手机。真实截图和帧时间在 `artifacts/browser/`，它们被 gitignore 排除。

经济/伤害阶段现已提交推送 `e6bc560`，Linux build/browser CI [42132345492](https://github.com/yaohanbo1-hue/tangping-game/actions/runs/42132345492) 全绿。

战场美术阶段已接入 scene-art.js：三路雨窗/石砖/积水，木板宿舍，钢框木/钢芯门，实际 HP 损坏/破门/焊接修复，床铺寝具、孩子与暖金应急灯/柜/供电线。静态离屏缓存 4,014,080 像素字节；移除覆盖主体的旧紫色扫描 CSS。render.js 删除旧星空、房间/床重复绘制，震屏/电弧不消耗战斗随机数。create-game-assets 已读并告知使用；样板、实际截图及来源见 ART_DIRECTION.md、assets/art/manifest.json。16 建筑/32 转职、35 怪物/10 词缀、五 Boss、UI 新画面尚未开始，不能拿旧图形声称重制。

本阶段 Node1474 项、构建一致、场景真实 Canvas 缓存/动画/降低动态/战斗状态隔离测试、全部三浏览器交互均过。本机 WebKit26.6 压力193.47ms/帧、P95261ms，JS9.75ms；实时场景敌数不同，禁止和旧值直接比较加速。空场暂停 A/B：正常17.58FPS，关CSS38.13，仅藏Canvas20.58，两者关52.37。性能远未达标；后续新建筑/敌人艺术应减少透明叠画，并处理DOM模糊合成。新版CI需推送后复查。

注意浏览器测试暴露桌面1440×900时建造栏首卡最初 x=-142.875，被裁出视口；Playwright自动滚入后可点击，旧版也存在。UI阶段必须修正并加入全部16卡可见的断言，不能把当前点击通过当作完整桌面布局验收。手机844×390可见16卡，仍非物理设备。

C盘一度满导致截图ENOSPC。已将本轮下载的完整Chromium1243目录移至 `D:\CodexArtifacts\tangping-game\browser-cache\chromium-1243`，释放约431MB。默认headless仍使用C盘的chromium_headless_shell-1243；所有测试可用，未移动用户文件。后续写大工件先确认磁盘。

下一步按原顺序继续16建筑/32分支的真实机制审计和统一美术，再35怪物、五Boss、全UI、剧情音频、防剧透、画质及性能回归。原完整目标不缩小；VERSION保持1.9.2，PR保持草稿。

本地测试进程已结束；后续以实际进程/CI 状态为准。无需唤醒或询问睡眠中的用户。
