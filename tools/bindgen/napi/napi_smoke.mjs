// napi addon 冒烟：验证 bindgen 生成的绑定可被 JS 加载调用（灯塔 C 出口④）
// 占位实现（bindgen 只生成桥接骨架）返回固定值 —— 本测试验证的是
// "string/数字参数 + 返回 + 只读属性"跨越 napi 边界正常，而非业务逻辑。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('napi addon 加载并通过边界传值', () => {
  const bindings = require('./build/Release/ccx_hello_bindings.node');
  assert.ok(bindings.Greeter, '导出 Greeter 对象');
  assert.equal(typeof bindings.Greeter.greet, 'function', 'greet 为函数');
  assert.equal(bindings.Greeter.greet('CCX'), 'TODO', 'string 参数/返回值跨边界');
  assert.equal(typeof bindings.Greeter.add(2, 3), 'number', '数字参数跨边界');
  assert.equal(bindings.Greeter.add(2, 3), 0, '占位实现返回默认值（桥接正常）');
  assert.equal(bindings.Greeter.version, '0.0.1', '只读属性跨边界');
});
