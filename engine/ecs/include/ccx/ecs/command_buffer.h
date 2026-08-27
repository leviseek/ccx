#pragma once
#include <vector>

#include "ccx/ecs/entity.h"
#include "ccx/ecs/world.h"

namespace ccx::ecs {

// 延迟写入通道（engine-spec §3.5，M0 子集）：
// - create() 立即占位（reserveEntity），apply() 时激活；
// - destroy/add/remove 记录操作，apply() 按序执行；
// - 未 apply 的 buffer 可整体丢弃（占位 id 会保留，文档见 world.h）。
class CommandBuffer {
public:
    explicit CommandBuffer(World& w) : world_(w) {}

    Entity create();
    void destroy(Entity e);
    template <class T>
    void add(Entity e) {
        ops_.push_back({Op::Kind::Add, e, World::componentTypeId<T>()});
    }
    template <class T>
    void remove(Entity e) {
        ops_.push_back({Op::Kind::Remove, e, World::componentTypeId<T>()});
    }

    void apply();
    size_t size() const { return creates_.size() + ops_.size(); }

private:
    struct Op {
        enum class Kind { Destroy, Add, Remove };
        Kind kind;
        Entity e;
        TypeId type;
    };
    World& world_;
    std::vector<Entity> creates_;
    std::vector<Op> ops_;
};

}  // namespace ccx::ecs
