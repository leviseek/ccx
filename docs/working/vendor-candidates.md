# 灯塔任务 B：cocos4 vendor 裁剪清单评审（ADR-005 §4 落地版）

> 日期：2026-08-27 · 数据来源：GitHub API 实测（cocos/cocos4 @ v4.0.0，git trees recursive）
> 结论先行：**v1 vendor 裁剪范围 = platform（5 平台 + interfaces/empty）+ audio + storage + java + main + renderer 后端启动基座（3 处），合计 ≈ 500 文件 / 5.5–6MB 源码**；ohos/openharmony/qnx 与 3D 渲染模块留"可选"，不进 v1 默认裁剪。

---

## 1. 核实结果（与 ADR-005 原假设的差异）

| ADR-005 假设 | 实测 | 处置 |
| --- | --- | --- |
| cocos-cli 有 `packages/platforms/*` builder 插件目录 | cli 的 `packages/` 实际只有 `asset-db / cc-module / cocos-cli-types / engine-compiler` | **修正**：builder 插件是"项目级约定"（文档示例 `[platform]/packages/platforms/`），协议沿用 contributes.builder，不 vendor 目录 |
| `native/cocos/platform/` 是"desktop/mobile 平台窗口/输入/FS/线程/生命周期" | 实测：BasePlatform/FileUtils/Image/SAXParser/SDLHelper/UniversalPlatform + 11 个子目录（android/apple/empty/interfaces/ios/java/linux/mac/ohos/openharmony/qnx/win32） | 按真实子目录出清单（下表） |
| 音频后端在 `native/cocos/platform/audio` | 实测：音频在 `native/cocos/audio/`（101 文件 753KB，含各平台后端子目录） | 修正来源路径；vendor 目标不变 |

## 2. 候选清单

| # | 来源（cocos4 @ v4.0.0） | 文件/大小 | 去留 | 用途与风险 |
| --- | --- | --- | --- | --- |
| V1 | `native/cocos/platform/`（Base/FileUtils/Image/SAXParser/SDLHelper/UniversalPlatform + interfaces + empty） | 350 文件 3138KB | ✅ **取**（裁剪后按需删平台宏） | 平台底座：窗口/输入/FS/线程/权限；SDLHelper 仅供 desktop 预览（可选项） |
| V2 | `native/cocos/platform/android/` | 77 文件 1050KB | ✅ 取 | Android JNI 生命周期/输入/音视频采集；依赖 `java/` 与 application |
| V3 | `native/cocos/platform/win32/` | 25 文件 99KB | ✅ 取 | Windows 窗口/输入（Vulkan/WebGPU 交换链宿主） |
| V4 | `native/cocos/platform/apple/ + ios/ + mac/` | 56 文件 201KB | ✅ 取 | iOS/macOS Metal 宿主、生命周期、触控 |
| V5 | `native/cocos/platform/linux/` | 22 文件 62KB | ✅ 取 | Linux 桌面（CI 冒烟） |
| V6 | `native/cocos/audio/` | 101 文件 753KB | ✅ 取 | 全平台音频后端；M0 可先只留头文件面 + OpenAL |
| V7 | `native/cocos/storage/` | 3 文件 14KB | ✅ 取 | 本地存储抽象（小游戏/localStorage 两侧） |
| V8 | `native/cocos/platform/java/` | 34 文件 192KB | ✅ 取 | Android Java 壳（Activity/权限/manifest） |
| V9 | `native/cocos/main/` | 1 文件 1KB | ✅ 取 | 平台 main 装配骨架 |
| V10 | `native/cocos/math/` | 32 文件 286KB | ⚠️ 评审 | 与 foundation/math 重叠，**默认不取**（避免双 math） |
| V11 | `native/cocos/renderer/`（gfx 后端初始化/swapchain 等） | 571 文件 5988KB | ⚠️ 按需取 3 处 | 只取 gfx 后端 device 创建/swapchain/命令队列基座；渲染器前端**不取**（自研 RHI，renderer-spec §2） |
| V12 | `native/cocos/platform/ohos/ + openharmony/` | 78 文件 1226KB | ⭕ 可选 | HarmonyOS 交付线未列入 v1（M3 若立项再取） |
| V13 | `native/cocos/platform/qnx/` | 8 文件 34KB | ⭕ 可选 | 无 QNX 交付计划 |
| V14 | `native/cocos/network/` | 29 文件 373KB | ⭕ 可选 | CCX 自研 network 抽象；仅参考不 vendor |
| V15 | `native/cocos/base/` | 109 文件 549KB | ⭕ 参考 | 与 foundation 重叠；不取，只读代码参考 |
| V16 | `native/cocos/bindings/` | — | ⭕ 不取 | TS↔C++ 绑定枢纽，CCX 走 IDL 生成（ADR-004） |

**v1 汇总**：V1–V9 全取 ≈ 438 文件 3.96MB；V11 按需取（估 60–80 文件 / 1.5–2MB）；合计 ≈ 500 文件 / 5.5–6MB 源码。

## 3. 每个 vendor 包的纪律（ci/gates/vendor_check.mjs 强制执行）

```text
platform/vendor/
├── pal/          UPSTREAM.md(commit=v4.0.0, date, localChanges: N) + LICENSE + patches/（若有改动）
├── audio/        ...
├── storage/      ...
├── android-java/ ...
└── renderer-boot/ ...
```

- 一律保留上游 LICENSE（MIT）与 AUTHORS 出处；发布页声明第三方组件清单（合规进 CI）。
- **禁止直接改 vendor 源码**：本地修改必须落 `patches/*.patch` + UPSTREAM.md 登记（ADR-005 §7 / vendor_check.mjs）。
- 季度同步窗口：只允许编译兼容性改动（platform-spec §5）。

## 4. M1 落地动作清单（✅ 1-2 已完成，2026-08-27）

1. ✅ 按 V1–V9 清单拷贝进 `engine/platform/vendor/*`（pal/audio/storage/main，369 文件 2.6MB；工具：tools/vendor/sync.mjs）。
2. ✅ 每个包写 UPSTREAM.md（来源 commit f5eaf97、同步日期 2026-08-27、localChanges: 0）+ LICENSE/AUTHORS。
3. ⏳ 编译矩阵先行验证：win32 + linux + android 三平台 hello（platform-spec §5 冒烟；platform 模块 CMake 挂载后执行）。
4. ⏳ 平台宏隔离：vendor 内允许 `#ifdef`；`platform/api/` 起禁止（platform-spec §2）。

> V11（renderer 后端启动基座）未随本轮落地，M1 后半段按需取 3 处（gfx 后端 device/swapchain）。

> 本清单为**评审结论**；M1 落地时若实际编译暴露依赖缺口，按"封装层兜底"原则补（ADR-005 §7），不回流改造 vendor。