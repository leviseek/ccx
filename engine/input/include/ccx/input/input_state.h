#pragma once
#include <cstdint>
#include <map>

#include "ccx/foundation/math/vec2.h"

namespace ccx::input {

// 按键/鼠标/触控统一输入状态（platform adapter 之上的归一化模型）
class InputState {
public:
    void beginFrame();
    void press(uint32_t code);
    void release(uint32_t code);
    bool isDown(uint32_t code) const;
    bool wasPressed(uint32_t code) const;
    bool wasReleased(uint32_t code) const;

    void setPointer(Vec2 pos, bool down);
    Vec2 pointerPos() const { return pointer_; }
    bool pointerDown() const { return pointerDown_; }
    bool pointerPressed() const { return pointerPressed_; }

private:
    struct KeyState {
        bool down = false;
        bool pressed = false;
        bool released = false;
    };
    std::map<uint32_t, KeyState> keys_;
    Vec2 pointer_{0.0f, 0.0f};
    bool pointerDown_ = false;
    bool pointerPressed_ = false;
};

namespace Key {
constexpr uint32_t A = 0x41, D = 0x44, S = 0x53, W = 0x57;
constexpr uint32_t Space = 0x20, Enter = 0x0D, Escape = 0x1B;
constexpr uint32_t Left = 0x25, Up = 0x26, Right = 0x27, Down = 0x28;
}  // namespace Key

}  // namespace ccx::input
