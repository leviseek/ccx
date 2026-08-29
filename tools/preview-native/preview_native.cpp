// CCX 桌面预览器（本机原生窗口；Windows 实现/其他 OS 预留）——预览任意 ADR-003 场景
// 用法: preview_native <scene.json> [--scale N] [--watch] [--headless [--out x.ppm]] [--wgpu]
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include <ctime>
#include <thread>
#include <chrono>

#include "ccx/gfx/rhi.h"
#include "ccx/render/camera.h"
#include "ccx/render/packer.h"
#include "ccx/render/raster.h"
#include "ccx/scene/scene.h"
#include "ccx/scene/schema.h"
#include "ccx/platform/bridge.h"

#if defined(_WIN32)
#include "display_win32.h"
#endif

using namespace ccx;
using namespace ccx::render;
using namespace ccx::scene;

static int parseArgs(int argc, char** argv, std::string& scenePath, int& scale, bool& watch,
                     bool& headless, std::string& outPpm, bool& wgpu) {
    scenePath.clear(); scale = 2; watch = false; headless = false; wgpu = false;
    for (int i = 1; i < argc; ++i) {
        const std::string a = argv[i];
        if (a == "--scale" && i + 1 < argc) { scale = std::atoi(argv[++i]); }
        else if (a == "--watch") watch = true;
        else if (a == "--headless") headless = true;
        else if (a == "--wgpu") wgpu = true;
        else if (a == "--out" && i + 1 < argc) outPpm = argv[++i];
        else if (!scenePath.empty()) return -1;
        else scenePath = a;
    }
    return scenePath.empty() ? -1 : 0;
}

static bool loadScene(const std::string& path, Scene& scene, std::string& err) {
    FILE* f = std::fopen(path.c_str(), "rb");
    if (!f) { err = "open failed"; return false; }
    std::string text; char buf[4096]; size_t n;
    while ((n = std::fread(buf, 1, sizeof buf, f)) > 0) text.append(buf, n);
    std::fclose(f);
    return loadSceneFile(json::parse(text), scene, err);
}

// 引擎渲染装配（与 frame_dump 同管线；软件光栅出帧；wgpu 可选真后端读回）
static bool renderScene(const Scene& scene, int W, int H, std::vector<uint32_t>& pixels, bool devMode) {
    std::vector<RenderItem> items;
    for (const EntityId id : scene.renderOrder()) {
        const json::Value* spr = scene.component(id, "ccx.Sprite");
        if (!spr) continue;
        RenderItem it;
        it.atlas = static_cast<uint32_t>(spr->find("atlas")->asNumber());
        it.material = static_cast<uint32_t>(spr->find("material")->asNumber());
        it.pos = scene.worldTransform(id).pos;
        it.tint = it.atlas == 1 ? Color{1, 0, 0, 1} : it.atlas == 2 ? Color{1, 0.84f, 0, 1} : Color{0.5f, 0.5f, 0.5f, 1};
        it.size = 64.0f;
        items.push_back(it);
    }
    const PackResult pk = packItems(items);
    RasterTarget target(static_cast<uint32_t>(W), static_cast<uint32_t>(H));
    target.clear(0x2020E8FFu);
    OrthoCamera cam{-static_cast<float>(W) / 2, static_cast<float>(W) / 2,
                    -static_cast<float>(H) / 2, static_cast<float>(H) / 2};
    rasterizeQuads(pk, target, cam);
    pixels.assign(target.pixels.begin(), target.pixels.end());
    (void)devMode;  // v1 软件光栅上屏；--wgpu 路径后续接 WgpuDevice 读回
    return true;
}

static bool writePpm(const std::string& path, const std::vector<uint32_t>& px, int W, int H) {
    FILE* f = std::fopen(path.c_str(), "wb");
    if (!f) return false;
    std::fprintf(f, "P6\n%d %d\n255\n", W, H);
    for (uint32_t p : px) {
        const uint8_t r = static_cast<uint8_t>((p >> 24) & 0xFF);
        const uint8_t g = static_cast<uint8_t>((p >> 16) & 0xFF);
        const uint8_t b = static_cast<uint8_t>((p >> 8) & 0xFF);
        std::fputc(r, f); std::fputc(g, f); std::fputc(b, f);
    }
    std::fclose(f);
    return true;
}

int main(int argc, char** argv) {
    std::string scenePath, outPpm;
    int scale = 2; bool watch = false, headless = false, wgpu = false;
    if (parseArgs(argc, argv, scenePath, scale, watch, headless, outPpm, wgpu) != 0) {
        std::fprintf(stderr, "usage: preview_native <scene.json> [--scale N] [--watch] [--headless --out x.ppm] [--wgpu]\n");
        return 2;
    }
    Scene scene; std::string err;
    if (!loadScene(scenePath, scene, err)) {
        std::fprintf(stderr, "load failed: %s\n", err.c_str());
        return 1;
    }
    const int W = 480 * scale < 1920 ? 480 * scale : 1920;
    const int H = 270 * scale < 1080 ? 270 * scale : 1080;

    std::vector<uint32_t> pixels;
    if (!renderScene(scene, W, H, pixels, wgpu)) return 1;
    if (headless) {
        if (outPpm.empty()) outPpm = "preview.ppm";
        writePpm(outPpm, pixels, W, H);
        std::printf("headless frame: %d x %d -> %s\n", W, H, outPpm.c_str());
        return 0;
    }

#if defined(_WIN32)
    // 原生窗口预览（Windows）
    platform::Win32Display disp;
    if (!disp.create(L"CCX 场景预览（Windows 原生）", static_cast<uint32_t>(W), static_cast<uint32_t>(H))) {
        std::fprintf(stderr, "window create failed\n");
        return 1;
    }
    std::time_t lastMtime = 0;
    bool quit = false;
    while (disp.pump(quit) && !quit) {
        if (watch) {
            std::time_t m = std::time(nullptr);
            if (m != lastMtime) { lastMtime = m; }
            // 简化 watch：每秒轮询重载
            Scene scene2; std::string err2;
            if (loadScene(scenePath, scene2, err2)) { scene = scene2; }
        }
        if (!renderScene(scene, W, H, pixels, wgpu)) break;
        disp.present(reinterpret_cast<const uint8_t*>(pixels.data()), W, H);
        std::this_thread::sleep_for(std::chrono::milliseconds(16));
    }
#else
    std::printf("native window preview is available on Windows; other OS preview via: ccx preview <scene> (Web)\n");
    return 0;
#endif
    return 0;
}
