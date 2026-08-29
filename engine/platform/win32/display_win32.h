#pragma once
// CCX platform Win32 DisplayAdapter（bridge.h 契约的原生实现；依赖仅 foundation + Win32 API）
#include "ccx/platform/bridge.h"

namespace ccx::platform {

// Win32 窗口 + DIB 上屏 + 键盘/指针事件（每帧 pump() 一次性消息泵）
class Win32Display : public DisplayAdapter {
public:
    Win32Display();
    ~Win32Display() override;

    bool create(const wchar_t* title, uint32_t width, uint32_t height, float dpr = 1.0f);
    void destroy();
    // DisplayAdapter
    Viewport fit(float availW, float availH, float baseW, float baseH) override;
    bool apply(const Viewport& vp) override;
    void onResize(void (*cb)(void*), void* user) override;
    bool present(const uint8_t* rgba, uint32_t w, uint32_t h) override;
    // 消息泵（每帧调用；含 WM_PAINT 重绘/WM_SIZE 回调/输入事件入队）
    bool pump(bool& quit);
    bool isAlive() const;
    // 输入事件（供 InputAdapter 消费）
    bool takeInput(InputEvent& out);

private:
    struct Impl;
    Impl* impl_;
};

}  // namespace ccx::platform
