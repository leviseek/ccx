#pragma once
// 崩溃上报（roadmap M3 工作包：崩溃上报与远程日志）
// - installCrashHandler(): 安装 SIGSEGV/SIGABRT(POSIX) / SEH(Windows) 处理器
// - writeCrashDump(reason): 立即写崩溃转储（异常码 + 栈回溯摘要）到 CCX_CRASH_DIR 或 .ccx/crash/
// 转储 JSON: { reason, pid, when, frames: ["0x...", ...] }

namespace ccx::platform {

// 安装崩溃处理器（幂等；进程生命周期内一次）
void installCrashHandler();

// 写崩溃转储并返回文件路径（失败返回空串）；处理器内部调用，也可手动测试
const char* writeCrashDump(const char* reason);

}  // namespace ccx::platform
