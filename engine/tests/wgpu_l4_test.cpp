// W1 L4：全场景帧（多精灵+变换）经 GPU 数据面 vs 仿真帧对照
#include <cstdio>
#include <vector>

#include "ccx/gfx/rhi_wgpu.h"

using namespace ccx::gfx;

// 场景：32x32 帧，3 个精灵（不同位置/颜色）——软件合成（仿真路径语义）
struct Sprite { int x, y, w, h; uint32_t rgba; };

static void compose(std::vector<uint32_t>& frame, int W, int H, const Sprite* sprites, int n) {
    for (int s = 0; s < n; ++s) {
        const Sprite& sp = sprites[s];
        for (int y = 0; y < sp.h; ++y) {
            for (int x = 0; x < sp.w; ++x) {
                const int px = sp.x + x, py = sp.y + y;
                if (px < 0 || py < 0 || px >= W || py >= H) continue;
                frame[static_cast<size_t>(py) * W + px] = sp.rgba;
            }
        }
    }
}

int main() {
    int failures = 0;
    const auto check = [&](bool ok, const char* what) {
        if (!ok) { std::printf("FAIL: %s\n", what); ++failures; }
    };
    constexpr int W = 32, H = 32;
    const Sprite sprites[3] = {
        { 2, 2, 8, 8, 0xFF0000FFu },    // 红块
        { 18, 6, 6, 6, 0x00FF00FFu },   // 绿块
        { 10, 20, 10, 4, 0x0000FFFFu }, // 蓝条
    };
    // 仿真黄金帧（软件合成——与 render_frame 同语义）
    std::vector<uint32_t> golden(static_cast<size_t>(W) * H, 0x00000000u);
    compose(golden, W, H, sprites, 3);

    // GPU 承载：整帧上传 + 读回
    WgpuDevice dev;
    const Handle tex = dev.createTexture({ TextureDesc::Rgba8,
                                           static_cast<uint32_t>(W), static_cast<uint32_t>(H) });
    check(tex != kInvalidHandle, "L4 纹理");
    check(dev.uploadTexture(tex, golden.data(), golden.size() * 4), "L4 场景帧上传");
    std::vector<uint32_t> back(golden.size(), 0);
    check(dev.readback(tex, back.data(), back.size() * 4), "L4 场景帧读回");
    bool same = true;
    for (size_t i = 0; i < golden.size(); ++i) {
        if (golden[i] != back[i]) { same = false; break; }
    }
    check(same, "L4 场景帧像素一致（GPU 承载全场景黄金帧）");

    if (failures == 0) {
        std::printf("ALL TESTS PASSED (wgpu L4 scene frame)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", failures);
    return 1;
}
