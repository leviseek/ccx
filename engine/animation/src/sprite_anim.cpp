#include "ccx/animation/sprite_anim.h"

#include <cmath>

namespace ccx::animation {

void SpriteSampler::setTime(float t) {
    const float dur = clip_.frameCount / clip_.fps;
    if (clip_.loop && dur > 0.0f) {
        t = std::fmod(t, dur);
        if (t < 0.0f) t += dur;
    } else {
        t = t < 0.0f ? 0.0f : t;
        t = t > dur ? dur : t;
    }
    t_ = t;
    uint32_t f = static_cast<uint32_t>(t * clip_.fps);
    if (f >= clip_.frameCount) f = clip_.frameCount - 1;  // 钳制（含非循环终点）
    // 循环模式在 f==frameCount 边界回绕由 fmod 保证，此处只需钳制
    frame_ = f;
}

uint32_t SpriteSampler::currentFrame() const { return frame_; }

FrameUv SpriteSampler::uvForFrame(const SpriteClip& clip, uint32_t frame) {
    const uint32_t total = clip.cols * clip.rows;
    const uint32_t f = frame >= clip.frameCount ? clip.frameCount - 1
                                                : (frame % total);
    const uint32_t col = f % clip.cols;
    const uint32_t row = f / clip.cols;
    FrameUv uv;
    const float invCols = clip.cols > 0 ? 1.0f / static_cast<float>(clip.cols) : 0.0f;
    const float invRows = clip.rows > 0 ? 1.0f / static_cast<float>(clip.rows) : 0.0f;
    uv.u0 = static_cast<float>(col) * invCols;
    uv.u1 = static_cast<float>(col + 1) * invCols;
    uv.v0 = static_cast<float>(row) * invRows;
    uv.v1 = static_cast<float>(row + 1) * invRows;
    return uv;
}

}  // namespace ccx::animation
