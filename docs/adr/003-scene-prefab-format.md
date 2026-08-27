# ADR-003 场景 / 预制体：公开、结构化、可 diff 的数据格式

- 状态：**采纳**（2026-08-27）
- 关联：ADR-002（ECS 数据模型）、ADR-006（服务层）、引擎-spec §6、资产-spec §3
- 影响范围：场景文件格式、预制体系统、序列化、Git 工作流、AI 可读性
- 范围（v0.2）：2D-first；示例组件均为 2D 集（无网格/骨骼 3D）

---

## 1. 背景

cocos4/Creator 的 .scene/.prefab 是编辑器私有 JSON 变体（含 uuid 映射、\_editor 元数据、压缩后的嵌套结构），Git diff 基本不可读、AI 无法直接编辑、第三方工具无法解析。原方案把"公开数据格式 + 结构化 diff"列为 12 铁律之 11，是最影响 AI Native 的一条。

## 2. 候选

| 候选 | 描述 | 问题 |
| --- | --- | --- |
| A | JSON v1（可读主格式，入库）+ 紧凑二进制 .cscene（发布/加载产物） | 双格式一致性成本 |
| B | 只做 JSON | 大场景加载慢、包体大 |
| C | 只做二进制（protobuf/flatbuffers） | 不可 diff、不可手工编辑、AI 难用 |

## 3. 决策

**采纳 A。JSON 是"真相格式"（存 Git、编辑器/AI/CLI 消费），二进制 .cscene 是"发布格式"（Cook 产物，运行时加载）。两者由同一 schema 驱动生成，schema 即契约（版本化 + 迁移器）。**

## 4. 格式规格（v1 摘要）

### 4.1 顶层结构

```json
{
  "schema": "ccx.scene/1",
  "meta": { "name": "Main", "generator": "ccx-editor 0.1", "createdAt": "...", "guid": "..." },
  "assets": { "materials": ["uuid:...", ...] },
  "entities": [
    {
      "id": 3,
      "name": "Player",
      "parent": 1,
      "children": [4, 5],
      "components": [
        { "type": "ccx.Transform", "data": { "position": [0, 1.2], "rotationZ": 0, "scale": [1, 1] } },
        { "type": "ccx.SpriteRenderer", "data": { "sprite": "uuid:img-xxx:0", "material": "uuid:mat-yyy", "color": [1,1,1,1] } },
        { "type": "game.Health", "data": { "max": 100, "current": 100 } },
        { "type": "ccx.PrefabRef", "data": { "prefab": "uuid:prefab-zzz", "overrides": [ ... ] } }
      ]
    }
  ],
  "systems": [
    { "type": "game.AISystem", "enabled": true }
  ]
}
```

- 组件 data 由**反射 schema**（ADR-004 生成的 JSON Schema）校验与驱动 Inspector。
- 引用一律是 `uuid[:subAssetIdx][:typeHint]` 字符串；同文件内实体引用用局部 id。
- 空组件（无 data）允许：`{ "type": "ccx.Tag" }`。

### 4.2 预制体 override（三态）

```json
"overrides": [
  { "op": "add",    "path": ["5", "components", "0"], "value": { "type": "game.Weapon", "data": {"id":"AK47"} } },
  { "op": "set",    "path": ["4", "components", "1", "data", "max"], "value": 150 },
  { "op": "remove", "path": ["6"] }
]
```

- path 定位：实例实体 id → 组件索引 → 字段路径（字段名由 schema 保证稳定）。
- 语义与 **JSON Patch (RFC 6902) 对齐**，diff 工具直接可用；预案实例 = base 模板 + overrides 应用。

### 4.3 Diff 示例（Git 友好）

```diff
 Player: Transform.position: [0,1.2] -> [0,2.0]
+Player: components[2]: {"type":"game.Weapon","data":{"id":"AK47"}}
 Enemy_003: Health.max: 100 -> 80
```

### 4.4 二进制 .cscene

- 布局：header(schema version) + 组件数据段（按 archetype 排布，SoA 直接镜像）+ 名称表 + 引用表。
- 由 Cook 从 JSON 生成；加载不经过 JSON 解析。**禁止手写二进制文件入库**（CI 检查）。
- LZ4 可选压缩段。

## 5. 理由

1. **AI/工具/服务共享**：一个 schema 同时驱动 Inspector、校验、MCP 读写、git diff 工具，符合铁律 3/11/12。
2. **编辑器态与运行态彻底分离**：JSON 里只有"游戏数据"，没有编辑器窗口状态（方案 §5 的 Runtime/UI 分离）。
3. **迁移路径**：Creator 场景迁移器输出 v1 JSON（M5），社区工具天然可解析。
4. **二进制只为性能存在**，不为"防篡改/私有化"存在。

## 6. 后果与反制

- **Schema 稳定性**：字段改名必须走迁移器注册表（`schema/migrations`），否则破坏 Diff/override 路径。CI 里有 schema 变更 lint。
- **双格式一致性**：round-trip 测试（JSON→binary→JSON 全等）进 CI 基准。
- **大场景痛点**：10 万实体 JSON 文件可达几十 MB —— 允许"引用外置"（实体数据进 .cscene 段引用）但默认还是内嵌，CI 有体积看板。

## 7. 不做

- 不做 XML/YAML 变体；不做 protobuf/自定义二进制作为真相格式；不做"编辑器私有字段混入场景文件"。
