// W7 骨骼 -> 渲染桥：姿态采样驱动渲染项（位置/旋转映射）
#include <cstdio>

#include "ccx/render/skeleton_render.h"

using namespace ccx;
using namespace ccx::render;

int main() {
    int failures = 0;
    const auto check = [&](bool ok, const char* what) {
        if (!ok) { std::printf("FAIL: %s\n", what); ++failures; }
    };
    animation::Skeleton sk;
    animation::BoneTrack root;
    root.name = "root";
    root.keys = { { 0.0f, { 0.0f, 0.0f, 0.0f } }, { 1.0f, { 40.0f, 20.0f, 90.0f } } };
    animation::BoneTrack arm;
    arm.name = "arm";
    arm.keys = { { 0.0f, { 5.0f, 0.0f, 0.0f } }, { 1.0f, { 5.0f, 0.0f, -30.0f } } };
    sk.tracks = { root, arm };

    const SkeletonRenderConfig cfg{ 100.0f, 200.0f, 3, 1, 16.0f };
    // 1) 末端采样 -> 2 项，位置含根偏移
    const auto items = skeletonToRenderItems(sk, 1.0f, cfg);
    check(items.size() == 2, "两项渲染");
    check(items[0].pos.x == 140.0f && items[0].pos.y == 220.0f, "根骨位置（根+40/20）");
    check(items[0].rotZ == 90.0f, "根骨旋转");
    // 2) 臂骨位置/旋转
    check(items[1].pos.x == 105.0f && items[1].pos.y == 200.0f, "臂骨位置（v0.1 独立于根偏移：cfg根+5）");
    check(items[1].rotZ == -30.0f, "臂骨旋转");
    // 3) atlas/size 透传
    check(items[0].atlas == 3 && items[0].size == 16.0f, "atlas/size 配置");

    if (failures == 0) {
        std::printf("ALL TESTS PASSED (skeleton render)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", failures);
    return 1;
}
