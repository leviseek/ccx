// 引擎脚本执行器（非 CTest）：命令文件 -> QuickJS + 真实场景桥 -> 场景文件
// 用法：ccx_script_runner <commands.ccx.js> <out.scene.json> [-j]
//  裸命令模式：每行一个 JSON 命令（# 注释）
//  -j 模式：每行一个 JS 表达式（可调 ccxSceneCommand(jsonStr)）
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <sstream>
#include <string>

#include "ccx/foundation/serialization/json.h"
#include "ccx/scene/schema.h"
#include "ccx/script/host.h"
#include "ccx/script/scene_bridge.h"

struct SceneHolder { ccx::scene::Scene target; };
SceneHolder gSceneLoader;
std::string gBridgeLast;

const char* sceneCommandBridge(const char* jsonIn) {
    gBridgeLast = ccx::script::applySceneCommand(gSceneLoader.target, jsonIn ? jsonIn : "{}");
    return gBridgeLast.c_str();
}

int main(int argc, char** argv) {
    if (argc < 3) {
        std::fprintf(stderr, "usage: ccx_script_runner <commands> <out.scene.json> [-j]\n");
        return 2;
    }
    const bool jsMode = argc >= 4 && std::string(argv[3]) == "-j";
    double budgetMs = -1.0;
    for (int i = 4; i < argc; ++i) {
        if (std::string(argv[i]) == "--budget" && i + 1 < argc) {
            budgetMs = std::atof(argv[i + 1]);
        }
    }
    std::ifstream f(argv[1]);
    if (!f) {
        std::fprintf(stderr, "open failed: %s\n", argv[1]);
        return 2;
    }
    std::stringstream ss;
    ss << f.rdbuf();
    const std::string text = ss.str();

    ccx::script::ScriptHost host;
    host.setJsonFunction("ccxSceneCommand", &sceneCommandBridge);
    if (budgetMs >= 0.0) host.setBudgetMs(budgetMs);
    int commands = 0;

    std::istringstream in(text);
    std::string line;
    while (std::getline(in, line)) {
        std::string t = line;
        while (!t.empty() && (t.front() == ' ' || t.front() == '\t')) t.erase(t.begin());
        while (!t.empty() && (t.back() == '\r' || t.back() == '\n')) t.pop_back();
        if (t.empty() || t[0] == '#') continue;
        if (jsMode) {
            const auto r = host.eval(t);
            if (!r.find("ok") || !r.find("ok")->asBool()) {
                std::fprintf(stderr, "line failed: %s\n", t.c_str());
                return 1;
            }
        } else {
            try {
                ccx::json::parse(t);
            } catch (...) {
                std::fprintf(stderr, "bad json: %s\n", t.c_str());
                return 1;
            }
            const std::string out1 = ccx::script::applySceneCommand(gSceneLoader.target, t);
            if (out1.find("\"ok\":false") != std::string::npos) {
                std::fprintf(stderr, "cmd failed: %s\n", out1.c_str());
                return 1;
            }
        }
        ++commands;
    }
    std::ofstream out(argv[2]);
    out << ccx::json::dump(ccx::scene::saveSceneFile(gSceneLoader.target));
    // JSON 安全：Windows 反斜杠路径规整为正斜杠（fopen 兼容）
    std::string outArg(argv[2]);
    for (char& ch : outArg) {
        if (ch == '\\') ch = '/';
    }
    std::printf("{\"commands\":%d,\"entities\":%zu,\"overBudget\":%s,\"out\":\"%s\"}\n",
                commands, gSceneLoader.target.renderOrder().size(), host.overBudget() ? "true" : "false", outArg.c_str());
    return 0;
}
