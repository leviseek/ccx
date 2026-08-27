#pragma once
#include <string>
#include <vector>

#include "ccx/foundation/serialization/json.h"
#include "ccx/render/render_graph.h"

namespace ccx::render {

// Render Pipeline 资产（renderer-spec §4）：JSON 资产 -> RenderGraph 编译路径
struct PipelinePass {
    std::string id;
    std::string target;      // 输出资源
    std::string shader;      // 着色器/材质标识
    std::string sort;        // 排序规则（"front2back"/"back2front"/"layer+order"）
    bool enable = true;
    std::vector<std::string> reads;    // 额外输入（阴影图等）
    std::vector<std::string> after;    // 资产内显式顺序
};

struct PipelineResource {
    std::string name;
    std::string format;      // "rgba8"/"d32f" 等（v1 只做透传校验）
    std::string size;        // "viewport"/"2048x2048"
    bool external = false;   // External（backbuffer 等）
};

struct PipelineDef {
    std::string schema;      // "ccx.pipeline/1"
    std::string name;
    std::string extends;     // 基类管线（v1 仅记录）
    std::vector<PipelinePass> passes;
    std::vector<PipelineResource> resources;
    std::vector<std::string> minFeatures;  // "instancing" 等能力要求
};

// 解析（ccx.pipeline/1）；失败返回 false + err
bool parsePipeline(const json::Value& doc, PipelineDef& out, std::string& err);

// 编译：enable pass + 资源声明 -> RenderGraph -> compile（含 minFeatures 降级门槛）
// caps：可用能力集合（renderer-spec §2.4 / platform-spec）；缺失 required 项返回错误
CompileResult compilePipeline(const PipelineDef& def, const std::vector<std::string>& caps);

}  // namespace ccx::render
