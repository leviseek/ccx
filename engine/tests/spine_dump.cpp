// Spine 帧导出工具（demo 链用）：spine.json -> 采样 -> 光栅 -> PPM
// 用法：ccx_spine_dump <spine.json> <out.ppm> [width height]
#include <algorithm>
#include <cstdio>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include "ccx/animation/spine_loader.h"
#include "ccx/foundation/serialization/json.h"
#include "ccx/gfx/rhi.h"
#ifdef CCX_WGPU_BACKEND
#include "ccx/gfx/rhi_wgpu.h"
#endif
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
#ifdef CCX_WGPU_BACKEND
    if (argc >= 6 && std::string(argv[5]) == "wgpu") {
        // GPU 数据面承载骨骼帧（W1×W7 合流）：上传 -> 读回
        gfx::WgpuDevice dev;
        const gfx::Handle tex = dev.createTexture(
            {gfx::TextureDesc::Rgba8, static_cast<uint32_t>(W), static_cast<uint32_t>(H)});
        if (!dev.uploadTexture(tex, target.pixels.data(), target.pixels.size() * 4)) {
            std::fprintf(stderr, "upload failed\n");
            return 1;
        }
        std::vector<uint32_t> back(target.pixels.size(), 0);
        if (!dev.readback(tex, back.data(), back.size() * 4)) {
            std::fprintf(stderr, "readback failed\n");
            return 1;
        }
        std::copy(back.begin(), back.end(), target.pixels.begin());
    }
#endif
    if (!render::writePpm(target, argv[2])) {
        std::fprintf(stderr, "write failed\n");
        return 1;
    }
    std::string ppmJson(argv[2]);
    for (char& cj : ppmJson) {
        if (cj == '\\') cj = '/';
    }
    std::printf("{\"bones\":%zu,\"width\":%d,\"height\":%d,\"ppm\":\"%s\"}\n",
                items.size(), W, H, ppmJson.c_str());
    return 0;
}