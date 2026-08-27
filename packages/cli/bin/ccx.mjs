#!/usr/bin/env node
// ccx-cli（M1：create / scene new 落地；doctor/version 保留）
// 约定：--json 机器可读；--no-interactive 适配 CI。
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommandBus } from '../../scene-service/src/commands.mjs';
import { renderPlan } from '../../scene-service/src/render_plan.mjs';
import { RpcClient } from '../../service-core/src/client.mjs';

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const positional = args.filter((a) => !a.startsWith('--'));
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--at') flags.at = args[++i];
    if (args[i] === '--type') flags.type = args[++i];
  }
  const sub = positional[0] ?? 'doctor';

  function emit(obj) {
    console.log(jsonMode ? JSON.stringify(obj, null, 2) : JSON.stringify(obj));
    if (!obj.ok) process.exitCode = 1;
  }

  function dirNonEmpty(dir) {
    try {
      return readdirSync(dir).length > 0;
    } catch {
      return false;
    }
  }

  // —— create <path>：项目脚手架（2D 模板）——
  if (sub === 'create') {
    const target = positional[1] ? resolve(positional[1]) : null;
    if (!target) return emit({ ok: false, error: '用法: ccx create <path> [--type 2d]' });
    if (flags.type && flags.type !== '2d') {
      return emit({ ok: false, error: '目前只支持 2d（范围声明见 README）' });
    }
    if (existsSync(target) && dirNonEmpty(target)) {
      return emit({ ok: false, error: '目标目录非空: ' + target });
    }
    mkdirSync(target, { recursive: true });
    cpSync(join(here, '..', 'templates', 'project'), target, { recursive: true });
    return emit({
      ok: true,
      created: target,
      template: '2d',
      files: ['ccx.project.json', 'scenes/main.scene.json', 'scripts/main.ts'],
    });
  }

  // —— scene apply <file> --cmd ...：见下方 apply 分支 ——
  // —— scene new [--at path]：空场景（ADR-003 v1）——
  if (sub === 'scene' && positional[1] === 'new') {
    const out = flags.at ? resolve(flags.at) : resolve('scenes/new.scene.json');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({
      schema: 'ccx.scene/1',
      meta: { name: 'New Scene', generator: 'ccx-cli' },
      entities: [],
      systems: [],
    }, null, 2) + '\n');
    return emit({ ok: true, created: out, schema: 'ccx.scene/1' });
  }

  // —— scene apply <file> --cmd '<json>'（可多次）：CommandBus 唯一写路径 ——
  if (sub === 'scene' && positional[1] === 'apply') {
    const file = positional[2] ? resolve(positional[2]) : null;
    if (!file || !existsSync(file)) {
      return emit({ ok: false, error: '用法: ccx scene apply <file> --cmd '<json>'（可多次）' });
    }
    const cmds = args.filter((a, i) => args[i - 1] === '--cmd');
    if (cmds.length === 0) return emit({ ok: false, error: '缺少 --cmd' });
    let json;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      return emit({ ok: false, error: '场景文件解析失败: ' + e.message });
    }
    const bus = CommandBus.fromSceneFile(json);
    const applied = [];
    for (const raw of cmds) {
      let cmd;
      try {
        cmd = JSON.parse(raw);
      } catch (e) {
        return emit({ ok: false, error: '--cmd 不是合法 JSON: ' + raw });
      }
      try {
        bus.apply(cmd);
      } catch (e) {
        return emit({ ok: false, error: '命令执行失败: ' + e.message });
      }
      applied.push(cmd.op);
    }
    const out = bus.toSceneFile();
    out.meta.generator = 'ccx-cli scene apply';
    writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
    return emit({
      ok: true,
      file,
      applied,
      entityCount: out.entities.length,
      note: 'undo/redo 属会话内能力（SceneService），CLI 一次性提交',
    });
  }

  // —— render plan <file>：渲染计划（场景 -> 稳定排序 -> 合批）——
  if (sub === 'render' && positional[1] === 'plan') {
    const file = positional[2] ? resolve(positional[2]) : null;
    if (!file || !existsSync(file)) {
      return emit({ ok: false, error: '用法: ccx render plan <scene.json>' });
    }
    let json;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      return emit({ ok: false, error: '场景文件解析失败: ' + e.message });
    }
    const plan = renderPlan(json);
    if (jsonMode) return emit({ ok: true, file, ...plan });
    return emit({
      ok: true,
      summary:
        plan.sprites + ' sprites -> ' + plan.batches.length + ' batches',
      batches: plan.batches.map((b) =>
        'atlas=' + b.atlas + ' mat=' + b.material + ' x' + b.count + '@' + b.first).join(' | '),
    });
  }

  // —— service demo：spawn stdio daemon -> RPC 调用 -> 退出 ——
  if (sub === 'service' && positional[1] === 'demo') {
    const daemonEntry = resolve(join(here, '..', '..', 'service-core', 'bin', 'daemon.mjs'));
    const client = new RpcClient(process.execPath, [daemonEntry]);
    try {
      await new Promise((resolve, reject) => {
        const off = client.onEvent((m) => {
          if (m.method === 'system.ready') {
            off();
            resolve();
          }
        });
        setTimeout(() => reject(new Error('daemon 未就绪')), 2000);
      });
      const list = await client.request('asset.list');
      return emit({ ok: true, daemon: 'stdio', assets: list.assets.length });
    } finally {
      client.close();
    }
  }

  // —— doctor / version ——
  if (sub === 'version') return emit({ ok: true, name: '@ccx/cli', version: '0.1.0', milestone: 'M1' });
  if (sub === 'doctor') {
    const cwd = process.cwd();
    const git = spawnSync('git', ['--version'], { encoding: 'utf8' });
    return emit({
      ok: true,
      tool: 'ccx doctor',
      cwd,
      checks: {
        node: process.version,
        git: git.status === 0 ? git.stdout.trim() : 'missing',
        'engine/ 骨架': existsSync(join(cwd, 'engine', 'foundation', 'include')),
        'packages/ 骨架': existsSync(join(cwd, 'packages')),
        'docs/ 规格': existsSync(join(cwd, 'docs', 'engine-spec.md')),
        'ci/gates': existsSync(join(cwd, 'ci', 'gates')),
        'CMakeLists': existsSync(join(cwd, 'CMakeLists.txt')),
        'mise.toml': existsSync(join(cwd, '.mise.toml')),
      },
    });
  }
  return emit({
    ok: false,
    error: 'unknown subcommand: ' + sub,
    usage: 'ccx create|scene new|doctor|version [--json]',
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
