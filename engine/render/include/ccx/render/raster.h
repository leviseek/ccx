#pragma once
#include <cstdint>
#include <vector>

#include "ccx/render/camera.h"
#include "ccx/render/packer.h"

namespace ccx::render {

// 软件光栅（M2 前"首帧"像素验证：quad 轴对齐扫描无 GPU；旋转项 v1 跳过）
struct RasterTarget {
    uint32_t width = 0;
    uint32_t height = 0;
    std::vector<uint32_t> pixels;  // RGBA8（0xRRGGBBAA）

    RasterTarget() = default;
    RasterTarget(uint32_t w, uint32_t h) : width(w), height(h), pixels(w * h, 0) {}

    void clear(uint32_t rgba);
    void put(int x, int y, uint32_t rgba);  // 越界忽略
    uint32_t get(int x, int y) const;       // 越界返回 0
};

// 从打包结果画轴对齐 quad（painter 序：后画覆盖前画）
// rotZ != 0 的项跳过（v1 限制，M2 GPU 路径不受限）
void rasterizeQuads(const PackResult& pk, RasterTarget& target, const OrthoCamera& cam);

// 帧导出：PPM（P6 二进制，三通道）落盘 —— "看到第一帧"的最小途径
bool writePpm(const RasterTarget& target, const char* path);

// —— M3 pixel-art 管线（renderer-spec §4：整数缩放 + 最近邻采样 + 色深 dither）——
// 输入 target -> 输出 out：最近邻整数倍放大（scale >= 1），保持像素锐利
void pixelateNearest(const RasterTarget& src, RasterTarget& out, unsigned scale);

// 输入 target -> 输出 out：Bayer 4x4 ordered dithering 降到指定每通道位数（1..8）
// 例：ditherToDepth(src, out, 3) => 每通道 3 bit（8 级灰阶/色阶）
void ditherToDepth(const RasterTarget& src, RasterTarget& out, unsigned bits);

// 便捷链：pixelateNearest + ditherToDepth 一步完成（scale>=1, bits 1..8）
void pixelArtChain(const RasterTarget& src, RasterTarget& out, unsigned scale, unsigned bits);

}  // namespace ccx::render
