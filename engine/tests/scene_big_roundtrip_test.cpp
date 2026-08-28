// v1.0 基准4（roadmap §8.2）：10 万实体场景 JSON round-trip 全等 + Git 结构化 diff 可演示
#include <chrono>
#include <cstdio>
#include <string>

#include "ccx/foundation/serialization/json.h"
#include "ccx/scene/schema.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::scene;

namespace {
int g_fail = 0;
void check(bool ok, const char* what) {
    if (!ok) { std::printf("FAIL: %s\n", what); ++g_fail; }
}
double msSince(std::chrono::steady_clock::time_point t0) {
    return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
}
}  // namespace

int main() {
    constexpr int kEntities = 100000;
    Scene scene;

    // —— 1) 构建 10 万实体（每实体 Sprite + Transform）——
    {
        const auto t0 = std::chrono::steady_clock::now();
        for (int i = 0; i < kEntities; ++i) {
            const EntityId id = scene.createNode("n" + std::to_string(i));
            json::Value::ObjectEntries spr;
            spr.emplace_back("atlas", json::Value::number(1 + (i % 4)));
            spr.emplace_back("material", json::Value::number(1));
            scene.setComponent(id, "ccx.Sprite", json::Value::object(std::move(spr)));
            scene.setLocalTransform(id, {{static_cast<float>(i), 0.0f}, 0, {1, 1}});
        }
        const double dt = msSince(t0);
        std::printf("roundtrip: build 100k scene: %.1f ms\n", dt);
        check(scene.nodeCount() == static_cast<size_t>(kEntities), "10 万节点在场");
    }

    // —— 2) save -> load（ADR-003）——
    json::Value saved;
    Scene loaded;
    {
        auto t0 = std::chrono::steady_clock::now();
        saved = saveSceneFile(scene);
        const double dtSave = msSince(t0);
        std::printf("roundtrip: save 100k: %.1f ms (%.1f MB)\n", dtSave,
                    static_cast<double>(json::dump(saved).size()) / (1024.0 * 1024.0));

        t0 = std::chrono::steady_clock::now();
        std::string err;
        check(loadSceneFile(saved, loaded, err), "10 万实体场景装载");
        const double dtLoad = msSince(t0);
        std::printf("roundtrip: load 100k: %.1f ms\n", dtLoad);
    }

    // —— 3) 全等校验：节点数 + 抽样实体组件/变换 + 完整 dump 相等 ——
    {
        check(loaded.nodeCount() == static_cast<size_t>(kEntities), "装载后 10 万节点");
        // 抽样：0 / 49999 / 99999 的 Sprite 组件 + 变换
        for (int i : {0, 49999, 99999}) {
            const EntityId id{static_cast<uint32_t>(i)};
            const json::Value* spr = loaded.component(id, "ccx.Sprite");
            check(spr != nullptr && spr->find("atlas")->asNumber() == 1 + (i % 4),
                  "抽样组件 atlas 一致");
            const WorldTransform w = loaded.worldTransform(id);
            check(w.pos.x == static_cast<float>(i), "抽样变换一致");
        }
        // 完整 JSON 全等（round-trip 无信息损失）
        const json::Value saved2 = saveSceneFile(loaded);
        check(json::dump(saved) == json::dump(saved2), "save(load(save)) 全等");
    }

    if (g_fail == 0) { std::printf("ALL ROUNDTRIP GATES PASSED\n"); return 0; }
    std::printf("%d ROUNDTRIP GATE FAILURE(S)\n", g_fail);
    return 1;
}
