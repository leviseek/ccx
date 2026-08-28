# engine/ — C++20 引擎核心（2D-first）

布局与依赖方向见 [engine-spec](../docs/engine-spec.md) §1；模块裁剪见 §2。

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| foundation | ✅ M0 实现中（反射/序列化/数学） | 灯塔任务 A |
| ecs / scene / gfx / render / animation / physics / audio / ui / input / asset / scripting / network / platform | ⏳ 占位 | M1/M2 按 roadmap 挂载 CMake |

本地工具链：mise（cmake+ninja，见 ../.mise.toml）+ 平台编译器（Windows 开发机可用 w64devkit，CI 用系统编译器）。

## 模块地图（M1 实况，v0.3.42）

| 模块 | 能力 | 依赖 | 测试 |
| --- | --- | --- | --- |
| foundation | 反射/JSON/metrics/mat4 | — | roundtrip/metrics 等 |
| ecs | World/Archetype/Scheduler(Stage)/CommandBuffer | foundation | ecs_minimal/schedule |
| scene | 树/排序/world 变换/ADR-003 装载导出/ECS 桥/碰撞集成 | foundation, ecs, physics | scene/schema/bridge/collider* |
| render | RenderGraph/Pipeline/shader-material 校验/batcher/packer/相机/软件光栅 | foundation | pipeline/shader_material/packer/camera/raster |
| gfx | 描述校验/句柄池/RHI(Device)+FakeDevice | foundation | gfx/rhi_fake |
| animation | 曲线/精灵帧/状态机（sprite 字段） | foundation | clip/sprite_anim/state_machine/integrated* |
| particle | 粒子发射器（固定池/LCG/淡出） | foundation | particle |
| input | 输入归一化（边沿/指针） | foundation | input |
| game | GameLoop 固定步/螺旋保护 | foundation | game_loop |
| assets | 资产注册表/PNG 头解析 | foundation | registry/png_size |
| audio | 播放事件总线 | foundation | audio |
| physics | AABB/宽相/窄相/层掩码 | foundation | physics.*/tick_collision/contact_driven |
| 顶层集成 | 帧循环全链；假 GPU 运行时（GameLoop→FakeDevice→readback） | 全模块 | full_tick/render_frame/fake_gpu_* |

> 依赖方向：一律向下（foundation 最底层）；scene 可依赖 physics，physics 不依赖 scene。
