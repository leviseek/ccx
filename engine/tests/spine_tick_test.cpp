// W7 运行时闭环：GameLoop 驱动骨骼动画（累计时间 -> 采样 -> 渲染项）
#include <cstdio>

#include "ccx/animation/spine_loader.h"
#include "ccx/foundation/serialization/json.h"
#include "ccx/game/game_loop.h"
#include "ccx/render/skeleton_render.h"

using namespace ccx;
using namespace ccx::json;
using namespace ccx::animation;
using namespace ccx::game;
using namespace ccx::render;

int main() {
    int failures = 0;
    const auto check = [&](bool ok, const char* what) {
        if (!ok) { std::printf("FAIL: %s\n", what); ++failures; }
    };
    // Spine 3.8 片段 -> Skeleton（走真实加载路径）
    const std::string jsonText =
        "{\"bones\":[{\"name\":\"root\"}],\n"
        " \"animations\":{\"walk\":{\"bones\":{\n"
        "   \"root\":{\"translate\":[[0,0,0],[1,100,0]],\"rotate\":[[0,0],[1,90]]}\n"
        " }}}}\n";
    const auto doc = json::parse(jsonText);
    Skeleton sk;
    std::string err;
    check(loadSpineSkeleton(doc, sk, err), "加载");

    // GameLoop 驱动：累计时间按固定步推进
    float animTime = 0.0f;
    float lastX = -1.0f;
    GameLoop loop({0.5f, 4});  // 固定步 0.5s
    for (int f = 0; f < 3; ++f) {
        loop.step(0.5f, [&](float) {
            animTime += 0.5f;
            const auto items = skeletonToRenderItems(
                sk, animTime, SkeletonRenderConfig{ 10.0f, 20.0f, 1, 1, 16.0f });
            check(items.size() == 1, "每帧一项");
            lastX = items[0].pos.x;
        });
    }
    // 3 帧后累计 1.5s -> 循环窗口（last+1=2.0）内 1.5 处于末端保持（x=100）
    check(lastX == 110.0f, "帧循环驱动：位置沿关键帧移动（t=1.5 末端保持，根10+100）");
    check(animTime == 1.5f, "累计时间 1.5s");

    if (failures == 0) {
        std::printf("ALL TESTS PASSED (spine tick loop)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", failures);
    return 1;
}
