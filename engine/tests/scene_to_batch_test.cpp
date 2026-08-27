// 场景 -> 渲染提交（renderer-spec §3.2/§5）：renderOrder 稳定排序 -> 合批
#include <cstdio>
#include <string>
#include <vector>

#include "ccx/render/batcher.h"
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
    Scene s;
    const EntityId bg = s.createNode("bg");
    const EntityId fg = s.createNode("fg");
    s.createNode("alpha", bg);
    s.createNode("beta", bg);
    s.createNode("gamma", bg);
    s.createNode("delta", fg);
    s.createNode("epsilon", fg);
    s.setSorting(bg, 0, -10);
    s.setSorting(fg, 1, 0);

    const auto find = [&](const char* name) -> EntityId {
        for (const EntityId id : s.renderOrder()) {
            const auto n = s.node(id);
            if (n && n->name == name) return id;
        }
        return kNullId;
    };
    const auto spr = [&](EntityId id, uint32_t atlas, uint32_t material) {
        s.setComponent(id, "ccx.Sprite",
                       ccx::json::parse("{\"atlas\":" + std::to_string(atlas) +
                                        ",\"material\":" + std::to_string(material) + "}"));
    };
    spr(find("alpha"), 1, 1);
    spr(find("beta"), 1, 1);
    spr(find("gamma"), 2, 1);
    spr(find("delta"), 1, 1);
    spr(find("epsilon"), 1, 1);

    // 渲染序收集精灵（layer+sortingOrder 稳定序）
    std::vector<SpriteInst> sprites;
    for (const EntityId id : s.renderOrder()) {
        const json::Value* c = s.component(id, "ccx.Sprite");
        if (!c) continue;
        sprites.push_back({static_cast<uint32_t>(c->find("atlas")->asNumber()),
                           static_cast<uint32_t>(c->find("material")->asNumber())});
    }
    check(sprites.size() == 5, "5 个精灵被收集");
    check(sprites[0].atlas == 1 && sprites[1].atlas == 1 && sprites[2].atlas == 2,
          "bg 层内顺序保持（alpha,beta,gamma）");
    check(sprites[3].atlas == 1, "fg 层在 bg 之后");

    // 合批：alpha+beta(1,1) / gamma(2,1) / delta+epsilon(1,1) -> 3 批
    const auto batches = buildBatches(sprites);
    check(batches.size() == 3, "3 批");
    check(batches[0].count == 2 && batches[0].key.atlas == 1, "第一批 2 实例");
    check(batches[1].count == 1 && batches[1].key.atlas == 2, "第二批 1 实例");
    check(batches[2].count == 2 && batches[2].first == 3, "第三批 fg 层");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (scene to batch)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
