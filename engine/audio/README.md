# audio — 播放事件数据面

- 用途：缓冲播放调度（M2 音频 worker 解码/输出之前的事件模型）。
- API：`PlayEvent{clipId, volume, loop, pan}`；`AudioBus`：`enqueue`（volume 钳制 0..1）、`poll`（FIFO，空返回空事件）、`setMasterVolume`（钳制）、`clear`。
- 语义：接触驱动（tick_contact）：新接触唯一触发 PlayEvent。
- 测试：audio.bus（顺序/钳制/清空）。依赖：foundation。
