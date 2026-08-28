#pragma once
#include <cstdint>
#include <queue>

namespace ccx::audio {

// 播放事件（M1 数据面：缓冲调度事件；实际解码/输出在 M2 音频 worker）
struct PlayEvent {
    uint8_t clipId = 0;
    float volume = 1.0f;   // 0..1
    bool loop = false;
    float pan = 0.0f;      // -1..1（立体声占位）
};

// 事件总线：enqueue -> poll 顺序消费；主音量钳制 [0,1]
class AudioBus {
public:
    void enqueue(PlayEvent ev);
    void setMasterVolume(float v);   // 钳制 0..1
    float masterVolume() const { return master_; }
    PlayEvent poll();                // 队首；空则返回 clipId=0 的空事件
    bool hasPending() const { return !queue_.empty(); }
    void clear();
    size_t pendingCount() const { return queue_.size(); }

private:
    std::queue<PlayEvent> queue_;
    float master_ = 1.0f;
};

}  // namespace ccx::audio
