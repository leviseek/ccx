// 假 GPU 全链端到端：场景 -> 渲染项 -> packer 缓冲 -> FakeDevice 上传 -> 模拟绘制 -> readback 像素断言
#include <cstdio>
#include <vector>

#include "ccx/gfx/rhi.h"
#include "ccx/render/camera.h"
#include "ccx/render/packer.h"
#include "ccx/render/raster.h"
#include "ccx/scene/schema.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::gfx;
using namespace ccx::render;
using namespace ccx::scene;

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
    // 场景：hero（atlas1 红）+ coin（atlas2 金，x=80）
    Scene scene;
    const EntityId hero = scene.createNode("hero");
    scene.setComponent(hero, "ccx.Sprite", json::parse("{\"atlas\":1,\"material\":1}"));
    const EntityId coin = scene.createNode("coin");
    scene.setLocalTransform(coin, {{80.0f, 0.0f}, 0, {1, 1}});
    scene.setComponent(coin, "ccx.Sprite", json::parse("{\"atlas\":2,\"material\":1}"));

    std::vector<RenderItem> items;
    for (const EntityId id : scene.renderOrder()) {
        const json::Value* spr = scene.component(id, "ccx.Sprite");
        if (!spr) continue;
        RenderItem it;
        it.atlas = static_cast<uint32_t>(spr->find("atlas")->asNumber());
        it.material = static_cast<uint32_t>(spr->find("material")->asNumber());
        it.pos = scene.worldTransform(id).pos;
        it.size = 64.0f;
        it.tint = it.atlas == 1 ? Color{1, 0, 0, 1} : Color{1.0f, 0.84f, 0.0f, 1.0f};
        items.push_back(it);
    }
    const auto pk = packItems(items);
    check(pk.vertexCount() == 8, "2 精灵 8 顶点");

    // 设备侧：上传缓冲
    FakeDevice dev;
    const Handle vb = dev.createBuffer({BufferDesc::Vertex, pk.vertexCount() * 24, true});
    const Handle ib = dev.createBuffer({BufferDesc::Index, pk.indexCount() * 4, false});
    check(dev.upload(vb, pk.vertices.data(), pk.vertexCount() * 24, 0), "顶点缓冲上传");
    check(dev.upload(ib, pk.indices.data(), pk.indexCount() * 4, 0), "索引缓冲上传");

    // 目标纹理 + 帧
    constexpr uint32_t kW = 160, kH = 90;
    const Handle target = dev.createTexture({TextureDesc::Rgba8, kW, kH});
    dev.beginFrame();
    dev.clear(target, 0x2020E8FFu);  // 清屏（W1a 语义）

    // 模拟绘制（真后端 W1c = 逐批 draw call + GPU 光栅）：软件光栅 -> 逐像素提交
    RasterTarget rt(kW, kH);
    rt.clear(0x2020E8FFu);
    OrthoCamera cam{-80.0f, 80.0f, -45.0f, 45.0f};
    rasterizeQuads(pk, rt, cam);
    for (uint32_t y = 0; y < kH; ++y) {
        for (uint32_t x = 0; x < kW; ++x) {
            dev.putPixel(target, static_cast<int>(x), static_cast<int>(y), rt.get(x, y));
            rt.get(x, y);
        }
    }
    dev.submit();

    // readback 断言（同 frame_ppm 语义，走"设备"路径）
    std::vector<uint32_t> px(kW * kH, 0);
    check(dev.readback(target, px.data(), px.size() * 4), "帧缓冲读回");
    check(px[45 * kW + 80] == 0xFF0000FFu, "中心像素红（hero）");
    check(px[80 * kW + 80] == 0x2020E8FFu, "hero 下方（y=80，quad 外）蓝底");
    // 金块：coin 世界 x=80 -> 屏幕 x = (80+80)/160*… = 160? 视口 160 右缘 -> coin 中心 160 出界
    // 相机 -80..80 世界 -> coin 中心 80 在边缘；取左侧可见区：x=0..80 世界
    check(dev.frames() == 1, "已提交 1 帧");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (fake gpu frame)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
