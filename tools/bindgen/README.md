# tools/bindgen — IDL 绑定生成器（灯塔任务 C，ADR-004）

目标：输入 `.idl`（C++ 导出面声明）→ 输出 napi 绑定源码 + `ccx.d.ts` + JSON Schema。
约束：IDL 为 C++ ↔ JS 边界的唯一来源；禁止手写桥接（ADR-004 §3/§6）。

M0 出口④：bindgen 输出 napi hello（C++ 调 TS 函数）。状态：占位。
