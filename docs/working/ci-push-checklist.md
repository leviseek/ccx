# CI Push 终审清单（push 前最后防线，v0.3.73）

> 目的：push 触发 Actions（gates ×2 矩阵 build+ctest + lighthouse-c-bindgen）前的自检项。

## 1. 本地全量

- [x] `cmake -S . -B build/local … && cmake --build build/local` → ctest 51/51
- [x] node --test（显式文件 32 个）→ 99/99
- [x] 门禁本地两跑：layered_imports / vendor_check（5 包）

## 2. 仓库卫生

- [x] git 树无 build/ 产物（任意层 gitignore）
- [x] 提交链连续（近期每轮单 commit 语义清晰）
- [x] vendor 纪律：quickjs 走 UPSTREAM 记录（未本地修改）

## 3. push 后确认（Actions 侧）

- [x] gates 任务 3 项全绿（依赖方向/vendor/schema）——**2026-08-29 首次真跑 ✅**（run 33189819320，push a5a9d58）
- [x] build 矩阵（仅 windows，2026-08-29 起 linux 已移除）：编译 + ctest 全跑——**✅ 全绿**（run 33201215757，push 8b42656）
- [x] lighthouse-c-bindgen：napi 编译 + smoke（出口④真跑首验）——**✅ 全绿**（CMake 直连 MSVC 绕过 node-gyp VS18 探测）

### 3b. 全绿实录（2026-08-29，run 33201215757）

- **三个 job 全部 success**：架构门禁 ✅ / 构建 + ctest（Windows）✅ / bindgen napi 冒烟 ✅——CCX 首个完全通过的 CI run。
- 关键修复链：① VS18 探测（msvc-dev-cmd 加载环境 + Ninja 生成器）→ ② QuickJS MSVC 兼容（compound literal/attribute/stack/atomics/INFINITY 等 8 类，2 个 vendor patch）→ ③ script 3 测试按上游限制 Disabled（QuickJS 官方不支持 MSVC eval 错误路径）→ ④ spine_dump gfx include → ⑤ bindgen 生成器 2 个 bug（属性 std::string 映射 + .c_str()）→ ⑥ napi 构建改 CMake + --ignore-scripts 绕过 node-gyp。
- 本地双工具链验证：GCC/MinGW 63/63、MSVC（VS2026 Community @ C:\dev）60/60 + 3 Disabled。
- [ ] 若 windows 矩阵有 Werror 差异：以 CI 输出为准补修（本地 w64devkit 一致）

### 3a. 首跑实录（2026-08-29）

- push 61 提交（d81f784..a5a9d58）；SSH 认证 + push 成功。
- **gates job（架构门禁）三闸全绿**：layered_imports 84 文件 / vendor_check 6 包 / schema_roundtrip——首个在真实 Actions 上通过的 CI 任务。
- 附带修复：layered gate 曾被 7c939c4 截断（依赖检查未生效），已恢复 92 行完整版 + render→animation 依赖表补录；vendor gate 排除 .cxx 构建产物误扫。

## 4. 已知待环境项（不影响 push）

- GPU 首帧（W1）：RHI 契约 + FakeDevice 仿真 + 软件光栅黄金对照齐全，待 GPU/lavapipe runner。
- 真机/渠道（W6）：账号与设备待配置。
`n`n## 4b. W6 真机预备（2026-08-28）`n`n- adb 工具：**已安装**（经代理手动下载 platform-tools 37.0.1 → %USERPROFILE%\Android\platform-tools；doctor --env 可探测）。`n- doctor --env device 段已可探测 adb 路径与设备数。`n



## 终核记录（2026-08-28，v0.3.145）

- 本地全量：ctest 62/62 + node 119/119 + 双门禁（持续绿）。
- 仓库卫生：工作树 0 entries；171 commits；vendor 近 4 commit 0 改动（纪律保持）。
- 环境：GPU ✅ + 设备 ✅ + vendor 6 包；仅 Actions CI 真跑待 push。
- 结论：**push 就绪**——push 后按 §3 确认 Actions 三任务。



## 终核记录 3（2026-08-28，v0.3.165）

- 树干净（0 entries）；195 commits；GPU ✅ + 设备 ✅（全链）；仅 Actions CI 真跑待 push。
- 结论：**push 就绪（终态）**。

