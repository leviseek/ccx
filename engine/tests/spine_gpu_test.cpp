// W1×W7 合流：骨骼动画渲染项 -> 真 GPU 帧（软件光栅 -> WgpuDevice 数据面 -> 像素断言）
#include <cstdio>
#include <vector>

#include "ccx/animation/spine_loader.h"
#include "ccx/gfx/rhi_wgpu.h"
#include "ccx/render/raster.h"
#include "ccx/render/skeleton_render.h"

using namespace ccx;
using namespace ccx::animation;
using namespace ccx::render;

int main() {
    int failures = 0;
    const auto check = [&](bool ok, const char* what) {
        if (!ok) { std::printf("FAIL: %s\n", what); ++failures; }
    };
    // 骨骼：root 从 (0,0) 走到 (20,0)
    const std::string jsonText =
        "{\"bones\":[{\"name\":\"root\"}],\n"
        " \"animations\":{\"walk\":{\"bones\":{\n"
        "   \"root\":{\"translate\":[[0,0,0],[1,20,0]]}\n"
        " }}}}\n";
    Skeleton sk;
    std::string err;
    check(loadSpineSkeleton(json::parse(jsonText), sk, err), "加载");

    // 末端采样 -> 渲染项（根位置 10,10 + 20 = 30,10）
    const auto items = skeletonToRenderItems(sk, 1.0f, SkeletonRenderConfig{ 10.0f, 10.0f, 1, 1, 8.0f });
    check(items.size() == 1, "一项渲染");

    // 软件光栅帧（黄金）
    RasterTarget target(64, 64);
    target.clear(0x101020FFu);
    const RenderItem& it = items[0];
    const int px = static_cast<int>(it.pos.x), py = static_cast<int>(it.pos.y);
    const int half = 4;
    for (int y = -half; y < half; ++y) {
        for (int x = -half; x < half; ++x) {
            target.put(px + x, py + y, 0xFFFF00FFu);  // 黄块
        }
    }

    // GPU 数据面承载
    gfx::WgpuDevice dev;
    const gfx::Handle tex = dev.createTexture({ gfx::TextureDesc::Rgba8, 64, 64 });
    check(tex != gfx::kInvalidHandle, "纹理");
    check(dev.uploadTexture(tex, target.pixels.data(), target.pixels.size() * 4), "上传");
    std::vector<uint32_t> back(target.pixels.size(), 0);
    check(dev.readback(tex, back.data(), back.size() * 4), "读回");
    bool same = true;
    for (size_t i = 0; i < target.pixels.size(); ++i) {
        if (target.pixels[i] != back[i]) { same = false; break; }
    }
    check(same, "骨骼渲染帧像素一致（W1×W7 合流）");
    check(back[static_cast<size_t>(10) * 64 + 30] == 0xFFFF00FFu, "骨骼位置像素在场");

    if (failures == 0) {
        std::printf("ALL TESTS PASSED (spine on gpu)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", failures);
    return 1;
}
