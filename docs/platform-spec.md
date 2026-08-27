# platform-spec — 平台层规格（Capability 模型 + vendor 复用）

> 配套：ADR-005 · 依赖：engine-spec §1（platform 模块）、renderer-spec §2.3、services-spec §6（构建）
> **v0.2**：2D-first——GLES3 为移动端主后端；Vulkan 仅 Android 高端可选；D3D12 移出

---

## 1. 结构

```text
platform/
├── api/                   CCX Platform API（能力 + adapter 接口，全部 C++ 头文件）
├── vendor/                cocos4 native 适配拷贝（见 ADR-005 §4，含 UPSTREAM.md / patches/）
├── native/                Windows/macOS/Linux/iOS/Android 启动器与生命周期归置
├── web/                   Web 适配（window/input/fs/audio 装配）
├── minigame/              wechat/tt/bytedance 等（channel 插件化）
└── tests/                 每平台 smoke + 能力矩阵测试
```

## 2. Capability 模型（铁律 8）

```cpp
namespace ccx::platform {
enum class Backend { Windows, macOS, Linux, iOS, Android, HarmonyOS, Web, MiniGame };
enum class GfxAPI  { Vulkan, Metal, WebGPU, GLES3, None };
enum class ScriptHost { V8, JSC, WebVM, None };

struct Capabilities {
  Backend   backend;
  GfxAPI    gfx;           // 已创建的后端
  ScriptHost scriptHost;

  bool compute, indirectDraw, bindless, storageBuffers; // 渲染能力位
  bool threads, fiber;                                  // 并行能力位
  bool gamepad, vibration, orientation, backgroundMute;
  bool fileSystem, persistentStorage;
  bool nativePlugin, wasm;
  bool ads, payment, share, login, social;              // 渠道服务能力位
  bool webgpu;                                          // 平台是否可建 WebGPU
  uint32_t maxTextureSize, maxUniformSize;              // 可降级阈值
  std::string platformId;   // "wechat-game" | "web" | "win32" ...
};
const Capabilities& capabilities() noexcept;   // 进程启动后只读
bool has(const char* name);                    // 可插拔能力查询（如 "audio.spatial"）
}
```

- **纪律**：
  - 引擎与游戏代码**禁止** `#ifdef _WIN32`/平台宏分支业务逻辑；一律查 capabilities。
  - vendor 目录内允许平台宏（那是适配层本职）；`api/` 起不允许（CI：regex lint 扫描 api/ 与 engine/ 非 vendor 目录）。
  - 能力位必须是**运行时真实探测**（创建 gfx device 后回填），不写死在编译期。

## 3. Adapter 注册表

```cpp
struct IWindow     { Size size(); void setSize(Size); void setTitle(std::string_view);
                     bool focused(); void show(); void onResize(Signal<Size>&); };
struct IInput      { /* 键盘/鼠标/触控/游戏手柄事件源，统一 Event 结构投递 */ };
struct IStorage    { readFile/writeFile/deleteFile/listDir（沙箱内路径）; };
struct IAudio      { /* mix 输出源；backend 无关 */ };
struct INetwork    { tcp/udp/ws 抽象 + 通道事件; };
struct ILifecycle  { /* onSuspend/onResume/onQuit/低内存 */ };
struct IChannelSDK { /* ads/pay/share/login；每渠道一个实现 */ };

class AdapterRegistry {
  template <class I> I* get();                  // 缺省 adapter 自动注册（stub/禁用）
  template <class I> void registerAdapter(I*);
  void snapCapabilities();                      // 启动后冻结能力位
};
```

- 每平台"装配清单"（compose）：`platform/native/win/register.cpp` 聚合该平台全部 adapter；Web/小游戏同理。
- 小游戏渠道（微信/抖音/快手/OPPO 等）为**独立 npm/zip 插件**，实现 IChannelSDK + 生命周期适配，不进核心（原方案 §17 落地）。

## 4. 渲染后端装配

- 启动序列：`platform → gfx 设备创建（capabilities.gfx 回填）→ 引擎其余模块 → scripting host → 游戏`。
- WebGPU 创建失败 → 按降级链：WebGPU → GLES3(WebGL2) → 报错退出（带诊断）。
- 移动端：Vulkan 失败 → GLES3；iOS：Metal 唯一（无降级）；Android 低端：直接 GLES3 表。
- **2D-first**：GLES3 为移动端默认主后端（2D 预算富余，renderer-spec §6），Vulkan 仅 Android 高端可选加速；WebGPU 桌面/Web 统一。
- device 丢失恢复：`onLost/onRestored` 事件 → RenderScene 重建 GPU 资源（纹理/顶点数据上传重放），M2 必须可用（移动端高频事故）。

## 5. 平台测试矩阵（CI + 设备农场）

| 平台 | 冒烟 | 全量 | 设备 |
| --- | --- | --- | --- |
| Windows (Vulkan/WebGPU/GLES3) | ✅ | ✅ | CI 实机 |
| macOS (Metal/WebGPU) | ✅ | ✅ | CI 实机 |
| Linux (Vulkan/WebGPU) | ✅ | 部分 | CI |
| Web (Chrome/FF/Safari) | ✅ | ✅ | 浏览器矩阵 |
| Android (Vulkan/GLES3) | ✅ | ✅ | 真机池（8 台覆盖） |
| iOS (Metal) | ✅ | ✅ | 真机池 |
| HarmonyOS | ✅ | 部分 | 真机借测 |
| 微信/抖音小游戏 | ✅ 真机 | 关键路径 | 渠道真机 |

- 冒烟 = 启动 + 首帧 + 输入 + 音频 + 存储；全量 = 引擎基准 + 编辑器 e2e 精简集。
- 每个 vendor patch 必须过全部平台编译（季度同步窗口内只允许编译兼容性改动）。

## 6. 与 BuildService 的关系

- BuildService 的平台插件 = cocos-cli contributes.builder 协议（ADR-006）：platformType（HTML5/WINDOWS/…）、options JSON Schema、hooks 状态机（onBeforeInit→…→onAfterBuild）。
- 每个平台一个 builder 插件包；CCX 内置 web/android/ios/windows/mac/linux/minigame(渠道) builders，社区可补。
- 产物约定：`build/<platform>/` + bundle 清单 JSON（资源/脚本/配置分离），Sign/Package hooks 在 M3 内补（证书、AAB/ipa 打包、渠道包）。

## 7. 明确不做

- 不做平台 SDK 直通（必须过 adapter）；不做"编辑器进程内嵌小游戏模拟器"（预览走 Web 构建 + 模拟器插件，M3+）。
- 不做多进程渲染（渲染与主进程同进程；worker 只做 IO/计算）。
