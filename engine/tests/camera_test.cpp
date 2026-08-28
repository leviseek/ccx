// 正交相机/视口测试（world -> NDC -> screen）
#include <cmath>
#include <cstdio>

#include "ccx/render/camera.h"

using namespace ccx::render;
using namespace ccx;

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
        // 1) 居中视口：世界 (0,0) -> 屏幕中心
        OrthoCamera cam{-400.0f, 400.0f, -225.0f, 225.0f};
        const Vec2 vp{800.0f, 450.0f};
        const Vec2 sc = cam.worldToScreen({0.0f, 0.0f}, vp);
        check(near(sc.x, 400.0f) && near(sc.y, 225.0f), "世界原点 -> 屏幕中心");
        const Vec2 tr = cam.worldToScreen({400.0f, 225.0f}, vp);
        check(near(tr.x, 800.0f) && near(tr.y, 0.0f), "右上角 -> (800, 0)（y 向下）");
    }
    {
        // 2) 相机平移：视口右移后世界点映射变化
        OrthoCamera cam{100.0f - 400.0f, 100.0f + 400.0f, -225.0f, 225.0f};
        const Vec2 vp{800.0f, 450.0f};
        const Vec2 sc = cam.worldToScreen({100.0f, 0.0f}, vp);
        check(near(sc.x, 400.0f) && near(sc.y, 225.0f), "相机居中于 (100,0)");
    }
    {
        // 3) NDC 范围：世界边界 -> ±1
        OrthoCamera cam{-100.0f, 100.0f, -50.0f, 50.0f};
        const Mat4 proj = cam.projection();
        const Vec2 ndcTL = proj.transformPoint({-100.0f, 50.0f});
        check(near(ndcTL.x, -1.0f) && near(ndcTL.y, 1.0f), "左上 -> (-1, 1)");
        const Vec2 ndcBR = proj.transformPoint({100.0f, -50.0f});
        check(near(ndcBR.x, 1.0f) && near(ndcBR.y, -1.0f), "右下 -> (1, -1)");
        // 正交矩阵权重：1
        Mat4 ids = proj * Mat4::identity();
        check(near(ids.m[15], 1.0f), "单位元乘正交不变");
    }
    {
        // 4) 宽高比：视口大小不影响 NDC（仅屏幕映射）
        OrthoCamera cam{-400.0f, 400.0f, -225.0f, 225.0f};
        const Vec2 vp{1920.0f, 1080.0f};
        const Vec2 sc = cam.worldToScreen({0.0f, 0.0f}, vp);
        check(near(sc.x, 960.0f) && near(sc.y, 540.0f), "高分屏中心");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (camera)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
