// 帧循环组装：Scheduler(Animation) -> Scene 变换 -> SceneBridge 同步 -> FrameMetrics 记录
// M1 运行时"一帧"路径的最小集成（GPU 提交在 M2）
#include <cmath>
#include <cstdio>

#include "ccx/animation/clip.h"
#include "ccx/ecs/scheduler.h"
#include "ccx/ecs/world.h"
#include "ccx/foundation/metrics.h"
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
    const float kDt = 0.1f;  // 10fps 帧间隔

    scene::Scene scene;
    const scene::EntityId hero = scene.createNode("hero");
    scene::EntityId coin = scene.createNode("coin");
    (void)coin;
    scene.setLocalTransform(hero, {{0, 0}, 0, {1, 1}});

    ecs::World world;
    scene::SceneBridge bridge(world);
    bridge.syncFromScene(scene);  // hero + coin -> 2 实体

    // 动画 clip：hero.pos.x 0 -> 10（1 秒）
    animation::Clip clip;
    clip.name = "march";
    clip.duration = 1.0f;
    clip.tracks["pos.x"].keys = {{0.0f, 0.0f}, {1.0f, 10.0f}};
    float animT = 0.0f;

    ecs::Scheduler sched;
    sched.add({"anim", ecs::Stage::Animation, {}, {},
               [&](ecs::World&, float dt) {
                   animT += dt;
                   scene::LocalTransform lt;
                   animation::applyToTransform(clip, animT, true, lt);
                   scene.setLocalTransform(hero, lt);
               }});

    metrics::FrameMetrics metrics;
    // 3 帧：scheduler -> bridge 同步 -> metrics 记录
    for (uint32_t f = 1; f <= 3; ++f) {
        check(sched.execute(world, kDt), "帧执行成功");
        bridge.syncFromScene(scene);
        metrics.recordFrame({f, kDt * 1000.0f, world.entityCount(), 0, 0, 0});
    }
    check(metrics.last() != nullptr && metrics.last()->frame == 3, "metrics 记录 3 帧");
    check(metrics.last()->entities == 2, "实体数 = 2（hero+coin）");
    const auto w = scene.worldTransform(hero);
    check(std::fabs(w.pos.x - 3.0f) < 1e-3f, "0.3s 后 hero 位于 x=3（线性插值）");
    // bridge 数值与场景一致（同步生效）
    const auto ent = bridge.entityForNode(hero);
    check(ent.has_value(), "hero 有实体");
    check(std::fabs(world.get<scene::BridgeTransform>(*ent).x - 3.0f) < 1e-3f,
          "ECS 镜像与场景一致");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (frame tick)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
