// 事件桥（W5b 第三环）：GameLoop 每帧 invoke onUpdate -> 脚本驱动场景命令
#include <cstdio>
#include <string>
#include <vector>

#include "ccx/foundation/serialization/json.h"
#include "ccx/game/game_loop.h"
#include "ccx/script/host.h"

using namespace ccx;
using namespace ccx::game;
using namespace ccx::script;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}

// 迷你场景（同桥测试）：命令字面量执行
int gEntities = 0;
int gNext = 1;
std::string gLastResult;
const char* sceneCommandBridge(const char* jsonIn) {
    const auto cmd = json::parse(jsonIn ? jsonIn : "{}");
    const auto op = cmd.find("op");
    const std::string s = op && op->kind() == json::Kind::String ? op->asString() : "";
    if (s == "create_entity") {
        ++gEntities;
        gLastResult = "{\"ok\":true,\"id\":" + std::to_string(gNext++) +
                      ",\"entities\":" + std::to_string(gEntities) + "}";
        return gLastResult.c_str();
    }
    if (s == "snapshot") {
        gLastResult = "{\"entities\":" + std::to_string(gEntities) + "}";
        return gLastResult.c_str();
    }
    gLastResult = "{\"ok\":false,\"error\":\"unknown op\"}";
    return gLastResult.c_str();
}
}  // namespace

int main() {
    ScriptHost host;
    host.setJsonFunction("ccxSceneCommand", &sceneCommandBridge);
    // 脚本：每帧 onUpdate 建一个实体
    const auto boot = host.eval(
        "var tick = 0;\n"
        "function onUpdate(dt) { tick = tick + 1;"
        "  ccxSceneCommand('{\"op\":\"create_entity\",\"name\":\"mob' + tick + '\"}');"
        "  return tick; }");
    check(boot.find("ok")->asBool(), "脚本装载");

    GameLoop loop({0.05f, 4});
    int lastTick = 0;
    for (int f = 1; f <= 5; ++f) {
        loop.step(0.1f, [&](float) {});
        const auto r = host.invoke("onUpdate", "{\"dt\":0.05}");
        check(r.find("ok")->asBool(), "onUpdate 调用成功");
        lastTick = static_cast<int>(r.find("value")->asNumber());
    }
    check(lastTick == 5, "脚本内 tick 计数 5");
    check(gEntities == 5, "脚本驱动场景创建 5 实体");

    // 未定义函数错误面
    const auto missing = host.invoke("nopeFn", "{}");
    check(!missing.find("ok")->asBool() &&
              missing.find("error")->asString().find("no such function") != std::string::npos,
          "未定义函数明确报错");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (script game loop)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
