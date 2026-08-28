// W1 L5：帧统计（上传字节/次数入 profiler 面）
#include <cstdio>
#include <vector>

#include "ccx/gfx/rhi_wgpu.h"

using namespace ccx::gfx;

int main() {
    int failures = 0;
    const auto check = [&](bool ok, const char* what) {
        if (!ok) { std::printf("FAIL: %s\n", what); ++failures; }
    };
    WgpuDevice dev;
    const Handle buf = dev.createBuffer({ BufferDesc::Vertex, 128 });
    const uint8_t d[16] = {};
    dev.upload(buf, d, 16, 0);
    dev.upload(buf, d, 8, 32);
    dev.beginFrame();
    dev.beginFrame();
    check(dev.frames() == 2, "L5 帧计数");
    check(dev.uploads() == 2, "L5 上传次数");
    check(dev.bytesUploaded() == 24, "L5 上传字节（16+8）");

    if (failures == 0) {
        std::printf("ALL TESTS PASSED (wgpu L5 frame stats)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", failures);
    return 1;
}
