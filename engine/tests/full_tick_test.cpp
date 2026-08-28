// 完整帧循环集成：输入 -> 移动/动画 -> 粒子 -> 场景桥 -> 指标（一帧全链路）
#include <cmath>
#include <cstdio>

#include "ccx/animation/state_machine.h"
#include "ccx/ecs/scheduler.h"
#include "ccx/ecs/world.h"
#include "ccx/foundation/metrics.h"
#include "ccx/input/input_state.h"
#include "ccx/particle/emitter.h"
#include "ccx/scene/bridge.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::animation;
using namespace ccx::ecs;
using namespace ccx::input;
using namespace ccx::metrics;
using namespace ccx::particle;
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
    const float kDt = 0.1f;
    Scene scene;
    const EntityId hero = scene.createNode("hero");
    const EntityId enemy = scene.createNode("enemy");

    World world;
    SceneBridge bridge(world);
    bridge.syncFromScene(scene);  // 2 实体

    // 输入：按住 W 移动 hero（50 px/s）
    InputState input;
    Vec2 heroPos{0.0f, 0.0f};
    const float kSpeed = 50.0f;

    // 动画：enemy 循环摆动（pos.y 1 -> 9，1 秒）
    AnimStateMachine sm;
    Clip sway;
    sway.name = "sway";
    sway.duration = 1.0f;
    sway.tracks["pos.y"].keys = {{0.0f, 1.0f}, {1.0f, 9.0f}};
    sm.addState({"sway", sway, true});

    // 粒子：hero 处的火花发射器
    Emitter sparks(EmitterConfig{.rate = 10.0f, .lifeMin = 0.5f, .lifeMax = 0.5f}, 64);

    Scheduler sched;
    sched.add({"move", Stage::Simulation, {}, {},
               [&](World&, float dt) {
                   if (input.isDown(Key::W)) {
                       heroPos.y += kSpeed * dt;
                       scene.setLocalTransform(hero, {{heroPos.x, heroPos.y}, 0, {1, 1}});
                   }
               }});
    sched.add({"anim", Stage::Animation, {}, {},
               [&](World&, float dt) {
                   sm.update(dt);
                   const AnimState* st = sm.currentClipState();
                   LocalTransform t;
                   applyToTransform(st->clip, sm.stateTime(), st->loop, t);
                   scene.setLocalTransform(enemy, t);
               }});
    sched.add({"particles", Stage::PostAnimation, {}, {},
               [&](World&, float dt) {
                   sparks.update(dt);
                   scene.setComponent(hero, "ccx.Particles",
                                      json::parse("{\"alive\":" +
                                                  std::to_string(sparks.aliveCount()) + "}"));
               }});

    FrameMetrics metrics;
    // 前 3 帧按住 W，后 2 帧松开
    for (int frame = 1; frame <= 5; ++frame) {
        input.beginFrame();
        if (frame <= 3) input.press(Key::W);
        else input.release(Key::W);
        input.setPointer({10.0f, 10.0f}, false);
        check(sched.execute(world, kDt), "帧执行");
        bridge.syncFromScene(scene);
        metrics.recordFrame({static_cast<uint32_t>(frame), kDt * 1000.0f,
                             world.entityCount(), 0, 0, 0});
    }
    // 断言
    check(std::fabs(heroPos.y - 15.0f) < 1e-3f, "按住 W 3 帧 -> 上移 15");
    const auto heroW = scene.worldTransform(hero);
    check(std::fabs(heroW.pos.y - 15.0f) < 1e-3f, "场景 world 变换一致");
    // 粒子：rate10 x 0.5s life -> 稳态约 5（最后 0.5s 内出生）
    const json::Value* pc = scene.component(hero, "ccx.Particles");
    check(pc != nullptr, "粒子计数组件已写");
    const int pAlive = pc ? static_cast<int>(pc->find("alive")->asNumber()) : -1;
    check(pAlive >= 3 && pAlive <= 8, "粒子稳态 alive 在区间");
    // 动画：enemy y 位置 1..9 之间
    const auto enemyW = scene.worldTransform(enemy);
    check(enemyW.pos.y >= 0.9f && enemyW.pos.y <= 9.1f, "摆动在范围");
    // metrics
    check(metrics.last() != nullptr && metrics.last()->frame == 5, "metrics 5 帧");
    check(metrics.last()->entities == 2, "实体数 2");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (full tick)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
