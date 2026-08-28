#include "ccx/render/skeleton_render.h"

namespace ccx::render {

std::vector<RenderItem> skeletonToRenderItems(const animation::Skeleton& sk, float time,
                                              const SkeletonRenderConfig& cfg) {
    std::vector<RenderItem> out;
    const auto poses = sk.sample(time);
    out.reserve(poses.size());
    for (const animation::BonePose& p : poses) {
        RenderItem item;
        item.atlas = cfg.atlas;
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
