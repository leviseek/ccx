// Collider 组件化：ccx.Collider 场景组件 -> Body -> 宽相+层窄相 -> 接触
#include <cstdio>
#include <map>
#include <vector>

#include "ccx/ecs/scheduler.h"
#include "ccx/ecs/world.h"
#include "ccx/physics/body.h"
#include "ccx/physics/collision.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::ecs;
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
// 从场景构建物理体表（ccx.Collider {hx,hy,layer,mask}）
std::map<uint32_t, Body> buildBodies(const Scene& scene) {
    std::map<uint32_t, Body> bodies;
    for (const EntityId id : scene.renderOrder()) {
        const json::Value* coll = scene.component(id, "ccx.Collider");
        if (!coll) continue;
        Body b;
        const float hx = coll->find("hx") ? coll->find("hx")->asNumber() : 25.0f;
        const float hy = coll->find("hy") ? coll->find("hy")->asNumber() : 25.0f;
        b.box = Aabb::fromCenter(scene.worldTransform(id).pos, {hx, hy});
        b.layer = coll->find("layer") ? static_cast<uint32_t>(coll->find("layer")->asNumber()) : 1u;
        b.mask = coll->find("mask") ? static_cast<uint32_t>(coll->find("mask")->asNumber())
                                    : 0xFFFFFFFFu;
        bodies[id.index] = b;
    }
    return bodies;
}
}  // namespace

int main() {
    Scene scene;
    const EntityId hero = scene.createNode("hero");
    scene.setComponent(hero, "ccx.Collider",
                       json::parse("{\"hx\":25,\"hy\":25,\"layer\":1,\"mask\":2}"));
    const EntityId pillar = scene.createNode("pillar");
    scene.setLocalTransform(pillar, {{100.0f, 0.0f}, 0, {1, 1}});
    scene.setComponent(pillar, "ccx.Collider",
                       json::parse("{\"hx\":25,\"hy\":25,\"layer\":2,\"mask\":3}"));

    World world;
    float heroX = 0.0f;
    Scheduler sched;
    sched.add({"move", Stage::Simulation, {}, {},
               [&](World&, float) {
                   heroX += 20.0f;
                   scene.setLocalTransform(hero, {{heroX, 0.0f}, 0, {1, 1}});
               }});

    SpatialGrid grid(32.0f, 8, 8);
    std::vector<std::pair<uint32_t, uint32_t>> seen;
    int contactFrame = 0;
    for (int f = 1; f <= 5; ++f) {
        check(sched.execute(world, 1.0f), "帧执行");
        // 物理阶段：重建网格 + 层窄相
        grid.clear();
        const auto bodies = buildBodies(scene);
        for (const auto& [id, b] : bodies) grid.insert(id, b.box);
        const auto contacts = narrowPhaseLayered(grid, bodies);
        if (!contacts.empty()) {
            seen.emplace_back(contacts[0].a, contacts[0].b);
            if (contactFrame == 0) contactFrame = f;
        }
    }
    check(contactFrame == 3, "帧3 起接触（英雄层1 掩码2 与环境层2 匹配）");
    check(!seen.empty() && seen[0] == std::make_pair(std::min(hero.index, pillar.index),
                                                     std::max(hero.index, pillar.index)),
          "接触对为 hero-pillar");

    // 层过滤用例：hero mask 改为不含环境（mask=4 仅子弹）-> 无接触
    {
        Scene scene2;
        const EntityId h2 = scene2.createNode("hero");
        scene2.setComponent(h2, "ccx.Collider",
                            json::parse("{\"hx\":25,\"hy\":25,\"layer\":1,\"mask\":4}"));
        const EntityId p2 = scene2.createNode("pillar");
        scene2.setLocalTransform(p2, {{40.0f, 0.0f}, 0, {1, 1}});
        scene2.setComponent(p2, "ccx.Collider",
                            json::parse("{\"hx\":25,\"hy\":25,\"layer\":2,\"mask\":1}"));
        SpatialGrid g2(32.0f, 4, 4);
        const auto bodies2 = buildBodies(scene2);
        for (const auto& [id, b] : bodies2) g2.insert(id, b.box);
        const auto contacts2 = narrowPhaseLayered(g2, bodies2);
        check(contacts2.empty(), "掩码不含对方层 -> 无接触（AABB 已重叠）");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (collider component)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
