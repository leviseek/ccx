# ADR-006 服务层协议：JSON-RPC 2.0 + JSON Schema IDL，CLI/Editor/MCP 同一服务面

- 状态：**采纳**（2026-08-27）
- 关联：ADR-003、ADR-005；services-spec 全文
- 影响范围：project/asset/scene/build/editor 服务、Command Bus、MCP 适配、cocos-cli 兼容

---

## 1. 背景

铁律 3："CLI、Editor、MCP 必须调用同一个 Service API"。cocos-cli 已把 create/build/MCP 做成 CLI 入口；社区 cocos-mcp 走的是"编辑器 execute_javascript"（绕过 API 去碰编辑器内部），这是错误示范 —— 它要求编辑器开着、且脚本可触摸一切。CCX 要让**服务独立于 UI 进程**（Headless 可跑），并让 MCP 是"表达层"而不是"业务层"。

## 2. 候选

| 候选 | 描述 | 问题 |
| --- | --- | --- |
| A | **JSON-RPC 2.0 + JSON Schema IDL** | Schema 用 TS 类型标注生成；工具链轻 |
| B | gRPC/protobuf | 跨语言强但笨重；负载大多是小 JSON；浏览器端支持麻烦 |
| C | 自定义二进制协议 | 造轮子 |
| D | REST + OpenAPI | 事件推送要另做 SSE/WS；命令语义（事务/undo 日志）无表达力 |

## 3. 决策

**采纳 A：进程内直调与远程 RPC 共用同一套"接口定义"（TS 接口 + JSON Schema 生成），传输层 JSON-RPC 2.0 over stdio / WebSocket / 命名管道；服务是进程内 Library（embedded）或独立进程（daemon），客户端不知二者差别。**

## 4. 规格摘要（完整版见 services-spec）

- **服务清单**：ProjectService / AssetService / SceneService / PrefabService(/并入 Scene) / MaterialService(/并入 Asset) / AnimationService(/并入 Scene) / BuildService / ProfilerService / EditorService。第一版收敛为 6 个：project / asset / scene / build / profiler / editor。
- **IDL 方式**：每个服务一个 TS 文件声明 interface（方法 + 请求/响应类型），构建期生成 JSON Schema + 客户端 Stub（Node/浏览器/编辑器内）。
- **事件**：服务端主动 notification（assetChanged、sceneInvalidated、buildProgress、commandApplied）；客户端按需订阅（可过滤）。
- **Command Bus**（铁律 12）：`scene.apply(command)` 是唯一写路径；命令带 undo/redo 语义与参数校验；编辑器 UI、AI、CLI 全部经它写入；内部是命令日志（可回放、可审计，格式见 services-spec §4）。
- **MCP 适配**：MCP Server 只是"Service API → MCP tool 定义"的声明映射，零业务逻辑；scheme 里的 tool 描述从服务方法文档生成。cocos-cli 的 `start-mcp-server` 命令面保留为兼容入口（它变成 CCX MCP 的启动器）。
- **cocos-cli 兼容**：`create/build(--platform,--stage)/wizard/pack` 的 CLI 层保留同名命令，内部转调服务；构建插件协议 contributes.builder 原样采纳（ADR-005）。

## 5. 理由

1. **一份实现，五类客户端**：Editor、CLI、MCP、CI、第三方工具全是服务客户端；业务不会散落多处。
2. **Headless 是硬需求**：CI/构建农场/MCP 服务无需 GUI；服务进程=daemon，编辑器=GUI 客户端（原方案 §19/23 收口）。
3. **命令模型一次建好**：undo/redo、diff、AI 生成命令、审计全部白拿（铁律 12）。
4. **JSON 生态亲和**：AI 与 TS 工具链零成本消费。

## 6. 后果与反制

- **性能边界**：命令/查询走 RPC 有序列化成本 —— 编辑器内嵌时短路为进程内直调（同接口）；大负载（纹理/顶点数据）不走 JSON，走"文件引用 + 服务端直接读条"（资产-spec 的 artifact 约定）。
- **安全**：daemon 默认只监听 localhost/用户级 socket；无跨机访问；鉴权为本地信任模型（M4 前不做云服务面）。
- **命令原子性**：apply 失败必须回滚到命令前状态（服务端快照或逆操作），CI 校验。
- **协议演进**：方法版本化（`asset.import@v1`），CLI 命令与工具版本解耦。

## 7. 不做

- 不做 gRPC、不做 REST 主协议、不做"编辑器 execute_javascript 式 MCP"（那是社区反面教材）。
- 不做多套服务实现（Editor 私有后端违反复核点）。
