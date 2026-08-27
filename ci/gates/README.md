# CI 门禁（M0 起强制，三条）

| 门禁 | 脚本 | 对应 | 本地运行 |
| --- | --- | --- | --- |
| 依赖方向 | layered_imports.mjs | 铁律 1/6，engine-spec §1 | `node ci/gates/layered_imports.mjs .` |
| vendor 纪律 | vendor_check.mjs | ADR-005 §4/§7 | `node ci/gates/vendor_check.mjs .` |
| schema round-trip | schema_roundtrip.mjs | ADR-003 §6 | 由 ctest 执行（构建后可显式给目录） |

首次提交前本地验证：`node ci/gates/layered_imports.mjs . && node ci/gates/vendor_check.mjs .`
