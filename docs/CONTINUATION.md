# 当前执行检查点

开发工作树：`C:\Users\hambu\Documents\Codex\tangping-game-v2`。仅在此独立仓库工作，用户 home 根仓库不是游戏项目。分支 `codex/v2-reconstruction`。

目标仍为原始完整 v2.0；未完成，禁止发布或合并。剩余逐项清单见 V2_STATUS.md。

本地提交 `1e66fcb93c93e9a3b03025ec2d432730ddf7d268` 包含已验证报告与 Playwright 1.63.0/CPU raster CI 设置。远端仍为 `2becb988c54193a16eec943b64e1ab1288717b1a`：git push 返回 GitHub `fatal error in commit_refs_rules`；GitHub 工具 update_ref 返回 GraphQL 服务端错误。两条途径均非自动审批拒绝。API 已创建等价树 `dcb33f1a1576fc1fe839b28556c517cbbb04b667` 与提交 `7f61041498c9a5e00659eb37aaef353d603905df`，但尚未成功移动远端分支。请先复查远端 head，不要盲目改写历史；本地与 API 提交的树相同。

本机 Node24.13.1 可执行，Playwright 1.63.0 及其 WebKit26.6 已安装。Node 存档23 + campaign255 + balance1064 全过，node build.js 与两个 HTML 一致。本机 WebKit26.6 真实交互测试通过，压力平均250.65ms/帧，P95 341ms，性能远未达标。新版 Linux CPU renderer CI 尚未触发，不能宣称 CI 已绿。

此前 Linux CI：Chromium 桌面/仿真触控通过；WebKit27.2 在开局后 rAF 停在9帧，无 JS 错误，点击稳定性等待超时。同版本 Windows 可运行。上游1.64 CPU raster 有已确认的退出崩溃，故固定1.63.0并指定Linux CPU raster复测，尚未证实它能解决本仓库的停帧。

真实截图与性能原始文件：`artifacts/browser/`（本机）、`artifacts/ci-browser/`（下载的失败CI工件）；这些路径已被 .gitignore 排除。不要把旧有紫色场景和现成 Canvas 建筑声称为本轮美术重制。`tests/profile-render.js` 的对照已证实绘制/合成成本显著：同一空战场正常10.95FPS，关CSS效果14.94，隐藏Canvas24.98，同时关闭39.92（Windows WebKit27.2 headless，不是物理手机）。

没有仍在运行的本地测试会话或后台服务。下一步优先恢复远端ref更新并验证Linux浏览器，再继续正常经济/伤害的完整通关、经济校准和三路雨夜新美术。无需用户确认或唤醒用户。
