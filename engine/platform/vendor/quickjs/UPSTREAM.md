# QuickJS（vendor 记录，ADR-005 §4/§7）

- 来源：https://github.com/bellard/quickjs（master @ 2026-08-28 Raw 下载）
- 用途：脚本引擎（W5a QuickJS 主选；v8-host-design / script-engine-decision 决策）
- 文件：quickjs.c / quickjs.h / cutils.h / list.h（大小校验：2033048 / 47259 / 11162 / 3089）
- 许可：MIT（quickjs.c 头部版权声明副本见 LICENSE.txt）
- 本地变更：无（原始快照）；任何改动必须经 patches/ 并本文件记录
- 注意：快速集成路径（单文件引擎）；绑定由 tools/bindgen quickjs 目标生成
