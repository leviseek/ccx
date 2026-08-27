# engine/ — C++20 引擎核心（2D-first）

布局与依赖方向见 [engine-spec](../docs/engine-spec.md) §1；模块裁剪见 §2。

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| foundation | ✅ M0 实现中（反射/序列化/数学） | 灯塔任务 A |
| ecs / scene / gfx / render / animation / physics / audio / ui / input / asset / scripting / network / platform | ⏳ 占位 | M1/M2 按 roadmap 挂载 CMake |

本地工具链：mise（cmake+ninja，见 ../.mise.toml）+ 平台编译器（Windows 开发机可用 w64devkit，CI 用系统编译器）。
