// 输入归一化测试（边沿语义/多键独立/指针）
#include <cstdio>

#include "ccx/input/input_state.h"

using namespace ccx::input;

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
        InputState in;
        in.press(Key::A);
        check(in.isDown(Key::A) && in.wasPressed(Key::A), "按下边沿");
        in.beginFrame();
        check(in.isDown(Key::A) && !in.wasPressed(Key::A), "第二帧 pressed 消失");
        in.release(Key::A);
        check(!in.isDown(Key::A) && in.wasReleased(Key::A), "抬起边沿");
        in.beginFrame();
        check(!in.wasReleased(Key::A) && !in.isDown(Key::A), "第三帧 released 消失");
    }
    {
        InputState in;
        in.press(Key::W);
        in.press(Key::Space);
        in.release(Key::Space);
        in.release(Key::Space);  // 幂等
        check(in.isDown(Key::W) && !in.isDown(Key::Space), "多键独立");
        check(in.wasReleased(Key::Space), "释放边沿记录");
    }
    {
        InputState in;
        in.setPointer({10.0f, 20.0f}, true);
        check(in.pointerDown() && in.pointerPressed(), "指针按下边沿");
        check(in.pointerPos().x == 10.0f && in.pointerPos().y == 20.0f, "指针位置");
        in.beginFrame();
        in.setPointer({11.0f, 20.0f}, true);  // 拖动
        check(in.pointerDown() && !in.pointerPressed(), "拖拽无新按下边沿");
        in.setPointer({11.0f, 20.0f}, false);
        check(!in.pointerDown(), "指针抬起");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (input)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
