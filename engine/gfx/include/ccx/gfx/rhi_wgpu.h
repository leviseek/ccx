#pragma once
#include <map>

#include "ccx/gfx/rhi.h"

namespace ccx::gfx {

// 真后端（W1）：wgpu-native（Vulkan 底层）Device 实现。
// 同步轮询封装（无窗口 offscreen 纹理目标）；清屏/回读与 FakeDevice 语义一致（黄金对照）。
class WgpuDevice : public Device {
public:
    WgpuDevice();
    ~WgpuDevice() override;

    Handle createBuffer(const BufferDesc& desc) override;
    Handle createTexture(const TextureDesc& desc) override;
    void destroy(Handle h) override;
    bool upload(Handle buffer, const void* data, uint32_t size, uint32_t offset) override;
    void clear(Handle texture, uint32_t rgba) override;
    bool readback(Handle texture, void* out, uint32_t bytes) override;
    void beginFrame() override;
    uint32_t submit() override;

private:
    void* instance_ = nullptr;  // WGPUInstance
    void* adapter_ = nullptr;   // WGPUAdapter
    void* device_ = nullptr;    // WGPUDevice
    void* queue_ = nullptr;     // WGPUQueue
    uint32_t nextHandle_ = 1;
    uint32_t frames_ = 0;
    struct Buffer { void* wgpu = nullptr; uint32_t size = 0; };
    struct Texture { void* wgpu = nullptr; uint32_t w = 0; uint32_t h = 0; };
    std::map<Handle, Buffer> buffers_;
    std::map<Handle, Texture> textures_;
    void poll();
};

}  // namespace ccx::gfx
