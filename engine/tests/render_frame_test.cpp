// 渲染帧全链：GameLoop 固定步驱动 Scheduler -> 渲染项收集（含动画 UV）-> packer 缓冲
#include <cstdio>
#include <vector>

#include "ccx/animation/sprite_anim.h"
#include "ccx/ecs/scheduler.h"
#include "ccx/ecs/world.h"
#include "ccx/foundation/metrics.h"
#include "ccx/game/game_loop.h"
#include "ccx/render/packer.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::animation;
using namespace ccx::ecs;
using namespace ccx::game;
using namespace ccx::metrics;
using namespace ccx::render;
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
    const float kRenderDt = 0.1f;   // 10fps 渲染
    Scene scene;
    const EntityId hero = scene.createNode("hero");
    scene.setComponent(hero, "ccx.Sprite", json::parse("{\"atlas\":1,\"material\":1}"));
    const EntityId coin = scene.createNode("coin");
    scene.setComponent(coin, "ccx.Sprite", json::parse("{\"atlas\":1,\"material\":1}"));

    World world;

    // 固定步：英雄沿 x 前进（每 fixed 步 +1）
    float heroX = 0.0f;
    Scheduler sched;
    sched.add({"march", Stage::Simulation, {}, {},
               [&](World&, float) {
                   heroX += 1.0f;
                   scene.setLocalTransform(hero, {{heroX, 0.0f}, 0, {1, 1}});
               }});

    // 精灵动画：跑动 clip 6 帧 10fps
    SpriteClip run{"run", 0, 3, 2, 6, 10.0f, true};

    GameLoop loop({0.05f, 4});  // 20fps 固定步
    FrameMetrics metrics;
    float firstHeroX = 0.0f;
    float firstU0 = -1.0f;

    for (int rf = 1; rf <= 3; ++rf) {
        // 渲染帧：分派固定步（0.1/0.05 -> 2 步）
        const uint32_t steps = loop.step(kRenderDt,
                                         [&](float dt) { (void)dt; sched.execute(world, 0.05f); });
        // 渲染项收集
        std::vector<RenderItem> items;
        SpriteSampler sam(run);
        sam.setTime(static_cast<float>(loop.frameCount()) * 0.0166667f * 60.0f / 10.0f);  // 简化时间
        const render::FrameUv uv{sam.currentFrame() * 0.1f, 0.0f,
                                  (sam.currentFrame() + 1) * 0.1f, 1.0f};
        for (const EntityId id : scene.renderOrder()) {
            const auto nd = scene.node(id);
            if (!nd) continue;
            const json::Value* spr = scene.component(id, "ccx.Sprite");
            if (!spr) continue;
            RenderItem it;
            it.atlas = static_cast<uint32_t>(spr->find("atlas")->asNumber());
            it.material = static_cast<uint32_t>(spr->find("material")->asNumber());
            it.pos = scene.worldTransform(id).pos;
            it.rotZ = scene.worldTransform(id).rotZ;
            it.uv = uv;
            items.push_back(it);
        }
        const auto pk = packItems(items);
        check(pk.vertexCount() == 8 && pk.indexCount() == 12, "2 精灵 -> 8 顶点 12 索引");
        check(steps == 2, "0.1/0.05 -> 每次 2 固定步");
        if (rf == 1) {
            firstHeroX = scene.worldTransform(hero).pos.x;
            firstU0 = pk.vertices[0].u;
        }
        metrics.recordFrame({static_cast<uint32_t>(rf), kRenderDt * 1000.0f,
                             world.entityCount(),
                             pk.batches.size(),           // batches
                             pk.batches.size(),           // drawCalls（合批后=批次）
                             pk.vertexCount() * sizeof(PackedVertex)});  // allocBytes
    }
    check(loop.frameCount() == 3, "3 渲染帧");
    const float heroXNow = scene.worldTransform(hero).pos.x;
    check(heroXNow > firstHeroX,
          ("固定步推进使英雄前进（" + std::to_string(firstHeroX) + " -> " +
           std::to_string(heroXNow) + "）").c_str());
    check(loop.frameCount() == metrics.last()->frame, "metrics 与渲染帧同步");
    check(metrics.last()->drawCalls == 1, "合批后 1 draw（2 精灵同键）");
    check(metrics.last()->allocBytes == 8 * (uint32_t)sizeof(PackedVertex),
          "metrics 记录顶点字节");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (render frame)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
