// M3 toon-2d 管线测试（renderer-spec §4）：水彩化 posterize + 描边边缘检测
#include <cstdio>

#include "ccx/render/raster.h"

using namespace ccx::render;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) { std::printf("FAIL: %s\n", what); ++g_failures; }
}
uint32_t rgb(uint8_t r, uint8_t g, uint8_t b) {
    return (static_cast<uint32_t>(r) << 24) | (static_cast<uint32_t>(g) << 16) |
           (static_cast<uint32_t>(b) << 8) | 0xFFu;
}
}  // namespace

int main() {
    // —— 1) 水彩化：posterize 到 levels 级（每通道落在量化网格）——
    {
        RasterTarget src(4, 4);
        for (uint32_t i = 0; i < src.pixels.size(); ++i) src.pixels[i] = rgb(100, 150, 200);
        RasterTarget out;
        watercolorToon(src, out, 6);
        // 6 级：q = 256/6 = 42；100->84, 150->126, 200->210（或末级 255）
        for (uint32_t p : out.pixels) {
            for (int ch = 24; ch >= 8; ch -= 8) {
                const int v = static_cast<int>((p >> ch) & 0xFF);
                const bool okv = v % 42 == 0 || v == 255;
                check(okv, "watercolor: 量化网格");
            }
        }
        check(out.pixels[0] != src.pixels[0], "watercolor: 值已改变");
    }

    // —— 2) 描边：红块在黑底上 -> 红块边缘变黑，内部保持红 ——
    {
        RasterTarget src(5, 5);
        for (uint32_t i = 0; i < src.pixels.size(); ++i) src.pixels[i] = rgb(0, 0, 0);
        for (int y = 1; y <= 3; ++y)
            for (int x = 1; x <= 3; ++x)
                src.pixels[static_cast<size_t>(y) * 5 + x] = rgb(255, 0, 0);
        RasterTarget out;
        outlineToon(src, out, 48.0f);
        check(out.get(1, 1) == 0x000000FFu, "outline: 边缘变黑");
        check(out.get(2, 2) == rgb(255, 0, 0), "outline: 内部保持红");
        check(out.get(0, 0) == 0x000000FFu, "outline: 背景黑不变");
    }

    // —— 3) toonChain 组合：尺寸不变 + 网格 + 边缘 ——
    {
        RasterTarget src(5, 5);
        for (uint32_t i = 0; i < src.pixels.size(); ++i) src.pixels[i] = rgb(0, 0, 0);
        for (int y = 1; y <= 3; ++y)
            for (int x = 1; x <= 3; ++x)
                src.pixels[static_cast<size_t>(y) * 5 + x] = rgb(200, 100, 50);
        RasterTarget out;
        toonChain(src, out, 5, 40.0f);
        check(out.width == 5 && out.height == 5, "chain: 尺寸不变");
        check(out.get(1, 1) == 0x000000FFu, "chain: 边缘黑");
        const uint32_t inner = out.get(2, 2);
        check(inner != rgb(200, 100, 50), "chain: 内部水彩化");
    }

    if (g_failures == 0) { std::printf("toon: all ok\n"); return 0; }
    std::printf("toon: %d failure(s)\n", g_failures);
    return 1;
}
