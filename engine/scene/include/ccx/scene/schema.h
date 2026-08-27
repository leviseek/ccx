#pragma once
#include <string>

#include "ccx/foundation/serialization/json.h"
#include "ccx/scene/scene.h"

namespace ccx::scene {

// ADR-003 v1 场景文件装载/导出（引擎运行时读场景的第一步；meta 透传）
// 组件约定：ccx.Transform {position:[x,y],rotationZ,scale:[x,y]}、ccx.Sorting {layer,order}
// 装载时转为节点属性；其他组件原样存为 JSON 数据。
bool loadSceneFile(const json::Value& doc, Scene& out, std::string& err);
json::Value saveSceneFile(const Scene& in);

}  // namespace ccx::scene
