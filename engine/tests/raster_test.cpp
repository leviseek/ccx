// 软件光栅测试（虚拟帧缓冲：清除/填充/重叠/旋转跳过/边界）
#include <cstdio>

#include "ccx/render/raster.h"

using namespace ccx::render;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
uint32_t rgb(uint8_t r, uint8_t g, uint8_t b) {
    return (static_cast<uint32_t>(r) << 24) | (static_cast<uint32_t>(g) << 16) |
           (static_cast<uint32_t>(b) << 8) | 0xFFu;
}
}  // namespace

int main() {
    OrthoCamera cam{-400.0f, 400.0f, -225.0f, 225.0f};
    RasterTarget target(800, 450);  // 与相机同视口
    target.clear(rgb(0, 0, 255));   // 蓝底

    // 红色 64x64 quad 于世界 (0,0)
    {
        RenderItem hero;
        hero.pos = {0.0f, 0.0f};
        hero.size = 64.0f;
        hero.tint = {1.0f, 0.0f, 0.0f, 1.0f};
        const auto pk = packItems({hero});
        rasterizeQuads(pk, target, cam);
        // 中心（400,225）为红；边界外为蓝
        check(target.get(400, 225) == rgb(255, 0, 0), "中心像素为红");
        check(target.get(368, 257) == rgb(255, 0, 0), "quad 内 (368,257) 红");
        check(target.get(400, 100) == rgb(0, 0, 255), "quad 外仍蓝");
        check(target.get(432, 193) == rgb(255, 0, 0), "右上角 (432,193) 红");
        check(target.get(433, 193) == rgb(0, 0, 255), "quad 边界外 (433,193) 蓝");
    }
    // 绿色 quad 覆盖（painter 序）：与红 quad 重叠区应为绿
    {
        RenderItem green;
        green.pos = {-10.0f, -10.0f};   // 与红 quad 部分重叠
        green.size = 64.0f;
        green.tint = {0.0f, 1.0f, 0.0f, 1.0f};
        const auto pk = packItems({green});
        rasterizeQuads(pk, target, cam);
        check(target.get(390, 215) == rgb(0, 255, 0), "重叠区被绿覆盖（painter 序）");
        // 红 quad 内、绿 quad 外 (432,206) 仍为红
        check(target.get(432, 206) == rgb(255, 0, 0), "红 quad 内、绿覆盖外保留");
        check(target.get(433, 206) == rgb(0, 0, 255), "红 quad 外恢复蓝");
    }
    // 旋转项跳过（v1）
    {
        RasterTarget t2(100, 100);
        t2.clear(rgb(0, 0, 255));
        RenderItem rot;
        rot.pos = {0.0f, 0.0f};
        rot.rotZ = 1.5707963f;
        rot.size = 32.0f;
        rot.tint = {1.0f, 0.0f, 0.0f, 1.0f};
        const auto pk = packItems({rot});
        OrthoCamera c2{-50.0f, 50.0f, -50.0f, 50.0f};
        rasterizeQuads(pk, t2, c2);
        check(t2.get(50, 50) == rgb(0, 0, 255), "旋转 quad 跳过（v1 限制）");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (raster)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
