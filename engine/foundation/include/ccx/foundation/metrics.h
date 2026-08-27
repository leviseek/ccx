#pragma once
#include <cstddef>
#include <cstdint>

#include "ccx/foundation/serialization/json.h"

namespace ccx::metrics {

// 每帧统计（engine-spec §3.7 性能预算的采集面；ProfilerService 的 C++ 侧骨架）
struct FrameStats {
    uint32_t frame = 0;
    float frameTimeMs = 0.0f;
    size_t entities = 0;
    size_t batches = 0;
    size_t drawCalls = 0;
    size_t allocBytes = 0;
};

// 环形缓冲（128 帧）；snapshotJson 输出最近 N 帧（ProfilerService §2 契约）
class FrameMetrics {
public:
    void recordFrame(const FrameStats& s);
    size_t size() const;                    // 已填帧数（<= 128）
    const FrameStats* last() const;
    uint32_t frameCount() const { return total_; }

    // 最近 count 帧（含当前），数组 {frame, frameTimeMs, entities, batches, drawCalls, allocBytes}
    json::Value snapshotJson(uint32_t count) const;

private:
    static constexpr size_t kCapacity = 128;
    FrameStats ring_[kCapacity];
    size_t head_ = 0;
    size_t filled_ = 0;
    uint32_t total_ = 0;
};

}  // namespace ccx::metrics
