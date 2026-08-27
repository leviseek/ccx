# ADR-001 引擎语言选型：C++20 + TypeScript 双语言

- 状态：**采纳**（2026-08-27）
- 关联：ADR-002（ECS）、ADR-004（脚本）、ADR-005（平台复用）
- 影响范围：所有模块的语言归属

---

## 1. 背景

原方案最后一节把第一个待定问题收敛为："第一版引擎选 C++、Rust 还是 C++ + TypeScript"。同时存在一个不可回避的事实约束：**CCX 最大的存量资产是 cocos4 的 native/ C++ 平台适配与 web/小游戏适配（MIT）**，以及 cocos-cli 的 TS 工具链。语言选型必须同时回答三个问题：

1. 引擎核心（ECS/渲染/物理/音频/平台）用什么？
2. 游戏脚本层用什么？
3. 工具链（Asset Pipeline/CLI/服务）用什么？

## 2. 候选方案

| 候选 | 描述 | 关键代价 |
| --- | --- | --- |
| A | C++20 核心 + TS 脚本/工具 | 内存安全靠纪律与工具；绑定层必须写好 |
| B | Rust 核心 + TS 脚本/工具 | cocos4 native 无法复用（要 FFI 或重写）；图形/移动 SDK 生态 C 接口为主，Rust 桥接成本高；招人难 |
| C | 全 TS（近似 cocos4 现状：TS 引擎 + C++ native binding） | 热路径性能与并行受限；方案明确要换掉该架构（渲染/物理在 TS 侧） |
| D | C++20 + Rust + TS 三语 | 三套工具链/三套生态/三倍集成成本；边界收益极低 |

## 3. 决策

**采纳 A：C++20 引擎核心 + TypeScript 脚本/工具/服务双语言。Rust 不进入第一版（在 ADR 中留"未来可选组件"的坑）。**

具体语言归属矩阵（最终以 engine-spec 为准）：

| 层 | 语言 | 原因 |
| --- | --- | --- |
| foundation（容器/内存/Job/数学/反射/序列化） | C++20 | 性能关键；ECS 地基 |
| ecs / scene / gfx / render / animation 内核 / physics / audio / ui 内核 / platform | C++20 | 热路径；与 vendor 的 C++ 平台层同语言 |
| asset importer 编排 / cook 任务图 / 所有 Service / CLI / Editor shell / MCP | TypeScript (Node) | Headless 服务高频迭代；Editor 同语言；AI 可读性最好 |
| 游戏脚本（项目代码） | TypeScript（编译到 JS） | 低门槛工作流（CCX 的核心卖点），见 ADR-004 |
| 原生绑定层 | 代码生成（IDL → napi/C API + .d.ts） | 减少手写桥接，保证边界干净，见 ADR-004 |

## 4. 理由

1. **平台复用是硬约束**：cocos4 native/cocos 的 window/input/fs/thread/audio/video/gfx 适配、小游戏 adapter 全是 C++。C++ 核心可**直接 vendor 或薄封装**（ADR-005），Rust 核心则要么写 FFI 壳要么重写，两者都让"复用平台层"这个战略判断落空。
2. **生态契合**：Vulkan/Metal/WebGPU-native/GLES 的官方与社区绑定、Box2D 等 2D 物理与移动 SDK 生态都是 C/C++ 第一公民；C++20 的 module/概念/三路比较等特性足以支撑现代写法。
3. **内存安全的替代方案**：真正需要防的是一类 bug（越界/悬垂/数据竞争）。用"工业纪律 + 工具"对冲：Arena/RAII 规范、ASan/UBSan/TSan 全量 CI、fuzz（engine-spec 质量门）。Rust 的安全性收益主要换不来"复用 C++ 平台层"的代价。
4. **TS 进工具链的理由**：服务层要同时被 Editor、CLI、MCP、CI 消费（铁律 3/4），TS 单语言让这几条线共享类型、共享实现；AI/Agent 生态对 TS/JSON 的亲和度最高（方案 MCP 路线依赖这一点）。
5. **脚本层 TS 的理由**：低门槛交付是 CCX 战略护城河；TS 有最强类型生态与工具链，且浏览器/小游戏原生跑 JS，天然无缝。

## 5. 后果与反制

- **C++ 侧纪律**：禁止裸 new（统一 Arena/分配器）；禁止裸指针成员越过模块边界（改 span/句柄）；RAII 强制；-Werror + clang-tidy + cppcheck。
- **绑定层是强制组件**：所有 C++ ↔ JS 边界走 IDL 生成（ADR-004），不允许手写 napi 散落。
- **Rust 的去向**：若未来需要极安全的独立组件（如远程不可信内容的解析器），以"可选原生插件"形态接入，不影响核心。
- **人才**：C++20 与 TS 双栈在中国游戏行业供给充足；Rust 不设岗位。
- **性能证明义务**：M1 出口必须拿出"10 万 2D 精灵 60fps（移动端中档机型）"基准（roadmap gate），防止"架构好看但跑不动"。

## 6. 明确不做

- 不选 "引擎核心也用 TS"（C 方案）：正是被替代的 cocos4 现状。
- 不引入 Rust 三语（D 方案）。
- 不选 D3D 专属路径或需要 C++/CLI 之类的平台绑定噱头。
