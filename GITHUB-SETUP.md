# 推送到 GitHub（让 CI 真跑，出口③④ 复核）

目标：把本仓库推到 GitHub，触发 `.github/workflows/m0-ci.yml` 的 3 个任务：
`gates`（3 门禁）、`build×2`（Linux/Windows 构建 + ctest 4 项）、`lighthouse-c-bindgen`（napi 冒烟）。

## 步骤

```bash
# 1) GitHub 网页上新建一个空仓库（例如 user/ccx，不要勾选任何初始化文件）

# 2) 本地关联并推送（在 D:\engine\ai-ccc 下）
git branch -M main
git remote add origin https://github.com/<你的用户名>/ccx.git
git push -u origin main

# 3) 打开 Actions 页确认三任务全绿
#    绿标后：出口③④ 复核完成（裁定 A 的收尾动作）
#    失败时：按日志修，走正常缺陷流程（不算 M0 返工）
```

## 首次 PR 后的流程（建议）

1. 每笔改动走 PR：kebab 前缀分支 → 两平台构建 + 门禁自动跑。
2. CI 门禁是硬红线（12 条铁律的机器化身）：红即合并不了。
3. 若想私有仓库：GitHub 免费私有仓库即可，Actions 额度对小型仓库足够。

> 本机已验证：ctest 4/4、三门禁、bindgen 5/5 + tsc、napi smoke 已配好（pull 后直接可跑）。
