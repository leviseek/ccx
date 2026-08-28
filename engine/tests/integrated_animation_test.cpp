// 动画整合：状态机选 clip -> SpriteSampler 按状态采样 -> 帧循环写回场景组件
// idle(2 帧 4fps) --time_gt:0.5--> walk(6 帧 10fps)，随机时间推进与剪辑切换
#include <cstdio>
#include <string>

#include "ccx/animation/sprite_anim.h"
#include "ccx/animation/state_machine.h"
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
    const float kDt = 0.1f;

    SpriteClip idleClip{"idle", 0, 2, 1, 2, 4.0f, true};    // 2 帧 @4fps（0.5s 周期）
    SpriteClip walkClip{"walk", 0, 3, 2, 6, 10.0f, true};   // 6 帧 @10fps

    AnimStateMachine sm;
    Clip emptyClip;  // 曲线轨（本测试不用，帧动画用 sprite 字段）
    sm.addState({"idle", emptyClip, true, idleClip});
    sm.addState({"walk", emptyClip, true, walkClip});
    sm.addTransition({"idle", "walk", "time_gt:0.5", 0.0f});
    sm.update(0.0f);

    Scene scene;
    const EntityId hero = scene.createNode("hero");
    World world;
    Scheduler sched;
    sched.add({"animSystem", Stage::PreSimulation, {}, {},
               [&](World&, float dt) {
                   sm.update(dt);   // 推进状态机（含切换）
                   const AnimState* st = sm.currentClipState();
                   SpriteSampler sam(st->sprite.value_or(SpriteClip{}));
                   sam.setTime(sm.stateTime());
                   scene.setComponent(hero, "ccx.SpriteFrame",
                                      json::parse("{\"frame\":" +
                                                  std::to_string(sam.currentFrame()) + "}"));
               }});

    // 期望：idle 段 [0,0,1,1]（t=0.1..0.4）；0.5s 切换后 walk 段 [0..5]；再回绕
    const int expected[] = {0, 0, 1, 1, 0, 1, 2, 3, 4, 5, 0};
    bool allOk = true;
    for (int i = 0; i < 11; ++i) {
        check(sched.execute(world, kDt), "帧执行");
        const int f = readFrame(scene, hero);
        if (f != expected[i]) {
            std::printf("  frame[%d]=%d (期望 %d)\n", i, f, expected[i]);
            allOk = false;
        }
    }
    check(allOk, "idle->walk 切换后帧序列正确（含回绕）");
    check(sm.currentState() == "walk", "状态机已切到 walk");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (integrated animation)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
