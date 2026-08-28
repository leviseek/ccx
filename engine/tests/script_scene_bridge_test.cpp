// 脚本 -> 引擎命令桥（W5b 第二环）：eval 中调用 ccxSceneCommand(json) 驱动场景
#include <cstdio>
#include <string>
#include <vector>

#include "ccx/foundation/serialization/json.h"
#include "ccx/script/host.h"

using namespace ccx;
using namespace ccx::script;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}

// C++ 迷你场景命令总线（就地：create_entity / add_component / snapshot）
struct MiniScene {
    int nextId = 1;
    struct Entity { int id; std::string name; std::vector<std::string> components; };
    std::vector<Entity> entities;
    int find(const char* name) const {
        for (const auto& e : entities) {
            if (e.name == name) return static_cast<int>(e.id);
        }
        return -1;
    }
    std::string apply(const std::string& jsonIn);
    std::string snapshotJson;
};
MiniScene gScene;
std::string gLastResult;

std::string MiniScene::apply(const std::string& jsonIn) {
    const auto cmd = json::parse(jsonIn);
    const auto op = cmd.find("op");
    if (!op || op->kind() != json::Kind::String) return "{\"ok\":false,\"error\":\"no op\"}";
    const std::string s = op->asString();
    if (s == "create_entity") {
        const json::Value* name = cmd.find("name");
        Entity e;
        e.id = nextId++;
        e.name = name && name->kind() == json::Kind::String ? name->asString() : "entity";
        entities.push_back(e);
        return "{\"ok\":true,\"id\":" + std::to_string(e.id) + ",\"entities\":" +
               std::to_string(entities.size()) + "}";
    }
    if (s == "add_component") {
        const json::Value* name = cmd.find("name");
        const std::string n = name && name->kind() == json::Kind::String ? name->asString() : "";
        const int id = gScene.find(n.c_str());
        if (id < 0) return "{\"ok\":false,\"error\":\"entity not found\"}";
        const json::Value* type = cmd.find("type");
        gScene.entities[static_cast<size_t>(id) - 1].components.push_back(
            type && type->kind() == json::Kind::String ? type->asString() : "unknown");
        return "{\"ok\":true,\"entities\":" + std::to_string(entities.size()) + "}";
    }
    if (s == "snapshot") {
        return "{\"entities\":" + std::to_string(entities.size()) + "}";
    }
    return "{\"ok\":false,\"error\":\"unknown op\"}";
}
const char* sceneCommandBridge(const char* jsonIn) {
    gLastResult = gScene.apply(jsonIn ? jsonIn : "{}");
    return gLastResult.c_str();
}
}  // namespace

// 快照模式（--dump）：固定脚本命令序列 -> 单行 JSON（跨语言对拍用）
std::string runFixedSequence() {
    ScriptHost host;
    host.setJsonFunction("ccxSceneCommand", &sceneCommandBridge);
    host.eval("ccxSceneCommand('{\"op\":\"create_entity\",\"name\":\"hero\"}')");
    host.eval("ccxSceneCommand('{\"op\":\"create_entity\",\"name\":\"npc\"}')");
    host.eval("ccxSceneCommand('{\"op\":\"add_component\",\"name\":\"hero\",\"type\":\"game.Health\"}')");
    gScene.entities.clear();
    gScene.nextId = 1;
    host.eval("ccxSceneCommand('{\"op\":\"create_entity\",\"name\":\"hero\"}')");
    host.eval("ccxSceneCommand('{\"op\":\"create_entity\",\"name\":\"npc\"}')");
    host.eval("ccxSceneCommand('{\"op\":\"add_component\",\"name\":\"hero\",\"type\":\"game.Health\"}')");
    std::string names = "[";
    for (size_t i = 0; i < gScene.entities.size(); ++i) {
        if (i) names += ",";
        names += "\"" + gScene.entities[i].name + "\"";
    }
    names += "]";
    return "{\"entities\":" + std::to_string(gScene.entities.size()) + ",\"names\":" + names + "}";
}

int main(int argc, char** argv) {
    if (argc >= 2 && std::string(argv[1]) == "--dump") {
        std::printf("%s\n", runFixedSequence().c_str());
        return 0;
    }
    ScriptHost host;
    host.setJsonFunction("ccxSceneCommand", &sceneCommandBridge);
    // 1) 脚本建实体
    const auto r1 = host.eval(
        "ccxSceneCommand('{\"op\":\"create_entity\",\"name\":\"hero\"}')");
    check(r1.find("ok")->asBool() &&
              r1.find("value")->asString().find("\"ok\":true") != std::string::npos,
          "脚本 create_entity 返回 ok");
    // 2) 加组件
    const auto r2 = host.eval(
        "ccxSceneCommand('{\"op\":\"add_component\",\"name\":\"hero\",\"type\":\"game.Health\"}')");
    check(r2.find("ok")->asBool() &&
              r2.find("value")->asString().find("\"ok\":true") != std::string::npos,
          "脚本 add_component 返回 ok");
    // 3) 快照
    const auto r3 = host.eval("ccxSceneCommand('{\"op\":\"snapshot\"}')");
    check(r3.find("ok")->asBool() &&
              r3.find("value")->asString().find("\"entities\":1") != std::string::npos,
          "快照实体数 1");
    // 4) 集成确认：C++ 侧实体与组件在场
    check(gScene.entities.size() == 1 && gScene.entities[0].components.size() == 1,
          "C++ 场景实际更新");
    // 5) 错误路径：未知实体
    const auto r5 = host.eval(
        "ccxSceneCommand('{\"op\":\"add_component\",\"name\":\"ghost\"}')");
    check(r5.find("ok")->asBool() &&
              r5.find("value")->asString().find("\"ok\":false") != std::string::npos,
          "未知实体错误进入脚本");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (scene command bridge)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
