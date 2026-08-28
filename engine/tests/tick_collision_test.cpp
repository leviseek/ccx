// 碰撞宽相接入帧循环：每帧重建 SpatialGrid -> 移动 hero 与障碍接近时产生候选对
#include <cstdio>

#include "ccx/ecs/scheduler.h"
#include "ccx/ecs/world.h"
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
// 帧内宽相：重建网格并产出候选对
std::vector<std::pair<uint32_t, uint32_t>> broadphase(const Scene& scene, SpatialGrid& grid,
                                                      float halfSize) {
    grid.clear();
    for (const EntityId id : scene.renderOrder()) {
        const auto p = scene.worldTransform(id).pos;
        grid.insert(id.index, Aabb::fromCenter(p, {halfSize, halfSize}));
    }
    return grid.pairs();
}
}  // namespace

int main() {
    Scene scene;
    const EntityId hero = scene.createNode("hero");
    const EntityId pillar = scene.createNode("pillar");
    scene.setLocalTransform(pillar, {{100.0f, 0.0f}, 0, {1, 1}});
    // 相机无关；世界坐标直接断言

    World world;
    Scheduler sched;
    float heroX = 0.0f;
    sched.add({"hero_move", Stage::Simulation, {}, {},
               [&](World&, float) {
                   heroX += 20.0f;
                   scene.setLocalTransform(hero, {{heroX, 0.0f}, 0, {1, 1}});
               }});
    SpatialGrid grid(32.0f, 8, 8);  // cell 32，覆盖 -128..128

    // 帧 1..5：hero 0->100；pillar 60 半宽 25 -> 接触当 heroX>=35
    bool seenPair = false;
    int firstContactFrame = 0;
    for (int f = 1; f <= 5; ++f) {
        check(sched.execute(world, 1.0f), "帧执行");
        const auto pairs = broadphase(scene, grid, 25.0f);
        // 接触边界：hero 右缘 (heroX+25) >= pillar 左缘 (75)
        const bool contact = heroX >= 50.0f;
        const auto expect = std::make_pair(std::min(hero.index, pillar.index),
                                           std::max(hero.index, pillar.index));
        const bool hasPair = std::find(pairs.begin(), pairs.end(), expect) != pairs.end();
        if (contact) {
            // 接触期：AABB 重叠 -> 宽相必须产出候选对
            check(hasPair, "接触期有候选对（hero,pillar）");
            if (hasPair && firstContactFrame == 0) firstContactFrame = f;
            seenPair = true;
        }
        // 分离期不断言：宽相是 cell 级，共享 cell 会产生候选对（窄相 M2 过滤）
    }
    check(seenPair, "至少一帧接触");
    check(firstContactFrame == 3, "第 3 帧起接触（heroX=60、pillar 60 半宽 25）");
    check(heroX == 100.0f && firstContactFrame == 3, "帧3 起接触（50<=heroX<=75 重叠窗）");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (tick collision)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
