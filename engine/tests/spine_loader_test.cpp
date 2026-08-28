// W7 Spine JSON 加载：真实格式 -> Skeleton -> 采样
#include <cstdio>
#include <string>

#include "ccx/animation/spine_loader.h"

using namespace ccx;
using namespace ccx::animation;

int main() {
    int failures = 0;
    const auto check = [&](bool ok, const char* what) {
        if (!ok) { std::printf("FAIL: %s\n", what); ++failures; }
    };
    // Spine 3.8 导出片段（bones + animations.walk.bones）
    const std::string jsonText =
        "{\"skeleton\":{\"spine\":\"3.8.99\"},\n"
        " \"bones\":[{\"name\":\"root\"},{\"name\":\"arm\",\"parent\":\"root\"}],\n"
        " \"animations\":{\"walk\":{\"bones\":{\n"
        "   \"root\":{\"translate\":[[0,0,0],[1,40,20]],\"rotate\":[[0,0],[1,90]]},\n"
        "   \"arm\":{\"translate\":[[0,5,0],[1,5,0]],\"rotate\":[[0,0],[1,-30]]}\n"
        " }}}}\n";
    const auto doc = json::parse(jsonText);
    Skeleton sk;
    std::string err;
    check(loadSpineSkeleton(doc, sk, err), ("加载: " + err).c_str());
    check(sk.boneCount() == 2, "两骨骼轨");
    check(sk.tracks[0].name == "root", "首骨骼 root");

    // 采样中点
    const auto p05 = sk.sample(0.5f);
    check(p05.size() == 2, "采样两姿态");
    check(p05[0].x > 19.0f && p05[0].x < 21.0f, "root 中点 x=20");
    check(p05[0].rotation > 44.0f && p05[0].rotation < 46.0f, "root 中点 rot=45");
    check(p05[1].rotation > -16.0f && p05[1].rotation < -14.0f, "arm 中点 rot=-15");
    // 末端
    const auto p1 = sk.sample(1.0f);
    check(p1[0].x == 40.0f && p1[0].rotation == 90.0f, "末端完整");
    // 错误面
    Skeleton bad;
    std::string err2;
    check(!loadSpineSkeleton(json::parse("{}"), bad, err2), "空文档拒绝");

    if (failures == 0) {
        std::printf("ALL TESTS PASSED (spine loader)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", failures);
    return 1;
}
