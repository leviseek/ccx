// scene 模块测试（engine-spec §4 / ADR-002/003：树、排序、world 变换、Prefab override）
#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

#include "ccx/scene/scene.h"

using namespace ccx::scene;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
bool near(float a, float b) { return std::fabs(a - b) < 1e-4f; }
}  // namespace

int main() {
    {
        // 1) 树结构：创建/父子/销毁
        Scene s;
        const EntityId root = s.createNode("root");
        const EntityId a = s.createNode("a", root);
        const EntityId b = s.createNode("b", root);
        const EntityId a1 = s.createNode("a1", a);
        check(s.nodeCount() == 4, "4 个节点");
        check(s.parentOf(a1) == a, "a1 的父是 a");
        check(s.childrenOf(root).size() == 2, "root 两个子节点");
        check(s.childrenOf(root)[0] == a && s.childrenOf(root)[1] == b, "子序稳定");
        s.destroyNode(a);
        check(s.nodeCount() == 2, "销毁子树后剩 root+b");
        check(s.node(a) == std::nullopt && s.node(a1) == std::nullopt, "子树节点全部移除");
        check(s.childrenOf(root).size() == 1, "父的子列表移除");
    }
    {
        // 2) 2D 排序：renderOrder 按 (layer, sortingOrder) 稳定排序
        Scene s;
        const EntityId root = s.createNode("root");
        const EntityId bg = s.createNode("bg", root);
        const EntityId fg = s.createNode("fg", root);
        const EntityId bgKid = s.createNode("bgKid", bg);
        s.setSorting(fg, 1, 0);
        s.setSorting(bg, 0, -5);
        s.setSorting(bgKid, 0, -2);
        const auto order = s.renderOrder();
        std::string joined;
        for (const EntityId e : order) joined += s.node(e)->name + "|";
        // bg(layer0,-5) < bgKid(layer0,-2) < fg(layer1,0)；root(layer0,0)
        check(joined.find("bg|") < joined.find("bgKid|"), "bg 先于 bgKid");
        check(joined.find("bgKid|") < joined.find("fg|"), "bgKid 先于 fg");
        check(joined.find("fg|") < joined.size(), "fg 存在");
    }
    {
        // 3) world 变换：父移动子跟随；缩放/旋转合成
        Scene s;
        const EntityId root = s.createNode("root");
        const EntityId child = s.createNode("child", root);
        s.setLocalTransform(root, {{10.0f, 0.0f}, 0.0f, {1.0f, 1.0f}});
        s.setLocalTransform(child, {{5.0f, 0.0f}, 0.0f, {2.0f, 1.0f}});
        const auto w = s.worldTransform(child);
        check(near(w.pos.x, 15.0f) && near(w.pos.y, 0.0f), "父子平移合成");
        check(near(w.scale.x, 2.0f), "父子缩放合成");
        // 旋转 90°：本地 (1,0) -> world (0,1)
        Scene s2;
        const EntityId r = s2.createNode("r");
        const EntityId c = s2.createNode("c", r);
        s2.setLocalTransform(r, {{0, 0}, 1.57079632679f, {1, 1}});
        s2.setLocalTransform(c, {{1, 0}, 0.0f, {1, 1}});
        const auto w2 = s2.worldTransform(c);
        check(near(w2.pos.x, 0.0f) && near(w2.pos.y, 1.0f), "旋转 90 度合成");
    }
    {
        // 4) Prefab override（ADR-003 §4.2）：Add/Set/Remove
        Scene templ;
        const EntityId tRoot = templ.createNode("enemy");
        templ.setComponent(tRoot, "game.Health",
                           ccx::json::parse("{\"max\":50,\"current\":50}"));
        templ.setLocalTransform(tRoot, {{0, 0}, 0, {1, 1}});

        Scene world;
        const std::vector<Override> ovs = {
            Override{.op = Override::Op::SetField,
                     .entityId = tRoot.index,
                     .componentType = "game.Health",
                     .fieldPath = {"max"},
                     .value = ccx::json::parse("80")},
            Override{.op = Override::Op::AddComponent,
                     .entityId = tRoot.index,
                     .componentType = "game.Weapon",
                     .value = ccx::json::parse("{\"id\":\"ak47\"}")},
            Override{.op = Override::Op::RemoveComponent,
                     .entityId = tRoot.index,
                     .componentType = "game.Health"},
        };
        const auto inst = world.instantiate(templ, ovs, kNullId);
        check(inst != kNullId, "实例化成功");
        check(world.hasComponent(inst, "game.Weapon"), "Add 组件生效");
        check(!world.hasComponent(inst, "game.Health"), "Remove 组件生效");
    }
    {
        // 5) Prefab 字段链 Set（嵌套对象修改）
        Scene templ;
        const EntityId t = templ.createNode("npc");
        templ.setComponent(t, "game.Character",
                           ccx::json::parse("{\"stats\":{\"hp\":100,\"mp\":50}}"));
        const auto ent = templ.createNode("ent");
        (void)ent;
        Scene world;
        const std::vector<Override> ovs = {
            Override{.op = Override::Op::SetField,
                     .entityId = t.index,
                     .componentType = "game.Character",
                     .fieldPath = {"stats", "hp"},
                     .value = ccx::json::parse("160")},
        };
        const auto inst = world.instantiate(templ, ovs, kNullId);
        const ccx::json::Value* c = world.component(inst, "game.Character");
        check(c != nullptr, "组件存在");
        check(c->find("stats")->find("hp")->asNumber() == 160.0, "字段链 Set 生效");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (scene)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
