#include "ccx/scene/collision.h"

namespace ccx::scene {

std::map<uint32_t, physics::Body> collectBodies(const Scene& scene) {
    std::map<uint32_t, physics::Body> bodies;
    for (const EntityId id : scene.renderOrder()) {
        const json::Value* coll = scene.component(id, "ccx.Collider");
        if (!coll) continue;
        physics::Body b;
        const float hx = coll->find("hx")
            ? static_cast<float>(coll->find("hx")->asNumber()) : 25.0f;
        const float hy = coll->find("hy")
            ? static_cast<float>(coll->find("hy")->asNumber()) : 25.0f;
        b.box = physics::Aabb::fromCenter(scene.worldTransform(id).pos, {hx, hy});
        b.layer = coll->find("layer") ? static_cast<uint32_t>(coll->find("layer")->asNumber()) : 1u;
        b.mask = coll->find("mask") ? static_cast<uint32_t>(coll->find("mask")->asNumber())
                                    : 0xFFFFFFFFu;
        bodies[id.index] = b;
    }
    return bodies;
}

std::vector<physics::ContactEvent> runCollisionSim(const Scene& scene,
                                                   physics::SpatialGrid& grid) {
    grid.clear();
    const auto bodies = collectBodies(scene);
    for (const auto& [id, b] : bodies) grid.insert(id, b.box);
    return physics::narrowPhaseLayered(grid, bodies);
}

}  // namespace ccx::scene
