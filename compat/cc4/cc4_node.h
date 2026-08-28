#pragma once
// CC4 Compat 兼容层（engine-spec §8 / roadmap M5：cc4-compat 基线）
// cc.Node/cc.Component 运行时视图，底层驱动 ECS；独立发布，不进引擎核心。

#include <string>
#include <vector>

#include "ccx/ecs/world.h"

namespace cc4 {

class Node {
public:
    Node(ccx::ecs::World* world, ccx::ecs::Entity e) : world_(world), entity_(e) {}

    std::string name() const { return name_; }
    void setName(const std::string& n) { name_ = n; }
    float x() const;
    float y() const;
    void setPosition(float x, float y);
    bool active() const;
    void setActive(bool a);
    ccx::ecs::Entity entity() const { return entity_; }
    ccx::ecs::World* world() const { return world_; }
private:
    ccx::ecs::World* world_ = nullptr;
    ccx::ecs::Entity entity_{};
    std::string name_;
};

class Component {
public:
    virtual ~Component() = default;
    Node* node() { return node_; }
    virtual void onLoad() {}
    virtual void onUpdate(float dt) { (void)dt; }

protected:
    Node* node_ = nullptr;
};

}  // namespace cc4
