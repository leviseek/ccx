# GPU 后端实做计划（M2 W1：首帧）

> 日期：2026-08-27 · 输入：m1-handoff §2、m2-gate-rehearsal exit1、render 现有数据面
> 目标：把"合成器"变成"真实第一帧"，验收对照软件光栅黄金输出。

## 1. 现有数据面 -> GPU 概念映射

| CCX 现成物 | GPU 概念 | 说明 |
| --- | --- | --- |
| `PackedVertex{x,y,u,v,rgba}` | 顶点缓冲（`VertexBufferLayout`） | 24B/顶点（2+2+4 字节）；自投影正交相机已自带 |
| `PackResult.batches` | draw 调用（每批 1 draw） | 同键连续段 = 1 draw call |
| `PackResult.indices` | 索引缓冲 | 每 quad 6 索引 |
| `OrthoCamera::projection()` | uniform（矩阵 4x4） | 现 Mat4 直接可用 |
| `RasterTarget` | `GPUTexture` + 像素读回 | **黄金对照**：GPU 帧缓冲读回像素 vs 软件光栅断言 |
| `FrameMetrics` | 帧统计（drawCalls 等） | 渲染帧测试已就位 |

## 2. 后端选择与依赖

- **首选 WebGPU native（wgpu-native，Vulkan/Metal/DX12 底层）**：CMake FetchContent 引入；跨平台；CI 可用软件 Vulkan（lavapipe）跑像素断言。
- **备选 GLES 3.0**（移动端；平台 vendor 已有 GL 适配线索，ADR-005）。
- 依赖风险：wgpu-native 构建链（rust/cargo）需 CI 支持；无 GPU 环境用 lavapipe（软件 Vulkan）。

## 3. 里程碑（每个可验证）

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| W1a | 窗口/表面 + 清屏 | 读回像素 == 清除色 |
| W1b | 单 quad（静态缓冲） | 像素 vs raster 黄金对照 |
| W1c | 合批绘制（batch 循环 + 动态 buffer 更新） | 5 精灵 3 批 fixture == 软件光栅 |
| W1d | 帧循环接入（GameLoop 内 submit + metrics 记账） | demo 级场景每帧提交且 profiler 有数 |
| W1e | 动画/接触叠加（UV 帧/位置每帧更新） | frame_diff/anim_color 断言移植 GPU 读回 |

## 4. 验收总账

- 每个里程碑结束时跑既有 Node 像素断言（frame_ppm/diff/anim_color/contact_gif）——**把 exe 换成 GPU 后端输出 reader**（同一断言函数族）。
- 全部通过 = exit1（"SPRITE 场景经后端输出非空帧"）完成。
## 附录 B：W1 接口映射核对表（2026-08-28 评估）

> 目的：GPU 环境到达前，把 RHI Device 契约与 wgpu-native（webgpu.h C API）逐项对齐，缩小接入时的排查面。

| RHI 契约（gfx/rhi.h） | webgpu.h 候选 API | 核对 |
| --- | --- | --- |
| createDevice() | wgpuCreateInstance + wgpuInstanceRequestAdapter + wgpuAdapterRequestDevice | 两阶段异步 → 同步封装 |
| createBuffer(size, usage) | wgpuDeviceCreateBuffer（WGPUBufferDescriptor） | 一一对应 |
| createTexture(w,h,format) | wgpuDeviceCreateTexture | 对应（format 映射表） |
| upload(buf, data, size, offset) | wgpuQueueWriteBuffer(queue, buffer, offset, data, size) | 直接对应 |
| clear(color) | wgpuCommandEncoderBeginRenderPass（loadOp=clear） | 封装 render pass |
| readback(buf) | wgpuQueueSubmit + 独立 readback buffer + wgpuBufferGetMappedRange | 多步（仿真已建模） |
| beginFrame/submit | wgpuQueueSubmit + wgpuDevicePoll | 封装 |
| putPixel（Fake only） | —（软件仿真独有） | 真后端不实现 |

### 风险预判

- wgpu-native 需要 d3d12/vulkan backend 运行时；CI 首选用 **lavapipe（软件 Vulkan）** 跑验收（无 GPU runner 时）。
- 帧回读（readback）在 GPU 管线是延迟路径：五级里程碑的"像素对照"需要 readback 轮询（与仿真路径同构但异步）。
- webgpu.h 头文件下载评估（本环境 2026-08-28 网络不可达）：**待复测项**——到达后 vendor 入 engine/platform/vendor/webgpu-headers（ADR-005）。

### 五级里程碑验收细化（从"标准"到"检查项"）

1. **L1 设备与缓冲**：createDevice 成功 + createBuffer/upload/readback 环回（数据一致性断言）。
2. **L2 清屏帧**：clear 后 readback 全像素 = 目标色（16×16）。
3. **L3 单精灵帧**：putPixel 等价路径 → 软件光栅黄金 PPM 与 GPU 帧 readback 像素级对照（差分 ≤ 容差）。
4. **L4 全场景帧**：demo 场景（hero/pillar 等）→ 与 render_frame 仿真帧对照。
5. **L5 帧统计**：帧耗时/上传字节进 profiler 快照（与引擎侧脚本统计同格式）。


## 环境就绪实测（2026-08-28）

- **真 GPU 就绪**：NVIDIA GeForce RTX 4070 SUPER（Vulkan 1.4.325，vulkaninfo 枚举成功）。
- 软件备选：SwiftShader ICD（Qoder IDE 自带 vk_swiftshader.dll + icd json）。
- 剩余缺口：wgpu-native 库与 webgpu.h 头（需网络获取或 cargo 构建；webgpu.h 网络待复测）。
- 验证入口：ccx doctor --env（gpu.ready=true 即此状态）。

