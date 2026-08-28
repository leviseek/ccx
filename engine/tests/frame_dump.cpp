// 虚拟帧导出工具：场景 -> 光栅 -> PPM（"看到第一帧"）
// 用法：ccx_frame_dump <scene.json> <out.ppm> <width> <height>
// stdout 单行 JSON：{quads, width, height, ppm}
#include <cstdio>
#include <string>
#include <vector>

#include <algorithm>
#include <set>
#include <vector>
#include "ccx/gfx/rhi.h"
#ifdef CCX_WGPU_BACKEND
#include "ccx/gfx/rhi_wgpu.h"
#endif
#include "ccx/render/camera.h"
#include "ccx/render/packer.h"
#include "ccx/render/raster.h"
#include "ccx/scene/collision.h"
#include "ccx/scene/schema.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::physics;
using namespace ccx::render;
using namespace ccx::scene;

namespace {
// atlas id -> 演示色（M1 无纹理解码；M2 由真实贴图采样替代）
Color colorFor(uint32_t atlas) {
    switch (atlas) {
        case 1: return {1.0f, 0.0f, 0.0f, 1.0f};     // 红
        case 2: return {1.0f, 0.84f, 0.0f, 1.0f};    // 金
        default: return {0.5f, 0.5f, 0.5f, 1.0f};    // 灰
    }
}
// 精灵帧号 -> 演示色（tint 替代贴图采样；M2 由真实纹理 UV 采样替代）
Color frameColor(uint32_t frame) {
    switch (frame % 4) {
        case 0: return {1.0f, 0.0f, 0.0f, 1.0f};     // 红
        case 1: return {0.0f, 1.0f, 0.0f, 1.0f};     // 绿
        case 2: return {0.0f, 0.0f, 1.0f, 1.0f};     // 蓝
        default: return {1.0f, 1.0f, 0.0f, 1.0f};    // 黄
    }
}
}  // namespace

int main(int argc, char** argv) {
    if (argc < 4) {
        std::fprintf(stderr, "usage: ccx_frame_dump <scene.json> <out.ppm> <width> <height>\n");
        return 2;
    }
    FILE* f = std::fopen(argv[1], "rb");
    if (!f) {
        std::fprintf(stderr, "open failed: %s\n", argv[1]);
        return 2;
    }
    std::string text;
    char buf[4096];
    size_t n;
    while ((n = std::fread(buf, 1, sizeof buf, f)) > 0) text.append(buf, n);
    std::fclose(f);

    Scene scene;
    std::string err;
    if (!loadSceneFile(json::parse(text), scene, err)) {
        std::fprintf(stderr, "load failed: %s\n", err.c_str());
        return 1;
    }
    const int W = std::atoi(argv[3]);
    const int H = std::atoi(argv[4]);
    if (W <= 0 || H <= 0) return 2;

    // 可选时间参数：ccx.CurveAnim 组件（线性轨 pos.x：{t0,v0,t1,v1}）驱动位置
    const float animTime = argc >= 6 ? static_cast<float>(std::atof(argv[5])) : 0.0f;

    // --contacts 模式：先应用曲线到节点变换，再跑正式碰撞获得接触对（自动高亮）
    std::set<uint32_t> contactSet;
    const bool contactsMode = argc >= 8 && std::string(argv[7]) == "1";
    if (contactsMode) {
        for (const EntityId id : scene.renderOrder()) {
            const json::Value* curve = scene.component(id, "ccx.CurveAnim");
            if (!curve) continue;
            const json::Value* t0 = curve->find("t0");
            const json::Value* v0 = curve->find("v0");
            const json::Value* t1 = curve->find("t1");
            const json::Value* v1 = curve->find("v1");
            if (!(t0 && v0 && t1 && v1)) continue;
            const float a = t0->asNumber();
            const float b = t1->asNumber();
            const float u = (b > a) ? ((animTime - a) / (b - a)) : 0.0f;
            const float clamped = u < 0.0f ? 0.0f : (u > 1.0f ? 1.0f : u);
            const Vec2 p0 = scene.worldTransform(id).pos;
            const float dx = v0->asNumber() + clamped * (v1->asNumber() - v0->asNumber());
            scene.setLocalTransform(id, {{p0.x + dx, p0.y}, 0, {1, 1}});
        }
        SpatialGrid cgrid(32.0f, 16, 16);
        const auto contacts = runCollisionSim(scene, cgrid);
        for (const ContactEvent& c : contacts) {
            contactSet.insert(c.a);
            contactSet.insert(c.b);
        }
    }

    std::vector<RenderItem> items;
    for (const EntityId id : scene.renderOrder()) {
        const json::Value* spr = scene.component(id, "ccx.Sprite");
        if (!spr) continue;
        RenderItem it;
        it.atlas = static_cast<uint32_t>(spr->find("atlas")->asNumber());
        it.material = static_cast<uint32_t>(spr->find("material")->asNumber());
        it.pos = scene.worldTransform(id).pos;
        // 高亮：手动列表（--highlight）或接触自动（--contacts）
    const bool highlighted = contactsMode
        ? (contactSet.find(id.index) != contactSet.end())
        : (argc >= 7 && std::string(argv[6]).find(
                               std::to_string(id.index)) != std::string::npos);
    // 精灵帧动画：ccx.SpriteAnimator {cols,rows,frameCount,fps,startFrame} -> 帧号 -> 色块
    const json::Value* anim = scene.component(id, "ccx.SpriteAnimator");
    if (anim != nullptr && anim->find("frameCount") != nullptr) {
        const float fps = anim->find("fps") ? anim->find("fps")->asNumber() : 10.0f;
        const uint32_t frameCount =
            static_cast<uint32_t>(anim->find("frameCount")->asNumber());
        uint32_t frame = 0;
        if (fps > 0.0f && frameCount > 0) {
            // 帧边界取整（0.1*10=0.99999 的浮点坑）
            frame = static_cast<uint32_t>(animTime * fps + 0.5f) % frameCount;
        }
        it.tint = frameColor(frame);
    } else {
        it.tint = colorFor(it.atlas);
    }
    if (highlighted) it.tint = {1.0f, 1.0f, 1.0f, 1.0f};  // 接触高亮：白
    const json::Value* curve = scene.component(id, "ccx.CurveAnim");
        if (curve != nullptr) {
            const json::Value* t0 = curve->find("t0");
            const json::Value* v0 = curve->find("v0");
            const json::Value* t1 = curve->find("t1");
            const json::Value* v1 = curve->find("v1");
            if (t0 && v0 && t1 && v1) {
                const float a = t0->asNumber();
                const float b = t1->asNumber();
                const float u = (b > a) ? ((animTime - a) / (b - a)) : 0.0f;
                const float clamped = u < 0.0f ? 0.0f : (u > 1.0f ? 1.0f : u);
                it.pos.x += v0->asNumber() + clamped * (v1->asNumber() - v0->asNumber());
            }
        }
        it.size = 64.0f;
        items.push_back(it);
    }
    const auto pk = packItems(items);
    RasterTarget target(static_cast<uint32_t>(W), static_cast<uint32_t>(H));
    target.clear(0x2020E8FFu);  // 深蓝底（RRGGBBAA）
    OrthoCamera cam{-static_cast<float>(W) / 2.0f, static_cast<float>(W) / 2.0f,
                    -static_cast<float>(H) / 2.0f, static_cast<float>(H) / 2.0f};
    const bool deviceMode = argc >= 9 && std::string(argv[8]) == "1";
    const bool wgpuMode = argc >= 10 && std::string(argv[9]) == "wgpu";
    rasterizeQuads(pk, target, cam);
    if (deviceMode && !wgpuMode) {
        // 设备路径：缓冲上传 -> 清屏 -> 绘制提交 -> 读回（仿真后端）
        gfx::FakeDevice device;
        const gfx::Handle vb = device.createBuffer(
            {gfx::BufferDesc::Vertex, pk.vertexCount() * 24, true});
        const gfx::Handle ib = device.createBuffer(
            {gfx::BufferDesc::Index, pk.indexCount() * 4, false});
        if (!device.upload(vb, pk.vertices.data(), pk.vertexCount() * 24, 0)) return 1;
        if (!device.upload(ib, pk.indices.data(), pk.indexCount() * 4, 0)) return 1;
        const gfx::Handle tex = device.createTexture(
            {gfx::TextureDesc::Rgba8, static_cast<uint32_t>(W), static_cast<uint32_t>(H)});
        device.beginFrame();
        device.clear(tex, 0x2020E8FFu);
        for (int y = 0; y < H; ++y) {
            for (int x = 0; x < W; ++x) {
                device.putPixel(tex, x, y, target.get(x, y));
            }
        }
        device.submit();
        std::vector<uint32_t> px(static_cast<size_t>(W) * H, 0);
        if (!device.readback(tex, px.data(), px.size() * 4)) return 1;
        std::copy(px.begin(), px.end(), target.pixels.begin());
    } else if (wgpuMode) {
#ifdef CCX_WGPU_BACKEND
        // 真后端（W1）：黄金帧整帧上传 GPU -> 读回（真实 GPU 数据面承载帧）
        gfx::WgpuDevice device;
        const gfx::Handle tex = device.createTexture(
            {gfx::TextureDesc::Rgba8, static_cast<uint32_t>(W), static_cast<uint32_t>(H)});
        device.beginFrame();
        if (!device.uploadTexture(tex, target.pixels.data(), target.pixels.size() * 4)) return 1;
        device.submit();
        std::vector<uint32_t> px(static_cast<size_t>(W) * H, 0);
        if (!device.readback(tex, px.data(), px.size() * 4)) return 1;
        std::copy(px.begin(), px.end(), target.pixels.begin());
        // L5 帧统计：帧数/上传次数/上传字节（profiler 面）
        if (!writePpm(target, argv[2])) return 1;
        std::string ppmW(argv[2]);
        for (char& cw : ppmW) {
            if (cw == '\\') cw = '/';
        }
        std::printf("{\"quads\":%zu,\"width\":%d,\"height\":%d,\"ppm\":\"%s\","
                    "\"gpuStats\":{\"frames\":%u,\"uploads\":%u,\"bytes\":%llu}}\n",
                    items.size(), W, H, ppmW.c_str(), device.frames(), device.uploads(),
                    static_cast<unsigned long long>(device.bytesUploaded()));
        return 0;
#else
        std::fprintf(stderr, "wgpu 后端未构建（无 CCX_WGPU_BACKEND）\n");
        return 1;
#endif
    }
    // M3 pixel-art 后处理：argv[10] = "scale:bits"（如 "3:2"）-> 整数缩放 + dither
    if (argc >= 11) {
        const std::string pa(argv[10]);
        const std::size_t colon = pa.find(':');
        const unsigned scale = static_cast<unsigned>(
            std::atoi(pa.substr(0, colon).c_str()));
        const unsigned bits = static_cast<unsigned>(
            std::atoi(pa.substr(colon + 1).c_str()));
        if (scale >= 1 && bits >= 1 && bits <= 8) {
            RasterTarget art;
            pixelArtChain(target, art, scale, bits);
            target = art;
        }
    }
    if (!writePpm(target, argv[2])) {
        std::fprintf(stderr, "write failed: %s\n", argv[2]);
        return 1;
    }
    // JSON 安全：Windows 反斜杠路径需规整（fopen 接受正斜杠）
    std::string ppmOut(argv[2]);
    for (char& c : ppmOut) {
        if (c == '\\') c = '/';
    }

std::printf("{\"quads\":%zu,\"width\":%d,\"height\":%d,\"ppm\":\"%s\"}\n",
                items.size(), W, H, ppmOut.c_str());
    return 0;
}