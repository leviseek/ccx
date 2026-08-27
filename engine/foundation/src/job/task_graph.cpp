#include "ccx/foundation/job/task_graph.h"

#include <algorithm>
#include <cstdio>

namespace ccx::job {

TaskId TaskGraph::add(std::string name, std::vector<TaskId> deps,
                      std::function<void(size_t)> fn) {
    const TaskId id = static_cast<TaskId>(nodes_.size());
    nodes_.push_back({std::move(name), std::move(deps), std::move(fn)});
    return id;
}

size_t TaskGraph::size() const { return nodes_.size(); }

bool TaskGraph::run() {
    // Kahn 拓扑排序（稠密小图：O(V^2) 足够；M1.5 换邻接表 + 就绪队列并行 worker）
    const size_t n = nodes_.size();
    std::vector<size_t> indeg(n, 0), order;
    order.reserve(n);
    for (size_t i = 0; i < n; ++i) {
        for (const TaskId d : nodes_[i].deps) {
            if (d >= n) return false;
            ++indeg[i];
        }
    }
    std::vector<bool> done(n, false);
    for (;;) {
        bool progressed = false;
        for (size_t i = 0; i < n; ++i) {
            if (done[i] || indeg[i] != 0) continue;
            bool depsOk = true;
            for (const TaskId d : nodes_[i].deps) {
                if (!done[d]) { depsOk = false; break; }
            }
            if (!depsOk) continue;
            done[i] = true;
            order.push_back(i);
            // Kahn：本节点完成后，所有依赖它的节点入度 -1
            for (size_t j = 0; j < n; ++j) {
                if (done[j]) continue;
                const auto& dj = nodes_[j].deps;
                if (std::find(dj.begin(), dj.end(), i) != dj.end()) --indeg[j];
            }
            progressed = true;
        }
        if (!progressed) break;
    }
    if (order.size() != n) {
        std::fprintf(stderr, "[ccx::job] TaskGraph: 检测到环，拒绝执行\n");
        return false;
    }
    // M1 骨架：串行执行；M1.5：无依赖节点分发到 worker 池并行
    for (const size_t i : order) {
        if (nodes_[i].fn) nodes_[i].fn(i);
    }
    return true;
}

}  // namespace ccx::job
