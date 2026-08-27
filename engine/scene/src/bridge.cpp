#include "ccx/scene/bridge.h"

namespace ccx::scene {

void SceneBridge::syncFromScene(const Scene& scene) {
    // 清理旧映射（M1 全量重建）
    for (const auto& [node, ent] : nodeToEntity_) {
        (void)node;
        world_.destroy(ent);
    }
    nodeToEntity_.clear();
    entityToNode_.clear();
    for (const EntityId id : scene.renderOrder()) {
        const auto nd = scene.node(id);
        if (!nd) continue;
        const ecs::Entity ent = world_.create();
        world_.add<BridgeTransform>(ent);
        nodeToEntity_.emplace(id, ent);
        entityToNode_.emplace(ent, id);
        syncTransform(scene, id);
    }
}

void SceneBridge::syncTransform(const Scene& scene, EntityId nodeId) {
    const auto it = nodeToEntity_.find(nodeId);
    if (it == nodeToEntity_.end()) return;
    const auto nd = scene.node(nodeId);
    if (!nd) return;
    BridgeTransform& t = world_.get<BridgeTransform>(it->second);
    t.x = nd->local.pos.x;
    t.y = nd->local.pos.y;
    t.rot = nd->local.rotZ;
    t.sx = nd->local.scale.x;
    t.sy = nd->local.scale.y;
}

std::optional<ecs::Entity> SceneBridge::entityForNode(EntityId nodeId) const {
    const auto it = nodeToEntity_.find(nodeId);
    return it != nodeToEntity_.end() ? std::optional<ecs::Entity>(it->second)
                                     : std::nullopt;
}

std::optional<EntityId> SceneBridge::nodeForEntity(ecs::Entity e) const {
    const auto it = entityToNode_.find(e);
    return it != entityToNode_.end() ? std::optional<EntityId>(it->second)
                                     : std::nullopt;
}

}  // namespace ccx::scene
