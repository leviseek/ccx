#include "ccx/audio/audio_bus.h"

#include <algorithm>

namespace ccx::audio {

void AudioBus::enqueue(PlayEvent ev) {
    ev.volume = std::clamp(ev.volume, 0.0f, 1.0f);
    queue_.push(ev);
}

void AudioBus::setMasterVolume(float v) {
    master_ = std::clamp(v, 0.0f, 1.0f);
}

PlayEvent AudioBus::poll() {
    if (queue_.empty()) return {};
    const PlayEvent ev = queue_.front();
    queue_.pop();
    return ev;
}

void AudioBus::clear() {
    while (!queue_.empty()) queue_.pop();
}

}  // namespace ccx::audio
