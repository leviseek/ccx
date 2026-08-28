// 真后端（W1）：wgpu-native Device 实现（同步轮询；offscreen 纹理目标）
#include "ccx/gfx/rhi_wgpu.h"

#include <cstdio>
#include <cstring>
#include <vector>

#include "webgpu.h"

namespace ccx::gfx {

namespace {
// 同步回调状态（RequestAdapter/RequestDevice 轮询）
struct SyncReq {
    bool done = false;
    void* result = nullptr;
    void* ctx = nullptr;
};
void onAdapter(WGPURequestAdapterStatus, WGPUAdapter a, WGPUStringView, void* u1, void*) {
    auto* s = static_cast<SyncReq*>(u1);
    s->result = a;
    s->done = true;
}
void onDevice(WGPURequestDeviceStatus, WGPUDevice d, WGPUStringView, void* u1, void*) {
    auto* s = static_cast<SyncReq*>(u1);
    s->result = d;
    s->done = true;
}
}  // namespace

WgpuDevice::WgpuDevice() {
    WGPUInstanceDescriptor id{};
    id.nextInChain = nullptr;
    instance_ = wgpuCreateInstance(&id);
    if (!instance_) {
        std::fprintf(stderr, "[wgpu] instance 创建失败\n");
        return;
    }
    SyncReq sa;
    WGPURequestAdapterCallbackInfo aci{};
    aci.callback = onAdapter;
    aci.userdata1 = &sa;
    wgpuInstanceRequestAdapter(static_cast<WGPUInstance>(instance_), nullptr, aci);
    while (!sa.done) wgpuInstanceProcessEvents(static_cast<WGPUInstance>(instance_));
    adapter_ = sa.result;
    if (!adapter_) {
        std::fprintf(stderr, "[wgpu] adapter 不可用（无 Vulkan 驱动）\n");
        return;
    }
    WGPUDeviceDescriptor dd{};
    dd.nextInChain = nullptr;
    SyncReq sd;
    WGPURequestDeviceCallbackInfo dci{};
    dci.callback = onDevice;
    dci.userdata1 = &sd;
    wgpuAdapterRequestDevice(static_cast<WGPUAdapter>(adapter_), &dd, dci);
    while (!sd.done) wgpuInstanceProcessEvents(static_cast<WGPUInstance>(instance_));
    device_ = sd.result;
    if (!device_) {
        std::fprintf(stderr, "[wgpu] device 请求失败\n");
        return;
    }
    queue_ = wgpuDeviceGetQueue(static_cast<WGPUDevice>(device_));
}

WgpuDevice::~WgpuDevice() {
    for (auto& [h, b] : buffers_) wgpuBufferDestroy(static_cast<WGPUBuffer>(b.wgpu));
    for (auto& [h, t] : textures_) wgpuTextureDestroy(static_cast<WGPUTexture>(t.wgpu));
    if (device_) wgpuDeviceRelease(static_cast<WGPUDevice>(device_));
    if (instance_) wgpuInstanceRelease(static_cast<WGPUInstance>(instance_));
}

void WgpuDevice::poll() {
    if (instance_) wgpuInstanceProcessEvents(static_cast<WGPUInstance>(instance_));
}

Handle WgpuDevice::createBuffer(const BufferDesc& desc) {
    if (!device_) return kInvalidHandle;
    WGPUBufferDescriptor bd{};
    bd.nextInChain = nullptr;
    bd.size = desc.size;
    bd.usage = WGPUBufferUsage_CopyDst | WGPUBufferUsage_CopySrc;
    bd.mappedAtCreation = false;
    void* buf = wgpuDeviceCreateBuffer(static_cast<WGPUDevice>(device_), &bd);
    const Handle h = nextHandle_++;
    buffers_[h] = { buf, desc.size };
    return h;
}

Handle WgpuDevice::createTexture(const TextureDesc& desc) {
    if (!device_) return kInvalidHandle;
    WGPUTextureDescriptor td{};
    td.nextInChain = nullptr;
    td.dimension = WGPUTextureDimension_2D;
    td.size = { desc.width, desc.height, 1 };
    td.format = WGPUTextureFormat_RGBA8Unorm;
    td.mipLevelCount = 1;
    td.sampleCount = 1;
    td.usage = WGPUTextureUsage_RenderAttachment | WGPUTextureUsage_CopySrc |
               WGPUTextureUsage_CopyDst;
    void* tex = wgpuDeviceCreateTexture(static_cast<WGPUDevice>(device_), &td);
    const Handle h = nextHandle_++;
    textures_[h] = { tex, desc.width, desc.height };
    return h;
}

void WgpuDevice::destroy(Handle h) {
    if (const auto it = buffers_.find(h); it != buffers_.end()) {
        wgpuBufferDestroy(static_cast<WGPUBuffer>(it->second.wgpu));
        buffers_.erase(it);
    } else if (const auto it2 = textures_.find(h); it2 != textures_.end()) {
        wgpuTextureDestroy(static_cast<WGPUTexture>(it2->second.wgpu));
        textures_.erase(it2);
    }
}

bool WgpuDevice::upload(Handle buffer, const void* data, uint32_t size, uint32_t offset) {
    const auto it = buffers_.find(buffer);
    if (it == buffers_.end() || !queue_) return false;
    if (offset + size > it->second.size) return false;
    wgpuQueueWriteBuffer(static_cast<WGPUQueue>(queue_),
                         static_cast<WGPUBuffer>(it->second.wgpu), offset, data, size);
    ++uploads_;
    bytesUploaded_ += size;
    poll();
    return true;
}

bool WgpuDevice::uploadTexture(Handle texture, const void* data, uint32_t bytes) {
    const auto it = textures_.find(texture);
    if (it == textures_.end() || !queue_) return false;
    const uint32_t w = it->second.w, h = it->second.h;
    if (bytes != w * h * 4) return false;
    WGPUTexelCopyTextureInfo dst{};
    dst.texture = static_cast<WGPUTexture>(it->second.wgpu);
    dst.mipLevel = 0;
    dst.origin = {0, 0, 0};
    dst.aspect = WGPUTextureAspect_All;
    WGPUTexelCopyBufferLayout layout{};
    layout.offset = 0;
    layout.bytesPerRow = ((w * 4) + 255u) & ~255u;
    layout.rowsPerImage = h;
    WGPUExtent3D extent{ w, h, 1 };
    // 数据需按对齐布局填充（行尾补零）——wgpu 复制量 = row*(h-1)+w*4
    const uint32_t dataSize = layout.bytesPerRow * (h - 1) + w * 4;
    std::vector<uint8_t> padded(dataSize, 0);
    const auto* src8 = static_cast<const uint8_t*>(data);
    for (uint32_t y = 0; y < h; ++y) {
      std::memcpy(padded.data() + static_cast<size_t>(y) * layout.bytesPerRow,
                  src8 + static_cast<size_t>(y) * w * 4, w * 4);
    }
    wgpuQueueWriteTexture(static_cast<WGPUQueue>(queue_), &dst, padded.data(), dataSize, &layout, &extent);
    ++uploads_;
    bytesUploaded_ += dataSize;
    poll();
    return true;
}

void WgpuDevice::clear(Handle texture, uint32_t rgba) {
    const auto it = textures_.find(texture);
    if (it == textures_.end() || !device_) return;
    WGPUCommandEncoderDescriptor ce{};
    ce.nextInChain = nullptr;
    void* enc = wgpuDeviceCreateCommandEncoder(static_cast<WGPUDevice>(device_), &ce);
    WGPURenderPassDescriptor rp{};
    rp.nextInChain = nullptr;
    WGPURenderPassColorAttachment ca{};
    ca.nextInChain = nullptr;
    ca.view = wgpuTextureCreateView(static_cast<WGPUTexture>(it->second.wgpu), nullptr);
    ca.depthSlice = WGPU_DEPTH_SLICE_UNDEFINED;
    ca.loadOp = WGPULoadOp_Clear;
    ca.storeOp = WGPUStoreOp_Store;
    ca.clearValue = { static_cast<float>((rgba >> 24) & 0xFF) / 255.0f,
                      static_cast<float>((rgba >> 16) & 0xFF) / 255.0f,
                      static_cast<float>((rgba >> 8) & 0xFF) / 255.0f,
                      static_cast<float>(rgba & 0xFF) / 255.0f };
    rp.colorAttachmentCount = 1;
    rp.colorAttachments = &ca;
    void* pass = wgpuCommandEncoderBeginRenderPass(static_cast<WGPUCommandEncoder>(enc), &rp);
    wgpuRenderPassEncoderEnd(static_cast<WGPURenderPassEncoder>(pass));
    wgpuTextureViewRelease(ca.view);
    void* cmd = wgpuCommandEncoderFinish(static_cast<WGPUCommandEncoder>(enc), nullptr);
    wgpuCommandEncoderRelease(static_cast<WGPUCommandEncoder>(enc));
    WGPUCommandBuffer cb0 = static_cast<WGPUCommandBuffer>(cmd);
    wgpuQueueSubmit(static_cast<WGPUQueue>(queue_), 1, &cb0);
    wgpuCommandBufferRelease(cb0);
    poll();
}

bool WgpuDevice::readback(Handle texture, void* out, uint32_t bytes) {
    const auto it = textures_.find(texture);
    if (it == textures_.end() || !device_ || !queue_) return false;
    const uint32_t w = it->second.w, h = it->second.h;
    const uint32_t need = w * h * 4;
    if (bytes < need) return false;
    // bytesPerRow 需 COPY_BYTES_PER_ROW_ALIGNMENT(256) 对齐
    const uint32_t row = ((w * 4) + 255u) & ~255u;
    const uint32_t bufSize = row * h;
    // 中转 buffer：MAP_READ + COPY_SRC；纹理 COPY_SRC → buffer
    WGPUBufferDescriptor bd{};
    bd.nextInChain = nullptr;
    bd.size = bufSize;
    bd.usage = WGPUBufferUsage_CopyDst | WGPUBufferUsage_MapRead;
    bd.mappedAtCreation = false;
    void* tmp = wgpuDeviceCreateBuffer(static_cast<WGPUDevice>(device_), &bd);
    WGPUCommandEncoderDescriptor ce{};
    ce.nextInChain = nullptr;
    void* enc = wgpuDeviceCreateCommandEncoder(static_cast<WGPUDevice>(device_), &ce);
    WGPUTexelCopyTextureInfo src{};
    src.texture = static_cast<WGPUTexture>(it->second.wgpu);
    src.mipLevel = 0;
    src.origin = {0, 0, 0};
    src.aspect = WGPUTextureAspect_All;
    WGPUTexelCopyBufferInfo dst{};
    dst.buffer = static_cast<WGPUBuffer>(tmp);
    dst.layout.offset = 0;
    dst.layout.bytesPerRow = row;
    dst.layout.rowsPerImage = h;
    WGPUExtent3D extent{ w, h, 1 };
    wgpuCommandEncoderCopyTextureToBuffer(static_cast<WGPUCommandEncoder>(enc), &src, &dst, &extent);
    void* cmd = wgpuCommandEncoderFinish(static_cast<WGPUCommandEncoder>(enc), nullptr);
    wgpuCommandEncoderRelease(static_cast<WGPUCommandEncoder>(enc));
    WGPUCommandBuffer cb1 = static_cast<WGPUCommandBuffer>(cmd);
    wgpuQueueSubmit(static_cast<WGPUQueue>(queue_), 1, &cb1);
    wgpuCommandBufferRelease(cb1);
    poll();
    SyncReq sm;
    WGPUBufferMapCallbackInfo mci{};
    mci.callback = [](WGPUMapAsyncStatus, WGPUStringView, void* u1, void*) {
        static_cast<SyncReq*>(u1)->done = true;
    };
    mci.userdata1 = &sm;
    wgpuBufferMapAsync(static_cast<WGPUBuffer>(tmp), WGPUMapMode_Read, 0, bufSize, mci);
    while (!sm.done) poll();
    const void* mapped = wgpuBufferGetConstMappedRange(static_cast<WGPUBuffer>(tmp), 0, bufSize);
    if (mapped) {
      // 逐行拷贝（去除行对齐填充）
      const auto* src8 = static_cast<const uint8_t*>(mapped);
      auto* dst8 = static_cast<uint8_t*>(out);
      for (uint32_t y = 0; y < h; ++y) {
        std::memcpy(dst8 + static_cast<size_t>(y) * w * 4, src8 + static_cast<size_t>(y) * row, w * 4);
      }
    }
    wgpuBufferUnmap(static_cast<WGPUBuffer>(tmp));
    wgpuBufferDestroy(static_cast<WGPUBuffer>(tmp));
    return mapped != nullptr;
}

void WgpuDevice::beginFrame() { ++frames_; }

uint32_t WgpuDevice::submit() { return frames_; }

}  // namespace ccx::gfx
