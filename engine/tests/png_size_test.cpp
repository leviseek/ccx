// PNG 尺寸解析 + 资产注册表 E2E（IHDR -> byteSize -> 渲染尺寸）
#include <cmath>
#include <cstdio>

#include "ccx/assets/parse_png.h"
#include "ccx/assets/registry.h"

using namespace ccx::assets;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
// 最小 PNG：签名 + IHDR（宽高参数化）
void mkPng(uint8_t* buf, size_t len, uint32_t w, uint32_t h) {
    const uint8_t sig[8] = {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
    for (int i = 0; i < 8; ++i) buf[i] = sig[i];
    buf[8] = 0;
    buf[9] = 0;
    buf[10] = 0;
    buf[11] = 13;
    buf[12] = 'I';
    buf[13] = 'H';
    buf[14] = 'D';
    buf[15] = 'R';
    buf[16] = static_cast<uint8_t>((w >> 24) & 0xFF);
    buf[17] = static_cast<uint8_t>((w >> 16) & 0xFF);
    buf[18] = static_cast<uint8_t>((w >> 8) & 0xFF);
    buf[19] = static_cast<uint8_t>(w & 0xFF);
    buf[20] = static_cast<uint8_t>((h >> 24) & 0xFF);
    buf[21] = static_cast<uint8_t>((h >> 16) & 0xFF);
    buf[22] = static_cast<uint8_t>((h >> 8) & 0xFF);
    buf[23] = static_cast<uint8_t>(h & 0xFF);
    buf[24] = 8;  // bit depth
    buf[25] = 6;  // RGBA
    (void)len;
}
}  // namespace

int main() {
    {
        // 1) 解析 64x48
        uint8_t buf[32] = {};
        mkPng(buf, sizeof buf, 64, 48);
        uint32_t w = 0, h = 0;
        check(parsePngSize(buf, sizeof buf, w, h), "解析成功");
        check(w == 64 && h == 48, "尺寸正确");
    }
    {
        // 2) 坏签名 / 数据不足 / IHDR 缺失
        uint8_t bad[32] = {};
        uint32_t w = 0, h = 0;
        check(!parsePngSize(bad, sizeof bad, w, h), "坏签名拒绝");
        check(!parsePngSize(bad, 8, w, h), "数据不足拒绝");
        uint8_t buf[32] = {};
        mkPng(buf, sizeof buf, 10, 10);
        buf[13] = 'X';  // 破坏 IHDR
        check(!parsePngSize(buf, sizeof buf, w, h), "IHDR 缺失拒绝");
    }
    {
        // 3) E2E：PNG 头 -> 注册表 byteSize -> 渲染边长
        uint8_t buf[32] = {};
        mkPng(buf, sizeof buf, 64, 64);
        uint32_t w = 0, h = 0;
        check(parsePngSize(buf, sizeof buf, w, h), "PNG 解析");
        AssetRegistry reg(8);
        const AssetHandle hero = reg.create(AssetType::Texture, 1, w * h * 4);
        reg.markLoaded(hero);
        const float side = std::sqrt(static_cast<float>(reg.lookup(hero)->byteSize) / 4.0f);
        check(side == 64.0f, "渲染边长 = 64（源自 PNG 头）");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (png size)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
