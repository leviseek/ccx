#pragma once
#include <vector>

#include "ccx/animation/skeleton.h"
#include "ccx/render/packer.h"

namespace ccx::render {

// W7 骨骼 -> 渲染桥：采样骨骼姿态 -> 渲染项（每骨骼一项）
// v0.1：根位置 + 骨骼局部偏移/旋转直接映射；层级链（父骨变换）留 v0.2
struct SkeletonRenderConfig {
    float rootX = 0.0f;
    float rootY = 0.0f;
    uint32_t atlas = 1;
    uint32_t material = 1;
    float size = 16.0f;
    bool useSlotAtlas = false;  // 骨骼名匹配插槽名时用插槽附件 atlas（W7 贴图面）
};

std::vector<RenderItem> skeletonToRenderItems(const animation::Skeleton& sk, float time,
                                              const SkeletonRenderConfig& cfg);

}  // namespace ccx::render