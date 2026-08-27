// 灯塔任务 D：SpriteBatch 合批模型原型（renderer-spec §5 的 CPU 侧先行验证）
// 目标：验证"静态合批 + 同键连续合批"数据模型 —— 100 个同图集同材质精灵 = 1 批。
// 说明：真实 GPU 提交在 M2（renderer-spec §6 预算）；本测试只验证批划分逻辑的
// 正确性与稳定性（与渲染后端无关，纯数据）。

#include <cstdint>
#include <cstdio>
#include <vector>

namespace {

struct BatchKey {
    uint32_t atlas = 0;     // 图集 id（asset-spec Cook 产物）
    uint32_t material = 0;  // 材质 id
    bool operator==(const BatchKey&) const = default;
};

struct SpriteInst {
    uint32_t atlas = 0;
    uint32_t material = 0;
};

struct Batch {
    BatchKey key;
    uint32_t first = 0;   // 实例范围（稳定插入序，renderer-spec §3.2/§5）
    uint32_t count = 0;
};

// 顺序合批：输入顺序即绘制顺序；同键连续段合并为一批。
// 排序（layer/sortingOrder）由上层完成后再进入本函数（renderer-spec §3.2）。
std::vector<Batch> buildBatches(const std::vector<SpriteInst>& sprites) {
    std::vector<Batch> out;
    for (size_t i = 0; i < sprites.size();) {
        const BatchKey key{sprites[i].atlas, sprites[i].material};
        size_t j = i + 1;
        while (j < sprites.size() && sprites[j].atlas == key.atlas &&
               sprites[j].material == key.material) {
            ++j;
        }
        out.push_back({key, static_cast<uint32_t>(i), static_cast<uint32_t>(j - i)});
        i = j;
    }
    return out;
}

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
    // 2) 交错场景：40/30/30（A/B/A）→ 3 批，顺序稳定（不重排既有顺序）
    {
        std::vector<SpriteInst> sprites;
        for (int i = 0; i < 40; ++i) sprites.push_back({1, 1});
        for (int i = 0; i < 30; ++i) sprites.push_back({2, 1});
        for (int i = 0; i < 30; ++i) sprites.push_back({1, 1});
        const auto batches = buildBatches(sprites);
        check(batches.size() == 3, "交错 A/B/A = 3 批");
        check(batches[0].count == 40 && batches[1].count == 30 && batches[2].count == 30,
              "各批计数正确");
        check(batches[0].key.atlas == 1 && batches[1].key.atlas == 2 && batches[2].key.atlas == 1,
              "批键顺序保持输入序");
        check(batches[2].first == 70, "第三批 first 索引正确");
    }
    // 3) 边界：1 个精灵 → 1 批；空输入 → 0 批
    {
        const std::vector<SpriteInst> one = {{0, 0}};
        check(buildBatches(one).size() == 1, "单精灵 = 1 批");
        check(buildBatches({}).empty(), "空输入 = 0 批");
    }
    // 4) 全部实例数守恒（合批不丢/不重实例）
    {
        std::vector<SpriteInst> sprites;
        for (int i = 0; i < 17; ++i) sprites.push_back({static_cast<uint32_t>(i % 3),
                                                        static_cast<uint32_t>(i % 2)});
        uint32_t total = 0;
        for (const Batch& b : buildBatches(sprites)) total += b.count;
        check(total == 17, "合批实例数守恒");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (sprite batch prototype)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
