// 系统调度测试（engine-spec §3.4：Stage + before/after 拓扑序；job::TaskGraph 骨架）
#include <cstdio>
#include <limits>
#include <string>
#include <vector>

#include <ccx/ecs/entity.h>
#include <ccx/ecs/scheduler.h>
#include <ccx/ecs/world.h>
#include "ccx/foundation/job/task_graph.h"
#include "ccx/foundation/reflection/ccx_type.h"

using namespace ccx;
using namespace ccx::ecs;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
}  // namespace

struct Health {};
CCX_TYPE(Health)

int main() {
    const float kDt = 0.016f;

    // 1) 阶段顺序 + 同阶段 before/after 拓扑
    {
        World w;
        Scheduler sched;
        std::vector<std::string> order;
        sched.add({"ai", Stage::Simulation, {}, {"movement"},
                   [&](World&, float dt) { check(dt == kDt, "dt 透传"); order.push_back("ai"); }});
        sched.add({"movement", Stage::Simulation, {"ai"}, {},
                   [&](World&, float) { order.push_back("movement"); }});
        sched.add({"refit", Stage::Simulation, {}, {},
                   [&](World&, float) { order.push_back("refit"); }});
        sched.add({"physics", Stage::Physics, {}, {},
                   [&](World&, float) { order.push_back("physics"); }});
        sched.add({"anim", Stage::Animation, {}, {},
                   [&](World&, float) { order.push_back("anim"); }});
        sched.add({"render", Stage::Render, {}, {},
                   [&](World&, float) { order.push_back("render"); }});
        check(sched.systemCount() == 6, "注册 6 系统");
        check(sched.execute(w, kDt), "全阶段执行成功");
        // ai 在 movement 之前（after 约束）；阶段顺序 Simulation < Physics < Animation < Render
        std::string joined;
        for (const auto& s : order) joined += s + "|";
        bool aiBeforeMov = joined.find("ai|") < joined.find("movement|");
        check(aiBeforeMov, "after 约束：ai 先于 movement");
        check(joined.find("physics|") < joined.find("anim|"), "阶段序：Physics < Animation");
        check(joined.find("anim|") < joined.find("render|"), "阶段序：Animation < Render");
    }

    // 2) 只执行指定阶段
    {
        World w;
        Scheduler sched;
        int runs = 0;
        sched.add({"a", Stage::Simulation, {}, {}, [&](World&, float) { ++runs; }});
        sched.add({"b", Stage::Render, {}, {}, [&](World&, float) { ++runs; }});
        check(sched.execute(w, kDt, Stage::Simulation), "单阶段执行");
        check(runs == 1, "只跑 Simulation 的 1 个系统");
    }

    // 3) 环检测
    {
        World w;
        Scheduler sched;
        sched.add({"a", Stage::Simulation, {"b"}, {}, {}});
        sched.add({"b", Stage::Simulation, {"a"}, {}, {}});
        check(!sched.execute(w, kDt), "环导致 execute 返回 false");
    }

    // 4) 调度器内直接驱动世界（清理语义的 smoke）
    {
        World w;
        Scheduler sched;
        size_t seen = 0;
        sched.add({"spawner", Stage::Simulation, {}, {},
                   [&](World& ww, float) {
                       const Entity e = ww.create();
                       ww.add<Health>(e);
                   }});
        sched.add({"counter", Stage::PostFrame, {}, {},
                   [&](World& ww, float) { seen = ww.count<Health>(); }});
        check(sched.execute(w, 1.0f), "驱动世界执行");
        check(seen == 1, "系统创建实体被后续阶段统计到");
    }

    // 5) job::TaskGraph 骨架：依赖序 + 环
    {
        job::TaskGraph g;
        std::string log;
        const auto t1 = g.add("t1", {}, [&](size_t) { log += "t1"; });
        const auto t2 = g.add("t2", {t1}, [&](size_t) { log += "t2"; });
        g.add("t3", {t2}, [&](size_t) { log += "t3"; });
        check(g.run(), "无环图执行成功");
        check(log == "t1t2t3", "依赖序 t1->t2->t3");

        job::TaskGraph cyc;
        const auto c1 = cyc.add("c1", {}, [](size_t) {});
        const auto c2 = cyc.add("c2", {c1}, [](size_t) {});
        const auto c3 = cyc.add("c3", {c2}, [](size_t) {});
        // 越界依赖（非法 id）应被拒绝
        const auto c4 = cyc.add("c4", {c3, std::numeric_limits<job::TaskId>::max()}, [](size_t) {});
        (void)c4;
        // 非法依赖（越界 id）同样返回 false
        check(!cyc.run(), "非法依赖不执行");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (scheduler + task graph)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
