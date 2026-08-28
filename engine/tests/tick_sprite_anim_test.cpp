// 精灵帧动画接入帧循环：Scheduler 系统推进 SpriteSampler -> 场景组件写回 -> 循环回绕
#include <cstdio>
#include <string>

#include "ccx/animation/sprite_anim.h"
#include "ccx/ecs/scheduler.h"
#include "ccx/ecs/world.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::animation;
using namespace ccx::ecs;
using namespace ccx::scene;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
int readFrame(const Scene& s, EntityId id) {
    const json::Value* f = s.component(id, "ccx.SpriteFrame");
    if (!f) return -1;
    const json::Value* v = f->find("frame");
    return v ? static_cast<int>(v->asNumber()) : -1;
}
}  // namespace

int main() {
    const float kDt = 0.1f;  // 10fps tick -> 每帧推进 1 帧（clip fps=10）
    Scene scene;
    const EntityId hero = scene.createNode("hero");
    scene.setComponent(hero, "ccx.SpriteAnimator",
                       json::parse("{\"cols\":3,\"rows\":2,\"frameCount\":6,\"fps\":10}"));

    SpriteClip clip{"run", 0, 3, 2, 6, 10.0f, true};
    float animTime = 0.0f;

    World world;
    Scheduler sched;
    sched.add({"spriteAnim", Stage::PreSimulation, {}, {},
               [&](World&, float dt) {
                   // 帧首采样：用当前时间采样，再推进（游戏循环惯例）
                   SpriteSampler s(clip);
                   s.setTime(animTime);
                   scene.setComponent(hero, "ccx.SpriteFrame",
                                      json::parse("{\"frame\":" +
                                                  std::to_string(s.currentFrame()) + "}"));
                   animTime += dt;
               }});

    // 前 6 帧：帧 0..5；第 7 帧回绕到 0（循环）
    const int expected[] = {0, 1, 2, 3, 4, 5, 0, 1};
    bool allOk = true;
    for (int i = 0; i < 8; ++i) {
        check(sched.execute(world, kDt), "帧执行");
        const int f = readFrame(scene, hero);
        if (f != expected[i]) {
            std::printf("  frame[%d]=%d (期望 %d)\n", i, f, expected[i]);
            allOk = false;
        }
    }
    check(allOk, "帧序列 0..5 后回绕 0..1（循环）");

    // 非循环 clip：第 7 帧钳在末帧 5
    const float kDt2 = 0.1f;
    SpriteClip oneShot{"flash", 0, 2, 2, 4, 10.0f, false};
    float t2 = 0.0f;
    Scene scene2;
    const EntityId enemy = scene2.createNode("enemy");
    Scene* pScene = &scene2;
    EntityId pEnemy = enemy;
    Scheduler sched2;
    sched2.add({"flash", Stage::PreSimulation, {}, {},
                [&](World&, float dt) {
                    SpriteSampler s(oneShot);
                    s.setTime(t2);
                    pScene->setComponent(pEnemy, "ccx.SpriteFrame",
                                         json::parse("{\"frame\":" +
                                                     std::to_string(s.currentFrame()) + "}"));
                    t2 += dt;
                }});
    for (int i = 0; i < 7; ++i) sched2.execute(world, kDt2);
    check(readFrame(scene2, enemy) == 3, "非循环 0.7s 后钳在末帧 3");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (sprite anim in tick)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
