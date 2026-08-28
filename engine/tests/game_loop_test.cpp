// GameLoop 测试（固定步长累积/多帧/螺旋保护）
#include <cstdio>

#include "ccx/game/game_loop.h"

using namespace ccx::game;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
}  // namespace

int main() {
    {
        // 1) 常规累积：0.15s wall -> 1 步（剩 0.05）
        GameLoop loop({0.1f, 4});
        uint32_t total = 0;
        const uint32_t s1 = loop.step(0.15f, [&](float) { ++total; });
        check(s1 == 1 && total == 1, "0.15 -> 1 步");
        check(loop.accumulator() > 0.049f && loop.accumulator() < 0.051f, "剩 0.05");
        // 第二帧 0.15 -> 累积 0.2 -> 2 步
        const uint32_t s2 = loop.step(0.15f, [&](float) { ++total; });
        check(s2 == 2 && total == 3, "0.15+0.05 -> 2 步");
        check(loop.accumulator() < 1e-4f, "累积清零");
        check(loop.frameCount() == 2, "两帧");
    }
    {
        // 2) 螺旋保护：dt=1.0（远大于 fixed 0.1*maxSteps 4）-> 只跑 4 步并丢弃
        GameLoop loop({0.1f, 4});
        uint32_t total = 0;
        const uint32_t s = loop.step(1.0f, [&](float) { ++total; });
        check(s == 4 && total == 4, "maxSubSteps 生效");
        check(loop.accumulator() < 1e-4f, "螺旋保护丢弃剩余");
    }
    {
        // 3) 精确整除：0.2 -> 2 步，累积 0
        GameLoop loop({0.1f, 4});
        uint32_t steps = loop.step(0.2f, [](float) {});
        check(steps == 2 && loop.accumulator() < 1e-4f, "整除无残留");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (game loop)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
