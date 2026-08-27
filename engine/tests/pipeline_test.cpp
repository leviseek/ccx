// Pipeline 资产解析 -> RenderGraph 编译（renderer-spec §4）
#include <cstdio>
#include <string>
#include <vector>

#include "ccx/foundation/serialization/json.h"
#include "ccx/render/pipeline.h"

using namespace ccx;
using namespace ccx::render;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        std::fflush(stdout);
        ++g_failures;
    }
}

const char* kPipelineJson = R"({
  "schema": "ccx.pipeline/1",
  "name": "Mobile2D",
  "extends": "ccx.forward-2d",
  "passes": [
    { "id": "world",    "target": "hdr",       "shader": "builtin/sprite", "sort": "layer+order" },
    { "id": "tilemap",  "target": "hdr",       "shader": "builtin/tilemap" },
    { "id": "light",    "target": "hdr",       "shader": "builtin/light2d", "enable": false },
    { "id": "ui",       "target": "backbuffer", "shader": "builtin/ui" },
    { "id": "post",     "target": "backbuffer", "shader": "builtin/post", "enable": false }
  ],
  "resources": {
    "hdr":       { "format": "rgba8", "size": "viewport" },
    "backbuffer": { "format": "rgba8", "size": "viewport", "usage": "external" }
  },
  "minFeatures": { "instancing": true }
})";
}  // namespace

int main() {
    {
        // 1) 解析 + 编译：禁用 pass 剔除，资源声明齐全，能力满足
        PipelineDef def;
        std::string err;
        check(parsePipeline(json::parse(kPipelineJson), def, err), "pipeline 解析成功");
        check(err.empty(), "无解析错误");
        check(def.name == "Mobile2D" && def.extends == "ccx.forward-2d", "名称/extends");
        check(def.passes.size() == 5, "原始 5 个 pass");
        check(def.minFeatures.size() == 1 && def.minFeatures[0] == "instancing",
              "minFeatures 解析");
        const auto r = compilePipeline(def, {"instancing"});
        check(r.ok, "编译通过");
        check(r.executionOrder.size() == 3, "启用 pass 为 3 个");
        check(r.executionOrder[0] == "world" && r.executionOrder[2] == "ui",
              "禁用 light/post 后执行序 world < ... < ui");
        // hdr 生命周期：world 最先写
        check(r.lifecycles[0].name == "hdr" &&
                  r.lifecycles[0].firstWrittenBy == "world",
              "hdr 由 world 首写");
    }
    {
        // 2) 能力缺失 -> 降级门槛拒绝
        PipelineDef def;
        std::string err;
        check(parsePipeline(json::parse(kPipelineJson), def, err), "解析成功");
        const auto r = compilePipeline(def, {});
        check(!r.ok, "缺 instancing 能力被拒");
        check(r.error.find("instancing") != std::string::npos, "错误指名缺失能力");
    }
    {
        // 3) schema 错误
        PipelineDef def;
        std::string err;
        check(!parsePipeline(json::parse("{\"name\":\"x\"}"), def, err), "缺 schema 拒绝");
        check(err.find("schema") != std::string::npos, "错误提示 schema");
    }
    {
        // 4) 资源缺失：pass 引用了未声明的 target
        const char* bad = R"({
          "schema": "ccx.pipeline/1",
          "passes": [ { "id": "p", "target": "ghost" } ],
          "resources": { "hdr": { "format": "rgba8" } }
        })";
        PipelineDef def;
        std::string err;
        check(parsePipeline(json::parse(bad), def, err), "解析成功");
        const auto r = compilePipeline(def, {});
        check(!r.ok && r.error.find("ghost") != std::string::npos, "未声明 target 被拒");
    }
    {
        // 5) 全部 pass 禁用
        const char* allOff = R"({
          "schema": "ccx.pipeline/1",
          "passes": [ { "id": "p", "target": "hdr", "enable": false } ],
          "resources": { "hdr": { "format": "rgba8" } }
        })";
        PipelineDef def;
        std::string err;
        check(parsePipeline(json::parse(allOff), def, err), "解析成功");
        const auto r = compilePipeline(def, {});
        check(!r.ok, "无启用 pass 被拒");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (pipeline)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
