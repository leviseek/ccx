#pragma once
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace ccx::job {

using TaskId = uint32_t;

// Task 图（engine-spec §3.4 System 调度的底层原语；M1 骨架：依赖拓扑序串行执行，
// 并行 worker 池留 M1.5 —— 见 task_graph.cpp 注释）
class TaskGraph {
public:
    TaskId add(std::string name, std::vector<TaskId> deps,
               std::function<void(size_t /*index*/)> fn);
    // 返回 false 表示存在环（本轮不执行任何任务）
    bool run();
    size_t size() const;

private:
    struct Node {
        std::string name;
        std::vector<TaskId> deps;
        std::function<void(size_t)> fn;
    };
    std::vector<Node> nodes_;
};

}  // namespace ccx::job
