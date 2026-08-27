// 导入任务队列（asset-spec §3.3：优先级 + 幂等 + 状态）
import { createHash } from 'node:crypto';

// 资产 UUID（v5 风格，确定性：命名空间 + importer + 相对路径）
export function assetUuid(path, importerId = 'ccx.generic') {
  const h = createHash('sha1')
    .update('ccx-asset-v1\n' + importerId + '\n' + path)
    .digest('hex');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' +
         h.slice(16, 20) + '-' + h.slice(20, 32);
}

export class ImportQueue {
  constructor() {
    this.jobs = [];        // { uuid, priority, params, status: 'pending' }
    this.done = new Map(); // uuid -> { status:'done'|'failed', result? , error? }
    this.seq = 0;
  }

  enqueue({ uuid, priority = 0, params = {} }) {
    const existing = this.jobs.find((j) => j.uuid === uuid);
    if (existing) {
      // 幂等：更新优先级（提升不降）
      if (priority > existing.priority) existing.priority = priority;
      return false;
    }
    this.jobs.push({ uuid, priority, params, status: 'pending', seq: this.seq++ });
    this.jobs.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
    return true;
  }

  next() {
    const i = this.jobs.findIndex((j) => j.status === 'pending');
    if (i < 0) return null;
    this.jobs[i].status = 'running';
    return this.jobs[i];
  }

  complete(uuid, result) {
    this.removeRunning(uuid);
    this.done.set(uuid, { status: 'done', result });
  }

  fail(uuid, error) {
    this.removeRunning(uuid);
    this.done.set(uuid, { status: 'failed', error });
  }

  cancel(uuid) {
    const i = this.jobs.findIndex((j) => j.uuid === uuid);
    if (i >= 0) {
      this.jobs.splice(i, 1);
      return true;
    }
    return false;
  }

  get(uuid) {
    return this.jobs.find((j) => j.uuid === uuid) ?? this.done.get(uuid) ?? null;
  }

  removeRunning(uuid) {
    const i = this.jobs.findIndex((j) => j.uuid === uuid);
    if (i >= 0) this.jobs.splice(i, 1);
  }

  summary() {
    return {
      queued: this.jobs.filter((j) => j.status === 'pending').length,
      running: this.jobs.filter((j) => j.status === 'running').length,
      done: this.done.size,
    };
  }
}
