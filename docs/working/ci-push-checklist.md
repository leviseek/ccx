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
- [ ] build 矩阵 ubuntu+windows：编译 + ctest 全跑（自动化覆盖 51 项含新 e2e/script）——⏳ 未过（linux 现阶段不考虑；windows 配置失败待查）
- [ ] lighthouse-c-bindgen：napi 编译 + smoke（出口④真跑首验）——⏳ 未过（linux 上 node-gyp 失败，现阶段不考虑）
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

