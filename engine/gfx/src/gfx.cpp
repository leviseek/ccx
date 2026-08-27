#include "ccx/gfx/gfx.h"

#include <algorithm>
#include <cmath>

namespace ccx::gfx {

std::optional<std::string> validateTexture(const TextureDesc& d, const Caps& caps) {
    if (d.width == 0 || d.height == 0) {
        return std::string("纹理尺寸必须 > 0");
    }
    if (d.width > caps.maxTextureSize || d.height > caps.maxTextureSize) {
        return std::string("纹理尺寸超过能力上限（maxTextureSize=") +
               std::to_string(caps.maxTextureSize) + "）";
    }
    const auto fmt = std::find(caps.supportedFormats.begin(), caps.supportedFormats.end(),
                               d.format);
    if (fmt == caps.supportedFormats.end()) {
        return std::string("格式不被当前设备支持");
    }
    if (d.samples != 1 && d.samples != 2 && d.samples != 4 && d.samples != 8) {
        return std::string("samples 必须为 1/2/4/8");
    }
    if (d.mipLevels == 0) {
        return std::string("mipLevels 必须 >= 1");
    }
    // mip 不能超过尺寸可容纳级数
    const uint32_t maxMips =
        static_cast<uint32_t>(std::floor(std::log2(std::max(d.width, d.height)))) + 1;
    if (d.mipLevels > maxMips) {
        return std::string("mipLevels 超出尺寸可容纳级数");
    }
    return std::nullopt;
}

std::optional<std::string> validateBuffer(const BufferDesc& d, const Caps& caps) {
    (void)caps;
    if (d.size == 0) {
        return std::string("缓冲尺寸必须 > 0");
    }
    if (static_cast<uint32_t>(d.usage) == 0) {
        return std::string("必须声明用途（usage）");
    }
    if (d.size % 4 != 0) {
        return std::string("缓冲尺寸必须 4 字节对齐");
    }
    return std::nullopt;
}

Handle HandlePool::alloc() {
    if (!free_.empty()) {
        const uint32_t idx = free_.back();
        free_.pop_back();
        versions_[idx] = versions_[idx] == 0 ? 1 : versions_[idx];
        return Handle{idx, versions_[idx]};
    }
    const uint32_t idx = static_cast<uint32_t>(versions_.size());
    versions_.push_back(1);
    return Handle{idx, 1};
}

void HandlePool::release(Handle h) {
    if (!valid(h)) return;
    ++versions_[h.index];           // 使旧句柄失效
    if (versions_[h.index] == 0) ++versions_[h.index];
    free_.push_back(h.index);
}

bool HandlePool::valid(Handle h) const {
    return h.index < versions_.size() && versions_[h.index] != 0 &&
           versions_[h.index] == h.version;
}

size_t HandlePool::liveCount() const { return versions_.size() - free_.size(); }

}  // namespace ccx::gfx
