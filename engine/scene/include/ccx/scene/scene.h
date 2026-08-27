#pragma once
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "ccx/foundation/math/vec2.h"
#include "ccx/foundation/serialization/json.h"

namespace ccx::scene {

struct EntityId {
    uint32_t index = 0;
    bool operator==(const EntityId&) const = default;
};
inline bool operator<(EntityId a, EntityId b) { return a.index < b.index; }
inline constexpr EntityId kNullId{0xFFFFFFFFu};

// 组件数据 = JSON（ADR-003：编辑器/AI/CLI 同一数据视图）
struct ComponentEntry {
    std::string type;
    json::Value data;
};

struct LocalTransform {
    Vec2 pos{0.0f, 0.0f};
    float rotZ = 0.0f;
    Vec2 scale{1.0f, 1.0f};
};

struct WorldTransform {
    Vec2 pos{0.0f, 0.0f};
    float rotZ = 0.0f;
    Vec2 scale{1.0f, 1.0f};
};

struct Node {
    EntityId id;
    std::string name;
    EntityId parent = kNullId;
    std::vector<EntityId> children;  // 稳定保序（渲染顺序基础）
    std::vector<ComponentEntry> components;
    uint32_t layer = 0;      // 2D 排序（engine-spec §4）
    int32_t sortingOrder = 0;
    LocalTransform local;
};

// Prefab override（ADR-003 §4.2 三态）
struct Override {
    enum class Op : uint8_t { AddComponent, SetField, RemoveComponent, RemoveNode };
    Op op = Op::SetField;
    uint32_t entityId = 0;             // 模板实体 id
    std::string componentType;         // Add/Set/Remove 目标组件类型
    std::vector<std::string> fieldPath;  // Set：组件 data 内的 JSON 字段链
    json::Value value;                 // Add/Set 的值
};

class Scene {
public:
    EntityId createNode(std::string name, EntityId parent = kNullId);
    void setParent(EntityId id, EntityId parent);  // 重挂（父子树移除 + 新父追加）
    void destroyNode(EntityId id);  // 递归销毁子树
    std::optional<Node> node(EntityId id) const;
    EntityId parentOf(EntityId id) const;
    std::vector<EntityId> childrenOf(EntityId id) const;
    size_t nodeCount() const;

    // 组件（数据即 JSON）
    void setComponent(EntityId id, std::string type, json::Value data);
    const json::Value* component(EntityId id, const std::string& type) const;
    bool hasComponent(EntityId id, const std::string& type) const;
    void removeComponent(EntityId id, const std::string& type);

    // 2D 排序
    void setSorting(EntityId id, uint32_t layer, int32_t sortingOrder);
    void sortingOf(EntityId id, uint32_t& layer, int32_t& order) const;

    // 变换
    void setLocalTransform(EntityId id, const LocalTransform& t);
    WorldTransform worldTransform(EntityId id) const;  // 沿祖先链合成

    // Prefab 实例化：克隆模板树并应用 override（ADR-003 §4.2）
    EntityId instantiate(const Scene& templ, const std::vector<Override>& overrides,
                         EntityId parent = kNullId);
    // 渲染顺序视图：DFS 前序 + (layer, sortingOrder) 稳定排序
    std::vector<EntityId> renderOrder() const;

private:
    std::vector<Node> nodes_;
    uint32_t allocIndex_ = 0;
    uint32_t allocSlot();
    Node& at(EntityId id);
    const Node& at(EntityId id) const;
    bool slotEmpty(EntityId id) const;
    void destroyRecursive(EntityId id);
    void collectDfs(EntityId id, std::vector<EntityId>& out) const;
};

}  // namespace ccx::scene
