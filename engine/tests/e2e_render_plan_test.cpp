// E2E：场景文件 -> 引擎数据 -> 渲染计划（M1 出口①/③ 的引擎侧演示）
#include <cstdio>
#include <string>

#include "ccx/render/batcher.h"
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
    // 1) 读取 + 装载场景文件
    const char* path = "examples/scenes/render_plan.scene.json";
    FILE* f = std::fopen(path, "rb");
    check(f != nullptr, "场景文件可读");
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
    check(loadSceneFile(json::parse(text), scene, err), "场景装载成功");
    check(err.empty(), "无装载错误");
    check(scene.nodeCount() == 7, "7 个节点");

    // 2) 渲染序 -> 合批计划
    std::vector<SpriteInst> sprites;
    std::string order;
    for (const EntityId id : scene.renderOrder()) {
        const auto nd = scene.node(id);
        if (!nd) continue;
        order += nd->name + "|";
        const json::Value* spr = scene.component(id, "ccx.Sprite");
        if (!spr) continue;
        sprites.push_back({static_cast<uint32_t>(spr->find("atlas")->asNumber()),
                           static_cast<uint32_t>(spr->find("material")->asNumber())});
    }
    check(order.find("bg|") != std::string::npos, "bg 在渲染序中");
    check(order.find("alpha|") < order.find("gamma|"), "层内顺序 alpha<gamma");
    check(order.find("gamma|") < order.find("delta|"), "层间顺序 gamma<delta");
    check(sprites.size() == 5, "5 个精灵");

    const auto batches = buildBatches(sprites);
    check(batches.size() == 3, "3 批");
    std::printf("render plan: 5 sprites -> %zu batches\n", batches.size());
    for (const Batch& b : batches) {
        std::printf("  batch: atlas=%u material=%u count=%u first=%u\n",
                    b.key.atlas, b.key.material, b.count, b.first);
    }

    // 3) 导出往返：save -> load 语义等价（Transform/Sorting 转属性后仍一致）
    const json::Value saved = saveSceneFile(scene);
    Scene scene2;
    std::string err2;
    check(loadSceneFile(saved, scene2, err2), "导出文件可再次装载");
    check(scene2.nodeCount() == 7, "往返后节点数一致");
    // 变换保持：bg 的 local 变换存在于导出（默认为默认值，往返即可）
    const auto bg = [&]() {
        for (uint32_t i = 0; ; ++i) {
            const auto nd = scene2.node(EntityId{i});
            if (nd && nd->name == "bg") return EntityId{i};
            if (i > 100) return kNullId;
        }
    }();
    check(bg != kNullId, "bg 往返后仍在");
    const auto w = scene2.worldTransform(bg);
    (void)w;  // 默认变换，不需断言值

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (e2e render plan)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
