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
