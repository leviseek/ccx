// RPC 客户端：stdio（子进程桥）或 TLS socket（M4 云构建远端 daemon）
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';

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

  // M4 云构建：TLS socket 客户端（远端 daemon；token 用于握手鉴权）
  static async tls({ host = '127.0.0.1', port, ca, servername = 'ccx', rejectUnauthorized = true }) {
    const { connect } = await import('node:tls');
    const client = Object.create(RpcClient.prototype);
    client.pending = new Map();
    client.seq = 0;
    client.eventListeners = new Set();
    client.proc = new Proxy({}, { get: () => () => {} });  // 占位（socket 无 stdin/kill 语义）
    const caPem = ca ? readFileSync(ca, 'utf8') : undefined;  // ca 为文件路径 -> PEM 内容
    const sock = connect({ host, port, ca: caPem, servername, rejectUnauthorized });
    client.socket = sock;
    client.rl = createInterface({ input: sock, crlfDelay: Infinity });
    client.rl.on('line', (line) => client.onLine(line));
    sock.on('error', () => client.failAll('tls connection error'));
    sock.on('close', () => client.failAll('tls closed'));
    await new Promise((res, rej) => { sock.once('secureConnect', res); sock.once('error', rej); });
    return client;
  }

  _write(line) {
    if (this.socket) this.socket.write(line + '\n');
    else this.proc.stdin.write(line + '\n');
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
    this._write(JSON.stringify(msg));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('RPC 超时: ' + method));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  notify(method, params = {}) {
    this._write(JSON.stringify({ jsonrpc: '2.0', method, params }));
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
    if (this.socket) {
      try { this.socket.end(); } catch { /* noop */ }
      return;
    }
    try {
      this.proc.stdin.end();
    } catch {
      /* noop */
    }
    this.proc.kill();
  }
}
