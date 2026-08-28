// W7 Spine 桥数据面：骨骼姿态采样（关键帧插值/循环）
#include <cstdio>

#include "ccx/animation/skeleton.h"

using namespace ccx::animation;

int main() {
    int failures = 0;
    const auto check = [&](bool ok, const char* what) {
        if (!ok) { std::printf("FAIL: %s\n", what); ++failures; }
    };
    Skeleton sk;
    BoneTrack root;
    root.name = "root";
    root.keys = {
        { 0.0f, { 0.0f, 0.0f, 0.0f } },
        { 1.0f, { 100.0f, 50.0f, 90.0f } },
    };
    BoneTrack arm;
    arm.name = "arm";
    arm.keys = {
        { 0.0f, { 10.0f, 0.0f, 0.0f } },
        { 1.0f, { 10.0f, 0.0f, -45.0f } },
    };
    sk.tracks = { root, arm };

    // 1) 中点插值
    const auto p05 = sk.sample(0.5f);
    check(p05.size() == 2, "骨骼数");
    check(p05[0].x > 49.0f && p05[0].x < 51.0f, "root.x 中点 50");
    check(p05[0].rotation > 44.0f && p05[0].rotation < 46.0f, "root.rot 中点 45");
    // 2) 末端姿态
    const auto p1 = sk.sample(1.0f);
    check(p1[0].x == 100.0f && p1[0].rotation == 90.0f, "末端姿态");
    // 3) 循环采样（越界回到循环）
    const auto pLoop = sk.sample(3.0f);
    check(pLoop[0].x >= 0.0f && pLoop[0].x <= 100.0f, "循环采样");
    // 4) 臂旋转插值
    check(p05[1].rotation < -21.0f && p05[1].rotation > -24.0f, "arm.rot 中点 -22.5");

    if (failures == 0) {
        std::printf("ALL TESTS PASSED (spine skeleton)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", failures);
    return 1;
}
