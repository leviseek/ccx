// W1 黄金对照合流：引擎渲染面（RasterTarget）↔ GPU 数据面（WgpuDevice）全量像素对照
#include <cstdio>
#include <vector>

#include "ccx/gfx/rhi_wgpu.h"
#include "ccx/render/raster.h"

using namespace ccx;

int main() {
    int failures = 0;
    const auto check = [&](bool ok, const char* what) {
        if (!ok) { std::printf("FAIL: %s\n", what); ++failures; }
    };
    constexpr int W = 32, H = 32;

    // 1) 引擎渲染面：软件光栅真实路径（raster 模块）
    render::RasterTarget target(W, H);
    for (int y = 0; y < 8; ++y) for (int x = 0; x < 8; ++x) target.put(2 + x, 2 + y, 0xFF0000FFu);
    for (int y = 0; y < 6; ++y) for (int x = 0; x < 6; ++x) target.put(18 + x, 6 + y, 0x00FF00FFu);
    for (int y = 0; y < 4; ++y) for (int x = 0; x < 10; ++x) target.put(10 + x, 20 + y, 0x0000FFFFu);
    const std::vector<uint32_t>& golden = target.pixels;

    // 2) GPU 面：整帧上传 + 读回
    gfx::WgpuDevice dev;
    const gfx::Handle tex = dev.createTexture({ gfx::TextureDesc::Rgba8,
                                                static_cast<uint32_t>(W), static_cast<uint32_t>(H) });
    check(tex != gfx::kInvalidHandle, "合流纹理");
    check(dev.uploadTexture(tex, golden.data(), golden.size() * 4), "合流上传");
    std::vector<uint32_t> back(golden.size(), 0);
    check(dev.readback(tex, back.data(), back.size() * 4), "合流读回");
    bool same = true;
    for (size_t i = 0; i < golden.size(); ++i) {
        if (golden[i] != back[i]) { same = false; break; }
    }
    check(same, "渲染面↔GPU 面全量像素一致（黄金对照合流）");

    if (failures == 0) {
        std::printf("ALL TESTS PASSED (wgpu golden confluence)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", failures);
    return 1;
}