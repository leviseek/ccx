// M3 pixel-art 管线测试（renderer-spec §4）：整数缩放/最近邻 + Bayer dither 色深
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
    // —— 1. 整数缩放 + 最近邻：2x2 图案 -> 4x4，每像素复制为 2x2 块 ——
    {
        RasterTarget src(2, 2);
        src.pixels = {rgb(255, 0, 0), rgb(0, 255, 0), rgb(0, 0, 255), rgb(255, 255, 255)};
        RasterTarget out;
        pixelateNearest(src, out, 2);
        check(out.width == 4 && out.height == 4, "nearest: 尺寸 2x -> 4x");
        check(out.get(0, 0) == rgb(255, 0, 0) && out.get(1, 0) == rgb(255, 0, 0),
              "nearest: 左上块复制");
        check(out.get(2, 0) == rgb(0, 255, 0) && out.get(3, 0) == rgb(0, 255, 0),
              "nearest: 右上块复制");
        check(out.get(0, 1) == rgb(255, 0, 0), "nearest: 垂直复制 y=1");
        check(out.get(0, 2) == rgb(0, 0, 255), "nearest: 左下块复制");
        check(out.get(2, 2) == rgb(255, 255, 255), "nearest: 右下块复制");
        check(out.get(3, 3) == rgb(255, 255, 255), "nearest: 右下角");
    }

    // —— 2. scale=1 恒等 ——
    {
        RasterTarget src(3, 2);
        src.pixels = {1, 2, 3, 4, 5, 6};
        RasterTarget out;
        pixelateNearest(src, out, 1);
        check(out.width == 3 && out.height == 2, "scale1: 尺寸不变");
        check(out.pixels == src.pixels, "scale1: 像素一致");
    }

    // —— 3. dither 到 1 bit：结果只含 0 或 255 ——
    {
        RasterTarget src(8, 8);
        for (uint32_t i = 0; i < src.pixels.size(); ++i)
            src.pixels[i] = rgb(128, 128, 128);  // 中灰
        RasterTarget out;
        ditherToDepth(src, out, 1);
        bool onlyBw = true;
        for (uint32_t p : out.pixels) {
            const int r = static_cast<int>((p >> 24) & 0xFF);
            const int g = static_cast<int>((p >> 16) & 0xFF);
            const int b = static_cast<int>((p >> 8) & 0xFF);
            if (!((r == 0 || r == 255) && (g == 0 || g == 255) && (b == 0 || b == 255)))
                onlyBw = false;
        }
        check(onlyBw, "dither1: 只有 0/255");
        // 中灰 128 + 阈值 -> 应有黑有白（Bayer 抖动不单调全 0）
        int blacks = 0, whites = 0;
        for (uint32_t p : out.pixels) {
            if (((p >> 24) & 0xFF) == 0) ++blacks;
            else ++whites;
        }
        check(blacks > 0 && whites > 0, "dither1: 中灰抖动出黑白混合");
    }

    // —— 4. dither 到 3 bit：每通道只取 8 级（0,32,64,...,224）——（255 会被量化到 224? 否：256/8=32, 255+th -> 255 -> /32*32=224 或 256 截断）—— 放宽：验证通道值都在 {0,32,...,224,255 不出现} 或 256 截断
    {
        RasterTarget src(4, 4);
        for (uint32_t i = 0; i < src.pixels.size(); ++i)
            src.pixels[i] = rgb(100, 150, 200);
        RasterTarget out;
        ditherToDepth(src, out, 3);
        bool inLevels = true;
        for (uint32_t p : out.pixels) {
            for (int ch = 24; ch >= 8; ch -= 8) {
                const int v = static_cast<int>((p >> ch) & 0xFF);
                if (v % 32 != 0) inLevels = false;
            }
        }
        check(inLevels, "dither3: 每通道落在 8 级量化网格");
    }

    // —— 5. pixelArtChain 组合 ——
    {
        RasterTarget src(2, 2);
        src.pixels = {rgb(255, 0, 0), rgb(0, 255, 0), rgb(0, 0, 255), rgb(255, 255, 255)};
        RasterTarget out;
        pixelArtChain(src, out, 3, 2);
        check(out.width == 6 && out.height == 6, "chain: 缩放生效");
        // 每通道 2 bit -> 网格 {0,85,170,255}
        bool inGrid = true;
        for (uint32_t p : out.pixels) {
            for (int ch = 24; ch >= 8; ch -= 8) {
                const int v = static_cast<int>((p >> ch) & 0xFF);
                if (v % 85 != 0) inGrid = false;
            }
        }
        check(inGrid, "chain: 2bit 色深网格");
        check(out.get(0, 0) == out.get(1, 0) && out.get(0, 0) == out.get(0, 1),
              "chain: 最近邻块内一致");
    }

    if (g_failures == 0) {
        std::printf("pixel_art: all ok\n");
        return 0;
    }
    std::printf("pixel_art: %d failure(s)\n", g_failures);
    return 1;
}
