// 碰撞层/掩码测试：掩码过滤 + 双向判定 + 与窄相组合
#include <cstdio>

#include "ccx/physics/body.h"

using namespace ccx::physics;

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
    {
        // 1) canCollide 双向判定
        Body a;
        a.layer = kLayerPlayer;
        a.mask = kLayerEnvironment;      // 玩家可与环境碰撞
        Body b;
        b.layer = kLayerEnvironment;
        b.mask = kLayerPlayer | kLayerProjectile;
        check(canCollide(a, b), "双向允许 -> 碰撞");
        Body c;
        c.layer = kLayerEnvironment;
        c.mask = kLayerProjectile;       // 该环境只挡子弹
        check(!canCollide(a, c), "环境掩码不含玩家 -> 不碰撞");
        Body d;
        d.layer = kLayerProjectile;
        d.mask = kLayerEnvironment;      // 子弹与环境
        check(canCollide(d, c) && canCollide(c, d), "子弹-环境对");
    }
    {
        // 2) 层过滤 + AABB：同 cell 玩家/子弹/环境三层
        SpatialGrid grid(32.0f, 4, 4);
        std::map<uint32_t, Body> bodies;
        bodies[1] = {Aabb::fromCenter({0, 0}, {10, 10}), kLayerPlayer, kLayerEnvironment};
        bodies[2] = {Aabb::fromCenter({5, 0}, {10, 10}), kLayerEnvironment,
                     kLayerPlayer | kLayerProjectile};   // 重叠玩家
        bodies[3] = {Aabb::fromCenter({10, 0}, {10, 10}), kLayerProjectile,
                     kLayerEnvironment};                  // 与环境重叠
        for (const auto& [id, b] : bodies) grid.insert(id, b.box);
        const auto contacts = narrowPhaseLayered(grid, bodies);
        // 期望：玩家-环境 (1,2)；子弹-环境 (2,3)；玩家-子弹掩码互不含 -> 无
        check(contacts.size() == 2, "两对接触（层过滤生效）");
        bool saw12 = false, saw23 = false;
        for (const auto& [a, b] : contacts) {
            if (a == 1 && b == 2) saw12 = true;
            if (a == 2 && b == 3) saw23 = true;
        }
        check(saw12 && saw23, "对集合正确（无玩家-子弹）");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (layers)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
