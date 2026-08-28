// 渲染计划导出工具（跨语言对拍用）：读场景文件 -> JSON 渲染计划（stdout 单行）
// 用法：ccx_render_plan_dump <scene.json>
#include <cstdio>
#include <string>
#include <vector>

#include "ccx/render/batcher.h"
#include "ccx/scene/schema.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::scene;
using namespace ccx::render;

int main(int argc, char** argv) {
    if (argc < 2) {
        std::fprintf(stderr, "usage: ccx_render_plan_dump <scene.json>\n");
        return 2;
    }
    FILE* f = std::fopen(argv[1], "rb");
    if (!f) {
        std::fprintf(stderr, "open failed: %s\n", argv[1]);
        return 2;
    }
    std::string text;
    char buf[4096];
    size_t n;
    while ((n = std::fread(buf, 1, sizeof buf, f)) > 0) text.append(buf, n);
    std::fclose(f);

    Scene scene;
    std::string err;
    if (!loadSceneFile(json::parse(text), scene, err)) {
        std::fprintf(stderr, "load failed: %s\n", err.c_str());
        return 1;
    }
    std::vector<SpriteInst> sprites;
    for (const EntityId id : scene.renderOrder()) {
        const json::Value* spr = scene.component(id, "ccx.Sprite");
        if (!spr) continue;
        sprites.push_back({static_cast<uint32_t>(spr->find("atlas")->asNumber()),
                           static_cast<uint32_t>(spr->find("material")->asNumber())});
    }
    const auto batches = buildBatches(sprites);

    json::Value::ObjectEntries root;
    root.emplace_back("sprites", json::Value::number(static_cast<double>(sprites.size())));
    json::Value::Array batchArr;
    for (const Batch& b : batches) {
        json::Value::ObjectEntries e;
        e.emplace_back("atlas", json::Value::number(b.key.atlas));
        e.emplace_back("material", json::Value::number(b.key.material));
        e.emplace_back("count", json::Value::number(b.count));
        e.emplace_back("first", json::Value::number(b.first));
        batchArr.push_back(json::Value::object(std::move(e)));
    }
    root.emplace_back("batches", json::Value::array(std::move(batchArr)));
    std::printf("%s\n", json::dump(json::Value::object(std::move(root))).c_str());
    return 0;
}
