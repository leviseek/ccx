#pragma once
#include <cstddef>
#include <cstdint>

namespace ccx::assets {

// PNG 头部尺寸解析（仅读 IHDR；像素解码在 M2 纹理 worker）
// 返回 false：非 PNG / 数据不足 / IHDR 缺失
bool parsePngSize(const uint8_t* data, size_t len, uint32_t& width, uint32_t& height);

}  // namespace ccx::assets
