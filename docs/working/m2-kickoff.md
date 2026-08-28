# M2 立项材料（首版）

> 日期：2026-08-27 · 来源：docs/working/m1-handoff.md 硬缺口清单 + roadmap §1 M2
> 本材料供立项评审使用；exit 标准可证伪，owner 可指派。

## 1. M2 目标（一句话）

**让第一帧出现在真实 GPU 上，并让"编辑器全程无手改 JSON"内测跑通。**

## 2. Scope（可验收工作包）

| # | 工作包 | 依赖 | 参考 |
| --- | --- | --- | --- |
| W1 | gfx 后端首帧：WebGPU native 首三角形 → SpriteBatch 提交；GLES3 移动后端起步 | GPU 开发机/CI runner | renderer-spec §2/§6 |
| W2 | 编辑器 Web UI 渲染层：渲染 buildView 快照 + 命令派发（复用 renderViewHtml 起点） | W1（场景预览） | services-spec §8 |
| W3 | 服务会话面：daemon 订阅会话（scene 打开/undo-redo 会话级）、CLI 联动 | 无 | services-spec §2/§4 |
| W4 | 纹理压缩 worker：astcenc/etto 接入 registerCompressor（真实压缩） | 无（M2 内部） | asset-spec §4 |
| W5 | V8 脚本宿主接入（绑定生成 → napi 编译 → 游戏脚本可跑） | CI node-gyp 验证通过（m1-handoff §2） | ADR-004 |
| W6 | Android/iOS 真机样例构建 | 真机/签名 | platform-spec §5 |
| W7 | Spine/DragonBones 桥（2D 骨骼动画） | W1 | engine-spec §1 |

## 3. Exit 标准（M2 gate 候选）

1. **第一帧**：SPRITE 场景（fixture render_plan）经 WebGPU/GLES 后端输出非空帧（截图像素断言）。
2. **编辑器内测**：一个人凭编辑器（非 CLI）完成"创建精灵→拖入场景→改属性→预览"，全程无手改 JSON。
3. **脚本可跑**：V8 宿主运行 `scripts/main.ts` 编译产物并驱动场景变更（SA 断言）。
4. **移动端冒烟**：Android/iOS 预编译样例启动到首帧。
5. **压缩真实化**：`cook` 对 png 产出真实 etc2/astc 字节（非占位）。

## 4. 依赖与风险

| 依赖 | 状态 | 风险 |
| --- | --- | --- |
| GPU 开发机或 CI runner（WebGPU native） | 待调配 | 无则 W1 延期（可先用 GLES 软件栈部分验证） |
| 微信/抖音账号 | 待申请 | W6 不受阻（后置渠道冒烟） |
| node-gyp 编译矩阵 | CI 已配未真跑 | push 后首个 PR 验证（m1-handoff §2） |

## 5. Owner 建议（占位）

- W1/W7：渲染组（1-2 人）· W2/W3：编辑器/工具组 · W4/W5：引擎组 · W6：平台组
- M2 gate 主持人：立项人指定

> 改动回溯：任何 exit 修订必须更新本文件与 roadmap §1 M2 行（双处一致）。
