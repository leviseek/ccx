#include "ccx/render/skeleton_render.h"

namespace ccx::render {

std::vector<RenderItem> skeletonToRenderItems(const animation::Skeleton& sk, float time,
                                              const SkeletonRenderConfig& cfg) {
    std::vector<RenderItem> out;
    const auto poses = sk.sample(time);
    out.reserve(poses.size());
    size_t boneIdx = 0;
    for (const animation::BonePose& p : poses) {
        RenderItem item;
        item.atlas = cfg.atlas;
        if (cfg.useSlotAtlas && boneIdx < sk.tracks.size()) {
            // 骨骼名 -> 插槽名匹配（Spine 惯例：同名）
            const std::string& boneName = sk.tracks[boneIdx].name;
            for (const animation::SlotAttachment& sa : sk.slots) {
                if (sa.slot == boneName && sa.atlas > 0) {
                    item.atlas = sa.atlas;
                    break;
                }
            }
        }
        ++boneIdx;
        item.material = cfg.material;
        item.pos.x = cfg.rootX + p.x;
        item.pos.y = cfg.rootY + p.y;
        item.rotZ = p.rotation;
        item.size = cfg.size;
        out.push_back(item);
    }
    return out;
}

}  // namespace ccx::render