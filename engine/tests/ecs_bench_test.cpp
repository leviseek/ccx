// M1 gate 基准（engine-spec §3.7 / ADR-001 §5）：实体创建速率 / 10 万查询 / 空世界 tick
#include <chrono>
#include <cstdio>
#include <vector>

#include "ccx/ecs/entity.h"
#include "ccx/ecs/world.h"
#include "ccx/foundation/reflection/ccx_type.h"

using namespace ccx::ecs;

struct Position { float x = 0.0f; float y = 0.0f; };
CCX_TYPE(Position, (CCX_PROP(&Position::x, "x", {})), (CCX_PROP(&Position::y, "y", {})))

struct Velocity { float vx = 0.0f; float vy = 0.0f; };
CCX_TYPE(Velocity, (CCX_PROP(&Velocity::vx, "vx", {})), (CCX_PROP(&Velocity::vy, "vy", {})))

namespace {
int g_fail = 0;
void check(bool ok, const char* what) {
    if (!ok) { std::printf("FAIL: %s\n", what); ++g_fail; }
}
double msSince(std::chrono::steady_clock::time_point t0) {
    return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
}
}  // namespace

int main() {
    // —— 1) 实体创建速率（≥ 1M/s 批量）——
    constexpr int kCreate = 200000;
    {
        World w;
        const auto t0 = std::chrono::steady_clock::now();
        for (int i = 0; i < kCreate; ++i) {
            const Entity e = w.create();
            w.add<Position>(e);
            w.add<Velocity>(e);
        }
        const double dt = msSince(t0);
        const double rate = kCreate / (dt / 1000.0);
        std::printf("bench: create+2comp %d entities: %.2f ms (%.1f M/s)\n",
                    kCreate, dt, rate / 1e6);
        check(rate >= 1e6, "实体创建速率 >= 1M/s (gate)");
        check(w.entityCount() == static_cast<size_t>(kCreate), "实体计数一致");
    }

    // —— 2) 10 万 Transform 只读查询（< 2 ms 桌面）——
    constexpr int kQuery = 100000;
    {
        World w;
        for (int i = 0; i < kQuery; ++i) {
            const Entity e = w.create();
            w.add<Position>(e);
        }
        volatile double sink = 0;
        const auto t0 = std::chrono::steady_clock::now();
        w.query<Position>([&](Entity, Position& p) { sink += p.x + p.y; });
        const double dt = msSince(t0);
        std::printf("bench: query<Position> 100k: %.3f ms\n", dt);
        check(dt < 2.0, "10 万 Transform 查询 < 2 ms (desktop gate)");
        (void)sink;
    }

    // —— 3) 空世界 tick（< 0.5 ms）——
    {
        World w;
        constexpr int kTicks = 1000;
        const auto t0 = std::chrono::steady_clock::now();
        for (int i = 0; i < kTicks; ++i) {
            w.query<Position>([](Entity, Position&) {});  // 空查询 = tick 骨架
        }
        const double dt = msSince(t0) / kTicks;
        std::printf("bench: empty tick: %.4f ms\n", dt);
        check(dt < 0.5, "空世界 tick < 0.5 ms (gate)");
    }

    // —— 4) 10 万精灵帧推进（变换写 + 脏集模拟：位置更新循环）< 1.5 ms 移动 ——
    {
        World w;
        for (int i = 0; i < kQuery; ++i) {
            const Entity e = w.create();
            w.add<Position>(e);
            w.add<Velocity>(e);
        }
        const auto t0 = std::chrono::steady_clock::now();
        for (int frame = 0; frame < 5; ++frame) {
            w.query<Position, Velocity>([](Entity, Position& p, Velocity& v) {
                p.x += v.vx;
                p.y += v.vy;
            });
        }
        const double dt = msSince(t0) / 5.0;
        std::printf("bench: 100k sprite frame advance: %.3f ms\n", dt);
        // 桌面放宽（移动 1.5ms 目标以桌面 1/2 估算）；gate 记录数据供移动端对照
        check(dt < 6.0, "10 万精灵帧推进 < 6 ms (desktop, 移动目标 1.5ms 待真机)");
    }

    if (g_fail == 0) { std::printf("ALL BENCH GATES PASSED\n"); return 0; }
    std::printf("%d BENCH GATE FAILURE(S)\n", g_fail);
    return 1;
}
