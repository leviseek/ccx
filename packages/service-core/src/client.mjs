// stdio 客户端（child_process 桥；RPC + 事件订阅）
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export class RpcClient {
  constructor(cmd, args, { cwd } = {}) {
    this.proc = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'inherit'] });
    this.pending = new Map();
    this.seq = 0;
    this.eventListeners = new Set();
    this.rl = createInterface({ input: this.proc.stdout, crlfDelay: Infinity });
    this.rl.on('line', (line) => this.onLine(line));
    this.proc.on('exit', () => this.failAll('daemon exited'));
  }

  onLine(line) {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    // 事件 = method 且无 id 的通知（除 ready 外的主动推送）
    if (msg.method && msg.id === undefined) {
      for (const fn of this.eventListeners) fn(msg);
      return;
    }
    const pending = this.pending.get(msg.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(msg.id);
    if (msg.error) pending.reject(new Error(msg.error.message));
    else pending.resolve(msg.result);
  }

  request(method, params = {}, timeoutMs = 5000, token = null) {
    const id = ++this.seq;
    const msg = { jsonrpc: '2.0', id, method, params };
    if (token) msg.auth = { token };  // M4 远端 daemon 鉴权
    this.proc.stdin.write(JSON.stringify(msg) + '\n');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('RPC 超时: ' + method));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  notify(method, params = {}) {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  onEvent(fn) {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  failAll(message) {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error(message));
    }
    this.pending.clear();
  }

  close() {
    try {
      this.proc.stdin.end();
    } catch {
      /* noop */
    }
    this.proc.kill();
  }
}
