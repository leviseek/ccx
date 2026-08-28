#pragma once
#include <string>

#include "ccx/scene/scene.h"

namespace ccx::script {

// 场景命令面（W5b 正式化）：JSON 命令 -> scene::Scene 数据面
// op 支持：create_entity{name,parent} / add_component{id,type,data} /
//          set_transform{id,position:[x,y]} / destroy_entity{id} / snapshot{}
std::string applySceneCommand(scene::Scene& scene, const std::string& jsonCmd);
std::string snapshotScene(const scene::Scene& scene);

}  // namespace ccx::script
