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
    handle(line) {
      const parsed = parseMessage(line);
      if (parsed.error) {
        return failure(null, parsed.error.code, parsed.error.message);
      }
      const { msg } = parsed;
      if (msg.id === undefined || msg.id === null) return null;  // 通知
      const out = dispatch(handlers, msg);
      if (out.code !== undefined) return failure(msg.id, out.code, out.message);
      return success(msg.id, out.result);
    },
  };
}

export function runStdioDaemon(services) {
  const daemon = createDaemon(services);
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    const out = daemon.handle(line);
    if (out) process.stdout.write(JSON.stringify(out) + '\n');
  });
  // 就绪通知（客户端等待）
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    method: 'system.ready',
    params: { pid: process.pid },
  }) + '\n');
}
