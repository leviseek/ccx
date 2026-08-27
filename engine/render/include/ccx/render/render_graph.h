#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace ccx::render {

// 渲染资源（renderer-spec §3.1 的抽象；真实 GPU 资源在 M2 由 RHI 创建）
enum class ResourceKind : uint8_t { Transient, External };

struct Pass {
    std::string name;
    std::vector<std::string> reads;   // 只读（采样/输入）
    std::vector<std::string> writes;  // 写入（RT/输出）
    std::vector<std::string> after;   // 显式顺序约束（同图资源策略，renderer-spec §3.3）
};

struct ResourceLifecycle {
    std::string name;
    ResourceKind kind = ResourceKind::Transient;
    std::string firstWrittenBy;   // 首次写入 pass
    std::string lastReadBy;       // 最后读取 pass
};

struct CompileResult {
    bool ok = false;
    std::string error;
    std::vector<std::string> executionOrder;     // pass 执行序（保添加序 + after 拓扑）
    std::vector<ResourceLifecycle> lifecycles;   // transient 生命周期区间（别名依据）
};

// 渲染图编译器：只做图的正确性验证与执行序（无 GPU 依赖，可单测）
class RenderGraph {
public:
    void declareResource(std::string name, ResourceKind kind = ResourceKind::Transient);
    void addPass(Pass p);

    CompileResult compile() const;

private:
    struct ResourceDecl {
        std::string name;
        ResourceKind kind = ResourceKind::Transient;
    };
    std::vector<ResourceDecl> resources_;
    std::vector<Pass> passes_;
};

}  // namespace ccx::render
