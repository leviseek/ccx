// CCX render wasm 入口：引擎软件光栅管线导出（RenderItem -> packer -> OrthoCamera -> RasterTarget）
// C 接口导出（ccx_render_frame）：供 Web/桌面宿主调用；引擎渲染能力跨平台复用
#include <cstdint>
#include <cstring>
#include <vector>

#include "ccx/foundation/math/color.h"
#include "ccx/foundation/math/vec2.h"
#include "ccx/render/camera.h"
#include "ccx/render/packer.h"
#include "ccx/render/raster.h"

using namespace ccx;
using namespace ccx::render;

namespace {
std::vector<RenderItem> g_items;
}

// 矩形批量渲染：每矩形 5 float { x, y, w, h, rgba32 }；世界 y 向下（与 ccx.chrono 一致）
// cam 为视口左上角（世界单位）：{ cam_x, cam_y, view_w, view_h }
extern "C" {

__attribute__((noinline))
void ccx_render_frame(const float* rects, int count,
                      float cam_x, float cam_y, float view_w, float view_h,
                      uint32_t* out) {
    g_items.clear();
    g_items.reserve(static_cast<size_t>(count));
    for (int i = 0; i < count; ++i) {
        const float* r = rects + i * 5;
        RenderItem it;
        it.pos = Vec2{r[0], r[1]};
        it.size = 1.0f;
        it.scale = Vec2{r[2], r[3]};
        const uint32_t rgba32 = *reinterpret_cast<const uint32_t*>(&r[4]);
        const float a = ((rgba32 >> 24) & 0xff) / 255.0f;
        it.tint = Color{
            ((rgba32 >> 16) & 0xff) / 255.0f,
            ((rgba32 >>  8) & 0xff) / 255.0f,
            ((rgba32 >>  0) & 0xff) / 255.0f,
            a,
        };
        g_items.push_back(it);
    }
    const PackResult pk = packItems(g_items);
    const uint32_t W = static_cast<uint32_t>(view_w);
    const uint32_t H = static_cast<uint32_t>(view_h);
    RasterTarget target(W, H);
    target.clear(0xFF101020u);   // 深空底（RGBA）
    // 引擎坐标系 y 向上：视口 top = (view_h - cam_y)，换算传入
    OrthoCamera cam{
        cam_x,
        cam_x + view_w,
        cam_y + view_h,
        cam_y,
    };
    rasterizeQuads(pk, target, cam);
    std::memcpy(out, target.pixels.data(), target.pixels.size() * 4);
}

}  // extern "C"
