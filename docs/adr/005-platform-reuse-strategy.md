# ADR-005 平台层复用策略：vendor cocos4 native + Capability 模型

- 状态：**采纳**（2026-08-27）；v0.2 后端矩阵按 2D-first 收敛
- 关联：ADR-001（语言）、ADR-006（服务）
- 影响范围：platform/ 模块、渲染后端（2D 视角）、小游戏/Web/Native 各交付线、CI 平台矩阵

---

## 1. 背景

原方案的判断："Cocos 最不应该重写的是平台适配与交付链路"。实测（README §1）确认 cocos4 native/ 是 C++ 平台适配（window/input/fs/thread/audio/video/gfx 各平台后端 + web/小游戏适配），MIT 许可；cocos-cli 已实现 contributes.builder 构建插件协议。

## 2. 候选

| 候选 | 描述 | 问题 |
| --- | --- | --- |
| A | **vendor 复用**：把 native/cocos/platform 相关目录以第三方源码形式纳入 CCX platform/，保持 MIT 归属，在其上做能力模型封装 | 需要维护 vendor 同步策略 |
| B | 全部自研重写平台层 | 数年工作量；丢最大资产 |
| C | 不整层复用，只抄接口 | 与上游脱节；重新踩坑（各家 SDK 生命周期/权限/裁剪） |

## 3. 决策

**采纳 A：vendor 复用（目录级拷贝，保留 LICENSE 与出处文件），并在其外包一层 CCX Platform API（Capability + Adapter 注册）。渲染后端的前端（RHI）自研，后端初始化/交换链/设备枚举复用 vendor 对应实现作为参考与启动基座。**

**范围声明（v0.2）**：CCX 为 2D-first 平台（用户裁切：不需要 3D 能力）。本 ADR 只关心 2D 交付线的平台能力；3D 渲染能力（网格/PBR/光照/GI/GPU-driven）不在范围（renderer-spec §1）。渲染后端矩阵按 2D 预算收敛（§6）。

## 4. Vendor 清单（M1 前物料）

| vendor 来源（cocos4） | CCX 去向 | 用途 |
| --- | --- | --- |
| native/cocos/platform（Base/FileUtils/Image/SAXParser + android/win32/apple/ios/mac/linux/interfaces/empty 等真实子目录，实测 350 文件 3.1MB） | platform/vendor/pal | 平台底座（详细清单见 docs/working/vendor-candidates.md） |
| native/cocos/platform/audio（AAudio/OpenAL/Web 音频后端） | platform/vendor/audio | 音频后端 |
| native/cocos/editor-support/… 与 web 适配（web 端 window/input/fs） | platform/vendor/web | Web 适配 |
| 小游戏适配（wechat/tt/bytedance 等，存在于 exports/templates 与 native 侧） | platform/vendor/minigame | 小游戏运行时适配 |
| cocos-cli builder 插件协议（contributes.builder；第三方插件位于项目内 packages/platforms/*，文档约定，实测 cli 仓库 packages/ 无此目录） | build-service 直接兼容（协议采纳，代码不 vendor） | 构建插件 |
| native 的 Vulkan/Metal/WebGPU/GLES 设备初始化与 swapchain | renderer 后端启动基座（参考实现，逐步替换） | 渲染后端基座 |

- 每个 vendor 目录带 `UPSTREAM.md`（来源 commit、同步日期、本地改动清单）；同步策略：**每季度跟随上游 tag**，若有本地修改则打 patch 文件（`patches/`）。
- 许可：MIT，保留 LICENSE 与 AUTHORS 出处；README 与发布页声明第三方组件清单（合规检查进 CI）。

## 5. CCX Platform API（能力模型，完整版见 platform-spec）

```cpp
struct Capabilities {
  bool graphics;         // 有 GPU 上下文
  bool compute;          // 支持 compute shader（粒子/后处理可选路径）
  bool threads;          // 多线程可用
  bool webgpu;           // WebGPU 可用
  bool gamepad;
  bool vibration;
  bool fileSystem;
  bool backgroundMute;   // 后台策略
  bool nativePlugin;     // 可加载原生插件
  bool ads, payment, share;   // 渠道服务
  enum class GraphicsAPI { Vulkan, Metal, WebGPU, GLES3 };
  enum class ScriptHost  { V8, JSC, WebVM };
};
const Capabilities& Platform::capabilities();  // 启动后只读
```

- **纪律**：引擎代码与游戏代码一律查询能力，禁止平台宏（platform-spec §3 有 CI 检查方案）。
- Adapter 注册表：window/input/storage/audio/network/lifecycle/sdk(ads,pay,share,login)/minigame 各自 `IAdapter` 接口，平台启动时注册。

## 6. 渲染后端决策要点（v0.2，2D 视角）

- **CCX RHI 前端自研**（renderer-spec §2）：资源模型、command encoder、同步原语抽象 —— 不复用 cocos gfx 的前端（它与 TS 引擎耦合，且架构是老式"device 万能对象"）。
- **后端矩阵（P0→P2，2D）**：**WebGPU**（Web + 桌面默认，M1 优先打通）→ **GLES3/WebGL2**（移动端全档主后端，M2）→ **Metal**（iOS/macOS，M2）→ **Vulkan**（Android 高端，可选加速，M2）。**D3D12 不做**（2D 无动机）。
- GLES3 是移动端默认的原因：2D 管线预算低（renderer-spec §6），GLES3 覆盖最广、调试/发布链路最成熟；Vulkan 仅在高端机型做能力增强（compute 粒子等），不阻塞发布。

## 7. 后果与反制

- **vendor 质量风险**：上游 bug 进入 CCX —— 反制：vendor 目录禁止直接改（改动必须走 patch 文件 + 上游 issue），CCX 侧封装层持全部"我们的逻辑"。
- **同步漂移**：季度同步 + CI 编译矩阵覆盖所有 vendor 平台。
- **协议兼容**：BuildService 实现 contributes.builder 的 config/hooks 状态机，保证 cocos-cli 生态插件（第三方平台 builder）可以直接装进 CCX 构建流程（ADR-006）。

## 8. 不做

- 不做"双平台层"（vendor 与自研并存两套 window/input）—— 一个 Adapter 注册表，一个实现。
- 不报复刻 cocos gfx 前端；不做平台 SDK 直通（一律过 adapter）。
- 不做 D3D12 后端；不维护 3D 专用的渲染能力位（如 bindless 不作为发布依赖）。
