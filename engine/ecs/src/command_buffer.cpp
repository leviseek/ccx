#include "ccx/ecs/command_buffer.h"

namespace ccx::ecs {

Entity CommandBuffer::create() {
    const Entity e = world_.reserveEntity();
    creates_.push_back(e);
    return e;
}

void CommandBuffer::destroy(Entity e) {
    ops_.push_back({Op::Kind::Destroy, e, 0});
}

void CommandBuffer::apply() {
    // 1) 激活存活的占位实体；apply 前被 destroy 的实体记入 killed（其全部 op 一并丢弃）
    std::vector<Entity> killed;
    for (const Entity c : creates_) {
        bool isKilled = false;
        for (const Op& op : ops_) {
            if (op.kind == Op::Kind::Destroy && op.e == c) {
                isKilled = true;
                break;
            }
        }
        if (isKilled) {
            killed.push_back(c);
        } else {
            world_.activate(c);
        }
    }
    creates_.clear();
    // 2) 按序执行销毁/增删组件（跳过被 killed 占位实体的 op）
    for (const Op& op : ops_) {
        bool skip = false;
        for (const Entity k : killed) {
            if (op.e == k) {
                skip = true;
                break;
            }
        }
        if (skip) continue;
        switch (op.kind) {
            case Op::Kind::Destroy:
                world_.destroy(op.e);
                break;
            case Op::Kind::Add:
                world_.addByTypeId(op.e, op.type);
                break;
            case Op::Kind::Remove:
                world_.removeByTypeId(op.e, op.type);
                break;
        }
    }
    ops_.clear();
}

}  // namespace ccx::ecs
