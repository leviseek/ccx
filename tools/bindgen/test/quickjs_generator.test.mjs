import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseIdl } from '../src/idl.mjs';
import { generateQuickjs } from '../src/generators.mjs';

test('generateQuickjs：C 绑定结构（模块注册/方法包装/marshal）', () => {
  const ir = parseIdl('module ccx.hello;\nclass Greeter {\n  greet(name: string): string;\n  add(a: float, b: float): float;\n}');
  const c = generateQuickjs(ir);
  assert.ok(c.includes('extern const char* greet(const char* name);'), 'extern 声明');
  assert.ok(c.includes('extern float add(float a, float b);'), 'extern 数值');
  assert.ok(c.includes('JS_CFUNC_DEF("greet", 1, ccx_ccx_hello_greet)'), '方法表注册');
  assert.ok(c.includes('JS_ToCString(ctx, argv[0])'), 'string marshal');
  assert.ok(c.includes('JS_ToFloat64(ctx, &a0, argv[0])'), 'float marshal');
  assert.ok(c.includes('JS_NewFloat64'), '返回值包装');
  assert.ok(c.includes('ccx_hello_module_init'), '模块初始化');
  assert.ok(c.includes('"ccx.hello"'), '模块名');
});

test('quickjs 目标端到端：CLI --quickjs 生成文件', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-qjs-'));
  try {
    const idl = join(dir, 'hello.idl');
    writeFileSync(idl, 'module ccx.hello;\nclass Greeter {\n  add(a: float, b: float): float;\n}');
    const r = spawnSync(process.execPath, [join(import.meta.dirname, '..', 'bin', 'bindgen.mjs'),
                                           idl, '--out', join(dir, 'out'), '--quickjs'],
                        { encoding: 'utf8' });
    assert.equal(r.status, 0, r.err);
    const c = readFileSync(join(dir, 'out', 'ccx_hello_quickjs.c'), 'utf8');
    assert.ok(c.includes('JS_CFUNC_DEF("add"'));
    assert.ok(c.includes('ccx_hello_add'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
