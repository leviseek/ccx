// 崩溃上报测试（M3）：安装处理器 + 手动转储 + 真实崩溃捕获（子进程模式）
#include <cstdio>
#include <cstdlib>
#include <string>
#include <sys/stat.h>

#include "ccx/foundation/crash_reporter.h"

namespace {
int g_fail = 0;
void check(bool ok, const char* what) {
    if (!ok) { std::printf("FAIL: %s" "\n", what); ++g_fail; }
}
bool fileExists(const char* p) {
    struct stat st;
    return stat(p, &st) == 0;
}
}  // namespace

int main(int argc, char** argv) {
    if (argc > 1 && std::string(argv[1]) == "--crash") {
        ccx::platform::installCrashHandler();
        volatile int* bad = nullptr;
        *bad = 42;
        return 2;
    }

    const char* dump = ccx::platform::writeCrashDump("test-reason");
    check(dump && dump[0], "dump path non-empty");
    if (dump && dump[0]) {
        check(fileExists(dump), "dump file exists");
        FILE* f = std::fopen(dump, "rb");
        if (f) {
            char buf[256] = {0};
            const size_t n = std::fread(buf, 1, sizeof(buf) - 1, f);
            std::fclose(f);
            const std::string s(buf, n);
            check(s.find("test-reason") != std::string::npos, "reason in JSON");
            check(s.find("when") != std::string::npos, "when field");
            check(s.find("frames") != std::string::npos, "frames field");
        } else check(false, "dump readable");
    }

    if (g_fail == 0) { std::printf("crash_reporter: all ok" "\n"); return 0; }
    std::printf("crash_reporter: %d failure(s)" "\n", g_fail);
    return 1;
}
