# M1 交接清单（已实现基线 + 剩余硬缺口与依赖）

> 日期：2026-08-27 · 本清单供 M1 收尾评审与 M2 立项使用；每项标注所需环境/动作与 spec 章节。

## 1. 已实现并可本地验证的基线（74 项自动化守护 → 见 README 执行状态表）

- **首帧仿真（无 GPU 可跑）**：RHI 接口核（gfx::Device）+ FakeDevice + 假 GPU 运行时（GameLoop 每帧上传/清屏/绘制/提交/readback 像素断言）——真后端实现者的契约与黄金对照（v0.3.40 起）\n- 引擎（C++20）：foundation（反射/JSON/metrics/job）、ecs（Archetype/Query 缓存/Stage 调度器/TaskGraph）、scene（树/排序/world 变换/Prefab override/ADR-003 文件装载导出/ECS 桥）、render（RenderGraph 编译器/Pipeline 资产/shader+material 校验/batcher）、gfx（描述校验/句柄池）、animation（曲线/精灵帧/状态机/帧循环合流）
- 服务（Node）：JSON-RPC 2.0 daemon（真实场景写路径/资产扫描/事件推送/构建 RPC/EOF 优雅退出）、SceneService CommandBus（undo/redo）、EditorShell（命令/快捷键/选择/面板）、BuildService（Builder 注册表/bundle/hooks）、AssetService（watch/队列/uuid/PNG/图集/Cook/压缩器接口）
- 交付链：CLI 11 个子命令（create/scene new/apply/atlas pack/scene atlas/render plan/cook/build/demo all/service demo/doctor/version）——**从 png 到渲染计划的闭环已单命令打通**

## 2. 剩余硬缺口（环境依赖明细）

| 缺口 | 所需环境/动作 | 对应章节 | 建议归属 |
| --- | --- | --- | --- |
| GPU 首帧（WebGPU native/Vulkan/Metal/GLES 后端 + SpriteBatch 提交） | GPU 实机或 CI runner（wgpu-native 后端可先软件验证）；M2 硬件里程碑 | renderer-spec §2/§6 | 渲染组 |
| V8/脚本宿主 + napi 绑定编译 | node-gyp + MSVC（Windows）或 gcc（Linux CI）——**已配好 CI 任务 lighthouse-c-bindgen**，push 后即验证 | ADR-004、tools/bindgen | 引擎组 |
| Web 构建目标（浏览器运行） | 无额外环境；CLI build 已产出 bundle 清单，Web 打包器接续 | services-spec §6、asset-spec §2.1 | 工具链组 |
| 编辑器 Web UI 渲染层（Shell 模型 → DOM） | 无额外环境；纯前端工项 | services-spec §8 | 编辑器组 |
| 移动端/小游戏真机 | Android/iOS 真机、微信/抖音开发者账号 | platform-spec §5 | 平台组 |
| 网络同步（ECS delta 通道） | 无额外环境；M4 工项 | engine-spec §1（network） | 引擎组 |
| Creator 2D 迁移器 | 存量项目样本 | engine-spec §8 | 工具链组 |

## 3. 项内快速上手（对 M2 立项者）

1. 读 README §7 执行状态表 → 各模块 README → 对应 spec。
2. `ccx doctor` 一键环境体检；`ccx demo all` 看交付链真跑。
3. 跨语言一致性已有对拍守护（`render_plan_alignment.test.mjs`）——新双实现必须同步补对拍。
4. 进程纪律：本机排查只精确清理测试子进程（勿通杀 node——DSH 宿主同在 Node 上）。

> 说明：M1 的"10 万精灵 gate"与"三端出包"等出口依赖 GPU/真机里程碑（§2），M1 阶段以 74 项自动化 + 交付链闭环作为阶段验证。

