// 帧统计适配器：recordFrameStats / snapshotJson —— 与 C++ metrics::FrameMetrics 同构
// （render_frame 测试与 daemon 侧 profile 共用同一 schema：frame/timeMs/entities/batches/drawCalls/allocBytes）

export const kCapacity = 128;

export class FrameProfile {
  constructor(capacity = kCapacity) {
    this.capacity = capacity;
    this.history = [];   // 最近 N 帧（chronological；超过则丢弃最旧）
    this.total = 0;
  }

  recordFrameStats(stats) {
    const s = {
      frame: stats.frame ?? this.total,
      frameTimeMs: stats.frameTimeMs ?? 0,
      entities: stats.entities ?? 0,
      batches: stats.batches ?? 0,
      drawCalls: stats.drawCalls ?? 0,
      allocBytes: stats.allocBytes ?? 0,
    };
    this.history.push(s);
    if (this.history.length > this.capacity) this.history.shift();
    this.total += 1;
    return s;
  }

  // 最近 count 帧（含当前，时间序），与 C++ snapshotJson 同构
  snapshotJson(count = 10) {
    const take = Math.min(count, this.history.length);
    return { schema: 'ccx.profile/1', frames: this.history.slice(-take) };
  }

  last() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }
}
