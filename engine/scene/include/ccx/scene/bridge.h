#pragma once
#include <map>
#include <optional>

#include "ccx/ecs/entity.h"
#include "ccx/ecs/world.h"
#include "ccx/foundation/reflection/type.h"
#include "ccx/scene/scene.h"

namespace ccx::scene {

// 场景 <-> ECS 桥（ADR-002 bridge 纪律：只做映射与数值同步，无业务逻辑）
// M1：scene 树 -> ECS 实体 + BridgeTransform 数值镜像；Renderable/PhysicsBody 类桥 M2。
struct BridgeTransform {
    float x = 0.0f;
    float y = 0.0f;
    float rot = 0.0f;
    float sx = 1.0f;
    float sy = 1.0f;
};

class SceneBridge {
public:
    explicit SceneBridge(ecs::World& world) : world_(world) {}

    // 全量同步：为场景全部活动节点创建实体并镜像 Transform（M1 重建语义）
    void syncFromScene(const Scene& scene);
    // 单节点数值同步（scene -> ecs）
    void syncTransform(const Scene& scene, EntityId nodeId);
    // 双向查询
    std::optional<ecs::Entity> entityForNode(EntityId nodeId) const;
    std::optional<EntityId> nodeForEntity(ecs::Entity e) const;
    size_t count() const { return nodeToEntity_.size(); }

private:
    ecs::World& world_;
    std::map<EntityId, ecs::Entity> nodeToEntity_;
    std::map<ecs::Entity, EntityId> entityToNode_;
};

}  // namespace ccx::scene

// 反射特化放头文件：所有引用方（含测试 TU）可见同一特化。
// （CCX_TYPE 宏的标识符拼接不支持 ::，此处等价手工展开。）
namespace ccx {
template <>
inline const TypeInfo* type_info_of<scene::BridgeTransform>() {
    static const TypeInfo kInfo = detail::make_type_info<scene::BridgeTransform>(
        "scene.BridgeTransform",
        {detail::make_property(&scene::BridgeTransform::x, "x", {}),
         detail::make_property(&scene::BridgeTransform::y, "y", {}),
         detail::make_property(&scene::BridgeTransform::rot, "rot", {}),
         detail::make_property(&scene::BridgeTransform::sx, "sx", {}),
         detail::make_property(&scene::BridgeTransform::sy, "sy", {})});
    return &kInfo;
}
}  // namespace ccx
[[maybe_unused]] static const bool kCcxRegistered_BridgeTransform =
    ccx::register_type<ccx::scene::BridgeTransform>();
