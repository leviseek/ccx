#include "ccx/foundation/metrics.h"

namespace ccx::metrics {

void FrameMetrics::recordFrame(const FrameStats& s) {
    ring_[head_] = s;
    head_ = (head_ + 1) % kCapacity;
    if (filled_ < kCapacity) ++filled_;
    ++total_;
}

size_t FrameMetrics::size() const { return filled_; }

const FrameStats* FrameMetrics::last() const {
    if (filled_ == 0) return nullptr;
    return &ring_[(head_ + kCapacity - 1) % kCapacity];
}

json::Value FrameMetrics::snapshotJson(uint32_t count) const {
    using json::Value;
    const size_t take = count < filled_ ? count : filled_;
    const size_t start = (head_ + kCapacity - take) % kCapacity;
    Value::Array frames;
    for (size_t i = 0; i < take; ++i) {
        const FrameStats& s = ring_[(start + i) % kCapacity];
        Value::ObjectEntries f;
        f.emplace_back("frame", Value::number(s.frame));
        f.emplace_back("frameTimeMs", Value::number(s.frameTimeMs));
        f.emplace_back("entities", Value::number(static_cast<double>(s.entities)));
        f.emplace_back("batches", Value::number(static_cast<double>(s.batches)));
        f.emplace_back("drawCalls", Value::number(static_cast<double>(s.drawCalls)));
        f.emplace_back("allocBytes", Value::number(static_cast<double>(s.allocBytes)));
        frames.push_back(Value::object(std::move(f)));
    }
    return Value::array(std::move(frames));
}

}  // namespace ccx::metrics
