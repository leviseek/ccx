// E2E：动画 -> 场景 -> 渲染计划（状态机/时间采样 -> 变换 -> 批结构稳定）
#include <cmath>
#include <cstdio>
#include <string>

#include "ccx/animation/state_machine.h"
#include "ccx/render/batcher.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::animation;
using namespace ccx::scene;
using namespace ccx::render;

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
    Scene scene;
    const EntityId hero = scene.createNode("hero");
    scene.setComponent(hero, "ccx.Sprite", json::parse("{\"atlas\":1,\"material\":1}"));
    const EntityId coin = scene.createNode("coin");
    scene.setComponent(coin, "ccx.Sprite", json::parse("{\"atlas\":2,\"material\":1}"));

    // 动画：hero 沿 x 移动（pos.x 0 -> 12）
    Clip clip;
    clip.name = "hero_march";
    clip.duration = 2.0f;
    clip.tracks["pos.x"].keys = {{0.0f, 0.0f}, {2.0f, 12.0f}};
    AnimStateMachine m;
    m.addState({"marching", clip, true});
    check(m.currentState() == "marching", "状态机就绪");

    const auto plan = [&]() -> std::vector<SpriteInst> {
        std::vector<SpriteInst> out;
        for (const EntityId id : scene.renderOrder()) {
            const json::Value* spr = scene.component(id, "ccx.Sprite");
            if (spr) {
                out.push_back({static_cast<uint32_t>(spr->find("atlas")->asNumber()),
                               static_cast<uint32_t>(spr->find("material")->asNumber())});
            }
        }
        return out;
    };

    // t=0：发射器把状态机时间应用到 hero 变换
    m.update(0.0f);
    {
        const AnimState* st = m.currentClipState();
        LocalTransform t;
        applyToTransform(st->clip, m.stateTime(), st->loop, t);
        scene.setLocalTransform(hero, t);
        const auto w = scene.worldTransform(hero);
        check(std::fabs(w.pos.x) < 1e-4f, "t=0 hero 在原点");
    }
    // 推进 1 秒 -> 中点 x=6
    m.update(1.0f);
    {
        const AnimState* st = m.currentClipState();
        LocalTransform t;
        applyToTransform(st->clip, m.stateTime(), st->loop, t);
        scene.setLocalTransform(hero, t);
        check(std::fabs(scene.worldTransform(hero).pos.x - 6.0f) < 1e-3f,
              "t=1 hero 在中点 x=6");
    }
    // 再推进 1 秒 = 一整周期 -> 循环回绕回原点
    m.update(1.0f);
    {
        const AnimState* st = m.currentClipState();
        LocalTransform t;
        applyToTransform(st->clip, m.stateTime(), st->loop, t);
        scene.setLocalTransform(hero, t);
        check(std::fabs(scene.worldTransform(hero).pos.x) < 1e-4f,
              "t=2 整周期回绕回原点（循环语义）");
    }
    // 渲染计划批结构不变（动画不影响合批）
    const auto batches = buildBatches(plan());
    check(batches.size() == 2, "两个精灵 = 2 批（不同图集）");
    check(batches[0].key.atlas == 1 && batches[1].key.atlas == 2, "批键正确");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (anim -> scene -> plan)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
