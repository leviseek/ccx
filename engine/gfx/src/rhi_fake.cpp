#include "ccx/gfx/rhi.h"

#include <algorithm>
#include <cstring>

namespace ccx::gfx {

Handle FakeDevice::createBuffer(const BufferDesc& desc) {
    const Handle h = nextHandle_++;
    buffers_[h] = Buffer{std::vector<uint8_t>(desc.size, 0)};
    return h;
}

Handle FakeDevice::createTexture(const TextureDesc& desc) {
    const Handle h = nextHandle_++;
    textures_[h] = Texture{desc.width, desc.height,
                           std::vector<uint32_t>(desc.width * desc.height, 0)};
    return h;
}

void FakeDevice::destroy(Handle h) {
    buffers_.erase(h);
    textures_.erase(h);
}

bool FakeDevice::upload(Handle buffer, const void* data, uint32_t size, uint32_t offset) {
    const auto it = buffers_.find(buffer);
    if (it == buffers_.end() || offset + size > it->second.data.size()) return false;
    std::memcpy(it->second.data.data() + offset, data, size);
    return true;
}

void FakeDevice::clear(Handle texture, uint32_t rgba) {
    const auto it = textures_.find(texture);
    if (it == textures_.end()) return;
    std::fill(it->second.pixels.begin(), it->second.pixels.end(), rgba);
}

bool FakeDevice::readback(Handle texture, void* out, uint32_t bytes) {
    const auto it = textures_.find(texture);
    if (it == textures_.end()) return false;
    const size_t need = it->second.pixels.size() * sizeof(uint32_t);
    if (bytes < need) return false;
    std::memcpy(out, it->second.pixels.data(), need);
    return true;
}

}  // namespace ccx::gfx
