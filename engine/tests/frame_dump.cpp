// 虚拟帧导出工具：场景 -> 光栅 -> PPM（"看到第一帧"）
// 用法：ccx_frame_dump <scene.json> <out.ppm> <width> <height>
// stdout 单行 JSON：{quads, width, height, ppm}
#include <cstdio>
#include <string>
#include <vector>

#include "ccx/render/camera.h"
#include "ccx/render/packer.h"
#include "ccx/render/raster.h"
#include "ccx/scene/schema.h"
#include "ccx/scene/scene.h"

using namespace ccx;
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

    std::vector<RenderItem> items;
    for (const EntityId id : scene.renderOrder()) {
        const json::Value* spr = scene.component(id, "ccx.Sprite");
        if (!spr) continue;
        RenderItem it;
        it.atlas = static_cast<uint32_t>(spr->find("atlas")->asNumber());
        it.material = static_cast<uint32_t>(spr->find("material")->asNumber());
        it.pos = scene.worldTransform(id).pos;
        it.size = 64.0f;
        it.tint = colorFor(it.atlas);
        items.push_back(it);
    }
    const auto pk = packItems(items);
    RasterTarget target(static_cast<uint32_t>(W), static_cast<uint32_t>(H));
    target.clear(0x2020E8FFu);  // 深蓝底（RRGGBBAA）
    OrthoCamera cam{-static_cast<float>(W) / 2.0f, static_cast<float>(W) / 2.0f,
                    -static_cast<float>(H) / 2.0f, static_cast<float>(H) / 2.0f};
    rasterizeQuads(pk, target, cam);
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
