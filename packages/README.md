# packages/ — TS 服务层（M0 骨架占位）

对应 [services-spec](../docs/services-spec.md)：CLI/Editor/MCP/CI 全部是同一 Service API 的客户端（ADR-006）。

| 包 | 状态 | 对应服务 |
| --- | --- | --- |
| cli | ⚙️ 壳已建（doctor/version，--json/--no-interactive） | services-spec §6 |
| project-service / asset-service / scene-service / build-service | ⏳ 占位 | services-spec §2 |
| mcp | ⏳ 占位 | services-spec §7（薄适配层，零业务） |
| profiler-service / editor-service | ⏳ M1+ 占位 | services-spec §2 |

M0 阶段引擎尚无能力，service 层只验收"接口面 + 事件通道"骨架（roadmap §2）。
