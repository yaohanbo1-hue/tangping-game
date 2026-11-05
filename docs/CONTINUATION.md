# 当前执行检查点

开发工作树：`C:\Users\hambu\Documents\Codex\tangping-game-v2`，分支 `codex/v2-reconstruction`。不要操作 home 根仓库；main 不改动。完整 v2.0 目标仍未完成，VERSION 保持 1.9.2，草稿 PR https://github.com/yaohanbo1-hue/tangping-game/pull/1 禁止合并。逐项清单见 V2_STATUS.md。

原先 GitHub ref 更新服务错误已经恢复，远端成功推进到 `9fa50f4`，其 Linux build 与 browser CI 均绿：[42129308510](https://github.com/yaohanbo1-hue/tangping-game/actions/runs/42129308510)。无需再次创建等价提交。

当前新增阶段：真实经济/伤害的完整战役、经济与科技推进、同类符文加算、实际输出统计、Boss 阶段阈值、持续伤害帧率一致性。Node 共 1474 项全过，构建同步。本机 Chromium153 桌面/Android 仿真与 WebKit26.6 iOS 仿真全部真实交互通过（含第四层科技可见）。六场从零资源的真实运营均打完 60 波，原始 `artifacts/campaign-matrix.json`，精简追踪 `docs/campaign-validation.json`，说明 CAMPAIGN_VALIDATION.md。困难/地狱完美策略仍零破门，终焉约 3.6 秒，禁止宣称最终难度完成。

浏览器压力 WebKit 平均 268.62ms/帧、P95 353ms；当前性能远未达标。旧空场 A/B 定位绘制/合成成本明显，见 PERFORMANCE.md。仿真浏览器不等于真实手机。真实截图和帧时间在 `artifacts/browser/`，它们被 gitignore 排除。

下一步战场美术：create-game-assets 技能已读取并告知使用。Canvas 程序化场景锁定暖金床头灯、深蓝雨夜三走廊、紫红梦魇。新艺术必须有真实轮廓/材质/灯具/雨影与门体损坏修复，缓存静态图层、不消耗战斗随机数，截图核验。之后仍要完整推进 16 建筑/32 转职、35 怪物/10 词缀、五 Boss 独立技能、全套 UI、剧情音频、防剧透审计、画质设置及性能等原始要求，不能缩小任务。

本地测试进程已结束；后续以实际进程/CI 状态为准。无需唤醒或询问睡眠中的用户。
