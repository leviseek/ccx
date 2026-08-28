// 脚本创作 -> 引擎消费闭环：脚本建场景 -> 保存 -> 装载 -> 渲染帧（packer 顶点）
#include <cstdio>
#include <string>
#include <vector>

#include "ccx/render/packer.h"
#include "ccx/scene/schema.h"
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
    // 1) 脚本创作场景
    scene::Scene authored;
    applySceneCommand(authored, "{\"op\":\"create_entity\",\"name\":\"hero\"}");
    applySceneCommand(authored,
        "{\"op\":\"add_component\",\"id\":0,\"type\":\"ccx.Sprite\","
        "\"data\":{\"atlas\":1,\"material\":1}}");
    applySceneCommand(authored,
        "{\"op\":\"add_component\",\"id\":0,\"type\":\"game.Health\",\"data\":{\"max\":100}}");
    applySceneCommand(authored, "{\"op\":\"create_entity\",\"name\":\"coin\"}");
    applySceneCommand(authored,
        "{\"op\":\"add_component\",\"id\":1,\"type\":\"ccx.Sprite\","
        "\"data\":{\"atlas\":2,\"material\":1}}");
    applySceneCommand(authored, "{\"op\":\"set_transform\",\"id\":0,\"position\":[50,0]}");
    check(authored.renderOrder().size() == 2, "脚本创作 2 实体");

    // 2) 保存 -> 装载（ADR-003）
    const auto saved = saveSceneFile(authored);
    scene::Scene loaded;
    std::string err;
    check(loadSceneFile(saved, loaded, err), "装载脚本产物");
    check(loaded.renderOrder().size() == 2, "装载后 2 实体");

    // 3) 引擎消费：渲染项 -> packer（同值等价性）
    const auto itemsFor = [](const scene::Scene& s) {
        std::vector<render::RenderItem> items;
        for (const scene::EntityId id : s.renderOrder()) {
            const json::Value* spr = s.component(id, "ccx.Sprite");
            if (!spr) continue;
            render::RenderItem it;
            it.atlas = static_cast<uint32_t>(spr->find("atlas")->asNumber());
            it.material = static_cast<uint32_t>(spr->find("material")->asNumber());
            it.pos = s.worldTransform(id).pos;
            it.size = 64.0f;
            items.push_back(it);
        }
        return items;
    };
    const auto pa = render::packItems(itemsFor(authored));
    const auto pl = render::packItems(itemsFor(loaded));
    check(pa.vertexCount() == 8 && pl.vertexCount() == 8, "两视图均 8 顶点");
    check(pa.batches.size() == pl.batches.size() && pa.batches.size() == 2,
          "两视图批结构一致（2 批）");
    check(pa.vertices[0].x == pl.vertices[0].x, "顶点位置一致（脚本 set_transform 生效）");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (script to frame)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
