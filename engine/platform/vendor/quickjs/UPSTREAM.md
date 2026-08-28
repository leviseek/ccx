# QuickJS（vendor 记录，ADR-005 §4/§7）

- 来源：https://github.com/bellard/quickjs（master @ 2026-08-28 Raw 下载）
- 用途：脚本引擎（W5a QuickJS 主选；嵌入编译冒烟已通过——engine/script + script.host 测试）
- 文件（大小校验，bytes）：
  - quickjs.c 2033048 / quickjs.h 47259 / cutils.{c,h} 17798+11162
  - libregexp.{c,h} 113209+2737 / libregexp-opcode.h 2887
  - libunicode.{c,h} 63617+5979 / libunicode-table.h 252492
  - dtoa.{c,h} 44875+3306 / list.h 3089
  - 生成头：quickjs-atom.h 8295 / quickjs-opcode.h 15801
- 许可：MIT（文本副本 LICENSE.txt）
- 本地变更：**1 个 patch**（2026-08-29）：`patches/msvc-packed.patch`——MSVC 无 `__attribute__((packed))`，cutils.h 用 `CCX_PACKED_STRUCT` 宏（MSVC pragma pack / GCC 原生）等价替换 3 处 packed 结构体；Windows CI（VS18/MSVC）编译必需。CONFIG_VERSION 由构建定义 |"1.0.0"| 兜底（无 config.h 时）
- 注意：任何改动必须经 patches/ 并本文件记录
