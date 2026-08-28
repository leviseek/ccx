// SpriteBatch 打包测试（渲染提交 CPU 侧：批/顶点/索引/UV/变换/染色）
#include <cmath>
#include <cstdio>
#include <vector>

#include "ccx/render/packer.h"

using namespace ccx::render;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
bool near(float a, float b) { return std::fabs(a - b) < 1e-4f; }
}  // namespace

int main() {
    {
        // 1) 批结构与顶点/索引规模：3 items（2 同键 + 1 异键）-> 2 批，12 顶点 18 索引
        std::vector<RenderItem> items = {
            {1, 1, {0, 0}, 0.0f, {1, 1}, {0, 0, 1, 1}, {1, 1, 1, 1}, 1.0f},
            {1, 1, {2, 0}, 0.0f, {1, 1}, {0, 0, 1, 1}, {1, 1, 1, 1}, 1.0f},
            {2, 1, {4, 0}, 0.0f, {1, 1}, {0, 0, 0.5f, 0.5f}, {1, 1, 1, 1}, 2.0f},
        };
        const auto p = packItems(items);
        check(p.batches.size() == 2, "2 批");
        check(p.batches[0].count == 2 && p.batches[1].count == 1, "批计数");
        check(p.vertexCount() == 12 && p.indexCount() == 18, "12 顶点 / 18 索引");
        // 第 3 item：pos=(4,0) size=2 -> 顶点 x∈[3,5]，y∈[-1,1]
        check(near(p.vertices[8].x, 3.0f) && near(p.vertices[9].x, 5.0f) &&
                  near(p.vertices[8].y, -1.0f) && near(p.vertices[9].y, -1.0f),
              "size=2 的 quad 范围（含 pos 偏移）");
    }
    {
        // 2) UV 与染色
        std::vector<RenderItem> items = {
            {1, 1, {0, 0}, 0.0f, {1, 1}, {0.25f, 0.0f, 0.5f, 1.0f}, {1.0f, 0.5f, 0.25f, 1.0f}, 1.0f},
        };
        const auto p = packItems(items);
        check(near(p.vertices[0].u, 0.25f) && near(p.vertices[1].u, 0.5f), "uv u0/u1");
        check(near(p.vertices[0].v, 0.0f) && near(p.vertices[2].v, 1.0f), "uv v");
        check(p.vertices[0].r == 255 && p.vertices[0].g == 127 && p.vertices[0].b == 63,
              "tint 转字节（0.25*255=63.75 截断 63）");
    }
    {
        // 3) 旋转 90 度：右上角 (-0.5,-0.5)+rot90 -> (0.5,-0.5)（逆时针）
        const float pi = 3.14159265f;
        std::vector<RenderItem> items = {
            {1, 1, {0, 0}, pi / 2.0f, {1, 1}, {0, 0, 1, 1}, {1, 1, 1, 1}, 1.0f},
        };
        const auto p = packItems(items);
        // 局部 (0.5,-0.5) 旋转 90° = (0.5, 0.5)
        check(near(p.vertices[1].x, 0.5f) && near(p.vertices[1].y, 0.5f), "旋转后顶点位置");
        check(near(p.vertices[2].x, -0.5f) && near(p.vertices[2].y, 0.5f), "第二顶点旋转");
    }
    {
        // 4) 空输入
        const auto p = packItems({});
        check(p.batches.empty() && p.vertexCount() == 0, "空输入");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (packer)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
