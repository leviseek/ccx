#include "ccx/render/raster.h"

#include <algorithm>
#include <cmath>
#include <cstdio>

namespace ccx::render {

void RasterTarget::clear(uint32_t rgba) {
    std::fill(pixels.begin(), pixels.end(), rgba);
}

void RasterTarget::put(int x, int y, uint32_t rgba) {
    if (x < 0 || y < 0 || x >= static_cast<int>(width) || y >= static_cast<int>(height)) return;
    pixels[static_cast<size_t>(y) * width + static_cast<size_t>(x)] = rgba;
}

uint32_t RasterTarget::get(int x, int y) const {
    if (x < 0 || y < 0 || x >= static_cast<int>(width) || y >= static_cast<int>(height)) return 0;
    return pixels[static_cast<size_t>(y) * width + static_cast<size_t>(x)];
}

void rasterizeQuads(const PackResult& pk, RasterTarget& target, const OrthoCamera& cam) {
    const Vec2 vp{static_cast<float>(target.width), static_cast<float>(target.height)};
    const size_t itemCount = pk.vertices.size() / 4;
    for (size_t i = 0; i < itemCount; ++i) {
        // 顶点 0/1/2：局部三点求旋转（v1 轴对齐，rotZ 检查用 1 号顶点的世界方向）
        const PackedVertex& v1 = pk.vertices[i * 4 + 1];
        const PackedVertex& v0 = pk.vertices[i * 4 + 0];
        const float r0 = std::fabs(std::atan2(v1.y - v0.y, v1.x - v0.x));
        const bool rotated = r0 > 0.01f;  // 水平边不再水平 -> 跳过
        if (rotated) continue;
        // 世界包围盒 -> 屏幕包围盒（y 翻转）
        const PackedVertex& v2 = pk.vertices[i * 4 + 2];
        const Vec2 s0 = cam.worldToScreen({v0.x, v0.y}, vp);
        const Vec2 s2 = cam.worldToScreen({v2.x, v2.y}, vp);
        // 定界用 floor(最大值)：浮点边界（如 432.00003）不产生多画格
        const int x0 = static_cast<int>(std::floor(std::min(s0.x, s2.x)));
        const int x1 = static_cast<int>(std::floor(std::max(s0.x, s2.x)));
        const int y0 = static_cast<int>(std::floor(std::min(s0.y, s2.y)));
        const int y1 = static_cast<int>(std::floor(std::max(s0.y, s2.y)));
        const uint32_t rgba = (static_cast<uint32_t>(v0.r) << 24) |
                              (static_cast<uint32_t>(v0.g) << 16) |
                              (static_cast<uint32_t>(v0.b) << 8) |
                              static_cast<uint32_t>(v0.a);
        for (int y = y0; y <= y1; ++y) {
            for (int x = x0; x <= x1; ++x) {
                target.put(x, y, rgba);
            }
        }
    }
}

bool writePpm(const RasterTarget& target, const char* path) {
    FILE* f = std::fopen(path, "wb");
    if (!f) return false;
    std::fprintf(f, "P6\n%d %d\n255\n", target.width, target.height);
    for (uint32_t p : target.pixels) {
        const unsigned char rgb[3] = {
            static_cast<unsigned char>((p >> 24) & 0xFF),
            static_cast<unsigned char>((p >> 16) & 0xFF),
            static_cast<unsigned char>((p >> 8) & 0xFF),
        };
        std::fwrite(rgb, 1, 3, f);
    }
    std::fclose(f);
    return true;
}

// —— M3 pixel-art 管线：整数缩放（最近邻）——
void pixelateNearest(const RasterTarget& src, RasterTarget& out, unsigned scale) {
    if (scale == 0) scale = 1;
    out = RasterTarget(src.width * scale, src.height * scale);
    for (uint32_t y = 0; y < out.height; ++y) {
        const uint32_t sy = y / scale;
        for (uint32_t x = 0; x < out.width; ++x) {
            out.pixels[y * out.width + x] = src.pixels[sy * src.width + x / scale];
        }
    }
}

// —— M3 pixel-art 管线：Bayer 4x4 ordered dithering（色深量化）——
namespace {
// 4x4 Bayer 矩阵（0..15），除 16 归一
constexpr int kBayer4[4][4] = {
    {0, 8, 2, 10},
    {12, 4, 14, 6},
    {3, 11, 1, 9},
    {15, 7, 13, 5},
};
}  // namespace

void ditherToDepth(const RasterTarget& src, RasterTarget& out, unsigned bits) {
    if (bits == 0 || bits > 8) bits = 8;
    out = src;  // 尺寸不变，拷贝像素
    const int levels = 1 << bits;              // 每通道量化级数
    const int q = 256 / levels;                // 量化步长（末级归一到 255）
    for (uint32_t y = 0; y < out.height; ++y) {
        for (uint32_t x = 0; x < out.width; ++x) {
            const uint32_t p = out.pixels[y * out.width + x];
            const int bayer = kBayer4[y % 4][x % 4];
            // 归一化 Bayer 抖动：c -> [0, levels) 连续值，Bayer 阈值比较小数部分进位
            const double th = static_cast<double>(bayer) / 16.0;  // 0..0.9375
            auto quant = [q, levels, th](int c) -> int {
                const double f = static_cast<double>(c) * (levels - 1) / 255.0;
                int idx = static_cast<int>(f);
                if (f - static_cast<double>(idx) > th) ++idx;
                if (idx < 0) idx = 0;
                if (idx >= levels) idx = levels - 1;
                return idx == levels - 1 ? 255 : idx * q;
            };
            const int r = quant(static_cast<int>((p >> 24) & 0xFF));
            const int g = quant(static_cast<int>((p >> 16) & 0xFF));
            const int b = quant(static_cast<int>((p >> 8) & 0xFF));
            out.pixels[y * out.width + x] = (static_cast<uint32_t>(r) << 24) |
                                             (static_cast<uint32_t>(g) << 16) |
                                             (static_cast<uint32_t>(b) << 8) |
                                             (p & 0xFFu);
        }
    }
}

void pixelArtChain(const RasterTarget& src, RasterTarget& out, unsigned scale, unsigned bits) {
    RasterTarget scaled;
    pixelateNearest(src, scaled, scale);
    ditherToDepth(scaled, out, bits);
}

}  // namespace ccx::render
