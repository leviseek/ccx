#pragma once
#include <string>

#include "ccx/animation/skeleton.h"
#include "ccx/foundation/serialization/json.h"

namespace ccx::animation {

// W7 Spine JSON 加载（v0.1：Spine 3.8 JSON——bones + animations[].bones[].translate/rotate）
// 返回 false + err 说明；成功填充 skeleton（每骨骼一轨，translate/rotate 合并关键帧）
bool loadSpineSkeleton(const json::Value& doc, Skeleton& out, std::string& err);

}  // namespace ccx::animation
