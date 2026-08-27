# M0 gate 评审材料（会签用，10 分钟议程）

> 状态：材料就绪（2026-08-27）。本文档供 M0 出口验收会签使用；签字后 M0 关闭、M1 立项。
> 硬标准见 [roadmap §8](../roadmap.md)（v1.0 Definition of Final）；本页是 M0 阶段临时验收。

---

## 1. 出口对照表

| # | 出口（roadmap §1 M0） | 状态 | 证据 |
| --- | --- | --- | --- |
| ① | 空场景 JSON 读写 + git diff 演示 | ✅ 本次补齐 | `examples/scenes/sample.scene.json`（ADR-003 v1）+ `scene_sample_test`（解析/golden 语义等价/反读闭环/dump 幂等，ctest 4/4）；真实 git diff 演示见 §3 |
| ② | Reflector + Serializer round-trip 绿 | ✅ 已达成 | `foundation.roundtrip` 测试（嵌套对象/Vec2/Color/引用串/schema，含 10 万实体规模的幂等用例） |
| ③ | 依赖门禁 CI 上线 | ✅ 代码就绪；⚠️ 待真 CI | 3 条门禁脚本本机通过（`layered_imports` 14 文件 / `vendor_check` / `schema_roundtrip` 走 ctest）；`m0-ci.yml` 已配置 Linux+Windows 矩阵——**需 push 到 GitHub 后由 Actions 产出绿标** |
| ④ | bindgen napi hello（JS 调 C++） | 🟡 本次补齐基础设施；验证在 CI | bindgen 5/5 单测 + tsc 通过（本机）；napi 编译冒烟 workflow 任务（`lighthouse-c-bindgen`）：生成 → node-gyp 编译 → smoke——**待 push 后由 Actions 执行** |

### 1.1 两个"待真 CI"的裁定建议

出口③④ 的代码与本地验证都已完成，但 **CI 从未在真实 GitHub Actions 上跑过**（仓库尚未推送到远程）。建议裁定：

- **方案 A（推荐）**：接受"本机验证 + workflow 已配置"为达成，push 后在首个 PR 上自动复核（post-commit 验证）；若失败按缺陷处理，不算 M0 返工。
- 方案 B：push 并等到 CI 全绿再会签（多等一个提交周期）。

## 2. 会签议程（10 分钟）

1. 过一遍出口对照表（5 分钟）：每项读状态与证据，无异议即过。
2. 裁定 §1.1 的两个"待真 CI"项（2 分钟）。
3. 确认后置项清单与 Owner（2 分钟，见 §4）。
4. 签字（1 分钟，§5）。

## 3. git diff 演示（出口①证据）

用 `sample.scene.json` 的一次典型编辑（把 enemy 血量上限 50 → 80）展示结构化解读：

以下是真实产生的 `git diff` 输出（enemy 血量上限 50 → 80）：

```text
diff --git a/examples/scenes/sample.scene.json b/examples/scenes/sample.scene.json
index 9519b28..d91ccd2 100644
--- a/examples/scenes/sample.scene.json
+++ b/examples/scenes/sample.scene.json
@@ -21,9 +21,10 @@
       "parent": null,
       "components": [
         { "type": "ccx.Position", "data": { "x": 20, "y": 0 } },
-        { "type": "game.Health",  "data": { "max": 50, "current": 50 } }
+        { "type": "game.Health",  "data": { "max": 80, "current": 80 } }
       ]
     }
   ],
   "systems": []
 }
```

> 结构化说明：场景文件是普通 JSON，diff 只显示被修改的那一个字段，而不是整段 blob —— 这正是 ADR-003 的目的（Git 友好、AI 可读、可脚本化处理）。

## 4. 后置项清单（M0 关闭后仍盯）

| 项 | Owner 建议 | 触发条件 |
| --- | --- | --- |
| push 仓库并跑通第一条 CI（3 门禁 + 4 测试 + bindgen smoke） | 工具链组 | 立项即做 |
| bindgen 扩展（数组参数/回调/默认值） | 引擎组 | M1 |
| ECS M1 化（Query 缓存/多 chunk/JobSystem） | 引擎组 | M1 |
| vendor M1 落地（pal/audio/storage，按 vendor-candidates.md） | 平台组 | M1 |
| M0 gate 会议纪要归档 | 召集人 | 会签后 |

## 5. 签字栏

- 出口验收结论：□ 全部达成（含裁定 A/B） □ 有偏差（见附注）
- 召集人 / 日期：____________ / ________
- 引擎组：________  平台组：________  工具链组：________
- 附注：____________________________________________________
