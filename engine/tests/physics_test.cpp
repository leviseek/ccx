// 2D 碰撞数据面测试（AABB 相交/包含 + 空间网格宽相）
#include <cstdio>

#include "ccx/physics/collision.h"

using namespace ccx::physics;

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
    {
        // 1) AABB 相交/接触/分离/包含
        const Aabb a = Aabb::fromCenter({0, 0}, {10, 10});
        const Aabb b = Aabb::fromCenter({15, 0}, {10, 10});   // 接触（x 临接 [-5,5] vs [5,25]）
        const Aabb c = Aabb::fromCenter({30, 0}, {5, 5});     // 分离
        check(a.overlaps(b), "接触即重叠（闭区间语义）");
        check(!a.overlaps(c), "分离不重叠");
        check(a.contains({0, 0}) && !a.contains({11, 0}), "包含/外");
    }
    {
        // 2) 网格：插入/查询/跨 cell
        SpatialGrid grid(10.0f, 8, 8);
        grid.insert(1, Aabb::fromCenter({0, 0}, {5, 5}));    // cell (0,0)
        grid.insert(2, Aabb::fromCenter({15, 15}, {5, 5}));  // cells (1..2, 1..2)
        grid.insert(3, Aabb::fromCenter({15, 0}, {8, 3}));   // 跨 cell (0..2, 0)
        const auto q = grid.query(Aabb::fromCenter({10, 0}, {10, 10}));
        check(q.size() == 3, "查询命中 3 项（覆盖 1/2/3 的 cells）");
        bool has1 = false, has2 = false, has3 = false;
        for (const uint32_t id : q) {
            if (id == 1) has1 = true;
            if (id == 2) has2 = true;
            if (id == 3) has3 = true;
        }
        check(has1 && has2 && has3, "跨 cell 命中 1/2/3");
        const auto absent = grid.query(Aabb::fromCenter({70, 70}, {2, 2}));
        check(absent.empty(), "无命中");
    }
    {
        // 3) 对生成：去重 + id 有序
        SpatialGrid grid(10.0f, 4, 4);
        grid.insert(1, Aabb::fromCenter({0, 0}, {9, 9}));
        grid.insert(2, Aabb::fromCenter({5, 5}, {9, 9}));
        grid.insert(3, Aabb::fromCenter({0, 0}, {1, 1}));
        const auto pairs = grid.pairs();
        check(pairs.size() == 3, "三对候选");
        bool saw12 = false, saw13 = false, saw23 = false;
        for (const auto& [x, y] : pairs) {
            check(x < y, "id 有序");
            if (x == 1 && y == 2) saw12 = true;
            if (x == 1 && y == 3) saw13 = true;
            if (x == 2 && y == 3) saw23 = true;
        }
        check(saw12 && saw13 && saw23, "全部候选对");
        // 边界外 cell 忽略
        grid.insert(9, Aabb::fromCenter({100, 100}, {5, 5}));
        check(grid.query(Aabb::fromCenter({100, 100}, {2, 2})).empty(), "越界 cell 忽略");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (physics)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
