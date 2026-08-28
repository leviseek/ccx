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

- [ ] gates 任务 3 项全绿（依赖方向/vendor/schema）
- [ ] build 矩阵 ubuntu+windows：编译 + ctest 全跑（自动化覆盖 51 项含新 e2e/script）
- [ ] lighthouse-c-bindgen：napi 编译 + smoke（出口④真跑首验）
- [ ] 若 windows 矩阵有 Werror 差异：以 CI 输出为准补修（本地 w64devkit 一致）

## 4. 已知待环境项（不影响 push）

- GPU 首帧（W1）：RHI 契约 + FakeDevice 仿真 + 软件光栅黄金对照齐全，待 GPU/lavapipe runner。
- 真机/渠道（W6）：账号与设备待配置。
`n`n## 4b. W6 真机预备（2026-08-28）`n`n- adb 工具：**已安装**（经代理手动下载 platform-tools 37.0.1 → %USERPROFILE%\Android\platform-tools；doctor --env 可探测）。`n- doctor --env device 段已可探测 adb 路径与设备数。`n



## 终核记录（2026-08-28，v0.3.145）

- 本地全量：ctest 62/62 + node 119/119 + 双门禁（持续绿）。
- 仓库卫生：工作树 0 entries；171 commits；vendor 近 4 commit 0 改动（纪律保持）。
- 环境：GPU ✅ + 设备 ✅ + vendor 6 包；仅 Actions CI 真跑待 push。
- 结论：**push 就绪**——push 后按 §3 确认 Actions 三任务。

