#include "ccx/animation/clip.h"

#include <algorithm>
#include <cmath>
#include <cstdio>

namespace ccx::animation {

namespace {
float ease(float k, CurveKind kind) {
    switch (kind) {
        case CurveKind::Step: return 1.0f;   // 直接跳到终点值
        case CurveKind::EaseIn: return k * k;
        case CurveKind::EaseOut: return 1.0f - (1.0f - k) * (1.0f - k);
        case CurveKind::EaseInOut:
            return k < 0.5f ? 2.0f * k * k : 1.0f - 2.0f * (1.0f - k) * (1.0f - k);
        case CurveKind::Linear:
        default: return k;
    }
}
}  // namespace

float sampleCurve(const Curve& c, float t) {
    if (c.keys.empty()) return 0.0f;
    if (t <= c.keys.front().time) return c.keys.front().value;
    if (t >= c.keys.back().time) return c.keys.back().value;
    for (size_t i = 0; i + 1 < c.keys.size(); ++i) {
        const Keyframe& a = c.keys[i];
        const Keyframe& b = c.keys[i + 1];
        if (t >= a.time && t <= b.time) {
            const float span = b.time - a.time;
            const float k = span > 0.0f ? (t - a.time) / span : 1.0f;
            const float e = ease(k, a.curve);
            return a.value + (b.value - a.value) * e;
        }
    }
    return c.keys.back().value;
}

void Sampler::setTime(float t, bool loop) {
    if (loop && clip_.duration > 0.0f) {
        t = std::fmod(t, clip_.duration);
        if (t < 0.0f) t += clip_.duration;
    } else {
        t = std::min(t, clip_.duration);
        t = std::max(0.0f, t);
    }
    t_ = t;
}

float Sampler::sample(const std::string& track) const {
    const auto it = clip_.tracks.find(track);
    if (it == clip_.tracks.end()) {
        std::fprintf(stderr, "[ccx::animation] 未知 track: %s\n", track.c_str());
        return 0.0f;
    }
    return sampleCurve(it->second, t_);
}

void applyToTransform(const Clip& clip, float t, bool loop, scene::LocalTransform& out) {
    // 只覆盖 clip 中声明的轨道；未声明的字段保持不变
    const float tt = loop ? std::fmod(t, clip.duration) : t;
    const auto find = [&](const char* name) -> const Curve* {
        const auto it = clip.tracks.find(name);
        return it != clip.tracks.end() ? &it->second : nullptr;
    };
    if (const Curve* c = find("pos.x")) out.pos.x = sampleCurve(*c, tt);
    if (const Curve* c = find("pos.y")) out.pos.y = sampleCurve(*c, tt);
    if (const Curve* c = find("rotZ")) out.rotZ = sampleCurve(*c, tt);
    if (const Curve* c = find("scale.x")) out.scale.x = sampleCurve(*c, tt);
    if (const Curve* c = find("scale.y")) out.scale.y = sampleCurve(*c, tt);
}

}  // namespace ccx::animation
