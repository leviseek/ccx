import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { analyzeType, parseIdl } from '../src/idl.mjs';
import { generateDts, generateNapi, generateSchema } from '../src/generators.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const sample = readFileSync(join(here, '..', 'examples', 'hello.idl'), 'utf8');
const advanced = readFileSync(join(here, '..', 'examples', 'advanced.idl'), 'utf8');

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

test('v0.2：数组/默认值/回调解析', () => {
  const ir = parseIdl(advanced);
  const pb = ir.classes[0];
  assert.equal(pb.name, 'Playback');
  assert.equal(pb.methods.length, 5);
  const play = pb.methods.find((m) => m.name === 'play');
  assert.equal(play.params[1].def, false, 'bool 默认值 false');
  const sum = pb.methods.find((m) => m.name === 'sum');
  assert.equal(analyzeType(sum.params[0].type).kind, 'array');
  assert.equal(analyzeType(sum.params[0].type).base, 'float');
  const tick = pb.methods.find((m) => m.name === 'onTick');
  const cb = analyzeType(tick.params[0].type);
  assert.equal(cb.kind, 'callback');
  assert.equal(cb.callbackParams.length, 0, '空参回调');
  const dmg = pb.methods.find((m) => m.name === 'onDamage');
  const cb2 = analyzeType(dmg.params[0].type);
  assert.equal(cb2.callbackParams[0].type, 'float', '回调内参数类型');
});

test('v0.2：d.ts 生成（可选参数/数组/回调）', () => {
  const dts = generateDts(parseIdl(advanced));
  assert.ok(dts.includes('play(url: string, loop?: boolean): void'), '默认值参数变成可选');
  assert.ok(dts.includes('sum(values: number[]): number'), '数组类型 map 为 number[]');
  assert.ok(dts.includes('onTick(cb: () => void): void'), '空参回调');
  assert.ok(dts.includes('onDamage(cb: (amount: number) => void): void'), '带参回调');
  const old = generateDts(parseIdl(sample));
  assert.ok(old.includes('declare namespace ccx.hello'));
  assert.ok(old.includes('readonly version: string;'));
});

test('v0.2：napi 生成（默认值/数组读取/回调引用）', () => {
  const cpp = generateNapi(parseIdl(advanced));
  assert.ok(cpp.includes('napi_get_array_length'), '数组长度读取');
  assert.ok(cpp.includes('napi_create_reference'), '回调存储 napi_ref');
  assert.ok(cpp.includes('g_ref_onTick_cb'), '回调引用命名');
  assert.ok(cpp.includes('if (argc > 1)'), '默认值 -> argc 守卫');
});

test('v0.2：schema 生成（数组 items/回调 function/默认值）', () => {
  const schema = JSON.parse(generateSchema(parseIdl(advanced)));
  assert.equal(schema.classes.Playback.methods.sum.params.values.type, 'array');
  assert.equal(schema.classes.Playback.methods.sum.params.values.items.type, 'number');
  assert.equal(schema.classes.Playback.methods.onTick.params.cb.binding, 'callback');
  assert.equal(schema.classes.Playback.methods.play.params.loop.default, false);
});

test('JSON Schema（API 契约）v0.1 回归', () => {
  const schema = JSON.parse(generateSchema(parseIdl(sample)));
  assert.equal(schema.title, 'ccx.hello');
  assert.ok(schema.classes.Greeter.methods.greet.params.name);
  assert.equal(schema.classes.Greeter.methods.add.params.a.type, 'number');
  assert.equal(schema.classes.Greeter.properties.version.readOnly, true);
});

test('出错输入有明确错误', () => {
  assert.throws(() => parseIdl('class A {\n}'), /缺少 module/);
  assert.throws(() => parseIdl('module m;\ngarbage line'), /必须位于 class 内/);
});
