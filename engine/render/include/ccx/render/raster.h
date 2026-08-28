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

}  // namespace ccx::render
