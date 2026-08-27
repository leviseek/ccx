// 场景 <-> ECS 桥测试（ADR-002 bridge：映射 + 数值镜像）
#include <cmath>
#include <cstdio>
#include <optional>

#include "ccx/ecs/world.h"
#include "ccx/scene/bridge.h"
#include "ccx/scene/scene.h"

using namespace ccx;

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
    ecs::World world;
    scene::Scene scene;
    const scene::EntityId root = scene.createNode("root");
    const scene::EntityId child = scene.createNode("child", root);
    const scene::EntityId leaf = scene.createNode("leaf", child);
    scene::LocalTransform t;
    t.pos = {10.0f, 5.0f};
    t.scale = {2.0f, 1.0f};
    scene.setLocalTransform(root, t);

    scene::SceneBridge bridge(world);
    bridge.syncFromScene(scene);
    check(bridge.count() == 3, "3 节点 -> 3 实体");
    const auto ent = bridge.entityForNode(root);
    check(ent.has_value(), "root 有实体");
    const auto back = bridge.nodeForEntity(*ent);
    check(back.has_value() && *back == root, "实体->节点往返");
    const scene::BridgeTransform& b = world.get<scene::BridgeTransform>(*ent);
    check(std::fabs(b.x - 10.0f) < 1e-4f && std::fabs(b.y - 5.0f) < 1e-4f,
          "Transform 数值镜像");
    check(std::fabs(b.sx - 2.0f) < 1e-4f, "scale 镜像");

    // 更新场景变换 -> 单点同步
    t.pos = {0.0f, 0.0f};
    t.rotZ = 1.5f;
    scene.setLocalTransform(root, t);
    bridge.syncTransform(scene, root);
    check(std::fabs(world.get<scene::BridgeTransform>(*ent).rot - 1.5f) < 1e-4f,
          "单点同步生效");

    // 全量重建：旧实体失效，新实体生效
    const ecs::Entity oldEnt = *ent;
    bridge.syncFromScene(scene);
    check(!world.valid(oldEnt), "重建后旧实体失效");
    check(bridge.count() == 3, "重建后数量一致");
    const auto ent2 = bridge.entityForNode(root);
    check(ent2.has_value() && *ent2 != oldEnt, "root 绑定新实体");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (scene bridge)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
