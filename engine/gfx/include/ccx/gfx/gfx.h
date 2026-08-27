#pragma once
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace ccx::gfx {

// 格式/用途（renderer-spec §2.1 子集，v1 透传校验）
enum class Format : uint8_t { Rgba8, Rgba16f, R32f, D32f, D24S8 };
enum class Usage : uint32_t {
    None = 0,
    RenderTarget = 1u << 0,
    Sampled = 1u << 1,
    Storage = 1u << 2,
    Uniform = 1u << 3,
};
inline Usage operator|(Usage a, Usage b) {
    return static_cast<Usage>(static_cast<uint32_t>(a) | static_cast<uint32_t>(b));
}

// 能力（platform-spec §2；GPU 设备创建后回填，M2）
struct Caps {
    uint32_t maxTextureSize = 4096;
    std::vector<Format> supportedFormats = {Format::Rgba8};
    bool instancing = false;
    bool compute = false;
};

struct TextureDesc {
    Format format = Format::Rgba8;
    uint32_t width = 0;
    uint32_t height = 0;
    uint32_t mipLevels = 1;
    uint32_t samples = 1;
    Usage usage = Usage::RenderTarget | Usage::Sampled;
};

struct BufferDesc {
    uint32_t size = 0;
    Usage usage = Usage::Uniform;
};

// 校验（纯数据，无 GPU 依赖）：返回错误描述或 nullopt
std::optional<std::string> validateTexture(const TextureDesc& d, const Caps& caps);
std::optional<std::string> validateBuffer(const BufferDesc& d, const Caps& caps);

// 句柄（防悬垂：index + version；RHI 资源全走句柄，renderer-spec §2.1）
struct Handle {
    uint32_t index = 0;
    uint32_t version = 0;
};

class HandlePool {
public:
    Handle alloc();
    void release(Handle h);
    bool valid(Handle h) const;
    size_t liveCount() const;
    size_t capacity() const { return versions_.size(); }

private:
    std::vector<uint32_t> versions_;   // index -> 当前版本（0 = 空闲）
    std::vector<uint32_t> free_;
};

}  // namespace ccx::gfx
