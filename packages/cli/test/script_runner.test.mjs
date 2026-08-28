import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = import.meta.dirname;
const root = join(here, '..', '..', '..');
const exe = process.env.CCX_RUNNER_EXE ??
  join(root, 'build', 'local', 'engine', 'tests', 'ccx_script_runner.exe');

test('引擎脚本执行器：裸命令 + JS 双模式（QuickJS 真路径）', async (t) => {
  if (!existsSync(exe)) {
    t.skip('未构建 ccx_script_runner');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'ccx-run-'));
  try {
    // 裸命令
    const cmds = [
      '{"op":"create_entity","name":"hero"}',
      '# comment',
      '{"op":"create_entity","name":"npc"}',
      '{"op":"add_component","id":0,"type":"game.Health","data":{"max":100}}',
    ].join('\n');
    const inFile = join(dir, 'cmds.ccx.js');
    const outFile = join(dir, 'out.scene.json');
    writeFileSync(inFile, cmds + '\n');
    const r = spawnSync(exe, [inFile, outFile], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const meta = JSON.parse(r.stdout.trim());
    assert.equal(meta.commands, 3);
    assert.equal(meta.entities, 2);
    const scene = JSON.parse(readFileSync(outFile, 'utf8'));
    assert.equal(scene.schema, 'ccx.scene/1');
    assert.equal(scene.entities.length, 2);
    // JS 模式：脚本调 ccxSceneCommand 建实体 + 表达式
    const jsFile = join(dir, 'js.ccx.js');
    writeFileSync(jsFile,
      "ccxSceneCommand('{\"op\":\"create_entity\",\"name\":\"wen\"}');\n" +
      '1 + 2\n');
    const r2 = spawnSync(exe, [jsFile, join(dir, 'js.json'), '-j'], { encoding: 'utf8' });
    assert.equal(r2.status, 0, r2.stderr);
    const meta2 = JSON.parse(r2.stdout.trim());
    assert.equal(meta2.entities, 1, 'JS 模式实体 1');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
