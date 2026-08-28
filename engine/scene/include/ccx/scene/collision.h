#pragma once
#include <cstdint>
#include <map>
#include <vector>

#include "ccx/physics/body.h"
#include "ccx/physics/collision.h"
#include "ccx/scene/scene.h"

namespace ccx::scene {

// 场景碰撞集成：ccx.Collider 组件 -> Body 表（{hx,hy,layer,mask}）
std::map<uint32_t, physics::Body> collectBodies(const Scene& scene);

// 帧碰撞模拟：清网格 -> 收集组件体 -> 宽相+层窄相 -> 接触事件
std::vector<physics::ContactEvent> runCollisionSim(const Scene& scene,
                                                   physics::SpatialGrid& grid);

}  // namespace ccx::scene
