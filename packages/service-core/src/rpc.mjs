// JSON-RPC 2.0 子集（services-spec §1；方法版本化占位：method 字符串原样透传）
export function parseMessage(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return { error: { code: -32700, message: 'Parse error' } };
  }
  if (msg && typeof msg === 'object' && msg.jsonrpc === '2.0' &&
      typeof msg.method === 'string') {
    return { msg };
  }
  return { error: { code: -32600, message: 'Invalid Request' } };
}

// 鉴权（M4 远端 daemon token）：env CCX_TOKEN 未配置 -> 开放；配置后需 msg.auth.token 匹配
// 返回 null=通过；返回 {code,message}=拒绝
export function tokenCheck(msg) {
  const expected = process.env.CCX_TOKEN;
  if (!expected) return null;
  const got = msg && msg.auth && typeof msg.auth.token === 'string' ? msg.auth.token : '';
  if (got !== expected) {
    return { code: -32001, message: 'Unauthorized: invalid token' };
  }
  return null;
}

export function success(id, result) {
  return { jsonrpc: '2.0', id, result };
}
export function failure(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

// 分发器：services[ns][method](params) -> result（async 方法支持）
export async function dispatch(services, msg) {
  const parts = msg.method.split('.');
  const ns = parts[0];
  const method = parts.slice(1).join('.');
  const service = services[ns];
  const fn = service && typeof service[method] === 'function' ? service[method] : null;
  if (!fn) {
    return { code: -32601, message: 'Method not found: ' + msg.method };
  }
  try {
    let result = fn(msg.params ?? {});
    if (result && typeof result.then === 'function') result = await result;
    return { result };
  } catch (e) {
    return { code: -32602, message: 'Invalid params: ' + e.message };
  }
}
