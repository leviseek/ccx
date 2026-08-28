#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace ccx::animation {

// W7 Spine 桥数据面（v0.1）：骨架骨骼列表 + 关键帧姿态插值。
// Spine JSON 解析在桥接层（M2）；本模块为引擎侧数据面（采样/姿态）。
struct BonePose {
    float x = 0.0f;
    float y = 0.0f;
    float rotation = 0.0f;  // 度
};

struct BoneKey {
    float time = 0.0f;
    BonePose pose;
};

struct BoneTrack {
    std::string name;
    std::vector<BoneKey> keys;
};

// 插槽附件（Spine skins -> region attachment -> atlas）
struct SlotAttachment {
    std::string slot;
    std::string attachment;  // region 名（可空 = 无附件）
    uint32_t atlas = 0;      // 渲染消费用（v0.1：附件名哈希 → atlas 占位）
};

struct Skeleton {
    std::vector<BoneTrack> tracks;
    std::vector<SlotAttachment> slots;
    // 采样：t 时刻各骨骼姿态（t 越界循环；无 track 骨骼返回零姿态）
    std::vector<BonePose> sample(float t) const;
    // 骨骼姿态 -> 渲染消费（根位置 + 局部旋转的近似层级：v0.1 仅根骨）
    size_t boneCount() const { return tracks.size(); }
};

}  // namespace ccx::animation