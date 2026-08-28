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

}  // namespace ccx::render
