#pragma once
// 纹理流送（Roadmap M4：纹理流送完善）——LOD 多级加载 + 内存预算逐出
#include <cstdint>
#include <vector>

namespace ccx::assets {

enum class LodLevel : uint8_t { Full = 0, Half = 1, Quarter = 2 };

// 流送纹理条目（数据面描述；实际像素数据由后端纹理池承载）
struct StreamedTexture {
    uint32_t assetId = 0;
    uint32_t width = 0;
    uint32_t height = 0;
    LodLevel lod = LodLevel::Full;
    bool resident = false;
    uint64_t lastUseFrame = 0;
};

// 流送管理器：按资产注册 LOD 链；selectLod 按视口尺寸/预算选级；
// tick 逐出超预算且长期未用的高 LOD（LRU 近似）
class TextureStreamer {
public:
    explicit TextureStreamer(uint32_t memoryBudgetBytes = 64u * 1024 * 1024);

    // 注册纹理（全量宽高）；返回内部索引（-1 失败）
    int32_t registerTexture(uint32_t assetId, uint32_t width, uint32_t height);
    // 选择 LOD：像素总预算内选最高可容纳级别（Full->Half->Quarter 降级）
    LodLevel selectLod(int32_t index, uint32_t viewportBytes, uint32_t targetBytes);
    // 标记帧使用（LRU 逐出参考）
    void touch(int32_t index, uint64_t frame);
    // 帧尾：若超预算，逐出最旧未用且非 Full 的条目（返回逐出数）
    int tick(uint64_t frame);
    void evict(int32_t index);
    size_t residentCount() const;
    size_t totalResidentBytes() const;
    const StreamedTexture* get(int32_t index) const;
    size_t count() const;

private:
    std::vector<StreamedTexture> textures_;
    uint32_t budget_ = 0;
};

}  // namespace ccx::assets
