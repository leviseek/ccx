// gfx CPU 面测试（renderer-spec §2.1/§2.3：描述校验 + 句柄池）
#include <cstdio>

#include "ccx/gfx/gfx.h"

using namespace ccx::gfx;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
bool hasError(const std::optional<std::string>& e, const char* kw) {
    return e.has_value() && e->find(kw) != std::string::npos;
}
}  // namespace

int main() {
    {
        // 校验：合法描述
        Caps caps;
        caps.maxTextureSize = 2048;
        caps.supportedFormats = {Format::Rgba8, Format::D32f};
        TextureDesc ok{Format::Rgba8, 1024, 768, 1, 1, Usage::RenderTarget | Usage::Sampled};
        check(!validateTexture(ok, caps).has_value(), "合法纹理校验通过");
        // 尺寸 0 / 超上限 / 不支持格式 / samples / mip 越界
        TextureDesc z;
        check(hasError(validateTexture(z, caps), "> 0"), "尺寸 0 拒绝");
        TextureDesc big{Format::Rgba8, 4096, 4096, 1, 1, Usage::Sampled};
        check(hasError(validateTexture(big, caps), "上限"), "超上限拒绝");
        TextureDesc badFmt{Format::R32f, 64, 64, 1, 1, Usage::Sampled};
        check(hasError(validateTexture(badFmt, caps), "格式"), "不支持格式拒绝");
        TextureDesc badSamples{Format::Rgba8, 64, 64, 1, 3, Usage::Sampled};
        check(hasError(validateTexture(badSamples, caps), "samples"), "samples=3 拒绝");
        TextureDesc badMips{Format::Rgba8, 4, 4, 8, 1, Usage::Sampled};
        check(hasError(validateTexture(badMips, caps), "mip"), "mip 越界拒绝");
        // 缓冲
        check(hasError(validateBuffer({0, Usage::Uniform}, caps), "> 0"), "缓冲 0 拒绝");
        check(hasError(validateBuffer({8, Usage::None}, caps), "用途"), "无用途拒绝");
        check(hasError(validateBuffer({6, Usage::Uniform}, caps), "对齐"), "非 4 字节对齐拒绝");
        check(!validateBuffer({1024, Usage::Uniform}, caps).has_value(), "合法缓冲通过");
    }
    {
        // 句柄池：复用 + 版本隔离
        HandlePool pool;
        const Handle a = pool.alloc();
        const Handle b = pool.alloc();
        check(pool.liveCount() == 2, "2 个存活句柄");
        pool.release(a);
        check(!pool.valid(a), "释放后旧句柄失效");
        const Handle c = pool.alloc();  // 复用 a 的 index
        check(c.index == a.index && c.version != a.version, "index 复用且版本递增");
        check(pool.valid(c), "新句柄有效");
        check(!pool.valid(b) == false, "b 仍有效");
        pool.release(c);
        pool.release(c);  // 重复释放为 no-op
        check(pool.liveCount() == 1, "释放后存活 1");
        // 无回收路径扩容
        HandlePool grow;
        for (int i = 0; i < 300; ++i) {
            const Handle h = grow.alloc();
            if (i % 2 == 0) grow.release(h);
        }
        check(grow.liveCount() == 150, "扩容后计数正确");
        // 全释放后 liveCount 归零、句柄全部失效
        HandlePool empty;
        Handle x = empty.alloc();
        empty.release(x);
        check(empty.liveCount() == 0, "归零");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (gfx cpu)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
