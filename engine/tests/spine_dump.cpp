// Spine 帧导出工具（demo 链用）：spine.json -> 采样 -> 光栅 -> PPM
// 用法：ccx_spine_dump <spine.json> <out.ppm> [width height]
#include <cstdio>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include "ccx/animation/spine_loader.h"
#include "ccx/foundation/serialization/json.h"
#include "ccx/render/raster.h"
#include "ccx/render/skeleton_render.h"

using namespace ccx;

int main(int argc, char** argv) {
    if (argc < 3) {
        std::fprintf(stderr, "usage: ccx_spine_dump <spine.json> <out.ppm> [w h]\n");
        return 2;
    }
    std::ifstream f(argv[1]);
    if (!f) { std::fprintf(stderr, "open failed\n"); return 2; }
    std::stringstream ss;
    ss << f.rdbuf();

    animation::Skeleton sk;
    std::string err;
    if (!animation::loadSpineSkeleton(json::parse(ss.str()), sk, err)) {
        std::fprintf(stderr, "spine 加载失败: %s\n", err.c_str());
        return 1;
    }
    const int W = argc >= 4 ? std::atoi(argv[3]) : 160;
    const int H = argc >= 5 ? std::atoi(argv[4]) : 90;
    const float T = 1.0f;  // 末端采样
    const auto items = render::skeletonToRenderItems(
        sk, T, render::SkeletonRenderConfig{ static_cast<float>(W) / 2.0f,
                                             static_cast<float>(H) / 2.0f, 1, 1, 8.0f });
    render::RasterTarget target(static_cast<uint32_t>(W), static_cast<uint32_t>(H));
    target.clear(0x101020FFu);
    for (const render::RenderItem& it : items) {
        const int px = static_cast<int>(it.pos.x), py = static_cast<int>(it.pos.y);
        const int half = static_cast<int>(it.size) / 2;
        for (int y = -half; y < half; ++y) {
            for (int x = -half; x < half; ++x) {
                target.put(px + x, py + y, 0xFFFF00FFu);
            }
        }
    }
    if (!render::writePpm(target, argv[2])) {
        std::fprintf(stderr, "write failed\n");
        return 1;
    }
    std::printf("{\"bones\":%zu,\"width\":%d,\"height\":%d,\"ppm\":\"%s\"}\n",
                items.size(), W, H, argv[2]);
    return 0;
}
