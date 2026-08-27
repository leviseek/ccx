// ECS 最小实现测试（engine-spec §3、ADR-002）
#include <cstdio>
#include <vector>

#include "ccx/ecs/command_buffer.h"
#include "ccx/ecs/entity.h"
#include "ccx/ecs/world.h"
#include "ccx/foundation/reflection/ccx_type.h"

using namespace ccx::ecs;

struct Health {
    float max = 100.0f;
    float current = 100.0f;
};
CCX_TYPE(Health,
    (CCX_PROP(&Health::max, "max", {})),
    (CCX_PROP(&Health::current, "current", {})))

struct Position {
    float x = 0.0f;
    float y = 0.0f;
};
CCX_TYPE(Position,
    (CCX_PROP(&Position::x, "x", {})),
    (CCX_PROP(&Position::y, "y", {})))

struct Tag {};
CCX_TYPE(Tag)

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
    World w;

    // 1) 创建/销毁/版本
    {
        const Entity e1 = w.create();
        check(w.valid(e1), "创建后有效");
        const uint32_t v1 = e1.version;
        w.destroy(e1);
        check(!w.valid(e1), "销毁后无效");
        const Entity e2 = w.create();
        check(e2.index == e1.index && e2.version == v1 + 1, "索引复用且版本递增");
        check(!w.valid(Entity{e2.index, v1}), "旧版本句柄无效");
        w.destroy(e2);
        check(w.entityCount() == 0, "计数归零");
    }

    // 2) 组件 add/get/migrate（数据跨 archetype 迁移保持）
    const Entity e = w.create();
    w.add<Health>(e);
    check(w.has<Health>(e), "add 后 has");
    w.get<Health>(e).max = 55.0f;
    w.get<Health>(e).current = 12.0f;
    w.add<Position>(e);  // 触发迁移
    check(w.has<Health>(e) && w.has<Position>(e), "迁移后双组件存在");
    check(w.get<Health>(e).max == 55.0f && w.get<Health>(e).current == 12.0f,
          "迁移后 Health 数据保持");
    check(w.get<Position>(e).x == 0.0f, "新组件默认构造");
    w.remove<Health>(e);
    check(!w.has<Health>(e) && w.has<Position>(e), "remove 后组件移除");
    w.remove<Health>(e);  // 幂等
    check(w.has<Position>(e), "重复 remove 幂等");

    // 3) query：1000 实体广播 + 混合签名 + 中间删除（chunk 扩容路径）
    {
        std::vector<Entity> ents;
        float sum = 0.0f;
        for (int i = 0; i < 1000; ++i) {
            const Entity q = w.create();
            w.add<Health>(q);
            w.get<Health>(q).current = static_cast<float>(i);
            ents.push_back(q);
        }
        size_t n = 0;
        w.query<Health>([&](Entity, Health& h) { ++n; sum += h.current; });
        check(n == 1000, "query<Health> 命中 1000（跨 chunk 扩容）");
        check(sum == 499500.0f, "query 求和正确");

        const Entity one = w.create();
        w.add<Health>(one);
        w.add<Position>(one);
        size_t both = 0;
        w.query<Health, Position>([&](Entity, Health&, Position&) { ++both; });
        check(both == 1, "混合签名只命中双组件者");
        check(w.count<Health>() == 1001, "count<Health> = 1001");

        w.destroy(ents[500]);
        check(!w.valid(ents[500]), "中间实体销毁");
        check(w.valid(ents[0]) && w.valid(ents[999]) && w.valid(one), "其余实体完好");
        check(w.count<Health>() == 1000, "count 随之 -1");
        w.destroy(one);
    }

    // 4) CommandBuffer：create/add 延迟生效；apply 前 destroy 的占位实体整体丢弃
    {
        CommandBuffer cb(w);
        const Entity a = cb.create();
        cb.add<Health>(a);
        const Entity b = cb.create();
        cb.add<Health>(b);
        cb.destroy(b);
        check(!w.valid(a), "apply 前占位未生效");
        cb.apply();
        check(w.valid(a) && w.has<Health>(a), "apply 后 create+add 生效");
        check(!w.valid(b), "apply 前 destroy 的实体不激活且其 op 无副作用");
        w.destroy(a);
    }

    // 5) 空组件 Tag
    {
        const Entity t = w.create();
        w.add<Tag>(t);
        check(w.has<Tag>(t), "空组件 add/has");
        size_t tags = 0;
        w.query<Tag>([&](Entity, Tag&) { ++tags; });
        check(tags == 1, "空组件 query");
        w.remove<Tag>(t);
        check(!w.has<Tag>(t), "空组件 remove");
        w.destroy(t);
    }

    // 6) 批量清理（保序销毁不破坏其余实体）
    {
        std::vector<Entity> all;
        w.query<Health>([&](Entity ent, Health&) { all.push_back(ent); });
        for (const Entity x : all) w.destroy(x);
        // 剩余：e（仅 Position）
        check(w.entityCount() == 1, "清理后仅剩无 Health 的 e");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (ecs minimal)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
