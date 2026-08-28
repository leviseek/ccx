// W1 L3：黄金帧数据面（软件光栅像素 → GPU 纹理 → 读回对照）
#include <cstdio>
#include <vector>

#include "ccx/gfx/rhi_wgpu.h"

using namespace ccx::gfx;

// 软件光栅黄金精灵（8x8：红底 + 中心白块）——render_frame 同语义
static uint32_t golden( int x, int y) {
    const bool center = x >= 2 && x <= 5 && y >= 2 && y <= 5;
    return center ? 0xFFFFFFFFu : 0xFF0000FFu;
}

int main() {
    int failures = 0;
    const auto check = [&](bool ok, const char* what) {
        if (!ok) { std::printf("FAIL: %s\n", what); ++failures; }
    };
    constexpr int W = 8, H = 8;
    std::vector<uint32_t> frame(static_cast<size_t>(W) * H);
    for (int y = 0; y < H; ++y)
        for (int x = 0; x < W; ++x)
            frame[static_cast<size_t>(y) * W + x] = golden(x, y);

    WgpuDevice dev;
    const Handle tex = dev.createTexture({ TextureDesc::Rgba8,
                                           static_cast<uint32_t>(W), static_cast<uint32_t>(H) });
    check(tex != kInvalidHandle, "L3 纹理");
    check(dev.uploadTexture(tex, frame.data(), frame.size() * 4), "L3 黄金帧上传");
    std::vector<uint32_t> back(frame.size(), 0);
    check(dev.readback(tex, back.data(), back.size() * 4), "L3 读回");
    bool same = true;
    for (size_t i = 0; i < frame.size(); ++i) {
        if (frame[i] != back[i]) { same = false; break; }
    }
    check(same, "L3 黄金帧像素一致（GPU 数据面承载黄金对照）");

    if (failures == 0) {
        std::printf("ALL TESTS PASSED (wgpu L3 golden frame)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", failures);
    return 1;
}
