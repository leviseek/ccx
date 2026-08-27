// 文件系统 watch（asset-spec §3.2 事件流的最小实现）
// - fs.watch（recursive 尽力而为），事件按路径合并（debounce）
// - 手动 pump() 便于测试与长时间无事件时冲刷
import fs from 'node:fs';

export function createWatcher(root, { debounceMs = 50 } = {}) {
  const queue = new Map();  // path -> lastEvent（'rename'|'change'）
  const listeners = new Set();
  let timer = null;
  let closed = false;
  let watcher = null;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  }

  function flush() {
    if (closed) return;
    const batch = [...queue.entries()];
    queue.clear();
    if (batch.length === 0) return;
    for (const fn of listeners) {
      try {
        fn(batch);
      } catch (e) {
        // 监听器错误不中断事件流
      }
    }
  }

  try {
    watcher = fs.watch(root, { recursive: true }, (event, filename) => {
      if (closed) return;
      const key = filename ? String(filename) : '/';
      queue.set(key, event);
      schedule();
    });
  } catch {
    watcher = null;  // recursive 不支持时降级（v1 明确无轮询兜底，调用方用 scan）
  }

  return {
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    pump() {
      clearTimeout(timer);
      flush();
    },
    pending() {
      return queue.size;
    },
    close() {
      closed = true;
      clearTimeout(timer);
      if (watcher) watcher.close();
      queue.clear();
      listeners.clear();
    },
  };
}
