// 接触驱动组合：碰撞（宽相+窄相）-> 场景组件 ccx.Contact + 新接触触发音效（AudioBus）
#include <algorithm>
#include <cstdio>
#include <map>

#include "ccx/audio/audio_bus.h"
#include "ccx/ecs/scheduler.h"
#include "ccx/ecs/world.h"
#include "ccx/physics/collision.h"
#include "ccx/scene/collision.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::audio;
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
}  // namespace

int main() {
    constexpr float kHalf = 25.0f;
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
    AudioBus audio;
    SpatialGrid grid(32.0f, 8, 8);
    std::vector<std::pair<uint32_t, uint32_t>> prevContacts;

    Scheduler sched;
    sched.add({"move", Stage::Simulation, {}, {},
               [&](World&, float) {
                   heroX += 20.0f;
                   scene.setLocalTransform(hero, {{heroX, 0.0f}, 0, {1, 1}});
               }});
    sched.add({"collision", Stage::PostAnimation, {}, {},
               [&](World&, float) {
                   // 正式碰撞系统：组件体 -> 宽相 + 层窄相
                   const auto contacts = runCollisionSim(scene, grid);
                   // 场景组件暴露 + 新接触触发音效
                   for (const ContactEvent& c : contacts) {
                       scene.setComponent(hero, "ccx.Contact",
                                          json::parse("{\"partner\":" +
                                                      std::to_string(c.b) + ",\"frame\":1}"));
                       const bool isNew =
                           std::find(prevContacts.begin(), prevContacts.end(),
                                     std::make_pair(c.a, c.b)) == prevContacts.end();
                       if (isNew) audio.enqueue({1, 0.8f, false, 0.0f});  // 碰撞音
                   }
                   prevContacts.clear();
                   for (const ContactEvent& c : contacts) {
                       prevContacts.emplace_back(c.a, c.b);
                   }
               }});

    int contactFrame = 0;
    int soundFrames = 0;
    for (int f = 1; f <= 5; ++f) {
        check(sched.execute(world, 1.0f), "帧执行");
        const json::Value* contact = scene.component(hero, "ccx.Contact");
        if (contact != nullptr && contactFrame == 0) contactFrame = f;
        if (audio.pendingCount() > 0) {
            ++soundFrames;
            audio.poll();  // 消费（每帧一次）
        }
    }
    check(contactFrame == 3, "帧3 起接触组件在场");
    check(soundFrames == 1, "音效只在首次接触帧触发一次");
    const json::Value* c = scene.component(hero, "ccx.Contact");
    check(c != nullptr, "接触组件已写");
    if (c != nullptr) {
        check(static_cast<int>(c->find("partner")->asNumber()) == pillar.index,
              "接触伴侣为 pillar");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (contact driven)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
