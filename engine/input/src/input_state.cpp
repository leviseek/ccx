#include "ccx/input/input_state.h"

namespace ccx::input {

void InputState::beginFrame() {
    for (auto& [code, s] : keys_) {
        (void)code;
        s.pressed = false;
        s.released = false;
    }
    pointerPressed_ = false;
}

void InputState::press(uint32_t code) {
    KeyState& s = keys_[code];
    if (!s.down) s.pressed = true;
    s.down = true;
}

void InputState::release(uint32_t code) {
    const auto it = keys_.find(code);
    if (it == keys_.end() || !it->second.down) return;
    it->second.down = false;
    it->second.released = true;
}

bool InputState::isDown(uint32_t code) const {
    const auto it = keys_.find(code);
    return it != keys_.end() && it->second.down;
}

bool InputState::wasPressed(uint32_t code) const {
    const auto it = keys_.find(code);
    return it != keys_.end() && it->second.pressed;
}

bool InputState::wasReleased(uint32_t code) const {
    const auto it = keys_.find(code);
    return it != keys_.end() && it->second.released;
}

void InputState::setPointer(Vec2 pos, bool down) {
    pointer_ = pos;
    if (down && !pointerDown_) pointerPressed_ = true;
    pointerDown_ = down;
}

}  // namespace ccx::input
