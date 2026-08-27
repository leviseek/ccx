#pragma once
#include <cstdint>
#include <string>

namespace ccx::animation {

// 精灵帧动画（图集网格 + 时间轴 → 帧索引/UV；renderer-spec §5 素材层，Spine 在 M2+）
struct SpriteClip {
    std::string name;
    uint32_t atlas = 0;
    uint32_t cols = 1;   // 图集网格列数
    uint32_t rows = 1;
    uint32_t frameCount = 1;  // 有效帧数（<= cols*rows，超界截断）
    float fps = 10.0f;
    bool loop = true;
};

// 归一化 UV（[0,1]；图集行序：第 0 行在顶部，v 向下增长 —— 与 spine/图集 Cook 对齐）
struct FrameUv {
    float u0 = 0.0f, v0 = 0.0f;
    float u1 = 1.0f, v1 = 1.0f;
};

class SpriteSampler {
public:
    explicit SpriteSampler(SpriteClip clip) : clip_(clip) {}

    void setTime(float t);
    uint32_t currentFrame() const;

    // 根据帧索引计算 UV（clip 网格）
    static FrameUv uvForFrame(const SpriteClip& clip, uint32_t frame);

    const SpriteClip& clip() const { return clip_; }
    float time() const { return t_; }

private:
    SpriteClip clip_;
    float t_ = 0.0f;
    uint32_t frame_ = 0;
};

}  // namespace ccx::animation
