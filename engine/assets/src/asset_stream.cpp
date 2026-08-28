// 纹理流送实现（Roadmap M4）：LOD 选择 + 预算逐出（LRU 近似）
#include "ccx/assets/asset_stream.h"

#include <algorithm>

namespace ccx::assets {

namespace {
uint32_t bytesFor(uint32_t w, uint32_t h, LodLevel lod) {
    uint32_t scale = 1;
    if (lod == LodLevel::Half) scale = 2;
    else if (lod == LodLevel::Quarter) scale = 4;
    const uint32_t sw = (w + scale - 1) / scale;
    const uint32_t sh = (h + scale - 1) / scale;
    return sw * sh * 4;  // RGBA8
}
}  // namespace

TextureStreamer::TextureStreamer(uint32_t budgetBytes) : budget_(budgetBytes) {
    if (budget_ == 0) budget_ = 64u * 1024 * 1024;
}

int32_t TextureStreamer::registerTexture(uint32_t assetId, uint32_t width, uint32_t height) {
    if (width == 0 || height == 0) return -1;
    StreamedTexture t;
    t.assetId = assetId;
    t.width = width;
    t.height = height;
    t.lod = LodLevel::Full;
    textures_.push_back(t);
    return static_cast<int32_t>(textures_.size() - 1);
}

LodLevel TextureStreamer::selectLod(int32_t index, uint32_t viewportBytes, uint32_t targetBytes) {
    if (index < 0 || static_cast<size_t>(index) >= textures_.size()) return LodLevel::Quarter;
    const StreamedTexture& t = textures_[static_cast<size_t>(index)];
    // 目标：总预算 targetBytes 内；从 Full 逐级降级直到 fit 或 Quarter
    LodLevel lod = LodLevel::Full;
    for (int l = 0; l <= 2; ++l) {
        const LodLevel cand = static_cast<LodLevel>(l);
        const uint32_t b = bytesFor(t.width, t.height, cand);
        if (b <= targetBytes) { lod = cand; break; }
        lod = cand;
    }
    // 视口小于 Quarter 尺寸则可进一步降级（占位逻辑：Quarter 为下限）
    (void)viewportBytes;
    return lod;
}

void TextureStreamer::touch(int32_t index, uint64_t frame) {
    if (index >= 0 && static_cast<size_t>(index) < textures_.size())
        textures_[static_cast<size_t>(index)].lastUseFrame = frame;
}

int TextureStreamer::tick(uint64_t frame) {
    (void)frame;  // 帧号由调用方传入（预留；LRU 用 lastUseFrame）
    int evicted = 0;
    uint64_t total = 0;
    for (const StreamedTexture& t : textures_) if (t.resident) total += bytesFor(t.width, t.height, t.lod);
    if (total <= budget_) return 0;
    // 逐出：非 Full、最久未用优先（LRU 近似的确定性实现）
    while (total > budget_) {
        int victim = -1;
        uint64_t oldest = UINT64_MAX;
        for (size_t i = 0; i < textures_.size(); ++i) {
            const StreamedTexture& t = textures_[i];
            if (t.resident && t.lod != LodLevel::Full && t.lastUseFrame < oldest) {
                oldest = t.lastUseFrame;
                victim = static_cast<int>(i);
            }
        }
        if (victim < 0) break;  // 无 Full 外可逐（Full 常驻）
        textures_[static_cast<size_t>(victim)].resident = false;
        total -= bytesFor(textures_[static_cast<size_t>(victim)].width,
                          textures_[static_cast<size_t>(victim)].height,
                          textures_[static_cast<size_t>(victim)].lod);
        ++evicted;
    }
    return evicted;
}

void TextureStreamer::evict(int32_t index) {
    if (index >= 0 && static_cast<size_t>(index) < textures_.size())
        textures_[static_cast<size_t>(index)].resident = false;
}

size_t TextureStreamer::residentCount() const {
    size_t n = 0;
    for (const StreamedTexture& t : textures_) if (t.resident) ++n;
    return n;
}

size_t TextureStreamer::totalResidentBytes() const {
    size_t total = 0;
    for (const StreamedTexture& t : textures_) if (t.resident) total += bytesFor(t.width, t.height, t.lod);
    return total;
}

const StreamedTexture* TextureStreamer::get(int32_t index) const {
    if (index < 0 || static_cast<size_t>(index) >= textures_.size()) return nullptr;
    return &textures_[static_cast<size_t>(index)];
}

size_t TextureStreamer::count() const { return textures_.size(); }

}  // namespace ccx::assets
