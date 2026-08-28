// 屏幕帧全链：资产尺寸 -> 渲染项 -> packer -> 相机 worldToScreen -> 屏幕坐标
// （M2 首帧的最终 CPU 侧坐标全集）
#include <cmath>
#include <cstdio>
#include <vector>

#include "ccx/assets/registry.h"
#include "ccx/render/camera.h"
#include "ccx/render/packer.h"

using namespace ccx;
using namespace ccx::assets;
using namespace ccx::render;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
bool near(float a, float b) { return std::fabs(a - b) < 1e-3f; }
float sideFor(size_t bytes) { return std::sqrt(static_cast<float>(bytes) / 4.0f); }
}  // namespace

int main() {
    AssetRegistry reg(16);
    const AssetHandle heroTex = reg.create(AssetType::Texture, 1, 64 * 64 * 4);
    reg.markLoaded(heroTex);

    OrthoCamera cam{-400.0f, 400.0f, -225.0f, 225.0f};  // 居中，800x450 视口
    const Vec2 vp{800.0f, 450.0f};

    const auto toScreen = [&](const PackedVertex& v) {
        return cam.worldToScreen({v.x, v.y}, vp);
    };

    // hero 位于世界原点
    {
        RenderItem hero;
        hero.pos = {0.0f, 0.0f};
        hero.size = sideFor(reg.lookup(heroTex)->byteSize);
        const auto pk = packItems({hero});
        const Vec2 s0 = toScreen(pk.vertices[0]);  // (-32,-32)
        const Vec2 s2 = toScreen(pk.vertices[2]);  // (32,32)
        check(near(s0.x, 368.0f) && near(s0.y, 257.0f), "左下角 (368,257)");
        check(near(s2.x, 432.0f) && near(s2.y, 193.0f), "右上角 (432,193)");
    }
    // 移动 +100 世界单位 -> 屏幕右移 100*1px/单位 = +100
    {
        RenderItem hero;
        hero.pos = {100.0f, 50.0f};
        hero.size = sideFor(reg.lookup(heroTex)->byteSize);
        const auto pk = packItems({hero});
        const Vec2 s0 = toScreen(pk.vertices[0]);  // (68, 18)
        const Vec2 s2 = toScreen(pk.vertices[2]);  // (132, 82)
        check(near(s0.x, 468.0f) && near(s0.y, 207.0f), "(68,18) -> (468,207)");
        check(near(s2.x, 532.0f) && near(s2.y, 143.0f), "(132,82) -> (532,143)");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (screen frame)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
