// stdio daemon（services-spec §1 的 daemon 形态；stream 可注入便于测试）
import { createInterface } from 'node:readline';
import { dispatch, failure, parseMessage, success } from './rpc.mjs';

export function createDaemon(services) {
  const pushFns = new Set();
  const handlers = { ...services };
  handlers.__system = {
    ping: () => ({ pong: Date.now() }),
    subscribe: (params) => {
      pushFns.add(params.channel ?? 'default');
      return { ok: true, channel: params.channel ?? 'default' };
    },
    unsubscribe: (params) => {
      pushFns.delete(params.channel ?? 'default');
      return { ok: true };
    },
  };
  return {
    onPush(fn) {
      pushFns.add(fn);
    },
    pushEvent(ns, event, data) {
      const payload = JSON.stringify({
        jsonrpc: '2.0',
        method: ns + '.event',
        params: { event, data },
      });
      for (const fn of pushFns) fn(payload);
    },
    async handle(line) {
      const parsed = parseMessage(line);
      if (parsed.error) {
        return failure(null, parsed.error.code, parsed.error.message);
      }
      const { msg } = parsed;
      if (msg.id === undefined || msg.id === null) return null;  // 通知
      const out = await dispatch(handlers, msg);
      if (out.code !== undefined) return failure(msg.id, out.code, out.message);
      return success(msg.id, out.result);
    },
  };
}

export function runStdioDaemon(services) {
  const daemon = createDaemon(services);
  // 事件推送通道：subscribe 后 daemon 侧可主动推送（services-spec §3 事件契约）
  daemon.onPush((payload) => process.stdout.write(payload + '\n'));
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    const out = await daemon.handle(line);
    if (out) process.stdout.write(JSON.stringify(out) + '\n');
  });
  // 常驻模式（stdio 为 ignore）：事件循环无活动句柄 -> 心跳保持
  if (process.env.CCX_DAEMON_DETACHED) {
    setInterval(() => {}, 60000);
  }
  // EOF 优雅退出（客户端 close -> exit 0）；常驻模式（CCX_DAEMON_DETACHED）忽略 EOF
  rl.on('close', () => {
    if (process.env.CCX_DAEMON_DETACHED) return;
    process.exit(0);
  });
  // 就绪通知（客户端等待）
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    method: 'system.ready',
    params: { pid: process.pid },
  }) + '\n');
}
