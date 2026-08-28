# 脚本引擎决策评估（W5a 决策点：v8 vs QuickJS）

> 日期：2026-08-28 · 输入：v8-host-design（结构/桥接清单/沙箱）、bindgen 现状（IDL→napi）
> 结论先行：**首选 QuickJS（单文件嵌入式引擎）**；当脚本需求演进出"全量 ES 特性 + 高吞吐"再评估 v8。

## 1. 评估维度

| 维度 | V8 | QuickJS |
| --- | --- | --- |
| 源码/构建 | GB 级构建链（v8 + v8-platform；node-gyp 或自家构建），产物大 | 单 C 文件（quickjs.c amalgamation），秒级编译，产物小 |
| 嵌入 API | v8 API 版本演化需要锁定与迁移 | C API 稳定保守（Fabrice Bellard，多年兼容） |
| 许可 | BSD-3（V8） | MIT |
| 性能 | 顶级（JIT） | 解释器（无 JIT）；游戏脚本面=低频场景命令，足够的订单量级 |
| 调试 | d8/chrome devtools | 需自写 REPL/内省（已有 daemon RPC 可担 broker） |
| 绑定 | napi（现有 bindgen 目标）直接可用 | 无 napi——需自行生成 C 桥（或走 WASM 不做） |
| 生态 | 标准全量 ES | ES2020+ 子集（可验证集合） |

## 2. 绑定衔接（QuickJS 路线）

- 现有 bindgen IDL → **新增 quickjs 目标**：生成 C 绑定（JSValue marshalling：object/array/number/string；回调节点）。
- 桥接面与 v8-host-design §3 相同（createEntity/addComponent/setProperty/queryContacts/isDown/now/onUpdate/onContact…）——宿主接口与引擎无关，仅绑定后端切换。
- daemon MCP 层与脚本桥**同一条命令面**（脚本调用 = scene.apply 同构）→ 对拍测试可复用在脚本上（脚本 10 条命令 == CLI/daemon 断言）。

## 3. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| QuickJS 无 JIT，高频脚本（每帧大循环）性能不够 | 设计边界：每帧脚本预算（超时暂停+metrics 告警）；物理/渲染在引擎侧 |
| ES 子集差异 | 锁定支持集文档 + CI 脚本 lint（acorn 校验） |
| 调试弱 | daemon session/audit 已可复盘：脚本调用全留痕，等价可回放 |
| 若未来需求升级 | 宿主接口不变，绑定后端换 v8（napi 复用 bindgen 既有目标）——**双后端可能性保留** |

## 4. 采纳建议

1. W5a 用 QuickJS 嵌入（单文件纳入 vendor/ 或第三方 fetch，遵守 ADR-005 纪律）。
2. bindgen 增 IDL→quickjs 目标（可复用现有 IDL 样例者先上一个 hello）。
3. 验收不变（m2-gate exit3：脚本 10 条 scene.apply 场景 diff 可核）。

> 决策记录：本表为 W5a 评审输入；若采纳 QuickJS，v8-host-design 的 §5 决策点标记为"已决：QuickJS 主选，v8 备选（接口不变）"。
