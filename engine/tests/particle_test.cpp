// 2D 粒子数据面测试（发射/更新/回收/稳态）
#include <cmath>
#include <cstdio>
#include <vector>

#include "ccx/particle/emitter.h"

using namespace ccx::particle;

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
        // 1) 发射与稳态：rate=10/s, life=1s -> 稳态 alive 约 10
        Emitter e({.rate = 10.0f, .lifeMin = 1.0f, .lifeMax = 1.0f, .looping = true}, 256);
        for (int i = 0; i < 30; ++i) e.update(0.1f);
        const uint32_t alive = e.aliveCount();
        check(alive >= 8 && alive <= 12, "稳态 alive≈10");
        check(e.capacity() == 256, "容量正确");
    }
    {
        // 2) 生命衰减与稳态：rate=20/s, life=0.5s -> 稳态 alive ≈ 10（rate*life）
        Emitter e({.rate = 20.0f, .lifeMin = 0.5f, .lifeMax = 0.5f, .looping = true}, 64);
        for (int i = 0; i < 20; ++i) e.update(0.1f);  // 2 秒（稳态）
        const uint32_t alive2 = e.aliveCount();
        check(alive2 >= 8 && alive2 <= 12, "稳态 alive≈rate*life=10，老粒子已回收");
    }
    {
        // 3) 重力：粒子 vel.y 变大
        Emitter e({.rate = 10.0f, .lifeMin = 2.0f, .lifeMax = 2.0f,
                   .gravity = 100.0f, .looping = true}, 32);
        e.update(0.1f);
        e.update(0.1f);
        bool sawY = false;
        for (const Particle& p : e.particles()) {
            if (p.alive && std::fabs(p.vel.y) > 1.0f) sawY = true;
        }
        check(sawY, "重力作用于 vel.y");
    }
    {
        // 4) 池容量封顶 + 淡出 alpha（t>0.6*maxLife 进入淡出）
        Emitter e({.rate = 50.0f, .lifeMin = 2.0f, .lifeMax = 2.0f, .looping = true}, 32);
        for (int i = 0; i < 15; ++i) e.update(0.1f);  // 1.5s：t=0.75 > 0.6
        check(e.aliveCount() <= 32, "池容量封顶");
        bool sawFade = false;
        for (const Particle& p : e.particles()) {
            if (p.alive && p.alpha < 1.0f && p.alpha > 0.0f) sawFade = true;
        }
        check(sawFade, "存在淡出中的粒子（t>0.6）");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (particle)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
