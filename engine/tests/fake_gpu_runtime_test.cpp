// 假 GPU 运行时：GameLoop 固定步驱动场景 -> 每 render 帧 packer 缓冲 -> FakeDevice 上传/清屏/绘制/提交 -> metrics
#include <cstdio>
#include <vector>

#include "ccx/ecs/scheduler.h"
#include "ccx/ecs/world.h"
#include "ccx/foundation/metrics.h"
#include "ccx/game/game_loop.h"
#include "ccx/gfx/rhi.h"
#include "ccx/render/camera.h"
#include "ccx/render/packer.h"
#include "ccx/render/raster.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::ecs;
using namespace ccx::game;
using namespace ccx::gfx;
using namespace ccx::metrics;
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
    constexpr uint32_t kW = 160, kH = 90;
    Scene scene;
    const EntityId hero = scene.createNode("hero");
    scene.setComponent(hero, "ccx.Sprite", json::parse("{\"atlas\":1,\"material\":1}"));

    World world;
    float heroX = 0.0f;
    Scheduler sched;
    sched.add({"move", Stage::Simulation, {}, {},
               [&](World&, float) {
                   heroX += 5.0f;  // 每固定步 +5 世界单位
                   scene.setLocalTransform(hero, {{heroX, 0.0f}, 0, {1, 1}});
               }});

    FakeDevice dev;
    const Handle target = dev.createTexture({TextureDesc::Rgba8, kW, kH});
    Handle vb = kInvalidHandle;
    Handle ib = kInvalidHandle;
    GameLoop loop({0.05f, 4});
    FrameMetrics metrics;
    OrthoCamera cam{-80.0f, 80.0f, -45.0f, 45.0f};
    uint32_t submitted = 0;

    for (int rf = 1; rf <= 3; ++rf) {
        loop.step(0.1f, [&](float) { sched.execute(world, 0.05f); });
        // 渲染收集 + 打包
        std::vector<RenderItem> items;
        for (const EntityId id : scene.renderOrder()) {
            const json::Value* spr = scene.component(id, "ccx.Sprite");
            if (!spr) continue;
            RenderItem it;
            it.atlas = static_cast<uint32_t>(spr->find("atlas")->asNumber());
            it.material = static_cast<uint32_t>(spr->find("material")->asNumber());
            it.pos = scene.worldTransform(id).pos;
            it.size = 64.0f;
            it.tint = {1.0f, 0.0f, 0.0f, 1.0f};
            items.push_back(it);
        }
        const auto pk = packItems(items);
        // 动态缓冲（首帧创建，之后重传）
        if (vb == kInvalidHandle) {
            vb = dev.createBuffer({BufferDesc::Vertex, pk.vertexCount() * 24, true});
            ib = dev.createBuffer({BufferDesc::Index, pk.indexCount() * 4, false});
        }
        check(dev.upload(vb, pk.vertices.data(), pk.vertexCount() * 24, 0), "顶点重传");
        dev.beginFrame();
        dev.clear(target, 0x2020E8FFu);
        // 模拟绘制（真后端 = draw call）
        RasterTarget rt(kW, kH);
        rt.clear(0x2020E8FFu);
        rasterizeQuads(pk, rt, cam);
        for (uint32_t y = 0; y < kH; ++y) {
            for (uint32_t x = 0; x < kW; ++x) {
                dev.putPixel(target, static_cast<int>(x), static_cast<int>(y), rt.get(x, y));
            }
        }
        submitted = dev.submit();
        metrics.recordFrame({static_cast<uint32_t>(rf), 10.0f, world.entityCount(),
                             1, 1, pk.vertexCount() * 24});
    }
    check(loop.frameCount() == 3, "3 render 帧");
    check(submitted == 3, "3 帧已提交到设备");
    check(metrics.last() != nullptr && metrics.last()->drawCalls == 1, "metrics 记账 draw");

    // 最终帧像素：hero x=30（6 固定步 × 5）-> 屏 x=80+30=110，quad 78..142
    std::vector<uint32_t> px(kW * kH, 0);
    check(dev.readback(target, px.data(), px.size() * 4), "读回");
    check(px[45 * kW + 110] == 0xFF0000FFu, "最终帧 hero 新位置红（x=110）");
    check(px[45 * kW + 70] == 0x2020E8FFu, "旧位置已是蓝底（quad 外）");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (fake gpu runtime)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
