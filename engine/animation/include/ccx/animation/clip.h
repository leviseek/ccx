#pragma once
#include <map>
#include <string>
#include <utility>
#include <vector>

#include "ccx/scene/scene.h"

namespace ccx::animation {

// 曲线关键帧（engine-spec §1 2D 动画：曲线数据走 C++，状态机走 ECS）
enum class CurveKind : uint8_t { Step, Linear, EaseIn, EaseOut, EaseInOut };

struct Keyframe {
    float time = 0.0f;
    float value = 0.0f;
    CurveKind curve = CurveKind::Linear;
};

struct Curve {
    std::vector<Keyframe> keys;  // 按 time 升序（构造时排序）
};

struct Clip {
    std::string name;
    float duration = 1.0f;
    std::map<std::string, Curve> tracks;  // "pos.x"/"rotZ"/"pos.y"/"scale.x"...
};

// 排序并归一插值；t 由调用方归一（Sampler 处理循环/范围）
float sampleCurve(const Curve& c, float t);

// 播放采样器：t 单调推进（loop 取模），可查询任意 track
class Sampler {
public:
    explicit Sampler(Clip clip) : clip_(std::move(clip)) {}

    const Clip& clip() const { return clip_; }
    void setTime(float t, bool loop = true);   // 归一化存储
    float time() const { return t_; }
    float sample(const std::string& track) const;  // 未命中的 track 抛错（v1）

private:
    Clip clip_;
    float t_ = 0.0f;
};

// 便捷：把 clip 动画应用到场景变换（tracks: pos.x/pos.y/rotZ/scale.x/scale.y）
void applyToTransform(const Clip& clip, float t, bool loop, scene::LocalTransform& out);

}  // namespace ccx::animation
