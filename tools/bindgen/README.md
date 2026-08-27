# tools/bindgen — IDL 绑定生成器（灯塔任务 C ✅ 已完成原型）

目标（ADR-004 §3/§6）：输入 `.idl` → 输出 napi 绑定源码 + `.d.ts` + JSON Schema；IDL 是 C++↔JS 边界的唯一来源。

## 原型状态（2026-08-27 已实现并验证）

- **IDL 子集**（src/idl.mjs）：`module` + `class { method(name: type): ret; readonly prop: type = default; }`；类型 string/float/int/bool/void
- **生成器**（src/generators.mjs）：
  - napi：`<module>_bindings.cpp`（raw N-API，无 node-addon-api 依赖，NAPI_MODULE 出口）
  - d.ts：`declare namespace <module>`（ambient，无初始化器）
  - schema：API 契约 JSON Schema（methods.params/returns + readOnly props）
- **验证**：`node --test` 5/5 通过；生成物经 `tsc --noEmit --strict` 类型检查通过（exit 0）
- **范围边界**：napi 产物需 node-gyp/MSVC 编译（CI 侧验证）；真实绑定实现体由引擎代码替换占位 TODO

## 使用

```bash
node bin/bindgen.mjs examples/hello.idl --out out
# → out/ccx_hello_bindings.cpp + out/ccx_hello.d.ts + out/ccx_hello.schema.json
node --test          # 5/5
npx tsc --noEmit --strict out/ccx_hello.d.ts
```

## 下一步（M1）

- IDL 扩展：数组参数、回调、默认值、跨模块引用
- 生成器接入 CMake（pre-build step）与 node-gyp 编译矩阵（CI workflow）
- JSON Schema 与引擎反射（engine-spec §5.2）对齐为同一 schema 源
