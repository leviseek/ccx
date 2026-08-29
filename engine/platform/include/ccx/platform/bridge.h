#pragma once
// CCX 平台桥接契约（platform-spec §2：Capability + Adapter；铁律 8——平台差异由 Adapter 承载，游戏无平台分支）
// 跨平台统一接口：各平台（Web/Android/iOS/桌面）以同一契约实现；游戏只依赖本头。
#include <cstdint>

namespace ccx::platform {

// 平台能力位（Capability 模型；宿主/系统探测结果）
enum class Capability : uint32_t {
    None        = 0,
    TouchInput  = 1 << 0,   // 触屏输入（移动端/Web 触控）
    Keyboard    = 1 << 1,   // 键盘输入
    Gamepad     = 1 << 2,   // 手柄输入
    Vibrate     = 1 << 3,   // 马达震动
    Share       = 1 << 4,   // 平台分享
    Login       = 1 << 5,   // 账号登录
    Audio       = 1 << 6,   // 平台音频后端
};

// 显示适配：视口策略（整数倍像素缩放 + DPR 物理渲染）+ 帧上屏
struct DisplayCapabilities {
    bool supportsDpr = true;          // 设备像素比（高分屏防模糊）
    bool supportsResize = true;       // 视口变化事件
    bool supportsIntegerScale = true; // 整数倍像素缩放
};

struct Viewport {
    float logicalW = 0;   // 逻辑（CSS/设计）像素宽
    float logicalH = 0;
    float scale = 1;      // 设计分辨率缩放（整数倍）
    float dpr = 1;        // 设备像素比（物理 = logical * dpr）
};

class DisplayAdapter {
public:
    virtual ~DisplayAdapter() = default;
    // 按可用空间选择视口（可用宽/高 -> 整数倍缩放；baseW/baseH = 设计分辨率）
    virtual Viewport fit(float availW, float availH, float baseW, float baseH) = 0;
    virtual bool apply(const Viewport& vp) = 0;                 // 生效（canvas/窗口尺寸）
    virtual void onResize(void (*cb)(void* user), void* user) = 0;
    // 引擎软件光栅帧上屏（RGBA8；present 由平台完成尺度/交换链）
    virtual bool present(const uint8_t* rgba, uint32_t w, uint32_t h) = 0;
    const DisplayCapabilities& caps() const { return caps_; }
protected:
    DisplayCapabilities caps_;
};

// 输入适配：平台事件 -> 引擎输入归一化模型（engine/input InputState 语义）
enum class Key { Left, Right, Up, Down, Jump, A, B, Pause, Record, Summon, Swap };
enum class InputEventType { Press, Release, Hold, Tap };

struct InputEvent {
    InputEventType type;
    Key key;
    float x = 0, y = 0;       // 指针（触屏）归一化坐标
    bool pointerActive = false;
};

class InputAdapter {
public:
    virtual ~InputAdapter() = default;
    // 平台 -> 归一化事件流（游戏/帧循环每帧 poll）
    virtual bool poll(InputEvent& out) = 0;
    virtual void clear() = 0;
};

// 渠道适配（支付/分享/登录/震动：对齐 services-spec 渠道能力面）
class ChannelAdapter {
public:
    virtual ~ChannelAdapter() = default;
    virtual bool has(Capability cap) const = 0;
    virtual bool vibrate(uint32_t ms) = 0;
    virtual bool share(const char* title, const char* path) = 0;
    virtual bool login() = 0;
};

// 平台桥：能力探测 + 三适配器组合（游戏入口构造一次）
struct PlatformBridge {
    DisplayAdapter* display = nullptr;
    InputAdapter* input = nullptr;
    ChannelAdapter* channel = nullptr;
    uint32_t capabilities() const {
        uint32_t caps = 0;
        if (display) caps |= static_cast<uint32_t>(Capability::TouchInput) * 0;  // 占位（能力来自宿主探测）
        return caps;
    }
};

}  // namespace ccx::platform
