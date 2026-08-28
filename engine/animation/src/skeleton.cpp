#include <cmath>

#include "ccx/animation/skeleton.h"

namespace ccx::animation {

namespace {
// 线性插值（time 相邻关键帧）
BonePose lerp(const BonePose& a, const BonePose& b, float t) {
    BonePose out;
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.rotation = a.rotation + (b.rotation - a.rotation) * t;
    return out;
}
}  // namespace

std::vector<BonePose> Skeleton::sample(float t) const {
    std::vector<BonePose> out;
    out.reserve(tracks.size());
    for (const BoneTrack& tr : tracks) {
        BonePose pose;
        if (!tr.keys.empty()) {
            // 循环时间
            const float last = tr.keys.back().time;
            float tt = t;
            if (last > 0.0f) tt = std::fmod(t, last + 1.0f);
            const BoneKey* prev = &tr.keys.front();
            const BoneKey* next = &tr.keys.front();
            for (const BoneKey& k : tr.keys) {
                if (k.time <= tt) prev = &k;
                if (k.time >= tt) { next = &k; break; }
            }
            if (prev == next) {
                pose = prev->pose;
            } else {
                const float span = next->time - prev->time;
                const float f = span > 0.0f ? (tt - prev->time) / span : 0.0f;
                pose = lerp(prev->pose, next->pose, f);
            }
        }
        out.push_back(pose);
    }
    return out;
}

}  // namespace ccx::animation
