// Collider 组件 ADR-003 往返：文件 -> collectBodies -> 保存 -> 重载 -> bodies 一致
#include <cstdio>
#include <string>

#include "ccx/physics/collision.h"
#include "ccx/scene/collision.h"
#include "ccx/scene/schema.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::physics;
using namespace ccx::scene;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
bool near(float a, float b) { return a == b; }  // 数值原样往返
}  // namespace

int main() {
    const auto doc = json::parse(
        "{\"schema\":\"ccx.scene/1\",\"meta\":{},\"systems\":[],"
        "\"entities\":["
        "{\"id\":1,\"name\":\"hero\",\"parent\":null,\"components\":["
        "{\"type\":\"ccx.Transform\",\"data\":{\"position\":[10,5],\"rotationZ\":0,\"scale\":[1,1]}},"
        "{\"type\":\"ccx.Collider\",\"data\":{\"hx\":25,\"hy\":20,\"layer\":1,\"mask\":2}}]},"
        "{\"id\":2,\"name\":\"pillar\",\"parent\":null,\"components\":["
        "{\"type\":\"ccx.Transform\",\"data\":{\"position\":[80,0],\"rotationZ\":0,\"scale\":[1,1]}},"
        "{\"type\":\"ccx.Collider\",\"data\":{\"hx\":30,\"hy\":30,\"layer\":2,\"mask\":3}}]}]}");
    std::string err;
    Scene scene;
    check(loadSceneFile(doc, scene, err), "首次装载");
    const auto bodies1 = collectBodies(scene);
    check(bodies1.size() == 2, "2 个物理体");
    // 接触（世界 10+25=35 >= 80-30=50? 不重叠；验证时用精确场景）
    SpatialGrid grid1(32, 8, 8);
    const auto contacts1 = runCollisionSim(scene, grid1);
    check(contacts1.empty(), "初始不接触");

    // 保存 -> 重载 -> 重建
    const auto saved = saveSceneFile(scene);
    Scene scene2;
    check(loadSceneFile(saved, scene2, err), "重载");
    const auto bodies2 = collectBodies(scene2);
    check(bodies2.size() == 2, "重载后仍 2 体");
    const auto it1 = bodies1.find(1);
    const auto it2 = bodies2.find(1);
    check(it1 != bodies1.end() && it2 != bodies2.end(), "hero 体存在");
    if (it1 != bodies1.end() && it2 != bodies2.end()) {
        check(it1->second.box.min.x == it2->second.box.min.x &&
              it1->second.box.max.x == it2->second.box.max.x &&
              it1->second.box.min.y == it2->second.box.min.y &&
              it1->second.box.max.y == it2->second.box.max.y &&
              it1->second.layer == it2->second.layer &&
              it1->second.mask == it2->second.mask,
          "hero 体字段一致（位置/尺寸/层/掩码）");
    }
    // 移动 hero 到重叠 -> 接触（验证物理数据来自文件）
    for (const EntityId id2 : scene2.renderOrder()) {
        if (scene2.node(id2)->name == "hero") {
            scene2.setLocalTransform(id2, {{60.0f, 0.0f}, 0, {1, 1}});
            break;
        }
    }
    SpatialGrid grid2(32, 8, 8);
    const auto contacts2 = runCollisionSim(scene2, grid2);
    check(contacts2.size() == 1, "移动后接触（数据来自文件->物理体）");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (collider roundtrip)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
