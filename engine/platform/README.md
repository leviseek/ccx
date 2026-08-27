# engine/platform — Capability 模型 + Adapter 注册表 + vendor（ADR-005/platform-spec）

vendor 目录：cocos4 native 适配已落地（M1-3：pal/audio/storage/main 共 369 文件 ≈2.6MB，
来源 commit f5eaf97，门禁 ci/gates/vendor_check.mjs 非空运行通过）。
同步/更新：node tools/vendor/sync.mjs（blobless 稀疏克隆）。
状态：vendor 层就绪；Capability/Adapter API 与 platform 模块 CMake 挂载在 M1 后半段。
