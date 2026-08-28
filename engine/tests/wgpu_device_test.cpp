// W1 真后端测试：L1 设备/缓冲 + L2 清屏帧（真 GPU 实跑）
#include <cstdio>
#include <cstring>
#include <vector>

#include "ccx/gfx/rhi_wgpu.h"

using namespace ccx::gfx;

int main() {
    int failures = 0;
    const auto check = [&](bool ok, const char* what) {
        if (!ok) {
            std::printf("FAIL: %s\n", what);
            ++failures;
        }
    };

    WgpuDevice dev;
    // L1：缓冲创建 + upload（真 GPU 队列写）
    const Handle buf = dev.createBuffer({ BufferDesc::Uniform, 64 });
    check(buf != kInvalidHandle, "L1 createBuffer");
    const uint8_t payload[8] = { 1, 2, 3, 4, 5, 6, 7, 8 };
    check(dev.upload(buf, payload, sizeof(payload), 0), "L1 upload");
    check(dev.upload(buf, payload, 8, 60) == false, "L1 越界拒绝（60+8>64）");

    // L2：清屏 + 回读（16x16 红）
    const Handle tex = dev.createTexture({ TextureDesc::Rgba8, 16, 16 });
    check(tex != kInvalidHandle, "L2 createTexture");
    dev.beginFrame();
    dev.clear(tex, 0xFF0000FFu);  // R=255 G=0 B=0 A=255
    dev.submit();
    std::vector<uint32_t> pixels(16 * 16, 0);
    check(dev.readback(tex, pixels.data(), pixels.size() * 4), "L2 readback");
    bool allRed = true;
    for (const uint32_t p : pixels) {
        if (p != 0xFF0000FFu) { allRed = false; break; }
    }
    check(allRed, "L2 全像素纯红");

    dev.destroy(buf);
    dev.destroy(tex);

    if (failures == 0) {
        std::printf("ALL TESTS PASSED (wgpu device: L1+L2)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", failures);
    return 1;
}
