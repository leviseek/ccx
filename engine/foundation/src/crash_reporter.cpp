// 崩溃上报实现（roadmap M3）：Windows SEH + POSIX 信号捕获 -> JSON 转储文件
#include "ccx/foundation/crash_reporter.h"

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

#ifdef _WIN32
#include <windows.h>
#include <direct.h>
#else
#include <signal.h>
#include <execinfo.h>
#include <unistd.h>
#endif

namespace ccx::platform {
namespace {

#ifdef _WIN32
LONG WINAPI sehHandler(EXCEPTION_POINTERS* info) {
    char reason[64];
    std::snprintf(reason, sizeof(reason), "SEH 0x%08lX",
                  static_cast<unsigned long>(info->ExceptionRecord->ExceptionCode));
    writeCrashDump(reason);
    return EXCEPTION_EXECUTE_HANDLER;
}
#else
void signalHandler(int sig) {
    char reason[64];
    std::snprintf(reason, sizeof(reason), "SIG %d", sig);
    writeCrashDump(reason);
    std::signal(sig, SIG_DFL);
    std::raise(sig);
}
#endif

std::string crashDir() {
    const char* env = std::getenv("CCX_CRASH_DIR");
    return env && env[0] ? std::string(env) : std::string(".ccx/crash");
}

#ifdef _WIN32
void captureFrames(void** frames, int& n) {
    (void)frames; (void)n;
}
#else
void captureFrames(void** frames, int& n) {
    n = backtrace(frames, 16);
}
#endif

}  // namespace

void installCrashHandler() {
#ifdef _WIN32
    SetUnhandledExceptionFilter(sehHandler);
#else
    std::signal(SIGSEGV, signalHandler);
    std::signal(SIGABRT, signalHandler);
    std::signal(SIGFPE, signalHandler);
#endif
}

const char* writeCrashDump(const char* reason) {
    static std::string lastPath;
    void* frames[16] = {nullptr};
    int n = 0;
    captureFrames(frames, n);
    std::string dir = crashDir();
#ifdef _WIN32
    std::string acc = dir.substr(0, dir.find('/'));
    if (!acc.empty()) { _mkdir(acc.c_str()); _mkdir(dir.c_str()); }
#else
    std::string acc = dir.substr(0, dir.find('/'));
    if (!acc.empty()) { mkdir(acc.c_str(), 0777); mkdir(dir.c_str(), 0777); }
#endif
    const auto now = std::chrono::system_clock::now().time_since_epoch().count() / 1000000000;
    std::string path = dir + "/ccx-crash-" + std::to_string(static_cast<long long>(now)) + ".json";
    std::string json;
    json.reserve(128);
    json += "{";
    json += "\"reason\":\"" + std::string(reason ? reason : "unknown") + "\",";
    json += "\"when\":\"" + std::to_string(static_cast<long long>(now)) + "\",";
    json += "\"frames\":\"" + std::to_string(n) + "\"}";
    FILE* f = std::fopen(path.c_str(), "wb");
    if (f) {
        std::fwrite(json.data(), 1, json.size(), f);
        std::fclose(f);
        lastPath = path;
        return lastPath.c_str();
    }
    lastPath.clear();
    return lastPath.c_str();
}

}  // namespace ccx::platform
