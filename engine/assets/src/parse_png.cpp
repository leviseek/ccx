#include "ccx/assets/parse_png.h"

namespace ccx::assets {

bool parsePngSize(const uint8_t* data, size_t len, uint32_t& width, uint32_t& height) {
    // 签名 + 长度 + IHDR + 宽高需要 16..24 字节；留足 24
    if (len < 24 || data == nullptr) return false;
    const uint8_t sig[8] = {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
    for (int i = 0; i < 8; ++i) {
        if (data[i] != sig[i]) return false;
    }
    if (data[12] != 'I' || data[13] != 'H' || data[14] != 'D' || data[15] != 'R') {
        return false;
    }
    width = (static_cast<uint32_t>(data[16]) << 24) |
            (static_cast<uint32_t>(data[17]) << 16) |
            (static_cast<uint32_t>(data[18]) << 8) |
            static_cast<uint32_t>(data[19]);
    height = (static_cast<uint32_t>(data[20]) << 24) |
             (static_cast<uint32_t>(data[21]) << 16) |
             (static_cast<uint32_t>(data[22]) << 8) |
             static_cast<uint32_t>(data[23]);
    return width > 0 && height > 0;
}

}  // namespace ccx::assets
