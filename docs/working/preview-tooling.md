# CCX 实时预览工具链（dev preview）

> 版本：v0.3.213（2026-08-29）· 目标：本机环境实时预览——Windows 预览 Windows 原生，macOS 预览 macOS 原生，**双栈通用 Web 预览**

## 1. 定位

引擎能力（render 软件光栅/RHI/Scene ADR-003）由工具链以「实时预览」消费；预览器是**外部工具**（tools/），不进入引擎库。

## 2. Web 实时预览（Win/mac 通用）

```bash
ccx preview scenes/my.scene.json --watch          # 实时：保存场景即刷新（SSE）
ccx preview scenes/my.scene.json --port 9000 --open  # 自定义端口并自动打开浏览器
```

- 服务路由：`/`（交互预览页：hierarchy/scene/inspector 面板 + 实体/命令切换）· `/__scene`（场景 JSON）· `/__events`（SSE：`--watch` 时 mtime 变化推送 `reload` → 浏览器整页刷新）
- 实现：`packages/editor-shell/src/preview_server.mjs`（node:http 零依赖；`buildScenePreviewHtml` 纯函数可测）
- 平台：任何浏览器（Windows/macOS 一致）；不支持 loopback 的受限沙箱仅服务不可用（CI/GitHub Actions 可跑集成用例）

## 3. 原生窗口预览（本机 OS）

```bash
node tools/preview-native/build.mjs                 # w64devkit g++ 链接引擎模块静态库 -> build/local/preview_native.exe
build/local/preview_native.exe scenes/x.scene.json --scale 2          # Windows 原生窗口实时预览
build/local/preview_native.exe scenes/x.scene.json --headless --out f.ppm   # 离屏单帧（CI/回归用）
build/local/preview_native.exe scenes/x.scene.json --watch            # 每秒重载（v1 轮询）
```

- Windows 实现：`engine/platform/win32/display_win32.{h,cpp}` —— **platform::DisplayAdapter（bridge.h 契约）的首个原生实现**（Win32 窗口 + GDI DIB 上屏 + 视口 fit/apply），预览器主循环走引擎装配（Scene → RenderItem → packer → RasterTarget → present）
- macOS：同源码（`#if defined(_WIN32)` 分支；非 Windows 输出指引走 Web 预览）——**待 mac 环境编译验证**
- 依赖：引擎模块静态库（`cmake --build build/local` 已产出 libccx_{gfx,render,scene,foundation}.a）

## 4. 架构归属（与前一轮桥接整改一致）

```
engine/platform (bridge.h 契约 + win32 DisplayAdapter)
  └─ tools/preview-native（桌面预览器：win32 原生窗口）
packages/platform-web（Web 显示/输入/渠道适配器）
  └─ packages/editor-shell（实时预览服务）+ 时之三重奏（预览宿主）
```

## 5. 验证记录（2026-08-29）

- `ccx preview` 服务：`buildScenePreviewHtml` 3/3（正常/异常诊断页/端口分配闭环）
- `preview_native.exe`：编译通过；`--headless` 渲染 sample.scene.json → 960×540 P6 PPM（1,555,215 B）✓
- 原生窗口交互（键盘/缩放/重载）：待手工验证（无头环境无法自动化窗口断言）

## 6. 遗留

- macOS 原生预览：源码条件编译就位，**无 mac 环境编译验证**（W6-2 同源缺口）
- 窗口输入归一化（InputAdapter 事件流）：adapter 钩子已留，v2 接键盘/指针归一化
- --watch 秒级轮询 → v2 换 ReadDirectoryChangesW
