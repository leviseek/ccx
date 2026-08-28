# game — 帧循环宿主

- 用途：固定步长游戏循环（app 层地基）。
- API：`GameLoop({fixedDt, maxSubSteps})` → `step(wallDt, fixedUpdate)`：累积执行 0..maxSubSteps 步；**螺旋保护**（超出丢弃）。
- 语义：0.15s wall / 0.1 fixed → 1 步（余 0.05）；0.2 → 2 步。
- 测试：game.loop（累积/整除/螺旋）。依赖：foundation。接入：render_frame（20fps 固定步驱动 Scheduler）。
