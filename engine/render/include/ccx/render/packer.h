#pragma once
#include <cstdint>
#include <vector>

#include "ccx/foundation/math/color.h"
#include "ccx/foundation/math/vec2.h"
#include "ccx/render/batcher.h"

namespace ccx::render {

// 精灵渲染提交（CPU 侧打包；renderer-spec §5/§6 —— GPU 上传在 M2）
struct FrameUv {
    float u0 = 0.0f, v0 = 0.0f;
    float u1 = 1.0f, v1 = 1.0f;
};

// 渲染项（场景/动画/图集解析后的统一输入）
struct RenderItem {
    uint32_t atlas = 0;
    uint32_t material = 0;
    Vec2 pos{0.0f, 0.0f};
    float rotZ = 0.0f;
    Vec2 scale{1.0f, 1.0f};
    FrameUv uv;             // 精灵帧采样结果（animation::SpriteSampler 提供）
    Color tint{1.0f, 1.0f, 1.0f, 1.0f};
    float size = 1.0f;      // 基础尺寸（世界单位，默认 1）
};

struct PackedVertex {
    float x = 0.0f, y = 0.0f;
    float u = 0.0f, v = 0.0f;
    uint8_t r = 255, g = 255, b = 255, a = 255;
};

struct PackResult {
    std::vector<Batch> batches;            // 连续段（buildBatches 对齐）
    std::vector<PackedVertex> vertices;    // 每 item 4 顶点（逆时针 quad）
    std::vector<uint32_t> indices;         // 每 item 6 索引
    uint32_t vertexCount() const { return static_cast<uint32_t>(vertices.size()); }
    uint32_t indexCount() const { return static_cast<uint32_t>(indices.size()); }
};

// 打包：渲染项（已按渲染序排序）-> 批 + 顶点 + 索引
PackResult packItems(const std::vector<RenderItem>& items);

}  // namespace ccx::render
