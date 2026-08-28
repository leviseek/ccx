#include "ccx/assets/registry.h"

namespace ccx::assets {

AssetRegistry::AssetRegistry(uint32_t capacity)
    : slots_(capacity), capacity_(capacity) {}

uint32_t AssetRegistry::nextFreeSlot() const {
    for (uint32_t i = 0; i < capacity_; ++i) {
        const uint32_t idx = (searchCursor_ + i) % capacity_;
        if (idx >= slots_.size()) return capacity_;
        if (!slots_[idx].used) return idx;
    }
    return capacity_;
}

AssetHandle AssetRegistry::create(AssetType type, uint32_t assetId, size_t byteSize) {
    const uint32_t idx = nextFreeSlot();
    if (idx >= capacity_) return {};  // 池满 -> 空句柄
    Slot& s = slots_[idx];
    s.used = true;
    s.entry = {type, assetId, byteSize, false, 0};
    ++count_;
    return {idx, s.version};
}

void AssetRegistry::destroy(AssetHandle h) {
    if (h.index >= capacity_) return;
    Slot& s = slots_[h.index];
    if (!s.used) return;  // 幂等
    s.used = false;
    s.entry = {};
    ++s.version;          // 旧句柄失效
    --count_;
}

const AssetEntry* AssetRegistry::lookup(AssetHandle h) const {
    if (h.index >= capacity_) return nullptr;
    const Slot& s = slots_[h.index];
    if (!s.used || s.version != h.version) return nullptr;
    return &s.entry;
}

void AssetRegistry::markLoaded(AssetHandle h) {
    AssetEntry* e = const_cast<AssetEntry*>(lookup(h));
    if (e) e->loaded = true;
}

void AssetRegistry::markUnloaded(AssetHandle h) {
    AssetEntry* e = const_cast<AssetEntry*>(lookup(h));
    if (e) e->loaded = false;
}

}  // namespace ccx::assets
