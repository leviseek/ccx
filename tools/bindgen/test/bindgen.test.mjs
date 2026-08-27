import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseIdl } from '../src/idl.mjs';
import { generateDts, generateNapi, generateSchema } from '../src/generators.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const sample = readFileSync(join(here, '..', 'examples', 'hello.idl'), 'utf8');

test('解析 IDL -> IR', () => {
  const ir = parseIdl(sample);
  assert.equal(ir.module, 'ccx.hello');
  assert.equal(ir.classes.length, 1);
  const g = ir.classes[0];
  assert.equal(g.name, 'Greeter');
  assert.equal(g.methods.length, 2);
  assert.equal(g.methods[0].params[0].type, 'string');
  assert.equal(g.props[0].default, '0.0.1');
});

test('生成 .d.ts', () => {
  const dts = generateDts(parseIdl(sample));
  assert.ok(dts.includes('declare namespace ccx.hello'));
  assert.ok(dts.includes('class Greeter'));
  assert.ok(dts.includes('greet(name: string): string'));
  assert.ok(dts.includes('readonly version: string;'));
});

test('生成 napi 源码', () => {
  const cpp = generateNapi(parseIdl(sample));
  assert.ok(cpp.includes('#include <node_api.h>'));
  assert.ok(cpp.includes('NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)'));
  assert.ok(cpp.includes('greet_wrapper'));
  assert.ok(cpp.includes('napi_set_named_property(env, exports, "Greeter"'));
  assert.ok(cpp.includes('add_wrapper'));
});

test('生成 JSON Schema（API 契约）', () => {
  const schema = JSON.parse(generateSchema(parseIdl(sample)));
  assert.equal(schema.title, 'ccx.hello');
  assert.ok(schema.classes.Greeter.methods.greet.params.name);
  assert.equal(schema.classes.Greeter.methods.add.params.a.type, 'number');
  assert.equal(schema.classes.Greeter.properties.version.readOnly, true);
});

test('出错输入有明确错误', () => {
  assert.throws(() => parseIdl('class A {\n}'), /缺少 module/);
  assert.throws(() => parseIdl('module m;\ngarbage line'), /必须位于 class 内/);
  assert.throws(() => parseIdl('module m;\nclass A {\n  bad line\n}'), /无法解析行/);
});
