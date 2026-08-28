# input — 输入归一化

- 用途：键盘/指针在 platform adapter 之上的统一状态（engine-spec §1）。
- API：`InputState`：`beginFrame()` 推进边沿（pressed/released 只存活一帧）；`press/release`（release 幂等）；`isDown/wasPressed/wasReleased`；`setPointer`（按下边沿只一次）。
- 键码：`Key::A/D/S/W/Space/Enter/Escape/Left/Up/Right/Down`（任意 uint32 可用）。
- 测试：input.state（边沿/多键/指针）。依赖：foundation。接入：full_tick（W 移动 3 帧 → +15px 断言）。
