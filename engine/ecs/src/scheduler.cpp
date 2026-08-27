#include "ccx/ecs/scheduler.h"

#include <algorithm>
#include <cstdio>
#include <unordered_map>

namespace ccx::ecs {

const char* stageName(Stage s) {
    switch (s) {
        case Stage::PreSimulation: return "PreSimulation";
        case Stage::Simulation: return "Simulation";
        case Stage::Physics: return "Physics";
        case Stage::Animation: return "Animation";
        case Stage::PostAnimation: return "PostAnimation";
        case Stage::Render: return "Render";
        case Stage::PostFrame: return "PostFrame";
    }
    return "?";
}

void Scheduler::add(SystemDesc desc) {
    for (auto it = systems_.begin(); it != systems_.end(); ++it) {
        if (it->name == desc.name) {
            *it = std::move(desc);
            return;
        }
    }
    systems_.push_back(std::move(desc));
}

size_t Scheduler::systemCount() const { return systems_.size(); }

bool Scheduler::execute(World& w, float dt) {
    bool ok = true;
    for (uint32_t s = 0; s <= static_cast<uint32_t>(Stage::PostFrame); ++s) {
        std::vector<size_t> members;
        for (size_t i = 0; i < systems_.size(); ++i) {
            if (systems_[i].stage == static_cast<Stage>(s)) members.push_back(i);
        }
        if (!members.empty()) ok = runStage(w, dt, static_cast<Stage>(s), members) && ok;
    }
    return ok;
}

bool Scheduler::execute(World& w, float dt, Stage only) {
    std::vector<size_t> members;
    for (size_t i = 0; i < systems_.size(); ++i) {
        if (systems_[i].stage == only) members.push_back(i);
    }
    return members.empty() || runStage(w, dt, only, members);
}

bool Scheduler::runStage(World& w, float dt, Stage s, const std::vector<size_t>& members) {
    // 同阶段内构图：before/after 按 name 匹配（仅组内），Kahn 拓扑排序后串行执行
    const size_t m = members.size();
    std::unordered_map<std::string, size_t> byName;
    for (size_t i = 0; i < m; ++i) byName.emplace(systems_[members[i]].name, i);

    std::vector<std::vector<size_t>> edges(m);
    std::vector<size_t> indeg(m, 0);
    for (size_t i = 0; i < m; ++i) {
        const SystemDesc& d = systems_[members[i]];
        auto link = [&](const std::string& other, bool depFirst) {
            const auto it = byName.find(other);
            if (it == byName.end()) return;  // 跨阶段/未知名字：忽略（阶段本身即全局序）
            const size_t j = it->second;
            if (depFirst) { edges[j].push_back(i); ++indeg[i]; }
            else { edges[i].push_back(j); ++indeg[j]; }
        };
        for (const std::string& b : d.before) link(b, true);   // b 在 i 之前 -> b->i
        for (const std::string& a : d.after) link(a, false);   // a 在 i 之后 -> i->a
    }

    std::vector<size_t> order;
    order.reserve(m);
    std::vector<bool> done(m, false);
    for (;;) {
        bool progressed = false;
        for (size_t i = 0; i < m; ++i) {
            if (done[i] || indeg[i] != 0) continue;
            done[i] = true;
            order.push_back(i);
            for (const size_t e : edges[i]) --indeg[e];
            progressed = true;
        }
        if (!progressed) break;
    }
    if (order.size() != m) {
        std::fprintf(stderr, "[ccx::ecs] Scheduler: stage %s 存在环，本阶段跳过\n",
                     stageName(s));
        return false;
    }
    for (const size_t i : order) {
        const SystemDesc& d = systems_[members[i]];
        if (d.run) d.run(w, dt);
        // TODO M1.5: 无相互依赖的系统经 job::TaskGraph 分发并行
    }
    return true;
}

}  // namespace ccx::ecs
