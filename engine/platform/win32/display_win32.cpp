// CCX platform Win32 DisplayAdapter 实现（GDI DIB 上屏；无第三方依赖）
#include "display_win32.h"
#include <windows.h>
#include <cstring>

namespace ccx::platform {

namespace {
struct Win32View { HWND hwnd = nullptr; HDC memDc = nullptr; HBITMAP dib = nullptr; void* bits = nullptr; int w = 0; int h = 0; };
LRESULT CALLBACK wndProc(HWND hwnd, UINT u, WPARAM wp, LPARAM lp) {
    auto* v = reinterpret_cast<Win32View*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    if (u == WM_NCCREATE) {
        auto* cs = reinterpret_cast<CREATESTRUCTW*>(lp);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(cs->lpCreateParams));
        v = reinterpret_cast<Win32View*>(cs->lpCreateParams);
    }
    if (!v) return DefWindowProcW(hwnd, u, wp, lp);
    if (u == WM_CLOSE) { PostQuitMessage(0); return 0; }
    if (u == WM_KEYDOWN || u == WM_KEYUP) {
        // 引擎归一化输入事件（key -> platform::Key；InputState 语义对齐）
        const bool press = u == WM_KEYDOWN;
        // 简化：事件入队由 adapter poll（display 侧不做语义映射），此处转发 WM_SYS 无关
        (void)press;
    }
    if (u == WM_PAINT) { PAINTSTRUCT ps; BeginPaint(hwnd, &ps); EndPaint(hwnd, &ps); return 0; }
    return DefWindowProcW(hwnd, u, wp, lp);
}
}  // namespace

struct Win32Display::Impl { Win32View view; bool alive = false; };

Win32Display::Win32Display() : impl_(new Impl()) {}
Win32Display::~Win32Display() { destroy(); delete impl_; }

bool Win32Display::create(const wchar_t* title, uint32_t width, uint32_t height, float /*dpr*/) {
    static bool registered = false;
    if (!registered) {
        WNDCLASSW wc{};
        wc.lpfnWndProc = wndProc;
        wc.hInstance = GetModuleHandleW(nullptr);
        wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
        wc.lpszClassName = L"CCXPreviewWindow";
        wc.hbrBackground = reinterpret_cast<HBRUSH>(GetStockObject(BLACK_BRUSH));
        if (!RegisterClassW(&wc)) return false;
        registered = true;
    }
    RECT rc{0, 0, static_cast<LONG>(width), static_cast<LONG>(height)};
    AdjustWindowRect(&rc, WS_OVERLAPPEDWINDOW, FALSE);
    impl_->view.hwnd = CreateWindowExW(0, L"CCXPreviewWindow", title, WS_OVERLAPPEDWINDOW,
                                      CW_USEDEFAULT, CW_USEDEFAULT,
                                      rc.right - rc.left, rc.bottom - rc.top,
                                      nullptr, nullptr, GetModuleHandleW(nullptr), &impl_->view);
    if (!impl_->view.hwnd) return false;
    ShowWindow(impl_->view.hwnd, SW_SHOW);
    impl_->alive = true;
    return true;
}

void Win32Display::destroy() {
    if (impl_->view.hwnd) { DestroyWindow(impl_->view.hwnd); impl_->view.hwnd = nullptr; }
    if (impl_->view.dib) { DeleteObject(impl_->view.dib); impl_->view.dib = nullptr; impl_->view.bits = nullptr; }
    if (impl_->view.memDc) { DeleteDC(impl_->view.memDc); impl_->view.memDc = nullptr; }
    impl_->alive = false;
}

Viewport Win32Display::fit(float availW, float availH, float baseW, float baseH) {
    int scale = 1;
    const float sw = availW / baseW, sh = availH / baseH;
    if (sw >= 2.0f && sh >= 2.0f) scale = 2;
    if (sw >= 3.0f && sh >= 3.0f) scale = 3;
    return {baseW * scale, baseH * scale, static_cast<float>(scale), 1.0f};
}

bool Win32Display::apply(const Viewport& vp) {
    if (!impl_->view.hwnd) return false;
    RECT rc{0, 0, static_cast<LONG>(vp.logicalW), static_cast<LONG>(vp.logicalH)};
    AdjustWindowRect(&rc, WS_OVERLAPPEDWINDOW, FALSE);
    SetWindowPos(impl_->view.hwnd, nullptr, 0, 0, rc.right - rc.left, rc.bottom - rc.top,
                 SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE);
    return true;
}

void Win32Display::onResize(void (*cb)(void*), void* /*user*/) { (void)cb; }

bool Win32Display::present(const uint8_t* rgba, uint32_t w, uint32_t h) {
    auto& v = impl_->view;
    if (!v.hwnd || w == 0 || h == 0) return false;
    if (v.dib == nullptr || v.w != static_cast<int>(w) || v.h != static_cast<int>(h)) {
        if (v.dib) { DeleteObject(v.dib); v.dib = nullptr; v.bits = nullptr; }
        if (v.memDc) { DeleteDC(v.memDc); v.memDc = nullptr; }
        v.memDc = CreateCompatibleDC(nullptr);
        BITMAPINFO bmi{};
        bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
        bmi.bmiHeader.biWidth = static_cast<LONG>(w);
        bmi.bmiHeader.biHeight = -static_cast<LONG>(h);  // top-down
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB;
        v.dib = CreateDIBSection(nullptr, &bmi, DIB_RGB_COLORS, &v.bits, nullptr, 0);
        if (!v.dib) return false;
        v.w = static_cast<int>(w);
        v.h = static_cast<int>(h);
    }
    // RGBA -> BGRA（引擎光栅单通道上屏）
    auto* out = static_cast<uint8_t*>(v.bits);
    const size_t n = static_cast<size_t>(w) * h;
    for (size_t i = 0; i < n; ++i) {
        out[i * 4 + 0] = rgba[i * 4 + 2];
        out[i * 4 + 1] = rgba[i * 4 + 1];
        out[i * 4 + 2] = rgba[i * 4 + 0];
        out[i * 4 + 3] = 0xFF;
    }
    HDC hdc = GetDC(v.hwnd);
    BitBlt(hdc, 0, 0, v.w, v.h, v.memDc, 0, 0, SRCCOPY);
    ReleaseDC(v.hwnd, hdc);
    return true;
}

bool Win32Display::pump(bool& quit) {
    MSG msg;
    quit = false;
    while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
        if (msg.message == WM_QUIT) { quit = true; }
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
    return impl_->alive && !quit;
}

bool Win32Display::isAlive() const { return impl_->alive; }
bool Win32Display::takeInput(InputEvent&) { return false; }  // 键盘归一化由工具栏事件泵接入（v1 窗口可渲染）

}  // namespace ccx::platform
