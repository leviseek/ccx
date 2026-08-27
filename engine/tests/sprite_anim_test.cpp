// 精灵帧动画测试（帧推进/循环/UV 计算）
#include <cmath>
#include <cstdio>

#include "ccx/animation/sprite_anim.h"

using namespace ccx::animation;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
bool near(float a, float b) { return std::fabs(a - b) < 1e-5f; }
}  // namespace

int main() {
    {
        // 1) 3x2 网格 6 帧，fps=10：t=0.15 -> 帧 1
        SpriteSampler s(SpriteClip{"run", 0, 3, 2, 6, 10.0f, true});
        s.setTime(0.15f);
        check(s.currentFrame() == 1, "t=0.15 -> 帧 1");
        s.setTime(0.59f);
        check(s.currentFrame() == 5, "t=0.59 -> 帧 5");
        // 循环：0.6 秒 6 帧 -> t=1.61 回绕到 0.41 -> 帧 4
        s.setTime(1.61f);
        check(s.currentFrame() == 4, "循环回绕 -> 帧 4");
        // 非循环越界钳到最后帧
        SpriteSampler s2(SpriteClip{"run", 0, 3, 2, 6, 10.0f, false});
        s2.setTime(9.0f);
        check(s2.currentFrame() == 5, "非循环钳到末帧");
    }
    {
        // 2) UV 计算（3x2）：帧 0 左上块、帧 1 右上、帧 2 第二行
        const SpriteClip clip{"run", 0, 3, 2, 6, 10.0f, true};
        const FrameUv f0 = SpriteSampler::uvForFrame(clip, 0);
        const FrameUv f2 = SpriteSampler::uvForFrame(clip, 2);
        check(near(f0.u0, 0.0f) && near(f0.v0, 0.0f) && near(f0.u1, 1.0f / 3.0f) &&
                  near(f0.v1, 0.5f),
              "帧 0 UV 左上块");
        check(near(f2.u0, 2.0f / 3.0f) && near(f2.v0, 0.0f), "帧 2 在顶层最右");
        const FrameUv f3 = SpriteSampler::uvForFrame(clip, 3);
        check(near(f3.v0, 0.5f) && near(f3.v1, 1.0f), "帧 3 在第二行");
    }
    {
        // 3) frameCount 截断：网格 4x4 但只声明 8 帧
        const SpriteClip clip{"guard", 0, 4, 4, 8, 8.0f, true};
        const FrameUv f7 = SpriteSampler::uvForFrame(clip, 7);
        check(near(f7.u1, 1.0f) && near(f7.v1, 0.5f), "第 8 帧 = (3,1)");
        SpriteSampler s(clip);
        s.setTime(0.99f);  // 8fps * 0.99s -> 帧 7（第 8 帧）
        check(s.currentFrame() == 7, "帧数截断到 frameCount-1");
        s.setTime(1.0f);   // 恰好一个周期 -> 回绕到帧 0
        check(s.currentFrame() == 0, "整周期回绕到首帧");
        // 越界取模语义：uvForFrame(帧 100) 取模 16 后仍按 frameCount 截断
        const FrameUv fm = SpriteSampler::uvForFrame(clip, 100);
        check(fm.u0 >= 0.0f && fm.u1 <= 1.0f && fm.v1 <= 1.0f, "越界 UV 仍在合法区间");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (sprite anim)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
