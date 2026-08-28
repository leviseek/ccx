# M1 Gate 预演评审材料（v0.3.43，2026-08-27）

> 用途：M1 里程碑收集评审用一页摘要；与 m1-handoff.md / m2-kickoff.md / m2-gate-rehearsal.md 互指。

## 1. 已实现（对照 m1-handoff 基线 + 50 轮增量）

| 面 | 成果 | 守护 |
| --- | --- | --- |
| 引擎 | 13 构建模块；渲染/动画/物理/粒子/输入/音频全数据面 | CTest 46 |
| 服务 | stdio daemon（8 服务 20+ RPC 方法）+ 事件推送 + 协议错误码 + EOF/常驻 | daemon 14 真进程 |
| AI 接口 | MCP 工具层（9 工具 listTools/callTool）+ CLI mcp 入口 | daemon+cli 用例 |
| 工具链 | CLI 21 个子命令（create/scene/atlas/render/cook/build/frame/editor/mcp/doctor/service/demo…） | cli 19 用例 |
| 编辑器 | Shell+视图模型+HTML 渲染+preview（--frame BMP/--gif）| editor 套件 |
| 交付链 | demo all **10 步单命令**（open…mcp…cook 全 ok，步耗时输出） | cli 用例 |
| 首帧仿真 | RHI(Device)+FakeDevice+假 GPU 运行时（GameLoop 每帧提交/readback 像素断言） | e2e.fake_gpu_* |
| 物理 | 宽相→窄相→层掩码→Collider 组件→ADR-003 往返→接触事件/音效/时序动画 | physics.* 7 测试 |
| 一致性 | 跨语言渲染计划对拍、场景 diff、组件写路径校验、审计留痕（铁律 12） | 各套件 |

## 2. 出口对照（M1 界定）

| 出口 | 状态 | 依据 |
| --- | --- | --- |
| 引擎组装 + 帧循环全链 | ✅ | full_tick / render_frame / fake_gpu_runtime |
| 服务三形态 + AI 接口 | ✅ | daemon/MCP/CLI 测试 |
| 编辑器模型→视图→预览 | ✅ | editor 套件 |
| 交付链单命令 | ✅ | demo all 10 步 |
| GPU 首帧（真） | 🟡 环境依赖 | RHI 契约+FakeDevice 仿真就绪；wgpu/lavapipe 环境到位即实现 |
| V8 脚本宿主 | 🟡 CI 依赖 | bindgen 就绪；lighthouse-c-bindgen 待 push 真跑 |
| Web 构建目标 | 🟡 待 M2 | bundle 清单已产出 |

## 3. 数字

- CTest 46/46；node --test 95/95；目标 162 项守护
- demo all **十四步**全部 ok（frame.gif 44ms / contact.gif 40ms 基线）；**长跑 5 轮计时分布：总耗时 87–90ms（min/max）**，无抖动
- git 仓库树干净（build/ 任意层忽略）

> 评审动作：对照 m1-handoff §1 基线 + §2 硬缺口确认；M2 开工前最后修订 m2-kickoff。




