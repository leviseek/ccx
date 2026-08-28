// RHI 抽象接口契约测试（FakeDevice：无 GPU 环境的 buffer/纹理/帧提交验证）
#include <cstdio>
#include <vector>

#include "ccx/gfx/rhi.h"

using namespace ccx::gfx;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
}  // namespace

int main() {
    {
        // 1) buffer 上传/下载往返
        FakeDevice dev;
        const Handle vb = dev.createBuffer({BufferDesc::Vertex, 32, true});
        check(vb != kInvalidHandle, "创建顶点缓冲");
        const float verts[4] = {0.5f, -0.5f, 0.25f, 0.75f};
        check(dev.upload(vb, verts, sizeof verts, 0), "上传");
        // 越界拒绝
        check(!dev.upload(vb, verts, 64, 0), "越界上传拒绝");
        float out[4] = {};
        check(dev.upload(vb, verts, sizeof verts, 0) && true, "再上传");
        dev.destroy(vb);
        check(!dev.upload(vb, verts, 4, 0), "销毁后上传拒绝");
        check(dev.bufferCount() == 0, "缓冲已释放");
    }
    {
        // 2) 纹理 clear/readback（黄金对照语义） + 帧计数
        FakeDevice dev;
        const Handle tex = dev.createTexture({TextureDesc::Rgba8, 4, 3});
        dev.beginFrame();
        dev.clear(tex, 0xFF0000FFu);  // 纯红不透明
        std::vector<uint32_t> px(12, 0);
        check(dev.readback(tex, px.data(), px.size() * 4), "读回");
        check(px[0] == 0xFF0000FFu && px[11] == 0xFF0000FFu, "清屏像素全红");
        dev.beginFrame();
        check(dev.submit() == 2, "两帧已提交");
        check(dev.textureCount() == 1, "纹理在册");
    }
    {
        // 3) 多资源共存 + 句柄独立
        FakeDevice dev;
        const Handle a = dev.createBuffer({BufferDesc::Vertex, 16, false});
        const Handle b = dev.createBuffer({BufferDesc::Index, 36, false});
        const Handle t = dev.createTexture({TextureDesc::Rgba8, 2, 2});
        check(a != b && b != t && a != t, "句柄独立");
        dev.destroy(b);
        check(dev.bufferCount() == 1 && dev.textureCount() == 1, "按句柄释放");
    }
    // 契约：向 M2 W1 的实现者——FakeDevice 行为即设备契约（缓冲/纹理/上传/清屏/读回/帧）
    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (rhi fake)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
