#pragma once
#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <vector>

#include "ccx/ecs/world.h"

namespace ccx::ecs {

// 系统阶段（engine-spec §3.4）：每帧按阶段顺序执行；同阶段内按 before/after 拓扑序
enum class Stage : uint8_t {
    PreSimulation,
    Simulation,
    Physics,
    Animation,
    PostAnimation,
    Render,
    PostFrame,
};

const char* stageName(Stage s);

using SystemFn = std::function<void(World&, float /*dt*/)>;

struct SystemDesc {
    std::string name;
    Stage stage = Stage::Simulation;
    std::vector<std::string> before;  // 同阶段内必须早于这些系统（按 name）
    std::vector<std::string> after;   // 同阶段内必须晚于这些系统
    SystemFn run;
};

class Scheduler {
public:
    void add(SystemDesc desc);  // 同名替换（排除环用）
    size_t systemCount() const;

    // 全阶段执行；返回 false 表示某阶段存在环（该阶段被跳过并报错）
    bool execute(World& w, float dt);
    // 只执行指定阶段
    bool execute(World& w, float dt, Stage only);

private:
    struct Node {
        std::string name;
        size_t descIndex = 0;
        std::vector<size_t> deps;  // 组内下标（before/after 解析后）
    };
    bool runStage(World& w, float dt, Stage s, const std::vector<size_t>& members);

    std::vector<SystemDesc> systems_;
};

}  // namespace ccx::ecs
