// 资产注册表驱动渲染：资产条目 -> 渲染项尺寸/UV（asset-driven rendering，renderer-spec §5 边界）
#include <cmath>
#include <cstdio>
#include <vector>

#include "ccx/assets/registry.h"
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
bool near(float a, float b) { return std::fabs(a - b) < 1e-4f; }
}  // namespace

// 精灵资产 -> 基础尺寸约定：byteSize 为 RGBA 像素字节数 -> 边长 = sqrt(bytes/4)
float sideFor(size_t bytes) { return std::sqrt(static_cast<float>(bytes) / 4.0f); }

int main() {
    AssetRegistry reg(16);
    // hero: 64x64 纹理 = 16384 字节；coin: 32x32 = 4096 字节
    const AssetHandle heroTex = reg.create(AssetType::Texture, 1, 64 * 64 * 4);
    const AssetHandle coinTex = reg.create(AssetType::Texture, 2, 32 * 32 * 4);
    const AssetHandle atlas = reg.create(AssetType::Atlas, 1, 0);
    reg.markLoaded(heroTex);
    reg.markLoaded(coinTex);

    // 渲染项从资产注册表取尺寸（v1 约定：atlas 中精灵为无损正方形 -> size=边长）
    std::vector<RenderItem> items;
    {
        RenderItem hero;
        hero.atlas = atlas.index;
        hero.material = 1;
        hero.pos = {0, 0};
        hero.size = sideFor(reg.lookup(heroTex)->byteSize);
        items.push_back(hero);
    }
    {
        RenderItem coin;
        coin.atlas = atlas.index;
        coin.material = 1;
        coin.pos = {100, 0};
        coin.size = sideFor(reg.lookup(coinTex)->byteSize);
        items.push_back(coin);
    }
    const auto pk = packItems(items);
    check(pk.vertexCount() == 8, "2 精灵 8 顶点");
    // hero quad: (-32..32)；coin quad: (-16..16) 且 x 偏移 100
    check(near(pk.vertices[0].x, -32.0f) && near(pk.vertices[1].x, 32.0f), "hero 64 宽");
    check(near(pk.vertices[4].x, 84.0f) && near(pk.vertices[5].x, 116.0f), "coin 32 宽（含偏移）");
    check(reg.lookup(heroTex)->loaded && reg.lookup(coinTex)->loaded, "资产已加载状态");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (asset-driven render)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
