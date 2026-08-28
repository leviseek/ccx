// W7 插槽/附件：skins region -> 渲染消费 atlas 映射
#include <cstdio>

#include "ccx/animation/spine_loader.h"

using namespace ccx;
using namespace ccx::animation;

int main() {
    int failures = 0;
    const auto check = [&](bool ok, const char* what) {
        if (!ok) { std::printf("FAIL: %s\n", what); ++failures; }
    };
    const std::string jsonText =
        "{\"bones\":[{\"name\":\"root\"}],\n"
        " \"slots\":[{\"name\":\"body\"},{\"name\":\"head\"}],\n"
        " \"skins\":{\"default\":{\"body\":{\"hero-body\":{\"path\":\"hero/body.png\"}},\n"
        "   \"head\":{\"hero-head\":{\"path\":\"hero/head.png\"}}}},\n"
        " \"animations\":{\"idle\":{\"bones\":{\"root\":{\"translate\":[[0,0,0],[1,10,0]]}}}}}\n";
    Skeleton sk;
    std::string err;
    check(loadSpineSkeleton(json::parse(jsonText), sk, err), "加载");
    check(sk.slots.size() == 2, "两插槽");
    check(sk.slots[0].slot == "body" && sk.slots[0].attachment == "hero-body", "body 附件");
    check(sk.slots[1].attachment == "hero-head", "head 附件");
    check(sk.slots[0].atlas > 0 && sk.slots[0].atlas != sk.slots[1].atlas, "附件 atlas 占位区分");

    if (failures == 0) {
        std::printf("ALL TESTS PASSED (spine slots)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", failures);
    return 1;
}
