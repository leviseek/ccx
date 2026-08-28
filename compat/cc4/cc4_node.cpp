// cc4 Node façade 实现（驱动 ECS World 的变换数据）
#include "cc4_node.h"

#include "ccx/foundation/reflection/ccx_type.h"

namespace cc4 {

// fcade 变换组件（与 Creator cc.Node 语义对齐）
struct CcPosition { float x = 0.0f; float y = 0.0f; };
struct CcActive { bool active = true; };
}  // namespace cc4

// 类型注册（ECS 组件契约）：cc4::CcPosition / CcActive
namespace ccx {
template <>
inline const TypeInfo* type_info_of<cc4::CcPosition>() {
    static const TypeInfo kInfo = detail::make_type_info<cc4::CcPosition>("cc4::CcPosition", {});
    return &kInfo;
}
template <>
inline const TypeInfo* type_info_of<cc4::CcActive>() {
    static const TypeInfo kInfo = detail::make_type_info<cc4::CcActive>("cc4::CcActive", {});
    return &kInfo;
}
}  // namespace ccx

namespace cc4 {

float Node::x() const {
    if (!world_ || !world_->valid(entity_)) return 0.0f;
    if (!world_->has<CcPosition>(entity_)) return 0.0f;
    return world_->get<CcPosition>(entity_).x;
}

float Node::y() const {
    if (!world_ || !world_->valid(entity_)) return 0.0f;
    if (!world_->has<CcPosition>(entity_)) return 0.0f;
    return world_->get<CcPosition>(entity_).y;
}

void Node::setPosition(float px, float py) {
    if (!world_ || !world_->valid(entity_)) return;
    if (!world_->has<CcPosition>(entity_)) world_->add<CcPosition>(entity_);
    world_->get<CcPosition>(entity_).x = px;
    world_->get<CcPosition>(entity_).y = py;
}

bool Node::active() const {
    if (!world_ || !world_->valid(entity_)) return false;
    if (!world_->has<CcActive>(entity_)) return true;
    return world_->get<CcActive>(entity_).active;
}

void Node::setActive(bool a) {
    if (!world_ || !world_->valid(entity_)) return;
    if (!world_->has<CcActive>(entity_)) world_->add<CcActive>(entity_);
    world_->get<CcActive>(entity_).active = a;
}

}  // namespace cc4
