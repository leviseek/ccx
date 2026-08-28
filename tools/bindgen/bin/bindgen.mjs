#!/usr/bin/env node
// ccx-bindgen CLI：ccx-bindgen <input.idl> [--out <dir>]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseIdl } from '../src/idl.mjs';
import { generateDts, generateNapi, generateQuickjs, generateSchema } from '../src/generators.mjs';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : '.';
if (!input) {
  console.error('usage: ccx-bindgen <input.idl> [--out <dir>]');
  process.exit(1);
}
const ir = parseIdl(readFileSync(input, 'utf8'));
mkdirSync(outDir, { recursive: true });
const base = ir.module.replace(/\./g, '_');
writeFileSync(join(outDir, base + '_bindings.cpp'), generateNapi(ir));
writeFileSync(join(outDir, base + '.d.ts'), generateDts(ir));
writeFileSync(join(outDir, base + '.schema.json'), generateSchema(ir));
if (args.includes('--quickjs')) {
  writeFileSync(join(outDir, base + '_quickjs.c'), generateQuickjs(ir));
}
console.log('ccx-bindgen: ' + ir.module + ' -> ' + outDir +
  ' (' + ir.classes.length + ' class, ' +
  ir.classes.reduce((n, c) => n + c.methods.length + c.props.length, 0) + ' members)');
