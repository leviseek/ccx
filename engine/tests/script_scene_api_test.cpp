// 场景命令桥正式化：JSON 命令 -> scene::Scene 数据面（脚本驱动真实场景）
#include <cstdio>
#include <string>

#include "ccx/script/scene_bridge.h"

using namespace ccx;
using namespace ccx::script;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
}  // namespace

int main() {
    scene::Scene scene;
    // 1) create_entity ×2
    const auto r1 = applySceneCommand(scene, "{\"op\":\"create_entity\",\"name\":\"hero\"}");
    (void)r1;
    check(r1.find("\"ok\":true") != std::string::npos, "create hero");
    const auto r2 = applySceneCommand(scene, "{\"op\":\"create_entity\",\"name\":\"npc\"}");
    check(r2.find("\"ok\":true") != std::string::npos, "create npc");
    check(scene.renderOrder().size() == 2, "场景 2 节点");
    // 2) add_component（真实组件数据）
    const auto rc = applySceneCommand(scene,
        "{\"op\":\"add_component\",\"id\":0,\"type\":\"game.Health\","
        "\"data\":{\"max\":100}}");
    check(rc.find("\"ok\":true") != std::string::npos, "add component");
    const json::Value* hp = scene.component(scene::EntityId{0}, "game.Health");
    check(hp != nullptr && hp->find("max")->asNumber() == 100.0, "组件数据真实在场");
    // 3) set_transform -> worldTransform 更新
    const auto rt = applySceneCommand(scene,
        "{\"op\":\"set_transform\",\"id\":0,\"position\":[30,40]}");
    check(rt.find("\"ok\":true") != std::string::npos, "set transform");
    const auto w = scene.worldTransform(scene::EntityId{0});
    check(w.pos.x == 30.0f && w.pos.y == 40.0f, "世界变换更新");
    // 4) destroy_entity
    const auto rd = applySceneCommand(scene, "{\"op\":\"destroy_entity\",\"id\":1}");
    check(rd.find("\"ok\":true") != std::string::npos, "destroy");
    check(scene.renderOrder().size() == 1, "销毁后 1 节点");
    // 5) snapshot
    const auto rs = applySceneCommand(scene, "{\"op\":\"snapshot\"}");
    check(rs.find("\"entities\":1") != std::string::npos &&
              rs.find("hero") != std::string::npos, "快照含 hero");
    // 6) 未知/错误命令
    check(applySceneCommand(scene, "{\"op\":\"nope\"}").find("\"ok\":false") != std::string::npos,
          "未知 op 拒绝");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (script scene api)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
