// 窄相测试：宽相误报过滤 + 接触事件 + 排序
#include <cstdio>

#include "ccx/physics/collision.h"
#include "ccx/physics/contact.h"

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
        // 1) 误报过滤：同 cell 但 AABB 分离 -> 无接触
        SpatialGrid grid(32.0f, 4, 4);
        std::map<uint32_t, Aabb> boxes;
        // hero 40（cell 1），pillar 75（cell 2）——共享 cell? 40/32=1；75/32=2：不共享
        // 构造共享 cell 又分离的：a=0 cell(0,0) 小盒；b=30 cell(0,0) 分离
        boxes[1] = Aabb::fromCenter({0, 0}, {5, 5});
        boxes[2] = Aabb::fromCenter({30, 0}, {5, 5});   // 同 cell 0，AABB 不重叠
        grid.insert(1, boxes[1]);
        grid.insert(2, boxes[2]);
        check(!grid.pairs().empty(), "宽相有候选（同 cell）");
        const auto contacts = narrowPhase(grid, boxes);
        check(contacts.empty(), "窄相过滤误报");
    }
    {
        // 2) 接触事件：重叠对产出 + a<b 排序
        SpatialGrid grid(32.0f, 4, 4);
        std::map<uint32_t, Aabb> boxes;
        boxes[5] = Aabb::fromCenter({0, 0}, {20, 20});
        boxes[7] = Aabb::fromCenter({10, 0}, {20, 20});   // 重叠
        boxes[9] = Aabb::fromCenter({100, 100}, {5, 5});  // 远处
        for (const auto& [id, b] : boxes) grid.insert(id, b);
        const auto contacts = narrowPhase(grid, boxes);
        check(contacts.size() == 1, "一组接触");
        check(contacts[0].a == 5 && contacts[0].b == 7, "接触对 (5,7)");
    }
    {
        // 3) 多对接触：3 重叠链 -> 3 对
        SpatialGrid grid(16.0f, 4, 4);
        std::map<uint32_t, Aabb> boxes;
        boxes[1] = Aabb::fromCenter({0, 0}, {20, 20});
        boxes[2] = Aabb::fromCenter({15, 0}, {20, 20});
        boxes[3] = Aabb::fromCenter({30, 0}, {20, 20});
        for (const auto& [id, b] : boxes) grid.insert(id, b);
        const auto contacts = narrowPhase(grid, boxes);
        check(contacts.size() == 3, "链式三对");
        check(contacts[0].a == 1 && contacts[0].b == 2 && contacts[2].a == 2 &&
                  contacts[2].b == 3,
              "排序稳定");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (narrow phase)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
