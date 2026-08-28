# M2 立项评审预演（门禁彩排）

> 日期：2026-08-28 · 输入：m2-proposal（§1-§6b）、m2-kickoff（7 工作包）、script-engine-decision、gpu-backend-plan（附录 B）、m1-architecture.html、m1-final-summary
> 目标：评审人 60 分钟内完成"立项可批/待补/退回"三择。

## 1. 议程（材料 → 演示）

| 段 | 材料 | 演示命令（若需） |
| --- | --- | --- |
| 交接实况 | m1-final-summary（51/100/15/175） | ccx doctor --all |
| 架构总览 | m1-architecture.html（四层/三视图） | 浏览器打开 |
| 范围与批次 | m2-proposal §2-§3（7 包/三批评交付） | — |
| 首批凭据 | m2-proposal §6b（复核路径 5.3s） | ctest -R "script|e2e" && node --test 3 文件 |
| W1 预备 | gpu-backend-plan 附录 B（映射/验收/lavapipe） | — |
| 决策点 | script-engine-decision（QuickJS 主选） | ccx script run --engine |

## 2. 通过判据（exit criteria ↔ 凭据）

| 判据 | 现状凭据 | 状态 |
| --- | --- | --- |
| 1 首帧像素对照 | RHI 契约+FakeDevice+黄金 PPM；真后端待 GPU/lavapipe | ⏳ 环境 |
| 2 编辑器 15 步无手改 JSON 内测 | editor preview（--frame/--gif/--site/--apply）+ 会话命令面 | ✅ 本地可跑 |
| 3 脚本 10 命令场景 diff 可核 | script runner/桥/对拍/消费闭环 4 测试 + demo script.run/engine 步 | ✅ |
| 4 真机首帧截图+帧统计 | 打包链就绪；渠道待配置 | ⏳ 环境 |
| 5 压缩产物 magic 校验 | cook 管线 + 外部压缩器接入（工具未指名） | 🟡 待指名 |

## 3. 风险登记

| 风险 | 概率/影响 | 缓解 |
| --- | --- | --- |
| GPU 环境长期不可达 | 高/中 | 五级验收按 lavapipe 软件路径；仿真对照已全备 |
| webgpu.h 网络不可达 | 中/低 | 待复测；映射表已核对，到达即 vendor |
| Actions 未真跑 | 中/中 | ci-push-checklist 终审；push 后立即确认 |
| 真机/签名渠道 | 中/高 | W6 排第三批；不阻塞首批/二批 |
| 压缩器指名依赖 | 低/低 | 外部接口可用；pngquant 安装即接 |

## 4. 评审输出模板

- 结论：☐ 批准立项 ☐ 待补（列项） ☐ 退回（列项）
- 决议记录：批准批次（建议首批 W3/W4/W5 主干已在 M1 内完成，正式立项后转 ticket）
- 遗留：评审人签字/日期

> 彩排自检：以上材料全部落库（docs/working/），无需现场生成。
