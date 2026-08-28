#include "ccx/render/packer.h"

#include <cmath>

namespace ccx::render {

namespace {
// 局部坐标（逆时针 quad）：(-0.5,-0.5)..(0.5,0.5) * size，再经 pos/rotZ/scale 变换
void emitQuad(PackResult& out, const RenderItem& item, uint32_t itemIndex) {
    const uint32_t base = out.vertexCount();
    const float cosR = std::cos(item.rotZ);
    const float sinR = std::sin(item.rotZ);
    const float hw = item.size * 0.5f;
    // 局部四角（bounds 由 uv 宽高比外显，v1 方形）
    const float lx[4] = {-hw, hw, hw, -hw};
    const float ly[4] = {-hw, -hw, hw, hw};
    const float u[4] = {item.uv.u0, item.uv.u1, item.uv.u1, item.uv.u0};
    const float v[4] = {item.uv.v0, item.uv.v0, item.uv.v1, item.uv.v1};
    for (int k = 0; k < 4; ++k) {
        const float sx = lx[k] * item.scale.x;
        const float sy = ly[k] * item.scale.y;
        PackedVertex pv;
        pv.x = item.pos.x + sx * cosR - sy * sinR;
        pv.y = item.pos.y + sx * sinR + sy * cosR;
        pv.u = u[k];
        pv.v = v[k];
        pv.r = static_cast<uint8_t>(item.tint.r * 255.0f);
        pv.g = static_cast<uint8_t>(item.tint.g * 255.0f);
        pv.b = static_cast<uint8_t>(item.tint.b * 255.0f);
        pv.a = static_cast<uint8_t>(item.tint.a * 255.0f);
        out.vertices.push_back(pv);
    }
    const uint32_t idx[6] = {base, base + 1, base + 2, base, base + 2, base + 3};
    for (const uint32_t i : idx) out.indices.push_back(i);
    (void)itemIndex;
}

}  // namespace

PackResult packItems(const std::vector<RenderItem>& items) {
    PackResult out;
    // 1) 批（同键连续段）
    std::vector<SpriteInst> insts;
    insts.reserve(items.size());
    for (const RenderItem& it : items) insts.push_back({it.atlas, it.material});
    out.batches = buildBatches(insts);
    // 2) 顶点/索引
    uint32_t itemIndex = 0;
    for (const RenderItem& it : items) {
        emitQuad(out, it, itemIndex);
        ++itemIndex;
    }
    return out;
}

}  // namespace ccx::render
