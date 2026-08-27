// animation 模块测试（曲线采样 + Sampler 循环 + 驱动场景变换）
#include <cmath>
#include <cstdio>

#include "ccx/animation/clip.h"
#include "ccx/foundation/math/vec2.h"
#include "ccx/scene/scene.h"

using namespace ccx;
using namespace ccx::animation;

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
        // 1) 线性插值 + 端点 + 越界
        Curve c;
        c.keys = {{0.0f, 0.0f}, {1.0f, 10.0f}};
        check(near(sampleCurve(c, 0.5f), 5.0f), "线性中点");
        check(near(sampleCurve(c, -1.0f), 0.0f), "左侧端点");
        check(near(sampleCurve(c, 3.0f), 10.0f), "右侧钳制");
    }
    {
        // 2) 缓动：EaseIn 前段低速，端点一致
        Curve ease;
        ease.keys = {{0.0f, 0.0f, CurveKind::EaseIn}, {1.0f, 100.0f, CurveKind::EaseIn}};
        const float quarter = sampleCurve(ease, 0.5f);   // 0.5^2 * 100 = 25
        check(near(quarter, 25.0f), "EaseIn 中点 = 25");
        check(near(sampleCurve(ease, 1.0f), 100.0f), "EaseIn 端点");
        Curve step;
        step.keys = {{0.0f, 0.0f, CurveKind::Step}, {1.0f, 5.0f, CurveKind::Step}};
        check(near(sampleCurve(step, 0.9f), 5.0f), "Step 直接跳终值");
    }
    {
        // 3) Sampler 循环与钳制
        Clip clip1;
        clip1.name = "walk";
        clip1.duration = 2.0f;
        clip1.tracks["pos.x"].keys = {{0.0f, 0.0f}, {2.0f, 20.0f}};
        Sampler s(clip1);
        s.setTime(1.0f, true);
        check(near(s.sample("pos.x"), 10.0f), "t=1 采样 10");
        s.setTime(3.0f, true);   // 回绕到 1
        check(near(s.sample("pos.x"), 10.0f), "3 秒回绕后仍在 10");
        s.setTime(0.5f, false);  // 钳制模式
        check(near(s.sample("pos.x"), 5.0f), "非循环 t=0.5");
        s.setTime(9.0f, false);
        check(near(s.sample("pos.x"), 20.0f), "非循环越界钳到终值");
    }
    {
        // 4) 驱动场景变换（pos/rot/scale 多轨）
        Clip clip2;
        clip2.name = "idle";
        clip2.duration = 1.0f;
        clip2.tracks["pos.x"].keys = {{0.0f, 0.0f}, {1.0f, 12.0f}};
        clip2.tracks["pos.y"].keys = {{0.0f, 8.0f}, {1.0f, -8.0f}};
        clip2.tracks["scale.x"].keys = {{0.0f, 1.0f}, {1.0f, 2.0f}};
        scene::Scene sc;
        const auto id = sc.createNode("hero");
        scene::LocalTransform lt;
        applyToTransform(clip2, 0.5f, true, lt);
        check(near(lt.pos.x, 6.0f) && near(lt.pos.y, 0.0f), "pos 双轴插值");
        check(near(lt.scale.x, 1.5f) && near(lt.scale.y, 1.0f), "scale 只动声明轴");
        sc.setLocalTransform(id, lt);
        const auto w = sc.worldTransform(id);
        check(near(w.pos.x, 6.0f) && near(w.pos.y, 0.0f), "动画值进场景");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (animation)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
