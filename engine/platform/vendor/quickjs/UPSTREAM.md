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
- 本地变更：**2 个 patch**（2026-08-29）：① `patches/msvc-packed.patch`——cutils.h MSVC 兼容全套：`CCX_PACKED_STRUCT` 宏（pragma pack）替换 3 处 packed；`__attribute__(x)` 整体置空宏（format/aligned/warn_unused_result）；likely/unlikely/force_inline 等宏条件化；clz/ctz 用 `_BitScan` 等价。② `patches/msvc-time.patch`——quickjs.c/h/dtoa.c MSVC 兼容：`struct timeval`+`gettimeofday`（FILETIME 实现）、`_AddressOfReturnAddress`、`DIRECT_DISPATCH=0`（无 label-as-value）、`CONFIG_ATOMICS`/`CONFIG_STACK_CHECK` 禁用（pthread/栈探测不适用）、`JS_MKVAL/MKPTR/JS_NAN` 内联函数替代 compound literal、移除冗余 `(JSValue)` cast、`1.0/0.0`→`INFINITY`（C2124）。Windows CI（VS18/MSVC）编译必需。**已知限制**：QuickJS 上游不官方支持 MSVC，eval 错误路径（ReferenceError 抛出）在 MSVC 崩溃（0xc0000409）——script.host/scene_bridge/game_loop 3 测试在 MSVC 下 DISABLED（GCC/MinGW 全绿）。CONFIG_VERSION 由构建定义 |"1.0.0"| 兜底（无 config.h 时）
- 注意：任何改动必须经 patches/ 并本文件记录

