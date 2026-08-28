// 资产全链组装：scene 装载 -> Sprite 收集 -> material 校验 vs shader -> pipeline 编译 -> 渲染计划
// 覆盖 M1 资产-渲染数据链路各层的组合（GPU 提交 M2）
#include <cstdio>
#include <map>
#include <string>
#include <vector>

#include "ccx/render/batcher.h"
#include "ccx/render/material.h"
#include "ccx/render/pipeline.h"
#include "ccx/render/shader.h"
#include "ccx/scene/schema.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::scene;
using namespace ccx::render;

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
    // 1) 场景装载（fixture 与 Node 服务侧同源）
    FILE* f = std::fopen("examples/scenes/render_plan.scene.json", "rb");
    check(f != nullptr, "fixture 可读");
    if (!f) {
        std::printf("1 FAILURE(S)\n");
        return 1;
    }
    std::string text;
    char buf[4096];
    size_t n;
    while ((n = std::fread(buf, 1, sizeof buf, f)) > 0) text.append(buf, n);
    std::fclose(f);
    Scene scene;
    std::string err;
    check(loadSceneFile(json::parse(text), scene, err), "场景装载");

    // 2) 材质/着色器资产校验
    MaterialDef mat;
    check(parseMaterial(json::parse(
              "{\"schema\":\"ccx.material/1\",\"name\":\"hero_mat\","
              "\"shader\":\"builtin/sprite\","
              "\"params\":{\"tint\":[1,1,1,1],\"brightness\":1.0}}"),
              mat, err),
          "材质解析");
    ShaderDef sh;
    check(parseShader(json::parse(
              "{\"schema\":\"ccx.shader/1\",\"name\":\"builtin/sprite\","
              "\"uniforms\":[{\"name\":\"tint\",\"type\":\"vec4\"},"
              "{\"name\":\"brightness\",\"type\":\"float\"}]}"),
              sh, err),
          "shader 解析");
    check(validateMaterialAgainstShader(mat, sh, err), "材质与 shader 匹配");

    // 3) 渲染计划（Sprite 收集 + 合批）
    std::vector<SpriteInst> sprites;
    for (const EntityId id : scene.renderOrder()) {
        const json::Value* spr = scene.component(id, "ccx.Sprite");
        if (!spr) continue;
        sprites.push_back({static_cast<uint32_t>(spr->find("atlas")->asNumber()),
                           static_cast<uint32_t>(spr->find("material")->asNumber())});
    }
    check(sprites.size() == 5, "5 精灵");
    const auto batches = buildBatches(sprites);
    check(batches.size() == 3, "3 批");

    // 4) Pipeline 编译（含 shader registry 一致性）
    PipelineDef def;
    check(parsePipeline(json::parse(R"({
      "schema": "ccx.pipeline/1",
      "name": "Mobile2D",
      "passes": [
        { "id": "world", "target": "hdr", "shader": "builtin/sprite" },
        { "id": "tilemap", "target": "hdr", "shader": "builtin/tilemap" },
        { "id": "ui", "target": "backbuffer", "shader": "builtin/ui" }
      ],
      "resources": {
        "hdr": { "format": "rgba8" },
        "backbuffer": { "format": "rgba8", "usage": "external" }
      },
      "minFeatures": { "instancing": true }
    })"), def, err),
          "pipeline 解析");
    std::map<std::string, ShaderDef> registry;
    for (const char* name : {"builtin/sprite", "builtin/tilemap", "builtin/ui"}) {
        ShaderDef s;
        s.name = name;
        registry.emplace(name, s);
    }
    const auto compiled = compilePipeline(def, {"instancing"}, &registry);
    check(compiled.ok, "pipeline 编译通过（registry 齐全）");
    check(compiled.executionOrder.size() == 3, "3 个启用 pass");

    // 5) 全链联动：批次材质键与材质资产对齐（v1 约定：material id == 材质序号）
    check(batches[0].key.material == 1, "批次材质键 1（mesh 材质 0 号）");
    check(mat.name == "hero_mat", "材质资产可用");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (asset chain)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
