#pragma once
#include <cstdint>
#include <vector>

namespace ccx::render {

// 2D 合批（renderer-spec §5 正式化）：同键连续段合并
struct BatchKey {
    uint32_t atlas = 0;
    uint32_t material = 0;
    bool operator==(const BatchKey&) const = default;
};

struct SpriteInst {
    uint32_t atlas = 0;
    uint32_t material = 0;
};

struct Batch {
    BatchKey key;
    uint32_t first = 0;   // 实例范围（稳定输入序）
    uint32_t count = 0;
};

// 顺序合批：输入顺序即绘制顺序；同键连续段合并为一批。
// 排序（layer/sortingOrder）由上层完成后再进入本函数。
std::vector<Batch> buildBatches(const std::vector<SpriteInst>& sprites);

}  // namespace ccx::render
