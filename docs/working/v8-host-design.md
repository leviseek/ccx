# V8 宿主设计（M2 W5 预研：脚本可跑）

> 日期：2026-08-27 · 输入：m2-gate-rehearsal exit3、tools/bindgen（IDL→napi 就绪）、daemon scene.apply 写路径。
> 目标：脚本驱动场景变更且全程无手改 JSON；沙箱内运行 game 逻辑。

## 1. 边界与原则

- **脚本不是第二引擎**：脚本经绑定表驱动引擎既有 API（命令总线/场景/物理/输入/帧事件），无并行数据面。
- **数据格式统一**：脚本调用 = scene.apply 同构命令（已有校验/审计/undo）。
- 沙箱：隔离 Context、无文件/网络直通（IO 经绑定代理审计）。

## 2. 系统结构

```
[GameLoop tick] -> Host.tick(now)
    -> script module 'onUpdate(dt)'（每 fixed 步）
    -> script module 'onContact(a,b)'（物理接触事件）
[Script] GraphicsAPI?  No——渲染归引擎；脚本只拿逻辑面
Host：
  - Isolate + Context（每场景 1 份；时长/内存预算）
  - 模块表：name -> 绑定函数表（由 bindgen 生成或手写薄层）
  - 桥接代理：IO/工具调用（daemon RPC 或审计代理）
```

## 3. 暴露桥接清单（脚本可调）

| 面 | 函数（草案） | 语义 |
| --- | --- | --- |
| 场景 | createEntity(name,parent) / addComponent(id,type,data) / setProperty(id,type,path,value) / queryEntities() | 与 daemon scene.apply 同构（校验+审计复用） |
| 物理 | queryContacts() → [{a,b}] | runCollisionSim 结果 |
| 输入 | isDown(key)/pointer() | InputState |
| 时钟 | now()/frameCount() | GameLoop 只读 |
| 事件 | onUpdate/onContact/onPointerDown 注册 | 每帧分发 |

## 4. 沙箱

- 单 Context 默认严格模式；无 require/fs/net（绑定表显式注入）。
- 预算：微任务栈上限、每帧脚本耗时上限（超时暂停并告警计入 metrics）。
- 错误传播：脚本异常 → 帧告警 + audit 记录（铁律 12/8），不崩宿主。

## 5. 风险与依赖

| 风险 | 缓解 |
| --- | --- |
| v8 构建集成（编译时长/产物） | CI 矩阵内单任务；或先接 QuickJS 评估后再定（W5a 决策点） |
| bindgen 覆盖有限 | 手写薄绑定层 + IDL 扩展示例先行（7/7 基础已测） |
| 脚本面与 C++ 面漂移 | 跨语言对拍测试扩展：脚本调用 == CLI/daemon 同命令断言 |

## 6. 里程碑

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| W5a | 宿主嵌入（Isolate/Context/模块表骨架；引擎内 hello 脚本） | 脚本打印/返回数值入 metrics |
| W5b | 绑定面（场景命令桥） | 脚本 10 条 scene.apply == 测试断言 |
| W5c | 事件桥（onUpdate/onContact/onPointerDown） | 接触脚本改动场景可见 |
| W5d | exit3 验收：脚本驱动场景变更全流程 + diff 可核 | m2-gate exit3 |

> 备注：本设计随 M2 立项修订；决策点（v8 vs quickjs）在 W5a。
