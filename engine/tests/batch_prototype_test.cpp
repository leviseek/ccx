// 灯塔任务 D：SpriteBatch 合批模型（renderer-spec §5；逻辑已正式化到 render::batcher）
#include <cstdint>
#include <cstdio>
#include <vector>

#include "ccx/render/batcher.h"

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
    // 1) 核心断言：100 个同图集同材质精灵 = 1 批
    {
        std::vector<SpriteInst> sprites(100, SpriteInst{7, 3});
        const auto batches = buildBatches(sprites);
        check(batches.size() == 1, "100 同键精灵 = 1 批");
        check(batches[0].key.atlas == 7 && batches[0].key.material == 3, "批键正确");
        check(batches[0].first == 0 && batches[0].count == 100, "批范围完整");
    }
    // 2) 交错场景：40/30/30（A/B/A）→ 3 批，顺序稳定
    {
        std::vector<SpriteInst> sprites;
        for (int i = 0; i < 40; ++i) sprites.push_back({1, 1});
        for (int i = 0; i < 30; ++i) sprites.push_back({2, 1});
        for (int i = 0; i < 30; ++i) sprites.push_back({1, 1});
        const auto batches = buildBatches(sprites);
        check(batches.size() == 3, "交错 A/B/A = 3 批");
        check(batches[0].count == 40 && batches[1].count == 30 && batches[2].count == 30,
              "各批计数正确");
        check(batches[0].key.atlas == 1 && batches[1].key.atlas == 2, "批键序保持");
        check(batches[2].first == 70, "第三批 first 索引正确");
    }
    // 3) 边界与守恒
    {
        const std::vector<SpriteInst> one = {{0, 0}};
        check(buildBatches(one).size() == 1, "单精灵 = 1 批");
        check(buildBatches({}).empty(), "空输入 = 0 批");
        std::vector<SpriteInst> sprites;
        for (int i = 0; i < 17; ++i) {
            sprites.push_back({static_cast<uint32_t>(i % 3), static_cast<uint32_t>(i % 2)});
        }
        uint32_t total = 0;
        for (const Batch& b : buildBatches(sprites)) total += b.count;
        check(total == 17, "合批实例数守恒");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (sprite batch)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
