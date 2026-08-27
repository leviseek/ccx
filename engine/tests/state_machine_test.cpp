// 动画状态机测试（时间条件/触发器/计时重置）
#include <cstdio>
#include <string>

#include "ccx/animation/state_machine.h"

using namespace ccx::animation;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
Clip makeClip(const char* name) {
    Clip c;
    c.name = name;
    c.duration = 1.0f;
    return c;
}
}  // namespace

int main() {
    {
        // 1) 时间条件切换 + 计时重置
        AnimStateMachine m;
        m.addState({"idle", makeClip("idle"), true});
        m.addState({"walk", makeClip("walk"), true});
        m.addTransition({"idle", "walk", "time_gt:0.5", 0.2f});
        check(m.currentState() == "idle", "初始状态 idle");
        m.update(0.3f);
        check(m.currentState() == "idle", "0.3s 未到阈值");
        m.update(0.25f);  // 累计 0.55
        check(m.currentState() == "walk", "0.55s 触发切换");
        check(m.stateTime() == 0.0f, "切换后计时重置");
        check(m.currentClipState() != nullptr &&
                  m.currentClipState()->name == "walk",
              "当前 clip 是 walk");
        m.update(0.1f);
        check(m.stateTime() == 0.1f, "切换后继续计时");
    }
    {
        // 2) 触发器条件（一次性消费）
        AnimStateMachine m;
        m.addState({"idle", makeClip("idle"), true});
        m.addState({"attack", makeClip("attack"), false});
        m.addTransition({"idle", "attack", "trigger:melee", 0.0f});
        m.addTransition({"attack", "idle", "time_gt:0.4", 0.0f});
        m.update(1.0f);
        check(m.currentState() == "idle", "未触发仍 idle");
        m.trigger("melee");
        m.update(0.016f);
        check(m.currentState() == "attack", "trigger 切换");
        // 触发器一次性：不再重复触发（当前状态已是 attack，过渡条件 from=idle 不匹配）
        m.update(0.5f);
        check(m.currentState() == "idle", "attack 超时回到 idle");
        m.trigger("melee");
        m.update(0.016f);
        check(m.currentState() == "attack", "触发器可再次使用");
    }
    {
        // 3) 过渡只在本状态匹配时生效
        AnimStateMachine m;
        m.addState({"a", makeClip("a"), true});
        m.addState({"b", makeClip("b"), true});
        m.addState({"c", makeClip("c"), true});
        m.addTransition({"a", "b", "time_gt:0.1", 0.0f});
        m.addTransition({"b", "c", "time_gt:0.1", 0.0f});
        m.update(0.5f);
        check(m.currentState() == "b", "a->b 切换");
        m.update(0.2f);
        check(m.currentState() == "c", "b->c 切换");
    }
    {
        // 4) 非法目标状态被拒绝（不崩溃，状态机保持）
        AnimStateMachine m;
        m.addState({"a", makeClip("a"), true});
        m.addTransition({"a", "ghost", "immediate", 0.0f});
        m.update(1.0f);
        check(m.currentState() == "a", "非法过渡被忽略");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (state machine)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
