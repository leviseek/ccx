# webgpu-headers（vendor 记录，ADR-005 §4/§7）

- 来源：https://github.com/webgpu-native/webgpu-headers（main @ 2026-08-28 Raw 下载）
- 用途：W1 真后端（wgpu-native）C 头文件；本机 Vulkan 就绪（RTX 4070 SUPER / SwiftShader 备选）
- 文件：webgpu.h（259,872 bytes）+ LICENSE（1,533 bytes，仓库根 BSD-3-Clause，UTF-8 无 BOM）
- 许可：BSD-3-Clause（LICENSE 文件；头文件 SPDX 声明一致）
- 本地变更：无；任何改动经 patches/ 并本文件记录
- 剩余缺口：wgpu-native 二进制（需 cargo 构建或发行包；头文件已就位）
