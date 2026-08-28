#pragma once
#include <cstdint>
#include <map>
#include <vector>

namespace ccx::gfx {

// RHI 抽象（M2 W1 接口核）：Device/缓冲/纹理的最小契约；无 GPU 环境用 FakeDevice 验证。
// 与现有数据面映射：PackedVertex -> createBuffer(upload)、OrthoCamera -> uniform(buffer)，
// RasterTarget 语义 -> clear/readback（黄金对照）。
using Handle = uint32_t;
constexpr Handle kInvalidHandle = 0;

struct BufferDesc {
    enum Usage { Vertex = 1, Index, Uniform };
    Usage usage = Vertex;
    uint32_t size = 0;
    bool dynamic = false;
};

struct TextureDesc {
    enum Format { Rgba8 = 1 };
    Format format = Rgba8;
    uint32_t width = 0;
    uint32_t height = 0;
};

class Device {
public:
    virtual ~Device() = default;
    virtual Handle createBuffer(const BufferDesc& desc) = 0;
    virtual Handle createTexture(const TextureDesc& desc) = 0;
    virtual void destroy(Handle h) = 0;
    virtual bool upload(Handle buffer, const void* data, uint32_t size, uint32_t offset = 0) = 0;
    virtual void clear(Handle texture, uint32_t rgba) = 0;
    virtual bool readback(Handle texture, void* out, uint32_t bytes) = 0;
    virtual void beginFrame() = 0;
    virtual uint32_t submit() = 0;  // 返回已提交帧数
};

// 软件实现：内存缓冲 + 纹理像素缓存；接口契约与黄金对照的双重验证
class FakeDevice : public Device {
public:
    Handle createBuffer(const BufferDesc& desc) override;
    Handle createTexture(const TextureDesc& desc) override;
    void destroy(Handle h) override;
    bool upload(Handle buffer, const void* data, uint32_t size, uint32_t offset) override;
    void clear(Handle texture, uint32_t rgba) override;
    bool readback(Handle texture, void* out, uint32_t bytes) override;
    void beginFrame() override { ++frame_; }
    uint32_t submit() override { return frame_; }
    // 绘制模拟（真后端 = draw call）：逐像素写入（含越界忽略）
    void putPixel(Handle texture, int x, int y, uint32_t rgba) {
        const auto it = textures_.find(texture);
        if (it == textures_.end()) return;
        if (x < 0 || y < 0 || x >= static_cast<int>(it->second.w) ||
            y >= static_cast<int>(it->second.h)) {
            return;
        }
        it->second.pixels[static_cast<size_t>(y) * it->second.w + static_cast<size_t>(x)] = rgba;
    }

    uint32_t bufferCount() const { return static_cast<uint32_t>(buffers_.size()); }
    uint32_t textureCount() const { return static_cast<uint32_t>(textures_.size()); }
    uint32_t frames() const { return frame_; }

private:
    struct Buffer { std::vector<uint8_t> data; };
    struct Texture { uint32_t w = 0; uint32_t h = 0; std::vector<uint32_t> pixels; };
    uint32_t nextHandle_ = 1;
    std::map<Handle, Buffer> buffers_;
    std::map<Handle, Texture> textures_;
    uint32_t frame_ = 0;
};

}  // namespace ccx::gfx
