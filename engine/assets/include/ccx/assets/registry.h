#pragma once
#include <cstdint>
#include <vector>

namespace ccx::assets {

enum class AssetType : uint8_t {
    Texture = 1,
    Atlas,
    Sprite,
    Audio,
    Material,
    Shader,
    Scene,
};

// 句柄：槽位 + 版本（销毁后旧句柄失效）
struct AssetHandle {
    uint32_t index = 0;
    uint32_t version = 0;
    bool operator==(const AssetHandle&) const = default;
};

struct AssetEntry {
    AssetType type{};
    uint32_t assetId = 0;      // 资产定义 id（如图集 id）
    size_t byteSize = 0;
    bool loaded = false;       // 数据是否已就绪
    uint32_t generation = 0;
};

// runtime 资产注册表（固定容量句柄池；加载/卸载计数）
class AssetRegistry {
public:
    explicit AssetRegistry(uint32_t capacity = 4096);

    AssetHandle create(AssetType type, uint32_t assetId, size_t byteSize);
    void destroy(AssetHandle h);            // 幂等；版本 +1
    const AssetEntry* lookup(AssetHandle h) const;
    const AssetEntry* lookupOrNull(AssetHandle h) const { return lookup(h); }
    uint32_t count() const { return count_; }
    uint32_t capacity() const { return capacity_; }

    // 负载状态维护（加载完成/卸载）
    void markLoaded(AssetHandle h);
    void markUnloaded(AssetHandle h);

private:
    struct Slot {
        AssetEntry entry{};
        uint32_t version = 0;
        bool used = false;
    };
    uint32_t nextFreeSlot() const;

    std::vector<Slot> slots_;
    uint32_t capacity_;
    uint32_t count_ = 0;
    uint32_t searchCursor_ = 0;
};

}  // namespace ccx::assets
